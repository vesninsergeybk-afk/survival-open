import test from 'node:test';
import assert from 'node:assert/strict';
import {openingThreat,STARTER_COMBAT} from '../balance.js';
import {OPENING_ARC} from '../opening-arc.js';
import {game} from './weapons-scene.mjs';
import {runEarlyCombatScenario} from '../tools/early-combat-audit.mjs';

test('итоговая домашняя кривая учитывает все модификаторы вместо скрытого ограничения на два корабля',()=>{
 const g=game();g.player.level=1;
 let previous=0;
 for(const [time,minGroup] of [[9,3],[36,4],[75,5],[118,6],[175,6],[205,6]]){
  g.time=time;
  const raw=openingThreat(time,1),effective=g.sectorDirector(raw);
  assert.ok(effective.groupSize>=minGroup,
   'на '+time+' с домашний конфликт не должен отменять рост боевой группы');
  assert.ok(effective.groupSize<=raw.groupSize);
  assert.ok(time===205||effective.cap>=previous,
   'на '+time+' с рост давления не должен исчезать за ограничением другой системы');
  previous=effective.cap;
 }
 g.time=204.99;
 const before=g.sectorDirector(openingThreat(g.time,1));
 g.time=205;
 const after=g.sectorDirector(openingThreat(g.time,1));
 assert.ok(after.cap>=before.cap&&after.groupSize>=before.groupSize,
  'переход на 205-й секунде не должен вводить дополнительную искусственную паузу');
});

test('первое поручение открывается до того, как начинается длительный обстрел',()=>{
 assert.ok(OPENING_ARC.offerAt>=9&&OPENING_ARC.offerAt<=12);
 const flight=runEarlyCombatScenario({seed:111,mode:'idle',seconds:20});
 assert.equal(flight.firstChoiceHull,STARTER_COMBAT.hull,
  'экран выбора должен появляться до первого повреждения при новом вылете');
});

test('пилот должен уклоняться, но движение позволяет пережить первые столкновения',()=>{
 const idle=runEarlyCombatScenario({seed:111,mode:'idle',seconds:60});
 const moving=runEarlyCombatScenario({seed:111,mode:'circle',seconds:60});
 assert.ok(idle.dead&&idle.seconds>=20,
  'полная неподвижность должна приводить к поражению, но не в первые секунды');
 assert.equal(moving.dead,false,
  'маневрирующий новичок должен суметь продержаться минуту');
 assert.ok(moving.hull>=20&&moving.hull<=STARTER_COMBAT.hull,
  'маневрирование должно оставлять игроку шанс продолжить бой');
 assert.ok(moving.maxNearby>=3,'настоящий игровой цикл создаёт заметные контакты');
});
