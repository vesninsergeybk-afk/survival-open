/** Local observations travel through a real, bounded mesh. No receiver may
 * learn a target coordinate merely by belonging to the same squad. */
import {activeStationGarrisons} from './station-garrisons.js';
export const MICRO_RADIO=Object.freeze({range:680,delay:.13,speed:1800,
 maxHops:5,ttl:4.5,maxPending:160,repeat:1.1,visual:.75});

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=e=>!!e&&e.hp>0&&!e.converted;

/** Only the real player and living, physically attackable friendly structures
 * belong here. The actual projectile collision system resolves the hit. */
export function microDroneTargets(game){
 if(game._microTargetsAt===game.time&&Array.isArray(game._microTargets))
  return game._microTargets;
 const result=[];
 if(game.player?.hp>0)result.push({key:'player',kind:'player',unit:game.player});
 for(const a of game.allies||[])if(alive(a))
  result.push({key:'ally:'+a.serial,kind:'ally',unit:a});
 for(const [name,items] of [
  ['artillery',game.world?.contours?.artillery||[]],
  ['support',game.world?.contours?.supportTurrets||[]]]){
  for(let i=0;i<items.length;i++){
   const t=items[i];if(!alive(t)||t.readyAt>game.time)continue;
   result.push({key:name+':'+(t.id??i),kind:'turret',unit:t});
  }
 }
 for(const {station,garrison} of activeStationGarrisons(game)){
  if(alive(garrison))result.push({key:'garrison:'+station.id,
   kind:'turret',unit:garrison});
  for(const drone of garrison.drones||[])if(alive(drone))
   result.push({key:'garrison-drone:'+station.id+':'+drone.slot,
    kind:'ally',unit:drone});
 }
 for(const mission of game.support?.missions||[])
  for(const craft of mission.craft||[])if(alive(craft))
   result.push({key:'craft:'+(mission.base?.id||'cover')+':'+(craft.serial??craft.lane),
    kind:'craft',unit:craft});
 game._microTargets=result;game._microTargetsAt=game.time;
 return result;
}

export function microDroneTarget(game,intel){
 if(!intel?.key)return null;
 return microDroneTargets(game).find(t=>t.key===intel.key)||null;
}

/** Picking a target must be based exclusively on this drone's actual LOS. */
export function microDroneObservation(e,game,candidates,range=600){
 let best=null,score=-Infinity;
 for(const target of candidates){
  if(!alive(target.unit))continue;
  const d=distance(e,target.unit);
  if(d>range||!game.enemyCanSee?.(e,target.unit))continue;
  const role=e.microDrone;
  if(role==='blade'&&target.kind!=='player'&&target.kind!=='ally')continue;
  const priority=target.kind==='player'?94:target.kind==='ally'?70:53;
  const bonus=target.kind==='turret'&&['missile','assault','disruptor'].includes(role)?42:
   target.kind==='ally'&&['blade','hunter'].includes(role)?25:
   target.kind==='player'&&['interceptor','stealth'].includes(role)?18:0;
  const value=priority+bonus-d*.055;
  if(value>score){score=value;best={key:target.key,kind:target.kind,
   x:target.unit.x,y:target.unit.y,vx:target.unit.vx||0,
   vy:target.unit.vy||0,at:game.time};}
 }
 return best;
}

export function microRadioInit(wing){
 wing.radioPending??=[];wing.radioSerial??=0;wing.radioEvents??=[];
 wing.radioInFlight??=new Set();
}

function receive(wing,e,packet,now){
 if(!Array.isArray(e._microSeenPackets))e._microSeenPackets=[];
 if(e._microSeenPackets.includes(packet.id))return false;
 if(e._microSeenPackets.length>110)e._microSeenPackets.length=0;
 e._microSeenPackets.push(packet.id);
 if(packet.kind==='contact'){
  if(!e.microIntel||packet.data.at>=e.microIntel.at)e.microIntel={...packet.data};
 }else if(packet.kind==='order'){
  if(!e.microOrder||packet.data.at>=e.microOrder.at)e.microOrder={...packet.data};
 }else if(packet.kind==='loss'){
  if(!Array.isArray(e.microKnownLosses))e.microKnownLosses=[];
  if(!e.microKnownLosses.includes(packet.data.serial))e.microKnownLosses.push(packet.data.serial);
 }else if(packet.kind==='threat'){
  e.microThreatReports??=[];
  e.microThreatReports.push({...packet.data,at:now});
  if(e.microThreatReports.length>14)e.microThreatReports.shift();
 }
 return true;
}

function sendToNeighbors(wing,from,packet,now,hops){
 if(hops>=MICRO_RADIO.maxHops||now-packet.at>MICRO_RADIO.ttl)return;
 for(const to of wing.members){
  if(to===from||!alive(to)||to._microSeenPackets?.includes(packet.id))continue;
  const d=distance(from,to);
  if(d>MICRO_RADIO.range)continue;
  const key=packet.id+':'+to.serial;
  if(wing.radioInFlight.has(key))continue;
  if(wing.radioPending.length>=MICRO_RADIO.maxPending)break;
  wing.radioInFlight.add(key);
  wing.radioPending.push({from,to,packet,hops:hops+1,
   key,due:now+MICRO_RADIO.delay+d/MICRO_RADIO.speed});
 }
}

export function microRadioPublish(wing,from,kind,data,now){
 if(!alive(from))return false;
 microRadioInit(wing);
 const packet={id:++wing.radioSerial,kind,data,at:now};
 receive(wing,from,packet,now);
 sendToNeighbors(wing,from,packet,now,0);
 return true;
}

export function microRadioAdvance(wing,now){
 microRadioInit(wing);
 const queued=wing.radioPending;
 wing.radioPending=[];
 for(const message of queued){
  if(message.due>now){wing.radioPending.push(message);continue;}
  wing.radioInFlight.delete(message.key);
  const {to,from,packet,hops}=message;
  if(!alive(to)||now-packet.at>MICRO_RADIO.ttl||
     distance(from,to)>MICRO_RADIO.range*1.16)continue;
  if(!receive(wing,to,packet,now))continue;
  wing.radioEvents.push({from,to,kind:packet.kind,at:now});
  sendToNeighbors(wing,to,packet,now,hops);
 }
 wing.radioPending=wing.radioPending.slice(-MICRO_RADIO.maxPending);
 wing.radioEvents=wing.radioEvents.filter(ev=>now-ev.at<MICRO_RADIO.visual).slice(-12);
}
