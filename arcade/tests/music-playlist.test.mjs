import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MUSIC_TRACKS, MUSIC_POOLS, MusicRotation} from '../music-playlist.js';
import {MUSIC_SCENES} from '../audio-director.js';

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
