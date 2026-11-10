import {contactOnCircle} from './impact-geometry.js?v=arcade-impact-51';
import {damageFriendlyTurret} from './turret-defense.js?v=turret-defense-20261110';

/** Resolve an enemy bolt against both kinds of friendly ships. The game
 * processes asteroid cover first; a single bolt can hit at most one hull. */
export function hitFriendlyShip(game,shot){
  if(!shot?.alive)return false;
  for(const mission of game.support?.missions||[]){
    const craft=mission.craft?.find(c=>c.hp>0&&
      Math.hypot(shot.x-c.x,shot.y-c.y)<shot.r+c.r);
    if(!craft)continue;
    shot.alive=false;craft.hp-=shot.damage;craft.hit=.18;
    if(craft.hp<=0)game.heritage.vfx.shipExplosion(craft.x,craft.y,24,'#80d9ff');
    else {
      const point=contactOnCircle(craft.x,craft.y,craft.r,shot.x,shot.y);
      game.heritage.vfx.hullImpact(point?.x??craft.x,point?.y??craft.y,false,point);
    }
    return true;
  }
  for(const ally of game.allies||[]){
    if(ally.hp<=0||Math.hypot(shot.x-ally.x,shot.y-ally.y)>=shot.r+ally.r)
      continue;
    shot.alive=false;
    game.hitAlly(ally,shot.damage*(1-(game.network?.armor||0)*.07));
    return true;
  }
  for(const decoy of game.artilleryDecoys||[]){
    if(decoy.hp<=0||decoy.until<=game.time||
      Math.hypot(shot.x-decoy.x,shot.y-decoy.y)>=shot.r+decoy.r)continue;
    shot.alive=false;decoy.hp=Math.max(0,decoy.hp-shot.damage);
    game.heritage?.vfx?.hullImpact?.(shot.x,shot.y,false);
    if(decoy.hp<=0){
      game.heritage?.vfx?.shipExplosion?.(decoy.x,decoy.y,18,'#a6e7ff');
      game.heritage?.play?.('supportDroneLost',.3,decoy);
    }
    return true;
  }
  for(const turret of game.world?.contours?.artillery||[]){
    if(turret.hp<=0||game.time<turret.readyAt||
      Math.hypot(shot.x-turret.x,shot.y-turret.y)>=shot.r+turret.r)continue;
    shot.alive=false;
    const impact=damageFriendlyTurret(game,turret,shot);
    const point=contactOnCircle(turret.x,turret.y,turret.r,shot.x,shot.y);
    if(impact.intercepted)return true;
    if(impact.destroyed){
      game.heritage?.vfx?.shipExplosion?.(turret.x,turret.y,40,'#ffae6e');
      game.heritage?.play?.('artilleryDestroyed',.8,turret);
    }else{
      game.heritage?.vfx?.hullImpact?.(point?.x??turret.x,point?.y??turret.y,false,point);
      game.heritage?.play?.('artilleryHit',.2,turret);
    }
    return true;
  }
  for(const turret of game.world?.contours?.supportTurrets||[]){
    if(turret.hp<=0||game.time<turret.readyAt)continue;
    // The small escorts are intentionally vulnerable: losing one forces a
    // paid, visible delivery of replacement flux to the mothership.
    for(const drone of turret.drones||[]){
      if(drone.hp<=0||Math.hypot(shot.x-drone.x,shot.y-drone.y)>=shot.r+drone.r)continue;
      shot.alive=false;drone.hp=Math.max(0,drone.hp-shot.damage);
      const point=contactOnCircle(drone.x,drone.y,drone.r,shot.x,shot.y);
      if(drone.hp<=0){
        game.heritage?.vfx?.shipExplosion?.(drone.x,drone.y,21,'#83f5c9');
        game.heritage?.play?.('supportDroneLost',.4,drone);
      }else game.heritage?.vfx?.hullImpact?.(point?.x??drone.x,point?.y??drone.y,false,point);
      return true;
    }
    if(Math.hypot(shot.x-turret.x,shot.y-turret.y)>=shot.r+turret.r)continue;
    shot.alive=false;
    const impact=damageFriendlyTurret(game,turret,shot);
    const point=contactOnCircle(turret.x,turret.y,turret.r,shot.x,shot.y);
    if(impact.intercepted)return true;
    if(impact.destroyed){
      game.heritage?.vfx?.shipExplosion?.(turret.x,turret.y,40,'#ffa87e');
      game.heritage?.play?.('supportDestroyed',.8,turret);
    }else{
      game.heritage?.vfx?.hullImpact?.(point?.x??turret.x,point?.y??turret.y,false,point);
      game.heritage?.play?.('supportHit',.2,turret);
    }
    return true;
  }
  for(const depot of [...(game.world?.contours?.fluxDepots||[]),
   ...(game.world?.contours?.fluxSiphonHives||[])]){
    if(depot.hp<=0||game.time<depot.readyAt||
      Math.hypot(shot.x-depot.x,shot.y-depot.y)>=shot.r+(depot.r||38))continue;
    shot.alive=false;depot.hp=Math.max(0,depot.hp-shot.damage);
    if(depot.hp<=0){
      game.heritage?.vfx?.shipExplosion?.(depot.x,depot.y,40,'#70f4df');
      game.heritage?.play?.('supportDestroyed',.7,depot);
    }else game.heritage?.vfx?.hullImpact?.(shot.x,shot.y,false);
    return true;
  }
  return false;
}
