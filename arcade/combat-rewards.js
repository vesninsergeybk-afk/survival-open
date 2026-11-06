import {ENEMY_TYPES} from './ai.js?v=enemy-learning-1-enemy-comms-1-regions-1-enemy-world-response-1-network-defense-4-enemy-audit-5-enemy-gunnery-1-opening-arc-1-enemy-plans-1-theater-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-tactical-field-2-backbone-2-enemy-fixes-1-mesh-strategy-v2-1-mesh-response-v2-1-radio-retry-1-flux-offense-1';

// Salvage is deliberately less lucrative than focused extraction, but it makes
// short combat-only sorties able to contribute toward a small purchase.
// Serial-based drops cost no RNG and do not add per-frame computation.
export function enemySalvage(enemy){
 const serial=Math.abs(Math.trunc(enemy?.serial||0));
 switch(enemy?.type){
  case 'scout':return serial%4===0?1:0;
  case 'fighter':return serial%3===0?1:0;
  case 'flanker':case 'berserker':return serial%2===0?1:0;
  case 'healer':return 1;
  case 'gunship':return 2;
  default:return 0;
 }
}

// Armour grows with world time. Reward some of that extra work while keeping
// XP growth below the health multiplier and preserving the early unlock rhythm.
export function enemyDataReward(enemy){
 const spec=ENEMY_TYPES[enemy?.type];if(!spec)return 0;
 const health=Math.max(spec.hp,enemy.maxHp||spec.hp);
 return Math.round(spec.score*Math.min(1.8,Math.sqrt(health/spec.hp)));
}
