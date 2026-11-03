import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CORRIDOR_OPERATION,corridorPosition,createCorridorOperation,
 corridorOffer,corridorPatrolModifier} from '../operations.js';
import {baseOffer,renderBasePanel,eligibleContractProgress} from '../base-panel.js';
import {World} from '../world.js';
import {baseNames} from '../balance.js';
import {renderWorldMap} from '../map-panel.js';

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
const start=src.indexOf(' updateCorridor(');
const end=src.indexOf('\n baseState(){',start);
assert.ok(start>0&&end>start,'operation lifecycle must be present in game');
const Ops=new Function('RULES','ENEMY_TYPES','dist','CORRIDOR_OPERATION','TAU','baseNames',
 'return class OperationHarness {'+src.slice(start,end)+'}')(
 {maxEnemies:180},{scout:{hp:45,dmg:7},fighter:{hp:70,dmg:11}},
 (a,b)=>Math.hypot(a.x-b.x,a.y-b.y),CORRIDOR_OPERATION,Math.PI*2,baseNames);
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
test('completing the mission pays once, clears the marker, and secures the sector',()=>{
 const {game,b,op,value}=fake();
 game.completeCorridor();
 assert.equal(b.corridorSecured,true);
 assert.equal(game.operation,null);
 assert.equal(game.waypoint,null);
 assert.equal(game.player.ore,CORRIDOR_OPERATION.rewardOre);
 assert.equal(value.ore,CORRIDOR_OPERATION.rewardOre);
 assert.equal(value.data,CORRIDOR_OPERATION.rewardData);
 game.completeCorridor();
 assert.equal(game.player.ore,CORRIDOR_OPERATION.rewardOre,
  'a completed operation cannot pay twice');
});
test('clearing the corridor reveals a nearby station as a new reason to explore',()=>{
 const station={id:'1:0',x:1500,y:150,type:'lab',active:false,discovered:false};
 const {game,value}=fake([station]);
 game.completeCorridor();
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
 assert.match(html,/data-act="acceptOperation"/);
 assert.match(html,/data-act="baseMap"/);
 assert.match(html,/255 м/);
  assert.match(html,/Принять заказ/);
  assert.doesNotMatch(html,/\d+ целей/);
 const underway=renderBasePanel(b,state({operation:createCorridorOperation(b)}));
 assert.match(underway,/Отложить · сохранить повреждения/);
 const done=renderBasePanel({...b,corridorSecured:true},st);
 assert.doesNotMatch(done,/data-act="acceptOperation"/);
 assert.match(done,/ПОМЕХИ УСТРАНЕНЫ/);
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
 world.home.corridorSecured=true;game.operation=null;
 const after=renderWorldMap(game);
 assert.match(after,/Разведка возле дока расширена/);
 assert.match(after,/Коридор открыт/);
});
