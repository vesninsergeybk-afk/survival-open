/** node --test site/games/survivor/tests/prologue-audio.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PROLOGUE_CUES, playPrologueCue } from '../src/prologue-audio-events.js';
import { SOUND_CATALOG } from '../audio-lab/sound-map.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const worldCode = readFileSync(resolve(root, 'src/prologue-mission.js'), 'utf8');

test('All prologue sound cues map to existing licensed or procedural game effects', () => {
    assert.ok(Object.keys(PROLOGUE_CUES).length >= 24);
    for (const [event, sound] of Object.entries(PROLOGUE_CUES)) {
        assert.ok(SOUND_CATALOG[sound], event + ' references missing sample key: ' + sound);
    }
    assert.ok(!worldCode.includes("'base_activate'"),
        'The unregistered base_activate event must not mute reactor and turret startup');
});

test('Local sounds pan and fade, distant machinery is silent, narrative cues remain audible', () => {
    const calls = [];
    const game = {
        player: { x: 100, y: 40 },
        audio: { playEvent(key, opts) { calls.push({ key, ...opts }); return true; } }
    };
    assert.equal(playPrologueCue(game, 'robot_wake', { x: 550, y: 40 }), true);
    assert.ok(calls[0].pan > 0, 'Machine to the right should pan right');
    assert.ok(calls[0].intensity < 1, 'Local distance should attenuate volume');
    assert.equal(playPrologueCue(game, 'robot_wake', { x: 1600, y: 40 }), false);
    assert.equal(calls.length, 1, 'Out-of-range robot must not consume a mixer voice');
    assert.equal(playPrologueCue(game, 'siege_started', { x: 1600, y: 40 }), true);
    assert.equal(calls[1].pan, 0, 'Important narrative alarm remains centered');
});

test('Cue routes cover mission transitions and combat without frame-by-frame alarm spam', () => {
    for (const sound of ['reactor_online','turret_boot','heavy_boot','gate_motor',
        'beam_start','beam_interrupted','robot_wake','robot_destroyed',
        'core_warning','defense_success','transmission_finished']) {
        assert.ok(worldCode.includes("'"+sound+"'"), sound+' not wired into Mission 00');
    }
    assert.ok(worldCode.includes('game.gameTime>=this.nextCoreHitCue'),
        'Core impact must be rate-limited');
    assert.ok(worldCode.includes('!spot.soundStarted'),
        'Each sleeping SPAC-1 chassis should play startup only once');
});
