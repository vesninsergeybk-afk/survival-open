import test from 'node:test';
import assert from 'node:assert/strict';
import {createContours,connectContour,advanceContours,contourFields} from '../territory-system.js';
import {stationFluxCapacity,FLUX_LOCAL_SHARE,validFluxEconomy,fieldDepths} from '../territory-economy.js';
import {deployDepot,advanceFluxDepots,depotCapacity} from '../flux-depots.js';
import {buildHive,upgradeHive,roadCrew,buildRoad,roadOffer,advanceFluxRoads,
 validFluxRoutes,hiveWorkers,hiveCargo} from '../flux-routes.js';

function worldFixture(){
 const stations=new Map(Object.entries({A:[0,0],B:[1200,0],C:[1200,1200],D:[0,1200]})
  .map(([id,[x,y]])=>[id,{id,x,y,active:true,enemy:false,suppressed:false,turrets:[],type:'dock'}]));
 const world={stations,contours:createContours(),nearbyStations(x,y,r){
  return [...stations.values()].filter(s=>Math.hypot(s.x-x,s.y-y)<=r);}};
 for(const [a,b] of [['A','B'],['B','C'],['C','D'],['D','A'],['A','C']])
  assert.ok(connectContour(world,a,b).ok,a+'—'+b);
 world.contours.trials.completed=2;world.contours.flux=200;
 const player={x:900,y:500,ore:500};
 return {world,player};
}
const totalStored=w=>[...w.stations.values()].reduce((n,s)=>n+(s.fluxStored||0),0)+
 (w.contours.fluxDepots||[]).reduce((n,s)=>n+s.stored,0)+
 (w.contours.fluxDepotPackets||[]).reduce((n,p)=>n+p.amount,0)+
 (w.contours.fluxRoadPackets||[]).reduce((n,p)=>n+p.amount,0);

test('flux collection is conserved between treasury and station reservoirs',()=>{
 const {world}=worldFixture();world.contours.flux=0;
 for(let time=1;time<=90;time++)advanceContours(world,time,1);
 const delivered=world.contours.delivered,local=[...world.stations.values()]
  .reduce((n,s)=>n+(s.fluxStored||0),0);
 assert.ok(delivered>0);
 assert.ok(Math.abs(local-delivered*FLUX_LOCAL_SHARE)<1e-5);
 assert.ok(Math.abs(world.contours.flux+local+2*.24*90/60-delivered)<1e-5);
 for(const station of world.stations.values())
  assert.ok(station.fluxStored<=stationFluxCapacity(station));
 assert.ok(validFluxEconomy(world.contours,[...world.stations]));
});

test('a warehouse gains capacity with depth and cannot accept more than its tank',()=>{
 const {world,player}=worldFixture();
 assert.deepEqual(fieldDepths(contourFields(world)),[0,0]);
 const built=deployDepot(world,player,{x:900,y:380},0);
 assert.ok(built.ok,built.reason);
 const depot=built.depot;assert.equal(depotCapacity(depot),12);
 depot.depth=2;assert.equal(depotCapacity(depot),36);
 depot.depth=0;depot.readyAt=0;depot.stored=11.75;
 for(let t=0;t<6;t++){advanceFluxDepots(world,t+1,1);advanceFluxRoads(world,t+1,1);}
 assert.ok(depot.stored<=depotCapacity(depot));
});

test('full station reservoirs do not block the treasury from buying a first warehouse',()=>{
 const {world}=worldFixture();world.contours.flux=0;
 for(const s of world.stations.values()){
  s.fluxDepth=0;s.fluxStored=stationFluxCapacity(s);
 }
 const stored=totalStored(world);
 for(let time=1;time<=200;time++)advanceContours(world,time,1);
 assert.ok(world.contours.flux>0,
  'global construction treasury must still receive its share when local tanks are full');
 assert.equal(totalStored(world),stored,'full tanks may not silently grow');
 assert.ok(world.contours.fluxSpilled>0,'excess local flux is a recorded loss');
});

test('paid roads transport actual cargo between separate triangles without duplication',()=>{
 const {world,player}=worldFixture(),a=deployDepot(world,player,{x:900,y:380},0).depot;
 player.x=350;player.y=680;
 const b=deployDepot(world,player,{x:350,y:860},0).depot;
 a.readyAt=b.readyAt=0;a.stored=8;b.stored=0;
 assert.equal(roadOffer(world,player,a,b).ok,true);
 const starting=totalStored(world),cost=world.contours.flux;
 assert.ok(buildRoad(world,player,a,b,0).ok);assert.equal(world.contours.flux,cost-3);
 for(let time=1;time<=18;time++)advanceFluxRoads(world,time,1);
 assert.ok(b.stored>0,'the next depot must receive real travelling siphons');
 assert.ok(a.stored<8);assert.ok(Math.abs(totalStored(world)-starting)<1e-7);
 assert.ok(validFluxRoutes(world.contours));
});

test('stations supply a baseline crew; building and upgrading a hive increases swarm and payload',()=>{
 const {world,player}=worldFixture(),fields=contourFields(world);
 const field=fields.find(f=>f.polygon&&f.polygon.length===3&&f.polygon.some(p=>p.x===1200&&p.y===0));
 const before=roadCrew(world,field,5);
 player.x=860;player.y=570;
 const result=buildHive(world,player,{x:1000,y:620},0);
 assert.ok(result.ok,result.reason);const hive=result.hive;
 assert.equal(hiveWorkers(hive),2);assert.equal(hiveCargo(hive),.25);
 const after=roadCrew(world,field,5);
 assert.ok(after.count>=before.count+2);
 const oldCost=world.contours.flux;
 assert.equal(upgradeHive(world,player,hive,5).level,1);
 assert.equal(world.contours.flux,oldCost-4);
 assert.equal(hiveWorkers(hive),4);assert.equal(hiveCargo(hive),.5);
 assert.equal(roadCrew(world,field,5).cargo,.5);
 assert.ok(validFluxRoutes(world.contours));
});

test('a severed road destroys the cargo rather than crediting its destination',()=>{
 const {world,player}=worldFixture(),a=deployDepot(world,player,{x:900,y:380},0).depot;
 player.x=350;player.y=680;
 const b=deployDepot(world,player,{x:350,y:860},0).depot;
 a.readyAt=b.readyAt=0;a.stored=8;
 assert.ok(buildRoad(world,player,a,b,0).ok);
 advanceFluxRoads(world,3,1);assert.ok(world.contours.fluxRoadPackets.length);
 const load=world.contours.fluxRoadPackets[0].amount;
 world.stations.get('D').suppressed=true;
 advanceFluxRoads(world,4,1);
 assert.equal(world.contours.fluxRoadPackets.length,0);
 assert.equal(b.stored,0);assert.ok(world.contours.fluxSpilled>=load);
});

test('a basic hive increases throughput on one road, even with no forks',()=>{
 const simulate=withHive=>{
  const {world,player}=worldFixture(),a=deployDepot(world,player,{x:900,y:380},0).depot;
  player.x=350;player.y=680;
  const b=deployDepot(world,player,{x:350,y:860},0).depot;
  a.readyAt=b.readyAt=0;a.stored=12;
  assert.ok(buildRoad(world,player,a,b,0).ok);
  if(withHive){
   player.x=860;player.y=570;
   const result=buildHive(world,player,{x:1000,y:620},0);
   assert.ok(result.ok);result.hive.readyAt=0;
  }
  for(let i=1;i<=80;i++)advanceFluxRoads(world,i*.1,.1);
  return b.stored+world.contours.fluxRoadPackets
   .filter(p=>p.toId===b.id).reduce((s,p)=>s+p.amount,0);
 };
 assert.ok(simulate(true)>simulate(false),
  'two newly built siphons should move more flux along a single route');
});

test('invalid roads and forged cargo cannot enter a saved run',()=>{
 const {world,player}=worldFixture(),a=deployDepot(world,player,{x:900,y:380},0).depot;
 player.x=350;player.y=680;
 const b=deployDepot(world,player,{x:350,y:860},0).depot;
 assert.ok(buildRoad(world,player,a,b,0).ok);
 assert.equal(validFluxRoutes(world.contours),true);
 const forged={...world.contours,fluxRoadPackets:[{
  roadId:world.contours.fluxRoads[0].id,fromId:a.id,toId:b.id,amount:300,
  launchedAt:2,arriveAt:3}]};
 assert.equal(validFluxRoutes(forged),false);
});
