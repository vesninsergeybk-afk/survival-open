import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,STARTER_COMBAT} from '../balance.js';
import {BENCHMARK_BUILDS,combatTierMatrix} from '../tools/combat-profile.mjs';
import {runFirstLoopScenario,runEncounterStress} from '../tools/early-combat-audit.mjs';
import {ENEMY_AWARENESS} from '../enemy-awareness.js';
import {SIGNAL_AI} from '../signal-perception.js';
import {HUD_RADAR_RANGE,radarPoint} from '../hud.js';
import {ArcadeGame} from './runtime-game.mjs';

test('первый цикл действительно выполняет стыковку, активацию, добычу и сдачу заказа',()=>{
 for(const seed of [111,222,333]){
  const run=runFirstLoopScenario({seed,seconds:15});
  const names=run.events.map(item=>item.name);
  for(const name of ['first-dock','activate','accept-rich-contract',
   'begin-extraction','rich-extracted','return-dock','contract-claim'])
   assert.ok(names.includes(name),`seed=${seed}: не произошло ${name}`);
  assert.ok(run.secondDockAt>run.firstDockAt);
  assert.ok(run.missionCompleteAt>0&&run.missionCompleteAt<15);
  assert.equal(run.upgradeCount,1,'добытый опыт позволяет купить раннее улучшение корпуса');
  assert.equal(run.maxHull,STARTER_COMBAT.hull+22);
  assert.ok(run.ore>run.initialOre,'награды должны попадать в настоящую экономику');
 }
});

test('раннее отступление даёт измеримый выигрыш, но ремонт тратит ресурс',()=>{
 for(const seed of [111,222,333]){
  const noRetreat=runFirstLoopScenario({seed,seconds:120,allowRetreat:false});
  const retreat=runFirstLoopScenario({seed,seconds:120,allowRetreat:true});
  assert.equal(noRetreat.dead,true);
  assert.ok(retreat.seconds>=noRetreat.seconds+20,
   `seed=${seed}: возвращение на ремонт почти ничего не меняет`);
  assert.equal(retreat.repairCount,2);
  assert.equal(retreat.returns,2);
  assert.ok(retreat.events.filter(e=>e.name==='paid-repair')
   .every((event,index,list)=>index===0||event.ore<list[index-1].ore),
   'платный ремонт должен уменьшать запас сплава');
 }
});

test('знакомство с управлением не перекрывает маршрут к первому заказу',()=>{
 for(const seed of [111,222,333]){
  const run=runFirstLoopScenario({seed,seconds:30,initialDelay:12});
  assert.ok(run.missionCompleteAt>12&&run.missionCompleteAt<30,
   `seed=${seed}: после короткой паузы не получилось добыть руду и сдать заказ`);
  assert.equal(run.upgradeCount,1);
 }
});

test('стоянка у домашнего дока под огнём не заменяет уклонение',()=>{
 for(const seed of [111,222,333]){
  const run=runFirstLoopScenario({seed,seconds:80,allowRetreat:false,patrolMode:'camp'});
  assert.equal(run.dead,true);
  assert.ok(run.seconds>20&&run.seconds<45);
 }
});

test('начальная угроза обнаруживается до первого попадания по кораблю',()=>{
 for(const seed of [111,222,333]){
  const run=runFirstLoopScenario({seed,seconds:35,allowRetreat:false});
  for(const field of ['firstRadarEnemyAt','firstOpticalThreatAt','firstSensorSightingAt',
   'firstEnemyInPlasmaRangeAt','firstDamageAt'])
   assert.ok(Number.isFinite(run[field]),`seed=${seed}: нет ${field}`);
  assert.ok(run.firstRadarEnemyAt<run.firstOpticalThreatAt);
  assert.ok(run.firstOpticalThreatAt<=run.firstSensorSightingAt,
   'расчётную видимость нельзя объявлять фактической фиксацией датчиком');
  assert.ok(run.firstSensorSightingAt<run.firstDamageAt);
  assert.ok(run.firstEnemyInPlasmaRangeAt<run.firstDamageAt);
  assert.ok(run.firstDamageAt-run.firstRadarEnemyAt>=5,
   'радар должен дать хотя бы несколько секунд перед первым повреждением');
 }
});

test('таблица сил использует допустимые ранги и показывает выигрыш от сближения',()=>{
 const matrix=combatTierMatrix(),profiles=matrix.tiers;
 const sight=matrix.sensorEnvelope;
 assert.equal(sight.patrolDirectSight,ENEMY_AWARENESS.directRange);
 assert.equal(sight.extractionPatrolSight,SIGNAL_AI.detectRadius);
 assert.equal(sight.cockpitRadarRange,HUD_RADAR_RANGE);
 assert.deepEqual(sight.stationDiscoveryByRadarRank,[570,760,950]);
 assert.ok(sight.pilotIntentLineOfSight>sight.patrolDirectSight);
 assert.ok(radarPoint(HUD_RADAR_RANGE,0,{x:0,y:0}));
 assert.equal(radarPoint(HUD_RADAR_RANGE+1,0,{x:0,y:0}),null);
 assert.equal(profiles.length,4);
 for(let i=0;i<profiles.length;i++){
  const tier=profiles[i],build=BENCHMARK_BUILDS[i];
  assert.ok(Object.values(tier.build).reduce((sum,rank)=>sum+rank,0)<=build.level-1);
  assert.ok(tier.ship.plasmaRange>=STARTER_COMBAT.plasmaRange);
  assert.equal(tier.contactDistances.plasmaBeforePatrolSight,
   ENEMY_AWARENESS.directRange-tier.ship.plasmaRange);
  assert.equal(tier.contactDistances.plasmaBeforeSignalSight,
   SIGNAL_AI.detectRadius-tier.ship.plasmaRange);
  assert.ok(tier.contactDistances.plasmaBeforeSignalSight>0,
   'в рамках проверяемых сборок патруль должен получать время на сближение');
  for(const enemy of tier.enemies){
   assert.ok(enemy.near.shots<enemy.far.shots,
    `${build.label}: сближение не должно быть менее выгодным`);
   assert.ok(enemy.near.ttkSeconds<enemy.far.ttkSeconds);
   assert.ok(enemy.hp>0);
  }
 }
 assert.ok(profiles[3].ship.hull>profiles[0].ship.hull);
 assert.ok(profiles[3].ship.speed>profiles[0].ship.speed);
 assert.ok(profiles[3].enemyFire.flanker.speed>
  profiles[0].enemyFire.flanker.speed,'поздние перехватчики должны иметь быструю атаку');
});

test('оптическое обнаружение действительно зависит от препятствия и направления полёта',()=>{
 const sight=ArcadeGame.prototype.enemyCanSee;
 const enemy={x:0,y:0,vx:0,vy:0},pilot={x:450,y:0,r:19};
 const scene={rockGrid:{query:()=>[]}};
 assert.equal(sight.call(scene,enemy,pilot),true);
 scene.rockGrid.query=()=>[{x:220,y:0,r:65,alive:true}];
 assert.equal(sight.call(scene,enemy,pilot),false,'астероид прерывает прямую видимость');
 scene.rockGrid.query=()=>[];
 enemy.vx=-200;
 assert.equal(sight.call(scene,enemy,pilot),false,'уходящий патруль не видит позади себя');
 enemy.vx=200;
 assert.equal(sight.call(scene,enemy,pilot),true,'патруль обнаруживает цель по ходу движения');
 pilot.x=ENEMY_AWARENESS.directRange+1;
 assert.equal(sight.call(scene,enemy,pilot),false,'за пределом датчика цель исчезает');
});

test('стресс-проба держит точное число врагов и предел снарядов',()=>{
 for(const count of [20,60,120,RULES.maxEnemies]){
  const result=runEncounterStress({count,frames:90});
  assert.equal(result.spawned,count);
  assert.ok(result.maxEnemies<=RULES.maxEnemies);
  assert.ok(result.maxShots<=RULES.maxShots);
 }
});
