import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEMS, ISSUE_REFS, PARTIAL_REFS, REF_TITLES, EMP_CUE_FRAMES} from '../studio/systems-data.js';

test('сохранены все 31 пункта исходного игрового реестра', () => {
 assert.equal(ISSUE_REFS.length, 31);
 assert.equal(new Set(ISSUE_REFS).size, 31);
 const names = SYSTEMS.flatMap(item => item.refs);
 assert.deepEqual([...new Set(names)].sort(), [...ISSUE_REFS].sort());
 for (const ref of ISSUE_REFS) assert.ok(REF_TITLES[ref], 'Потерян заголовок ' + ref);
});

test('каждая концепция даёт игроку выбор и описывает последствия', () => {
 assert.equal(SYSTEMS.length, 15);
 assert.equal(new Set(SYSTEMS.map(item => item.id)).size, SYSTEMS.length);
 for (const item of SYSTEMS) {
  assert.ok(typeof item.id === 'string' && item.id.length >= 2);
  for (const key of ['chapter','name','phase','essence','reality','hypothesis','rule','risk','test','deps']) {
   assert.ok(typeof item[key] === 'string' && item[key].trim().length > 3,
    'У ' + item.id + ' нет содержательного поля ' + key);
  }
  assert.ok(Number.isInteger(item.priority) && item.priority >= 1);
  assert.ok(item.refs.length >= 1);
  assert.ok(item.beats.length >= 3 && item.beats.length <= 6);
  for (const [index, beat] of item.beats.entries()) {
   assert.equal(beat.length, 4, item.id + ' шаг ' + index);
   assert.ok(typeof beat[0] === 'string' && beat[0].trim().length >= 4,
    'Нет названия этапа ' + item.id + '/' + index);
   assert.ok(beat.slice(1).every(value => typeof value === 'string' && value.trim().length > 12),
    'Не описаны действия, ответ мира или выбор в ' + item.id + '/' + index);
  }
 }
});

test('частичная реализация не получает ложный статус готовности', () => {
 for (const ref of PARTIAL_REFS) assert.ok(ISSUE_REFS.includes(ref));
 for (const item of SYSTEMS) {
  assert.ok(['Концепция', 'Согласование', 'Частично в игре'].includes(item.phase));
 }
 assert.ok(SYSTEMS.find(item => item.id === 'return').refs.includes('А4'));
 assert.ok(SYSTEMS.find(item => item.id === 'storm').refs.includes('Г2'));
 assert.ok(SYSTEMS.find(item => item.id === 'special').refs.includes('Б1'));
});

test('концепция ЭМ-глушителя описывает все фазы без ложной уязвимости', () => {
 const emp=SYSTEMS.find(item=>item.id==='emp');
 assert.ok(emp);
 assert.equal(emp.beats.length,6);
 assert.equal(EMP_CUE_FRAMES.length,7);
 assert.deepEqual([...new Set(EMP_CUE_FRAMES.map(frame=>frame.key))],
  ['approach','ready','charging','danger','discharge','overheat']);
 for(const frame of EMP_CUE_FRAMES){
  assert.ok(frame.label.length>=8);
  assert.ok(frame.hint.length>=10);
  assert.ok(frame.explanation.length>=35);
  assert.ok(/^#[0-9a-f]{6}$/i.test(frame.color));
  assert.ok(frame.now>=0 && frame.distance>=0);
  if(frame.key==='ready')assert.doesNotMatch(frame.label,/УЯЗВИМ/);
  if(frame.key==='discharge')assert.match(frame.label,/ПРОШЁЛ/);
  if(frame.key==='overheat')assert.match(frame.label,/УЯЗВИМ/);
 }
});
