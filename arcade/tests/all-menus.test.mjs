import test from 'node:test';
import assert from 'node:assert/strict';
import {openSystemMenu,closeSystemMenu,restoreSystemMenu,mountSystemMenu} from '../game-menu.js';
import {renderOpeningHardware,renderOpeningSignals,renderContinuation,renderDeathScreen} from '../menu-screens.js';
import {renderPilotMenu} from '../pilot-menu.js';
import {createLoadout} from '../ship-loadout.js';
import {renderWorldMap} from '../map-panel.js';
import {DEFAULT_CONTROLS} from '../control-layout.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {World} from '../world.js';
function nativeScene(mode='',paused=false){
 const nodes=new Map(),events={};
 const node=id=>({id,open:false,isConnected:true,dataset:{},setAttribute(k,v){this[k]=v;},getAttribute(k){return this[k];},focus(){doc.activeElement=this;},
  addEventListener(type,fn){(events[id+':'+type]||=[]).push(fn);},showModal(){this.open=true;},close(){this.open=false;}});
 for(const id of ['gameMenuDialog','controlSettings','systemMap','systemSkills','systemResume','systemClose','menuBtn'])nodes.set(id,node(id));
 const doc={activeElement:null,getElementById:id=>nodes.get(id),querySelectorAll:()=>[],querySelector:()=>null};
 const prior=node('prior');doc.activeElement=prior;
 const calls=[],loadout=createLoadout(),draft={slots:[...loadout.slots]};
 const game={paused,dead:false,controls:{...DEFAULT_CONTROLS},overlay:{hidden:!mode,dataset:{mode},innerHTML:'station contents'},
  shipLoadout:loadout,hangarSession:draft,keys:new Set(['KeyW']),endInteraction(){calls.push('end');},
  heritage:{modal:mode,pause(s){calls.push('pause:'+s);},resume(){calls.push('resume');}}};
 return {doc,game,nodes,calls,prior,events};
}
test('pause menu resumes flight once and restores focus without changing equipment',()=>{
 const {doc,game,nodes,calls,prior}=nativeScene(),before=JSON.stringify(game.shipLoadout);
 assert.ok(openSystemMenu(game,doc));assert.equal(game.paused,true);assert.equal(game.keys.size,0);
 assert.equal(nodes.get('gameMenuDialog').open,true);assert.equal(openSystemMenu(game,doc),false);
 assert.ok(closeSystemMenu(game,doc));assert.equal(game.paused,false);assert.equal(doc.activeElement,prior);
 assert.equal(restoreSystemMenu(game,doc),false);assert.equal(calls.filter(x=>x==='resume').length,1);
 assert.equal(JSON.stringify(game.shipLoadout),before);
});
test('settings preserve the docked screen and draft and leave its world paused',()=>{
 const {doc,game,calls}=nativeScene('base',true),draft=game.hangarSession;
 openSystemMenu(game,doc);closeSystemMenu(game,doc);
 assert.equal(game.paused,true);assert.equal(game.overlay.innerHTML,'station contents');
 assert.equal(game.hangarSession,draft);assert.equal(game.overlay.dataset.mode,'base');
 assert.equal(calls.at(-1),'pause:base');assert.ok(!calls.includes('resume'));
});
test('menus do not allow map or skill navigation during a run choice or death',()=>{
 for(const mode of ['run-start','opening-choice','opening-reward','death']){
  const {doc,game,nodes}=nativeScene(mode,true);game.dead=mode==='death';openSystemMenu(game,doc);
  assert.ok(nodes.get('systemMap').disabled);assert.ok(nodes.get('systemSkills').disabled);closeSystemMenu(game,doc);
 }
});
test('system navigation from a station retains the draft and active docking session',()=>{
 const {doc,game,events}=nativeScene('base',true),draft=game.hangarSession;
 game.stationExitArmed=true;game.openMap=()=>{game.overlay.dataset.mode='map';game.mapReturnToBase=true;};
 mountSystemMenu(game,doc);openSystemMenu(game,doc);events['systemMap:click'][0]();
 assert.equal(game.overlay.dataset.mode,'map');assert.equal(game.paused,true);
 assert.equal(game.hangarSession,draft);assert.equal(game.stationExitArmed,true);
});
test('return to station does not commit or discard the existing ship draft',()=>{
 const g=Object.create(RuntimeHarness.prototype),draft={pending:'blueprint'};
 Object.assign(g,{docked:{id:'home'},stationExitArmed:true,mapReturnToBase:true,hangarSession:draft,
  overlay:{hidden:false,dataset:{mode:'skills'}},heritage:{pause(){}},renderDock(){this.rendered=true;}});
 assert.ok(g.returnToStation());assert.equal(g.overlay.dataset.mode,'base');assert.equal(g.mapReturnToBase,false);
 assert.equal(g.hangarSession,draft);assert.ok(g.rendered);
 g.stationExitArmed=false;g.overlay.dataset.mode='skills';assert.equal(g.returnToStation(),false);
 assert.equal(g.overlay.dataset.mode,'skills');
});
test('new-run confirmation can be cancelled without clearing the checkpoint or calling storage',()=>{
 const g=Object.create(RuntimeHarness.prototype),dialog={inert:false,querySelector:()=>null,querySelectorAll:()=>[],hasAttribute:()=>true,focus(){}},save={id:'checkpoint'};
 let confirm=null,writes=0;
 g.overlay={hidden:false,dataset:{mode:'run-start'},querySelector(selector){return selector==='.dialog'?dialog:selector==='.run-confirm'?confirm:null;},
  insertAdjacentHTML(where,html){assert.match(html,/role="alertdialog"/);confirm={querySelector:()=>null,querySelectorAll:()=>[],hasAttribute:()=>true,focus(){},remove(){confirm=null;}};}};
 g.pendingCheckpoint=save;g.runStore={startNew(){writes++;},end(){writes++;}};
 assert.ok(g.requestRunAction('runNew'));assert.equal(dialog.inert,true);assert.equal(g.pendingCheckpoint,save);
 assert.equal(g.requestRunAction('runNew'),false);g.cancelRunAction();
 assert.equal(dialog.inert,false);assert.equal(confirm,null);assert.equal(writes,0);assert.equal(g.pendingCheckpoint,save);
});
test('reward screen accurately distinguishes fitting a gun from storing it',()=>{
 const free=createLoadout();assert.match(renderOpeningHardware(free),/Получить и установить/);
 free.slots=free.slots.map(()=> 'plasma');const full=renderOpeningHardware(free);
 assert.match(full,/Получить на склад/);assert.doesNotMatch(full,/Получить и установить/);
 const signals=renderOpeningSignals('G');assert.match(signals,/Удерживайте G/);assert.match(signals,/155 с игрового времени/);
});
test('pilot screen limits cards to the selected branch and exposes prerequisites and prices',()=>{
 const skills=[{id:'radar',branch:'Технологии',title:'Радар',desc:'Обнаруживает станции',from:3,max:2},
  {id:'tactics',branch:'Технологии',title:'Тактика',desc:'Ускоряет решения',from:4,max:2,requires:'radar'},
  {id:'mining',branch:'Добыча',title:'Горняк',desc:'Добывает',from:1,max:2}];
 const args={player:{level:4,points:1,xp:100},ranks:{},skills,doctrines:[],branch:'Технологии',nextEffect:()=>'+100 м',nextXp:150,atStation:true};
 const html=renderPilotMenu(args);assert.match(html,/data-act="skill" data-id="radar">Изучить · 1 очко/);
 assert.match(html,/Сначала Радар/);assert.match(html,/data-help="Обнаруживает станции"/);
 assert.doesNotMatch(html,/data-act="skill" data-id="mining"/);assert.match(html,/data-act="pilotHangar"/);
});
test('local map puts destinations above optional reports and displays remapped controls',()=>{
 const world=new World(20261102);world.home.discovered=true;world.home.active=true;world.discovered.add(world.home.id);
 const game={world,player:{x:0,y:0},time:0,skillRanks:{},enemyBasesUnlocked:()=>false,mapView:'targets',controls:{...DEFAULT_CONTROLS,map:'KeyG',skills:'KeyJ'}};
 const html=renderWorldMap(game);
 assert.ok(html.indexOf('Обнаруженные станции')<html.indexOf('<details class="map-world-details">'));
 assert.match(html,/G — карта · J — развитие/);assert.doesNotMatch(html,/Tab или M/);
});
test('flight Escape consumes the native cancel action before opening the pause dialog',()=>{
 const {doc,game,nodes}=nativeScene(),priorDoc=globalThis.document,priorWindow=globalThis.window;
 const fallback={hidden:true,open:false,style:{},addEventListener(){}},listeners={};
 const get=doc.getElementById;doc.getElementById=id=>id==='creditsDialog'?null:get(id)||fallback;
 doc.addEventListener=(type,fn)=>(listeners[type]||=[]).push(fn);
 game.overlay.addEventListener=()=>{};game.bindControlSettings=()=>{};
 let prevented=false;
 nodes.get('gameMenuDialog').showModal=function(){assert.equal(prevented,true);this.open=true;};
 globalThis.document=doc;globalThis.window={addEventListener(){}};
 try{
  RuntimeHarness.prototype.bind.call(game);
  const key={code:'Escape',key:'Escape',repeat:false,target:{closest:()=>null},preventDefault(){prevented=true;}};
  for(const fn of listeners.keydown)fn(key);
  assert.ok(nodes.get('gameMenuDialog').open);assert.ok(game.paused);
 }finally{globalThis.document=priorDoc;globalThis.window=priorWindow;}
});
