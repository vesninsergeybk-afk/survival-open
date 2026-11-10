import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {DEFAULT_CONTROLS} from '../control-layout.js';
import {COUNTER_MANEUVER,deflectBurstShots} from '../pilot-countermaneuver.js';

const shot=(x,y,vx,vy,r=6)=>({x,y,vx,vy,r,alive:true,damage:12});

test('countermaneuver redirects at most two imminent small shots and leaves larger artillery alone',()=>{
 const g=game();g.doctrine='countermaneuver';
 const one=shot(65,0,-350,0),two=shot(85,20,-240,-50);
 const third=shot(105,-15,-220,30),heavy=shot(80,0,-300,0,14);
 const passing=shot(90,80,-300,0),outgoing=shot(90,0,300,0);
 g.shots=[one,two,third,heavy,passing,outgoing];
 assert.equal(COUNTER_MANEUVER.radius,115);
 assert.equal(deflectBurstShots(g),2);
 assert.ok(one.vx>0);
 assert.ok(two.vx>0);
 assert.ok(third.vx<0,'the third threat is outside the limited defensive budget');
 assert.equal(heavy.vx,-300);
 assert.equal(passing.vx,-300);
 assert.equal(outgoing.vx,300);
 assert.equal(deflectBurstShots(g),1,'shots redirected away are no longer counted as threats');
});

test('other doctrines cannot deflect bullets, even when Shift is pressed',()=>{
 const g=game(),incoming=shot(90,0,-300,0);
 g.shots=[incoming];g.doctrine='assault';g.controls={...DEFAULT_CONTROLS};
 assert.equal(g.startBurst(),true);
 assert.equal(incoming.vx,-300);
 assert.equal(deflectBurstShots(g),0);
});
test('first countermaneuver rank also shortens ordinary dash cooldown without incoming shots',()=>{
 const plain=game(),pilot=game();
 assert.equal(plain.startBurst(),true);
 pilot.doctrineRanks={countermaneuver:1};
 assert.equal(pilot.startBurst(),true);
 assert.ok(Math.abs(pilot.player.burstCooldown/plain.player.burstCooldown-0.88)<1e-9);
});

test('the manoeuvre doctrine activates on a real dash, spends normal dash cooldown and reports a visible counter',()=>{
 const g=game(),incoming=shot(90,0,-300,0);
 g.shots=[incoming];g.doctrine='countermaneuver';g.controls={...DEFAULT_CONTROLS};
 assert.equal(g.startBurst(),true);
 assert.ok(g.player.burstCooldown>0);
 assert.ok(incoming.vx>0);
 assert.match(g.lastNotice,/КОНТРМАНЁВР/);
 assert.equal(g.startBurst(),false,'cannot repeatedly turn shots during an unavailable dash');
});
test('advanced manoeuvres deflect more varied shots and recover hull only after genuine protection',()=>{
 const g=game();g.doctrineRanks={countermaneuver:3};g.player.hp=70;g.time=10;
 const shots=[shot(90,0,-300,0,10),shot(100,15,-300,-45),
  shot(115,-15,-330,40),shot(130,7,-350,0),shot(75,0,-300,0,15)];
 g.shots=shots;
 assert.equal(deflectBurstShots(g),4);
 assert.equal(g.player.hp,73);
 assert.equal(shots[4].vx,-300,'heavy artillery stays dangerous');
 assert.equal(deflectBurstShots(g),0,'already reflected bullets cannot heal again');
 assert.equal(g.player.hp,73);
});
