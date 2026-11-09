/** What an individual pilot can actually know about the player.
 * Only sampled, unobstructed sightings or delivered radio reports may renew
 * pursuit. An encounter may start with a dispatch coordinate, but the ship
 * cannot silently follow a moving player across the whole sector. */
export const ENEMY_AWARENESS=Object.freeze({
  directRange:290,visualGrace:.58,personalMemory:4.8,
  dispatchMemory:9,impactMemory:3.7,radioLead:.12,maxLead:26
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

/** Background ships cross a traffic lane, not a secretly supplied player
 * coordinate. The camera only selects which slice of the world is simulated;
 * spotting the pilot still requires actual sensors or an incoming radio order. */
export function ambientPatrolRoute(camera,side,lane,serial=0){
  if(!camera||!Number.isFinite(camera.x)||!Number.isFinite(camera.y)||
     !(camera.w>0)||!(camera.h>0))return null;
  const t=clamp(Number.isFinite(lane)?lane:.5,.14,.86);
  const drift=((Math.abs(Math.trunc(serial))%3)-1)*.065;
  if(side===0||side===1)return {
    x:side===0?camera.x+camera.w+270:camera.x-270,
    y:camera.y+clamp(t+drift,.12,.88)*camera.h,_exitSide:side};
  if(side===2||side===3)return {
    x:camera.x+clamp(t+drift,.12,.88)*camera.w,
    y:side===2?camera.y+camera.h+270:camera.y-270,_exitSide:side};
  return null;
}

/** A patrol that crossed the sector without a contact exits the active
 * simulation quietly. It cannot be farmed for experience or occupy the cap. */
/** A routine patrol should fly *through* its lane until it has evidence of a
 * threat. Orbiting, flanking and healing behaviors are combat formations;
 * applying them to an unalerted ship traps it near the player indefinitely. */
export function unalertedPatrolRoute(e,game,radio=null,strategic=null){
  if(!e?._patrolRoute||e.boss||e.missionStructure||e.openingCommander||
     e.interceptCargo||e.relayAssault||e.protect?.hp>0||e.signalIntel||
     e._enemyLearningSaw||e._irisHasSight||
     game.time-(e._awarenessLast?.at??-Infinity)<=ENEMY_AWARENESS.personalMemory||
     game.time-(e._awarenessImpact?.at??-Infinity)<=ENEMY_AWARENESS.impactMemory||
     game.time-(e._awarenessDispatch?.at??-Infinity)<=ENEMY_AWARENESS.dispatchMemory||
     game.time<(e._irisSearchingUntil??-Infinity)||radio?.intel||strategic)return null;
  return e._patrolRoute;
}

export function patrolCanLeave(e,game){
  const route=e?._patrolRoute;
  if(!route||distance(e,route)>145||!game?.camera)return false;
  const cam=game.camera();
  const offscreen=e.x<cam.x-55||e.x>cam.x+cam.w+55||
    e.y<cam.y-55||e.y>cam.y+cam.h+55;
  const radio=game.enemyComms?.directiveFor?.(e,game.time);
  const strategic=game.enemyComms?.strategicDirectiveFor?.(e,game.time);
  if(!unalertedPatrolRoute(e,game,radio,strategic))return false;
  if(offscreen)return true;
  // A zoomed-out pilot may still see a patrol at its original exit waypoint.
  // Extend the SAME straight traffic lane, rather than letting the ship orbit
  // inside the view and permanently consume an enemy slot. Each extension has
  // a fixed direction, so a patrol cannot learn the moving pilot's position.
  const stride=500;
  if(route._exitSide===0)route.x+=stride;
  else if(route._exitSide===1)route.x-=stride;
  else if(route._exitSide===2)route.y+=stride;
  else if(route._exitSide===3)route.y-=stride;
  return false;
}
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
      game.enemyLearning?.observePlayer(player,now,e);
      game.enemyComms?.reportSight(e,player,now);
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
  if(order?.intel)return point(order.intel,now);
  const intel=e.signalIntel;
  if((intel?.combatFocus===game.player||intel?.lastSeenEstimated)&&
    now-intel.lastSeenAt<=ENEMY_AWARENESS.personalMemory)
    return point({x:intel.lastSeenX,y:intel.lastSeenY,
      vx:0,vy:0,at:intel.lastSeenAt},now);
  if(e._awarenessLast&&now-e._awarenessLast.at<=ENEMY_AWARENESS.personalMemory)
    return point(e._awarenessLast,now);
  // An impact reveals an approximate incoming bearing, not the attacker.
  // The victim investigates briefly without aiming at an unseen player.
  if(e._awarenessImpact&&now-e._awarenessImpact.at<=ENEMY_AWARENESS.impactMemory)
    return point(e._awarenessImpact,now);
  const dispatch=e._awarenessDispatch;
  if(dispatch&&now-dispatch.at<=ENEMY_AWARENESS.dispatchMemory)
    return point({...dispatch,vx:0,vy:0},now);
  if(e._patrolRoute)return point({...e._patrolRoute,vx:0,vy:0,at:now},now);
  // Search locally around the last known point, then return to patrol.
  // This position depends only on this pilot's state, not on player.x/y.
  const anchor=e._awarenessLast||dispatch||e._awarenessPatrol||
    (e._awarenessPatrol={x:e.x,y:e.y});
  const phase=now*.34+(Math.abs(e.serial||0)%7)*.89;
  return {x:anchor.x+Math.cos(phase)*115,
    y:anchor.y+Math.sin(phase)*115,vx:0,vy:0,r:19,hp:1,remembered:true};
}
