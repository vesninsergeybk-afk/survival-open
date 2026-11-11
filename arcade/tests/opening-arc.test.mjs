import test from 'node:test';
import assert from 'node:assert/strict';
import {OPENING_ARC,createOpeningArc,beginOpeningArc,advanceOpeningArc,
 openingArcActive,openingArcObjective,openingArcPressure,openingWaypointCue,recordOpeningCommanderDefeat,
 validateOpeningArc,runClock} from '../opening-arc.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {createLoadout} from '../ship-loadout.js';

const home={x:360,y:-85};
const arc=()=>createOpeningArc(home);

test('first dilemma is optional and never activates both missions',()=>{
 const a=arc();assert.ok(validateOpeningArc(a));
 assert.equal(beginOpeningArc(a,'rescue',16),true);
 assert.equal(beginOpeningArc(a,'intercept',17),false);
 assert.equal(a.expiresAt,16+OPENING_ARC.deadline);
 assert.equal(openingArcActive(a),true);
 const skipped=arc();skipped.status='skipped';
 assert.equal(beginOpeningArc(skipped,'rescue',30),false);
});

test('rescue requires actual held interaction in range and persists partial effort',()=>{
 const a=arc();beginOpeningArc(a,'rescue',20);
 assert.equal(advanceOpeningArc(a,25,2,{repairing:false,withinRange:true}),'active');
 assert.equal(advanceOpeningArc(a,26,2,{repairing:true,withinRange:false}),'active');
 assert.equal(a.repair,0);
 assert.equal(advanceOpeningArc(a,27,1.5,{repairing:true,withinRange:true}),'active');
 assert.equal(advanceOpeningArc(a,28,1,{repairing:false,withinRange:true}),'active');
 assert.equal(a.repair,1.5);
 assert.equal(a.rescuePulseUsed,false);
 assert.equal(advanceOpeningArc(a,32,10,{repairing:true,withinRange:true}),'rescue-extracted');
 assert.equal(a.status,'active');assert.equal(a.rescueStage,'return');
 assert.equal(advanceOpeningArc(a,33,1,{returnedToDock:false}),'active');
 assert.equal(advanceOpeningArc(a,36,1,{returnedToDock:true}),'rescue-complete');
 assert.equal(a.status,'complete');
 assert.equal(a.rescuePulseUsed,true,'the one-time defensive pulse is earned by actual work');
 assert.equal(a.alarmUntil,36+OPENING_ARC.rescueAlarm);
 assert.equal(advanceOpeningArc(a,33,2,{repairing:true,withinRange:true}),'idle',
  'no repeated award after completion');
});

test('interception only succeeds on actual destroyed commander, and missing deadline is failure',()=>{
 const a=arc();beginOpeningArc(a,'intercept',18);
 a.commanderSerial=7;
 assert.equal(advanceOpeningArc(a,19,.1,{commanderDefeated:false}),'active');
 assert.equal(advanceOpeningArc(a,20,.1,{commanderDefeated:true}),'intercept-complete');
 assert.equal(a.reliefUntil,20+OPENING_ARC.interceptRelief);
 assert.equal(advanceOpeningArc(a,25,.1,{commanderDefeated:true}),'idle');
 const b=arc();beginOpeningArc(b,'intercept',18);
 b.commanderSerial=8;
 assert.equal(advanceOpeningArc(b,b.expiresAt,.1,{commanderDefeated:true}),'failed',
  'an enemy destroyed after the deadline cannot award success');
 assert.equal(b.reliefUntil,0);
 const c=arc();beginOpeningArc(c,'intercept',18);c.commanderSerial=9;
 assert.equal(recordOpeningCommanderDefeat(c,{serial:9,openingCommander:true,hp:0},
  c.expiresAt-.001),true);
 assert.equal(advanceOpeningArc(c,c.expiresAt+.02,.02,
  {commanderDefeated:true}),'intercept-complete',
  'a kill on the final frame is credited even when the next update is past the timer');
});

test('missing or unrelated commanders never turn an intercept into a free reward',()=>{
 const a=arc();beginOpeningArc(a,'intercept',18);a.commanderSerial=7;
 assert.equal(advanceOpeningArc(a,25,.1,{commanderDefeated:false}),'active');
 assert.equal(recordOpeningCommanderDefeat(a,{serial:7,openingCommander:true,hp:100},25),false);
 assert.equal(recordOpeningCommanderDefeat(a,{serial:8,openingCommander:true,hp:0},25),false);
 assert.equal(recordOpeningCommanderDefeat(a,{serial:7,openingCommander:false,hp:0},25),false);
 assert.equal(recordOpeningCommanderDefeat(a,{serial:7,openingCommander:true,hp:0,expAwarded:true},25),false,
  'an offscreen retreat is not a player victory');
 assert.equal(recordOpeningCommanderDefeat(a,{serial:7,openingCommander:true,hp:0},25),true);
 assert.equal(advanceOpeningArc(a,26,.1,{commanderDefeated:a.commanderDefeated}),'intercept-complete');
 assert.equal(recordOpeningCommanderDefeat(a,{serial:7,openingCommander:true,hp:0},27),false);
 const oldSave=arc();delete oldSave.commanderDefeated;
 assert.ok(validateOpeningArc(oldSave),'old saves are accepted without a phantom kill');
 assert.equal(validateOpeningArc({...a,commanderDefeated:'yes'}),false);
});

test('interception spawns armed ordinary ships and a three-drone blue school',()=>{
 const g=Object.create(RuntimeHarness.prototype),a=arc(),events=[];
 Object.assign(g,{openingArc:a,time:16,enemySerial:0,groupSerial:0,
  player:{x:0,y:0,hp:110},enemies:[],waypoint:{id:'0:0',x:360,y:-85,label:'Док'},
  overlay:{dataset:{mode:'opening-choice'}},dismiss:()=>{},notice:t=>events.push(t)});
 g.chooseOpeningRoute('intercept');
 assert.equal(a.status,'active');assert.equal(a.kind,'intercept');
 assert.equal(g.enemies.length,6);
 assert.equal(g.enemies.filter(e=>e.openingCommander).length,1);
 assert.equal(g.enemies[0].hp>=100,true);
 assert.ok(g.enemies.slice(1).every(e=>e.protect===g.enemies[0]));
 assert.ok(g.enemies.slice(1).every(e=>e.missionStructure&&
  e.scenario==='opening-escort'));
 assert.deepEqual(g.enemies.slice(1,3).map(e=>e.openingEscortSlot),[-1,1]);
 assert.deepEqual(g.enemies.slice(1,3).map(e=>e.type),['fighter','flanker']);
 assert.deepEqual(g.enemies.slice(3).map(e=>e.openingTriangleSlot),[0,1,2]);
 assert.ok(g.enemies.slice(3).every(e=>e.openingBlueTriangle&&e.hp===26));
 assert.equal(g.waypoint.id,'opening-intercept');
 assert.deepEqual(a.returnWaypoint,{id:'0:0',x:360,y:-85,label:'Док'});
 assert.equal(events.length,1);
});

test('intercept arrow follows the living commander but respects a new player waypoint',()=>{
 const a=arc();beginOpeningArc(a,'intercept',16);a.commanderSerial=12;
 const enemy={serial:12,x:115,y:230,hp:100};
 const g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{openingArc:a,time:30,visuals:{capitalDamageQA:false},enemies:[enemy],
  player:{x:0,y:0},waypoint:{id:'opening-intercept',x:a.interceptX,y:a.interceptY},
  world:{home},openingRepairing:false});
 g.updateOpeningArc(.05);
 assert.equal(g.waypoint.x,115);assert.equal(g.waypoint.y,230);
 enemy.x=290;enemy.y=-81;g.updateOpeningArc(.05);
 assert.equal(g.waypoint.x,290);assert.equal(g.waypoint.y,-81);
 g.waypoint={id:'player-choice',x:800,y:900};enemy.x=300;
 g.updateOpeningArc(.05);
 assert.equal(g.waypoint.x,800,'the opening mission does not hijack a later chosen route');
});

test('rescue selection creates three ordinary guards, blue interceptors and a timed tug',()=>{
 const a=arc(),g=Object.create(RuntimeHarness.prototype),notes=[];
 Object.assign(g,{openingArc:a,time:16,enemySerial:0,groupSerial:0,
  player:{x:home.x,y:home.y},enemies:[],waypoint:null,
  overlay:{dataset:{mode:'opening-choice'}},dismiss:()=>{},
  notice:t=>notes.push(t),controlLabel:()=> 'E'});
 g.chooseOpeningRoute('rescue');
 assert.equal(a.rescueGuardsSpawned,true);
 assert.equal(g.enemies.length,6);
 assert.ok(g.enemies.every(e=>e.openingRescueRole==='guard'&&e.protect?.hp===100));
 assert.ok(g.enemies.every(e=>e.guardPost?.x===e.x&&e.guardPost?.y===e.y));
 assert.deepEqual(g.enemies.map(e=>e.rescueSlot),[0,1,2,3,4,5]);
 assert.deepEqual(g.enemies.slice(0,3).map(e=>e.type),['fighter','flanker','fighter']);
 assert.equal(g.enemies.filter(e=>e.openingBlueTriangle).length,3);
 assert.equal(a.rescueTugAt,16+OPENING_ARC.rescueTugDelay);
 assert.equal(g.waypoint.id,'opening-rescue');
 assert.match(notes[0],/буксир/);
});

test('the hostile tug steals unattended capsules, damage breaks its capture progress',()=>{
 const a=arc();beginOpeningArc(a,'rescue',20);a.rescueTugLock=8;
 assert.equal(advanceOpeningArc(a,30,2,{tugAtCapsule:false}),'active');
 assert.ok(a.rescueTugLock<8);
 assert.equal(advanceOpeningArc(a,34,6,{tugAtCapsule:true}),'rescue-stolen');
 assert.equal(a.status,'failed');
 const b=arc();beginOpeningArc(b,'rescue',20);
 assert.equal(advanceOpeningArc(b,45,OPENING_ARC.repairSeconds,
  {repairing:true,withinRange:true,tugAtCapsule:true}),'rescue-extracted');
 assert.equal(b.rescueStage,'return');
 assert.equal(validateOpeningArc({...b,rescueTugLock:500}),false);
});

test('rescue tug travels towards the capsule, and live enemies are released after success',()=>{
 const a=arc();beginOpeningArc(a,'rescue',20);
 const g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{time:20+OPENING_ARC.rescueTugDelay,openingArc:a,
  enemySerial:0,groupSerial:0,openingRepairing:false,
  visuals:{capitalDamageQA:false},world:{home},waypoint:{id:'opening-rescue'},
  player:{x:a.rescueX,y:a.rescueY,vx:0,vy:0,hp:110,maxHp:110,shield:0,ore:0},
  enemies:[],notice:()=>{},heritage:{play:()=>{}},endInteraction:()=>{},
  cockpit:{resourceGain:()=>{}},showOpeningReward:()=>{},
  awardExperience:()=>{},rewardNotice:()=>{}});
 g.updateOpeningArc(.05);
 const tug=g.enemies.find(e=>e.openingRescueRole==='tug');
 const escort=g.enemies.find(e=>e.openingRescueRole==='escort');
 assert.ok(tug?.missionFlight,'enemy recovery is a real travelling craft');
 assert.equal(escort?.protect,tug);
 assert.equal(escort?.rescueSlot,1);
 assert.equal(g.enemies.length,8,'six site defenders and a tug with escort');
 a.repair=OPENING_ARC.repairSeconds;a.rescueStage='return';
 a.rescueCargoX=home.x;a.rescueCargoY=home.y;
 g.player.x=home.x;g.player.y=home.y;
 g.updateOpeningArc(.1);
 assert.equal(a.status,'complete');
 assert.equal(g.enemies.every(e=>e.openingRescueRole===undefined),true);
 assert.equal(g.enemies.every(e=>e.missionFlight===undefined),true,
  'a surviving tug must not hover at the capsule forever');
});

test('the opening choice does not obscure an already accepted station contract',()=>{
 const a=arc(),g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{openingArc:a,time:26,visuals:{capitalDamageQA:false},
  player:{x:home.x,y:home.y},world:{home},operation:null,
  contract:{kind:'kill',goal:2,progress:0},showOpeningChoice(){this.offers=(this.offers||0)+1;}});
 g.updateOpeningArc(.02);
 assert.equal(g.offers,undefined);
 assert.equal(a.status,'offer');
 g.contract=null;
 g.updateOpeningArc(.02);
 assert.equal(g.offers,1,'the choice can appear after finishing the contract');
});

test('pressure differs visibly by player action but never affects distant regions',()=>{
 const base={cap:21,interval:4,groupSize:3,types:['scout','fighter']};
 const a=arc();a.status='complete';a.reliefUntil=260;
 const b=arc();b.status='complete';b.alarmUntil=260;
 const near={x:360,y:-85},far={x:35000,y:7000};
 const regular=openingArcPressure(base,null,200,near,home);
 const quiet=openingArcPressure(base,a,200,near,home);
 const loud=openingArcPressure(base,b,200,near,home);
 assert.ok(quiet.interval>regular.interval);
 assert.ok(quiet.cap<regular.cap);
 assert.ok(loud.interval<regular.interval);
 assert.ok(loud.cap>regular.cap);
 assert.deepEqual(openingArcPressure(base,a,610,far,home),base);
 assert.deepEqual(openingArcPressure(base,b,610,far,home),base);
});

test('active crisis holds back ambient swarms; rescue completion immediately removes relief',()=>{
 const base={cap:9,interval:5,groupSize:3,types:['scout','fighter']};
 const a=arc();beginOpeningArc(a,'rescue',22);
 const active=openingArcPressure(base,a,63,home,home);
 assert.ok(active.interval>base.interval);
 assert.ok(active.cap<base.cap);
 assert.deepEqual(openingArcPressure(base,a,63,{x:15000,y:0},home),base);
 a.status='complete';a.alarmUntil=163;
 const result=openingArcPressure(base,a,64,home,home);
 assert.ok(result.interval<base.interval,'rescue consequence must be a real alarm');
 assert.ok(result.cap>base.cap);
});

test('short recovery windows punctuate the first ten minutes without disabling danger',()=>{
 const base={cap:20,interval:4,groupSize:3,types:['scout','fighter']};
 const quiet=openingArcPressure(base,null,200,{x:0,y:0},home);
 const danger=openingArcPressure(base,null,150,{x:0,y:0},home);
 assert.ok(quiet.interval>danger.interval);
 assert.ok(quiet.cap<danger.cap);
 assert.ok(quiet.cap>=4);
 assert.deepEqual(openingArcPressure(base,null,115,{x:30000,y:0},home),base,
  'recovery beats must not make distant dangerous regions easier');
 assert.deepEqual(openingArcPressure(base,null,601,{x:0,y:0},home),base);
});

test('timers, labels and invalid checkpoint data are bounded',()=>{
 const a=arc();beginOpeningArc(a,'rescue',20);
 assert.match(openingArcObjective(a,50),/ЭВАКУАЦИЯ/);
 assert.match(openingArcObjective(a,50,true),/держите «Действие»/,
  'a touch user must see the actual on-screen control, not a keyboard key');
 assert.doesNotMatch(openingArcObjective(a,50,true),/удерживайте E/);
 assert.equal(openingWaypointCue({id:'opening-intercept'},1026.3),'НАВОДЧИК · 1026 М');
 assert.equal(openingWaypointCue({id:'opening-rescue'},150),'КАПСУЛА · 150 М');
 assert.equal(openingWaypointCue({id:'0:0'},150),'');
 assert.equal(runClock(63.9),'01:03');assert.equal(runClock(-100),'00:00');
 assert.equal(validateOpeningArc({...a,repair:1000}),false);
 assert.equal(validateOpeningArc({...a,commanderSerial:-2}),false);
 assert.equal(validateOpeningArc({...a,returnWaypoint:{id:'n',x:NaN,y:0}}),false);
 assert.equal(validateOpeningArc({...a,status:'unknown'}),false);
 assert.equal(validateOpeningArc({...a,rescueStage:'return',repair:0}),false);
});

test('opening rescue briefing names the touch action without inventing a keyboard',()=>{
 const a=arc(),notices=[],g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{openingArc:a,time:16,isTouchLayout:true,
  overlay:{dataset:{mode:'opening-choice'}},waypoint:null,dismiss:()=>{},
  notice:t=>notices.push(t)});
 g.chooseOpeningRoute('rescue');
 assert.equal(a.kind,'rescue');assert.equal(g.waypoint.id,'opening-rescue');
 assert.match(notices[0],/«Действие»/);
 assert.doesNotMatch(notices[0],/Удерживайте E/);
});

test('game grants interceptor payout and relief once, then offers an actual module',()=>{
 const a=arc();beginOpeningArc(a,'intercept',20);a.commanderSerial=7;
 const notes=[],gain=[],g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{time:43,openingArc:a,openingRepairing:false,
  visuals:{capitalDamageQA:false},world:{home},waypoint:{id:'opening-intercept'},
  enemies:[],player:{x:0,y:0,hp:110,ore:0,data:0},firstHardwareReward:null,
  cockpit:{resourceGain:v=>gain.push(v)},collect:v=>{g.player.data+=v.value;},
  notice:t=>notes.push(t),endInteraction:()=>{},showOpeningReward:()=>{g.rewardShown=true;}});
 assert.equal(g.updateOpeningArc(.05),undefined);
 assert.equal(a.status,'active','a missing commander is not an observed kill');
 assert.equal(g.player.ore,0);
 a.commanderDefeated=true;a.commanderDefeatedAt=42;
 g.updateOpeningArc(.05);
 assert.equal(a.status,'complete');assert.equal(a.reliefUntil,163);
 assert.equal(g.player.ore,OPENING_ARC.interceptRewardOre);
 assert.equal(g.player.data,OPENING_ARC.interceptRewardData);
 assert.equal(g.firstHardwareReward,'pending');assert.equal(g.rewardShown,true);
 assert.equal(g.waypoint,null);assert.equal(gain.length,1);
 g.updateOpeningArc(.05);
 assert.equal(g.player.ore,OPENING_ARC.interceptRewardOre);
 assert.equal(notes.length,1);
});

test('game rescue is a genuine sustained action with a consequence and one payout',()=>{
 const a=arc();beginOpeningArc(a,'rescue',20);
 a.rescueGuardsSpawned=true;a.rescueTugSpawned=true;
 const g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{time:30,openingArc:a,openingRepairing:true,enemySerial:0,groupSerial:0,
  visuals:{capitalDamageQA:false},world:{home:{...home,id:'0:0'}},waypoint:{id:'opening-rescue'},
  enemies:[],player:{x:a.rescueX,y:a.rescueY,vx:0,vy:0,hp:30,maxHp:110,ore:3,shield:0},
  firstHardwareReward:null,cockpit:{resourceGain:()=>{}},notice:()=>{},
  endInteraction:()=>{},showOpeningReward:()=>{g.rewardShown=true;}});
 g.updateOpeningArc(1.5);assert.equal(a.status,'active');assert.equal(g.player.ore,3);
 g.player.x+=200;g.updateOpeningArc(10);
 assert.equal(a.status,'active');assert.equal(a.repair,1.5);
 g.player.x=a.rescueX;g.updateOpeningArc(10.1);
 assert.equal(a.status,'active');assert.equal(a.rescueStage,'return');
 assert.equal(g.player.ore,3,'extraction alone must never pay the reward');
 assert.equal(g.waypoint.id,'opening-rescue-return');
 g.player.x=home.x;g.player.y=home.y;g.updateOpeningArc(1);
 assert.equal(a.status,'complete');assert.equal(a.alarmUntil,130);
 assert.equal(g.player.ore,3+OPENING_ARC.rescueRewardOre);
 assert.equal(g.player.shield,OPENING_ARC.rescueShield);
 assert.equal(g.waypoint.id,'0:0','a wounded survivor gets a real return route');
 assert.equal(g.rewardShown,true);
 g.updateOpeningArc(10);assert.equal(g.player.ore,3+OPENING_ARC.rescueRewardOre);
});

test('capsule emits one shielding pulse halfway, clears nearby bullets, and cannot be farmed',()=>{
 const a=arc();beginOpeningArc(a,'rescue',20);
 a.rescueGuardsSpawned=true;a.rescueTugSpawned=true;
 const close={x:a.rescueX+100,y:a.rescueY,alive:true};
 const far={x:a.rescueX+400,y:a.rescueY,alive:true};
 const effects=[],notes=[];
 const g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{time:28,openingArc:a,openingRepairing:true,enemySerial:0,groupSerial:0,
  visuals:{capitalDamageQA:false},
  world:{home},waypoint:{id:'opening-rescue'},
  player:{x:a.rescueX,y:a.rescueY,vx:0,vy:0,hp:110,maxHp:110,ore:0,shield:0},
  shots:[close,far],enemies:[],heritage:{vfx:{nova:(...args)=>effects.push(args)},play:()=>{}},
  cockpit:{resourceGain:()=>{}},notice:t=>notes.push(t),endInteraction:()=>{},
  showOpeningReward:()=>{g.rewardShown=true;}});
 g.updateOpeningArc(OPENING_ARC.repairSeconds*.52);
 assert.equal(a.status,'active');assert.equal(a.rescuePulseUsed,true);
 assert.equal(g.player.shield,OPENING_ARC.rescuePulseShield);
 assert.equal(close.alive,false);assert.equal(far.alive,true);
 assert.equal(effects.length,1);assert.match(notes[0],/Защитный импульс/);
 g.player.shield=0;g.openingRepairing=false;g.updateOpeningArc(.5);
 assert.equal(g.player.shield,0,'interrupting and returning cannot retrigger the shield');
 g.openingRepairing=true;g.updateOpeningArc(OPENING_ARC.repairSeconds*.5);
 assert.equal(a.rescueStage,'return');assert.equal(a.status,'active');
 assert.equal(g.player.shield,0);assert.equal(effects.length,1);
 assert.equal(g.rewardShown,undefined);
 g.player.x=home.x;g.player.y=home.y;g.updateOpeningArc(1);
 assert.equal(a.status,'complete');assert.equal(g.player.shield,OPENING_ARC.rescueShield);
 assert.equal(g.rewardShown,true);
 assert.ok(validateOpeningArc(a),'a pulse-marked rescue remains checkpoint-safe');
 assert.equal(validateOpeningArc({...a,rescuePulseUsed:'yes'}),false);
 const old=arc();delete old.rescuePulseUsed;
 assert.equal(validateOpeningArc(old),true,'old saves lacking the new flag remain valid');
});

test('opening hardware claim immediately fits a module and rejects a duplicate',()=>{
 const g=Object.create(RuntimeHarness.prototype),events=[];
 Object.assign(g,{shipLoadout:createLoadout(),firstHardwareReward:'pending',
  player:{hp:25,maxHp:110},
  overlay:{dataset:{mode:'opening-reward'}},hangarSession:{dirty:()=>false,begin:()=>{}},
  syncShipLoadout:()=>{},dismiss:()=>{},heritage:{ui:()=>{}},
  notice:t=>events.push(t)});
 g.claimOpeningReward('rail');
 assert.equal(g.firstHardwareReward,'rail');
 assert.deepEqual(g.shipLoadout.slots.slice(0,2),['plasma','rail']);
 assert.equal(g.shipLoadout.owned.rail,1);
 assert.equal(g.hangarSession.focusWeapon,'rail');
 assert.equal(g.hangarSession.slot,1);
 g.claimOpeningReward('flak');
 assert.equal(g.shipLoadout.owned.flak,undefined);
 assert.equal(events.length,2);
 assert.match(events[0],/ремонта/,'critical hull prompts a meaningful next action');
});
