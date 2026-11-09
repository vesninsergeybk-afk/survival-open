import {alertSignalThreat} from './signal-perception.js';

export const ATTACK_ALARM=Object.freeze({radius:640,repeatSeconds:1.4});

/** A hit is immediately useful intelligence to nearby ships. A living pilot
 * can radio a *sector*; witnesses can see a wreck. Nobody receives the live
 * player object or coordinates from a distant shot behind cover. */
export function alertFleetUnderFire(game,victim,estimate){
 if(!game?.grid?.query||!victim||!Number.isFinite(game.time))return 0;
 const sector=estimate&&Number.isFinite(estimate.x)&&Number.isFinite(estimate.y)?
  {x:estimate.x,y:estimate.y}:
  {x:victim.x,y:victim.y};
 let warned=0;
 for(const mate of game.grid.query(victim.x,victim.y,ATTACK_ALARM.radius)){
  if(mate===victim||mate.hp<=0||mate.converted||mate.captured||
     !Number.isFinite(mate.x)||!Number.isFinite(mate.y)||
     Math.hypot(mate.x-victim.x,mate.y-victim.y)>ATTACK_ALARM.radius||
     game.time<(mate._underFireAlarmUntil||0))continue;
  const witnessed=!!game.enemyCanSee?.(mate,victim);
  const relayed=victim.hp>0&&
   !!game.enemyComms?.send?.(victim,mate,'distress',game.time);
  if(!witnessed&&!relayed)continue;
  mate._underFireAlarmUntil=game.time+ATTACK_ALARM.repeatSeconds;
  mate._awarenessDispatch={...sector,at:game.time};
  mate._commsIncident={...sector,at:game.time,kind:'under-fire',assetId:null};
  if(mate.signalIntel)alertSignalThreat(mate.signalIntel,
   {...sector,estimated:true},game.time);
  warned++;
 }
 return warned;
}
