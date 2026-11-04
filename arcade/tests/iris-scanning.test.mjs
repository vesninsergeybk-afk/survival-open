import test from 'node:test';
import assert from 'node:assert/strict';
import {IRIS_SCAN,irisScanExtension,updateIrisPerception,irisSearchGoal,
 irisBurstThrust,irisBurstJink}
 from '../iris-scanning.js';
import {updateEnemy} from '../ai.js';
import {createSignalIntel,alertSignalIntel} from '../signal-perception.js';

test('jaws expand, hold and retract with continuous eased motion',()=>{
 const start=30,total=IRIS_SCAN.open+IRIS_SCAN.hold+IRIS_SCAN.close;
 assert.equal(irisScanExtension(start-.1,start),0);
 assert.equal(irisScanExtension(start,start),0);
 assert.equal(irisScanExtension(start+IRIS_SCAN.open,start),1);
 assert.equal(irisScanExtension(start+IRIS_SCAN.open+IRIS_SCAN.hold,start),1);
 assert.equal(irisScanExtension(start+total,start),0);
 assert.equal(irisScanExtension(start+.65,start,true),1);
 let previous=0;
 for(let frame=0;frame<=Math.round(total*60);frame++){
  const extension=irisScanExtension(start+frame/60,start);
  assert.ok(extension>=0&&extension<=1);
  assert.ok(Math.abs(extension-previous)<.06,
   'a 60 FPS animation cannot jump between opening positions');
  previous=extension;
 }
});

function scene(){
 const player={x:140,y:0,r:19,hp:100},e={type:'scout',serial:2,
  x:0,y:0,vx:160,vy:0,think:9,hp:28,maxHp:28,damage:9};
 const game={time:0,player,visible:false,enemyCanSee(){return this.visible;}};
 return {game,e};
}

test('real line-of-sight acquisition bends an inertial flight instead of freezing',()=>{
 const {game,e}=scene();game.visible=true;game.time=1;
 assert.equal(updateIrisPerception(e,game,1/60),true);
 assert.equal(e._irisScanMode,'acquire');
 assert.equal(e._irisLastSeenX,140);
 const beginningSpeed=Math.hypot(e.vx,e.vy);
 for(let i=0;i<50;i++){
  game.time+=1/60;updateIrisPerception(e,game,1/60);
 }
 assert.ok(beginningSpeed>145,'the drone retains almost all inertia initially');
 assert.ok(Math.hypot(e.vx,e.vy)>55,'the scout remains a moving target');
 assert.ok(Math.hypot(e.x,e.y)>30,'the scanner actually flies a curved path');
 assert.ok(Math.abs(e.vy)>15,'the new path differs from straight-line pursuit');
});

test('scanning trajectory remains stable at 30 and 60 updates per second',()=>{
 const simulate=dt=>{
  const {game,e}=scene();game.visible=true;game.time=1;
  updateIrisPerception(e,game,dt);
  for(let i=1;i<Math.round(.9/dt);i++){
   game.time+=dt;updateIrisPerception(e,game,dt);
  }
  return e;
 };
 const thirty=simulate(1/30),sixty=simulate(1/60);
 assert.ok(Math.hypot(thirty.x-sixty.x,thirty.y-sixty.y)<9,
  'the acceleration cap produces similar paths across frame rates');
});

test('an incoming missile triggers an outward evasive bend during scanning',()=>{
 const {game,e}=scene();game.visible=true;game.time=1;
 game.missiles=[{x:35,y:0,life:2,target:e}];
 updateIrisPerception(e,game,1/60);
 assert.ok(e._irisScanEvadeUntil>game.time);
 for(let i=0;i<23;i++){
  game.time+=1/60;updateIrisPerception(e,game,1/60);
 }
 assert.ok(Math.hypot(e.vx,e.vy)>40);
 assert.ok(e._irisScanEvadeCooldown>game.time);
});

test('after scanning, thrust and side-slip rise smoothly and end automatically',()=>{
 const {game,e}=scene();game.visible=true;game.time=1;
 updateIrisPerception(e,game,1/60);
 for(let i=0;i<71;i++){
  game.time+=1/60;updateIrisPerception(e,game,1/60);
 }
 assert.ok(e._irisBurstStarted>0,'scan completion schedules a burst');
 const start=e._irisBurstStarted,duration=IRIS_SCAN.burstSeconds;
 assert.equal(irisBurstThrust(e,start),1);
 assert.ok(irisBurstThrust(e,start+duration*.5)>1.5);
 assert.ok(Math.abs(irisBurstJink(e,start+duration*.5))>.3);
 assert.ok(Math.abs(irisBurstThrust(e,start+duration)-1)<1e-9);
 assert.ok(Math.abs(irisBurstJink(e,start+duration))<1e-9);
 let last=1;
 for(let i=1;i<=60;i++){
  const next=irisBurstThrust(e,start+i/60);
  assert.ok(Math.abs(next-last)<.04,'there are no abrupt engine jumps');
  last=next;
 }
});

test('the real enemy controller accelerates out of its scanning curve',()=>{
 const {game,e}=scene();
 Object.assign(e,{r:14,state:'hunt',think:9,fire:10,angle:0,commitUntil:0});
 Object.assign(game,{time:1,visible:true,allies:[],missiles:[],
  grid:{query:()=>[]},avoidance:()=>({x:0,y:0}),
  heritage:{play:()=>{}},enemyShot:()=>{},hurt:()=>{}});
 game.player.invul=10;
 let scanSpeed=0,maxBurstSpeed=0;
 for(let i=0;i<140;i++){
  game.time=1+i/60;
  updateEnemy(e,game,1/60);
  const speed=Math.hypot(e.vx,e.vy);
  if(i===60)scanSpeed=speed;
  if(i>72&&i<129)maxBurstSpeed=Math.max(maxBurstSpeed,speed);
 }
 assert.ok(scanSpeed>50,'the scanner never becomes a stationary target');
 assert.ok(maxBurstSpeed>scanSpeed+25,
  'the tactical burst produces a meaningful increase in actual speed');
});

test('loss of sight makes a scout scan and search the last known point',()=>{
 const {game,e}=scene();game.visible=true;game.time=1;
 updateIrisPerception(e,game,1/60);
 for(let i=0;i<78;i++){
  game.time+=1/60;updateIrisPerception(e,game,1/60);
 }
 game.visible=false;game.player.x=700;game.player.y=450;
 for(let i=0;i<75;i++){
  game.time+=1/60;updateIrisPerception(e,game,1/60);
 }
 assert.equal(e._irisScanMode,'lost');
 assert.ok(e._irisSearchingUntil>game.time);
 const goal=irisSearchGoal(e,game);
 assert.ok(goal&&Math.hypot(goal.x-140,goal.y)<100);
 assert.ok(Math.hypot(goal.x-700,goal.y-450)>450,
  'search follows the remembered position, not the invisible player');
});

test('existing signal-intelligence patrols use their true engaged/search state',()=>{
 const {game,e}=scene();
 e.signalIntel={mode:'investigate',combatFocus:null};game.time=.1;
 assert.equal(updateIrisPerception(e,game,1/60),false);
 e.signalIntel.mode='engaged';e.signalIntel.combatFocus=game.player;game.time=.2;
 assert.equal(updateIrisPerception(e,game,1/60),true);
 assert.equal(e._irisScanMode,'acquire');
 e.signalIntel.mode='search';game.time=1.5;
 assert.equal(updateIrisPerception(e,game,1/60),true);
 assert.equal(e._irisScanMode,'lost');
 assert.equal(irisSearchGoal(e,game),null,
  'signal patrol keeps its existing group search route');
});

test('a signal patrol attacked by an ally does not stop to scan for the player',()=>{
 const {game,e}=scene();
 const attacker={x:250,y:45,hp:20,role:'fighter'};
 e.signalIntel={mode:'engaged',combatFocus:attacker};game.time=30;
 assert.equal(updateIrisPerception(e,game,.1),false);
 assert.equal(e._irisScanMode,undefined);
 e.signalIntel.combatFocus=game.player;game.time=30.3;
 assert.equal(updateIrisPerception(e,game,.1),true);
 assert.equal(e._irisScanMode,'acquire',
  'switching actual focus to player triggers visible opening');
});

test('real enemy update retains its combat target when an allied fighter attacks',()=>{
 const {game,e}=scene();
 const attacker={x:250,y:45,hp:20,role:'fighter'};
 e.signalIntel=createSignalIntel(300,0,30);
 Object.assign(e,{group:7,signalSlot:0,signalExitX:900,signalExitY:0,
   r:14,state:'hunt',think:0,fire:2,commitUntil:0,angle:0});
 Object.assign(game,{time:30,allies:[],grid:{query:()=>[]},
   avoidance:()=>({x:0,y:0}),heritage:{play:()=>{}},
   enemyShot:()=>{},hurt:()=>{}});
 alertSignalIntel(e.signalIntel,attacker,game.time);
 e.x=50;e.y=0;
 updateEnemy(e,game,.1);
 assert.equal(e.target,attacker,
   'the scout must keep tracking its actual attacker during combat');
});

test('200 simultaneous scouts remain bounded with sensor checks staggered',()=>{
 const {game}=scene();
 const drones=Array.from({length:200},(_,i)=>({type:'scout',serial:i+1,
   x:i%20*17,y:Math.floor(i/20)*20,vx:120,vy:0}));
 game.visible=true;
 for(let frame=0;frame<65;frame++){
  game.time+=1/60;
  for(const drone of drones)updateIrisPerception(drone,game,1/60);
 }
 for(const e of drones){
  assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));
  assert.ok(Math.hypot(e.vx,e.vy)<=IRIS_SCAN.maxScanSpeed+1e-6,
   'a mass of scouts remains at a bounded scanning speed');
 }
});
