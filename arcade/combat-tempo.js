// Quiet is earned by surviving an encounter, not by parking at a friendly base.
// Scenario assaults, mining-noise investigations and paid raids remain separate.
export const TEMPO=Object.freeze({startAt:175,earlyStartAt:48,localRadius:850,combatMemory:5,
 earlyMinQuiet:5,earlyMaxQuiet:8,minQuiet:12,maxQuiet:22,maxLocalThreats:1});
export const createCombatTempo=()=>({version:1,lastContactAt:-1000,
 quietUntil:0,quietArmed:false,encounters:0});
export function recordCombatContact(game){
 if(game.combatTempo){game.combatTempo.lastContactAt=game.time;
  if(game.time>=TEMPO.earlyStartAt)game.combatTempo.quietArmed=true;}
}
export function ambientTempoPlan(game,director,random=Math.random){
 if(game.time<TEMPO.earlyStartAt)return {mode:'normal',delay:0,director};
 const s=game.combatTempo;
 if(!s)return {mode:'normal',delay:0,director};
 const local=game.enemies.filter(e=>e.hp>0&&!e.converted&&!e.regionalCargo&&
  Math.hypot(e.x-game.player.x,e.y-game.player.y)<TEMPO.localRadius).length;
 if(local>=TEMPO.maxLocalThreats){s.quietArmed=true;return {mode:'wait',delay:4};}
 if(s.quietArmed&&game.time-s.lastContactAt<24){
  const early=game.time<TEMPO.startAt;
  const minimum=early?TEMPO.earlyMinQuiet:TEMPO.minQuiet;
  const maximum=early?TEMPO.earlyMaxQuiet:TEMPO.maxQuiet;
  s.quietUntil=Math.max(s.quietUntil,game.time+minimum+
   random()*(maximum-minimum));
  s.quietArmed=false;
 }
 if(s.quietArmed&&game.time-s.lastContactAt>=24)s.quietArmed=false;
 if(game.time<s.quietUntil)return {mode:'wait',delay:Math.min(5,s.quietUntil-game.time)};
 if(game.time<TEMPO.startAt)return {mode:'normal',delay:0,director};
 s.encounters++;
 // A small eye swarm offers XP and a chance to charge a raid consumable.
 // Powerful ships arrive less frequently, but still require positioning.
 if(s.encounters%3===1){
  return {mode:'flock',delay:0,director:{...director,
   types:['scout'],groupSize:Math.min(8,Math.max(4,director.groupSize+1)),
   cap:Math.min(director.cap,Math.max(28,Math.ceil(director.cap*.72)))}};
 }
 return {mode:'normal',delay:0,director:{...director,
  groupSize:Math.min(7,director.groupSize),
  cap:Math.min(director.cap,Math.max(34,Math.ceil(director.cap*.85)))}};
}
export function validCombatTempo(s,time){
 if(s===undefined)return true;
 return !!s&&s.version===1&&typeof s.quietArmed==='boolean'&&
  Number.isFinite(s.lastContactAt)&&s.lastContactAt>=-1000&&s.lastContactAt<=time&&
  Number.isFinite(s.quietUntil)&&s.quietUntil>=0&&s.quietUntil<=time+TEMPO.maxQuiet&&
  Number.isInteger(s.encounters)&&s.encounters>=0&&s.encounters<=1e8;
}
