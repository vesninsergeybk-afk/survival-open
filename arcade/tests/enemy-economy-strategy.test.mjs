import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {SUPPLY,SUPPLY_RESPONSE,SUPPLY_ROUTE,SUPPLY_DIVERSION,
 advanceRegionalSupply,interceptSupply,regionalSupplyValid,supplyRouteLength}
 from '../regional-supply.js';
import {regionalMapOverlay,renderRegionAtlas} from '../regional-map.js';
import {regionalCampaignPressure} from '../regional-campaign.js';
import {strategicCapture} from '../regional-supply.js';
import {openingThreat} from '../balance.js';

test('a remote industrial network does not burn ten convoys against a full depot',()=>{
 const world=new World(),s=world.regionalSupply;
 advanceRegionalSupply(world,1800);
 assert.equal(s.delivered,3,'two stored reserves plus one pre-paid sortie');
 assert.equal(s.serial,3,'no surplus dispatches to a full stockpile');
 assert.equal(s.reserves,2);assert.ok(s.pendingRaid);
 assert.equal(s.convoys.length,0);
 assert.equal(s.ore,SUPPLY.capacity,'stored raw material remains available');
 assert.ok(regionalSupplyValid(s,1800));
 const snapshot=JSON.stringify(s);
 advanceRegionalSupply(world,1800);
 assert.equal(JSON.stringify(s),snapshot,'no second simulation on the same tick');
});

test('the headquarters changes its route only after two reported losses and pays for the plan',()=>{
 const world=new World(),s=world.regionalSupply;
 const seen=new Set(),events=[];
 let lossOneAt=null,lossTwoAt=null,firstPlanAt=null;
 for(let t=1;t<=360;t++){
  events.push(...advanceRegionalSupply(world,t));
  for(const cargo of [...s.convoys])if(!seen.has(cargo.id)&&seen.size<2){
   seen.add(cargo.id);cargo.hp=0;
   assert.ok(interceptSupply(world,cargo,t));
   if(lossOneAt===null)lossOneAt=t;else lossTwoAt=t;
  }
  if(s.strategy.routePlan&&firstPlanAt===null)firstPlanAt=t;
 }
 assert.equal(seen.size,2);
 assert.ok(firstPlanAt>=lossTwoAt+SUPPLY_RESPONSE.reportDelay,
  'the first shot cannot reveal the next one, and radio reports have travel time');
 assert.equal(s.strategy.route,'diversion');
 assert.ok(events.some(e=>e.kind==='route-prep'));
 assert.ok(events.some(e=>e.kind==='route-changed'));
 assert.ok(supplyRouteLength('diversion')>supplyRouteLength('direct'));
 assert.notDeepEqual(SUPPLY_DIVERSION,SUPPLY_ROUTE);
 assert.ok(regionalSupplyValid(s,360));
});

test('a hidden ambush is discovered after the missed ETA, not at the time of the kill',()=>{
 const world=new World(),s=world.regionalSupply;
 advanceRegionalSupply(world,65);
 const cargo=s.convoys[0];assert.ok(cargo);
 advanceRegionalSupply(world,158);
 assert.ok(Math.hypot(cargo.x-SUPPLY_ROUTE[0].x,cargo.y-SUPPLY_ROUTE[0].y)>SUPPLY_RESPONSE.radioRadius);
 assert.ok(Math.hypot(cargo.x-SUPPLY_ROUTE.at(-1).x,cargo.y-SUPPLY_ROUTE.at(-1).y)>SUPPLY_RESPONSE.radioRadius);
 cargo.hp=0;assert.ok(interceptSupply(world,cargo,158));
 const due=s.strategy.pendingLosses[0].dueAt;
 assert.ok(due>158+SUPPLY_RESPONSE.reportDelay);
 advanceRegionalSupply(world,due-1);
 assert.equal(s.strategy.knownLosses,0);
 advanceRegionalSupply(world,due);
 assert.equal(s.strategy.knownLosses,1);
 assert.ok(s.history.some(e=>e.kind==='shipment-overdue'));
 assert.ok(regionalSupplyValid(s,due));
});

test('old-route losses cannot magically prove that the new bypass needs an escort',()=>{
 const world=new World(),s=world.regionalSupply;
 advanceRegionalSupply(world,65);
 const cargo=s.convoys[0];assert.equal(cargo.routeId,'direct');
 s.strategy.route='diversion';
 cargo.hp=0;assert.ok(interceptSupply(world,cargo,65));
 advanceRegionalSupply(world,95);
 assert.equal(s.strategy.knownLosses,0);
 assert.equal(s.strategy.screenPlan,null);
 assert.ok(regionalSupplyValid(s,95));
});

test('route adaptation cannot start without the exact resource payment',()=>{
 const world=new World(),s=world.regionalSupply;
 s.strategy.knownLosses=2;s.nextDispatch=1e6;
 advanceRegionalSupply(world,19);
 assert.equal(s.strategy.routePlan,null);
 assert.equal(s.strategy.route,'direct');
 advanceRegionalSupply(world,20);
 assert.ok(s.strategy.routePlan);
 assert.ok(Math.abs(s.ore)<1e-8,'the first four units of mined ore pay for the plan');
 assert.equal(s.strategy.knownLosses,0);
 assert.ok(regionalSupplyValid(s,20));
});

test('older checkpoints without a strategy gain no past intelligence or free materials',()=>{
 const world=new World(),s=world.regionalSupply;
 delete s.strategy;
 advanceRegionalSupply(world,1);
 assert.deepEqual(s.strategy.pendingLosses,[]);
 assert.equal(s.strategy.knownLosses,0);
 assert.equal(s.strategy.route,'direct');
 assert.ok(regionalSupplyValid(s,1));
});

test('repeated ambushes force paid escorts, while old transports retain their route',()=>{
 const world=new World(),s=world.regionalSupply,seen=new Set();
 let lastRoute=null,firstProtected=null;
 for(let t=1;t<=1250;t++){
  advanceRegionalSupply(world,t);
  for(const cargo of [...s.convoys])if(!seen.has(cargo.id)){
   seen.add(cargo.id);
   if(seen.size<=4){
    lastRoute=cargo.routeId;
    cargo.hp=0;assert.ok(interceptSupply(world,cargo,t));
   }else if(cargo.screened)firstProtected=cargo;
  }
  if(firstProtected)break;
 }
 assert.equal(lastRoute,'diversion');
 assert.equal(s.strategy.route,'diversion');
 assert.equal(s.strategy.screened,true);
 assert.ok(firstProtected?.screened);
 assert.equal(firstProtected.routeId,'diversion');
 assert.ok(seen.size>=5);
 assert.ok(s.ore>=0);
 assert.ok(regionalSupplyValid(s,s.clock));
});

test('known map tracks show a changed route but do not reveal unknown industrial coordinates',()=>{
 const world=new World(),s=world.regionalSupply,
  game={world,player:{x:0,y:0}};
 s.strategy.route='diversion';
 assert.doesNotMatch(renderRegionAtlas(game),/Снабжение севера: путь изменён/);
 const source=world.stations.get(SUPPLY.mineId);source.discovered=true;
 assert.match(renderRegionAtlas(game),/Снабжение севера: путь изменён после потерь/);
 const svg=regionalMapOverlay(game,p=>p,()=>true);
 assert.ok(svg.includes('39000.0 -16500.0'));
});

test('liberation changes not only enemy quantity but also the composition of patrols',()=>{
 const world=new World(),p={x:35000,y:7000},late=openingThreat(1400,12);
 world.regionalSupply.delivered=5; // Five actual arrivals would fund the heavy-ship tier.
 const before=regionalCampaignPressure(late,world,p);
 assert.ok(before.types.includes('gunship'));
 const depot=world.stations.get(SUPPLY.militaryId);
 depot.enemy=false;depot.captured=true;strategicCapture(world,depot,0);
 const after=regionalCampaignPressure(late,world,p);
 assert.ok(after.cap<before.cap&&after.interval>before.interval);
 assert.ok(after.groupSize<=2);
 assert.deepEqual(after.types,['scout','fighter']);
 assert.deepEqual(regionalCampaignPressure(late,world,{x:90000,y:0}),late);
});
