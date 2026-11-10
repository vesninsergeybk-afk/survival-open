// Territorial energy has one spendable treasury, but different producers.
// Depth is the shortest route through friendly faces to an exposed edge.
// It is derived from the current topology, so losing a border automatically
// changes the yield of the remaining faces without invalidating old saves.
const edgeKey=(a,b)=>String(a)<String(b)?a+'|'+b:b+'|'+a;
export const FLUX_LOCAL_SHARE=.72;
export const stationFluxCapacity=station=>4+8*Math.max(0,Math.min(6,station?.fluxDepth||0));
export function syncStationFluxDepths(world,fields){
 const depths=fieldDepths(fields),rank=new Map();
 for(let i=0;i<fields.length;i++)for(const id of fields[i].vertices||[])
  rank.set(id,Math.max(rank.get(id)||0,depths[i]||0));
 for(const station of world.stations.values()){
  station.fluxDepth=rank.get(station.id)||0;
  station.fluxStored??=0;
  const extra=Math.max(0,station.fluxStored-stationFluxCapacity(station));
  if(extra){station.fluxStored-=extra;world.contours.fluxSpilled=(world.contours.fluxSpilled||0)+extra;}
 }
}
export function fieldStationFree(world,field,inflight=0){
 return (field?.vertices||[]).reduce((sum,id)=>{
  const s=world.stations.get(id);
  return sum+(s?.active&&!s.enemy&&!s.suppressed?
   Math.max(0,stationFluxCapacity(s)-(s.fluxStored||0)):0);
 },0)-inflight;
}
export function storeFieldFlux(world,field,amount){
 let remaining=Math.max(0,amount);
 const stations=(field?.vertices||[]).map(id=>world.stations.get(id))
  .filter(s=>s?.active&&!s.enemy&&!s.suppressed)
  .sort((a,b)=>(a.fluxStored||0)/stationFluxCapacity(a)-
   (b.fluxStored||0)/stationFluxCapacity(b));
 for(const station of stations){
  const added=Math.min(remaining,Math.max(0,stationFluxCapacity(station)-(station.fluxStored||0)));
  station.fluxStored=(station.fluxStored||0)+added;remaining-=added;
 }
 return Math.max(0,amount-remaining);
}
export const FLUX_INFRASTRUCTURE=Object.freeze({
 extractor:{name:'Глубинный коллектор',prices:[15,40,100],description:'Увеличивает добычу флюкса в прилегающих треугольниках.'},
 relay:{name:'Транспортный узел',prices:[12,35,85],description:'Ускоряет доставку флюкса к складам у этого узла.'},
 defense:{name:'Оборонный реактор',prices:[20,55,100],description:'Даёт станции дополнительные автоматические заряды ПВО.'}
});
export const fluxInfrastructureRank=(station,key)=>station?.fluxInfrastructure?.[key]||0;
export function fieldDepths(fields){
 const edges=new Map(),neighbors=fields.map(()=>new Set()),depth=fields.map(()=>-1);
 for(let i=0;i<fields.length;i++){
  const vertices=fields[i].vertices||[];
  for(let k=0;k<vertices.length;k++){
   const edge=edgeKey(vertices[k],vertices[(k+1)%vertices.length]);
   if(!edges.has(edge))edges.set(edge,[]);
   edges.get(edge).push(i);
  }
 }
 const exposed=new Set();
 for(const members of edges.values()){
  if(members.length===1)exposed.add(members[0]);
  else for(const a of members)for(const b of members)if(a!==b)neighbors[a].add(b);
 }
 if(!exposed.size)fields.forEach((_,i)=>exposed.add(i));
 const queue=[...exposed];for(const i of queue)depth[i]=0;
 for(let i=0;i<queue.length;i++)for(const next of neighbors[queue[i]]){
  if(depth[next]!==-1)continue;
  depth[next]=Math.min(6,depth[queue[i]]+1);queue.push(next);
 }
 return depth.map(x=>Math.max(0,x));
}
export function fieldFluxMultiplier(world,field,depth=0){
 const collectors=(field.vertices||[]).reduce((sum,id)=>
  sum+fluxInfrastructureRank(world?.stations?.get?.(id),'extractor'),0);
 return Math.min(4.6,1+Math.min(6,depth)*.48+Math.min(8,collectors)*.16);
}
export function weightedContourProduction(world,fields){
 if(!fields?.length)return 0;
 const area=fields.reduce((n,f)=>n+f.area,0);if(area<=0)return 0;
 const depths=fieldDepths(fields);
 return 8*Math.sqrt(area/1e6)*fields.reduce((sum,f,i)=>
  sum+f.area/area*fieldFluxMultiplier(world,f,depths[i]),0);
}
export function fluxFieldYields(world,fields){
 const area=fields.reduce((sum,f)=>sum+f.area,0),depths=fieldDepths(fields);
 const base=area>0?8*Math.sqrt(area/1e6):0;
 return fields.map((field,i)=>({field,depth:depths[i],
  multiplier:fieldFluxMultiplier(world,field,depths[i]),
  output:area>0?base*field.area/area*fieldFluxMultiplier(world,field,depths[i]):0}));
}
export function stationFluxUpgradeOffer(world,station,key){
 const cfg=FLUX_INFRASTRUCTURE[key],state=world?.contours;
 if(!cfg)return {ok:false,reason:'Неизвестная технология'};
 if(!station?.active||station.enemy||station.suppressed)
  return {ok:false,reason:'Станция должна работать'};
 if(!(state?.trials?.completed>0))return {ok:false,reason:'Сначала защитите первый треугольник'};
 const level=fluxInfrastructureRank(station,key),flux=cfg.prices[level];
 if(flux===undefined)return {ok:false,reason:'Достигнут максимальный уровень'};
 if((state.flux||0)+1e-8<flux)return {ok:false,reason:'Нужно '+flux+' флюкса',flux};
 return {ok:true,flux,level:level+1};
}
export function buyStationFluxUpgrade(world,station,key){
 const quote=stationFluxUpgradeOffer(world,station,key);if(!quote.ok)return quote;
 world.contours.flux=Math.max(0,world.contours.flux-quote.flux);
 station.fluxInfrastructure??={};station.fluxInfrastructure[key]=quote.level;
 return {...quote,name:FLUX_INFRASTRUCTURE[key].name};
}
// Maintenance only draws fractional flux while a completed contour exists.
// Unpaid debt is capped: a stranded pilot can restore the field with the next
// harvested delivery instead of inheriting an impossible permanent bill.
export function advanceFluxMaintenance(state,fieldCount,dt){
 if(!state||!Number.isFinite(dt)||dt<=0)return;
 if(fieldCount<=0){state.maintenanceDebt=0;state.territoryPowered=true;return;}
 const rate=.24*fieldCount/60;
 const owed=Math.min(.5,Math.max(0,state.maintenanceDebt||0)+rate*dt);
 const paid=Math.min(Math.max(0,state.flux||0),owed);
 state.flux=Math.max(0,state.flux-paid);
 state.maintenanceDebt=Math.max(0,owed-paid);
 state.territoryPowered=state.maintenanceDebt<.01;
}
export function validFluxEconomy(state,stations){
 if(state.maintenanceDebt!==undefined&&(!Number.isFinite(state.maintenanceDebt)||
   state.maintenanceDebt<0||state.maintenanceDebt>.500001))return false;
 if(state.territoryPowered!==undefined&&typeof state.territoryPowered!=='boolean')return false;
 for(const key of ['fluxSpilled','fluxHarvestedLocally'])if(state[key]!==undefined&&
  (!Number.isFinite(state[key])||state[key]<0||state[key]>1e12))return false;
 for(const entry of stations?.values?.()||[]){
  const station=Array.isArray(entry)?entry[1]:entry;
  if(station.fluxDepth!==undefined&&(!Number.isInteger(station.fluxDepth)||
   station.fluxDepth<0||station.fluxDepth>6))return false;
  if(station.fluxStored!==undefined&&(!Number.isFinite(station.fluxStored)||
   station.fluxStored<0||station.fluxStored>stationFluxCapacity(station)+1e-6))return false;
  const infra=station.fluxInfrastructure;if(infra===undefined)continue;
  if(!infra||Array.isArray(infra)||typeof infra!=='object'||
   Object.keys(infra).some(key=>!FLUX_INFRASTRUCTURE[key]||
    !Number.isInteger(infra[key])||infra[key]<0||infra[key]>3))return false;
 }
 return true;
}
