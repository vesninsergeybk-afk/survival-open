import {doctrineRank} from './pilot-doctrines.js?v=pilot-depth-1-pilot-value-2';
/**
 * A manoeuvre doctrine changes the outcome of an imminent hit, not a generic
 * damage coefficient. Only two small, genuinely incoming hostile shots can be
 * turned away. Large artillery and shots passing elsewhere remain dangerous.
 */
export const COUNTER_MANEUVER=Object.freeze({radius:115,maximum:2,smallShotRadius:8,warningTime:.55});
export const countermaneuverRadius=game=>doctrineRank(game,'countermaneuver')>=2?145:COUNTER_MANEUVER.radius;
// A successful advanced counter creates a short defensive opening against
// follow-up fire. A dash into empty space never grants the damage reduction.
export function counterguardMultiplier(game){
 const rank=doctrineRank(game,'countermaneuver');
 return rank>=2&&game.counterguardUntil>game.time?(rank>=3?.7:.85):1;
}

export function deflectBurstShots(game){
 const rank=doctrineRank(game,'countermaneuver');
 if(!rank||!game.player)return 0;
 const p=game.player;
 const radius=countermaneuverRadius(game);
 const maximum=rank>=3?4:rank>=2?3:COUNTER_MANEUVER.maximum;
 const smallShotRadius=rank>=2?11:COUNTER_MANEUVER.smallShotRadius;
 const warningTime=rank>=2?0.7:COUNTER_MANEUVER.warningTime;
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
 if(count&&rank>=2)game.counterguardUntil=game.time+2;
 if(count&&rank>=3){
  const shieldLimit=Math.max(p.shield||0,16+(game.skillRanks?.shield||0)*24);
  if(((game.skillRanks?.shield||0)>0||p.shield>0)&&p.shield<shieldLimit)
   p.shield=Math.min(shieldLimit,p.shield+6*count);
  else p.hp=Math.min(p.maxHp,p.hp+3*count);
 }
 return count;
}
