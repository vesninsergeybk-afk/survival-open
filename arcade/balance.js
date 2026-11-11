// Data-only balancing and deterministic world math for the arcade reboot.
// Keep rules separate from rendering so high-density simulation is testable.
// Starter combat has one source of truth for the ship, weapon and sight ranges.
// Upgrades still extend these values; later sector pressure is a separate curve.
export const STARTER_COMBAT = Object.freeze({
  hull: 90,
  speed: 248,
  plasmaDamage: 18,
  plasmaRange: 330,
  plasmaInterval: .64,
  patrolSight: 620,
  signalSight: 560,
  intentRange: 700
});
// An active shield absorbs most of a hit, but its field transmits a small
// shock to the hull. This keeps hull condition meaningful in shielded fights.
export const SHIELD_HULL_TRANSFER = .15;
export function splitPlayerDamage(damage,shield,hullTransfer=SHIELD_HULL_TRANSFER){
 const incoming=Math.max(0,Number.isFinite(damage)?damage:0);
 const charge=Math.max(0,Number.isFinite(shield)?shield:0);
 const transfer=Number.isFinite(hullTransfer)?Math.max(0,Math.min(1,hullTransfer)):SHIELD_HULL_TRANSFER;
 const absorbed=Math.min(charge,incoming*(1-transfer));
 return {absorbed,hullDamage:incoming-absorbed};
}
export const RULES = Object.freeze({
  cell: 640,
  rockCell: 460,
  maxEnemies: 180,
  maxAllies: 6,
  maxDrops: 280,
  maxParticles: 240,
  maxShots: 220,
  nearBeam: 115,
  beamRange: STARTER_COMBAT.plasmaRange,
  beamMinFactor: .40,
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
// Checkpoints predating the starter-hull rebalance have no balance version.
// The old base plus purchased hull ranks identifies them without changing a
// current save or revoking bought upgrades. Preserve the same damage ratio.
export function rebaseSavedHull(player,hullRanks=0){
 const ranks=Math.max(0,Math.trunc(hullRanks)||0);
 const previousMax=110+22*ranks;
 if(!player||player.maxHp!==previousMax)return false;
 const nextMax=STARTER_COMBAT.hull+22*ranks;
 player.hp=Math.max(0,Math.min(nextMax,
  Math.round(player.hp/previousMax*nextMax)));
 player.maxHp=nextMax;
 return true;
}
// Version 2 thresholds are needed when restoring older station checkpoints.
const PREVIOUS_XP_THRESHOLDS = Object.freeze([42, 68, 105, 155, 230, 330, 475]);
export const legacyExpForNext = level =>
  Math.round(75 * Math.pow(1.36, Math.max(0, level - 1)));
export const previousExpForNext = level =>
  PREVIOUS_XP_THRESHOLDS[level - 1] ?? legacyExpForNext(level);
// The new curve stays demanding over a long run without making each point
// exponentially harder to earn than the player's increasing combat power.
const EARLY_XP_THRESHOLDS = Object.freeze([42, 68, 105, 155, 205, 265, 345]);
export const expForNext = level =>
  EARLY_XP_THRESHOLDS[level - 1] ?? Math.round(430 * Math.pow(1.135, Math.max(0, level - 8)));
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

// Ordinary contact density stays below what a single starter plasma can
// dispatch. Larger authored assaults keep their separate, explicit budgets.
// The mature director climbs gradually rather than jumping at a time gate.
export function openingThreat(time, level = 1) {
 if(time<9)return {cap:0,interval:9,groupSize:0,types:[]};
 if(time<36)return {cap:7,interval:10,groupSize:3,types:['scout']};
 if(time<80)return {cap:10,interval:11,groupSize:4,types:['scout','fighter']};
 if(time<120)return {cap:11,interval:11.5,groupSize:4,types:['scout','fighter','flanker']};
 if(time<175)return {cap:14,interval:12,groupSize:5,types:['scout','fighter','flanker']};
 if(time<230)return {cap:17,interval:11,groupSize:6,
  types:time<190?['scout','fighter','flanker','berserker']:
   ['scout','fighter','flanker','berserker','healer']};
 const elapsed=time-230;
 return {
  cap:Math.min(70,17+Math.floor(elapsed/18)+
   Math.floor(Math.max(0,level-1)*.65*Math.min(1,elapsed/110))),
  interval:Math.max(3.3,10.5-elapsed/230-
   Math.max(0,level-1)*.025*Math.min(1,elapsed/110)),
  groupSize:Math.min(6+Math.floor(elapsed/150),8),
  types:['scout','fighter','flanker','berserker','healer','gunship']
 };
}
// Ambient patrols use a local contact budget throughout the flight. The
// independent ambient budget bounds distant traffic; the absolute cap still
// includes industrial, mission, and other ships. Never switch to a global-only
// local encounter budget while far-away enemies remain alive.
export function openingSpawnRoom(time,director,globalCount,localCount,ambientCount){
 const globalRoom=RULES.maxEnemies-globalCount;
 return Math.max(0,Math.min(director.cap-localCount,
  ambientPopulationBudget(time,director.cap)-ambientCount,globalRoom));
}
// Distant traffic has a separate budget. As the explored sector grows, keeping
// the *local* opening cap small must not starve the next nearby encounter.
export const ambientPopulationBudget=(time,cap)=>time<175?cap*2:
 Math.max(cap*2,Math.round(34+36*clamp((time-175)/55,0,1)));
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
