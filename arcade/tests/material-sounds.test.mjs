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
  createBufferSource(){return make('bufferSource',{loop:false,playbackRate:{value:1}});},
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
test('extractor loops one recorded engine sample and stops when released',()=>{
 const {audio,ctx}=activeEngine();
 const samples=new Map([['extractor_loop',{duration:2.8}]]);
 audio.sfxLab={master:{},bufferByKey:samples,play:()=>true};
 audio.setExtractionActive(true);
 assert.ok(audio.extractionVoice);
 assert.equal(ctx.starts.length,1,'one recorded engine source, not three generators');
 audio.setExtractionActive(true);
 assert.equal(ctx.starts.length,1);
 audio.setExtractionActive(false);
 assert.equal(audio.extractionVoice,null);
 assert.equal(ctx.stops.length,1);
});
test('muting stops the extractor and a missing recording never produces beeps',()=>{
 const {audio,ctx}=activeEngine();
 audio.sfxLab={master:{},bufferByKey:new Map(),play:()=>false};
 audio.setExtractionActive(true);
 assert.equal(ctx.starts.length,0);
 assert.equal(audio.rockImpact({heavy:true}),false);
 assert.equal(ctx.starts.length,0);
 assert.equal(audio.tone({freq:440}),false);
});
test('rock impacts use separate sampled ore recordings',()=>{
 const {audio}=activeEngine(),events=[];
 audio.sfxLab={master:{},play:(key,opts)=>{events.push({key,...opts});return true;}};
 assert.equal(audio.rockImpact({heavy:false,pan:.5,intensity:.8}),true);
 assert.equal(audio.rockImpact({heavy:true,pan:-.3}),true);
 assert.deepEqual(events.map(e=>e.key),['rock_chip','rock_break']);
 assert.deepEqual(events.map(e=>e.pan),[.5,-.3]);
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

test('starter auto-fire combines five pairs of physically recorded impacts',()=>{
 const cue=SOUND_CATALOG.starter_soft;
 assert.equal(cue?.profile,'softpulse');
 assert.equal(cue?.sampleUrls.length,5);
 assert.equal(cue?.sampleLayerUrls.length,5);
 assert(cue.sampleUrls.every(path=>path.includes('/kenney/impactMetal_medium_')));
 assert(cue.sampleLayerUrls.every(path=>path.includes('/kenney/impactSoft_medium_')));
 assert(!cue.sampleUrls.concat(cue.sampleLayerUrls).some(path=>path.includes('laser')));
 assert.equal(cue.layerGain,.3);
 const mixer=new AudioLabEngine();
 assert.equal(mixer.bufferByKey.has('starter_soft'),false);
 assert.equal(mixer.layerBuffersByKey.has('starter_soft'),false);
});
test('each auto-fire plays exactly two decoded recordings without oscillators',()=>{
 const oldWindow=globalThis.window,ctx=fakeContext();
 ctx.state='running';
 globalThis.window={setTimeout:()=>0};
 try {
  const mixer=new AudioLabEngine({context:ctx});
  mixer.master={};mixer.buses={weapons:{}};mixer.random=()=>0;
  mixer.bufferByKey.set('starter_soft',[{duration:.18}]);
  mixer.layerBuffersByKey.set('starter_soft',[{duration:.16}]);
  assert.equal(mixer.play('starter_soft'),true);
  assert.equal(ctx.starts.length,2,'metal attack plus soft body layer');
  assert.equal(ctx.nodes.filter(n=>n.kind==='oscillator').length,0);
 }finally{
  if(oldWindow===undefined)delete globalThis.window;
  else globalThis.window=oldWindow;
 }
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

test('no synthesised signal is generated when audio clips are unavailable',()=>{
 const {audio,ctx}=activeEngine();
 assert.equal(audio.tone({freq:120}),false);
 assert.equal(audio.shoot('starter_soft'),false);
 assert.equal(audio.explosion('big'),false);
 assert.equal(ctx.starts.length,0);
 const mixer=new AudioLabEngine({context:{...ctx,state:'running'}});
 assert.equal(mixer.play('starter_soft'),false);
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
