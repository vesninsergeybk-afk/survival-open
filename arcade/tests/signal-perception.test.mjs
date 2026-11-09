import test from 'node:test';
import assert from 'node:assert/strict';
import {createSignalIntel,alertSignalIntel,alertSignalThreat,
 updateSignalIntent,SIGNAL_AI,canAutoTarget} from '../signal-perception.js';
import {updateEnemy,updateAlly} from '../ai.js';
import {EnemyComms} from '../enemy-comms.js';
import {enemyPursuitTarget} from '../enemy-awareness.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {contactOnCircle} from '../impact-geometry.js';

const actor=(intel=null)=>({
  serial:3,group:7,type:'scout',x:500,y:0,vx:0,vy:0,r:14,hp:28,maxHp:28,
  damage:9,think:0,fire:2,state:'hunt',commitUntil:0,angle:0,
  signalIntel:intel,signalSlot:0,signalExitX:900,signalExitY:0
});
const world=(player={x:0,y:0,hp:110,r:19,invul:0})=>({
  time:30,player,allies:[],grid:{query:()=>[]},
  avoidance:()=>({x:0,y:0}),enemyCanSee:()=>false,
  camera:()=>({x:-600,y:-400,w:1200,h:800}),
  heritage:{play:()=>{}},enemyShot:()=>{},hurt:()=>{}
});
test('extraction signal sends a patrol to the rock rather than an omniscient chase',()=>{
 const intel=createSignalIntel(1000,0,30),e=actor(intel),game=world();
 updateEnemy(e,game,.2);
 assert.equal(intel.mode,'investigate');
 assert.ok(e.x>500,'the ship heads toward the emission on the right');
 assert.ok(e.vx>0);
 assert.equal(e.target,undefined,'investigation does not acquire the player as combat target');
});
test('at the source, a patrol searches for a finite time and then withdraws',()=>{
 const intel=createSignalIntel(1000,0,30);
 const e=actor(intel),game=world();
 e.x=985;e.y=3;
 updateEnemy(e,game,.1);
 assert.equal(intel.mode,'search');
 assert.ok(intel.searchUntil>game.time);
 game.time=intel.searchUntil+.1;e.sensorTimer=0;
 updateEnemy(e,game,.1);
 assert.equal(intel.mode,'withdraw');
 const order=updateSignalIntent(e,game,.1);
 assert.equal(order.retreat,true);
 assert.equal(order.x,900,'withdrawal uses the actual entry coordinate');
});
test('a patrolmate learns of the player only after a transmitted radio alert',()=>{
 const first=actor(createSignalIntel(1000,0,30));
 const second=actor(createSignalIntel(1000,0,30));
 first.serial=1;second.serial=2;first.x=350;second.x=560;
 const game=world({x:300,y:0,hp:110,r:19,invul:0});
 game.enemies=[first,second];game.enemyCanSee=ship=>ship===first;
 game.grid.query=(x,y,r)=>game.enemies.filter(e=>Math.hypot(e.x-x,e.y-y)<=r);
 game.enemyComms=new EnemyComms();game.enemyComms.update(game);
 first.sensorTimer=0;second.sensorTimer=0;
 updateEnemy(first,game,.1);
 assert.equal(first.signalIntel.mode,'engaged');
 assert.equal(first.signalIntel.lastSeenX,300);
 assert.equal(second.signalIntel.mode,'investigate',
  'a nearby patrol has not magically read its wingman’s memory');
 game.time=30.2;updateEnemy(first,game,.1);
 game.time=30.7;game.enemyComms.update(game);
 assert.ok(game.enemyComms.events.some(event=>event.kind==='contact'||event.kind==='order'));
 updateSignalIntent(second,game,.1);
 assert.equal(second.signalIntel.mode,'engaged');
 assert.equal(second.signalIntel.lastSeenX,300);
});
test('large asteroid occlusion can prevent detection at range',()=>{
 const intel=createSignalIntel(500,0,30),e=actor(intel);
 e.x=0;e.y=0;
 const game=world({x:250,y:0,hp:110,r:19,invul:0});
 e.sensorTimer=0;game.enemyCanSee=()=>false;
 updateSignalIntent(e,game,.1);
 assert.equal(intel.mode,'investigate');
 game.enemyCanSee=()=>true;e.sensorTimer=0;
 updateSignalIntent(e,game,.1);
 assert.equal(intel.mode,'engaged');
});
test('after losing a distant player, the group searches the last observed location',()=>{
 const intel=createSignalIntel(100,0,1);
 alertSignalIntel(intel,{x:400,y:160},3);
 const e=actor(intel),game=world({x:1100,y:900,hp:110,r:19,invul:0});
 game.time=10;
 updateSignalIntent(e,game,.3);
 assert.equal(intel.mode,'search');
 assert.equal(intel.searchX,400);
 assert.equal(intel.searchY,160);
 assert.ok(intel.searchUntil>game.time);
});
test('a nearby patrol still loses sight behind a rock after the memory window',()=>{
 const intel=createSignalIntel(500,0,1);alertSignalIntel(intel,{x:160,y:0},2);
 const e=actor(intel),game=world({x:160,y:0,hp:110,r:19,invul:0});
 e.x=0;e.y=0;e.sensorTimer=0;game.time=8;game.enemyCanSee=()=>false;
 updateSignalIntent(e,game,.1);
 assert.equal(intel.mode,'search');
 assert.equal(intel.searchX,160);
});
test('taking a hit triggers pursuit, but unexplained environmental damage need not',()=>{
 const intel=createSignalIntel(100,200,30);
 assert.equal(alertSignalIntel(intel,{x:0,y:0},30),true);
 assert.equal(alertSignalIntel(intel,{x:1,y:2},30.2),false);
 assert.equal(intel.lastSeenX,1);
 assert.equal(intel.mode,'engaged');
 assert.ok(SIGNAL_AI.closeRadius<SIGNAL_AI.detectRadius);
});
test('ordinary encounters still use the original combat AI',()=>{
 const game=world(),e=actor();
 e.signalIntel=null;e.x=350;
 updateEnemy(e,game,.1);
 assert.equal(e.state,'hunt');
 assert.equal(e.target,game.player);
 assert.ok(e.x<350,'ordinary combat waves still pursue the player');
});
test('all autonomous weapons respect unconfirmed signal patrols',()=>{
 const intel=createSignalIntel(300,0,30),patrol=actor(intel);
 assert.equal(canAutoTarget(patrol),false,'investigating patrol stays unconfirmed');
 intel.mode='search';assert.equal(canAutoTarget(patrol),false);
 intel.mode='withdraw';assert.equal(canAutoTarget(patrol),false);
 assert.equal(canAutoTarget(actor()),true,'ordinary waves remain valid combat targets');
 alertSignalIntel(intel,{x:0,y:0,hp:110},33);
 assert.equal(canAutoTarget(patrol),true,'detected threats can be engaged normally');
});
test('drone escort protects extraction but does not betray a hidden player',()=>{
 const intel=createSignalIntel(300,0,30),patrol=actor(intel);
 patrol.x=200;patrol.y=0;
 const p={x:0,y:0,hp:110,r:19};
 let hits=0;
 const game={...world(p),skillRanks:{tactics:0},mining:{active:true},
  network:{armament:0,engine:0},doctrine:null,shotsNear:()=>[],
  nearbyEnemyBase:()=>null,grid:{query:()=>[patrol]},
  damageEnemy:()=>{hits++;},flash:()=>{}};
 const ally={serial:1,role:'scout',x:0,y:40,vx:0,vy:0,r:10,hp:25,think:0,fire:0,state:'follow'};
 updateAlly(ally,game,.1);
 assert.equal(hits,0);assert.equal(ally.state,'guard');
 alertSignalIntel(intel,p,game.time);
 ally.think=0;ally.fire=0;
 updateAlly(ally,game,.1);
 assert.equal(ally.state,'cover');assert.equal(hits,1);
});
test('converted units likewise ignore investigating patrols',()=>{
 const intel=createSignalIntel(300,0,30),patrol=actor(intel);
 patrol.x=110;
 let hits=0;const game={...world(),grid:{query:()=>[patrol]},
  damageEnemy:()=>{hits++;},flash:()=>{}};
 const converted={...actor(),serial:9,converted:true,convertedTime:10,
  x:0,y:0,fire:0};
 updateEnemy(converted,game,.1);
 assert.equal(hits,0);
 alertSignalIntel(intel,game.player,game.time);
 converted.fire=0;updateEnemy(converted,game,.1);
 assert.equal(hits,1);
});
test('a drone shot reveals the drone position, not the hidden player',()=>{
 const intel=createSignalIntel(300,0,30);
 const ally={x:250,y:45,hp:20,role:'fighter'};
 alertSignalIntel(intel,ally,30);
 assert.equal(intel.combatFocus,ally);
 assert.equal(intel.lastSeenX,250);assert.equal(intel.lastSeenY,45);
 const e=actor(intel),game=world();
 e.x=50;e.y=0;e.sensorTimer=1;
 updateEnemy(e,game,.1);
 assert.equal(e.target,ally,'investigating group responds to its actual attacker');
});
test('a hidden long-range hit alerts a patrol without granting exact coordinates',()=>{
 const player={x:820,y:40,hp:110,r:19},intel=createSignalIntel(120,90,0);
 const enemy=actor(intel);enemy.x=100;enemy.y=100;enemy.hp=70;enemy.maxHp=70;
 const g=new RuntimeHarness();Object.assign(g,{player,time:1,
  enemyCanSee:()=>false,visuals:{},heritage:{play(){},vfx:{hullImpact(){}}}});
 const contact=contactOnCircle(enemy.x,enemy.y,enemy.r,player.x,player.y);
 g.damageEnemy(enemy,5,'rail',contact);
 const pursuit=enemyPursuitTarget(enemy,{time:1.1,player});
 assert.equal(intel.mode,'engaged','being attacked must not prevent return fire');
 assert.equal(canAutoTarget(enemy),true);
 assert.equal(intel.lastSeenEstimated,true);
 assert.equal(intel.combatFocus,null);
 assert.notDeepEqual([pursuit.x,pursuit.y],[player.x,player.y]);
 assert.ok(Math.hypot(pursuit.x-player.x,pursuit.y-player.y)>100,
  'the victim must not track an unseen gunner at a measured world coordinate');
 const visible=createSignalIntel(120,90,0);
 const sighted=actor(visible);sighted.x=100;sighted.y=100;
 Object.assign(g,{enemyCanSee:()=>true,time:2});
 g.damageEnemy(sighted,5,'rail',contact);
 assert.equal(visible.lastSeenX,player.x,
  'actual line of sight may legitimately reveal an attacker');
});

test('an estimated radio contact never becomes a magically precise target lock',()=>{
 const p={x:1100,y:500,hp:100,r:19},intel=createSignalIntel(0,0,0);
 const e=actor(intel),g=world(p);g.time=1;
 g.enemyComms={directiveFor:()=>({intel:{x:360,y:120,vx:0,vy:0,
   at:1,estimated:true}})};
 updateSignalIntent(e,g,.05);
 assert.equal(intel.mode,'engaged');
 assert.equal(intel.combatFocus,null);
 assert.equal(intel.lastSeenEstimated,true);
 assert.deepEqual([enemyPursuitTarget(e,g).x,enemyPursuitTarget(e,g).y],
  [360,120]);
 assert.equal(alertSignalThreat(intel,{x:240,y:0,estimated:true},1.1),true);
 assert.equal(intel.combatFocus,null);
});
test('an identified allied attacker can be reacquired without revealing the player',()=>{
 const intel=createSignalIntel(300,0,30);
 const ally={x:200,y:30,hp:30,role:'fighter'};
 alertSignalIntel(intel,ally,30);
 const e=actor(intel),game=world({x:1200,y:1200,hp:110,r:19,invul:0});
 e.x=50;e.y=0;e.sensorTimer=0;game.time=36;
 game.enemyCanSee=(ship,target)=>target===ally;
 updateSignalIntent(e,game,.1);
 assert.equal(intel.mode,'engaged');
 assert.equal(intel.combatFocus,ally);
 assert.equal(intel.lastSeenAt,36);
});
test('gameplay and HUD use the same player-facing signal state',async()=>{
 const {readFileSync}=await import('node:fs');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const hud=readFileSync(new URL('../hud.js',import.meta.url),'utf8');
 assert.match(game,/this\.spawnGroup\(noisePatrolDirector\(alarm,before\),source\)/);
 assert.match(game,/armNoiseCourier\(this,this\.enemies\.slice\(before\),source\)/);
 assert.match(game,/this\.lastNoiseSource=\{x:rock\.x,y:rock\.y\}/);
 assert.match(game,/this\.noiseAlert=\{x:source\.x,y:source\.y,/);
 assert.match(game,/if\(e\.signalIntel&&aggressor\)/);
 assert.match(readFileSync(new URL('../combat-targets.js',import.meta.url),'utf8'),/canAutoTarget\(t\)/);
 assert.match(hud,/ПАТРУЛЬ ИЩЕТ ИСТОЧНИК/);
 assert.match(hud,/ПЕРЕХОД В АТАКУ/);
 assert.match(hud,/SIGNAL|СИГНАЛ/);
});
