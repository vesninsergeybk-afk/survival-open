import test from 'node:test';
import assert from 'node:assert/strict';
import {irisCanSense,updateIrisSwarm,IRIS_SWARM} from '../iris-swarm.js';
import {updateEnemy,ENEMY_TYPES} from '../ai.js';
import {firstRockImpact} from '../terrain.js';
import {updateAutomaticWeapons} from '../ship-weapons.js';
import {createLoadout,createThermal} from '../ship-loadout.js';

const player=()=>({x:0,y:0,vx:0,vy:0,r:19,hp:110,invul:100,angle:0});
const drone=(serial,x,y=0,group=1)=>({
  serial,group,type:'scout',x,y,vx:0,vy:0,r:14,hp:28,maxHp:28,
  damage:9,state:'hunt',think:0,fire:1,commitUntil:0,hit:0
});
function scene(enemies,rocks=[]){
 const p=player(),shots=[],beamHits=[];
 const game={time:0,player:p,allies:[],missiles:[],operation:null,
  grid:{query:()=>enemies.filter(e=>e.hp>0)},
  rockGrid:{query:()=>rocks},avoidance:()=>({x:0,y:0}),
  enemyCanSee:(e,t)=>Math.hypot(e.x-t.x,e.y-t.y)<=290&&
   !firstRockImpact(e.x,e.y,t.x,t.y,rocks,0,t),
  shipLoadout:createLoadout(),skillRanks:{},weaponThermal:createThermal(),
  weaponProfile:{plasma:1,rail:0,flak:0,rocket:0},
  moduleClocks:{rail:1,flak:1},beamClock:0,
  damageRock(){},flash(){},hurt(){},
  heritage:{play(){},vfx:{muzzle(){},hullImpact(){},shipExplosion(){}}},
  damageEnemy(e,d,source){
   beamHits.push({serial:e.serial,time:this.time,damage:d,source});
   e.hp-=d;e.hit=.12;
  },
  enemyShot(x,y,tx,ty,damage,options){shots.push({time:this.time,x,y,damage,options});return true;}
 };
 return {game,shots,beamHits,enemies};
}
function advance(s,seconds=6){
 const dt=1/60;
 for(let frame=0;frame<seconds*60;frame++){
  s.game.time+=dt;
  for(const e of s.enemies)if(e.hp>0)updateEnemy(e,s.game,dt);
  updateAutomaticWeapons(s.game,dt,true);
  for(const e of s.enemies)e.hit=Math.max(0,(e.hit||0)-dt);
 }
}

test('long-range sensing respects real rock occlusion and does not weaken HP',()=>{
 const e=drone(1,350),p=player(),rock={x:170,y:0,r:49,alive:true};
 const s=scene([e],[rock]);
 assert.equal(irisCanSense(e,s.game,p),false);
 rock.alive=false;
 assert.equal(irisCanSense(e,s.game,p),true);
 assert.equal(irisCanSense(e,s.game,p,290),false);
 assert.equal(ENEMY_TYPES.scout.hp,38);
});

test('after a real hit one drone breaks contact, its partner attacks; no new HP or hit immunity',()=>{
 const a=drone(1,248),b=drone(2,280,55),other=drone(3,270,-30,99);
 const {game}=scene([a,b,other]);game.time=2;a.hit=.12;a._irisHasFired=true;
 const tactic=updateIrisSwarm(a,game,game.player);
 assert.equal(tactic.mode,'break');
 assert.equal(tactic.speed>1.5,true);
 assert.ok(b._irisWingUntil>game.time);
 assert.equal(other._irisWingUntil,undefined,'no orders cross encounter groups');
 assert.equal(updateIrisSwarm(b,game,game.player).mode,'wing');
 assert.equal(a.hp,28);
 game.time+=IRIS_SWARM.retreatSeconds+.05;
 assert.equal(updateIrisSwarm(a,game,game.player),null,'escape burn is brief');
});

test('asteroid refuge is a reachable, destructible rock, not a phantom safe spot',()=>{
 const e=drone(1,210,100),p=player();
 const rock={x:260,y:85,r:51,alive:true};
 const {game}=scene([e],[rock]);game.time=2;e.hit=.12;e._irisHasFired=true;
 const first=updateIrisSwarm(e,game,p);
 assert.equal(first.mode,'cover');
 assert.equal(firstRockImpact(p.x,p.y,first.x,first.y,[rock],2,p)?.rock,rock);
 rock.alive=false;
 assert.equal(updateIrisSwarm(e,game,p).mode,'break');
});

test('an early hit at beam maximum range triggers a pursuit, not endless flight',()=>{
 const a=drone(1,418),b=drone(2,429,45);
 const {game}=scene([a,b]);game.time=1;a.hit=.12;
 assert.equal(updateIrisSwarm(a,game,game.player).mode,'wing');
 assert.equal(a._irisRetreatUntil,undefined);
 assert.equal(updateIrisSwarm(b,game,game.player).mode,'wing');
});

test('wingmen accelerate only after an observed real plasma shot, without reading beamClock',()=>{
 const e=drone(1,335),{game}=scene([e]);
 game.time=1;e._irisWingUntil=2.2;e._irisWingSide=1;
 game.beamClock=0;
 assert.equal(updateIrisSwarm(e,game,game.player).speed,1.38);
 game._irisLastPlasmaAt=1;
 assert.equal(updateIrisSwarm(e,game,game.player).speed,1.58);
 game.time=1.5;
 assert.equal(updateIrisSwarm(e,game,game.player).speed,1.38,
  'a real impulse has a short lifetime even if weapon clock stays at zero');
});

test('a scout cannot repeatedly escape before its first retaliatory shot',()=>{
 const e=drone(1,235),{game}=scene([e]);game.time=1;e.hit=.12;
 const first=updateIrisSwarm(e,game,game.player);
 assert.equal(first.mode,'wing');
 assert.equal(e._irisRetreatAt,undefined);
 e.hit=0;updateIrisSwarm(e,game,game.player);
 game.time=1.3;e.hit=.12;
 assert.equal(updateIrisSwarm(e,game,game.player).mode,'wing');
 assert.equal(e._irisRetreatAt,undefined);
});

test('mission bodyguards and scouts fighting escorts keep their established orders',()=>{
 const a=drone(1,230),b=drone(2,250),{game}=scene([a,b]);
 a.protect={hp:40};b.target={x:300,y:0,hp:20};game.time=2;
 a.hit=.12;b.hit=.12;
 assert.equal(updateIrisSwarm(a,game,game.player),null);
 assert.equal(updateIrisSwarm(b,game,game.player),null);
 assert.equal(a._irisRetreatUntil,undefined);
 assert.equal(b._irisWingUntil,undefined);
});

test('real starter plasma continues to damage scouts normally; their response creates attack opportunities',()=>{
 const a=drone(1,345),b=drone(2,365,80);
 const s=scene([a,b]);advance(s,7);
 assert.ok(s.beamHits.length>=2,'actual automatic plasma lands visible hits');
 assert.ok(s.shots.length>=1,'scouts retaliate instead of only fleeing: '+
  JSON.stringify({hits:s.beamHits,enemies:s.enemies.map(e=>({hp:e.hp,x:e.x,y:e.y,scan:e._irisScanStarted,retreat:e._irisRetreatAt}))}));
 assert.ok(s.shots[0].time<2,'they fight back during the opening exchange');
 assert.ok(new Set(s.beamHits.map(hit=>hit.serial)).size===2,
  'automatic targeting changes as scouts exchange places');
 assert.ok(s.beamHits.every(h=>h.damage>0));
 assert.ok(s.enemies.every(e=>e.hp<=28),'no secret health replenishment');
});

test('200 scouts use bounded, finite flight with nearby wings and scanning',()=>{
 const enemies=Array.from({length:200},(_,i)=>
  drone(i+1,360+i%20*8,-400+Math.floor(i/20)*80,Math.floor(i/5)));
 const s=scene(enemies);
 for(let i=0;i<enemies.length;i+=5)enemies[i].hit=.12;
 for(let frame=0;frame<45;frame++){
  s.game.time+=1/60;
  for(const e of enemies)updateEnemy(e,s.game,1/60);
 }
 assert.ok(enemies.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&
   Math.hypot(e.vx,e.vy)<600));
});

test('a twelve-drone fight against genuine starter plasma still generates pressure',()=>{
 const squad=()=>Array.from({length:12},(_,i)=>
  drone(i+1,330+(i%4)*22,(i-5.5)*45,1+Math.floor(i/4)));
 const pack=scene(squad());
 const uncoordinated=scene(squad());
 uncoordinated.game._irisPackRetryAt=Infinity;
 advance(pack,10);advance(uncoordinated,10);
 const metrics={
  packShots:pack.shots.length,oldShots:uncoordinated.shots.length,
  packSurvivors:pack.enemies.filter(e=>e.hp>0).length,
  oldSurvivors:uncoordinated.enemies.filter(e=>e.hp>0).length,
  packHits:pack.beamHits.length,oldHits:uncoordinated.beamHits.length,
  firingSectors:new Set(pack.shots.map(s=>
   Math.floor((Math.atan2(s.y,s.x)+Math.PI)*4/Math.PI))).size
 };
 assert.ok(pack.shots.length>=3,'an organized group must keep threatening the player');
 assert.ok(pack.shots.length>=Math.floor(uncoordinated.shots.length*.8),
  'formation cannot quietly halve combat pressure: '+JSON.stringify(metrics));
 assert.ok(pack.shots.length<=uncoordinated.shots.length*1.35+1,
  'grouping cannot silently create an inescapable rate of fire');
 assert.ok(metrics.firingSectors>=3,
  'the crossfire should actually emerge from distinct world directions');
 assert.ok(pack.enemies.every(e=>e.hp<=28));
});
