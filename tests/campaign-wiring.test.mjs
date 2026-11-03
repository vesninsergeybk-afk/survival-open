/**
 * Lightweight release guard: parallel visual/audio updates must not silently
 * remove campaign wiring from main.js while leaving the campaign menu visible.
 * Run with: node --test site/games/survivor/tests/campaign-wiring.test.mjs
 * Does not need a browser, network, dependencies or GitHub Actions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=path=>readFileSync(resolve(root,path),'utf8');
const main=source('src/main.js');
const world=source('src/mission-world.js');
const layout=source('src/mission-layouts.js');
const scenery=source('src/mission-scenery.js');
const progression=source('src/mission-progression.js');
const obstacles=source('src/world-obstacles.js');
const index=source('index.html');
const bases=source('src/friendly-bases.js');
const sw=source('service-worker.js');
const ambush=source('src/mission-ambush.js');
class TestMissionLog{
    constructor(){this.entries=[];}
    reset(){}
    note(){}
    open(){}
}

test('HTML campaign picker has an active runtime listener',()=>{
    assert.match(index,/id="btnCampaign"/);
    assert.match(main,/import\s*\{[^}]*installMissionUI[^}]*\}\s*from\s*['"]\.\/mission-world\.js/);
    assert.match(main,/installMissionUI\(this\)/);
});
test('missions override endless maps, stations, waves and rendering',()=>{
    assert.match(main,/new MissionWorld\(this,this\.activeMission\.index\)/);
    assert.match(main,/new PrologueMissionWorld\(this\)/);
    assert.match(main,/this\.missionWorld\.enter\(this\)/);
    assert.match(main,/this\.missionWorld\.update\(this,dt,hpMult,dmgMult\)/);
    assert.match(main,/this\.missionWorld\?\.drawBack\(ctx,this\)/);
    assert.match(main,/this\.missionWorld\?\.drawFront\(ctx,this\)/);
    assert.match(main,/else this\._spawnLogic\(dt, hpMult, dmgMult, diff\.spawnMult\)/);
});
test('touch and keyboard interactions remain connected',()=>{
    assert.match(index,/id="missionAction"/);
    assert.match(main,/this\.missionWorld\.interact\(this\)/);
    assert.match(world,/getElementById\('missionAction'\)/);
});
test('a suspended tutorial is stopped before campaign begins',()=>{
    assert.match(main,/_endTutorialIfActive\(\)/);
    assert.match(main,/this\.tutorial\?\.skip\?\.\(\)/);
});
test('the third mission counts only defended bomber raids',()=>{
    assert.match(bases,/game\.missionWorld\?\.onRaidEnded\(/);
    assert.match(world,/onRaidEnded\(game,won\)/);
    assert.match(world,/this\.defenses>=2/);
});
test('reactive terrain and field repairs remain in the mission runtime',()=>{
    assert.match(layout,/missionVolatile/);
    assert.match(world,/_detonateRocks\(game\)/);
    assert.match(world,/p\.type==='repair'/);
    assert.match(scenery,/rock\.missionSeal/);
    assert.match(scenery,/rock\.missionVolatile/);
});
test('hostile sites are attackable, anchored and gate each objective',()=>{
    assert.match(layout,/enemySites:/);
    assert.match(world,/new Enemy\(/);
    assert.match(world,/core\.missionStructure=true/);
    assert.match(world,/enemySiteAlive\(game\)/);
    assert.match(world,/this\._updateEnemySite\(game,dt\)/);
    assert.match(world,/missionGarrison/);
    assert.match(main,/!e\.missionStructure/);
    assert.match(scenery,/hostileStation\(ctx,world\.enemySite/);
});
test('wreckage is real shootable collision scenery rather than a fake wall',()=>{
    assert.match(layout,/rock\.missionHull=true/);
    assert.match(obstacles,/o\.missionHullPart/);
    assert.match(obstacles,/drawStationPart/);
    assert.match(obstacles,/damageWorldObstacles/);
});
test('all mission scenery reads the defined game clock',()=>{
    assert.doesNotMatch(scenery,/indexTime/);
    assert.match(scenery,/const t=game\.gameTime\|\|0/);
});
test('mission 4 is a distinct playable escort operation',()=>{
    assert.match(world,/index<=4/);
    assert.match(world,/world\.index<4\?'inline-flex'/);
    assert.match(progression,/Путь через туманность/);
    assert.match(layout,/convoyStart:/);
    assert.match(layout,/missionRoadblock/);
    assert.match(world,/_updateConvoy\(game,dt\)/);
    assert.match(world,/missionConvoyRaider/);
    assert.match(world,/c\.hp=Math\.max\(0,c\.hp-damage\)/);
    assert.match(world,/this\.convoy\.hp\+160/);
    assert.match(world,/this\.exitOnline&&this\.convoy/);
    assert.match(scenery,/convoyArt\(ctx,game,world,t\)/);
    assert.match(scenery,/p\.type==='gate'/);
});
test('offline cache knows the deployed campaign entrypoints',()=>{
    assert.match(index,/main\.js\?v=routes-102/);
    assert.match(sw,/main\.js\?v=routes-102/);
    assert.match(sw,/mission-world\.js\?v=routes-102/);
    assert.match(sw,/friendly-bases\.js\?v=campaign-restore-1/);
    assert.match(sw,/mission-world\.js\?v=convoy-world-1/);
    assert.match(sw,/mission-progression\.js\?v=convoy-world-1/);
    assert.match(sw,/mission-layouts\.js\?v=convoy-world-1/);
});

test('escort layout retains clear docking zones and exactly two real roadblocks',()=>{
    const compiled=new Function(
        layout.replace(/\bexport (?=(function|const)\b)/g,'')+
        '\nreturn {getMissionScene,makeMissionAsteroids};'
    )();
    const scene=compiled.getMissionScene(4);
    const rocks=compiled.makeMissionAsteroids(4,0,0);
    assert.equal(scene.route.length,3);
    assert.equal(scene.stations.length,3);
    assert.equal(rocks.filter(r=>r.missionRoadblock===1).length,2);
    assert.equal(rocks.filter(r=>r.missionRoadblock===2).length,2);
    assert.equal(rocks.filter(r=>r.missionVolatile).length,4);
    for(const rock of rocks){
        assert.ok(Math.hypot(rock.x,rock.y)>125);
        for(const base of scene.stations)
            assert.ok(Math.hypot(rock.x-base.dx,rock.y-base.dy)>157);
    }
});
test('escort can be repaired, routed, defended and completed only with living cargo',()=>{
    const layoutModule=new Function(
        layout.replace(/\bexport (?=(function|const)\b)/g,'')+
        '\nreturn {getMissionScene,makeMissionAsteroids};'
    )();
    class TestEnemy{
        constructor(x,y,type,hpMult=1){
            Object.assign(this,{x,y,type,size:type.size,hp:type.hp*hpMult,
                maxHp:type.hp*hpMult,flashTimer:0,fireTimer:0,age:0,boss:!!type.boss});
        }
        _shoot(){}
    }
    const ambushFns=new Function(ambush.replace(/\bexport (?=(function|const)\b)/g,'')+
        '\nreturn {createConvoyTrap,advanceConvoyTrap,progressCaption,CONVOY_TRAP};')();
    const dependencies={
        ...ambushFns,MissionLog:TestMissionLog,
        window:{matchMedia:()=>({matches:false})},
        GameState:{PLAYING:'play',MENU:'menu'},damageWorldObstacles:()=>{},
        BOSSES:{HUNTER:{hp:1400,size:55}},
        ENEMIES:{STALKER:{id:'stalker',hp:32,size:15},
            GUNSHIP:{id:'gunship',hp:110,size:23},MAGE:{id:'mage',hp:30,size:17}},
        Enemy:TestEnemy,MISSION_PROFILES:[],isMissionUnlocked:()=>true,
        readCampaign:()=>({}),getMissionScene:layoutModule.getMissionScene,
        makeMissionAsteroids:layoutModule.makeMissionAsteroids,
        drawMissionBackdrop:()=>{},drawMissionForeground:()=>{}
    };
    const clean=world.replace(/^import[\s\S]*?from\s*['"][^'"]+['"];\s*$/gm,'')
        .replace(/\bexport (?=(class|function|const)\b)/g,'');
    const MissionWorld=new Function(...Object.keys(dependencies),
        clean+'\nreturn MissionWorld;')(...Object.values(dependencies));
    const game={
        player:{x:0,y:0,gainExp:()=>{},takeDamage:()=>{}},gameTime:0,state:'play',
        enemies:[],worldVfx:{nova:()=>{},boostCollect:()=>{}},
        friendlyBases:{bases:[{}],credits:150,addCredits:()=>{}},
        createFloatingText:()=>{},createParticles:()=>{},_announce:()=>{},
        _spawnOne:()=>{},gameOver:()=>{},
        _spawnBoss(def){const boss=new TestEnemy(0,0,def);boss.boss=true;this.enemies.push(boss);}
    };
    const mission=new MissionWorld(game,4);
    mission._updateHud=()=>{};
    mission._victory=()=>{mission.victory=true;};
    mission.enter(game);
    const cargo=mission.convoy;
    const exitGate=mission.props.find(p=>p.type==='gate');
    game.player.x=exitGate.x;game.player.y=exitGate.y;
    assert.equal(mission.canInteract(game),null); // gate is locked until arrival
    // Field repair is possible only near the actual moving transport.
    cargo.hp=500;
    game.player.x=cargo.x;game.player.y=cargo.y;
    game.friendlyBases.credits=30;
    assert.equal(mission.canInteract(game).type,'convoy-repair');
    assert.equal(mission.interact(game),true);
    assert.equal(cargo.hp,660);
    assert.equal(game.friendlyBases.credits,6);
    assert.equal(mission.canInteract(game),null); // cooldown
    cargo.hp=760;
    game.friendlyBases.bases[0].activated=true;
    // The pilot can trade resources for time, with a real interception risk.
    cargo.phase='charging';cargo.leg=0;cargo.hold=70;
    game.friendlyBases.bases[1].activated=true;
    game.player.x=game.friendlyBases.bases[1].x;
    game.player.y=game.friendlyBases.bases[1].y;
    game.friendlyBases.credits=50;
    assert.equal(mission.canInteract(game)?.type,'relay-overcharge');
    assert.equal(mission.interact(game),true);
    assert.equal(cargo.hold,45);
    assert.equal(game.friendlyBases.credits,30);
    assert.equal(mission.canInteract(game),null,'overcharge works once per relay');
    cargo.overchargedLegs.clear();cargo.hold=15;
    assert.equal(mission.canInteract(game),null,'no salvage waste near the end of charging');
    cargo.phase='launch';cargo.leg=0;cargo.hold=0;
    cargo.chargeStarted=false;cargo.overchargedLegs.clear();cargo.raidClock=28;
    game.friendlyBases.bases[1].activated=false;
    game.friendlyBases.credits=150;
    let blockedSince=0;
    for(let tick=1;tick<=560;tick++){
        game.gameTime=tick;
        game.player.x=cargo.x;game.player.y=cargo.y;
        for(const enemy of game.enemies.filter(e=>e.missionConvoyRaider)){
            enemy.update(1,game);enemy.age++;
        }
        // Approximate 16 seconds of ordinary weapon fire per interceptor.
        game.enemies=game.enemies.filter(e=>!e.missionConvoyRaider||e.age<16);
        if(tick>=455)game.enemies=game.enemies.filter(e=>!e.boss);
        mission.update(game,1,1,1);
        if(cargo.phase==='blocked'){
            blockedSince++;
            if(blockedSince>=8){
                game.worldObstacles.filter(r=>r.missionRoadblock===cargo.leg+1)
                    .forEach(r=>r.destroyed=true);
                blockedSince=0;
            }
        }
        if(cargo.phase==='docking')
            game.friendlyBases.bases[cargo.leg+1].activated=true;
        if(cargo.leg===3&&mission.trap?.cleared&&!mission.exitOnline){
            const gate=mission.props.find(p=>p.type==='gate');
            game.player.x=gate.x;game.player.y=gate.y;
            assert.equal(mission.canInteract(game).type,'gate');
            assert.equal(mission.interact(game),true);
            assert.equal(mission.evacuation.bossCueAt,game.gameTime+8,
                'gate opening summons the boss, regardless of global elapsed time');
        }
        if(mission.victory||mission.failed)break;
    }
    assert.equal(mission.failed,false);
    assert.equal(mission.victory,true);
    assert.ok(cargo.hp>0);
    assert.ok(game.gameTime<540,'victory follows the completed escort, not minute nine');
    assert.ok(Number.isFinite(mission.evacuation.rescueAt));
    assert.ok(cargo.raids>=5);
    // Even after all route work, a destroyed transport invalidates victory.
    mission.victory=false;mission.failed=false;
    cargo.hp=0;mission.update(game,1,1,1);
    assert.equal(mission.failed,true);
});
