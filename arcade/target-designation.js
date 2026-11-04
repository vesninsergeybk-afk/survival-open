import {combatTargets,targetDistance,targetRadius,clearLine}
  from './combat-targets.js?v=living-world-1';

export const TARGET_DESIGNATION=Object.freeze({duration:14,tapRadius:34,maxDistance:900});

/** Optional player decision on the game canvas, shared by mouse and touch.
 * It can only point at an already targetable, unoccluded visible enemy. */
export function pickDesignatedTarget(game,worldPoint,tapRadius=TARGET_DESIGNATION.tapRadius){
  if(!game?.player||!worldPoint)return null;
 const targets=combatTargets(game,Math.max(70,tapRadius+50),worldPoint);
 const worker=game.world?.regionalSupply?.central?.worker;
 if(worker?.hp>0&&game.world?.stations.get('industry:source')?.enemy)
  targets.push({kind:'enemy',target:worker,goal:true});
 return targets
    .filter(item=>targetDistance(game.player,item.target)<=TARGET_DESIGNATION.maxDistance&&
      targetDistance(worldPoint,item.target)<=
        Math.max(tapRadius,targetRadius(item)+9)&&
      clearLine(game,game.player,item.target))
    .sort((a,b)=>targetDistance(worldPoint,a.target)-targetDistance(worldPoint,b.target))[0]||null;
}

export function activeDesignatedTarget(game){
  const record=game?.designatedTarget;
  if(!record||game.time>record.expiresAt||!(record.target?.hp>0)||
     record.target.converted||record.target.captured)return null;
  return record.target;
}
