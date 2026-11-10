import {firstRockImpact} from './terrain.js';
import {combatTargets,targetRadius} from './combat-targets.js';

const TAU=Math.PI*2;
const MINE_SPACING=43;
const MINE_CLEARANCE=12;
const MINE_RELOCATE_LIMIT=108;

// The avoidance grid includes small rocks, whereas rockGrid contains only
// solid projectile cover (and some wrecks). An aimed landing must respect both.
export function landingRocks(game,point,radius=210){
 const seen=new Set(),result=[];
 for(const grid of [game.avoidanceRockGrid,game.rockGrid]){
  for(const rock of grid?.query(point.x,point.y,radius)||[]){
   if(rock?.alive&&!seen.has(rock)){
    seen.add(rock);result.push(rock);
   }
  }
 }
 return result;
}

const rockAt=(point,rocks,margin)=>
 rocks.find(rock=>Math.hypot(rock.x-point.x,rock.y-point.y)<rock.r+margin)||null;

export function landingRock(game,point,margin=12){
 return rockAt(point,landingRocks(game,point),margin);
}

function freeMineSite(base,rocks,placed,limit=MINE_RELOCATE_LIMIT){
 const free=point=>!rockAt(point,rocks,MINE_CLEARANCE)&&
  placed.every(other=>Math.hypot(other.x-point.x,other.y-point.y)>=26);
 if(free(base))return base;
 for(let radius=18;radius<=limit;radius+=18){
  for(let i=0;i<12;i++){
   const angle=i*TAU/12;
   const candidate={x:base.x+Math.cos(angle)*radius,y:base.y+Math.sin(angle)*radius};
   if(free(candidate))return candidate;
  }
 }
 return null;
}

export function planMineSites(game,center,count){
 const angle=Math.atan2(center.y-game.player.y,center.x-game.player.x)+Math.PI/2;
 const rocks=landingRocks(game,center,(count-1)*MINE_SPACING*.5+MINE_RELOCATE_LIMIT+90);
 const sites=[];
 for(let i=0;i<count;i++){
  const offset=(i-(count-1)/2)*MINE_SPACING;
  const base={x:center.x+Math.cos(angle)*offset,y:center.y+Math.sin(angle)*offset};
  const site=freeMineSite(base,rocks,sites);
  if(!site)return null;
  sites.push(site);
 }
 return sites;
}

// A slowly drifting rock may enter a pod's landing site after launch. Adjust
// only at landing, never create an active mine inside a rock.
export function resolveMineLanding(game,point,placed=[]){
 const rocks=landingRocks(game,point,205);
 return freeMineSite(point,rocks,placed);
}

// Large asteroids still shelter enemies from an area blast, but the blast is
// no longer reduced to zero simply because a rock lies somewhere in the ring.
export function blastCoverFactor(game,from,to){
 const distance=Math.hypot(to.x-from.x,to.y-from.y);
 const rocks=game.rockGrid?.query((from.x+to.x)*.5,(from.y+to.y)*.5,distance*.5+65)||[];
 return firstRockImpact(from.x,from.y,to.x,to.y,rocks,2,null)?.6:1;
}

export function railCoverPreview(game,from,direction,range){
 const length=Math.hypot(direction.x-from.x,direction.y-from.y);
 if(length<1)return null;
 const end={x:from.x+(direction.x-from.x)*range/length,
  y:from.y+(direction.y-from.y)*range/length};
 const rocks=game.rockGrid?.query((from.x+end.x)*.5,(from.y+end.y)*.5,range*.5+80)||[];
 const cover=firstRockImpact(from.x,from.y,end.x,end.y,rocks,2,from);
 const dx=end.x-from.x,dy=end.y-from.y,a=dx*dx+dy*dy;
 let first=null;
 for(const item of combatTargets(game,range+70,from,true)){
  const target=item.target,r=targetRadius(item);
  const fx=from.x-target.x,fy=from.y-target.y;
  const b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-r*r;
  const discriminant=b*b-4*a*c;
  if(discriminant<0)continue;
  const t=c<=0?0:(-b-Math.sqrt(discriminant))/(2*a);
  if(t>=0&&t<=1&&(!first||t<first.t))first={t,target};
 }
 const targetFirst=first&&(!cover||first.t<=cover.t+1e-7);
 return {end,cover,blocked:!!cover&&!targetFirst,
  impact:targetFirst?{x:from.x+dx*first.t,y:from.y+dy*first.t}:cover||end};
}
