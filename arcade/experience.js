import {expForNext,previousExpForNext,legacyExpForNext} from './balance.js?v=xp-feedback-pass1-1-data-economy-20261111';
import {doctrineSpent,normalizedDoctrineRanks} from './pilot-doctrines.js?v=pilot-depth-1-pilot-value-2';

// Legacy station saves store the current level and progress within that level.
export const XP_CURVE_VERSION = 3;
export const FIRST_RICH_ASTEROID_XP = 18;

// Skills cost one point, doctrines cost 1/2/3 points by depth. This ledger is
// presentation/audit only: old saves must not be silently granted or charged
// points when some historical purchases cannot be reconstructed.
export function developmentPointLedger(state={}){
 const earned=Math.max(0,Math.floor(state.level||1)-1)+
  Math.max(0,Math.floor(state.masteryPoints||0));
 const rankSum=entries=>Object.values(entries||{}).reduce((sum,value)=>
  sum+(Number.isInteger(value)&&value>0?value:0),0);
 const branchSum=entries=>Object.values(entries||{}).reduce((sum,choice)=>
  sum+(Number.isInteger(choice?.rank)&&choice.rank>0?choice.rank:0),0);
 const spent=rankSum(state.skillRanks)+branchSum(state.tactical?.branches)+
  branchSum(state.loadout?.specializations)+doctrineSpent(normalizedDoctrineRanks(state));
 const free=Math.max(0,Math.floor(state.points||0));
 return {earned,spent,free,unaccounted:earned-spent-free};
}

export function experienceFromPickup(item){
 return item?.type === 'data' && item.xpGranted !== true && Number.isFinite(item.value)
  ? Math.max(0,item.value) : 0;
}

// Participation must be recent: stationary dock defenses must not auto-level
// a pilot who never engaged the attackers.
export function qualifiesForDirectCombatXp(enemy,now){
 return Number.isFinite(enemy?.lastPlayerHitAt) && Number.isFinite(now) &&
  now>=enemy.lastPlayerHitAt && now-enemy.lastPlayerHitAt<=20;
}

// Returns earned levels; the caller presents sound and HUD feedback.
export function grantExperience(player,amount){
 if(!player || !Number.isFinite(amount) || amount < 0)return 0;
 player.xp+=amount;
 let levels=0;
 while(player.level<1000 && player.xp>=expForNext(player.level)){
  player.xp-=expForNext(player.level);
  player.level++;
  player.points++;
  levels++;
 }
 return levels;
}

// One discovery per run, never XP proportional to alloy or repeated extraction.
export function firstRichAsteroidExperience(player,rock,kind){
 if(!player || kind!=='extract' || !rock?.rich || player.firstRichRockStudied)return 0;
 player.firstRichRockStudied=true;
 return FIRST_RICH_ASTEROID_XP;
}

// Preserve the exact lifetime experience earned under either previous curve.
// Existing skills and unspent points survive; the cheaper current curve may
// legitimately grant several new levels to a veteran pilot on first restore.
export function migrateLegacyPlayerExperience(player){
 if(!player || player.xpCurveVersion===XP_CURVE_VERSION ||
  !Number.isInteger(player.level) || player.level<1 ||
  !Number.isFinite(player.xp) || player.xp<0)return 0;
 const previous=player.xpCurveVersion===2?previousExpForNext:legacyExpForNext;
 let credit=0;
 for(let lvl=1;lvl<player.level;lvl++){
  const difference=previous(lvl)-expForNext(lvl);
  if(!Number.isFinite(difference))return 0;
  credit+=difference;
 }
 if(!Number.isFinite(credit))return 0;
 player.xpCurveVersion=XP_CURVE_VERSION;
 return grantExperience(player,credit);
}
