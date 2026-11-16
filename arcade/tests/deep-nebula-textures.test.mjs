import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CosmicAmbience,NEBULA_DETAIL_SIZE} from '../cosmic-ambience.js';

test('five region-specific CC0 textures are compact local WebP images',()=>{
 assert.equal(NEBULA_DETAIL_SIZE,512);
 for(let i=0;i<5;i++){
  const file=readFileSync(new URL(
   '../../assets/space/deep-nebula/cloud-'+i+'.webp',import.meta.url));
  assert.equal(file.subarray(0,4).toString(),'RIFF');
  assert.equal(file.subarray(8,12).toString(),'WEBP');
  assert.ok(file.byteLength>4000&&file.byteLength<190000,
   'region '+i+' should stay a small local texture');
 }
});

test('regional detail textures load lazily, pattern once, and fade between sectors',()=>{
 const previous=globalThis.Image,created=[];
 class FakeImage{
  constructor(){this.naturalWidth=NEBULA_DETAIL_SIZE;
   this.naturalHeight=NEBULA_DETAIL_SIZE;created.push(this);}
  set src(value){this._src=value;}
 }
 globalThis.Image=FakeImage;
 let draws=0,patterns=0,alphas=[];
 const ctx={globalAlpha:1,save(){},restore(){},translate(){},
  scale(){},fillRect(){draws++;alphas.push(this.globalAlpha);},
  createPattern(){patterns++;return {kind:'pattern'};}};
 try{
  const scene=new CosmicAmbience();
  const camera={x:800,y:-450,w:960,h:540};
  scene._drawDetails(ctx,camera,2,60,0,false);
  assert.equal(created.length,1,'the first sector loads only one image');
  assert.ok(created[0]._src.includes('/assets/space/deep-nebula/cloud-0.webp'));
  assert.equal(draws,0,'the game can render while art is loading');
  created[0].onload();
  scene._drawDetails(ctx,camera,4,60,0,false);
  assert.equal(draws,1);
  scene._drawDetails(ctx,camera,4.2,60,0,false);
  assert.equal(patterns,1,'the repeat pattern is cached');
  scene._drawDetails(ctx,camera,6,60,1,false);
  assert.equal(created.length,2,'changing sector starts one local image load');
  created[1].onload();
  const before=draws;
  scene._drawDetails(ctx,camera,7,60,1,false);
  assert.ok(draws>before,'new texture fades in without changing gameplay');
  assert.ok(alphas.every(v=>v>=0&&v<=.62),'opacity is always restrained');
  scene._drawDetails(ctx,camera,11,60,1,false);
  assert.equal(scene.detailPrevious,-1,'old art is released after transition');
  assert.equal(created.length,2,'existing texture is reused');
  assert.ok(scene.detailPatterns[0]&&scene.detailPatterns[1]);
  assert.deepEqual(camera,{x:800,y:-450,w:960,h:540},
   'camera geometry must remain untouched');
 }finally{globalThis.Image=previous;}
});

test('optional texture failure and manual opt-out preserve the old sky',()=>{
 const previous=globalThis.Image,created=[];
 class FakeImage{
  constructor(){this.naturalWidth=512;this.naturalHeight=512;created.push(this);}
  set src(value){this._src=value;}
 }
 globalThis.Image=FakeImage;
 let draws=0;
 const ctx={save(){},restore(){},translate(){},scale(){},
  createPattern(){return {};},fillRect(){draws++;}};
 const camera={x:0,y:0,w:800,h:450};
 try{
  const off=new CosmicAmbience({textures:false});
  off._drawDetails(ctx,camera,5,60,0,false);
  assert.equal(created.length,0);
  assert.equal(draws,0);
  const on=new CosmicAmbience();
  on._drawDetails(ctx,camera,5,60,0,false);
  assert.equal(created.length,1);
  created[0].onerror();
  assert.doesNotThrow(()=>on._drawDetails(ctx,camera,7,60,0,false));
  assert.equal(on.detailStates[0],'failed');
  assert.equal(draws,0,'failed optional art must not render a broken rectangle');
 }finally{globalThis.Image=previous;}
});
