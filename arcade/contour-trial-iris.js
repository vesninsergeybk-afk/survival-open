/** The IRIS scouts assigned to a newly enclosed territory fight differently.
 * They telegraph one short, imperfect intercept, then break away to reload.
 * Ordinary scouts, converted ships and unrelated encounters are untouched.
 * All state is transient; a failed trial simply spawns a fresh squad. */
import {clamp} from './balance.js';

export const CONTOUR_IRIS=Object.freeze({
 minimumRange:135,maximumRange:445,windup:.78,rush:.79,
 correctionAt:.32,recovery:1.25,baseSpeed:338,maxSpeed:385,
 maxSimultaneous:4
});

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const targetPoint=(enemy,player,side,lead=.23)=>{
 const dx=player.x-enemy.x,dy=player.y-enemy.y,d=Math.hypot(dx,dy)||1;
 const predictedX=player.x+clamp((player.vx||0)*lead,-85,85);
 const predictedY=player.y+clamp((player.vy||0)*lead,-85,85);
 return {x:predictedX-dy/d*side*23,y:predictedY+dx/d*side*23};
};

export function contourIrisDirective(enemy,game){
 if(!enemy?._trialDiveEnabled||enemy.type!=='scout'||enemy.converted||enemy.hp<=0||
    enemy.trialId!==game.contourTrial?.entry?.id||enemy.state!=='hunt')return null;
 const now=game.time,player=game.player;
 if(!player||!(player.hp>0))return null;
 const d=distance(enemy,player);
 let attack=enemy._trialDive;
 if(attack?.phase==='rush'){
  if(now>=attack.until){
   attack.phase='recover';attack.until=now+CONTOUR_IRIS.recovery;
   attack.x=enemy.x+(enemy.vx||0)*.64;
   attack.y=enemy.y+(enemy.vy||0)*.64;
  }else{
   if(!attack.corrected&&now>=attack.started+CONTOUR_IRIS.correctionAt){
    const aim=targetPoint(enemy,player,attack.side,.12);
    // One limited course correction is dodgeable; the ship never homes in
    // perfectly at the last instant or snaps its physical position.
    attack.x+=clamp(aim.x-attack.x,-75,75);
    attack.y+=clamp(aim.y-attack.y,-75,75);
    attack.corrected=true;
   }
   return {x:attack.x,y:attack.y,
    speed:Math.min(CONTOUR_IRIS.maxSpeed,CONTOUR_IRIS.baseSpeed+(enemy._trialDiveTier||1)*4),
    phase:'rush'};
  }
 }
 if(attack?.phase==='recover'){
  if(now<attack.until)return {x:attack.x,y:attack.y,speed:193,phase:'recover'};
  attack.phase='cooldown';attack.until=now+2.3+(Math.abs(enemy.serial||0)%4)*.4;
 }
 if(attack?.phase==='windup'){
  if(!game.enemyCanSee?.(enemy,player)){
   attack.phase='cooldown';attack.until=now+2;return null;
  }
  if(now<attack.until){
   const near=targetPoint(enemy,player,attack.side,.2);
   // Maintain a slow lateral drift while charging; never freeze in place.
   return {x:near.x,y:near.y,speed:78,phase:'windup'};
  }
  attack.phase='rush';attack.started=now;
  attack.until=now+CONTOUR_IRIS.rush;attack.corrected=false;
  // Commit to the warned interception point. The player can change course
  // during the warning instead of discovering an invisible target reset.
  return {x:attack.x,y:attack.y,
   speed:Math.min(CONTOUR_IRIS.maxSpeed,CONTOUR_IRIS.baseSpeed+(enemy._trialDiveTier||1)*4),
   phase:'rush'};
 }
 if((attack?.until||0)>now||d<CONTOUR_IRIS.minimumRange||
    d>CONTOUR_IRIS.maximumRange||!game.enemyCanSee?.(enemy,player))return null;
 // Limit simultaneous high-speed threats, even if twenty scouts join a wave.
 const active=(game.enemies||[]).filter(other=>other!==enemy&&other.hp>0&&
  other.trialId===enemy.trialId&&
  ['windup','rush'].includes(other._trialDive?.phase)).length;
 if(active>=CONTOUR_IRIS.maxSimultaneous)return null;
 const side=(enemy.serial||0)%2===0?1:-1;
 const aim=targetPoint(enemy,player,side);
 enemy._trialDive={phase:'windup',started:now,until:now+CONTOUR_IRIS.windup,
  x:aim.x,y:aim.y,side,corrected:false};
 game.heritage?.play?.('ramWarning',1.4,enemy);
 return {x:aim.x,y:aim.y,speed:78,phase:'windup'};
}

/** Swept contact avoids a fast dive passing through the ship at 10–20 FPS. */
export function contourIrisRushContacts(startX,startY,enemy,player){
 const dx=enemy.x-startX,dy=enemy.y-startY;
 const t=clamp(((player.x-startX)*dx+(player.y-startY)*dy)/
  Math.max(1e-8,dx*dx+dy*dy),0,1);
 const closestX=startX+dx*t,closestY=startY+dy*t;
 const reach=(enemy.r||14)+(player.r||19);
 return Math.hypot(closestX-player.x,closestY-player.y)<reach;
}

/** An exact world-space warning and readable, low-cost thrust trail. */
export function drawContourIrisCharge(ctx,enemy,now,reducedMotion=false){
 const attack=enemy?._trialDive;
 if(!attack||!['windup','rush'].includes(attack.phase)||enemy.hp<=0)return false;
 const warning=attack.phase==='windup';
 const progress=clamp((now-attack.started)/(warning?CONTOUR_IRIS.windup:CONTOUR_IRIS.rush),0,1);
 const radius=(enemy.r||14)+(warning?11+7*(1-progress):8);
 ctx.save();ctx.lineCap='round';
 ctx.strokeStyle=warning?'#ffc58f':'#ff727d';ctx.lineWidth=warning?2.4:3;
 ctx.beginPath();ctx.arc(enemy.x,enemy.y,radius,0,Math.PI*2);ctx.stroke();
 if(warning){
  // The lane is a prediction, not an invisible unavoidable lock-on.
  ctx.setLineDash([9,8]);ctx.strokeStyle='rgba(255,154,135,.68)';ctx.lineWidth=1.7;
  ctx.beginPath();ctx.moveTo(enemy.x,enemy.y);ctx.lineTo(attack.x,attack.y);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='#ffe0b2';ctx.font='bold 10px system-ui';ctx.textAlign='center';
  ctx.fillText('РЫВОК '+Math.max(0,attack.until-now).toFixed(1)+' c',enemy.x,
   enemy.y-radius-13);
 }else if(!reducedMotion){
  const vx=enemy.vx||0,vy=enemy.vy||0,mag=Math.hypot(vx,vy)||1;
  const length=Math.min(83,30+mag*.14);
  ctx.globalAlpha=.85;ctx.lineWidth=4.2;ctx.strokeStyle='#a765ff';
  ctx.beginPath();ctx.moveTo(enemy.x,enemy.y);
  ctx.lineTo(enemy.x-vx/mag*length,enemy.y-vy/mag*length);ctx.stroke();
  ctx.lineWidth=1.5;ctx.strokeStyle='#ffdad9';ctx.stroke();
 }
 ctx.restore();return true;
}
