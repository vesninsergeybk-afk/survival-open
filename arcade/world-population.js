import {hash} from './balance.js';
import {REGIONS} from './regions.js';

// A fixed, seeded civilization already occupies the sector at launch.
// Distant factories and transports advance as orders, not hundreds of AI actors.
export const POPULATION=Object.freeze({
 radius:55000, coloniesPerRegion:6, activeLimit:160,
 miningPerSecond:.78, oreCapacity:80, cargoCost:9,
 launchInterval:24, cargoSpeed:210, convoyHp:180,
 cargoCapacity:2, buildCost:9, buildSeconds:21, shipsPerBuild:3,
 maxReserve:36, alarmRadius:1100, radioRadius:7600,
 patrolRange:2650, patrolCooldown:38, alarmDelay:7,
 shieldRecovery:175, shieldBreachSeconds:75, shieldSegmentHp:650,
 shieldChargePerSecond:1.2
});
const TAU=Math.PI*2;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const regionAngle=Object.freeze({amber:0,azure:Math.PI/2,lilac:-Math.PI/2,teal:Math.PI});
const roles=Object.freeze(['extractor','factory','relay','hangar','support']);
const types=Object.freeze({extractor:'arsenal',factory:'carrier',relay:'lab',hangar:'carrier',support:'dock'});
const roleTitles=Object.freeze({
 extractor:'Рудный терминал',factory:'Сборочная верфь',relay:'Ретранслятор',
 hangar:'Ангар патрулей',support:'Ремонтная платформа'
});
const stationHp=Object.freeze({extractor:280,factory:550,relay:250,hangar:360,support:310});
const workerCount=2,workerRebuildCost=6,workerRebuildSeconds=75;
const offsets=Object.freeze([
 {x:-950,y:-90},{x:920,y:160},{x:-45,y:-760},
 {x:725,y:-740},{x:-650,y:820}
]);
const warped=(x,y,rotation)=>({
 x:x*Math.cos(rotation)-y*Math.sin(rotation),
 y:x*Math.sin(rotation)+y*Math.cos(rotation)
});
const regionName=id=>REGIONS.find(r=>r.id===id)?.name||id;

function colonyPosition(seed,region,index){
 const k=index+1,offset=(hash(k,region.length,seed)-.5);
 if(region==='amethyst'){
  const angle=(index+.18+offset*.13)/POPULATION.coloniesPerRegion*TAU;
  const radius=6800+(index%3)*3500+Math.floor(index/3)*1600+
   hash(index,27,seed)*700;
  return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};
 }
 const angle=regionAngle[region]+(index-2.5)*.215+offset*.075;
 const radius=28200+index*3450+hash(index,35,seed)*900;
 return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};
}

function colony(seed,region,index){
 const center=colonyPosition(seed,region,index),id='colony:'+region+':'+index;
 const rotation=hash(index,region.length,seed+87)*TAU;
 const tier=region==='amethyst'?1+Math.floor(index/2):
  Math.min(5,2+Math.floor(index/2));
 const fortress=index===5&&region!=='amethyst';
 const buildings=roles.map((role,i)=>{
  const offset=warped(offsets[i].x,offsets[i].y,rotation);
  return {id:id+':'+role,x:center.x+offset.x,y:center.y+offset.y,
   role,title:roleTitles[role],type:types[role],
   hp:stationHp[role]+tier*65};
 });
 const ready=Math.min(POPULATION.maxReserve,10+tier*4+(fortress?8:0));
 return {id,region,index,x:center.x,y:center.y,tier,fortress,rotation,
  buildings,ore:24+Math.floor(hash(index,39,seed)*18),
  miners:Array.from({length:workerCount},(_,n)=>({
   id:id+':miner:'+n,colonyId:id,populationWorker:true,
   x:center.x-950,y:center.y-90,r:17,hp:90+tier*17,maxHp:90+tier*17,
   hit:0,slot:n,repairUntil:0,repairPaid:false
  })),
  deposit:2600+Math.floor(hash(index,42,seed)*1700),
  pool:18+tier*3,ready,produced:0,shipped:0,delivered:0,intercepted:0,
  built:0,lost:0,patrols:0,patrolCooldown:0,alarmUntil:0,
  reportedAt:-1,reportedX:0,reportedY:0,radioQueue:[],
  nextDispatch:8+index*2,buildUntil:0,buildQueued:false,
  lastAlarmSent:0,sorties:[],
  respondedToFields:[],
  shield:fortress?{
   segments:[0,1,2].map(i=>({hp:POPULATION.shieldSegmentHp,
    maxHp:POPULATION.shieldSegmentHp,angle:rotation+i*TAU/3})),
   breachUntil:0,repairAt:0,spent:0
  }:null};
}

export function createPopulation(seed=20261102,time=0){
 const colonies=REGIONS.flatMap(region=>Array.from(
  {length:POPULATION.coloniesPerRegion},(_,index)=>colony(seed,region.id,index)));
 return {version:1,seed,clock:Math.floor(time),colonies,convoys:[],
  serial:0,launched:0,intercepted:0,arrived:0,events:[]};
}

const live=(world,id)=>{const s=world.stations.get(id);
 return !!s?.enemy&&!s.captured&&!s.suppressed&&s.hp>0;};
const roleId=(colony,role)=>colony.id+':'+role;
const endpoints=(world,colony)=>({
 source:world.stations.get(roleId(colony,'extractor')),
 factory:world.stations.get(roleId(colony,'factory'))
});
const record=(state,kind,colony,time,extra={})=>{
 const event={kind,colonyId:colony.id,time,...extra};
 state.events.push(event);
 if(state.events.length>30)state.events.splice(0,state.events.length-30);
 return event;
};

export function populationStations(population){
 return population.colonies.flatMap(c=>c.buildings.map(b=>({id:b.id,x:b.x,y:b.y,
  type:b.type,rank:c.tier,title:(c.fortress?'Крепость · ':'Колония · ')+b.title,
  strategicRole:'population-'+b.role,colonyId:c.id,enemy:true,
  active:false,activationIndex:0,discovered:false,usedUpgrade:false,
  captured:false,hp:b.hp,maxHp:b.hp,turrets:[],
  signalAt:0})));
}

export function ensurePopulationStations(world){
 if(!world?.population)return;
 world.populationStations=populationStations(world.population).map(spec=>{
  const existing=world.stations.get(spec.id);
  if(existing)return existing;
  if(['extractor','factory','hangar'].includes(spec.strategicRole.slice(11))){
   const count=spec.strategicRole==='population-factory'?3:2;
   for(let i=0;i<count;i++){
    const a=i*TAU/count;
    spec.turrets.push({x:spec.x+Math.cos(a)*95,y:spec.y+Math.sin(a)*95,
     colonyId:spec.colonyId,
     hp:85+spec.rank*28,maxHp:85+spec.rank*28,shot:1+i*.37});
   }
  }
  world.stations.set(spec.id,spec);return spec;
 });
 const byCell=new Map(),cell=2500;
 for(const station of world.populationStations){
  const key=Math.floor(station.x/cell)+':'+Math.floor(station.y/cell);
  if(!byCell.has(key))byCell.set(key,[]);
  byCell.get(key).push(station.id);
 }
 world.populationStationCells=byCell;
}

export function nearbyPopulationStations(world,x,y,r){
 const found=[],grid=world.populationStationCells;
 if(!grid)return found;
 const cell=2500,left=Math.floor((x-r)/cell),right=Math.floor((x+r)/cell);
 const top=Math.floor((y-r)/cell),bottom=Math.floor((y+r)/cell);
 for(let cy=top;cy<=bottom;cy++)for(let cx=left;cx<=right;cx++)
  for(const id of grid.get(cx+':'+cy)||[]){
   const station=world.stations.get(id);
   if(station&&distance(station,{x,y})<r)found.push(station);
  }
 return found;
}

// Seed hostile territorial rings before the first frame; new expansion still
// pays for every link laid after launch.
export function seedPopulationTerritory(world){
 const state=world.enemyExpansion;
 if(!state?.links)return;
 const seen=new Set(state.links.map(([a,b])=>[a,b].sort().join('|')));
 for(const colony of world.population.colonies){
  if(colony.index%2===0&&!colony.fortress)continue;
  const ids=['extractor','factory','relay'].map(role=>roleId(colony,role));
  for(let i=0;i<3;i++){
   const a=ids[i],b=ids[(i+1)%3],key=[a,b].sort().join('|');
   if(seen.has(key))continue;
   const aa=world.stations.get(a),bb=world.stations.get(b);
   if(!aa||!bb||distance(aa,bb)>2800)continue;
   seen.add(key);state.links.push([a,b,'home']);
  }
 }
}

function routeEndpoint(world,colony){
 const neighbors=world.population.colonies.filter(c=>c.region===colony.region);
 const target=neighbors[(colony.index+1)%neighbors.length];
 return target||colony;
}
const routeLength=(a,b)=>distance(a,b);
export function populationCargoPosition(world,cargo,time){
 const source=world.stations.get(cargo.sourceId);
 const depot=world.stations.get(cargo.targetId);
 if(!source||!depot)return {x:cargo.x,y:cargo.y,angle:cargo.angle||0};
 const dx=depot.x-source.x,dy=depot.y-source.y,mag=Math.hypot(dx,dy)||1;
 const length=cargo.routeLength||routeLength(source,depot);
 const progress=clamp((time-cargo.launchedAt)*cargo.speed/Math.max(1,length),0,1);
 const bend=Math.sin(progress*Math.PI)*cargo.bend;
 return {x:source.x+dx*progress-dy/mag*bend,
  y:source.y+dy*progress+dx/mag*bend,
  angle:Math.atan2(dy,dx)+Math.PI/2,distance:length*progress};
}
export function updatePopulationMiners(world,c,time){
 const source=world.stations.get(roleId(c,'extractor'));
 if(!source)return;
 for(const miner of c.miners){
  const phase=time*.47+miner.slot*Math.PI+c.rotation;
  miner.x=source.x+Math.cos(phase)*(190+miner.slot*75);
  miner.y=source.y+Math.sin(phase)*(190+miner.slot*75);
 }
}
export function populationWorkersNear(world,x,y,r=1300){
 if(!world?.population)return [];
 const near=[];
 for(const c of world.population.colonies){
  const source=world.stations.get(roleId(c,'extractor'));
  if(!source?.enemy||distance(source,{x,y})>r+320)continue;
  updatePopulationMiners(world,c,world.population.clock);
  for(const miner of c.miners)if(miner.hp>0&&distance(miner,{x,y})<r)near.push(miner);
 }
 return near;
}
export function damagePopulationWorker(world,miner,damage,time){
 const c=populationColony(world,miner);
 if(!c||!c.miners.includes(miner)||miner.hp<=0)return {hit:false};
 miner.hp=Math.max(0,miner.hp-Math.max(0,damage));
 miner.hit=.24;
 if(miner.hp===0){
  record(world.population,'miner-lost',c,time,{slot:miner.slot});
  populationAlarm(world,miner.x,miner.y,time,'mining-attack');
  return {hit:true,killed:true,colony:c};
 }
 return {hit:true,killed:false,colony:c};
}
function launch(world,state,colony,now){
 const target=routeEndpoint(world,colony);
 const source=world.stations.get(roleId(colony,'extractor'));
 const depot=world.stations.get(roleId(target,'factory'));
 if(!source||!depot||!live(world,source.id)||!live(world,depot.id))return null;
 const length=routeLength(source,depot);
 const cargo={id:'population-cargo-'+(++state.serial),populationCargo:true,
  regionalCargo:true,colonyId:colony.id,targetColonyId:target.id,
  sourceId:source.id,targetId:depot.id,routeLength:length,
  bend:(hash(state.serial,colony.index,state.seed)-.5)*650,
  speed:POPULATION.cargoSpeed+colony.tier*11,launchedAt:now,
  hp:POPULATION.convoyHp+colony.tier*18,
  maxHp:POPULATION.convoyHp+colony.tier*18,r:36,hit:0,seen:false,
  escortManifest:null,escorted:false,rewarded:false,
  angle:0,x:source.x,y:source.y,distance:0};
 state.convoys.push(cargo);colony.ore-=POPULATION.cargoCost;
 colony.shipped++;state.launched++;
 return record(state,'dispatch',colony,now,{cargoId:cargo.id,targetId:target.id});
}
function updateShield(colony,t){
 const shield=colony.shield;
 if(!shield)return;
 if(shield.breachUntil>t)return;
 if(shield.breachUntil&&t>=shield.breachUntil){
  shield.breachUntil=0;
  shield.repairAt=t+10;
 }
 if(t<shield.repairAt)return;
 if(shield.segments.filter(s=>s.hp>0).length<2&&colony.pool>=12){
  colony.pool-=12;let restored=0;
  for(const segment of shield.segments)if(segment.hp<=0&&restored<2){
   segment.hp=180;restored++;
  }
 }
 for(const segment of shield.segments){
  if(segment.hp<segment.maxHp&&colony.pool>=.15){
   const charge=Math.min(POPULATION.shieldChargePerSecond,segment.maxHp-segment.hp);
   segment.hp+=charge;colony.pool=Math.max(0,colony.pool-charge*.025);
  }
 }
}
export function advancePopulation(world,time){
 const state=world.population,events=[];
 if(!state||!Number.isFinite(time)||time<state.clock)return events;
 while(state.clock<Math.floor(time)){
  const t=++state.clock;
  for(const c of state.colonies){
   const source=roleId(c,'extractor'),factory=roleId(c,'factory');
   updatePopulationMiners(world,c,t);
   for(const miner of c.miners){
    if(miner.hp>0||!live(world,source))continue;
    if(!miner.repairPaid&&c.pool>=workerRebuildCost){
     c.pool-=workerRebuildCost;miner.repairPaid=true;
     miner.repairUntil=t+workerRebuildSeconds;
    }
    if(miner.repairPaid&&t>=miner.repairUntil){
     miner.hp=miner.maxHp;miner.repairPaid=false;miner.repairUntil=0;
     events.push(record(state,'miner-restored',c,t,{slot:miner.slot}));
    }
   }
   const working=c.miners.filter(m=>m.hp>0).length;
   if(live(world,source)&&working&&c.deposit>0&&c.ore<POPULATION.oreCapacity){
    const mined=Math.min(c.deposit,POPULATION.miningPerSecond*working/workerCount,
     POPULATION.oreCapacity-c.ore);
    c.deposit-=mined;c.ore+=mined;c.produced+=mined;
   }
   if(c.radioQueue.length){
    for(const message of c.radioQueue.filter(m=>m.dueAt<=t)){
     c.reportedAt=t;c.reportedX=message.x;c.reportedY=message.y;
     c.alarmUntil=Math.max(c.alarmUntil,t+95);
     events.push(record(state,'alarm',c,t,{x:message.x,y:message.y}));
    }
    c.radioQueue=c.radioQueue.filter(m=>m.dueAt>t);
   }
   updateShield(c,t);
   if(c.buildQueued&&t>=c.buildUntil){
    c.buildQueued=false;c.ready=Math.min(POPULATION.maxReserve,c.ready+POPULATION.shipsPerBuild);
    c.built+=POPULATION.shipsPerBuild;
    events.push(record(state,'build',c,t,{ships:POPULATION.shipsPerBuild}));
   }
   if(live(world,factory)&&!c.buildQueued&&c.pool>=POPULATION.buildCost&&
       c.ready<=POPULATION.maxReserve-POPULATION.shipsPerBuild){
    c.pool-=POPULATION.buildCost;c.buildQueued=true;
    c.buildUntil=t+POPULATION.buildSeconds;
   }
   const outbound=state.convoys.filter(v=>v.colonyId===c.id&&v.hp>0).length;
   if(t>=c.nextDispatch&&c.ore>=POPULATION.cargoCost&&
      outbound<POPULATION.cargoCapacity){
    const sent=launch(world,state,c,t);
    if(sent)events.push(sent);
    c.nextDispatch=t+POPULATION.launchInterval+
     Math.floor(hash(t,c.index,state.seed)*8);
   }
  }
  for(const cargo of state.convoys){
   if(cargo.hp<=0)continue;
   const position=populationCargoPosition(world,cargo,t);
   Object.assign(cargo,position);
   if(cargo.distance+1e-6>=cargo.routeLength){
    cargo.hp=0;
    const target=state.colonies.find(c=>c.id===cargo.targetColonyId);
    if(target&&live(world,cargo.targetId)){
     target.pool=Math.min(100,target.pool+POPULATION.cargoCost);
     target.delivered++;state.arrived++;
     events.push(record(state,'delivery',target,t,{cargoId:cargo.id}));
    }
   }
  }
  state.convoys=state.convoys.filter(c=>c.hp>0);
 }
 for(const cargo of state.convoys)Object.assign(cargo,populationCargoPosition(world,cargo,time));
 return events;
}
export function interceptPopulationCargo(world,cargo,time){
 const state=world?.population;
 if(!state?.convoys.includes(cargo)||cargo.hp>0||cargo.rewarded)return false;
 cargo.rewarded=true;state.convoys=state.convoys.filter(c=>c!==cargo);
 const colony=state.colonies.find(c=>c.id===cargo.colonyId);
 if(colony){colony.intercepted++;record(state,'intercept',colony,time,{cargoId:cargo.id});}
 state.intercepted++;
 return true;
}
export function populationColony(world,target){
 const id=typeof target==='string'?target:target?.colonyId;
 return id?world?.population?.colonies.find(c=>c.id===id)||null:null;
}
export function populationAlarm(world,x,y,time,kind='sighting'){
 const state=world?.population;
 if(!state)return 0;
 let heard=0;
 for(const colony of state.colonies){
  const relay=roleId(colony,'relay'),near=distance(colony,{x,y});
  if(near>POPULATION.radioRadius||!live(world,relay))continue;
  const dueAt=Math.ceil(time)+POPULATION.alarmDelay+Math.ceil(near/1300);
  // The report carries a last-known coordinate. It does not track a moving pilot.
  if(colony.radioQueue.some(m=>m.dueAt>=time&&Math.hypot(m.x-x,m.y-y)<500))continue;
  colony.radioQueue.push({x,y,dueAt,kind});
  colony.radioQueue=colony.radioQueue.slice(-6);
  heard++;
 }
 return heard;
}
export function populationShield(world,target,time=0){
 const colony=populationColony(world,target);
 return colony?.shield&&colony.shield.breachUntil<=time&&
  colony.shield.segments.filter(s=>s.hp>0).length>=2&&
  live(world,roleId(colony,'relay'))?colony:null;
}
export function damagePopulationShield(world,target,damage,time,source){
 const colony=populationShield(world,target,time);
 if(!colony)return {blocked:false};
 if(source!=='artillery')return {blocked:true,damaged:false};
 const shield=colony.shield,angle=Math.atan2(target.y-colony.y,target.x-colony.x);
 const segment=shield.segments.reduce((best,s)=>Math.cos(angle-s.angle)>Math.cos(angle-best.angle)?s:best);
 const dealt=Math.min(segment.hp,Math.max(0,damage));
 segment.hp-=dealt;
 const down=shield.segments.filter(s=>s.hp<=0).length;
 if(down>=2){
  shield.breachUntil=time+POPULATION.shieldBreachSeconds;
  shield.repairAt=shield.breachUntil+POPULATION.shieldRecovery;
  const state=world.population;
  record(state,'breach',colony,time,{until:shield.breachUntil});
  return {blocked:true,damaged:dealt>0,breached:true,colony};
 }
 return {blocked:true,damaged:dealt>0,segment,colony};
}

export function validPopulation(state,stations,time){
 if(state===undefined)return true;
 if(!state||state.version!==1||!Number.isInteger(state.seed)||
  !Number.isInteger(state.clock)||state.clock<0||state.clock>time||
  !Array.isArray(state.colonies)||state.colonies.length!==REGIONS.length*POPULATION.coloniesPerRegion||
  !Array.isArray(state.convoys)||state.convoys.length>POPULATION.activeLimit||
  !Number.isInteger(state.serial)||state.serial<0||state.serial>1e9||
  !Array.isArray(state.events)||state.events.length>30)return false;
 const ids=new Set(stations.map(([id])=>id)),seen=new Set();
 for(const c of state.colonies){
  if(!c||!/^colony:(amethyst|amber|azure|lilac|teal):[0-5]$/.test(c.id)||
   seen.has(c.id)||!Number.isFinite(c.x)||!Number.isFinite(c.y)||
   !Number.isFinite(c.ore)||c.ore<0||c.ore>POPULATION.oreCapacity+1||
   !Number.isFinite(c.deposit)||c.deposit<0||c.deposit>5000||
   !Number.isFinite(c.pool)||c.pool<0||c.pool>100||
   !Number.isInteger(c.ready)||c.ready<0||c.ready>POPULATION.maxReserve||
   !Array.isArray(c.miners)||c.miners.length!==workerCount||
   c.miners.some(m=>!m.populationWorker||m.colonyId!==c.id||
    !Number.isFinite(m.x)||!Number.isFinite(m.y)||
    !Number.isFinite(m.hp)||m.hp<0||m.hp>m.maxHp||
    !Number.isFinite(m.repairUntil)||m.repairUntil<0||
    typeof m.repairPaid!=='boolean')||
   !Number.isFinite(c.nextDispatch)||c.nextDispatch<0||c.nextDispatch>1e9||
   !Array.isArray(c.radioQueue)||c.radioQueue.length>6||
   !Array.isArray(c.sorties)||c.sorties.length>30||
   !Array.isArray(c.respondedToFields)||c.respondedToFields.length>32||
   c.respondedToFields.some(id=>typeof id!=='string'||id.length>220)||
   c.sorties.some(s=>!Number.isInteger(s.serial)||s.serial<0||
     !Number.isFinite(s.x)||!Number.isFinite(s.y)||
     !Number.isFinite(s.toX)||!Number.isFinite(s.toY)||
     !Number.isFinite(s.launchedAt)||!Number.isFinite(s.returnAt))||
   c.radioQueue.some(m=>!Number.isFinite(m.x)||!Number.isFinite(m.y)||
    !Number.isFinite(m.dueAt)||m.dueAt<0||m.dueAt>1e9)||
   !roles.every(role=>ids.has(roleId(c,role))))return false;
  if(c.shield&&(!Array.isArray(c.shield.segments)||c.shield.segments.length!==3||
    !Number.isFinite(c.shield.breachUntil)||c.shield.breachUntil<0||
    c.shield.breachUntil>time+POPULATION.shieldBreachSeconds+1||
    c.shield.segments.some(s=>!Number.isFinite(s.hp)||s.hp<0||s.hp>POPULATION.shieldSegmentHp)))return false;
  seen.add(c.id);
 }
 const convoys=new Set();
 for(const cargo of state.convoys){
  if(!cargo||!cargo.populationCargo||!cargo.regionalCargo||
   convoys.has(cargo.id)||!/^population-cargo-\d+$/.test(cargo.id)||
   !ids.has(cargo.sourceId)||!ids.has(cargo.targetId)||
   !Number.isFinite(cargo.x)||!Number.isFinite(cargo.y)||
   !(cargo.hp>0)||cargo.hp>cargo.maxHp||
   !Number.isFinite(cargo.launchedAt)||cargo.launchedAt<0||cargo.launchedAt>time||
   !Number.isFinite(cargo.routeLength)||cargo.routeLength<=0||
   !Number.isFinite(cargo.distance)||cargo.distance<0||
   cargo.distance>cargo.routeLength+cargo.speed)return false;
  convoys.add(cargo.id);
 }
 return true;
}
