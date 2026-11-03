import test from 'node:test';
import assert from 'node:assert/strict';
import {uiSoundPlan,worldSoundPlan,sceneSoundPlan,ambientSoundPlan,AmbientSoundClock} from '../soundscape.js';

test('interface cues are short, distinct, and kept on the effects bus',()=>{
 const names=['open','map','tab','dock','close','select','deny','cancel','slider','audioOn'];
 for(const name of names){
  const plan=uiSoundPlan(name);
  assert.ok(plan.length>=1&&plan.length<=2,name);
  for(const note of plan){
   assert.equal(note.bus,'sfx',name);
   assert.ok(note.dur<.2,name);
   assert.ok(note.volume>0&&note.volume<=.1,name);
  }
 }
 assert.notDeepEqual(uiSoundPlan('dock'),uiSoundPlan('map'));
 // An intentionally mechanical interface avoids high-pitched 16-bit chirps.
 for(const name of ['open','map','tab','dock','close','select','confirm','deny','cancel','slider','audioOn']){
  for(const note of uiSoundPlan(name)){
   assert.ok(note.noise || note.freq<=230, `${name} sounds too high and synthetic`);
   if(note.noise)assert.ok(note.noiseBand>0, `${name} unfiltered white noise`);
  }
 }
 assert.deepEqual(uiSoundPlan('unknown'),[]);
});
test('world cues are transient and adaptive layers obey music-volume bus',()=>{
 for(const kind of ['discover','amber','ion','contract']){
  const plan=worldSoundPlan(kind);
  assert.ok(plan.length>=1&&plan.length<=2,kind);
  assert.ok(plan.every(n=>n.bus==='sfx'));
 }
 for(const kind of ['void','station','extraction','alert','battle','siege']){
  assert.ok(ambientSoundPlan(kind).every(n=>n.bus==='music'));
  assert.ok(ambientSoundPlan(kind).length<=2);
 }
 for(const kind of ['alert','battle','siege','recovery']){
  assert.ok(sceneSoundPlan(kind).every(n=>n.bus==='music'));
 }
 assert.deepEqual(sceneSoundPlan('drift'),[]);
 assert.deepEqual(ambientSoundPlan('extraction'),[], 'extractor owns its sustained acoustic layer');
});
test('environment events stay sparse, stop on pause and follow threat priority',()=>{
 const clock=new AmbientSoundClock();
 for(let i=0;i<3;i++)assert.equal(clock.tick(4,{nearStation:true}),null);
 assert.equal(clock.tick(1,{nearStation:true}),'station');
 assert.equal(clock.tick(100,{mining:true}),null); // capped time step
 assert.equal(clock.tick(9,{mining:true}),null); // capped time step
 assert.equal(clock.tick(4,{scene:'battle'}),null);
 assert.equal(clock.tick(4,{scene:'battle'}),'battle');
 const t=clock.elapsed;
 assert.equal(clock.tick(30,{paused:true,scene:'siege'}),null);
 assert.equal(clock.elapsed,t);
});
