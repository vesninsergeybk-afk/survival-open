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
  rewardOre:7,rewardData:11,escort:['flanker','fighter'],raid:['flanker','flanker']
 }),
 teal:Object.freeze({id:'teal',name:'Бирюзовая бездна',resource:'обломки',
  sourceId:'frontier:teal:source',depotId:'frontier:teal:depot',
  source:{x:-35500,y:10500},depot:{x:-42000,y:9000},
  route:[{x:-35500,y:10500},{x:-38200,y:12000},{x:-42000,y:9000}],
  capacity:16,cost:8,dispatch:90,speed:185,hp:145,
  assembly:22,warning:12,raidInterval:120,
  rewardOre:9,rewardData:7,escort:['fighter','healer'],raid:['fighter','healer','fighter']
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
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const STORM_SOURCE=stormFields(FRONTIERS.azure.source.x,FRONTIERS.azure.source.y,1500)
 .sort((a,b)=>distance(a,FRONTIERS.azure.source)-distance(b,FRONTIERS.azure.source))[0];
export const FRONTIER_STORM_FIELD=STORM_SOURCE;

export function frontierCargoPosition(id,progress){
 const path=FRONTIERS[id].route;
 let rest=Math.max(0,progress);
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],d=distance(a,b);
  if(rest<=d){const p=rest/d;return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,
   angle:Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2};}
  rest-=d;
 }
 return {...path.at(-1),angle:0};
}
const routeLength=id=>FRONTIERS[id].route.slice(1)
 .reduce((sum,p,i)=>sum+distance(FRONTIERS[id].route[i],p),0);
const shipOrigin=()=>({x:FRONTIERS.teal.source.x+92,y:FRONTIERS.teal.source.y-66});
function createNetwork(id,time){
 const at=Math.floor(time),start=shipOrigin();
 return {clock:at,resource:0,nextDispatch:at+65,serial:0,convoys:[],
  reserves:0,assemblyUntil:0,nextRaid:0,pendingRaid:null,delivered:0,
  intercepted:0,launched:0,raids:0,lastPulse:-1,history:[],
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
   if(src?.enemy&&depot?.enemy&&s.resource>=cfg.cost&&
      t>=s.nextDispatch&&s.convoys.length===0&&s.reserves<2){
    s.resource-=cfg.cost;s.nextDispatch=t+cfg.dispatch;
    const cargo={id:'frontier-cargo-'+id+'-'+(++s.serial),frontierCargo:true,
     frontierNetwork:id,regionalCargo:true,type:'fighter',distance:0,launchedAt:t,
     ...frontierCargoPosition(id,0),r:32,hp:cfg.hp,maxHp:cfg.hp,hit:0,seen:false};
    s.convoys.push(cargo);s.launched++;emit('dispatch',t);
   }
   for(const cargo of s.convoys){
    cargo.distance=(t-cargo.launchedAt)*cfg.speed;
    Object.assign(cargo,frontierCargoPosition(id,cargo.distance));
    if(cargo.distance>=routeLength(id)){
     cargo.hp=0;
     if(depot?.enemy&&s.reserves<2){
      s.reserves++;s.delivered++;s.assemblyUntil=Math.max(s.assemblyUntil,t+cfg.assembly);
      emit('delivery',t);
     }else emit('diverted',t);
    }
   }
   s.convoys=s.convoys.filter(c=>c.hp>0);
   if(!depot?.enemy){s.reserves=0;s.pendingRaid=null;}
   if(depot?.enemy&&s.reserves>0&&!s.pendingRaid&&
     t>=s.assemblyUntil&&t>=s.nextRaid){
    s.reserves--;s.pendingRaid={readyAt:t+cfg.warning};emit('raid-warning',t);
   }
  }
  for(const cargo of s.convoys){
   cargo.distance=(time-cargo.launchedAt)*cfg.speed;
   Object.assign(cargo,frontierCargoPosition(id,cargo.distance));
  }
  if(s.worker)Object.assign(s.worker,frontierWorkerPosition(s.worker,time));
 }
 return events;
}

export function interceptFrontierCargo(world,cargo,time){
 const id=cargo.frontierNetwork,s=world.regionalSupply?.frontier?.[id];
 if(!FRONTIERS[id]||!s?.convoys.includes(cargo)||cargo.rewarded||cargo.hp>0)return false;
 cargo.rewarded=true;s.convoys=s.convoys.filter(c=>c!==cargo);
 s.intercepted++;frontierEvent(s,id,'intercept',time);return true;
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
 if(kind==='source'&&s.worker){s.worker.phase='evacuated';s.worker.carry=0;}
 if(kind==='depot'){s.reserves=0;s.pendingRaid=null;}
 frontierEvent(s,id,kind+'-captured',time);return true;
}

export function frontierIndustryValid(root,time){
 const numeric=(x,a=0,b=1e9)=>Number.isFinite(x)&&x>=a&&x<=b;
 const point=p=>p&&numeric(p.x,-1e9,1e9)&&numeric(p.y,-1e9,1e9);
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
   !Array.isArray(s.history)||s.history.length>8||
   s.history.some(e=>e.network!==id||!numeric(e.time,0,time)||
    !['harvest','dispatch','delivery','diverted','raid-warning','raid',
      'intercept','worker-lost','wreck-emptied','source-captured','depot-captured'].includes(e.kind))||
   !Array.isArray(s.convoys)||s.convoys.length>1||
   s.convoys.some(c=>c.frontierCargo!==true||c.regionalCargo!==true||
    c.frontierNetwork!==id||!new RegExp('^frontier-cargo-'+id+'-\\d+$').test(c.id)||
    !numeric(c.launchedAt,0,time)||!numeric(c.distance,0,routeLength(id)+cfg.speed)||
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
