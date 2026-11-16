import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRockAmbientDrift,updateRockMotion,impactRock,miningTarget} from '../mining.js';
import {hash} from '../balance.js';

function rock(x,y){
 return {x,y,originX:x,originY:y,r:45,alive:true,rich:false,
  vx:0,vy:0,spin:0,spinVelocity:0,flash:0,heat:0,hp:80,maxHp:80};
}
function driftingRock(){
 for(let x=200;x<1000;x+=19)for(let y=300;y<700;y+=29)
  if(hash(x,y,9461)<.6)return rock(x,y);
 throw Error('eligible rock was not found');
}
test('ambient rock drift is slow, bounded and reproducible without changing radius or saves',()=>{
 const a=driftingRock(),b=structuredClone(a),original=structuredClone(a);
 let maxDistance=0,minDistance=Infinity,maxStep=0;
 for(let i=1;i<=3000;i++){
  const t=i/60,ox=a.x,oy=a.y;
  updateRockMotion(a,1/60,t,true);
  updateRockMotion(b,1/60,t,true);
  const delta=Math.hypot(a.x-ox,a.y-oy);
  const distance=Math.hypot(a.x-original.x,a.y-original.y);
  maxStep=Math.max(maxStep,delta);
  maxDistance=Math.max(maxDistance,distance);
  minDistance=Math.min(minDistance,distance);
  assert.ok(distance<=30,'drift stays near the original cell');
 }
 assert.deepEqual(a,b,'same deterministic rock gets same world path');
 assert.ok(maxDistance>5,'the stone actually moves away from its start');
 assert.ok(maxStep<.15,'movement remains continuous, not teleporting');
 assert.equal(a.r,original.r);
 assert.equal(a.originX,original.originX);
 assert.equal(a.originY,original.originY);
 assert.equal(a.hp,original.hp);
 assert.equal(a.vx,0);assert.equal(a.vy,0);
 assert.deepEqual(Object.keys(a).sort(),Object.keys(original).sort(),
  'no new rock state or save fields were created');
 assert.equal(miningTarget([a],{x:a.x,y:a.y},null,160),a,
  'mining and collision queries use the same updated coordinates as rendering');
});
test('drift is optional, avoids ore and unknown old-save origins',()=>{
 const a=driftingRock(),b=structuredClone(a),ore={...a,rich:true};
 for(let i=1;i<=600;i++){
  updateRockMotion(a,1/60,i/60,false);
  updateRockMotion(ore,1/60,i/60,true);
 }
 assert.deepEqual(a,b,'setting off preserves the old immobile behavior');
 assert.equal(ore.x,b.x);assert.equal(ore.y,b.y);
 const legacy={...a};delete legacy.originX;delete legacy.originY;
 assert.equal(applyRockAmbientDrift(legacy,1/60,5),false);
 assert.equal(legacy.x,a.x);
 const dead={...a,alive:false};
 assert.equal(applyRockAmbientDrift(dead,1/60,5),false);
});
test('impact physics still moves rocks and respects original cell boundary',()=>{
 const r=driftingRock(),origin={x:r.x,y:r.y};
 impactRock(r,12,r.x-100,r.y-10,'auto');
 const speed=Math.hypot(r.vx,r.vy);
 assert.ok(speed>0);
 for(let i=1;i<=180;i++){
  updateRockMotion(r,1/60,i/60,true);
  assert.ok(Math.hypot(r.x-origin.x,r.y-origin.y)<=86.00001);
 }
 assert.ok(Math.hypot(r.x-origin.x,r.y-origin.y)>0);
});
