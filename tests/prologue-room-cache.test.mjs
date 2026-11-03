import test from 'node:test';
import assert from 'node:assert/strict';
import {PrologueMissionWorld} from '../src/prologue-mission.js';

// The workshop junction exposes five rooms at once. A three-slot FIFO used
// to repaint every large offscreen room bitmap on every animation frame.
test('branching prologue rooms reuse bitmaps across consecutive frames',()=>{
 const game={player:{x:10000,y:8000}};
 const world=new PrologueMissionWorld(game);
 const camera={worldX:world.cx+1950,worldY:world.cy-400};
 const visible=world.paintedRooms
  .map((room,i)=>({room,i}))
  .filter(({room})=>{
   const halo=Math.max(room.w,room.h)*.7;
   return world._withinCamera({camera,player:game.player},room,
    Math.max(0,halo-room.w/2),Math.max(0,halo-room.h/2));
  });
 assert.equal(visible.length,5,'actual room geometry must reproduce the junction');
 const oldDocument=globalThis.document;
 let paints=0,draws=0;
 globalThis.document={
  createElement(tag){
   assert.equal(tag,'canvas');
   return {width:0,height:0,getContext(){return {translate(){}};}};
  }
 };
 world._paintRoomBase=()=>{paints++;};
 const ctx={drawImage(_image,sx,sy,sw,sh,dx,dy,dw,dh){
  draws++;
  assert.ok(sw>0&&sh>0);
  assert.equal(sw,dw);assert.equal(sh,dh);
  assert.ok(sw<=1296&&sh<=896,'cached layer is cropped to the camera');
 }};
 try{
  for(let frame=0;frame<120;frame++)
   for(const {room,i} of visible)
    world._roomBase(ctx,room,i,{camera});
  assert.equal(paints,5,'unchanged rooms must paint just once');
  assert.equal(draws,600);
  assert.equal(world.roomLayers.size,5);
  assert.equal(world.roomCacheStats.evictions,0);
  world._sectorPowered=idx=>idx===visible[0].i;
  world._roomBase(ctx,visible[0].room,visible[0].i,{camera});
  assert.equal(paints,6,'power-state change refreshes only its own chamber');
  assert.ok(world.roomLayers.size<=6);
 }finally{
  if(oldDocument===undefined)delete globalThis.document;
  else globalThis.document=oldDocument;
 }
});
