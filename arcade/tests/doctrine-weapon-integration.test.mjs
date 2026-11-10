import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {fireAimedRail,startRailSweep,updateRailSweep} from '../ship-weapons.js';
import {moduleStats} from '../ship-loadout.js';
import {updateAlly} from '../ai.js';

const enemy=(x,y=0,hp=300)=>({x,y,hp,maxHp:hp,r:14,type:'fighter',converted:false});
const rock=(x,y=0,r=40)=>({x,y,r,hp:500,maxHp:500,alive:true});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);

test('aimed rail applies both purchased damage doctrines and refreshes the command mark',()=>{
 const g=game(['rail',null,null,null,null,null]),target=enemy(140);
 g.manualRailMode=true;g.doctrineRanks={assault:1,command:1};
 g.enemies=[target];g.grid.insert(target);
 const first=fireAimedRail(g,{x:140,y:0});
 assert.equal(first.ok,true);assert.equal(first.hits,1);
 close(300-target.hp,moduleStats('rail').damage*1.5*1.12*1.10);
 assert.equal(g.commandMark.target,target);
 g.moduleClocks.rail=0;
 const hp=target.hp;
 const second=fireAimedRail(g,{x:140,y:0});
 assert.equal(second.ok,true);assert.equal(second.hits,1);
 close(hp-target.hp,moduleStats('rail').damage*1.5*1.12*1.35);
});

test('sustained rail sweep applies doctrines to actual pulses',()=>{
 const g=game(['rail',null,null,null,null,null]),target=enemy(140);
 g.doctrineRanks={assault:1,command:1};g.enemies=[target];g.grid.insert(target);
 assert.equal(startRailSweep(g,{x:200,y:0}).ok,true);
 g.time+=.11;updateRailSweep(g);
 assert.ok(target.hp<300);
 assert.equal(g.commandMark.target,target);
 const dealt=300-target.hp;
 const pulse=moduleStats('rail').damage*2.3*.105/5;
 // The first update catches the current pulse and the immediately previous
 // one. The second is already a repeat hit against the established mark.
 close(dealt,pulse*1.12*(1.10+1.35));
});

test('prospect charge is spent on real plasma damage, not on rock cover',()=>{
 const g=game(),target=enemy(120);
 g.doctrineRanks={prospect:3};g.prospectCharges=6;g.prospectChargeUntil=100;
 g.grid.insert(target);g.enemies=[target];g.updateShipWeapons(.01);
 assert.equal(g.prospectCharges,5);
 const baseline=game(),ordinary=enemy(120);
 baseline.grid.insert(ordinary);baseline.enemies=[ordinary];baseline.updateShipWeapons(.01);
 close(300-target.hp,(300-ordinary.hp)*1.45);

 const blocked=game(),covered=enemy(170),obstacle=rock(80,0,45);
 blocked.doctrineRanks={prospect:3};blocked.prospectCharges=6;blocked.prospectChargeUntil=100;
 blocked.grid.insert(covered);blocked.enemies=[covered];blocked.rockGrid.insert(obstacle);
 blocked.damageRock=()=>{};blocked.updateShipWeapons(.01);
 assert.equal(covered.hp,300);
 assert.equal(blocked.prospectCharges,6);
});

test('commander rank two makes a nearby escort prioritize the marked threat',()=>{
 const makeScene=rank=>{
  const g=game(),ally={serial:1,role:'fighter',x:90,y:0,vx:0,vy:0,r:13,hp:50,
   maxHp:50,think:0,fire:10,state:'follow',commitUntil:0};
  const near=enemy(120),marked=enemy(250);
  g.enemies=[near,marked];g.grid.insert(near);g.grid.insert(marked);
  g.allies=[ally];g.doctrineRanks={command:rank};
  g.commandMark={target:marked,until:g.time+3,lastHitAt:g.time};
  g.avoidance=()=>({x:0,y:0});g.shotsNear=()=>[];g.nearbyEnemyBase=()=>null;
  updateAlly(ally,g,.01);
  return {ally,near,marked};
 };
 const ordinary=makeScene(1);
 assert.equal(ordinary.ally.target,ordinary.near,
  'the first rank must not silently change formation targeting');
 const coordinated=makeScene(2);
 assert.equal(coordinated.ally.target,coordinated.marked);
});
