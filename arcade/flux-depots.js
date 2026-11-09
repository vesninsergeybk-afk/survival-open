import {contourFields,fieldAt} from './territory-system.js';
import {productiveContourFields} from './contour-trials.js';
import {fluxInfrastructureRank} from './territory-economy.js';

export const FLUX_DEPOT=Object.freeze({name:'Склад флюкса',oreCost:18,fluxCost:5,
 buildSeconds:3,buildRadius:560,capacity:12,supplyRadius:680,
 sourceRadius:1300,packetSpeed:460,baseFillPerMinute:11,
 maxDepots:48,maxPackets:128,clearance:145});
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const active=t=>t?.hp>0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const depotCapacity=t=>FLUX_DEPOT.capacity+8*(t?.level||0);
export const depotSupplyRadius=t=>FLUX_DEPOT.supplyRadius+120*(t?.level||0);
const DEPOT_UPGRADES=Object.freeze([{ore:22,flux:6},{ore:35,flux:12},{ore:60,flux:26}]);
export function depotUpgradeOffer(world,player,t,time){
 if(!active(t))return {ok:false,reason:'Склад разрушен'};
 if(time<t.readyAt)return {ok:false,reason:'Дождитесь окончания строительства'};
 const price=DEPOT_UPGRADES[t.level||0];
 if(!price)return {ok:false,reason:'Склад развит полностью'};
 if((player.ore||0)<price.ore)return {ok:false,reason:'Нужно '+price.ore+' сплава',...price};
 if((world.contours?.flux||0)+1e-8<price.flux)return {ok:false,reason:'Нужно '+price.flux+' флюкса',...price};
 return {ok:true,...price};
}
export function upgradeDepot(world,player,t,time){
 const offer=depotUpgradeOffer(world,player,t,time);if(!offer.ok)return offer;
 player.ore-=offer.ore;world.contours.flux-=offer.flux;
 t.level=(t.level||0)+1;return {...offer,level:t.level};
}
const centerOf=f=>f.center||{x:(f.polygon||[]).reduce((s,p)=>s+p.x,0)/(f.polygon?.length||1),
 y:(f.polygon||[]).reduce((s,p)=>s+p.y,0)/(f.polygon?.length||1)};

export function depotOffer(world,player,point){
 const state=world?.contours;
 if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return {ok:false,reason:'Выберите точку строительства'};
 if(!(state?.trials?.completed>0))return {ok:false,reason:'Сначала защитите первый треугольник'};
 const fields=productiveContourFields(world,contourFields(world));
 const field=fieldAt(world,point.x,point.y,fields);
 if(!field)return {ok:false,reason:'Склад размещается внутри защищённого треугольника'};
 if(d(player,point)>FLUX_DEPOT.buildRadius)return {ok:false,reason:'Слишком далеко от корабля'};
 if(d(player,point)<75)return {ok:false,reason:'Освободите место у корабля'};
 if((state.fluxDepots||[]).filter(active).length>=FLUX_DEPOT.maxDepots)
  return {ok:false,reason:'Достигнут предел складов'};
 if([...(state.fluxDepots||[]),...(state.artillery||[]),...(state.supportTurrets||[])]
  .some(t=>(active(t)||t.kind!=='flux-depot')&&d(t,point)<FLUX_DEPOT.clearance))
  return {ok:false,reason:'Слишком близко к другому сооружению'};
 if([...world.stations.values()].some(t=>d(t,point)<120))
  return {ok:false,reason:'Слишком близко к станции'};
 if((player.ore||0)<FLUX_DEPOT.oreCost)return {ok:false,reason:'Нужно '+FLUX_DEPOT.oreCost+' сплава'};
 if((state.flux||0)+1e-8<FLUX_DEPOT.fluxCost)return {ok:false,reason:'Нужно '+FLUX_DEPOT.fluxCost+' флюкса'};
 return {ok:true,field,connection:{cable:d(point,centerOf(field))}};
}
export function deployDepot(world,player,point,time){
 const offer=depotOffer(world,player,point);if(!offer.ok)return offer;
 const state=world.contours;
 state.fluxDepots??=[];state.fluxDepotPackets??=[];
 if(state.fluxDepots.length>=FLUX_DEPOT.maxDepots)
  state.fluxDepots=state.fluxDepots.filter(active);
 state.fluxDepotSerial=(state.fluxDepotSerial||0)+1;
 const depot={kind:'flux-depot',id:state.fluxDepotSerial,x:point.x,y:point.y,
  r:38,hp:100,maxHp:100,stored:0,chargeCredit:0,level:0,readyAt:time+FLUX_DEPOT.buildSeconds};
 state.fluxDepots.push(depot);state.flux=Math.max(0,state.flux-FLUX_DEPOT.fluxCost);
 player.ore-=FLUX_DEPOT.oreCost;
 return {ok:true,depot,connection:offer.connection};
}
export function depotAt(world,point,radius=50){
 return (world?.contours?.fluxDepots||[]).find(t=>active(t)&&d(t,point)<radius)||null;
}
export function nearestSupplyDepot(world,point,time,unitCost=.25){
 let best=null,bestDist=Infinity;
 for(const depot of world?.contours?.fluxDepots||[]){
  if(!active(depot)||depot.readyAt>time||depot.stored+1e-8<unitCost)continue;
  const distance=d(depot,point);
  if(distance>depotSupplyRadius(depot))continue;
  if(distance<bestDist){best=depot;bestDist=distance;}
 }
 return best;
}
export function takeDepotFlux(depot,amount){
 if(!depot||!Number.isFinite(amount)||amount<=0||depot.stored+1e-8<amount)return false;
 depot.stored=Math.max(0,depot.stored-amount);return true;
}
export function advanceFluxDepots(world,time,dt){
 const state=world?.contours;if(!state)return;
 state.fluxDepots??=[];state.fluxDepotPackets??=[];
 const fields=productiveContourFields(world,contourFields(world));
 for(const packet of state.fluxDepotPackets){
  const target=state.fluxDepots.find(t=>t.id===packet.depotId);
  if(!target||!active(target)){packet.done=true;continue;}
  if(time<packet.arriveAt)continue;
  target.stored=Math.min(depotCapacity(target),target.stored+packet.amount);
  packet.done=true;
 }
 state.fluxDepotPackets=state.fluxDepotPackets.filter(p=>!p.done);
 if(!fields.length||state.flux<2.25||
    state.fluxDepotPackets.length>=FLUX_DEPOT.maxPackets)return;
 const sources=fields.map(field=>({field,at:centerOf(field),relay:
  (field.vertices||[]).reduce((rank,id)=>
   Math.max(rank,fluxInfrastructureRank(world.stations.get(id),'relay')),0)}));
 const incoming=new Map();
 for(const packet of state.fluxDepotPackets)
  incoming.set(packet.depotId,(incoming.get(packet.depotId)||0)+packet.amount);
 // Under a scarce treasury, a depot built first must not monopolize every
 // dispatch. Include packets already in flight, otherwise a depot with a
 // long route would keep being selected before its first delivery arrived.
 const neediest=[...state.fluxDepots].sort((a,b)=>
  (a.stored+(incoming.get(a.id)||0))/depotCapacity(a)-
  (b.stored+(incoming.get(b.id)||0))/depotCapacity(b)||a.id-b.id);
 for(const depot of neediest){
  if(!active(depot)||depot.readyAt>time||
     depot.stored+(incoming.get(depot.id)||0)>=depotCapacity(depot)-.24)continue;
  let source=null,sourceDistance=Infinity;
  for(const item of sources){
   const distance=d(depot,item.at);
   if(distance<sourceDistance){source=item;sourceDistance=distance;}
  }
  if(!source)continue;
  const distancePenalty=Math.max(.3,
   (1+sourceDistance/FLUX_DEPOT.sourceRadius)**-1);
  const fillRate=FLUX_DEPOT.baseFillPerMinute*(1+.35*source.relay)*
   (1+.5*(depot.level||0))*distancePenalty;
  depot.chargeCredit=clamp(depot.chargeCredit+fillRate/60*Math.max(0,dt),0,1);
  const amount=Math.min(.5,Math.floor((depot.chargeCredit+1e-8)/.25)*.25,
   Math.floor((depotCapacity(depot)-depot.stored-(incoming.get(depot.id)||0)+1e-8)/.25)*.25,
   Math.floor((state.flux-2+1e-8)/.25)*.25);
  if(amount<.25||state.fluxDepotPackets.length>=FLUX_DEPOT.maxPackets)continue;
  state.flux=Math.max(0,state.flux-amount);depot.chargeCredit-=amount;
  state.fluxDepotPackets.push({depotId:depot.id,amount,
   startX:source.at.x,startY:source.at.y,
   launchedAt:time,arriveAt:time+.5+sourceDistance/FLUX_DEPOT.packetSpeed});
  incoming.set(depot.id,(incoming.get(depot.id)||0)+amount);
 }
}
export function drawFluxDepots(ctx,game,cam,preview=null){
 const state=game.world?.contours;if(!state)return;
 const time=game.time;
 for(const depot of state.fluxDepots||[]){
  if(depot.x<cam.x-85||depot.x>cam.x+cam.w+85||
     depot.y<cam.y-85||depot.y>cam.y+cam.h+85)continue;
  const online=depot.hp>0&&depot.readyAt<=time;
  ctx.save();ctx.translate(depot.x,depot.y);
  const pulse=game.visuals?.reducedMotion?0:Math.sin(time*2.1+depot.id)*.12;
  ctx.shadowColor='#59e4ed';ctx.shadowBlur=online?16:4;
  ctx.fillStyle=depot.hp>0?'#12334d':'#3d343d';
  ctx.strokeStyle=online?'#7bece8':'#718a9b';ctx.lineWidth=3;
  ctx.beginPath();for(let i=0;i<6;i++){
   const angle=Math.PI/3*i-Math.PI/6,x=Math.cos(angle)*38,y=Math.sin(angle)*38;
   if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
  }ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  for(let i=0;i<3;i++){
   const a=i*Math.PI*2/3+Math.PI/6;
   ctx.save();ctx.rotate(a);ctx.fillStyle='#486d88';ctx.fillRect(-8,-34,16,18);
   ctx.fillStyle='#9befff';ctx.fillRect(-5,-31,10,11);ctx.restore();
  }
  ctx.fillStyle='#12293b';ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#6ef4df';ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(0,0,17,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(depot.stored/depotCapacity(depot),0,1));ctx.stroke();
  ctx.fillStyle=online?'#effff7':'#a2c0cb';ctx.font='bold 12px system-ui';ctx.textAlign='center';
  ctx.fillText(depot.hp<=0?'×':depot.stored.toFixed(1),0,4);
  ctx.restore();
 }
 for(const packet of state.fluxDepotPackets||[]){
  const end=state.fluxDepots.find(t=>t.id===packet.depotId);if(!end)continue;
  const t=clamp((time-packet.launchedAt)/(packet.arriveAt-packet.launchedAt),0,1);
  const x=packet.startX+(end.x-packet.startX)*t,y=packet.startY+(end.y-packet.startY)*t;
  if(x<cam.x||y<cam.y||x>cam.x+cam.w||y>cam.y+cam.h)continue;
  ctx.save();ctx.fillStyle='#b4fff2';ctx.shadowColor='#66e7fa';ctx.shadowBlur=15;
  ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 const hover=game.tacticalPointer,rect=hover&&game.canvas?.getBoundingClientRect?.();
 const pointer=rect?.width?{x:cam.x+(hover.x-rect.left)/rect.width*cam.w,
  y:cam.y+(hover.y-rect.top)/rect.height*cam.h}:null;
 const selected=game.artilleryMenuTarget?.kind==='flux-depot'?game.artilleryMenuTarget:
  (pointer?depotAt(game.world,pointer):null);
 if(selected){
  ctx.save();ctx.setLineDash([7,7]);ctx.strokeStyle='#84eafa';ctx.lineWidth=2;
  const old=game.turretRangeBefore;
  if(old?.turret===selected&&old.expires>time){
   ctx.strokeStyle='#adabc3';ctx.beginPath();ctx.arc(selected.x,selected.y,old.range,0,Math.PI*2);ctx.stroke();
   ctx.strokeStyle='#84eafa';
  }
  ctx.beginPath();ctx.arc(selected.x,selected.y,depotSupplyRadius(selected),0,Math.PI*2);ctx.stroke();
  ctx.restore();
 }
 if(preview){
  const offer=depotOffer(game.world,preview.player,preview.point);
  ctx.save();ctx.strokeStyle=offer.ok?'#78f5c9':'#f17874';ctx.lineWidth=2;
  ctx.setLineDash([8,6]);ctx.beginPath();ctx.arc(preview.point.x,preview.point.y,38,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([10,13]);ctx.strokeStyle='rgba(132,230,241,.4)';
  ctx.beginPath();ctx.arc(preview.point.x,preview.point.y,FLUX_DEPOT.supplyRadius,0,Math.PI*2);ctx.stroke();
  ctx.restore();
 }
}
export function validFluxDepots(state){
 const depots=state?.fluxDepots||[],packets=state?.fluxDepotPackets||[],serial=state?.fluxDepotSerial||0;
 if(!Array.isArray(depots)||depots.length>FLUX_DEPOT.maxDepots||
  !Array.isArray(packets)||packets.length>FLUX_DEPOT.maxPackets||
  !Number.isSafeInteger(serial)||serial<0||serial>1e9)return false;
 const ids=new Set(),finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
 for(const t of depots){
  if(!t||t.kind!=='flux-depot'||!Number.isInteger(t.id)||t.id<1||t.id>serial||ids.has(t.id)||
   !finite(t.x,-1e9,1e9)||!finite(t.y,-1e9,1e9)||!finite(t.hp,0,100)||
   (t.r!==undefined&&t.r!==38)||
   t.maxHp!==100||(t.level!==undefined&&(!Number.isInteger(t.level)||t.level<0||t.level>3))||
   !finite(t.stored,0,depotCapacity(t)+.0001)||
   !finite(t.chargeCredit,0,1.0001)||!finite(t.readyAt,0,1e9))return false;
  ids.add(t.id);
 }
 for(const p of packets)if(!p||!ids.has(p.depotId)||
  !finite(p.amount,.25,.5)||Math.round(p.amount*4)!==p.amount*4||
  !finite(p.startX,-1e9,1e9)||!finite(p.startY,-1e9,1e9)||
  !finite(p.launchedAt,0,1e9)||!finite(p.arriveAt,p.launchedAt,p.launchedAt+1e6))return false;
 return true;
}
