import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWorldMap} from '../map-panel.js';

const home={id:'home',x:150,y:-30,type:'dock',active:true,enemy:false,discovered:true};
const laboratory={id:'lab1',x:620,y:30,type:'lab',active:true,enemy:false,discovered:true};
const world={
 home,
 stations:new Map([['home',home],['lab1',laboratory]]),
 networkTopology:()=>({linked:new Set(['home','lab1']),count:2,links:[]}),
 signals:()=>[]
};
const scenario=()=>({
 player:{x:0,y:0},world,enemyBasesUnlocked:()=>false,
 waypoint:{id:'home',x:home.x,y:home.y,label:'Док'},
 operation:null,mapReturnToBase:false,docked:null,time:12,
 contract:{baseId:'lab1',goal:3,progress:2,name:'Образцы'}
});

test('a completed contract marks exactly the issuing station, preserving a manual route',()=>{
 const game=scenario();
 let html=renderWorldMap(game);
 assert.doesNotMatch(html,/Построить маршрут к награде/);
 assert.doesNotMatch(html,/stroke="#ffd27e"/);
 assert.match(html,/СДАЧА · lab1/);
 assert.match(html,/data-act="missionHomeWaypoint" data-id="lab1"/);
 game.contract.progress=3;
 html=renderWorldMap(game);
 assert.match(html,/Построить маршрут к награде/);
 assert.match(html,/data-id="lab1"/);
 assert.match(html,/stroke="#ffd27e"/);
 assert.match(html,/НАГРАДА ГОТОВА/);
 assert.equal(game.waypoint.id,'home');
 game.contract=null;
 html=renderWorldMap(game);
 assert.doesNotMatch(html,/stroke="#ffd27e"/);
});

test('meteor front and its surviving mineral deposits have different map markers',()=>{
 const game=scenario();
 game.world={...world,rocks:new Map([['0:0',[{
  id:'0:0/meteor-front-1-0',originKind:'event',alive:true,x:320,y:130
 }]]])};
 game.meteorFront={active:{angle:0,x:300,y:0,serial:1,seed:4}};
 const html=renderWorldMap(game);
 assert.match(html,/Оранжевый коридор — метеоритный фронт/);
 assert.match(html,/Руда после метеоритного фронта/);
 assert.match(html,/Янтарные ромбы — богатая руда/);
 game.world.rocks.get('0:0')[0].alive=false;
 assert.doesNotMatch(renderWorldMap(game),/Руда после метеоритного фронта/);
});

test('an authored operation does not show an ordinary contract return marker',()=>{
 const game=scenario();
 game.contract=null;
 game.operation={id:'silent-corridor',name:'Глухой коридор',
  x:900,y:-400,hp:100,maxHp:150,pulsePeriod:4.2,pulseRange:315,pulseCharge:3.8};
 const html=renderWorldMap(game);
 assert.match(html,/СКОРО ЭМ-РАЗРЯД/);
 assert.doesNotMatch(html,/Построить маршрут к награде/);
});


test('defend contract shows a real 650 m perimeter, then removes it upon completion',()=>{
 const game=scenario();
 game.contract={kind:'defend',baseId:'lab1',goal:5,progress:2,name:'Оборона периметра'};
 let html=renderWorldMap(game);
 assert.match(html,/ЗОНА ЗАЩИТЫ · 650 М/);
 assert.match(html,/stroke="#78e4d6"/);
 assert.doesNotMatch(html,/Построить маршрут к награде/);
 game.contract.progress=5;
 html=renderWorldMap(game);
 assert.doesNotMatch(html,/stroke="#78e4d6"/);
 assert.match(html,/Построить маршрут к награде/);
 game.contract=null;
 assert.doesNotMatch(renderWorldMap(game),/ЗОНА ЗАЩИТЫ · 650 М/);
});

test('mission markers keep their original object numbers when earlier objectives are finished',()=>{
 const game=scenario();game.contract=null;game.waypoint=null;
 game.operation={id:'false-call',name:'Чужой позывной',phase:'active',baseId:'lab1',
  x:950,y:0,checks:1,correct:2,decoding:false,
  beacons:[{x:950,y:0,checked:true},{x:1120,y:20,checked:false},
   {x:1300,y:-20,checked:false}]};
 const html=renderWorldMap(game);
 assert.match(html,/Маяк 2/);assert.match(html,/Маяк 3/);
 assert.doesNotMatch(html,/Маяк 1/,'completed beacon must not renumber the surviving targets');
});

test('the chart follows the new final mission stages without exposing obsolete markers',()=>{
 const game=scenario();game.contract=null;game.waypoint=null;
 game.operation={id:'line-break',name:'Линия разрыва',phase:'active',stage:'sync',baseId:'home',
  x:950,y:0,progress:2,nodes:[{x:700,y:0,done:true},{x:1200,y:0,done:true}],
  link:{x:950,y:0,progress:2,goal:6.5,hp:90,done:false}};
 let html=renderWorldMap(game);
 assert.match(html,/Сопряжение узлов/);assert.match(html,/Сопряжение/);
 assert.doesNotMatch(html,/Узел 1/);
 game.operation={id:'false-call',name:'Чужой позывной',phase:'active',
  signalStage:'uplink',baseId:'lab1',x:1000,y:200,beacons:[],
  uplink:{x:1000,y:200,progress:1,goal:5.5,hp:90,done:false}};
 html=renderWorldMap(game);
 assert.match(html,/Ответный маяк/);
 assert.doesNotMatch(html,/Маяк 1/);
 game.operation={id:'sleeping-reactor',name:'Спящий реактор',phase:'active',
  baseId:'home',x:900,y:100,progress:1,cooled:false,
  nodes:[{x:780,y:80,done:true},{x:900,y:100,done:false}],
  coolant:{x:1150,y:260,progress:0,goal:4,done:false}};
 html=renderWorldMap(game);
 assert.match(html,/Клапан охлаждения/);
 assert.match(html,/Кассета 2/);
 assert.doesNotMatch(html,/Кассета 1/);
});
