import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {CENTRAL_INDUSTRY,interceptCentralCargo} from '../central-industry.js';
import {labDiscoveryPromise,labLogisticsUnlocked,labLogisticsIntel,LAB_LOGISTICS_TECH,cargoStrengthensEnemy} from '../station-progression.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {captureCheckpoint,restoreCheckpoint} from '../run-checkpoint.js';
import {updateRegionalWorld} from '../region-runtime.js';

const lab=(id='2:2',x=2500,y=2300,active=false)=>({
 id,type:'lab',x,y,enemy:false,active,discovered:true,rank:1,
 turrets:[],hp:800,maxHp:800
});
const installLab=(g,base)=>{g.world.stations.set(base.id,base);g.world.discovered.add(base.id);return base;};
const centralCargo=(id='central-cargo-1',x=6500,y=1600)=>({
 id,centralCargo:true,regionalCargo:true,x,y,hp:115,maxHp:115,
 r:29,seen:false,launchedAt:60,distance:0
});

test('a lab promises logistics intelligence before activation without selling an empty technology',()=>{
 const g=game(),b=installLab(g,lab());g.docked=b;
 assert.equal(labLogisticsUnlocked(g.world),false);
 assert.match(labDiscoveryPromise(b,g.world),/первая лаборатория/i);
 const html=renderBasePanel(b,g.baseState());
 assert.match(html,/отслеживать проходящие поблизости грузы/);
 assert.doesNotMatch(html,/data-act="buyLogisticsIntel"/);
});

test('the first lab opens a real, approximate supply lead and the unlock survives a checkpoint',()=>{
 const g=game(),b=installLab(g,lab());g.docked=b;g.paused=true;
 g.player.x=b.x;g.player.y=b.y;
 const mine=g.world.stations.get(CENTRAL_INDUSTRY.sourceId);
 const unknownMap=renderWorldMap(g);
 assert.doesNotMatch(unknownMap,/data-id="intel:central-source"/);
 g.baseAction('activate');
 assert.equal(b.active,true);
 assert.equal(labLogisticsUnlocked(g.world),true);
 assert.match(g.lastNotice,/Радиоперехват снабжения/);
 assert.match(renderBasePanel(b,g.baseState()),/Радиоперехват работает/);
 const intel=labLogisticsIntel(g.world,g.player);
 const source=intel.contacts.find(c=>c.kind==='source');assert.ok(source);
 assert.notEqual(source.x,mine.x,'an unrevealed station must remain approximate');
 assert.match(renderWorldMap(g),/data-id="intel:central-source"/);
 assert.match(renderWorldMap(g),/Радиослед добычи/);
 const checkpoint=captureCheckpoint(g,b);
 const restored=game();restoreCheckpoint(restored,checkpoint);
 assert.equal(labLogisticsUnlocked(restored.world),true);
 assert.match(renderWorldMap(restored),/data-id="intel:central-source"/);
});

test('an additional lab actually extends the coverage of moving supply ships',()=>{
 const g=game(),first=installLab(g,lab('0:-3',-50,-3740,true));
 const cargo=centralCargo();g.world.regionalSupply.central.convoys.push(cargo);
 const noCoverage=labLogisticsIntel(g.world,g.player);
 assert.equal(noCoverage.unlocked,true);
 assert.equal(noCoverage.contacts.some(c=>c.id===cargo.id),false);
 const second=installLab(g,lab('5:1',6100,1300,false));
 assert.match(labDiscoveryPromise(second,g.world),/расширить район слежения/);
 second.active=true;
 const covered=labLogisticsIntel(g.world,g.player);
 assert.ok(covered.contacts.some(c=>c.id===cargo.id));
 assert.match(renderWorldMap(g),/data-id="central-cargo-1"/);
 assert.ok(first.active);
 assert.equal(LAB_LOGISTICS_TECH.range,4300);
});

test('a far-off lab does not reveal the central industrial source across the entire universe',()=>{
 const g=game();installLab(g,lab('24:21',30000,28000,true));
 const intel=labLogisticsIntel(g.world,g.player);
 assert.equal(intel.unlocked,true);
 assert.equal(intel.contacts.some(c=>c.id==='intel:central-source'),false);
 assert.doesNotMatch(intel.status,/Шахта продолжает снабжать/);
});

test('frontier laboratories detect only nearby shipments that still serve an enemy depot',()=>{
 const g=game();installLab(g,lab('6:30',8400,38400,true));
 const cargo={id:'frontier-cargo-azure-1',frontierCargo:true,frontierNetwork:'azure',
  hp:135,maxHp:135,x:8500,y:38500,seen:false};
 g.world.regionalSupply.frontier.azure.convoys.push(cargo);
 assert.equal(labLogisticsIntel(g.world,g.player).contacts.some(c=>c.id===cargo.id),true);
 const depot=g.world.stations.get('frontier:azure:depot');depot.enemy=false;depot.captured=true;
 assert.equal(labLogisticsIntel(g.world,g.player).contacts.some(c=>c.id===cargo.id),false);
});

test('map waypoint selects only an actually scanned hostile cargo, never a forged position',()=>{
 const g=game();installLab(g,lab('5:1',6100,1300,true));
 const cargo=centralCargo();g.world.regionalSupply.central.convoys.push(cargo);
 g.overlay.dataset.mode='map';
 let waypoint=null;g.setNavigationCourse=wp=>{waypoint=wp;};
 g.selectWaypoint({id:cargo.id,x:'999999',y:'999999',label:'Подделка'});
 assert.equal(waypoint.id,cargo.id);
 assert.equal(waypoint.x,cargo.x);
 assert.equal(waypoint.label,'Местный рудный груз');
 assert.equal(waypoint.radioContact,true);
 waypoint=null;
 g.selectWaypoint({id:'central-cargo-not-real',x:'6500',y:'1600'});
 assert.equal(waypoint,null);
});

test('radio waypoint stops following a cargo outside lab range and reacquires it on renewed coverage',()=>{
 const g=game(),b=installLab(g,lab('0:2',200,2800,true));
 const cargo=centralCargo('central-cargo-1',4400,2800);cargo.launchedAt=10;
 g.world.regionalSupply.central.convoys.push(cargo);
 g.overlay.dataset.mode='map';g.player.x=4400;g.player.y=2800;
 g.setNavigationCourse=waypoint=>{g.waypoint=waypoint;};
 g.selectWaypoint({id:cargo.id,x:'4400',y:'2800'});
 assert.equal(g.waypoint.radioContact,true);
 g.time=11;updateRegionalWorld(g,1);
 g.time=12;updateRegionalWorld(g,1);
 assert.equal(g.waypoint.signalLive,false);
 assert.match(g.waypoint.label,/Последняя радиометка/);
 const lastX=g.waypoint.x,lastY=g.waypoint.y;
 g.time=13;updateRegionalWorld(g,1);
 assert.equal(g.waypoint.x,lastX,'ship movement beyond radio coverage must stay unknown');
 assert.equal(g.waypoint.y,lastY);
 b.x=5700;b.y=1900;
 g.time=14;updateRegionalWorld(g,1);
 assert.equal(g.waypoint.signalLive,true);
 assert.equal(g.waypoint.x,cargo.x);
 assert.equal(g.waypoint.y,cargo.y);
 assert.equal(g.waypoint.label,'Местный рудный груз');
});

test('capturing a cargo destination cancels an obsolete radio chase',()=>{
 const g=game();installLab(g,lab('3:2',4400,2800,true));
 const cargo=centralCargo('central-cargo-1',4400,2800);cargo.launchedAt=10;
 g.world.regionalSupply.central.convoys.push(cargo);
 g.waypoint={id:cargo.id,x:cargo.x,y:cargo.y,label:'Местный рудный груз',
  signalLabel:'Местный рудный груз',radioContact:true,signalLive:true};
 const depot=g.world.stations.get(CENTRAL_INDUSTRY.depotId);
 assert.equal(cargoStrengthensEnemy(g.world,cargo),true);
 depot.enemy=false;depot.captured=true;
 assert.equal(cargoStrengthensEnemy(g.world,cargo),false);
 g.time=11;updateRegionalWorld(g,1);
 assert.equal(g.waypoint,null);
});

test('desktop and compact maps give a truthful route selection hint',()=>{
 const g=game();installLab(g,lab('2:2',2500,2300,true));
 const html=renderWorldMap(g);
 assert.match(html,/map-intel-wide">Выберите маршрут в списке справа/);
 assert.match(html,/map-intel-compact">Откройте «Цели»/);
 assert.doesNotMatch(LAB_LOGISTICS_TECH.unlocked,/в разделе «Регионы и цели»/);
});

test('industrial waypoint becomes exact after discovery and vanishes when the source is neutralized',()=>{
 const g=game();installLab(g,lab('2:2',2500,2300,true));
 const initial=labLogisticsIntel(g.world,g.player).contacts.find(c=>c.kind==='source');
 g.waypoint={id:initial.id,x:initial.x,y:initial.y,label:initial.label};
 const mine=g.world.stations.get(CENTRAL_INDUSTRY.sourceId);
 mine.discovered=true;g.time=11;
 updateRegionalWorld(g,1);
 assert.equal(g.waypoint.x,mine.x);
 assert.equal(g.waypoint.y,mine.y);
 mine.enemy=false;mine.captured=true;g.time=12;
 updateRegionalWorld(g,1);
 assert.equal(g.waypoint,null,'the game must not continue pointing to an already silenced source');
});

test('interception and disabling the source change the lab report from live world state',()=>{
 const g=game();installLab(g,lab('5:1',6100,1300,true));
 const cargo=centralCargo();g.world.regionalSupply.central.convoys.push(cargo);
 assert.match(labLogisticsIntel(g.world).status,/Шахта продолжает снабжать/);
 cargo.hp=0;assert.equal(interceptCentralCargo(g.world,cargo,g.time),true);
 assert.equal(labLogisticsIntel(g.world).contacts.some(c=>c.id===cargo.id),false);
 assert.match(labLogisticsIntel(g.world).status,/перехвачено рейсов — 1/);
 const worker=g.world.regionalSupply.central.worker;worker.hp=0;
 const intel=labLogisticsIntel(g.world);
 assert.equal(intel.contacts.some(c=>c.kind==='source'),false);
 assert.equal(intel.contacts.some(c=>c.kind==='depot'),true);
 assert.match(intel.status,/Добыча остановлена/);
 const depot=g.world.stations.get(CENTRAL_INDUSTRY.depotId);depot.enemy=false;depot.captured=true;
 assert.match(labLogisticsIntel(g.world).status,/сеть больше не создаёт подкрепления/);
 const diverted=centralCargo('central-cargo-2');g.world.regionalSupply.central.convoys.push(diverted);
 assert.equal(labLogisticsIntel(g.world).contacts.some(c=>c.id===diverted.id),false,
  'cargo headed to a captured destination is no longer a valuable target');
 assert.match(renderWorldMap(g),/Местная цепочка снабжения подавлена/);
});

test('captured enemy laboratory unlocks intelligence without giving a duplicate reward',()=>{
 const g=game(),b=installLab(g,lab());
 Object.assign(b,{enemy:true,hp:12});
 assert.equal(labLogisticsUnlocked(g.world),false);
 g.hitEnemyBase(b,20);
 assert.equal(b.captured,true);
 assert.equal(labLogisticsUnlocked(g.world),true);
 assert.match(g.lastNotice,/Радиоперехват снабжения открыт/);
 g.docked=b;g.paused=true;g.player.x=b.x;g.player.y=b.y;
 const saved=captureCheckpoint(g,b),restored=game();restoreCheckpoint(restored,saved);
 assert.equal(labLogisticsUnlocked(restored.world),true);
 const again=installLab(g,lab('3:3',3700,3700));Object.assign(again,{enemy:true,hp:10});
 g.hitEnemyBase(again,20);
 assert.doesNotMatch(g.lastNotice,/Радиоперехват снабжения открыт/);
});
