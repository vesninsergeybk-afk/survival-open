import test from 'node:test';
import assert from 'node:assert/strict';
import {drawIrisDrone,irisEnabledByQuery,irisFrameAt,irisCycleFrameAt,
 irisManeuverFrameAt,irisDodgeFrameAt,irisDrawSize,irisThrustLevel,isIrisDroneReady}
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
test('full close/reopen cycles remain visible after the initial reveal',()=>{
  for(let serial=0;serial<20;serial++){
    const frames=new Set();
    for(let t=.9;t<8;t+=1/60)frames.add(irisCycleFrameAt(t,serial));
    assert.deepEqual([...frames].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8]);
    assert.equal(irisCycleFrameAt(50,serial,true),8);
  }
  const synchronized=new Set(Array.from({length:20},(_,i)=>irisCycleFrameAt(2,i)));
  assert.ok(synchronized.size>=4,'scouts must not blink together');
});

test('shell motion remains continuous at 30 FPS and maneuver half-close is smooth',()=>{
  for(let serial=0;serial<12;serial++){
    let prior=irisCycleFrameAt(0,serial);
    for(let i=1;i<360;i++){
      const current=irisCycleFrameAt(i/30,serial);
      assert.ok(Math.abs(current-prior)<=2,
        `frame jumped ${prior} to ${current} at ${i}/30 for scout ${serial}`);
      prior=current;
    }
  }
  assert.equal(irisManeuverFrameAt(-1),8);
  assert.equal(irisManeuverFrameAt(0),8);
  assert.ok(irisManeuverFrameAt(.36)<=3);
  assert.equal(irisManeuverFrameAt(.72),8);
});

test('ion exhaust has off and bounded power states',()=>{
  assert.equal(irisThrustLevel(0),-1);
  assert.equal(irisThrustLevel(6.99),-1);
  assert.equal(irisThrustLevel(7),0);
  assert.equal(irisThrustLevel(40),1);
  assert.equal(irisThrustLevel(110),3);
  assert.equal(irisThrustLevel(158),4);
  assert.equal(irisThrustLevel(180),5);
  assert.equal(irisThrustLevel(110,200,2),5);
  assert.equal(irisThrustLevel(110,0,0,1),4);
  assert.equal(irisThrustLevel(110,0,0,-1),2);
  assert.equal(irisThrustLevel(999),5);
  assert.equal(irisThrustLevel(Number.NaN),-1);
});
test('the painted scout is smaller than the hero and blinks during dodges',()=>{
  assert.ok(irisDrawSize(14)>28&&irisDrawSize(14)<34);
  assert.ok(irisDrawSize(14)<39,'the scout hull is smaller than the hero hull');
  assert.equal(irisDodgeFrameAt(-1),8);
  assert.equal(irisDodgeFrameAt(0),8);
  assert.ok(irisDodgeFrameAt(.245)<=2);
  assert.equal(irisDodgeFrameAt(.49),8);
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
   this.naturalWidth=url.includes('iris-body')?480:
    url.includes('iris-scan-core')?160:960;
   this.naturalHeight=url.includes('iris-body')?480:
    url.includes('iris-scan-core')?160:320;
   this.onload?.();
  }
 };
 const draws=[],rotations=[],ctx={save(){},restore(){},translate(){},rotate(a){rotations.push(a);},
  drawImage(...args){draws.push(args);},set imageSmoothingEnabled(value){}};
 try{
  assert.equal(drawIrisDrone(ctx,{type:'fighter'},2),false);
  assert.equal(constructed,0);
  const e={type:'scout',serial:1,x:10,y:20,r:14,vx:110,vy:0,visualAngle:0};
  assert.equal(drawIrisDrone(ctx,e,2),true);
  assert.equal(constructed,3);
  assert.equal(draws.length,2,'engines run even when the armor is closed');
  assert.deepEqual(draws[1].slice(1,5),[0,0,160,160]);
  assert.ok(draws[1][7]<34,'rendered hull has been reduced to scout scale');
  draws.length=0;
  assert.equal(drawIrisDrone(ctx,e,3),true);
  assert.equal(draws.length,2);
  assert.deepEqual(draws[1].slice(1,5),[320,320,160,160]);
  draws.length=0;
  assert.equal(drawIrisDrone(ctx,e,3.8),true);
  assert.notDeepEqual(draws[1].slice(1,3),[320,320],
    'the live scout must close its armor again');
  draws.length=0;
  e.vx=0;e.vy=160;
  assert.equal(drawIrisDrone(ctx,e,4.01),true);
  assert.equal(e._irisManeuverAt,4.01,'a sharp turn starts a short shell gesture');
  assert.deepEqual(draws[0].slice(1,5),[800,0,160,320],
    'the same turn pushes exhaust to its strongest sprite');
  draws.length=0;
  e.vx=0;e.vy=0;
  assert.equal(drawIrisDrone(ctx,e,4.6),true);
  assert.equal(draws.length,1,'engines stop when the drone has stopped');
  e.vx=0;e.vy=160;e._scoutDodgeStarted=4.8;e._scoutDodgeSide=1;
  draws.length=0;rotations.length=0;
  assert.equal(drawIrisDrone(ctx,e,5.045),true);
  assert.ok(rotations[0]>.1,'the hull banks visibly during a dodge');
  assert.deepEqual(draws[0].slice(1,5),[800,0,160,320],
    'a side-dash uses the strongest existing exhaust art');
  assert.deepEqual(draws[1].slice(1,5),[320,0,160,160],
    'the shell briefly half-closes during the side-dash');
  assert.equal(constructed,3);
 }finally{globalThis.Image=originalImage;}
});

test('actual scan state opens painted petals and purple scanner without extra art requests',()=>{
 const calls=[],texts=[],strokes=[];
 const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},
  beginPath(){},closePath(){},clip(){},moveTo(){},lineTo(){},arc(){},
  fill(){},stroke(){strokes.push(1);},fillText(...a){texts.push(a);},
  drawImage(...a){calls.push(a);},set globalAlpha(v){},
  set imageSmoothingEnabled(v){},set strokeStyle(v){},set fillStyle(v){},
  set lineWidth(v){},set lineCap(v){},set textAlign(v){},
  set textBaseline(v){},set font(v){}
 };
 const e={type:'scout',serial:5,x:10,y:15,r:14,vx:0,vy:0,
  _irisScanMode:'acquire',_irisScanStarted:10,visualAngle:0};
 assert.equal(drawIrisDrone(ctx,e,10.77),true);
 assert.ok(calls.length>=4,'core plus three physically transformed original petals');
 assert.ok(texts.some(x=>x[0]==='!'),'acquisition indicator');
 calls.length=0;texts.length=0;e._irisScanMode='lost';e._irisScanStarted=12;
 assert.equal(drawIrisDrone(ctx,e,12.77),true);
 assert.ok(texts.some(x=>x[0]==='?'),'search indicator');
 calls.length=0;e._irisScanStarted=20;e._irisFirstPaintTime=0;
 assert.equal(drawIrisDrone(ctx,e,21.75),true);
 assert.deepEqual(calls[0].slice(1,5),[320,320,160,160],
  'the ordinary animation resumes at the same fully retracted pose');
 assert.ok(Math.abs(e._irisFirstPaintTime-20.85)<.0001);
 e._irisBurstStarted=21.75;e.vx=170;e.vy=0;strokes.length=0;
 assert.equal(drawIrisDrone(ctx,e,22.25),true);
 assert.ok(strokes.length>=2,'the post-scan acceleration draws short violet wakes');
});

