/**
 * 8.9 launch guard: mission-one encounter, three-beacon gating and skills.
 * Run: node --test site/games/survivor/tests/mission-one-redesign.test.mjs
 * No browser or dependencies required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=file=>readFileSync(resolve(root,file),'utf8');
const layouts=new Function(source('src/mission-layouts.js')
    .replace(/\bexport (?=(function|const)\b)/g,'')+
    '\nreturn {getMissionScene,makeMissionAsteroids};')();
class TestEnemy{
    constructor(x,y,def,hp=1){
        Object.assign(this,{x,y,hp:(def.hp||15)*hp,maxHp:(def.hp||15)*hp,
            def,boss:!!def.boss,flashTimer:0,fireTimer:0});
    }
    _shoot(){}
}
const dependencies={
    GameState:{PLAYING:'play',MENU:'menu'},damageWorldObstacles:()=>{},
    BOSSES:{HUNTER:{hp:1250,boss:true}},
    ENEMIES:{BAT:{id:'bat',hp:15},ZOMBIE:{id:'zombie',hp:30},
        STALKER:{id:'stalker',hp:32},WOLF:{id:'wolf',hp:44},
        BOMBER:{id:'bomber',hp:34}},
    Enemy:TestEnemy,MISSION_PROFILES:[],isMissionUnlocked:()=>true,
    readCampaign:()=>({}),...layouts,
    drawMissionBackdrop:()=>{},drawMissionForeground:()=>{},
    MissionLog:class{reset(){} note(){} open(){}},
    window:{matchMedia:()=>({matches:false})}
};
const worldBody=source('src/mission-world.js')
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"];\s*$/gm,'')
    .replace(/\bexport (?=(class|function|const)\b)/g,'');
const World=new Function(...Object.keys(dependencies),
    worldBody+'\nreturn MissionWorld;')(...Object.values(dependencies));

function setup(){
    const player={x:0,y:0,level:1,exp:0,fieldSkills:{},
        gainExp(amount){this.exp+=amount;}};
    const vfx={nova(){},hit(){},boostCollect(){},bossPortal(){}};
    const network={bases:[{}],credits:200,bombTraces:[],
        addCredits(amount){this.credits+=amount;}};
    const game={player,state:'play',gameTime:0,enemies:[],beams:[],
        friendlyBases:network,worldVfx:vfx,
        _announce(){},createParticles(){},createFloatingText(){},
        _spawnOne(){},gameOver(){this.over=true;},
        _spawnBoss(def){this.enemies.push(new TestEnemy(0,0,def));}};
    const world=new World(game,1);
    world._updateHud=()=>{};
    world.enter(game);
    return {game,world,player,network};
}
function near(game,point){game.player.x=point.x;game.player.y=point.y;}
test('first mission is authored, spacious and uses three independent relays',()=>{
    const scene=layouts.getMissionScene(1);
    const rocks=layouts.makeMissionAsteroids(1,0,0);
    assert.equal(scene.props.filter(x=>x.type==='beacon').length,3);
    assert.equal(scene.stations.length,4);
    assert.ok(rocks.length>=180);
    assert.ok(scene.props.filter(x=>x.type==='cache').length>=6);
    assert.ok(scene.stations.at(-1).dx-scene.stations[0].dx>3000);
    for(const rock of rocks){
        for(const p of [...scene.stations,...scene.props.filter(x=>x.type==='beacon')])
            assert.ok(Math.hypot(rock.x-p.dx,rock.y-p.dy)>150);
    }
});
test('relays unlock after real defense objectives without a farming gate',()=>{
    const {game,world,player,network}=setup();
    const [a,b,c]=['beacon-1','beacon-2','beacon-3'].map(id=>
        world.props.find(x=>x.id===id));
    assert.equal(world.beaconUnlocked(game,a),false);
    network.bases[0].activated=true;
    assert.equal(world.beaconUnlocked(game,a),true);
    near(game,a);assert.equal(world.interact(game),true);
    assert.equal(world.beaconUnlocked(game,b),false);
    game.gameTime=10;world.update(game,1,1,1);
    assert.equal(world.first.alpha,1);
    game.gameTime=50;world.update(game,1,1,1);
    assert.equal(world.first.alpha,2);
    assert.equal(world.beaconUnlocked(game,b),false);
    game.enemies=[];
    assert.equal(world.beaconUnlocked(game,b),true);
    near(game,b);assert.equal(world.interact(game),true);
    game.gameTime=67;world.update(game,1,1,1);
    game.gameTime=110;world.update(game,1,1,1);
    assert.equal(world.first.beta,2);
    game.enemies=[];
    // All scheduled defenders are gone; no arbitrary XP grinding is required.
    assert.equal(world.beaconUnlocked(game,c),true);
    near(game,c);assert.equal(world.interact(game),true);
    assert.equal(world.first.beacons,3);
});
test('an unavailable beacon explains its prerequisites when approached',()=>{
    const {game,world,network}=setup();
    const beta=world.props.find(p=>p.id==='beacon-2');
    near(game,beta);
    assert.match(world.blockedInteraction(game).reason,/ЗАПУСТИТЕ ВЕРФЬ/);
    network.bases[0].activated=true;
    assert.match(world.blockedInteraction(game).reason,/ВКЛЮЧИТЕ «АЛЬФУ»/);
});
test('sabotage can capture Beta and force reactivation',()=>{
    const {game,world,network}=setup();
    network.bases[0].activated=true;
    world.first.beacons=2;world.first.betaHp=0;
    world.props.find(p=>p.id==='beacon-2').used=true;
    game.gameTime=50;world.update(game,1,1,1);
    assert.equal(world.first.beacons,1);
    assert.equal(world.props.find(p=>p.id==='beacon-2').used,false);
    assert.equal(world.first.betaHp,world.first.betaMaxHp);
});
test('bombers break turrets; stasis absorbs attacks; green beam repairs',()=>{
    const {game,world,player,network}=setup();
    const bases=network.bases;
    const target=bases[2];target.activated=true;
    target.turrets=[{mount:0,integrity:100,disabled:false}];
    world.first.beacons=3;
    world._spawnFinalSiege(game);
    const bomber=game.enemies.find(e=>e.missionSiegeBomber);
    assert.ok(bomber,'A bomber must be present');
    bomber.x=target.x+150;bomber.y=target.y;
    // The siege runs locally when the pilot is defending Gamma's stations.
    near(game,target);
    bomber.strikeTimer=0;bomber.update(1,game);
    assert.equal(target.turrets[0].integrity,66);
    player.fieldSkills.station_stasis=1;
    near(game,target);game.gameTime=2;
    assert.equal(world.useStationStasis(game),true);
    const shieldBefore=target.defense.reserve;
    bomber.strikeTimer=0;bomber.update(1,game);
    assert.equal(target.turrets[0].integrity,66);
    assert.ok(target.defense.reserve<shieldBefore);
    player.fieldSkills.field_repair=1;
    assert.equal(world.useRepairBeam(game),true);
    assert.equal(target.turrets[0].integrity,100);
    assert.equal(game.beams[0].color,'#5fff90');
});
test('skill tree has unlockable active skills and visible prerequisite edges',()=>{
    const skills=source('src/skill-tree.js');
    const ui=source('src/ui.js');
    const main=source('src/main.js');
    const html=source('index.html');
    const bases=source('src/friendly-bases.js');
    assert.match(skills,/[\x27\x22]ability:station_stasis[\x27\x22]/);
    assert.match(skills,/field_repair/);
    assert.match(skills,/parents/);
    assert.match(ui,/skill-links/);
    assert.match(ui,/skill-inspect/);
    assert.match(main,/choice\.type === 'ability'/);
    assert.match(main,/!e\.missionBeaconWave && !e\.missionFinalRaider/);
    assert.match(main,/event\.code==='Space'/);
    assert.match(main,/event\.code==='KeyQ'/);
    assert.match(html,/id="missionRepairAbility"/);
    assert.match(html,/id="missionStasisAbility"/);
    assert.match(bases,/missionStasis\?\.rank>=2/);
});


test('pilot without Engineering can repair disabled turrets at a higher cost',()=>{
    const {game,world,player,network}=setup();
    const base=network.bases[2];
    base.activated=true;
    base.turrets=[{integrity:0,disabled:true}];
    network.credits=80;
    near(game,base);
    assert.equal(player.fieldSkills.field_repair,undefined);
    assert.equal(world.useRepairBeam(game),true);
    assert.equal(base.turrets[0].integrity,30);
    assert.equal(base.turrets[0].disabled,false);
    assert.equal(network.credits,62);
    assert.equal(world.useRepairBeam(game),false,'cooldown prevents immediate repeat');
    game.gameTime=21;
    player.fieldSkills.field_repair=1;
    assert.equal(world.useRepairBeam(game),true);
    assert.equal(base.turrets[0].integrity,80);
    assert.equal(network.credits,52);
});

test('bombers cause no remote damage while siege clock is suspended',()=>{
    const {game,world,network}=setup();
    const bases=network.bases;
    bases.forEach(b=>{b.activated=true;b.turrets=[{integrity:100,disabled:false}];});
    world.first.beacons=3;
    world._spawnFinalSiege(game);
    const bomber=game.enemies.find(e=>e.missionSiegeBomber);
    assert.ok(bomber);
    const target=bases[2]; // wave 1, bomber 0 targets bastion 2
    bomber.x=target.x+150;bomber.y=target.y;
    bomber.strikeTimer=0;
    const gamma=world.props.find(p=>p.id==='beacon-3');
    game.player.x=gamma.x+1200;game.player.y=gamma.y;
    bomber.update(1,game);
    assert.equal(target.turrets[0].integrity,100);
    near(game,gamma);
    bomber.update(1,game);
    assert.equal(target.turrets[0].integrity,66);
});

test('linked working turrets recharge shield; victory follows objectives, not minute nine',()=>{
    const {game,world,network}=setup();
    network.bases.forEach(b=>{
        b.activated=true;b.turrets=[{integrity:100,disabled:false}];
    });
    const f=world.first;
    f.beacons=3;
    f.siegeWaves=3;
    f.siegeElapsed=130;
    f.nextSiege=200;
    f.coreHp=300;
    f.lastCoreHitAt=0;
    world.bossStarted=true;
    world.boss=new TestEnemy(0,0,{hp:1000});
    world.boss.hp=0; // killed and removed from game.enemies
    const gamma=world.props.find(p=>p.id==='beacon-3');
    near(game,gamma);
    game.gameTime=390;
    world._victory=()=>{world.victory=true;};
    world.update(game,1,1,1);
    assert.ok(f.coreHp>300,'live defensive network recharges Gamma');
    assert.equal(world.victory,true,'a successful player does not wait until 9:00');
});

test('final siege contains precisely three escalating waves with early warning',()=>{
    const {game,world,network}=setup();
    network.bases[0].activated=true;
    world.first.beacons=3;
    const gamma=world.props.find(p=>p.id==='beacon-3');
    near(game,gamma);
    game.gameTime=200;
    world.first.siegeElapsed=32;world.first.nextSiege=42;
    world._updateFirstMission(game,0.1,1,1);
    assert.equal(world.first.warnedSiegeWave,1);
    world.first.siegeElapsed=42;world._updateFirstMission(game,0.1,1,1);
    assert.equal(world.first.siegeWaves,1);
    assert.equal(game.enemies.filter(e=>e.missionSiegeBomber).length,1);
});
