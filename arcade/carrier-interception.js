// A finite moving-target operation at a friendly carrier.
// One real cargo object is shared by navigation, combat and world rendering.
export const CARRIER_INTERCEPTION=Object.freeze({
 id:'carrier-interception',kind:'carrier-interception',name:'Перехват снабжения',
 rewardOre:38,rewardData:30,maxHp:420,speed:76,boostSpeed:114,triggerRange:480,
 boostWarningAt:12,boostAt:14,pulseStart:6,pulsePeriod:11,pulseCharge:2.4,
 pulseRange:230,pulseDamage:12,ventDuration:3,engineThreshold:65,
 engineDuration:4,engineCooldown:9,engineSpeedFactor:.60,
 warningDistance:390,lastChanceDistance:570,retryDelay:35,
 desc:'Перехватите транспорт и вернитесь с телеметрией. Нос прикрыт бронёй, двигатели уязвимы с кормы. Перед круговым разрядом выйдите за 230 м; после него броня открывается на 3 с. Повреждение двигателей замедляет груз. Охранение можно уничтожить или обойти.',
 consequence:'Доставленные сведения уменьшают число вражеских патрулей вдоль маршрута снабжения.'
});
export const isCarrierBase=base=>base?.type==='carrier'&&!base?.enemy&&!base?.captured;
export const AUTONOMOUS_STRIKE_RANGE=9800;
export const autonomousStrikeCarrier=base=>!!base?.active&&!base.enemy&&!base.suppressed&&
 base.type==='carrier'&&base.captured===true&&
 ['military','central-depot','frontier-azure-depot','frontier-teal-depot'].includes(base.strategicRole);

const rotate=(base,x,y,heading)=>({
 x:base.x+x*Math.cos(heading)-y*Math.sin(heading),
 y:base.y+x*Math.sin(heading)+y*Math.cos(heading)
});
export function carrierRoute(base){
 // Each carrier has a stable route, but the cargo must not circle its launching base.
 const key=String(base.id||'carrier');
 let seed=0;for(const character of key)seed=(seed*31+character.charCodeAt(0))>>>0;
 const heading=(seed%8)*Math.PI/4;
 return [
  rotate(base,1080,-350,heading),
  rotate(base,2300,-500,heading),
  rotate(base,3330,-2100,heading)
 ];
}
export function createCarrierInterception(base){
 if(!isCarrierBase(base))return null;
 const route=carrierRoute(base),start=route[0];
 return {...CARRIER_INTERCEPTION,baseId:base.id,route,
  x:start.x,y:start.y,hp:CARRIER_INTERCEPTION.maxHp,r:36,
  maxHp:CARRIER_INTERCEPTION.maxHp,phase:'approach',routeIndex:0,
  segmentDistance:0,contactAt:0,warningSent:false,lastChanceSent:false,
  reinforcementSent:false,escortSerials:[],interceptCargo:true,
  type:'gunship',angle:0,vx:0,vy:0,hit:0,expAwarded:true,
  converted:false,flightTime:0,boostWarned:false,boosted:false,pulseSerial:0,
  pulseWarningSerial:-1,engineStress:0,engineDisabledUntil:0,engineReadyAt:0};
}

// All cues and combat use this same clock. The approach never advances it.
export function carrierPulseState(op){
 const elapsed=(op.flightTime||0)-CARRIER_INTERCEPTION.pulseStart;
 if(elapsed<0)return {key:'cruise',remaining:-elapsed,charge:0};
 const cycle=Math.floor(elapsed/CARRIER_INTERCEPTION.pulsePeriod);
 const within=elapsed-cycle*CARRIER_INTERCEPTION.pulsePeriod;
 if(within<CARRIER_INTERCEPTION.pulseCharge)return {key:'charging',cycle,
  remaining:CARRIER_INTERCEPTION.pulseCharge-within,charge:within/CARRIER_INTERCEPTION.pulseCharge};
 if(within<CARRIER_INTERCEPTION.pulseCharge+CARRIER_INTERCEPTION.ventDuration)
  return {key:'vent',cycle,remaining:CARRIER_INTERCEPTION.pulseCharge+CARRIER_INTERCEPTION.ventDuration-within,charge:1};
 return {key:'cruise',cycle,remaining:CARRIER_INTERCEPTION.pulsePeriod-within,charge:0};
}
export function advanceCarrierSystems(op,dt){
 if(!carrierInFlight(op)||!Number.isFinite(dt)||dt<=0)return {};
 op.flightTime=(op.flightTime||0)+dt;
 const clock=op.flightTime,pulse=carrierPulseState(op),events={};
 if(!op.boostWarned&&clock>=CARRIER_INTERCEPTION.boostWarningAt){op.boostWarned=true;events.boostWarning=true;}
 if(!op.boosted&&clock>=CARRIER_INTERCEPTION.boostAt){op.boosted=true;events.boost=true;}
 if(pulse.key==='charging'&&op.pulseWarningSerial!==pulse.cycle){
  op.pulseWarningSerial=pulse.cycle;events.pulseWarning=true;
 }
 const serial=Math.max(0,Math.floor((clock-CARRIER_INTERCEPTION.pulseStart-
  CARRIER_INTERCEPTION.pulseCharge)/CARRIER_INTERCEPTION.pulsePeriod)+1);
 if(serial>(op.pulseSerial||0)){op.pulseSerial=serial;events.discharge=true;}
 op.speed=(op.boosted?CARRIER_INTERCEPTION.boostSpeed:CARRIER_INTERCEPTION.speed)*
  (clock<(op.engineDisabledUntil||0)?CARRIER_INTERCEPTION.engineSpeedFactor:1);
 return events;
}
export function carrierAspect(op,origin){
 if(!origin)return 'side';
 const dx=origin.x-op.x,dy=origin.y-op.y,d=Math.hypot(dx,dy);
 if(d<.001)return 'side';
 const heading=(op.angle||0)-Math.PI/2;
 const alignment=(dx*Math.cos(heading)+dy*Math.sin(heading))/d;
 return alignment>.45?'front':alignment<-.45?'rear':'side';
}
export function hitCarrierCargo(op,damage,origin){
 if(!carrierInFlight(op)||op.hp<=0||!Number.isFinite(damage)||damage<=0)return {damage:0};
 const aspect=carrierAspect(op,origin),vent=carrierPulseState(op).key==='vent';
 const factor=vent?1.5:aspect==='front'?.45:aspect==='rear'?1.35:1;
 const actual=Math.min(op.hp,damage*factor);
 op.hp=Math.max(0,op.hp-actual);op.lastAspect=aspect;
 let engineDisabled=false;
 if(aspect==='rear'&&op.flightTime>=(op.engineReadyAt||0)){
  op.engineStress=(op.engineStress||0)+actual;
  if(op.engineStress>=CARRIER_INTERCEPTION.engineThreshold&&op.hp>0){
   op.engineStress=0;op.engineDisabledUntil=op.flightTime+CARRIER_INTERCEPTION.engineDuration;
   op.engineReadyAt=op.flightTime+CARRIER_INTERCEPTION.engineCooldown;engineDisabled=true;
  }
 }
 return {damage:actual,aspect,vent,engineDisabled};
}
export function carrierTacticalCue(op,player){
 const pulse=carrierPulseState(op);
 if(pulse.key==='charging')return 'РАЗРЯД '+pulse.remaining.toFixed(1)+' С · '+
  (Math.hypot(player.x-op.x,player.y-op.y)<=CARRIER_INTERCEPTION.pulseRange?'ВЫЙДИТЕ ЗА 230 М':'ВНЕ ЗОНЫ 230 М');
 if(pulse.key==='vent')return 'БРОНЯ ОТКРЫТА · УРОН +50% · '+pulse.remaining.toFixed(1)+' С';
 if(op.flightTime<(op.engineDisabledUntil||0))return 'ДВИГАТЕЛИ ПОВРЕЖДЕНЫ · ГРУЗ ЗАМЕДЛЕН';
 if(op.boostWarned&&!op.boosted)return 'ФОРСАЖ ЧЕРЕЗ '+Math.max(0,CARRIER_INTERCEPTION.boostAt-op.flightTime).toFixed(1)+' С';
 return carrierAspect(op,player)==='front'?'НОСОВАЯ БРОНЯ · ОБОЙДИТЕ С ФЛАНГА':'УЯЗВИМАЯ КОРМА · ПОВРЕДИТЕ ДВИГАТЕЛИ';
}
export function carrierOffer(base,operation,now=0){
 if(!isCarrierBase(base))return null;
 if(base.supplyIntercepted)return {...CARRIER_INTERCEPTION,status:'complete'};
 if(operation?.id===CARRIER_INTERCEPTION.id&&operation.baseId===base.id)
  return {...CARRIER_INTERCEPTION,status:'active',phase:operation.phase,
   hp:operation.hp,x:operation.x,y:operation.y,
   distanceRemaining:carrierDistanceRemaining(operation)};
 const remaining=Math.max(0,(base.carrierRetryAt||0)-now);
 return {...CARRIER_INTERCEPTION,status:!base.active?'locked':
  remaining>0?'cooldown':'available',remaining:Math.ceil(remaining),
  phase:base.carrierMission?.phase||'approach',resumable:!!base.carrierMission};
}
export const carrierInFlight=op=>op?.id===CARRIER_INTERCEPTION.id&&
 ['contact','pursuit','turn','last'].includes(op.phase);

export function carrierDistanceRemaining(op){
 if(!op?.route||op.route.length!==3)return 0;
 const index=Math.min(1,Math.max(0,op.routeIndex||0));
 let remaining=Math.hypot(op.route[index+1].x-op.x,op.route[index+1].y-op.y);
 if(index===0)remaining+=Math.hypot(op.route[2].x-op.route[1].x,
  op.route[2].y-op.route[1].y);
 return remaining;
}
export function moveCarrierCargo(op,dt){
 if(!carrierInFlight(op)||!Number.isFinite(dt)||dt<=0)return {moved:0,turned:false,escaped:false};
 let left=op.speed*dt,moved=0,turned=false;
 while(left>0&&op.routeIndex<2){
  const target=op.route[op.routeIndex+1];
  const dx=target.x-op.x,dy=target.y-op.y,d=Math.hypot(dx,dy);
  if(d<=0.0001){op.x=target.x;op.y=target.y;op.routeIndex++;
   if(op.routeIndex===1)turned=true;continue;}
  const step=Math.min(d,left);
  op.vx=dx/d*op.speed;op.vy=dy/d*op.speed;
  op.angle=Math.atan2(dy,dx)+Math.PI/2;
  op.x+=dx/d*step;op.y+=dy/d*step;
  moved+=step;left-=step;
  if(d-step<0.0001){op.x=target.x;op.y=target.y;op.routeIndex++;
   if(op.routeIndex===1)turned=true;}
 }
 if(op.routeIndex>=2){op.vx=0;op.vy=0;}
 return {moved,turned,escaped:op.routeIndex>=2};
}
const segmentDistance=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
};
export function carrierPatrolModifier(base,x,y){
 if(!base?.supplyIntercepted)return 1;
 const route=carrierRoute(base),p={x,y};
 const close=Math.min(segmentDistance(p,route[0],route[1]),
  segmentDistance(p,route[1],route[2]));
 return close<740?1.19:1;
}
