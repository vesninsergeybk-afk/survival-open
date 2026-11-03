import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCENARIOS} from '../studio/concepts.js';
import {SCENARIO_BASELINES,TACTICAL_EXPERIMENTS} from '../studio/design-brief.js';

const carrier=SCENARIOS.carrier;
const source=readFileSync(new URL('../studio/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../studio/index.html',import.meta.url),'utf8');

test('carrier studio distinguishes the live first iteration from the unmeasured proposal',()=>{
 assert.match(carrier.state,/пробная версия/);
 assert.equal(SCENARIO_BASELINES.carrier.phases.length,8);
 assert.match(SCENARIO_BASELINES.carrier.status,/В игре/);
 assert.match(SCENARIO_BASELINES.carrier.reward,/38 сплава/);
 assert.match(carrier.reward,/В пробной сборке/);
 assert.match(carrier.time,/измерения ещё не проводились/);
});

test('carrier storyboard makes the route, moving transport, failure and return leg observable',()=>{
 const expected=['brief','approach','contact','escort','turn','last','return','result'];
 assert.deepEqual(carrier.phases.map(p=>p.id),expected);
 const chase=carrier.phases.slice(2,6).map(p=>p.progress);
 assert.ok(chase.every((p,i)=>p>0&&p<1&&(i===0||p>chase[i-1])));
 assert.equal(carrier.phases[6].progress,chase.at(-1));
 assert.equal(carrier.phases[7].progress,chase.at(-1));
 assert.match(carrier.phases[5].world,/повторить/);
 assert.match(carrier.phases[6].world,/не начислена/);
 assert.match(carrier.phases[7].action,/сенсорной кнопкой/);
 for(const phase of carrier.phases){
  assert.ok(phase.x>=0&&phase.x<=1&&phase.y>=0&&phase.y<=1);
  assert.equal(typeof phase.action,'string');
  assert.equal(typeof phase.choice,'string');
 }
});

test('player choice is tested using positioning and existing controls, not new keys',()=>{
 for(const beat of ['contact','escort','turn']){
  const options=TACTICAL_EXPERIMENTS.carrier[beat];
  assert.equal(options.length,2);
  assert.notEqual(options[0].result,options[1].result);
  assert.ok(options.every(o=>o.name&&o.risk));
 }
 const spec=readFileSync(new URL('../studio/CARRIER-INTERCEPTION-CONCEPT-2026-11-03.md',import.meta.url),'utf8');
 assert.match(spec,/Автоогонь должен давать возможность выбирать цель/);
 assert.match(spec,/До первого контакта время не ограничено/);
 assert.match(spec,/После возвращения|после сдачи|после возвращения/);
});

test('workshop loads the refreshed route storyboard and offers a linked concept specification',()=>{
 assert.match(source,/function drawCarrierRoute\(/);
 assert.match(source,/activeScenario==='carrier'&&scenarioMode==='proposal'/);
 assert.match(source,/carrier-concept-link/);
 assert.match(source,/\.\/concepts\.js\?v=carrier-live-1/);
 assert.match(source,/\.\/design-brief\.js\?v=carrier-live-1/);
 assert.match(html,/app\.js\?v=studio-carrier-live-1/);
 assert.match(html,/CARRIER-INTERCEPTION-CONCEPT-2026-11-03\.md/);
});
