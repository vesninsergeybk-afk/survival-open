import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {createFieldLoan} from '../field-weapons.js';
import {armContourReserve,contourFields,CONTOURS} from '../territory-system.js';
import {fireAimedRail,updateAutomaticWeapons} from '../ship-weapons.js';
import {damageTarget} from '../combat-targets.js';
import {labLogisticsIntel} from '../station-progression.js';
import {renderBasePanel} from '../base-panel.js';
import {captureCheckpoint,restoreCheckpoint,packRun,unpackRun,validateCheckpoint} from '../run-checkpoint.js';
import {spawnCentralRaid} from '../region-runtime.js';
import {createCommandState,updateStrategicCommand,assignStationInterdiction,
 updateStationInterdiction,followUpInterdiction,stationRaidValid,commandStateValid,
 STATION_INTERDICTION} from '../strategic-command.js';

const noop=()=>{};
const lab=(x=5800,y=1400)=>({id:'4:1',type:'lab',active:true,enemy:false,discovered:true,
 x,y,turrets:[],hp:800,maxHp:800});
function scene(){
 const g=game();g.time=200;g.world.nearbyRocks=()=>[];
 g.world.regionalSupply.command=createCommandState();
 const b=lab();g.world.stations.set(b.id,b);g.world.discovered.add(b.id);
 const witness={serial:1,type:'fighter',hp:58,maxHp:58,x:b.x+100,y:b.y,vx:0,vy:0,r:14};
 g.enemies=[witness];g.enemySerial=1;g.world.regionalSupply.central.intercepted=1;
 g.camera=()=>({x:g.player.x-600,y:g.player.y-400,w:1200,h:800});
 return {g,b,witness};
}
function armed(){
 const {g,b}=scene();b.x=420;b.y=0;
 const ship={serial:2,type:'gunship',scenario:'central-funded',x:220,y:0,hp:400,maxHp:400,r:22,vx:0,vy:0};
 ship.stationRaid={id:1,front:'home',stationId:b.id,x:b.x,y:b.y,issuedAt:190,
  expiresAt:315,chargeAt:196,nextPulse:0,interruptUntil:0,announced:true};
 g.world.regionalSupply.command.serial=1;g.enemies=[ship];g.grid.clear();g.grid.insert(ship);
 return {g,b,ship};
}
test('passive listening cannot reveal a laboratory to headquarters; optical contact and radio arrival are required',()=>{
 const {g,b,witness}=scene(),s=g.world.regionalSupply.command;
 g.enemies=[];updateStrategicCommand(g);assert.equal(s.reports.length,0);
 g.enemies=[witness];g.time=201;updateStrategicCommand(g);
 assert.equal(s.reports.length,1);assert.equal(s.reports[0].stationId,b.id);
 assert.ok(s.reports[0].receivedAt>g.time);
 const ship={...witness,type:'gunship',scenario:'central-funded'};g.enemies.push(ship);
 assert.equal(assignStationInterdiction(g,ship,'home'),false,'reports cannot arrive instantly');
 g.time=210;assert.equal(assignStationInterdiction(g,ship,'home'),true);
 assert.equal(g.enemies.length,2,'an order does not conjure ships');
 assert.equal(ship.stationRaid.stationId,b.id);assert.ok(commandStateValid(s,g.time));
 assert.ok(stationRaidValid(ship.stationRaid,g.time));
});
test('cover, facing, lack of transmitters and stale sightings prevent omniscient counter-orders',()=>{
 for(const reason of ['cover','facing','radio','stale']){
  const {g,b,witness}=scene(),s=g.world.regionalSupply.command;
  if(reason==='cover')g.world.nearbyRocks=()=>[{x:b.x+50,y:b.y,r:40,alive:true}];
  if(reason==='facing'){witness.vx=100;witness.vy=0;}
  if(reason==='radio'){b.x=-9000;witness.x=-8900;}
  updateStrategicCommand(g);
  if(reason!=='stale')assert.equal(s.reports.length,0,reason);
  else {
   assert.equal(s.reports.length,1);g.time+=181;
   const ship={...witness,scenario:'central-funded'};g.enemies.push(ship);
   assert.equal(assignStationInterdiction(g,ship,'home'),false);
  }
 }
});
test('a real paid sortie receives the regional order without additional free reinforcements',()=>{
 const {g,b}=scene(),pool=g.world.regionalSupply.central;
 updateStrategicCommand(g);g.time=210;g.player.x=b.x;g.player.y=b.y;
 pool.pendingRaid={announced:true,readyAt:209};
 g.spawnGroup=d=>{for(let i=0;i<d.groupSize;i++)g.enemies.push({hp:28,scenario:'ambient'});return 0;};
 const before=g.enemies.length;
 assert.ok(spawnCentralRaid(g,{cap:20,groupSize:2,types:['fighter']}));
 assert.equal(g.enemies.length,before+5);assert.equal(pool.raids,1);
 const leader=g.enemies.find(e=>e.stationRaid);assert.ok(leader);
 assert.equal(leader.type,'gunship');assert.equal(leader.stationRaid.stationId,b.id);
 assert.match(g.lastNotice,/подавить связь/);
 assert.equal(assignStationInterdiction(g,{...leader,stationRaid:null,scenario:'ambient'},'home'),false);
});
test('station PVO spends a real charge; an unopposed subsequent pulse disables actual radio coverage',()=>{
 const {g,b,ship}=armed();
 g.time=204;updateStationInterdiction(g,ship,.02);
 assert.equal(b.defense.charges,0);assert.ok(!b.suppressed);
 assert.ok(labLogisticsIntel(g.world,g.player).contacts.length>0);
 g.time=209;updateStationInterdiction(g,ship,.02);
 g.time=216;updateStationInterdiction(g,ship,.02);
 assert.equal(b.suppressed,true);assert.equal(b.suppressedUntil,230);
 assert.equal(labLogisticsIntel(g.world,g.player).contacts.length,0);
 g.time=230;ship.hp=0;updateStrategicCommand(g);
 assert.equal(b.suppressed,false);assert.ok(labLogisticsIntel(g.world,g.player).contacts.length>0);
});
test('a flux-funded decoy acts only after real PVO fails, aborts one paid order without removing the enemy ship',()=>{
 const {g,b,ship}=armed();
 const n1={...lab(1000,-700),id:'support:a',type:'dock'};
 const n2={...lab(1000,700),id:'support:c',type:'dock'};
 g.world.stations.set(n1.id,n1);g.world.stations.set(n2.id,n2);
 g.world.contours.links=[[b.id,n1.id],[n1.id,n2.id],[n2.id,b.id]];
 assert.equal(contourFields(g.world).length,1);
 g.world.contours.flux=CONTOURS.reserveCost;
 assert.equal(armContourReserve(g.world,b.id,200).ok,true);
 const previousEnemyCount=g.enemies.length;
 g.time=204;updateStationInterdiction(g,ship,.02);
 assert.equal(b.defense.charges,0);
 assert.ok(g.world.contours.reserve,'PVO gets priority; it must not waste a flux decoy');
 g.time=209;updateStationInterdiction(g,ship,.02);
 g.time=216;updateStationInterdiction(g,ship,.02);
 assert.equal(ship.stationRaid,null,'the paid jamming mission has lost its target');
 assert.equal(g.world.contours.reserve,null,'the prepared reserve cannot trigger again');
 assert.ok(!b.suppressed,'the contour and radio link survive the decoy');
 assert.equal(contourFields(g.world).length,1);
 assert.equal(g.enemies.length,previousEnemyCount,'no ship is erased, created, or funded for free');
 assert.ok(ship.hp>0);
 assert.match(g.lastNotice,/Ложный маяк/);
});
test('an unarmed flux decoy cannot be purchased during the enemy windup and used instantly',()=>{
 const {g,b,ship}=armed();
 const n1={...lab(1000,-700),id:'support:a',type:'dock'};
 const n2={...lab(1000,700),id:'support:c',type:'dock'};
 g.world.stations.set(n1.id,n1);g.world.stations.set(n2.id,n2);
 g.world.contours.links=[[b.id,n1.id],[n1.id,n2.id],[n2.id,b.id]];
 g.world.contours.flux=CONTOURS.reserveCost;
 g.time=204;updateStationInterdiction(g,ship,.02);
 g.time=209;assert.equal(armContourReserve(g.world,b.id,g.time).ok,true);
 updateStationInterdiction(g,ship,.02);
 g.time=216;updateStationInterdiction(g,ship,.02);
 assert.equal(b.suppressed,true,'the decoy is still preparing');
 assert.ok(g.world.contours.reserve,'unsuccessful protection must not burn the charge');
});
test('jamming a bridge really disconnects its downstream stations, then restores the same network',()=>{
 const {g,b}=scene(),home=g.world.home;
 b.x=home.x+1100;b.y=home.y;
 const next={...lab(),id:'5:1',x:home.x+2200,y:home.y,type:'carrier'};g.world.stations.set(next.id,next);
 assert.ok(g.world.networkTopology().linked.has(next.id));
 b.suppressed=true;b.suppressedUntil=214;
 assert.ok(!g.world.networkTopology().linked.has(next.id));
 g.time=214;updateStrategicCommand(g);
 assert.ok(g.world.networkTopology().linked.has(next.id));
 assert.ok(b.active&&next.active,'ownership and installed stations are preserved');
});
test('a surviving paid jammer can receive one follow-up target only from delivered, nearby reports',()=>{
 const {g,b}=scene(),s=g.world.regionalSupply.command;
 const relay={...lab(6060,1510),id:'5:1',type:'arsenal',relayBoost:true};
 g.world.stations.set(relay.id,relay);g.world.discovered.add(relay.id);
 const ship={serial:3,type:'gunship',scenario:'central-funded',x:5800,y:1450,
  hp:260,maxHp:260,vx:0,vy:0,stationRaid:{id:1,front:'home',stationId:b.id,
   x:b.x,y:b.y,issuedAt:200,expiresAt:325,chargeAt:null,nextPulse:0,
   interruptUntil:0,announced:true,redirected:false}};
 g.enemies=[ship];
 s.reports=[{front:'home',stationId:b.id,x:b.x,y:b.y,seenAt:200,receivedAt:205},
  {front:'home',stationId:relay.id,x:relay.x,y:relay.y,seenAt:201,receivedAt:206}];
 g.time=205;assert.equal(followUpInterdiction(g,ship),false,'the report has not arrived');
 g.time=210;assert.equal(followUpInterdiction(g,ship),true);
 assert.equal(ship.stationRaid.stationId,relay.id);
 assert.equal(ship.stationRaid.expiresAt,325,'the original sortie deadline remains');
 assert.equal(ship.stationRaid.nextPulse,221,'re-targeting requires another visible approach');
 assert.equal(followUpInterdiction(g,ship),false,'the same fighter cannot chain indefinitely');
 assert.match(g.lastNotice,/второй приказ/);
 assert.ok(stationRaidValid(ship.stationRaid,g.time));
 g.paused=true;g.player.x=g.docked.x+15;g.player.y=g.docked.y+20;
 const saved=captureCheckpoint(g,g.docked);
 assert.ok(validateCheckpoint(saved));
 const restored=game();restoreCheckpoint(restored,unpackRun(packRun(saved)));
 assert.equal(restored.enemies[0].stationRaid.stationId,relay.id);
 assert.equal(restored.enemies[0].stationRaid.redirected,true);
});

test('headquarters cannot redirect a paid jammer outside its radio network',()=>{
 const {g,b}=scene(),s=g.world.regionalSupply.command;
 const next={...lab(20350,20100),id:'8:8',relayBoost:true};
 g.world.stations.set(next.id,next);
 const ship={x:20150,y:20100,hp:200,stationRaid:{id:1,front:'home',stationId:b.id,
  x:b.x,y:b.y,issuedAt:190,expiresAt:310,chargeAt:null,nextPulse:0,
  interruptUntil:0,announced:true,redirected:false}};
 g.time=210;s.reports=[{front:'home',stationId:next.id,x:next.x,y:next.y,
  seenAt:205,receivedAt:209}];
 assert.equal(followUpInterdiction(g,ship),false);
 assert.equal(ship.stationRaid.stationId,b.id);
 assert.equal(stationRaidValid({...ship.stationRaid,redirected:4},g.time),false);
});
test('the same windup has different real solutions for plasma, aimed rail and ion',()=>{
 const ranged=armed();ranged.g.shipLoadout.slots[0]='rail';ranged.g.syncShipLoadout();ranged.g.manualRailMode=true;
 assert.ok(fireAimedRail(ranged.g,{x:ranged.ship.x,y:ranged.ship.y}).ok);
 assert.ok(ranged.ship.hp>0);assert.equal(ranged.ship.stationRaid.chargeAt,null);
 const automatic=armed();automatic.g.shipLoadout.slots[0]='rail';automatic.g.syncShipLoadout();
 updateAutomaticWeapons(automatic.g,.01,true);
 assert.equal(automatic.ship.stationRaid.chargeAt,196,'automatic rail damage alone is not a manual disruption');
 const ion=armed();ion.g.fieldLoan=createFieldLoan('ion',ion.g.docked.id,ion.g.time);
 ion.g.shipLoadout.slots[1]='ion';ion.g.syncShipLoadout();ion.ship.ionMarkUntil=220;
 assert.ok(ion.g.callIonDischarge());assert.equal(ion.ship.stationRaid.chargeAt,null);
 assert.equal(ion.g.fieldLoan.charges,3,'intercepting a windup must not consume rented ammo');
 assert.match(ion.g.lastNotice,/подготовка импульса сорвана/i);
 const chain=armed();chain.g.fieldLoan=createFieldLoan('ion',chain.g.docked.id,chain.g.time);
 chain.g.shipLoadout.slots[1]='ion';chain.g.syncShipLoadout();
 chain.g.enemies.push({...chain.ship,serial:3,x:250,stationRaid:null},{...chain.ship,serial:4,x:280,stationRaid:null});
 chain.g.enemies.forEach(e=>{e.ionMarkUntil=220;chain.g.grid.insert(e);});
 assert.ok(chain.g.callIonDischarge());assert.ok(chain.g.ionMasteryAwarded);
 assert.match(chain.g.lastNotice,/освоен.*подготовка импульса сорвана/i);
 const plasma=armed();plasma.ship.hp=8;plasma.g.player.x=plasma.ship.x-90;
 updateAutomaticWeapons(plasma.g,.01,true);
 assert.ok(plasma.ship.hp<=0,'close plasma stops the attack by destroying the carrier');
 assert.equal(updateStationInterdiction(plasma.g,plasma.ship,.02),false);
});
test('a suppressed laboratory terminal explains the outage without promising active radio or missing links',()=>{
 const {g,b}=scene();b.suppressed=true;b.suppressedUntil=214;
 const html=renderBasePanel(b,g.baseState());
 assert.match(html,/Связь этой лаборатории подавлена/);
 assert.doesNotMatch(html,/Радиоперехват работает|Для сетевых услуг подключите промежуточные/);
});
test('cover or stasis breaks the windup; leaving the mission alive does not grant an endless jammer',()=>{
 const {g,b,ship}=armed();
 g.world.nearbyRocks=()=>[{x:320,y:0,r:40,alive:true}];
 updateStationInterdiction(g,ship,.02);assert.equal(ship.stationRaid.chargeAt,null);assert.ok(!b.suppressed);
 g.world.nearbyRocks=()=>[];ship.stationRaid.chargeAt=198;ship.stasisUntil=205;
 updateStationInterdiction(g,ship,.02);assert.equal(ship.stationRaid.chargeAt,null);
 g.time=316;assert.equal(updateStationInterdiction(g,ship,.02),false);
 assert.equal(ship.stationRaid,null);assert.ok(ship.hp>0);
});
test('a checkpoint restores reports, paid orders and remaining disruption without renewing them',()=>{
 const {g,b,ship}=armed();b.suppressed=true;b.suppressedUntil=210;
 g.player.x=g.docked.x;g.player.y=g.docked.y;g.paused=true;
 const data=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.ok(validateCheckpoint(data));
 const restored=game();restoreCheckpoint(restored,data);
 assert.equal(restored.world.stations.get(b.id).suppressedUntil,210);
 assert.equal(restored.enemies[0].stationRaid.expiresAt,315);
 const corrupt=unpackRun(packRun(data));corrupt.state.enemies[0].stationRaid.stationId='missing';
 assert.equal(validateCheckpoint(corrupt),false);
 const newer=unpackRun(packRun(data));newer.world.regionalSupply.command.serial=-1;
 assert.equal(validateCheckpoint(newer),false);
});
test('a pending decoy survives a checkpoint with the same arm time; forged stations are rejected',()=>{
 const {g,b}=armed();g.world.contours.reserve={stationId:b.id,readyAt:229};
 g.world.contours.flux=3;
 g.player.x=g.docked.x;g.player.y=g.docked.y;g.paused=true;
 const data=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.equal(validateCheckpoint(data),true);
 const restored=game();restoreCheckpoint(restored,data);
 assert.deepEqual(restored.world.contours.reserve,{stationId:b.id,readyAt:229});
 assert.equal(restored.world.contours.flux,3);
 const forged=unpackRun(packRun(data));forged.world.contours.reserve.stationId='unknown:node';
 assert.equal(validateCheckpoint(forged),false);
});
test('the defense action navigates to the real threatened station and rejects a forged or expired alert',()=>{
 const {g,b,ship}=armed();g.overlay.dataset.mode='map';let route=null;
 g.setNavigationCourse=wp=>{route=wp;};
 assert.ok(g.chooseStationDefense(b.id));assert.equal(route.id,b.id);assert.equal(route.x,b.x);
 route=null;assert.equal(g.chooseStationDefense('0:0'),false);assert.equal(route,null);
 g.time=ship.stationRaid.expiresAt;assert.equal(g.chooseStationDefense(b.id),false);
});
