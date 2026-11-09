import {combatTargets,targetAlive,targetRadius,damageTarget} from './combat-targets.js?v=frontier-siege-1';
import {firstRockImpact} from './terrain.js';
import {blastCoverFactor} from './aimed-terrain.js';
import {contactAtPoint,contactOnCircle} from './impact-geometry.js';
import {weaponDamageFactor} from './weapon-specializations.js';
import {emitWeaponFx} from './weapon-fx.js';

// Real, swept projectiles. Both pools are short-lived and strictly bounded:
// no per-particle physics and no extra damage from decorative trails.
export const FLAK_PELLETS_PER_TARGET=3;
export const FLAK_POOL_CAP=96;
export const FLAK_SPEED=1650;
export const HEAVY_SHELL_SPEED=690;
const TAU=Math.PI*2;
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const point=(x,y)=>({x,y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function interceptTime(from,target,speed){
 const dx=target.x-from.x,dy=target.y-from.y;
 const vx=Number.isFinite(target.vx)?target.vx:0;
 const vy=Number.isFinite(target.vy)?target.vy:0;
 const a=vx*vx+vy*vy-speed*speed,b=2*(dx*vx+dy*vy),c=dx*dx+dy*dy;
 if(Math.abs(a)<1e-8)return b<0?-c/b:Math.sqrt(c)/speed;
 const disc=b*b-4*a*c;
 if(disc<0)return Math.sqrt(c)/speed;
 const roots=[(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)].filter(t=>t>=0);
 return roots.length?Math.min(...roots):Math.sqrt(c)/speed;
}

/** Earliest exact circle entry on a swept world-space segment. */
export function segmentCircle(a,b,target,radius){
 const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-target.x,fy=a.y-target.y;
 const squared=dx*dx+dy*dy,c=fx*fx+fy*fy-radius*radius;
 if(c<=0)return 0;
 if(squared<=1e-9)return null;
 const cross=2*(fx*dx+fy*dy),delta=cross*cross-4*squared*c;
 if(delta<0)return null;
 const t=(-cross-Math.sqrt(delta))/(2*squared);
 return t>=0&&t<=1?t:null;
}
const at=(a,b,t)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);

/**
 * One physical scatter volley. A mount points into one sector; targets outside
 * that sector cannot be struck by its guided dispersion. Every individual
 * pellet still flies straight, can miss a moving target and stops on cover or
 * the first actual hostile hull. The attack's damage budget is unchanged:
 * three pellets divide the former per-target damage, with no free extra hit.
 */
export function launchFlakVolley(game,from,targets,anchor,stats){
 const alive=targets.filter(item=>targetAlive(game,item));
 if(!alive.length||!anchor||!targetAlive(game,anchor))return false;
 const orientation=Math.atan2(anchor.target.y-from.y,anchor.target.x-from.x);
 const sweep=game.shipLoadout?.specializations?.flak?.path==='sweep';
 const halfCone=sweep?1.15:.85;
 const inside=alive.filter(item=>Math.abs(angleDifference(
  Math.atan2(item.target.y-from.y,item.target.x-from.x),orientation))<=halfCone);
 if(!inside.length)return false;
 const pellets=game.flakPellets??(game.flakPellets=[]);
 // Shared catalogue snapshot permits interception by a different hostile hull
 // without treating arbitrary friendly world objects as valid targets.
 const candidates=combatTargets(game,stats.range+45,game.player);
 for(const item of inside){
  const t=item.target,d=distance(from,t);
  // A small, physically bounded lead keeps this anti-swarm weapon viable
  // against moving cargo; a sudden turn can still dodge the straight pellets.
  const lead=Math.min(stats.range/FLAK_SPEED,interceptTime(from,t,FLAK_SPEED));
  const aimX=t.x+(Number.isFinite(t.vx)?t.vx:0)*lead;
  const aimY=t.y+(Number.isFinite(t.vy)?t.vy:0)*lead;
  const direction=Math.atan2(aimY-from.y,aimX-from.x);
  const angularRadius=Math.min(.14,Math.asin(Math.min(.95,targetRadius(item)*.72/Math.max(1,d))));
  for(let i=-1;i<=1;i++){
   const angle=direction+i*angularRadius;
   // The cap is never silently truncated: the oldest in-flight pellet leaves
   // first, and the next salvo is already limited by module cooldown/heat.
   if(pellets.length>=FLAK_POOL_CAP)pellets.shift();
   pellets.push({x:from.x,y:from.y,px:from.x,py:from.y,
    vx:Math.cos(angle),vy:Math.sin(angle),remaining:stats.range,
    damage:stats.damage/FLAK_PELLETS_PER_TARGET,candidates});
  }
 }
 const launch=point(from.x+Math.cos(orientation)*43,from.y+Math.sin(orientation)*43);
 emitWeaponFx(game,'flak',from,launch,{impact:false});
 game.heritage?.vfx?.muzzle(from.x,from.y,orientation,'flak');
 return true;
}

/** Motion and actual collision resolution; swept checks prevent tunnelling at 15 FPS. */
export function updateFlakPellets(game,dt){
 const pellets=game.flakPellets;
 if(!pellets?.length||!(dt>0))return;
 for(let i=pellets.length-1;i>=0;i--){
  const pellet=pellets[i],step=Math.min(pellet.remaining,FLAK_SPEED*dt);
  const from=point(pellet.x,pellet.y),end=point(from.x+pellet.vx*step,from.y+pellet.vy*step);
  const rocks=game.rockGrid?.query((from.x+end.x)*.5,(from.y+end.y)*.5,step*.5+50)||[];
  const cover=firstRockImpact(from.x,from.y,end.x,end.y,rocks,1,game.player);
  let first=null;
  for(const item of pellet.candidates){
   if(!targetAlive(game,item))continue;
   const t=segmentCircle(from,end,item.target,targetRadius(item));
   if(t!==null&&(!first||t<first.t))first={item,t};
  }
  if(cover&&(!first||cover.t<=first.t)){
   const hit=contactAtPoint(cover.rock.x,cover.rock.y,cover.x,cover.y);
   game.damageRock(cover.rock,pellet.damage*.85,from.x,from.y,'auto',true,hit);
   pellets.splice(i,1);
  }else if(first){
   const hit=at(from,end,first.t);
   damageTarget(game,first.item,pellet.damage*weaponDamageFactor(game.shipLoadout,'flak',first.item.target),
    'flak',contactAtPoint(first.item.target.x,first.item.target.y,hit.x,hit.y));
   pellets.splice(i,1);
  }else{
   pellet.px=from.x;pellet.py=from.y;pellet.x=end.x;pellet.y=end.y;
   pellet.remaining-=step;
   if(pellet.remaining<=.01)pellets.splice(i,1);
  }
 }
}

/** One unguided shell per heavy mount. Targets may dodge after the telegraph. */
export function launchHeavyShell(game,from,aim){
 const d=distance(from,aim);if(!(d>0))return false;
 const ux=(aim.x-from.x)/d,uy=(aim.y-from.y)/d;
 game.heavyShells=[{x:from.x,y:from.y,px:from.x,py:from.y,
  vx:ux,vy:uy,tx:aim.x,ty:aim.y,remaining:d,totalDistance:d}];
 emitWeaponFx(game,'howitzer',from,point(from.x+ux*60,from.y+uy*60),{impact:false});
 game.heritage?.play?.('rocketShot',.2,from);
 return true;
}

function detonateHeavy(game,hit){
 game.heritage?.vfx?.nova(hit.x,hit.y,110,'violet');
 game.heritage?.play?.('howitzerShot',.35,hit);
 // Preserve target snapshots: a turret destroyed by this blast must not
 // expose its protected station core to the *same* explosion.
 for(const item of combatTargets(game,180,hit)){
  const t=item.target;if(distance(t,hit)>110+targetRadius(item))continue;
  damageTarget(game,item,180*blastCoverFactor(game,hit,t),'howitzer',
   contactOnCircle(t.x,t.y,targetRadius(item),hit.x,hit.y));
 }
}

/** The shell never homes. It passes above rocks but hostile hulls may intercept it. */
export function updateHeavyShells(game,dt){
 const shells=game.heavyShells;
 if(!shells?.length||!(dt>0))return;
 for(let i=shells.length-1;i>=0;i--){
  const shell=shells[i],from=point(shell.x,shell.y),step=Math.min(shell.remaining,HEAVY_SHELL_SPEED*dt);
  const end=point(from.x+shell.vx*step,from.y+shell.vy*step);
  let first=null;
  for(const item of combatTargets(game,step*.5+115,point((from.x+end.x)*.5,(from.y+end.y)*.5))){
   const t=segmentCircle(from,end,item.target,targetRadius(item));
   if(t!==null&&(!first||t<first.t))first={item,t};
  }
  shell.px=from.x;shell.py=from.y;shell.x=end.x;shell.y=end.y;
  shell.remaining-=step;
  if(first){
   shells.splice(i,1);detonateHeavy(game,at(from,end,first.t));
  }else if(shell.remaining<=.01){
   shells.splice(i,1);detonateHeavy(game,point(shell.tx,shell.ty));
  }
 }
}

/** World-space silhouettes; no additional drawn collision or false impact. */
export function drawBallisticWeapons(ctx,game,fps=60,reducedMotion=false,camera=null){
 const visible=(x,y,pad)=>!camera||(x>=camera.x-pad&&x<=camera.x+camera.w+pad&&
  y>=camera.y-pad&&y<=camera.y+camera.h+pad);
 ctx.save();ctx.lineCap='round';
 for(const p of game.flakPellets||[]){
  if(!visible(p.x,p.y,30))continue;
  const bx=p.x-p.vx*18,by=p.y-p.vy*18;
  ctx.strokeStyle='#f08b48';ctx.lineWidth=fps<28?3.5:6;
  ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(p.x,p.y);ctx.stroke();
  ctx.strokeStyle='#ffe5bb';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(p.x-p.vx*9,p.y-p.vy*9);ctx.lineTo(p.x,p.y);ctx.stroke();
 }
 for(const s of game.heavyShells||[]){
  const fraction=1-s.remaining/Math.max(1,s.totalDistance||s.remaining||1);
  const height=Math.sin(Math.PI*Math.max(0,Math.min(1,fraction)))*
   Math.min(110,Math.max(32,(s.totalDistance||300)*.13));
  if(visible(s.x,s.y-height,40)||visible(s.x,s.y,40)){
   const drawY=s.y-height;
   ctx.fillStyle='#c68afa';ctx.globalAlpha=.2;
   ctx.beginPath();ctx.arc(s.x,s.y,8,0,TAU);ctx.fill();
   ctx.globalAlpha=1;
   ctx.strokeStyle='#b06dff';ctx.lineWidth=fps<28?5:10;
   ctx.beginPath();ctx.moveTo(s.x-s.vx*28,drawY-s.vy*28);ctx.lineTo(s.x,drawY);ctx.stroke();
   ctx.strokeStyle='#ffdcff';ctx.lineWidth=2.6;
   ctx.beginPath();ctx.moveTo(s.x-s.vx*13,drawY-s.vy*13);ctx.lineTo(s.x,drawY);ctx.stroke();
   ctx.fillStyle='#fff4ff';ctx.beginPath();ctx.arc(s.x,drawY,fps<28?5:7,0,TAU);ctx.fill();
  }
  if(visible(s.tx,s.ty,120)){
   ctx.strokeStyle='#e2b2ff99';ctx.lineWidth=2;
   ctx.setLineDash([7,7]);ctx.beginPath();ctx.arc(s.tx,s.ty,110,0,TAU);ctx.stroke();ctx.setLineDash([]);
   if(!reducedMotion){
    ctx.strokeStyle='#e9b8ff66';ctx.beginPath();ctx.arc(s.tx,s.ty,18,0,TAU);ctx.stroke();
   }
  }
 }
 ctx.restore();
}
