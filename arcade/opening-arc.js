// A short, optional first-sector dilemma. The two responses share one reward,
// but change the local threat in opposite ways. The arc is data-only so a
// station checkpoint can restore it without creating duplicate enemies.
export const OPENING_ARC=Object.freeze({
 offerAt:16,deadline:155,repairSeconds:3.5,repairRange:155,
 interceptRewardData:27,interceptRewardOre:8,
 rescueRewardOre:28,rescueShield:20,
 interceptRelief:120,rescueAlarm:100,
 localRadius:2600
});

export function createOpeningArc(home){
 return {version:1,status:'offer',kind:null,startedAt:0,expiresAt:0,
  commanderSerial:null,repair:0,
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

export function advanceOpeningArc(arc,now,dt,{commanderAlive=true,repairing=false,withinRange=false}={}){
 if(!openingArcActive(arc))return 'idle';
 // One success transition only; a late kill cannot award a failed assignment.
 if(now>=arc.expiresAt){arc.status='failed';return 'failed';}
 if(arc.kind==='intercept'){
  if(!commanderAlive){
   arc.status='complete';arc.reliefUntil=now+OPENING_ARC.interceptRelief;
   return 'intercept-complete';
  }
 }else if(arc.kind==='rescue'){
  if(repairing&&withinRange)arc.repair=Math.min(OPENING_ARC.repairSeconds,
   arc.repair+Math.max(0,dt));
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
 if(nearby&&arc?.reliefUntil>now){
  result={...result,interval:result.interval*1.5,
   cap:Math.max(4,result.cap-4)};
 }else if(nearby&&arc?.alarmUntil>now){
  result={...result,interval:Math.max(2.4,result.interval*.84),
   cap:Math.min(70,result.cap+2)};
 }
 return result;
}

export function openingArcObjective(arc,now){
 if(arc?.reliefUntil>now)return 'ПАТРУЛИ ПОТЕРЯЛИ НАВЕДЕНИЕ · '+
  Math.ceil(arc.reliefUntil-now)+' с реже';
 if(arc?.alarmUntil>now)return 'ТРЕВОГА ПОСЛЕ СПАСЕНИЯ · '+
  Math.ceil(arc.alarmUntil-now)+' с чаще';
 if(!openingArcActive(arc))return '';
 const seconds=Math.max(0,Math.ceil(arc.expiresAt-now));
 if(arc.kind==='intercept')return 'ПЕРЕХВАТ · уничтожьте наводчика · '+seconds+' с';
 return 'ЭВАКУАЦИЯ · удерживайте E у капсулы · '+
  Math.round(arc.repair/OPENING_ARC.repairSeconds*100)+'% · '+seconds+' с';
}

export function validateOpeningArc(arc){
 if(!arc||arc.version!==1||!['offer','active','complete','failed','skipped'].includes(arc.status)||
  ![null,'intercept','rescue'].includes(arc.kind))return false;
 for(const key of ['startedAt','expiresAt','repair','rescueX','rescueY','interceptX','interceptY',
  'reliefUntil','alarmUntil'])if(typeof arc[key]!=='number'||!Number.isFinite(arc[key])||
   Math.abs(arc[key])>1e9)return false;
 if(arc.repair<0||arc.repair>OPENING_ARC.repairSeconds||
  (arc.commanderSerial!==null&&(!Number.isInteger(arc.commanderSerial)||arc.commanderSerial<1)))return false;
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
