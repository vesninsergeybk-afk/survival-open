/**
 * Pacing and tactical consequences of authored Survivor missions.
 * Run: node --test site/games/survivor/tests/campaign-pacing.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=path=>readFileSync(resolve(root,path),'utf8');
const worldSrc=source('src/mission-world.js');
const mainSrc=source('src/main.js');
const html=source('index.html');
const sw=source('service-worker.js');
const layoutSrc=source('src/mission-layouts.js');
const getMissionScene=new Function(
    layoutSrc.replace(/\bexport (?=(function|const)\b)/g,'')+
    '\nreturn getMissionScene;')();
const ENEMIES=Object.fromEntries(['BAT','STALKER','ZOMBIE','WOLF',
    'MAGE','GUNSHIP'].map(name=>[name,{id:name}]));
class Enemy{
    constructor(x,y,def){
        Object.assign(this,{x,y,def,hp:50,maxHp:50,flashTimer:0,speed:70});
    }
}
const World=new Function('getMissionScene','Enemy','ENEMIES',
    worldSrc.replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm,'')
        .replace(/\bexport (?=(class|function|const)\b)/g,'')+
        '\nreturn MissionWorld;')(getMissionScene,Enemy,ENEMIES);

function fixture(index){
    const game={gameTime:0,state:'playing',player:{x:0,y:0,vx:0,vy:0},
        enemies:[],worldObstacles:[],worldVfx:{nova(){},hit(){}},
        _announce(){},_spawnOne(){},createFloatingText(){},
        createParticles(){},friendlyBases:{credits:80,bases:[],addCredits(){}}};
    const world=new World(game,index);
    game.friendlyBases.bases=world.scene.stations.map(st=>({
        x:st.dx,y:st.dy,activated:true,hp:200,maxHp:200,
        turrets:[],defense:{active:0}
    }));
    return {world,game};
}
test('alpha waits for the player instead of spawning a remote battle',()=>{
    const {world,game}=fixture(1);
    world.first.beacons=1;world.first.nextWave=7;
    game.gameTime=8;game.player.x=3000;game.player.y=1800;
    world._updateFirstMission(game,.016,1,1);
    assert.equal(world.first.alpha,0);
    assert.equal(game.enemies.length,0);
    assert.match(world._objectiveRaw(game),/вернитесь к маяку/);
    const beacon=world.props.find(p=>p.id==='beacon-1');
    game.player.x=beacon.x;game.player.y=beacon.y;
    world._updateFirstMission(game,.016,1,1);
    assert.equal(world.first.alpha,1);
    assert.ok(game.enemies.length>=8);
});
test('second alpha wave follows the first with a short, guaranteed pause',()=>{
    const {world,game}=fixture(1);
    world.first.beacons=1;world.first.nextWave=7;
    game.gameTime=8;world._updateFirstMission(game,.016,1,1);
    assert.equal(world.first.alpha,1);
    game.gameTime=70;world._updateFirstMission(game,.016,1,1);
    assert.equal(world.first.alpha,1,'living wave must block the next wave');
    game.enemies=[];
    game.gameTime=72;world._updateFirstMission(game,.016,1,1);
    assert.equal(world.first.alpha,1,'a breathing interval remains');
    game.gameTime=76;world._updateFirstMission(game,.016,1,1);
    assert.equal(world.first.alpha,2);
});
test('alpha objective points at live attackers, not only the old beacon',()=>{
    const {world,game}=fixture(1);
    world.first.beacons=1;world.first.alpha=2;
    const e={x:890,y:-240,hp:30,missionBeaconWave:'alpha'};
    game.enemies.push(e);
    assert.equal(world.target(game),e);
});
test('enemy cap cannot count a wave that never spawned',()=>{
    const {world,game}=fixture(1);
    world.first.beacons=1;world.first.nextWave=7;
    game.gameTime=8;game.enemies=Array.from({length:55},()=>({hp:50}));
    world._updateFirstMission(game,.016,1,1);
    assert.equal(world.first.alpha,0);
});
test('beta saboteurs cannot damage the beacon while the pilot is absent',()=>{
    const {world,game}=fixture(1);
    const beacon=world.props.find(p=>p.id==='beacon-2');
    world.first.beacons=2;world.first.nextWave=7;beacon.used=true;
    game.player.x=beacon.x;game.player.y=beacon.y;game.gameTime=8;
    world._updateFirstMission(game,.016,1,1);
    const saboteur=game.enemies.find(e=>e.missionSaboteur);
    assert.ok(saboteur);
    saboteur.x=beacon.x;saboteur.y=beacon.y;saboteur.attackClock=.2;
    const health=world.first.betaHp;
    game.player.x=4500;game.player.y=4500;
    saboteur.update(1,game);
    assert.equal(world.first.betaHp,health);
    game.player.x=beacon.x;game.player.y=beacon.y;
    saboteur.update(1,game);
    assert.equal(world.first.betaHp,health-10);
});
test('convoy combat bonus is local, capped and cannot skip the final seconds',()=>{
    const {world}=fixture(4),c=world.convoy;
    c.phase='charging';c.hold=70;c.combatCharge=0;
    const near={x:c.x+100,y:c.y+60,missionConvoyRaider:true};
    assert.deepEqual(Array.from({length:4},()=>
        world.onEnemyDestroyed({...near})),[6,6,6,0]);
    assert.equal(c.hold,52);assert.equal(c.combatCharge,18);
    assert.equal(world.onEnemyDestroyed({x:c.x+900,y:c.y,
        missionConvoyRaider:true}),0);
    assert.equal(world.onEnemyDestroyed({x:c.x,y:c.y}),0);
    c.combatCharge=0;c.hold=3;
    assert.equal(world.onEnemyDestroyed({...near}),1);
    assert.equal(c.hold,2);
});
test('each new relay resets earned acceleration and provides a new challenge',()=>{
    const {world,game}=fixture(4),c=world.convoy;
    c.combatCharge=18;c.hold=12;c.raidClock=1000;
    c.x=world.route[0].x;c.y=world.route[0].y;
    world._updateConvoy(game,.1);
    assert.equal(c.phase,'charging');
    assert.equal(c.combatCharge,0);
    assert.ok(c.hold>65);
});
test('leaving a relay pauses charging and prevents offscreen transport damage',()=>{
    const {world,game}=fixture(4),c=world.convoy;
    const stop=world.route[0];
    c.x=stop.x;c.y=stop.y;c.raidClock=0;
    game.player.x=c.x+950;game.player.y=c.y;
    world._updateConvoy(game,1);
    assert.equal(c.phase,'charging');
    assert.equal(c.hold,stop.hold);
    assert.match(world._objectiveRaw(game),/Зарядка остановлена/);
    game.player.x=c.x;game.player.y=c.y;
    world._updateConvoy(game,1);
    assert.ok(c.hold<stop.hold);
    const attacker=game.enemies.find(e=>e.missionConvoyRaider);
    assert.ok(attacker);
    attacker.x=c.x;attacker.y=c.y;
    const hp=c.hp;
    game.player.x=c.x+950;
    attacker.update(10,game);
    assert.equal(c.hp,hp);
    game.player.x=c.x;game.player.y=c.y;
    attacker.update(10,game);
    assert.ok(c.hp<hp);
});
test('on-screen feedback and offline version use the current pacing rules',()=>{
    assert.match(mainSrc,/РЕЛЕ · ЗАРЯДКА −/);
    assert.match(mainSrc,/mission-world\.js\?v=routes-102/);
    assert.match(html,/main\.js\?v=routes-102/);
    for(const file of ['main','mission-world','prologue-mission'])
        assert.match(sw,new RegExp(file+'\\.js\\?v=routes-102'));
});
