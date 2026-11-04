import test from 'node:test';
import assert from 'node:assert/strict';
import {IRIS_PACK,irisPackDirective,irisPackMayFire,irisPackPhase,
 irisPackSeparation} from '../iris-choreography.js';
import {updateEnemy} from '../ai.js';

const drone=(i,count,r=295)=>({
 type:'scout',serial:i+1,group:1,
 x:Math.cos(i*2*Math.PI/count)*r,y:Math.sin(i*2*Math.PI/count)*r,
 vx:0,vy:0,hp:28,maxHp:28,r:14,hit:0,think:0,fire:1,
 state:'hunt',commitUntil:0,damage:9
});
const scene=(count=12)=>{
 const player={x:0,y:0,vx:0,vy:0,hp:110,r:19,invul:99};
 const drones=Array.from({length:count},(_,i)=>drone(i,count));
 let lookups=0;
 const game={time:0,player,allies:[],missiles:[],shots:[],
  grid:{query(){lookups++;return drones.filter(d=>d.hp>0);}},
  avoidance:()=>({x:0,y:0}),enemyCanSee:()=>false,
  heritage:{play(){},vfx:{shipExplosion(){}}},hurt(){},enemyShot(){return true;}};
 return {game,drones,lookupCount:()=>lookups};
};

test('four or more scouts get distinct attack, flanking and reserve roles',()=>{
 const {game,drones}=scene(13);game.time=1;
 for(const e of drones)irisPackDirective(e,game);
 const plan=game._irisPackPlan;
 assert.ok(plan&&plan.roles.size===13);
 const roles=[...plan.roles.values()].map(x=>x.role);
 assert.equal(roles.filter(x=>x==='vanguard').length,1);
 assert.equal(roles.filter(x=>x==='left').length,1);
 assert.equal(roles.filter(x=>x==='right').length,1);
 assert.equal(roles.filter(x=>x==='intercept').length,1);
 assert.equal(roles.filter(x=>x.startsWith('sentry')).length,2);
 assert.equal(roles.filter(x=>x==='reserve').length,7);
 assert.equal(irisPackPhase(plan,game.time),'form');
 assert.equal(drones.filter(e=>irisPackMayFire(e,game)).length,6,
  'the approach is a recognizable probing attack');
 game.time=plan.start+IRIS_PACK.shapeUntil+.1;
 assert.equal(drones.filter(e=>irisPackMayFire(e,game)).length,8,
  'a coordinated strike uses capped firing positions');
 game.time=plan.start+IRIS_PACK.strikeUntil+.1;
 assert.equal(drones.filter(e=>irisPackMayFire(e,game)).length,6,
  'after the strike the pack visibly releases pressure');
});

test('a real angular corridor stays unoccupied by reserve positions',()=>{
 const {game,drones}=scene(25);
 drones.forEach(e=>irisPackDirective(e,game));
 const plan=game._irisPackPlan;
 for(const role of plan.roles.values()){
  if(role.role!=='reserve')continue;
  const a=Math.abs(Math.atan2(Math.sin(role.angle-plan.gapAngle),
    Math.cos(role.angle-plan.gapAngle)));
  assert.ok(a>=IRIS_PACK.openAngle*.5-.001,
    'screen drones cannot seal the intentional escape sector');
 }
});

test('roles persist between frames and survivors regroup after the lead dies',()=>{
 const {game,drones}=scene(10);game.time=5;
 drones.forEach(e=>irisPackDirective(e,game));
 const previous=game._irisPackPlan,leader=previous.vanguard;
 game.time+=.2;drones.forEach(e=>irisPackDirective(e,game));
 assert.equal(game._irisPackPlan,previous,'positions do not shuffle every frame');
 leader.hp=0;game.time+=.85;
 drones.filter(e=>e.hp>0).forEach(e=>irisPackDirective(e,game));
 assert.equal(game._irisPackPlan,previous,
  'a single loss cannot restart the cycle and indefinitely postpone pressure');
 assert.notEqual(game._irisPackPlan.vanguard,leader);
 assert.ok(game._irisPackPlan.brokenUntil>game.time,
  'a short regroup tells the player the leader was destroyed');
 assert.equal(drones.filter(e=>e.hp>0&&irisPackMayFire(e,game)).length,0);
});

test('reinforcements wait in an outer arc without restarting the current attack',()=>{
 const {game,drones}=scene(6);game.time=2;
 drones.forEach(e=>irisPackDirective(e,game));
 const plan=game._irisPackPlan;
 const newcomer=drone(18,20,250);drones.push(newcomer);
 const order=irisPackDirective(newcomer,game);
 assert.equal(game._irisPackPlan,plan);
 assert.equal(order.mode,'reserve');
 assert.equal(irisPackMayFire(newcomer,game),false);
});

test('protected scouts and unconfirmed signal patrols do not join the pack',()=>{
 const {game,drones}=scene(8);
 drones[0].protect={hp:50};
 drones[1].signalIntel={mode:'investigate'};
 drones.forEach(e=>irisPackDirective(e,game));
 assert.equal(game._irisPackPlan.roles.size,6);
 assert.equal(irisPackDirective(drones[0],game),null);
 assert.equal(irisPackDirective(drones[1],game),null);
});

test('three lonely drones do not trigger a new group query every frame',()=>{
 const {game,drones,lookupCount}=scene(3);
 for(let frame=0;frame<60;frame++){
  game.time=frame/60;
  drones.forEach(e=>assert.equal(irisPackDirective(e,game),null));
 }
 assert.ok(lookupCount()<=3,`negative caching: ${lookupCount()}`);
});

test('after heavy losses the pack dissolves without repeated expensive replanning',()=>{
 const {game,drones,lookupCount}=scene(6);
 drones.forEach(e=>irisPackDirective(e,game));
 drones.slice(0,3).forEach(e=>{e.hp=0;});
 game.time=1;
 drones.slice(3).forEach(e=>assert.equal(irisPackDirective(e,game),null));
 const before=lookupCount();
 for(let step=0;step<24;step++){
  game.time+=1/60;
  drones.slice(3).forEach(e=>irisPackDirective(e,game));
 }
 assert.ok(lookupCount()-before<=1,'a broken pack should reuse a negative cache');
});

test('a compact incoming mass opens into multiple distinct paths in actual motion',()=>{
 const {game,drones}=scene(14);
 drones.forEach((e,i)=>{e.x=360+(i%3)*7;e.y=-49+i*7;});
 for(let frame=0;frame<210;frame++){
  game.time+=1/60;
  drones.forEach(e=>updateEnemy(e,game,1/60));
 }
 const ys=drones.map(e=>e.y);
 assert.ok(Math.max(...ys)-Math.min(...ys)>205,
  'the group must no longer travel as a single narrow stripe');
});

test('200 scouts remain finite and their vectors are sampled, not recomputed each tick',()=>{
 const {game,drones,lookupCount}=scene(200);
 for(let frame=0;frame<42;frame++){
  game.time=frame/60;
  drones.forEach(e=>{
   const order=irisPackDirective(e,game);
   if(order){
    assert.ok(Number.isFinite(order.x)&&Number.isFinite(order.y));
    const separate=irisPackSeparation(e,game);
    assert.ok(Number.isFinite(separate.x)&&Number.isFinite(separate.y));
   }
  });
 }
 assert.ok(lookupCount()<3500,`bounded grid queries: ${lookupCount()}`);
 game.time=2;
 assert.ok(drones.filter(e=>irisPackMayFire(e,game)).length<=10,
  'large hordes cannot open two hundred simultaneous firing slots');
});

test('real steering spreads a group and keeps flight speed bounded',()=>{
 const {game,drones}=scene(14);game.time=1;
 for(let frame=0;frame<210;frame++){
  game.time+=1/60;
  drones.forEach(e=>updateEnemy(e,game,1/60));
 }
 assert.ok(drones.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&
  Math.hypot(e.vx,e.vy)<550));
 const roles=new Set(drones.map(e=>e._irisPackRole));
 assert.ok(roles.has('reserve')&&roles.has('left')&&roles.has('right'));
});
