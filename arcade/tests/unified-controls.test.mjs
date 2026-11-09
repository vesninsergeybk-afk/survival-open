import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONTROL_ACTIONS,DEFAULT_CONTROLS,CONTROL_STORAGE_KEY,validControls,readControls,
 changeControl,readableKey,isPressed,isMapShortcut,isMapCloseShortcut} from '../control-layout.js';
import {manualWeapons,selectedManual,cycleManual,manualClick,pointerWeaponAction} from '../manual-weapon-controls.js';
import {planHowitzer} from '../ship-weapons.js';
import {game} from './weapons-scene.mjs';
import {precisionRailUnlocked} from '../station-progression.js';
import {mapKeysLabel,mapCloseKeysLabel} from '../map-panel.js';

test('new bindings are complete, one-action-per-key and survive storage',()=>{
 assert.equal(validControls(DEFAULT_CONTROLS),true);
 assert.equal(new Set(CONTROL_ACTIONS.map(x=>x.code)).size,CONTROL_ACTIONS.length);
 const move=changeControl(DEFAULT_CONTROLS,'dash','KeyV');
 assert.equal(move.ok,true);
 assert.equal(isPressed(new Set(['KeyV']),move.bindings,'dash'),true);
 assert.equal(isPressed(new Set(['KeyV']),DEFAULT_CONTROLS,'dash'),false);
 const store={getItem(key){assert.equal(key,CONTROL_STORAGE_KEY);return JSON.stringify(move.bindings);}};
 assert.deepEqual(readControls(store),move.bindings);
 assert.equal(readableKey('Space'),'Пробел');
});

test('a duplicate, unsafe or malformed key mapping cannot silently break movement',()=>{
 assert.equal(changeControl(DEFAULT_CONTROLS,'dash','KeyW').ok,false);
 assert.equal(changeControl(DEFAULT_CONTROLS,'dash','Escape').ok,false);
 assert.equal(changeControl(DEFAULT_CONTROLS,'dash','F5').ok,false);
 assert.deepEqual(readControls({getItem:()=>'{invalid'}),DEFAULT_CONTROLS);
 assert.deepEqual(readControls({getItem:()=>JSON.stringify({...DEFAULT_CONTROLS,up:'KeyS'})}),DEFAULT_CONTROLS);
});
test('Tab and M show the map, arrows remain movement aliases, and customized keys keep priority',()=>{
 assert.ok(isMapShortcut('Tab',DEFAULT_CONTROLS));
 assert.ok(isMapShortcut('KeyM',DEFAULT_CONTROLS));
 assert.ok(!isMapShortcut('KeyD',DEFAULT_CONTROLS));
 assert.ok(isMapShortcut('KeyM',{...DEFAULT_CONTROLS,map:'KeyN'}));
 const custom=changeControl(DEFAULT_CONTROLS,'dash','KeyM');
 assert.equal(custom.ok,true);
 assert.ok(!isMapShortcut('KeyM',custom.bindings),'M is not stolen from a remapped dash');
 assert.ok(isMapShortcut('Tab',custom.bindings));
 const withTab=changeControl({...DEFAULT_CONTROLS,map:'KeyN'},'dash','Tab');
 assert.equal(withTab.ok,true);
 assert.ok(!isMapShortcut('Tab',withTab.bindings),'Tab is not stolen from a remapped dash');
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 for(const arrow of ['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'])
  assert.ok(source.includes(`this.keys.has('${arrow}')`),arrow+' must remain an actual movement alias');
 assert.match(source,/if\(isMapShortcut\(e\.code,this\.controls\)\)this\.openMap\(\)/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/WASD \/ стрелки — полёт/);
 assert.match(html,/Tab \/ M — карта/);
 assert.equal(mapKeysLabel(DEFAULT_CONTROLS),'Tab / M');
 assert.equal(mapKeysLabel(custom.bindings),'Tab','custom M binding must remove M from the footer');
 assert.equal(mapKeysLabel({...DEFAULT_CONTROLS,map:'KeyN'}),'N / Tab / M');
 assert.ok(isMapCloseShortcut('KeyM',DEFAULT_CONTROLS));
 assert.ok(!isMapCloseShortcut('Tab',DEFAULT_CONTROLS),
  'Tab must remain free for keyboard navigation across the open interactive map');
 assert.ok(!isMapCloseShortcut('KeyM',custom.bindings));
 assert.ok(isMapCloseShortcut('KeyN',{...DEFAULT_CONTROLS,map:'KeyN'}));
 assert.equal(mapCloseKeysLabel(DEFAULT_CONTROLS),'M / Esc');
 assert.equal(mapCloseKeysLabel(custom.bindings),'Esc');
 assert.equal(mapCloseKeysLabel({...DEFAULT_CONTROLS,map:'KeyN'}),'N / M / Esc');
 assert.match(source,/this\.overlay\.dataset\.mode==='map'.*?isMapCloseShortcut\(e\.code,this\.controls\)/s);
});

test('RMB fires the selected manual weapon; LMB only marks a priority target',()=>{
 const mouse=(button,extras={})=>({button,pointerType:'mouse',ctrlKey:false,altKey:false,metaKey:false,...extras});
 assert.deepEqual(pointerWeaponAction(mouse(0),'comet'),{kind:null,mark:false});
 assert.deepEqual(pointerWeaponAction(mouse(2),'comet'),{kind:'comet',mark:false});
 assert.deepEqual(pointerWeaponAction(mouse(2),'mines'),{kind:'mines',mark:false});
 assert.deepEqual(pointerWeaponAction(mouse(2),'rail'),{kind:'rail',mark:false});
 assert.deepEqual(pointerWeaponAction(mouse(2),'howitzer'),{kind:'howitzer',mark:false});
 assert.deepEqual(pointerWeaponAction(mouse(0,{ctrlKey:true}),'comet'),{kind:null,mark:true});
 assert.deepEqual(pointerWeaponAction(mouse(0,{ctrlKey:true}),'rail'),{kind:null,mark:true});
 assert.deepEqual(pointerWeaponAction(mouse(0,{ctrlKey:true,altKey:true}),'comet'),{kind:null,mark:false});
 assert.deepEqual(pointerWeaponAction({button:0,pointerType:'touch',ctrlKey:false},'comet',true),
  {kind:'mines',mark:false},'touch mine selection is not replaced by desktop marking');
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(source,/if\(mark\)\{if\(!held&&moved<=14\)this\.designateTargetAt\(worldPoint\);return;\}/);
 assert.match(source,/Для метки нет цели\. Наведите курсор на противника и нажмите Ctrl \+ ЛКМ\./);
 assert.doesNotMatch(source,/Рядом нет цели\. Паразит отмечает врага/,
  'a missed optional priority click should not imply that a parasite ability was activated');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/Приоритетная цель \(без выстрела\)/);
});

test('four manual modes have a stable wheel order and separate selection',()=>{
 const both=manualWeapons({rail:true,howitzer:true},true);
 assert.deepEqual(both,['comet','mines','rail','howitzer']);
 assert.deepEqual(manualWeapons({rail:true,howitzer:true},false),['comet','mines','howitzer']);
 assert.equal(selectedManual('missing',both),'comet');
 assert.equal(cycleManual('rail',both,1),'howitzer');
 assert.equal(cycleManual('howitzer',both,1),'comet');
 assert.equal(cycleManual('rail',both,-1),'mines');
 assert.equal(manualClick('rail',true),'rail');
 assert.equal(manualClick('rail',false),'rail');
 assert.equal(manualClick('rail',false,true),'designate');
 assert.equal(manualClick('howitzer',true),'howitzer');
 assert.equal(manualClick('howitzer',false,true),'designate','touch target selection remains available with heavy weapon installed');
 assert.equal(manualClick('rail',true,true),'rail','explicit touch precision mode still fires the rail');
 assert.equal(manualClick('comet',false),'comet');
 assert.equal(manualClick('mines',false),'mines');
 assert.equal(manualClick('comet',false,true),'comet');
 assert.equal(manualClick(null,false),'designate');
});

test('flight status explains Space once and keeps the two mouse cooldowns separate',()=>{
 const g=game(),originalDocument=globalThis.document;
 const status={textContent:'',hidden:false,setAttribute(name,value){this[name]=value;}};
 globalThis.document={getElementById:id=>id==='fieldWeaponStatus'?status:null};
 try{
  g.mouseArsenal={cometReadyAt:g.time+3,minesReadyAt:g.time+8,projectiles:[],mines:[],bursts:[]};
  g.syncControlUI();
  assert.match(status.textContent,/ПКМ · КОМЕТА · 3 с/);
  g.selectedManualWeapon='mines';g.syncControlUI();
  assert.match(status.textContent,/ПКМ · МИНЫ · 8 с/);
  assert.equal((status.textContent.match(/Пробел/g)||[]).length,1);
 }finally{
  if(originalDocument===undefined)delete globalThis.document;
  else globalThis.document=originalDocument;
 }
});

test('manual howitzer really aims at mouse point, while F keeps its automatic target',()=>{
 const g=game();g.weaponProfile.howitzer=true;
 const aimed=planHowitzer(g,{x:215,y:120});
 assert.equal(aimed.ok,true);
 assert.equal(aimed.charge.x,215);
 assert.equal(aimed.charge.y,120);
 assert.equal(planHowitzer(g,{x:901,y:0}).ok,false);
 assert.equal(planHowitzer(g,{x:NaN,y:0}).ok,false);
 assert.equal(planHowitzer(g).ok,false,'F still requires a hostile target');
});

test('actual game selection keeps manual rail and howitzer separate from automatic mounts',()=>{
 const g=game(['rail','plasma',null,null,null,'howitzer']);
 const arsenal={id:'1:0',type:'arsenal',x:100,y:0,enemy:false,active:true,discovered:true};
 g.world.stations.set(arsenal.id,arsenal);
 assert.equal(precisionRailUnlocked(g.world),true);
 g.syncManualWeaponSelection();
 assert.equal(g.selectedManualWeapon,'comet','ordinary play defaults to the broad comet attack');
 assert.equal(g.manualRailMode,false,'installing the rail must preserve automatic fire');
 assert.equal(g.switchManualWeapon(),true);
 assert.equal(g.selectedManualWeapon,'mines');
 assert.equal(g.switchManualWeapon(),true);
 assert.equal(g.selectedManualWeapon,'rail');
 assert.equal(g.manualRailMode,false);
 assert.ok(g.weaponProfile.plasma);
 assert.equal(g.switchManualWeapon(),true);
 assert.equal(g.selectedManualWeapon,'howitzer');
 assert.equal(g.switchManualWeapon(),true);
 assert.equal(g.selectedManualWeapon,'comet');
 assert.equal(g.switchManualWeapon(),true);
 assert.equal(g.selectedManualWeapon,'mines');
 assert.equal(g.switchManualWeapon(),true);
 assert.equal(g.selectedManualWeapon,'rail');
 assert.equal(g.manualRailMode,false,'returning to rail does not disable automatic fire before a manual shot');
 assert.equal(g.fireSelectedManualAt({x:190,y:30}),true);
 assert.equal(g.manualRailMode,true,'a deliberate desktop RMB shot enters precision control');
 assert.equal(g.railSweep?.until-g.railSweep?.startedAt,5);
 g.syncManualWeaponSelection();
 assert.equal(g.manualRailMode,true,'normal loadout refresh does not erase the deliberate mode choice');
});

test('the published UI offers mouse release attacks and separates everyday from advanced controls',()=>{
 const gameText=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(gameText,/this\.fireSelectedManualAt\(worldPoint\)/);
 assert.match(gameText,/this\.designateTargetAt\(point\)/);
 assert.match(gameText,/this\.switchManualWeapon\(e\.deltaY>0\?1:-1\)/);
 assert.match(gameText,/pointerWeaponAction\(e,weapon,this\.mobileMineArmed\)/);
 assert.match(gameText,/if\(kind==='comet'\|\|kind==='mines'\)this\.fireActiveMouseWeapon\(kind,worldPoint\)/);
 assert.match(gameText,/this\.mouseAim=null/);
 assert.match(html,/id="minefieldBtn"/);
 assert.match(html,/Дополнительные команды/);
 assert.match(html,/id="controlsBindingList"/);
 assert.ok(html.indexOf('id="controlsBindingMessage"')<html.indexOf('id="controlsBindingList"'),
  'conflict feedback must be visible above the long list, without scrolling');
 assert.match(html,/id="controlsReset"/);
 assert.match(gameText,/this\.recordStorage\?\.setItem\(CONTROL_STORAGE_KEY/);
 assert.match(gameText,/list\.querySelector\('\[data-bind=/,
  'the remapped button must regain focus after rebuilding the list');
});
