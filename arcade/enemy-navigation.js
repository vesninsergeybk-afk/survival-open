/** A local, bounded sideways correction for an asteroid directly across the
 * current waypoint. This uses rocks in the pilot's immediate vicinity;
 * it never supplies a new player coordinate or an artificial speed boost. */
export function enemyRockDetour(pilot,game,goalX,goalY){
  const dx=goalX-pilot.x,dy=goalY-pilot.y,range=Math.hypot(dx,dy);
  if(range<35)return {x:0,y:0};
  const ux=dx/range,uy=dy/range;
  // Nearby rocks change slowly relative to a pilot. A short cache avoids
  // repeating spatial queries every frame for large enemy formations.
  const cached=pilot._rockDetour;
  if(cached&&Number.isFinite(game.time)&&game.time<cached.until&&
     Math.hypot(pilot.x-cached.x,pilot.y-cached.y)<24&&
     ux*cached.ux+uy*cached.uy>.966)return cached.force;
  const remember=force=>{
    if(Number.isFinite(game.time))pilot._rockDetour={
      x:pilot.x,y:pilot.y,ux,uy,until:game.time+.12,force};
    return force;
  };
  const nearby=game.rockGrid?.query?.(pilot.x,pilot.y,430)||
    game.nearRocks||[];
  let nearest=null,nearestAlong=Infinity,urgency=0;
  for(const rock of nearby){
    if(rock.alive===false)continue;
    const rx=rock.x-pilot.x,ry=rock.y-pilot.y;
    if(Math.abs(rx)>430||Math.abs(ry)>430)continue;
    const along=rx*ux+ry*uy;
    const clearance=rock.r+(pilot.r||14)+32;
    if(along<-(pilot.r||14)||along>Math.min(range,390)+clearance)continue;
    const across=Math.abs(rx*uy-ry*ux);
    if(across>clearance+65||along>nearestAlong)continue;
    nearest=rock;nearestAlong=along;
    urgency=Math.max(0,Math.min(1,(clearance+65-across)/100));
  }
  if(!nearest)return remember({x:0,y:0});
  // Pick the shorter bypass side for an offset rock. For an exact head-on
  // obstacle, a stable serial parity prevents left/right oscillation.
  const sideOffset=(nearest.x-pilot.x)*uy-(nearest.y-pilot.y)*ux;
  const side=Math.abs(sideOffset)>12?Math.sign(sideOffset):
    (Math.abs(pilot.serial||0)%2===0?1:-1);
  return remember({x:-uy*side*1.16*urgency,y:ux*side*1.16*urgency});
}
