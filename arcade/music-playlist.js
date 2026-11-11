/**
 * Licensed music catalog and persistent rotation for «Выживший».
 * New CC music is fetched and verified into assets/audio/music/ before CI tests.
 * CC BY 4.0 and CC0 credits: assets/audio/music/CREDITS.md and game Credits panel.
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
  ambush: Object.freeze({title:"Ambush",file:"ambush.ogg",level:0.63,source:"https://www.scottbuckley.com.au/library/ambush/"}),
  adrift_among_infinite_stars: Object.freeze({title:"Adrift Among Infinite Stars",file:"adrift-among-infinite-stars.ogg",level:0.71,source:"https://scottbuckley.com.au/library/adrift-among-infinite-stars/"}),
  permafrost: Object.freeze({title:"Permafrost",file:"permafrost.ogg",level:0.71,source:"https://scottbuckley.com.au/library/permafrost/"}),
  penumbra: Object.freeze({title:"Penumbra",file:"penumbra.ogg",level:0.7,source:"https://scottbuckley.com.au/library/penumbra/"}),
  echoes: Object.freeze({title:"Echoes",file:"echoes.ogg",level:0.67,source:"https://scottbuckley.com.au/library/echoes/"}),
  memories_of_stone: Object.freeze({title:"Memories of Stone",file:"memories-of-stone.ogg",level:0.73,source:"https://scottbuckley.com.au/library/memories-of-stone/"}),
  unraveling: Object.freeze({title:"Unraveling",file:"unraveling.ogg",level:0.71,source:"https://scottbuckley.com.au/library/unraveling/"}),
  aurora: Object.freeze({title:"Aurora",file:"aurora.ogg",level:0.69,source:"https://scottbuckley.com.au/library/aurora/"}),
  singularity_calm: Object.freeze({title:"Singularity (calm)",file:"singularity-calm.ogg",level:0.64,source:"https://opengameart.org/content/singularity-0"}),
  singularity_action: Object.freeze({title:"Singularity (action)",file:"singularity-action.ogg",level:0.57,source:"https://opengameart.org/content/singularity-0"}),
  silver_bullet: Object.freeze({title:"Silver Bullet",file:"silver-bullet.ogg",level:0.48,source:"https://opengameart.org/content/silver-bullet"}),
  unholy_surge: Object.freeze({title:"Unholy Surge",file:"unholy-surge.ogg",level:0.46,source:"https://opengameart.org/content/unholy-surge"}),
  space_boss_battle: Object.freeze({title:"Space Boss Battle",file:"space-boss-battle.ogg",level:0.52,source:"https://opengameart.org/content/space-boss-battle"}),
  boss_battle_9_metal: Object.freeze({title:"Boss Battle #9 (Metal loop)",file:"boss-battle-9-metal-loop.ogg",level:0.49,source:"https://opengameart.org/content/boss-battle-9-metal"})
});

export const MUSIC_POOLS = Object.freeze({
  opening: Object.freeze(['starfire','aphelion','shadows_and_dust','adrift_among_infinite_stars']),
  exploration: Object.freeze(['starfire','aphelion','shadows_and_dust','decoherence','meanwhile',
    'adrift_among_infinite_stars','permafrost','penumbra','echoes','memories_of_stone','unraveling','aurora','singularity_calm']),
  tension: Object.freeze(['nightfall','convergence','decoherence','meanwhile','singularity_action','unraveling']),
  combat: Object.freeze(['pursuit','simulacra','red','ambush','starfire','singularity_action','silver_bullet','unholy_surge']),
  boss: Object.freeze(['eyes_in_the_void','ambush','convergence','red','space_boss_battle','boss_battle_9_metal','unholy_surge'])
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
