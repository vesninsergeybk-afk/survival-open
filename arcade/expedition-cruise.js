// Long interregional flights should take less real time without disabling the
// survival clock. Cruise is a movement bonus only in open, calm space; it is
// never an invulnerability frame, fast travel, or a source of resources.
export const EXPEDITION_CRUISE=Object.freeze({
 warmup:2.2,multiplier:2.15,arrivalDistance:2200,
 hostileDistance:1100,stationDistance:900,stormDistance:260,
 minimumInput:.8,alignment:.82
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function cruiseSafe(game,mx,my){
 const p=game.player,goal=game.waypoint,c=EXPEDITION_CRUISE;
 const friendly=game.world?.stations?.get(goal?.id);
 if(!(goal?.id?.startsWith('region-')||friendly?.discovered&&!friendly.enemy)||
  !p||!Number.isFinite(goal.x)||!Number.isFinite(goal.y)||
  game.operation||game.mining?.active||game.holdFire||p.burstRemaining>0||
  (game.time-(game.lastDamageAt??-Infinity))<4)return false;
 const d=distance(p,goal),m=Math.hypot(mx,my);
 if(d<c.arrivalDistance||m<c.minimumInput||
  (mx*(goal.x-p.x)+my*(goal.y-p.y))/Math.max(.01,m*d)<c.alignment)return false;
 if(game.enemies?.some(e=>e.hp>0&&!e.converted&&distance(p,e)<c.hostileDistance)||
  game.shots?.some(s=>s.alive&&distance(p,s)<c.hostileDistance)||
  game.zones?.some(z=>z.fuse>0&&distance(p,z)<(z.r||0)+c.stormDistance)||
  game.regionalStormFields?.some(f=>distance(p,f)<f.r+c.stormDistance)||
  game.world?.nearbyStations?.(p.x,p.y,c.stationDistance,true)?.some(b=>b.enemy&&!b.captured))return false;
 return true;
}

export function updateCruise(game,mx,my,dt){
 const before=!!game.cruising;
 game.cruiseCharge=cruiseSafe(game,mx,my)?
  Math.min(EXPEDITION_CRUISE.warmup,(game.cruiseCharge||0)+dt):0;
 game.cruising=game.cruiseCharge>=EXPEDITION_CRUISE.warmup;
 return !before&&game.cruising;
}
