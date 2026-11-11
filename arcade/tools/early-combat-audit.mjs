// Repeatable logic-only first-flight combat scenarios. This runs the real
// update loop, attacks and enemy AI, but has no visual input or browser FPS.
// The controls are synthetic: the output is diagnostic, not a playtest score.
import {pathToFileURL} from 'node:url';
import {SpatialGrid,openingThreat,STARTER_COMBAT} from '../balance.js';
import {EnemyComms} from '../enemy-comms.js';
import {EnemyLearning} from '../enemy-learning.js';
import {noisePatrolDirector} from '../noise-escalation.js';
import {OPENING_ARC} from '../opening-arc.js';
import {moduleStats} from '../ship-loadout.js';
import {HUD_RADAR_RANGE} from '../hud.js';
import {game as fixture} from '../tests/weapons-scene.mjs';

const noop=()=>{};
function earlyFlightFixture(homeInactive=true){
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
 Object.assign(g.mining,{active:false,fxClock:0,target:null});
 g.cockpit.impact=noop;g.heritage.tick=noop;g.heritage.extraction=noop;
 g.heritage.world=noop;g.heritage.onDeath=noop;
 g.heritage.resume=noop;g.releaseMenu=noop;
 g.notice=noop;g.runStore={end:noop,recoveryCheckpoint:()=>null};
 return g;
}
export function runEarlyCombatScenario({seed=111,mode='idle',seconds=120,hz=60,
 noiseAt=null,homeInactive=true,build='starter'}={}){
 const g=earlyFlightFixture(homeInactive);
 if(build==='reinforced'){
  // Reproduce a strong pre-contour ship, using the same combat and AI loop.
  g.shipLoadout.slots[1]='plasma';g.shipLoadout.owned.plasma=2;g.syncShipLoadout();
  Object.assign(g.skillRanks,{beam:3,shield:3,hull:1});
  Object.assign(g.player,{hp:112,maxHp:112,shield:88,level:8});
 }
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

// A scripted novice route through the REAL update and interaction methods.
// The route does not aim, avoid enemy fire intelligently, use a dash or adapt
// the mission: successful docking is evidence of reachability, not playability.
export function runFirstLoopScenario({seed=111,seconds=120,hz=60,
 allowRetreat=true,initialDelay=0,patrolMode='orbit'}={}){
 const g=earlyFlightFixture(true),home=g.world.home;
 const rock=g.world.nearbyRocks(0,0,750).filter(r=>r.rich&&r.alive)
  .sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y))[0];
 if(!rock)throw new Error('Opening rich asteroid not found');
 let stage=initialDelay>0?'orient':'home',hits=0,netAliveDrops=0,
  repairCount=0,upgradeCount=0,returns=0;
 let firstDockAt=null,missionCompleteAt=null,secondDockAt=null;
 let firstRadarEnemyAt=null,firstOpticalThreatAt=null,firstSensorSightingAt=null,
  firstEnemyInPlasmaRangeAt=null,firstDamageAt=null;
 const events=[],samples=[],step=1/hz,originalRandom=Math.random;
 const initialOre=g.player.ore;
 const plasmaRange=moduleStats('plasma',g.skillRanks).range;
 const originalMatchMedia=globalThis.matchMedia;
 let randomSeed=seed>>>0,maxEnemies=0,maxNearby=0;
 function flyTo(x,y,stop=45){
  const dx=x-g.player.x,dy=y-g.player.y,d=Math.hypot(dx,dy);
  g.touch.x=d<=stop?0:dx/d;g.touch.y=d<=stop?0:dy/d;
  return d<=stop;
 }
 function event(name){events.push({name,at:+g.time.toFixed(1),hull:+g.player.hp.toFixed(1),
  ore:g.player.ore,level:g.player.level});}
 try{
  Math.random=()=>((randomSeed=Math.imul(randomSeed,1664525)+1013904223>>>0)/4294967296);
  // Node has no matchMedia. The game queries it for its first extraction hint.
  globalThis.matchMedia=()=>({matches:false});
  for(let frame=0;frame<seconds*hz&&!g.dead;frame++){
   if(stage==='orient'){
    g.touch.x=0;g.touch.y=0;
    if(g.time>=initialDelay){stage='home';event('orientation-ended');}
   }else if(stage==='home'){
    flyTo(home.x,home.y,115);
    if(g.currentInteraction()?.kind==='station'&&g.beginInteraction('audit')){
     firstDockAt=g.time;event('first-dock');
     g.baseAction('activate','');event('activate');
     g.baseAction('acceptContract','alternate');event('accept-rich-contract');
     if(!home.active||g.contract?.kind!=='rich')throw new Error('Dock preparation failed');
     if(!g.dismiss())throw new Error('First departure refused');
     stage='mine';
    }
   }else if(stage==='mine'){
    const dx=home.x-rock.x,dy=home.y-rock.y,d=Math.hypot(dx,dy);
    const at=flyTo(rock.x+dx/d*90,rock.y+dy/d*90,37);
    if(rock.alive&&at&&g.mining.target===rock&&!g.actionHeld){
     if(!g.beginInteraction('audit'))throw new Error('Extractor failed to start');
     event('begin-extraction');
    }
    if(!rock.alive){g.endInteraction('audit');event('rich-extracted');stage='loot';}
   }else if(stage==='loot'){
    // Fracture drops are physical objects; approach them before returning.
    flyTo(rock.x,rock.y,24);
    if(Math.hypot(g.player.x-rock.x,g.player.y-rock.y)<85){
     stage='return';event('ore-collection-attempt');
    }
   }else if(stage==='return'){
    flyTo(home.x,home.y,110);
    if(g.currentInteraction()?.kind==='station'&&g.beginInteraction('audit')){
     secondDockAt=g.time;event('return-dock');
     if(!g.contract)missionCompleteAt=g.time;
     else if(g.contract.progress>=g.contract.goal){
      g.baseAction('claimContract','');missionCompleteAt=g.time;
     }
     event('contract-claim');
     const hpBefore=g.player.hp,oreBefore=g.player.ore;
     if(g.player.hp<g.player.maxHp-12)g.baseAction('repair','');
     if(g.player.hp>hpBefore&&g.player.ore<oreBefore)repairCount++;
     if(g.player.points>0){
      g.baseTab='development';
      if(g.buySkill('hull'))upgradeCount++;
     }
     event('repair-and-upgrade');
     if(!g.dismiss())throw new Error('Second departure refused');
     stage='patrol';
    }
   }else if(stage==='patrol'){
    if(patrolMode==='camp')flyTo(home.x,home.y,35);
    else{
     const phase=g.time/8;
     flyTo(home.x+Math.cos(phase)*550,home.y+Math.sin(phase)*550,35);
    }
    if(allowRetreat&&returns<2&&g.time>18&&g.player.hp<g.player.maxHp*.70){
     stage='tactical-return';event('fall-back');
    }
   }else if(stage==='tactical-return'){
    flyTo(home.x,home.y,105);
    if(g.currentInteraction()?.kind==='station'&&g.beginInteraction('audit')){
     returns++;event('repair-dock');
     const hpBefore=g.player.hp,oreBefore=g.player.ore;
     g.baseAction('repair','');
     if(g.player.hp>hpBefore&&g.player.ore<oreBefore)repairCount++;
     event('paid-repair');
     if(!g.dismiss())throw new Error('Tactical departure refused');
     stage='patrol';
    }
   }
   if(g.paused)throw new Error('Scenario paused unexpectedly during '+stage);
   const prevHp=g.player.hp,prevCount=g.enemies.filter(e=>e.hp>0).length;
   g.update(step);
   if(g.player.hp<prevHp){
    hits++;
    if(firstDamageAt===null)firstDamageAt=g.time;
   }
   const alive=g.enemies.filter(e=>e.hp>0&&!e.converted);
   // Radar entry and line-of-sight are GEOMETRIC opportunities, not proof
   // that a throttled HUD actually drew the contact or a sampled sensor saw it.
   if(firstRadarEnemyAt===null&&alive.some(e=>
    Math.hypot(e.x-g.player.x,e.y-g.player.y)<=HUD_RADAR_RANGE))
    firstRadarEnemyAt=g.time;
   if(firstOpticalThreatAt===null&&alive.some(e=>
    Math.hypot(e.x-g.player.x,e.y-g.player.y)<=STARTER_COMBAT.patrolSight&&
    g.enemyCanSee(e,g.player)))firstOpticalThreatAt=g.time;
   // Unlike a line-of-sight query, this checks a sighting actually stored by
   // the ordinary enemy-awareness or scout scan during the real update tick.
   if(firstSensorSightingAt===null&&alive.some(e=>
    (e._awarenessLast&&g.time-e._awarenessLast.at<=step+.001)||
    (e._irisHasSight&&g.time-(e._irisLastSeenAt??-Infinity)<=step+.001)))
    firstSensorSightingAt=g.time;
   if(firstEnemyInPlasmaRangeAt===null&&alive.some(e=>
    Math.hypot(e.x-g.player.x,e.y-g.player.y)<=plasmaRange))
    firstEnemyInPlasmaRangeAt=g.time;
   // Includes patrol departures, not just kills: never report as kill count.
   netAliveDrops+=Math.max(0,prevCount-alive.length);
   const nearby=alive.filter(e=>Math.hypot(e.x-g.player.x,e.y-g.player.y)<850).length;
   maxEnemies=Math.max(maxEnemies,alive.length);maxNearby=Math.max(maxNearby,nearby);
   if(frame%Math.max(1,Math.round(30*hz))===0||g.dead)
    samples.push({time:+g.time.toFixed(1),hull:+g.player.hp.toFixed(1),
     ore:g.player.ore,level:g.player.level,stage,alive:alive.length,nearby});
  }
  return {seed,seconds:+g.time.toFixed(1),dead:g.dead,stage,allowRetreat,
   initialDelay,patrolMode,firstDockAt,
   secondDockAt,missionCompleteAt,
   firstRadarEnemyAt,firstOpticalThreatAt,firstSensorSightingAt,firstEnemyInPlasmaRangeAt,
   firstDamageAt,initialOre,ore:g.player.ore,
   hull:+g.player.hp.toFixed(1),maxHull:g.player.maxHp,level:g.player.level,
   points:g.player.points,returns,repairCount,upgradeCount,hits,
   netAliveDrops,maxEnemies,maxNearby,
   events,samples};
 }finally{
  Math.random=originalRandom;
  if(originalMatchMedia===undefined)delete globalThis.matchMedia;
  else globalThis.matchMedia=originalMatchMedia;
 }
}
// CPU-only pressure probe for the enemy AI and update loop at its hard cap.
// Results are comparative, machine-dependent measurements, not browser FPS.
export function runEncounterStress({seed=111,count=60,frames=300,hz=60}={}){
 const g=earlyFlightFixture(true),originalRandom=Math.random;
 let randomSeed=seed>>>0;
 try{
  Math.random=()=>((randomSeed=Math.imul(randomSeed,1664525)+1013904223>>>0)/4294967296);
  g.time=180;g.spawnClock=1e8;g.holdFire=true;
  g.player.hp=100000;g.player.maxHp=100000;g.player.invul=100000;
  const director={cap:count,groupSize:7,interval:7,
   types:['scout','fighter','flanker']};
  for(let attempts=0;g.enemies.length<count&&attempts<100;attempts++)
   g.spawnGroup(director,{x:g.player.x,y:g.player.y});
  if(g.enemies.length!==count)
   throw new Error('Stress population '+g.enemies.length+' !== '+count);
  for(let i=0;i<g.enemies.length;i++){
   const e=g.enemies[i],angle=i*2.39996;
   const distance=260+(i%11)*45;
   e.x=Math.cos(angle)*distance;e.y=Math.sin(angle)*distance;
  }
  const wallStart=performance.now();
  let maxShots=0,maxEnemies=g.enemies.length;
  for(let i=0;i<frames;i++){
   g.update(1/hz);
   maxShots=Math.max(maxShots,g.shots.length);
   maxEnemies=Math.max(maxEnemies,g.enemies.length);
  }
  const wallMs=performance.now()-wallStart;
  return {seed,requested:count,spawned:count,frames,hz,
   wallMs:+wallMs.toFixed(1),msPerFrame:+(wallMs/frames).toFixed(3),
   maxShots,maxEnemies,scope:'Node CPU-only real update; simulated invulnerable stationary ship; no canvas/audio/GPU'};
 }finally{Math.random=originalRandom;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.includes('--stress')){
  console.log(JSON.stringify({scope:'Machine-dependent Node CPU probe, not GPU FPS',
   scenarios:[20,60,120,180].map(count=>runEncounterStress({count}))},null,2));
 }else if(process.argv.includes('--first-loop')){
  const fast=process.argv.includes('--smoke');
  console.log(JSON.stringify({scope:'Scripted real interaction + update loop; not manual playtest or renderer FPS',
   scenarios:(fast?[111]:[111,222,333]).map(seed=>runFirstLoopScenario({seed,
    seconds:fast?60:120}))},null,2));
 }else{
 const fast=process.argv.includes('--smoke');
 const scenarios=runEarlyCombatMatrix({seeds:fast?[111]:[111,222,333],
  modes:fast?['idle','circle']:['idle','straight','circle','zigzag'],
  seconds:fast?60:120});
 console.log(JSON.stringify(scenarios,null,2));
 }
}
