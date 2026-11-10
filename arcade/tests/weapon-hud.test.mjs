import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {game} from './weapons-scene.mjs';
import {createFieldLoan,fieldReady} from '../field-weapons.js';
import {moduleStats} from '../ship-loadout.js';
import {weaponDeckState} from '../weapon-hud.js';

const find=(state,id)=>state.rows.find(row=>row.id===id);

test('flight deck shows every equipped automatic module, with real damage, range, cycle and heat',()=>{
 const g=game();g.shipLoadout.slots=['plasma','plasma','rail','rocket',null,null];
 g.syncShipLoadout();g.skillRanks.beam=2;g.skillRanks.range=1;
 g.weaponThermal.current=73;g.beamClock=.45;g.rocketClock=2.5;
 const state=weaponDeckState(g),plasma=find(state,'plasma'),rail=find(state,'rail');
 assert.equal(state.autoCount,4);
 assert.match(plasma.name,/×2/);assert.match(plasma.detail,/Урон вблизи/);
 assert.ok(plasma.detail.includes(String(moduleStats('plasma',g.skillRanks).range)));
 assert.equal(plasma.status,'0,5 с');
 assert.match(rail.detail,/700 м/);assert.equal(rail.status,'ГОТОВО');
 assert.equal(find(state,'rocket').status,'2,5 с');
 assert.equal(state.heatPercent,73);
 assert.equal(find(state,'flak'),undefined,'uninstalled modules must not occupy HUD');
});

test('G field weapon is infinite and distinct from Space; loan without mounting is explicit',()=>{
 const g=game();g.fieldLoan=createFieldLoan('resonator',g.docked.id,g.time);
 g.fieldLoan.charges=0; // A checkpoint from the old three-shot economy.
 let state=weaponDeckState(g);
 assert.equal(find(state,'field').state,'blocked');
 assert.equal(find(state,'field').status,'НЕ УСТАНОВЛЕНО');
 assert.match(find(state,'field').name,/∞/);
 assert.ok(find(state,'tactical').name.startsWith('ПРОБЕЛ'));
 g.shipLoadout.slots[1]='resonator';g.syncShipLoadout();
 g.fieldLoan.cooldownUntil=g.time+2.35;
 state=weaponDeckState(g);
 assert.equal(find(state,'field').status,'2,4 с');
 assert.match(find(state,'field').detail,/6 с/);
 assert.equal(fieldReady(g.fieldLoan,g.time).ok,false);
 g.time+=2.4;
 state=weaponDeckState(g);
 assert.equal(find(state,'field').status,'ГОТОВО');
 assert.equal(fieldReady(g.fieldLoan,g.time).ok,true,'legacy zero ammo cannot lock rental');
});

test('manual mouse weapon selection changes the live parameters, not just the label',()=>{
 const g=game();g.mouseArsenal={cometReadyAt:g.time+3.2,minesReadyAt:0};
 let state=weaponDeckState(g);
 assert.match(find(state,'manual').name,/КОМЕТА/);
 assert.match(find(state,'manual').detail,/670 м/);
 assert.equal(find(state,'manual').status,'3,2 с');
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
 g.selectedManualWeapon='howitzer';state=weaponDeckState(g);
 assert.match(find(state,'manual').name,/ГАУБИЦА/);
 assert.equal(find(state,'howitzer'),undefined,'the selected gun must not be listed twice');
});

test('the page provides a continuous desktop instrument and an accessible mobile expansion',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../weapon-hud.css',import.meta.url),'utf8');
 const script=readFileSync(new URL('../hud.js',import.meta.url),'utf8');
 for(const id of ['weaponDeck','weaponDeckToggle','weaponDeckBody','weaponDeckAuto',
  'weaponDeckDirect','weaponDeckHeat','weaponDeckCompact'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/weaponDeckToggle[^>]*aria-controls="weaponDeckBody"[^>]*aria-expanded="false"/);
 assert.match(html,/weapon-hud\.css\?v=unlimited-rental-hud-1/);
 assert.match(css,/@media\(pointer:coarse\)/);
 assert.match(css,/\.weapon-deck\.is-open \.weapon-deck-body/);
 assert.match(script,/this\.renderWeaponDeck\(game\)/);
});
