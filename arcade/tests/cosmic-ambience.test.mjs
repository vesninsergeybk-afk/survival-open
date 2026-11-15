import test from 'node:test';
import assert from 'node:assert/strict';
import {CosmicAmbience,cosmicEventAt} from '../cosmic-ambience.js';

test('scenic events are deterministic, finite and do not affect the first flight',()=>{
 assert.equal(cosmicEventAt(0),null);
 assert.equal(cosmicEventAt(41.999),null);
 assert.equal(cosmicEventAt(42).kind,'comet');
 assert.equal(cosmicEventAt(55),null);
 assert.equal(cosmicEventAt(168).kind,'distant-burst');
 assert.equal(cosmicEventAt(294).kind,'micro-meteors');
 assert.deepEqual(cosmicEventAt(45,3),cosmicEventAt(45,3));
 assert.equal(cosmicEventAt(Infinity),null);
});

test('all scenery is optional and respects low frame rates and reduced motion',()=>{
 const old=globalThis.document;
 let tiles=0,draws=0;
 const gradient=()=>({addColorStop(){}});
 const brush=new Proxy({createRadialGradient:gradient,createLinearGradient:gradient},
  {get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 globalThis.document={createElement(){tiles++;return {width:0,height:0,getContext(){return brush;}};}};
 const ctx=new Proxy({drawImage(){draws++;},createRadialGradient:gradient,createLinearGradient:gradient},
  {get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 try{
  const scene=new CosmicAmbience();
  const camera={x:100,y:-200,w:800,h:450};
  const original=structuredClone(camera);
  scene.draw(ctx,camera,45,60,0,false);
  assert.equal(tiles,4,'three shared star layers and one regional haze are created');
  assert.ok(draws>0,'scenic layers were painted');
  scene.draw(ctx,camera,47,60,0,false);
  assert.equal(tiles,4,'the scenery is cached, not rebuilt every frame');
  assert.deepEqual(camera,original,'camera state remains untouched');
  scene.draw(ctx,camera,47,30,0,false);
  scene.draw(ctx,camera,47,60,0,true);
  assert.equal(tiles,4,'low performance and accessibility do not rebuild textures');
  const before=draws;
  new CosmicAmbience({enabled:false}).draw(ctx,camera,47,60,0,false);
  assert.equal(draws,before,'query switch can fully remove the new rendering');
 }finally{globalThis.document=old;}
});
