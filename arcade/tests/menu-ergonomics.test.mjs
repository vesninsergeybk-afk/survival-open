import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderBasePanel,baseOffer} from '../base-panel.js';
import {renderProgressionScreen,progressionModel} from '../progression-screen.js';
import {renderShipHangar} from '../hangar-panel.js';
import {createLoadout} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';
import {game} from './weapons-scene.mjs';

function station({ore=20,hp=38,points=2}={}){
 const g=game();g.baseTab='summary';g.hangarView='weapons';g.developmentDomain='weapons';
 g.developmentWeapon='plasma';g.developmentFocus='skill-beam';
 g.paused=true;g.overlay.hidden=false;g.overlay.dataset.mode='base';
 g.player.ore=ore;g.player.hp=hp;g.player.points=points;
 g.player.level=4;g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 g.tactical=createTactical();g.controls={};return g;
}

test('repair and drone hire are direct, mutually affordable choices and keep their real receipts',()=>{
 const repair=station();const before=repair.baseState();
 const html=renderBasePanel(repair.docked,before);
 assert.match(html,/data-act="repair">Починить · 18 сплава · \+50 прочности/);
 assert.match(html,/data-act="hire" data-role="scout">Нанять дрона · 20 сплава/);
 repair.baseAction('repair','');
 assert.equal(repair.player.hp,88);assert.equal(repair.player.ore,2);
 const after=renderBasePanel(repair.docked,repair.baseState());
 assert.match(after,/data-act="hire" data-role="scout" disabled/);
 assert.match(after,/Не хватает 18 ед. сплава/);
 const hire=station();hire.baseAction('hire','scout');
 assert.equal(hire.player.ore,0);assert.equal(hire.allies.length,1);
 assert.match(renderBasePanel(hire.docked,hire.baseState()),/data-act="repair" disabled/);
 assert.equal(baseOffer(hire.docked,hire.baseState()).reasons.repair,'Не хватает 18 ед. сплава');
});

test('plasma development honestly shows the mounted slot and shared calibration',()=>{
 const g=station();g.baseTab='development';
 let html=renderProgressionScreen(g.baseState());
 assert.match(html,/✓ На корабле · 1 шт\. · узел 1/);
 assert.match(html,/Общая технология: усиливает всё автоматическое оружие/);
 assert.doesNotMatch(html,/data-act="fitWeapon" data-id="plasma"/,
  'у уже установленной плазмы не должно быть лишней кнопки перехода к установке');
 assert.doesNotMatch(html,/>Оснастить корабль<\/button>/);
 assert.equal(progressionModel(g.baseState()).nodes.find(n=>n.id==='skill-beam').shared,true);
 g.developmentWeapon='rail';html=renderProgressionScreen(g.baseState());
 assert.match(html,/Не установлено на корабле/);
 assert.equal(progressionModel(g.baseState()).nodes.find(n=>n.id==='skill-beam').rank,0);
 g.hangarAction({act:'hgUpgrade',id:'beam'});
 assert.equal(g.player.points,1);assert.equal(g.skillRanks.beam,1);
 g.developmentWeapon='plasma';
 assert.equal(progressionModel(g.baseState()).nodes.find(n=>n.id==='skill-beam').rank,1);
});

test('fitting an already mounted gun opens the ship scheme and remembers the exact return target',()=>{
 const g=station();g.baseTab='development';
 const before=JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]);
 g.focusFittingWeapon('plasma');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarSession.catalog,false);
 assert.equal(g.hangarSession.slot,0);
 assert.deepEqual(g.stationMenuContext,{origin:'development',domain:'weapons',
  focus:'skill-beam',weapon:'plasma'});
 assert.match(renderShipHangar({...g.baseState(),stationMenuContext:g.stationMenuContext},g.hangarSession),
  /data-act="menuContextBack">← Назад к развитию/);
 assert.equal(JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]),before);
});

test('an absent gun goes directly to its actual fitting choice without paying for browsing',()=>{
 const g=station();g.baseTab='development';g.developmentWeapon='rail';
 const before=JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]);
 g.focusFittingWeapon('rail');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarSession.catalog,true);
 assert.equal(g.hangarSession.focusWeapon,'rail');assert.equal(g.hangarSession.slot,1);
 assert.equal(JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]),before);
});

test('equipment shows two genuine choices and tactical purchases do not duplicate in development',()=>{
 const g=station();g.baseTab='development';g.developmentDomain='tactics';
 const development=renderProgressionScreen(g.baseState());
 assert.match(development,/data-act="openEquipmentTactic" data-id="pulse"/);
 assert.doesNotMatch(development,/data-act="hgTacticUnlock"|data-act="hgTacticEquip"/);
 const equipment=renderShipHangar({...g.baseState(),hangarView:'tactics'},g.hangarSession);
 assert.match(equipment,/data-act="hgView" data-id="weapons"/);
 assert.match(equipment,/data-act="hgView" data-id="tactics"/);
 assert.doesNotMatch(equipment,/data-act="hgView" data-id="services"|data-act="hgView" data-id="upgrades"/);
});

test('development groups actual mounted weapons before other guns and separates manual flight weapons',()=>{
 const g=station();g.baseTab='development';
 const html=renderProgressionScreen(g.baseState());
 assert.match(html,/НА КОРАБЛЕ[\s\S]*data-id="plasma"/);
 assert.match(html,/ДРУГОЕ ОРУЖИЕ[\s\S]*data-id="ion"/);
 assert.match(html,/ДРУГОЕ ОРУЖИЕ[\s\S]*data-id="howitzer"/);
 assert.match(html,/РУЧНОЕ[\s\S]*data-id="comet"/);
 assert.doesNotMatch(html,/class="prog-subtab-label">АВТО</);
});

test('small screens keep the two equipment sections, focus indicators and contextual return control',()=>{
 const css=readFileSync(new URL('../menu-consistency.css',import.meta.url),'utf8');
 assert.match(css,/\.hg-view-nav\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.menu-context-return/);
 const g=station();g.baseTab='development';g.stationMenuContext={origin:'hangar'};
 assert.match(renderProgressionScreen({...g.baseState(),stationMenuContext:g.stationMenuContext}),
  /data-act="menuContextBack">← Назад к оснащению/);
});
