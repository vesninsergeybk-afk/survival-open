import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioEngine} from '../../src/audio.js';
import {ArcadeHeritage} from '../heritage.js';

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
 assert.deepEqual(shots,['whip']);
 assert.deepEqual(events,['magic_wand']);
 assert.deepEqual(rocks.map(o=>o.heavy),[false,true]);
});
test('game mining loop does not emit a gunshot on each resource tick',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/this\.heritage\.extraction\(this\.mining\.active\)/);
 assert.doesNotMatch(game,/kind\s*===\s*['"]extract['"]\s*\)\s*this\.heritage\.play\(['"]laser['"]/);
});
