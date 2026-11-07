// First authored sector operation: a visible hostile target, not a generic kill counter.
// Kept separate from repeatable station contracts so combat events cannot complete it by accident.
export const CORRIDOR_OPERATION=Object.freeze({
 id:'silent-corridor',kind:'jammer',name:'Глухой коридор',
 kicker:'ОСОБАЯ ОПЕРАЦИЯ',rewardOre:30,rewardData:22,
 maxHp:150,focusRange:435,escortTrigger:650,radioDelay:9,ambushRadius:295,
 pulseRange:315,pulsePeriod:4.2,pulseDamage:13,
 desc:'Отключите глушитель и вернитесь в док. При сближении разведчик пойдёт передавать тревогу. Перехватите его или обойдите отмеченную засаду на обратном пути.',
 consequence:'После уничтожения передатчика разведка дока расширится на 350 м, а вражеские патрули в домашнем секторе станут реже.'
});
export const isCorridorDock=base=>base?.id==='0:0'&&base?.type==='dock'&&!base?.enemy;
export const corridorPosition=base=>({x:base.x+1180,y:base.y-510});
export function createCorridorOperation(base){
 if(!isCorridorDock(base))return null;
 const {x,y}=corridorPosition(base);
 return {...CORRIDOR_OPERATION,baseId:base.id,x,y,hp:CORRIDOR_OPERATION.maxHp,
  phase:'attack',radio:'idle',pursuitStarted:false,guardsSpawned:false,reinforcementsAt:0,waves:0,pulseCharge:0,pulseLocked:false,pulseWarned:false,pulseFlashUntil:0,overheatedUntil:0};
}
export function corridorAmbush(base,operation){
 return {x:base.x+(operation.x-base.x)*.51,y:base.y+(operation.y-base.y)*.51};
}
export function corridorOffer(base,operation){
 if(!isCorridorDock(base))return null;
 if(base.corridorSecured)return {status:'complete',...CORRIDOR_OPERATION};
 if(operation?.id===CORRIDOR_OPERATION.id&&operation.baseId===base.id)
  return {status:'active',...CORRIDOR_OPERATION,
   x:operation.x,y:operation.y,hp:Math.max(0,operation.hp),phase:operation.phase||'attack',radio:operation.radio};
 const remembered=base.corridorMission;
 return {status:base.active?'available':'locked',...CORRIDOR_OPERATION,
  ...corridorPosition(base),resumable:!!remembered,phase:remembered?.phase||'attack',
  hp:remembered?.hp??CORRIDOR_OPERATION.maxHp,radio:remembered?.radio};
}
// The mission changes pressure only around the home dock. No permanent safe-zone exploit.
export function corridorPatrolModifier(base,x,y){
 if(!base?.corridorSecured)return 1;
 return Math.hypot(x-base.x,y-base.y)<1250?1.17:1;
}


// A second authored operation uses extraction controls for a different decision:
// repair a lost scientific probe while dropping the beam to fight off pursuers.
export const PROBE_OPERATION=Object.freeze({
 id:'last-signal',kind:'probe',name:'Последний сигнал',
 rewardOre:20,rewardData:32,partialOre:9,partialData:16,maxRepair:100,maxHp:90,
 repairRange:150,searchRadius:240,detectRange:295,repairPerSecond:5,telemetryAt:50,retryDelay:30,
 stages:Object.freeze([
  {at:26,limit:50,type:'fighter',angle:2.55,range:350,damage:14,charge:2.8},
  {at:65,limit:85,type:'flanker',angle:-.48,range:360,damage:16,charge:3}
 ]),
 desc:'Найдите зонд в районе сигнала. Удерживайте действие для ремонта. Если налётчик глушит луч, отпустите кнопку и перехватите его. Ремонт сохраняется.',
 consequence:'С 50% можно увезти данные в лабораторию. Полный ремонт также расширит обзор карты на 300 м.'
});
export const isProbeLab=base=>base?.type==='lab'&&!base?.enemy&&!base?.captured;
export function probePosition(base,world){
 const offsets=[[790,-260],[650,480],[-790,-310],[-610,520],[340,-820],[-240,810]];
 for(const [dx,dy] of offsets){
  const x=base.x+dx,y=base.y+dy;
  const blockedRocks=world?.nearbyRocks(x,y,145).some(r=>
   r.alive&&Math.hypot(x-r.x,y-r.y)<r.r+72);
  const blockedBases=world?.nearbyStations(x,y,215,true).some(s=>s.id!==base.id);
  if(!blockedRocks&&!blockedBases)return {x,y};
 }
 return {x:base.x+790,y:base.y-260};
}
export function createProbeOperation(base,world){
 if(!isProbeLab(base))return null;
 const site=probePosition(base,world);
 return {...PROBE_OPERATION,baseId:base.id,...site,search:probeSearchArea(base,world,site),
  located:false,phase:'repair',hp:PROBE_OPERATION.maxHp,r:28,repair:0,waves:0};
}
export function probeSearchArea(base,world,site=probePosition(base,world)){
 const angle=Math.atan2(site.y-base.y,site.x-base.x)+.82;
 return {x:site.x+Math.cos(angle)*205,y:site.y+Math.sin(angle)*205};
}
export function operationDestination(operation,world){
 if(operation?.phase==='return')return world?.stations?.get(operation.baseId)||operation;
 return operation?.id===PROBE_OPERATION.id&&operation.located===false?operation.search:operation;
}
export function probeOffer(base,operation,now=0){
 if(!isProbeLab(base))return null;
 if(base.probeRecovered||base.probeTelemetryDelivered)return {status:'complete',...PROBE_OPERATION,
  partial:!base.probeRecovered};
 if(base.probeRetryAt>now)return {status:'cooldown',...PROBE_OPERATION,remaining:Math.ceil(base.probeRetryAt-now)};
 if(operation?.id===PROBE_OPERATION.id&&operation.baseId===base.id)
  return {status:'active',...PROBE_OPERATION,
   x:operation.x,y:operation.y,repair:operation.repair,hp:operation.hp,located:operation.located,
   phase:operation.phase,strikerSerial:operation.strikerSerial};
 const remembered=base.probeMission;
 return {status:base.active?'available':'locked',...PROBE_OPERATION,
  resumable:!!remembered,repair:remembered?.repair||0};
}


// After each distinct operation, suggest an accessible station with a different
// task when it is reasonably close. Never reveal distant bases just to force a
// linear campaign: the nearest useful node remains a valid fallback.
export function chooseOperationLead(world,origin,baseId,preferredType,maxDistance){
 const candidates=(world?.nearbyStations?.(origin.x,origin.y,maxDistance,false)||[])
  .filter(b=>b.id!==baseId&&!b.enemy&&!b.active&&!b.discovered)
  .sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-
               Math.hypot(b.x-origin.x,b.y-origin.y));
 const nearest=candidates[0];
 if(!nearest)return null;
 const preferred=candidates.find(b=>b.type===preferredType);
 const nearestDistance=Math.hypot(nearest.x-origin.x,nearest.y-origin.y);
 return preferred&&Math.hypot(preferred.x-origin.x,preferred.y-origin.y)<=
  Math.max(1300,nearestDistance*1.4)?preferred:nearest;
}
