// Three finite relay-defense waves. This file owns pure mission data and state-derived copy.
export const RELAY_DEFENSE=Object.freeze({
 id:'relay-defense',name:'Оборона ретранслятора',kind:'relay-defense',
 rewardOre:28,rewardData:24,maxHp:160,triggerRange:500,assaultRange:375,
 preparation:8,intermission:6,waves:Object.freeze([
  Object.freeze([{type:'scout',angle:-.35},{type:'scout',angle:.3}]),
  Object.freeze([{type:'fighter',angle:-1.2},{type:'flanker',angle:-.85}]),
  Object.freeze([{type:'gunship',angle:2.6},{type:'scout',angle:3.1}])
 ]),
 desc:'Найдите ретранслятор возле арсенала и отразите три конечные волны. Налётчики атакуют именно передатчик: перехватывайте их до выстрела. Между волнами есть короткая передышка.',
 consequence:'Станция сохраняет ретранслятор и раскрывает координаты ещё одного узла. Награда выдаётся один раз.'
});
export const isRelayArsenal=base=>base?.type==='arsenal'&&!base.enemy&&!base.captured;
export function relayPosition(base,world){
 const offsets=[[340,-220],[-340,-210],[310,270],[-330,260],[440,0],[-430,0]];
 for(const [dx,dy] of offsets){
  const x=base.x+dx,y=base.y+dy;
  const rocks=world?.nearbyRocks?.(x,y,115)||[];
  const stations=world?.nearbyStations?.(x,y,205,true)||[];
  if(!rocks.some(r=>r.alive&&Math.hypot(x-r.x,y-r.y)<r.r+63)&&
     !stations.some(s=>s.id!==base.id))return {x,y};
 }
 return {x:base.x+340,y:base.y-220};
}
export function createRelayDefense(base,world){
 if(!isRelayArsenal(base))return null;
 const {x,y}=relayPosition(base,world);
 return {...RELAY_DEFENSE,baseId:base.id,x,y,r:34,hp:RELAY_DEFENSE.maxHp,
  phase:'approach',wave:0,nextAt:0,enemySerials:[]};
}
export function relayOffer(base,operation,now=0){
 if(!isRelayArsenal(base))return null;
 if(base.relayDefenseDone)return {status:'complete',...RELAY_DEFENSE};
 if(operation?.id===RELAY_DEFENSE.id&&operation.baseId===base.id)
  return {status:'active',...RELAY_DEFENSE,
   hp:operation.hp,phase:operation.phase,wave:operation.wave,x:operation.x,y:operation.y};
 if(base.relayRetryAt>now)return {status:'cooldown',...RELAY_DEFENSE,
  remaining:Math.ceil(base.relayRetryAt-now)};
 return {status:base.active?'available':'locked',...RELAY_DEFENSE,
  resumable:!!base.relayMission};
}
export function relayDefenseCue(op,now=0){
 if(!op||op.id!==RELAY_DEFENSE.id)return null;
 if(op.phase==='approach')return 'НАЙДИТЕ РЕТРАНСЛЯТОР';
 if(op.phase==='warning')return 'АТАКА ЧЕРЕЗ '+Math.max(0,Math.ceil(op.nextAt-now))+' С';
 if(op.phase==='wave')return 'ОТРАЗИТЕ ВОЛНУ '+op.wave+'/3';
 if(op.phase==='intermission')return 'СЛЕДУЮЩАЯ ВОЛНА ЧЕРЕЗ '+Math.max(0,Math.ceil(op.nextAt-now))+' С';
 return 'ОБОРОНА ВЫПОЛНЯЕТСЯ';
}
