import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {SPAC1_COUNTS,SPAC1_MANIFEST,spac1FrameRef} from '../src/spac1-sprites.js';

test('the baked sheet has exactly 64 grounded cells with the audited view map',()=>{
 const root=new URL('../assets/prologue/spac1/runtime-v2/',import.meta.url);
 const bytes=readFileSync(fileURLToPath(new URL('walk.webp',root)));
 const audit=JSON.parse(readFileSync(fileURLToPath(new URL('walk-audit.json',root)),'utf8'));
 assert.equal(bytes.subarray(0,4).toString(),'RIFF');
 assert.equal(bytes.subarray(8,12).toString(),'WEBP');
 assert.equal(bytes.length,317084);
 assert.equal(audit.frames.length,64);
 const views=[[0,false],[1,false],[6,true],[3,false],[4,false],[3,true],[6,false],[7,false]];
 for(let dir=0;dir<8;dir++){
   for(let frame=0;frame<8;frame++){
     const m=audit.frames[dir*8+frame];
     assert.equal(m.index,dir);
     assert.equal(m.frame,frame);
     assert.equal(m.source_row,views[dir][0]);
     assert.equal(m.mirror,views[dir][1]);
     assert.ok(Math.abs(m.helmet_target_x-80)<=1);
     assert.ok(Math.abs(m.helmet_target_y-64)<=1);
     assert.ok(Math.abs(m.sole_target_y-128)<=1);
     const ref=spac1FrameRef('walk',dir,frame);
     assert.equal(ref.row,views[dir][0]);
     assert.equal(!!ref.mirrored,views[dir][1]);
   }
 }
 assert.equal(SPAC1_COUNTS.walk,8);
 assert.equal(SPAC1_MANIFEST.total,176);
});

test('the game paints the static WebP cells without canvas reconstructions',async()=>{
 const oldImage=globalThis.Image,oldDocument=globalThis.document;
 const requested=[];
 let canvasCreated=0;
 class StubImage {
   constructor(){this.naturalWidth=1280;this.naturalHeight=1280;}
   set src(value){this._src=value;requested.push(value);queueMicrotask(()=>this.onload?.());}
   get src(){return this._src;}
   decode(){return Promise.resolve();}
 }
 globalThis.Image=StubImage;
 globalThis.document={createElement(){canvasCreated++;throw Error('offline bake must not create canvases at runtime');}};
 try{
   const module=await import('../src/spac1-sprites.js?baked-walk-134=1');
   module.warmSpac1();
   await new Promise(resolve=>setImmediate(resolve));
   const samples=[];
   const ctx={drawImage(image,sx,sy,sw,sh){samples.push({image,sx,sy,sw,sh});}};
   for(let dir=0;dir<8;dir++)for(let frame=0;frame<8;frame++)
      assert.equal(module.drawSpac1PreviewFrame(ctx,'walk',dir,frame,0,0,96),true);
   assert.equal(samples.length,64);
   assert.ok(samples.every(s=>s.image instanceof StubImage));
   assert.ok(samples.every(s=>s.sw===160 && s.sh===160));
   assert.ok(requested.some(s=>s.endsWith('/walk.webp')));
   assert.equal(canvasCreated,0);
   const moving=[];
   const paint={
      globalAlpha:1,save(){},restore(){},translate(){},beginPath(){},ellipse(){},fill(){},fillRect(){},
      drawImage(image,sx,sy){moving.push({sx,sy,image});}
   };
   const enemy={x:300,y:200,hp:72,maxHp:72,visualAngle:-Math.PI/2,
      prologueGroup:'security',ranged:true,aimAngle:0,aimTimer:0,fireTimer:0,prologueTravel:0};
   for(let i=0;i<120;i++){
      enemy.x-=80/60;enemy.prologueTravel=80/60;
      enemy.aimTimer=i>20&&i<60?.4:0;
      assert.equal(module.drawSpac1Robot(paint,enemy,i/60),true);
   }
   assert.ok(moving.every(s=>s.sy===2*160),'aim direction cannot hijack walking legs');
   assert.deepEqual([...new Set(moving.map(s=>s.sx/160))].sort((a,b)=>a-b),
      [0,1,2,3,4,5,6,7],'all phases appear during motion');
 }finally{
   if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage;
   if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
 }
});
