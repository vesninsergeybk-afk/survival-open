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
