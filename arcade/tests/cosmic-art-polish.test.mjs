import test from 'node:test';
import assert from 'node:assert/strict';
import {CosmicAmbience} from '../cosmic-ambience.js';
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
