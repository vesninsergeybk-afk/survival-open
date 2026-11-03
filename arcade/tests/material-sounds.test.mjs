import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioEngine} from '../../src/audio.js';
import {ArcadeHeritage} from '../heritage.js';
import {AudioLabEngine} from '../../audio-lab/audio-mixer.js';
import {SOUND_CATALOG} from '../../audio-lab/sound-map.js';

function fakeParam(value=0){
 return {value,setValueAtTime(v){this.value=v;},
  linearRampToValueAtTime(v){this.value=v;},
  exponentialRampToValueAtTime(v){this.value=v;},
  cancelScheduledValues(){}};
}
function fakeContext(){
 const starts=[],stops=[],nodes=[];
 const make=(kind,props={})=>{const node={kind,connect(dest){return dest;},
  start(at){starts.push({kind,at});},stop(at){stops.push({kind,at});},...props};
  nodes.push(node);return node;};
 return {currentTime:2,sampleRate:100,starts,stops,nodes,
  createGain(){return make('gain',{gain:fakeParam()});},
  createBiquadFilter(){return make('filter',{frequency:fakeParam(),Q:fakeParam()});},
  createBufferSource(){return make('bufferSource',{loop:false});},
  createOscillator(){return make('oscillator',{frequency:fakeParam()});},
  createStereoPanner(){return make('panner',{pan:fakeParam()});},
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
 };
}
function activeEngine(){
 const audio=new AudioEngine({muted:false,musicEnabled:false});
 const ctx=fakeContext();
 audio.ctx=ctx;audio.sfxGain={gain:{value:1}};audio.masterGain={gain:{value:1}};
 audio.musicGain={gain:{value:1}};audio.enabled=true;audio.unlocked=true;
 return {audio,ctx};
}
test('mining extractor sustains exactly one layered voice and stops on release',()=>{
 const {audio,ctx}=activeEngine();
 audio.setExtractionActive(true);
 assert.ok(audio.extractionVoice);
 assert.equal(ctx.starts.length,3);
 audio.setExtractionActive(true);
 assert.equal(ctx.starts.length,3,'holding F must never restart the tool');
 audio.setExtractionActive(false);
 assert.equal(audio.extractionVoice,null);
 assert.equal(ctx.stops.length,3,'release must stop the entire sound layer');
 audio.setExtractionActive(false);
 assert.equal(ctx.stops.length,3,'no extra stop on following frame');
});
test('muting closes extraction sound without touching the mining state',()=>{
 const {audio,ctx}=activeEngine();
 audio.setExtractionActive(true);
 audio.setMuted(true);
 assert.equal(audio.extractionVoice,null);
 assert.equal(ctx.stops.length,3);
 audio.setExtractionActive(true);
 assert.equal(ctx.starts.length,3,'muted player must not hear extractor');
});
test('rocks sound granular, never like a spaceship explosion',()=>{
 const {audio,ctx}=activeEngine();
 assert.equal(audio.rockImpact({heavy:false,pan:.5,intensity:.8}),true);
 assert.equal(ctx.starts.length,1);
 assert.equal(audio.rockImpact({heavy:true,pan:-.3}),true);
 assert.equal(ctx.starts.length,3,'break adds a low stone resonance');
 assert.ok(ctx.nodes.some(n=>n.kind==='filter'&&n.type==='lowpass'));
});
test('legacy sound mapping separates energy shots, enemy fire and stone',()=>{
 const h=new ArcadeHeritage(),shots=[],rocks=[],events=[];
 h.soundOn=true;
 h.audio={shoot:key=>shots.push(key),playEvent:key=>events.push(key),
  rockImpact:options=>{rocks.push(options);return true;}};
 h.play('laser');
 h.play('enemyShot');
 h.play('stone',0,{x:0,y:0});
 h.play('rockBreak',0,{x:0,y:0});
 assert.deepEqual(shots,['starter_soft']);
 assert.deepEqual(events,['magic_wand']);
 assert.deepEqual(rocks.map(o=>o.heavy),[false,true]);
});
test('game mining loop does not emit a gunshot on each resource tick',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/this\.heritage\.extraction\(this\.mining\.active\)/);
 assert.doesNotMatch(game,/kind\s*===\s*['"]extract['"]\s*\)\s*this\.heritage\.play\(['"]laser['"]/);
});

test('starter pulse has a soft procedural texture even without studio samples',()=>{
 const cue=SOUND_CATALOG.starter_soft;
 assert.equal(cue?.profile,'softpulse');
 assert.equal(cue?.sampleUrl,undefined,'public starter must never fetch missing studio recordings');
 const synth=new AudioLabEngine(),notes=[];
 synth.random=()=>0.5;
 synth.osc=(_,params)=>notes.push({source:'osc',...params});
 synth.noise=(_,params)=>notes.push({source:'noise',...params});
 assert.ok(synth.synthesize({},cue.profile,0)>0.1);
 assert.equal(notes.length,3);
 assert.ok(notes.filter(n=>n.source==='osc').every(n=>n.type!=='sawtooth'&&n.from<350));
 assert.ok(notes.filter(n=>n.source==='noise').every(n=>n.filter==='lowpass'&&n.frequency<=1000));
});
test('starter auto-fire recedes during continuous volleys and resets after quiet',()=>{
 const h=new ArcadeHeritage(),shots=[];
 h.soundOn=true;
 h.audio={shoot:(key,options)=>shots.push({key,intensity:options.intensity})};
 for(let i=0;i<6;i++){
  h.vfx.clock=i*0.36;
  assert.equal(h.play('laser',0.32),true);
 }
 assert.ok(shots.every(s=>s.key==='starter_soft'));
 assert.equal(shots[0].intensity,1);
 assert.ok(shots[5].intensity<shots[0].intensity);
 assert.ok(shots[5].intensity>=0.6,'sustained fire must remain audible');
 h.vfx.clock=5;
 h.play('laser',0.32);
 assert.equal(shots.at(-1).intensity,1,'first shot after quiet has its full presence');
});

test('the final mix has a limiter and music ducking never overwrites player volume',()=>{
 const oldWindow=globalThis.window,ctx=fakeContext();
 ctx.state='running';ctx.destination={};
 ctx.createDynamicsCompressor=()=>({
  threshold:fakeParam(),knee:fakeParam(),ratio:fakeParam(),
  attack:fakeParam(),release:fakeParam(),connect(target){return target;}
 });
 globalThis.window={AudioContext:class {constructor(){return ctx;}}};
 try {
  const audio=new AudioEngine({muted:false,musicEnabled:true,masterVolume:.6,
   sfxVolume:.8,musicVolume:.35});
  audio.init();
  assert.ok(audio.limiter,'the summed output must have a safety limiter');
  assert.notEqual(audio.musicDuckGain,audio.musicGain);
  audio.musicDuckGain.gain.value=.38;
  audio.musicScale=.7;
  audio.applyVolumes();
  assert.equal(audio.musicDuckGain.gain.value,.38,
   'scene volume polling must not reset explosion ducking');
  assert.equal(audio.musicGain.gain.value,.35*.7);
 } finally {
  if(oldWindow===undefined)delete globalThis.window;
  else globalThis.window=oldWindow;
 }
});

test('direct procedural effects never exceed their separate voice budget',()=>{
 const {audio,ctx}=activeEngine();
 for(let i=0;i<30;i++)audio.tone({freq:120,dur:.1});
 assert.equal(audio.directVoices.size,16);
 assert.equal(ctx.starts.length,16);
 const ended=[...audio.directVoices][0];
 ended.onended();
 assert.equal(audio.directVoices.size,15);
 audio.tone({freq:130,dur:.12});
 assert.equal(ctx.starts.length,17);
});

test('both rocket detonation and armored contacts are routed into sound catalog',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const heritage=readFileSync(new URL('../heritage.js',import.meta.url),'utf8');
 assert.match(game,/this\.heritage\.play\('rocketImpact'/);
 assert.match(game,/this\.heritage\.play\('armorHit'/);
 assert.match(game,/this\.heritage\.play\(heavy\?'largeExplosion':'explosion',\.18,\{x:e\.x,y:e\.y\}\)/);
 assert.match(heritage,/rocketImpact:'explosion_small'/);
 assert.match(heritage,/armorHit:'armor_hit'/);
});
