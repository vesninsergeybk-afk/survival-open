import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {renderBasePanel} from '../base-panel.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {packRun,unpackRun} from '../run-checkpoint.js';
import {createFieldOperation,fieldOperationIds,fieldOperationOffer,fieldOperationMining,
 advanceFieldOperation,validFieldOperation,fieldOperationCue,fieldOperationInteraction} from '../field-operations.js';

const world=new World(20261107);
const stations=world.nearbyStations(0,0,9000,false).filter(b=>!b.enemy);
const lab=stations.find(b=>b.type==='lab'),arsenal=stations.find(b=>b.type==='arsenal');
const dock=world.home,carrier=stations.find(b=>b.type==='carrier');
for(const base of [lab,arsenal,dock,carrier])base.active=true;

function fakeGame(op){
 return {operation:op,player:{x:op.x,y:op.y},enemies:[],enemySerial:0,groupSerial:0,
  time:0,mining:{active:false},miningNoise:0,dead:false,world,
  heritage:{vfx:{nova(){}},play(){}},notice(){},hurt(){this.hits=(this.hits||0)+1;},
  prepareMissionStrike(enemy,target,spec){enemy.missionStrike={...spec};enemy.target=target;},
  updateMissionStrike(enemy,target){target.hp=Math.max(0,target.hp-1);}};
}

test('station role offers distinct finite scenarios and repeat cooldown',()=>{
 assert.deepEqual(fieldOperationIds('lab'),['deep-resonance','reverse-hunt','false-call']);
 assert.deepEqual(fieldOperationIds('arsenal'),['two-fronts','sleeping-reactor']);
 assert.deepEqual(fieldOperationIds('dock'),['line-break']);
 assert.deepEqual(fieldOperationIds('carrier'),['broken-convoy']);
 const offer=fieldOperationOffer(lab,null,50,'deep-resonance');
 assert.equal(offer.status,'available');
 assert.equal(fieldOperationOffer({...lab,fieldOperationCooldowns:{'deep-resonance':90}},null,50,'deep-resonance').remaining,40);
 const html=renderBasePanel(lab,{ore:80,hp:110,maxHp:110,shield:0,activeBases:2,connectedBases:2,
  connected:true,allies:0,droneRoles:[],droneDamage:0,charges:0,transfers:[],contract:null,
  network:{armor:0,armament:0,engine:0,strikePower:0},baseTab:'operations',world,time:50});
 assert.match(html,/Глубинный резонанс/);
 assert.match(html,/Обратная охота/);
 assert.match(html,/Чужой позывной/);
 assert.match(html,/data-act="acceptFieldOperation" data-role="deep-resonance"/);
});

test('resonance requires actual marked mineral extraction, enables partial return, no double credit',()=>{
 const op=createFieldOperation('deep-resonance',lab,world);
 assert.ok(op&&validFieldOperation(op));
 assert.equal(op.samples.length,2);
 assert.equal(fieldOperationMining(op,{id:'unrelated',rich:true},'extract'),false);
 assert.equal(fieldOperationMining(op,{id:op.samples[0].id},'auto'),false);
 op.phase='active';
 assert.equal(fieldOperationMining(op,{id:op.samples[0].id},'extract'),true);
 assert.equal(op.progress,1);
 assert.equal(fieldOperationMining(op,{id:op.samples[0].id},'extract'),false);
 const other=op.samples[1].id;
 assert.equal(fieldOperationMining(op,{id:other},'strike'),true);
 assert.equal(op.phase,'return');
 assert.equal(op.progress,2);
 assert.ok(validFieldOperation(op));
});

test('resonance changes danger only after risky mining; pulse is telegraphed and avoidable',()=>{
 const op=createFieldOperation('deep-resonance',lab,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);assert.equal(op.phase,'active');
 game.player.x=op.samples[0].x;game.player.y=op.samples[0].y;
 game.mining.active=true;
 for(let i=0;i<80;i++){game.time+=.1;advanceFieldOperation(game,.1);}
 assert.ok(op.resonance>=90||op.alerted,'active mining creates meaningful pressure');
 assert.ok(op.alerted,'a visible guard responds to pressure');
 if(op.pulseUntil){game.player.x+=600;game.time=op.pulseUntil;advanceFieldOperation(game,.1);}
 assert.equal(game.hits||0,0,'leaving the hazard circle avoids damage');
});

test('reverse hunt rewards surviving scan cycles and gives a partial outcome for an early kill',()=>{
 const op=createFieldOperation('reverse-hunt',lab,world),game=fakeGame(op);
 assert.ok(validFieldOperation(op));
 advanceFieldOperation(game,.1);
 assert.equal(op.phase,'active');
 const enemy=game.enemies.find(e=>e.serial===op.enemySerial);
 assert.ok(enemy&&enemy.hp>100);
 for(let i=0;i<2;i++){
  game.time=op.scanAt;advanceFieldOperation(game,.1);
  game.player.x=enemy.x+200;game.player.y=enemy.y;
  game.time=op.scanUntil;advanceFieldOperation(game,.1);
  assert.equal(op.scans,i+1);
 }
 assert.equal(op.phase,'return');assert.equal(op.partial,false);
 const other=createFieldOperation('reverse-hunt',lab,world,1),early=fakeGame(other);
 advanceFieldOperation(early,.1);
 early.enemies[0].hp=0;early.time=1;advanceFieldOperation(early,.1);
 assert.equal(other.phase,'return');assert.equal(other.partial,true);
 assert.match(fieldOperationCue(other,early),/ВЕРНИТЕСЬ/);
});

test('two-front defense attacks separate assets and accepts one surviving node',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 assert.ok(validFieldOperation(op));
 assert.ok(Math.hypot(op.nodes[0].x-op.nodes[1].x,op.nodes[0].y-op.nodes[1].y)>180);
 advanceFieldOperation(game,.1);assert.equal(op.phase,'active');
 game.time=op.nextWaveAt;advanceFieldOperation(game,.1);
 assert.equal(op.wave,1);assert.equal(game.enemies.filter(e=>e.fieldOperation===op.id).length,2);
 assert.notEqual(game.enemies[0].target,game.enemies[1].target);
 for(const enemy of game.enemies)enemy.hp=0;
 game.time+=1;advanceFieldOperation(game,.1);
 assert.ok(op.nextWaveAt>game.time);
 op.nodes[0].hp=0;
 game.time=op.nextWaveAt;advanceFieldOperation(game,.1);
 assert.equal(op.wave,2);
 for(const enemy of game.enemies)enemy.hp=0;
 game.time+=1;advanceFieldOperation(game,.1);
 assert.equal(op.phase,'return');assert.equal(op.partial,true);
 assert.ok(validFieldOperation(op));
});

test('claiming a field operation pays once, reduces repeats, and keeps station identity',()=>{
 const op=createFieldOperation('deep-resonance',lab,world),game=fakeGame(op);
 op.phase='return';op.progress=2;
 game.docked=lab;game.player={ore:0,data:0,level:1};
 game.cockpit={resourceGain(){}};game.heritage.station=()=>{};
 game.collect=function(item){this.player.data+=item.value;};
 game.rewardNotice=()=>{};game.waypoint={id:op.id};
 lab.fieldMission=op;lab.fieldOperationRuns={};
 game.fieldLoan=null;
 assert.equal(RuntimeHarness.prototype.finishFieldOperation.call(game),true);
 assert.equal(game.player.ore,26);assert.equal(game.player.data,25);
 assert.equal(lab.fieldOperationRuns[op.id],1);
 assert.equal(RuntimeHarness.prototype.finishFieldOperation.call(game),false);
 assert.equal(game.player.ore,26);
 assert.equal(fieldOperationOffer(lab,null,game.time,op.id).status,'cooldown');
});

test('line repair needs sustained interaction, then changes to a guarded second node',()=>{
 const op=createFieldOperation('line-break',dock,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 assert.equal(op.phase,'active');
 assert.ok(validFieldOperation(op));
 const first=op.nodes[0];
 game.player.x=first.x;game.player.y=first.y;
 assert.equal(fieldOperationInteraction(op,game.player)?.label,'Ремонт узла');
 game.actionHeld={kind:'field-work',target:first};game.time+=5.1;advanceFieldOperation(game,5.1);
 assert.equal(op.progress,1);assert.equal(op.nodes[0].done,true);
 assert.ok(game.enemies.length>=2,'second repair is contested');
 assert.ok(game.enemies.some(e=>e.missionStrike&&e.target===op.nodes[1]),
  'a raider is actually aimed at destructible equipment');
 const second=op.nodes[1];game.player.x=second.x;game.player.y=second.y;
 game.actionHeld={kind:'field-work',target:second};game.time+=6.1;advanceFieldOperation(game,6.1);
 assert.equal(op.phase,'return');assert.equal(op.progress,2);
 assert.ok(validFieldOperation(op));
});

test('the second communication node can actually be destroyed, forcing a partial return',()=>{
 const op=createFieldOperation('line-break',dock,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const first=op.nodes[0];game.player.x=first.x;game.player.y=first.y;
 game.actionHeld={kind:'field-work',target:first};game.time=5.1;advanceFieldOperation(game,5.1);
 const second=op.nodes[1];assert.ok(second.hp<=100&&second.hp>0);
 const assassin=game.enemies.find(e=>e.missionStrike&&e.target===second);
 assert.ok(assassin);
 game.updateMissionStrike(assassin,second);assert.ok(second.hp<100);
 second.hp=0;game.time+=1;advanceFieldOperation(game,.1);
 assert.equal(op.phase,'return');assert.equal(op.partial,true);
 assert.equal(fieldOperationInteraction(op,game.player),null);
});

test('false beacon gives an observable clue and punishes a rushed wrong choice',()=>{
 const op=createFieldOperation('false-call',lab,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const wrong=op.beacons.find((b,i)=>i!==op.correct);
 game.player.x=wrong.x;game.player.y=wrong.y;
 game.actionHeld={kind:'field-work',target:wrong};game.time=2;advanceFieldOperation(game,2);
 assert.equal(op.checks,1);assert.equal(op.phase,'active');
 assert.ok(game.enemies.some(e=>e.fieldOperation===op.id));
 const correct=op.beacons[op.correct];game.player.x=correct.x;game.player.y=correct.y;
 game.actionHeld={kind:'field-work',target:correct};game.time=4;advanceFieldOperation(game,2);
 assert.equal(op.phase,'return');assert.equal(op.partial,true);
 assert.ok(validFieldOperation(op));
});

test('reactor outer cassette is safe, inner cassette requires avoiding warned pulses',()=>{
 const op=createFieldOperation('sleeping-reactor',arsenal,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);
 const outer=op.nodes[0];game.player.x=outer.x;game.player.y=outer.y;
 game.actionHeld={kind:'field-work',target:outer};game.time=3.4;advanceFieldOperation(game,3.4);
 assert.equal(op.progress,1);
 game.time=op.pulseAt;advanceFieldOperation(game,.1);
 assert.ok(op.pulseUntil>game.time,'pulse has advance warning');
 game.player.x=op.x+350;game.player.y=op.y;
 game.time=op.pulseUntil;advanceFieldOperation(game,.1);
 assert.equal(game.hits||0,0);
 const inner=op.nodes[1];game.player.x=inner.x;game.player.y=inner.y;
 game.actionHeld={kind:'field-work',target:inner};game.time+=5;advanceFieldOperation(game,5);
 assert.equal(op.phase,'return');assert.equal(op.progress,2);
});

test('convoy route choice changes path and risk; destroyed cargo can still be recovered',()=>{
 const safe=createFieldOperation('broken-convoy',carrier,world,0,'safe');
 const fast=createFieldOperation('broken-convoy',carrier,world,0,'fast');
 const routeLength=op=>Math.hypot(op.route[0].x-op.route[1].x,op.route[0].y-op.route[1].y)+
  Math.hypot(op.route[1].x-op.route[2].x,op.route[1].y-op.route[2].y);
 assert.ok(routeLength(safe)>routeLength(fast));
 assert.ok(validFieldOperation(safe)&&validFieldOperation(fast));
 const game=fakeGame(fast);advanceFieldOperation(game,.1);
 const initialX=fast.x,initialY=fast.y;
 game.time+=1;advanceFieldOperation(game,1);
 assert.ok(Math.hypot(fast.x-initialX,fast.y-initialY)>0);
 fast.hp=0;game.time+=1;advanceFieldOperation(game,.1);
 assert.equal(fast.phase,'salvage');
 const crate=fast.crate;game.player.x=crate.x;game.player.y=crate.y;
 game.actionHeld={kind:'field-work',target:crate};game.time+=3.3;advanceFieldOperation(game,3.3);
 assert.equal(fast.phase,'return');assert.equal(fast.partial,true);
 assert.ok(validFieldOperation(fast));
});

test('checkpoint graph preserves the exact mission and attacker target after docking',()=>{
 const op=createFieldOperation('two-fronts',arsenal,world),game=fakeGame(op);
 advanceFieldOperation(game,.1);game.time=op.nextWaveAt;advanceFieldOperation(game,.1);
 const snapshot={operation:op,station:{fieldMission:op},enemies:game.enemies};
 const restored=unpackRun(packRun(snapshot));
 assert.equal(restored.operation,restored.station.fieldMission);
 assert.equal(restored.enemies[0].target,restored.operation.nodes[0]);
 assert.equal(restored.enemies[1].target,restored.operation.nodes[1]);
 assert.ok(validFieldOperation(restored.operation));
});
