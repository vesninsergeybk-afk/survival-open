import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {POPULATION,advancePopulation,interceptPopulationCargo,
 populationAlarm,populationShield,damagePopulationShield,validPopulation,
 damagePopulationWorker,populationWorkersNear} from '../world-population.js';
import {updatePopulationWorld,rememberPopulationShip,drawPopulationWorld} from '../population-runtime.js';
import {createSpaceAnomalies,updateSpaceAnomalies,drawSpaceAnomalies} from '../space-anomalies.js';

const round=n=>Math.round(n*1000)/1000;
function gameAt(world,x,y,time=1){
 const player={x,y,vx:0,vy:0,hp:300,maxHp:300,r:18};
 return {world,seed:world.seed,player,time,miningNoise:0,
  enemies:[],groupSerial:0,enemySerial:0,cameraZoom:1,
  camera:()=>({x:player.x-700,y:player.y-480,w:1400,h:960}),
  notice:()=>{},hurt(damage){player.hp-=damage;},
  damageEnemy(e,dmg){e.hp=Math.max(0,e.hp-dmg);},
  addDrop:()=>{},heritage:{vfx:{},play:()=>{}}};
}
const canvas=()=>new Proxy({globalAlpha:1}, {get(target,name){
 if(name in target)return target[name];
 return ()=>{};
},set(target,key,value){target[key]=value;return true;}});

test('thirty seeded colonies contain 150 individual stations, existing territories and finite frontier',()=>{
 const a=new World(20261109),b=new World(20261109);
 assert.equal(a.population.colonies.length,30);
 assert.equal(a.populationStations.length,150);
 assert.equal(a.enemyExpansion.links.length,45);
 assert.equal(a.population.colonies.filter(c=>c.fortress).length,4);
 assert.deepEqual(a.population.colonies.map(c=>[round(c.x),round(c.y)]),
  b.population.colonies.map(c=>[round(c.x),round(c.y)]));
 assert.equal(a.nearbyStations(0,0,POPULATION.radius*2).filter(s=>s.colonyId).length,150);
 assert.equal(a.station(100,100),null);
 assert.equal(a.rockCell(250,250).length,0);
 for(const c of a.population.colonies)for(const building of c.buildings)
  assert.ok(a.stations.has(building.id));
 assert.ok(validPopulation(a.population,[...a.stations],0));
});

test('every industry spends finite ore, launches physical cargo and converts delivered loads into ships',()=>{
 const world=new World(),population=world.population;
 assert.equal(advancePopulation(world,0).length,0);
 advancePopulation(world,180);
 assert.ok(population.launched>=65,population.launched);
 assert.ok(population.arrived>=15,population.arrived);
 assert.ok(population.colonies.some(c=>c.produced>60));
 assert.ok(population.colonies.some(c=>c.delivered>0&&c.built>0));
 assert.ok(population.colonies.every(c=>c.ore<=POPULATION.oreCapacity&&c.ready<=POPULATION.maxReserve));
 assert.ok(population.convoys.length<=POPULATION.activeLimit);
 assert.ok(validPopulation(population,[...world.stations],180));
 const snapshot=JSON.stringify(population);
 advancePopulation(world,180);
 assert.equal(JSON.stringify(population),snapshot,'one economic second is never paid twice');
});

test('destroyed cargo loses its materials permanently and a captured mine stops extracting',()=>{
 const world=new World(),population=world.population;
 advancePopulation(world,23);
 const cargo=population.convoys[0];
 assert.ok(cargo,'a cargo ship has launched');
 const origin=population.colonies.find(c=>c.id===cargo.colonyId);
 cargo.hp=0;
 assert.equal(interceptPopulationCargo(world,cargo,23),true);
 assert.equal(interceptPopulationCargo(world,cargo,23),false);
 assert.equal(population.intercepted,1);
 const mine=world.stations.get(origin.id+':extractor');
 mine.enemy=false;mine.captured=true;
 const ore=origin.ore,produced=origin.produced;
 advancePopulation(world,35);
 assert.equal(origin.produced,produced,'captured mines cannot mine off-screen');
 assert.ok(origin.ore<=ore,'a mine without extraction cannot mint new cargo');
});
test('two physical miners power each mine, can be sabotaged and rebuild only from paid stock',()=>{
 const world=new World(),c=world.population.colonies[0];
 const factory=world.stations.get(c.id+':factory');
 factory.enemy=false;factory.captured=true;
 advancePopulation(world,1);
 const origin=c.miners[0];
 assert.equal(populationWorkersNear(world,origin.x,origin.y,1000).length,2);
 c.pool=5;
 for(const miner of c.miners){
  assert.ok(damagePopulationWorker(world,miner,miner.hp,2).killed);
  assert.equal(miner.hp,0);
 }
 const before=c.produced;
 advancePopulation(world,90);
 assert.equal(c.produced,before,'an unstaffed mine cannot generate ore');
 assert.equal(c.miners.filter(m=>m.hp>0).length,0,'insufficient stock blocks repairs');
 c.pool=12;
 advancePopulation(world,91);
 assert.equal(c.pool,0,'each replacement consumes six actual materials');
 advancePopulation(world,169);
 assert.equal(c.miners.filter(m=>m.hp>0).length,2);
 assert.ok(c.produced>before);
 assert.ok(validPopulation(world.population,[...world.stations],169));
});

test('patrols launch at scale from finite hangars, remember losses and receive delayed radio intelligence',()=>{
 const world=new World();
 const colony=world.population.colonies[0],game=gameAt(world,colony.x,colony.y,1);
 updatePopulationWorld(game,1);
 assert.ok(game.enemies.length>=8,'a new territory is defended by a squad, not one fighter');
 assert.ok(game.enemies.every(e=>e.populationSortieId&&e.populationManifest));
 assert.ok(colony.ready<14,'ships really leave the local reserve');
 const first=game.enemies[0],manifest=first.populationManifest,slot=first.populationSlot;
 first.hp=0;
 assert.equal(rememberPopulationShip(first),true);
 assert.equal(manifest[slot].hp,0);
 assert.equal(rememberPopulationShip(first),false);
 const sent=populationAlarm(world,colony.x,colony.y,1,'sighting');
 assert.ok(sent>0);
 assert.ok(colony.radioQueue.length>0);
 assert.equal(colony.reportedAt,-1);
 advancePopulation(world,10);
 assert.ok(colony.reportedAt>=8);
 assert.ok(colony.alarmUntil>10);
 assert.ok(validPopulation(world.population,[...world.stations],10));
});

test('citadel hulls ignore ship attacks, but two artillery-exposed shield sectors open a breach',()=>{
 const world=new World(),c=world.population.colonies.find(c=>c.fortress);
 const station=world.stations.get(c.id+':factory');
 assert.ok(populationShield(world,station,0));
 assert.equal(damagePopulationShield(world,station,100,0,'player').blocked,true);
 assert.deepEqual(c.shield.segments.map(s=>s.hp),[650,650,650]);
 for(let i=0;i<2;i++){
  const angle=c.shield.segments[i].angle;
  const target={colonyId:c.id,x:c.x+Math.cos(angle)*1000,y:c.y+Math.sin(angle)*1000};
  damagePopulationShield(world,target,650,0,'artillery');
 }
 assert.equal(c.shield.breachUntil,75);
 assert.equal(populationShield(world,station,10),null);
 assert.equal(damagePopulationShield(world,station,50,10,'player').blocked,false);
 advancePopulation(world,87);
 assert.ok(c.pool>=0);
 assert.ok(c.shield.segments.some(s=>s.hp>0));
});

test('anomalies are seeded, warned, renderable and cause actual reversible environmental effects',()=>{
 const world=new World(20261109),fields=world.anomalies;
 assert.equal(fields.length,25);
 assert.deepEqual(fields,createSpaceAnomalies(20261109));
 const gravity=fields.find(f=>f.type==='gravity');
 const g=gameAt(world,gravity.x+240,gravity.y,40);
 const before=g.player.vx;
 updateSpaceAnomalies(g,.5);
 assert.ok(g.player.vx<before,'gravity pulls toward the core');
 drawSpaceAnomalies(g,canvas(),g.camera());
 drawPopulationWorld(g,canvas(),g.camera());
 const wreck=fields.find(f=>f.type==='wrecks'),salvage=[];
 g.player.x=wreck.x+70;g.player.y=wreck.y;g.time=135;
 g.addDrop=(...args)=>salvage.push(args);
 updateSpaceAnomalies(g,.1);updateSpaceAnomalies(g,.1);
 assert.equal(salvage.length,1,'the same wreck cannot be farmed each frame');
});
