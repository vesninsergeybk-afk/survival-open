import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES, openingThreat, burstStats, SpatialGrid, dist} from '../balance.js';
import {updateEnemy, updateAlly} from '../ai.js';

test('первые 9 секунд защищены от вражеских групп',()=>{
 assert.equal(openingThreat(0).cap,0);
 assert.equal(openingThreat(8.99).groupSize,0);
 assert.deepEqual(openingThreat(9).types,['scout']);
});
test('первые минуты дают пространство для манёвра',()=>{
 const first=openingThreat(20),second=openingThreat(50),third=openingThreat(100);
 assert.equal(first.cap,8);
 assert.equal(second.cap,14);
 assert.ok(third.cap>second.cap);
 for(const t of [12,40,70,110,140,180,204]){
  assert.ok(!openingThreat(t).types.includes('gunship'),'дальнобойный корвет до 205 сек');
 }
 assert.ok(openingThreat(205).types.includes('gunship'));
 assert.equal(openingThreat(205).cap,33);
 assert.ok(openingThreat(206).cap<=38);
 assert.ok(openingThreat(205).interval>3);
 assert.ok(openingThreat(500,10).cap<=RULES.maxEnemies);
});
test('улучшение двигателя ускоряет и сокращает перезарядку рывка',()=>{
 const basic=burstStats(0),upgraded=burstStats(1);
 assert.ok(basic.duration>0&&basic.duration<1);
 assert.ok(upgraded.duration>basic.duration);
 assert.ok(upgraded.cooldown<basic.cooldown);
 assert.ok(basic.multiplier>2);
});
test('ремонтник не стреляет издалека, оставляя эту роль корвету',()=>{
 const medic={serial:1,group:1,type:'healer',x:0,y:0,vx:0,vy:0,hp:75,
  maxHp:75,damage:5,r:14,think:0,fire:0,state:'heal',commitUntil:0};
 const grid=new SpatialGrid(100);grid.insert(medic);
 let fired=0;
 const game={time:190,player:{x:80,y:0,hp:110,r:19,invul:0},grid,allies:[],
  avoidance:()=>({x:0,y:0}),enemyShot:()=>{fired++;},hurt:()=>{}};
 updateEnemy(medic,game,.1);
 assert.equal(fired,0);
});
test('ведомый выбирает угрозу около игрока и не улетает за врагом',()=>{
 const a={serial:1,role:'scout',x:90,y:0,vx:0,vy:0,r:13,hp:50,
  maxHp:50,think:0,fire:0,state:'follow',commitUntil:0};
 const nearby={serial:9,type:'scout',x:170,y:20,hp:28,maxHp:28};
 const distant={serial:10,type:'gunship',x:700,y:0,hp:120,maxHp:120};
 const grid=new SpatialGrid(100);grid.insert(nearby);grid.insert(distant);
 let shots=0;
 const game={time:20,player:{x:0,y:0,hp:110},grid,allies:[a],
  network:{engine:0,armament:0,armor:0},skillRanks:{tactics:0},
  avoidance:()=>({x:0,y:0}),shotsNear:()=>[],nearbyEnemyBase:()=>null,
  heritage:{play:()=>{}},damageEnemy:()=>{shots++;},flash:()=>{}};
 for(let i=0;i<120;i++){game.time+=.016;updateAlly(a,game,.016);}
 assert.equal(a.state,'cover');
 assert.equal(a.target,nearby);
 assert.ok(shots>0);
 assert.ok(dist(a,game.player)<230);
});
test('отставший ведомый немедленно возвращается',()=>{
 const a={serial:2,role:'fighter',x:550,y:0,vx:0,vy:0,r:13,hp:50,
  maxHp:50,think:0,fire:10,state:'cover',commitUntil:99,
  target:{serial:5,x:560,y:0,hp:60}};
 const grid=new SpatialGrid(100);grid.insert(a.target);
 const game={time:30,player:{x:0,y:0,hp:110},grid,allies:[a],
  network:{engine:0,armament:0,armor:0},skillRanks:{tactics:0},
  avoidance:()=>({x:0,y:0}),shotsNear:()=>[],nearbyEnemyBase:()=>null,
  damageEnemy:()=>{},flash:()=>{}};
 updateAlly(a,game,.2);
 assert.equal(a.state,'follow');
 assert.ok(dist(a,game.player)<550);
});
