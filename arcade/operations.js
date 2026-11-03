// First authored sector operation: a visible hostile target, not a generic kill counter.
// Kept separate from repeatable station contracts so combat events cannot complete it by accident.
export const CORRIDOR_OPERATION=Object.freeze({
 id:'silent-corridor',kind:'jammer',name:'Глухой коридор',
 kicker:'ОСОБАЯ ОПЕРАЦИЯ',rewardOre:30,rewardData:22,
 maxHp:150,focusRange:255,escortTrigger:650,
 pulseRange:315,pulsePeriod:4.2,pulseDamage:13,
 desc:'На восточном маршруте работает вражеский глушитель. Подлетите к передатчику и уничтожьте его. Его охранение можно обойти или сначала устранить. На расстоянии до 255 м луч автоматически переключится на передатчик. В радиусе 315 м передатчик заряжает ЭМ-импульс: отойдите, чтобы ослабить заряд.',
 consequence:'После уничтожения передатчика разведка дока расширится на 350 м, а вражеские патрули в домашнем секторе станут реже.'
});
export const isCorridorDock=base=>base?.id==='0:0'&&base?.type==='dock'&&!base?.enemy;
export const corridorPosition=base=>({x:base.x+1180,y:base.y-510});
export function createCorridorOperation(base){
 if(!isCorridorDock(base))return null;
 const {x,y}=corridorPosition(base);
 return {...CORRIDOR_OPERATION,baseId:base.id,x,y,hp:CORRIDOR_OPERATION.maxHp,
  guardsSpawned:false,reinforcementsAt:0,waves:0,pulseCharge:0,pulseLocked:false,pulseWarned:false,pulseFlashUntil:0,overheatedUntil:0};
}
export function corridorOffer(base,operation){
 if(!isCorridorDock(base))return null;
 if(base.corridorSecured)return {status:'complete',...CORRIDOR_OPERATION};
 if(operation?.id===CORRIDOR_OPERATION.id&&operation.baseId===base.id)
  return {status:'active',...CORRIDOR_OPERATION,
   x:operation.x,y:operation.y,hp:Math.max(0,operation.hp)};
 const remembered=base.corridorMission;
 return {status:base.active?'available':'locked',...CORRIDOR_OPERATION,
  ...corridorPosition(base),resumable:!!remembered,
  hp:remembered?.hp??CORRIDOR_OPERATION.maxHp};
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
 rewardOre:16,rewardData:32,maxRepair:100,repairRange:150,repairPerSecond:8.5,
 desc:'Разведывательный зонд лаборатории перестал отвечать. Найдите его, удерживайте E рядом с корпусом для восстановления и отпускайте E, когда нужно защищаться. Выполненная работа сохраняется.',
 consequence:'Лаборатория получит телеметрию, покажет ещё один сигнал станции и расширит местную разведку на 300 м.'
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
 return {...PROBE_OPERATION,baseId:base.id,...probePosition(base,world),
  repair:0,waves:0,repairing:false,lastRepairNotice:0};
}
export function probeOffer(base,operation){
 if(!isProbeLab(base))return null;
 if(base.probeRecovered)return {status:'complete',...PROBE_OPERATION};
 if(operation?.id===PROBE_OPERATION.id&&operation.baseId===base.id)
  return {status:'active',...PROBE_OPERATION,
   x:operation.x,y:operation.y,repair:operation.repair};
 const remembered=base.probeMission;
 return {status:base.active?'available':'locked',...PROBE_OPERATION,
  resumable:!!remembered,repair:remembered?.repair||0};
}
