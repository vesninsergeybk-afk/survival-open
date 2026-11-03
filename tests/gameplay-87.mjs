/**
 * Survivor 8.7 — dependency-free regression suite.
 * Run from the game directory: node --test tests/gameplay-87.mjs
 * Source is evaluated in an isolated function because browser-only ESM imports
 * also initialize image/sound loaders and do not run directly in Node.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const strip = source => source
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;\s*/gm, '')
    .replace(/^\s*export\s+/gm, '');
const evaluate = (name, dependencies, result) => {
    const source = strip(read(name));
    const keys = Object.keys(dependencies);
    return new Function(...keys, source + '\nreturn ' + result + ';')(
        ...keys.map(k => dependencies[k])
    );
};

const CONFIG = evaluate('config.js', {}, 'CONFIG');
const {WEAPONS,PASSIVES,ENEMIES} = evaluate('data.js', {}, '({WEAPONS,PASSIVES,ENEMIES})');
const {buildSkillTree,skillChoice,SKILL_BRANCHES} = evaluate(
    'skill-tree.js', {CONFIG,WEAPONS,PASSIVES},
    '({buildSkillTree,skillChoice,SKILL_BRANCHES})'
);
const CombatDirector = evaluate('combat-director.js', {atlas:{}}, 'CombatDirector');
const WaveDirector = evaluate('wave-director.js', {}, 'WaveDirector');
const {createWorldCaches,updateWorldCaches} = evaluate('world-caches.js',
    {CONFIG,atlas:{}}, '({createWorldCaches,updateWorldCaches})');
const UI = evaluate('ui.js', {buildSkillTree,skillChoice}, 'UI');
const FriendlyBases = evaluate('friendly-bases.js', {
    CONFIG, ENEMIES, Enemy:class {}, Projectile:class {},
    STATION_PARTS:{arc:0,missile:1,rail:2},
    drawStationPart:()=>{},drawCombatImpact:()=>{}
}, 'FriendlyBases');

const source = read('entities.js');
const start = source.indexOf('export class Enemy {');
const end = source.indexOf('export class EnemyProjectile', start);
assert.ok(start >= 0 && end > start);
const Enemy = new Function('CONFIG','findEnemyDef','EnemyProjectile','getEnemySprite',
    source.slice(start,end).replace('export class Enemy','class Enemy') + '\nreturn Enemy;'
)(CONFIG,()=>null,class {},()=>null);

test('all 31 skill nodes are visible; ranks and station locks are enforced', () => {
    assert.equal(SKILL_BRANCHES.reduce((sum,b)=>sum+b.tiers.flat().length,0),31);
    const player={level:2,weapons:[{id:'starter_pulse',level:1}],passives:{}};
    const network={enabled:true,technologyTier:0,getUpgradeCap:()=>2,hasActivatedType:()=>false};
    const first=buildSkillTree(player,network);
    assert.ok(first.available.some(n=>n.id==='starter_pulse'));
    assert.equal(first.branches.flatMap(b=>b.tiers.flat())
        .find(n=>n.id==='railgun').state,'locked');
    player.weapons[0].level=2;
    assert.equal(skillChoice(player,network,'weapon','starter_pulse'),null);
    network.technologyTier=3;network.getUpgradeCap=()=>5;player.level=9;
    assert.ok(skillChoice(player,network,'weapon','starter_pulse'));
});

test('overlapping meteors give a normalized, finite escape vector', () => {
    const director=new CombatDirector();
    director.addZone(-70,0,80,1,20);
    director.addZone(70,0,80,1,20);
    for(const [x,y] of [[0,0],[1,0],[0,12],[-10,10]]) {
        const v=director.avoidanceVector(x,y,15,.7);
        assert.ok(v && Number.isFinite(v.x) && Number.isFinite(v.y));
        assert.ok(Math.abs(Math.hypot(v.x,v.y)-1)<.001);
    }
});

test('enemy escape has bounded turns and does not stall inside a warning zone', () => {
    const type={id:'test',size:14,hp:100,speed:130,damage:5,exp:10,
        color:'#fff',archetype:'chaser'};
    const enemy=new Enemy(0,0,type,1,1);
    const game={gameTime:40,player:{x:280,y:0,vx:0,vy:0},
        enemies:[enemy],mines:[],battleDirector:{
            avoidanceVector(x){return x<100?{x:0,y:1,intensity:.95}:null;}
        }};
    let last=null, observedTurn=false;
    for(let i=0;i<120;i++) {
        // Reverse the pursuit target midway through the escape: a sharp
        // desired turn must still produce a smooth on-screen hull rotation.
        if(i===48) {
            game.battleDirector.avoidanceVector=()=>null;
            game.player.x=-400;
        }
        game.gameTime+=1/60;enemy.update(1/60,game);
        if(last!==null) {
            const delta=Math.atan2(Math.sin(enemy.visualAngle-last),
                Math.cos(enemy.visualAngle-last));
            assert.ok(Math.abs(delta)<.35);
            if(Math.abs(delta)>.015)observedTurn=true;
        }
        last=enemy.visualAngle;
    }
    assert.ok(observedTurn);
    assert.ok(Math.hypot(enemy.x,enemy.y)>60);
});

test('meteor escape cannot cancel pursuit into a stationary hover', () => {
    const type={id:'test',size:14,hp:100,speed:100,damage:5,exp:10,
        color:'#fff',archetype:'chaser'};
    const enemy=new Enemy(0,0,type,1,1);
    const game={gameTime:40,player:{x:500,y:0,vx:0,vy:0},mines:[],
        battleDirector:{avoidanceVector:()=>({x:-1,y:0,intensity:.46})}};
    enemy._moveWithTactics(1/60,game,100,0,1);
    assert.ok(enemy.x < -.45, 'ship must visibly move OUT of the meteor marker');
});

test('reactive shield absorbs damage before the remaining standard shield', () => {
    const type={id:'shield',size:14,hp:100,speed:50,damage:5,exp:10,
        color:'#fff',shielded:true,shieldHp:50,damageReduction:.5};
    const enemy=new Enemy(0,0,type,1,1);
    enemy.reactiveShieldHp=10;
    enemy.takeDamage(30);
    assert.equal(enemy.hp,90);
    assert.equal(enemy.shieldHp,40);
});

test('exploration and activation rewards happen once; next objective is scanned', () => {
    let exp=0;
    const game={player:{x:12000,y:8000,hp:110,maxHp:110,gainExp:n=>exp+=n},
        worldObstacles:[],stageId:'forest',gameTime:5,enemies:[],run:{},
        worldVfx:{nova(){},boostDrop(){}},createFloatingText(){},_announce(){}};
    const bases=new FriendlyBases();
    bases.reset(game,true);
    const home=bases.bases.find(b=>b.id==='home');
    assert.ok(home.discovered && !home.visited);
    game.player.x=home.x;game.player.y=home.y;
    bases.revealNearby(game);bases.revealNearby(game);
    assert.equal(exp,12);
    assert.ok(bases.buy(game,home,'activate').ok);
    assert.equal(exp,36);
    assert.equal(bases.credits,10);
    const target=bases.expeditionTarget(game);
    assert.ok(target?.scanned && !target.activated);
    assert.equal(bases.setNavigationTarget(target.id),true);
    assert.equal(bases.status(game).objective.id,target.id);
});

test('render paths share cached sprites and warning cues are not skipped', () => {
    assert.doesNotMatch(read('entities.js'),/drawCombatShip\(ctx,this\.id/);
    const render=read('main.js').split('_renderEnemies(ctx) {')[1].split('_drawGrid()')[0];
    assert.doesNotMatch(render,/e\.render\(ctx\);\s*continue;/);
    assert.match(render,/if \(e\.aimTimer > 0\)/);
});

test('moving expeditions meet opponents ahead; competitive spawn angles stay fixed', () => {
    const make = (enabled, vx = 225, vy = 0) => ({
        gameTime:26,kills:0,player:{level:2,vx,vy,hp:100,maxHp:100},
        enemies:[],friendlyBases:{enabled}
    });
    const expedition = new WaveDirector();
    const first = expedition.step(4,make(true));
    assert.ok(first.spawn);
    assert.ok(Math.cos(first.angle) > .9);
    const sideways = expedition.step(4,make(true,0,-225));
    assert.ok(Math.sin(sideways.angle) < -.9);
    const stationary = new WaveDirector().step(4,make(true,0,0));
    const competitive = new WaveDirector().step(4,make(false));
    assert.equal(stationary.angle,competitive.angle);
});

test('rare research capsules appear only on expeditions, reveal on approach and pay once', () => {
    const caches=createWorldCaches('forest',true);
    const signals=caches.filter(c=>c.kind==='signal');
    assert.ok(signals.length>=5);
    assert.ok(createWorldCaches('forest',false).every(c=>c.kind==='supplies'));
    const item=signals[0];let exp=0,credits=0;
    const game={worldCaches:caches,player:{
        x:item.x+640,y:item.y,gainExp:n=>{exp+=n;}
    },friendlyBases:{addCredits:n=>{credits+=n;}},
    run:{},createFloatingText(){},createParticles(){},_announce(){}};
    updateWorldCaches(game);
    assert.ok(item.discovered && !item.opened);
    game.player.x=item.x;updateWorldCaches(game);updateWorldCaches(game);
    assert.ok(item.opened);
    assert.equal(exp,24);assert.equal(credits,22);
    assert.equal(game.run.signalsRecovered,1);
});

test('skill tree can be studied from pause without spending a level', () => {
    class El {
        constructor() {
            this.children=[];this.parentElement=null;this.listeners={};
            this.className='';this.style={};this.classList={add(){},remove(){}};
        }
        appendChild(child) {
            if (child.parentElement)
                child.parentElement.children=child.parentElement.children.filter(x=>x!==child);
            this.children.push(child);child.parentElement=this;
        }
        setAttribute(){}
        addEventListener(name,callback){this.listeners[name]=callback;}
        set innerHTML(value){this.children=[];}
        focus(){this.focused=true;}
        querySelector(selector){
            const classes=selector.split('.').filter(Boolean);
            const queue=[this];
            while(queue.length){
                const child=queue.shift();
                if(classes.every(c=>child.className.split(' ').includes(c)))return child;
                queue.push(...child.children);
            }
            return null;
        }
    }
    const original=new El(),modal=new El();
    original.appendChild(modal);
    const root=new El(),tech=new El(),title=new El(),body=new El();
    const previous=globalThis.document;
    globalThis.document={body,createElement:()=>new El(),getElementById:()=>title};
    try {
        const ui=Object.create(UI.prototype);
        ui.els={levelUpMenu:modal,upgradeOptions:root,levelUpTechNote:tech};
        ui.game={buildStyle:'fighter',friendlyBases:{
            enabled:true,technologyTier:0,getUpgradeCap:()=>2,
            hasActivatedType:()=>false,bases:[]
        }};
        const player={level:2,weapons:[{id:'starter_pulse',level:1}],passives:{}};
        let picked=0,closed=0;
        ui.showSkillTree(player,()=>picked++,{
            preview:true,onClose:()=>closed++
        });
        assert.equal(modal.parentElement,body);
        assert.equal(root.querySelector('.skill-node.available').disabled,true);
        assert.equal(root.querySelector('.skill-supply'),null);
        root.querySelector('.skill-tab').listeners.click();
        assert.equal(root.querySelector('.skill-node.available').disabled,true);
        root.querySelector('.skill-preview-close').listeners.click();
        assert.equal(closed,1);
        ui.showSkillTree(player,()=>picked++);
        root.querySelector('.skill-node.available').listeners.click();
        assert.equal(picked,1);
    } finally {
        globalThis.document=previous;
    }
});

test('replay cannot replace the saved stage, difficulty or run counter', () => {
    const main=read('main.js');
    const replay=main.slice(main.indexOf('    _beginReplay(blob, speed)'),
        main.indexOf('    toggleMap()'));
    assert.doesNotMatch(replay,/this\.save\.settings\.(?:stage|difficulty)\s*=/);
    assert.match(main,/if \(!this\.replayActive\) \{\s*this\.save\.runs/);
});
