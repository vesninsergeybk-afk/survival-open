import test from 'node:test';
import assert from 'node:assert/strict';
import {uiSoundPlan,worldSoundPlan,sceneSoundPlan,ambientSoundPlan,AmbientSoundClock} from '../soundscape.js';
import {SOUND_CATALOG} from '../../audio-lab/sound-map.js';

test('UI events use individual recordings and no synthesized notes',()=>{
 const names=['open','map','tab','dock','close','select','confirm','deny','cancel','slider','audioOn'];
 const keys=new Set();
 for(const name of names){
  const plan=uiSoundPlan(name);
  assert.equal(plan.length,1,name);
  const {key,intensity}=plan[0];
  assert(SOUND_CATALOG[key]?.sampleUrl,name);
  assert.equal(SOUND_CATALOG[key]?.family,'ui');
  assert(!('freq' in plan[0])&&!('noise' in plan[0]),name);
  assert(intensity>0&&intensity<=1);
  keys.add(key);
 }
 assert(keys.size>=10);
 assert.deepEqual(uiSoundPlan('unknown'),[]);
});
test('world, scenes and ambient layer recordings are part of one catalog',()=>{
 for(const kind of ['discover','amber','ion','contract']){
  const [recorded]=worldSoundPlan(kind);
  assert(SOUND_CATALOG[recorded.key]?.sampleUrl,kind);
 }
 for(const kind of ['void','station','extraction','alert','battle','siege']){
  for(const cue of ambientSoundPlan(kind))assert(SOUND_CATALOG[cue.key]?.sampleUrl);
 }
 for(const kind of ['alert','battle','siege','recovery']){
  for(const cue of sceneSoundPlan(kind))assert(SOUND_CATALOG[cue.key]?.sampleUrl);
 }
 assert.deepEqual(sceneSoundPlan('drift'),[]);
 assert.deepEqual(ambientSoundPlan('extraction'),[],
   'extractor uses a continuous engine recording, not a short periodic cue');
});
test('environment events stay sparse, stop on pause and follow threat priority',()=>{
 const clock=new AmbientSoundClock();
 for(let i=0;i<3;i++)assert.equal(clock.tick(4,{nearStation:true}),null);
 assert.equal(clock.tick(1,{nearStation:true}),'station');
 assert.equal(clock.tick(100,{mining:true}),null);
 assert.equal(clock.tick(9,{mining:true}),null);
 assert.equal(clock.tick(4,{scene:'battle'}),null);
 assert.equal(clock.tick(4,{scene:'battle'}),'battle');
 const t=clock.elapsed;
 assert.equal(clock.tick(30,{paused:true,scene:'siege'}),null);
 assert.equal(clock.elapsed,t);
});
