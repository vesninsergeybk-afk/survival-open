/**
 * Public sound library contract. The 46 Kenney audio assets are pinned in
 * kenney/manifest.json and installed into the Pages bundle by the workflow.
 */
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
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
assert.equal(source.files.length,46,'All verified Kenney sources should be pinned');
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
assert.equal(Object.keys(BASE_SOUNDS).length,29);
assert.equal(Object.keys(EVENT_SOUNDS).length,13);
assert.equal(WEAPON_SOUNDS.starter_soft.sampleUrls.length,5);
assert.equal(WEAPON_SOUNDS.starter_soft.sampleLayerUrls.length,5);
assert(WEAPON_SOUNDS.starter_soft.sampleUrls.every(u=>u.includes('impactMetal_medium_')));
assert(WEAPON_SOUNDS.starter_soft.sampleLayerUrls.every(u=>u.includes('impactSoft_medium_')));
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
 remote+' source-file links, '+local+' bundled CC0 references, zero procedural game voices.');
