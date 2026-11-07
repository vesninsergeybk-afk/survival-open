import {RuntimeHarness} from './runtime-game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CORRIDOR_OPERATION,corridorPosition,createCorridorOperation,
 corridorOffer,corridorPatrolModifier,chooseOperationLead,corridorAmbush,corridorScanBonus} from '../operations.js';
import {baseOffer,renderBasePanel,eligibleContractProgress} from '../base-panel.js';
import {CARRIER_INTERCEPTION} from '../carrier-interception.js';
import {World} from '../world.js';
import {baseNames,RULES} from '../balance.js';
import {renderWorldMap} from '../map-panel.js';
import {finishSortie,appendSortieReport} from '../sortie-economy.js';

const home={id:'0:0',x:360,y:-85,type:'dock',active:true};
const state=(extra={})=>({
 ore:70,hp:88,maxHp:110,shield:0,activeBases:1,connectedBases:1,connected:true,
 allies:0,droneRoles:[],droneDamage:0,charges:0,transfers:[],contract:null,
 network:{armor:0,armament:0,engine:0,strikePower:0},...extra
});
test('the special mission belongs only to the home dock and cannot be repeated',()=>{
 assert.equal(corridorOffer({...home,active:false},null).status,'locked');
 assert.equal(corridorOffer(home,null).status,'available');
 assert.equal(corridorOffer({...home,corridorSecured:true},null).status,'complete');
 assert.equal(corridorOffer({...home,id:'1:0'},null),null);
 assert.equal(corridorOffer({...home,type:'arsenal'},null),null);
 const op=createCorridorOperation(home);
 assert.equal(corridorOffer(home,op).status,'active');
 assert.equal(op.maxHp,CORRIDOR_OPERATION.maxHp);
 assert.equal(op.hp,op.maxHp);
 assert.equal(op.id,CORRIDOR_OPERATION.id);
 assert.ok(Math.hypot(op.x-home.x,op.y-home.y)>1100);
 assert.ok(Math.hypot(op.x-home.x,op.y-home.y)<1500);
 assert.equal(eligibleContractProgress(op,'kill',{type:'fighter'}),false,
  'random kills must never count toward a jammer operation');
});
test('the operation site does not overlap existing asteroids or stations',()=>{
 const world=new World(),pos=corridorPosition(world.home);
 const rocks=world.nearbyRocks(pos.x,pos.y,120);
 assert.ok(rocks.every(r=>Math.hypot(r.x-pos.x,r.y-pos.y)>r.r+80));
 assert.ok(world.nearbyStations(pos.x,pos.y,250).every(b=>b.id===world.home.id));
});
test('a completed corridor changes patrol pressure only near its own dock',()=>{
 assert.equal(corridorPatrolModifier(home,home.x,home.y),1);
 assert.equal(corridorPatrolModifier({...home,corridorSecured:true},home.x,home.y),1.17);
 assert.equal(corridorPatrolModifier({...home,corridorSecured:true},home.x+1300,home.y),1);
});
const src=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const start=src.indexOf(' updateCorridorReturn(');
const end=src.indexOf('\n baseState(){',start);
assert.ok(start>0&&end>start,'operation lifecycle must be present in game');
const Ops=RuntimeHarness;
const fake=(nextStations=[])=>{
 const b={...home},op=createCorridorOperation(b);
 const value={ore:0,data:0},messages=[],game=new Ops();
 Object.assign(game,{world:{home:b,stations:new Map([[b.id,b]]),nearbyRocks:()=>[],
   nearbyStations:()=>nextStations,discovered:new Set()},
  operation:op,dead:false,player:{x:op.x+800,y:op.y,ore:0},
  time:20,enemies:[],enemySerial:0,groupSerial:0,waypoint:{id:op.id},
  notice:(msg)=>messages.push(msg),heritage:{vfx:{shipExplosion:()=>{},nova:()=>{}},
   station:()=>{}},cockpit:{resourceGain:(ore)=>{value.ore+=ore}},
  collect:(drop)=>{value.data+=drop.value}});
 return {game,b,op,value,messages};
};
test('the escort appears at the real target, not at unrelated kills',()=>{
 const {game,op}=fake();
 game.updateCorridor();assert.equal(game.enemies.length,0);
 game.player.x=op.x+500;game.updateCorridor();
 assert.equal(game.enemies.length,2);
 assert.ok(game.enemies.every(e=>Math.hypot(e.x-op.x,e.y-op.y)<210));
 game.updateCorridor();assert.equal(game.enemies.length,2);
 game.time+=33;game.updateCorridor();assert.equal(game.enemies.length,3);
 game.time+=50;game.updateCorridor();assert.equal(game.enemies.length,3,
  'reinforcements are bounded: no infinite mission-only wave farm');
});
test('a committed EMP pulse continues after retreat, is harmless outside its ring and then overheats',()=>{
 const {game,op}=fake();let damage=0;
 game.hurt=value=>{damage+=value};
 game.player.x=op.x+100;
 game.updateCorridor(2);
 assert.equal(damage,0);
 assert.equal(op.pulseCharge,2);
 assert.equal(op.pulseLocked,true,'after a clear warning the emitter commits to its next pulse');
 game.player.x=op.x+500;game.updateCorridor(2);
 assert.equal(op.pulseCharge,4,'flying away must not silently cancel an already committed pulse');
 game.updateCorridor(.25);
 assert.equal(damage,0,'the pulse is safe outside the indicated danger radius');
 assert.equal(op.pulseCharge,0);
 assert.ok(op.overheatedUntil>game.time,'discharge opens a short vulnerability window');
 game.player.x=op.x+100;game.updateCorridor(1);
 assert.equal(op.pulseCharge,0,'an overheated emitter does not restart immediately');
 game.time=op.overheatedUntil+.1;
 game.updateCorridor(op.pulsePeriod-.1);
 assert.equal(damage,0,'the next charge still has a readable warning interval');
 game.updateCorridor(.12);
 assert.equal(damage,op.pulseDamage);
 assert.equal(op.pulseCharge,0);
 game.completeCorridor();game.updateCorridor(30);
 assert.equal(damage,op.pulseDamage,'a destroyed jammer never pulses');
});
test('the destroyed jammer starts a return journey without paying prematurely',()=>{
 const {game,b,op,value}=fake();
 game.completeCorridor();
 assert.equal(op.phase,'return');
 assert.equal(op.hp,0);
 assert.equal(b.corridorSecured,undefined);
 assert.equal(game.operation,op);
 assert.equal(game.waypoint.id,op.id);
 assert.equal(game.waypoint.x,b.x);
 assert.equal(game.waypoint.y,b.y);
 assert.equal(game.player.ore,0);
 assert.equal(value.ore,0);
 assert.equal(value.data,0);
 assert.equal(corridorOffer(b,op).phase,'return');
 assert.equal(corridorOffer({...b,corridorMission:op},null).phase,'return',
  'the delivery phase must survive postponing the mission');
});
test('the radio scout creates one avoidable ambush only if it transmits',()=>{
 const {game,b,op}=fake();
 game.player.x=op.x+500;game.player.y=op.y;game.updateCorridor();
 assert.equal(op.radio,'calling');
 game.time=op.radioAt+.1;game.updateCorridor();assert.equal(op.radio,'sent');
 game.completeCorridor();
 const ambush=corridorAmbush(b,op);
 const count=game.enemies.length;
 game.player.x=ambush.x;game.player.y=ambush.y+CORRIDOR_OPERATION.ambushRadius+10;
 game.updateCorridor(1);assert.equal(game.enemies.length,count);
 game.player.x=ambush.x;game.player.y=ambush.y;
 game.updateCorridor(1);
 assert.equal(game.enemies.length,count+2);
 assert.ok(game.enemies.slice(-2).every(e=>e.scenario==='corridor-pursuit'));
 game.updateCorridor(4);
 assert.equal(game.enemies.length,count+2,'the pursuit cannot be farmed repeatedly');
 assert.equal(game.operation.phase,'return');
 const quiet=fake();quiet.game.player.x=quiet.op.x+500;quiet.game.player.y=quiet.op.y;
 quiet.game.updateCorridor();quiet.game.enemies.find(e=>e.corridorCourier).hp=0;
 quiet.game.updateCorridor();assert.equal(quiet.op.radio,'blocked');
 quiet.game.completeCorridor();Object.assign(quiet.game.player,corridorAmbush(quiet.b,quiet.op));
 quiet.game.updateCorridor();assert.equal(quiet.op.pursuitStarted,false);
 quiet.game.deliverCorridor();assert.equal(corridorScanBonus(quiet.b),500);
});
test('a radio call goes through on time while the operation is postponed',()=>{
 const {game,b,op}=fake();b.corridorMission=op;
 Object.assign(game.player,{x:op.x+450,y:op.y});game.updateCorridor();
 const scout=game.enemies.find(e=>e.serial===op.radioSerial);
 game.operation=null;game.time=op.radioAt+1;game.updateCorridor();
 scout.hp=0;game.stopCorridorRadio(op);
 assert.equal(op.radio,'sent');assert.equal(scout.missionFlight,undefined);
 assert.equal(game.operation,null);
});
test('a blocked ambush can retry without marking the encounter spent or spawning on the pilot',()=>{
 const {game,b,op}=fake();op.radio='sent';game.completeCorridor();
 Object.assign(game.player,corridorAmbush(b,op));
 game.enemies=Array.from({length:RULES.maxEnemies},()=>({hp:1}));
 game.updateCorridor();assert.equal(op.pursuitStarted,false);
 game.enemies=[];game.time+=1;
 game.world.nearbyRocks=(x,y)=>[{x,y,r:45,alive:true}];
 game.updateCorridor();assert.equal(op.pursuitStarted,false);
 game.world.nearbyRocks=()=>[];game.time+=1;game.updateCorridor();
 assert.equal(op.pursuitStarted,true);assert.equal(game.enemies.length,2);
 assert.ok(game.enemies.every(e=>Math.hypot(e.x-game.player.x,e.y-game.player.y)>=130));
});
test('delivery at the issuing dock pays once, clears the marker and secures the route',()=>{
 const {game,b,value}=fake();
 game.completeCorridor();
 // This is the same docking action invoked by keyboard E or the touch action button.
 const dockStart=src.indexOf('  dock(selected=null){');
 const dockEnd=src.indexOf('\n baseAction(act,role){',dockStart);
 assert.ok(dockStart>0&&dockEnd>dockStart);
 const Dock=RuntimeHarness;
 game.player.x=b.x;game.player.y=b.y;
 game.waypoint={id:b.id,x:b.x,y:b.y,label:'Сдать операцию: Ремонтный док'};
 game.overlay={hidden:true,dataset:{}};game.endInteraction=()=>{};
 game.heritage.pause=()=>{};game.heritage.ui=()=>{};game.renderDock=()=>{};
 Dock.prototype.dock.call(game,b);
 assert.equal(b.corridorSecured,true);
 assert.equal(game.operation,null);
 assert.equal(game.waypoint,null);
 assert.equal(corridorScanBonus(b),350,'skipping the scout still yields the standard exploration benefit');
 assert.equal(game.player.ore,CORRIDOR_OPERATION.rewardOre);
 assert.equal(value.ore,CORRIDOR_OPERATION.rewardOre);
 assert.equal(value.data,CORRIDOR_OPERATION.rewardData);
 game.deliverCorridor();
 assert.equal(game.player.ore,CORRIDOR_OPERATION.rewardOre,
  'returning a second time must never pay twice');
});
test('clearing the corridor reveals a nearby station as a new reason to explore',()=>{
 const station={id:'1:0',x:1500,y:150,type:'lab',active:false,discovered:false};
 const {game,value}=fake([station]);
 game.completeCorridor();
 assert.equal(station.discovered,false,'the next lead is awarded after returning');
 game.deliverCorridor();
 assert.equal(station.discovered,true);
 assert.equal(game.world.discovered.has(station.id),true);
 assert.equal(game.waypoint?.id,station.id);
 assert.equal(value.ore,CORRIDOR_OPERATION.rewardOre,
  'the exploratory lead must not duplicate the mission payout');
 assert.equal(value.data,CORRIDOR_OPERATION.rewardData);
});
test('station UI exposes a briefing, route, equipment, and network independently',()=>{
 const b={...home},st=state();
 const html=renderBasePanel(b,st);
 for(const tab of ['summary','operations','hangar','network'])
  assert.match(html,new RegExp('data-role="'+tab+'"'));
 assert.match(html,/data-act="baseTab" data-role="operations">Посмотреть задания/);
 assert.match(html,/data-act="baseMap"/);
 const jobs=renderBasePanel(b,{...st,baseTab:'operations'});
 assert.match(jobs,/data-act="acceptOperation"/);
 assert.match(jobs,/315 м/);
 assert.match(jobs,/разведчик уйдёт передавать тревогу/);
 assert.match(jobs,/Принять заказ/);
 assert.doesNotMatch(jobs,/\d+ целей/);
 const underway=renderBasePanel(b,state({baseTab:'operations',operation:createCorridorOperation(b)}));
 assert.match(underway,/Отложить · сохранить повреждения/);
 const homebound=createCorridorOperation(b);homebound.phase='return';homebound.hp=0;
 const delivery=renderBasePanel(b,state({baseTab:'operations',operation:homebound}));
 assert.match(delivery,/ОСТАЛОСЬ ВЕРНУТЬСЯ/);
 assert.match(delivery,/Награда и разведка откроются после возвращения/);
 const completed={...b,corridorSecured:true};
 assert.doesNotMatch(renderBasePanel(completed,{...st,baseTab:'operations'}),/data-act="acceptOperation"/);
 assert.match(renderBasePanel(completed,st),/ПОМЕХИ УСТРАНЕНЫ/);
});
test('the navigation map displays the actual target and the secured-route outcome',()=>{
 const world=new World();world.home.active=true;world.home.discovered=true;
 const op=createCorridorOperation(world.home);
 const game={world,player:{x:world.home.x,y:world.home.y},enemyBasesUnlocked:()=>false,
  waypoint:{id:op.id,x:op.x,y:op.y,label:'Глушитель'},operation:op,contract:null};
 const before=renderWorldMap(game);
 assert.match(before,/ВОСТОЧНЫЙ КОРИДОР/);
 assert.match(before,/Отложить операцию/);
 assert.match(before,/Глушитель/);
 op.phase='return';op.hp=0;
 game.waypoint={id:op.id,x:world.home.x,y:world.home.y,label:'Док'};
 const returnMap=renderWorldMap(game);
 assert.match(returnMap,/Док · передать данные/);
 assert.match(returnMap,/Телеметрия сохранена/);
 assert.match(returnMap,/Построить маршрут к награде/);
 world.home.corridorSecured=true;game.operation=null;
 const after=renderWorldMap(game);
 assert.match(after,/Разведка возле дока расширена на 350 м/);
 assert.match(after,/Коридор открыт/);
 world.home.corridorQuiet=true;
 const quiet=renderWorldMap(game);
 assert.match(quiet,/Разведка возле дока расширена на 500 м/);
 assert.match(quiet,/до 2700 м/);
});

test('the next lead favours a different station task without demanding a long detour',()=>{
 const origin={x:0,y:0},nearest={id:'dock',type:'dock',x:900,y:0,discovered:false,active:false},
  lab={id:'lab',type:'lab',x:1120,y:0,discovered:false,active:false},
  distant={id:'lab-far',type:'lab',x:2300,y:0,discovered:false,active:false};
 const world={nearbyStations:(x,y,r)=>[nearest,lab,distant].filter(b=>Math.hypot(x-b.x,y-b.y)<r)};
 assert.equal(chooseOperationLead(world,origin,'home','lab',2400),lab,
  'offer the next distinct special operation when its station is nearby');
 lab.discovered=true;
 assert.equal(chooseOperationLead(world,origin,'home','lab',2400),nearest,
  'do not send the player on a huge detour to force a scripted order');
 nearest.active=true;
 assert.equal(chooseOperationLead(world,origin,'home','lab',2400),distant);
 distant.enemy=true;
 assert.equal(chooseOperationLead(world,origin,'home','lab',2400),null,
  'never point a friendly story reward to an enemy installation');
});
