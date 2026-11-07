import { SOUND_CATALOG, BUS_PRESET } from './sound-map.js?v=foley-autofire-03-mission-av-1';

/**
 * Isolated sound-lab engine. Shared by the audio laboratory and the live production game. Native Web Audio; no dependencies and no network calls
 * except explicit loadSampleFromUrl() requests.
 *
 * All production voices are decoded sound files, with no oscillator/noise fallback.
 * Missing files stay silent and are surfaced as loading errors in the lab.
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
    this.layerBuffersByKey = new Map();
    this.sampleFetches = new Map();
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
    // No sound is synthesized while samples load or if an asset fails.
    const available = this.bufferByKey.get(key);
    if (!available) return false;
    // Parallel downloads can finish out of order. Keep source variant indices stable.
    const sampleChoices = Array.isArray(available) ?
      available.map((buffer, index) => ({buffer, index})).filter(item => !!item.buffer) :
      [{buffer: available, index: 0}];
    if (!sampleChoices.length) return false;
    const chosen = sampleChoices[Math.floor(this.random() * sampleChoices.length)];
    const variant = chosen.index, buffer = chosen.buffer;
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
      born: now, level, output, sources: [], layerGains: [], disposed: false };
    this.active.add(voice);

    const played = [this.playBuffer(voice, buffer, now, def.maxDuration)];
    const layers = this.layerBuffersByKey.get(key);
    if (layers?.[variant]) {
      // Match each real impact with its own soft foley layer when both are ready.
      played.push(this.playBuffer(voice, layers[variant], now, def.maxDuration, def.layerGain || .3));
    }
    const duration = Math.max(...played.map(item => item.duration));
    if (played.some(item => item.trimmed) && duration >= 0.07) {
      const fadeStart = Math.max(now + 0.02, now + duration - 0.045);
      output.gain.setValueAtTime(level, fadeStart);
      output.gain.linearRampToValueAtTime(0.0001, now + duration);
    }
    if (bus === 'impacts' && def.priority >= 4) this.duckMusic(0.52, 0.38);
    if (key === 'boss_warning' || key === 'player_damage' || key === 'player_death') this.duckMusic(0.6, 0.55);
    if (key === 'base_resonance_link' || key === 'base_raid_warning' ||
        key === 'base_raid_success' || key === 'base_destroyed') this.duckMusic(0.56, 0.6);
    window.setTimeout(() => this.disposeVoice(voice), Math.ceil(duration * 1000) + 160);
    return true;
  }

  playBuffer(voice, buffer, when, maxDuration = null, layerGain = 1) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    // Recorded variants first; small pitch differences prevent harsh repetition.
    source.playbackRate.value = voice.fixedPitch ? 1 : 0.97 + this.random() * 0.06;
    const actual = buffer.duration / source.playbackRate.value;
    const duration = Math.max(0.045, maxDuration ? Math.min(actual, maxDuration) : actual);
    const layer = this.ctx.createGain();
    layer.gain.value = layerGain;
    source.connect(layer).connect(voice.output);
    voice.layerGains.push(layer);
    if (maxDuration && actual > maxDuration) source.start(when, 0, duration * source.playbackRate.value);
    else source.start(when);
    voice.sources.push(source);
    return {duration, trimmed: !!maxDuration && actual > maxDuration};
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
    for (const gain of voice.layerGains) gain.disconnect();
    voice.output.disconnect();
  }

  async decodeFile(key, file) {
    await this.unlock();
    const array = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(array);
    this.bufferByKey.set(key, buffer);
    return { key, seconds: buffer.duration, channels: buffer.numberOfChannels };
  }

  async loadSampleFromUrl(key, url, {append = false, layer = false, index = null} = {}) {
    await this.unlock();
    if (!(key in SOUND_CATALOG)) throw new Error('Неизвестное звуковое событие: ' + key);
    if (!this.sampleFetches.has(url)) {
      const pending = (async () => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
        return this.ctx.decodeAudioData(await response.arrayBuffer());
      })();
      this.sampleFetches.set(url, pending);
      pending.catch(() => { if (this.sampleFetches.get(url) === pending) this.sampleFetches.delete(url); });
    }
    const buffer = await this.sampleFetches.get(url);
    const destination = layer ? this.layerBuffersByKey : this.bufferByKey;
    if (append) {
      const previous = destination.get(key);
      const variants = previous ? [...(Array.isArray(previous) ? previous : [previous])] : [];
      if (Number.isInteger(index) && index >= 0) variants[index] = buffer;
      else variants.push(buffer);
      destination.set(key, variants);
    } else destination.set(key, buffer);
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
