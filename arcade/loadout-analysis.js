import {beamDamage} from './balance.js';
import {MODULES,moduleStats,loadoutProfile} from './ship-loadout.js?v=weapons-cycle-2-campaign-1-menu-focus-1';
import {plasmaDamageFactor} from './weapon-specializations.js?v=weapons-cycle-2';

// One unarmored target, no cover or misses. Heat is reported separately, never
// presented as a promise of sustained DPS. Additional flak targets aren't DPS
// against a single ship; manual weapons aren't continuous automatic damage.
export function loadoutAnalysis(loadout,ranks={}){
 const counts=loadoutProfile(loadout),ranges=[100,400,650];
 const families=['plasma','rail','flak','rocket'];
 const stats=Object.fromEntries(families.map(id=>[id,
  moduleStats(id,ranks,loadout.specializations?.[id])]));
 const damageAt=distance=>families.reduce((total,id)=>{
  const s=stats[id];if(!counts[id]||distance>s.range)return total;
  const damage=id==='plasma'?beamDamage(s.damage,distance,115,s.range,.28)*
   plasmaDamageFactor(loadout.specializations?.plasma,distance,s.range):s.damage;
  return total+damage*counts[id]/s.interval;
 },0);
 const heatRate=families.reduce((sum,id)=>sum+counts[id]*MODULES[id].heat/stats[id].interval,0);
 const maxRange=Math.max(0,...families.filter(id=>counts[id]).map(id=>stats[id].range));
 const notes=[];
 if(counts.flak)notes.push('Осколочное оружие поражает до '+stats.flak.targets+' целей в пределах 245 м. Таблица считает урон только по одной.');
 if(counts.rail)notes.push('Рельс предпочитает цель операции и тяжёлые корабли. Непробиваемое укрытие принимает выстрел на себя.');
 if(counts.rocket)notes.push('Ракетам нужно долететь до цели; манёвр и астероиды могут сорвать попадание.');
 if(counts.ion)notes.push('Ион: три ручных разряда по плазменным меткам. Для обычного урона в секунду он не учитывается.');
 if(counts.resonator)notes.push('Резонатор связывает группу: 35% нанесённого урона передаётся соседям. По одиночной цели не действует; таблица связь не учитывает.');
 if(counts.howitzer)notes.push('Гаубица даёт 70 нагрева и приостанавливает автоогонь во время подготовки. В таблицу автоогня не входит.');
 if(maxRange<650)notes.push('Дальше '+maxRange+' м эта сборка не ведёт автоматический огонь.');
 return {ranges,dps:ranges.map(damageAt),heatRate,maxRange,notes};
}
