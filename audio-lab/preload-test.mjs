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
  for(const key of ['ui_audio_on','starter_soft','comet_launch','comet_burst',
   'artillery_launch','artillery_impact','mine_launch','mine_arm',
   'mine_burst','target_mark','dash_burst','swarm_arrival','swarm_split','swarm_merge','swarm_warning']){
   assert(events.some(entry=>entry.key===key),'missing preload cue '+key);
  }
  assert(events.every(entry=>entry.prepareOnly&&entry.append),
   'preparation must not resume the AudioContext');
  assert(events.every(entry=>entry.url.endsWith('.ogg')));
 } finally{globalThis.window=oldWindow;}
});

test('sound-on feedback waits for its real recording and an unlocked mixer',async()=>{
 const audio=new AudioEngine({muted:false});
 const loads=[];
 audio.init=()=>{};
 audio.sfxLab={ctx:{state:'running'},bufferByKey:new Map(),
  loadSampleFromUrl:async(key,url,options)=>{
   loads.push({key,url,options});
   audio.sfxLab.bufferByKey.set(key,[{duration:.5}]);
  },unlock:async()=>{}};
 assert.equal(await audio.readyForCue('ui_audio_on'),true);
 assert.equal(await audio.readyForCue('ui_audio_on'),true);
 assert.equal(loads.length,1,'the feedback cue must not be fetched twice');
 assert.equal(loads[0].key,'ui_audio_on');
 assert.equal(loads[0].options.prepareOnly,true);
 assert.ok(loads[0].url.endsWith('.ogg'));
 audio.settings.muted=true;
 assert.equal(await audio.readyForCue('ui_audio_on'),false);
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
