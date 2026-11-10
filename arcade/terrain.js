/**
 * Tactical terrain for the first asteroid-belt trial.
 * Pure geometry: deterministic generation, no rendering or combat RNG.
 */
export const AMBER_BELT=Object.freeze({
 centerX:7200,centerY:1450,halfLength:1350,slope:.22,
 corridor:175,outerBand:850
});
// These deposits exist from world creation, including before the rescue is
// offered. Two clear lanes lead through each ring, so cover never becomes a
// sealed wall around a mission objective or a station approach.
export const DEBRIS_POCKETS=Object.freeze([
 {x:-395,y:585,inner:190,outer:620,gaps:[-.73,2.49]},
 {x:2550,y:1750,inner:200,outer:740,gaps:[-.36,2.76]},
 {x:-2250,y:-1450,inner:180,outer:660,gaps:[.44,-2.64]}
]);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const angularDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
export function debrisPocketDensity(x,y){
 let highest=0;
 for(const pocket of DEBRIS_POCKETS){
  const dx=x-pocket.x,dy=y-pocket.y,r=Math.hypot(dx,dy);
  if(r<=pocket.inner||r>=pocket.outer)continue;
  // The first-flight repair orbit around the home dock must retain its
  // pre-existing escape and combat routes. The rescue lies outside it.
  if(pocket===DEBRIS_POCKETS[0]&&Math.hypot(x-360,y+85)<1150)continue;
  const heading=Math.atan2(dy,dx);
  // Corridors remain visible and wide enough for a ship and its pursuers.
  if(pocket.gaps.some(a=>angularDistance(heading,a)<.35))continue;
  const inner=clamp((r-pocket.inner)/110,0,1);
  const outer=clamp((pocket.outer-r)/115,0,1);
  highest=Math.max(highest,Math.min(inner,outer));
 }
 return highest;
}
export function inRescueClearing(x,y){
 const site=DEBRIS_POCKETS[0];
 return Math.hypot(x-site.x,y-site.y)<site.inner-4;
}
const beltCoords=(x,y)=>{
 const along=(x-AMBER_BELT.centerX)/AMBER_BELT.halfLength;
 const cross=Math.abs(y-(AMBER_BELT.centerY+
   (x-AMBER_BELT.centerX)*AMBER_BELT.slope));
 return {along,cross};
};
/** Broad boundary used for local rock-cell generation and one-time guidance. */
export function nearAmberBelt(x,y){
 const {along,cross}=beltCoords(x,y);
 return Math.abs(along)<1.05&&cross<AMBER_BELT.outerBand+110;
}
/** A visible, open flying corridor bisects the belt. */
export function inAmberCorridor(x,y){
 const {along,cross}=beltCoords(x,y);
 return Math.abs(along)<1&&cross<AMBER_BELT.corridor;
}
/** Two tapered rock bands on opposite sides of the corridor. */
export function amberBeltDensity(x,y){
 const {along,cross}=beltCoords(x,y);
 if(Math.abs(along)>=1||cross<=AMBER_BELT.corridor||cross>=AMBER_BELT.outerBand)return 0;
 return clamp(Math.min(
   (1-Math.abs(along))/.18,
   (cross-AMBER_BELT.corridor)/140,
   (AMBER_BELT.outerBand-cross)/170
 ),0,1);
}
/**
 * First contact along the actual projectile segment, including long frames.
 * Only visibly large rocks stop hostile shots. Smaller mining fragments do not.
 * A rock overlapping the player never grants invisible immunity.
 */
export function firstRockImpact(x0,y0,x1,y1,rocks,shotRadius=0,player=null,bodyCollision=false){
 const vx=x1-x0,vy=y1-y0,a=vx*vx+vy*vy;
 let best=null,bestT=Infinity;
 for(const rock of rocks){
  if(!rock.alive||rock.r<34)continue;
  if(player&&Math.hypot(player.x-rock.x,player.y-rock.y)<
     rock.r+(player.r||0)+3)continue;
  // Projectiles have a restrained collision margin; a charging ship needs
  // its full physical radius to stop before its hull enters the asteroid.
  const r=rock.r+(bodyCollision?Math.max(0,shotRadius):
    Math.min(4,Math.max(0,shotRadius)*.5));
  const fx=x0-rock.x,fy=y0-rock.y;
  // Cheap bounding check before the quadratic calculation.
  if(rock.x<Math.min(x0,x1)-r||rock.x>Math.max(x0,x1)+r||
     rock.y<Math.min(y0,y1)-r||rock.y>Math.max(y0,y1)+r)continue;
  const c=fx*fx+fy*fy-r*r;
  let t=Infinity;
  if(c<=0)t=0;
  else if(a>1e-9){
   const b=2*(fx*vx+fy*vy),discriminant=b*b-4*a*c;
   if(discriminant>=0)t=(-b-Math.sqrt(discriminant))/(2*a);
  }
  if(t>=0&&t<=1&&t<bestT){bestT=t;best={rock,x:x0+vx*t,y:y0+vy*t,t};}
 }
 return best;
}
