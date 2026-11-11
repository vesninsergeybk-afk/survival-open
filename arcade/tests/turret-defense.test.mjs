import test from 'node:test';
import assert from 'node:assert/strict';
import {connectContour,createContours} from '../territory-system.js';
import {deployArtillery,validFluxArtillery} from '../flux-artillery.js';
import {deploySupport,advanceFluxSupports,validFluxSupports} from '../flux-supports.js';
import {buyTurretBranch} from '../turret-growth.js';
import {advanceTurretDefenses,damageFriendlyTurret,turretShieldCapacity}
 from '../turret-defense.js';
import {turretRepairQuote,repairTurret,repairableTurret} from '../turret-repair.js';

function fixture(){
 const stations=new Map([['A',0,0],['B',1600,0],['C',600,1400]]
  .map(([id,x,y])=>[id,{id,x,y,active:true,enemy:false,suppressed:false,turrets:[]}]));
 const world={stations,contours:createContours(),nearbyStations(x,y,r){
  return [...stations.values()].filter(s=>Math.hypot(x-s.x,y-s.y)<r);}};
 for(const [a,b] of [['A','B'],['B','C'],['C','A']])
  assert.ok(connectContour(world,a,b).ok);
 world.contours.trials.completed=1;world.contours.flux=250;
 world.contours.turretSlotRank=2;
 const player={x:500,y:300,ore:1200,hp:100};
 const game={world,player,enemies:[],time:5,vw:1200,heritage:{play(){},vfx:{nova(){},shipExplosion(){}}},
  notice(message){this.lastNotice=message;}};
 return {world,player,game};
}

test('powered turret absorbs initial hits; sustained gunfire cannot recharge its screen',()=>{
 const {world,player,game}=fixture();
 const turret=deployArtillery(world,player,{x:700,y:300},0).turret;
 advanceTurretDefenses(game,.1);
 const cap=turretShieldCapacity(turret),hp=turret.hp,initialFlux=world.contours.flux;
 assert.equal(turret.shield,cap);
 damageFriendlyTurret(game,turret,{damage:12,kind:'fighter',x:700,y:300});
 assert.equal(turret.hp,hp);
 assert.equal(turret.shield,cap-12);
 assert.match(game.lastNotice,/ПОД ОБСТРЕЛОМ/);
 for(let second=6;second<=12;second++){
  game.time=second;
  advanceTurretDefenses(game,1);
  damageFriendlyTurret(game,turret,{damage:2,kind:'fighter',x:700,y:300});
 }
 assert.equal(turret.hp,hp);
 assert.equal(world.contours.flux,initialFlux,'no invisible regeneration during a volley');
 game.time=23;advanceTurretDefenses(game,1);
 assert.ok(turret.shield>cap-26);
 assert.ok(world.contours.flux<initialFlux,'shield recharge uses real resources');
 assert.equal(validFluxArtillery(world.contours),true);
});

test('new shields charge fully when a building goes online, not during construction',()=>{
 const {world,player,game}=fixture();
 const turret=deployArtillery(world,player,{x:700,y:300},game.time).turret;
 advanceTurretDefenses(game,.1);
 assert.equal(turret.shield,0);
 game.time=turret.readyAt+.01;advanceTurretDefenses(game,.1);
 assert.equal(turret.shield,turretShieldCapacity(turret));
 assert.equal(validFluxArtillery(world.contours),true);
});

test('an emplacement gets one paid reserve screen under sustained fire, not infinite protection',()=>{
 const {world,player,game}=fixture();
 const turret=deployArtillery(world,player,{x:700,y:300},0).turret;
 advanceTurretDefenses(game,.1);
 const initialFlux=world.contours.flux;
 for(let i=0;i<8;i++)damageFriendlyTurret(game,turret,{
  damage:22,kind:'fighter',x:710,y:300});
 assert.ok(turret.nextEmergencyScreenAt>game.time,'a reserve screen should activate');
 const nextReady=turret.nextEmergencyScreenAt;
 assert.ok(world.contours.flux<initialFlux,'reserve screen must use flux');
 assert.ok(turret.hp>0,'first focus-fire volley should not instantly destroy a gun');
 for(let i=0;i<6;i++)damageFriendlyTurret(game,turret,{
  damage:22,kind:'fighter',x:710,y:300});
 assert.equal(turret.nextEmergencyScreenAt,nextReady,
  'one volley may not repeatedly refill the emergency capacitor');
 assert.equal(validFluxArtillery(world.contours),true);
});

test('heavy siege bolts cannot activate the emergency screen',()=>{
 const {world,player,game}=fixture();
 const turret=deployArtillery(world,player,{x:700,y:300},0).turret;
 advanceTurretDefenses(game,.1);
 turret.shield=3;
 const original=world.contours.flux;
 damageFriendlyTurret(game,turret,{damage:22,kind:'siege-bolt',x:710,y:300});
 assert.equal(turret.nextEmergencyScreenAt,undefined);
 assert.ok(turret.hp<turret.maxHp);
 assert.equal(world.contours.flux,original);
});

test('a turret screen absorbs a reduced mine blast; point defence cannot shoot an explosion',()=>{
 const {world,player,game}=fixture();
 const turret=deployArtillery(world,player,{x:700,y:300},0).turret;
 advanceTurretDefenses(game,.1);
 assert.equal(buyTurretBranch(world,player,turret,'fortify',game.time).ok,true);
 const initialShield=turret.shield;
 const impact=damageFriendlyTurret(game,turret,{
  damage:22,kind:'area-blast',x:700,y:300});
 assert.equal(impact.intercepted,false);
 assert.equal(turret.shield,initialShield-22);
 assert.equal(turret.hp,turret.maxHp);
});

test('without a contour cable shields and repair stop, even with stored flux',()=>{
 const {world,player,game}=fixture();
 const turret=deploySupport(world,player,{x:700,y:300},0,'laser').turret;
 buyTurretBranch(world,player,turret,'fortify',game.time);
 buyTurretBranch(world,player,turret,'fortify',game.time);
 advanceTurretDefenses(game,.1);
 turret.hp=45;turret.shield=0;turret.lastTurretHitAt=0;
 world.stations.get('B').suppressed=true;
 game.time=30;advanceTurretDefenses(game,1);
 assert.equal(turret.hp,45);assert.equal(turret.shield,0);
 assert.equal(turret._defensePowered,false);
});

test('fortification adds interception and paid autonomous hull repair, with a real cooldown',()=>{
 const {world,player,game}=fixture();
 const turret=deployArtillery(world,player,{x:700,y:300},0).turret;
 advanceTurretDefenses(game,.1);
 const first=turretShieldCapacity(turret);
 assert.ok(buyTurretBranch(world,player,turret,'fortify',game.time).ok);
 assert.ok(turretShieldCapacity(turret)>first);
 const flux=world.contours.flux;
 const intercepted=damageFriendlyTurret(game,turret,{damage:28,kind:'fighter',x:710,y:300});
 assert.equal(intercepted.intercepted,true);
 assert.equal(world.contours.flux<flux,true);
 assert.equal(damageFriendlyTurret(game,turret,{damage:28,kind:'fighter',x:710,y:300}).intercepted,false);
 assert.equal(damageFriendlyTurret(game,turret,{damage:22,kind:'siege-bolt',x:710,y:300}).intercepted,false,
  'a heavy siege shot must not become harmless after buying the first rank');
 assert.ok(buyTurretBranch(world,player,turret,'fortify',game.time).ok);
 turret.hp=55;turret.shield=0;turret.lastTurretHitAt=game.time;
 game.time=20;const before=world.contours.flux;
 advanceTurretDefenses(game,1);
 assert.ok(turret.hp>55);
 assert.ok(world.contours.flux<before);
 assert.equal(validFluxArtillery(world.contours),true);
});

test('repair action restores damaged live turrets without replacing ammo and revives wrecks',()=>{
 const {world,player,game}=fixture();
 const turret=deploySupport(world,player,{x:700,y:300},0,'hive').turret;
 turret.hp=40;turret.ammo=3;
 player.x=700;
 assert.equal(repairableTurret(world,player),turret);
 const offer=turretRepairQuote(world,player,turret);
 assert.equal(offer.destroyed,false);
 const repaired=repairTurret(world,player,turret,game.time);
 assert.equal(repaired.ok,true);
 assert.equal(turret.hp,40+Math.ceil(turret.maxHp*.38));
 assert.equal(turret.ammo,3);
 turret.hp=0;
 const wreck=repairTurret(world,player,turret,15);
 assert.equal(wreck.destroyed,true);
 assert.equal(turret.hp,Math.ceil(turret.maxHp*.6));
 assert.equal(turret.ammo,0);
 assert.equal(turret.initialReady,false);
 assert.equal(validFluxSupports(world.contours),true);
});

test('an old saved hive converts two large drones to twelve actual microdrones',()=>{
 const {world,player,game}=fixture();
 const hive=deploySupport(world,player,{x:700,y:300},0,'hive').turret;
 hive.drones=[1,2].map(slot=>({slot,x:710+slot,y:300,hp:28,maxHp:28,r:10,
  nextShotAt:6,lastShotAt:-1,angle:0}));
 hive.initialReady=true;delete hive.droneSchema;
 assert.equal(validFluxSupports(world.contours),true);
 advanceFluxSupports(game,.1);
 assert.equal(hive.drones.filter(drone=>drone.hp>0).length,12);
 assert.equal(hive.droneSchema,2);
 assert.ok(hive.drones.every(drone=>drone.maxHp===12&&drone.r===6));
 assert.equal(validFluxSupports(world.contours),true);
});

test('all three fortification ranks keep a valid shield across different turret hull sizes',()=>{
 for(const type of ['arc','laser','hive']){
  const {world,player,game}=fixture();
  const turret=deploySupport(world,player,{x:700,y:300},0,type).turret;
  advanceTurretDefenses(game,.1);
  for(let rank=1;rank<=3;rank++){
   assert.equal(buyTurretBranch(world,player,turret,'fortify',game.time).ok,true);
   assert.ok(turret.shield<=turretShieldCapacity(turret));
   assert.equal(validFluxSupports(world.contours),true);
  }
  turret.shield=Infinity;
  assert.equal(validFluxSupports(world.contours),false);
 }
});
