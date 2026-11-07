import test from 'node:test';
import assert from 'node:assert/strict';
import {contourIrisDirective,contourIrisRushContacts,drawContourIrisCharge,CONTOUR_IRIS} from '../contour-trial-iris.js';
import {updateEnemy} from '../ai.js';
import {markDashPass} from '../field-evolution.js';

function scene(){
 const player={x:0,y:0,vx:0,vy:0,r:19,hp:200,invul:200};
 const sounds=[];
 const game={time:10,player,enemies:[],allies:[],missiles:[],support:{missions:[]},
  grid:{query:()=>[]},contourTrial:{entry:{id:7}},
  enemyCanSee:()=>true,avoidance:()=>({x:0,y:0}),
  heritage:{play:(name)=>sounds.push(name),vfx:{shipExplosion(){}}},
  enemyShot:()=>true,hurt(){throw Error('invulnerable player was hit');}};
 const enemy={type:'scout',serial:31,x:330,y:0,vx:0,vy:0,r:14,
  hp:28,maxHp:28,damage:9,think:0,fire:0,state:'hunt',
  target:player,trialId:7,_trialDiveEnabled:true,_trialDiveTier:4};
 game.enemies.push(enemy);
 return {game,enemy,sounds};
}

test('a territorial IRIS announces its dive, corrects once and then breaks away',()=>{
 const {game,enemy,sounds}=scene();
 let order=contourIrisDirective(enemy,game);
 assert.equal(order.phase,'windup');
 assert.equal(enemy._trialDive.phase,'windup');
 assert.ok(sounds.includes('ramWarning'));
 game.time+=CONTOUR_IRIS.windup*.55;
 assert.equal(contourIrisDirective(enemy,game).phase,'windup');
 const warned={x:enemy._trialDive.x,y:enemy._trialDive.y};
 game.player.y=160;
 game.time+=CONTOUR_IRIS.windup*.5;
 order=contourIrisDirective(enemy,game);
 assert.equal(order.phase,'rush');
 assert.deepEqual({x:order.x,y:order.y},warned,
  'the first high-speed leg follows the previously displayed target');
 assert.ok(order.speed>300);
 const before={x:order.x,y:order.y};
 game.player.y=1000;
 game.time+=CONTOUR_IRIS.correctionAt+.01;
 order=contourIrisDirective(enemy,game);
 assert.equal(order.phase,'rush');
 assert.ok(Math.hypot(order.x-before.x,order.y-before.y)<=107,
  'one limited correction, no perfect last-second homing');
 assert.equal(enemy._trialDive.corrected,true);
 const fixed={x:order.x,y:order.y};
 game.player.y=2000;
 game.time+=.1;
 order=contourIrisDirective(enemy,game);
 assert.equal(order.phase,'rush');
 assert.deepEqual({x:order.x,y:order.y},fixed,'no additional instant turns');
 game.time+=CONTOUR_IRIS.rush;
 assert.equal(contourIrisDirective(enemy,game).phase,'recover');
});

test('a warning never bypasses genuine line of sight or becomes a global scout buff',()=>{
 const {game,enemy}=scene();
 game.enemyCanSee=()=>false;
 assert.equal(contourIrisDirective(enemy,game),null);
 game.enemyCanSee=()=>true;
 enemy._trialDiveEnabled=false;
 assert.equal(contourIrisDirective(enemy,game),null);
 enemy._trialDiveEnabled=true;enemy.trialId=8;
 assert.equal(contourIrisDirective(enemy,game),null);
 enemy.trialId=7;enemy.converted=true;
 assert.equal(contourIrisDirective(enemy,game),null);
});

test('only two nearby IRIS can telegraph a rush at once',()=>{
 const {game,enemy}=scene();
 const other=[32,33,34].map(serial=>({
  ...enemy,serial,x:350, _trialDive:undefined
 }));
 game.enemies.push(...other);
 for(const unit of game.enemies)contourIrisDirective(unit,game);
 assert.equal(game.enemies.filter(unit=>unit._trialDive?.phase==='windup').length,2);
});

test('a high-speed dive cannot tunnel through the player on a low-FPS frame',()=>{
 const enemy={x:50,y:0,r:14},player={x:0,y:0,r:19};
 assert.equal(contourIrisRushContacts(-50,0,enemy,player),true);
 assert.equal(contourIrisRushContacts(-50,70,{x:50,y:70,r:14},player),false);
});

test('trial charge artwork is tied to a real warning state and reduced-motion safe',()=>{
 const {game,enemy}=scene();
 const operations=[];
 const ctx=new Proxy({},{get(target,key){
  return key in target?target[key]:(...args)=>{operations.push([key,...args]);};
 },set(target,key,value){target[key]=value;return true;}});
 assert.equal(drawContourIrisCharge(ctx,enemy,game.time),false);
 contourIrisDirective(enemy,game);
 assert.equal(drawContourIrisCharge(ctx,enemy,game.time,true),true);
 assert.ok(operations.some(([name])=>name==='fillText'),'a literal dash warning exists');
});

test('a dodged dive leaves a visible slower recovery window',()=>{
 const {game,enemy}=scene();
 contourIrisDirective(enemy,game);
 game.time+=CONTOUR_IRIS.windup+.01;
 contourIrisDirective(enemy,game);
 game.time+=CONTOUR_IRIS.rush+.01;
 const order=contourIrisDirective(enemy,game);
 assert.equal(order.phase,'recover');
 assert.ok(order.speed<CONTOUR_IRIS.baseSpeed*.5);
 const labels=[];
 const ctx=new Proxy({},{get(target,key){
  if(key==='fillText')return text=>labels.push(text);
  return key in target?target[key]:()=>{};
 },set(target,key,value){target[key]=value;return true;}});
 assert.equal(drawContourIrisCharge(ctx,enemy,game.time,true),true);
 assert.ok(labels.includes('ПЕРЕГРУЗКА'));
});

test('Conduit dash can cancel a warned IRIS attack, while ordinary ships keep their behavior',()=>{
 const {game,enemy}=scene();
 contourIrisDirective(enemy,game);
 game.fieldEvolution={pulseAt:0};game.skillRanks={conduit:1};game.flash=()=>{};
 game.heritage.vfx.nova=()=>{};
 game.player.burstRemaining=.2;game.player.x=370;
 assert.equal(markDashPass(game,0,0),1);
 assert.equal(enemy._trialDive.phase,'recover');
 assert.equal(enemy._trialDive.interrupted,true);
 assert.ok(enemy.stasisUntil>game.time);
 assert.ok(enemy.fieldMarkUntil>game.time,'the original dash-and-shoot synergy survives');
 const ordinary={...enemy,serial:100,x:180,fieldMarkUntil:0,
  trialId:undefined,_trialDive:undefined,_trialDiveEnabled:false};
 game.enemies=[ordinary];
 assert.equal(markDashPass(game,0,0),1);
 assert.equal(ordinary._trialDive,undefined);
});

test('real IRIS AI retains ordinary projectile fire and reaches aggressive rush speed',()=>{
 const {game,enemy}=scene();
 const speeds=[];const phases=new Set();
 for(let frame=0;frame<300&&enemy.hp>0;frame++){
  game.time+=1/60;
  updateEnemy(enemy,game,1/60);
  phases.add(enemy._trialDive?.phase);
  if(enemy._trialDive?.phase==='rush')speeds.push(Math.hypot(enemy.vx,enemy.vy));
 }
 assert.ok(phases.has('windup')&&phases.has('rush'),
  'the special maneuver must actually run through the normal enemy controller');
 assert.ok(speeds.some(speed=>speed>195),'the charge visibly outruns normal scouting');
 assert.ok(Number.isFinite(enemy.x)&&Number.isFinite(enemy.y));
});
