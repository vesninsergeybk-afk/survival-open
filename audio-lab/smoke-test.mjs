/**
 * Public sound library contract. Remote Kenney and packaged Foley recordings
 * are pinned by separate manifests.
 */
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {WEAPONS} from '../src/data.js';
import {WEAPON_SOUNDS,EVENT_SOUNDS,BASE_SOUNDS,AUX_SOUNDS,SOUND_CATALOG} from './sound-map.js';

const here=dirname(fileURLToPath(import.meta.url));
const game=resolve(here,'..');
const ids=Object.values(WEAPONS).map(item=>item.id).sort();
assert.deepEqual(Object.keys(WEAPON_SOUNDS).filter(id=>id!=='starter_soft').sort(),ids,
 'Every weapon must have a matching event');
const source=JSON.parse(readFileSync(resolve(here,'assets/sfx/kenney/manifest.json'),'utf8'));
assert.equal(source.license,'CC0-1.0');
assert.match(source.sourceCommit,/^[a-f0-9]{40}$/);
assert.equal(source.files.length,36,'Only referenced Kenney files should be pinned');
const names=new Set(source.files.map(entry=>{
 assert.match(entry.blobSha,/^[a-f0-9]{40}$/);
 assert(entry.size>0);
 return entry.file;
}));
assert.equal(names.size,source.files.length,'Source files cannot be duplicated');
const referenced=new Set(Object.values(SOUND_CATALOG).flatMap(def=>
 [...(def.sampleUrls?.length?def.sampleUrls:def.sampleUrl?[def.sampleUrl]:[]),...(def.sampleLayerUrls||[])]
 .filter(url=>url.includes('/kenney/')).map(url=>url.split('/').at(-1))));
assert.deepEqual([...referenced].sort(),[...names].sort(),
 'Every downloaded CC0 recording should actually be used by an audible event');

const foley=JSON.parse(readFileSync(resolve(here,'assets/sfx/foley/manifest.json'),'utf8'));
assert.equal(foley.license,'CC0-1.0');
assert.equal(foley.files.length,28,'Recorded Foley library must be complete');
const durations=new Map();
for(const entry of foley.files){
 assert.match(entry.sha256,/^[a-f0-9]{64}$/);
 assert(entry.seconds>.15&&entry.seconds<2,'Foley cue has unexpected duration: '+entry.file);
 const data=readFileSync(resolve(here,'assets/sfx/foley',entry.file));
 assert.equal(data.subarray(0,4).toString(),'OggS','Invalid Foley file: '+entry.file);
 assert.equal(createHash('sha256').update(data).digest('hex'),entry.sha256,
  'Published Foley data changed: '+entry.file);
 assert(!durations.has(entry.file),'Duplicate recorded Foley: '+entry.file);
 durations.set(entry.file,entry.seconds);
}
const foleyReferences=new Set(Object.values(SOUND_CATALOG).flatMap(def=>
 [...(def.sampleUrls?.length?def.sampleUrls:def.sampleUrl?[def.sampleUrl]:[]),...(def.sampleLayerUrls||[])]
 .filter(url=>url.includes('/foley/')).map(url=>url.split('/').at(-1))));
assert.deepEqual([...foleyReferences].sort(),[...durations.keys()].sort(),
 'Every packaged recorded file should be used by an audible event');

let local=0,remote=0;
for(const [id,def] of Object.entries(SOUND_CATALOG)){
 assert(def.profile&&def.family,'Missing audio definition: '+id);
 assert(def.minIntervalMs>0&&def.minIntervalMs<=10000,'Invalid throttle: '+id);
 assert(def.priority>=1&&def.priority<=5,'Invalid priority: '+id);
 const urls=[...(def.sampleUrls?.length?def.sampleUrls:def.sampleUrl?[def.sampleUrl]:[]),...(def.sampleLayerUrls||[])];
 assert(urls.length>=1,'Synthesised or missing sound: '+id);
 for(const url of urls){
  assert(!url.includes('/studio/'),'Studio SFX cannot be published: '+id);
  assert(url.startsWith('./assets/sfx/'),'Unknown audio source: '+url);
  if(url.includes('/kenney/')){
   assert(names.has(url.split('/').at(-1)),'Unpinned CC0 asset: '+url);
   remote++;
  }else{
   const path=resolve(here,url);
   assert(existsSync(path),'Missing CC0 sample: '+url);
   assert.equal(readFileSync(path).subarray(0,4).toString('ascii'),'OggS');
   local++;
  }
 }
}
for(const name of ['ui_open','ui_tab','world_discover','scene_alert',
 'ambient_void','rock_chip','rock_break','extractor_loop']){
 assert(AUX_SOUNDS[name]?.sampleUrl,'Missing recorded environment/UI cue: '+name);
}
for(const name of ['field_work','field_shield_up','field_shield_break',
 'field_relay_repair','field_convoy_repair','field_beacon_ok','field_beacon_alarm',
 'field_salvage','field_cassette','field_raid','field_scan',
 'field_reactor_charge','field_pulse']){
 assert(AUX_SOUNDS[name]?.sampleUrl,'Mission scene has no recorded cue: '+name);
}
for(const name of ['comet_launch','comet_burst','mine_launch','mine_arm','mine_burst',
 'target_mark','dash_burst','swarm_arrival','swarm_split','swarm_merge','swarm_warning',
 'artillery_servo','artillery_launch','artillery_impact','artillery_destroyed']){
 const def=AUX_SOUNDS[name];
 assert(def?.sampleUrls?.length&&def?.sampleLayerUrls?.length,
  'Combat mechanic needs a separately mixed, recorded attack and body: '+name);
 assert.equal(def.sampleUrls.length,def.sampleLayerUrls.length);
 assert(def.fixedPitch,'Recorded combat Foley must keep its natural pitch');
 const longest=Math.max(...[...def.sampleUrls,...def.sampleLayerUrls]
  .map(url=>durations.get(url.split('/').at(-1))||0));
 assert(def.maxDuration>=longest-.02,
  'Combat effect is being truncated: '+name+' '+def.maxDuration+' < '+longest);
}
for(const name of ['artillery_build','artillery_online','artillery_charge',
 'artillery_servo','artillery_acquire','artillery_launch','artillery_impact',
 'artillery_hit','artillery_destroyed']){
 const def=AUX_SOUNDS[name];
 assert(def?.sampleUrl,'Field artillery sound must exist: '+name);
 assert(['recorded'].includes(def.profile),'No synthesised artillery cue: '+name);
}
assert.equal(Object.keys(BASE_SOUNDS).length,29);
assert.equal(Object.keys(EVENT_SOUNDS).length,13);
assert.equal(WEAPON_SOUNDS.starter_soft.sampleUrls.length,5);
assert.equal(WEAPON_SOUNDS.starter_soft.sampleLayerUrls.length,5);
assert(WEAPON_SOUNDS.starter_soft.sampleUrls.every(u=>u.includes('/foley/')));
assert(WEAPON_SOUNDS.starter_soft.sampleLayerUrls.every(u=>u.includes('/foley/')));
assert(WEAPON_SOUNDS.starter_soft.fixedPitch);
assert(WEAPON_SOUNDS.starter_soft.maxDuration>=Math.max(...[
 ...WEAPON_SOUNDS.starter_soft.sampleUrls,...WEAPON_SOUNDS.starter_soft.sampleLayerUrls
 ].map(url=>durations.get(url.split('/').at(-1))||0))-.02);
assert(![...WEAPON_SOUNDS.starter_soft.sampleUrls,...WEAPON_SOUNDS.starter_soft.sampleLayerUrls].some(u=>u.includes('laser')),
 'Starter auto-fire must never use electronic laser beeps');
assert(existsSync(resolve(here,'assets/sfx/studio/SOURCES.md')));
const audio=readFileSync(resolve(game,'src/audio.js'),'utf8');
const mixer=readFileSync(resolve(here,'audio-mixer.js'),'utf8');
assert(audio.includes('new AudioLabEngine('));
assert(audio.includes('musicDuckBus: this.musicDuckGain'));
assert(audio.includes('this.musicGain.connect(this.musicDuckGain)'));
assert(!audio.includes('createOscillator('),'Game still synthesises tones');
assert(!mixer.includes('createOscillator('),'Mixer still synthesises tones');
assert(!mixer.includes('synthesize('),'Missing audio must remain silent');
console.log('Survivor audio: '+Object.keys(SOUND_CATALOG).length+
 ' recorded events, '+source.files.length+' pinned Kenney CC0 OGGs, '+
 foley.files.length+' physically recorded Foley OGGs, '+remote+' source-file links, '+local+
 ' bundled CC0 references, zero procedural game voices.');
