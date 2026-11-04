import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CARRIER_INTERCEPTION as C,createCarrierInterception,advanceCarrierSystems,
 moveCarrierCargo,carrierPulseState,carrierAspect,hitCarrierCargo,carrierTacticalCue} from '../carrier-interception.js';
import {createLoadout,createThermal,coolWeapons,loadoutProfile} from '../ship-loadout.js';
import {loadoutAnalysis} from '../loadout-analysis.js';
import {renderShipHangar} from '../hangar-panel.js';
import {HangarSession} from '../ship-loadout.js';
import {SpatialGrid} from '../balance.js';
import {updateAuxiliaryWeapons} from '../ship-weapons.js';
import {renderWorldMap} from '../map-panel.js';
import {World} from '../world.js';
import {createIonLoan,planIonDischarge} from '../ion-conductor.js';

// Exercise the exported runtime; omit only the DOM constructor/animation boot.
const entry=new URL('../game.js',import.meta.url);
const source=readFileSync(entry,'utf8').replace(/\nnew ArcadeGame\(\);\s*$/,'\n')
 .replace(/from '(\.[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,entry).href));
const {ArcadeGame}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const noop=()=>{};
const base={id:'audit-carrier',type:'carrier',x:0,y:0,active:true,discovered:true};
function scene(){
 const station={...base},op=createCarrierInterception(station),g=Object.create(ArcadeGame.prototype);
 const notices=[],damage=[];
 Object.assign(g,{operation:op,world:{stations:new Map([[station.id,station]]),nearbyRocks:()=>[]},
  player:{x:op.x,y:op.y,angle:0,level:1,r:19,hp:110,ore:0,data:0},
  enemies:[],enemySerial:0,groupSerial:0,time:0,dead:false,notices,damage,
  waypoint:{id:C.id,x:op.x,y:op.y},spawnClock:0,
  skillRanks:{beam:0,range:0,double:0,rocket:0},shipLoadout:createLoadout(),
  weaponThermal:createThermal(),moduleClocks:{rail:0,flak:0},beamClock:0,rocketClock:0,
  heavyCharge:null,heavyCooldown:0,holdFire:false,mining:{active:false},probeRepairing:false,
  nearArsenalBonus:false,fieldLoan:null,overchargeUntil:0,
  grid:new SpatialGrid(110),rockGrid:new SpatialGrid(140),flashes:[],missiles:[],allies:[],
  cockpit:{resourceGain:noop},heritage:{play:noop,station:noop,
   vfx:{nova:noop,hullImpact:noop,shipExplosion:noop,muzzle:noop,rocketImpact:noop}},
  notice:text=>notices.push(text),hurt:n=>damage.push(n),
  collect:item=>{g.player.data+=item.value;},nearbyEnemyBase:()=>null});
 g.weaponProfile=loadoutProfile(g.shipLoadout);
 return {g,op,station};
}
function position(op,aspect,d=100){
 const a=(op.angle||0)-Math.PI/2+(aspect==='rear'?Math.PI:aspect==='side'?Math.PI/2:0);
 return {x:op.x+Math.cos(a)*d,y:op.y+Math.sin(a)*d};
}

test('transport armor is directional; distant escorts never provide invisible damage reduction',()=>{
 for(const [aspect,expected] of [['front',45],['side',100],['rear',135]]){
  const {g,op}=scene();g.updateCarrierInterception(.01);
  Object.assign(g.player,position(op,aspect));
  for(const e of g.enemies)if(e!==op){e.x+=10000;e.y+=10000;}
  const previous=op.hp;g.damageEnemy(op,100,'beam');
  assert.equal(carrierAspect(op,g.player),aspect);
  assert.ok(Math.abs(previous-op.hp-expected)<1e-8,aspect);
 }
});
test('rear hits interrupt propulsion, but engine lockout prevents endless immobilization',()=>{
 const op=createCarrierInterception(base);op.phase='pursuit';op.hp=1e6;op.maxHp=1e6;
 advanceCarrierSystems(op,1);const origin=position(op,'rear');
 assert.equal(hitCarrierCargo(op,50,origin).engineDisabled,true);
 advanceCarrierSystems(op,.01);assert.equal(op.speed,C.speed*C.engineSpeedFactor);
 assert.equal(hitCarrierCargo(op,500,origin).engineDisabled,false);
 advanceCarrierSystems(op,C.engineDuration+.01);assert.equal(op.speed,C.speed);
 assert.equal(hitCarrierCargo(op,500,origin).engineDisabled,false);
 advanceCarrierSystems(op,C.engineCooldown);assert.equal(hitCarrierCargo(op,50,origin).engineDisabled,true);
});
test('plasma marks transport for the ion chain and a rented beam boost also affects cargo',()=>{
 const {g,op}=scene();g.updateCarrierInterception(.01);
 Object.assign(g.player,position(op,'side'));
 g.fieldLoan=createIonLoan(base.id);g.weaponProfile.ion=true;g.overchargeUntil=5;g.grid.insert(op);
 const previous=op.hp;g.updateShipWeapons(.01);
 const expected=18*1.2;assert.ok(Math.abs(previous-op.hp-expected)<1e-8);assert.ok(op.ionMarkUntil>g.time);
 const plan=planIonDischarge(g.enemies,g.player,g.time,g.fieldLoan);
 assert.equal(plan.ok,true);assert.ok(plan.targets.includes(op));
});
test('transport collisions destroy rock cover without creating alloy or mining progress',()=>{
 const {g,op}=scene();const rock={x:op.x,y:op.y,r:40,hp:50,alive:true};
 g.world.nearbyRocks=()=>[rock];const events=[];
 g.damageRock=(target,damage,x,y,kind)=>{events.push({target,damage,kind});target.alive=false;};
 g.updateCarrierInterception(.01);
 assert.equal(events.length,1);assert.equal(events[0].damage,50);assert.equal(events[0].kind,'cover');
 assert.equal(g.player.ore,0);
});
test('the warning radius is the actual damage radius; pulse hits once and then opens armor',()=>{
 for(const [distance,hits] of [[229,1],[231,0]]){
  const {g,op}=scene();g.updateCarrierInterception(.01);
  op.flightTime=C.pulseStart;op.pulseSerial=0;
  Object.assign(g.player,{x:op.x,y:op.y+distance});
  // No movement isolates the exact geometric boundary from pursuit speed.
  op.route=[{x:op.x,y:op.y},{x:op.x+10000,y:op.y},{x:op.x+20000,y:op.y}];
  op.engineDisabledUntil=1e6;op.speed=0;
  // Place the player relative to the end position of the discharge frame.
  const elapsed=C.pulseCharge+.01;
  g.player.x=op.x+C.speed*C.engineSpeedFactor*elapsed;
  g.updateCarrierInterception(elapsed);
  assert.equal(g.damage.length,hits);
  assert.equal(carrierPulseState(op).key,'vent');
  const front=position(op,'front'),previous=op.hp;
  assert.equal(hitCarrierCargo(op,20,front).damage,30);
  assert.equal(previous-op.hp,30);
  g.updateCarrierInterception(.01);assert.equal(g.damage.length,hits,'no damage every vent frame');
 }
});
test('a stationary wait loses the cargo; speed remains catchable and clocks agree at 30 and 60 FPS',()=>{
 function run(dt){
  const op=createCarrierInterception(base);op.phase='pursuit';let elapsed=0,pulses=0,warnings=0;
  for(let tick=0;tick<6000;tick++){
   const events=advanceCarrierSystems(op,dt);pulses+=!!events.discharge;warnings+=!!events.pulseWarning;
   assert.ok(op.speed<272);
   elapsed+=dt;if(moveCarrierCargo(op,dt).escaped)return {elapsed,pulses,warnings};
  }
  assert.fail('transport never reaches exit');
 }
 const a=run(1/30),b=run(1/60);
 assert.ok(a.elapsed>25&&a.elapsed<40,'bounded pursuit, not an indefinite HP sponge');
 assert.ok(Math.abs(a.elapsed-b.elapsed)<.08);assert.equal(a.pulses,b.pulses);
 assert.equal(a.warnings,b.warnings);assert.ok(a.pulses>=2);
 const waiting=createCarrierInterception(base);advanceCarrierSystems(waiting,60);
 assert.equal(waiting.flightTime,0,'approach has no hidden countdown');
});

// A controlled analytical pursuit: ideal positioning, one cargo, no rocks or
// escorts. This compares the real gun/heat/damage methods, not human difficulty.
function pursuit(aspect,distance=100,weapon='plasma',dt=1/60){
 const {g,op}=scene();op.phase='pursuit';g.enemies=[op];
 g.shipLoadout.slots=[weapon,null,null,null,null,null];g.weaponProfile=loadoutProfile(g.shipLoadout);
 for(let tick=0;tick<12000;tick++){
  g.time+=dt;g.updateCarrierInterception(dt);if(!g.operation)return {won:false,time:g.time};
  if(op.phase==='return')return {won:true,time:g.time};
  Object.assign(g.player,position(op,aspect,distance));
  g.grid.clear();g.grid.insert(op);coolWeapons(g.weaponThermal,dt,false);g.updateShipWeapons(dt);
 }
 assert.fail('pursuit did not finish');
}
test('real guns support distinct viable approaches; rear plasma is faster than armored frontal fire',t=>{
 const rear=pursuit('rear'),front=pursuit('front');
 assert.equal(rear.won,true);assert.equal(front.won,true);
 assert.ok(rear.time<front.time*.8);
 assert.equal(pursuit('rear',100,'plasma',1/30).won,true);
 const rail=pursuit('side',600,'rail');
 assert.equal(rail.won,true,'range build has a different viable approach');
 assert.equal(pursuit('side',600,'flak').won,false,'short range cannot hit a remote cargo');
 assert.equal(pursuit('front',600,'plasma').won,false);
 t.diagnostic(JSON.stringify({idealPlasmaRearSeconds:rear.time,idealPlasmaFrontSeconds:front.time,idealRail600mSeconds:rail.time}));
});
test('telemetry payout remains one-time and creates an actual post-mission breathing space',()=>{
 const {g,op,station}=scene();g.updateCarrierInterception(.02);g.damageEnemy(op,1e6,'rail');
 assert.equal(g.player.ore,0);assert.equal(op.phase,'return');
 g.deliverCarrierInterception();g.deliverCarrierInterception();
 assert.equal(g.player.ore,C.rewardOre);assert.equal(g.player.data,C.rewardData);
 assert.ok(station.supplyIntercepted);assert.ok(g.spawnClock>=10);
});
test('hangar compares distance and heat without multiplying single-target flak by its victim count',()=>{
 const ship=createLoadout(),initial=loadoutAnalysis(ship);
 assert.ok(Math.abs(initial.dps[0]-18/.63)<1e-8);assert.equal(initial.dps[2],0);
 ship.slots=['rail',null,null,null,null,null];const rail=loadoutAnalysis(ship);
 assert.equal(rail.dps[0],rail.dps[2]);
 ship.slots=['flak',null,null,null,null,null];assert.equal(loadoutAnalysis(ship).dps[0],14/1.15);
 ship.slots=['plasma','plasma','plasma','plasma','plasma',null];ship.frame=3;
 assert.ok(loadoutAnalysis(ship).heatRate>14);
 const session=new HangarSession();session.begin(createLoadout());session.draft=ship;
 const html=renderShipHangar({loadout:createLoadout(),level:14,ore:400},session);
 assert.match(html,/После применения/);assert.match(html,/без брони, укрытий и перегрева/);
 assert.match(html,/перегреется/);
});
test('a rail penetrator passes one asteroid but a second still protects the target',()=>{
 for(const count of [1,2]){
  const {g}=scene();g.operation=null;const enemy={type:'gunship',x:g.player.x+500,y:g.player.y,hp:1000,r:20};
  g.shipLoadout.slots=['rail',null,null,null,null,null];
  g.shipLoadout.specializations={rail:{path:'penetrator',rank:2}};g.weaponProfile=loadoutProfile(g.shipLoadout);
  g.grid.insert(enemy);const rocks=[150,300].slice(0,count).map(offset=>({x:g.player.x+offset,y:g.player.y,r:40,hp:500,alive:true}));
  for(const rock of rocks)g.rockGrid.insert(rock);
  const rockHits=[];g.damageRock=(r,d)=>rockHits.push({r,d});
  g.damageEnemy=(e,d)=>{e.hp-=d;};updateAuxiliaryWeapons(g,.01,true);
  assert.equal(rockHits.length,count);
  if(count===1)assert.ok(enemy.hp<1000);else assert.equal(enemy.hp,1000);
 }
});
test('missiles hit asteroid cover along their swept path instead of passing through it',()=>{
 const {g}=scene(),p=g.player,target={x:p.x+500,y:p.y,hp:100,r:20},
  rock={x:p.x+200,y:p.y,r:40,hp:100,alive:true};
 g.rockGrid.insert(rock);const impacts=[];g.damageRock=(...args)=>impacts.push(args);
 g.missiles=[{x:p.x,y:p.y,target,tx:target.x,ty:target.y,speed:1000,life:2,damage:50}];
 g.updateMissiles(.5);
 assert.equal(impacts.length,1);assert.equal(impacts[0][0],rock);
 assert.equal(g.missiles.length,0);assert.equal(target.hp,100);
});
test('secured supply remains visible on the tactical map after the active mission is cleared',()=>{
 const world=new World();const station=world.nearbyStations(0,0,14000,false).find(b=>b.type==='carrier');
 Object.assign(station,{active:true,discovered:true,supplyIntercepted:true});
 const html=renderWorldMap({player:{x:station.x,y:station.y},world,operation:null,contract:null,
  enemyBasesUnlocked:()=>false,waypoint:null});
 assert.match(html,/перехваченные маршруты снабжения/);assert.match(html,/740 м/);
});
