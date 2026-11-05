import test from 'node:test';
import assert from 'node:assert/strict';
import {OPENING_ARC,createOpeningArc,beginOpeningArc,advanceOpeningArc,
 openingArcActive,openingArcObjective,openingArcPressure,validateOpeningArc,runClock} from '../opening-arc.js';
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
 assert.equal(advanceOpeningArc(a,32,2,{repairing:true,withinRange:true}),'rescue-complete');
 assert.equal(a.status,'complete');
 assert.equal(a.alarmUntil,32+OPENING_ARC.rescueAlarm);
 assert.equal(advanceOpeningArc(a,33,2,{repairing:true,withinRange:true}),'idle',
  'no repeated award after completion');
});

test('interception only succeeds on actual destroyed commander, and missing deadline is failure',()=>{
 const a=arc();beginOpeningArc(a,'intercept',18);
 assert.equal(advanceOpeningArc(a,19,.1,{commanderAlive:true}),'active');
 assert.equal(advanceOpeningArc(a,24,.1,{commanderAlive:false}),'intercept-complete');
 assert.equal(a.reliefUntil,24+OPENING_ARC.interceptRelief);
 assert.equal(advanceOpeningArc(a,25,.1,{commanderAlive:false}),'idle');
 const b=arc();beginOpeningArc(b,'intercept',18);
 assert.equal(advanceOpeningArc(b,b.expiresAt,.1,{commanderAlive:false}),'failed',
  'an enemy destroyed after the deadline cannot award success');
 assert.equal(b.reliefUntil,0);
});

test('real ship selection spawns one marked pilot and two escorts, with one priority goal',()=>{
 const g=Object.create(RuntimeHarness.prototype),a=arc(),events=[];
 Object.assign(g,{openingArc:a,time:16,enemySerial:0,groupSerial:0,
  player:{x:0,y:0,hp:110},enemies:[],waypoint:{id:'0:0',x:360,y:-85,label:'Док'},
  overlay:{dataset:{mode:'opening-choice'}},dismiss:()=>{},notice:t=>events.push(t)});
 g.chooseOpeningRoute('intercept');
 assert.equal(a.status,'active');assert.equal(a.kind,'intercept');
 assert.equal(g.enemies.length,3);
 assert.equal(g.enemies.filter(e=>e.openingCommander).length,1);
 assert.equal(g.enemies[0].hp>=100,true);
 assert.ok(g.enemies.slice(1).every(e=>e.protect===g.enemies[0]));
 assert.equal(g.waypoint.id,'opening-intercept');
 assert.deepEqual(a.returnWaypoint,{id:'0:0',x:360,y:-85,label:'Док'});
 assert.equal(events.length,1);
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

test('short recovery windows punctuate the first ten minutes without disabling danger',()=>{
 const base={cap:20,interval:4,groupSize:3,types:['scout','fighter']};
 const quiet=openingArcPressure(base,null,115,{x:0,y:0},home);
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
 assert.equal(runClock(63.9),'01:03');assert.equal(runClock(-100),'00:00');
 assert.equal(validateOpeningArc({...a,repair:1000}),false);
 assert.equal(validateOpeningArc({...a,commanderSerial:-2}),false);
 assert.equal(validateOpeningArc({...a,returnWaypoint:{id:'n',x:NaN,y:0}}),false);
 assert.equal(validateOpeningArc({...a,status:'unknown'}),false);
});

test('game grants interceptor payout and relief once, then offers an actual module',()=>{
 const a=arc();beginOpeningArc(a,'intercept',20);a.commanderSerial=7;
 const notes=[],gain=[],g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{time:43,openingArc:a,openingRepairing:false,
  visuals:{capitalDamageQA:false},world:{home},waypoint:{id:'opening-intercept'},
  enemies:[],player:{x:0,y:0,hp:110,ore:0,data:0},firstHardwareReward:null,
  cockpit:{resourceGain:v=>gain.push(v)},collect:v=>{g.player.data+=v.value;},
  notice:t=>notes.push(t),endInteraction:()=>{},showOpeningReward:()=>{g.rewardShown=true;}});
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
 const g=Object.create(RuntimeHarness.prototype);
 Object.assign(g,{time:30,openingArc:a,openingRepairing:true,
  visuals:{capitalDamageQA:false},world:{home},waypoint:{id:'opening-rescue'},
  enemies:[],player:{x:a.rescueX,y:a.rescueY,hp:110,ore:3,shield:0},
  firstHardwareReward:null,cockpit:{resourceGain:()=>{}},notice:()=>{},
  endInteraction:()=>{},showOpeningReward:()=>{g.rewardShown=true;}});
 g.updateOpeningArc(1.5);assert.equal(a.status,'active');assert.equal(g.player.ore,3);
 g.player.x+=200;g.updateOpeningArc(10);
 assert.equal(a.status,'active');assert.equal(a.repair,1.5);
 g.player.x=a.rescueX;g.updateOpeningArc(2.1);
 assert.equal(a.status,'complete');assert.equal(a.alarmUntil,130);
 assert.equal(g.player.ore,3+OPENING_ARC.rescueRewardOre);
 assert.equal(g.player.shield,OPENING_ARC.rescueShield);
 assert.equal(g.rewardShown,true);
 g.updateOpeningArc(10);assert.equal(g.player.ore,3+OPENING_ARC.rescueRewardOre);
});

test('opening hardware claim immediately fits a module and rejects a duplicate',()=>{
 const g=Object.create(RuntimeHarness.prototype),events=[];
 Object.assign(g,{shipLoadout:createLoadout(),firstHardwareReward:'pending',
  overlay:{dataset:{mode:'opening-reward'}},hangarSession:{dirty:()=>false,begin:()=>{}},
  syncShipLoadout:()=>{},dismiss:()=>{},heritage:{ui:()=>{}},
  notice:t=>events.push(t)});
 g.claimOpeningReward('rail');
 assert.equal(g.firstHardwareReward,'rail');
 assert.deepEqual(g.shipLoadout.slots.slice(0,2),['plasma','rail']);
 assert.equal(g.shipLoadout.owned.rail,1);
 g.claimOpeningReward('flak');
 assert.equal(g.shipLoadout.owned.flak,undefined);
 assert.equal(events.length,2);
});
