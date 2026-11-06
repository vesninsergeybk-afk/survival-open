// A territorial jammer opens a short window for the PILOT to sabotage a
// physical industrial depot. Supply already in flight is never removed.
import {warFronts} from './war-fronts.js?v=campaign-1-repair-qa-1-enemy-balance-2-territory-war-1';

export const INDUSTRIAL_BREACH=Object.freeze({
 damageRequired:110,duration:270,earliestRepair:150,repairRatio:.75
});
const stockKey=front=>front.key==='home'||front.key==='north'?'ore':'resource';

export function industrialBreachActive(depot,time){
 return !!depot?.enemy&&(depot.fluxBreachUntil||0)>time;
}

export function recordIndustrialBreachHit(world,turret,damage,time){
 if(!Number.isFinite(damage)||damage<=0||!Number.isFinite(time))return null;
 const front=warFronts(world).find(f=>f.depot?.enemy&&f.depot?.turrets.includes(turret));
 const depot=front?.depot;
 if(!depot||industrialBreachActive(depot,time)||!(depot.fluxJamUntil>time))return null;
 depot.fluxBreachProgress=Math.min(INDUSTRIAL_BREACH.damageRequired,
  (depot.fluxBreachProgress||0)+damage);
 if(depot.fluxBreachProgress<INDUSTRIAL_BREACH.damageRequired)
  return {kind:'progress',front:front.key,progress:depot.fluxBreachProgress};
 depot.fluxBreachUntil=time+INDUSTRIAL_BREACH.duration;
 depot.fluxBreachRepairAt=time+INDUSTRIAL_BREACH.earliestRepair;
 depot.fluxBreachProgress=0;
 return {kind:'breach',front:front.key,depot,until:depot.fluxBreachUntil};
}

// The enemy may shorten the outage ONLY by spending ore from its existing
// industrial pool, after a guaranteed period of disruption. The same ore
// would otherwise fund cargo and reinforcements.
export function advanceIndustrialBreaches(world,time){
 const events=[];
 for(const front of warFronts(world)){
  const depot=front.depot;
  if(!depot||!(depot.fluxBreachUntil>0))continue;
  if(!depot.enemy||time>=depot.fluxBreachUntil){
   depot.fluxBreachUntil=0;depot.fluxBreachRepairAt=0;depot.fluxBreachProgress=0;
   continue;
  }
  if(time<(depot.fluxBreachRepairAt||Infinity))continue;
  const key=stockKey(front),cost=Math.ceil(front.cost*INDUSTRIAL_BREACH.repairRatio);
  if(!front.pool||!Number.isFinite(front.pool[key])||front.pool[key]<cost)continue;
  front.pool[key]-=cost;
  depot.fluxBreachUntil=0;depot.fluxBreachRepairAt=0;depot.fluxBreachProgress=0;
  events.push({kind:'repaired',front:front.key,depot,cost});
 }
 return events;
}
