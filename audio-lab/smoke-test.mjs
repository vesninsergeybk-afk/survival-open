/**
 * Survivor audio contract check, no build or dependencies.
 * Run: node audio-lab/smoke-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { WEAPONS } from '../src/data.js';
import { WEAPON_SOUNDS, EVENT_SOUNDS, SOUND_CATALOG } from './sound-map.js';

const here = dirname(fileURLToPath(import.meta.url));
const game = resolve(here, '..');
const ids = Object.values(WEAPONS).map(item => item.id).sort();
assert.deepEqual(Object.keys(WEAPON_SOUNDS).filter(id => id !== 'starter_soft').sort(), ids,
  'Every game weapon needs a unique sound');
assert.equal(WEAPON_SOUNDS.starter_soft.profile, 'softpulse');
assert.equal(WEAPON_SOUNDS.starter_soft.sampleUrl, undefined,
  'Public starter must not depend on excluded studio recordings');

for (const [id, sound] of Object.entries(SOUND_CATALOG)) {
  assert(sound.profile && sound.family, 'Missing sound design: ' + id);
  assert(sound.minIntervalMs > 0 && sound.minIntervalMs <= 5000, 'Invalid throttle: ' + id);
  assert(sound.priority >= 1 && sound.priority <= 5, 'Invalid priority: ' + id);
  if (!sound.sampleUrl) continue;
  const path = resolve(here, sound.sampleUrl);
  // The public repo intentionally omits 21 Sonniss sources.
  if (sound.sampleUrl.includes('/studio/')) {
    assert(!existsSync(path), 'Studio recording should not ship in public repo: ' + id);
    continue;
  }
  assert(existsSync(path), 'Missing CC0 sample ' + id + ': ' + path);
  const signature = readFileSync(path).subarray(0, 4).toString('ascii');
  assert.equal(signature, 'OggS', 'Expected Ogg/Opus or Vorbis: ' + id);
}
assert(Object.keys(EVENT_SOUNDS).includes('explosion_big'));
const studioSamples = Object.values(SOUND_CATALOG).filter(sound => sound.sampleUrl?.includes('/studio/'));
const stationSamples = Object.values(SOUND_CATALOG).filter(sound => sound.sampleUrl?.includes('/base/'));
assert.equal(studioSamples.length, 21, 'Expected 21 excluded studio cues');
const kenney = Object.entries(SOUND_CATALOG).filter(([,sound]) =>
  sound.sampleUrl && !sound.sampleUrl.includes('/studio/') && !sound.sampleUrl.includes('/base/'));
assert.deepEqual(kenney.map(([key])=>key).sort(),
  ['armor_hit','explosion_small','hit','pickup','starter_pulse'],
  'All five verified Kenney files must be wired to live events');
assert.equal(stationSamples.length, 29, 'Expected 29 CC0 station and progression cues');
assert(existsSync(resolve(here, 'assets/sfx/studio/SOURCES.md')),
  'Studio sound provenance document missing');

const weaponsCode = readFileSync(resolve(game, 'src/weapons.js'), 'utf8');
assert((weaponsCode.match(/audio\.shoot\(this\.id\)/g) || []).length >= 3, 'Weapon IDs not routed');
assert(weaponsCode.includes("audio?.shoot?.(this.id)"), 'Special weapons not routed');
const entityCode = readFileSync(resolve(game, 'src/entities.js'), 'utf8');
assert(entityCode.includes("game.audio?.shoot?.('orbit')"), 'Orbit contacts are not routed');

const audioCode = readFileSync(resolve(game, 'src/audio.js'), 'utf8');
assert(audioCode.includes('new AudioLabEngine('), 'Sampler not connected');
assert(audioCode.includes('musicDuckBus: this.musicDuckGain'), 'Isolated music ducking not connected');
assert(audioCode.includes('this.musicGain.connect(this.musicDuckGain)'),
  'Music route must pass through independent duck gain');
for (const key of ['level_up', 'player_death', 'boss_spawn', 'achievement']) {
  assert(audioCode.includes("this.sfxLab.play('" + key + "')"),
    'Missing live event routing: ' + key);
}
const sw = readFileSync(resolve(game, 'service-worker.js'), 'utf8');
assert(sw.includes("const networkFirst = req.mode === 'navigate'"),
  'Changing JS modules should be refreshed network-first');
assert(sw.includes('cache.add(path)'), 'Boot shell is not precached');
assert(!sw.includes("'./audio-lab/assets/sfx/studio/starter_pulse.ogg'"),
  'Audio assets must stay lazy-loaded instead of blocking first-room startup');
console.log('Survivor audio: ' + ids.length + ' weapon profiles; ' +
  stationSamples.length + ' station CC0 + ' + kenney.length + ' Kenney CC0 recordings; 21 procedural studio fallbacks; ' +
  'audio routing/offline paths OK.');
