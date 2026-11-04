import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {renderBasePanel} from '../base-panel.js';
import {renderShipHangar} from '../hangar-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';
import {RuntimeHarness} from './runtime-game.mjs';

const base={id:'0:0',x:0,y:0,type:'dock',active:true,discovered:true};
const stationState={ore:84,data:12,hp:110,maxHp:110,shield:30,allies:0,
 activeBases:1,connectedBases:1,connected:true,droneRoles:[],droneDamage:0,charges:0,
 network:{armor:0,engine:0,armament:0,strikePower:0},transfers:[],
 loadout:createLoadout(),skillRanks:{},level:1,points:1,operation:null,time:0};

test('station menus retain real action handlers and make module consequences explicit',()=>{
 const html=renderBasePanel(base,{...stationState,baseTab:'network'});
 assert.match(html,/ВЫЖИВШИЙ \/ ТЕРМИНАЛ СТАНЦИИ/);
 assert.match(html,/station-dock/);
 assert.match(html,/После установки заменить его в этом прохождении нельзя/);
 assert.match(html,/data-act="installModule"/);
 assert.match(html,/aria-selected="true"/);
});

test('irreversible module confirmation requires the matching pending choice, with safe initial focus',()=>{
 const prevDocument=globalThis.document;
 let focused='',alerts=0,removed=0;
 const container={panel:null,querySelector(){return this.panel;},append(panel){this.panel=panel;}};
 const makeElement=tag=>({tag,dataset:{},children:[],attributes:{},textContent:'',
  append(...children){this.children.push(...children);},
  setAttribute(key,value){this.attributes[key]=value;},
  scrollIntoView(){},focus(){focused=this.textContent;},
  remove(){removed++;container.panel=null;}});
 globalThis.document={createElement:makeElement};
 try{
  const game={
   docked:{id:'dock-home',type:'dock',active:true},player:{ore:80},
   overlay:{dataset:{mode:'base'},querySelector(selector){
    if(selector==='.base-modules')return container;
    if(selector==='.base-module-confirm')return container.panel;
    if(selector.includes('data-act="installModule"'))return {focus(){focused='original';}};
    return null;
   }},
   pendingStationModule:null,heritage:{ui(){alerts++;}},notice(){},purchases:[],
   baseAction(act,role){this.purchases.push({act,role});container.panel=null;}
  };
  const runtime=RuntimeHarness.prototype;
  runtime.confirmStationModule.call(game,'workshop');
  assert.equal(alerts,1,'unconfirmed direct action must be rejected');
  runtime.askStationModule.call(game,'workshop');
  assert.equal(focused,'Вернуться к выбору','focus must not jump to irreversible purchase');
  assert.equal(container.panel.attributes.role,'alertdialog');
  assert.equal(container.panel.attributes['aria-modal'],'true');
  assert.equal(game.player.ore,80,'preview cannot spend resources');
  assert.deepEqual(game.pendingStationModule,{baseId:'dock-home',role:'workshop',cost:38});
  assert.equal(container.panel.children[2].children[1].attributes['aria-describedby'],'base-module-confirm-desc');
  assert.equal(runtime.confirmStationModule.call(game,'bulwark'),false,'different role is not authorized');
  assert.equal(game.purchases.length,0);
  assert.equal(runtime.confirmStationModule.call(game,'workshop'),true);
  assert.deepEqual(game.purchases,[{act:'installModule',role:'workshop'}]);
  assert.equal(runtime.confirmStationModule.call(game,'workshop'),false,'stale confirmation cannot repeat purchase');
  runtime.askStationModule.call(game,'workshop');
  runtime.cancelStationModule.call(game,'workshop');
  assert.equal(removed,1);
  assert.equal(focused,'original');
  assert.equal(runtime.confirmStationModule.call(game,'workshop'),false,'cancelled choice cannot be committed');
  assert.equal(game.purchases.length,1);
  game.player.ore=20;
  runtime.askStationModule.call(game,'workshop');
  assert.equal(game.pendingStationModule,null,'unaffordable choice cannot start confirmation');
 }finally{
  if(prevDocument===undefined)delete globalThis.document;
  else globalThis.document=prevDocument;
 }
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

test('unfinished hangar changes are shown on every station tab and never described as saved',()=>{
 const session=new HangarSession(),current=createLoadout();session.begin(current);
 session.draft.slots[0]=null;
 for(const tab of ['summary','operations','hangar','network']){
  const html=renderBasePanel(base,{...stationState,baseTab:tab,loadout:current,hangarSession:session});
  assert.match(html,/В ангаре есть неприменённая сборка/,tab);
  assert.match(html,/В полёт · сборка не применена/,tab);
 }
 const draft=renderShipHangar({...stationState,loadout:current,hangarSession:session},session);
 assert.match(draft,/Схемы оснащения · сохранено 0 из 3/);
 assert.match(draft,/Пустая ячейка/);
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
 assert.match(first,/role="dialog" aria-modal="true" aria-labelledby="map-menu-title"/);
 assert.match(first,/map-mode-map/);
 assert.match(first,/data-act="mapView" data-id="targets"/);
 assert.match(first,/координаты приблизительные/);
 game.mapView='targets';
 assert.match(renderWorldMap(game),/map-mode-targets/);
 const loadout=createLoadout(),session=new HangarSession();session.begin(loadout);
 session.draft.slots[0]=null;
 Object.assign(game,{docked:home,mapReturnToBase:true,shipLoadout:loadout,hangarSession:session});
 assert.match(renderWorldMap(game),/Сборка ангара не применена/);
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
 assert.match(game,/this\.cancelStationModule\(this\.pendingStationModule\.role\)/);
 assert.match(game,/act==='skillBranch'/);
 assert.match(game,/act==='mapView'/);
 assert.match(css,/prefers-reduced-motion/);
});

test('published entry points invalidate the entire changed ES-module import chain',()=>{
 const source=relative=>readFileSync(new URL('../'+relative,import.meta.url),'utf8');
 const game=source('game.js'),base=source('base-panel.js');
 const preview=source('hangar-preview.js');
 assert.match(source('index.html'),/game\.js\?v=[^"']*living-world-1/);
 assert.match(game,/base-panel\.js\?v=first-contract-reward-1/);
 assert.match(game,/first-contract-reward\.js\?v=first-contract-reward-1/);
 assert.match(game,/ship-loadout\.js\?v=first-contract-reward-1/);
 assert.match(game,/run-checkpoint\.js\?v=[^"']*living-world-1/);
 assert.match(game,/sortie-economy\.js\?v=economy-integrity-1-econ-audit-2/);
 assert.match(game,/sortie-ledger\.js\?v=economy-ledger-1/);
 assert.match(base,/sortie-economy\.js\?v=economy-integrity-1-econ-audit-2/);
 assert.match(game,/map-panel\.js\?v=menu-exit-1/);
 assert.match(base,/hangar-panel\.js\?v=first-contract-reward-1/);
 assert.match(base,/map-panel\.js\?v=menu-exit-1/);
 assert.match(source('hangar-preview.html'),/hangar-preview\.js\?v=menu-exit-1/);
 assert.match(preview,/hangar-panel\.js\?v=menu-exit-1/);
});

test('active menu controls never override positioning transforms used by ship hardpoints',()=>{
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 const activeRule=css.match(/#overlay \.dialog button:not\(:disabled\):active\s*\{([^}]*)\}/)?.[1];
 assert.ok(activeRule,'menu active-state rule is missing');
 assert.doesNotMatch(activeRule,/transform\s*:/,'active-state must not displace a ship node during click');
 const reducedRule=css.match(/@media\(prefers-reduced-motion:reduce\)\s*\{([\s\S]*?)\}\s*\}/)?.[1];
 assert.ok(reducedRule,'reduced-motion settings are missing');
 assert.doesNotMatch(reducedRule,/transform\s*:/,'reduced motion must not displace ship hardpoints');
 assert.match(css,/\.base-foot\s*\{position:sticky;bottom:0/,'station return action must stay visible while panels scroll');
 assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/menu-system\.css\?v=first-contract-reward-1/);
});

test('landscape phone layout reserves notches and exposes navigation without three desktop columns',()=>{
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 const compact=css.slice(css.indexOf('@media(max-height:580px) and (max-width:980px)'),
  css.indexOf('@media(max-width:480px) and (min-height:581px)'));
 assert.match(compact,/env\(safe-area-inset-left\)/);
 assert.match(compact,/env\(safe-area-inset-right\)/);
 assert.match(compact,/#overlay \.base-dialog,#overlay \.map-dialog,#overlay \.skill-dialog\s*\{[^}]*width:100%;min-width:0;max-width:100%/);
 assert.match(compact,/\.map-view-switch\{display:grid/);
 assert.match(compact,/\.skill-branch-tabs\{display:grid/);
 const coarse=css.slice(css.indexOf('@media(pointer:coarse) and (max-height:580px)'));
 assert.match(coarse,/\.hg-layout\{display:block/);
 assert.match(coarse,/\.hg-mobile-only\{display:inline-block!important/);
 assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),
  /menu-system\.css\?v=first-contract-reward-1/);
 assert.match(compact, /\.base-tabs\{position:sticky/);
 assert.match(compact, /\.hg-apply-bar\{position:sticky;top:51px/);
});
