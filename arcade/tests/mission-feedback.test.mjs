import test from 'node:test';
import assert from 'node:assert/strict';
import {contractReturnStation,contractDefenseZone,corridorCue,missionHudText} from '../mission-feedback.js';

const world=()=>({stations:new Map([
  ['dock',{id:'dock',x:120,y:20,active:true,enemy:false}],
  ['lab',{id:'lab',x:900,y:30,active:true,enemy:false}]
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
 assert.equal(contractReturnStation(contract,scene),null);
});

test('special operations do not become unclaimed ordinary contracts',()=>{
 assert.equal(contractReturnStation({id:'silent-corridor',hp:0},world()),null);
 assert.equal(contractReturnStation({id:'last-signal',repair:100},world()),null);
});

test('corridor cues match distinct real mission phases',()=>{
 const mission=op();
 assert.equal(corridorCue(mission,12,1400).key,'approach');
 assert.match(corridorCue(mission,12,1400).hint,/ДО ЦЕЛИ 1400 М/);
 assert.equal(corridorCue(mission,12,240).key,'vulnerable');
 mission.pulseCharge=1.2;
 assert.equal(corridorCue(mission,12,240).key,'charging');
 mission.pulseLocked=true;
 assert.match(corridorCue(mission,12,240).hint,/РАЗРЯД НЕИЗБЕЖЕН/);
 mission.pulseCharge=3.8;
 const danger=corridorCue(mission,12,240);
 assert.equal(danger.key,'danger');
 assert.match(danger.hint,/ОТОЙДИТЕ/);
 mission.pulseFlashUntil=12.5;
 mission.overheatedUntil=14;
 assert.equal(corridorCue(mission,12.1,240).key,'discharge');
 assert.equal(corridorCue(mission,12.7,240).key,'overheat');
 assert.equal(corridorCue(mission,14.1,240).key,'danger');
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
