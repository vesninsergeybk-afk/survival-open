import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {renderBasePanel} from '../base-panel.js';
import {renderShipHangar} from '../hangar-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';

const base={id:'0:0',x:0,y:0,type:'dock',active:true,discovered:true};
const stationState={ore:84,data:12,hp:110,maxHp:110,shield:30,allies:0,
 activeBases:1,connectedBases:1,connected:true,droneRoles:[],droneDamage:0,charges:0,
 network:{armor:0,engine:0,armament:0,strikePower:0},transfers:[],
 loadout:createLoadout(),skillRanks:{},level:1,points:1,operation:null,time:0};

test('station menus retain real action handlers and make module consequences explicit',()=>{
 const html=renderBasePanel(base,{...stationState,baseTab:'network'});
 assert.match(html,/ВЫЖИВШИЙ \/ ТЕРМИНАЛ СТАНЦИИ/);
 assert.match(html,/station-dock/);
 assert.match(html,/Второй станет недоступен до конца вылета/);
 assert.match(html,/data-act="installModule"/);
 assert.match(html,/aria-selected="true"/);
});

test('the loadout summary and costs precede large artwork and carry real range estimates',()=>{
 const current=createLoadout(),session=new HangarSession();session.begin(current);
 session.draft.slots[1]='rail';
 const html=renderShipHangar({...stationState,loadout:current,hangarSession:session},session);
 const apply=html.indexOf('class="hg-apply-bar');
 const layout=html.indexOf('class="hg-layout"');
 assert.ok(apply>=0&&layout>apply,'apply/reset must be available before a long ship view');
 assert.match(html,/Предварительная сборка/);
 assert.match(html,/hg-range-brief/);
 assert.match(html,/100 м/);
 assert.match(html,/400 м/);
 assert.match(html,/650 м/);
 assert.match(html,/СХЕМА ОСНАЩЕНИЯ/);
 assert.match(html,/hero-evolution\/ship_01.webp/);
 assert.match(html,/data-act="hgApply"/);
});

test('real mission preview uses labeled illustrative art without embedding invented game data',()=>{
 const html=renderBasePanel(base,{...stationState,baseTab:'operations'});
 assert.match(html,/mission-corridor/);
 assert.match(html,/Глухой коридор/);
 assert.match(html,/доставить телеметрию/);
 assert.match(html,/data-act="acceptOperation"/);
});

test('map supports a deliberate short-screen switch while preserving imprecise signals',()=>{
 const home={...base,id:'home'},lab={...base,id:'lab',type:'lab',x:700,y:100};
 const world={home,stations:new Map([['home',home],['lab',lab]]),
  networkTopology:()=>({linked:new Set(['home','lab']),count:2,links:[]}),
  signals:()=>[{id:'unknown',x:1200,y:900,type:'lab'}]};
 const game={world,player:{x:0,y:0},waypoint:null,operation:null,contract:null,
  docked:null,mapReturnToBase:false,enemyBasesUnlocked:()=>false};
 const first=renderWorldMap(game);
 assert.match(first,/map-mode-map/);
 assert.match(first,/data-act="mapView" data-id="targets"/);
 assert.match(first,/координаты приблизительные/);
 game.mapView='targets';
 assert.match(renderWorldMap(game),/map-mode-targets/);
});

test('new artwork is lightweight and every path is present in the actual Pages game',()=>{
 const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(page,/menu-system\.css/);
 for(const name of ['corridor','probe','relay','carrier']){
  const file=new URL('../studio/menu-kit/mission/'+name+'.webp',import.meta.url);
  assert.ok(existsSync(file),name+' illustration is missing');
  assert.ok(statSync(file).size<150_000,name+' illustration is too large');
  assert.ok(css.includes('mission/'+name+'.webp'));
 }
 assert.match(game,/askStationModule\(role\)/);
 assert.match(game,/act==='confirmModule'/);
 assert.match(game,/act==='skillBranch'/);
 assert.match(game,/act==='mapView'/);
 assert.match(css,/prefers-reduced-motion/);
});

test('published entry points invalidate the entire changed ES-module import chain',()=>{
 const source=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
 const game=source('game.js'),base=source('base-panel.js');
 const preview=source('hangar-preview.js');
 assert.match(source('index.html'),/game\.js\?v=[^"']*menus-2/);
 assert.match(game,/base-panel\.js\?v=menus-gameplay-first-2/);
 assert.match(game,/map-panel\.js\?v=menus-gameplay-first-1/);
 assert.match(base,/hangar-panel\.js\?v=menus-gameplay-first-2/);
 assert.match(base,/map-panel\.js\?v=menus-gameplay-first-1/);
 assert.match(source('hangar-preview.html'),/hangar-preview\.js\?v=menus-gameplay-first-2/);
 assert.match(preview,/hangar-panel\.js\?v=menus-gameplay-first-2/);
});

test('active menu controls never override positioning transforms used by ship hardpoints',()=>{
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 const activeRule=css.match(/#overlay \.dialog button:not\(:disabled\):active\s*\{([^}]*)\}/)?.[1];
 assert.ok(activeRule,'menu active-state rule is missing');
 assert.doesNotMatch(activeRule,/transform\s*:/,'active-state must not displace a ship node during click');
 const reducedRule=css.match(/@media\(prefers-reduced-motion:reduce\)\s*\{([\s\S]*?)\}\s*\}/)?.[1];
 assert.ok(reducedRule,'reduced-motion settings are missing');
 assert.doesNotMatch(reducedRule,/transform\s*:/,'reduced motion must not displace ship hardpoints');
 assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/menu-system\.css\?v=menus-gameplay-first-3/);
});
