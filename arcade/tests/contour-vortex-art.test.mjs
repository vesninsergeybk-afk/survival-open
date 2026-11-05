import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VORTEX_ART,vortexFrameAt,vortexAtlasCell,drawContourVortexArt}
 from '../contour-vortex-art.js';

test('vortex art contains all 80 cells, divided into two browser-sized atlases',()=>{
 assert.equal(VORTEX_ART.frameCount,80);
 assert.equal(VORTEX_ART.period,4);
 const locations=new Set();
 for(let f=0;f<80;f++){
  const cell=vortexAtlasCell(f);
  assert.ok(cell.sheet===0||cell.sheet===1);
  assert.ok(cell.x>=0&&cell.x+cell.size<=1920);
  assert.ok(cell.y>=0&&cell.y+cell.size<=768);
  locations.add(`${cell.sheet}:${cell.x}:${cell.y}`);
 }
 assert.equal(locations.size,80);
 assert.equal(vortexAtlasCell(39).sheet,0);
 assert.deepEqual(vortexAtlasCell(40),{sheet:1,x:0,y:0,size:192});
 for(const filename of ['contour-vortex-atlas-0.webp','contour-vortex-atlas-1.webp',
  'contour-vortex-icon.webp']){
  const file=new URL('../../assets/space/'+filename,import.meta.url);
  const bytes=fs.readFileSync(file);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.ok(bytes.length>5000&&bytes.length<3_000_000);
 }
});

test('vortex playback is periodic and every field has a stable phase',()=>{
 for(const id of ['alpha~beta~gamma','delta~epsilon~zeta']){
  for(let i=0;i<160;i++){
   const t=i/20;
   assert.equal(vortexFrameAt(t,id),vortexFrameAt(t+4,id));
   assert.equal(vortexFrameAt(t,id),vortexFrameAt(t+8,id));
  }
 }
 assert.equal(vortexFrameAt(3,'x',true),0);
});

test('art draws exactly one cropped atlas cell and retains a fallback',()=>{
 const original=globalThis.Image;
 const requests=[];
 try{
  globalThis.Image=class {
   naturalWidth=1920;
   naturalHeight=768;
   set src(url){requests.push(url);this.onload();}
  };
  const drawings=[];
  const ctx={globalCompositeOperation:'lighter',globalAlpha:1,
   save(){},restore(){},drawImage(...args){drawings.push(args);}};
  assert.equal(drawContourVortexArt(ctx,3.75,{id:'test-field'},1.02),true);
  assert.equal(requests.length,2);
  assert.equal(drawings.length,1);
  assert.equal(drawings[0].length,9);
  assert.equal(drawings[0][3],192);
  assert.equal(drawings[0][4],192);
  assert.ok(drawings[0][7]>200);
  assert.ok(drawings[0][8]>200);
 }finally{if(original===undefined)delete globalThis.Image;else globalThis.Image=original;}
});
