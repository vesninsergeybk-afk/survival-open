import {RuntimeHarness} from './runtime-game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {PROBE_OPERATION,createProbeOperation,probeOffer,isProbeLab,chooseOperationLead} from '../operations.js';
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
 const game=new Ops(),waves=[],messages=[],drops=[];
 Object.assign(game,{operation:op,world:{stations:new Map([[base.id,base]]),
   discovered:new Set(),nearbyStations:()=>[]},
  player:{x:op.x,y:op.y,ore:0},dead:false,time:90,waypoint:{id:op.id},
  cockpit:{resourceGain:()=>{}},heritage:{vfx:{nova:()=>{}},station:()=>{}},
  notice:m=>messages.push(m),collect:item=>drops.push(item),
  spawnCorridorGuard:(type)=>{waves.push(type);return true;}});
 return {game,base,op,waves,messages,drops};
};
test('repair has separate threat stages, progress persists through interruptions',()=>{
 const {game,op,waves}=makeGame();
 game.repairProbe(3);assert.equal(op.repair,25.5);assert.deepEqual(waves,[]);
 game.repairProbe(.7);assert.deepEqual(waves,['scout','scout']);
 game.repairProbe(3);assert.equal(op.waves,1);
 game.repairProbe(2);assert.deepEqual(waves,['scout','scout','fighter']);
 const before=op.repair;
 game.probeRepairing=false;
 assert.equal(op.repair,before,'letting go of E is safe and does not reset the probe');
});
test('the probe pays exactly once and reveals a future destination',()=>{
 const {game,base,op,drops}=makeGame();
 const lead={id:'2:1',x:op.x+450,y:op.y+700,type:'dock',active:false,discovered:false};
 game.world.nearbyStations=()=>[lead];
 game.repairProbe(12);
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
test('no passive shooting while repairing, and no corridor damage applied to probe',()=>{
 assert.match(gameSource,/this\.probeRepairing=activeInteraction\(this\.actionHeld,'repair',atProbe\)/);
 assert.match(gameSource,/this\.mining\.active=activeInteraction\(this\.actionHeld,'mine',candidate\?\.alive\)/);
 assert.match(gameSource,/if\(this\.probeRepairing\)this\.repairProbe\(dt\)/);
 assert.match(gameSource,/updateAutomaticWeapons\(this,dt,!this.heavyCharge&&automaticFireAllowed\(this.holdFire,this.mining.active,this.probeRepairing\)\)/);
 assert.match(gameSource,/op\.id!==CORRIDOR_OPERATION\.id\|\|this\.dead/);
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
 const map=renderWorldMap(game);
 assert.match(map,/АВАРИЙНАЯ ТЕЛЕМЕТРИЯ/);
 assert.match(map,/Аварийный зонд/);
});
