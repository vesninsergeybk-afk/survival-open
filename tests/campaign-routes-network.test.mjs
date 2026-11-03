/**
 * Tactical route/defense regression checks for Survivor missions 02–03.
 * Run: node --test site/games/survivor/tests/campaign-routes-network.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=name=>readFileSync(resolve(root,name),'utf8');
const strip=text=>text
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm,'')
    .replace(/\bexport (?=(class|function|const)\b)/g,'');
const sceneSource=source('src/mission-layouts.js');
const {getMissionScene,makeMissionAsteroids}=new Function(
    strip(sceneSource)+'\nreturn {getMissionScene,makeMissionAsteroids};')();
class FakeEnemy{
    constructor(x,y,definition={}){
        this.x=x;this.y=y;this.hp=definition.hp||60;this.maxHp=this.hp;
        this.size=definition.size||18;this.damage=definition.damage||0;
        this.color=definition.color||'#ffb887';this.flashTimer=0;
        this.tacticPhase=0;this.speed=definition.speed||100;
    }
}
const enemyDefs={STALKER:{hp:40,size:16,damage:10},
    MAGE:{hp:60,size:16,damage:9},
    BOMBER:{hp:90,size:24,damage:11}};
const MissionWorld=new Function('getMissionScene','GameState','Enemy','ENEMIES',
    strip(source('src/mission-world.js'))+'\nreturn MissionWorld;')(
    getMissionScene,{PLAYING:'playing',DOCK:'dock'},FakeEnemy,enemyDefs);
const FriendlyBases=new Function('CONFIG','STATION_PARTS','Enemy','ENEMIES',
    strip(source('src/friendly-bases.js'))+'\nreturn FriendlyBases;')(
    {ARENA_WIDTH:24000,ARENA_HEIGHT:16000},
    {arc:{},missile:{},rail:{}},FakeEnemy,enemyDefs);
function fixture(index){
    const game={state:'playing',gameTime:0,
        player:{x:12000,y:8000,level:2,exp:0,gainExp(value){this.exp+=value;}},
        enemies:[],worldObstacles:[],worldVfx:{nova(){}},
        createFloatingText(){},createParticles(){},_announce(){},
        friendlyBases:{bases:[],credits:200,addCredits(){}}};
    const world=new MissionWorld(game,index);
    game.missionWorld=world;
    game.friendlyBases.bases=world.scene.stations.map((s,i)=>({
        id:'test-'+i,x:world.cx+s.dx,y:world.cy+s.dy,
        activated:true,missionOptional:!!s.optional,
        hp:180,maxHp:180,type:s.type,displayName:s.name
    }));
    world.enemySiteAlive=()=>true;
    world._announce=()=>{};
    world._updateHud=()=>{};
    world.log={note(){}};
    game.gameOver=()=>{throw Error('The escort must survive');};
    return {game,world};
}
function moveWithRig(game,rig){game.player.x=rig.x;game.player.y=rig.y;}
function reachFork(game,world){
    world.quarry.started=true;
    for(let step=0;step<12&&!world.quarry.forkReached;step++){
        game.gameTime++;
        moveWithRig(game,world.quarry.rig);
        world._updateQuarry(game,1);
    }
    assert.equal(world.quarry.forkReached,true);
}
function pickRoute(game,world,route){
    const prop=world.props.find(p=>p.route===route);
    game.player.x=prop.x;game.player.y=prop.y;
    assert.equal(world.canInteract(game)?.id,prop.id);
    assert.equal(world.interact(game),true);
    return prop;
}
test('fork stops the escort, shows both physical choices, locks the unchosen route',()=>{
    const {game,world}=fixture(2),q=world.quarry;
    reachFork(game,world);
    const before={x:q.rig.x,y:q.rig.y};
    world._updateQuarry(game,1);
    assert.deepEqual({x:q.rig.x,y:q.rig.y},before);
    assert.match(world._objectiveRaw(game),/БЫСТРЫЙ ПРОХОД или УКРЫТИЯ/);
    const selected=pickRoute(game,world,'direct');
    assert.equal(q.routeChoice,'direct');
    assert.equal(selected.used,true);
    const other=world.props.find(p=>p.route==='shelter');
    game.player.x=other.x;game.player.y=other.y;
    assert.notEqual(world.canInteract(game)?.type,'route-choice');
    assert.match(world.blockedInteraction(game).reason,/МАРШРУТ УЖЕ ВЫБРАН/);
});
test('fast route has a blocking ambush and resumes only after the squad falls',()=>{
    const {game,world}=fixture(2),q=world.quarry;
    reachFork(game,world);pickRoute(game,world,'direct');
    let reachedAmbush=false;
    for(let i=0;i<80;i++){
        game.gameTime++;moveWithRig(game,q.rig);
        game.enemies.filter(e=>!e.missionRigBlocker).forEach(e=>e.hp=0);
        world._updateQuarry(game,1);
        if(q.awaitingClear){reachedAmbush=true;break;}
    }
    assert.equal(reachedAmbush,true);
    assert.equal(q.ambushTriggered,true);
    assert.ok(game.enemies.some(e=>e.missionRigBlocker&&e.hp>0));
    const stopped={x:q.rig.x,y:q.rig.y};
    game.gameTime++;world._updateQuarry(game,1);
    assert.deepEqual({x:q.rig.x,y:q.rig.y},stopped);
    // An enemy cannot quietly destroy an offscreen carrier.
    const blocker=game.enemies.find(e=>e.missionRigBlocker&&e.hp>0);
    const hp=q.rig.hp;game.player.x=0;game.player.y=0;
    blocker.x=q.rig.x;blocker.y=q.rig.y;blocker.rigAttack=-1;
    blocker.update(5,game);
    assert.equal(q.rig.hp,hp);
    game.enemies.filter(e=>e.missionRigBlocker).forEach(e=>e.hp=0);
    for(let i=0;i<75&&!q.completed;i++){
        game.gameTime++;moveWithRig(game,q.rig);
        game.enemies.filter(e=>!e.missionRigBlocker).forEach(e=>e.hp=0);
        world._updateQuarry(game,1);
    }
    assert.equal(q.awaitingClear,false);
    assert.equal(q.completed,true);
    assert.deepEqual({x:q.rig.x,y:q.rig.y},
        {x:world.cx+world.scene.minerGoal.dx,y:world.cy+world.scene.minerGoal.dy});
});
test('sheltered route trades travel time for one physical field repair',()=>{
    const {game,world}=fixture(2),q=world.quarry;
    q.rig.hp=180;
    reachFork(game,world);pickRoute(game,world,'shelter');
    const before={x:q.rig.x,y:q.rig.y};
    game.player.x=0;game.player.y=0;
    world._updateQuarry(game,2);
    assert.deepEqual({x:q.rig.x,y:q.rig.y},before);
    for(let i=0;i<100&&!q.completed;i++){
        game.gameTime++;moveWithRig(game,q.rig);
        game.enemies.forEach(e=>e.hp=0);
        world._updateQuarry(game,1);
    }
    assert.equal(q.completed,true);
    assert.equal(q.serviceUsed,true);
    assert.equal(q.ambushTriggered,false);
    assert.equal(q.rig.hp,235);
});
test('both authored tracks leave physical room for the excavator',()=>{
    const scene=getMissionScene(2),rocks=makeMissionAsteroids(2,12000,8000);
    for(const path of Object.values(scene.quarryRoutes)){
        const points=[{dx:1870,dy:-370},scene.quarryFork,...path];
        for(const rock of rocks)for(let i=1;i<points.length;i++){
            const a=points[i-1],b=points[i];
            const dx=b.dx-a.dx,dy=b.dy-a.dy;
            const t=Math.max(0,Math.min(1,((rock.x-12000-a.dx)*dx+
                (rock.y-8000-a.dy)*dy)/(dx*dx+dy*dy)));
            const clearance=Math.hypot(rock.x-12000-a.dx-dx*t,
                rock.y-8000-a.dy-dy*t)-rock.radius;
            assert.ok(clearance>=82,'An asteroid blocks an escort track');
        }
    }
});
test('mission 03 defense is chosen near mandatory stations; reserve stops one bomber',()=>{
    const bases=new FriendlyBases();
    bases.bases=[
        {id:'dock',x:11000,y:8000,type:'dock',activated:true,hp:180},
        {id:'north',x:13500,y:6500,type:'outpost',activated:true,hp:180},
        {id:'lab',x:14500,y:9800,type:'lab',activated:true,hp:180,
            displayName:'Лаборатория «Пульс»'},
        {id:'reserve',x:16400,y:6500,type:'outpost',activated:true,hp:180,
            missionOptional:true}
    ];
    bases.nextRaidAt=0;
    const warnings=[];
    const game={gameTime:100,player:{x:16400,y:6500,level:1},
        missionWorld:{index:3,network:{defenseReady:true}},
        enemies:[],worldVfx:{nova(){}},
        _announce(message){warnings.push(message);},
        audio:{playEvent(){}},friendlyBases:bases};
    bases.updateRaid(1,game);
    assert.equal(bases.raid,null,'The optional relay is not a defense objective');
    game.player.x=14500;game.player.y=9800;
    bases.updateRaid(1,game);
    assert.equal(bases.raid.baseId,'lab');
    assert.equal(bases.raid.countdown,18);
    assert.ok(warnings.some(message=>message.includes('Лаборатория')));
    const raid=bases.raid;
    bases.launchRaid(game,bases.bases[2],raid);
    assert.equal(raid.reserveAssisted,true);
    assert.equal(game.enemies.filter(e=>e.raidRole==='bomber').length,1);
    bases.bases[3].activated=false;game.enemies=[];
    bases.launchRaid(game,bases.bases[2],raid);
    assert.equal(raid.reserveAssisted,false);
    assert.equal(game.enemies.filter(e=>e.raidRole==='bomber').length,2);
});
test('new mission art and offline entry all reference the same release',()=>{
    const main=source('src/main.js'),world=source('src/mission-world.js');
    const sw=source('service-worker.js'),html=source('index.html');
    assert.match(main,/mission-world\.js\?v=routes-102/);
    assert.match(main,/friendly-bases\.js\?v=routes-102/);
    assert.match(world,/mission-scenery\.js\?v=routes-102/);
    assert.match(world,/mission-layouts\.js\?v=routes-102/);
    assert.match(html,/main\.js\?v=routes-102/);
    for(const mod of ['main','mission-world','mission-layouts',
        'mission-scenery','friendly-bases'])
        assert.match(sw,new RegExp(mod+'\\.js\\?v=routes-102'));
});
