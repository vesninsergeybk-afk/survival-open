import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANDSCAPE_ATLAS,landscapeAsteroidChoice,landscapeAsteroidPose,
 LandscapeAsteroids} from '../landscape-asteroids.js';

const rock=(x,y,r=43)=>({x,y,originX:x,originY:y,r,rich:false,spin:0});

test('the shipped Varkalandar animation atlas is small, transparent and regular',()=>{
 const png=readFileSync(new URL(
  '../../assets/space/varkalandar/varkalandar-18x12.png',import.meta.url));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16),LANDSCAPE_ATLAS.width);
 assert.equal(png.readUInt32BE(20),LANDSCAPE_ATLAS.height);
 assert.equal(png[25],6,'the sprite atlas retains transparency');
 assert.deepEqual([LANDSCAPE_ATLAS.variants,LANDSCAPE_ATLAS.frames,LANDSCAPE_ATLAS.cell],[18,12,96]);
 assert.ok(png.byteLength<5_000_000,'the raw source archives must not be shipped');
});

test('region-specific graphics choose all eighteen variants without random state changes',()=>{
 const variants=new Set();
 const regions=[new Set(),new Set(),new Set(),new Set(),new Set()];
 let selected=0,total=0;
 for(let x=-650;x<=650;x+=27)for(let y=-650;y<=650;y+=39){
  const r=rock(x,y),region=Math.abs((x+y)%5);
  for(let sector=0;sector<5;sector++){
   const a=landscapeAsteroidChoice(r,sector);
   assert.equal(a,landscapeAsteroidChoice(r,sector));
   if(a!==null){
    assert.ok(Number.isInteger(a)&&a>=0&&a<18);
    variants.add(a);regions[sector].add(a);
   }
  }
  const a=landscapeAsteroidChoice(r,region);
  selected+=a!==null?1:0;
  total++;
 }
 assert.equal(variants.size,18);
 assert.ok(regions.every(s=>s.size>=4),'each region has several distinct materials');
 assert.ok(selected/total>.16&&selected/total<.28,'rare but noticeable');
 const r=rock(14,75);
 assert.equal(landscapeAsteroidChoice({...r,rich:true},1),null);
 assert.equal(landscapeAsteroidChoice(rock(14,75,21),1),null);
 const moved={...r,x:9999,y:-9999};
 assert.equal(landscapeAsteroidChoice(r,2),landscapeAsteroidChoice(moved,2),
  'the material does not change when a rock drifts');
});

test('animated images use a fixed 12-frame grid with short, finite periods',()=>{
 let count=0;
 for(let x=0;x<340;x+=11)for(let y=0;y<400;y+=17){
  const r=rock(x,y);
  const pose=landscapeAsteroidPose(r,3.5,2);
  if(!pose)continue;
  count++;
  assert.ok(pose.row>=0&&pose.row<18);
  assert.ok(pose.frame>=0&&pose.frame<12);
  assert.equal(pose.next,(pose.frame+1)%12);
  assert.ok(pose.period>=1.95&&pose.period<2.7);
  assert.ok(pose.blend>=0&&pose.blend<1);
  assert.deepEqual(pose,landscapeAsteroidPose(r,3.5,2));
 }
 assert.ok(count>40);
});

test('one atlas is reused; blending is capped; reduced motion is static',()=>{
 const old=globalThis.Image;let image=null;
 class MockImage{
  constructor(){image=this;this.naturalWidth=1152;this.naturalHeight=1728;}
  set src(x){this._src=x;}
 }
 globalThis.Image=MockImage;
 try{
  const scene=new LandscapeAsteroids();
  assert.ok(image._src.includes('varkalandar-18x12.png'));
  const chosen=Array.from({length:800},(_,i)=>rock(i*47,42,50)).
   filter(r=>landscapeAsteroidChoice(r)!==null).slice(0,20);
  assert.equal(scene.draw({save(){},restore(){},translate(){},rotate(){},drawImage(){}},chosen[0],2),false);
  image.onload();
  let painted=0,saves=0,restores=0,lastArgs=null;
  const c={globalAlpha:1,save(){saves++;},restore(){restores++;},
   translate(){},rotate(){},drawImage(...args){painted++;lastArgs=args;}};
  scene.beginFrame(60);chosen.forEach(r=>scene.draw(c,r,2.456));
  assert.ok(painted<=chosen.length+8&&painted>=chosen.length);
  assert.equal(saves,restores);
  assert.equal(lastArgs.length,9);
  assert.equal(lastArgs[3],96);assert.equal(lastArgs[4],96);
  const before=painted;
  assert.equal(scene.draw(c,{...chosen[0],rich:true},2),false);
  assert.equal(painted,before);
  const quiet=new LandscapeAsteroids({reducedMotion:true,source:'test-image.png'});
  quiet.image=image;quiet.beginFrame(60);
  assert.equal(quiet.blendBudget,0);
  const first=landscapeAsteroidPose(chosen[0],0);
  assert.ok(first);
  quiet.draw(c,chosen[0],18);
  assert.equal(painted,before+1);
  assert.equal(new LandscapeAsteroids({enabled:false}).image,null);
 }finally{globalThis.Image=old;}
});
