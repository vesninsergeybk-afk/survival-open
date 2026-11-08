import { AudioLabEngine } from '../audio-lab/audio-mixer.js?v=foley-autofire-03-mission-av-1-mission-pack-1-mission-variety-1-mission-choices-1-recorded-combat-1-realfoley-2';
import { SOUND_CATALOG } from '../audio-lab/sound-map.js?v=foley-autofire-03-mission-av-1-mission-pack-1-mission-variety-1-mission-choices-1-recorded-combat-1-realfoley-2-manual-qa-1';
import { baseSoundPlan } from './base-audio-events.js?v=audio-91';
import { MUSIC_TRACKS, MUSIC_POOLS, MusicRotation } from '../arcade/music-playlist.js?v=cinematic-rotation-01';

/**
 * @module audio
 * @description Mixed licensed cinematic scores and game SFX.
 * Scores are streamed; all game effects are decoded CC0 audio recordings.
 *
 * Dependencies: browser Web Audio API. Degrades silently when unavailable.
 *
 * Exports:
 *   - class AudioEngine
 */



export class AudioEngine {
    constructor(settings) {
        this.settings = settings;
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.musicDuckGain = null;
        this.limiter = null;
        this.directVoices = new Set();
        this.activeRockImpacts = 0;
        this.musicSlots = new Map();
        this.musicRotation = new MusicRotation();
        this._firstMusic = true;
        this._resumeMusic = null;
        this._musicFailures = new Set();
        this._activeMusic = null;
        this.musicState = 'exploration';
        this.musicOn = false;
        this.musicScale = 1; // Scene mix factor, separate from the player's saved volume.
        this.extractionVoice = null;
        this.enabled = true;
        this.unlocked = false;
        this.sfxLab = null;
        this._samplesPromise = null;
        this._essentialPromise = null;
        this._cueReadyPromises = new Map();
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
            // Ducking is independent of saved volume and 650 ms scene-sync calls.
            this.musicDuckGain = this.ctx.createGain();
            this.musicDuckGain.gain.value = 1;
            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.musicDuckGain).connect(this.masterGain);
            // Safety ceiling for the final sum of streamed music, UI and effects.
            this.limiter = this.ctx.createDynamicsCompressor();
            this.limiter.threshold.value = -8;
            this.limiter.knee.value = 2;
            this.limiter.ratio.value = 12;
            this.limiter.attack.value = 0.003;
            this.limiter.release.value = 0.22;
            this.masterGain.connect(this.limiter).connect(this.ctx.destination);
            this.applyVolumes();
            // Sample-ready effects share the existing AudioContext and SFX gain.
            this.sfxLab = new AudioLabEngine({
                context: this.ctx,
                destination: this.sfxGain,
                musicDuckBus: this.musicDuckGain,
                musicLevelProvider: () => 1
            });
        } catch (err) {
            console.warn('[audio] disabled', err);
            this.enabled = false;
        }
    }

    /** Decode the first combat cues without resuming or playing audio.
     *  The actual sound still requires a user gesture and an unmuted mixer.
     */
    primeEssentials() {
        if (this._essentialPromise) return this._essentialPromise;
        if (typeof window === 'undefined' || !(window.AudioContext || window.webkitAudioContext))
            return Promise.resolve();
        this.init();
        if (!this.sfxLab) return Promise.resolve();
        const keys = ['ui_audio_on','starter_soft','comet_launch','comet_burst','mine_launch',
            'mine_arm','mine_burst','target_mark','dash_burst','swarm_arrival',
            'swarm_split','swarm_merge','swarm_warning'];
        const root = new URL('../audio-lab/', import.meta.url);
        const queue = keys.flatMap(key => {
            const def = SOUND_CATALOG[key];
            const main = def.sampleUrls?.length ? def.sampleUrls : def.sampleUrl ? [def.sampleUrl] : [];
            return [...main.map((url,index) => [key,url,false,index]),
                ...(def.sampleLayerUrls || []).map((url,index) => [key,url,true,index])];
        });
        let cursor = 0;
        const worker = async () => {
            while (cursor < queue.length) {
                const [key,url,layer,index] = queue[cursor++];
                try {
                    await this.sfxLab.loadSampleFromUrl(key,new URL(url,root).href,
                        {append:true,layer,index,prepareOnly:true});
                } catch (err) { console.warn('[audio] Essential recording unavailable:',key,err); }
            }
        };
        this._essentialPromise = Promise.all(Array.from({length:Math.min(4,queue.length)},worker));
        return this._essentialPromise;
    }

    /** Make one short feedback recording playable after the player's sound-on gesture.
     *  Reuses already downloaded samples; never creates a synthetic fallback.
     */
    readyForCue(key) {
        if (!this.enabled || this.settings.muted) return Promise.resolve(false);
        this.init();
        const lab = this.sfxLab, def = SOUND_CATALOG[key];
        if (!lab || !def) return Promise.resolve(false);
        const sample = def.sampleUrls?.[0] || def.sampleUrl;
        if (!sample) return Promise.resolve(false);
        if (!this._cueReadyPromises.has(key)) {
            const root = new URL('../audio-lab/', import.meta.url);
            const pending = (lab.bufferByKey.get(key)
                ? Promise.resolve(true)
                : lab.loadSampleFromUrl(key,new URL(sample,root).href,
                    {append:true,index:0,prepareOnly:true}).then(() => true))
                .catch(err => {
                    console.warn('[audio] Feedback recording unavailable:',key,err);
                    this._cueReadyPromises.delete(key);
                    return false;
                });
            this._cueReadyPromises.set(key,pending);
        }
        // Resume has already been requested during the user gesture in unlock().
        return Promise.all([this._cueReadyPromises.get(key),lab.unlock()])
            .then(([loaded]) => loaded && lab.ctx?.state === 'running')
            .catch(() => false);
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
                // Decode a few CC0 effects at a time; mobile startup must stay playable.
                const priority = ['starter_soft','comet_launch','comet_burst',
                    'mine_launch','mine_arm','mine_burst','target_mark','dash_burst',
                    'swarm_arrival','swarm_split','swarm_merge','swarm_warning',
                    'magic_wand','knife','explosion_small',
                    'explosion_big','hit','armor_hit','rock_chip','rock_break','pickup',
                    'ui_tab','ui_open','player_damage','boss_warning','extractor_loop',
                    'shield_hit','field_shield_up','field_shield_break',
                    'field_relay_repair','field_convoy_repair','field_beacon_ok',
                    'field_beacon_alarm','field_salvage','field_cassette',
                    'field_scan','field_scan_captured','field_scan_miss','field_reactor_charge','field_pulse','field_work','field_raid',
                    'mission_emp_charge','mission_emp_pulse','mission_probe_weld','mission_probe_ready',
                    'mission_relay_wave','mission_relay_prepare','mission_relay_impact','mission_relay_online',
                    'mission_carrier_contact','mission_carrier_boost'];
                const sounds = Object.entries(SOUND_CATALOG)
                    .sort(([a],[b]) => (priority.indexOf(a) < 0 ? 999 : priority.indexOf(a)) -
                        (priority.indexOf(b) < 0 ? 999 : priority.indexOf(b)));
                const queue = sounds.flatMap(([key,def]) => {
                    const main = def.sampleUrls?.length ? def.sampleUrls : def.sampleUrl ? [def.sampleUrl] : [];
                    const layers = def.sampleLayerUrls || [];
                    return [...main.map((url,index) => [key,url,false,index]),
                        ...layers.map((url,index) => [key,url,true,index])];
                });
                let cursor = 0;
                const worker = async () => {
                    while (cursor < queue.length) {
                        const [key, url, layer, index] = queue[cursor++];
                        try { await this.sfxLab.loadSampleFromUrl(key, new URL(url, root).href, {append:true,layer,index}); }
                        catch (err) { console.warn('[audio] CC0 recording unavailable:', key, err); }
                    }
                };
                this._samplesPromise = Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
            }).catch(err => console.warn('[audio] sample bank unavailable', err));
        }
    }

    applyVolumes() {
        if (!this.ctx) return;
        const s = this.settings;
        // Global `muted` state zeroes master gain without overwriting volume,
        // so unmuting restores the player's chosen level. M now opens the map.
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

    // Kept as a no-op for older callers. Runtime generated tones are disabled.
    tone() { return false; }

    /** Loop a decoded engine recording while the extraction tool is engaged. */
    setExtractionActive(active) {
        if (!active) {
            const voice = this.extractionVoice;
            if (!voice || !this.ctx) return;
            this.extractionVoice = null;
            const now = this.ctx.currentTime;
            voice.output.gain.cancelScheduledValues(now);
            voice.output.gain.setValueAtTime(Math.max(0.0001, voice.output.gain.value), now);
            voice.output.gain.linearRampToValueAtTime(0.0001, now + 0.14);
            try { voice.source.stop(now + 0.15); } catch {}
            return;
        }
        if (this.extractionVoice || !this.ctx || !this.unlocked ||
            this.settings.muted || !this.sfxLab?.master) return;
        const samples = this.sfxLab.bufferByKey.get('extractor_loop');
        const buffer = Array.isArray(samples) ? samples[0] : samples;
        if (!buffer) return; // An audio file has not arrived yet; never synthesize a motor.
        const ctx = this.ctx, now = ctx.currentTime;
        const output = ctx.createGain();
        output.gain.setValueAtTime(0.0001, now);
        output.gain.linearRampToValueAtTime(0.16, now + 0.12);
        output.connect(this.sfxGain);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(output);
        source.start(now);
        this.extractionVoice = {output,source};
    }

    rockImpact({heavy=false,intensity=1,pan=0}={}) {
        return this.playEvent(heavy ? 'rock_break' : 'rock_chip', {intensity,pan});
    }

    /** All effects route to decoded sound recordings; never fall back to beeps. */
    playEvent(key, options={}) {
        if (!this.enabled || this.settings.muted) return false;
        return this.sfxLab?.master ? this.sfxLab.play(key, options) : false;
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

    // High-level effects ---------------------------------------------------
    hit(material='normal') {
        return this.playEvent(material==='armor'?'armor_hit':material==='shield'?'shield_hit':'hit');
    }
    shoot(weaponId='starter_pulse',options={}) { return this.playEvent(weaponId,options); }
    explosion(size='big') { return this.playEvent(size==='small'?'explosion_small':'explosion_big'); }
    pickup() { return this.playEvent('pickup'); }
    levelUp() { return this.playEvent('level_up'); }
    damage() { return this.playEvent('player_damage'); }
    death() { return this.playEvent('player_death'); }
    bossSpawn() { return this.playEvent('boss_spawn'); }
    bossWarn() { return this.playEvent('boss_warning'); }
    achievement() { return this.playEvent('achievement'); }

    // Stream one licensed cue at a time. Rotate tracks only on complete cues
    // or meaningful changes in threat, and crossfade before the cue ends.
    _musicSlot(id) {
        if (this.musicSlots.has(id)) return this.musicSlots.get(id);
        const def = MUSIC_TRACKS[id];
        if (!def || !this.ctx) return null;
        const element = new Audio(new URL('../assets/audio/music/' + def.file, import.meta.url).href);
        element.loop = false;
        element.preload = 'metadata';
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        const source = this.ctx.createMediaElementSource(element);
        source.connect(gain).connect(this.musicGain);
        const slot = { id, element, gain, level: def.level, category: null };
        this.musicSlots.set(id, slot);
        element.addEventListener('timeupdate', () => {
            if (!this.musicOn || this._activeMusic !== slot || element.paused) return;
            if (Number.isFinite(element.duration) && element.duration > 16 &&
                element.duration - element.currentTime <= 7) {
                this._playMusicState(this.musicState, 4.2, true);
            }
        });
        element.addEventListener('ended', () => {
            if (this.musicOn && this._activeMusic === slot)
                this._playMusicState(this.musicState, 1.2, true);
        });
        element.addEventListener('error', () => {
            this._musicFailures.add(id);
            console.warn('[audio] Music asset unavailable:', id, element.error?.code);
            if (this.musicOn && this._activeMusic === slot)
                this._playMusicState(this.musicState, 1, true);
        });
        return slot;
    }

    _chooseMusic(state, avoid) {
        const pool = MUSIC_POOLS[state];
        if (!pool?.length) return null;
        // The first music after entering a fresh run comes from a curated
        // opening pool, shuffled across sessions via localStorage.
        const group = this._firstMusic && state === 'exploration' ? 'opening' : state;
        for (let attempt = 0; attempt < MUSIC_POOLS[group].length; attempt++) {
            const id = this.musicRotation.next(group, avoid);
            if (!this._musicFailures.has(id)) return id;
            avoid = id;
        }
        return null;
    }

    _playMusicState(state, fadeSeconds = 3.8, forceNext = false) {
        if (!this.musicOn || !this.ctx || this.settings.musicEnabled === false) return;
        const prev = this._activeMusic;
        if (!forceNext && prev?.category === state) {
            if (prev.element.paused) prev.element.play().catch(err =>
                console.warn('[audio] Music playback blocked:', err));
            return;
        }
        const resumed = !forceNext && this._resumeMusic?.category === state ?
            this._resumeMusic : null;
        const id = resumed?.id || this._chooseMusic(state, prev?.id);
        if (!id) return;
        const next = this._musicSlot(id);
        if (!next) return;
        this._firstMusic = false;
        this._resumeMusic = null;
        next.category = state;
        if (prev === next) return;
        const now = this.ctx.currentTime;
        if (!resumed) {
            try { next.element.currentTime = 0; } catch { /* Metadata still loading */ }
        }
        // A third fast threat transition must not leave three scores playing.
        for (const stale of this.musicSlots.values()) {
            if (stale === prev || stale === next || stale.element.paused) continue;
            stale.element.pause();
            stale.gain.gain.cancelScheduledValues(now);
            stale.gain.gain.value = 0;
        }
        next.gain.gain.cancelScheduledValues(now);
        next.gain.gain.setValueAtTime(0, now);
        next.gain.gain.linearRampToValueAtTime(next.level, now + fadeSeconds);
        this._activeMusic = next;
        next.element.play().catch(err =>
            console.warn('[audio] Cannot start music:', id, err));
        if (prev) {
            prev.gain.gain.cancelScheduledValues(now);
            prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
            prev.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
            window.setTimeout(() => {
                if (this._activeMusic === prev) return;
                prev.element.pause();
                prev.gain.gain.value = 0;
            }, Math.ceil(fadeSeconds * 1000) + 150);
        }
    }

    setMusicState(state) {
        if (!MUSIC_POOLS[state] || state === this.musicState) return;
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
        if (this._activeMusic) this._resumeMusic = this._activeMusic;
        this.musicOn = false;
        this._activeMusic = null;
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
