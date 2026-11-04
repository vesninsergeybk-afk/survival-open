/** What an individual pilot can actually know about the player.
 * Only sampled, unobstructed sightings or delivered radio reports may renew
 * pursuit. An encounter may start with a dispatch coordinate, but the ship
 * cannot silently follow a moving player across the whole sector. */
export const ENEMY_AWARENESS=Object.freeze({
  directRange:290,visualGrace:.58,personalMemory:4.8,
  dispatchMemory:9,radioLead:.12,maxLead:26
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const point=(data,now)=>({
  x:data.x+clamp((data.vx||0)*Math.min(ENEMY_AWARENESS.radioLead,
    Math.max(0,now-data.at)),-ENEMY_AWARENESS.maxLead,ENEMY_AWARENESS.maxLead),
  y:data.y+clamp((data.vy||0)*Math.min(ENEMY_AWARENESS.radioLead,
    Math.max(0,now-data.at)),-ENEMY_AWARENESS.maxLead,ENEMY_AWARENESS.maxLead),
  vx:data.vx||0,vy:data.vy||0,r:19,hp:1,remembered:true
});

export function updateEnemyAwareness(e,game){
  const now=game.time,player=game.player;
  if(e._awarenessNextAt==null)
    e._awarenessNextAt=now+(Math.abs(e.serial||0)%7)*.035;
  if(now>=e._awarenessNextAt){
    e._awarenessNextAt=now+.36+(Math.abs(e.serial||0)%5)*.042;
    const seen=distance(e,player)<ENEMY_AWARENESS.directRange&&
      !!game.enemyCanSee?.(e,player);
    if(seen){
      e._awarenessLast={x:player.x,y:player.y,
        vx:player.vx||0,vy:player.vy||0,at:now};
      game.enemyComms?.reportSight(e,player,now);
      game.enemyLearning?.observePlayer(player,now);
    }
  }
  e._enemyLearningSaw=!!e._awarenessLast&&
    now-e._awarenessLast.at<=ENEMY_AWARENESS.visualGrace;
  return e._enemyLearningSaw;
}

export function enemyPursuitTarget(e,game){
  const now=game.time;
  if(e._enemyLearningSaw)return game.player;
  const order=game.enemyComms?.directiveFor?.(e,now);
  if(order?.intel&&now-order.intel.at<=2.6)return point(order.intel,now);
  const intel=e.signalIntel;
  if(intel?.combatFocus===game.player&&
    now-intel.lastSeenAt<=ENEMY_AWARENESS.personalMemory)
    return point({x:intel.lastSeenX,y:intel.lastSeenY,
      vx:0,vy:0,at:intel.lastSeenAt},now);
  if(e._awarenessLast&&now-e._awarenessLast.at<=ENEMY_AWARENESS.personalMemory)
    return point(e._awarenessLast,now);
  const dispatch=e._awarenessDispatch;
  if(dispatch&&now-dispatch.at<=ENEMY_AWARENESS.dispatchMemory)
    return point({...dispatch,vx:0,vy:0},now);
  // Search locally around the last known point, then return to patrol.
  // This position depends only on this pilot's state, not on player.x/y.
  const anchor=e._awarenessLast||dispatch||e._awarenessPatrol||
    (e._awarenessPatrol={x:e.x,y:e.y});
  const phase=now*.34+(Math.abs(e.serial||0)%7)*.89;
  return {x:anchor.x+Math.cos(phase)*115,
    y:anchor.y+Math.sin(phase)*115,vx:0,vy:0,r:19,hp:1,remembered:true};
}
