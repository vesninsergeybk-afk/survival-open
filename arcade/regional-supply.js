import {REGIONS} from './regions.js?v=regions-1';
import {commandStateValid} from './strategic-command.js?v=campaign-1-repair-qa-1';
import {createCentralIndustry,advanceCentralIndustry,interceptCentralCargo,centralIndustryValid,CENTRAL_INDUSTRY,centralEvent} from './central-industry.js?v=living-world-1-home-conflict-1';
import {createFrontierIndustry,advanceFrontierIndustry,interceptFrontierCargo,interceptFrontierRepair,frontierIndustryValid,captureFrontierStation} from './frontier-industry.js?v=living-world-3-radio-shadow-1-expedition-1-repair-qa-1';
export const SUPPLY=Object.freeze({mineId:'28:5',militaryId:'4:-32',
 production:.2,capacity:24,cargoCost:12,dispatchPeriod:90,speed:220,
 assembly:28,raidPeriod:95,warning:10,oreReward:12,dataReward:15});
export const STRATEGIC_STATIONS=Object.freeze([
 {id:SUPPLY.mineId,x:35000,y:7000,type:'arsenal',rank:1,strategicRole:'mine',
  title:'Добывающий комплекс',hp:260,turrets:2,turretHp:65},
 {id:SUPPLY.militaryId,x:6000,y:-40000,type:'carrier',rank:3,strategicRole:'military',
  title:'Военный узел',hp:650,turrets:3,turretHp:110}
]);
export const SUPPLY_ROUTE=Object.freeze([
 {x:35000,y:7000},{x:32000,y:-9000},{x:18000,y:-25000},{x:6000,y:-40000}
].map(Object.freeze));
const routeLength=SUPPLY_ROUTE.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-SUPPLY_ROUTE[i].x,p.y-SUPPLY_ROUTE[i].y),0);
export function supplyPosition(distance){
 let remaining=Math.max(0,distance);
 for(let i=1;i<SUPPLY_ROUTE.length;i++){
  const a=SUPPLY_ROUTE[i-1],b=SUPPLY_ROUTE[i],d=Math.hypot(b.x-a.x,b.y-a.y);
  if(remaining<=d){const f=remaining/d;return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,
   angle:Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2};}
  remaining-=d;
 }
 const end=SUPPLY_ROUTE.at(-1);return {...end,angle:0};
}
export function createRegionalSupply(time=0){return {
 version:1,clock:Math.floor(time),ore:0,nextDispatch:Math.floor(time)+60,
 serial:0,convoys:[],reserves:0,assemblyUntil:0,nextRaid:0,pendingRaid:null,
 delivered:0,intercepted:0,raids:0,history:[],visited:['amethyst'],
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
  if(mine?.enemy&&military?.enemy&&s.ore+1e-8>=SUPPLY.cargoCost&&t>=s.nextDispatch&&s.convoys.length<2){
   s.ore=Math.max(0,s.ore-SUPPLY.cargoCost);s.nextDispatch=t+SUPPLY.dispatchPeriod;
   s.convoys.push({id:'regional-cargo-'+(++s.serial),regionalCargo:true,type:'gunship',
    distance:0,launchedAt:t,...supplyPosition(0),r:43,hp:180,maxHp:180,hit:0,seen:false});emit('dispatch',t);
  }
  for(const c of s.convoys){
   if(c.hp<=0)continue;
   c.distance=(t-c.launchedAt)*SUPPLY.speed;Object.assign(c,supplyPosition(c.distance));
   if(c.distance>=routeLength){
    c.hp=0;
    if(military?.enemy){
     s.reserves=Math.min(2,s.reserves+1);s.delivered++;
     s.assemblyUntil=Math.max(s.assemblyUntil,t+SUPPLY.assembly);emit('delivery',t);
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
  c.distance=(time-c.launchedAt)*SUPPLY.speed;Object.assign(c,supplyPosition(c.distance));
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
 return !!s&&s.version===1&&Number.isInteger(s.clock)&&num(s.clock,0,time)&&
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
   ['dispatch','delivery','diverted','raid-warning','raid','intercept','mine-captured','military-captured'].includes(e.kind)&&num(e.time,0,time))&&
  Array.isArray(s.convoys)&&s.convoys.length<=2&&new Set(s.convoys.map(c=>c.id)).size===s.convoys.length&&
  s.convoys.every(c=>c.regionalCargo===true&&/^regional-cargo-\d+$/.test(c.id)&&
   num(c.launchedAt,0,time)&&num(c.distance,0,routeLength+SUPPLY.speed)&&num(c.x,-1e9,1e9)&&num(c.y,-1e9,1e9)&&num(c.hp,.001,180)&&c.maxHp===180&&c.r===43);
}
export const supplyStatus=world=>{
 const s=world.regionalSupply,mine=world.stations.get(SUPPLY.mineId),war=world.stations.get(SUPPLY.militaryId);
 if(!s)return '';
 if(war&&!war.enemy)return 'Военный узел захвачен: организованные тяжёлые подкрепления остановлены.';
 if(mine&&!mine.enemy)return 'Источник руды захвачен. Новых отправок не будет; груз в пути и готовые резервы ещё опасны.';
 return 'Рудный пояс снабжает военный узел. Перехват груза задерживает тяжёлое подкрепление; захват комплекса останавливает новые отправки.';
};
