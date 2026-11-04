import test from 'node:test';
import assert from 'node:assert/strict';
import {IRIS_COMBAT,scoutAttack,scoutAttackGoal,updateEnemy} from '../ai.js';
import {createSignalIntel} from '../signal-perception.js';

const scene=(serial=1)=>{
 const player={x:0,y:0,vx:0,vy:0,r:19,hp:110,invul:99};
 const shots=[];
 const game={time:1,player,allies:[],missiles:[],grid:{query:()=>[]},
  avoidance:()=>({x:0,y:0}),enemyCanSee:(e,t)=>
   Math.hypot(e.x-t.x,e.y-t.y)<=290,
  heritage:{play(){}},hurt(){},
  enemyShot(x,y,tx,ty,damage,options){
   shots.push({time:this.time,x,y,tx,ty,damage,options});return true;
  }};
 const enemy={type:'scout',serial,x:245,y:0,vx:-140,vy:0,r:14,
  hp:28,maxHp:28,damage:9,think:0,fire:0,state:'hunt',
  commitUntil:0,target:player,hit:0};
 return {game,enemy,shots};
};
const advance=(game,enemy,seconds,dt=1/60)=>{
 for(let i=0;i<Math.round(seconds/dt);i++){
  game.time+=dt;updateEnemy(enemy,game,dt);
 }
};

test('first pulse arrives during the visible purple scan, not after a helpless pause',()=>{
 const {game,enemy,shots}=scene();
 advance(game,enemy,.49);
 assert.equal(shots.length,0,'opening the jaws warns before the shot');
 advance(game,enemy,.35);
 assert.equal(shots.length,1,'the scout shoots before the scanning interval ends');
 assert.ok(shots[0].time-enemy._irisScanStarted>=IRIS_COMBAT.scanShotAt);
 assert.equal(shots[0].options.kind,'iris');
 assert.equal(shots[0].damage,IRIS_COMBAT.damage);
});

test('scouts orbit in effective range and keep shooting after the first scan',()=>{
 const {game,enemy,shots}=scene();
 advance(game,enemy,9);
 const distance=Math.hypot(enemy.x-game.player.x,enemy.y-game.player.y);
 assert.ok(distance>85&&distance<315,`sustained range: ${distance}`);
 assert.ok(shots.length>=3,`a functioning hunter fires repeatedly: ${shots.length}`);
 assert.ok(shots.every(s=>s.damage<=6),'danger comes from pressure, not inflated damage');
});

test('a scout cannot fire before identifying the target or through cover',()=>{
 const {game,enemy,shots}=scene();
 game.enemyCanSee=()=>false;
 advance(game,enemy,5);
 assert.equal(shots.length,0);
 game.enemyCanSee=()=>true;
 advance(game,enemy,1.7);
 assert.ok(shots.length>=1,'visual contact unlocks combat');
 const other=scene();
 other.enemy.signalIntel=createSignalIntel(400,0,1);
 other.game.enemyCanSee=()=>false;
 advance(other.game,other.enemy,4);
 assert.equal(other.shots.length,0,'an investigating signal patrol remains harmless');
});

test('sighted drones lead moving targets only partially and have a readable charge',()=>{
 const {game,enemy,shots}=scene();
 game.player.vy=210;
 enemy.fire=-1;enemy._irisHasSight=true;
 game.time=20;
 assert.equal(scoutAttack(enemy,game,game.player),false);
 assert.equal(shots.length,0);
 game.time+=IRIS_COMBAT.charge+.01;
 assert.equal(scoutAttack(enemy,game,game.player),true);
 assert.equal(shots.length,1);
 assert.ok(shots[0].ty>0&&shots[0].ty<=45);
});

test('shared volley spacing keeps 200 enemies from making an inescapable wall',()=>{
 const {game}=scene();
 const drones=Array.from({length:200},(_,i)=>({
  type:'scout',serial:i+1,x:170+Math.cos(i)*12,y:Math.sin(i)*12,
  vx:0,vy:0,hp:28,maxHp:28,fire:-1,_irisHasSight:true
 }));
 const times=[];
 game.enemyShot=(...args)=>{times.push(game.time);return true;};
 for(let frame=0;frame<180;frame++){
  game.time+=1/60;
  for(const e of drones)scoutAttack(e,game,game.player);
 }
 assert.ok(times.length>=3&&times.length<=8,`bounded pulses: ${times.length}`);
 for(let i=1;i<times.length;i++)
  assert.ok(times[i]-times[i-1]>=IRIS_COMBAT.volleySpacing-1/60);
});

test('a delayed volley never appears after the visible warning expired',()=>{
 const {game,enemy,shots}=scene();
 enemy._irisHasSight=true;enemy.fire=-1;
 game.time=10;game._irisNextVolleyAt=100;
 scoutAttack(enemy,game,game.player);
 game.time=11.2;game._irisNextVolleyAt=0;
 assert.equal(scoutAttack(enemy,game,game.player),false);
 assert.equal(shots.length,0,'renew the warning after excessive waiting');
 game.time+=IRIS_COMBAT.charge+.01;
 assert.equal(scoutAttack(enemy,game,game.player),true);
});

test('orbital targeting remains finite at zero distance',()=>{
 const {game,enemy}=scene();enemy.x=game.player.x;enemy.y=game.player.y;
 const goal=scoutAttackGoal(enemy,game.player);
 assert.ok(Number.isFinite(goal.x)&&Number.isFinite(goal.y));
});
