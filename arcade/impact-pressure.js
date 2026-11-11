// A single crowd volley must not instantly destroy the hull, but maintaining
// position under fire must eventually exhaust even a heavily upgraded ship.
// Grace-period contacts consume a little shield; consecutive *real* hits
// impose a short-lived impact load on both shield and hull.
export const IMPACT_PRESSURE=Object.freeze({
 window:5,
 maxStacks:3,
 bonusPerStack:.20,
 grazeFraction:.18,
 grazeLimit:3.5,
 grazeCooldown:.24
});

export function impactPressureLevel(state,now){
 if(!state||!Number.isFinite(now)||!Number.isFinite(state.lastHitAt)||
  now-state.lastHitAt>IMPACT_PRESSURE.window)return 0;
 return Math.max(0,Math.min(IMPACT_PRESSURE.maxStacks,state.stacks||0));
}

export function registerImpact(game,now){
 const prev=game.impactPressure||{};
 const stacks=Math.min(IMPACT_PRESSURE.maxStacks,
  impactPressureLevel(prev,now)+1);
 game.impactPressure={...prev,stacks,lastHitAt:now};
 // The first hit is always unchanged, regardless of ship upgrades.
 return 1+(stacks-1)*IMPACT_PRESSURE.bonusPerStack;
}

export function shieldGrazeInGrace(game,damage,now){
 const shield=game.player?.shield||0,prev=game.impactPressure||{};
 if(shield<=0||!Number.isFinite(damage)||damage<=0||
  !Number.isFinite(now)||now<(prev.nextGrazeAt??-Infinity))return 0;
 const spent=Math.min(shield,IMPACT_PRESSURE.grazeLimit,
  damage*IMPACT_PRESSURE.grazeFraction);
 if(spent<=0)return 0;
 game.player.shield=Math.max(0,shield-spent);
 game.impactPressure={...prev,nextGrazeAt:now+IMPACT_PRESSURE.grazeCooldown};
 return spent;
}
