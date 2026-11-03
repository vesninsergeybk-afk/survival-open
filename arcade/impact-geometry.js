/**
 * Visual-only contact on the game's existing circular collision proxy.
 * It never changes damage or collision resolution. Irregular ship paintings
 * still need a dedicated visual outline; don't assume the circle is pixel-accurate.
 */
const EPSILON=1e-6;

/**
 * Surface point facing the source; also returns an outward unit normal.
 * Unknown direction => center cue, not an invented "top" or random side.
 * Invalid target coordinates => null; callers can keep their previous fallback.
 */
export function contactOnCircle(cx,cy,radius,sourceX,sourceY){
 if(!Number.isFinite(cx)||!Number.isFinite(cy))return null;
 const r=Number.isFinite(radius)?Math.max(0,radius):0;
 if(!Number.isFinite(sourceX)||!Number.isFinite(sourceY))
  return {x:cx,y:cy,nx:0,ny:0,directed:false};
 const dx=sourceX-cx,dy=sourceY-cy,d=Math.hypot(dx,dy);
 if(d<EPSILON)return {x:cx,y:cy,nx:0,ny:0,directed:false};
 const nx=dx/d,ny=dy/d;
 return {x:cx+nx*r,y:cy+ny*r,nx,ny,directed:true};
}

/**
 * A segment intersection is already an exact game-space contact; retain it.
 * The outward normal is computed only for directing debris.
 */
export function contactAtPoint(cx,cy,hitX,hitY){
 if(![cx,cy,hitX,hitY].every(Number.isFinite))return null;
 const dx=hitX-cx,dy=hitY-cy,d=Math.hypot(dx,dy);
 if(d<EPSILON)return {x:hitX,y:hitY,nx:0,ny:0,directed:false};
 return {x:hitX,y:hitY,nx:dx/d,ny:dy/d,directed:true};
}
