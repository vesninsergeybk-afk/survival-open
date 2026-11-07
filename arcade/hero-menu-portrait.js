import {shipArtStage} from './ship-loadout.js';

// The station terminal, equipment screen and development tree must show the
// same stage and severe-damage artwork as the player's in-flight sprite.
export function heroMenuPortrait(level = 1, hp = 1, maxHp = 1) {
 const stage = shipArtStage(level) + 1;
 const health = Number(hp);
 const maxHealth = Number(maxHp);
 const damaged = Number.isFinite(health) && Number.isFinite(maxHealth) &&
  maxHealth > 0 && health / maxHealth < .4;
 return '../assets/space/hero-evolution/ship_' + String(stage).padStart(2, '0') +
  (damaged ? '_damaged' : '') + '.webp';
}
