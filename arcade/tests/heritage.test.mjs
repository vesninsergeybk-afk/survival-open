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

test('a station comes online immediately; its cinematic tail does not block mechanics',()=>{
 const h=new ArcadeHeritage();
 const calls=[],pending=[];
 h.soundOn=true;
 h.audio={baseAction:options=>calls.push(options.action+':'+options.type),
  tone:options=>calls.push('tone:'+options.type),
  playEvent:key=>calls.push(key)};
 h.scheduled=(callback,delay)=>pending.push({callback,delay});
 h.station('activate','dock');
 assert.equal(calls[0],'activate:dock');
 assert.equal(calls.filter(s=>s.startsWith('tone:')).length,2);
 assert.deepEqual(pending.map(x=>x.delay),[650,1560,2690]);
 pending.forEach(x=>x.callback());
 assert.equal(calls.filter(s=>s.startsWith('tone:')).length,7);
 assert.ok(!calls.includes('upgrade_standard'), 'startup must not add a generic arcade success chime');
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

test('menu, discoveries and musical motifs are audible only when enabled',()=>{
 const h=new ArcadeHeritage();
 const calls=[];
 h.audio={tone:note=>calls.push(note),setMusicState:()=>{}};
 h.scheduled=(callback)=>callback();
 h.ui('dock');
 h.world('discover');
 assert.equal(calls.length,0);
 h.soundOn=true;
 h.ui('dock');
 h.world('discover');
 assert.equal(calls.length,4);
 assert.ok(calls.every(n=>n.bus==='sfx'));
 h.emitNotes([{freq:110,dur:.2,bus:'music',afterMs:0}]);
 assert.equal(calls.at(-1).bus,'music');
 h.hidden=true;
 h.emitNotes([{freq:200,dur:.2,afterMs:0}]);
 assert.equal(calls.length,5);
});
test('antenna and module construction use dedicated events',()=>{
 const h=new ArcadeHeritage(),events=[];
 h.soundOn=true;h.audio={playEvent:key=>events.push(key)};
 h.station('upgrade','dock',{tech:'relay'});
 h.station('upgrade','dock',{tech:'module'});
 assert.deepEqual(events,['base_resonance_link','base_section_construct']);
});
