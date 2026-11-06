import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {contourCoverOffer,selectCoverTarget,CONTOUR_COVER} from '../contour-cover.js';
import {territoryTech} from '../territory-tech.js';
import {INDUSTRIAL_BREACH,recordIndustrialBreachHit,advanceIndustrialBreaches,
 industrialBreachActive} from '../industrial-breach.js';
import {advanceRegionalSupply} from '../regional-supply.js';
import {advanceCentralIndustry} from '../central-industry.js';
import {advanceFrontierIndustry} from '../frontier-industry.js';
import {warFronts} from '../war-fronts.js';
import {drawContourWorld} from '../contour-visuals.js';
import {captureCheckpoint,packRun,unpackRun,validateCheckpoint,restoreCheckpoint} from '../run-checkpoint.js';
import {game} from './weapons-scene.mjs';

function contourWithCarrier(world){
 const carrier={...world.home,id:'100:0',x:400,y:0,type:'carrier',active:true,
  enemy:false,suppressed:false,discovered:true,turrets:[]};
 const a={...carrier,id:'100:1',x:2100,y:0,type:'dock'};
 const b={...carrier,id:'100:2',x:900,y:1600,type:'lab'};
 for(const node of [carrier,a,b])world.stations.set(node.id,node);
 world.contours.links=[[carrier.id,a.id],[a.id,b.id],[b.id,carrier.id]];
 return {carrier,a,b};
}
test('a paid wing can cover a threatened pilot only inside a field anchored by a carrier',()=>{
 const w=new World(),{carrier}=contourWithCarrier(w);
 const ship={x:1100,y:500},enemy={x:ship.x+70,y:ship.y,hp:90};
 const offer=contourCoverOffer(w,ship,[enemy],1,0);
 assert.equal(offer.ok,true);assert.equal(offer.carrier,carrier);
 assert.equal(contourCoverOffer(w,ship,[],1,0).ok,false,'no free wing against empty space');
 assert.equal(contourCoverOffer(w,ship,[enemy],0,0).ok,false,'carrier needs a paid charge');
 assert.equal(contourCoverOffer(w,{x:5000,y:5000},[enemy],1,0).ok,false,'no global strike');
 assert.equal(contourCoverOffer(w,ship,[enemy],1,8).ok,false,'cooldown preserved');
 carrier.suppressed=true;
 assert.equal(contourCoverOffer(w,ship,[enemy],1,0).ok,false,'contour fails without its carrier');
 assert.equal(CONTOUR_COVER.shots,4);
});

test('a liberated industrial depot remains a real local carrier, never a global spawn',()=>{
 const w=new World();contourWithCarrier(w);
 const player={x:1100,y:500},enemy={x:player.x+80,y:player.y,hp:100};
 const attached=w.stations.get('100:0');attached.type='dock';
 assert.equal(contourCoverOffer(w,player,[enemy],1,0).ok,false);
 const depot=w.stations.get('industry:depot');
 depot.enemy=false;depot.captured=true;depot.active=true;
 assert.equal(territoryTech(w).home,true);
 assert.equal(contourCoverOffer(w,player,[enemy],1,0).ok,true);
 assert.equal(contourCoverOffer(w,{x:depot.x+12000,y:depot.y},
  [{x:depot.x+12010,y:depot.y,hp:90}],1,0).ok,false);
});

test('intercept priority and battlefield technology follow permanent industrial capture',()=>{
 const w=new World();const p={x:1000,y:1000};
 const patrol={x:1010,y:1000,hp:90};
 const cargo={x:1210,y:1000,hp:170,regionalCargo:true};
 w.regionalSupply.convoys.push(cargo);
 assert.equal(selectCoverTarget(w,p,[patrol]).target,patrol,'before capture the closest threat wins');
 const northern=w.stations.get('north:military')||w.stations.get('regional:military')||
  warFronts(w).find(f=>f.key==='north').depot;
 northern.enemy=false;northern.captured=true;northern.active=true;
 assert.equal(selectCoverTarget(w,p,[patrol]).target,cargo,'industrial targeting is a captured capability');
 for(const key of ['azure','teal']){
  const depot=warFronts(w).find(f=>f.key===key).depot;
  depot.enemy=false;depot.captured=true;depot.active=true;
 }
 const tech=territoryTech(w);
 assert.equal(tech.azure,true);assert.equal(tech.teal,true);
 assert.equal(tech.home,false);
});

test('only real pilot turret damage while jamming opens the industrial breach',()=>{
 const w=new World(),f=warFronts(w).find(f=>f.key==='home'),depot=f.depot,t=depot.turrets[0];
 assert.equal(recordIndustrialBreachHit(w,t,100,10),null,'no jammer, no sabotage');
 depot.fluxJamUntil=140;
 assert.equal(recordIndustrialBreachHit(w,t,60,10).kind,'progress');
 assert.equal(depot.fluxBreachProgress,60);
 const event=recordIndustrialBreachHit(w,t,55,11);
 assert.equal(event.kind,'breach');assert.equal(event.front,'home');
 assert.equal(depot.fluxBreachUntil,11+INDUSTRIAL_BREACH.duration);
 assert.ok(industrialBreachActive(depot,200));
 assert.equal(recordIndustrialBreachHit(w,t,500,13),null,'cannot stack a permanent lock');
});

test('breach stops new cargo but preserves stock, cargo already in flight and paid raid',()=>{
 const w=new World(),f=warFronts(w).find(f=>f.key==='home');
 const s=w.regionalSupply.central;
 s.ore=20;s.clock=100;s.nextDispatch=101;
 s.convoys=[{id:'existing',hp:1,launchedAt:100,distance:0,speed:1,
  route:'direct',x:f.source.x,y:f.source.y}];
 s.pendingRaid={readyAt:101,announced:true};
 const before=s.ore;f.depot.fluxBreachUntil=230;
 advanceCentralIndustry(w,102);
 assert.equal(s.ore,before,'breach does not delete enemy ore');
 assert.equal(s.convoys[0].id,'existing','breach does not destroy existing convoy');
 assert.deepEqual(s.pendingRaid,{readyAt:101,announced:true},'already paid order kept');
 assert.equal(s.serial,0,'no new cargo dispatched');
});

test('northern and both frontier economies honor the same production lock',()=>{
 for(const key of ['north','azure','teal']){
  const w=new World(),f=warFronts(w).find(f=>f.key===key),s=f.pool;
  s.clock=100;s.nextDispatch=101;
  if(key==='north')s.ore=24;
  else s.resource=24;
  f.depot.fluxBreachUntil=200;
  const advance=key==='north'?advanceRegionalSupply:advanceFrontierIndustry;
  advance(w,102);
  assert.equal(s.serial,0,key+' must not launch while the depot is sabotaged');
  f.depot.fluxBreachUntil=0;
  advance(w,103);
  assert.equal(s.serial,1,key+' may launch again from its actual stock');
 }
});

test('repair uses the existing industrial pool, with guaranteed downtime and no magic refill',()=>{
 const w=new World(),f=warFronts(w).find(f=>f.key==='north');
 const depot=f.depot,pool=f.pool;
 depot.fluxBreachUntil=340;depot.fluxBreachRepairAt=205;pool.ore=0;
 assert.deepEqual(advanceIndustrialBreaches(w,204),[]);
 assert.deepEqual(advanceIndustrialBreaches(w,206),[],'empty stores cannot repair');
 const cost=Math.ceil(f.cost*INDUSTRIAL_BREACH.repairRatio);
 pool.ore=cost;
 const events=advanceIndustrialBreaches(w,207);
 assert.equal(events[0].kind,'repaired');assert.equal(events[0].cost,cost);
 assert.equal(pool.ore,0);assert.equal(depot.fluxBreachUntil,0);
});

test('capture or timeout releases the breach without spending enemy materials',()=>{
 const w=new World(),f=warFronts(w).find(f=>f.key==='teal'),p=f.pool;
 f.depot.fluxBreachUntil=120;f.depot.fluxBreachRepairAt=90;p.resource=10;
 assert.deepEqual(advanceIndustrialBreaches(w,120),[]);
 assert.equal(f.depot.fluxBreachUntil,0);assert.equal(p.resource,10);
 f.depot.fluxBreachUntil=220;f.depot.fluxBreachRepairAt=180;f.depot.enemy=false;
 advanceIndustrialBreaches(w,140);
 assert.equal(f.depot.fluxBreachUntil,0);assert.equal(p.resource,10);
});

test('breach and cover survive ordinary checkpoints, oversized forged timers fail validation',()=>{
 const g=game();const depot=g.world.stations.get('industry:depot');
 g.time=200;g.paused=true;g.player.x=g.docked.x;g.player.y=g.docked.y;
 depot.fluxJamUntil=250;depot.fluxBreachUntil=390;depot.fluxBreachRepairAt=260;
 depot.fluxBreachProgress=0;
 const save=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.ok(validateCheckpoint(save));
 const restored=game();restoreCheckpoint(restored,save);
 assert.equal(restored.world.stations.get(depot.id).fluxBreachUntil,390);
 save.world.stations.find(([id])=>id===depot.id)[1].fluxBreachUntil=9999;
 assert.equal(validateCheckpoint(save),false);
});

test('in-flight battle effects distinguish active sabotage progress from production shutdown',()=>{
 const w=new World(),depot=warFronts(w).find(f=>f.key==='home').depot;
 depot.fluxJamUntil=280;depot.fluxBreachProgress=74;
 const labels=[],ctx=new Proxy({}, {get:(o,key)=>key==='fillText'?
  (value)=>labels.push(value):typeof key==='string'&&
  ['save','restore','beginPath','arc','stroke','fill','setLineDash','moveTo',
   'lineTo','translate'].includes(key)?()=>{}:o[key],set:(o,k,v)=>(o[k]=v,true)});
 const g={world:w,time:200,visuals:{reducedMotion:true},fps:28,
  player:{x:0,y:0},support:{missions:[]}};
 const camera={x:depot.x-400,y:depot.y-400,w:800,h:800};
 drawContourWorld(g,ctx,camera);
 assert.ok(labels.includes('ПРОРЫВ 74/110'),'the player sees how much damage remains');
 labels.length=0;depot.fluxBreachProgress=0;depot.fluxBreachUntil=450;
 drawContourWorld(g,ctx,camera);
 assert.ok(labels.includes('СНАБЖЕНИЕ ОСТАНОВЛЕНО'));
 assert.ok(labels.some(x=>String(x).startsWith('РЕМОНТ ИЛИ')));
});
