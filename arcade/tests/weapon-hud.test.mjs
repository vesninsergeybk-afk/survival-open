import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {existsSync} from 'node:fs';
import {game} from './weapons-scene.mjs';
import {createFieldLoan,fieldReady} from '../field-weapons.js';
import {moduleStats} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';
import {weaponDeckState} from '../weapon-hud.js';
import {CockpitDisplay} from '../hud.js';

const find=(state,id)=>state.rows.find(row=>row.id===id);

test('flight deck shows every equipped automatic module, with real damage, range, cycle and heat',()=>{
 const g=game();g.shipLoadout.slots=['plasma','plasma','rail','rocket',null,null];
 g.syncShipLoadout();g.skillRanks.beam=2;g.skillRanks.range=1;
 g.weaponThermal.current=73;g.beamClock=.45;g.rocketClock=2.5;
 const state=weaponDeckState(g),plasma=find(state,'plasma'),rail=find(state,'rail');
 assert.equal(state.autoCount,4);
 assert.match(state.quick.auto.name,/ПЛАЗМА ×2 \[1, 2\]/);
 assert.match(state.quick.auto.name,/РАКЕТ/);
 assert.match(state.quick.auto.status,/ПЛАЗМА:/);
 assert.equal(state.quick.manual.key,'ПКМ');
 assert.match(state.compact,/АВТО.*ПКМ.*ПРОБЕЛ/);
 assert.match(plasma.name,/×2/);assert.match(plasma.detail,/Урон вблизи/);
 assert.ok(plasma.detail.includes(String(moduleStats('plasma',g.skillRanks).range)));
 assert.equal(plasma.status,'0,5 с');
 assert.match(rail.detail,/700 м/);assert.equal(rail.status,'ГОТОВО');
 assert.equal(find(state,'rocket').status,'2,5 с');
 assert.equal(state.heatPercent,73);
 assert.equal(find(state,'flak'),undefined,'uninstalled modules must not occupy HUD');
 assert.equal(plasma.icon,'plasma');
 assert.equal(plasma.chargePercent,100-Math.round(100*.45/moduleStats('plasma',g.skillRanks).interval));
});

test('plasma cockpit strength includes the actual close-range furnace specialization',()=>{
 const g=game(),base=weaponDeckState(g);
 g.shipLoadout.specializations.plasma={path:'furnace',rank:2};
 const boosted=weaponDeckState(g),normal=moduleStats('plasma',g.skillRanks).damage;
 assert.match(find(base,'plasma').detail,new RegExp('Урон вблизи '+normal));
 const expected=(normal*1.45).toLocaleString('ru-RU',{maximumFractionDigits:1});
 assert.ok(find(boosted,'plasma').detail.includes('Урон вблизи '+expected));
});

test('G field weapon is infinite and distinct from Space; loan without mounting is explicit',()=>{
 const g=game();g.fieldLoan=createFieldLoan('resonator',g.docked.id,g.time);
 g.fieldLoan.charges=0; // A checkpoint from the old three-shot economy.
 let state=weaponDeckState(g);
 assert.equal(find(state,'field').state,'blocked');
 assert.equal(find(state,'field').status,'НЕ УСТАНОВЛЕНО');
 assert.match(find(state,'field').name,/∞/);
 assert.equal(find(state,'tactical').key,'ПРОБЕЛ');
 assert.equal(state.quick.tactical.id,'tactical');
 assert.equal(state.quick.field.id,'field');
 assert.match(state.compact,/ПРОБЕЛ.*; G/, 'both live actions must stay visible in the collapsed HUD');
 g.shipLoadout.slots[1]='resonator';g.syncShipLoadout();
 g.fieldLoan.cooldownUntil=g.time+2.35;
 state=weaponDeckState(g);
 assert.equal(find(state,'field').status,'2,4 с');
 assert.equal(state.quick.field.status,'2,4 с');
 assert.match(find(state,'field').detail,/6 с/);
 assert.equal(fieldReady(g.fieldLoan,g.time).ok,false);
 g.time+=2.4;
 state=weaponDeckState(g);
 assert.equal(find(state,'field').status,'ГОТОВО');
 assert.equal(fieldReady(g.fieldLoan,g.time).ok,true,'legacy zero ammo cannot lock rental');
 g.fieldLoan=null;state=weaponDeckState(g);
 assert.equal(state.quick.field,null,'unavailable rental must not leave a dead HUD button');
 assert.match(state.compact,/ПРОБЕЛ/);
});
test('Space telemetry shows actual offensive effects and the live trapped crowd',()=>{
 const g=game();g.tactical=createTactical();g.tactical.owned.push('trap');g.tactical.equipped='trap';
 let row=find(weaponDeckState(g),'tactical');
 assert.match(row.detail,/Радиус 242 м/);
 assert.match(row.detail,/действует 8 с/);
 assert.match(row.detail,/первый удар 9/);
 assert.match(row.detail,/урон 5 \/ 0,8 с/);
 g.tactical.effects.push({kind:'trap',x:100,y:0,radius:242,until:g.time+8});
 g.enemies=[{x:150,y:0,hp:30,r:15},{x:800,y:0,hp:40,r:15}];
 row=find(weaponDeckState(g),'tactical');
 assert.match(row.detail,/в поле 1/);
 g.tactical.equipped='jam';g.tactical.owned.push('jam');
 assert.match(find(weaponDeckState(g),'tactical').detail,/подавление связи/);
 assert.doesNotMatch(find(weaponDeckState(g),'tactical').detail,/урон 0/);
});

test('manual mouse weapon selection changes the live parameters, not just the label',()=>{
 const g=game();g.mouseArsenal={cometReadyAt:g.time+3.2,minesReadyAt:0};
 let state=weaponDeckState(g);
 assert.match(find(state,'manual').name,/КОМЕТА/);
 assert.match(find(state,'manual').detail,/670 м/);
 assert.equal(find(state,'manual').status,'3,2 с');
 assert.equal(find(state,'manual').key,'ПКМ');
 assert.equal(find(state,'manual').icon,'comet');
 g.selectedManualWeapon='mines';g.mouseArsenal.minesReadyAt=g.time+9;
 state=weaponDeckState(g);
 assert.match(find(state,'manual').name,/МИННЫЙ ВЕЕР/);
 assert.match(find(state,'manual').detail,/4 мин/);
 assert.equal(find(state,'manual').status,'9 с');
});

test('a fitted howitzer remains visible even when the pilot selects another mouse weapon',()=>{
 const g=game();g.shipLoadout.slots[5]='howitzer';g.syncShipLoadout();
 g.selectedManualWeapon='comet';
 let state=weaponDeckState(g);
 assert.equal(state.installedCount,2);
 assert.match(find(state,'howitzer').detail,/900 м/);
 assert.equal(find(state,'howitzer').status,'НЕ ВЫБРАНА');
 assert.doesNotMatch(find(state,'howitzer').name,/УЗЕЛ H/,'H is an internal module id, not a hotkey');
 g.selectedManualWeapon='howitzer';state=weaponDeckState(g);
 assert.match(find(state,'manual').name,/ГАУБИЦА/);
 assert.equal(find(state,'howitzer'),undefined,'the selected gun must not be listed twice');
});

test('the page provides a compact desktop instrument and an accessible mobile expansion',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../weapon-hud.css',import.meta.url),'utf8');
 const script=readFileSync(new URL('../hud.js',import.meta.url),'utf8');
 for(const id of ['weaponDeck','weaponDeckToggle','weaponDeckBody','weaponDeckAuto',
  'weaponDeckDirect','weaponDeckCompact','weaponDeckAutoQuick','weaponDeckManualQuick',
  'weaponDeckSpaceQuick','weaponDeckFieldQuick',
  'weaponDeckSpaceStatus','weaponDeckFieldStatus'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/weaponDeckToggle[^>]*aria-controls="weaponDeckBody"[^>]*aria-expanded="false"/);
 assert.match(html,/weapon-hud\.css\?v=station-escort-weapon-hud-20261112/);
 assert.match(html,/game\.js\?v=[^"\n]*weapon-deck-audit-2/);
 assert.match(readFileSync(new URL('../game.js',import.meta.url),'utf8'),
  /hud\.js\?v=[^'\n]*weapon-deck-audit-2/);
 assert.match(script,/weapon-hud\.js\?v=[^'\n]*weapon-deck-audit-2/);
 assert.doesNotMatch(html,/id="weaponDeckHeat"/,'only one visible thermal gauge should exist');
 assert.ok(html.indexOf('id="weaponDeckDirect"')<html.indexOf('id="weaponDeckAuto"'),
  'directly controlled actions are higher priority than passive auto-fire');
 assert.match(css,/@media\(pointer:coarse\)/);
 assert.match(css,/\.weapon-deck\.is-open \.weapon-deck-body/);
 assert.match(css,/@media\(pointer:fine\)\{[\s\S]*\.weapon-deck:not\(\.is-open\) \.weapon-deck-body\{display:none\}/,
  'desktop collapsed state must hide detailed telemetry, not merely change aria-expanded');
 assert.match(css,/\.weapon-deck:not\(\.is-open\) \.weapon-deck-quick-readouts\{\s*display:flex/,
  'desktop collapsed state must still display Space and G readiness');
 assert.match(css,/\.weapon-deck-quick\[hidden\]\{display:none!important\}/,
  'the G badge must remain visually hidden until a field weapon is fitted');
 assert.match(css,/pointer-events:none/, 'passive desktop telemetry must not block mouse aiming');
 assert.match(css,/\.weapon-deck\.is-open\{\s*pointer-events:auto/, 'an explicit expansion allows scrolling');
 assert.match(css,/min-height:45px/);
 assert.doesNotMatch(css,/font-size:8px\}\s*\.cockpit-hud \.weapon-deck-detail/,
  'critical telemetry must not fall to 8px on narrow screens');
 assert.match(script,/this\.renderWeaponDeck\(game\)/);
 assert.match(script,/state\.quick\.tactical/);
 assert.match(script,/weapon-deck-charge/);
});
test('station field-loan and help copy use the G binding, never the tactical Space binding',()=>{
 const source=readFileSync(new URL('../base-panel.js',import.meta.url),'utf8');
 assert.match(source,/const fieldKey=readableKey\(\(state\.controls\|\|DEFAULT_CONTROLS\)\.fieldWeapon\)/);
 assert.doesNotMatch(source,/const fieldKey=readableKey\(\(state\.controls\|\|DEFAULT_CONTROLS\)\.field\)/);
});
test('every installed weapon and tactical device has a real purpose-drawn cockpit SVG',()=>{
 const source=readFileSync(new URL('../hud.js',import.meta.url),'utf8');
 const ids=['weapon-plasma','weapon-rail','weapon-flak','weapon-rocket',
  'weapon-comet','weapon-mines','weapon-howitzer','tactical-pulse',
  'tactical-trap','tactical-decoy','tactical-jam','field-resonator'];
 for(const id of ids){
  const asset=new URL('../studio/hud-kit/'+id+'.svg',import.meta.url);
  assert.equal(existsSync(asset),true,id+' must not show a broken image icon');
  const svg=readFileSync(asset,'utf8');
  assert.match(svg,/<svg[^>]+viewBox="0 0 48 48"/,id+' requires predictable HUD dimensions');
  assert.match(source,new RegExp(id+'\\.svg'),id+' must be reachable from the HUD icon map');
 }
});

test('cockpit renders real key badges, visual readiness and both mobile actions in priority order',()=>{
 const g=game();g.fieldLoan=createFieldLoan('ion',g.docked.id,g.time);
 g.shipLoadout.slots[1]='ion';g.syncShipLoadout();
 g.tactical=createTactical();g.tactical.readyAt=g.time+7;
 const original=globalThis.document;
 const domNode=tag=>({
  tag,children:[],style:{properties:{},setProperty(key,value){this.properties[key]=value}},
  dataset:{},attributes:{},textContent:'',hidden:false,
  setAttribute(key,value){this.attributes[key]=value},
  getAttribute(key){return this.attributes[key]??null},
  append(...nodes){this.children.push(...nodes)},
  replaceChildren(...nodes){this.children=nodes.flatMap(node=>node.tag==='fragment'?node.children:[node]);}
 });
 const names=['weaponDeckCount','weaponDeckAutoQuick','weaponDeckAutoKey',
  'weaponDeckAutoName','weaponDeckAutoStatus','weaponDeckManualQuick','weaponDeckManualKey',
  'weaponDeckManualName','weaponDeckManualStatus','weaponDeckSpaceQuick','weaponDeckSpaceKey',
  'weaponDeckSpaceName','weaponDeckSpaceStatus','weaponDeckFieldQuick',
  'weaponDeckFieldKey','weaponDeckFieldName','weaponDeckFieldStatus',
  'weaponDeckAuto','weaponDeckDirect'];
 const n=Object.fromEntries(names.map(name=>[name,domNode('div')]));
 const toggle=domNode('button');
 globalThis.document={
  getElementById:id=>id==='weaponDeckToggle'?toggle:null,
  createDocumentFragment:()=>domNode('fragment'),
  createElement:domNode
 };
 try{
  const display={n,weaponDeckSignature:'',weaponDeckRows:new Map()};
  CockpitDisplay.prototype.renderWeaponDeck.call(display,g);
  assert.equal(n.weaponDeckAutoKey.textContent,'АВТО');
  assert.match(n.weaponDeckAutoName.textContent,/ПЛАЗМА.*1/);
  assert.equal(n.weaponDeckManualKey.textContent,'ПКМ');
  assert.match(n.weaponDeckManualName.textContent,/КОМЕТА/);
  assert.match(n.weaponDeckAutoQuick.attributes['aria-label'],/ПЛАЗМА/);
  assert.equal(n.weaponDeckSpaceKey.textContent,'ПРОБЕЛ');
  assert.equal(n.weaponDeckFieldKey.textContent,'G');
  assert.equal(n.weaponDeckSpaceStatus.textContent,'7 с');
  assert.equal(n.weaponDeckFieldStatus.textContent,'ГОТОВО');
  assert.equal(n.weaponDeckFieldQuick.hidden,false);
  assert.deepEqual(n.weaponDeckDirect.children.slice(0,3).map(el=>el.dataset.slot),
   ['tactical','field','manual']);
  assert.equal(n.weaponDeckDirect.children[0].children[0].children[0].src,
   './studio/hud-kit/tactical-pulse.svg');
  assert.match(n.weaponDeckDirect.children[0].attributes['aria-label'],/ПРОБЕЛ/);
  const tactical=display.weaponDeckRows.get('tactical');
  assert.equal(tactical.element.dataset.state,'cooldown');
  assert.ok(Number.parseInt(tactical.element.style.properties['--charge-fill'])<100);
  g.time+=7.1;
  CockpitDisplay.prototype.renderWeaponDeck.call(display,g);
  assert.equal(n.weaponDeckSpaceStatus.textContent,'ГОТОВО');
  assert.equal(tactical.element.dataset.state,'ready');
  assert.equal(tactical.element.style.properties['--charge-fill'],'100%');
  g.fieldLoan=null;CockpitDisplay.prototype.renderWeaponDeck.call(display,g);
  assert.equal(n.weaponDeckFieldQuick.hidden,true);
 }finally{globalThis.document=original;}
});
