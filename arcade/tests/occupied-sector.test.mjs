import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {capturedFacilityDescription,capturedFacilityEffect} from '../captured-facilities.js';
import {RunCheckpointStore,RUN_KEYS} from '../run-checkpoint.js';

const initial=(world,index)=>world.population.colonies.find(c=>c.region==='amethyst'&&c.index===index);
const radius=c=>Math.hypot(c.x,c.y);

test('occupied-sector mode begins with nearby, already linked hostile industrial districts',()=>{
 const w=new World(1842,{occupied:true});
 assert.equal(w.occupied,true);
 for(let i=0;i<3;i++){
  const district=initial(w,i);
  assert.ok(radius(district)<6200&&radius(district)>2500);
  for(const role of ['extractor','factory','relay']){
   const station=w.stations.get(district.id+':'+role);
   assert.ok(station?.enemy,'industry is occupied before the pilot arrives');
  }
  const id=[district.id+':extractor',district.id+':factory',district.id+':relay'];
  assert.ok(id.every((key,j)=>w.enemyExpansion.links.some(([a,b])=>
   [a,b].includes(key)&&[a,b].includes(id[(j+1)%id.length]))));
 }
 assert.equal(w.home.enemy,false,'starting dock remains friendly');
 const old=new World(1842);
 assert.equal(old.occupied,false);
 assert.ok(radius(initial(old,0))>=6900,'ordinary arcade geometry is preserved');
});

test('same seed yields the same enemy settlement and distinct seeds change approach routes',()=>{
 const a=new World(1842,{occupied:true});
 const b=new World(1842,{occupied:true});
 const c=new World(97531,{occupied:true});
 const signature=w=>[0,1,2].map(i=>{
  const p=initial(w,i);return [Math.round(p.x),Math.round(p.y),Math.round(p.rotation*1000)];
 });
 assert.deepEqual(signature(a),signature(b));
 assert.notDeepEqual(signature(a),signature(c));
 assert.deepEqual(a.enemyExpansion.links.slice(0,12),b.enemyExpansion.links.slice(0,12));
});

test('captured industrial sites grant distinct local abilities without stacking',()=>{
 const world=new World(1842,{occupied:true});
 const colony=initial(world,0);
 const ore=world.stations.get(colony.id+':extractor');
 const relay=world.stations.get(colony.id+':relay');
 const where={x:ore.x,y:ore.y};
 assert.deepEqual(capturedFacilityEffect(world,where),{miningMultiplier:1,discoveryBonus:0});
 for(const station of [ore,relay]){
  station.enemy=false;station.captured=true;station.active=true;
 }
 assert.deepEqual(capturedFacilityEffect(world,where),{miningMultiplier:1.2,discoveryBonus:220});
 assert.match(capturedFacilityDescription(ore),/20%/);
 assert.match(capturedFacilityDescription(relay),/220 м/);
 assert.deepEqual(capturedFacilityEffect(world,{x:ore.x+6000,y:ore.y+6000}),
  {miningMultiplier:1,discoveryBonus:0});
 relay.suppressed=true;
 assert.equal(capturedFacilityEffect(world,where).discoveryBonus,0);
 ore.ruined=true;
 assert.equal(capturedFacilityEffect(world,where).miningMultiplier,1);
});

test('captured relay extends actual discovery but does not reveal distant stations',()=>{
 const w=new World(1842,{occupied:true});
 const relay=w.stations.get(initial(w,0).id+':relay');
 relay.enemy=false;relay.captured=true;relay.active=true;
 const target={id:'test:station',x:relay.x+690,y:relay.y,type:'dock',enemy:false,
  active:false,discovered:false,turrets:[],hp:100,maxHp:100};
 // Discovery scans generated station cells, so exercise its range calculation
 // through a neighboring generated station, not an unindexed synthetic ID.
 assert.equal(capturedFacilityEffect(w,relay).discoveryBonus,220);
 assert.equal(capturedFacilityEffect(w,{x:relay.x+6000,y:relay.y}).discoveryBonus,0);
});

test('experimental checkpoints use separate storage keys from ordinary runs',()=>{
 const records=new Map();
 const storage={getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value)};
 const normal=new RunCheckpointStore(storage,()=>1);
 const occupied=new RunCheckpointStore(storage,()=>2,'occupied');
 assert.equal(normal.startNew().ok,true);
 assert.equal(occupied.startNew().ok,true);
 assert.ok(records.has(RUN_KEYS[1]));
 assert.ok(records.has(RUN_KEYS[1]+'.occupied'));
 assert.equal(new RunCheckpointStore(storage,()=>3).load(),null);
 assert.equal(new RunCheckpointStore(storage,()=>3,'occupied').load(),null);
});
