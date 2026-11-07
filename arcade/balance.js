// Data-only balancing and deterministic world math for the arcade reboot.
// Keep rules separate from rendering so high-density simulation is testable.
export const RULES = Object.freeze({
  cell: 640,
  rockCell: 460,
  maxEnemies: 180,
  maxAllies: 2,
  maxDrops: 280,
  maxParticles: 240,
  maxShots: 220,
  nearBeam: 115,
  beamRange: 300,
  beamMinFactor: .28,
  asteroidRange: 245,
  baseInteract: 165,
  enemyBaseUnlockLevel: 6,
  enemyBaseUnlockStations: 3,
  tacticalInterval: .42,
  squadCommitSeconds: 1.8
});
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const length = (x, y) => Math.hypot(x, y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const hash = (x, y, seed = 1) => {
  let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ (seed | 0)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const beamDamage = (base, distance, near = RULES.nearBeam,
  range = RULES.beamRange, minFactor = RULES.beamMinFactor) => {
  const fraction = clamp((distance - near) / Math.max(1, range - near), 0, 1);
  return base * (1 - (1 - minFactor) * fraction);
};
export const burstStats = rank => ({
  duration:.36+rank*.06,
  cooldown:5.8-rank*.65,
  multiplier:2.25
});
// Ease the opening decisions; from level 8 the existing curve is unchanged.
const EARLY_XP_THRESHOLDS = Object.freeze([42, 68, 105, 155, 230, 330, 475]);
export const legacyExpForNext = level =>
  Math.round(75 * Math.pow(1.36, Math.max(0, level - 1)));
export const expForNext = level =>
  EARLY_XP_THRESHOLDS[level - 1] ?? legacyExpForNext(level);
export const baseNames = Object.freeze({
  dock: 'Ремонтный док',
  arsenal: 'Военный арсенал',
  carrier: 'Авианосец',
  lab: 'Лаборатория'
});
export const baseColor = Object.freeze({
  dock: '#69e5e4', arsenal: '#f5bd75', carrier: '#929dff', lab: '#bc8afb'
});
export function spawnOutside(camera, side, position, inset = 145) {
  // Every group member is beyond the camera, including sprite size and jitter.
  const v = clamp(position, -.12, 1.12);
  if (side === 0) return {x: camera.x - inset, y: camera.y + v * camera.h};
  if (side === 1) return {x: camera.x + camera.w + inset, y: camera.y + v * camera.h};
  if (side === 2) return {x: camera.x + v * camera.w, y: camera.y - inset};
  return {x: camera.x + v * camera.w, y: camera.y + camera.h + inset};
}
export const outsideCamera = (x, y, camera, radius = 0) =>
  x + radius < camera.x || x - radius > camera.x + camera.w ||
  y + radius < camera.y || y - radius > camera.y + camera.h;

// Staged early pressure. Low caps protect performance and leave room to learn.
export function openingThreat(time, level = 1) {
 if(time<9)return {cap:0,interval:9,groupSize:0,types:[]};
 if(time<36)return {cap:4,interval:8,groupSize:2,types:['scout']};
 if(time<75)return {cap:7,interval:6.2,groupSize:2,types:['scout','fighter']};
 if(time<118)return {cap:11,interval:5.3,groupSize:2,types:['scout','fighter','flanker']};
 if(time<155)return {cap:16,interval:4.6,groupSize:3,types:['scout','fighter','flanker','berserker']};
 if(time<205)return {cap:21,interval:4,groupSize:3,types:['scout','fighter','flanker','berserker','healer']};
 const elapsed=time-205;
 return {
  // The late game becomes more dangerous through tougher ships and formations,
  // without an unbounded crowd that overwhelms lower-end GPUs.
  cap:Math.min(70,21+Math.floor(elapsed/22)+
   Math.floor(Math.max(0,level-1)*1.2*Math.min(1,elapsed/90))),
  interval:Math.max(1.6,4-elapsed/300-
   Math.max(0,level-1)*.025*Math.min(1,elapsed/90)),
  groupSize:Math.min(3+Math.floor(elapsed/220),5),
  types:['scout','fighter','flanker','berserker','healer','gunship']
 };
}
export class SpatialGrid {
  constructor(cell = 100) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  insert(entity) {
    const k = Math.floor(entity.x / this.cell) + ':' + Math.floor(entity.y / this.cell);
    let bucket = this.map.get(k);
    if (!bucket) this.map.set(k, bucket = []);
    bucket.push(entity);
  }
  query(x, y, radius) {
    const result = [];
    const c = this.cell;
    const x0 = Math.floor((x - radius) / c), x1 = Math.floor((x + radius) / c);
    const y0 = Math.floor((y - radius) / c), y1 = Math.floor((y + radius) / c);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      const bucket = this.map.get(i + ':' + j);
      if (bucket) for (const value of bucket) result.push(value);
    }
    return result;
  }
}
