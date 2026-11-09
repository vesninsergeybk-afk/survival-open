// A damaged ordinary fighter may sacrifice itself. This is a physical charge:
// no added HP, invulnerability, teleportation, or knowledge through cover.
export const LAST_STAND=Object.freeze({
 threshold:.36,earliest:95,windup:.72,duration:5.2,
 speed:525,turnRate:2.75,damage:20,maxSimultaneous:2
});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function armLastStand(e,game,hpBefore,sawPlayer){
 if(!e||!game?.player||!sawPlayer||game.time<LAST_STAND.earliest||
    !['fighter','flanker'].includes(e.type)||
    e.serial%3!==0||e._lastStandSpent||e._lastStand||
    e.boss||e.missionStructure||e.relayAssault||e.stationRaid||
    e.interceptCargo||e.protect?.hp>0||e.converted||e.trialId!==undefined||
    e.hp<=0||!Number.isFinite(e.maxHp)||
    hpBefore<e.maxHp*LAST_STAND.threshold||
    e.hp>e.maxHp*LAST_STAND.threshold||dist(e,game.player)>620)return false;
 const count=(game.enemies||[]).filter(other=>other.hp>0&&other._lastStand).length;
 if(count>=LAST_STAND.maxSimultaneous)return false;
 e._lastStandSpent=true;
 e._lastStand={started:game.time,chargeAt:game.time+LAST_STAND.windup,
   expires:game.time+LAST_STAND.duration,lastSeenAt:game.time,
   x:game.player.x,y:game.player.y,heading:Math.atan2(e.vy||0,e.vx||1)};
 e._gunAiming=null;e._gunBurst=null;e._irisChargeStarted=null;
 game.heritage?.play?.('ramWarning',1.7,{x:e.x,y:e.y});
 return true;
}

// Collision against the WHOLE charge segment, including low-FPS frames.
export function sweptRamHit(x1,y1,x2,y2,point,radius){
 const dx=x2-x1,dy=y2-y1,denom=dx*dx+dy*dy;
 const t=denom>0?clamp(((point.x-x1)*dx+(point.y-y1)*dy)/denom,0,1):0;
 return Math.hypot(point.x-(x1+dx*t),point.y-(y1+dy*t))<=radius;
}

/** Returns true while the sacrificial manoeuvre owns movement and weapon AI. */
export function updateLastStand(e,game,dt){
 const charge=e?._lastStand;if(!charge)return false;
 if(e.hp<=0||e.converted){e._lastStand=null;return false;}
 const now=game.time,player=game.player;
 if(now>=charge.expires||now-charge.lastSeenAt>2.5){
  e._lastStand=null;e.commitUntil=0;return false;
 }
 const visible=player?.hp>0&&
   (game.enemyCanSee?.(e,player)??false);
 if(visible){charge.x=player.x;charge.y=player.y;charge.lastSeenAt=now;}
 const oldX=e.x,oldY=e.y;
 const charging=now>=charge.chargeAt;
 const headingGoal=Math.atan2(charge.y-e.y,charge.x-e.x);
 const previous=Math.hypot(e.vx||0,e.vy||0)>25?
  Math.atan2(e.vy,e.vx):charge.heading;
 const turn=charging?LAST_STAND.turnRate:LAST_STAND.turnRate*1.4;
 const heading=previous+clamp(angleDelta(previous,headingGoal),-turn*dt,turn*dt);
 charge.heading=heading;
 const thrust=charging?LAST_STAND.speed:178;
 const ramp=1-Math.exp(-(charging?4.8:7)*dt);
 e.vx+=(Math.cos(heading)*thrust-e.vx)*ramp;
 e.vy+=(Math.sin(heading)*thrust-e.vy)*ramp;
 e.x+=e.vx*dt;e.y+=e.vy*dt;e.angle=heading+Math.PI/2;
 e.state=charging?'last-stand-charge':'last-stand-windup';
 e._gunAiming=null;e._commsIntent={x:charge.x,y:charge.y,
   mode:charging?'ram-charge':'ram-rally',at:now};
 if(charging&&player?.hp>0&&
    sweptRamHit(oldX,oldY,e.x,e.y,player,e.r+(player.r||0))){
  if(player.invul<=0)game.hurt?.(LAST_STAND.damage,{x:e.x,y:e.y});
  e.hp=0;e.visualDeath=false;
  game.heritage?.vfx?.shipExplosion?.(e.x,e.y,20,'#ff734f');
  e._lastStand=null;
 }
 return true;
}
