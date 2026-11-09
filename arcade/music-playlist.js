/**
 * Licensed music catalog and persistent rotation for «Выживший».
 * Only compositions present in assets/audio/music/ are playable.
 * CC BY 4.0 attribution: assets/audio/music/CREDITS.md and game Credits panel.
 */
export const MUSIC_TRACKS = Object.freeze({
  starfire: Object.freeze({title:"Starfire",file:"starfire.ogg",level:0.75,source:"https://www.scottbuckley.com.au/library/starfire/"}),
  pursuit: Object.freeze({title:"Pursuit",file:"pursuit.ogg",level:0.58,source:"https://www.scottbuckley.com.au/library/pursuit/"}),
  eyes_in_the_void: Object.freeze({title:"Eyes in the Void",file:"eyes-in-the-void.ogg",level:0.65,source:"https://www.scottbuckley.com.au/library/eyes-in-the-void/"}),
  aphelion: Object.freeze({title:"Aphelion",file:"aphelion.ogg",level:0.77,source:"https://www.scottbuckley.com.au/library/aphelion/"}),
  decoherence: Object.freeze({title:"Decoherence",file:"decoherence.ogg",level:0.71,source:"https://www.scottbuckley.com.au/library/decoherence/"}),
  shadows_and_dust: Object.freeze({title:"Shadows and Dust",file:"shadows-and-dust.ogg",level:0.74,source:"https://www.scottbuckley.com.au/library/shadows-and-dust/"}),
  meanwhile: Object.freeze({title:"Meanwhile",file:"meanwhile.ogg",level:0.72,source:"https://www.scottbuckley.com.au/library/meanwhile/"}),
  nightfall: Object.freeze({title:"Nightfall",file:"nightfall.ogg",level:0.63,source:"https://www.scottbuckley.com.au/library/nightfall/"}),
  convergence: Object.freeze({title:"Convergence",file:"convergence.ogg",level:0.7,source:"https://www.scottbuckley.com.au/library/convergence/"}),
  simulacra: Object.freeze({title:"Simulacra",file:"simulacra.ogg",level:0.59,source:"https://www.scottbuckley.com.au/library/simulacra/"}),
  red: Object.freeze({title:"Red",file:"red.ogg",level:0.55,source:"https://www.scottbuckley.com.au/library/red/"}),
  ambush: Object.freeze({title:"Ambush",file:"ambush.ogg",level:0.63,source:"https://www.scottbuckley.com.au/library/ambush/"})
});

export const MUSIC_POOLS = Object.freeze({
  opening: Object.freeze(['starfire','aphelion','shadows_and_dust']),
  exploration: Object.freeze(['starfire','aphelion','shadows_and_dust','decoherence','meanwhile']),
  tension: Object.freeze(['nightfall','convergence','decoherence','meanwhile']),
  combat: Object.freeze(['pursuit','simulacra','red','ambush','starfire']),
  boss: Object.freeze(['eyes_in_the_void','ambush','convergence','red'])
});

const STORAGE_KEY = 'survivor_arcade_music_rotation_v1';

/** A shuffle bag that survives reloads; a track is not replayed until the pool is exhausted. */
export class MusicRotation {
  constructor({storage = null, random = Math.random} = {}) {
    this.random = random;
    try { this.storage = storage ?? globalThis.localStorage ?? null; }
    catch { this.storage = null; }
    try {
      const saved = JSON.parse(this.storage?.getItem(STORAGE_KEY) || '{}');
      this.histories = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { this.histories = {}; }
    this.lastGlobal = null;
  }
  next(category, avoid = null) {
    const pool = MUSIC_POOLS[category];
    if (!pool?.length) return null;
    const history = Array.isArray(this.histories[category]) ? this.histories[category] : [];
    const recent = history.slice(-(pool.length - 1));
    let choices = pool.filter(id => !recent.includes(id) && id !== avoid && id !== this.lastGlobal);
    if (!choices.length) choices = pool.filter(id => !recent.includes(id) && id !== avoid);
    if (!choices.length) choices = pool.filter(id => id !== avoid && id !== this.lastGlobal);
    if (!choices.length) choices = pool.filter(id => id !== avoid);
    const index = Math.min(choices.length - 1, Math.max(0, Math.floor(this.random() * choices.length)));
    const picked = choices[index] || pool[0];
    this.histories[category] = [...history, picked].slice(-30);
    this.lastGlobal = picked;
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.histories)); } catch { /* Private browsing */ }
    return picked;
  }
}
