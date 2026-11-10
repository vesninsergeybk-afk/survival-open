/** Hostile station guns lock a visible point before launching a dodgeable shot. */
import {learnedTurretAim} from './enemy-learning.js';
// 1.2 s reload + 1.15 s aiming ≈ the previous 2.2–2.55 s firing cycle.
export const BASE_TURRET_GUN=Object.freeze({range:530,charge:1.15,reload:1.2,
 speed:405,maxConcurrent:3});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function advanceBaseTurretGun(game,t,rank,target,dt,canStart=true){
 t.shot=(t.shot??0)-Math.max(0,dt);
 t.flash=Math.max(0,(t.flash||0)-Math.max(0,dt));
 if(!(t.hp>0)){t._baseAim=null;return false;}
 const aim=t._baseAim;
 if(aim){
  // This gun cannot chase a vanished target or retain a shot after losing sight.
  if(!(aim.target?.hp>0)||distance(t,aim.target)>BASE_TURRET_GUN.range||
     (typeof game.enemyCanSee==='function'&&!game.enemyCanSee(t,aim.target))){
   t._baseAim=null;t.shot=Math.max(.55,t.shot);return false;
  }
  if(game.time<aim.until)return false;
  const fired=game.enemyShot(t.x,t.y,aim.x,aim.y,16+rank*2,{
   kind:'base-turret',speed:BASE_TURRET_GUN.speed,r:5.5,
   learnToken:game.enemyLearning?.shotToken(t)})!==false;
  if(fired)game.enemyLearning?.fired(t);
  t._baseAim=null;
  t.shot=fired?BASE_TURRET_GUN.reload+((t.id||0)%4)*.12:.35;
  return fired;
 }
 if(t.shot>0||!canStart||!(target?.hp>0)||
    distance(t,target)>BASE_TURRET_GUN.range||
    (typeof game.enemyCanSee==='function'&&!game.enemyCanSee(t,target)))return false;
 // Preserve the learned shot bias, but fix the aim at charge start. Evasion
 // during the full warning is meaningful; no retargeting on the release tick.
 if(target===game.player)game.enemyLearning?.observePlayer(target,game.time,t);
 const profile=game.enemyLearning?.styleFor(t,game.time,'turret');
 const motion=target===game.player?
  learnedTurretAim(target,profile,t._learningObservation?.turnSign||0):
  {x:target.x,y:target.y};
 t._baseAim={x:motion.x,y:motion.y,target,started:game.time,
  until:game.time+BASE_TURRET_GUN.charge};
 return false;
}

/** The telegraph is painted from the gun to the *locked* impact point. */
export function drawBaseTurretWarnings(ctx,game,cam,reduced=false){
 let count=0;
 for(const base of game.world?.nearbyStations?.(game.player.x,game.player.y,950)||[]){
  if(!base.enemy||base.captured)continue;
  for(const t of base.turrets||[]){
   const aim=t._baseAim;
   if(!(t.hp>0)||!aim||t.x<cam.x-40||t.x>cam.x+cam.w+40||
      t.y<cam.y-40||t.y>cam.y+cam.h+40)continue;
   const p=Math.max(0,Math.min(1,(game.time-aim.started)/BASE_TURRET_GUN.charge));
   ctx.save();ctx.lineCap='round';ctx.globalAlpha=.31+p*.48;
   ctx.strokeStyle='#ff7292';ctx.lineWidth=1.4+p*1.5;
   ctx.setLineDash([8,6]);ctx.lineDashOffset=reduced?0:-p*13;
   ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(aim.x,aim.y);ctx.stroke();
   ctx.setLineDash([]);ctx.strokeStyle='#ffd3a8';ctx.lineWidth=1.7;
   ctx.beginPath();ctx.arc(aim.x,aim.y,7+p*6,0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.moveTo(aim.x-5,aim.y);ctx.lineTo(aim.x+5,aim.y);
   ctx.moveTo(aim.x,aim.y-5);ctx.lineTo(aim.x,aim.y+5);ctx.stroke();
   ctx.restore();count++;
  }
 }
 return count;
}
