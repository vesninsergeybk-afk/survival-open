import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AnimatedAsteroids,ASTEROID_ANIMATION,asteroidAnimationPose,
 asteroidAnimationEligible} from '../animated-asteroids.js';

const rock=(x,y,r=42)=>({x,y,originX:x,originY:y,r,spin:.12,rich:false});

test('the licensed Jarusca file is a real transparent 9 x 23 spritesheet',()=>{
 const png=readFileSync(new URL('../../assets/space/jarusca-asteroids-diffuse.png',import.meta.url));
 assert.ok(png.length>100000&&png.length<2000000,'original source was saved locally');
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),ASTEROID_ANIMATION.width);
 assert.equal(png.readUInt32BE(20),ASTEROID_ANIMATION.height);
 assert.equal(png[25],6,'RGBA source with true transparency');
 assert.deepEqual([ASTEROID_ANIMATION.columns,ASTEROID_ANIMATION.rows,ASTEROID_ANIMATION.cell],[23,9,75]);
});

test('rock appearance is deterministic, within the sprite grid and changes over time',()=>{
 let eligible=0;const rows=new Set();
 for(let x=-250;x<250;x+=17)for(let y=-200;y<200;y+=37){
  const r=rock(x,y),p=asteroidAnimationPose(r,37.5);
  assert.ok(p.row>=0&&p.row<9);
  assert.ok(p.frame>=0&&p.frame<23);
  assert.ok(Number.isFinite(p.rotation));
  assert.deepEqual(p,asteroidAnimationPose(r,37.5),'visual pose never consumes game RNG');
  rows.add(p.row);if(asteroidAnimationEligible(r))eligible++;
 }
 assert.equal(rows.size,9,'all nine licensed asteroid variants are in use');
 assert.ok(eligible>80,'animated rocks appear often enough to be noticeable');
 const r=rock(91,23);
 assert.notEqual(asteroidAnimationPose(r,0).frame,asteroidAnimationPose(r,6).frame);
 assert.equal(asteroidAnimationEligible({...r,rich:true}),false);
 assert.equal(asteroidAnimationEligible(r,true),false);
 assert.equal(asteroidAnimationEligible(rock(10,30,12)),false);
});

test('animated rocks paint exactly one 75px atlas frame with existing collision size unchanged',()=>{
 const old=globalThis.Image;let created=null;
 class MockImage{
  constructor(){created=this;this.naturalWidth=1725;this.naturalHeight=675;}
  set src(value){this._src=value;}
 }
 globalThis.Image=MockImage;
 try{
  const paint=new AnimatedAsteroids();
  assert.ok(created._src.includes('jarusca-asteroids-diffuse.png'));
  assert.equal(paint.image,null,'sprites must not render before loaded');
  created.onload();
  const eligible=Array.from({length:1000},(_,i)=>rock(i*17,74)).find(r=>asteroidAnimationEligible(r));
  assert.ok(eligible);
  let painted=0,details=null,save=0,restore=0;
  const ctx={save(){save++;},restore(){restore++;},translate(){},rotate(){},
   drawImage(...args){painted++;details=args;}};
  assert.equal(paint.draw(ctx,eligible,38),true);
  assert.equal(painted,1);assert.equal(details.length,9);
  assert.equal(details[3],75);assert.equal(details[4],75);
  assert.equal(details[7],eligible.r*2.8);
  assert.equal(details[8],eligible.r*2.8);
  assert.equal(save,restore);
  assert.equal(paint.draw(ctx,eligible,38,true),false,'ore keeps its original painted metal seams');
  assert.equal(paint.drawIncoming(ctx,{serial:1},3,1.2,40),true);
  assert.equal(painted,2);
  assert.equal(save,restore);
  assert.equal(new AnimatedAsteroids({enabled:false}).image,null);
 }finally{globalThis.Image=old;}
});


test('rotation advances often enough at 60 FPS instead of the old 1.4–2.7 frames/s',()=>{
 for(const r of [rock(4,7),rock(57,103),rock(-214,125),rock(90,-17)]){
  const pose=asteroidAnimationPose(r,0);
  assert.ok(pose.period>=2&&pose.period<2.95);
  assert.equal(pose.nextFrame,(pose.frame+1)%23);
  assert.ok(pose.blend>=0&&pose.blend<1);
  let changes=0,last=pose.frame;
  for(let i=1;i<=60;i++){
   const frame=asteroidAnimationPose(r,i/60).frame;
   if(frame!==last)changes++;
   last=frame;
  }
  assert.ok(changes>=7&&changes<=12,'sprite advances every ~85–130 ms');
 }
});

test('frame blending is bounded and disabled on stressed frames with hysteresis',()=>{
 const old=globalThis.Image;let source;
 class MockImage{
  constructor(){source=this;this.naturalWidth=1725;this.naturalHeight=675;}
  set src(value){this._src=value;}
 }
 globalThis.Image=MockImage;
 try{
  const painter=new AnimatedAsteroids();
  source.onload();
  const rocks=Array.from({length:500},(_,i)=>rock(19*i+9,301+i,64)).
   filter(r=>asteroidAnimationEligible(r)).slice(0,48);
  assert.equal(rocks.length,48);
  const ctx={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},
   drawCalls:0,drawImage(){this.drawCalls++;}};
  painter.beginFrame(60);
  rocks.forEach(r=>painter.draw(ctx,r,18.65));
  assert.equal(painter.qualityTier,3);
  assert.ok(painter.blendedDraws>0);
  assert.ok(painter.blendedDraws<=12,'only twelve rocks may get a second draw call');
  assert.equal(ctx.drawCalls,painter.animatedDraws+painter.blendedDraws);
  assert.equal(painter.animatedDraws,48);
  painter.beginFrame(50);
  assert.equal(painter.qualityTier,3,'no flashing at the 50 FPS boundary');
  painter.beginFrame(47);
  assert.equal(painter.qualityTier,2);
  painter.beginFrame(52);
  assert.equal(painter.qualityTier,2,'quality does not oscillate at threshold');
  painter.beginFrame(38);
  assert.equal(painter.qualityTier,1);
  painter.beginFrame(30);
  assert.equal(painter.qualityTier,0);
  assert.equal(painter.draw(ctx,rocks[0],19),false,'slow frame uses old still-image fallback');
  painter.beginFrame(35);
  assert.equal(painter.qualityTier,0);
  painter.beginFrame(38);
  assert.equal(painter.qualityTier,1);
  painter.beginFrame(46);
  assert.equal(painter.qualityTier,2);
  painter.beginFrame(56);
  assert.equal(painter.qualityTier,3);
 }finally{globalThis.Image=old;}
});
