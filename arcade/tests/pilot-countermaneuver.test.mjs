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

test('the manoeuvre doctrine activates on a real dash, spends normal dash cooldown and reports a visible counter',()=>{
 const g=game(),incoming=shot(90,0,-300,0);
 g.shots=[incoming];g.doctrine='countermaneuver';g.controls={...DEFAULT_CONTROLS};
 assert.equal(g.startBurst(),true);
 assert.ok(g.player.burstCooldown>0);
 assert.ok(incoming.vx>0);
 assert.match(g.lastNotice,/КОНТРМАНЁВР/);
 assert.equal(g.startBurst(),false,'cannot repeatedly turn shots during an unavailable dash');
});
