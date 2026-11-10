import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {progressionModel,renderProgressionScreen,paintProgressionLinks} from '../progression-screen.js';
import {createLoadout} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';
import {DEFAULT_CONTROLS} from '../control-layout.js';
import {game} from './weapons-scene.mjs';

function docked(){
 const g=game();g.paused=true;g.overlay.hidden=false;g.overlay.dataset.mode='base';
 g.baseTab='development';g.developmentDomain='pilot';g.developmentTactic='pulse';
 g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 g.tactical=createTactical();g.controls={...DEFAULT_CONTROLS};
 return g;
}
const state=(g,domain)=>({...g.baseState(),developmentDomain:domain,baseActive:true,station:g.docked});

test('all five progression domains show only real station actions and never mutate the ship while browsing',()=>{
 const g=docked(),before=JSON.stringify([g.shipLoadout,g.skillRanks,g.tactical,g.player.ore,g.player.points]);
 for(const domain of ['pilot','weapons','ship','tactics','network']){
  const model=progressionModel(state(g,domain)),html=renderProgressionScreen(state(g,domain));
  assert.equal(model.domain,domain);
  assert.ok(model.nodes.length,domain);
  assert.match(html,new RegExp('data-domain="'+domain+'"'));
  for(const node of model.nodes){
   assert.match(html,new RegExp('data-act="devFocus" data-id="'+node.id+'"'));
   if(node.action!=='baseTab')assert.ok(['skill','doctrine','fitWeapon','hgUpgrade','hgSpec','hgFrame',
    'openEquipmentTactic','hgTacticUpgrade','hgNetworkSlots'].includes(node.action),node.action);
  }
 }
 assert.equal(JSON.stringify([g.shipLoadout,g.skillRanks,g.tactical,g.player.ore,g.player.points]),before);
});

test('the progression atlas spends exactly one real point on a general weapon upgrade',()=>{
 const g=docked();g.player.level=3;g.player.points=1;g.player.ore=120;
 g.developmentDomain='weapons';
 const node=progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='skill-beam');
 assert.equal(node.canAct,true);assert.equal(node.action,'hgUpgrade');
 const ore=g.player.ore;
 g.hangarAction({act:node.action,id:node.actionId});
 assert.equal(g.skillRanks.beam,1);assert.equal(g.player.points,0);assert.equal(g.player.ore,ore);
 assert.equal(progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='skill-beam').canAct,false);
 g.hangarAction({act:node.action,id:node.actionId});
 assert.equal(g.skillRanks.beam,1);
});

test('weapon browsing clearly distinguishes equipped plasma from absent flak without spending points',()=>{
 const g=docked();g.player.level=4;g.player.points=2;g.developmentWeapon='plasma';
 const before=JSON.stringify([g.shipLoadout,g.skillRanks,g.player.points,g.player.ore]);
 const plasma=renderProgressionScreen(state(g,'weapons'));
 assert.match(plasma,/data-id="plasma" aria-pressed="true"[^>]*>[\s\S]*?На корабле · 1/);
 assert.match(plasma,/ВЫБРАНО ДЛЯ ПРОСМОТРА[\s\S]*?✓ На корабле · 1 шт\./);
 assert.match(plasma,/data-act="fitWeapon" data-id="plasma">Посмотреть узел №1/,
  'installed plasma offers its actual ship slot without suggesting another purchase');

 g.developmentWeapon='flak';
 const absent=progressionModel(state(g,'weapons'));
 const flak=renderProgressionScreen(state(g,'weapons'));
 assert.equal(absent.weapon.installed,false);
 assert.equal(absent.weapon.installedCount,0);
 assert.match(flak,/data-id="flak" aria-pressed="true"[^>]*>[\s\S]*?Не установлено/);
 assert.match(flak,/ВЫБРАНО ДЛЯ ПРОСМОТРА[\s\S]*?Осколочный излучатель[\s\S]*?Не установлено на корабле/);
 assert.match(flak,/data-act="fitWeapon" data-id="flak">Перейти к установке/);
 const beam=absent.nodes.find(n=>n.id==='skill-beam');
 assert.equal(beam.canAct,false);
 assert.match(beam.reason,/Сначала установите/);
 assert.match(flak,/data-act="hgUpgrade" data-id="beam" disabled/);
 assert.equal(JSON.stringify([g.shipLoadout,g.skillRanks,g.player.points,g.player.ore]),before,
  'viewing another weapon must not equip it or spend resources');

 g.shipLoadout.slots[1]='flak';
 const installed=progressionModel(state(g,'weapons'));
 assert.equal(installed.weapon.installed,true);
 assert.equal(installed.nodes.find(n=>n.id==='skill-beam').canAct,true);
 assert.match(renderProgressionScreen(state(g,'weapons')),/✓ На корабле · 1 шт\./);
});

test('rocket unlock is available before fitting, but its subsequent ranks require installation',()=>{
 const g=docked();g.player.level=7;g.player.points=3;g.developmentWeapon='rocket';
 g.skillRanks.rocket=0;
 const before=progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='skill-rocket');
 assert.equal(before.canAct,true,'first rank manufactures a launcher');
 g.skillRanks.rocket=1;
 const after=progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='skill-rocket');
 assert.equal(after.canAct,false,'future launcher upgrades should not look active without the launcher');
 assert.match(after.reason,/Сначала установите/);
});

test('manual weapons have dedicated artwork, honest prerequisite trees and no ship fitting button',()=>{
 const g=docked();g.player.level=5;g.player.points=3;
 for(const [id,base,paths] of [
  ['comet','cometRadius',['cometCore','cometCryo']],
  ['mines','mineArray',['minePierce','mineSnare']]]){
  g.developmentWeapon=id;
  const model=progressionModel(state(g,'weapons'));
  assert.equal(model.weapon.manual,true);
  assert.deepEqual(model.nodes.map(n=>n.id),['skill-'+base,...paths.map(path=>'skill-'+path)]);
  assert.ok(model.nodes.every(n=>n.action==='skill'));
  assert.ok(model.nodes.slice(1).every(n=>n.requires==='skill-'+base&&n.status==='locked'));
  const html=renderProgressionScreen(state(g,'weapons'));
  assert.match(html,new RegExp('data-id="'+id+'" aria-pressed="true"'));
  assert.match(html,/Доступно в полёте/);
  assert.doesNotMatch(html,/data-act="fitWeapon"/);
  for(const image of [id,...paths.map(path=>({cometCore:'comet_core',cometCryo:'comet_cryo',
   minePierce:'mine_pierce',mineSnare:'mine_snare'})[path])]){
   assert.ok(existsSync(new URL('../assets/progression/weapons/'+image+'.webp',import.meta.url)));
  }
 }
});

test('manual upgrades spend ordinary level points, exclude the opposite path and gate mastery',()=>{
 const g=docked();g.player.level=5;g.player.points=5;g.developmentWeapon='comet';
 const before=JSON.stringify(g.shipLoadout);
 let model=progressionModel(state(g,'weapons'));
 assert.equal(model.nodes.find(n=>n.id==='skill-cometCore').canAct,false);
 assert.equal(g.buySkill('cometCore'),false,'cannot bypass prerequisite');
 assert.equal(g.buySkill('cometRadius'),true);
 model=progressionModel(state(g,'weapons'));
 assert.equal(model.nodes.find(n=>n.id==='skill-cometCore').canAct,true);
 assert.equal(g.buySkill('cometCore'),true);
 assert.equal(g.buySkill('cometCryo'),false,'cannot buy conflicting path through direct action');
 assert.equal(g.buySkill('cometCore'),false,'mastery is gated by pilot level');
 assert.equal(progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='skill-cometCryo').status,'exclusive');
 assert.match(progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='skill-cometCore').reason,/уровне 9/);
 g.player.level=9;assert.equal(g.buySkill('cometCore'),true);
 assert.equal(g.skillRanks.cometCore,2);
 assert.equal(g.player.points,2);
 assert.equal(JSON.stringify(g.shipLoadout),before,'manual upgrade never mutates the installed ship modules');
});

test('manual paths advertise mastery before purchase and explain desktop versus touch controls',()=>{
 const g=docked();g.player.level=5;g.player.points=3;g.developmentDomain='weapons';
 g.developmentWeapon='comet';g.developmentFocus='skill-cometCore';
 const desktop=renderProgressionScreen(state(g,'weapons'));
 assert.match(desktop,/выбор ветки с уровня 5, мастерство с уровня 9/i);
 assert.doesNotMatch(desktop,/Комета · ЛКМ/);
 g.developmentFocus='skill-cometRadius';
 assert.match(renderProgressionScreen(state(g,'weapons')),/Выберите «Голубую комету» колесом мыши/);
 const touch=renderProgressionScreen({...state(g,'weapons'),isTouchLayout:true});
 assert.match(touch,/Коснитесь точки взрыва на поле боя/);
 assert.match(touch,/Доступно в полёте · касание поля боя/);
 assert.doesNotMatch(touch,/Зажмите ЛКМ/);
 g.developmentWeapon='mines';g.developmentFocus='skill-mineArray';
 const mines=renderProgressionScreen({...state(g,'weapons'),isTouchLayout:true});
 assert.match(mines,/Нажмите «Мины · выбор», затем коснитесь/);
 assert.doesNotMatch(mines,/Зажмите ПКМ/);
 const detail=progressionModel({...state(g,'weapons'),developmentFocus:'skill-mineSnare'});
 assert.equal(detail.selected.masteryAt,9);
});

test('ship frame nodes charge the actual alloy price, and preserve the existing loadout',()=>{
 const g=docked();g.player.level=4;g.player.ore=47;g.developmentDomain='ship';
 const before=JSON.stringify(g.shipLoadout.slots);
 let node=progressionModel(state(g,'ship')).nodes.find(n=>n.id==='frame-1');
 assert.equal(node.canAct,false);assert.match(node.reason,/48/);
 g.hangarAction({act:node.action});assert.equal(g.shipLoadout.frame,0);
 g.player.ore=48;node=progressionModel(state(g,'ship')).nodes.find(n=>n.id==='frame-1');
 assert.equal(node.canAct,true);
 g.hangarAction({act:node.action});
 assert.equal(g.shipLoadout.frame,1);assert.equal(g.player.ore,0);
 assert.equal(JSON.stringify(g.shipLoadout.slots),before);
});

test('a pending fitting blueprint blocks frame purchase until the draft is resolved',()=>{
 const g=docked();g.player.level=4;g.player.ore=100;
 g.hangarSession.draft.slots[1]='rail';
 let node=progressionModel(state(g,'ship')).nodes.find(n=>n.id==='frame-1');
 assert.equal(node.canAct,false);
 assert.match(node.reason,/примените или отмените предварительную сборку/);
 g.hangarSession.begin(g.shipLoadout);
 node=progressionModel(state(g,'ship')).nodes.find(n=>n.id==='frame-1');
 assert.equal(node.canAct,true);
});

test('weapon specializations and tactical branches honor actual level, stations, points and exclusive choices',()=>{
 const g=docked();g.player.level=7;g.player.points=2;g.activeBases=2;g.developmentDomain='weapons';
 let node=progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='spec-plasma-focus');
 assert.equal(node.canAct,true);
 g.hangarAction({act:node.action,id:node.actionId});
 assert.deepEqual(g.shipLoadout.specializations.plasma,{path:'focus',rank:1});
 assert.equal(g.player.points,1);
 assert.equal(progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='spec-plasma-furnace').canAct,false);
 g.developmentDomain='tactics';
 const tactical=progressionModel(state(g,'tactics')).nodes.find(n=>n.id==='tactic-pulse-shell');
 assert.equal(tactical.canAct,true);
 g.hangarAction({act:tactical.action,id:tactical.actionId});
 assert.deepEqual(g.tactical.branches.pulse,{path:'shell',rank:1});
 assert.equal(g.player.points,0);
 assert.equal(progressionModel(state(g,'tactics')).nodes.find(n=>n.id==='tactic-pulse-burst').canAct,false);
});

test('network tree offers only the real flux-funded upgrade, without redirect cards',()=>{
 const g=docked(),model=progressionModel(state(g,'network'));
 assert.equal(model.nodes.length,1);
 assert.equal(model.nodes[0].action,'hgNetworkSlots');
 const html=renderProgressionScreen(state(g,'network'));
 assert.doesNotMatch(html,/data-act="baseTab" data-id="network" data-role="network"/);
 g.developmentFocus='network-turret-slots';
 assert.match(renderProgressionScreen(state(g,'network')),/data-act="hgNetworkSlots"/);
 assert.match(html,/Вместимость опорных линий/);
 assert.doesNotMatch(html,/0\/1 · доступно/);
});

test('a not-yet-installed howitzer shows locked choices and a direct fitting route',()=>{
 const g=docked();g.hangarSession.focusWeapon='howitzer';
 const model=progressionModel(state(g,'weapons'));
 assert.equal(model.nodes.length,2);
 assert.ok(model.nodes.every(node=>node.action==='hgSpec'&&!node.canAct));
 assert.deepEqual(model.nodes.map(node=>node.level),[14,14]);
 assert.deepEqual(model.nodes.map(node=>node.masteryAt),[18,18]);
 assert.match(renderProgressionScreen(state(g,'weapons')),/data-act="fitWeapon" data-id="howitzer"/);
});

test('pilot doctrines have independent ranks, escalating prices and honest level locks',()=>{
 const g=docked();g.player.level=4;g.player.points=1;g.developmentDomain='pilot';
 g.skillBranch='Корабль';
 const first=progressionModel(state(g,'pilot'));
 const doctrineNodes=first.nodes.filter(n=>n.id.startsWith('doctrine-'));
 assert.equal(new Set(doctrineNodes.map(n=>n.icon)).size,4,
  'каждая доктрина должна узнаваемо отличаться от соседней');
 for(const doctrine of doctrineNodes)
  assert.ok(existsSync(new URL('../'+doctrine.icon.replace('./',''),import.meta.url)),
   'пиктограмма должна существовать: '+doctrine.icon);
 const node=first.nodes.find(n=>n.id==='doctrine-countermaneuver');
 assert.ok(node?.canAct);
 assert.match(node.description,/рывок|отражает|выстрелы/);
 g.buyDoctrine('countermaneuver');
 assert.equal(g.doctrineRanks.countermaneuver,1);
 assert.equal(g.player.points,0);
 const second=progressionModel(state(g,'pilot'));
 assert.equal(second.nodes.find(n=>n.id==='doctrine-assault').status,'waiting');
 assert.equal(second.nodes.find(n=>n.id==='doctrine-countermaneuver').status,'locked');
 g.player.level=7;g.player.points=3;
 const next=progressionModel(state(g,'pilot'));
 const upgrade=next.nodes.find(n=>n.id==='doctrine-countermaneuver');
 assert.equal(upgrade.cost,'2 очка развития');assert.equal(upgrade.rank,1);
 assert.match(upgrade.effect,/3 снарядов/);
 assert.equal(g.buyDoctrine('assault'),true);
 assert.equal(g.buyDoctrine('countermaneuver'),true);
 assert.equal(g.player.points,0);
 assert.deepEqual(g.doctrineRanks,{countermaneuver:2,assault:1});
});

test('progression screen keeps a remapped tactical key available while field weapon is installed',()=>{
 const g=docked();g.player.level=5;g.player.points=1;g.developmentDomain='tactics';
 g.controls.field='KeyZ';
 g.fieldLoan={moduleId:'ion',charges:3};g.shipLoadout.slots[1]='ion';
 const html=renderProgressionScreen(state(g,'tactics'));
 assert.doesNotMatch(html,/клавиша Z занята|полевое устройство не запускается/);
 assert.match(html,/Для применения нажмите Z/);
});

test('all referenced generated images are present as independent assets',()=>{
 const g=docked(),root=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
 for(const domain of ['pilot','weapons','ship','tactics','network']){
  const html=renderProgressionScreen(state(g,domain));
  for(const match of html.matchAll(/src="(\.\/assets\/progression\/[^\"]+\.webp)"/g)){
   assert.equal(existsSync(join(root,match[1])),true,'missing '+match[1]);
  }
 }
});

test('the visual graph has honest tier labels, real prerequisite links and readable non-color statuses',()=>{
 const g=docked();g.player.level=7;g.player.points=2;g.developmentTactic='pulse';
 const tactical=renderProgressionScreen(state(g,'tactics'));
 assert.match(tactical,/class="prog-graph"/);
 assert.match(tactical,/class="prog-tier-track"/);
 assert.match(tactical,/data-requires="tactic-pulse"/);
 assert.match(tactical,/class="prog-graph-key"/);
 assert.match(tactical,/Закрыто или требует ресурсов/);
 assert.match(tactical,/0\/2 · /);
 assert.doesNotMatch(renderProgressionScreen(state(g,'network')),/data-requires=/,
  'station destinations are navigation cards, never a fictitious skill tree');
});

test('unique skill silhouettes exist and are not borrowed from unrelated upgrades',()=>{
 const g=docked(),wanted={
  dodge:'upgrades/dodge.webp',extractor:'upgrades/extractor.webp',
  wreck:'upgrades/wreck.webp',capture:'tactics/capture.webp',signal:'tactics/signal.webp'
 };
 const root=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
 const nodes=[];
 for(const skillBranch of ['Корабль','Технологии','Добыча']){
  nodes.push(...progressionModel({...state(g,'pilot'),skillBranch}).nodes);
 }
 nodes.push(...progressionModel({...state(g,'tactics'),developmentTactic:'abilities'}).nodes);
 for(const [id,path] of Object.entries(wanted)){
  const node=nodes.find(n=>n.id==='skill-'+id);
  assert.ok(node,'missing real skill '+id);
  assert.ok(node.icon.endsWith(path),id+' should have its own readable silhouette');
  assert.ok(existsSync(join(root,'assets/progression',path)),path);
 }
});

test('each real specialization path has a distinct marker and keeps its tree position after purchase',()=>{
 const g=docked();g.player.level=7;g.player.points=2;g.activeBases=2;
 const weapons={plasma:['furnace','focus'],rail:['breaker','penetrator'],
  flak:['sweep','interceptor'],rocket:['seeker','payload']};
 for(const [id,paths] of Object.entries(weapons)){
  const s={...state(g,'weapons'),hangarSession:{...g.hangarSession,focusWeapon:id}};
  const nodes=progressionModel(s).nodes.filter(n=>n.id.startsWith('spec-'));
  assert.deepEqual(nodes.map(n=>n.mark),paths);
  assert.ok(nodes.every(n=>n.level===7&&n.masteryAt===11));
  assert.match(renderProgressionScreen(s),/class="prog-branch-mark"/);
 }
 const tactics={pulse:['shell','burst'],decoy:['lure','ghost'],
  trap:['sink','snare'],jam:['wide','deep']};
 for(const [id,paths] of Object.entries(tactics)){
  const s={...state(g,'tactics'),developmentTactic:id};
  const nodes=progressionModel(s).nodes.filter(n=>n.id.startsWith('tactic-'+id+'-'));
  assert.deepEqual(nodes.map(n=>n.mark),paths);
  assert.ok(nodes.every(n=>n.level===3&&n.masteryAt===7));
  assert.match(renderProgressionScreen(s),/class="prog-branch-mark"/);
 }
 // Selecting the first rank must not move a node from level 7 to level 11.
 g.shipLoadout.specializations.plasma={path:'focus',rank:1};
 const chosen=progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='spec-plasma-focus');
 assert.equal(chosen.level,7);assert.equal(chosen.rank,1);
});

test('menu sketches use existing artwork plus the exact lightweight vector pieces they need',()=>{
 const root=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
 const development=readFileSync(join(root,'progression-art.css'),'utf8');
 const station=readFileSync(join(root,'station-menu-v2.css'),'utf8');
 for(const asset of ['studio/menu-kit/art/ui/progression-grid.svg',
  'studio/menu-kit/art/ui/nav-development.svg','studio/menu-kit/art/ui/panel-hatch.svg',
  'assets/progression/frames/node_selected.webp']){
  assert.ok(existsSync(join(root,asset)),asset);
 }
 assert.match(development,/progression-grid\.svg/);
 assert.match(development,/\.prog-graph-key/);
 assert.match(development,/\.prog-tier-track/);
 assert.match(station,/nav-development\.svg/);
 assert.match(station,/\.base-overview-lead/);
});

test('station and direct progression routes both load the newest renderer after publication',()=>{
 const root=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
 const files=['development-panel.js','base-panel.js','game.js'];
 for(const file of files){
  const source=readFileSync(join(root,file),'utf8');
  assert.match(source,/progression-art-6-sketch/,file+' must change the import URL with the design');
 }
 const page=readFileSync(join(root,'index.html'),'utf8');
 assert.match(page,/game\.js\?v=[^"\n]*menu-sketch-1/);
 assert.match(page,/progression-art\.css\?v=[^"\n]*semantic-1/);
 assert.match(page,/station-menu-v2\.css\?v=[^"\n]*semantic-1/);
 assert.match(page,/game\.js\?v=[^"\n]*realfoley-2-first-cue-1-semantic-1/);
 assert.match(readFileSync(join(root,'game.js'),'utf8'),/base-panel\.js\?v=[^'\n]*semantic-1/);
 assert.match(readFileSync(join(root,'development-panel.js'),'utf8'),/progression-screen\.js\?v=[^'\n]*semantic-1/);
 assert.match(readFileSync(join(root,'base-panel.js'),'utf8'),/hangar-panel\.js\?v=[^'\n]*semantic-1/);
});

test('every published station import invalidates stale manual-weapon menu code',()=>{
 const root=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
 const read=file=>readFileSync(join(root,file),'utf8');
 const chain=[
  ['index.html','game.js','manual-qa-2'],
  ['game.js','base-panel.js','manual-qa-2'],
  ['game.js','development-panel.js','manual-qa-2'],
  ['base-panel.js','development-panel.js','manual-qa-2'],
  ['development-panel.js','progression-screen.js','manual-qa-1'],
  ['game.js','progression-screen.js','manual-qa-1']
 ];
 for(const [source,target,version] of chain){
  const escaped=target.replace(/\./g,'\\.');
  const match=read(source).match(new RegExp(escaped+'\\?v=([^"\'\\s]+)'));
  assert.ok(match,source+' must import '+target);
  // Newer changes append further cache revisions; the manual weapon revision
  // must remain in the chain without having to be its final suffix.
  assert.ok(match[1].includes(version),source+' must retain '+target+' revision '+version);
 }
});

test('tree connectors cannot create scrollbars on short branches and grow for long ones',()=>{
 const previous=globalThis.getComputedStyle;
 globalThis.getComputedStyle=()=>({paddingRight:'10px',paddingBottom:'13px'});
 try{
  const attrs={};
  const svg={setAttribute:(key,value)=>{attrs[key]=String(value);},replaceChildren(){}};
  const tiers=[{offsetTop:7,offsetHeight:162}];
  const root={clientWidth:474,clientHeight:342,scrollWidth:484,scrollHeight:352,
   querySelector:()=>svg,querySelectorAll:selector=>selector==='.prog-tier'?tiers:[],
   getBoundingClientRect:()=>({left:0,top:0})};
  paintProgressionLinks(root);
  assert.equal(attrs.width,'464');assert.equal(attrs.height,'329');
  tiers[0].offsetTop=650;
  paintProgressionLinks(root);
  assert.equal(attrs.height,'812');
 }finally{globalThis.getComputedStyle=previous;}
});
