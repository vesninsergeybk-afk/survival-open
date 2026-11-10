/**
 * A manoeuvre doctrine changes the outcome of an imminent hit, not a generic
 * damage coefficient. Only two small, genuinely incoming hostile shots can be
 * turned away. Large artillery and shots passing elsewhere remain dangerous.
 */
export const COUNTER_MANEUVER=Object.freeze({radius:115,maximum:2,smallShotRadius:8,warningTime:.55});

export function deflectBurstShots(game){
 if(game.doctrine!=='countermaneuver'||!game.player)return 0;
 const p=game.player,{radius,maximum,smallShotRadius,warningTime}=COUNTER_MANEUVER;
 const threats=(game.shots||[]).filter(s=>{
  if(!s?.alive||(s.r||6)>smallShotRadius)return false;
  const dx=p.x-s.x,dy=p.y-s.y,speed2=s.vx*s.vx+s.vy*s.vy;
  if(speed2<1||Math.hypot(dx,dy)>radius)return false;
  const time=(dx*s.vx+dy*s.vy)/speed2;
  if(time<0||time>warningTime)return false;
  return Math.hypot(dx-s.vx*time,dy-s.vy*time)<(p.r||19)+(s.r||6)+12;
 }).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
 let count=0;
 for(const shot of threats.slice(0,maximum)){
  const dx=shot.x-p.x,dy=shot.y-p.y,d=Math.hypot(dx,dy);
  const speed=Math.hypot(shot.vx,shot.vy);
  shot.vx=d>=1?dx/d*speed:-shot.vx;
  shot.vy=d>=1?dy/d*speed:-shot.vy;
  count++;
 }
 return count;
}
