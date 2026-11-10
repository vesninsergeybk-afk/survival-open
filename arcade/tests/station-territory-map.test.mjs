import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connectContour,createContours,contourFields} from '../territory-system.js';
import {stationContourDefenseModel,renderStationContourDefense} from '../station-territory-map.js';

function fixture(){
 const sites=[['A',0,0,'dock'],['B',1500,-100,'arsenal'],
  ['C',1100,1400,'carrier'],['D',-900,1300,'lab']];
 const stations=new Map(sites.map(([id,x,y,type])=>[id,
  {id,x,y,type,active:true,enemy:false,suppressed:false}]));
 const world={stations,contours:createContours()};
 for(const [a,b] of [['A','B'],['B','C'],['C','A'],['C','D'],['D','A']])
  assert.equal(connectContour(world,a,b).ok,true);
 assert.equal(contourFields(world).length,2);
 const shared={id:1,type:'arc',kind:'flux-support',x:550,y:700,
  hp:125,maxHp:125,readyAt:0,branches:{}};
 const first={id:2,type:'laser',kind:'flux-support',x:750,y:-50,
  hp:125,maxHp:125,readyAt:0,branches:{}};
 const second={id:3,kind:'flux-artillery',x:100,y:1350,
  hp:155,maxHp:155,readyAt:0,branches:{}};
 world.contours.supportTurrets.push(shared,first);
 world.contours.artillery.push(second);
 world.contours.flux=100;
 world.contours.trials.completed=1;
 const state={world,ore:1000,time:5};
 return {world,stations,shared,first,second,state};
}

test('station map lists every actual neighboring triangle, with stable stations and edges',()=>{
 const {world,stations}=fixture();
 const plan=stationContourDefenseModel(world,stations.get('A'));
 assert.equal(plan.faces.length,2);
 assert.equal(plan.stations.length,4);
 assert.equal(plan.stations.filter(s=>s.current).length,1);
 assert.equal(new Set(plan.edges.map(e=>e.id)).size,5);
 assert.equal(stationContourDefenseModel(world,stations.get('B')).faces.length,1);
 assert.equal(stationContourDefenseModel(world,stations.get('D')).faces.length,1);
 assert.equal(stationContourDefenseModel(world,{id:'unknown'}).faces.length,0);
});

test('shared-edge turret is presented in both triangles but remains one real upgrade target',()=>{
 const {world,stations}=fixture();
 const plan=stationContourDefenseModel(world,stations.get('A'));
 const ab=plan.faces.find(face=>face.field.vertices.includes('B'));
 const ad=plan.faces.find(face=>face.field.vertices.includes('D'));
 assert.deepEqual(ab.turrets.map(t=>t.target).sort(),['s:1','s:2']);
 assert.deepEqual(ad.turrets.map(t=>t.target).sort(),['a:3','s:1']);
 assert.equal(plan.turrets.length,3);
 assert.deepEqual(plan.turrets.find(t=>t.target==='s:1').faceLabels,
  [ab.label,ad.label]);
 assert.notEqual(ab.id,ad.id);
});

test('selection changes upgrade list and highlights the exact face in an accessible diagram',()=>{
 const {world,stations,state}=fixture();
 const plan=stationContourDefenseModel(world,stations.get('A'));
 const ab=plan.faces.find(face=>face.field.vertices.includes('B'));
 const ad=plan.faces.find(face=>face.field.vertices.includes('D'));
 const a=renderStationContourDefense(stations.get('A'),{...state,territoryContourId:ab.id});
 const b=renderStationContourDefense(stations.get('A'),{...state,territoryContourId:ad.id});
 assert.match(a,/aria-label="Схема контуров вокруг выбранной станции/);
 assert.match(a,/data-act="selectTerritoryContour"/);
 assert.match(a,/aria-pressed="true"/);
 assert.match(a,/С1/);
 assert.match(a,/К1/);
 assert.match(a,/К2/);
 assert.match(a,/общая грань: Контур/);
 assert.match(a,/data-act="upgradeTerritoryTurret"[^>]*data-target="s:1"/);
 assert.match(a,/data-act="upgradeTerritoryTurret"[^>]*data-target="s:2"/);
 assert.doesNotMatch(a,/data-act="upgradeTerritoryTurret"[^>]*data-target="a:3"/);
 assert.match(b,/data-act="upgradeTerritoryTurret"[^>]*data-target="a:3"/);
 assert.doesNotMatch(b,/data-act="upgradeTerritoryTurret"[^>]*data-target="s:2"/);
 assert.match(b,/К этой станции примыкают 2 контура/);
});

test('no face means no ambiguous list of nearby guns and selection is checked on purchase',()=>{
 const {world,stations,state}=fixture();
 const lone={id:'lone',type:'lab',active:true,x:4000,y:4000};
 const view=renderStationContourDefense(lone,state);
 assert.match(view,/не входит в замкнутый контур/);
 assert.doesNotMatch(view,/data-act="upgradeTerritoryTurret"/);
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/chosenFace\?\.turrets\.some\(item=>item\.target===key\)/);
 assert.match(game,/this\.territoryContourSelection=\{stationId:this\.docked\.id,faceId\}/);
 const plan=stationContourDefenseModel(world,stations.get('A'));
 const wrong=plan.faces.find(face=>face.field.vertices.includes('B'));
 assert.ok(!wrong.turrets.some(t=>t.target==='a:3'));
});
