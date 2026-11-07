import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeHarness} from './runtime-game.mjs';
import {World} from '../world.js';
import {advanceRegionalSupply,interceptSupply,strategicCapture,regionalSupplyValid} from '../regional-supply.js';
import {FRONTIERS,FRONTIER_RESPONSE,FRONTIER_REPAIR,FRONTIER_ROUTES,frontierRouteLength,
 frontierCargoPosition,frontierRadioCoverage,
 recordFrontierCargoAttack} from '../frontier-industry.js';
import {updateRegionalWorld,hitRegionalCargo,spawnFrontierRaid} from '../region-runtime.js';
import {renderRegionAtlas,regionalMapOverlay} from '../regional-map.js';
import {regionAt} from '../regions.js';
import {openingThreat} from '../balance.js';
import {combatTargets} from '../combat-targets.js';
import {designationLabel} from '../target-designation.js';
import {labLogisticsIntel,cargoStrengthensEnemy} from '../station-progression.js';

const noop=()=>{};
function game(id='azure'){
 const g=new RuntimeHarness(),origin=FRONTIERS[id].source;
 Object.assign(g,{world:new World(4213),player:{...origin,r:19,hp:110},
  time:0,enemies:[],allies:[],enemySerial:0,groupSerial:0,
  vw:1200,vh:800,notices:[],notice:s=>g.notices.push(s),
  heritage:{play:noop,vfx:{hullImpact:noop,shipExplosion:noop,nova:noop}},
  drops:[],addDrop:(...v)=>g.drops.push(v)});
 return g;
}
const network=(g,id)=>g.world.regionalSupply.frontier[id];
function tick(g,to){for(let t=Math.floor(g.time)+1;t<=to;t++){
 g.time=t;updateRegionalWorld(g,1);
}}
function reachShadow(g,id,limit=950){
 const s=network(g,id);
 for(let t=Math.floor(g.time)+1;t<=limit;t++){
  g.time=t;advanceRegionalSupply(g.world,t);
  const cargo=s.convoys[0];
  if(cargo&&!frontierRadioCoverage(g.world,id,cargo))return cargo;
 }
 throw Error(`${id}: no reachable radio shadow before the shipment arrives`);
}

test('both enemy industries have a discoverable radio shadow along real cargo routes',()=>{
 for(const id of ['azure','teal']){
  const g=game(id);
  const cfg=FRONTIERS[id];
  assert.equal(frontierRadioCoverage(g.world,id,cfg.source),true);
  assert.equal(frontierRadioCoverage(g.world,id,cfg.depot),true);
  assert.ok(Array.from({length:40},(_,i)=>
   frontierCargoPosition(id,frontierRouteLength(id)*i/40))
   .some(p=>!frontierRadioCoverage(g.world,id,p)));
  const source=g.world.stations.get(cfg.sourceId);
  assert.ok(!renderRegionAtlas(g).includes('Радиосвязь действует возле вражеских станций'));
  assert.ok(!regionalMapOverlay(g,p=>p,()=>true).includes('<circle'),
   'unexplored transmitters must not appear on the map');
  source.discovered=true;
  assert.match(renderRegionAtlas(g),/В радиотени пропажу груза заметят/);
  assert.equal([...regionalMapOverlay(g,p=>p,()=>true).matchAll(/<circle /g)].length,1,
   'only the explored source transmitter must be shown');
  const depot=g.world.stations.get(cfg.depotId);
  depot.discovered=true;
  assert.equal([...regionalMapOverlay(g,p=>p,()=>true).matchAll(/<circle /g)].length,2);
  source.enemy=false;
  assert.equal([...regionalMapOverlay(g,p=>p,()=>true).matchAll(/<circle /g)].length,1,
   'captured transmitters must disappear from hostile coverage');
 }
});

test('an industrial network pays for a real repair expedition and only repairs on arrival',()=>{
 for(const id of ['azure','teal']){
  const g=game(id),s=network(g,id),cfg=FRONTIERS[id];
  const source=g.world.stations.get(cfg.sourceId),depot=g.world.stations.get(cfg.depotId);
  source.discovered=true;
  s.resource=FRONTIER_REPAIR.cost;
  s.nextDispatch=1e8;
  depot.hp=depot.maxHp*.49;
  const turret=depot.turrets[0];turret.hp=turret.maxHp*.28;
  const destroyed=depot.turrets[1];destroyed.hp=0;
  let departedAt=0;
  for(let t=1;t<=280&&!departedAt;t++){
   const events=advanceRegionalSupply(g.world,t);
   if(events.some(e=>e.kind==='repair-depot-dispatch'&&e.network===id))departedAt=t;
  }
  const craft=s.repairExpedition;
  assert.ok(craft&&departedAt>=FRONTIER_REPAIR.earliest);
  assert.equal(craft.targetKind,'depot');
  assert.ok(Math.hypot(craft.x-cfg.source.x,craft.y-cfg.source.y)<5);
  assert.equal(craft.frontierRepair,true);
  assert.equal(s.repairsLaunched,1);
  assert.equal(depot.hp,depot.maxHp*.49,'repair must not be instant');
  assert.ok(s.resource>=0);
  const arrival=departedAt+Math.ceil(frontierRouteLength(id,craft.routeId)/FRONTIER_REPAIR.speed);
  advanceRegionalSupply(g.world,arrival-1);
  assert.ok(s.repairExpedition,'repair ship must traverse the route');
  const events=advanceRegionalSupply(g.world,arrival);
  assert.ok(events.some(e=>e.kind==='repair-depot-complete'&&e.network===id));
  assert.equal(s.repairExpedition,null);
  assert.equal(craft.hp,0,'escorts must not keep defending a vanished live target');
  assert.ok(depot.hp>depot.maxHp*.49);
  assert.ok(turret.hp>turret.maxHp*.28);
  assert.equal(destroyed.hp,0,'a demolished turret cannot be resurrected');
  assert.ok(regionalSupplyValid(g.world.regionalSupply,arrival));
 }
});

test('damaged production sites receive a reserve-funded reverse repair expedition',()=>{
 const g=game('teal'),s=network(g,'teal'),cfg=FRONTIERS.teal;
 const source=g.world.stations.get(cfg.sourceId);
 s.assemblyUntil=1e8;s.reserves=1;s.resource=0;s.nextDispatch=1e8;
 source.hp=source.maxHp*.43;
 advanceRegionalSupply(g.world,FRONTIER_REPAIR.earliest);
 const craft=s.repairExpedition;
 assert.ok(craft);
 assert.equal(craft.targetKind,'source');
 assert.equal(s.reserves,0,'maintenance must consume an actual stored reinforcement');
 assert.ok(Math.hypot(craft.x-cfg.depot.x,craft.y-cfg.depot.y)<5);
 assert.ok(regionalSupplyValid(g.world.regionalSupply,FRONTIER_REPAIR.earliest));
 const arrival=craft.launchedAt+Math.ceil(frontierRouteLength('teal',craft.routeId)/FRONTIER_REPAIR.speed);
 const events=advanceRegionalSupply(g.world,arrival);
 assert.ok(events.some(e=>e.kind==='repair-source-complete'));
 assert.ok(source.hp>source.maxHp*.43);
 assert.equal(s.repairsCompleted,1);
});

test('a player can intercept maintenance, and captured destinations cannot be repaired',()=>{
 for(const capture of [false,true]){
  const g=game('azure'),s=network(g,'azure'),cfg=FRONTIERS.azure;
  const depot=g.world.stations.get(cfg.depotId);
  s.nextDispatch=1e8;s.resource=FRONTIER_REPAIR.cost;
  depot.hp=depot.maxHp*.5;
  advanceRegionalSupply(g.world,FRONTIER_REPAIR.earliest);
  const craft=s.repairExpedition,original=depot.hp;
  assert.ok(craft);
  if(capture)depot.enemy=false;
  else{
   craft.hp=0;
   assert.ok(interceptSupply(g.world,craft,FRONTIER_REPAIR.earliest));
   assert.equal(interceptSupply(g.world,craft,FRONTIER_REPAIR.earliest),false);
   assert.equal(s.repairsIntercepted,1);
  }
  const events=advanceRegionalSupply(g.world,FRONTIER_REPAIR.earliest+90);
  assert.equal(depot.hp,original);
  assert.equal(s.repairsCompleted,0);
  if(capture)assert.ok(events.some(e=>e.kind==='repair-aborted'));
  assert.ok(regionalSupplyValid(g.world.regionalSupply,FRONTIER_REPAIR.earliest+90));
 }
});

test('repair ships are actual combat targets, visible mission markers and nonrepeatable rewards',()=>{
 const g=game('azure'),s=network(g,'azure'),cfg=FRONTIERS.azure;
 s.nextDispatch=1e8;s.resource=FRONTIER_REPAIR.cost;
 g.world.stations.get(cfg.sourceId).discovered=true;
 g.world.stations.get(cfg.depotId).hp*=.6;
 advanceRegionalSupply(g.world,140);
 const craft=s.repairExpedition;
 assert.ok(craft);
 craft.seen=true;craft.lastSeenAt=g.time;craft.lastSeenX=craft.x;craft.lastSeenY=craft.y;
 const target=combatTargets(g,120,{x:craft.x,y:craft.y},false)
  .find(item=>item.target===craft);
 assert.ok(target,'the ship must be attackable by ordinary automatic weapons');
 assert.match(designationLabel(target),/ремонтный корабль/i);
 assert.match(renderRegionAtlas(g),/Ремонтный корабль/);
 assert.match(regionalMapOverlay(g,p=>p,()=>true),/РЕМОНТНЫЙ КОРАБЛЬ/);
 const before=g.drops.length;
 hitRegionalCargo(g,craft,craft.hp+1);
 assert.equal(s.repairsIntercepted,1);
 assert.equal(s.repairExpedition,null);
 assert.equal(g.drops.length,before+2);
 hitRegionalCargo(g,craft,30);
 assert.equal(g.drops.length,before+2,'a destroyed expedition cannot pay a second reward');
 assert.match(g.notices.at(-1),/ремонтный корабль уничтожен/i);
});

test('a discovered repair ship can actually be selected from the region map',()=>{
 const g=game('azure'),s=network(g,'azure'),cfg=FRONTIERS.azure;
 s.nextDispatch=1e8;s.resource=4;
 g.world.stations.get(cfg.depotId).hp*=.5;
 g.world.stations.get(cfg.sourceId).discovered=true;
 advanceRegionalSupply(g.world,140);
 const craft=s.repairExpedition;
 assert.ok(craft);
 assert.doesNotMatch(renderRegionAtlas(g),/Замечен ремонтный корабль/,
  'industrial counters must not reveal live unobserved movements');
 craft.seen=true;
 g.overlay={dataset:{mode:'map'}};
 let selected=null;
 g.setNavigationCourse=(waypoint)=>{selected=waypoint};
 g.selectWaypoint({id:craft.id,x:craft.x,y:craft.y,label:'Ремонтный корабль'});
 assert.ok(selected,'the actual map button must lead to a navigable target');
 assert.equal(selected.id,craft.id);
 assert.equal(selected.label,'Ремонтный корабль');
 assert.match(renderRegionAtlas(g),/Замечен ремонтный корабль/);
 craft.seen=false;
 selected=null;
 g.selectWaypoint({id:craft.id,x:craft.x,y:craft.y,label:'Ремонтный корабль'});
 assert.equal(selected,null,'the map must reject an unseen target without radio intelligence');
});

test('a nearby active laboratory detects a live repair expedition without revealing captured targets',()=>{
 const g=game('teal'),s=network(g,'teal'),cfg=FRONTIERS.teal;
 s.nextDispatch=1e8;s.resource=4;
 const depot=g.world.stations.get(cfg.depotId);
 depot.hp*=.5;
 advanceRegionalSupply(g.world,140);
 const craft=s.repairExpedition;
 assert.ok(craft);
 g.world.stations.set('test-lab',{id:'test-lab',type:'lab',active:true,
  enemy:false,x:craft.x,y:craft.y});
 let intel=labLogisticsIntel(g.world,g.player);
 assert.ok(intel.contacts.some(c=>c.id===craft.id&&c.kind==='cargo'&&
  c.label.includes('ремонтная')));
 g.overlay={dataset:{mode:'map'}};
 let chosen=null;
 g.setNavigationCourse=waypoint=>{chosen=waypoint};
 g.selectWaypoint({id:craft.id,x:craft.x,y:craft.y,label:'Радиометка ремонтного корабля'});
 assert.ok(chosen?.radioContact,'laboratory tracking must create a live radio waypoint');
 assert.equal(chosen.signalLabel,'Вражеская ремонтная экспедиция');
 assert.equal(cargoStrengthensEnemy(g.world,craft),true);
 depot.enemy=false;
 assert.equal(cargoStrengthensEnemy(g.world,craft),false);
 intel=labLogisticsIntel(g.world,g.player);
 assert.ok(!intel.contacts.some(c=>c.id===craft.id),
  'a captured destination must not remain a valuable radio interception objective');
});

test('maintenance has finite budget, does not launch for healthy stations or with no stores',()=>{
 const g=game('teal'),s=network(g,'teal'),cfg=FRONTIERS.teal;
 s.nextDispatch=1e8;
 advanceRegionalSupply(g.world,300);
 assert.equal(s.repairsLaunched,0);
 const depot=g.world.stations.get(cfg.depotId);
 depot.hp=depot.maxHp*.2;
 s.resource=0;
 // No worker or stored reserves means no material can appear by assertion.
 s.worker.hp=0;
 advanceRegionalSupply(g.world,420);
 assert.equal(s.repairsLaunched,0);
 s.resource=FRONTIER_REPAIR.cost;
 advanceRegionalSupply(g.world,900);
 assert.ok(s.repairsLaunched>0&&s.repairsLaunched<=FRONTIER_REPAIR.maxWindowMissions);
 assert.ok(s.repairsCompleted<=s.repairsLaunched);
 assert.ok(s.resource>=0);
 assert.ok(regionalSupplyValid(g.world.regionalSupply,900));
});

test('repair windows reopen in a long run while expenditure and active ships stay bounded',()=>{
 const g=game('teal'),s=network(g,'teal'),cfg=FRONTIERS.teal;
 s.nextDispatch=1e8;s.worker.hp=0;s.resource=16;
 const depot=g.world.stations.get(cfg.depotId);
 depot.hp=depot.maxHp*.1;
 advanceRegionalSupply(g.world,140);
 assert.equal(s.repairsLaunched,1);
 advanceRegionalSupply(g.world,380);
 assert.equal(s.repairsLaunched,2);
 advanceRegionalSupply(g.world,800);
 assert.equal(s.repairsLaunched,2,'only two expeditions per 15-minute interval');
 advanceRegionalSupply(g.world,1039);
 assert.equal(s.repairsLaunched,2,'a rolling window blocks a burst across the 15-minute boundary');
 advanceRegionalSupply(g.world,1040);
 assert.equal(s.repairsLaunched,3,'a long-lasting enemy world can repair again');
 assert.equal(s.repairExpedition?.id,'frontier-repair-teal-3');
 assert.deepEqual(s.repairDispatchTimes,[380,1040]);
 assert.equal(s.resource,4,'all three repair missions used actual material');
 assert.ok(regionalSupplyValid(g.world.regionalSupply,1040));
});

test('long-range hits to maintenance ships can trigger paid protective escorts',()=>{
 const g=game('teal'),s=network(g,'teal'),cfg=FRONTIERS.teal;
 s.nextDispatch=1e8;s.worker.hp=0;s.resource=12;
 const depot=g.world.stations.get(cfg.depotId);
 depot.hp=depot.maxHp*.15;
 advanceRegionalSupply(g.world,140);
 const craft=s.repairExpedition;
 assert.ok(craft);
 assert.ok(recordFrontierCargoAttack(g.world,craft,'rail',500,141));
 assert.ok(recordFrontierCargoAttack(g.world,craft,'rail',500,143));
 advanceRegionalSupply(g.world,184);
 assert.ok(s.strategy.screenUntil>184);
 const before=s.resource;
 advanceRegionalSupply(g.world,380);
 assert.equal(s.repairExpedition?.screened,true);
 assert.equal(s.resource,before-FRONTIER_REPAIR.cost-FRONTIER_RESPONSE.screenCargoCost);
 g.time=380;
 g.player.x=s.repairExpedition.x;g.player.y=s.repairExpedition.y;
 updateRegionalWorld(g,0);
 assert.deepEqual(g.enemies.filter(e=>e.protect===s.repairExpedition).map(e=>e.type),
  ['gunship','healer'],'paid heavy escort must appear in the actual encounter');
 assert.ok(regionalSupplyValid(g.world.regionalSupply,380));
});

test('a repair ship destroyed in radio shadow is not reported until it misses arrival',()=>{
 const g=game('teal'),s=network(g,'teal'),cfg=FRONTIERS.teal;
 s.nextDispatch=1e8;s.resource=4;
 g.world.stations.get(cfg.depotId).hp*=.4;
 advanceRegionalSupply(g.world,140);
 let craft=s.repairExpedition;
 let lostAt=0;
 for(let t=141;t<200;t++){
  advanceRegionalSupply(g.world,t);
  craft=s.repairExpedition;
  if(craft&&!frontierRadioCoverage(g.world,'teal',craft)){
   lostAt=t;break;
  }
 }
 assert.ok(lostAt,'route includes a genuine radio blind spot');
 craft.hp=0;
 assert.ok(interceptSupply(g.world,craft,lostAt));
 assert.equal(s.strategy.pendingLosses.length,1);
 assert.equal(s.strategy.reports.length,0);
 const expected=Math.ceil(craft.launchedAt+frontierRouteLength('teal',craft.routeId)/FRONTIER_REPAIR.speed);
 const due=expected+FRONTIER_RESPONSE.missingGrace;
 let events=advanceRegionalSupply(g.world,due-1);
 assert.ok(!events.some(e=>e.kind==='shipment-overdue'));
 events=advanceRegionalSupply(g.world,due);
 assert.ok(events.some(e=>e.kind==='shipment-overdue'));
 assert.equal(s.strategy.pendingLosses.length,0);
 assert.ok(regionalSupplyValid(g.world.regionalSupply,due));
});

test('repair operations remain deterministic across frame steps and legacy industrial saves',()=>{
 const results=[];
 for(const step of [1/30,1/60]){
  const g=game('azure'),s=network(g,'azure'),cfg=FRONTIERS.azure;
  s.nextDispatch=1e8;s.resource=FRONTIER_REPAIR.cost;
  g.world.stations.get(cfg.depotId).hp*=.4;
  for(let t=step;t<380;t+=step)advanceRegionalSupply(g.world,t);
  advanceRegionalSupply(g.world,380);
  results.push({launched:s.repairsLaunched,completed:s.repairsCompleted,
   resource:s.resource,health:g.world.stations.get(cfg.depotId).hp,
   expedition:s.repairExpedition?.id||null});
 }
 assert.deepEqual(results[0],results[1]);
 const legacy=game('teal'),s=network(legacy,'teal');
 delete s.repairExpedition;delete s.repairsLaunched;
 delete s.repairsCompleted;delete s.repairsIntercepted;delete s.nextRepairAt;
 assert.ok(regionalSupplyValid(legacy.world.regionalSupply,0));
 advanceRegionalSupply(legacy.world,100);
 assert.equal(s.repairsLaunched,0,'old saves must not receive a free repair ship');
 assert.ok(s.nextRepairAt>100,'legacy state starts a fresh preparation clock');
});

test('a freighter destroyed outside coverage cannot instantly report its own death',()=>{
 const g=game('teal'),s=network(g,'teal');
 const cargo=reachShadow(g,'teal');
 assert.equal(frontierRadioCoverage(g.world,'teal',cargo),false);
 const t=g.time;
 cargo.hp=0;assert.ok(interceptSupply(g.world,cargo,t));
 assert.equal(s.strategy.reports.filter(r=>r.kind==='loss').length,0);
 assert.equal(s.strategy.pendingLosses.length,1);
 const due=s.strategy.pendingLosses[0].dueAt;
 assert.ok(due>t+1);
 advanceRegionalSupply(g.world,due-1);
 assert.equal(s.strategy.reports.filter(r=>r.kind==='loss').length,0);
 const notices=advanceRegionalSupply(g.world,due);
 assert.ok(notices.some(e=>e.kind==='shipment-overdue'&&e.network==='teal'));
 const loss=s.strategy.reports.find(r=>r.kind==='loss');
 assert.equal(loss?.at,due);
 assert.equal(loss.receivedAt,due+FRONTIER_RESPONSE.reportDelay);
 assert.equal(s.strategy.pendingLosses.length,0);
 assert.ok(regionalSupplyValid(g.world.regionalSupply,due));
});

test('an automatic distress packet is received only when a freighter can reach a station',()=>{
 const g=game('azure'),s=network(g,'azure');
 let cargo;
 for(let t=1;t<=400&&!cargo;t++){
  g.time=t;advanceRegionalSupply(g.world,t);cargo=s.convoys[0];
 }
 assert.ok(cargo);
 assert.equal(frontierRadioCoverage(g.world,'azure',cargo),true);
 cargo.hp=0;assert.ok(interceptSupply(g.world,cargo,g.time));
 assert.equal(s.strategy.pendingLosses.length,0);
 const report=s.strategy.reports.find(r=>r.kind==='loss');
 assert.equal(report?.receivedAt,g.time+FRONTIER_RESPONSE.reportDelay);
});

test('two long-range hits in a radio shadow are stored, then transmitted only by a surviving ship',()=>{
 const g=game('teal'),s=network(g,'teal');
 let cargo=reachShadow(g,'teal');
 const first=g.time;
 assert.equal(recordFrontierCargoAttack(g.world,cargo,'rail',600,first),true);
 advanceRegionalSupply(g.world,first+2);
 g.time=first+2;
 cargo=s.convoys.find(c=>c.id===cargo.id);
 assert.ok(cargo&&!frontierRadioCoverage(g.world,'teal',cargo));
 assert.equal(recordFrontierCargoAttack(g.world,cargo,'rail',600,g.time),true);
 assert.equal(cargo.radioBuffer.length,2);
 assert.equal(s.strategy.reports.filter(r=>r.kind==='long').length,0);
 let reconnectedAt=0;
 for(let t=g.time+1;t<=first+85;t++){
  advanceRegionalSupply(g.world,t);
  if(s.strategy.reports.filter(r=>r.kind==='long').length===2){reconnectedAt=t;break;}
 }
 assert.ok(reconnectedAt>g.time);
 const reports=s.strategy.reports.filter(r=>r.kind==='long');
 assert.deepEqual(reports.map(r=>r.at),[first,first+2]);
 assert.ok(reports.every(r=>r.receivedAt===reconnectedAt+FRONTIER_RESPONSE.reportDelay));
 assert.equal(cargo.radioBuffer.length,0);
 assert.ok(regionalSupplyValid(g.world.regionalSupply,reconnectedAt));
});

test('black-box observations perish with a freighter lost outside radio coverage',()=>{
 const g=game('teal'),s=network(g,'teal');
 const cargo=reachShadow(g,'teal');
 recordFrontierCargoAttack(g.world,cargo,'rail',700,g.time);
 assert.equal(cargo.radioBuffer.length,1);
 cargo.hp=0;interceptSupply(g.world,cargo,g.time);
 advanceRegionalSupply(g.world,g.time+100);
 assert.equal(s.strategy.reports.filter(r=>r.kind==='long').length,0);
 assert.equal(s.strategy.pendingLosses.length,0);
});

test('radio-shadow ambush delays the same paid enemy route response without suppressing it',()=>{
 const prepareAfterTwo=(id,shadow)=>{
  const g=game(id),s=network(g,id),cfg=FRONTIERS[id];
  // Both comparisons start with precisely enough stock for two transports.
  s.resource=cfg.cost*2;
  s.nextDispatch=1;
  let interceptions=0;
  for(let t=1;t<=650;t++){
   g.time=t;
   const events=advanceRegionalSupply(g.world,t);
   if(events.some(e=>e.network===id&&e.kind==='route-prep')){
    assert.equal(interceptions,2);
    assert.ok(s.strategy.routePlan);
    return t;
   }
   const cargo=s.convoys[0];
   if(cargo&&interceptions<2&&
      frontierRadioCoverage(g.world,id,cargo)!==shadow){
    cargo.hp=0;
    assert.ok(interceptSupply(g.world,cargo,t));
    interceptions++;
    // The source can afford the same route change in either case.
    if(interceptions===2)s.resource=Math.max(s.resource,FRONTIER_RESPONSE.routeCost);
   }
  }
  assert.fail(`${id}: enemy did not prepare a route change after two interceptions`);
 };
 for(const id of ['azure','teal']){
  const near=prepareAfterTwo(id,false),hidden=prepareAfterTwo(id,true);
  assert.ok(hidden>=near+20,`${id}: radio shadow must delay route reaction (${near} vs ${hidden})`);
 }
});

test('two confirmed losses trigger a paid, delayed, plotted diversion; earlier cargo retains its route',()=>{
 for(const id of ['azure','teal']){
  const g=game(id),s=network(g,id),cfg=FRONTIERS[id];
  let losses=0,prepareAt=0,changedAt=0;
  const oldLength=frontierRouteLength(id);
  for(let t=1;t<=1800;t++){
   g.time=t;
   const events=advanceRegionalSupply(g.world,t);
   if(events.some(e=>e.network===id&&e.kind==='route-prep')){
    prepareAt=t;
   }
   if(events.some(e=>e.network===id&&e.kind==='route-changed')){
    changedAt=t;break;
   }
   const cargo=s.convoys[0];
   if(cargo&&losses<2){
    assert.equal(cargo.routeId,'direct');
    cargo.hp=0;
    assert.ok(interceptSupply(g.world,cargo,t));
    losses++;
   }
  }
  assert.equal(losses,2,`${id}: observations must come from two real transports`);
  assert.ok(prepareAt>0,`${id}: source must fund a route change`);
  assert.ok(changedAt-prepareAt>=FRONTIER_RESPONSE.routePrep);
  assert.ok(s.resource>=0,`${id}: route planning cannot create debt`);
  assert.equal(s.strategy.route,'diversion');
  assert.ok(frontierRouteLength(id,'diversion')>oldLength);
  assert.ok(FRONTIER_ROUTES[id].diversion.every(p=>regionAt(p.x,p.y).id===id));
  assert.ok(regionalSupplyValid(g.world.regionalSupply,g.time));
  tick(g,g.time+300);
  assert.ok(s.launched>=3,`${id}: a third shipment must still depart`);
  assert.ok(s.convoys.every(c=>c.routeId==='diversion'),`${id}: new cargo follows the selected route`);
  g.world.stations.get(cfg.sourceId).discovered=true;
  assert.match(renderRegionAtlas(g),/обходной/);
  const svg=regionalMapOverlay(g,p=>p,()=>true);
  assert.ok(svg.includes(String(FRONTIER_ROUTES[id].diversion[1].x)));
 }
});

test('cargo telemetry needs two distant real hits, a delivery delay and source stock',()=>{
 const g=game('azure'),s=network(g,'azure'),cfg=FRONTIERS.azure;
 let cargo;
 for(let t=1;t<480&&!cargo;t++){
  g.time=t;updateRegionalWorld(g,1);cargo=s.convoys[0];
 }
 assert.ok(cargo);
 g.player={...g.player,x:cargo.x+600,y:cargo.y+600};
 hitRegionalCargo(g,cargo,1,null,'rail');
 assert.equal(s.strategy.reports.length,1);
 hitRegionalCargo(g,cargo,1,null,'rail');
 assert.equal(s.strategy.reports.length,1,'several simultaneous hits form one report');
 tick(g,g.time+2);
 hitRegionalCargo(g,cargo,1,null,'rail');
 assert.equal(s.strategy.reports.length,2);
 assert.equal(s.strategy.screenPlan,null,'no instantaneous strategic knowledge');
 s.resource=cfg.capacity;
 const secondHit=g.time;
 tick(g,secondHit+FRONTIER_RESPONSE.reportDelay-1);
 assert.equal(s.strategy.screenPlan,null);
 tick(g,secondHit+FRONTIER_RESPONSE.reportDelay);
 assert.ok(s.strategy.screenPlan,'two delivered hit reports cause a response');
 assert.ok(s.strategy.screenPlan.readyAt-g.time>=FRONTIER_RESPONSE.screenPrep);
 const prep=s.strategy.screenPlan.readyAt;
 tick(g,prep);
 assert.ok(s.strategy.screenUntil>g.time);
 let screened=false;
 for(let t=Math.floor(g.time)+1;t<=prep+FRONTIER_RESPONSE.screenDuration;t++){
  g.time=t;updateRegionalWorld(g,1);
  if(s.convoys.some(c=>c.screened)){screened=true;break;}
 }
 assert.ok(screened,'at least one later cargo gets an upgraded escort if it can pay');
 assert.ok(s.convoys.find(c=>c.screened).routeId==='direct');
 assert.ok(regionalSupplyValid(g.world.regionalSupply,g.time));
});

test('route decision consumes exactly two units with no working source or shipment',()=>{
 const g=game('teal');tick(g,112);
 const s=network(g,'teal');
 s.worker.hp=0;s.worker.phase='disabled';s.resource=4;s.nextDispatch=1000;
 s.strategy.reports=[
  {seq:1,kind:'loss',route:'direct',at:99,receivedAt:111},
  {seq:2,kind:'loss',route:'direct',at:100,receivedAt:112}
 ];s.strategy.reportSerial=2;
 g.time=113;updateRegionalWorld(g,1);
 assert.equal(s.resource,2,'changing the route has a fixed material cost');
 assert.deepEqual(s.strategy.routePlan,{to:'diversion',readyAt:113+FRONTIER_RESPONSE.routePrep});
 assert.ok(regionalSupplyValid(g.world.regionalSupply,g.time));
});

test('without material the same reports cannot create a diversion or upgraded escort',()=>{
 const g=game('teal');tick(g,112);
 const s=network(g,'teal');
 s.worker.hp=0;s.worker.phase='disabled';s.resource=0;s.nextDispatch=1000;
 s.strategy.reports=[
  {seq:1,kind:'loss',route:'direct',at:98,receivedAt:110},
  {seq:2,kind:'loss',route:'direct',at:99,receivedAt:111},
  {seq:3,kind:'long',route:'direct',at:100,receivedAt:112},
  {seq:4,kind:'long',route:'direct',at:101,receivedAt:113}
 ];s.strategy.reportSerial=4;
 tick(g,145);
 assert.equal(s.strategy.routePlan,null);
 assert.equal(s.strategy.screenPlan,null);
 assert.equal(s.strategy.screenUntil,0);
 assert.equal(s.strategy.route,'direct');
});

test('screened escort charges its own two units on top of the ordinary shipment',()=>{
 const g=game('teal');tick(g,120);
 const s=network(g,'teal'),cfg=FRONTIERS.teal;
 s.worker.hp=0;s.worker.phase='disabled';
 s.convoys=[];s.reserves=0;s.resource=cfg.cost+FRONTIER_RESPONSE.screenCargoCost;
 s.nextDispatch=121;s.strategy.screenUntil=240;
 g.time=121;updateRegionalWorld(g,1);
 const cargo=s.convoys[0];
 assert.ok(cargo?.screened);
 assert.equal(s.resource,0);
 g.player.x=cargo.x;g.player.y=cargo.y;
 updateRegionalWorld(g,0);
 assert.deepEqual(g.enemies.slice(-2).map(e=>e.type),['gunship','healer']);
 assert.ok(regionalSupplyValid(g.world.regionalSupply,g.time));
});

test('a transport already in flight does not teleport when the network changes route',()=>{
 const g=game('azure'),s=network(g,'azure');
 let cargo;
 for(let t=1;t<450&&!cargo;t++){
  g.time=t;updateRegionalWorld(g,1);cargo=s.convoys[0];
 }
 assert.ok(cargo);
 const launch=cargo.launchedAt;
 s.strategy.routePlan={to:'diversion',readyAt:g.time+1};
 tick(g,g.time+1);
 assert.equal(s.strategy.route,'diversion');
 assert.equal(cargo.routeId,'direct');
 assert.ok(Math.abs(cargo.distance-(g.time-launch)*FRONTIERS.azure.speed)<.001);
});

test('near attacks, irrelevant damage and reports about nonexistent cargo cannot train industry',()=>{
 const g=game('teal'),s=network(g,'teal');
 let cargo;
 for(let t=1;t<=700&&!cargo;t++){
  g.time=t;updateRegionalWorld(g,1);cargo=s.convoys[0];
 }
 assert.ok(cargo);
 assert.equal(recordFrontierCargoAttack(g.world,cargo,'rail',100,g.time),false);
 assert.equal(recordFrontierCargoAttack(g.world,cargo,'other',900,g.time),false);
 assert.equal(recordFrontierCargoAttack(g.world,{...cargo},'rail',900,g.time),false);
 assert.equal(s.strategy.reports.length,0);
});

test('capturing the source spends one stored reserve on one announced, avoidable last raid',()=>{
 const g=game('teal'),cfg=FRONTIERS.teal,s=network(g,'teal');
 const source=g.world.stations.get(cfg.sourceId);
 s.reserves=1;s.assemblyUntil=500;
 source.enemy=false;source.captured=true;source.discovered=true;
 assert.ok(strategicCapture(g.world,source,0));
 assert.equal(s.reserves,0);
 assert.ok(s.strategy.emergency);
 const director={...openingThreat(500,5),cap:30};
 assert.equal(spawnFrontierRaid(g,director),false,'warning required');
 g.time=1;updateRegionalWorld(g,1);
 assert.ok(s.strategy.emergency.announced);
 assert.ok(g.notices.some(n=>n.includes('ответный отряд')));
 const due=s.strategy.emergency.readyAt;
 g.time=due;
 assert.equal(spawnFrontierRaid(g,{...director,cap:1}),false,'director cap applies');
 assert.ok(spawnFrontierRaid(g,director));
 assert.equal(s.strategy.emergency,null);
 assert.equal(s.strategy.emergencyRaids,1);
 assert.equal(g.enemies.filter(e=>e.scenario==='teal-last-reserve').length,1);
 assert.equal(g.enemies.length,director.groupSize+1);
 g.enemies=[];
 assert.equal(spawnFrontierRaid(g,director),false,'no free repeat');
 tick(g,1600);
 assert.equal(s.strategy.emergencyRaids,1);
 assert.ok(regionalSupplyValid(g.world.regionalSupply,g.time));
});

test('a starved source cannot retaliate; capturing a depot cancels a scheduled retaliation',()=>{
 for(const resources of [0,1]){
  const g=game('azure'),s=network(g,'azure'),cfg=FRONTIERS.azure;
  s.reserves=resources;
  const source=g.world.stations.get(cfg.sourceId);
  source.enemy=false;source.captured=true;
  strategicCapture(g.world,source,0);
  assert.equal(Boolean(s.strategy.emergency),Boolean(resources));
  const depot=g.world.stations.get(cfg.depotId);
  depot.enemy=false;depot.captured=true;
  strategicCapture(g.world,depot,0);
  assert.equal(s.strategy.emergency,null);
  assert.equal(s.reserves,0);
  g.time=35;updateRegionalWorld(g,1);
  assert.equal(spawnFrontierRaid(g,{cap:30}),false);
 }
});

test('conquering either required station cancels unexecuted routing and escort orders',()=>{
 for(const kind of ['source','depot']){
  const g=game('azure'),s=network(g,'azure'),cfg=FRONTIERS.azure;
  s.strategy.routePlan={to:'diversion',readyAt:35};
  s.strategy.screenPlan={readyAt:30};
  s.strategy.screenUntil=200;
  const base=g.world.stations.get(kind==='source'?cfg.sourceId:cfg.depotId);
  base.enemy=false;base.captured=true;
  strategicCapture(g.world,base,0);
  g.time=60;updateRegionalWorld(g,1);
  assert.equal(s.strategy.route,'direct');
  assert.equal(s.strategy.routePlan,null);
  assert.equal(s.strategy.screenPlan,null);
  assert.equal(s.strategy.screenUntil,0);
 }
});

test('a producer cannot be captured twice to buy an extra emergency squad',()=>{
 const g=game('azure'),s=network(g,'azure'),src=g.world.stations.get(FRONTIERS.azure.sourceId);
 s.reserves=2;src.enemy=false;src.captured=true;
 strategicCapture(g.world,src,0);
 assert.equal(s.reserves,1);
 assert.equal(s.strategy.emergencyCommitted,true);
 strategicCapture(g.world,src,0);
 assert.equal(s.reserves,1);
 assert.ok(s.strategy.emergency);
});

test('old saves without strategy or cargo route migrate at current time without invented reports',()=>{
 const g=game('azure'),s=network(g,'azure');
 tick(g,320);
 for(const id of ['azure','teal']){
  const n=network(g,id);delete n.strategy;
  for(const c of n.convoys){delete c.routeId;delete c.screened;}
 }
 assert.ok(regionalSupplyValid(g.world.regionalSupply,g.time));
 const existing=s.convoys[0];
 g.time=321;updateRegionalWorld(g,1);
 assert.ok(s.strategy);
 assert.deepEqual(s.strategy.reports,[]);
 assert.equal(s.strategy.route,'direct');
 if(existing)assert.ok(Number.isFinite(existing.x));
 assert.ok(regionalSupplyValid(g.world.regionalSupply,g.time));
});

test('industrial simulation is unchanged by coarse vs fine frame steps over a 30-minute sortie',()=>{
 const a=new World(56842),b=new World(56842);
 for(let t=1;t<=1800;t++){
  advanceRegionalSupply(a,t);
  advanceRegionalSupply(b,t-.5);
  advanceRegionalSupply(b,t);
 }
 assert.deepEqual(b.regionalSupply.frontier,a.regionalSupply.frontier);
 assert.ok(regionalSupplyValid(a.regionalSupply,1800));
});
