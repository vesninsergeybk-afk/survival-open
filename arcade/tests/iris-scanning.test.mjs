import test from 'node:test';
import assert from 'node:assert/strict';
import {IRIS_SCAN,irisScanExtension,updateIrisPerception,irisSearchGoal}
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

test('real line-of-sight acquisition brakes the scout to a halt',()=>{
 const {game,e}=scene();game.visible=true;game.time=1;
 assert.equal(updateIrisPerception(e,game,1/60),true);
 assert.equal(e._irisScanMode,'acquire');
 assert.equal(e._irisLastSeenX,140);
 const beginningSpeed=e.vx;
 for(let i=0;i<50;i++){
  game.time+=1/60;updateIrisPerception(e,game,1/60);
 }
 assert.ok(Math.abs(e.vx)<1,'the scanning drone actually stops');
 assert.ok(e.x<7,'braking should not drift across the screen');
 assert.ok(beginningSpeed<160,'braking starts immediately');
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
  assert.ok(Math.hypot(e.vx,e.vy)<=120);
 }
});
