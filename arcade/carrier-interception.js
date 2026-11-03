// A finite moving-target operation at a friendly carrier.
// One real cargo object is shared by navigation, combat and world rendering.
export const CARRIER_INTERCEPTION=Object.freeze({
 id:'carrier-interception',kind:'carrier-interception',name:'Перехват снабжения',
 rewardOre:38,rewardData:30,maxHp:590,speed:43,triggerRange:480,
 warningDistance:390,lastChanceDistance:570,retryDelay:35,
 desc:'Найдите район встречи, перехватите движущийся груз и вернитесь с телеметрией на авианосец. Охранение можно уничтожить или обойти.',
 consequence:'Доставленные сведения уменьшают число вражеских патрулей вдоль маршрута снабжения.'
});
export const isCarrierBase=base=>base?.type==='carrier'&&!base?.enemy&&!base?.captured;

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
  converted:false};
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
