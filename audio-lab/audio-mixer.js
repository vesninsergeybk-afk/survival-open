import { SOUND_CATALOG, BUS_PRESET } from './sound-map.js?v=audio-fidelity-01';

/**
 * Isolated sound-lab engine. Shared by the audio laboratory and the live production game. Native Web Audio; no dependencies and no network calls
 * except explicit loadSampleFromUrl() requests.
 *
 * The procedural voices are audition placeholders, not licensed studio SFX.
 * A verified sample overrides the placeholder, retaining routing and limits.
 */
export class AudioLabEngine {
  constructor(options = {}) {
    this.ctx = options.context || null;
    this.destination = options.destination || null;
    this.musicDuckBus = options.musicDuckBus || null;
    this.musicLevelProvider = options.musicLevelProvider || null;
    this.master = null;
    this.buses = {};
    this.busesLevel = { ...BUS_PRESET };
    this.bufferByKey = new Map();
    this.active = new Set();
    this.lastPlayMs = new Map();
    this.currentMusic = null;
    this.globalVoiceLimit = 12;
    this.busLimits = { weapons: 5, impacts: 3, ui: 3, structures: 2, ambience: 1 };
    this.random = Math.random;
  }

  async unlock() {
    if (!this.master) {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('Браузер не поддерживает Web Audio');
        this.ctx = new AC();
      }
      this.master = this.ctx.createGain();
      const compressor = this.ctx.createDynamicsCompressor();
      // Gentle glue compression, not a transient-flattening limiter.
      compressor.threshold.value = -22;
      compressor.knee.value = 15;
      compressor.ratio.value = 2.6;
      compressor.attack.value = 0.007;
      compressor.release.value = 0.32;
      this.master.connect(compressor).connect(this.destination || this.ctx.destination);
      for (const name of ['weapons', 'impacts', 'ui', 'structures', 'ambience', 'music']) {
        const gain = this.ctx.createGain();
        gain.gain.value = this.busesLevel[name];
        // 6–7 kHz soft low-pass removes brittle hiss from procedural
        // weapons while preserving the low-frequency punch of impacts.
        if (name === 'weapons' || name === 'impacts') {
          const warmth = this.ctx.createBiquadFilter();
          warmth.type = 'lowpass';
          warmth.frequency.value = name === 'weapons' ? 5700 : 6800;
          warmth.Q.value = 0.45;
          gain.connect(warmth).connect(this.master);
        } else gain.connect(this.master);
        this.buses[name] = gain;
      }
      this.master.gain.value = this.busesLevel.master;
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this;
  }

  setVolume(name, value) {
    const level = Math.min(1, Math.max(0, Number(value) || 0));
    if (!(name in this.busesLevel)) return;
    this.busesLevel[name] = level;
    if (!this.ctx) return;
    const node = name === 'master' ? this.master : this.buses[name];
    node.gain.setTargetAtTime(level, this.ctx.currentTime, 0.025);
  }

  getBus(def) {
    if (def.family === 'impact') return 'impacts';
    if (def.family === 'ui') return 'ui';
    if (def.family === 'structure') return 'structures';
    if (def.family === 'ambient') return 'ambience';
    return 'weapons';
  }

  /**
   * One call per attack/salvo, never one call per visual projectile or damage tick.
   * Returns false when the event was suppressed to protect the mix.
   */
  play(key, { intensity = 1, pan = 0, force = false } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const def = SOUND_CATALOG[key];
    if (!def) return false;
    const now = this.ctx.currentTime;
    const ms = now * 1000;
    const last = this.lastPlayMs.get(key);
    if (!force && last !== undefined && ms - last < def.minIntervalMs) return false;

    const bus = this.getBus(def);
    const candidates = [...this.active].filter(v => v.bus === bus);
    const canAdd = candidates.length < this.busLimits[bus] && this.active.size < this.globalVoiceLimit;
    if (!canAdd) {
      const pool = candidates.length >= this.busLimits[bus] ? candidates : [...this.active];
      const weakest = pool.sort((a, b) => a.priority - b.priority || a.born - b.born)[0];
      if (!weakest || weakest.priority > def.priority) return false;
      this.stopVoice(weakest, 0.025);
    }

    this.lastPlayMs.set(key, ms);
    const output = this.ctx.createGain();
    const level = Math.min(1, def.gain * Math.max(0.1, Math.min(1.4, intensity)));
    // Prevent the click-like onset that made the earlier SFX brittle.
    output.gain.setValueAtTime(0.0001, now);
    output.gain.linearRampToValueAtTime(level, now + (bus === 'impacts' ? 0.008 : 0.012));
    const stereo = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (stereo) {
      stereo.pan.value = Math.max(-0.85, Math.min(0.85, pan));
      output.connect(stereo).connect(this.buses[bus]);
    } else {
      output.connect(this.buses[bus]);
    }

    const voice = { key, bus, priority: def.priority, fixedPitch: !!def.fixedPitch,
      born: now, output, sources: [], disposed: false };
    this.active.add(voice);

    const buffer = this.bufferByKey.get(key);
    const duration = buffer ? this.playBuffer(voice, buffer, now) : this.synthesize(voice, def.profile, now);
    if (bus === 'impacts' && def.priority >= 4) this.duckMusic(0.52, 0.38);
    if (key === 'boss_warning' || key === 'player_damage' || key === 'player_death') this.duckMusic(0.6, 0.55);
    if (key === 'base_resonance_link' || key === 'base_raid_warning' ||
        key === 'base_raid_success' || key === 'base_destroyed') this.duckMusic(0.56, 0.6);
    window.setTimeout(() => this.disposeVoice(voice), Math.ceil(duration * 1000) + 160);
    return true;
  }

  playBuffer(voice, buffer, when) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    // Preserve the body of studio recordings; only subtly vary repeat shots.
    source.playbackRate.value = voice.fixedPitch ? 1 : 0.97 + this.random() * 0.06;
    source.connect(voice.output);
    source.start(when);
    voice.sources.push(source);
    return buffer.duration / source.playbackRate.value;
  }

  synthesize(voice, profile, t) {
    const o = (type, from, to, length, volume, offset = 0, cutoff = 12000) =>
      this.osc(voice, { type, from, to, length, volume, at: t + offset, cutoff });
    const n = (filter, frequency, length, volume, offset = 0, q = 0.7) =>
      this.noise(voice, { filter, frequency, length, volume, at: t + offset, q });

    switch (profile) {
      case 'pulse':
        o('triangle', 760, 285, 0.105, 0.80); o('sine', 195, 108, 0.14, 0.32);
        n('bandpass', 1250, 0.045, 0.17); return 0.18;
      case 'softpulse': {
        // The basic gun fires throughout most of a run. Keep the audible
        // presence in the low/mid band without a whip crack or bright chirp.
        const variants = [
          { pitch: 146, body: 720 },
          { pitch: 155, body: 810 },
          { pitch: 140, body: 650 }
        ];
        const shape = variants[Math.floor(this.random() * variants.length)];
        const detune = 0.97 + this.random() * 0.06;
        n('lowpass', shape.body, 0.13, 0.19, 0.007);
        o('sine', shape.pitch * detune, shape.pitch * 0.79 * detune,
          0.16, 0.33, 0, 850);
        o('triangle', shape.pitch * 1.45 * detune,
          shape.pitch * 0.98 * detune, 0.105, 0.12, 0.015, 950);
        return 0.19;
      }
      case 'arc':
        n('bandpass', 1500, 0.23, 0.72, 0, 0.95);
        o('sawtooth', 500, 110, 0.20, 0.34); return 0.3;
      case 'ion':
        o('sawtooth', 1400, 175, 0.19, 0.50, 0, 2000);
        o('sine', 310, 105, 0.24, 0.37); n('bandpass', 3200, 0.09, 0.34); return 0.3;
      case 'rocket':
        n('lowpass', 1100, 0.35, 0.73);
        o('sawtooth', 135, 65, 0.31, 0.30, 0, 600); return 0.41;
      case 'orbit':
        n('bandpass', 3300, 0.075, 0.47);
        o('triangle', 520, 280, 0.11, 0.26); return 0.15;
      case 'lightning':
        n('bandpass', 1350, 0.28, 0.64);
        o('sawtooth', 1050, 110, 0.14, 0.44, 0, 3400);
        n('bandpass', 2600, 0.10, 0.35, 0.13); return 0.34;
      case 'mine':
        n('bandpass', 1250, 0.070, 0.50);
        o('sine', 270, 95, 0.16, 0.34); return 0.20;
      case 'shield':
        o('sine', 175, 120, 0.48, 0.48);
        o('triangle', 610, 430, 0.34, 0.23); return 0.54;
      case 'cryo':
        n('bandpass', 1500, 0.32, 0.62);
        o('sine', 205, 69, 0.32, 0.40); return 0.4;
      case 'repair':
        o('sine', 360, 510, 0.36, 0.40);
        o('triangle', 720, 920, 0.31, 0.13); return 0.43;
      case 'torpedo':
        o('sawtooth', 340, 92, 0.29, 0.45, 0, 2600);
        n('bandpass', 1700, 0.25, 0.40); return 0.36;
      case 'rail':
        n('bandpass', 680, 0.15, 0.72);
        o('triangle', 280, 64, 0.36, 0.83);
        o('sawtooth', 540, 100, 0.16, 0.30, 0, 1600);
        return 0.44;
      case 'drone':
        o('triangle', 680, 430, 0.12, 0.23, 0, 1900);
        n('highpass', 2900, 0.055, 0.39); return 0.17;
      case 'quantum':
        o('triangle', 1000, 220, 0.17, 0.48, 0, 2800);
        o('triangle', 245, 110, 0.22, 0.51);
        n('highpass', 3000, 0.045, 0.24); return 0.26;
      case 'hit':
        n('bandpass', 1150, 0.075, 0.52);
        o('triangle', 220, 110, 0.095, 0.36); return 0.12;
      case 'armor':
        n('bandpass', 600, 0.15, 0.68);
        o('triangle', 440, 160, 0.2, 0.30); return 0.23;
      case 'shield_hit':
        o('sine', 880, 230, 0.2, 0.60);
        n('highpass', 1800, 0.1, 0.3); return 0.25;
      case 'explosion_small':
        n('lowpass', 1650, 0.32, 0.86);
        o('triangle', 210, 55, 0.31, 0.65); return 0.4;
      case 'explosion_big':
        n('lowpass', 960, 0.55, 1.0);
        n('bandpass', 2350, 0.22, 0.55);
        o('sine', 180, 43, 0.50, 0.87);
        o('triangle', 245, 89, 0.28, 0.40); return 0.65;
      case 'base_start':
        n('lowpass', 560, 1.9, 0.46);
        o('sawtooth', 94, 135, 2.3, 0.28, 0, 650);
        o('sine', 240, 610, 0.54, 0.22, 2.15); return 2.85;
      case 'base_build':
        n('bandpass', 720, 0.65, 0.66);
        o('triangle', 170, 90, 0.7, 0.36); return 0.8;
      case 'base_signal':
        o('sine', 460, 615, 0.55, 0.4);
        o('sine', 690, 950, 0.55, 0.35, .35); return 1;
      case 'base_warning':
        for (let i=0; i<2; i++) o('triangle', 560, 320, 0.3, 0.5, i*.47); return 1.04;
      case 'base_down':
        n('lowpass', 630, 1.4, 0.77);
        o('sawtooth', 200, 49, 1.5, 0.53, 0, 610); return 1.7;
      case 'warning':
        for (let i = 0; i < 3; i++) o('triangle', 520 - i * 110, 455 - i * 110, 0.16, 0.34, i * 0.19, 1600);
        return 0.75;
      case 'pickup':
        o('sine', 850, 1460, 0.14, 0.55); return 0.19;
      case 'levelup':
        for (let i = 0; i < 3; i++) o('triangle', 523 * Math.pow(2, i / 4), 523 * Math.pow(2, i / 4), 0.18, 0.48, i * 0.11);
        return 0.5;
      case 'damage':
        n('lowpass', 850, 0.21, 0.68);
        o('sawtooth', 195, 72, 0.26, 0.50, 0, 1300); return 0.33;
      case 'engine':
        o('sawtooth', 140, 93, 0.56, 0.27, 0, 450);
        o('sine', 120, 85, 0.57, 0.29); return 0.65;
      default:
        o('triangle', 520, 220, 0.12, 0.38); return 0.2;
    }
  }

  osc(voice, { type, from, to, length, volume, at, cutoff }) {
    const oscillator = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(30, from), at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + length);
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(volume, at + Math.min(0.012, length * 0.22));
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    oscillator.connect(filter).connect(env).connect(voice.output);
    oscillator.start(at);
    oscillator.stop(at + length + 0.015);
    voice.sources.push(oscillator);
  }

  noise(voice, { filter, frequency, length, volume, at, q }) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    source.loop = length > source.buffer.duration;
    const band = this.ctx.createBiquadFilter();
    band.type = filter;
    band.frequency.value = frequency;
    band.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(volume, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(band).connect(env).connect(voice.output);
    source.start(at);
    source.stop(at + length + 0.01);
    voice.sources.push(source);
  }

  getNoiseBuffer() {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.ceil(this.ctx.sampleRate * 0.8);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = this.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  duckMusic(seconds, factor) {
    const bus = this.musicDuckBus || this.buses.music;
    if (!bus) return;
    const t = this.ctx.currentTime;
    const base = this.musicLevelProvider ? this.musicLevelProvider() : this.busesLevel.music;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(base * factor, t + 0.035);
    bus.gain.setValueAtTime(base * factor, t + 0.1);
    bus.gain.linearRampToValueAtTime(base, t + seconds);
  }

  stopVoice(voice, fadeSeconds = 0.02) {
    if (voice.disposed) return;
    const t = this.ctx.currentTime;
    voice.output.gain.cancelScheduledValues(t);
    voice.output.gain.setValueAtTime(voice.output.gain.value, t);
    voice.output.gain.linearRampToValueAtTime(0.0001, t + fadeSeconds);
    this.active.delete(voice);
    window.setTimeout(() => this.disposeVoice(voice), Math.round(fadeSeconds * 1000) + 20);
  }

  disposeVoice(voice) {
    if (voice.disposed) return;
    voice.disposed = true;
    this.active.delete(voice);
    for (const source of voice.sources) {
      try { source.stop(); } catch (_) { /* completed already */ }
      try { source.disconnect(); } catch (_) { /* completed already */ }
    }
    voice.output.disconnect();
  }

  async decodeFile(key, file) {
    await this.unlock();
    const array = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(array);
    this.bufferByKey.set(key, buffer);
    return { key, seconds: buffer.duration, channels: buffer.numberOfChannels };
  }

  async loadSampleFromUrl(key, url) {
    await this.unlock();
    if (!(key in SOUND_CATALOG)) throw new Error('Неизвестное звуковое событие: ' + key);
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
    const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
    this.bufferByKey.set(key, buffer);
    return { key, seconds: buffer.duration, channels: buffer.numberOfChannels };
  }

  async playMusicFile(state, file) {
    await this.decodeFile('music:' + state, file);
    return this.setMusicState(state);
  }

  setMusicState(state, fadeSeconds = 1.4) {
    if (!this.ctx) return false;
    const buffer = this.bufferByKey.get('music:' + state);
    if (!buffer) return false;
    const now = this.ctx.currentTime;
    if (this.currentMusic?.state === state) return true;
    if (this.currentMusic) this.fadeMusic(0, fadeSeconds);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.68, now + fadeSeconds);
    source.connect(gain).connect(this.buses.music);
    source.start(now);
    this.currentMusic = { source, gain, state };
    return true;
  }

  fadeMusic(target = 0, seconds = 1.1) {
    if (!this.currentMusic) return;
    const previous = this.currentMusic;
    const t = this.ctx.currentTime;
    previous.gain.gain.cancelScheduledValues(t);
    previous.gain.gain.setValueAtTime(previous.gain.gain.value, t);
    previous.gain.gain.linearRampToValueAtTime(target, t + seconds);
    if (target === 0) {
      this.currentMusic = null;
      window.setTimeout(() => {
        try { previous.source.stop(); } catch (_) { /* already stopped */ }
        previous.source.disconnect();
        previous.gain.disconnect();
      }, Math.ceil(seconds * 1000) + 80);
    }
  }

  stopAll() {
    for (const voice of [...this.active]) this.stopVoice(voice);
    this.fadeMusic(0, 0.25);
  }
}
