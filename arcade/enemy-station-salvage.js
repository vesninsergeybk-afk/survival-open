import {fieldAt} from './territory-system.js';

// Defeating a fortified industry district produces a ruined strategic site.
// Ownership changes only after a deliberate, exposed repair-and-claim action.
export const SALVAGE=Object.freeze({range:175,seconds:8,oreBase:10,orePerRank:3});

export function ruinEnemyIndustry(base,time){
 if(!base?.colonyId||!base.enemy||base.captured)return false;
 base.hp=0;base.enemy=false;base.captured=false;base.active=false;
 base.ruined=true;base.ruinedAt=time;base.activated=false;
 // Neutral ruins must not inherit the enemy suppression flag: checkpoints
 // require every suppressed station to carry a dated suppression deadline.
 // Zero HP and neutral ownership already disable all industry.
 base.coreExposed=false;base.suppressed=false;
 return true;
}

export function salvageQuote(world,player,base){
 if(!base?.ruined||base.captured||base.hp>0||base.enemy)
  return {ok:false,reason:'Объект не требует захвата.'};
 if(Math.hypot(player.x-base.x,player.y-base.y)>SALVAGE.range)
  return {ok:false,reason:'Подлетите к обломкам станции.'};
 const cost=SALVAGE.oreBase+Math.min(5,Math.max(1,base.rank||1))*SALVAGE.orePerRank;
 const secured=!!fieldAt(world,base.x,base.y)||
  (world.nearbyStations?.(base.x,base.y,2500,false)||[]).some(s=>
   s.active&&!s.enemy&&!s.ruined&&s.hp>0);
 if((base.rank>=3||base.title?.includes('Крепость'))&&!secured)
  return {ok:false,reason:'Тяжёлую станцию нельзя удержать без опорного контура. Подведите свою сеть ближе.'};
 if(player.ore<cost)
  return {ok:false,reason:'Для ремонта ядра нужно '+cost+' сплава (не хватает '+(cost-player.ore)+').'};
 return {ok:true,cost,seconds:SALVAGE.seconds};
}

export function claimRuinedIndustry(world,player,base,time){
 const quote=salvageQuote(world,player,base);
 if(!quote.ok)return quote;
 player.ore-=quote.cost;
 base.ruined=false;base.suppressed=false;base.captured=true;base.enemy=false;
 base.hp=Math.max(1,Math.round(base.maxHp*.3));base.active=true;
 base.activated=true;base.activationTime=time;
 return {ok:true,cost:quote.cost};
}
