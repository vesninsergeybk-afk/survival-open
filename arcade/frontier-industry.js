import {stormFields,stormPhase} from './regional-storms.js?v=regions-1';

// Two deliberately different regional economies: the azure induction plant
// harvests actual environmental discharge cycles; teal's recycler dismantles
// a finite, visible wreck field. Neither source can conjure reinforcements.
export const FRONTIERS=Object.freeze({
 azure:Object.freeze({id:'azure',name:'Лазурный разлом',resource:'заряды',
  sourceId:'frontier:azure:source',depotId:'frontier:azure:depot',
  source:{x:5750,y:37000},depot:{x:11000,y:40500},
  route:[{x:5750,y:37000},{x:8000,y:38200},{x:11000,y:40500}],
  capacity:12,cost:6,dispatch:85,speed:215,hp:135,
  harvest:3,assembly:20,warning:11,raidInterval:115,
  rewardOre:7,rewardData:11,escort:['flanker','fighter'],reinforcement:'flanker'
 }),
 teal:Object.freeze({id:'teal',name:'Бирюзовая бездна',resource:'обломки',
  sourceId:'frontier:teal:source',depotId:'frontier:teal:depot',
  source:{x:-35500,y:10500},depot:{x:-42000,y:9000},
  route:[{x:-35500,y:10500},{x:-38200,y:12000},{x:-42000,y:9000}],
  capacity:16,cost:8,dispatch:90,speed:185,hp:145,
  assembly:22,warning:12,raidInterval:120,
  rewardOre:9,rewardData:7,escort:['fighter','healer'],reinforcement:'healer'
 })
});
export const FRONTIER_STATIONS=Object.freeze([
 {id:FRONTIERS.azure.sourceId,x:5750,y:37000,type:'lab',rank:2,
  strategicRole:'frontier-azure-source',title:'Индукционная вышка',hp:370,turrets:2,turretHp:85},
 {id:FRONTIERS.azure.depotId,x:11000,y:40500,type:'carrier',rank:2,
  strategicRole:'frontier-azure-depot',title:'Электроангар перехватчиков',hp:460,turrets:2,turretHp:100},
 {id:FRONTIERS.teal.sourceId,x:-35500,y:10500,type:'arsenal',rank:3,
  strategicRole:'frontier-teal-source',title:'Утилизационный комбинат',hp:440,turrets:2,turretHp:90},
 {id:FRONTIERS.teal.depotId,x:-42000,y:9000,type:'carrier',rank:3,
  strategicRole:'frontier-teal-depot',title:'Ремонтная верфь',hp:520,turrets:3,turretHp:95}
]);
export const FRONTIER_WRECKS=Object.freeze([
 {id:'wreck:0',x:-35170,y:10940,stock:60},
 {id:'wreck:1',x:-36100,y:11230,stock:60},
 {id:'wreck:2',x:-35950,y:9880,stock:60}
]);
// Diversions are authored, finite routes. A shipment keeps the route it was
// assigned at departure even if headquarters changes its plan mid-flight.
export const FRONTIER_ROUTES=Object.freeze({
 azure:Object.freeze({direct:FRONTIERS.azure.route,diversion:Object.freeze([
  FRONTIERS.azure.source,{x:6550,y:35300},{x:9600,y:35800},
  {x:12100,y:38000},FRONTIERS.azure.depot])}),
 teal:Object.freeze({direct:FRONTIERS.teal.route,diversion:Object.freeze([
  FRONTIERS.teal.source,{x:-36600,y:7800},{x:-40500,y:6700},
  FRONTIERS.teal.depot])})
});
export const FRONTIER_RESPONSE=Object.freeze({reportDelay:12,reportMemory:600,
 routeCost:2,routePrep:34,routeCooldown:200,
 screenCost:1,screenCargoCost:2,screenPrep:28,screenDuration:330,
 emergencyWarning:18,emergencyCost:1,maxReports:12,
 radioRadius:2600,missingGrace:24,maxMissing:4,maxMissingWait:180,maxBufferedHits:4});
// A small, funded industrial decision distinct from the ambient combat director.
// Existing patrol reserves are not converted into free maintenance ships.
export const FRONTIER_REPAIR=Object.freeze({cost:4,earliest:140,cooldown:240,
 maxMissions:2,hp:125,speed:190,threshold:.78,hullGain:.26,turretGain:.32});
export const frontierRoute=(id,mode='direct')=>
 FRONTIER_ROUTES[id]?.[mode]||FRONTIERS[id].route;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const STORM_SOURCE=stormFields(FRONTIERS.azure.source.x,FRONTIERS.azure.source.y,1500)
 .sort((a,b)=>distance(a,FRONTIERS.azure.source)-distance(b,FRONTIERS.azure.source))[0];
export const FRONTIER_STORM_FIELD=STORM_SOURCE;

export function frontierCargoPosition(id,progress,routeId='direct'){
 const path=frontierRoute(id,routeId);
 let rest=Math.max(0,progress);
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],d=distance(a,b);
  if(rest<=d){const p=rest/d;return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,
   angle:Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2};}
  rest-=d;
 }
 return {...path.at(-1),angle:0};
}
export const frontierRouteLength=(id,routeId='direct')=>frontierRoute(id,routeId)
 .slice(1).reduce((sum,p,i)=>sum+distance(frontierRoute(id,routeId)[i],p),0);
// Enemy stations can receive cargo telemetry only inside their radio coverage.
// This is separate from the player's laboratory listening network.
export function frontierRadioCoverage(world,id,position){
 const cfg=FRONTIERS[id];
 if(!cfg||!position||!Number.isFinite(position.x)||!Number.isFinite(position.y))return false;
 return [cfg.sourceId,cfg.depotId].some(key=>{
  const station=world?.stations?.get(key);
  return station?.enemy&&distance(station,position)<=FRONTIER_RESPONSE.radioRadius;
 });
}
const shipOrigin=()=>({x:FRONTIERS.teal.source.x+92,y:FRONTIERS.teal.source.y-66});
function createStrategy(time){return {route:'direct',routePlan:null,nextRoutePlanAt:Math.floor(time),
 screenPlan:null,screenUntil:0,nextScreenPlanAt:Math.floor(time),
 reports:[],pendingLosses:[],reportSerial:0,routeEvidenceThrough:0,screenEvidenceThrough:0,
 nextAttackAt:0,emergency:null,emergencyCommitted:false,emergencyRaids:0};}
function createNetwork(id,time){
 const at=Math.floor(time),start=shipOrigin();
 return {clock:at,resource:0,nextDispatch:at+65,serial:0,convoys:[],
  reserves:0,assemblyUntil:0,nextRaid:0,pendingRaid:null,delivered:0,
  intercepted:0,launched:0,raids:0,lastPulse:-1,history:[],strategy:createStrategy(time),
  repairExpedition:null,repairsLaunched:0,repairsCompleted:0,repairsIntercepted:0,
  nextRepairAt:at+FRONTIER_REPAIR.earliest,
  worker:id==='teal'?{frontierWorker:true,network:'teal',x:start.x,y:start.y,
   hp:95,maxHp:95,r:18,phase:'seek',cacheId:null,carry:0,
   from:{...start},to:{...start},at,until:at}:null,
  wrecks:id==='teal'?FRONTIER_WRECKS.map(w=>({frontierSalvage:true,network:'teal',
   id:w.id,x:w.x,y:w.y,r:35,hp:100,maxHp:100,stock:w.stock,maxStock:w.stock,
   hit:0,rewarded:false})):[]};
}
export function createFrontierIndustry(time=0){return {version:1,
 azure:createNetwork('azure',time),teal:createNetwork('teal',time)};}
export function frontierEvent(state,id,kind,time){
 const event={network:id,kind,time};state.history.push(event);
 state.history=state.history.slice(-8);return event;
}
export function frontierWorkerPosition(worker,time){
 if(!worker)return null;
 if(worker.phase!=='outbound'&&worker.phase!=='return')return {...worker.to};
 const f=clamp((time-worker.at)/Math.max(.01,worker.until-worker.at),0,1);
 return {x:worker.from.x+(worker.to.x-worker.from.x)*f,
  y:worker.from.y+(worker.to.y-worker.from.y)*f};
}

function strategyOf(s,time){
 // Older checkpoints are valid. They begin observing only from their load time.
 if(!s.strategy)s.strategy=createStrategy(time);
 s.strategy.pendingLosses??=[];
 return s.strategy;
}
function repairState(s,time){
 // Legacy checkpoints did not have repair missions. They gain no backdated ship.
 s.repairExpedition??=null;
 s.repairsLaunched??=0;s.repairsCompleted??=0;s.repairsIntercepted??=0;
 s.nextRepairAt??=Math.floor(time)+FRONTIER_REPAIR.earliest;
}
function damagedStation(station){
 return station.hp<station.maxHp*FRONTIER_REPAIR.threshold||
  station.turrets.some(t=>t.hp>0&&t.hp<t.maxHp*.7);
}
function repairStation(station){
 station.hp=Math.min(station.maxHp,station.hp+Math.ceil(station.maxHp*FRONTIER_REPAIR.hullGain));
 for(const turret of station.turrets)if(turret.hp>0)
  turret.hp=Math.min(turret.maxHp,turret.hp+Math.ceil(turret.maxHp*FRONTIER_REPAIR.turretGain));
}
function repairPosition(id,distance,routeId,targetKind){
 if(targetKind==='depot')return frontierCargoPosition(id,distance,routeId);
 const p=frontierCargoPosition(id,Math.max(0,frontierRouteLength(id,routeId)-distance),routeId);
 return {...p,angle:p.angle+Math.PI};
}
function repairGoal(source,depot,s){
 // Real stores: the source pays for depot repairs, delivered reserves at the
 // depot pay for source repairs. A pending combat raid has already spent its reserve.
 const options=[];
 for(const [kind,station,funded] of [
  ['depot',depot,s.resource>=FRONTIER_REPAIR.cost],
  ['source',source,s.reserves>=1]]){
  if(!station?.enemy||!funded||!damagedStation(station))continue;
  const turretDamage=station.turrets.reduce((v,t)=>v+(t.hp>0?1-t.hp/t.maxHp:0),0);
  options.push({kind,priority:1-station.hp/station.maxHp+turretDamage*.2});
 }
 return options.sort((a,b)=>b.priority-a.priority)[0]?.kind||null;
}
function report(s,kind,route,time,transmittedAt=time){
 const st=strategyOf(s,time);
 st.reports.push({seq:++st.reportSerial,kind,route,at:Math.floor(time),
  receivedAt:Math.floor(transmittedAt)+FRONTIER_RESPONSE.reportDelay});
 st.reports=st.reports.slice(-FRONTIER_RESPONSE.maxReports);
}
export function recordFrontierCargoAttack(world,cargo,weapon,range,time){
 const id=cargo?.frontierNetwork,s=world.regionalSupply?.frontier?.[id];
 if(!FRONTIERS[id]||!s?.convoys.includes(cargo)||cargo.hp<=0||
   !['beam','rail','rocket','flak'].includes(weapon)||range<270||
   !Number.isFinite(range)||!Number.isFinite(time))return false;
 const st=strategyOf(s,time);
 if(time<st.nextAttackAt)return false;
 st.nextAttackAt=time+1.05;
 if(frontierRadioCoverage(world,id,cargo))report(s,'long',cargo.routeId||'direct',time);
 else{
  // A surviving freighter can forward stored observations on reconnecting.
  // Destroying it while isolated destroys those observations too.
  cargo.radioBuffer??=[];
  cargo.radioBuffer.push(Math.floor(time));
  cargo.radioBuffer=cargo.radioBuffer.slice(-FRONTIER_RESPONSE.maxBufferedHits);
 }
 return true;
}

function updateStrategy(s,id,src,depot,t,emit){
 const st=strategyOf(s,t),policy=FRONTIER_RESPONSE;
 st.reports=st.reports.filter(r=>r.at>=t-policy.reportMemory);
 const active=src?.enemy&&depot?.enemy;
 if(!active){
  st.routePlan=null;st.screenPlan=null;st.screenUntil=0;st.pendingLosses=[];
  return;
 }
 for(const lost of st.pendingLosses.filter(p=>p.dueAt<=t)){
  // The depot detects an overdue shipment; it never learns the killer's position.
  report(s,'loss',lost.route,lost.dueAt);
  emit('shipment-overdue',t);
 }
 st.pendingLosses=st.pendingLosses.filter(p=>p.dueAt>t);
 if(st.routePlan&&t>=st.routePlan.readyAt){
  st.route=st.routePlan.to;st.routePlan=null;emit('route-changed',t);
 }
 if(st.screenPlan&&t>=st.screenPlan.readyAt){
  st.screenUntil=t+policy.screenDuration;st.screenPlan=null;emit('screen-ready',t);
 }
 const arrived=st.reports.filter(r=>r.receivedAt<=t);
 const losses=arrived.filter(r=>r.kind==='loss'&&r.route===st.route&&
  r.seq>st.routeEvidenceThrough);
 if(!st.routePlan&&t>=st.nextRoutePlanAt&&s.resource>=policy.routeCost&&
   losses.length>=2){
  const evidence=losses.slice(-2);
  if(evidence[1].at>evidence[0].at){
   s.resource-=policy.routeCost;
   st.routeEvidenceThrough=evidence[1].seq;
   st.routePlan={to:st.route==='direct'?'diversion':'direct',readyAt:t+policy.routePrep};
   st.nextRoutePlanAt=t+policy.routeCooldown;
   emit('route-prep',t);
  }
 }
 const hits=arrived.filter(r=>r.kind==='long'&&r.seq>st.screenEvidenceThrough);
 if(!st.screenPlan&&t>=st.nextScreenPlanAt&&t>=st.screenUntil&&
   s.resource>=policy.screenCost&&hits.length>=2){
  const evidence=hits.slice(-2);
  if(evidence[1].at>evidence[0].at){
   s.resource-=policy.screenCost;
   st.screenEvidenceThrough=evidence[1].seq;
   st.screenPlan={readyAt:t+policy.screenPrep};
   st.nextScreenPlanAt=t+policy.screenDuration;
   emit('screen-prep',t);
  }
 }
}

function tealWorkerTick(world,s,t){
 const w=s.worker,config=FRONTIERS.teal;
 if(!world.stations.get(config.sourceId)?.enemy||w.hp<=0)return;
 if(w.phase==='seek'){
  if(s.resource>=config.capacity)return;
  const cache=s.wrecks.find(c=>c.hp>0&&c.stock>0);
  if(!cache)return;
  w.phase='outbound';w.cacheId=cache.id;w.from={...w.to};w.to={x:cache.x,y:cache.y};
  w.at=t;w.until=t+Math.max(1,Math.ceil(distance(w.from,w.to)/145));
 }else if(w.phase==='outbound'&&t>=w.until){w.phase='salvage';w.at=t;w.until=t;}
 else if(w.phase==='salvage'){
  const cache=s.wrecks.find(c=>c.id===w.cacheId);
  if(cache?.hp>0&&cache.stock>0&&w.carry<4&&t-w.at>=3){
   cache.stock=Math.max(0,cache.stock-1);w.carry++;w.at=t;w.until=t;
  }
  if(!cache||cache.hp<=0||cache.stock<=0||w.carry>=4){
   w.phase='return';w.from={...w.to};w.to=shipOrigin();w.at=t;
   w.until=t+Math.max(1,Math.ceil(distance(w.from,w.to)/145));
  }
 }else if(w.phase==='return'&&t>=w.until){
  s.resource=Math.min(config.capacity,s.resource+w.carry);
  w.carry=0;w.cacheId=null;w.phase='seek';w.from={...w.to};w.at=t;w.until=t;
 }
}

export function advanceFrontierIndustry(world,time){
 const root=world.regionalSupply?.frontier,events=[];
 if(!root)return events;
 for(const id of ['azure','teal']){
  const cfg=FRONTIERS[id],s=root[id];
  repairState(s,time);
  const src=world.stations.get(cfg.sourceId),depot=world.stations.get(cfg.depotId);
  const emit=(kind,t)=>events.push(frontierEvent(s,id,kind,t));
  while(s.clock<Math.floor(time)){
   const t=++s.clock;
   if(id==='azure'&&src?.enemy&&STORM_SOURCE){
    const phase=stormPhase(STORM_SOURCE,t);
    if(phase.state==='discharge'&&phase.cycle!==s.lastPulse){
     s.lastPulse=phase.cycle;
     s.resource=Math.min(cfg.capacity,s.resource+cfg.harvest);
     if(src.discovered)emit('harvest',t);
    }
   }
   if(id==='teal')tealWorkerTick(world,s,t);
   updateStrategy(s,id,src,depot,t,emit);
   if(src?.enemy&&depot?.enemy&&s.resource>=cfg.cost&&
      t>=s.nextDispatch&&s.convoys.length===0&&s.reserves<2){
    const st=strategyOf(s,t);
    const screened=t<st.screenUntil&&
     s.resource>=cfg.cost+FRONTIER_RESPONSE.screenCargoCost;
    s.resource-=cfg.cost+(screened?FRONTIER_RESPONSE.screenCargoCost:0);
    s.nextDispatch=t+cfg.dispatch;
    const cargo={id:'frontier-cargo-'+id+'-'+(++s.serial),frontierCargo:true,
     frontierNetwork:id,regionalCargo:true,type:'fighter',distance:0,launchedAt:t,
     routeId:st.route,screened,...frontierCargoPosition(id,0,st.route),
     r:32,hp:cfg.hp,maxHp:cfg.hp,hit:0,seen:false};
    s.convoys.push(cargo);s.launched++;emit('dispatch',t);
    if(screened)emit('screen-dispatch',t);
   }
   for(const cargo of s.convoys){
    cargo.distance=(t-cargo.launchedAt)*cfg.speed;
    Object.assign(cargo,frontierCargoPosition(id,cargo.distance,cargo.routeId));
    if(cargo.radioBuffer?.length&&frontierRadioCoverage(world,id,cargo)){
     for(const at of cargo.radioBuffer)report(s,'long',cargo.routeId||'direct',at,t);
     cargo.radioBuffer=[];
    }
    if(cargo.distance>=frontierRouteLength(id,cargo.routeId)){
     cargo.hp=0;
     if(depot?.enemy&&s.reserves<2){
      s.reserves++;s.delivered++;s.assemblyUntil=Math.max(s.assemblyUntil,t+cfg.assembly);
      emit('delivery',t);
     }else emit('diverted',t);
    }
   }
   s.convoys=s.convoys.filter(c=>c.hp>0);
   const expedition=s.repairExpedition;
   if(expedition){
    expedition.distance=(t-expedition.launchedAt)*FRONTIER_REPAIR.speed;
    Object.assign(expedition,repairPosition(id,expedition.distance,expedition.routeId,expedition.targetKind));
    if(expedition.distance>=frontierRouteLength(id,expedition.routeId)){
     const target=expedition.targetKind==='source'?src:depot;
     if(target?.enemy){repairStation(target);s.repairsCompleted++;
      emit('repair-'+expedition.targetKind+'-complete',t);}
     else emit('repair-aborted',t);
     // Escort references can outlive the mission; they must not guard a ghost.
     expedition.hp=0;
     s.repairExpedition=null;
    }
   }
   const goal=repairGoal(src,depot,s);
   if(!s.repairExpedition&&goal&&src?.enemy&&depot?.enemy&&
      t>=s.nextRepairAt&&s.repairsLaunched<FRONTIER_REPAIR.maxMissions){
    const routeId=strategyOf(s,t).route;
    if(goal==='source')s.reserves--;
    else s.resource-=FRONTIER_REPAIR.cost;
    s.nextRepairAt=t+FRONTIER_REPAIR.cooldown;
    s.repairExpedition={id:'frontier-repair-'+id+'-'+(++s.repairsLaunched),
     frontierRepair:true,frontierNetwork:id,regionalCargo:true,type:'fighter',
     routeId,targetKind:goal,distance:0,launchedAt:t,
     ...repairPosition(id,0,routeId,goal),r:29,
     hp:FRONTIER_REPAIR.hp,maxHp:FRONTIER_REPAIR.hp,hit:0,seen:false,escorted:false};
    emit('repair-'+goal+'-dispatch',t);
   }
   if(!depot?.enemy){s.reserves=0;s.pendingRaid=null;}
   if(depot?.enemy&&s.reserves>0&&!s.pendingRaid&&
     t>=s.assemblyUntil&&t>=s.nextRaid){
    s.reserves--;s.pendingRaid={readyAt:t+cfg.warning};emit('raid-warning',t);
   }
  }
  for(const cargo of s.convoys){
   cargo.distance=(time-cargo.launchedAt)*cfg.speed;
   Object.assign(cargo,frontierCargoPosition(id,cargo.distance,cargo.routeId));
  }
  if(s.repairExpedition){
   const expedition=s.repairExpedition;
   expedition.distance=(time-expedition.launchedAt)*FRONTIER_REPAIR.speed;
   Object.assign(expedition,repairPosition(id,expedition.distance,expedition.routeId,expedition.targetKind));
  }
  if(s.worker)Object.assign(s.worker,frontierWorkerPosition(s.worker,time));
 }
 return events;
}
export function interceptFrontierRepair(world,craft,time){
 const id=craft?.frontierNetwork,s=world.regionalSupply?.frontier?.[id];
 if(!FRONTIERS[id]||!craft?.frontierRepair||s?.repairExpedition!==craft||
    craft.rewarded||craft.hp>0)return false;
 craft.rewarded=true;s.repairExpedition=null;s.repairsIntercepted++;
 frontierEvent(s,id,'repair-intercept',time);
 return true;
}

export function interceptFrontierCargo(world,cargo,time){
 const id=cargo.frontierNetwork,s=world.regionalSupply?.frontier?.[id];
 if(!FRONTIERS[id]||!s?.convoys.includes(cargo)||cargo.rewarded||cargo.hp>0)return false;
 cargo.rewarded=true;s.convoys=s.convoys.filter(c=>c!==cargo);
 s.intercepted++;frontierEvent(s,id,'intercept',time);
 if(frontierRadioCoverage(world,id,cargo)){
  // An automated distress packet can be sent immediately before destruction.
  report(s,'loss',cargo.routeId||'direct',time);
 }else{
  const st=strategyOf(s,time);
  const expected=Math.ceil(cargo.launchedAt+
   frontierRouteLength(id,cargo.routeId)/FRONTIERS[id].speed);
  st.pendingLosses.push({route:cargo.routeId||'direct',at:Math.floor(time),
   dueAt:Math.max(Math.floor(time)+1,expected+FRONTIER_RESPONSE.missingGrace)});
  st.pendingLosses=st.pendingLosses.slice(-FRONTIER_RESPONSE.maxMissing);
 }
 return true;
}
export function damageFrontierAsset(world,target,damage,time){
 const s=world.regionalSupply?.frontier?.teal;
 if(!s||!(damage>0)||target.hp<=0)return null;
 if(target.frontierWorker&&target===s.worker){
  target.hp=Math.max(0,target.hp-damage);
  if(target.hp===0){target.phase='disabled';target.carry=0;
   frontierEvent(s,'teal','worker-lost',time);return 'worker';}
  return 'hit';
 }
 if(target.frontierSalvage&&s.wrecks.includes(target)){
  target.hp=Math.max(0,target.hp-damage);
  target.stock=Math.min(target.stock,Math.floor(target.maxStock*target.hp/target.maxHp));
  if(target.hp===0&&!target.rewarded){
   target.rewarded=true;frontierEvent(s,'teal','wreck-emptied',time);return 'wreck';}
  return 'hit';
 }
 return null;
}

export function captureFrontierStation(world,base,time){
 const parts=/^frontier-(azure|teal)-(source|depot)$/.exec(base.strategicRole||'');
 if(!parts)return false;
 const [,id,kind]=parts,s=world.regionalSupply.frontier?.[id];
 if(!s)return false;
 const st=strategyOf(s,time);
 st.routePlan=null;st.screenPlan=null;st.screenUntil=0;st.pendingLosses=[];
 if(kind==='source'&&s.worker){s.worker.phase='evacuated';s.worker.carry=0;}
 if(kind==='source'){
  // A prepared reserve can mount one final response, but it cannot be created
  // after the producer has fallen or spend reserve units twice.
  if(world.stations.get(FRONTIERS[id].depotId)?.enemy&&
    s.reserves>=FRONTIER_RESPONSE.emergencyCost&&!st.emergencyCommitted){
   s.reserves-=FRONTIER_RESPONSE.emergencyCost;
    st.emergencyCommitted=true;
   st.emergency={readyAt:time+FRONTIER_RESPONSE.emergencyWarning,announced:false};
   frontierEvent(s,id,'emergency-prep',time);
  }
 }
 if(kind==='depot'){
  s.reserves=0;s.pendingRaid=null;
  if(s.strategy)s.strategy.emergency=null;
 }
 frontierEvent(s,id,kind+'-captured',time);return true;
}

export function frontierIndustryValid(root,time){
 const numeric=(x,a=0,b=1e9)=>Number.isFinite(x)&&x>=a&&x<=b;
 const point=p=>p&&numeric(p.x,-1e9,1e9)&&numeric(p.y,-1e9,1e9);
 const plan=p=>p===null||p&&numeric(p.readyAt);
 const responseValid=st=>st===undefined||Boolean(st&&
  ['direct','diversion'].includes(st.route)&&
  (st.routePlan===null||plan(st.routePlan)&&
    ['direct','diversion'].includes(st.routePlan.to)&&st.routePlan.to!==st.route)&&
  plan(st.screenPlan)&&numeric(st.nextRoutePlanAt)&&numeric(st.nextScreenPlanAt)&&
  numeric(st.screenUntil)&&numeric(st.nextAttackAt)&&
  Number.isSafeInteger(st.reportSerial)&&numeric(st.reportSerial)&&
  Number.isSafeInteger(st.routeEvidenceThrough)&&
  numeric(st.routeEvidenceThrough,0,st.reportSerial)&&
  Number.isSafeInteger(st.screenEvidenceThrough)&&
  numeric(st.screenEvidenceThrough,0,st.reportSerial)&&
  Number.isSafeInteger(st.emergencyRaids)&&numeric(st.emergencyRaids,0,1)&&
  typeof st.emergencyCommitted==='boolean'&&
  (!st.emergency||st.emergencyCommitted)&&
  (st.emergency===null||plan(st.emergency)&&
    typeof st.emergency.announced==='boolean')&&
  Array.isArray(st.reports)&&st.reports.length<=FRONTIER_RESPONSE.maxReports&&
  (st.pendingLosses===undefined||Array.isArray(st.pendingLosses)&&
    st.pendingLosses.length<=FRONTIER_RESPONSE.maxMissing&&
    st.pendingLosses.every(p=>['direct','diversion'].includes(p.route)&&
      Number.isInteger(p.at)&&numeric(p.at,0,time)&&
      Number.isInteger(p.dueAt)&&
      numeric(p.dueAt,p.at,p.at+FRONTIER_RESPONSE.maxMissingWait)))&&
  st.reports.every((r,i)=>Number.isSafeInteger(r.seq)&&
    numeric(r.seq,1,st.reportSerial)&&
    (i===0||st.reports[i-1].seq<r.seq)&&
    ['loss','long'].includes(r.kind)&&['direct','diversion'].includes(r.route)&&
    Number.isInteger(r.at)&&numeric(r.at,0,time)&&
    Number.isInteger(r.receivedAt)&&
    numeric(r.receivedAt,r.at+FRONTIER_RESPONSE.reportDelay,
      r.at+FRONTIER_RESPONSE.reportMemory+FRONTIER_RESPONSE.reportDelay)));
 if(!root||root.version!==1)return false;
 for(const id of ['azure','teal']){
  const cfg=FRONTIERS[id],s=root[id],w=s?.worker;
  if(!s||!Number.isInteger(s.clock)||!numeric(s.clock,0,time)||
   !numeric(s.resource,0,cfg.capacity)||!numeric(s.nextDispatch)||
   !Number.isSafeInteger(s.serial)||!numeric(s.serial)||
   !Number.isInteger(s.reserves)||!numeric(s.reserves,0,2)||
   !numeric(s.assemblyUntil)||!numeric(s.nextRaid)||
   (s.pendingRaid&&(!numeric(s.pendingRaid.readyAt)||
     (s.pendingRaid.announced!==undefined&&typeof s.pendingRaid.announced!=='boolean')))||
   !['delivered','intercepted','launched','raids'].every(k=>
     Number.isSafeInteger(s[k])&&numeric(s[k]))||
   !Number.isInteger(s.lastPulse)||!numeric(s.lastPulse,-1,1e9)||
   !responseValid(s.strategy)||
   !Array.isArray(s.history)||s.history.length>8||
   s.history.some(e=>e.network!==id||!numeric(e.time,0,time)||
    !['harvest','dispatch','delivery','diverted','raid-warning','raid',
      'intercept','worker-lost','wreck-emptied','source-captured','depot-captured',
      'route-prep','route-changed','screen-prep','screen-ready','screen-dispatch',
      'emergency-prep','emergency-raid','shipment-overdue',
      'repair-depot-dispatch','repair-source-dispatch',
      'repair-depot-complete','repair-source-complete','repair-aborted',
      'repair-intercept'].includes(e.kind))||
   !Array.isArray(s.convoys)||s.convoys.length>1||
   (s.repairExpedition!==undefined&&s.repairExpedition!==null&&(
    !s.repairExpedition.frontierRepair||!s.repairExpedition.regionalCargo||
    s.repairExpedition.frontierNetwork!==id||
    !new RegExp('^frontier-repair-'+id+'-[1-2]$').test(s.repairExpedition.id)||
    !['direct','diversion'].includes(s.repairExpedition.routeId)||
    !['source','depot'].includes(s.repairExpedition.targetKind)||
    !numeric(s.repairExpedition.launchedAt,0,time)||
    !numeric(s.repairExpedition.distance,0,frontierRouteLength(id,s.repairExpedition.routeId)+FRONTIER_REPAIR.speed)||
    !point(s.repairExpedition)||!numeric(s.repairExpedition.hp,.001,FRONTIER_REPAIR.hp)||
    s.repairExpedition.maxHp!==FRONTIER_REPAIR.hp||s.repairExpedition.r!==29||
    typeof s.repairExpedition.seen!=='boolean'||
    typeof s.repairExpedition.escorted!=='boolean'))||
   (s.repairsLaunched!==undefined&&(!Number.isInteger(s.repairsLaunched)||
    !numeric(s.repairsLaunched,0,FRONTIER_REPAIR.maxMissions)))||
   (s.repairsCompleted!==undefined&&(!Number.isInteger(s.repairsCompleted)||
    !numeric(s.repairsCompleted,0,FRONTIER_REPAIR.maxMissions)))||
   (s.repairsIntercepted!==undefined&&(!Number.isInteger(s.repairsIntercepted)||
    !numeric(s.repairsIntercepted,0,FRONTIER_REPAIR.maxMissions)))||
   (s.nextRepairAt!==undefined&&!numeric(s.nextRepairAt,0,1e9))||
   (s.repairsLaunched!==undefined&&s.repairsCompleted!==undefined&&
    s.repairsIntercepted!==undefined&&
    (s.repairsCompleted+s.repairsIntercepted>s.repairsLaunched||
     (s.repairExpedition&&s.repairsCompleted+s.repairsIntercepted>=s.repairsLaunched)))||
   (s.repairExpedition&&s.repairsLaunched!==undefined&&
    s.repairExpedition.id!=='frontier-repair-'+id+'-'+s.repairsLaunched)||
   s.convoys.some(c=>c.frontierCargo!==true||c.regionalCargo!==true||
    c.frontierNetwork!==id||!new RegExp('^frontier-cargo-'+id+'-\\d+$').test(c.id)||
    (c.routeId!==undefined&&!['direct','diversion'].includes(c.routeId))||
    (c.screened!==undefined&&typeof c.screened!=='boolean')||
    (c.radioBuffer!==undefined&&(!Array.isArray(c.radioBuffer)||
     c.radioBuffer.length>FRONTIER_RESPONSE.maxBufferedHits||
     c.radioBuffer.some(at=>!Number.isInteger(at)||!numeric(at,c.launchedAt,time))))||
    !numeric(c.launchedAt,0,time)||
    !numeric(c.distance,0,frontierRouteLength(id,c.routeId)+cfg.speed)||
    !point(c)||!numeric(c.hp,.001,cfg.hp)||c.maxHp!==cfg.hp||c.r!==32))return false;
  if(id==='azure'&&(w!==null||!Array.isArray(s.wrecks)||s.wrecks.length!==0))return false;
  if(id==='teal'){
   if(!w?.frontierWorker||w.network!=='teal'||!numeric(w.hp,0,95)||
    w.maxHp!==95||w.r!==18||!point(w)||!point(w.from)||!point(w.to)||
    !numeric(w.at)||!numeric(w.until)||w.until<w.at||!numeric(w.carry,0,4)||
    !['seek','outbound','salvage','return','disabled','evacuated'].includes(w.phase)||
    (w.cacheId!==null&&!FRONTIER_WRECKS.some(c=>c.id===w.cacheId))||
    !Array.isArray(s.wrecks)||s.wrecks.length!==FRONTIER_WRECKS.length)return false;
   for(let i=0;i<s.wrecks.length;i++){
    const c=s.wrecks[i],spec=FRONTIER_WRECKS[i];
    if(c.id!==spec.id||c.frontierSalvage!==true||c.network!=='teal'||
      c.x!==spec.x||c.y!==spec.y||c.r!==35||c.maxHp!==100||
      !numeric(c.hp,0,100)||c.maxStock!==spec.stock||
      !numeric(c.stock,0,spec.stock)||typeof c.rewarded!=='boolean')return false;
   }
  }
 }
 return true;
}
