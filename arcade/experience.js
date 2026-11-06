import {expForNext, legacyExpForNext} from './balance.js?v=xp-feedback-pass1-1';

// Legacy station saves store the current level and progress within that level.
export const XP_CURVE_VERSION = 2;
export const FIRST_RICH_ASTEROID_XP = 18;

// Every permanent rank or doctrine consumes exactly one level point. This is
// presentation/audit only: old saves must not be silently granted or charged
// points when some historical purchases cannot be reconstructed.
export function developmentPointLedger(state={}){
 const earned=Math.max(0,Math.floor(state.level||1)-1);
 const rankSum=entries=>Object.values(entries||{}).reduce((sum,value)=>
  sum+(Number.isInteger(value)&&value>0?value:0),0);
 const branchSum=entries=>Object.values(entries||{}).reduce((sum,choice)=>
  sum+(Number.isInteger(choice?.rank)&&choice.rank>0?choice.rank:0),0);
 const spent=rankSum(state.skillRanks)+branchSum(state.tactical?.branches)+
  branchSum(state.loadout?.specializations)+(state.doctrine?1:0);
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

// Credit the historical cost difference without losing level or spent points.
// Beyond level 8 both curves have identical step costs, so credit stays bounded.
export function migrateLegacyPlayerExperience(player){
 if(!player || player.xpCurveVersion===XP_CURVE_VERSION ||
  !Number.isInteger(player.level) || player.level<1 ||
  !Number.isFinite(player.xp) || player.xp<0)return 0;
 let credit=0;
 for(let lvl=1;lvl<Math.min(8,player.level);lvl++)
  credit+=legacyExpForNext(lvl)-expForNext(lvl);
 player.xpCurveVersion=XP_CURVE_VERSION;
 return grantExperience(player,credit);
}
