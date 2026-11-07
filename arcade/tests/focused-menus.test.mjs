import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {createLoadout,HangarSession} from '../ship-loadout.js';
import {createTactical,tacticalSpec} from '../tactical-fields.js';
import {renderShipHangar} from '../hangar-panel.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {focusContourRegion,contourConnectionChoices,contourRegionNodes} from '../contour-preview.js';
import {createContours} from '../territory-system.js';
import {REGIONS} from '../regions.js';
import {menuHints} from '../menu-hints.js';

function dockedGame(){
 const g=game();g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 g.paused=true;g.baseTab='hangar';g.hangarView='weapons';g.overlay.hidden=false;
 g.tactical=createTactical();g.skillRanks.rocket=0;
 return g;
}

test('inspecting a fitting quotes the full price without spending, and the explicit action charges exactly once',()=>{
 const g=dockedGame();g.player.level=3;g.player.ore=40;
 g.hangarAction({act:'hgSlot',id:'1'});
 const before=JSON.stringify(g.shipLoadout);
 g.hangarAction({act:'hgFocusWeapon',id:'rail'});
 assert.equal(JSON.stringify(g.shipLoadout),before);assert.equal(g.player.ore,40);
 const html=renderShipHangar(g.baseState(),g.hangarSession);
 assert.doesNotMatch(html,/class="hg-ship"/,'fitting must not reintroduce the third ship column');
 assert.match(html,/aria-label="Узлы корабля"/);
 assert.equal((html.match(/data-act="hgEquip"/g)||[]).length,1);
 assert.match(html,/Купить и установить · 36 сплава/);
 assert.match(html,/Сплав спишется при нажатии кнопки. Останется 4 сплава/);
 assert.doesNotMatch(html,/Выбор оружия сразу устанавливает/);
 g.hangarAction({act:'hgEquip',id:'rail'});
 assert.equal(g.shipLoadout.slots[1],'rail');assert.equal(g.player.ore,4);
 g.hangarAction({act:'hgEquip',id:'rail'});assert.equal(g.player.ore,4);
});

test('an unaffordable fitting retains its real price and explains the shortage',()=>{
 const g=dockedGame();g.player.level=3;g.player.ore=5;
 g.hangarAction({act:'hgSlot',id:'1'});g.hangarAction({act:'hgFocusWeapon',id:'rail'});
 const html=renderShipHangar(g.baseState(),g.hangarSession);
 assert.match(html,/data-act="hgEquip" data-id="rail" disabled>Купить и установить · 36 сплава/);
 assert.match(html,/Не хватает 31/);
 g.hangarAction({act:'hgEquip',id:'rail'});
 assert.equal(g.shipLoadout.slots[1],null);assert.equal(g.player.ore,5);
});

test('filtering a fitting selects a matching item without changing a loaded blueprint',()=>{
 const loadout=createLoadout(),session=new HangarSession();session.begin(loadout);
 session.draft.slots[1]='rail';const before=JSON.stringify(session.draft);
 session.dispatch({act:'hgSlot',id:'1'},{loadout});
 session.dispatch({act:'hgFilter',id:'manual'},{loadout});
 assert.equal(session.focusWeapon,'ion');assert.equal(JSON.stringify(session.draft),before);
 const html=renderShipHangar({loadout,level:3,ore:100,baseActive:true},session);
 assert.match(html,/Сначала примените или отмените загруженную схему/);
});

test('tactical inspection shows only the chosen branches and preserves equipment, currency and an unfinished blueprint',()=>{
 const g=dockedGame();g.hangarView='tactics';g.hangarSession.draft.slots[1]='rail';
 const before=JSON.stringify(g.tactical),money=g.player.ore,draft=JSON.stringify(g.hangarSession.draft);
 g.hangarAction({act:'hgFocusTactic',id:'jam'});
 assert.equal(JSON.stringify(g.tactical),before);assert.equal(g.player.ore,money);
 assert.equal(JSON.stringify(g.hangarSession.draft),draft);
 const html=renderShipHangar({...g.baseState(),developmentMode:true,developmentCategory:'tactics'},g.hangarSession);
 assert.equal((html.match(/data-act="hgFocusTactic"/g)||[]).length,4);
 assert.match(html,/Устройство пока не получено/);
 assert.match(html,/data-act="hgTacticUnlock" data-id="jam"/);
 assert.doesNotMatch(html,/data-act="hgTacticUpgrade"/,'an unowned device cannot open a purchasable branch');
 assert.doesNotMatch(html,/Защитная оболочка|Сборщик патрулей/);
 assert.match(html,/Сейчас установлено: <b>Импульс<\/b>/);
 g.hangarAction({act:'hgFocusTactic',id:'fabricated'});assert.equal(g.hangarSession.focusTactic,'jam');
});

test('a tactical shortcut opens the specified device without buying or discarding a draft',()=>{
 const g=dockedGame();g.baseTab='development';g.hangarSession.draft.slots[1]='rail';
 const snapshot=JSON.stringify(g.hangarSession.draft),tactical=JSON.stringify(g.tactical),ore=g.player.ore;
 g.openDevelopment('tactics','jam');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarView,'tactics');
 assert.equal(g.hangarSession.focusTactic,'jam');
 assert.equal(JSON.stringify(g.tactical),tactical);assert.equal(g.player.ore,ore);
 assert.equal(JSON.stringify(g.hangarSession.draft),snapshot);
 g.openDevelopment('tactics','fabricated');assert.equal(g.hangarSession.focusTactic,'jam');
});

test('owned tactical equipment can be upgraded or installed on the same page',()=>{
 const g=dockedGame();g.tactical.owned.push('decoy');g.hangarSession.focusTactic='decoy';
 const html=renderShipHangar({...g.baseState(),developmentMode:true,developmentCategory:'tactics'},g.hangarSession);
 assert.match(html,/Получено · сейчас установлено другое устройство/);
 assert.match(html,/data-act="hgTacticUpgrade" data-id="decoy:lure"/);
 assert.match(html,/data-act="hgTacticEquip" data-id="decoy"/);
 assert.match(html,/Радиус: 590 → 700 м/);
 assert.doesNotMatch(html,/data-act="hgTacticUnlock"/);
});

test('the tactical cooldown describes the selected upgraded device, including when another device is equipped',()=>{
 const g=dockedGame();g.hangarView='tactics';
 g.tactical.owned.push('decoy');g.tactical.equipped='decoy';
 g.tactical.branches.pulse={path:'shell',rank:1};
 g.hangarSession.focusTactic='pulse';
 const html=renderShipHangar(g.baseState(),g.hangarSession);
 assert.match(html,new RegExp('перезарядка '+tacticalSpec({...g.tactical,equipped:'pulse'}).cooldown+' с'));
});

test('hull and frame show the requirements without unrelated weapon technologies',()=>{
 const g=dockedGame();g.player.level=1;g.player.points=0;g.hangarView='upgrades';
 const html=renderShipHangar(g.baseState(),g.hangarSession);
 assert.match(html,/Свободные очки: 0/);
 assert.match(html,/Укрепление корпуса/);
 assert.match(html,/data-id="hull" disabled>Изучить · 1 очко<\/button>[^]*?Нужен уровень 2/);
 assert.doesNotMatch(html,/Калибровка орудий|Авторакеты|Разделение луча/);
 assert.match(html,/Оружейные узлы/);
 g.player.level=3;g.player.points=1;
 const available=renderShipHangar(g.baseState(),g.hangarSession);
 for(const id of ['hull','engine'])assert.match(available,new RegExp('data-id="'+id+'">Изучить · 1 очко'));
});

test('region entry immediately suggests a legal starting station without building lines or revealing contacts',()=>{
 const g=dockedGame(),world=g.world;
 const before=JSON.stringify(world.contours),known=[...world.discovered],ore=g.player.ore;
 const source=focusContourRegion(g,'amethyst');
 assert.equal(source.id,world.home.id);assert.equal(g.contourFirst,null);
 assert.equal(g.contourSelection,world.home.id);
 assert.equal(JSON.stringify(world.contours),before);assert.deepEqual([...world.discovered],known);assert.equal(g.player.ore,ore);
 const nodes=contourRegionNodes(world,REGIONS[0]),choices=contourConnectionChoices(world,source.id,nodes);
 assert.ok(choices.next.length);
 g.mapView='territory';const html=renderWorldMap(g);
 assert.match(html,/Пока рядом нет подходящей работающей опоры/);assert.match(html,/Отметить маршрут к станции/);
 assert.doesNotMatch(html,/aria-label="Неизвестный узел, вражеская станция"/);
 focusContourRegion(g,'all');assert.equal(g.contourFirst,null);
});

test('automatic suggestions prefer closing a real field, exclude suppressed sources, and construct nothing',()=>{
 const stations=new Map([
  ['a',{id:'a',x:0,y:0,active:true}],['b',{id:'b',x:1000,y:0,active:true}],
  ['c',{id:'c',x:0,y:1000,active:true}],['s',{id:'s',x:20,y:20,active:true,suppressed:true}]
 ]);
 const world={stations,contours:{...createContours(),links:[['a','b'],['b','c']]},nearbyStations:()=>[...stations.values()]};
 const g={world,player:{x:0,y:0}};
 assert.equal(focusContourRegion(g,'amethyst').id,'a');
 assert.equal(world.contours.links.length,2);assert.equal(world.contours.flux,0);
 assert.notEqual(focusContourRegion(g,'amethyst','s').id,'s');
});

test('station functions explain automatic service radio and automatic territorial links separately',()=>{
 const g=dockedGame(),html=renderBasePanel(g.docked,{...g.baseState(),baseTab:'network'}).split('id="base-panel-network"')[1];
 assert.match(html,/Контурные линии появляются сами/);
 assert.match(html,/Линий у станции <b>0<\/b>/);
 assert.match(html,/data-act="baseContours">Открыть контуры этой станции/);
 assert.ok(html.indexOf('Связь и территория')<html.indexOf('Технология всего флота'));
 assert.ok(html.indexOf('Технология всего флота')<html.indexOf('ОБОРОНА СТАНЦИИ'));
 assert.match(html,/Технология всего флота/);
 assert.match(html,/Местный модуль · выбор для этой станции/);
});

test('the map lists destinations without suggesting a count of active missions',()=>{
 const g=dockedGame();g.mapView='targets';
 const html=renderWorldMap(g);
 assert.match(html,/data-id="targets" aria-pressed="true"[^>]*>[\s\S]*?Цели<\/button>/);
 assert.doesNotMatch(html,/Цели · \d+/);
});

test('touch information opens on one tap, stays open until dismissed, and never propagates as a purchase',()=>{
 const previous=globalThis.document,listeners={},attributes=new Map();let popup=null;
 const node={dataset:{help:'Полное описание'},getBoundingClientRect:()=>({left:24,top:36,bottom:80}),
  setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
 const root={addEventListener:(name,fn)=>listeners[name]=fn,append(p){popup=p;p.isConnected=true;}};
 globalThis.document={documentElement:{clientWidth:412,clientHeight:915},createElement:()=>({style:{},
  setAttribute(){},getBoundingClientRect:()=>({width:300,height:150}),addEventListener(){},remove(){this.isConnected=false;popup=null;}})};
 const e={target:{closest:selector=>selector==='.menu-hint-popup'?null:node},
  preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
 try{
  menuHints(root);listeners.pointerover({...e,pointerType:'touch'});assert.equal(popup,null);
  listeners.click(e);assert.ok(popup?.isConnected);assert.ok(e.prevented&&e.stopped);assert.ok(attributes.has('aria-describedby'));
  listeners.pointerout(e);assert.ok(popup?.isConnected,'touch explanations must not disappear on pointerout');
  listeners.click(e);assert.equal(popup,null);assert.equal(attributes.has('aria-describedby'),false);
  listeners.click(e);listeners.keydown({...e,key:'Escape'});assert.equal(popup,null);
 }finally{globalThis.document=previous;}
});
