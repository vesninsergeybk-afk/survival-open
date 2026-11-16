import test from 'node:test';
import assert from 'node:assert/strict';
import {CinematicScenery,CINEMATIC_LANDMARKS,landmarkPosition,landmarkVisible} from '../cinematic-scenery.js';

test('five distinct scenery motifs stay pinned to unique world points',()=>{
 assert.equal(CINEMATIC_LANDMARKS.length,5);
 assert.equal(new Set(CINEMATIC_LANDMARKS.map(x=>x.kind)).size,5);
 for(const x of CINEMATIC_LANDMARKS){
  assert.ok(Number.isFinite(x.x)&&Number.isFinite(x.y));
  assert.ok(x.factor>.01&&x.factor<.2&&x.alpha>0&&x.alpha<1);
 }
});
test('parallax has continuous translation and culls distant artwork',()=>{
 const item=CINEMATIC_LANDMARKS[1],cam={x:9000,y:36000,w:960,h:540};
 const a=landmarkPosition(item,cam);
 assert.deepEqual(a,landmarkPosition(item,cam));
 const b=landmarkPosition(item,{...cam,x:cam.x+100});
 assert.ok(Math.abs(b.x-a.x+100*item.factor)<1e-9);
 assert.ok(landmarkVisible(item,cam,600));
 assert.equal(landmarkVisible(item,{x:-80000,y:-80000,w:960,h:540},600),false);
});
test('art caches once, skips very low FPS and can be disabled',()=>{
 const oldD=globalThis.document,oldI=globalThis.Image;
 const stats={tiles:0,draws:0};const grad=()=>({addColorStop(){}});
 const brush=new Proxy({createRadialGradient:grad,createLinearGradient:grad},
  {get(t,k){return k in t?t[k]:()=>{};},set(t,k,v){t[k]=v;return true;}});
 globalThis.Image=undefined;
 globalThis.document={createElement(){stats.tiles++;return {width:0,height:0,getContext:()=>brush};}};
 const ctx=new Proxy({drawImage(){stats.draws++;}},
  {get(t,k){return k in t?t[k]:()=>{};},set(t,k,v){t[k]=v;return true;}});
 const cam={x:9200,y:36400,w:960,h:540};
 try{
  const sky=new CinematicScenery();
  sky.draw(ctx,cam,0,60);assert.ok(stats.draws>0);
  const tiles=stats.tiles;sky.draw(ctx,cam,14,60);assert.equal(stats.tiles,tiles);
  sky.draw(ctx,cam,20,25);assert.equal(stats.tiles,tiles);
  const before=stats.draws;
  new CinematicScenery({enabled:false}).draw(ctx,cam,0,60);
  assert.equal(stats.draws,before);
  assert.deepEqual(cam,{x:9200,y:36400,w:960,h:540});
 }finally{globalThis.document=oldD;globalThis.Image=oldI;}
});
