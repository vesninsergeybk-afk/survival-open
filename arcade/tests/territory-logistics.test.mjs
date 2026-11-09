import test from 'node:test';
import assert from 'node:assert/strict';
import {createContours,connectContour,advanceContours,contourFields} from '../territory-system.js';
import {fieldDepths,fieldFluxMultiplier,weightedContourProduction,
 stationFluxUpgradeOffer,buyStationFluxUpgrade,advanceFluxMaintenance,validFluxEconomy} from '../territory-economy.js';
import {FLUX_DEPOT,depotOffer,deployDepot,advanceFluxDepots,
 nearestSupplyDepot,takeDepotFlux,validFluxDepots,depotUpgradeOffer,upgradeDepot} from '../flux-depots.js';
import {deployArtillery,advanceFluxArtillery,steerGuidedShell,validFluxArtillery} from '../flux-artillery.js';
import {artilleryShotUnits,artilleryShotFlux,artilleryShellDamage} from '../turret-growth.js';
import {ensureStationDefense,defenseStatus} from '../network-defense.js';
import {hitFriendlyShip} from '../enemy-shot-targets.js';

function fixture(){
 const stations=new Map([['A',0,0],['B',1600,0],['C',600,1400]].map(
  ([id,x,y])=>[id,{id,x,y,active:true,enemy:false,suppressed:false,turrets:[],type:'dock'}]));
 const world={stations,contours:createContours(),nearbyStations(x,y,r){
  return [...stations.values()].filter(s=>Math.hypot(s.x-x,s.y-y)<r);}};
 for(const [a,b]of [['A','B'],['B','C'],['C','A']])assert.ok(connectContour(world,a,b).ok);
 world.contours.trials.completed=1;world.contours.flux=100;
 const player={x:500,y:300,ore:200},point={x:700,y:300};
 return {world,player,point};
}

test('a surrounded interior triangle produces more flux than exposed border triangles',()=>{
 const fields=[{id:'center',vertices:['A','B','C'],area:1e6},
  {id:'outer1',vertices:['B','A','D'],area:1e6},
  {id:'outer2',vertices:['C','B','E'],area:1e6},
  {id:'outer3',vertices:['A','C','F'],area:1e6}];
 const world={stations:new Map()};
 assert.deepEqual(fieldDepths(fields),[1,0,0,0]);
 assert.equal(fieldFluxMultiplier(world,fields[0],1),1.48);
 assert.ok(weightedContourProduction(world,fields)>8*Math.sqrt(4));
 assert.equal(fieldDepths(fields.slice(1))[0],0);
});

test('station extractor, relay and defense are paid once and cannot exceed rank three',()=>{
 const {world}=fixture(),base=world.stations.get('A');
 const start=weightedContourProduction(world,contourFields(world));
 for(const key of ['extractor','relay','defense']){
  world.contours.flux=300;
  for(let level=1;level<=3;level++){
   const quote=stationFluxUpgradeOffer(world,base,key),before=world.contours.flux;
   assert.ok(quote.ok,key+' rank '+level);
   assert.equal(buyStationFluxUpgrade(world,base,key).level,level);
   assert.equal(before-world.contours.flux,quote.flux);
  }
  assert.equal(stationFluxUpgradeOffer(world,base,key).ok,false);
 }
 assert.ok(weightedContourProduction(world,contourFields(world))>start);
 assert.equal(defenseStatus(base,true,1).capacity,5);
 assert.equal(validFluxEconomy(world.contours,world.stations),true);
 base.fluxInfrastructure.defense=8;
 assert.equal(validFluxEconomy(world.contours,world.stations),false);
});

test('continuous upkeep cannot create negative flux or an unrecoverable debt',()=>{
 const state=createContours();state.flux=.1;
 advanceFluxMaintenance(state,2,60);
 assert.equal(state.flux,0);assert.ok(state.maintenanceDebt>0);
 assert.equal(state.territoryPowered,false);
 for(let i=0;i<100;i++)advanceFluxMaintenance(state,2,60);
 assert.ok(state.maintenanceDebt<=.5);
 state.flux=1;advanceFluxMaintenance(state,2,.1);
 assert.equal(state.territoryPowered,true);
 assert.ok(state.flux>=0);
 advanceFluxMaintenance(state,0,1);
 assert.equal(state.maintenanceDebt,0);
});

test('a flux depot stores only paid incoming packets, with finite local capacity',()=>{
 const {world,player,point}=fixture();
 assert.ok(depotOffer(world,player,point).ok);
 const built=deployDepot(world,player,point,0);
 assert.ok(built.ok,built.reason);assert.equal(world.contours.flux,95);
 const depot=built.depot;
 assert.equal(depot.stored,0);
 assert.equal(nearestSupplyDepot(world,point,4),null);
 for(let i=1;i<=1000;i++)advanceFluxDepots(world,i*.1,.1);
 const inFlight=world.contours.fluxDepotPackets.reduce((s,p)=>s+p.amount,0);
 assert.ok(depot.stored>0);assert.ok(depot.stored<=depotCapacityValue(depot));
 assert.ok(Math.abs(95-world.contours.flux-depot.stored-inFlight)<1e-7);
 assert.equal(validFluxDepots(world.contours),true);
 const before=depot.stored;
 assert.ok(takeDepotFlux(depot,.25));assert.equal(depot.stored,before-.25);
 assert.equal(takeDepotFlux(depot,100),false);
});
function depotCapacityValue(t){return FLUX_DEPOT.capacity+8*(t.level||0);}

test('a nearby artillery battery consumes local depot stores and keeps treasury accounting exact',()=>{
 const {world,player,point}=fixture();
 const depot=deployDepot(world,player,point,0).depot;
 depot.readyAt=0;depot.stored=6;
 const battery=deployArtillery(world,player,{x:900,y:450},0,0);
 assert.ok(battery.ok,battery.reason);
 const turret=battery.turret;
 const game={world,player,enemies:[],time:0,vw:1200,
  damageEnemy(){},hitTurret(){},hitEnemyBase(){}};
 const treasury=world.contours.flux;
 for(let i=1;i<=200;i++){game.time=i*.05;advanceFluxArtillery(game,.05);}
 assert.ok(depot.stored<6,'a usable warehouse must fund actual battery packets');
 assert.equal(world.contours.flux,treasury,'a turret cannot charge the treasury again for warehouse fuel');
 assert.ok(turret.ammo>0);
 assert.equal(validFluxDepots(world.contours),true);
});

test('depot improvements increase supply coverage and are paid, capped and validated',()=>{
 const {world,player,point}=fixture();const depot=deployDepot(world,player,point,0).depot;
 depot.readyAt=0;world.contours.flux=150;
 assert.ok(depotUpgradeOffer(world,player,depot,1).ok);
 const before=world.contours.flux;
 assert.equal(upgradeDepot(world,player,depot,1).level,1);
 assert.equal(before-world.contours.flux,6);
 assert.equal(depotCapacityValue(depot),20);
 assert.equal(validFluxDepots(world.contours),true);
 depot.level=9;assert.equal(validFluxDepots(world.contours),false);
});

test('the powered field harvest continues even when maintenance temporarily suspends defenses',()=>{
 const {world}=fixture();world.contours.flux=0;
 for(let i=0;i<360;i++)advanceContours(world,i*.5,.5,[],null);
 assert.ok(world.contours.delivered>0,'energy outage must not permanently stop production');
 assert.ok(world.contours.flux>=0);
});

test('station PVO uses purchased reactor capacity without free instant reloads',()=>{
 const {world}=fixture(),base=world.stations.get('A');
 const defense=ensureStationDefense(base,true,0);
 assert.equal(defense.charges,1);
 base.fluxInfrastructure={defense:2};
 ensureStationDefense(base,true,1);
 assert.equal(defenseStatus(base,true,1).capacity,4);
 assert.equal(defense.charges,1,'purchased capacity should not create free ammunition');
 ensureStationDefense(base,true,60);
 assert.equal(defense.charges,4);
});

test('enemy fire destroys a stocked warehouse once, making supply infrastructure vulnerable',()=>{
 const {world,player,point}=fixture(),depot=deployDepot(world,player,point,0).depot;
 depot.readyAt=0;depot.stored=3;
 let explosions=0;
 const game={world,time:7,allies:[],artilleryDecoys:[],support:{missions:[]},
  heritage:{vfx:{shipExplosion(){explosions++;},hullImpact(){}},play(){}}};
 const shot={x:depot.x,y:depot.y,r:4,damage:100,alive:true};
 assert.equal(hitFriendlyShip(game,shot),true);
 assert.equal(shot.alive,false);
 assert.equal(depot.hp,0);assert.equal(explosions,1);
 assert.equal(nearestSupplyDepot(world,point,7),null);
 assert.equal(hitFriendlyShip(game,shot),false,'one shot cannot be applied twice');
});

test('automatic missile guidance spends additional flux and cannot snap to a new target',()=>{
 const turret={kind:'flux-artillery',branches:{seeker:2}};
 assert.equal(artilleryShotUnits(turret),3);
 assert.equal(artilleryShotFlux(turret),.75);
 assert.ok(artilleryShellDamage(turret)>artilleryShellDamage({kind:'flux-artillery'}));
 const enemy={serial:17,x:250,y:80,hp:50,converted:false};
 const game={enemies:[enemy]},shell={targetX:200,targetY:50,
  lockX:200,lockY:50,guidanceRank:2,trackSerial:17};
 assert.equal(steerGuidedShell(game,shell,.1),true);
 assert.ok(shell.targetX>200&&shell.targetX<=enemy.x);
 enemy.x=900;const old=shell.targetX;
 assert.equal(steerGuidedShell(game,shell,.1),false);
 assert.equal(shell.targetX,old);
 game.enemies.push({serial:18,x:201,y:52,hp:40});
 enemy.hp=0;assert.equal(steerGuidedShell(game,shell,.1),false);
 const {world,player,point}=fixture();
 const built=deployArtillery(world,player,point,0,0);
 assert.ok(built.ok);
 built.turret.branches.seeker=3;
 assert.equal(artilleryShotFlux(built.turret),1.25);
 assert.equal(validFluxArtillery(world.contours),true);
});
