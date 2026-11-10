import {contourFields,fieldAt} from './territory-system.js?v=flux-siphon-roads-1';
import {productiveContourFields} from './contour-trials.js';
import {depotAt,depotCapacity} from './flux-depots.js?v=flux-siphon-roads-1';
import {stationFluxCapacity} from './territory-economy.js?v=flux-siphon-roads-1';

// Cargo stays in one place: station, warehouse, or a real in-flight siphon.
export const SIPHON_HIVE=Object.freeze({name:'Сифонный улей',oreCost:25,fluxCost:4,
 buildSeconds:4,buildRadius:560,maxHives:24,maxHp:90,clearance:130});
export const FLUX_ROAD=Object.freeze({oreCost:16,fluxCost:3,maxLength:2500,
 maxRoads:72,maxPackets:256,maxLinksPerDepot:4,baseSpeed:240});
const hiveSprite=typeof Image==='undefined'?null:new Image();
if(hiveSprite)hiveSprite.src=new URL('./assets/artillery/flux-siphon-nest.svg',import.meta.url).href;
const UPGRADES=[{ore:20,flux:4},{ore:34,flux:8},{ore:52,flux:14}];
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const active=x=>x?.hp>0;
const fieldsOf=world=>productiveContourFields(world,contourFields(world));
const getField=(world,p,fields)=>fieldAt(world,p.x,p.y,fields);
export const hiveWorkers=h=>2+2*(h?.level||0);
export const hiveCargo=h=>.25*(1+(h?.level||0));
export function hiveAt(world,point,radius=43){
 return (world?.contours?.fluxSiphonHives||[]).find(h=>active(h)&&d(h,point)<radius)||null;
}
export function hiveOffer(world,player,point){
 const state=world?.contours;
 if(!state||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))
  return {ok:false,reason:'Укажите место улья'};
 if(!(state.trials?.completed>0))return {ok:false,reason:'Сначала защитите первый треугольник'};
 const field=getField(world,point,fieldsOf(world));
 if(!field)return {ok:false,reason:'Улей должен стоять в защищённом треугольнике'};
 if(d(player,point)>SIPHON_HIVE.buildRadius)return {ok:false,reason:'Слишком далеко от корабля'};
 if(d(player,point)<75)return {ok:false,reason:'Освободите место у корабля'};
 if((state.fluxSiphonHives||[]).filter(active).length>=SIPHON_HIVE.maxHives)
  return {ok:false,reason:'Достигнут предел ульев'};
 if([...(state.fluxSiphonHives||[]),...(state.fluxDepots||[]),
  ...(state.artillery||[]),...(state.supportTurrets||[])].some(s=>
  (active(s)||!['flux-depot','flux-siphon-hive'].includes(s.kind))&&
  d(s,point)<SIPHON_HIVE.clearance))return {ok:false,reason:'Слишком близко к сооружению'};
 if([...world.stations.values()].some(s=>d(s,point)<120))
  return {ok:false,reason:'Слишком близко к станции'};
 if((player.ore||0)<SIPHON_HIVE.oreCost)return {ok:false,reason:'Нужно 25 сплава'};
 if((state.flux||0)<SIPHON_HIVE.fluxCost)return {ok:false,reason:'Нужно 4 флюкса'};
 return {ok:true,field,connection:{cable:d(point,field.center)}};
}
export function buildHive(world,player,point,time){
 const offer=hiveOffer(world,player,point);if(!offer.ok)return offer;
 const state=world.contours;state.fluxSiphonHives??=[];state.fluxSiphonSerial??=0;
 if(state.fluxSiphonHives.length>=SIPHON_HIVE.maxHives)
  state.fluxSiphonHives=state.fluxSiphonHives.filter(active);
 const hive={kind:'flux-siphon-hive',id:++state.fluxSiphonSerial,x:point.x,y:point.y,
  r:37,hp:SIPHON_HIVE.maxHp,maxHp:SIPHON_HIVE.maxHp,level:0,
  readyAt:time+SIPHON_HIVE.buildSeconds};
 state.fluxSiphonHives.push(hive);player.ore-=SIPHON_HIVE.oreCost;
 state.flux-=SIPHON_HIVE.fluxCost;return {...offer,hive};
}
export function hiveUpgradeOffer(world,player,hive,time){
 const price=UPGRADES[hive?.level||0];
 if(!active(hive))return {ok:false,reason:'Улей разрушен'};
 if(time<hive.readyAt)return {ok:false,reason:'Улей ещё строится'};
 if(!price)return {ok:false,reason:'Все улучшения куплены'};
 if((player.ore||0)<price.ore)return {ok:false,reason:'Нужно '+price.ore+' сплава',...price};
 if((world.contours.flux||0)<price.flux)return {ok:false,reason:'Нужно '+price.flux+' флюкса',...price};
 return {ok:true,...price};
}
export function upgradeHive(world,player,hive,time){
 const offer=hiveUpgradeOffer(world,player,hive,time);if(!offer.ok)return offer;
 player.ore-=offer.ore;world.contours.flux-=offer.flux;hive.level++;
 return {...offer,level:hive.level};
}
function roadInFields(a,b,fields){
 const n=Math.max(1,Math.ceil(d(a,b)/80));
 for(let i=0;i<=n;i++){
  const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};
  if(!fields.some(f=>getField(null,p,[f])))return false;
 }
 return true;
}
const roadPathCache=new WeakMap();
function roadPathOnline(road,a,b,fields,signature){
 const cached=roadPathCache.get(road);
 if(cached?.signature===signature)return cached.online;
 const online=roadInFields(a,b,fields);
 roadPathCache.set(road,{signature,online});return online;
}
export function roadOffer(world,player,from,to){
 const state=world?.contours,depots=state?.fluxDepots||[];
 if(!state||!from||!to||!depots.includes(from)||!depots.includes(to)||
  from===to||!active(from)||!active(to))return {ok:false,reason:'Выберите два действующих склада'};
 const fields=fieldsOf(world),first=getField(world,from,fields),second=getField(world,to,fields);
 if(!first||!second||first.id===second.id)
  return {ok:false,reason:'Нужны склады двух разных защищённых треугольников'};
 if(d(from,to)>FLUX_ROAD.maxLength)return {ok:false,reason:'Дорога длиннее 2500 м'};
 if(!roadInFields(from,to,fields))return {ok:false,reason:'Дорога выходит за пределы защищённой территории'};
 const roads=state.fluxRoads||[];
 if(roads.length>=FLUX_ROAD.maxRoads)return {ok:false,reason:'Достигнут предел дорог'};
 if(roads.some(r=>r.fromId===from.id&&r.toId===to.id||
  r.fromId===to.id&&r.toId===from.id))return {ok:false,reason:'Склады уже соединены'};
 if([from.id,to.id].some(id=>roads.filter(r=>r.fromId===id||r.toId===id).length>=
  FLUX_ROAD.maxLinksPerDepot))return {ok:false,reason:'У склада уже четыре дороги'};
 if((player.ore||0)<FLUX_ROAD.oreCost)return {ok:false,reason:'Нужно 16 сплава'};
 if((state.flux||0)<FLUX_ROAD.fluxCost)return {ok:false,reason:'Нужно 3 флюкса'};
 return {ok:true,fromField:first,toField:second,connection:{cable:d(from,to)}};
}
export function buildRoad(world,player,from,to,time){
 const offer=roadOffer(world,player,from,to);if(!offer.ok)return offer;
 const state=world.contours;state.fluxRoads??=[];state.fluxRoadSerial??=0;
 const road={id:++state.fluxRoadSerial,fromId:from.id,toId:to.id,
  readyAt:time+2,nextLaunchAt:time+2};
 state.fluxRoads.push(road);player.ore-=FLUX_ROAD.oreCost;state.flux-=FLUX_ROAD.fluxCost;
 return {...offer,road};
}
export function roadCrew(world,field,time,fields=fieldsOf(world)){
 const stations=(field?.vertices||[]).filter(id=>{
  const s=world.stations.get(id);return s?.active&&!s.enemy&&!s.suppressed;
 }).length;
 const hives=(world.contours.fluxSiphonHives||[]).filter(h=>active(h)&&h.readyAt<=time&&
  getField(world,h,fields)?.id===field?.id);
 const count=clamp(stations+hives.reduce((n,h)=>n+hiveWorkers(h),0),0,18);
 const rank=Math.max(0,...hives.map(h=>h.level||0));
 return {count,cargo:.25*(rank+1),speed:FLUX_ROAD.baseSpeed+rank*65};
}
export function advanceFluxRoads(world,time,dt){
 const state=world?.contours;if(!state||dt<=0)return;
 state.fluxRoads??=[];state.fluxRoadPackets??=[];
 const depots=new Map((state.fluxDepots||[]).map(d=>[d.id,d])),fields=fieldsOf(world),
  signature=fields.map(f=>f.id).join('~');
 const online=new Map(state.fluxRoads.map(r=>{
  const a=depots.get(r.fromId),b=depots.get(r.toId);
  const first=a&&getField(world,a,fields),second=b&&getField(world,b,fields);
  return [r.id,!!(active(a)&&active(b)&&a.readyAt<=time&&b.readyAt<=time&&
   first&&second&&first.id!==second.id&&roadPathOnline(r,a,b,fields,signature))];
 }));
 const roads=new Map(state.fluxRoads.map(r=>[r.id,r]));
 for(const p of state.fluxRoadPackets){
  const target=depots.get(p.toId);
  if(!roads.has(p.roadId)||!online.get(p.roadId)||!active(target)){
   p.done=true;state.fluxSpilled=(state.fluxSpilled||0)+p.amount;continue;
  }
  if(time>=p.arriveAt){
   const accepted=Math.min(p.amount,Math.max(0,depotCapacity(target)-target.stored));
   target.stored+=accepted;state.fluxSpilled=(state.fluxSpilled||0)+p.amount-accepted;
   p.done=true;
  }
 }
 state.fluxRoadPackets=state.fluxRoadPackets.filter(p=>!p.done);
 const incoming=new Map(),working=new Map();
 for(const p of state.fluxRoadPackets){
  incoming.set(p.toId,(incoming.get(p.toId)||0)+p.amount);
  const source=depots.get(p.fromId),field=source&&getField(world,source,fields);
  if(field)working.set(field.id,(working.get(field.id)||0)+1);
 }
 for(const p of state.fluxDepotPackets||[])
  incoming.set(p.depotId,(incoming.get(p.depotId)||0)+p.amount);
 for(const r of state.fluxRoads){
  if(!online.get(r.id)||time<r.readyAt||time<r.nextLaunchAt||
    state.fluxRoadPackets.length>=FLUX_ROAD.maxPackets)continue;
  const a=depots.get(r.fromId),b=depots.get(r.toId);
  const aFill=(a.stored+(incoming.get(a.id)||0))/depotCapacity(a),
   bFill=(b.stored+(incoming.get(b.id)||0))/depotCapacity(b);
  if(Math.abs(aFill-bFill)<.12)continue;
  const source=aFill>bFill?a:b,target=source===a?b:a;
  const field=getField(world,source,fields),crew=roadCrew(world,field,time,fields);
  if((working.get(field.id)||0)>=crew.count)continue;
  const available=source.stored-Math.max(1,depotCapacity(source)*.12),
   space=depotCapacity(target)-target.stored-(incoming.get(target.id)||0);
  const amount=Math.floor((Math.min(crew.cargo,available,space)+1e-8)/.25)*.25;
  if(amount<.25)continue;
  source.stored-=amount;
  state.fluxRoadPackets.push({roadId:r.id,fromId:source.id,toId:target.id,amount,
   launchedAt:time,arriveAt:time+.35+d(source,target)/crew.speed});
  incoming.set(target.id,(incoming.get(target.id)||0)+amount);
  working.set(field.id,(working.get(field.id)||0)+1);
  // More hired siphons must help even on a single road, not only on forks.
  // In-flight crew still caps throughput for long routes.
  r.nextLaunchAt=time+Math.max(.12,1.5/Math.max(1,crew.count)-
   .08*(crew.cargo/.25-1));
 }
}
export function drawFluxRoads(ctx,game,cam,preview=null){
 const state=game.world?.contours;if(!state)return;
 const depots=new Map((state.fluxDepots||[]).map(x=>[x.id,x]));
 const fields=fieldsOf(game.world),signature=fields.map(f=>f.id).join('~'),online=r=>{
  const a=depots.get(r.fromId),b=depots.get(r.toId);
  return active(a)&&active(b)&&getField(game.world,a,fields)&&
   getField(game.world,b,fields)&&roadPathOnline(r,a,b,fields,signature);
 };
 for(const road of state.fluxRoads||[]){
  const a=depots.get(road.fromId),b=depots.get(road.toId);if(!a||!b)continue;
  if(Math.max(a.x,b.x)<cam.x-200||Math.min(a.x,b.x)>cam.x+cam.w+200||
   Math.max(a.y,b.y)<cam.y-200||Math.min(a.y,b.y)>cam.y+cam.h+200)continue;
  const valid=online(road);
  ctx.save();ctx.lineCap='round';ctx.strokeStyle=valid?'rgba(240,157,54,.2)':'rgba(110,120,135,.18)';
  ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.setLineDash([14,13]);ctx.strokeStyle=valid?'#c99454':'#687887';ctx.lineWidth=2.2;
  ctx.lineDashOffset=game.visuals?.reducedMotion?0:-game.time*18;ctx.stroke();ctx.restore();
 }
 if(preview?.from&&preview.point){
  const to=depotAt(game.world,preview.point,70),end=to||preview.point;
  const valid=roadOffer(game.world,preview.player,preview.from,to).ok;
  ctx.save();ctx.setLineDash([12,10]);ctx.lineWidth=3;ctx.strokeStyle=valid?'#ffc871':'#dd7979';
  ctx.beginPath();ctx.moveTo(preview.from.x,preview.from.y);ctx.lineTo(end.x,end.y);ctx.stroke();
  ctx.restore();
 }
 for(const p of state.fluxRoadPackets||[]){
  const a=depots.get(p.fromId),b=depots.get(p.toId);if(!a||!b)continue;
  const t=clamp((game.time-p.launchedAt)/Math.max(.01,p.arriveAt-p.launchedAt),0,1),
   x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
  if(x<cam.x-30||x>cam.x+cam.w+30||y<cam.y-30||y>cam.y+cam.h+30)continue;
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
  ctx.fillStyle='#20475c';ctx.strokeStyle='#8feaf2';ctx.lineWidth=1.3;
  ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-5);ctx.lineTo(-3,0);ctx.lineTo(-6,5);
  ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ffcd71';ctx.shadowColor='#ffb342';
  ctx.shadowBlur=game.visuals?.reducedMotion?0:12;ctx.beginPath();ctx.arc(-1,0,2.7+p.amount,0,Math.PI*2);
  ctx.fill();ctx.restore();
 }
}
export function drawSiphonHives(ctx,game,cam,preview=null){
 const state=game.world?.contours;if(!state)return;
 for(const h of state.fluxSiphonHives||[]){
  if(h.x<cam.x-70||h.x>cam.x+cam.w+70||h.y<cam.y-70||h.y>cam.y+cam.h+70)continue;
  ctx.save();ctx.translate(h.x,h.y);
  const online=active(h)&&h.readyAt<=game.time;
  if(hiveSprite?.complete&&hiveSprite.naturalWidth){
   ctx.globalAlpha=online?1:.55;
   ctx.drawImage(hiveSprite,-37,-37,74,74);
   ctx.globalAlpha=1;
  }else{
   ctx.fillStyle=online?'#193e50':'#39424a';ctx.strokeStyle='#d5a260';ctx.lineWidth=2.2;
   ctx.beginPath();for(let i=0;i<6;i++){
    const a=i*Math.PI/3;if(i)ctx.lineTo(Math.cos(a)*34,Math.sin(a)*34);
    else ctx.moveTo(Math.cos(a)*34,Math.sin(a)*34);
   }ctx.closePath();ctx.fill();ctx.stroke();
  }
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3+(game.visuals?.reducedMotion?0:game.time*.1);
   ctx.fillStyle=online?'#ffcc70':'#7c6855';ctx.shadowColor='#ffaf40';ctx.shadowBlur=online?7:0;
   ctx.beginPath();ctx.arc(Math.cos(a)*18,Math.sin(a)*18,3+(h.level||0)*.3,0,Math.PI*2);ctx.fill();
  }
  ctx.shadowBlur=0;ctx.fillStyle='#fff2bf';ctx.textAlign='center';ctx.font='bold 12px system-ui';
  ctx.fillText('×'+hiveWorkers(h),0,5);ctx.restore();
 }
 if(preview){
  ctx.save();ctx.strokeStyle=hiveOffer(game.world,preview.player,preview.point).ok?'#ffce76':'#e77f72';
  ctx.setLineDash([9,7]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(preview.point.x,preview.point.y,37,0,Math.PI*2);
  ctx.stroke();ctx.restore();
 }
 const stations=game.world.stations.values();
 for(const s of stations){
  if(s.fluxStored===undefined||s.x<cam.x-65||s.x>cam.x+cam.w+65||
   s.y<cam.y-65||s.y>cam.y+cam.h+65)continue;
  const fullness=clamp(s.fluxStored/stationFluxCapacity(s),0,1);
  ctx.save();ctx.fillStyle='#172e41';ctx.strokeStyle='#8b734d';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(s.x-24,s.y+41,48,12,5);ctx.fill();ctx.stroke();
  for(let i=0;i<5;i++){
   const lit=(i+.5)/5<=fullness;ctx.fillStyle=lit?'#ffbf61':'#465b64';
   ctx.shadowColor='#ffb04b';ctx.shadowBlur=lit&&!game.visuals?.reducedMotion?6:0;
   ctx.beginPath();ctx.arc(s.x-16+i*8,s.y+47,2.9,0,Math.PI*2);ctx.fill();
  }ctx.restore();
 }
}
export function validFluxRoutes(state){
 const hives=state?.fluxSiphonHives||[],roads=state?.fluxRoads||[],
  packets=state?.fluxRoadPackets||[],depots=state?.fluxDepots||[];
 const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
 if(!Array.isArray(hives)||hives.length>SIPHON_HIVE.maxHives||
  !Array.isArray(roads)||roads.length>FLUX_ROAD.maxRoads||
  !Array.isArray(packets)||packets.length>FLUX_ROAD.maxPackets||
  !Number.isSafeInteger(state.fluxSiphonSerial??0)||(state.fluxSiphonSerial??0)<0||
  !Number.isSafeInteger(state.fluxRoadSerial??0)||(state.fluxRoadSerial??0)<0)return false;
 const hiveIds=new Set();
 for(const h of hives){
  if(!h||h.kind!=='flux-siphon-hive'||!Number.isInteger(h.id)||h.id<1||
   h.id>(state.fluxSiphonSerial||0)||hiveIds.has(h.id)||
   !finite(h.x,-1e9,1e9)||!finite(h.y,-1e9,1e9)||!finite(h.hp,0,SIPHON_HIVE.maxHp)||
   h.maxHp!==SIPHON_HIVE.maxHp||h.r!==37||!Number.isInteger(h.level)||
   h.level<0||h.level>3||!finite(h.readyAt,0,1e9))return false;
  hiveIds.add(h.id);
 }
 const ids=new Set(depots.map(x=>x.id)),roadIds=new Set(),pairs=new Set(),degrees=new Map();
 for(const r of roads){
  if(!r||!Number.isInteger(r.id)||r.id<1||r.id>(state.fluxRoadSerial||0)||
   roadIds.has(r.id)||!ids.has(r.fromId)||!ids.has(r.toId)||r.fromId===r.toId||
   !finite(r.readyAt,0,1e9)||!finite(r.nextLaunchAt,0,1e9))return false;
  roadIds.add(r.id);const key=[r.fromId,r.toId].sort((a,b)=>a-b).join('|');
  if(pairs.has(key))return false;pairs.add(key);
  for(const id of [r.fromId,r.toId]){
   const degree=(degrees.get(id)||0)+1;if(degree>FLUX_ROAD.maxLinksPerDepot)return false;
   degrees.set(id,degree);
  }
 }
 for(const p of packets){
  const r=roads.find(x=>x.id===p.roadId);
  if(!r||!((r.fromId===p.fromId&&r.toId===p.toId)||
   (r.fromId===p.toId&&r.toId===p.fromId))||
   !finite(p.amount,.25,1)||Math.abs(p.amount*4-Math.round(p.amount*4))>1e-7||
   !finite(p.launchedAt,0,1e9)||!finite(p.arriveAt,p.launchedAt,p.launchedAt+1e6))return false;
 }
 return true;
}
