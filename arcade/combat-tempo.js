// Quiet is earned by surviving an encounter, not by parking at a friendly base.
// Scenario assaults, mining-noise investigations and paid raids remain separate.
export const TEMPO=Object.freeze({startAt:175,localRadius:850,combatMemory:5,
 minQuiet:12,maxQuiet:22,maxLocalThreats:1});
export const createCombatTempo=()=>({version:1,lastContactAt:-1000,
 quietUntil:0,quietArmed:false,encounters:0});
export function recordCombatContact(game){
 if(game.combatTempo){game.combatTempo.lastContactAt=game.time;
  if(game.time>=TEMPO.startAt)game.combatTempo.quietArmed=true;}
}
export function ambientTempoPlan(game,director,random=Math.random){
 if(game.time<TEMPO.startAt)return {mode:'normal',delay:0,director};
 const s=game.combatTempo;
 if(!s)return {mode:'normal',delay:0,director};
 const local=game.enemies.filter(e=>e.hp>0&&!e.converted&&!e.regionalCargo&&
  Math.hypot(e.x-game.player.x,e.y-game.player.y)<TEMPO.localRadius).length;
 if(local>=TEMPO.maxLocalThreats){s.quietArmed=true;return {mode:'wait',delay:4};}
 if(s.quietArmed&&game.time-s.lastContactAt<24){
  s.quietUntil=Math.max(s.quietUntil,game.time+TEMPO.minQuiet+
   random()*(TEMPO.maxQuiet-TEMPO.minQuiet));
  s.quietArmed=false;
 }
 if(s.quietArmed&&game.time-s.lastContactAt>=24)s.quietArmed=false;
 if(game.time<s.quietUntil)return {mode:'wait',delay:Math.min(5,s.quietUntil-game.time)};
 s.encounters++;
 // A small eye swarm offers XP and a chance to charge a raid consumable.
 // Powerful ships arrive less frequently, but still require positioning.
 if(s.encounters%3===1){
  return {mode:'flock',delay:0,director:{...director,
   types:['scout'],groupSize:Math.min(6,Math.max(4,director.groupSize+1)),
   cap:Math.min(28,director.cap)}};
 }
 return {mode:'normal',delay:0,director:{...director,
  groupSize:Math.min(5,director.groupSize),cap:Math.min(34,director.cap)}};
}
export function validCombatTempo(s,time){
 if(s===undefined)return true;
 return !!s&&s.version===1&&typeof s.quietArmed==='boolean'&&
  Number.isFinite(s.lastContactAt)&&s.lastContactAt>=-1000&&s.lastContactAt<=time&&
  Number.isFinite(s.quietUntil)&&s.quietUntil>=0&&s.quietUntil<=time+TEMPO.maxQuiet&&
  Number.isInteger(s.encounters)&&s.encounters>=0&&s.encounters<=1e8;
}
