import test from 'node:test';
import assert from 'node:assert/strict';
import {drawIrisDrone,irisFrameAt,irisThrustLevel,isIrisDroneReady}
 from '../iris-drone-renderer.js';

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
