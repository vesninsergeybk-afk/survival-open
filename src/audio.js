import { AudioLabEngine } from '../audio-lab/audio-mixer.js?v=starter-soft-66';
import { SOUND_CATALOG } from '../audio-lab/sound-map.js?v=starter-soft-66';
import { baseSoundPlan } from './base-audio-events.js?v=audio-91';

/**
 * @module audio
 * @description Mixed licensed cinematic scores and game SFX.
 * Scores are streamed; weapon sounds are sample-backed or synthesised.
 *
 * Dependencies: browser Web Audio API. Degrades silently when unavailable.
 *
 * Exports:
 *   - class AudioEngine
 */

const CINEMATIC_TRACKS = Object.freeze({
    exploration: { file: 'starfire.ogg', level: 0.75 },
    combat: { file: 'pursuit.ogg', level: 0.58 },
    boss: { file: 'eyes-in-the-void.ogg', level: 0.65 }
});

export class AudioEngine {
    constructor(settings) {
        this.settings = settings;
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.musicSlots = new Map();
        this._activeMusic = null;
        this.musicState = 'exploration';
        this.musicOn = false;
        this.musicScale = 1; // Scene mix factor, separate from the player's saved volume.
        this.extractionVoice = null;
        this.enabled = true;
        this.unlocked = false;
        this.sfxLab = null;
        this._samplesPromise = null;
    }

    init() {
        if (this.ctx) return;
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) {
                this.enabled = false;
                return;
            }
            this.ctx = new AC();
            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);
            this.applyVolumes();
            // Sample-ready effects share the existing AudioContext and SFX gain.
            this.sfxLab = new AudioLabEngine({
                context: this.ctx,
                destination: this.sfxGain,
                musicDuckBus: this.musicGain,
                musicLevelProvider: () => this.settings.musicEnabled === false ? 0 :
                    (this.settings.musicVolume ?? 0.4) * this.musicScale
            });
        } catch (err) {
            console.warn('[audio] disabled', err);
            this.enabled = false;
        }
    }

    unlock() {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {
                /* ignore */
            });
        }
        this.unlocked = true;
        if (this.sfxLab) {
            this.sfxLab.unlock().then(() => {
                if (this._samplesPromise) return;
                const root = new URL('../audio-lab/', import.meta.url);
                this._samplesPromise = Promise.allSettled(Object.entries(SOUND_CATALOG)
                    .filter(([, def]) => def.sampleUrl && !def.sampleUrl.includes('/sfx/studio/'))
                    .map(([key, def]) => this.sfxLab.loadSampleFromUrl(key, new URL(def.sampleUrl, root).href)));
            }).catch(err => console.warn('[audio] sample bank unavailable', err));
        }
    }

    applyVolumes() {
        if (!this.ctx) return;
        const s = this.settings;
        // iter-13: a global `muted` flag (toggled by the M hotkey) zeroes the
        // master gain without overwriting masterVolume so unmute restores
        // exactly what the player had before.
        const muteMult = s.muted ? 0 : 1;
        this.masterGain.gain.value = (s.masterVolume ?? 0.6) * muteMult;
        this.sfxGain.gain.value = s.sfxVolume ?? 0.8;
        this.musicGain.gain.value = (s.musicEnabled === false ? 0 : 1) *
            (s.musicVolume ?? 0.4) * this.musicScale;
    }

    /** Toggle a global mute (zeroes master gain, leaves volumes intact). */
    setMuted(flag) {
        this.settings.muted = !!flag;
        if (flag) this.setExtractionActive(false);
        this.applyVolumes();
    }

    // Generic tone helper --------------------------------------------------
    tone({
        freq = 440,
        dur = 0.08,
        type = 'sine',
        volume = 0.2,
        attack = 0.005,
        release = 0.05,
        sweep = 0,
        noise = false,
        noiseBand = 0,
        bus = 'sfx'
    }) {
        if (!this.enabled || !this.ctx || !this.unlocked) return;
        const now = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);
        gain.connect(bus === 'music' ? this.musicGain : this.sfxGain);

        let source;
        if (noise) {
            source = this.ctx.createBufferSource();
            source.buffer = this._noiseBuffer();
            source.loop = true;
        } else {
            const osc = this.ctx.createOscillator();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (sweep) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), now + dur);
            }
            source = osc;
        }
        if (noise && noiseBand && this.ctx.createBiquadFilter) {
            const warmth = this.ctx.createBiquadFilter();
            warmth.type = 'bandpass';
            warmth.frequency.value = noiseBand;
            warmth.Q.value = 0.62;
            source.connect(warmth);
            warmth.connect(gain);
        } else source.connect(gain);
        source.start(now);
        source.stop(now + dur + release + 0.01);
    }

    /**
     * Extractor contact: a sustained abrasive electric texture plus a low motor
     * resonance. One shared voice is held while F is pressed, so damage ticks
     * never trigger a fresh weapon shot or restart the audio.
     */
    setExtractionActive(active) {
        if (!active) {
            const voice = this.extractionVoice;
            if (!voice || !this.ctx) return;
            this.extractionVoice = null;
            const now = this.ctx.currentTime;
            voice.output.gain.cancelScheduledValues(now);
            voice.output.gain.setValueAtTime(Math.max(0.0001, voice.output.gain.value), now);
            voice.output.gain.linearRampToValueAtTime(0.0001, now + 0.16);
            for (const source of voice.sources) {
                try { source.stop(now + 0.18); } catch { /* already stopped */ }
            }
            return;
        }
        if (this.extractionVoice || !this.enabled || !this.unlocked ||
            !this.ctx || this.settings.muted) return;
        const ctx = this.ctx, now = ctx.currentTime;
        const output = ctx.createGain();
        output.gain.setValueAtTime(0.0001, now);
        output.gain.linearRampToValueAtTime(0.75, now + 0.12);
        output.connect(this.sfxGain);

        const staticSource = ctx.createBufferSource();
        staticSource.buffer = this._noiseBuffer();
        staticSource.loop = true;
        const crackle = ctx.createBiquadFilter();
        crackle.type = 'bandpass';
        crackle.frequency.value = 1050;
        crackle.Q.value = 0.52;
        const staticLevel = ctx.createGain();
        staticLevel.gain.value = 0.23;
        staticSource.connect(crackle).connect(staticLevel).connect(output);

        const motor = ctx.createOscillator();
        motor.type = 'triangle';
        motor.frequency.value = 89;
        const motorLevel = ctx.createGain();
        motorLevel.gain.value = 0.095;
        motor.connect(motorLevel).connect(output);

        const flutter = ctx.createOscillator();
        flutter.type = 'sine';
        flutter.frequency.value = 8.5;
        const flutterDepth = ctx.createGain();
        flutterDepth.gain.value = 0.07;
        flutter.connect(flutterDepth).connect(staticLevel.gain);

        staticSource.start(now);
        motor.start(now);
        flutter.start(now);
        this.extractionVoice = { output, sources: [staticSource, motor, flutter] };
    }

    /**
     * Rock and scrap have a granular crunch, not the ship-explosion sample.
     * Stereo position and attenuation are inherited from the game camera.
     */
    rockImpact({ heavy = false, intensity = 1, pan = 0 } = {}) {
        if (!this.ctx || !this.enabled || !this.unlocked || this.settings.muted) return false;
        const ctx = this.ctx, now = ctx.currentTime;
        const life = heavy ? 0.31 : 0.095;
        const gain = ctx.createGain();
        const level = (heavy ? 0.17 : 0.075) * Math.max(0.08, Math.min(1, intensity));
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(level, now + 0.007);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + life);
        if (ctx.createStereoPanner) {
            const stereo = ctx.createStereoPanner();
            stereo.pan.value = Math.max(-0.85, Math.min(0.85, pan));
            gain.connect(stereo).connect(this.sfxGain);
        } else gain.connect(this.sfxGain);

        const grit = ctx.createBufferSource();
        grit.buffer = this._noiseBuffer();
        const gritBand = ctx.createBiquadFilter();
        gritBand.type = 'lowpass';
        gritBand.frequency.value = heavy ? 830 : 1300;
        gritBand.Q.value = 0.65;
        grit.connect(gritBand).connect(gain);
        grit.start(now);
        grit.stop(now + life + 0.015);

        if (heavy) {
            const stone = ctx.createOscillator();
            stone.type = 'triangle';
            stone.frequency.setValueAtTime(132, now);
            stone.frequency.exponentialRampToValueAtTime(70, now + life);
            const body = ctx.createGain();
            body.gain.value = 0.28;
            stone.connect(body).connect(gain);
            stone.start(now);
            stone.stop(now + life + 0.015);
        }
        return true;
    }

    _noiseBuffer() {
        if (this._noise) return this._noise;
        // A long, reusable noise bed avoids audible loops in the extractor.
        const len = Math.round(this.ctx.sampleRate * 2.4);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this._noise = buf;
        return buf;
    }

    /** Game event routed through the licensed/CC0 sample mixer. */
    playEvent(key, options = {}) {
        if (this.sfxLab?.master) return this.sfxLab.play(key, options);
        // Sample bank still unlocking: use a restrained, unpitched cue.
        // A universal 540 Hz beep made unrelated actions sound identical.
        if (!this.ctx || !this.unlocked || this.settings.muted) return false;
        const family = SOUND_CATALOG[key]?.family;
        const low = family === 'impact' || family === 'structure';
        this.tone({ noise: true, noiseBand: low ? 520 : 1150,
            dur: low ? 0.12 : 0.055, volume: low ? 0.11 : 0.045,
            attack: 0.007, release: 0.10 });
        return false;
    }

    /**
     * Successful dock purchases are the sole source of station upgrade cues.
     * A startup first powers the 2.85s reactor; the linked-network result
     * follows the animation rather than competing with its machinery.
     */
    baseAction(options) {
        for (const { key, afterMs } of baseSoundPlan(options)) {
            if (afterMs) window.setTimeout(() => this.playEvent(key), afterMs);
            else this.playEvent(key);
        }
    }

    // High-level SFX -------------------------------------------------------
    hit(material = 'normal') {
        if (this.sfxLab?.master) {
            this.sfxLab.play(material === 'armor' ? 'armor_hit' : material === 'shield' ? 'shield_hit' : 'hit');
            return;
        }
        this.tone({ noise: true, noiseBand: 690, dur: 0.065,
            volume: 0.085, attack: 0.005, release: 0.09 });
    }
    shoot(weaponId = 'starter_pulse', options = {}) {
        if (this.sfxLab?.master) {
            return this.sfxLab.play(weaponId, options);
        }
        // While the mixer unlocks, even the temporary cue stays unobtrusive.
        const intensity = Math.max(0.2, Math.min(1, options.intensity ?? 1));
        this.tone({ noise: true, noiseBand: 720, dur: 0.085,
            volume: 0.034 * intensity, attack: 0.018, release: 0.10 });
        this.tone({ freq: 150, dur: 0.13, type: 'sine',
            volume: 0.028 * intensity, attack: 0.020, release: 0.09, sweep: -22 });
        return true;
    }
    explosion(size = 'big') {
        if (this.sfxLab?.master) {
            this.sfxLab.play(size === 'small' ? 'explosion_small' : 'explosion_big');
            return;
        }
        this.tone({ noise: true, noiseBand: 480, dur: 0.25, volume: 0.20, release: 0.17 });
    }
    pickup() {
        if (this.sfxLab?.master) {
            this.sfxLab.play('pickup');
            return;
        }
        this.tone({ noise: true, noiseBand: 1300, dur: 0.045,
            volume: 0.055, attack: 0.004, release: 0.07 });
    }
    levelUp() {
        if (this.sfxLab?.master) {
            this.sfxLab.play('level_up');
            return;
        }
        this.tone({ noise: true, noiseBand: 740, dur: 0.14, volume: 0.15,
            attack: 0.012, release: 0.18 });
        this.tone({ freq: 190, dur: 0.30, type: 'triangle', volume: 0.08,
            attack: 0.025, release: 0.23, sweep: 45 });
    }
    damage() {
        if (this.sfxLab?.master) {
            this.sfxLab.play('player_damage');
            return;
        }
        this.tone({ freq: 180, dur: 0.18, type: 'sawtooth', volume: 0.18, sweep: -80 });
    }
    death() {
        if (this.sfxLab?.master) {
            this.sfxLab.play('player_death');
            return;
        }
        this.tone({ freq: 220, dur: 0.4, type: 'sawtooth', volume: 0.25, sweep: -180 });
        setTimeout(
            () => this.tone({ freq: 110, dur: 0.6, type: 'sawtooth', volume: 0.2, sweep: -80 }),
            200
        );
    }
    bossSpawn() {
        if (this.sfxLab?.master) {
            this.sfxLab.play('boss_spawn');
            return;
        }
        this.tone({ noise: true, dur: 0.4, volume: 0.3, release: 0.25 });
        setTimeout(() => this.tone({ freq: 80, dur: 0.6, type: 'sawtooth', volume: 0.3 }), 100);
    }
    bossWarn() {
        if (this.sfxLab?.master) {
            this.sfxLab.play('boss_warning');
            return;
        }
        this.tone({ noise: true, noiseBand: 370, dur: 0.28,
            volume: 0.17, attack: 0.03, release: 0.3 });
        this.tone({ freq: 100, dur: 0.45, type: 'triangle', volume: 0.09,
            attack: 0.05, release: 0.3, sweep: -20 });
    }
    achievement() {
        if (this.sfxLab?.master) {
            this.sfxLab.play('achievement');
            return;
        }
        this.tone({ noise: true, noiseBand: 860, dur: 0.17,
            volume: 0.12, attack: 0.014, release: 0.16 });
        this.tone({ freq: 230, dur: 0.24, type: 'sine', volume: 0.06,
            attack: 0.025, release: 0.2, sweep: 42 });
    }

    // Licensed cinematic music: streamed as HTMLAudioElement, never decoded
    // wholesale into AudioBuffers (five-minute scores on mobile are large).
    // Each track has its own gain for a seamless, voice-free crossfade.
    _musicSlot(state) {
        if (this.musicSlots.has(state)) return this.musicSlots.get(state);
        const def = CINEMATIC_TRACKS[state];
        if (!def || !this.ctx) return null;
        const element = new Audio(new URL('../assets/audio/music/' + def.file, import.meta.url).href);
        element.loop = true;
        element.preload = 'metadata';
        element.addEventListener('error', () =>
            console.warn('[audio] Music unavailable:', state, element.error?.code));
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        const source = this.ctx.createMediaElementSource(element);
        source.connect(gain).connect(this.musicGain);
        const slot = { state, element, gain, level: def.level };
        this.musicSlots.set(state, slot);
        return slot;
    }

    _playMusicState(state, fadeSeconds = 2.6) {
        if (!this.musicOn || !this.ctx || this.settings.musicEnabled === false) return;
        const next = this._musicSlot(state);
        if (!next) return;
        const prev = this._activeMusic;
        const now = this.ctx.currentTime;
        if (prev === next) {
            next.gain.gain.cancelScheduledValues(now);
            next.gain.gain.setTargetAtTime(next.level, now, 0.15);
            if (next.element.paused) next.element.play().catch(err =>
                console.warn('[audio] Music playback blocked:', err));
            return;
        }

        next.gain.gain.cancelScheduledValues(now);
        next.gain.gain.setValueAtTime(0, now);
        next.gain.gain.linearRampToValueAtTime(next.level, now + fadeSeconds);
        this._activeMusic = next;
        // The first play follows the player's Start/Unmute gesture.
        next.element.play().catch(err =>
            console.warn('[audio] Cannot start music', state, err));

        if (prev) {
            prev.gain.gain.cancelScheduledValues(now);
            prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
            prev.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
            window.setTimeout(() => {
                if (this._activeMusic === prev) return;
                prev.element.pause();
                prev.gain.gain.value = 0;
            }, Math.ceil(fadeSeconds * 1000) + 100);
        }
    }

    setMusicState(state) {
        if (!CINEMATIC_TRACKS[state] || state === this.musicState) return;
        this.musicState = state;
        if (this.musicOn) this._playMusicState(state);
    }

    startMusic() {
        if (!this.enabled || !this.ctx || this.settings.musicEnabled === false) return;
        this.unlock();
        this.musicOn = true;
        this._playMusicState(this.musicState);
    }

    stopMusic() {
        this.musicOn = false;
        this._activeMusic = null;
        // Pause immediately on game pause/quit; keep playback positions so
        // resuming the same encounter does not restart the score.
        for (const slot of this.musicSlots.values()) {
            slot.element.pause();
            slot.gain.gain.cancelScheduledValues(this.ctx.currentTime);
            slot.gain.gain.value = 0;
        }
    }

    toggleMusic(on) {
        this.settings.musicEnabled = !!on;
        this.applyVolumes();
        if (on) this.startMusic();
        else this.stopMusic();
    }
}
