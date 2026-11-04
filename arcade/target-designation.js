import {combatTargets,targetDistance,targetRadius,clearLine}
  from './combat-targets.js?v=regions-1-enemy-world-response-1';

export const TARGET_DESIGNATION=Object.freeze({duration:14,tapRadius:34,maxDistance:900});

/** Optional player decision on the game canvas, shared by mouse and touch.
 * It can only point at an already targetable, unoccluded visible enemy. */
export function pickDesignatedTarget(game,worldPoint,tapRadius=TARGET_DESIGNATION.tapRadius){
  if(!game?.player||!worldPoint)return null;
  return combatTargets(game,Math.max(70,tapRadius+50),worldPoint)
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
