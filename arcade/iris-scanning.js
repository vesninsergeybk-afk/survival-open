/** I.R.I.S. sight and scan state. Detection uses the game's real line of sight.
 * The scan changes movement: the enemy stops, remembers the contact, then
 * searches its last observed location instead of tracking an unseen player.
 * Existing extraction patrols keep their own shared signal-intelligence AI. */
export const IRIS_SCAN=Object.freeze({
  stop:1.08,open:.48,hold:.61,close:.46,
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
  e._irisScanUntil=now+IRIS_SCAN.stop;
  e._irisScanCooldown=now+2.1+(Math.abs(e.serial||0)%4)*.14;
  return true;
}

/** Called once per physics update, after updating group signal intelligence.
 * Returns true when this scout is holding still to scan. */
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
    const visible=distance<=290&&
      (game.enemyCanSee?.(e,player)??true);
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
    // Fast, smooth braking: less than a few world units of drift.
    const brake=Math.exp(-22*dt);
    e.vx=(e.vx||0)*brake;e.vy=(e.vy||0)*brake;
    if(Math.hypot(e.vx,e.vy)<1)e.vx=e.vy=0;
    e.x+=e.vx*dt;e.y+=e.vy*dt;
    return true;
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
