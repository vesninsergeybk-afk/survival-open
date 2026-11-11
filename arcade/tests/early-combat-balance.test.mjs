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
import {IMPACT_PRESSURE,impactPressureLevel,registerImpact,shieldGrazeInGrace} from '../impact-pressure.js';

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
 assert.ok(close/distant>2,'приближение должно ощутимо повышать урон');
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

test('защищённые девять секунд переходят в управляемые группы и постепенное усиление',()=>{
 const first=openingThreat(9),second=openingThreat(36),third=openingThreat(85);
 assert.equal(openingThreat(8.99).groupSize,0);
 assert.equal(first.groupSize,3);
 assert.equal(first.interval,10,'первые патрули оставляют время для манёвра');
 assert.ok(openingThreat(120).interval>=12,
  'небольшой рой заменяет патруль в разреженном начале');
 assert.ok(second.cap>first.cap&&third.cap>second.cap);
 assert.ok(second.types.includes('fighter'));
 assert.ok(!second.types.includes('gunship'));
 assert.ok(openingThreat(230).cap>=openingThreat(229.99).cap,
  'усиление по числу противников не должно внезапно исчезать');
 assert.ok(openingThreat(230).groupSize>=openingThreat(229.99).groupSize,
  'после 230-й секунды обычная эскадрилья не должна резко уменьшаться');
 for(const t of [9,36,80,120,175,230,300]){
  const {cap,groupSize}=openingThreat(t);
  assert.ok(groupSize<=cap&&cap<=RULES.maxEnemies);
 }
});

test('местная численность растёт медленно; опасные виды открываются по очереди',()=>{
 const expected=[7,10,11,14,17,17];
 const stages=[9,36,80,120,175,230];
 for(let i=0;i<stages.length;i++){
  const actual=openingThreat(stages[i]);
  assert.equal(actual.cap,expected[i],`время ${stages[i]}: предел ${actual.cap}`);
 }
 assert.equal(openingThreat(229.99).cap,openingThreat(230).cap);
 assert.ok(!openingThreat(229.99).types.includes('gunship'));
 assert.ok(openingThreat(230).types.includes('gunship'));
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

test('корпус защищён в короткое окно после удара, но повторные попадания истощают щит',()=>{
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
 assert.ok(Math.abs(g.player.shield-19.5)<1e-9,
  'часть последующего удара расходует щит, но не корпус');
 assert.equal(deflectEffects.length,1,'игрок видит первое отражённое попадание');
 assert.ok(deflectEffects[0][2]?.directed,'отражение привязано к месту попадания');
 g.time+=.05;
 g.hurt(20,{x:80,y:0});
 assert.equal(g.player.shield,19.5,'частые повторные касания ограничены по времени');
 assert.equal(deflectEffects.length,1,'поток снарядов не создаёт россыпь вспышек');
 assert.equal(g.player.invul,firstGrace,'отражение не продлевает неуязвимость');
 g.time+=.17;
 g.hurt(20,{x:80,y:0});
 assert.equal(deflectEffects.length,2,'отражённые попадания остаются читаемыми в долгом залпе');
 assert.ok(Math.abs(g.player.hp-87)<1e-9);
 assert.ok(Math.abs(g.player.shield-19.5)<1e-9);
 g.time+=.04;
 g.hurt(20,{x:80,y:0});
 assert.equal(g.player.shield,16,'щит снова тратится лишь после интервала защиты');
 g.time+=.6;g.player.invul=0;
 g.hurt(20,{x:80,y:0});
 assert.ok(Math.abs(g.player.hp-83)<1e-9,
  'истощённый щит не усиливает прямой урон корпусу');
 assert.ok(Math.abs(g.player.shield)<1e-9);
 assert.equal(hurtEffects.length,2);
});

test('серия прямых попаданий ускоряет истощение развитого щита без дополнительного урона корпусу',()=>{
 const g=fixture();g.player.hp=90;g.player.shield=80;g.player.invul=0;
 g.skillRanks.shield=3;
 g.time=10;g.cockpit={impact(){}};
 g.hurt(20,{x:80,y:0});
 assert.equal(g.player.shield,63);
 assert.equal(g.player.hp,87);
 g.time+=.8;g.player.invul=0;
 g.hurt(20,{x:80,y:0});
 assert.ok(Math.abs(g.player.shield-42)<1e-9,
  'защитный запас тратится на 4 больше из-за повторного попадания');
 assert.equal(g.player.hp,84,'урон корпусу при целом щите остаётся 15%');
});

test('нагрузка от серии попаданий растёт постепенно и сбрасывается после уклонения',()=>{
 const game={player:{shield:88}};
 assert.equal(registerImpact(game,10),1);
 assert.equal(registerImpact(game,11),1.2);
 assert.equal(registerImpact(game,12),1.4);
 assert.equal(registerImpact(game,13),1.4,'нагрузка ограничена');
 assert.equal(impactPressureLevel(game.impactPressure,17.9),3);
 assert.equal(impactPressureLevel(game.impactPressure,18.01),0);
 assert.equal(registerImpact(game,18.01),1,'долгое уклонение полностью сбрасывает нагрузку');
 assert.equal(IMPACT_PRESSURE.window,5);
});

test('отражённый удар расходует только существующий щит и не снимает защиту корпуса',()=>{
 const game={player:{shield:3}};
 assert.equal(shieldGrazeInGrace(game,50,0),3);
 assert.equal(game.player.shield,0);
 assert.equal(shieldGrazeInGrace(game,50,.3),0,
  'после истощения щита окно неуязвимости остаётся полноценным');
 assert.equal(registerImpact(game,1),1,'отражённые попадания не наращивают урон');
});

test('защитные окна доктрин уменьшают именно фактический урон при попадании',()=>{
 const received=(ranks,windows={})=>{
  const g=fixture();g.doctrineRanks=ranks;Object.assign(g,windows);
  g.player.hp=90;g.player.shield=0;g.player.invul=0;
  g.cockpit={impact(){}};
  g.hurt(20,{x:80,y:0});
  return 90-g.player.hp;
 };
 assert.equal(received({}),20);
 assert.equal(received({assault:2},{assaultBurstUntil:12}),15);
 assert.equal(received({countermaneuver:2},{counterguardUntil:12}),17);
 assert.equal(received({countermaneuver:3},{counterguardUntil:12}),14);
 assert.equal(received({assault:2,countermaneuver:3},
  {assaultBurstUntil:12,counterguardUntil:12}),10.5);
 assert.equal(received({countermaneuver:3},{counterguardUntil:9}),20,
  'истёкшее защитное окно не должно уменьшать урон');
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
 assert.equal(openingSpawnRoom(204,openingThreat(204),46,0,10),openingThreat(204).cap,
  'старый локальный бюджет учитывает дальние патрули отдельно');
 assert.equal(openingSpawnRoom(205,openingThreat(205),43,0,27),17,
  'удалённые патрули не блокируют близкую встречу после расширения сектора');
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
 assert.equal(game.enemies.length-previous,3);
 assert.ok(game.enemies.slice(previous).every(e=>e.hp>0&&e._patrolRoute));
});
test('первый приоритетный рой соблюдает полный бюджет из шести свободных мест',()=>{
 const g=Object.create(ArcadeGame.prototype);
 Object.assign(g,{time:120,player:{x:0,y:0,level:1,hp:90},
  enemies:Array.from({length:8},(_,i)=>({x:350+i*14,y:0,hp:28,
   _patrolRoute:{x:1600,y:0}})),groupSerial:0,enemySerial:8,
  nextMoteEncounterAt:110,lastEncounter:'motes',lastEncounterLabelAt:-Infinity,
  spawnEntryCamera:()=>({x:-600,y:-400,w:1200,h:800})});
 const recovery=g.spawnGroup(openingThreat(120));
 const newShips=g.enemies.slice(8);
 assert.equal(newShips.length,6);
 assert.ok(newShips.every(e=>e.microSwarm&&e._patrolRoute));
 assert.ok(recovery>=3);
 assert.equal(g.nextMoteEncounterAt,215);
 g.time=125;
 assert.equal(g.spawnGroup(openingThreat(125)),0,
  'после роя обычные формирования ждут, пока в секторе освободится место');
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
 assert.equal(game.enemies.length-before,3);
});
test('широкая камера учитывает всех видимых врагов, даже если они далеко от героя',()=>{
 const g=Object.create(ArcadeGame.prototype);
 Object.assign(g,{time:90,player:{x:0,y:0,level:1,hp:90},
  enemies:Array.from({length:11},(_,i)=>({x:2500+i*150,y:150,hp:28,
   _patrolRoute:{x:6000,y:0}})),groupSerial:0,enemySerial:11,
  camera:()=>({x:-5000,y:-3000,w:10000,h:6000}),
  spawnEntryCamera:()=>({x:-5000,y:-3000,w:10000,h:6000})});
 assert.equal(g.spawnGroup(openingThreat(90)),0,
  'патруль не должен заполнять уже многолюдный видимый сектор при отдалении');
});

test('создатель обычных встреч не блокируется дальними кораблями после 230 секунд',()=>{
 const game=Object.create(ArcadeGame.prototype);
 Object.assign(game,{time:240,player:{x:0,y:0,level:1,hp:90},
  enemies:Array.from({length:43},(_,i)=>({x:8500+i*50,y:0,hp:28,
   _patrolRoute:{x:9500,y:0}})),groupSerial:0,enemySerial:43,
  lastEncounter:null,lastEncounterLabelAt:-Infinity,
  spawnEntryCamera:()=>({x:-600,y:-400,w:1200,h:800})});
 const previous=game.enemies.length;
 ArcadeGame.prototype.spawnGroup.call(game,openingThreat(240));
 const spawned=game.enemies.slice(previous);
 // A normal formation has six ships; an unprepared pilot gets eight motes.
 // Both demonstrate that distant
 // traffic did not starve the local encounter budget.
 assert.ok([6,8].includes(spawned.length),
  'местное звено появляется, хотя вдали уже есть 43 корабля');
 assert.ok(spawned.every(e=>e._patrolRoute),
  'оба типа встреч входят по настоящим маршрутам из-за экрана');
 if(spawned.length===8)
  assert.ok(spawned.every(e=>e.microSwarm),
   'рой из восьми кораблей допустим только для микродронов');
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
