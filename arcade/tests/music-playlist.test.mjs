import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MUSIC_TRACKS, MUSIC_POOLS, MusicRotation} from '../music-playlist.js';
import {MUSIC_SCENES} from '../audio-director.js';
import {AudioEngine} from '../../src/audio.js';

const arcade = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(arcade, '..');

test('all licensed tracks exist and every score state resolves to a nonempty playlist', () => {
  assert.equal(Object.keys(MUSIC_TRACKS).length, 12);
  assert.equal(new Set(Object.values(MUSIC_TRACKS).map(t=>t.file)).size, 12);
  for (const [id, track] of Object.entries(MUSIC_TRACKS)) {
    assert.ok(track.source.startsWith('https://www.scottbuckley.com.au/library/'), id);
    assert.ok(track.level>0 && track.level<=1, id);
    const path = resolve(root, 'assets/audio/music', track.file);
    assert.ok(existsSync(path), id + ' missing from public repository');
    assert.ok(statSync(path).size > 100000, id + ' music is suspiciously small');
    assert.equal(readFileSync(path).subarray(0,4).toString('ascii'),'OggS',id);
  }
  for (const [category, ids] of Object.entries(MUSIC_POOLS)) {
    assert.ok(ids.length>=2, category + ' lacks variety');
    assert.equal(new Set(ids).size, ids.length, category + ' contains duplicates');
    assert.ok(ids.every(id=>MUSIC_TRACKS[id]), category + ' refers to missing track');
  }
  for (const scene of Object.values(MUSIC_SCENES))
    assert.ok(MUSIC_POOLS[scene.track], scene.track + ' missing a playlist');
  assert.equal(MUSIC_SCENES.alert.track, 'tension');
});

test('opening tracks are varied across separate sessions and persisted', () => {
  const storage = {
    data:new Map(),getItem(k){return this.data.get(k)??null},
    setItem(k,v){this.data.set(k,v)}
  };
  const intros = [];
  for (let i=0;i<12;i++) {
    const rotation = new MusicRotation({storage,random:()=>0});
    intros.push(rotation.next('opening'));
  }
  for (let i=0;i<10;i++)
    assert.equal(new Set(intros.slice(i,i+3)).size,3,'Opening repeated before pool exhaustion at '+i);
});

test('each battle category has a shuffle bag and avoids immediate repeats', () => {
  const rotation = new MusicRotation({storage:null,random:()=>.999});
  for (const category of ['exploration','tension','combat','boss']) {
    const pool = MUSIC_POOLS[category];
    const firstRound = pool.map(()=>rotation.next(category));
    assert.equal(new Set(firstRound).size,pool.length,category);
    assert.notEqual(rotation.next(category),firstRound.at(-1),category+' repeated immediately');
  }
});

test('game credits visibly attribute every track and licensed ship graphics', () => {
  const html = readFileSync(resolve(arcade,'index.html'),'utf8');
  const css = readFileSync(resolve(arcade,'style.css'),'utf8');
  const musicCredits = readFileSync(resolve(root,'assets/audio/music/CREDITS.md'),'utf8');
  assert.ok(html.includes('id="creditsDialog"') && html.includes('id="audioCredits"'));
  assert.ok(html.includes('disruptorart.itch.io/tiny-ships-free-spaceships'));
  assert.ok(html.includes('creativecommons.org/licenses/by/4.0/'));
  for (const track of Object.values(MUSIC_TRACKS)) {
    assert.ok(html.includes(track.source), 'Missing in-game artist source: '+track.title);
    assert.ok(musicCredits.includes(track.source), 'Missing asset credits: '+track.title);
  }
  assert.ok(css.includes('#creditsDialog::backdrop'));
  const script=readFileSync(resolve(arcade,'game.js'),'utf8');
  assert.ok(script.includes("credits.showModal()"));
  assert.ok(script.includes("this.paused=true;this.pausedRenderPending=true"));
  const audio=readFileSync(resolve(root,'src/audio.js'),'utf8');
  assert.ok(audio.includes("element.loop = false"),'Playlist cannot advance when track loops forever');
  assert.ok(audio.includes("element.addEventListener('timeupdate'"),'No end-of-track crossfade');
});

test('the real music engine crossfades, rotates and resumes without restarting', () => {
  const originalAudio=globalThis.Audio,originalWindow=globalThis.window;
  class FakeMedia {
    constructor(url){this.src=url;this.duration=200;this.currentTime=0;this.paused=true;this.handlers={};}
    addEventListener(name,handler){this.handlers[name]=handler;}
    play(){this.paused=false;return Promise.resolve();}
    pause(){this.paused=true;}
    emit(name){this.handlers[name]?.();}
  }
  const fakeParam=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},
    linearRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
  const fakeGain=()=>({gain:fakeParam(),connect(){return this;}});
  const ctx={currentTime:30,state:'running',createGain:fakeGain,
    createMediaElementSource(){return {connect(target){return target;}}}};
  try {
    globalThis.Audio=FakeMedia;
    globalThis.window={setTimeout(fn){fn();return 0;}};
    const music=new AudioEngine({musicEnabled:true,musicVolume:.4});
    music.ctx=ctx;music.musicGain=fakeGain();
    music.startMusic();
    const first=music._activeMusic;
    assert.ok(MUSIC_POOLS.opening.includes(first.id));
    assert.equal(first.element.paused,false);
    first.element.currentTime=196;
    first.element.emit('timeupdate');
    const second=music._activeMusic;
    assert.ok(second && second.id!==first.id,'End-of-track must move to another composition');
    assert.ok(MUSIC_POOLS.exploration.includes(second.id));
    music.setMusicState('tension');
    const alert=music._activeMusic;
    assert.ok(MUSIC_POOLS.tension.includes(alert.id));
    alert.element.currentTime=45;
    music.stopMusic();
    music.startMusic();
    assert.equal(music._activeMusic.id,alert.id,'Resume should not shuffle again');
    assert.equal(music._activeMusic.element.currentTime,45,'Resume should keep playback position');
  } finally {
    if(originalAudio===undefined)delete globalThis.Audio;else globalThis.Audio=originalAudio;
    if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
  }
});

test('a third fast threat transition stops the stale first composition',()=>{
 const oldAudio=globalThis.Audio,oldWindow=globalThis.window;
 const media=[];
 class StubMedia {
  constructor(){this.paused=true;this.currentTime=0;this.handlers={};media.push(this);}
  addEventListener(name,fn){this.handlers[name]=fn;}
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
 }
 const param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},
  linearRampToValueAtTime(v){this.value=v;}});
 const gain=()=>({gain:param(),connect(){return this;}});
 try {
  globalThis.Audio=StubMedia;globalThis.window={setTimeout(){}};
  const audio=new AudioEngine({musicEnabled:true,musicVolume:.3});
  audio.ctx={state:'running',currentTime:5,createGain:gain,
   createMediaElementSource(){return {connect(dest){return dest;}}}};
  audio.musicGain=gain();
  audio.startMusic();
  audio.setMusicState('combat');
  audio.setMusicState('tension');
  assert.equal(media.filter(slot=>!slot.paused).length,2,
   'music transitions may overlap at most two tracks');
  assert.equal(audio.musicOn,true);
 } finally {
  if(oldAudio===undefined)delete globalThis.Audio;else globalThis.Audio=oldAudio;
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
 }
});
