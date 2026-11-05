import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoomForDrop} from '../drop-capacity.js';
import {RuntimeHarness} from './runtime-game.mjs';
import {RULES} from '../balance.js';

test('under capacity, no existing loot moves or gets collected',()=>{
 const drops=[{type:'ore',life:20}];
 assert.equal(makeRoomForDrop(drops,3),true);
 assert.equal(drops.length,1);
 assert.equal(makeRoomForDrop(drops,0),false);
});

test('at capacity, the oldest expiring ordinary loot is replaced without crediting the pilot',()=>{
 const game=new RuntimeHarness();
 game.drops=Array.from({length:RULES.maxDrops},(_,i)=>({
  type:i===0?'fieldCell':'ore',life:i===3?1:30,x:i,y:0
 }));
 const charge=game.drops[0];
 game.collect=()=>{throw Error('overflow must never call collect()');};
 assert.notEqual(game.addDrop('data',9000,7000,7,{source:'combat',xpGranted:false}),false);
 assert.equal(game.drops.length,RULES.maxDrops);
 assert.equal(game.drops[0],charge,'field charges survive saturation');
 const added=game.drops.at(-1);
 assert.deepEqual([added.type,added.value,added.source,added.xpGranted,added.life],
  ['data',7,'combat',false,34]);
 assert.ok(!game.drops.some(d=>d.x===3),'fading ordinary loot is evicted');
});

test('an all-special-charge pool cannot overwrite a mission charge or auto-claim a reward',()=>{
 const game=new RuntimeHarness();
 game.drops=Array.from({length:RULES.maxDrops},()=>({type:'fieldCell',life:20}));
 game.collect=()=>{throw Error('overflow must not collect on behalf of the pilot');};
 assert.equal(game.addDrop('data',900,900,25,{source:'combat',xpGranted:false}),false);
 assert.equal(game.drops.length,RULES.maxDrops);
 assert.ok(game.drops.every(d=>d.type==='fieldCell'));
});

test('an already credited combat kill stays marked after a crowded-field spawn',()=>{
 const game=new RuntimeHarness();
 game.drops=Array.from({length:RULES.maxDrops},()=>({type:'ore',life:5}));
 game.addDrop('data',10,20,15,{source:'combat',xpGranted:true,life:50});
 assert.equal(game.drops.at(-1).xpGranted,true);
 assert.equal(game.drops.at(-1).life,50);
});
