import test from 'node:test';
import assert from 'node:assert/strict';
import {CosmicAmbience,cosmicEventAt} from '../cosmic-ambience.js';
import {meteorSceneryPosition} from '../space-anomalies.js';

test('nebula is baked once as a translucent, region-dependent texture',()=>{
 const old=globalThis.document,records=[];
 globalThis.document={createElement:()=>({
  width:0,height:0,getContext:()=>({
   createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
   putImageData:(image)=>records.push(image.data),
   createRadialGradient:()=>({addColorStop(){}}),
   fillRect(){}
  })
 })};
 try{
  const painter=new CosmicAmbience(),a=painter._makeHaze(0),b=painter._makeHaze(0);
  assert.equal(a.width,256);assert.equal(a.height,256);
  assert.equal(b.width,256);assert.equal(records.length,2);
  assert.deepEqual(records[0],records[1],'same seed and region yield the same art');
  const alpha=Array.from({length:256*256},(_,i)=>records[0][i*4+3]);
  assert.equal(alpha[0],0,'tile corners are transparent');
  assert.ok(alpha.some(n=>n>20),'gas has visible density, not a blank texture');
  assert.ok(alpha.some(n=>n===0),'space stays dark between gas arms');
 }finally{globalThis.document=old;}
});

test('decorative meteor wraps outside the visible anomaly, not through its center',()=>{
 const f={id:'test-meteor',r:1250};
 for(let i=0;i<12;i++){
  let prev=meteorSceneryPosition(f,i,0,false);
  for(let t=.5;t<500;t+=.5){
   const curr=meteorSceneryPosition(f,i,t,false);
   assert.ok(curr.fade>=0&&curr.fade<=1,'fade is bounded');
   if(curr.fade>.08&&prev.fade>.08)
    assert.ok(Math.hypot(curr.x-prev.x,curr.y-prev.y)<18,
     'visible stones move continuously');
   prev=curr;
  }
 }
});

test('scenic event remains the same while flying across region boundaries',()=>{
 for(const time of [42,48,168,177,294,299]){
  const observed=cosmicEventAt(time,0);
  for(let sector=1;sector<5;sector++)
   assert.deepEqual(cosmicEventAt(time,sector),observed);
 }
});

test('nebula region changes crossfade and eventually release the previous texture',()=>{
 const old=globalThis.document;
 const noop=()=>{},gradient=()=>({addColorStop(){}});
 const c=new Proxy({createRadialGradient:gradient,createLinearGradient:gradient},
  {get(t,k){return k in t?t[k]:noop;},set(t,k,v){t[k]=v;return true;}});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>c})};
 try{
  const sky=new CosmicAmbience(),camera={x:0,y:0,w:800,h:450};
  sky.draw(c,camera,1,60,0,false);
  const first=sky.haze;assert.ok(first);
  sky.draw(c,camera,3,60,1,false);
  assert.equal(sky.previousHaze,first,'old region persists through crossfade');
  sky.draw(c,camera,4,60,1,false);
  assert.equal(sky.previousHaze,first);
  sky.draw(c,camera,6,60,1,false);
  assert.equal(sky.previousHaze,null,'old texture is released after transition');
 }finally{globalThis.document=old;}
});
