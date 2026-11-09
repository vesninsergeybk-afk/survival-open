// Repeatable logic-only first-flight combat scenarios. This runs the real
// update loop, attacks and enemy AI, but has no visual input or browser FPS.
// The controls are synthetic: the output is diagnostic, not a playtest score.
import {pathToFileURL} from 'node:url';
import {SpatialGrid,openingThreat,STARTER_COMBAT} from '../balance.js';
import {EnemyComms} from '../enemy-comms.js';
import {EnemyLearning} from '../enemy-learning.js';
import {noisePatrolDirector} from '../noise-escalation.js';
import {OPENING_ARC} from '../opening-arc.js';
import {game as fixture} from '../tests/weapons-scene.mjs';

const noop=()=>{};
export function runEarlyCombatScenario({seed=111,mode='idle',seconds=120,hz=60,
 noiseAt=null,homeInactive=true}={}){
 const g=fixture(),home=g.world.home;
 g.time=0;g.spawnClock=9;g.dead=false;g.paused=false;
 Object.assign(g.player,{x:0,y:0,vx:0,vy:0,hp:STARTER_COMBAT.hull,
  maxHp:STARTER_COMBAT.hull,shield:0,ore:0,data:0,level:1,points:0,xp:0,
  invul:0,burstRemaining:0,burstCooldown:0});
 g.skillRanks=Object.fromEntries(Object.keys(g.skillRanks).map(key=>[key,0]));
 g.shipLoadout.frame=0;g.shipLoadout.owned={plasma:1};g.syncShipLoadout();
 if(homeInactive){
  home.active=false;home.discovered=false;
  g.world.discovered.delete(home.id);g.docked=null;g.activeBases=0;
 }
 Object.assign(g,{vw:1280,vh:720,canvas:{},shotGrid:new SpatialGrid(95),
  visuals:{updateSky:noop,capitalDamageQA:false},
  enemyComms:new EnemyComms(),enemyLearning:new EnemyLearning(null),
  lastDamageAt:-Infinity,lastX:0,lastY:0,stationary:0,zoneClock:80,
  worldQueryClock:0,worldQueryX:0,worldQueryY:0,nearRocks:[],localStations:[],
  miningNoise:0,miningNoiseWarned:false,miningIntroShown:false,
  noiseAlert:null,worldVisualLast:0,heavyPortalShown:true,allySerial:0,
  amberBeltSeen:false,ionFieldSeen:false,lastIonAudioCycle:-1});
 g.cockpit.impact=noop;g.heritage.tick=noop;g.heritage.extraction=noop;
 g.heritage.world=noop;g.heritage.onDeath=noop;
 g.notice=noop;g.runStore={end:noop,recoveryCheckpoint:()=>null};
 const originalRandom=Math.random;
 let randomSeed=seed>>>0;
 let maxEnemies=0,maxNearby=0,hits=0,noiseShips=0,firstChoiceHull=null;
 const samples=[],step=1/hz;
 try{
  Math.random=()=>((randomSeed=Math.imul(randomSeed,1664525)+1013904223>>>0)/4294967296);
  for(let frame=0;frame<seconds*hz&&!g.dead;frame++){
   if(mode==='straight'){g.touch.x=1;g.touch.y=0;}
   if(mode==='circle'){
    const phase=g.time*.60;g.touch.x=-Math.sin(phase);g.touch.y=Math.cos(phase);
   }
   if(mode==='zigzag'){
    const leg=Math.floor(g.time/2.5)%4;
    g.touch.x=[1,0,-1,0][leg];g.touch.y=[0,1,0,-1][leg];
   }
   const previousHp=g.player.hp;
   g.update(step);
   if(g.time-step<OPENING_ARC.offerAt&&g.time>=OPENING_ARC.offerAt)
    firstChoiceHull=+g.player.hp.toFixed(1);
   if(g.player.hp<previousHp)hits++;
   if(noiseAt!==null&&g.time-step<noiseAt&&g.time>=noiseAt){
    const before=g.enemies.length;
    g.spawnGroup(noisePatrolDirector(g.sectorDirector(
     openingThreat(g.time,g.player.level)),before,false,g.time),
    {x:g.player.x,y:g.player.y});
    noiseShips=g.enemies.length-before;
   }
   const alive=g.enemies.filter(e=>e.hp>0&&!e.converted);
   const nearby=alive.filter(e=>Math.hypot(e.x-g.player.x,e.y-g.player.y)<850).length;
   maxEnemies=Math.max(maxEnemies,alive.length);
   maxNearby=Math.max(maxNearby,nearby);
   if(frame%Math.max(1,Math.round(30*hz))===0||g.dead)
    samples.push({time:+g.time.toFixed(1),hull:+g.player.hp.toFixed(1),
     level:g.player.level,alive:alive.length,nearby,spawnClock:+(g.spawnClock||0).toFixed(1)});
  }
  return {seed,mode,seconds:+g.time.toFixed(1),dead:g.dead,
   hull:+g.player.hp.toFixed(1),level:g.player.level,hits,firstChoiceHull,
   maxEnemies,maxNearby,noiseShips,samples};
 }finally{Math.random=originalRandom;}
}
export function runEarlyCombatMatrix({
 seeds=[111,222,333],modes=['idle','straight','circle','zigzag'],
 seconds=120,hz=60,noiseAt=null}={}){
 return {scope:'Real update loop; synthetic input; no canvas, frame time, player skill or browser FPS',
  scenarios:seeds.flatMap(seed=>modes.map(mode=>
   runEarlyCombatScenario({seed,mode,seconds,hz,noiseAt})))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const fast=process.argv.includes('--smoke');
 const scenarios=runEarlyCombatMatrix({seeds:fast?[111]:[111,222,333],
  modes:fast?['idle','circle']:['idle','straight','circle','zigzag'],
  seconds:fast?60:120});
 console.log(JSON.stringify(scenarios,null,2));
}
