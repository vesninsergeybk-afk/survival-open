import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contractReturnStation,contractDefenseZone,corridorCue,missionHudText,missionHomeStations,missionHomeText} from '../mission-feedback.js';

const world=()=>({stations:new Map([
  ['dock',{id:'dock',type:'dock',x:120,y:20,active:true,enemy:false}],
  ['lab',{id:'lab',type:'lab',x:900,y:30,active:true,enemy:false}]
])});
const op=()=>({id:'silent-corridor',hp:150,pulseRange:315,pulsePeriod:4.2,
  focusRange:255,pulseCharge:0,pulseFlashUntil:0,overheatedUntil:0});

test('reward marker points only to the issuing station when the award is ready',()=>{
 const scene=world(),contract={baseId:'lab',goal:5,progress:4};
 assert.equal(contractReturnStation(contract,scene),null);
 contract.progress=5;
 assert.equal(contractReturnStation(contract,scene)?.id,'lab');
 assert.notEqual(contractReturnStation(contract,scene)?.id,'dock');
 assert.equal(contractReturnStation(null,scene),null);
 assert.equal(contractReturnStation({baseId:'dock',goal:0,progress:0},scene),null);
 contract.progress=6;
 assert.equal(contractReturnStation(contract,scene)?.id,'lab');
 scene.stations.get('lab').active=false;
 assert.equal(contractReturnStation(contract,scene)?.id,'lab',
  'the player can return a completed order to a neutral, not yet powered station');
 scene.stations.get('lab').ruined=true;
 assert.equal(contractReturnStation(contract,scene),null);
});

test('mission homes remain explicit before completion and distinguish two issuing stations',()=>{
 const state={world:world(),player:{x:0,y:0},contract:{baseId:'lab',goal:5,progress:1},
  operation:{id:'last-signal',baseId:'dock',phase:'repair'}};
 const homes=missionHomeStations(state);
 assert.deepEqual(homes.map(h=>h.station.id),['dock','lab']);
 assert.match(missionHomeText(state),/Операция: сдача — Док \[dock\]/);
 assert.match(missionHomeText(state),/Заказ: сдача — Лаборатория \[lab\]/);
 state.contract.progress=5;
 assert.ok(missionHomeText(state).includes('✓ Заказ'));
 state.world.stations.get('lab').ruined=true;
 assert.deepEqual(missionHomeStations(state).map(h=>h.station.id),['dock']);
});

test('special operations do not become unclaimed ordinary contracts',()=>{
 assert.equal(contractReturnStation({id:'silent-corridor',hp:0},world()),null);
 assert.equal(contractReturnStation({id:'last-signal',repair:100},world()),null);
});

test('corridor cues match distinct real mission phases',()=>{
 const mission=op();
 assert.equal(corridorCue(mission,12,1400).key,'approach');
 assert.match(corridorCue(mission,12,1400).hint,/ДО ЦЕЛИ 1400 М/);
 assert.equal(corridorCue(mission,12,240).key,'ready');
 assert.doesNotMatch(corridorCue(mission,12,240).label,/УЯЗВИМ/);
 assert.doesNotMatch(corridorCue(mission,12,240).hint,/НАВЕДЁН/);
 mission.pulseCharge=1.2;
 assert.equal(corridorCue(mission,12,240).key,'charging');
 mission.pulseLocked=true;
 assert.match(corridorCue(mission,12,240).hint,/РАЗРЯД БУДЕТ/);
 mission.pulseCharge=3.8;
 const danger=corridorCue(mission,12,240);
 assert.equal(danger.key,'danger');
 assert.match(danger.hint,/ВЫЙДИТЕ/);
 mission.pulseCharge=0;mission.pulseLocked=false;
 mission.pulseFlashUntil=12.5;
 mission.overheatedUntil=14;
 assert.equal(corridorCue(mission,12.1,240).key,'discharge');
 assert.equal(corridorCue(mission,12.7,240).key,'overheat');
 assert.equal(corridorCue(mission,14.1,240).key,'ready');
 mission.hp=0;
 assert.equal(corridorCue(mission,14.1,240),null);
 assert.equal(corridorCue({id:'last-signal',hp:100},14.1,240),null);
});


test('defense perimeter is visible only for an unfinished defense contract at its issuing station',()=>{
 const scene=world(),contract={kind:'defend',baseId:'lab',goal:5,progress:2};
 assert.equal(contractDefenseZone(contract,scene)?.station.id,'lab');
 assert.equal(contractDefenseZone(contract,scene)?.radius,650);
 contract.progress=5;
 assert.equal(contractDefenseZone(contract,scene),null);
 contract.progress=2;contract.kind='kill';
 assert.equal(contractDefenseZone(contract,scene),null);
 contract.kind='defend';scene.stations.get('lab').enemy=true;
 assert.equal(contractDefenseZone(contract,scene),null);
});


test('cockpit explains defense eligibility, the real EMP phase and probe repair',()=>{
 const scene=world(),ship={player:{x:900,y:30},world:scene,operation:null,
  contract:{kind:'defend',baseId:'lab',name:'Оборона',goal:5,progress:2},time:12};
 assert.match(missionHudText(ship),/В ЗОНЕ ЗАЩИТЫ/);
 ship.player.x=1800;
 assert.match(missionHudText(ship),/ДО ЗОНЫ 250 М/);
 ship.contract.progress=5;
 assert.match(missionHudText(ship),/ВЕРНИТЕСЬ НА БАЗУ/);
 ship.contract=null;ship.operation={...op(),x:0,y:0,pulseCharge:1.5,pulseLocked:true};
 assert.match(missionHudText(ship),/ЗАРЯДКА ЭМ-ИМПУЛЬСА/);
 ship.operation={...op(),x:1100,y:80,baseId:'dock',phase:'return',hp:0};
 assert.match(missionHudText(ship),/ВЕРНИТЕСЬ В ДОК/);
 assert.match(missionHudText(ship),/1680 М/);
 ship.operation={id:'last-signal',x:0,y:0,repair:43};
 const probe=missionHudText(ship);
 assert.match(probe,/РЕМОНТ 43%/);
 assert.doesNotMatch(probe,/NaN|ГЛУШИТЕЛЬ/);
});

test('cockpit, map and game import the same mission-feedback module revision',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const hud=readFileSync(new URL('../hud.js',import.meta.url),'utf8');
 const map=readFileSync(new URL('../map-panel.js',import.meta.url),'utf8');
 const revision=(source)=>{
  const match=source.match(/mission-feedback\.js\?v=([^']+)'/);
  assert.ok(match,'mission-feedback import must have an explicit version');
  return match[1];
 };
 assert.equal(revision(game),revision(hud),'cockpit must receive the active mission phases');
 assert.equal(revision(game),revision(map),'tactical map must receive the same mission phases');
});

test('подсказки игры совпадают с утверждёнными сценариями мастерской', async () => {
 const {EMP_CUE_FRAMES}=await import('../studio/systems-data.js');
 for(const frame of EMP_CUE_FRAMES){
  const sample={...op(),pulseCharge:frame.charge,pulseLocked:frame.locked,
   pulseFlashUntil:frame.flashUntil,overheatedUntil:frame.overheatedUntil};
  const actual=corridorCue(sample,frame.now,frame.distance);
  assert.equal(actual?.key,frame.key,frame.name);
  assert.equal(actual?.label,frame.label,frame.name);
  assert.equal(actual?.hint,frame.hint,frame.name);
  assert.equal(actual?.color,frame.color,frame.name);
 }
});

test('вне радиуса ЭМ-импульс продолжает заряжаться, но ИИ не приказывает уходить',()=>{
 const mission={...op(),pulseCharge:1.3,pulseLocked:true};
 const charge=corridorCue(mission,12,370);
 assert.equal(charge.key,'charging');
 assert.match(charge.hint,/ВНЕ ЗОНЫ УДАРА/);
 assert.doesNotMatch(charge.hint,/ВЫЙДИТЕ/);
 mission.pulseCharge=3.8;
 const danger=corridorCue(mission,12,370);
 assert.equal(danger.key,'danger');
 assert.match(danger.hint,/ВНЕ ЗОНЫ УДАРА/);
 assert.doesNotMatch(danger.hint,/ВЫЙДИТЕ/);
 mission.pulseCharge=1;mission.pulseLocked=false;
 assert.match(corridorCue(mission,12,370).hint,/ЗАРЯД СНИЖАЕТСЯ/);
});

test('фаза после удара и окно +35% не дают ложных обещаний',()=>{
 const mission={...op(),pulseFlashUntil:12.55,overheatedUntil:14.3};
 const flashed=corridorCue(mission,12.1,240);
 assert.equal(flashed.key,'discharge');
 assert.match(flashed.label,/ПРОШЁЛ/);
 assert.doesNotMatch(flashed.hint,/ОПАСНАЯ ЗОНА|ОТОЙДИТЕ/);
 const boost=corridorCue(mission,12.8,240);
 assert.equal(boost.key,'overheat');
 assert.match(boost.hint,/ОРУЖИЕ \+35%/);
 assert.equal(corridorCue(mission,14.4,240).key,'ready');
 assert.doesNotMatch(corridorCue(mission,14.4,240).label,/УЯЗВИМ/);
});
