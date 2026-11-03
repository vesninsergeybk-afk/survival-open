/**
 * Behavioral release guards for the first five Survivor missions.
 * Run: node --test site/games/survivor/tests/mission-interactions.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=name=>readFileSync(resolve(root,name),'utf8');
const missionSource=source('src/mission-world.js');
const prologueSource=source('src/prologue-mission.js');
const main=source('src/main.js');
const index=source('index.html');
const sw=source('service-worker.js');
const sceneSource=source('src/mission-layouts.js');
const getMissionScene=new Function(
    sceneSource.replace(/\bexport (?=(function|const)\b)/g,'')+
    '\nreturn getMissionScene;')();
const GameState={PLAYING:'playing',DOCK:'dock'};
const MissionWorld=new Function('getMissionScene','GameState',
    missionSource.replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm,'')
        .replace(/\bexport (?=(class|function|const)\b)/g,'')+
        '\nreturn MissionWorld;')(getMissionScene,GameState);

function fixture(index){
    const game={state:GameState.PLAYING,gameTime:0,
        player:{x:0,y:0,level:1,exp:0},
        enemies:[],worldObstacles:[],friendlyBases:{
            bases:[],credits:80,dockable:()=>null}};
    const world=new MissionWorld(game,index);
    game.friendlyBases.bases=world.scene.stations.map((base,i)=>({
        ...base,id:'test-'+i,x:base.dx,y:base.dy,
        activated:false,hp:200,maxHp:200,missionOptional:!!base.optional,
        turrets:[],displayName:base.name
    }));
    return {game,world};
}
test('nearest campaign station is a visible and functional action',()=>{
    const {game,world}=fixture(1);
    const station=game.friendlyBases.bases[0];
    game.player.x=station.x;game.player.y=station.y;
    game.friendlyBases.dockable=()=>station;
    const action=world.canInteract(game);
    assert.equal(action.type,'station-panel');
    assert.equal(action.activated,false);
    game.openBaseDock=()=>{game.state=GameState.DOCK;};
    assert.equal(world.interact(game),true);
    assert.equal(game.state,GameState.DOCK);
    assert.match(missionSource,/interactive.type==='station-panel'/);
    assert.match(missionSource,/ПОДКЛЮЧИТЬ СТАНЦИЮ/);
});
test('nearby mission objects take priority over a station panel',()=>{
    const {game,world}=fixture(2);
    const cache=world.props.find(p=>p.id==='cache-a');
    game.player.x=cache.x;game.player.y=cache.y;
    game.friendlyBases.dockable=()=>game.friendlyBases.bases[0];
    assert.equal(world.canInteract(game).type,'cache');
});
test('quarry mission explains why the ore carrier has stopped',()=>{
    const {game,world}=fixture(2);
    game.friendlyBases.bases.forEach(b=>b.activated=true);
    world.sealRemaining=()=>4;
    world.quarry.started=true;world.quarry.completed=false;
    assert.match(world._objectiveRaw(game),/«Крот» ждёт вас/);
    game.player.x=world.quarry.rig.x;game.player.y=world.quarry.rig.y;
    assert.match(world._objectiveRaw(game),/«Крот»: развилка/);
});
test('the quarry gate explains every prerequisite in sequence',()=>{
    const {game,world}=fixture(2);
    const gate=world.props.find(p=>p.type==='gate');
    game.player.x=gate.x;game.player.y=gate.y;
    world.quarry.completed=true;
    world.enemySiteAlive=()=>false;
    world.allBasesActive=()=>true;
    assert.match(world.blockedInteraction(game).reason,/АВАРИЙНОГО СИГНАЛА/);
    world.quarry.overload=true;
    assert.match(world.blockedInteraction(game).reason,/БРОНЕНОСЕЦ В ПУТИ/);
    world.bossStarted=true;world.boss={hp:100};
    game.enemies=[world.boss];
    assert.match(world.blockedInteraction(game).reason,/ДРОБИЛЬЩИКА/);
    game.enemies=[];
    assert.equal(world.canInteract(game).type,'gate');
});
test('jammer explicitly requires functioning mandatory stations',()=>{
    const {game,world}=fixture(3);
    const jammer=world.props.find(p=>p.type==='jammer');
    game.player.x=jammer.x;game.player.y=jammer.y;
    world.network.decoyCleared=true;
    world.enemySiteAlive=()=>false;
    world.allBasesActive=()=>false;
    assert.match(world.blockedInteraction(game).reason,/ОБЯЗАТЕЛЬНЫЕ СТАНЦИИ/);
});
test('prologue beam resets disabled button state between missions',()=>{
    assert.match(prologueSource,/repair.disabled=!!cooldown&&!this.repairHold/);
    assert.match(prologueSource,/hold.progress/);
    assert.match(main,/prologue-mission.js\?v=routes-102/);
});
test('mission HUD avoids rewriting unchanged text on every frame',()=>{
    assert.match(missionSource,/if\(hud\.textContent!==hudText\)hud\.textContent=hudText/);
    assert.match(prologueSource,/if\(hud\.textContent!==text\)hud\.textContent=text/);
});
test('mobile mission button and offline loader point to the same release',()=>{
    assert.match(main,/mission-world.js\?v=routes-102/);
    assert.match(index,/main\.js\?v=routes-102/);
    for(const f of ['main','mission-world','prologue-mission'])
        assert.match(sw,new RegExp(f+'\\.js\\?v=routes-102'));
    assert.match(missionSource,/ПОДКЛЮЧИТЬ СТАНЦИЮ/);
});
