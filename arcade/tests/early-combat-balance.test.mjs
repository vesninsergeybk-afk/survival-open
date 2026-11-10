import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,STARTER_COMBAT,beamDamage,openingThreat,openingSpawnRoom,rebaseSavedHull,SHIELD_HULL_TRANSFER,splitPlayerDamage} from '../balance.js';
import {moduleStats,createLoadout} from '../ship-loadout.js';
import {ENEMY_TYPES,IRIS_COMBAT} from '../ai.js';
import {ENEMY_AWARENESS} from '../enemy-awareness.js';
import {SIGNAL_AI} from '../signal-perception.js';
import {IRIS_SWARM} from '../iris-swarm.js';
import {ArcadeGame} from './runtime-game.mjs';
import {game as fixture} from './weapons-scene.mjs';

test('начальный корабль слабее на дистанции, но сохраняет мощный ближний бой',()=>{
 const p=moduleStats('plasma');
 assert.equal(createLoadout().slots[0],'plasma');
 assert.equal(p.damage,STARTER_COMBAT.plasmaDamage);
 assert.equal(p.range,RULES.beamRange);
 assert.equal(p.interval,STARTER_COMBAT.plasmaInterval);
 assert.ok(p.range<IRIS_SWARM.sensorRange,
  'разведчик должен заметить пилота раньше максимальной дальности стартовой плазмы');
 assert.ok(p.range<=STARTER_COMBAT.patrolSight+15,
  'обычные враги должны получать время на ответный выстрел');
 const close=beamDamage(p.damage,RULES.nearBeam);
 const distant=beamDamage(p.damage,p.range-20);
 assert.ok(close/distant>2.5,'приближение должно ощутимо повышать урон');
 assert.ok(Math.ceil(ENEMY_TYPES.scout.hp/close)<=3,
  'разведчик не должен превращаться в губку для попаданий в упор');
 assert.ok(Math.ceil(ENEMY_TYPES.scout.hp/distant)>=5,
  'с края дальности нельзя быстро срезать разведчика без ответного огня');
});

test('обнаружение согласовано между патрулём, визуальным контактом и сигналом добычи',()=>{
 assert.equal(ENEMY_AWARENESS.directRange,STARTER_COMBAT.patrolSight);
 assert.equal(SIGNAL_AI.detectRadius,STARTER_COMBAT.signalSight);
 const game={rockGrid:{query:()=>[]}};
 const enemy={x:0,y:0,vx:0,vy:0};
 assert.equal(ArcadeGame.prototype.enemyCanSee.call(game,enemy,
  {x:STARTER_COMBAT.patrolSight-1,y:0}),true);
 assert.equal(ArcadeGame.prototype.enemyCanSee.call(game,enemy,
  {x:STARTER_COMBAT.patrolSight+1,y:0}),false);
 assert.ok(STARTER_COMBAT.intentRange>STARTER_COMBAT.patrolSight,
  'предупреждение об огне должно быть заметно до приближения на дистанцию выстрела');
 assert.ok(IRIS_COMBAT.projectileSpeed>STARTER_COMBAT.speed,
  'снаряд должен догонять пилота, если тот лишь летит прямо');
});

test('защищённые девять секунд переходят в плотные, но ограниченные бои',()=>{
 const first=openingThreat(9),second=openingThreat(36),third=openingThreat(75);
 assert.equal(openingThreat(8.99).groupSize,0);
 assert.equal(first.groupSize,4);
 assert.ok(first.interval<=7);
 assert.ok(second.cap>first.cap&&third.cap>second.cap);
 assert.ok(second.types.includes('fighter'));
 assert.ok(!second.types.includes('gunship'));
 assert.ok(openingThreat(205).cap>=openingThreat(204.99).cap,
  'усиление по числу противников не должно внезапно исчезать');
 assert.ok(openingThreat(205).groupSize>=openingThreat(204.99).groupSize,
  'после 205-й секунды обычная эскадрилья не должна резко уменьшаться');
 for(const t of [9,36,75,118,155,205,300]){
  const {cap,groupSize}=openingThreat(t);
  assert.ok(groupSize<=cap&&cap<=RULES.maxEnemies);
 }
});

test('в первые минуты рядом с пилотом примерно на 10% меньше обычных патрулей',()=>{
 const before=[9,15,22,28,33];
 const stages=[9,36,75,118,155];
 for(let i=0;i<stages.length;i++){
  const actual=openingThreat(stages[i]);
  assert.ok(Math.abs(actual.cap-before[i]*.9)<=.5,
   `время ${stages[i]}: предел ${actual.cap} должен быть близок к -10%`);
 }
 assert.equal(openingThreat(204.99).cap,openingThreat(205).cap,
  'возврат к обычной численности должен быть плавным');
 assert.equal(openingThreat(205).cap,33,
  'поздние патрули и полноценные бои остаются прежними');
});

test('щит передаёт корпусу часть урона, сохраняя общий баланс одного попадания',()=>{
 assert.equal(SHIELD_HULL_TRANSFER,.15);
 const hit=splitPlayerDamage(20,50);
 assert.equal(hit.absorbed,17);
 assert.equal(hit.hullDamage,3);
 const weak=splitPlayerDamage(20,2);
 assert.deepEqual(weak,{absorbed:2,hullDamage:18});
 assert.deepEqual(splitPlayerDamage(20,0),{absorbed:0,hullDamage:20});
 for(const [damage,shield] of [[3,40],[17,1],[55,22],[20,50]]){
  const {absorbed,hullDamage}=splitPlayerDamage(damage,shield);
  assert.ok(absorbed<=shield&&absorbed>=0&&hullDamage>=0);
  assert.ok(Math.abs(absorbed+hullDamage-damage)<1e-9);
 }
});

test('реальное попадание повреждает оба слоя, но повторный удар во время неуязвимости не учитывается',()=>{
 const g=fixture();
 g.time=75;g.player.hp=90;g.player.shield=40;g.player.invul=0;
 g.cockpit={impact(){}};
 const hurtEffects=[],deflectEffects=[];
 g.heritage.vfx={
  arcadePlayerHurt(...args){hurtEffects.push(args);},
  arcadePlayerDeflect(...args){deflectEffects.push(args);}
 };
 g.hurt(20,{x:80,y:0});
 assert.ok(Math.abs(g.player.hp-87)<1e-9);
 assert.ok(Math.abs(g.player.shield-23)<1e-9);
 assert.ok(g.player.invul>0);
 assert.equal(hurtEffects.length,1);
 assert.equal(hurtEffects[0][5],3,'эффект учитывает именно урон корпусу');
 const firstGrace=g.player.invul;
 g.hurt(20,{x:80,y:0});
 assert.ok(Math.abs(g.player.hp-87)<1e-9);
 assert.ok(Math.abs(g.player.shield-23)<1e-9);
 assert.equal(deflectEffects.length,1,'игрок видит первое отражённое попадание');
 assert.ok(deflectEffects[0][2]?.directed,'отражение привязано к месту попадания');
 g.time+=.05;
 g.hurt(20,{x:80,y:0});
 assert.equal(deflectEffects.length,1,'поток снарядов не создаёт россыпь вспышек');
 assert.equal(g.player.invul,firstGrace,'отражение не продлевает неуязвимость');
 g.time+=.17;
 g.hurt(20,{x:80,y:0});
 assert.equal(deflectEffects.length,2,'отражённые попадания остаются читаемыми в долгом залпе');
 assert.ok(Math.abs(g.player.hp-87)<1e-9);
 assert.ok(Math.abs(g.player.shield-23)<1e-9);
 g.time+=.6;g.player.invul=0;
 g.hurt(20,{x:80,y:0});
 assert.ok(Math.abs(g.player.hp-84)<1e-9);
 assert.ok(Math.abs(g.player.shield-6)<1e-9);
 assert.equal(hurtEffects.length,2);
});

test('дальние неосведомлённые патрули не перекрывают местные встречи',()=>{
 const stage=openingThreat(20);
 assert.equal(openingSpawnRoom(20,stage,5,0,5),stage.cap);
 assert.equal(openingSpawnRoom(20,stage,stage.cap*2,0,stage.cap*2),0,
  'накопление невидимых патрулей должно быть ограничено');
 assert.equal(openingSpawnRoom(20,stage,stage.cap,stage.cap,stage.cap),0,
  'в насыщенном бою новые корабли не появляются поверх игрока');
 assert.equal(openingSpawnRoom(20,stage,30,0,3),stage.cap,
  'далёкие корабли других операций не отменяют местные патрули');
 assert.equal(openingSpawnRoom(205,openingThreat(205),22,0,0),openingThreat(205).cap,
  'дальние враги не расходуют квоту местных столкновений после 205-й секунды');
 assert.equal(openingSpawnRoom(204,openingThreat(204),46,0,30),openingThreat(204).cap,
  'старый локальный бюджет учитывает дальние патрули отдельно');
 assert.equal(openingSpawnRoom(205,openingThreat(205),43,0,27),33,
  'при переходе на 205-й секунде местный бюджет не должен внезапно стать нулём');
 assert.equal(openingSpawnRoom(205,openingThreat(205),RULES.maxEnemies,0,0),0,
  'общий абсолютный предел по-прежнему защищает производительность');
});

test('настоящий создатель встреч выпускает группу при заполненном далёкими патрулями лимите',()=>{
 const game=Object.create(ArcadeGame.prototype);
 Object.assign(game,{time:20,player:{x:0,y:0,level:1,hp:90},
  enemies:Array.from({length:6},(_,i)=>({x:9000+i*50,y:0,hp:28,
   _patrolRoute:{x:10000,y:0}})),groupSerial:0,enemySerial:6,
  lastEncounter:null,lastEncounterLabelAt:-Infinity,
  spawnEntryCamera:()=>({x:-600,y:-400,w:1200,h:800})});
 const previous=game.enemies.length;
 ArcadeGame.prototype.spawnGroup.call(game,openingThreat(20));
 assert.equal(game.enemies.length-previous,4);
 assert.ok(game.enemies.slice(previous).every(e=>e.hp>0&&e._patrolRoute));
});

test('промышленные эскадры нового мира не занимают квоту обычных патрулей',()=>{
 const game=Object.create(ArcadeGame.prototype);
 Object.assign(game,{time:20,player:{x:0,y:0,level:1,hp:90},
  enemies:Array.from({length:18},(_,i)=>({x:7000+i*60,y:0,hp:50,
   populationSortieId:'population:'+i,_patrolRoute:{x:8000,y:0}})),
  groupSerial:1,enemySerial:18,lastEncounter:null,lastEncounterLabelAt:-Infinity,
  spawnEntryCamera:()=>({x:-600,y:-400,w:1200,h:800})});
 const before=game.enemies.length;
 ArcadeGame.prototype.spawnGroup.call(game,openingThreat(20));
 assert.equal(game.enemies.length-before,4);
});

test('создатель обычных встреч не блокируется дальними кораблями после 205 секунд',()=>{
 const game=Object.create(ArcadeGame.prototype);
 Object.assign(game,{time:205,player:{x:0,y:0,level:1,hp:90},
  enemies:Array.from({length:43},(_,i)=>({x:8500+i*50,y:0,hp:28,
   _patrolRoute:{x:9500,y:0}})),groupSerial:0,enemySerial:43,
  lastEncounter:null,lastEncounterLabelAt:-Infinity,
  spawnEntryCamera:()=>({x:-600,y:-400,w:1200,h:800})});
 const previous=game.enemies.length;
 ArcadeGame.prototype.spawnGroup.call(game,openingThreat(205));
 const spawned=game.enemies.slice(previous);
 // At 205 seconds the legal random encounter is either seven ordinary
 // patrol ships or two eight-drone packs. Both demonstrate that distant
 // traffic did not starve the local encounter budget.
 assert.ok([7,16].includes(spawned.length),
  'местное звено появляется, хотя вдали уже есть 43 корабля');
 assert.ok(spawned.every(e=>e._patrolRoute),
  'оба типа встреч входят по настоящим маршрутам из-за экрана');
 if(spawned.length===16)
  assert.ok(spawned.every(e=>e.microSwarm),
   'двойная встреча из 16 кораблей допустима только для микророёв');
});

test('старые сохранения получают новую броню, сохраняя долю здоровья и вложенные очки',()=>{
 const unmodified={hp:55,maxHp:110};
 assert.equal(rebaseSavedHull(unmodified,0),true);
 assert.deepEqual(unmodified,{hp:45,maxHp:90});
 assert.equal(rebaseSavedHull(unmodified,0),false,'повторное восстановление ничего не отнимает');
 const upgraded={hp:77,maxHp:154};
 assert.equal(rebaseSavedHull(upgraded,2),true);
 assert.deepEqual(upgraded,{hp:67,maxHp:134});
 const current={hp:70,maxHp:STARTER_COMBAT.hull};
 assert.equal(rebaseSavedHull(current,0),false);
 assert.deepEqual(current,{hp:70,maxHp:90});
});
