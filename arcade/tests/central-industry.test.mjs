import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeHarness} from './runtime-game.mjs';
import {World} from '../world.js';
import {CENTRAL_INDUSTRY,centralWorkerPosition,centralIndustryValid} from '../central-industry.js';
import {advanceRegionalSupply,strategicCapture} from '../regional-supply.js';
import {updateRegionalWorld,spawnCentralRaid,hitRegionalCargo} from '../region-runtime.js';
import {combatTargets,damageTarget} from '../combat-targets.js';
import {pickDesignatedTarget} from '../target-designation.js';
import {renderRegionAtlas,regionalMapOverlay} from '../regional-map.js';

const noop=()=>{};
function game(){
 const g=new RuntimeHarness();
 Object.assign(g,{world:new World(),player:{x:0,y:0,r:19,hp:110,level:1},time:0,
  enemies:[],allies:[],enemySerial:0,groupSerial:0,activeBases:0,hacks:[],drops:[],
  vw:1200,vh:800,skillRanks:{radar:0},notices:[],
  notice:(message)=>g.notices.push(message),
  heritage:{play:noop,vfx:{hullImpact:noop,shipExplosion:noop,nova:noop}},
  addDrop:(...args)=>g.drops.push(args),grid:{query:()=>[]}});
 return g;
}
test('small stations coexist with procedural stations and appear only when explored',()=>{
 const w=new World(),source=w.stations.get(CENTRAL_INDUSTRY.sourceId);
 assert.ok(source?.enemy);assert.equal(source.discovered,false);
 assert.ok(w.nearbyStations(source.x,source.y,280).includes(source));
 assert.ok(!w.nearbyStations(0,0,3000).includes(source));
 assert.ok(w.discover(source.x,source.y,300).includes(source));
 assert.ok(w.nearbyStations(source.x,source.y,300,false).every(b=>!b.enemy));
});
test('one worker depletes actual rocks and earns bounded ore; without rocks there is no free production',()=>{
 const w=new World(),s=w.regionalSupply.central;
 const near=w.nearbyRocks(CENTRAL_INDUSTRY.sourceX,CENTRAL_INDUSTRY.sourceY,850);
 const total=near.reduce((n,r)=>n+r.hp,0);
 advanceRegionalSupply(w,300);
 assert.ok(s.produced>0);assert.ok(s.delivered>0);
 assert.ok(near.reduce((n,r)=>n+r.hp,0)<total,'mining must alter persistent asteroid HP');
 assert.ok(centralIndustryValid(s,300));
 const position=centralWorkerPosition(s.worker,300.5);
 assert.ok(Number.isFinite(position.x)&&Number.isFinite(position.y));
 const empty=new World();
 for(const r of empty.nearbyRocks(CENTRAL_INDUSTRY.sourceX,CENTRAL_INDUSTRY.sourceY,850)){
  r.alive=false;r.hp=0;
 }
 advanceRegionalSupply(empty,500);
 assert.equal(empty.regionalSupply.central.produced,0);
 assert.equal(empty.regionalSupply.central.delivered,0);
});
test('interception removes funded deliveries, is a real weapon target and cannot duplicate loot',()=>{
 const normal=new World();advanceRegionalSupply(normal,320);
 assert.ok(normal.regionalSupply.central.delivered>0);
 const g=game();
 for(let time=1;time<=320;time++){
  g.time=time;advanceRegionalSupply(g.world,time);
  for(const cargo of [...g.world.regionalSupply.central.convoys]){
   g.player.x=cargo.x;g.player.y=cargo.y;
   const item=combatTargets(g,150).find(item=>item.target===cargo);
   assert.ok(item,'cargo is targetable by ordinary weapons');
   damageTarget(g,item,200,'rail');
   hitRegionalCargo(g,cargo,200);
  }
 }
 assert.equal(g.world.regionalSupply.central.delivered,0);
 assert.ok(g.world.regionalSupply.central.intercepted>=2);
 assert.equal(g.drops.length,g.world.regionalSupply.central.intercepted*2);
});
test('capturing either station changes production or combat, without erasing cargo en route',()=>{
 const w=new World(),s=w.regionalSupply.central;
 advanceRegionalSupply(w,140);assert.equal(s.convoys.length,1);
 const cargo=s.convoys[0],source=w.stations.get(CENTRAL_INDUSTRY.sourceId);
 source.enemy=false;source.captured=true;strategicCapture(w,source,140);
 const mined=s.produced;
 advanceRegionalSupply(w,200);
 assert.equal(s.produced,mined);assert.equal(s.worker.phase,'evacuated');
 assert.ok(s.delivered>=1,'a cargo already under way can arrive');
 const prior=s.serial;advanceRegionalSupply(w,500);assert.equal(s.serial,prior);
 const second=new World();advanceRegionalSupply(second,140);
 const depot=second.stations.get(CENTRAL_INDUSTRY.depotId);
 depot.enemy=false;depot.captured=true;strategicCapture(second,depot,140);
 assert.equal(second.regionalSupply.central.reserves,0);
 assert.equal(second.regionalSupply.central.pendingRaid,null);
 advanceRegionalSupply(second,600);
 assert.equal(second.regionalSupply.central.raids,0);
 assert.equal(second.regionalSupply.central.reserves,0);
});
test('funded patrol waits for a visible warning, respects the cap and spends one reserve',()=>{
 const g=game(),s=g.world.regionalSupply.central;
 g.spawnGroup=director=>{
  for(let i=0;i<Math.min(director.groupSize,director.cap-g.enemies.length);i++)
   g.enemies.push({hp:25,scenario:'ambient'});
  return 0;
 };
 const director={cap:30,groupSize:2,types:['scout','fighter']};
 s.reserves=1;s.assemblyUntil=1;
 g.time=10;updateRegionalWorld(g,1);
 assert.ok(s.pendingRaid?.announced);
 assert.equal(spawnCentralRaid(g,director),false);
 g.time=21;assert.equal(spawnCentralRaid(g,{...director,cap:1}),false);
 assert.ok(spawnCentralRaid(g,director)>0);
 assert.equal(g.enemies.length,3,'a paid shipment adds one ship on top of the ambient pair');
 assert.equal(g.enemies.filter(e=>e.scenario==='ambient').length,2);
 assert.equal(g.enemies.filter(e=>e.scenario==='central-funded').length,1);
 assert.equal(s.raids,1);
 assert.equal(spawnCentralRaid(g,director),false);
 assert.ok(g.notices.some(text=>text.includes('патруль')));
});
test('preventing a funded patrol measurably removes one fighter, without deleting ambient pressure',()=>{
 const director={cap:10,groupSize:3,types:['scout','fighter']};
 const create=paid=>{
  const g=game(),s=g.world.regionalSupply.central;
  g.spawnGroup=d=>{
   for(let i=0;i<d.groupSize;i++)g.enemies.push({hp:25,scenario:'ambient'});
   return 0;
  };
  g.time=100;s.pendingRaid=paid?{announced:true,readyAt:90}:null;
  const funded=spawnCentralRaid(g,director);
  if(!funded)g.spawnGroup(director);
  return {count:g.enemies.length,bonus:g.enemies.filter(e=>e.scenario==='central-funded').length};
 };
 assert.deepEqual(create(true),{count:4,bonus:1});
 assert.deepEqual(create(false),{count:3,bonus:0});
});
test('the worker stays out of automatic fire until explicitly designated; destroying it halts mining',()=>{
 const g=game(),worker=g.world.regionalSupply.central.worker;
 g.player.x=worker.x+100;g.player.y=worker.y+100;
 assert.ok(!combatTargets(g,400).some(item=>item.target===worker));
 const chosen=pickDesignatedTarget(g,{x:worker.x,y:worker.y});
 assert.equal(chosen?.target,worker);
 g.designatedTarget={target:worker,expiresAt:30};
 assert.ok(combatTargets(g,400).some(item=>item.target===worker));
 damageTarget(g,chosen,100,'rail');
 assert.equal(worker.phase,'disabled');
 assert.ok(g.notices.some(text=>text.includes('добыча остановилась')));
 advanceRegionalSupply(g.world,300);
 assert.equal(g.world.regionalSupply.central.produced,0);
 assert.equal(g.world.regionalSupply.central.delivered,0);
});
test('map keeps local routes secret before discovery and reveals observed convoy only',()=>{
 const g=game(),s=g.world.regionalSupply.central;
 advanceRegionalSupply(g.world,140);
 const cargo=s.convoys[0];assert.ok(cargo);
 let html=renderRegionAtlas(g),layer=regionalMapOverlay(g,p=>p,()=>true);
 assert.ok(!html.includes('Местная промышленность'));
 assert.ok(!layer.includes('МЕСТНЫЙ ГРУЗ'));
 g.world.stations.get(CENTRAL_INDUSTRY.sourceId).discovered=true;
 html=renderRegionAtlas(g);layer=regionalMapOverlay(g,p=>p,()=>true);
 assert.ok(html.includes('Местная промышленность'));
 assert.ok(!layer.includes('МЕСТНЫЙ ГРУЗ'));
 cargo.seen=true;assert.ok(regionalMapOverlay(g,p=>p,()=>true).includes('МЕСТНЫЙ ГРУЗ'));
});
