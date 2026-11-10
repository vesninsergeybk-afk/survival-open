import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderBasePanel,baseOffer} from '../base-panel.js';
import {renderProgressionScreen,progressionModel,paintProgressionLinks} from '../progression-screen.js';
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
 const quote=baseOffer(repair.docked,before);
 const html=renderBasePanel(repair.docked,before);
 assert.ok(html.includes('data-act="repair">Починить · '+quote.repairCost+' сплава · +'+quote.repairAmount+' прочности'));
 assert.ok(html.includes('data-act="hire" data-role="scout">Нанять дрона · '+quote.hireCost+' сплава'));
 repair.baseAction('repair','');
 assert.equal(repair.player.hp,before.hp+quote.repairAmount);
 assert.equal(repair.player.ore,before.ore-quote.repairCost);
 const after=renderBasePanel(repair.docked,repair.baseState());
 assert.match(after,/data-act="hire" data-role="scout" disabled/);
 const shortage=baseOffer(repair.docked,repair.baseState()).reasons.hire;
 assert.ok(shortage?.startsWith('Не хватает'));
 assert.ok(after.includes(shortage));
 const hire=station();const hireQuote=baseOffer(hire.docked,hire.baseState());
 hire.baseAction('hire','scout');
 assert.equal(hire.player.ore,20-hireQuote.hireCost);assert.equal(hire.allies.length,1);
 assert.match(renderBasePanel(hire.docked,hire.baseState()),/data-act="repair" disabled/);
 assert.ok(baseOffer(hire.docked,hire.baseState()).reasons.repair.startsWith('Не хватает'));
});

test('overview starts with repair and hire before the tall mission and map preview',()=>{
 const g=station(),html=renderBasePanel(g.docked,g.baseState());
 const quick=html.indexOf('class="base-quick-services"');
 const lead=html.indexOf('class="base-overview-lead"');
 assert.ok(quick>=0&&lead>quick,'the two direct station services must precede the tall briefing');
 const firstBlock=html.slice(quick,lead);
 assert.match(firstBlock,/data-act="repair"/);
 assert.match(firstBlock,/data-act="hire"/);
 assert.doesNotMatch(firstBlock,/class="base-overview-sector"/);
});

test('plasma development honestly shows the mounted slot and shared calibration',()=>{
 const g=station();g.baseTab='development';
 let html=renderProgressionScreen(g.baseState());
 assert.match(html,/✓ На корабле · 1 шт\. · узел 1/);
 assert.match(html,/Общая технология: усиливает всё автоматическое оружие/);
 assert.match(html,/class="prog-weapon-fit" data-act="fitWeapon" data-id="plasma">Посмотреть узел №1/,
  'из дерева развития можно открыть действительно установленный узел');
 assert.equal((html.match(/data-act="fitWeapon" data-id="plasma"/g)||[]).length,1,
  'один понятный переход без дублирования на панели подробностей');
 assert.doesNotMatch(html,/>Оснастить корабль<\/button>/);
 assert.equal(progressionModel(g.baseState()).nodes.find(n=>n.id==='skill-beam').shared,true);
 g.developmentWeapon='rail';html=renderProgressionScreen(g.baseState());
 assert.match(html,/Не установлено на корабле/);
 assert.match(html,/class="prog-weapon-fit" data-act="fitWeapon" data-id="rail">Перейти к установке/);
 assert.equal(progressionModel(g.baseState()).nodes.find(n=>n.id==='skill-beam').rank,0);
 g.hangarAction({act:'hgUpgrade',id:'beam'});
 assert.equal(g.player.points,1);assert.equal(g.skillRanks.beam,1);
 g.developmentWeapon='plasma';
 assert.equal(progressionModel(g.baseState()).nodes.find(n=>n.id==='skill-beam').rank,1);
 g.developmentWeapon='ion';html=renderProgressionScreen(g.baseState());
 assert.equal((html.match(/data-act="fitWeapon" data-id="ion"/g)||[]).length,1,
  'для оружия без отдельной ветки технология не должна создавать второй переход');
});

test('fitting an already mounted gun opens the ship scheme and remembers the exact return target',()=>{
 const g=station();g.baseTab='development';
 const before=JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]);
 g.focusFittingWeapon('plasma');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarSession.catalog,false);
 assert.equal(g.hangarSession.slot,0);
 assert.deepEqual(g.stationMenuContext,{origin:'development',domain:'weapons',
  focus:'skill-beam',weapon:'plasma',returnFocus:null});
 assert.match(renderShipHangar({...g.baseState(),stationMenuContext:g.stationMenuContext},g.hangarSession),
  /data-act="menuContextBack">← Назад к развитию/);
 assert.equal(JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]),before);
});

test('round trip development → mounted weapon → development returns to its original control and costs nothing',()=>{
 const g=station();g.baseTab='development';
 const initial=JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]);
 const origin={dataset:{act:'fitWeapon',id:'plasma',role:'',target:'',focus:''}};
 g.overlay.ownerDocument={activeElement:origin};g.overlay.contains=el=>el===origin;
 let focusRequest;
 g.renderDock=options=>{focusRequest=options;};
 g.focusFittingWeapon('plasma');
 assert.deepEqual(g.stationMenuContext.returnFocus,
  {act:'fitWeapon',id:'plasma',role:'',target:'',focus:''});
 assert.equal(g.restoreStationMenuContext(),true);
 assert.equal(g.baseTab,'development');
 assert.equal(g.developmentDomain,'weapons');assert.equal(g.developmentFocus,'skill-beam');
 assert.equal(g.developmentWeapon,'plasma');assert.equal(g.stationMenuContext,null);
 assert.deepEqual(focusRequest.restoreFocus,{act:'fitWeapon',id:'plasma',role:'',target:'',focus:''});
 assert.match(focusRequest.focusFallback,/prog-node/);
 assert.equal(JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]),initial);
});

test('round trip fitting → development → fitting restores the selected slot and keyboard target',()=>{
 const g=station();g.baseTab='hangar';g.hangarSession.slot=2;g.hangarSession.catalog=true;
 const initial=JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]);
 const origin={dataset:{act:'openDevelopment',id:'weapons',focus:'plasma'}};
 g.overlay.ownerDocument={activeElement:origin};g.overlay.contains=el=>el===origin;
 let focusRequest;g.renderDock=options=>{focusRequest=options;};
 g.openDevelopment('weapons','plasma');
 assert.equal(g.stationMenuContext.origin,'hangar');
 assert.deepEqual(g.stationMenuContext.returnFocus,
  {act:'openDevelopment',id:'weapons',role:'',target:'',focus:'plasma'});
 assert.equal(g.restoreStationMenuContext(),true);
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarView,'weapons');
 assert.equal(g.hangarSession.slot,2);assert.equal(g.hangarSession.catalog,true);
 assert.deepEqual(focusRequest.restoreFocus,
  {act:'openDevelopment',id:'weapons',role:'',target:'',focus:'plasma'});
 assert.match(focusRequest.focusFallback,/hgSlot/);
 assert.equal(JSON.stringify([g.shipLoadout,g.player.points,g.player.ore]),initial);
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
 assert.match(html,/Другое оружие · \d+[\s\S]*data-id="ion"/);
 assert.match(html,/Другое оружие · \d+[\s\S]*data-id="howitzer"/);
 assert.match(html,/РУЧНОЕ[\s\S]*data-id="comet"/);
 assert.ok(html.indexOf('is-manual-group')<html.indexOf('class="prog-weapon-more"'),
  'manual weapons appear before the optional uninstalled module catalog');
 assert.match(html,/class="prog-weapon-more"/);
 assert.doesNotMatch(html,/class="prog-weapon-more" open/);
 g.developmentWeapon='rail';
 assert.match(renderProgressionScreen(g.baseState()),/class="prog-weapon-more" open/,
  'when an absent weapon is selected, its disclosure is expanded');
 assert.doesNotMatch(html,/class="prog-subtab-label">АВТО</);
});

test('the points ledger sits beside the free-point counter, before the tall skill tree',()=>{
 const g=station();g.baseTab='development';
 const html=renderProgressionScreen(g.baseState());
 assert.ok(html.indexOf('class="prog-points-tools"')>=0);
 assert.ok(html.indexOf('class="prog-ledger"')<html.indexOf('class="prog-graph"'));
 assert.equal((html.match(/class="prog-ledger"/g)||[]).length,1);
});

test('narrow screens place the details after the chosen tier, then restore the desktop inspector',()=>{
 const previous=globalThis.window;
 let compact=true,placement='',inline=false;
 const detail={classList:{add:()=>{inline=true;},remove:()=>{inline=false;}}};
 const tier={insertAdjacentElement:(position,element)=>{
  assert.equal(position,'afterend');assert.equal(element,detail);placement='after-tier';
 }};
 const workspace={querySelector:()=>detail,append:element=>{
  assert.equal(element,detail);placement='desktop';
 }};
 const chosen={closest:selector=>selector==='.prog-tier'?tier:null};
 const root={closest:()=>workspace,querySelector:selector=>selector==='.prog-node[aria-pressed="true"]'?chosen:null};
 globalThis.window={matchMedia:()=>({matches:compact})};
 try{
  paintProgressionLinks(root);
  assert.equal(placement,'after-tier');assert.equal(inline,true);
  compact=false;paintProgressionLinks(root);
  assert.equal(placement,'desktop');assert.equal(inline,false);
 }finally{globalThis.window=previous;}
});

test('overview mounted guns open the exact slot with a direct return to overview',()=>{
 const g=station();
 g.shipLoadout.slots[1]='plasma';g.hangarSession.begin(g.shipLoadout);
 const overview=renderBasePanel(g.docked,g.baseState());
 assert.match(overview,/class="base-mounted-weapon" data-act="fitWeapon" data-id="plasma" data-slot="0"/);
 assert.match(overview,/class="base-mounted-weapon" data-act="fitWeapon" data-id="plasma" data-slot="1"/);
 const original=JSON.stringify([g.shipLoadout,g.player.ore,g.player.points]);
 g.focusFittingWeapon('plasma','1');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarSession.slot,1);
 assert.equal(g.hangarSession.catalog,false);
 assert.equal(g.stationMenuContext.origin,'summary');
 assert.match(renderShipHangar({...g.baseState(),stationMenuContext:g.stationMenuContext},g.hangarSession),
  /data-act="menuContextBack">← Назад к обзору/);
 assert.equal(g.restoreStationMenuContext(),true);
 assert.equal(g.baseTab,'summary');assert.equal(g.stationMenuContext,null);
 assert.equal(JSON.stringify([g.shipLoadout,g.player.ore,g.player.points]),original);
});

test('a full weapon rack requires an explicit slot selection before any replacement',()=>{
 const g=station();g.baseTab='development';
 g.shipLoadout.slots[1]='flak';g.hangarSession.begin(g.shipLoadout);
 const original=JSON.stringify([g.shipLoadout,g.player.ore,g.player.points]);
 g.focusFittingWeapon('rail');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarSession.chooseReplacement,true);
 assert.equal(g.hangarSession.requestedWeapon,'rail');
 assert.equal(g.hangarSession.catalog,false);
 assert.match(renderShipHangar({...g.baseState(),stationMenuContext:g.stationMenuContext},g.hangarSession),
  /Нет свободных узлов для/);
 assert.equal(JSON.stringify([g.shipLoadout,g.player.ore,g.player.points]),original);
 g.hangarAction({act:'hgSlot',id:'1'});
 assert.equal(g.hangarSession.chooseReplacement,false);
 assert.equal(g.hangarSession.slot,1);
 assert.equal(g.hangarSession.focusWeapon,'rail');
 assert.equal(g.hangarSession.catalog,true,'the selected occupied slot must open the requested catalog');
 assert.equal(g.hangarSession.draft.slots[1],'flak','slot selection alone must not replace anything');
 assert.equal(JSON.stringify([g.shipLoadout,g.player.ore,g.player.points]),original);
});

test('locked heavy slot explains how to open it instead of prompting an impossible replacement',()=>{
 const g=station();g.baseTab='development';
 const original=JSON.stringify([g.shipLoadout,g.player.ore,g.player.points]);
 g.focusFittingWeapon('howitzer');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarSession.slot,5);
 assert.equal(g.hangarSession.chooseReplacement,false);
 assert.equal(g.hangarSession.catalog,false);
 assert.match(renderShipHangar({...g.baseState(),stationMenuContext:g.stationMenuContext},g.hangarSession),
  /data-act="openDevelopment" data-id="ship">Условия открытия узла/);
 assert.equal(JSON.stringify([g.shipLoadout,g.player.ore,g.player.points]),original);
});

test('station territory and permanent network development are clearly distinguished',()=>{
 const g=station(),overview=renderBasePanel(g.docked,g.baseState());
 assert.match(overview,/data-role="network"[^>]*>[^<]*Территория/);
 g.baseTab='network';
 const territory=renderBasePanel(g.docked,g.baseState());
 assert.match(territory,/Управление территорией/);
 assert.match(territory,/data-act="openDevelopment" data-id="network">Открыть развитие сети/);
 assert.match(territory,/Вклад станции в технологию флота/);
});

test('small screens keep the two equipment sections, focus indicators and contextual return control',()=>{
 const css=readFileSync(new URL('../menu-consistency.css',import.meta.url),'utf8');
 assert.match(css,/\.hg-view-nav\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.menu-context-return/);
 assert.match(css,/\.prog-weapon-fit/);
 const g=station();g.baseTab='development';g.stationMenuContext={origin:'hangar'};
 assert.match(renderProgressionScreen({...g.baseState(),stationMenuContext:g.stationMenuContext}),
  /data-act="menuContextBack">← Назад к оснащению/);
});

test('the published page refreshes the entire changed menu import and style chain',()=>{
 const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
 const version='menu-audit-fix-1';
 const current='menu-depth-2';
 for(const [file,paths] of [
  ['index.html',['game.js','menu-consistency.css']],
  ['game.js',['base-panel.js','development-panel.js','progression-screen.js','ship-loadout.js']],
  ['base-panel.js',['development-panel.js','hangar-panel.js','ship-loadout.js']],
  ['development-panel.js',['progression-screen.js']],
  ['hangar-panel.js',['ship-loadout.js']]]){
  const html=source(file);
  for(const path of paths){
   const line=html.split('\n').find(line=>line.includes(path+'?v='));
   if(!(['game.js','base-panel.js','hangar-panel.js'].includes(file)&&
    (path==='ship-loadout.js'||file==='base-panel.js'&&path==='hangar-panel.js')))
    assert.ok(line?.includes(version),file+' should keep the previous release marker for '+path);
   assert.ok(line?.includes(current),file+' should refresh new version of '+path);
  }
 }
 assert.match(source('index.html'),/station-menu-v2\.css\?v=[^"']*overview-first-1/);
 assert.match(source('index.html'),/game\.js\?v=[^"']*overview-free-close-1/);
 assert.match(source('game.js'),/base-panel\.js\?v=[^"']*overview-first-1/);
 assert.match(source('game.js'),/flux-artillery\.js\?v=[^"']*free-close-1/);
});
