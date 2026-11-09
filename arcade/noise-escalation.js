import {MINING_NOISE} from './mining.js?v=pressure-response-1';

/** Mining draws an investigating wing. A scout must actually spot the pilot,
 * survive a visible withdrawal, and escape before reinforcements are called.
 * All positions are last-known signals, never a hidden live player target. */
export const NOISE_ESCALATION=Object.freeze({
 initialWing:7,reinforcementWing:11,patrolCooldown:19,
 reportDelay:1.8,reinforcementDelay:5.5,escapeDistance:1050,
 escapeSpeed:260
});

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// A pilot can finish the first extraction before patrols are permitted to
// spawn. Preserve that *historical* acoustic report so decay cannot erase
// the consequence; quiet extraction must still stay below the same threshold.
export function preserveEarlyNoiseSignal(previous,noise,source,time){
 if(previous||!source||time>=MINING_NOISE.firstPatrolAt||
    noise<MINING_NOISE.scout)return previous;
 return {x:source.x,y:source.y};
}
export function noisePatrolDirector(director,liveCount=0,reinforcement=false){
 const size=reinforcement?NOISE_ESCALATION.reinforcementWing:NOISE_ESCALATION.initialWing;
 return {...director,
  // Noise contacts are an exception to the quiet early ambient traffic cap.
  // Still honour the world's hard maximum inside spawnGroup.
  cap:Math.max(director.cap||0,liveCount+size),groupSize:size,
  types:reinforcement?['scout','fighter','flanker']:['scout','fighter']};
}

export function armNoiseCourier(game,created,source){
 if(game.noiseEscalation||!created?.length)return false;
 const courier=created.find(e=>e.type==='scout'&&e.hp>0);
 if(!courier)return false;
 courier.noiseCourier=true;
 game.noiseEscalation={phase:'searching',serial:courier.serial,
  source:{x:source.x,y:source.y}};
 return true;
}

export function updateNoiseEscalation(game){
 const state=game.noiseEscalation;
 if(!state||game.dead||game.paused)return;
 if(state.phase==='reinforcement'){
  if(game.time<state.at||game.contourTrial)return;
  const before=game.enemies.length;
  const alarm=game.sectorDirector({cap:Math.max(8,before+NOISE_ESCALATION.reinforcementWing),
   groupSize:NOISE_ESCALATION.reinforcementWing,types:['scout','fighter','flanker'],interval:5});
  game.spawnGroup(noisePatrolDirector(alarm,before,true),state.source);
  if(game.enemies.length===before){state.at=game.time+3;return;}
  game.notice?.('ПОДКРЕПЛЕНИЕ ПРИБЫЛО! Связной привёл новую эскадрилью к последней известной позиции.',5);
  game.noiseEscalation=null;
  return;
 }
 const courier=game.enemies.find(e=>e.serial===state.serial);
 if(!courier||courier.hp<=0||courier.converted){
  if(state.phase!=='searching')game.notice?.('Связной уничтожен. Подкрепление не придёт!',4);
  game.noiseEscalation=null;return;
 }
 if(state.phase==='searching'){
  // Taking blind fire can mark an estimated signal as "engaged". An actual
  // scout report requires a verified sighting of the pilot or a relayed
  // visual contact, never a guessed impact location or another target.
  if(courier.signalIntel?.mode!=='engaged'||
     courier.signalIntel.combatFocus!==game.player||
     courier.signalIntel.lastSeenEstimated)return;
  state.phase='reporting';state.at=game.time+NOISE_ESCALATION.reportDelay;
  state.source={x:courier.signalIntel.lastSeenX,y:courier.signalIntel.lastSeenY};
  game.notice?.('РАЗВЕДКА ЗАМЕТИЛА ВАС! Связной готовит вызов подкрепления. Перехватите его!',5);
  return;
 }
 if(state.phase==='reporting'&&game.time>=state.at){
  state.phase='escaping';
  // The outgoing route is fixed once; evading it is meaningful and visible.
  const dx=courier.x-state.source.x,dy=courier.y-state.source.y;
  const length=Math.hypot(dx,dy)||1;
  const side=length>20?{x:dx/length,y:dy/length}:
   {x:Math.cos(courier.serial*2.4),y:Math.sin(courier.serial*2.4)};
  state.exit={x:courier.x+side.x*NOISE_ESCALATION.escapeDistance,
   y:courier.y+side.y*NOISE_ESCALATION.escapeDistance};
  courier.missionFlight={...state.exit,speed:NOISE_ESCALATION.escapeSpeed};
  courier.noiseCourierEscaping=true;
  game.notice?.('СВЯЗНОЙ УХОДИТ! Догоните разведчика, иначе он приведёт большую эскадру.',5);
 }
 if(state.phase==='escaping'&&distance(courier,state.exit)<55){
  // An escaped ship isn't a combat kill and must never grant loot or XP.
  courier.noiseCourierEscaped=true;
  game.enemies=game.enemies.filter(e=>e!==courier);
  game.noiseEscalation={phase:'reinforcement',serial:state.serial,
   source:state.source,at:game.time+NOISE_ESCALATION.reinforcementDelay};
  game.notice?.('РАДИОПЕРЕХВАТ: разведчик передал координаты. Подкрепление уже в пути!',5);
 }
}
