import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioEngine} from '../src/audio.js';
import {AudioLabEngine} from './audio-mixer.js';

test('combat sample preparation does not ask to resume or play audio',async()=>{
 const oldWindow=globalThis.window;
 globalThis.window={AudioContext:class{}};
 try{
  const audio=new AudioEngine({muted:true});
  const events=[];
  audio.init=()=>{
   audio.sfxLab={loadSampleFromUrl:async(key,url,options)=>events.push({key,url,...options})};
  };
  const first=audio.primeEssentials();
  assert.strictEqual(audio.primeEssentials(),first,'preload should start only once');
  await first;
  assert.equal(audio.unlocked,false,'preparation is allowed while sound is muted');
  for(const key of ['starter_soft','comet_launch','comet_burst','mine_launch','mine_arm',
   'mine_burst','target_mark','dash_burst','swarm_arrival','swarm_split','swarm_merge','swarm_warning']){
   assert(events.some(entry=>entry.key===key),'missing preload cue '+key);
  }
  assert(events.every(entry=>entry.prepareOnly&&entry.append),
   'preparation must not resume the AudioContext');
  assert(events.every(entry=>entry.url.endsWith('.ogg')));
 } finally{globalThis.window=oldWindow;}
});

test('preloading OGG data decodes without invoking AudioContext.resume',async()=>{
 const oldFetch=globalThis.fetch;
 let decoded=0;
 globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new Uint8Array([79,103,103,83]).buffer});
 try{
  const ctx={state:'suspended',decodeAudioData:async()=>{
   decoded++;return {duration:.45,numberOfChannels:1};
  },resume(){throw new Error('AudioContext resumed before user gesture');}};
  const lab=new AudioLabEngine({context:ctx});
  await lab.loadSampleFromUrl('starter_soft','https://example.test/shot.ogg',
   {append:true,index:0,prepareOnly:true});
  assert.equal(decoded,1);
  assert.equal(lab.bufferByKey.get('starter_soft')[0].duration,.45);
  assert.equal(lab.master,null,'preloading must not build or activate the mixer');
 }finally{globalThis.fetch=oldFetch;}
});
