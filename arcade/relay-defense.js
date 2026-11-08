import {hash} from './balance.js';

export const RELAY_DEFENSE=Object.freeze({
 id:'relay-defense',name:'Оборона ретранслятора',kind:'relay-defense',
 rewardOre:28,rewardData:24,maxHp:160,triggerRange:500,assaultRange:375,
 bonusOre:8,bonusData:8,bonusScan:250,retryDelay:45,antennaHp:54,
 preparation:5.5,intermission:6.5,prepHold:2.8,prepCost:5,prepShield:36,
 waves:Object.freeze([
  Object.freeze([{type:'fighter',angle:0,target:'relay',range:470,damage:14,charge:3.2},
   {type:'scout',angle:.54}]),
  Object.freeze([{type:'flanker',angle:-1.6,target:'relay',range:480,damage:15,charge:3},
   {type:'fighter',angle:1.3,target:'antenna',range:410,damage:12,charge:3.2}]),
  Object.freeze([{type:'gunship',angle:2.7,target:'relay',range:500,damage:20,charge:3.8},
   {type:'scout',angle:2.05}])
 ]),
 desc:'Отразите три налёта. Цели врагов обозначены заранее, но порядок атак меняется при повторной попытке. В подготовке или между волнами можно один раз установить защитный барьер на передатчик либо резервную антенну за 5 сплава. Сохранённая антенна улучшает разведку.',
 consequence:'Если антенна уцелеет, она расширит разведку арсенала и поможет найти следующий узел сети.'
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
 const bearing=hash(base.x,base.y,world?.seed)*Math.PI*2+(base.relayAttempts||0)*1.73;
 const antenna={r:18,hp:RELAY_DEFENSE.antennaHp,maxHp:RELAY_DEFENSE.antennaHp};
 for(const offset of [0,.65,-.65,1.3,-1.3,Math.PI]){
  antenna.x=x+Math.cos(bearing+1.3+offset)*142;
  antenna.y=y+Math.sin(bearing+1.3+offset)*142;
  const rocks=world?.nearbyRocks?.(antenna.x,antenna.y,75)||[];
  if(!rocks.some(r=>r.alive&&Math.hypot(r.x-antenna.x,r.y-antenna.y)<r.r+32))break;
 }
 return {...RELAY_DEFENSE,baseId:base.id,x,y,r:34,hp:RELAY_DEFENSE.maxHp,
  bearing,antenna,phase:'approach',wave:0,nextAt:0,enemySerials:[],
  assaultPattern:(base.relayAttempts||0)%3,prepProgress:0,prepTarget:null,
  prepared:false,fieldShield:0};
}
export function relayWavePlan(op,index=op.wave){
 const original=RELAY_DEFENSE.waves[index]||[];
 const pattern=op.assaultPattern||0;
 const plans=[original,
  [[{type:'fighter',angle:-.5,target:'antenna',range:410,damage:12,charge:3.5},
    {type:'scout',angle:1.1}],
   [{type:'flanker',angle:-1.4,target:'relay',range:450,damage:15,charge:3.2},
    {type:'fighter',angle:.8,target:'antenna',range:400,damage:13,charge:3.5}],
   [{type:'gunship',angle:2.5,target:'relay',range:495,damage:20,charge:3.9},
    {type:'scout',angle:.6,target:'antenna',range:350,damage:10,charge:3.5}]][index]||original,
  [[{type:'fighter',angle:.1,target:'relay',range:470,damage:14,charge:3.2},
    {type:'scout',angle:1.6,target:'antenna',range:350,damage:9,charge:3.8}],
   [{type:'flanker',angle:-.9,target:'antenna',range:410,damage:15,charge:3},
    {type:'fighter',angle:2.1,target:'relay',range:460,damage:14,charge:3.3}],
   [{type:'gunship',angle:2.6,target:'antenna',range:485,damage:17,charge:4.1},
    {type:'scout',angle:1.0,target:'relay',range:430,damage:10,charge:3.6}]][index]||original];
 return plans[pattern].map(spec=>({...spec,angle:spec.angle+(op.bearing||0)}));
}
export function relayPrepInteraction(op,player){
 if(op?.id!==RELAY_DEFENSE.id||!['warning','intermission'].includes(op.phase)||
  op.prepared||player.ore<RELAY_DEFENSE.prepCost)return null;
 for(const target of [op,op.antenna])if(target?.hp>0&&
   Math.hypot(player.x-target.x,player.y-target.y)<=125)
  return {kind:'relay-prep',target,hold:true,label:target===op?
   'Барьер передатчика · 5 сплава':'Барьер антенны · 5 сплава'};
 return null;
}
export function relayIncomingTargets(op){
 const counts={relay:0,antenna:0};
 for(const e of relayWavePlan(op))if(e.target&&e.target in counts)
  counts[e.target==='antenna'&&op.antenna?.hp<=0?'relay':e.target]++;
 return counts;
}
export function relayApproachCue(op){
 const directions=['→','↘','↓','↙','←','↖','↑','↗'];
 return relayWavePlan(op).filter(spec=>spec.target).map(spec=>{
  const index=(Math.round(spec.angle/(Math.PI/4))%8+8)%8;
  return directions[index];
 }).join(' ');
}
export function relayOffer(base,operation,now=0){
 if(!isRelayArsenal(base))return null;
 if(base.relayDefenseDone)return {status:'complete',...RELAY_DEFENSE,
  antennaSaved:base.relaySite?.antenna?.hp>0};
 if(operation?.id===RELAY_DEFENSE.id&&operation.baseId===base.id)
  return {status:'active',...RELAY_DEFENSE,
   hp:operation.hp,phase:operation.phase,wave:operation.wave,nextAt:operation.nextAt,
   x:operation.x,y:operation.y,bearing:operation.bearing,antenna:operation.antenna};
 if(base.relayRetryAt>now)return {status:'cooldown',...RELAY_DEFENSE,
  remaining:Math.ceil(base.relayRetryAt-now)};
 return {status:base.active?'available':'locked',...RELAY_DEFENSE,
  resumable:!!base.relayMission};
}
export function relayDefenseCue(op,now=0){
 if(!op||op.id!==RELAY_DEFENSE.id)return null;
 if(op.phase==='approach')return 'НАЙДИТЕ РЕТРАНСЛЯТОР';
 if(op.phase==='warning')return 'АТАКА ЧЕРЕЗ '+Math.max(0,Math.ceil(op.nextAt-now))+' С '+relayApproachCue(op)+
  ' · '+relayTargetCue(op);
 if(op.phase==='wave')return 'ОТРАЗИТЕ ВОЛНУ '+op.wave+'/3';
 if(op.phase==='intermission')return 'СЛЕДУЮЩАЯ ВОЛНА ЧЕРЕЗ '+Math.max(0,Math.ceil(op.nextAt-now))+' С '+relayApproachCue(op)+
  ' · '+relayTargetCue(op);
 return 'ОБОРОНА ВЫПОЛНЯЕТСЯ';
}
function relayTargetCue(op){
 const targets=relayIncomingTargets(op);
 return targets.relay&&targets.antenna?'ДВЕ ЦЕЛИ':targets.antenna?'АНТЕННА ПОД УДАРОМ':
  'ПЕРЕДАТЧИК ПОД УДАРОМ';
}
export function relayAttacker(op,enemies,now){
 if(op?.phase!=='wave')return null;
 let target=null,firstShot=Infinity;
 for(const e of enemies){
  if(e.relayAssault!==op.baseId||e.hp<=0||e.converted)continue;
  const charge=e.relayChargeUntil>now?e.relayChargeUntil:Infinity;
  if(charge<firstShot||(!target&&e.missionStrike)){
   target=e;firstShot=charge;
  }
 }
 return target;
}
