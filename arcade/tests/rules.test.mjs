import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES, beamDamage, expForNext, spawnOutside, outsideCamera, SpatialGrid} from '../balance.js';
import {World} from '../world.js';
import {updateEnemy, updateAlly} from '../ai.js';

test('луч даёт полный урон вблизи и слабеет вдали',()=>{
 assert.equal(beamDamage(20,80),20);
 assert.equal(beamDamage(20,RULES.nearBeam),20);
 const far=beamDamage(20,RULES.beamRange);
 assert.ok(far<9 && far>7);
 assert.ok(beamDamage(20,260)<20);
});
test('стоимость уровня растёт без мгновенного лавинообразного развития',()=>{
 assert.equal(expForNext(1),42);
 for(let level=2;level<25;level++)
  assert.ok(expForNext(level)>expForNext(level-1));
});
test('враги появляются за пределами разных экранов',()=>{
 for(const camera of [{x:-600,y:-400,w:1200,h:800},{x:0,y:0,w:620,h:1000}]){
  for(let side=0;side<4;side++)for(const fraction of [0,.1,.5,.9,1]){
   const p=spawnOutside(camera,side,fraction,145);
   assert.ok(outsideCamera(p.x,p.y,camera,45));
  }
 }
});
test('мир детерминирован и не меняет ранее открытые станции',()=>{
 const w1=new World(1337),w2=new World(1337);
 const a=w1.nearbyStations(0,0,4000).map(({id,x,y,type})=>[id,x,y,type]);
 const b=w2.nearbyStations(0,0,4000).map(({id,x,y,type})=>[id,x,y,type]);
 assert.deepEqual(a,b);assert.equal(w1.home.x,360);
 w1.home.active=true;
 assert.equal(w1.nearbyStations(0,0,700)[0].active,true);
});
test('пространственная сетка возвращает соседей без полного перебора',()=>{
 const grid=new SpatialGrid(100);
 grid.insert({x:3,y:4,id:'a'});grid.insert({x:155,y:6,id:'b'});
 assert.equal(grid.query(0,0,80).length,1);
});
test('ремонтник восстанавливает повреждённого союзника',()=>{
 const wounded={type:'fighter',x:9,y:0,hp:20,maxHp:100};
 const healer={type:'healer',serial:1,group:1,x:0,y:0,vx:0,vy:0,hp:60,maxHp:60,
  damage:5,r:14,think:0,fire:20,state:'heal',commitUntil:0,healReserve:100};
 const g={time:1,player:{x:600,y:600,hp:100,r:19,invul:0},grid:new SpatialGrid(100),
  allies:[],avoidance:()=>({x:0,y:0}),enemyShot:()=>{},hurt:()=>{}};
 g.grid.insert(wounded);g.grid.insert(healer);
 updateEnemy(healer,g,.5);
 assert.ok(wounded.hp>20);
 assert.ok(healer.healReserve<100);
});
test('ведомый вычисляет маршрут без NaN',()=>{
 const ally={serial:1,role:'fighter',x:0,y:0,vx:0,vy:0,r:13,hp:50,maxHp:50,
  think:0,fire:0,state:'follow',commitUntil:0};
 const p={x:500,y:500,hp:100};
 const g={time:0,player:p,grid:new SpatialGrid(100),allies:[ally],
  network:{engine:0,armament:0,armor:0},skillRanks:{tactics:0},
  avoidance:()=>({x:0,y:0}),shotsNear:()=>[],nearbyEnemyBase:()=>null,
  damageEnemy:()=>{},flash:()=>{}};
 updateAlly(ally,g,.016);
 assert.ok(Number.isFinite(ally.x)&&Number.isFinite(ally.y));
});
