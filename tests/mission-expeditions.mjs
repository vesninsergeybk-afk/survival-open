import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
const layoutSource=read('mission-layouts.js').replace(/\bexport /g,'');
const layouts=new Function(layoutSource+'\nreturn {getMissionScene,makeMissionAsteroids};')();
const worldSource=read('mission-world.js').replace(/^import .*?;\n/gm,'')
    .replace(/\bexport /g,'');
const noop=()=>{};
class Enemy {
    constructor(x,y,def={}) {
        this.x=x;this.y=y;this.hp=def.hp||100;this.maxHp=this.hp;
        this.size=27;this.flashTimer=0;this.damage=2;
    }
}
class MissionLog {
    constructor(){this.entries=[];}
    reset(){} open(){}
    note(title,description,objective,show) {
        this.entries.push({title,description,objective,show});
    }
}
globalThis.document={getElementById:()=>null};
globalThis.window={matchMedia:()=>({matches:false})};
const createWorld=new Function('GameState','damageWorldObstacles','BOSSES',
    'ENEMIES','Enemy','MISSION_PROFILES','isMissionUnlocked','readCampaign',
    'getMissionScene','makeMissionAsteroids','drawMissionBackdrop',
    'drawMissionForeground','MissionLog','createConvoyTrap',
    'advanceConvoyTrap','progressCaption','CONVOY_TRAP',
    worldSource+'\nreturn MissionWorld');
const MissionWorld=createWorld({PLAYING:'playing'},noop,{HUNTER:{}},
    {STALKER:{},MAGE:{},GUNSHIP:{}},Enemy,[],noop,noop,
    layouts.getMissionScene,layouts.makeMissionAsteroids,
    noop,noop,MissionLog,noop,noop,noop,{});
function newGame(){
    return {
        state:'playing',gameTime:40,worldObstacles:[],enemies:[],
        player:{x:12000,y:8000,level:7,hp:160,exp:0,
            gainExp(n){this.exp+=n;},takeDamage(n){this.hp-=n;}},
        friendlyBases:{bases:[{id:'home',type:'dock',hp:180,
            maxHp:180,turrets:[],development:{}}],
            credits:140,nextRaidAt:Infinity,raid:null,
            addCredits(n){this.credits+=n;}},
        worldVfx:{nova:noop,boostCollect:noop},createParticles:noop,
        createFloatingText:noop,_announce:noop,
        gameOver(){this.state='over';}
    };
}
// Second mission: a physical expedition, a moving machine and an exit
// which becomes available only after the quarry crisis and boss defeat.
const g2=newGame(),m2=new MissionWorld(g2,2);
g2.missionWorld=m2;m2.enter(g2);
const rocks=g2.worldObstacles.filter(r=>r.missionSeal);
assert.equal(rocks.length,7);
g2.friendlyBases.bases[0].activated=true;
rocks.slice(0,3).forEach(r=>r.destroyed=true);
g2.friendlyBases.bases[1].activated=true;
g2.player.x=m2.quarry.rig.x;g2.player.y=m2.quarry.rig.y;
assert.equal(m2.canInteract(g2)?.type,'rig');
assert.equal(m2.interact(g2),true);
assert.equal(m2.quarry.started,true);
// «Крот» now stops at a real fork until the player chooses a route.
for(let i=0;i<25&&!m2.quarry.forkReached;i++){
    g2.gameTime+=.5;
    g2.player.x=m2.quarry.rig.x;g2.player.y=m2.quarry.rig.y;
    m2._updateQuarry(g2,.5);
}
assert.equal(m2.quarry.forkReached,true);
assert.equal(m2.quarry.routeChoice,null);
const choice=m2.props.find(p=>p.id==='route-direct');
g2.player.x=choice.x;g2.player.y=choice.y;
assert.equal(m2.canInteract(g2)?.type,'route-choice');
assert.equal(m2.interact(g2),true);
assert.equal(m2.quarry.routeChoice,'direct');
for(let i=0;i<170&&!m2.quarry.completed;i++){
    g2.gameTime+=.5;
    g2.player.x=m2.quarry.rig.x;g2.player.y=m2.quarry.rig.y;
    // The expedition fixture has no combat loop: simulate pilot kills.
    g2.enemies.filter(e=>e.missionRigRaider).forEach(e=>e.hp=0);
    m2._updateQuarry(g2,.5);
}
assert.equal(m2.quarry.completed,true);
assert.equal(m2.quarry.ambushTriggered,true);
m2.enemySite.core.hp=0;
g2.enemies=g2.enemies.filter(e=>e!==m2.enemySite.core);
m2._updateEnemySite(g2,.5);m2._updateQuarry(g2,.5);
assert.equal(m2.quarry.overload,true);
m2.bossStarted=true;m2.boss=new Enemy(2,2);g2.enemies.push(m2.boss);
const gate=m2.props.find(p=>p.id==='escape-gate');
g2.player.x=gate.x;g2.player.y=gate.y;
assert.equal(m2.canInteract(g2),null);
g2.enemies=g2.enemies.filter(e=>e!==m2.boss);
assert.equal(m2.canInteract(g2)?.type,'gate');
const scene2=layouts.getMissionScene(2);
assert.ok(Math.hypot(scene2.stations[0].dx-gate.x+m2.cx,
    scene2.stations[0].dy-gate.y+m2.cy)>5000);
// The miner has real room to fly without crossing an asteroid.
const rig=scene2.props.find(p=>p.id==='rig'),goal=scene2.minerGoal;
const minClearance=Math.min(...layouts.makeMissionAsteroids(2,0,0).map(rock=>{
    const dx=goal.dx-rig.dx,dy=goal.dy-rig.dy;
    const t=Math.max(0,Math.min(1,((rock.x-rig.dx)*dx+
        (rock.y-rig.dy)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(rock.x-rig.dx-dx*t,rock.y-rig.dy-dy*t)-rock.radius;
}));
assert.ok(minClearance>170,'Miner corridor must have room for its hull');
// Third mission: optional relay, a real trap, recoverable sabotage and
// two locally triggered raids without eight-minute idle time.
const g3=newGame(),m3=new MissionWorld(g3,3);
g3.missionWorld=m3;m3.enter(g3);
assert.equal(g3.friendlyBases.bases.length,4);
g3.friendlyBases.bases.slice(0,3).forEach(b=>b.activated=true);
assert.equal(m3.allBasesActive(g3),true,'Optional base cannot block mission');
const decoy=m3.props.find(p=>p.id==='decoy');
g3.player.x=decoy.x;g3.player.y=decoy.y;
assert.equal(m3.canInteract(g3)?.type,'decoy');
m3.interact(g3);
assert.equal(g3.enemies.filter(e=>e.missionDecoy).length,4);
g3.enemies=g3.enemies.filter(e=>!e.missionDecoy);
m3._updateNetwork(g3);
assert.equal(m3.network.decoyCleared,true);
m3.enemySite.core.hp=0;
g3.enemies=g3.enemies.filter(e=>e!==m3.enemySite.core);
m3._updateEnemySite(g3,.5);
const jammer=m3.props.find(p=>p.id==='jammer');
g3.player.x=jammer.x;g3.player.y=jammer.y;
assert.equal(m3.canInteract(g3)?.type,'jammer');
m3.interact(g3);
const lab=g3.friendlyBases.bases[2];
assert.equal(lab.hp,85);
assert.equal(g3.friendlyBases.nextRaidAt,Infinity);
g3.player.x=lab.x;g3.player.y=lab.y;
assert.equal(m3.canInteract(g3)?.type,'repair');
m3.interact(g3);m3._updateNetwork(g3);
assert.equal(m3.network.defenseReady,true);
assert.ok(g3.friendlyBases.nextRaidAt-g3.gameTime<=15);
lab.hp=0;
assert.equal(m3.canInteract(g3)?.type,'reboot');
m3.interact(g3);
assert.equal(lab.hp,92);
assert.equal(m3.allBasesActive(g3),true);
m3.onRaidEnded(g3,true);
m3.onRaidEnded(g3,true);
assert.equal(m3.defenses,2);
assert.notEqual(g3.state,'over');
console.log('Expedition 9.3: route, burrower, evacuation, decoy, sabotage, repair and raids passed');
