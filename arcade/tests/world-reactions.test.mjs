import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeHarness} from './runtime-game.mjs';
import {World} from '../world.js';
import {advanceRegionalSupply,interceptSupply,strategicCapture,regionalSupplyValid} from '../regional-supply.js';
import {FRONTIERS,FRONTIER_RESPONSE,FRONTIER_ROUTES,frontierRouteLength,
 recordFrontierCargoAttack} from '../frontier-industry.js';
import {updateRegionalWorld,hitRegionalCargo,spawnFrontierRaid} from '../region-runtime.js';
import {renderRegionAtlas,regionalMapOverlay} from '../regional-map.js';
import {regionAt} from '../regions.js';

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
 assert.equal(spawnFrontierRaid(g,{cap:30}),false,'warning required');
 g.time=1;updateRegionalWorld(g,1);
 assert.ok(s.strategy.emergency.announced);
 assert.ok(g.notices.some(n=>n.includes('ответный отряд')));
 const due=s.strategy.emergency.readyAt;
 g.time=due;
 assert.equal(spawnFrontierRaid(g,{cap:1}),false,'director cap applies');
 assert.equal(spawnFrontierRaid(g,{cap:30}),true);
 assert.equal(s.strategy.emergency,null);
 assert.equal(s.strategy.emergencyRaids,1);
 assert.ok(g.enemies.every(e=>e.scenario==='teal-last-reserve'));
 g.enemies=[];
 assert.equal(spawnFrontierRaid(g,{cap:30}),false,'no free repeat');
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
