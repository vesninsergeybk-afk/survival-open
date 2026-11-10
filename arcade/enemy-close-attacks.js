import {sweptRamHit} from './enemy-last-stand.js?v=redteam-20261109-1';
import {firstRockImpact} from './terrain.js?v=arcade-belt-26-redteam-20261109-1';

// A close-range pass is a commitment to a location, never homing contact
// damage. The pilot sees the wind-up and can evade by turning after the lock.
// One wing starts its run at a time; a pack cannot inflict simultaneous
// unavoidable body blows merely because it has more members.
export const CLOSE_ATTACK=Object.freeze({
 earliest:5,globalSpacing:1.45,windup:.64,dashSeconds:.44,
 recovery:.43,maxWarnings:2,
 scout:Object.freeze({min:54,max:212,speed:415,damage:14,cooldown:7.1}),
 fighter:Object.freeze({min:50,max:185,speed:360,damage:17,cooldown:7.6}),
 flanker:Object.freeze({min:55,max:230,speed:470,damage:18,cooldown:7.9})
});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function cancelCloseAttack(e){
 if(e)e._closeAttack=null;
}

/** Return true if the new close attack owns this enemy's movement. */
export function advanceEnemyCloseAttack(e,game,dt,target){
 const now=game?.time,player=game?.player,cfg=CLOSE_ATTACK[e?.type];
 if(!cfg||!player||!(dt>0)||!Number.isFinite(now))return false;
 let attack=e._closeAttack;
 if(attack){
  if(e.hp<=0||e.converted||player.hp<=0||e.boss||e.missionStructure){
   cancelCloseAttack(e);return false;
  }
  e._gunAiming=null;e._gunBurst=null;e._irisChargeStarted=null;
  const oldX=e.x,oldY=e.y;
  if(attack.stage==='windup'){
   // Kill momentum smoothly; no tracking of the target after the lock.
   const drag=Math.exp(-7*Math.max(0,dt));
   e.vx=(e.vx||0)*drag;e.vy=(e.vy||0)*drag;
   e.x+=e.vx*dt;e.y+=e.vy*dt;
   if(game.enemyCanSee&&!game.enemyCanSee(e,player)){
    cancelCloseAttack(e);e._closeAttackNextAt=now+2;return true;
   }
   if(now>=attack.until){
    const dx=attack.x-e.x,dy=attack.y-e.y,m=Math.hypot(dx,dy)||1;
    attack.dx=dx/m;attack.dy=dy/m;
    attack.stage='dash';attack.until=now+CLOSE_ATTACK.dashSeconds;
   }
  }else if(attack.stage==='dash'){
   const step=Math.min(dt,Math.max(0,attack.until-now+dt))*cfg.speed;
   e.vx=attack.dx*cfg.speed;e.vy=attack.dy*cfg.speed;
   e.x+=attack.dx*step;e.y+=attack.dy*step;
   e.angle=Math.atan2(attack.dy,attack.dx)+Math.PI/2;
   // Rock cover is real. A warned dash cannot pass through the asteroid that
   // blocks its trajectory, even when one low-FPS tick spans the obstacle.
   if(game.rockGrid?.query){
    const travel=Math.hypot(e.x-oldX,e.y-oldY);
    const rocks=game.rockGrid.query((e.x+oldX)/2,(e.y+oldY)/2,travel/2+(e.r||14)+60);
    const impact=firstRockImpact(oldX,oldY,e.x,e.y,rocks,e.r||14,null,true);
    if(impact){e.x=impact.x;e.y=impact.y;attack.until=now;}
   }
   if(!attack.struck&&sweptRamHit(oldX,oldY,e.x,e.y,player,(e.r||14)+(player.r||19)+3)){
    attack.struck=true;
    const before=(player.hp||0)+(player.shield||0);
    if(player.invul<=0)game.hurt?.(cfg.damage,{x:e.x,y:e.y});
    const dealt=Math.max(0,before-(player.hp||0)-(player.shield||0));
    if(dealt>0)game.enemyLearning?.dealt?.(game.enemyLearning?.shotToken?.(e),dealt);
    attack.until=now;
   }
   if(now>=attack.until){attack.stage='recover';attack.until=now+CLOSE_ATTACK.recovery;}
  }else if(attack.stage==='recover'){
   const reverse=105;
   e.vx=-attack.dx*reverse;e.vy=-attack.dy*reverse;
   e.x+=e.vx*dt;e.y+=e.vy*dt;
   if(now>=attack.until){cancelCloseAttack(e);e.vx*=.4;e.vy*=.4;}
  }
  e._commsIntent={x:attack.x,y:attack.y,
   mode:attack.stage==='windup'?'close-windup':attack.stage==='dash'?'close-dash':'close-recover',at:now};
  return true;
 }
 if(target!==player||now<CLOSE_ATTACK.earliest||
    now<(e._closeAttackNextAt||0)||now<(game._enemyCloseNextAt||0)||
    e.hp<=0||e.converted||e.boss||e.missionStructure||e.openingCommander||
    e._lastStand||e.ramOrder||e.relayAssault||e.stationRaid||e.interceptCargo||
    e.protect?.hp>0||e.trialRetreatUntil||e._trialDive||
    e._gunAiming||e._gunBurst||
    !['hunt','flank','intercept'].includes(e.state)||
    (e.signalIntel&&e.signalIntel.mode!=='engaged')||
    !(e._enemyLearningSaw||e.type==='scout'&&e._irisHasSight)||
    (game.enemyCanSee&&!game.enemyCanSee(e,player)))return false;
 const range=dist(e,player);
 if(range<cfg.min||range>cfg.max)return false;
 const cam=game.camera?.();
 if(cam&&(e.x<cam.x+(e.r||14)+12||e.x>cam.x+cam.w-(e.r||14)-12||
   e.y<cam.y+(e.r||14)+12||e.y>cam.y+cam.h-(e.r||14)-12))return false;
 const lead=Math.min(.14,range/cfg.speed*.25);
 const x=player.x+Math.max(-24,Math.min(24,(player.vx||0)*lead));
 const y=player.y+Math.max(-24,Math.min(24,(player.vy||0)*lead));
 e._closeAttack={stage:'windup',x,y,started:now,until:now+CLOSE_ATTACK.windup,
  struck:false,dx:0,dy:0};
 e._closeAttackNextAt=now+cfg.cooldown+(Math.abs(e.serial||0)%3)*.31;
 game._enemyCloseNextAt=now+CLOSE_ATTACK.globalSpacing;
 e._gunAiming=null;e._gunBurst=null;e._irisChargeStarted=null;
 game.heritage?.play?.('ramWarning',.38,{x:e.x,y:e.y});
 return true;
}

export function drawEnemyCloseWarnings(ctx,game,cam,fps=60){
 let count=0;
 for(const e of game?.enemies||[]){
  const a=e._closeAttack;
  if(!a||a.stage==='recover'||e.hp<=0||e.converted||
    e.x<cam.x-30||e.x>cam.x+cam.w+30||e.y<cam.y-30||e.y>cam.y+cam.h+30||
    count>=(fps<28?1:CLOSE_ATTACK.maxWarnings))continue;
  const warning=a.stage==='windup',progress=warning?
   Math.max(0,Math.min(1,(game.time-a.started)/CLOSE_ATTACK.windup)):1;
  const tint=e.type==='scout'?'#ae8dff':e.type==='flanker'?'#ffbb7b':'#ff8d85';
  ctx.save();ctx.strokeStyle=tint;ctx.globalAlpha=.42+progress*.5;
  ctx.lineWidth=warning?1.7+progress*1.7:2.8;
  ctx.setLineDash(warning?[7,5]:[]);
  ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(a.x,a.y);ctx.stroke();
  ctx.setLineDash([]);ctx.beginPath();ctx.arc(e.x,e.y,(e.r||14)+10+progress*7,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(a.x,a.y,11+progress*8,0,Math.PI*2);ctx.stroke();
  if(warning){
   ctx.textAlign='center';ctx.fillStyle=tint;ctx.font='bold 9px system-ui';
   ctx.fillText('БЛИЖНИЙ РЫВОК',e.x,e.y-(e.r||14)-33,150);
  }
  ctx.restore();count++;
 }
 return count;
}
