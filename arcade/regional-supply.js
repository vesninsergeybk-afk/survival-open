import {REGIONS} from './regions.js?v=regions-1-living-world-population-1';
import {commandStateValid} from './strategic-command.js?v=campaign-1-repair-qa-1-world-feedback-1-territory-war-1';
import {createCentralIndustry,advanceCentralIndustry,interceptCentralCargo,centralIndustryValid,CENTRAL_INDUSTRY,centralEvent} from './central-industry.js?v=living-world-1-home-conflict-1-enemy-balance-2-supply-stronghold-1-territory-war-1';
import {createFrontierIndustry,advanceFrontierIndustry,interceptFrontierCargo,interceptFrontierRepair,frontierIndustryValid,captureFrontierStation} from './frontier-industry.js?v=living-world-3-radio-shadow-1-expedition-1-repair-qa-1-supply-stronghold-1-territory-war-1';
export const SUPPLY=Object.freeze({mineId:'28:5',militaryId:'4:-32',
 production:.2,capacity:24,cargoCost:12,dispatchPeriod:90,speed:220,
 assembly:28,raidPeriod:95,warning:10,oreReward:12,dataReward:15});
export const SUPPLY_RESPONSE=Object.freeze({
 reserveCommitments:2,radioRadius:4800,reportDelay:12,missingGrace:24,
 routeCost:4,routePrep:24,screenCost:3,screenPrep:20,screenCargoCost:2,
 maxLossReports:6
});
export const STRATEGIC_STATIONS=Object.freeze([
 {id:SUPPLY.mineId,x:35000,y:7000,type:'arsenal',rank:1,strategicRole:'mine',
  title:'Добывающий комплекс',hp:260,turrets:2,turretHp:65},
 {id:SUPPLY.militaryId,x:6000,y:-40000,type:'carrier',rank:3,strategicRole:'military',
  title:'Военный узел',hp:650,turrets:3,turretHp:110}
]);
export const SUPPLY_ROUTE=Object.freeze([
 {x:35000,y:7000},{x:32000,y:-9000},{x:18000,y:-25000},{x:6000,y:-40000}
].map(Object.freeze));
export const SUPPLY_DIVERSION=Object.freeze([
 SUPPLY_ROUTE[0],{x:39000,y:-16500},{x:27000,y:-33000},SUPPLY_ROUTE.at(-1)
].map(Object.freeze));
export const supplyRoute=routeId=>routeId==='diversion'?SUPPLY_DIVERSION:SUPPLY_ROUTE;
export const supplyRouteLength=routeId=>supplyRoute(routeId).slice(1).reduce((n,p,i)=>
 n+Math.hypot(p.x-supplyRoute(routeId)[i].x,p.y-supplyRoute(routeId)[i].y),0);
// A visual sighting leaves a last-known point, never a perpetual live beacon.
// Laboratory intercepts use their own verified radio-contact rules.
export const cargoLastContact=(cargo,time,maxAge=100)=>{
 if(!cargo?.seen||!Number.isFinite(cargo.lastSeenAt)||
  !Number.isFinite(cargo.lastSeenX)||!Number.isFinite(cargo.lastSeenY)||
  time<cargo.lastSeenAt||time-cargo.lastSeenAt>maxAge)return null;
 return {x:cargo.lastSeenX,y:cargo.lastSeenY,live:time-cargo.lastSeenAt<1.5};
};
export function supplyPosition(distance,routeId='direct'){
 const route=supplyRoute(routeId);
 let remaining=Math.max(0,distance);
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],d=Math.hypot(b.x-a.x,b.y-a.y);
  if(remaining<=d){const f=remaining/d;return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,
   angle:Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2};}
  remaining-=d;
 }
 const end=route.at(-1);return {...end,angle:0};
}
const northernStrategy=()=>({route:'direct',routePlan:null,screenPlan:null,
 screened:false,knownLosses:0,pendingLosses:[]});
const northernState=s=>{
 s.strategy??=northernStrategy();
 s.strategy.pendingLosses??=[];
 return s.strategy;
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// A destroyed freighter can report a loss through a surviving station radio.
// Otherwise only its missed arrival gives the depot evidence of the loss.
function reportNorthernLoss(world,cargo,time){
 const s=world.regionalSupply,st=northernState(s);
 const linked=[SUPPLY.mineId,SUPPLY.militaryId].some(id=>{
  const station=world.stations.get(id);
  return station?.enemy&&distance(station,cargo)<=SUPPLY_RESPONSE.radioRadius;
 });
 const dueAt=linked?Math.floor(time)+SUPPLY_RESPONSE.reportDelay:
  Math.max(Math.floor(time)+1,Math.ceil(cargo.launchedAt+
   supplyRouteLength(cargo.routeId)/SUPPLY.speed)+SUPPLY_RESPONSE.missingGrace);
 st.pendingLosses.push({dueAt,at:Math.floor(time),route:cargo.routeId||'direct',delayed:!linked});
 st.pendingLosses=st.pendingLosses.slice(-SUPPLY_RESPONSE.maxLossReports);
}
function advanceNorthernStrategy(s,source,depot,t,emit){
 const st=northernState(s);
 for(const loss of st.pendingLosses.filter(loss=>loss.dueAt<=t)){
  // Old-route ambushes are not evidence that the newly chosen bypass is bad.
  if(loss.route===st.route)st.knownLosses=Math.min(8,st.knownLosses+1);
  if(loss.delayed)emit('shipment-overdue',t);
 }
 st.pendingLosses=st.pendingLosses.filter(loss=>loss.dueAt>t);
 if(!source?.enemy||!depot?.enemy)return;
 if(st.routePlan&&t>=st.routePlan.readyAt){
  st.route='diversion';st.routePlan=null;st.knownLosses=0;
  emit('route-changed',t);
 }
 if(st.screenPlan&&t>=st.screenPlan.readyAt){
  st.screened=true;st.screenPlan=null;emit('screen-ready',t);
 }
 if(st.knownLosses>=2&&!st.routePlan&&st.route==='direct'&&
    s.ore>=SUPPLY_RESPONSE.routeCost){
  s.ore-=SUPPLY_RESPONSE.routeCost;st.knownLosses-=2;
  st.routePlan={readyAt:t+SUPPLY_RESPONSE.routePrep};emit('route-prep',t);
 }else if(st.knownLosses>=2&&st.route==='diversion'&&!st.screened&&
     !st.screenPlan&&s.ore>=SUPPLY_RESPONSE.screenCost){
  s.ore-=SUPPLY_RESPONSE.screenCost;st.knownLosses-=2;
  st.screenPlan={readyAt:t+SUPPLY_RESPONSE.screenPrep};emit('screen-prep',t);
 }
}
export function createRegionalSupply(time=0){return {
 version:1,clock:Math.floor(time),ore:0,nextDispatch:Math.floor(time)+60,
 serial:0,convoys:[],reserves:0,assemblyUntil:0,nextRaid:0,pendingRaid:null,
 delivered:0,intercepted:0,raids:0,history:[],visited:['amethyst'],
 strategy:northernStrategy(),
 central:createCentralIndustry(time),frontier:createFrontierIndustry(time)
};}
export function supplyEvent(state,kind,time){
 const e={kind,time};state.history.push(e);state.history=state.history.slice(-6);return e;
}
// Called once per simulation second. No wall-clock/offline growth, and no global
// procedural-world traversal. A captured source never regenerates silently.
export function advanceRegionalSupply(world,time){
 const s=world.regionalSupply,events=[];
 if(!s)return events;
 // Legacy checkpoints have no small industrial loop. Start it from the saved
 // simulation clock, never simulate unseen production retrospectively.
 if(!s.central)s.central=createCentralIndustry(s.clock);
 // A legacy checkpoint has never simulated these regions. Begin at the
 // current game instant; do not grant years of unseen production on load.
 if(!s.frontier)s.frontier=createFrontierIndustry(time);
 const mine=world.stations.get(SUPPLY.mineId),military=world.stations.get(SUPPLY.militaryId);
 const emit=(kind,t)=>events.push(supplyEvent(s,kind,t));
 while(s.clock<Math.floor(time)){
  const t=++s.clock;
  if(mine?.enemy)s.ore=Math.min(SUPPLY.capacity,s.ore+SUPPLY.production);
  advanceNorthernStrategy(s,mine,military,t,emit);
  const st=northernState(s),screened=st.screened;
  const cargoCost=SUPPLY.cargoCost+(screened?SUPPLY_RESPONSE.screenCargoCost:0);
  // Two ready reserves are the store's limit; a pending sortie has already
  // spent its reserve. Do not waste ore on cargo without a receiving slot.
  const commitments=s.reserves+s.convoys.length;
  if(mine?.enemy&&military?.enemy&&!(military.fluxBreachUntil>t)&&s.ore+1e-8>=cargoCost&&
     t>=s.nextDispatch&&s.convoys.length<2&&
     commitments<SUPPLY_RESPONSE.reserveCommitments){
   s.ore=Math.max(0,s.ore-cargoCost);s.nextDispatch=t+SUPPLY.dispatchPeriod;
   s.convoys.push({id:'regional-cargo-'+(++s.serial),regionalCargo:true,type:'gunship',
    distance:0,launchedAt:t,routeId:st.route,screened,
    ...supplyPosition(0,st.route),r:43,hp:180,maxHp:180,hit:0,seen:false});
   emit(screened?'screen-dispatch':'dispatch',t);
  }
  for(const c of s.convoys){
   if(c.hp<=0)continue;
   c.distance=(t-c.launchedAt)*SUPPLY.speed;Object.assign(c,supplyPosition(c.distance,c.routeId));
   if(c.distance>=supplyRouteLength(c.routeId)){
    c.hp=0;
    if(military?.enemy){
     if(s.reserves<2){s.reserves++;s.delivered++;
      s.assemblyUntil=Math.max(s.assemblyUntil,t+SUPPLY.assembly);emit('delivery',t);}
     else emit('overflow',t); // Old checkpoints may contain surplus cargo.
    }else emit('diverted',t);
   }
  }
  s.convoys=s.convoys.filter(c=>c.hp>0);
  if(!military?.enemy){s.reserves=0;s.pendingRaid=null;}
  if(military?.enemy&&s.reserves>0&&!s.pendingRaid&&t>=s.assemblyUntil&&t>=s.nextRaid){
   s.reserves--;s.pendingRaid={readyAt:t+SUPPLY.warning};emit('raid-warning',t);
  }
 }
 for(const c of s.convoys){
  c.distance=(time-c.launchedAt)*SUPPLY.speed;Object.assign(c,supplyPosition(c.distance,c.routeId));
 }
 return events.concat(advanceCentralIndustry(world,time),advanceFrontierIndustry(world,time));
}
export function interceptSupply(world,cargo,time){
 if(cargo.frontierRepair)return interceptFrontierRepair(world,cargo,time);
 if(cargo.frontierCargo)return interceptFrontierCargo(world,cargo,time);
 if(cargo.centralCargo)return interceptCentralCargo(world,cargo,time);
 const s=world.regionalSupply;
 if(!s?.convoys.includes(cargo)||cargo.rewarded||cargo.hp>0)return false;
 cargo.rewarded=true;s.intercepted++;s.convoys=s.convoys.filter(c=>c!==cargo);
 reportNorthernLoss(world,cargo,time);
 supplyEvent(s,'intercept',time);return true;
}
export function strategicCapture(world,base,time){
 if(!base.strategicRole)return false;
 if(base.strategicRole.startsWith('frontier-')){
  if(!world.regionalSupply.frontier)
   world.regionalSupply.frontier=createFrontierIndustry(time);
  return captureFrontierStation(world,base,time);
 }
 if(base.strategicRole.startsWith('central-')&&!world.regionalSupply.central)
  world.regionalSupply.central=createCentralIndustry(world.regionalSupply.clock);
 if(base.strategicRole==='central-source'){
  const worker=world.regionalSupply.central?.worker;
  if(worker){worker.phase='evacuated';worker.carry=0;}
  centralEvent(world.regionalSupply.central,'central-source-captured',time);
  return true;
 }
 if(base.strategicRole==='central-depot'){
  const s=world.regionalSupply.central;
  if(s){s.reserves=0;s.pendingRaid=null;centralEvent(s,'central-depot-captured',time);}
  return true;
 }
 if(base.strategicRole==='military'){
  world.regionalSupply.reserves=0;world.regionalSupply.pendingRaid=null;
 }
 supplyEvent(world.regionalSupply,base.strategicRole==='mine'?'mine-captured':'military-captured',time);
 return true;
}
export function regionalSupplyValid(s,time){
 const num=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
 const cargoMetadataValid=c=>{
  const last=c.lastSeenAt===undefined&&c.lastSeenX===undefined&&c.lastSeenY===undefined||
   num(c.lastSeenAt,0,time)&&num(c.lastSeenX,-1e9,1e9)&&num(c.lastSeenY,-1e9,1e9);
  const escorts=c.escortManifest===undefined||c.escorted===true&&
   Array.isArray(c.escortManifest)&&c.escortManifest.length===2&&
   c.escortManifest.every(m=>m&&['fighter','flanker','gunship','healer'].includes(m.type)&&
    num(m.maxHp,1,10000)&&num(m.hp,0,m.maxHp));
  return last&&escorts&&(c.escorted===undefined||typeof c.escorted==='boolean');
 };
 const strategyValid=st=>st===undefined||Boolean(st&&
  ['direct','diversion'].includes(st.route)&&typeof st.screened==='boolean'&&
  Number.isInteger(st.knownLosses)&&num(st.knownLosses,0,8)&&
  (st.routePlan===null||st.routePlan&&num(st.routePlan.readyAt,0,1e9))&&
  (st.screenPlan===null||st.screenPlan&&num(st.screenPlan.readyAt,0,1e9))&&
  Array.isArray(st.pendingLosses)&&st.pendingLosses.length<=SUPPLY_RESPONSE.maxLossReports&&
  st.pendingLosses.every(l=>Number.isInteger(l.at)&&num(l.at,0,time)&&
   Number.isInteger(l.dueAt)&&num(l.dueAt,l.at,1e9)&&
   typeof l.delayed==='boolean'&&['direct','diversion'].includes(l.route)));
 return !!s&&s.version===1&&Number.isInteger(s.clock)&&num(s.clock,0,time)&&
  strategyValid(s.strategy)&&
  commandStateValid(s.command,time)&&
  (s.central===undefined||centralIndustryValid(s.central,time))&&
  (s.frontier===undefined||frontierIndustryValid(s.frontier,time))&&
  num(s.ore,0,SUPPLY.capacity)&&num(s.nextDispatch,0,1e9)&&
  Number.isSafeInteger(s.serial)&&num(s.serial,0,1e9)&&num(s.reserves,0,2)&&Number.isInteger(s.reserves)&&
  num(s.assemblyUntil,0,1e9)&&num(s.nextRaid,0,1e9)&&
  (!s.pendingRaid||num(s.pendingRaid.readyAt,0,1e9))&&
  ['delivered','intercepted','raids'].every(k=>Number.isSafeInteger(s[k])&&num(s[k],0,1e9))&&
  Array.isArray(s.visited)&&s.visited.length<=5&&s.visited.every(id=>REGIONS.some(r=>r.id===id))&&
  Array.isArray(s.history)&&s.history.length<=6&&s.history.every(e=>
   ['dispatch','delivery','diverted','overflow','raid-warning','raid','intercept','mine-captured','military-captured',
    'route-prep','route-changed','screen-prep','screen-ready','screen-dispatch','shipment-overdue'].includes(e.kind)&&num(e.time,0,time))&&
  Array.isArray(s.convoys)&&s.convoys.length<=2&&new Set(s.convoys.map(c=>c.id)).size===s.convoys.length&&
  s.convoys.every(c=>c.regionalCargo===true&&cargoMetadataValid(c)&&/^regional-cargo-\d+$/.test(c.id)&&
   [undefined,'direct','diversion'].includes(c.routeId)&&
   (c.screened===undefined||typeof c.screened==='boolean')&&
   num(c.launchedAt,0,time)&&num(c.distance,0,supplyRouteLength(c.routeId)+SUPPLY.speed)&&
   num(c.x,-1e9,1e9)&&num(c.y,-1e9,1e9)&&num(c.hp,.001,180)&&c.maxHp===180&&c.r===43)&&
  [...(s.central?.convoys||[]),...(s.frontier?.azure?.convoys||[]),...(s.frontier?.teal?.convoys||[]),
   s.frontier?.azure?.repairExpedition,s.frontier?.teal?.repairExpedition]
   .filter(Boolean).every(cargoMetadataValid);
}
export const supplyStatus=world=>{
 const s=world.regionalSupply,mine=world.stations.get(SUPPLY.mineId),war=world.stations.get(SUPPLY.militaryId);
 if(!s)return '';
 if(war&&!war.enemy)return 'Военный узел захвачен: организованные тяжёлые подкрепления остановлены.';
 if(mine&&!mine.enemy)return 'Источник руды захвачен. Новых отправок не будет; груз в пути и готовые резервы ещё опасны.';
 return 'Рудный пояс снабжает военный узел. Перехват груза задерживает тяжёлое подкрепление; захват комплекса останавливает новые отправки.';
};
