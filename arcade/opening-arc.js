// A short, optional first-sector dilemma. The two responses share one reward,
// but change the local threat in opposite ways. The arc is data-only so a
// station checkpoint can restore it without creating duplicate enemies.
export const OPENING_ARC=Object.freeze({
 offerAt:16,deadline:155,repairSeconds:3.5,repairRange:155,
 interceptRewardData:27,interceptRewardOre:8,
 rescueRewardOre:28,rescueRewardXp:18,rescueShield:35,
 interceptRelief:120,rescueAlarm:100,
 rescuePulseProgress:.5,rescuePulseRadius:300,rescuePulseShield:18,
 localRadius:2600
});

export function createOpeningArc(home){
 return {version:1,status:'offer',kind:null,startedAt:0,expiresAt:0,
  commanderSerial:null,commanderDefeated:false,commanderDefeatedAt:null,repair:0,
  rescuePulseUsed:false,
  rescueX:home.x-755,rescueY:home.y+670,
  interceptX:home.x+625,interceptY:home.y-500,
  reliefUntil:0,alarmUntil:0,returnWaypoint:null};
}

export const openingArcActive=arc=>arc?.status==='active';

export function beginOpeningArc(arc,kind,now){
 if(arc?.status!=='offer'||!['intercept','rescue'].includes(kind))return false;
 arc.status='active';arc.kind=kind;arc.startedAt=now;
 arc.expiresAt=now+OPENING_ARC.deadline;return true;
}

export function recordOpeningCommanderDefeat(arc,enemy,now){
 if(!openingArcActive(arc)||arc.kind!=='intercept'||
  !enemy?.openingCommander||enemy.serial!==arc.commanderSerial||enemy.hp>0||
  enemy.expAwarded||enemy.converted||!Number.isFinite(now))return false;
 arc.commanderDefeated=true;arc.commanderDefeatedAt=now;return true;
}

export function advanceOpeningArc(arc,now,dt,{commanderDefeated=false,repairing=false,withinRange=false}={}){
 if(!openingArcActive(arc))return 'idle';
 // One success transition only; a late kill cannot award a failed assignment.
 const timelyKill=arc.kind==='intercept'&&commanderDefeated&&arc.commanderSerial!==null&&
  Number.isFinite(arc.commanderDefeatedAt)&&arc.commanderDefeatedAt<arc.expiresAt;
 if(now>=arc.expiresAt&&!timelyKill){arc.status='failed';return 'failed';}
 if(arc.kind==='intercept'){
  // An absent ship is not proof of victory: saves, despawns and a missing
  // reference must never hand out the first weapon for free.
  if((now<arc.expiresAt||timelyKill)&&commanderDefeated&&arc.commanderSerial!==null){
   arc.status='complete';arc.reliefUntil=now+OPENING_ARC.interceptRelief;
   return 'intercept-complete';
  }
 }else if(arc.kind==='rescue'){
  if(repairing&&withinRange)arc.repair=Math.min(OPENING_ARC.repairSeconds,
   arc.repair+Math.max(0,dt));
  // Halfway through extraction the capsule releases its one emergency
  // shielding pulse. The flag survives interruptions and checkpoints.
  if(repairing&&withinRange&&!arc.rescuePulseUsed&&
    arc.repair>=OPENING_ARC.repairSeconds*OPENING_ARC.rescuePulseProgress)
   arc.rescuePulseUsed=true;
  if(arc.repair>=OPENING_ARC.repairSeconds){
   arc.status='complete';arc.alarmUntil=now+OPENING_ARC.rescueAlarm;
   return 'rescue-complete';
  }
 }
 return 'active';
}

export function openingArcPressure(director,arc,now,player,home){
 if(!director?.types?.length)return director;
 let result=director;
 const nearby=home&&player&&Math.hypot(player.x-home.x,player.y-home.y)<=OPENING_ARC.localRadius;
 // Short recoveries are added to the existing director without erasing enemies.
 // They are strongest early, taper to zero by 10 minutes, and do not alter
 // regional warfare or make the player permanently safe near the first dock.
 if(now<600&&nearby){
  const wave=Math.floor(Math.max(0,now-36)/92);
  const age=Math.max(0,now-36)%92;
  if(now>=36&&age>=62&&age<88){
   result={...result,interval:result.interval*1.65,
    cap:Math.max(4,result.cap-Math.min(6,2+wave))};
  }
 }
 // The authored crisis adds its own concrete threat. Do not stack a full
 // ambient swarm on top of the protected commander or an unarmed rescue hold.
 // Completing the rescue ends this breathing room immediately and triggers
 // its advertised alarm, so opting in does not make an endlessly safe sector.
 if(nearby&&openingArcActive(arc)){
  result={...result,interval:result.interval*(arc.kind==='rescue'?1.45:1.28),
   cap:Math.max(4,result.cap-2)};
 }
 if(nearby&&arc?.reliefUntil>now){
  result={...result,interval:result.interval*1.5,
   cap:Math.max(4,result.cap-4)};
 }else if(nearby&&arc?.alarmUntil>now){
  result={...result,interval:Math.max(2.4,result.interval*.84),
   cap:Math.min(70,result.cap+2)};
 }
 return result;
}

export function openingArcObjective(arc,now,touch=false){
 if(arc?.reliefUntil>now)return 'ПАТРУЛИ ПОТЕРЯЛИ НАВЕДЕНИЕ · '+
  Math.ceil(arc.reliefUntil-now)+' с реже';
 if(arc?.alarmUntil>now)return 'ТРЕВОГА ПОСЛЕ СПАСЕНИЯ · '+
  Math.ceil(arc.alarmUntil-now)+' с чаще';
 if(!openingArcActive(arc))return '';
 const seconds=Math.max(0,Math.ceil(arc.expiresAt-now));
 if(arc.kind==='intercept')return 'ПЕРЕХВАТ · уничтожьте наводчика · '+seconds+' с';
 return 'ЭВАКУАЦИЯ · '+(touch?'держите «Действие»':'удерживайте E у капсулы')+' · '+
  Math.round(arc.repair/OPENING_ARC.repairSeconds*100)+'% · '+seconds+' с';
}

export function openingWaypointCue(waypoint,distance){
 if(!Number.isFinite(distance)||distance<0)return '';
 if(waypoint?.id==='opening-intercept')return 'НАВОДЧИК · '+Math.round(distance)+' М';
 if(waypoint?.id==='opening-rescue')return 'КАПСУЛА · '+Math.round(distance)+' М';
 return '';
}

export function validateOpeningArc(arc){
 if(!arc||arc.version!==1||!['offer','active','complete','failed','skipped'].includes(arc.status)||
  ![null,'intercept','rescue'].includes(arc.kind))return false;
 for(const key of ['startedAt','expiresAt','repair','rescueX','rescueY','interceptX','interceptY',
  'reliefUntil','alarmUntil'])if(typeof arc[key]!=='number'||!Number.isFinite(arc[key])||
   Math.abs(arc[key])>1e9)return false;
 if(arc.repair<0||arc.repair>OPENING_ARC.repairSeconds||
  (arc.commanderSerial!==null&&(!Number.isInteger(arc.commanderSerial)||arc.commanderSerial<1)))return false;
 if(arc.commanderDefeated!==undefined&&typeof arc.commanderDefeated!=='boolean')return false;
 if(arc.commanderDefeated&&arc.kind!=='intercept')return false;
 if(arc.rescuePulseUsed!==undefined&&typeof arc.rescuePulseUsed!=='boolean')return false;
 if(arc.rescuePulseUsed&&arc.kind!=='rescue')return false;
 if(arc.commanderDefeatedAt!==undefined&&arc.commanderDefeatedAt!==null&&
  (!Number.isFinite(arc.commanderDefeatedAt)||arc.commanderDefeatedAt<0||
   arc.commanderDefeatedAt>1e9||!arc.commanderDefeated))return false;
 if(arc.status==='active'&&(!arc.kind||arc.expiresAt<=arc.startedAt))return false;
 if(arc.returnWaypoint!==undefined&&arc.returnWaypoint!==null&&
  (typeof arc.returnWaypoint!=='object'||typeof arc.returnWaypoint.id!=='string'||
   !Number.isFinite(arc.returnWaypoint.x)||!Number.isFinite(arc.returnWaypoint.y)))return false;
 return true;
}

export function runClock(seconds){
 const total=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
}
