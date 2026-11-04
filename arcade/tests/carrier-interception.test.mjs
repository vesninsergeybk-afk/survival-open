import {RuntimeHarness} from './runtime-game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {ENEMY_TYPES} from '../ai.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';
import {missionHudText} from '../mission-feedback.js';
import {
 CARRIER_INTERCEPTION,isCarrierBase,carrierRoute,createCarrierInterception,
 carrierOffer,carrierInFlight,carrierDistanceRemaining,moveCarrierCargo,carrierPatrolModifier,
 advanceCarrierSystems,hitCarrierCargo
} from '../carrier-interception.js';

const world=new World(20261102);
const carrier=world.nearbyStations(0,0,14000,false).find(b=>b.type==='carrier'&&!b.captured);
assert.ok(carrier,'procedural world must contain a friendly carrier');
carrier.active=true;carrier.discovered=true;world.discovered.add(carrier.id);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('one carrier offers an actual moving-target mission with a stable exit',()=>{
 assert.equal(isCarrierBase(carrier),true);
 assert.equal(isCarrierBase({...carrier,enemy:true}),false);
 assert.equal(carrierOffer({...carrier,active:false},null,0).status,'locked');
 assert.equal(carrierOffer(carrier,null,0).status,'available');
 const route=carrierRoute(carrier),again=carrierRoute(carrier);
 assert.deepEqual(route,again);
 const total=distance(route[0],route[1])+distance(route[1],route[2]);
 assert.ok(total>2700&&total<3600,'authored route near 3 km');
 const op=createCarrierInterception(carrier);
 assert.equal(op.phase,'approach');
 assert.equal(op.hp,CARRIER_INTERCEPTION.maxHp);
 assert.equal(carrierDistanceRemaining(op),total);
 assert.equal(moveCarrierCargo(op,10).moved,0,'no invisible countdown before contact');
 assert.deepEqual([op.x,op.y],[route[0].x,route[0].y]);
 assert.equal(carrierOffer(carrier,op,0).status,'active');
});

test('turn is continuous, exit is visible, and movement never exceeds speed times dt',()=>{
 const op=createCarrierInterception(carrier);op.phase='pursuit';
 let previous={x:op.x,y:op.y},seenTurn=false,exited=false;
 for(let tick=0;tick<900;tick++){
  const result=moveCarrierCargo(op,.1),jump=distance(previous,op);
  assert.ok(jump<=op.speed*.1+1e-6,'cargo teleported on segment transition');
  if(result.turned)seenTurn=true;
  if(result.escaped){exited=true;break;}
  previous={x:op.x,y:op.y};
 }
 assert.ok(seenTurn&&exited);
 assert.equal(op.routeIndex,2);
 assert.ok(distance(op,op.route[2])<.001);
 assert.ok(carrierDistanceRemaining(op)<.001);
});

const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const start=gameSource.indexOf('  // A carrier operation begins');
const end=gameSource.indexOf(' // After a successful intercept',start);
const damageStart=gameSource.indexOf(" damageEnemy(e,damage,source='other',contact=null){");
const damageEnd=gameSource.indexOf(' flash(x,y,x2,y2,color=',damageStart);
assert.ok(start>0&&end>start&&damageStart>0&&damageEnd>damageStart);
const CarrierHarness=RuntimeHarness;

function scenario(){
 const base={...carrier,supplyIntercepted:false,carrierRetryAt:0,carrierMission:null};
 const scene={stations:new Map([[base.id,base]]),nearbyRocks:()=>[]};
 const op=createCarrierInterception(base);base.carrierMission=op;
 const game=new CarrierHarness(),messages=[];
 Object.assign(game,{
  world:scene,operation:op,player:{x:op.x,y:op.y,ore:0},
  enemies:[],enemySerial:0,groupSerial:0,time:1,dead:false,
  waypoint:{id:op.id,x:op.x,y:op.y},data:0,
  heritage:{vfx:{nova(){},shipExplosion(){},hullImpact(){}},play(){},station(){}},
  cockpit:{resourceGain(){}},notice:message=>messages.push(message),
  collect(item){this.data+=item.value;}
 });
 return {game,base,op,messages};
}

test('only meeting starts pursuit; two real escorts guard the moving cargo',()=>{
 const {game,op}=scenario();
 game.player.x=op.x-600;
 game.updateCarrierInterception(.1);
 assert.equal(op.phase,'approach');
 assert.equal(game.enemies.length,0);
 game.player.x=op.x-400;
 game.updateCarrierInterception(.1);
 assert.equal(op.phase,'contact');
 assert.equal(game.enemies.length,3);
 assert.ok(game.enemies.includes(op));
 const escorts=game.enemies.filter(e=>e.carrierEscort===op.baseId);
 assert.equal(escorts.length,2);
 assert.ok(escorts.every(e=>e.protect===op&&e.operationGuard));
 const old={x:op.x,y:op.y};
 game.time+=.1;game.updateCarrierInterception(.1);
 assert.ok(distance(op,old)>0);
 assert.ok(distance(op,game.waypoint)<.001,'navigation follows physical cargo');
});

test('combat stops cargo, but payout waits for a one-time return to the issuing carrier',()=>{
 const {game,base,op}=scenario();
 game.updateCarrierInterception(.02);
 game.damageEnemy(op,100,'beam');
 assert.ok(op.hp>0,'cargo remains damageable under escort');
 assert.equal(game.player.ore,0);
 game.damageEnemy(op,500,'beam');
 assert.equal(op.phase,'return');
 assert.equal(game.operation,op);
 assert.equal(game.player.ore,0);
 assert.equal(game.data,0);
 assert.equal(game.waypoint.x,base.x);
 assert.equal(game.waypoint.y,base.y);
 game.deliverCarrierInterception();
 assert.equal(base.supplyIntercepted,true);
 assert.equal(game.operation,null);
 assert.equal(game.player.ore,38);
 assert.equal(game.data,30);
 game.deliverCarrierInterception();
 assert.equal(game.player.ore,38);
 assert.equal(game.data,30);
 assert.ok(carrierPatrolModifier(base,...[op.route[0].x,op.route[0].y])>1);
 assert.equal(carrierOffer(base,null,game.time).status,'complete');
});

test('escape loses no resources and gives a finite retry window',()=>{
 const {game,base,op}=scenario();
 game.updateCarrierInterception(.02);
 op.routeIndex=1;op.x=op.route[2].x-op.speed*.05;op.y=op.route[2].y;
 // Use the route itself for a valid last segment rather than a synthetic jump.
 op.x=op.route[1].x;op.y=op.route[1].y;op.routeIndex=1;
 game.time=65;game.updateCarrierInterception(90);
 assert.equal(game.operation,null);
 assert.equal(base.supplyIntercepted,false);
 assert.equal(base.carrierMission,null);
 assert.equal(base.carrierRetryAt,65+CARRIER_INTERCEPTION.retryDelay);
 assert.equal(game.player.ore,0);
 assert.equal(game.data,0);
 assert.equal(carrierOffer(base,null,65).status,'cooldown');
 assert.equal(carrierOffer(base,null,100).status,'available');
});

test('station, tactical map, and cockpit tell the same mission truth',()=>{
 const state={ore:80,hp:110,maxHp:110,shield:0,activeBases:2,connectedBases:2,
  connected:true,allies:0,droneRoles:[],droneDamage:0,charges:0,transfers:[],
  contract:null,network:{armor:0,armament:0,engine:0,strikePower:0},
  baseTab:'operations',time:10,world};
 assert.match(renderBasePanel(carrier,state),/Перехват снабжения/);
 const op=createCarrierInterception(carrier);
 const active=renderBasePanel(carrier,{...state,operation:op});
 assert.match(active,/район встречи/i);
 const mapGame={player:{x:carrier.x,y:carrier.y},world,operation:op,
  contract:null,enemyBasesUnlocked:()=>false,
  waypoint:{id:op.id,x:op.x,y:op.y,label:'Район перехвата груза'},
  mapReturnToBase:false,docked:null,time:10};
 assert.match(renderWorldMap(mapGame),/ПЕРЕХВАТ КОНВОЯ/);
 assert.match(renderWorldMap(mapGame),/ВЫХОД КОНВОЯ|ПЕРЕХВАТ КОНВОЯ/);
 assert.match(missionHudText(mapGame),/РАЙОН ВСТРЕЧИ/);
 op.phase='pursuit';
 assert.match(missionHudText(mapGame),/ДО ВЫХОДА/);
 op.phase='return';
 assert.match(missionHudText(mapGame),/ВЕРНИТЕСЬ НА АВИАНОСЕЦ/);
});

test('existing missions and the source entrypoint remain independently wired',()=>{
 assert.match(gameSource,/this\.updateCorridor\(dt\)/);
 assert.match(gameSource,/this\.updateRelayDefense\(dt\)/);
 assert.match(gameSource,/carrierInFlight\(this\.operation\)/);
 assert.match(gameSource,/if\(!e\.interceptCargo\)updateEnemy/);
 assert.match(gameSource,/if\(e\.interceptCargo\)\{this\.drawCarrierCargo/);
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(index,/game\.js\?v=[a-z0-9-]+/);
});


test('docking at the issuing carrier actually delivers telemetry once',()=>{
 const {game,base,op}=scenario();
 game.updateCarrierInterception(.02);
 game.damageEnemy(op,900,'beam');
 assert.equal(op.phase,'return');
 const dockStart=gameSource.indexOf('  dock(selected=null){');
 const dockEnd=gameSource.indexOf('\n baseAction(act,role){',dockStart);
 assert.ok(dockStart>0&&dockEnd>dockStart);
 const Dock=RuntimeHarness;
 Object.assign(game,{overlay:{hidden:true,dataset:{}},endInteraction(){},renderDock(){}});
 game.heritage.pause=()=>{};game.heritage.ui=()=>{};
 game.player.x=base.x;game.player.y=base.y;
 Dock.prototype.dock.call(game,base);
 assert.equal(base.supplyIntercepted,true);
 assert.equal(game.operation,null);
 assert.equal(game.player.ore,CARRIER_INTERCEPTION.rewardOre);
 assert.equal(game.data,CARRIER_INTERCEPTION.rewardData);
 game.overlay.hidden=true;
 Dock.prototype.dock.call(game,base);
 assert.equal(game.player.ore,CARRIER_INTERCEPTION.rewardOre,'a second dock cannot duplicate alloy');
 assert.equal(game.data,CARRIER_INTERCEPTION.rewardData,'a second dock cannot duplicate data');
});

test('postponed telemetry stays at the carrier and can be claimed on return',()=>{
 const {game,base,op}=scenario();
 game.updateCarrierInterception(.02);
 game.damageEnemy(op,900,'beam');
 assert.equal(op.phase,'return');
 const abandonStart=gameSource.indexOf(' abandonOperation(){');
 const abandonEnd=gameSource.indexOf('\n  abandonContract(){',abandonStart);
 assert.ok(abandonStart>0&&abandonEnd>abandonStart);
 const Abandon=RuntimeHarness;
 Object.assign(game,{overlay:{hidden:false,dataset:{mode:'base'}},renderDock(){}});
 game.heritage.ui=()=>{};
 Abandon.prototype.abandonOperation.call(game);
 assert.equal(game.operation,null);
 assert.equal(game.waypoint,null);
 assert.equal(base.carrierMission,op,'captured evidence must survive postponement');
 const offer=carrierOffer(base,null,game.time);
 assert.equal(offer.status,'available');
 assert.equal(offer.phase,'return');
 assert.equal(offer.resumable,true);
 const actionStart=gameSource.indexOf(' baseAction(act,role){');
 const actionEnd=gameSource.indexOf('\n callStrike(){',actionStart);
 assert.ok(actionStart>0&&actionEnd>actionStart);
 const Accept=RuntimeHarness;
 game.docked=base;game.baseState=()=>({ore:game.player.ore,network:{},allies:0,droneRoles:[],connectedBases:1});
 Accept.prototype.baseAction.call(game,'acceptOperation','');
 assert.equal(base.supplyIntercepted,true);
 assert.equal(game.operation,null);
 assert.equal(game.player.ore,CARRIER_INTERCEPTION.rewardOre);
 assert.equal(game.data,CARRIER_INTERCEPTION.rewardData);
});
