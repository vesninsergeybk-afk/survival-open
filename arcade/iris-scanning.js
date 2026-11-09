/** I.R.I.S. sight and scan state. Detection uses the game's real line of sight.
 * During the scan the drone follows an inertial, evasive arc around its last
 * contact, then accelerates out of the scan with a brief sideways burst.
 * Existing extraction patrols keep their own shared signal-intelligence AI. */
import {irisCanSense,IRIS_SWARM} from './iris-swarm.js?v=iris-swarm-2-pressure-response-1-combat-balance-1';
export const IRIS_SCAN=Object.freeze({
  sweep:1.08,open:.48,hold:.61,close:.46,
  cruise:94,maxScanSpeed:190,acceleration:265,evadeAcceleration:345,
  burstSeconds:1.05,burstStrength:.62,
  forgetDelay:.78,searchSeconds:4.6
});

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=t=>{const p=clamp(t,0,1);return p*p*(3-2*p);};

/** 0..1 physical jaw extension, sampled from simulation time (not FPS). */
export function irisScanExtension(time,started,reducedMotion=false){
  const t=time-started;
  if(!Number.isFinite(t)||t<0||t>IRIS_SCAN.open+IRIS_SCAN.hold+IRIS_SCAN.close)return 0;
  if(reducedMotion)return 1;
  if(t<IRIS_SCAN.open)return smooth(t/IRIS_SCAN.open);
  if(t<IRIS_SCAN.open+IRIS_SCAN.hold)return 1;
  return 1-smooth((t-IRIS_SCAN.open-IRIS_SCAN.hold)/IRIS_SCAN.close);
}

function beginScan(e,game,kind){
  const now=game.time;
  if(now<(e._irisScanUntil??0)){
    if(e._irisScanMode!==kind)e._irisPendingScan=kind;
    return false;
  }
  if(now<(e._irisScanCooldown??0)&&e._irisScanMode===kind)return false;
  e._irisScanMode=kind;
  e._irisScanStarted=now;
  e._irisScanUntil=now+IRIS_SCAN.sweep;
  e._irisBurstUntil=0;
  const intelligence=e.signalIntel;
  const anchorX=intelligence?.lastSeenX??e._irisLastSeenX;
  const anchorY=intelligence?.lastSeenY??e._irisLastSeenY;
  e._irisScanAnchorX=Number.isFinite(anchorX)?anchorX:game.player.x;
  e._irisScanAnchorY=Number.isFinite(anchorY)?anchorY:game.player.y;
  const radialX=e.x-e._irisScanAnchorX,radialY=e.y-e._irisScanAnchorY;
  const tangentDot=radialY*(e.vx||0)-radialX*(e.vy||0);
  // Continue on the side closest to the incoming trajectory, not the side
  // of a freshly randomized reversal. Stable serials disperse the swarm.
  e._irisScanSide=Math.abs(tangentDot)>300?
    (tangentDot>0?-1:1):(Math.abs(e.serial||0)%2===0?1:-1);
  e._irisScanCooldown=now+2.1+(Math.abs(e.serial||0)%4)*.14;
  return true;
}

/** The scanning ship flies a controlled curve. The acceleration cap keeps
 * speed and direction continuous across any frame rate; incoming missiles or
 * damage trigger a small outward dodge without canceling the scan animation. */
function flyScanningArc(e,game,dt){
  const now=game.time,serial=Math.abs(Math.trunc(e.serial||0));
  const dx=e.x-e._irisScanAnchorX,dy=e.y-e._irisScanAnchorY;
  const distance=Math.hypot(dx,dy);
  const rx=distance>1?dx/distance:Math.cos(serial*2.4);
  const ry=distance>1?dy/distance:Math.sin(serial*2.4);
  const side=e._irisScanSide||1;
  const tx=-ry*side,ty=rx*side;
  const age=Math.max(0,now-e._irisScanStarted);
  // Orbit outside point-blank range; never make a stationary bullseye.
  const desiredTangential=IRIS_SCAN.cruise+(serial%5)*6;
  let desiredRadial=clamp((135-distance)*.46,-69,56)+
    Math.sin(age*6+serial*.77)*14;
  let threatened=(e.hit||0)>.025;
  if(!threatened&&game.missiles?.length){
    for(const missile of game.missiles){
      if(missile.target===e&&missile.life>0&&
          Math.hypot(missile.x-e.x,missile.y-e.y)<165){
        threatened=true;break;
      }
    }
  }
  if(threatened&&now>=(e._irisScanEvadeCooldown??0)){
    e._irisScanEvadeStarted=now;
    e._irisScanEvadeUntil=now+.42;
    e._irisScanEvadeCooldown=now+1.2;
  }
  const evade=now<(e._irisScanEvadeUntil??0);
  if(evade){
    const phase=clamp((now-e._irisScanEvadeStarted)/.42,0,1);
    desiredRadial+=115*Math.sin(Math.PI*phase);
  }
  const avoid=game.avoidance?.(e.x,e.y,38)||{x:0,y:0};
  let wantX=tx*desiredTangential+rx*desiredRadial+avoid.x*180;
  let wantY=ty*desiredTangential+ry*desiredRadial+avoid.y*180;
  // Limit commanded thrust, never snap an already moving ship to a cap.
  const wantedSpeed=Math.hypot(wantX,wantY);
  if(wantedSpeed>IRIS_SCAN.maxScanSpeed){
    wantX=wantX/wantedSpeed*IRIS_SCAN.maxScanSpeed;
    wantY=wantY/wantedSpeed*IRIS_SCAN.maxScanSpeed;
  }
  const differenceX=wantX-(e.vx||0),differenceY=wantY-(e.vy||0);
  const magnitude=Math.hypot(differenceX,differenceY);
  const maxDelta=(evade?IRIS_SCAN.evadeAcceleration:IRIS_SCAN.acceleration)*
    Math.max(0,dt);
  const fraction=magnitude>maxDelta&&magnitude>0?maxDelta/magnitude:1;
  e.vx=(e.vx||0)+differenceX*fraction;
  e.vy=(e.vy||0)+differenceY*fraction;
  e.x+=e.vx*dt;e.y+=e.vy*dt;
  if(Math.hypot(e.vx,e.vy)>12)
    e.angle=Math.atan2(e.vy,e.vx)+Math.PI/2;
}

/** Smooth 1→1.62→1 speed multiplier, applied through the normal steering
 * solver: the post-scan burst accelerates instead of jumping velocity. */
export function irisBurstThrust(e,now){
  const elapsed=now-(e._irisBurstStarted??-Infinity);
  if(elapsed<0||elapsed>=IRIS_SCAN.burstSeconds)return 1;
  return 1+IRIS_SCAN.burstStrength*
    Math.sin(Math.PI*elapsed/IRIS_SCAN.burstSeconds);
}

/** Extra sideways thrust (scaled by ordinary scout speed) after a scan. */
export function irisBurstJink(e,now){
  const elapsed=now-(e._irisBurstStarted??-Infinity);
  if(elapsed<0||elapsed>=IRIS_SCAN.burstSeconds)return 0;
  const phase=elapsed/IRIS_SCAN.burstSeconds;
  return (e._irisScanSide||1)*.37*Math.sin(Math.PI*phase);
}

/** Called once per physics update, after updating group signal intelligence.
 * Returns true when this scout is flying its scanning arc. */
export function updateIrisPerception(e,game,dt){
  if(e.type!=='scout'||e.converted||e.boss||e.missionStructure)return false;
  const now=game.time, intel=e.signalIntel;
  if(intel){
    // Signal patrols can engage the player's allies as well. A drone shot
    // must not freeze the patrol in a player-search animation or make it
    // forget the attacker. Track actual player contact, not group alert mode.
    const playerContact=intel.mode==='engaged'&&intel.combatFocus===game.player;
    const hadPlayerContact=!!e._irisTrackedPlayer;
    e._irisTrackedPlayer=playerContact;
    if(playerContact&&!hadPlayerContact)beginScan(e,game,'acquire');
    if(hadPlayerContact&&!playerContact&&intel.mode==='search')
      beginScan(e,game,'lost');
  }else if(now>=(e._irisNextSenseAt??0)){
    const player=game.player;
    const distance=Math.hypot(e.x-player.x,e.y-player.y);
    // In real gameplay enemyCanSee tests forward angle and asteroid cover.
    const visible=distance<=IRIS_SWARM.sensorRange&&
      irisCanSense(e,game,player);
    e._irisNextSenseAt=now+.24+(Math.abs(e.serial||0)%4)*.035;
    if(visible){
      e._irisLastSeenX=player.x;e._irisLastSeenY=player.y;
      e._irisLastSeenAt=now;
      if(!e._irisHasSight){
        e._irisHasSight=true;e._irisSearchingUntil=0;
        beginScan(e,game,'acquire');
      }
    }else if(e._irisHasSight&&now-(e._irisLastSeenAt??now)>IRIS_SCAN.forgetDelay){
      e._irisHasSight=false;
      e._irisLostAt=now;
      e._irisSearchingUntil=now+IRIS_SCAN.searchSeconds;
      beginScan(e,game,'lost');
    }
  }
  if(e._irisPendingScan&&now>=(e._irisScanUntil??0)){
    const next=e._irisPendingScan;e._irisPendingScan=null;
    beginScan(e,game,next);
  }
  if(now<(e._irisScanUntil??0)){
    // Actual damage interrupts the scouting arc; the open shell keeps its
    // warning animation while the ordinary flight solver handles escape.
    // A physical hit interrupts scanning, so the ordinary dodge activates.
    // Missiles keep the specialized outward scan-evade arc in flyScanningArc.
    if(now<(e._irisRetreatUntil||0)||(e.hit||0)>.025)return false;
    flyScanningArc(e,game,dt);
    return true;
  }
  if(Number.isFinite(e._irisScanStarted)&&
     e._irisBurstTriggeredAt!==e._irisScanStarted&&
     now-(e._irisScanUntil??0)<.25){
    e._irisBurstTriggeredAt=e._irisScanStarted;
    e._irisBurstStarted=now;
    e._irisBurstUntil=now+IRIS_SCAN.burstSeconds;
  }
  return false;
}

/** Ordinary scouts examine remembered coordinates for a few seconds after LOS
 * is lost. Extraction patrols use their existing search/withdraw route. */
export function irisSearchGoal(e,game){
  if(e.signalIntel||e._irisHasSight||
     !(game.time<(e._irisSearchingUntil??0))||
     !Number.isFinite(e._irisLastSeenX))return null;
  const elapsed=Math.max(0,game.time-(e._irisLostAt??game.time));
  const angle=elapsed*.9+(Math.abs(e.serial||0)%7)*.79;
  const radius=Math.min(95,elapsed*22);
  return {x:e._irisLastSeenX+Math.cos(angle)*radius,
    y:e._irisLastSeenY+Math.sin(angle)*radius};
}
