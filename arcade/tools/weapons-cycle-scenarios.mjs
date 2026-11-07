import {EnemyLearning} from '../enemy-learning.js';
import {EnemyComms} from '../enemy-comms.js';
import {captureCheckpoint,validateCheckpoint,packRun} from '../run-checkpoint.js';
import {pathToFileURL} from 'node:url';
// Logic-only authored-operation trials. Real update, AI, projectiles, terrain and
// player acceleration; a deterministic controller supplies continuous input.
// This cannot measure enjoyment, visual readability, device FPS or human timing.
import {game} from '../tests/weapons-scene.mjs';
import {SpatialGrid} from '../balance.js';
import {World} from '../world.js';
import {createFieldLoan,missionAssignment} from '../field-weapons.js';
import {createCorridorOperation,createProbeOperation,operationDestination} from '../operations.js';
import {createRelayDefense,relayWavePlan} from '../relay-defense.js';
import {createCarrierInterception,carrierPulseState} from '../carrier-interception.js';
const noop=()=>{};
const jobs={jammer:['dock',createCorridorOperation],probe:['lab',createProbeOperation],relay:['arsenal',createRelayDefense],cargo:['carrier',createCarrierInterception]};
const kits=[{id:'plasma-ion',slots:['plasma','ion'],range:100,field:'ion'},
 {id:'rail-plasma',slots:['rail','plasma'],range:570},
 {id:'flak-resonator',slots:['flak','resonator'],range:180,field:'resonator'}];
export function runOperationScenario(job,kitId,dt=1/60,{worldSeed,stationary=false,interceptRadio=false}={}){
 const starter=kitId==='starter';
 const kit=starter?{id:kitId,slots:['plasma'],range:135}:kits.find(k=>k.id===kitId);
 if(!kit||!jobs[job])throw new Error('unknown scenario');
 const g=game(Array.from({length:6},(_,i)=>kit.slots[i]||null));g.shipLoadout.frame=0;
 if(worldSeed!==undefined){
  g.world=new World(worldSeed);g.seed=worldSeed;g.docked=g.world.home;
  g.docked.active=true;g.docked.discovered=true;g.world.discovered.add(g.docked.id);
 }
 g.enemyLearning=new EnemyLearning(null);g.enemyComms=new EnemyComms();g.time=0;
 g.player.level=starter?1:4;g.skillRanks.rocket=0;g.skillRanks.beam=starter?0:1;
 const [type,create]=jobs[job],b=g.world.home;b.type=type;
 g.operation=create(b,g.world);const op=g.operation;b[{jammer:'corridorMission',probe:'probeMission',relay:'relayMission',cargo:'carrierMission'}[job]]=op;
 Object.assign(g.player,{x:b.x+60,y:b.y,invul:0,burstRemaining:0,burstCooldown:0,burstX:0,burstY:-1});
 if(stationary){g.player.x=op.x;g.player.y=op.y;}
 if(kit.field)g.fieldLoan=createFieldLoan(kit.field,b.id,0,missionAssignment(op,null));g.syncShipLoadout();
 Object.assign(g,{vw:1280,vh:720,canvas:{},shotGrid:new SpatialGrid(95),visuals:{updateSky:noop,capitalDamageQA:false},
  lastDamageAt:-Infinity,lastX:g.player.x,lastY:g.player.y,stationary:0,
  zoneClock:1e6,spawnClock:1e6,worldQueryClock:0,worldQueryX:0,worldQueryY:0,nearRocks:[],localStations:[],
  miningNoise:0,miningNoiseWarned:false,miningIntroShown:false,noiseAlert:null,worldVisualLast:0,
  heavyPortalShown:true,allySerial:0,amberBeltSeen:false,ionFieldSeen:false,lastIonAudioCycle:-1});
 g.cockpit.impact=noop;g.heritage.tick=noop;g.heritage.extraction=noop;g.heritage.world=noop;g.heritage.onDeath=noop;
 const notices=[];g.notice=text=>notices.push(text);g.runStore={end:noop,recoveryCheckpoint:()=>null};
 let uses=0,minimumHull=110,combatAt=null,delivered=false,checkpointSaved=false;
 for(let frame=0;frame<240/dt&&!g.dead;frame++){
  const active=g.operation,returning=!active||active.phase==='return';
  let desired={x:b.x+55,y:b.y};
  const hostiles=g.enemies.filter(e=>e.hp>0&&!e.converted&&!e.interceptCargo);
  const nearest=hostiles.sort((a,c)=>Math.hypot(a.x-g.player.x,a.y-g.player.y)-Math.hypot(c.x-g.player.x,c.y-g.player.y))[0];
  if(!returning){
   if(combatAt===null&&hostiles.length)combatAt=g.time;
   let target=active,preferred=active.phase==='approach'?Math.min(kit.range,300):kit.range;
   if(job==='relay'){
    if(nearest){
     target=hostiles.find(e=>e.missionStrike?.target==='antenna')||hostiles.find(e=>e.missionStrike)||nearest;
     preferred=Math.min(kit.range,175);
    }else if(active.phase==='warning'||active.phase==='intermission'){
     const bearing=relayWavePlan(active).find(spec=>spec.target==='relay').angle;
     target={x:active.x+Math.cos(bearing)*240,y:active.y+Math.sin(bearing)*240};preferred=0;
    }
   }
   if(job==='probe'){
    const striker=hostiles.find(e=>e.serial===active.strikerSerial);
    const threat=striker||(nearest&&Math.hypot(nearest.x-g.player.x,nearest.y-g.player.y)<280?nearest:null);
    target=threat||operationDestination(active,g.world);preferred=threat?Math.min(kit.range,135):30;
    g.actionHeld=active.located!==false&&!threat&&Math.hypot(g.player.x-active.x,g.player.y-active.y)<145?
     {kind:'repair',source:'keyboard'}:null;
   }else g.actionHeld=null;
   const courier=job==='jammer'&&interceptRadio&&active.radio==='calling'&&hostiles.find(e=>e.serial===active.radioSerial);
   if(courier){target=courier;preferred=100;}
   const a=job==='cargo'&&active.phase!=='approach'?(active.angle||0)-Math.PI/2+Math.PI:
    Math.atan2(g.player.y-target.y,g.player.x-target.x);
   desired={x:target.x+Math.cos(a)*preferred,y:target.y+Math.sin(a)*preferred};
   // Respect the visible discharge warning with movement, then re-enter.
   if(job==='jammer'&&active.pulseCharge>2.5&&Math.hypot(g.player.x-active.x,g.player.y-active.y)<=315){
    const retreat=Math.atan2(g.player.y-active.y,g.player.x-active.x);
    desired={x:active.x+Math.cos(retreat)*355,y:active.y+Math.sin(retreat)*355};
   }
   if(job==='cargo'&&carrierPulseState(active).key==='charge')desired={x:active.x+Math.cos(a)*270,y:active.y+Math.sin(a)*270};
  }else g.actionHeld=null;
  if(stationary){
   desired={x:g.player.x,y:g.player.y};
   if(job==='probe'&&active)g.actionHeld={kind:'repair',source:'keyboard'};
  }
  const dx=desired.x-g.player.x,dy=desired.y-g.player.y,d=Math.hypot(dx,dy);
  g.touch.x=dx/Math.max(d,60);g.touch.y=dy/Math.max(d,60);
  if(kit.field&&g.fieldLoan?.cooldownUntil<=g.time&&g.fieldLoan.charges>0&&!g.probeRepairing){
   const before=g.fieldLoan.used;g.callFieldWeapon();if(g.fieldLoan.used>before)uses++;
  }
  g.update(dt);minimumHull=Math.min(minimumHull,g.player.hp);
  if(stationary&&!g.operation)break;
  if(returning&&Math.hypot(g.player.x-b.x,g.player.y-b.y)<135){
   g.dock(b);delivered=true;
   const checkpoint=captureCheckpoint(g,b);
   checkpointSaved=validateCheckpoint(checkpoint)&&packRun(checkpoint).length>0;break;
  }
 }
 const completed=!!b[{jammer:'corridorSecured',probe:'probeRecovered',relay:'relayDefenseDone',cargo:'supplyIntercepted'}[job]];
 return {job,kit:kit.id,hz:Math.round(1/dt),completed,returned:delivered,checkpointSaved,radioMessages:g.enemyComms.messages,seconds:+g.time.toFixed(2),hull:+g.player.hp.toFixed(1),minimumHull:+minimumHull.toFixed(1),fieldUses:uses,
  oreGain:g.player.ore-400,data:g.player.data,objectiveHP:Math.round(op.hp||0),antennaHP:op.antenna?.hp,
  repair:op.repair,radio:op.radio,ambush:op.pursuitStarted,phase:op.phase,dead:g.dead};
}
export function runScenarioMatrix(){
 const results=[],originalRandom=Math.random;
 try{for(const hz of [60,30])for(const job of Object.keys(jobs))for(const kit of kits){
  let seed=20261104;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  results.push(runOperationScenario(job,kit.id,1/hz));
 }}finally{Math.random=originalRandom;}
 return {scope:'Authored encounters only; no ambient director or random orbital zones; level 4, calibration 1, two slots, no escorts; current radio mesh and fresh learning model enabled, authored guard constraints preserved; deterministic controller, not a human playtest.',results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=runScenarioMatrix();console.log(JSON.stringify(result,null,2));
 if(result.results.some(r=>!r.completed||!r.returned||!r.checkpointSaved||r.dead))process.exitCode=1;
}
