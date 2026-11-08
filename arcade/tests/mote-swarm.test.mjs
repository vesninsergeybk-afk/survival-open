import test from 'node:test';
import assert from 'node:assert/strict';
import {MOTE_SWARM,updateMoteSwarmOrders,moveMote,drawMoteSwarms} from '../mote-swarm.js';
import {updateEnemy} from '../ai.js';
import {enemySalvage,enemyDataReward} from '../combat-rewards.js';
import {rewardEyeKill} from '../field-loot.js';
import {enemyFieldReward} from '../field-evolution.js';
import {game as actualGame} from './weapons-scene.mjs';
import {openingThreat} from '../balance.js';
import {availableEncounters} from '../encounters.js';

const drones=(count,pack=7)=>Array.from({length:count},(_,i)=>({
 type:'scout',serial:i+1,group:pack,motePack:pack,moteRoot:pack,moteSpawnedAt:95,
 microSwarm:true,x:290+i%5*6,y:20+Math.floor(i/5)*6,vx:0,vy:0,
 r:MOTE_SWARM.radius,hp:MOTE_SWARM.hp,maxHp:MOTE_SWARM.hp,stasisUntil:0,
 angle:0,fire:0,hit:0,moteApproach:{x:0,y:0}
}));
const scene=(enemies,time=100)=>({enemies,time,groupSerial:7,
 player:{x:0,y:0,hp:100,vx:0,vy:0},avoidance:()=>({x:0,y:0}),
 enemyCanSee:()=>true,shots:[],enemyShot(x,y,tx,ty,damage){
  this.shots.push({x,y,tx,ty,damage});return true;
 }});

test('единый рой расходится на два фланга и позже вновь собирается вместе',()=>{
 const game=scene(drones(10));
 updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,2);
 assert.ok(game.enemies.every(e=>Number.isFinite(e.moteOrder.x)));
 assert.ok(game.enemies.every(e=>e.motePackCount===5));
 const previous=game.enemies.map(e=>e.motePack);
 game.time=104;updateMoteSwarmOrders(game);
 assert.deepEqual(game.enemies.map(e=>e.motePack),previous,'no oscillating merge during flank manoeuvre');
 game.time=109;updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1);
 assert.ok(game.enemies.every(e=>e.hp===MOTE_SWARM.hp),'split/merge never heals or duplicates a ship');
});

test('группа сохраняет общий приказ, даже если уцелели всего два дрона',()=>{
 const game=scene(drones(2),109);
 updateMoteSwarmOrders(game);
 assert.equal(new Set(game.enemies.map(e=>e.motePack)).size,1);
 for(const e of game.enemies){
  const before={x:e.x,y:e.y};
  updateEnemy(e,game,.1);
  assert.ok(Math.hypot(e.x-before.x,e.y-before.y)>0);
  assert.equal(e.moteLeader,e.serial===1);
 }
});

test('one group uses one warned volley rather than a bullet per drone',()=>{
 const game=scene(drones(7),101);
 updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,0);
 game.time=103;updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,0,'firing must display a warning first');
 game.time=103.6;updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,1);
 game.time=103.95;updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,1,'the whole pack shares one cooldown');
});

test('first visible micro-drone pack shows its area-weapon hint once, even if the leader is offscreen',()=>{
 const group=drones(4),leader=group[0];
 leader.encounterLabel='РОЙ МИКРОДРОНОВ · используйте комету или мины';
 const words=[];
 const c=new Proxy({fillText(value){words.push(value);}},
  {get(target,key){return target[key]??(()=>{});}});
 const distant={x:-500,y:-500,w:100,h:100};
 drawMoteSwarms(c,group,distant,99,true);
 assert.equal(leader.encounterLabelStart,undefined,'offscreen encounter does not waste hint time');
 // The leader stays outside but its group enters the viewport.
 leader.x=500;
 const visible={x:200,y:-10,w:150,h:100};
 drawMoteSwarms(c,group,visible,100,true);
 assert.equal(leader.encounterLabelStart,100);
 assert.ok(words.includes(leader.encounterLabel),'the swarm must actually paint its tactical hint');
 words.length=0;
 drawMoteSwarms(c,group,visible,104,true);
 assert.ok(!words.includes(leader.encounterLabel),'the cue must not obscure the fight indefinitely');
});

test('no firing through blocked sight, and frozen members respect stasis',()=>{
 const game=scene(drones(3),102);
 game.enemyCanSee=()=>false;
 updateMoteSwarmOrders(game);
 game.time=109;updateMoteSwarmOrders(game);
 assert.equal(game.shots.length,0);
 const e=game.enemies[0];e.stasisUntil=115;
 e.moteOrder={x:120,y:40};const x=e.x;
 updateEnemy(e,game,.1);
 assert.equal(e.x,x,'motes respect the same station stasis as other enemies');
});

test('micro drones yield tiny XP but no scrap or parasite/buff farming',()=>{
 const e=drones(1)[0];e.hp=0;
 assert.equal(enemyDataReward(e),1);
 assert.equal(enemySalvage(e),0);
 const game={time:100,fieldLoot:{kills:0},fieldEvolution:{charge:0,kills:0},
  skillRanks:{parasite:1},enemies:[e],player:{x:0,y:0},addDrop(){throw Error('unexpected reward');}};
 assert.equal(rewardEyeKill(game,e,true),null);
 assert.equal(enemyFieldReward(game,e,true).core,false);
});

test('movement remains bounded under low FPS and does not teleport between formations',()=>{
 const game=scene(drones(1),109),e=game.enemies[0];
 e.moteOrder={x:0,y:0};moveMote(e,game,.05);
 assert.ok(Math.hypot(e.vx,e.vy)<=MOTE_SWARM.speed);
 assert.ok(Math.hypot(e.x-290,e.y-20)<12);
});

test('the actual spawn path creates small scout ships with one shared pack',()=>{
 const g=actualGame();g.vw=1200;g.vh=800;g.time=110;g.lastEncounter='';
 const director=openingThreat(110,3);
 const index=availableEncounters(110,director,2,11).indexOf('motes');
 const choice=(index+.25)/availableEncounters(110,director,2,11).length;
 const rng=Math.random;let calls=0;
 Math.random=()=>[.2,.5,choice][calls++]??.3;
 try{g.spawnGroup(director);}finally{Math.random=rng;}
 assert.equal(g.enemies.length,10);
 assert.ok(g.enemies.every(e=>e.microSwarm&&e.r===MOTE_SWARM.radius&&e.hp<20));
 assert.equal(new Set(g.enemies.map(e=>e.motePack)).size,1);
 assert.ok(g.enemies.every(e=>e._patrolRoute&&e.moteApproach===e._patrolRoute),
  'a routine swarm must have a traffic route, not omniscient player tracking');
});

test('a kill contract credits only a fully defeated collective, exactly once',()=>{
 const g=actualGame(),swarm=drones(4);
 g.enemies=swarm;let credited=0;g.advanceContract=()=>{credited++;};
 swarm[0].hp=0;
 assert.equal(g.creditContractKill(swarm[0]),false);
 for(const e of swarm)e.hp=0;
 for(const e of swarm)g.creditContractKill(e);
 assert.equal(credited,1);
});
