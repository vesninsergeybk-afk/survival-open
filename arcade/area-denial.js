// A local orbit is not an escape: hostile units can throw a timed charge into
// a defended patch of space. The pilot must LEAVE the marked area, not merely
// change heading. Detection uses recent positions, not instantaneous speed.
export const AREA_DENIAL=Object.freeze({
 warmup:55, sampleEvery:.35, history:5.7, exposure:5.1,
 maximumOrbitRadius:185, hostileRange:900, combatMemory:10, cooldown:14,
 blastRadius:215, fuse:2.05, blastDamage:52, hullTransfer:.33,
 fortressSplashFactor:.42
});

export function createAreaDenial(){
 return {samples:[],nextSampleAt:0,nextChargeAt:0};
}

function threateningEnemies(game){
 const p=game.player,r2=AREA_DENIAL.hostileRange**2;
 return (game.enemies||[]).filter(e=>e.hp>0&&!e.converted&&!e.trialRetreatUntil&&
  (e.x-p.x)**2+(e.y-p.y)**2<=r2);
}

export function trackAreaDenial(game){
 const state=game.areaDenial,p=game.player,now=game.time;
 // A squad that has just been shot down can still have transmitted the
 // coordinates. Otherwise an overpowered ship would prevent its own counters
 // merely by killing every nearby target before the sampling window ends.
 const recentFight=now-Math.max(game.combatTempo?.lastContactAt??-Infinity,
  game.lastDamageAt??-Infinity)<=AREA_DENIAL.combatMemory;
 if(!state||!p||now<AREA_DENIAL.warmup||game.contourTrial){
  if(state){state.samples.length=0;state.nextSampleAt=now;}
  return null;
 }
 if(now<state.nextSampleAt)return null;
 state.nextSampleAt=now+AREA_DENIAL.sampleEvery;
 state.samples.push({x:p.x,y:p.y,t:now});
 state.samples=state.samples.filter(s=>now-s.t<=AREA_DENIAL.history);
 if(now<state.nextChargeAt||state.samples.length<3||
    now-state.samples[0].t<AREA_DENIAL.exposure)return null;
 // Sampling continues through brief breaks in combat. Otherwise an advanced
 // ship would be immune by clearing every wave before five seconds elapsed.
 if(!recentFight&&threateningEnemies(game).length===0)return null;
 // Keep the player safe from overlapping independent orbital warnings.
 if((game.zones||[]).some(z=>z.fuse>0&&
   Math.hypot(z.x-p.x,z.y-p.y)<z.r+AREA_DENIAL.blastRadius*.6))return null;
 const x=state.samples.reduce((sum,s)=>sum+s.x,0)/state.samples.length;
 const y=state.samples.reduce((sum,s)=>sum+s.y,0)/state.samples.length;
 if(state.samples.some(s=>Math.hypot(s.x-x,s.y-y)>AREA_DENIAL.maximumOrbitRadius))return null;
 state.samples.length=0;
 state.nextChargeAt=now+AREA_DENIAL.cooldown;
 return {kind:'displacement-mine',x,y,r:AREA_DENIAL.blastRadius,
  fuse:AREA_DENIAL.fuse,fuseStart:AREA_DENIAL.fuse,
  damage:AREA_DENIAL.blastDamage,ttl:.62};
}

// A stationary emplacement is armoured against blast waves. The remaining
// damage still depletes its charged screen and can eventually break the hull.
export function mineDamageAgainstTurret(zone){
 return Math.max(0,(zone?.damage||0)*AREA_DENIAL.fortressSplashFactor);
}
