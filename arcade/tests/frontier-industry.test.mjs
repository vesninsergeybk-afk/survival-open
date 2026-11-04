import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeHarness} from './runtime-game.mjs';
import {World} from '../world.js';
import {FRONTIERS,FRONTIER_STORM_FIELD,FRONTIER_WRECKS,
 advanceFrontierIndustry,frontierIndustryValid,damageFrontierAsset}
 from '../frontier-industry.js';
import {advanceRegionalSupply,interceptSupply,strategicCapture,regionalSupplyValid}
 from '../regional-supply.js';
import {updateRegionalWorld,spawnFrontierRaid,hitRegionalCargo} from '../region-runtime.js';
import {combatTargets,selectTargets,damageTarget} from '../combat-targets.js';
import {pickDesignatedTarget} from '../target-designation.js';
import {renderRegionAtlas,regionalMapOverlay} from '../regional-map.js';
import {RULES} from '../balance.js';
import {openingThreat} from '../balance.js';

const noop=()=>{};
function game(region='azure'){
 const g=new RuntimeHarness(),p=FRONTIERS[region].depot;
 Object.assign(g,{world:new World(),player:{x:p.x,y:p.y,r:19,hp:110,level:1},
  time:0,enemies:[],allies:[],hacks:[],enemySerial:0,groupSerial:0,activeBases:0,
  vw:1200,vh:800,notices:[],notice:(s)=>g.notices.push(s),
  heritage:{play:noop,vfx:{hullImpact:noop,shipExplosion:noop,nova:noop}},
  drops:[],addDrop:(...d)=>g.drops.push(d),grid:{query:()=>[]}});
 return g;
}
function advance(g,seconds,{intercept=false,raid=false}={}){
 let spawned=0;
 for(let t=g.time+1;t<=seconds;t++){
  g.time=t;updateRegionalWorld(g,1);
  if(intercept)for(const c of [...g.world.regionalSupply.frontier.azure.convoys,
    ...g.world.regionalSupply.frontier.teal.convoys]){
   c.hp=0;assert.ok(interceptSupply(g.world,c,t));
  }
  if(raid&&spawnFrontierRaid(g,{...openingThreat(t,5),cap:30})){spawned++;g.enemies=[];}
 }
 return spawned;
}
test('region-specific stations occupy their intended world and preserve world station identities',()=>{
 const w=new World();
 for(const cfg of Object.values(FRONTIERS)){
  for(const id of [cfg.sourceId,cfg.depotId]){
   const b=w.stations.get(id);assert.ok(b);assert.ok(b.enemy);
   assert.ok(w.nearbyStations(b.x,b.y,220,true).includes(b));
  }
 }
 w.ensureRegionalStations();
 assert.equal([...w.stations].filter(([id])=>id.startsWith('frontier:')).length,4);
 for(const wreck of FRONTIER_WRECKS)
  assert.ok(w.nearbyRocks(wreck.x,wreck.y,190).every(r=>
   Math.hypot(r.x-wreck.x,r.y-wreck.y)>r.r+90),
  `${wreck.id} must remain visible, not hidden inside a procedural asteroid`);
});
test('azure captures real storms and moves limited energy cells through physical cargo',()=>{
 const w=new World(),cfg=FRONTIERS.azure;
 assert.ok(FRONTIER_STORM_FIELD,'the energy source must attach to a real storm');
 assert.equal(w.regionalSupply.frontier.azure.resource,0);
 const events=advanceRegionalSupply(w,900);
 const s=w.regionalSupply.frontier.azure;
 assert.ok(events.some(e=>e.network==='azure'&&e.kind==='dispatch'));
 assert.ok(s.delivered>=1&&s.launched>=1);
 assert.ok(s.resource<=cfg.capacity&&s.reserves<=2&&s.convoys.length<=1);
 assert.ok(s.history.every(e=>e.network==='azure'));
 assert.ok(regionalSupplyValid(w.regionalSupply,900));
 const snapshot=JSON.stringify(s);
 advanceFrontierIndustry(w,900);
 assert.equal(JSON.stringify(s),snapshot,'same simulation time does not duplicate production');
});
test('teal worker collects only visible, exhaustible caches; damage or capture halts supply',()=>{
 const w=new World();advanceRegionalSupply(w,480);
 const s=w.regionalSupply.frontier.teal;
 assert.ok(s.launched>=1,'a worker must finance at least one shipment');
 assert.ok(s.wrecks.some((v,i)=>v.stock<FRONTIER_WRECKS[i].stock));
 assert.ok(s.wrecks.every(v=>v.stock>=0));
 const harvested=s.wrecks.reduce((sum,c)=>sum+(c.maxStock-c.stock),0);
 assert.ok(harvested>0);
 assert.equal(damageFrontierAsset(w,s.worker,110,480),'worker');
 const before=s.launched,bank=s.resource;
 advanceRegionalSupply(w,4500);
 assert.equal(s.worker.hp,0);
 assert.ok(s.launched<=before+Math.floor(bank/FRONTIERS.teal.cost),
  'without a worker, dispatches can only spend existing material');
 assert.ok(s.resource<=bank);
 const src=w.stations.get(FRONTIERS.teal.sourceId);
 src.enemy=false;src.captured=true;
 assert.equal(strategicCapture(w,src,4500),true);
 const after=s.launched;advanceRegionalSupply(w,6000);
 assert.equal(s.launched,after);
 assert.ok(s.wrecks.reduce((sum,c)=>sum+c.stock,0)>=0);
});
test('destroying a new strategic base with the real weapon path changes regional industry',()=>{
 const g=game('azure'),cfg=FRONTIERS.azure;
 advanceRegionalSupply(g.world,600);g.time=600;
 const depot=g.world.stations.get(cfg.depotId),s=g.world.regionalSupply.frontier.azure;
 assert.ok(s.delivered>0);
 for(const turret of depot.turrets)turret.hp=0;
 const core=combatTargets(g,350).find(x=>x.target===depot);
 assert.ok(core,'a strategic base must be targetable regardless of early story levels');
 damageTarget(g,core,10000,'rail');
 assert.ok(depot.captured&&!depot.enemy);
 assert.equal(s.reserves,0);assert.equal(s.pendingRaid,null);
 const raids=s.raids;advanceRegionalSupply(g.world,1500);
 assert.equal(s.raids,raids);
});
test('intercepting shipments costs enemies reserves and awards exactly once',()=>{
 const g=game('azure'),cfg=FRONTIERS.azure;
 g.player={...g.player,...cfg.route[1]};
 let c;
 for(let t=1;t<400&&!c;t++){
  g.time=t;updateRegionalWorld(g,1);
  c=g.world.regionalSupply.frontier.azure.convoys[0];
 }
 assert.ok(c,'an energy shipment should still be in transit');
 g.player.x=c.x;g.player.y=c.y;
 const item=combatTargets(g,400).find(item=>item.target===c);
 assert.ok(item,'autofire can deliberately intercept a hostile delivery');
 hitRegionalCargo(g,c,1000);
 assert.equal(g.world.regionalSupply.frontier.azure.intercepted,1);
 assert.equal(g.drops.length,2);
 assert.equal(g.world.regionalSupply.frontier.azure.delivered,0);
 hitRegionalCargo(g,c,1000);
 assert.equal(g.drops.length,2,'same shipment cannot be rewarded twice');
});
test('alternative paths yield fewer reinforcements: capture a producer or intercept its cargo',()=>{
 for(const id of ['azure','teal']){
  const ordinary=game(id),cutSource=game(id),ambush=game(id);
  const src=cutSource.world.stations.get(FRONTIERS[id].sourceId);
  src.enemy=false;src.captured=true;
  assert.ok(strategicCapture(cutSource.world,src,0));
  const normalRaids=advance(ordinary,1500,{raid:true});
  const noSourceRaids=advance(cutSource,1500,{raid:true});
  const interceptedRaids=advance(ambush,1500,{raid:true,intercept:true});
  assert.ok(normalRaids>0,`${id}: an economy must produce observable enemies`);
  assert.equal(noSourceRaids,0,`${id}: producer elimination prevents paid raids`);
  assert.equal(interceptedRaids,0,`${id}: road ambush prevents paid raids`);
  assert.ok(ambush.world.regionalSupply.frontier[id].intercepted>=1);
  assert.ok(ordinary.enemies.length<=RULES.maxEnemies);
 }
});
test('funded patrols warn before spawning, respect director capacity, and have distinct combat roles',()=>{
 for(const id of ['azure','teal']){
  const g=game(id),s=g.world.regionalSupply.frontier[id];
  s.reserves=1;s.assemblyUntil=0;s.nextRaid=0;
  g.time=1;updateRegionalWorld(g,1);
  assert.ok(s.pendingRaid?.announced);
  assert.ok(g.notices.some(n=>n.includes(id==='azure'?'электроангар':'ремонтная верфь')));
  const director={...openingThreat(500,5),cap:30};
  assert.equal(spawnFrontierRaid(g,director),false,'warning must not be skipped');
  g.time=s.pendingRaid.readyAt;
  assert.equal(spawnFrontierRaid(g,{...director,cap:1}),false,'never break the live cap');
  assert.ok(spawnFrontierRaid(g,director),'one normal wave plus one financed specialist');
  assert.equal(g.enemies.length,director.groupSize+1);
  const specialist=g.enemies.filter(e=>e.frontierRole===id);
  assert.equal(specialist.length,1);
  assert.equal(specialist[0].type,FRONTIERS[id].reinforcement);
  assert.ok(specialist[0].hp>=specialist[0].maxHp);
  if(id==='azure')assert.equal(specialist[0].stormAdapted,true);
  else assert.equal(specialist[0].healReserve,120);
  assert.equal(spawnFrontierRaid(g,director),false,'stock cannot launch twice');
 }
});
test('teal salvage requires an explicit target; other enemies remain automatically targetable',()=>{
 const g=game('teal'),s=g.world.regionalSupply.frontier.teal;
 const wreck=s.wrecks[0];g.player.x=wreck.x;g.player.y=wreck.y;
 assert.equal(combatTargets(g,220).some(t=>t.target===wreck),false);
 const selection=pickDesignatedTarget(g,{x:wreck.x,y:wreck.y});
 assert.equal(selection?.target,wreck);
 g.designatedTarget={target:wreck,expiresAt:14};
 assert.ok(selectTargets(g,220,10).some(t=>t.target===wreck));
 g.time=15;assert.equal(combatTargets(g,220).some(t=>t.target===wreck),false);
});
test('intel and routes are learned by exploration; undiscovered convoys do not leak into UI',()=>{
 const g=game('azure');
 for(let t=1;t<400&&!g.world.regionalSupply.frontier.azure.convoys.length;t++)
  advanceRegionalSupply(g.world,t);
 let html=renderRegionAtlas(g);
 assert.ok(!html.includes('Индукционная вышка'));
 assert.ok(!html.includes('frontier-cargo-azure'));
 const cfg=FRONTIERS.azure;
 g.world.stations.get(cfg.sourceId).discovered=true;
 html=renderRegionAtlas(g);
 assert.ok(html.includes('Энергосеть разлома'));
 const overlay=regionalMapOverlay(g,p=>p,()=>true);
 assert.ok(overlay.includes('stroke-dasharray="11 6"'));
 const cargo=g.world.regionalSupply.frontier.azure.convoys[0];
 assert.ok(cargo);cargo.seen=true;
 assert.ok(renderRegionAtlas(g).includes(cargo.id));
 assert.ok(regionalMapOverlay(g,p=>p,()=>true).includes('ЭНЕРГОТРАНСПОРТ'));
});
test('migrated checkpoints never mint frontier resources from elapsed play time',()=>{
 const w=new World();delete w.regionalSupply.frontier;
 w.regionalSupply.clock=10;
 advanceRegionalSupply(w,900);
 const s=w.regionalSupply.frontier;
 assert.equal(s.azure.resource,0);
 assert.equal(s.teal.resource,0);
 assert.equal(s.azure.launched,0);assert.equal(s.teal.launched,0);
 assert.equal(s.azure.clock,900);assert.equal(s.teal.clock,900);
 assert.ok(frontierIndustryValid(s,900));
});
