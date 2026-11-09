// Reproducible, data-only encounter profile for a single plasma emitter.
// This is NOT an observed fight: movement, cover, misses, shields, firing
// angles, escorts, temporary bonuses, and simultaneous enemies are excluded.
import {pathToFileURL} from 'node:url';
import {beamDamage,STARTER_COMBAT} from '../balance.js';
import {ENEMY_TYPES,IRIS_COMBAT} from '../ai.js';
import {ENEMY_GUNNERY,gunProfile} from '../enemy-gunnery.js';
import {moduleStats} from '../ship-loadout.js';

// Rank allocations total no more than one skill point per level gained.
// They are illustrative builds, not promises about the typical player's gear.
export const BENCHMARK_BUILDS=Object.freeze([
 {label:'Старт',level:1,time:0,beam:0,range:0,hull:0,engine:0},
 {label:'Ранний',level:4,time:90,beam:1,range:0,hull:1,engine:1},
 {label:'Средний',level:8,time:360,beam:2,range:1,hull:2,engine:2},
 {label:'Поздний',level:14,time:900,beam:4,range:2,hull:4,engine:3}
]);

export function combatTierProfile(build){
 const {level,time,beam,range,hull,engine}=build;
 const spec=moduleStats('plasma',{beam,range});
 const hullHp=STARTER_COMBAT.hull+22*hull;
 const shots=[];
 for(const type of ['scout','fighter','flanker','gunship']){
  const enemy=ENEMY_TYPES[type];
  const hp=Math.round(enemy.hp*(type==='scout'?
   1+Math.min(.65,time/1600):1+Math.min(2.5,time/550)));
  const values={type,hp};
  for(const [key,distance] of [['near',115],['far',spec.range]]){
   const damage=beamDamage(spec.damage,distance,115,spec.range);
   // The runtime keeps fractional HP. Rounding is display-only.
   const actualHp=enemy.hp*(type==='scout'?
    1+Math.min(.65,time/1600):1+Math.min(2.5,time/550));
   const count=Math.ceil(actualHp/damage);
   values[key]={shotDamage:+damage.toFixed(2),shots:count,
    ttkSeconds:+((count-1)*spec.interval).toFixed(2)};
  }
  shots.push(values);
 }
 const fighter=gunProfile('fighter',time),flanker=gunProfile('flanker',time);
 const gunship=gunProfile('gunship',time);
 const shot=(damage,speed,warning,shots=1)=>({damage,speed,warning,shots,
  flightAt300:+(300/speed).toFixed(2)});
 return {label:build.label,level,time,build:{beam,range,hull,engine},
  ship:{hull:hullHp,speed:STARTER_COMBAT.speed+35*engine,
   plasmaDamage:+spec.damage.toFixed(2),plasmaRange:spec.range,
   plasmaInterval:+spec.interval.toFixed(3)},
  enemyFire:{scout:shot(IRIS_COMBAT.damage,IRIS_COMBAT.projectileSpeed,
   IRIS_COMBAT.charge),
   fighter:shot(fighter.damage,fighter.speed,fighter.charge,fighter.shots||1),
   flanker:shot(flanker.damage,flanker.speed,flanker.charge),
   gunship:shot(gunship.damage,gunship.speed,gunship.charge,gunship.shots||1),
   gunshipLance:{damage:ENEMY_GUNNERY.lance.damage,
    warning:ENEMY_GUNNERY.lance.charge,availableAfter:245}},
  enemies:shots};
}
export const combatTierMatrix=()=>({
 scope:'Theory: one unblocked plasma emitter; enemy HP grows with flight time; no actual hit rate or enemy count',
 tiers:BENCHMARK_BUILDS.map(combatTierProfile)
});
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 console.log(JSON.stringify(combatTierMatrix(),null,2));
