import {RuntimeHarness} from './runtime-game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {PROBE_OPERATION,createProbeOperation,probeOffer,isProbeLab,chooseOperationLead,operationDestination} from '../operations.js';
import {renderBasePanel} from '../base-panel.js';
import {renderWorldMap} from '../map-panel.js';

const world=new World(20261102);
const lab=world.nearbyStations(0,0,9000,false).find(b=>b.type==='lab');
assert.ok(lab,'procedural world must offer a laboratory');
lab.active=true;lab.discovered=true;world.discovered.add(lab.id);

test('laboratory probe is an authored one-time mission in a clear part of space',()=>{
 assert.equal(isProbeLab(lab),true);
 assert.equal(probeOffer({...lab,active:false},null).status,'locked');
 assert.equal(probeOffer(lab,null).status,'available');
 const op=createProbeOperation(lab,world);
 const range=Math.hypot(op.x-lab.x,op.y-lab.y);
 assert.ok(range>500&&range<1000);
 assert.ok(world.nearbyRocks(op.x,op.y,145)
  .every(r=>!r.alive||Math.hypot(op.x-r.x,op.y-r.y)>=r.r+72));
 assert.ok(world.nearbyStations(op.x,op.y,215,true)
  .every(st=>st.id===lab.id));
 assert.equal(probeOffer(lab,op).status,'active');
 assert.equal(probeOffer({...lab,probeRecovered:true},null).status,'complete');
});
const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const start=gameSource.indexOf(' repairProbe(dt){');
const end=gameSource.indexOf('\n baseState(){',start);
assert.ok(start>0&&end>start);
const Ops=RuntimeHarness;
const makeGame=()=>{
 const base={...lab},op=createProbeOperation(base,world);
 const game=new Ops(),messages=[],drops=[];
 Object.assign(game,{operation:op,world:{stations:new Map([[base.id,base]]),
   discovered:new Set(),nearbyStations:()=>[],nearbyRocks:()=>[]},
  player:{x:op.x,y:op.y,ore:0},dead:false,time:90,waypoint:{id:op.id},
  enemies:[],enemySerial:0,groupSerial:0,overlay:{dataset:{}},flash(){},
  cockpit:{resourceGain:()=>{}},heritage:{vfx:{nova:()=>{},shipExplosion:()=>{}},station:()=>{},ui(){},play(){}},
  notice:m=>messages.push(m),collect:item=>drops.push(item)});
 base.probeMission=op;
 return {game,base,op,messages,drops};
};
test('only a local scan reveals the probe, and live jammers cap repair at both stages',()=>{
 const {game,op}=makeGame();
 assert.notDeepEqual(operationDestination(op,game.world),op);
 game.repairProbe(3);assert.equal(op.repair,0);
 game.updateProbe();assert.equal(op.located,true);assert.equal(operationDestination(op,game.world),op);
 game.repairProbe(5);assert.equal(op.repair,25);assert.equal(game.enemies.length,0);
 game.repairProbe(10);assert.equal(op.repair,50);assert.equal(op.waves,1);
 assert.equal(game.enemies.find(e=>e.serial===op.strikerSerial).missionStrike.target,'probe');
 game.repairProbe(10);assert.equal(op.repair,50);
 game.enemies.find(e=>e.serial===op.strikerSerial).hp=0;game.updateProbe();
 assert.equal(op.repair,50,'stopping the beam never resets it');
 game.repairProbe(10);assert.equal(op.waves,2);assert.equal(op.repair,85);
});
test('the probe pays exactly once and reveals a future destination',()=>{
 const {game,base,op,drops}=makeGame();
 const lead={id:'2:1',x:op.x+450,y:op.y+700,type:'dock',active:false,discovered:false};
 game.world.nearbyStations=()=>[lead];
 game.updateProbe();
 for(let i=0;i<2;i++){
  game.repairProbe(20);game.enemies.find(e=>e.serial===op.strikerSerial).hp=0;game.updateProbe();
 }
 game.repairProbe(20);
 assert.equal(base.probeRecovered,true);
 assert.equal(base.probeMission,null);
 assert.equal(game.operation,null);
 assert.equal(game.player.ore,PROBE_OPERATION.rewardOre);
 assert.deepEqual(drops,[{type:'data',value:PROBE_OPERATION.rewardData}]);
 assert.equal(lead.discovered,true);
 assert.equal(game.waypoint.id,lead.id);
 game.completeProbe();
 assert.equal(game.player.ore,PROBE_OPERATION.rewardOre);
});
test('only the issuing lab can redeem partial data, including after the probe is destroyed',()=>{
 const {game,base,op,drops}=makeGame();
 game.updateProbe();game.repairProbe(20);
 op.hp=0;game.loseProbe(op);
 assert.equal(op.phase,'return');assert.equal(operationDestination(op,game.world),base);
 game.completeProbe(true);assert.equal(game.player.ore,0);
 game.docked=base;game.completeProbe(true);game.completeProbe(true);
 assert.equal(base.probeRecovered,undefined);assert.equal(base.probeTelemetryDelivered,true);
 assert.equal(probeOffer(base,null).partial,true);
 assert.equal(game.player.ore,PROBE_OPERATION.partialOre);
 assert.deepEqual(drops,[{type:'data',value:PROBE_OPERATION.partialData}]);
});
test('postponing an active repair leaves the probe exposed and does not replace the next course',()=>{
 const {game,base,op}=makeGame();
 game.updateProbe();game.repairProbe(20);
 const striker=game.enemies.find(e=>e.serial===op.strikerSerial);
 Object.assign(striker,{x:op.x+350,y:op.y,relayChargeUntil:game.time+1});
 game.abandonOperation();assert.equal(game.operation,null);
 const other={id:'relay-defense',baseId:'4:0'},route={id:'relay-defense',x:0,y:0};
 game.operation=other;game.waypoint=route;
 game.time+=2;game.updateProbe();assert.equal(op.hp,76);
 op.hp=1;striker.relayChargeUntil=game.time+3;
 game.time+=4;game.updateProbe();
 assert.equal(base.probeMission,op);assert.equal(op.phase,'return');
 assert.equal(game.operation,other);assert.equal(game.waypoint,route);
});
test('no passive shooting while repairing, and no corridor damage applied to probe',()=>{
 assert.match(gameSource,/this\.probeRepairing=activeInteraction\(this\.actionHeld,'repair',atProbe\)/);
 assert.match(gameSource,/this\.mining\.active=activeInteraction\(this\.actionHeld,'mine',candidate\?\.alive\)/);
 assert.match(gameSource,/if\(this\.probeRepairing\)this\.repairProbe\(dt\)/);
 assert.match(gameSource,/updateAutomaticWeapons\(this,dt,!this.heavyCharge&&automaticFireAllowed\(this.holdFire,\s*this.mining.active,this.probeRepairing\|\|this.openingRepairing\|\|this.actionHeld\?\.kind==='field-work'\)\)/);
 const {game,op}=makeGame();game.updateCorridor(5);assert.equal(op.hp,PROBE_OPERATION.maxHp);
 const targets=readFileSync(new URL('../combat-targets.js',import.meta.url),'utf8');
 assert.match(targets,/if\(t===game.operation&&!t.interceptCargo\)return false/);
});
test('lab terminal and map show the actual mission with a repair instruction',()=>{
 const state={ore:70,hp:110,maxHp:110,shield:0,activeBases:2,
  connectedBases:2,connected:true,allies:0,droneRoles:[],droneDamage:0,
  charges:0,transfers:[],contract:null,network:{armor:0,armament:0,engine:0,strikePower:0},
  baseTab:'operations'};
 const html=renderBasePanel(lab,state);
 assert.match(html,/Последний сигнал/);
 assert.match(html,/data-act="acceptOperation"/);
 const op=createProbeOperation(lab,world);
 const active=renderBasePanel(lab,{...state,operation:op});
 assert.match(active,/Удерживайте E/);
 const game={world,operation:op,waypoint:{id:op.id,x:op.x,y:op.y,label:'Зонд'},
  player:{x:lab.x,y:lab.y},contract:null,enemyBasesUnlocked:()=>false};
 assert.match(renderWorldMap(game),/Район поиска зонда/);
 assert.doesNotMatch(renderWorldMap(game),/Аварийный зонд/);
 op.located=true;const map=renderWorldMap(game);
 assert.match(map,/АВАРИЙНАЯ ТЕЛЕМЕТРИЯ/);
 assert.match(map,/Аварийный зонд/);
});
test('the issuing lab shows the salvage payout on arrival, before opening the task list',()=>{
 const op=createProbeOperation(lab,world);Object.assign(op,{repair:50,located:true,phase:'return',hp:0});
 const baseState={operation:op,world,ore:80,hp:110,maxHp:110,network:{},baseTab:'summary'};
 const html=renderBasePanel(lab,baseState);
 assert.match(html,/Телеметрия готова к сдаче/);
 assert.match(html,/data-act="claimProbeData">Сдать данные и завершить/);
 const jobs=renderBasePanel(lab,{...baseState,baseTab:'operations'});
 assert.match(jobs,/Награда: \+9 сплава · \+16 опыта/);
 assert.doesNotMatch(jobs,/Награда: \+20 сплава/);
 const paused={...lab,probeMission:op};
 const resumed=renderBasePanel(paused,{...baseState,operation:null});
 assert.match(resumed,/data-act="claimProbeData">Сдать данные и завершить/);
});
