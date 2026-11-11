import {ENEMY_TYPES} from './ai.js?v=enemy-learning-1-enemy-comms-1-regions-1-enemy-world-response-1-network-defense-4-enemy-audit-5-enemy-gunnery-1-opening-arc-1-enemy-plans-1-theater-1-campaign-1-theater-audit-1-repair-qa-1-mesh-1-tactical-field-2-backbone-2-enemy-fixes-1-mesh-strategy-v2-1-mesh-response-v2-1-radio-retry-1-flux-offense-1-territory-war-1-contour-counterattack-1-first-loops-1-station-ops-2-flux-build-1-support-three-1-triangle-defense-1-growth-1-pressure-response-1-combat-balance-1-territory-logistics-1-redteam-20261109-1-megawing-20261109-1-mote-audit-20261110-1-flux-siphon-roads-1-ai-commander-20261110-pilot-depth-1-corvette-20261110-1-pilot-value-2-hud-merge-20261110-opening-evasion-20261110-turret-defense-20261110-close-threat-20261110-trial-station-defense-20261110-escort-squad-20261110-wingmastery-20261110-xp-audit-20261111';

// Salvage is deliberately less lucrative than focused extraction, but it makes
// short combat-only sorties able to contribute toward a small purchase.
// Serial-based drops cost no RNG and do not add per-frame computation.
export function enemySalvage(enemy){
 if(enemy?.microSwarm)return 0;
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

// Armour grows with world time and strategic threat. XP must follow the
// additional damage required, otherwise late victories pay less for more work.
export function enemyDataReward(enemy){
 if(enemy?.microSwarm)return 2;
 const spec=ENEMY_TYPES[enemy?.type];if(!spec)return 0;
 const health=Math.max(spec.hp,enemy.maxHp||spec.hp);
 return Math.round(spec.score*Math.min(3.5,Math.pow(health/spec.hp,.85)));
}
