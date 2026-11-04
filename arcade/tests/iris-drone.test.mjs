import test from 'node:test';
import assert from 'node:assert/strict';
import {drawIrisDrone,irisEnabledByQuery,irisFrameAt,irisThrustLevel,isIrisDroneReady}
 from '../iris-drone-renderer.js';

test('I.R.I.S. is enabled by default, with an explicit rollback switch',()=>{
  assert.equal(irisEnabledByQuery(),true);
  assert.equal(irisEnabledByQuery('?iris=1'),true);
  assert.equal(irisEnabledByQuery('?mode=play'),true);
  assert.equal(irisEnabledByQuery('?mode=play&iris=0'),false);
  assert.equal(irisEnabledByQuery('?iris=0&mode=play'),false);
});

test('all nine shell frames are reachable and ordered',()=>{
  assert.equal(irisFrameAt(0),0);
  assert.equal(irisFrameAt(.9),8);
  assert.equal(irisFrameAt(-10),0);
  assert.equal(irisFrameAt(20),8);
  assert.equal(irisFrameAt(.25,true),8);
  const visited=new Set();
  let previous=0;
  for(let i=0;i<=900;i++){
    const frame=irisFrameAt(i/1000);
    assert.ok(frame>=previous);
    previous=frame;
    visited.add(frame);
  }
  assert.deepEqual([...visited],[0,1,2,3,4,5,6,7,8]);
});
test('ion exhaust has off and bounded power states',()=>{
  assert.equal(irisThrustLevel(0),-1);
  assert.equal(irisThrustLevel(4.99),-1);
  assert.equal(irisThrustLevel(5),2);
  assert.equal(irisThrustLevel(180),4);
  assert.equal(irisThrustLevel(999),5);
  assert.equal(irisThrustLevel(Number.NaN),-1);
});
test('without loaded images, the old scout renderer remains available',()=>{
  assert.equal(isIrisDroneReady(),false);
  assert.equal(drawIrisDrone({}, {type:'scout',x:0,y:0,r:14},2),false);
  assert.equal(drawIrisDrone({}, {type:'fighter',x:0,y:0,r:14},2),false);
});

test('the optional art loads only when a scout requests it',()=>{
 const originalImage=globalThis.Image;
 let constructed=0;
 globalThis.Image=class {
  constructor(){constructed++;this.naturalWidth=0;this.naturalHeight=0;}
  set src(url){
   this.naturalWidth=url.includes('iris-body')?480:960;
   this.naturalHeight=url.includes('iris-body')?480:320;
   this.onload?.();
  }
 };
 const draws=[],ctx={save(){},restore(){},translate(){},rotate(){},
  drawImage(...args){draws.push(args);},set imageSmoothingEnabled(value){}};
 try{
  assert.equal(drawIrisDrone(ctx,{type:'fighter'},2),false);
  assert.equal(constructed,0);
  const e={type:'scout',serial:1,x:10,y:20,r:14,vx:110,vy:0,visualAngle:0};
  assert.equal(drawIrisDrone(ctx,e,2),true);
  assert.equal(constructed,2);
  assert.equal(draws.length,1);
  draws.length=0;
  assert.equal(drawIrisDrone(ctx,e,3),true);
  assert.equal(draws.length,2);
  assert.deepEqual(draws[1].slice(1,5),[320,320,160,160]);
  assert.equal(constructed,2);
 }finally{globalThis.Image=originalImage;}
});
