import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeHeritage} from '../heritage.js';

test('previous audio engine starts muted and never initializes on its own',()=>{
 const h=new ArcadeHeritage();
 assert.equal(h.soundOn,false);
 assert.equal(h.settings.muted,true);
 assert.equal(h.settings.musicEnabled,false);
 assert.equal(h.audio.ctx,null);
});
test('sound is an explicit reversible player choice',()=>{
 const h=new ArcadeHeritage();
 const calls=[];
 h.audio={
  enabled:true,init(){calls.push('init')},setMuted(v){calls.push('muted:'+v)},
  unlock(){calls.push('unlock')},startMusic(){calls.push('musicOn')},
  stopMusic(){calls.push('musicOff')},shoot(){calls.push('shot')},
  setMusicState(){},
 };
 assert.equal(h.toggleSound(),true);
 assert.deepEqual(calls.slice(0,4),['init','muted:false','unlock','musicOn']);
 h.play('laser',.3);h.play('laser',.3);
 assert.equal(calls.filter(x=>x==='shot').length,1);
 h.tick(.4,0);
 h.play('laser',.3);
 assert.equal(calls.filter(x=>x==='shot').length,2);
 assert.equal(h.toggleSound(),false);
 assert.equal(h.settings.muted,true);
 assert.equal(h.settings.musicEnabled,false);
});
test('original pooled effects downshift instead of exceeding the frame budget',()=>{
 const h=new ArcadeHeritage();
 h.setBudget(18);assert.equal(h.vfx.budgetScale,.27);
 h.setBudget(36);assert.equal(h.vfx.budgetScale,.45);
 h.setBudget(60);assert.equal(h.vfx.budgetScale,1);
});

test('station starts one complete recorded reactor cue without synthetic layers',()=>{
 const h=new ArcadeHeritage(),calls=[],pending=[];
 h.soundOn=true;
 h.audio={baseAction:options=>calls.push(options.action+':'+options.type),
  playEvent:key=>calls.push(key)};
 h.scheduled=(callback,delay)=>pending.push({callback,delay});
 h.station('activate','dock');
 assert.deepEqual(calls,['activate:dock']);
 assert.equal(pending.length,0,'reactor OGG contains its own full tail');
});
test('station transactions are audible only after success and map to separate cues',()=>{
 const h=new ArcadeHeritage();const events=[];
 h.soundOn=true;h.audio={playEvent:key=>events.push(key)};
 h.station('upgrade','arsenal',{tech:'armament'});
 h.station('hire','carrier');h.station('repairDrones','dock');
 h.station('claimContract','lab');h.station('transfer','dock');
 assert.deepEqual(events,['upgrade_weapon','base_escort_launch',
  'base_repair_pulse','achievement','base_resonance_link']);
});
test('rockets use the real sound catalog key instead of an absent weapon',()=>{
 const h=new ArcadeHeritage(),shots=[];
 h.soundOn=true;h.audio={shoot:key=>shots.push(key)};
 h.play('rocket');
 assert.deepEqual(shots,['knife']);
});

test('menu, discoveries and recorded motifs only play when audio is enabled',()=>{
 const h=new ArcadeHeritage(),calls=[];
 h.audio={playEvent:(key,options)=>calls.push({key,...options}),setMusicState:()=>{}};
 h.scheduled=(callback)=>callback();
 h.ui('dock');h.world('discover');
 assert.equal(calls.length,0);
 h.soundOn=true;
 h.ui('dock');h.world('discover');
 assert.deepEqual(calls.map(x=>x.key),['ui_dock','world_discover']);
 h.emitNotes([{key:'scene_alert',intensity:.6,afterMs:0}]);
 assert.equal(calls.at(-1).key,'scene_alert');
 assert.equal(calls.at(-1).intensity,.6);
 h.hidden=true;
 h.emitNotes([{key:'scene_battle',afterMs:0}]);
 assert.equal(calls.length,3);
});
test('antenna and module construction use dedicated events',()=>{
 const h=new ArcadeHeritage(),events=[];
 h.soundOn=true;h.audio={playEvent:key=>events.push(key)};
 h.station('upgrade','dock',{tech:'relay'});
 h.station('upgrade','dock',{tech:'module'});
 assert.deepEqual(events,['base_resonance_link','base_section_construct']);
});

test('zero volume persists and far effects never mask nearby impacts',()=>{
 const original=globalThis.localStorage, values=new Map();
 globalThis.localStorage={
  getItem:key=>values.get(key)||null,
  setItem:(key,value)=>values.set(key,value)
 };
 try {
  const h=new ArcadeHeritage(),heard=[];
  h.setVolume('musicVolume',0);
  h.setVolume('sfxVolume',0);
  assert.equal(new ArcadeHeritage().settings.musicVolume,0);
  assert.equal(new ArcadeHeritage().settings.sfxVolume,0);
  h.soundOn=true;h.listener={x:0,y:0};h.viewWidth=900;
  h.audio={playEvent:(key,options)=>heard.push({key,...options}),applyVolumes(){}};
  assert.equal(h.play('hit',.4,{x:1800,y:0}),false,'inaudible distant hits must not consume the cooldown');
  assert.equal(h.play('hit',.4,{x:500,y:0}),true);
  assert.equal(h.play('hit',.4,{x:60,y:0}),true,'nearby shot takes priority over a distant one');
  assert.equal(heard.length,2);
  assert.equal(heard[0].force,undefined);
  assert.equal(heard[1].force,true);
  assert.ok(heard[1].intensity>heard[0].intensity);
 } finally {
  if(original===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=original;
 }
});
