// The first small, autonomous industrial loop. It is part of regionalSupply,
// not an independent source of free enemies. Production requires a living
// worker, an actual asteroid and a hostile source station. Every convoy is
// paid for once and can fund at most one replacement ambient encounter.
export const CENTRAL_INDUSTRY=Object.freeze({
 sourceId:'industry:source',depotId:'industry:depot',
 sourceX:4400,sourceY:2800,depotX:7200,depotY:1600,
 workerSpeed:155,miningRate:1,miningYield:.24,workerCapacity:4,
 oreCapacity:16,cargoCost:8,dispatchPeriod:75,
 cargoSpeed:210,cargoHp:115,warning:9,assembly:14,
 oreReward:6,dataReward:8
});

export const CENTRAL_STATIONS=Object.freeze([
 {id:CENTRAL_INDUSTRY.sourceId,x:CENTRAL_INDUSTRY.sourceX,y:CENTRAL_INDUSTRY.sourceY,
  type:'arsenal',rank:1,strategicRole:'central-source',title:'Малая добывающая станция',
  hp:225,turrets:1,turretHp:65},
 {id:CENTRAL_INDUSTRY.depotId,x:CENTRAL_INDUSTRY.depotX,y:CENTRAL_INDUSTRY.depotY,
  type:'carrier',rank:1,strategicRole:'central-depot',title:'Сборочный пост',
  hp:280,turrets:2,turretHp:65}
]);

export const CENTRAL_ROUTE=Object.freeze([
 Object.freeze({x:CENTRAL_INDUSTRY.sourceX,y:CENTRAL_INDUSTRY.sourceY}),
 Object.freeze({x:5900,y:1650}),
 Object.freeze({x:CENTRAL_INDUSTRY.depotX,y:CENTRAL_INDUSTRY.depotY})
]);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const legLengths=CENTRAL_ROUTE.slice(1).map((p,i)=>distance(CENTRAL_ROUTE[i],p));
const routeLength=legLengths.reduce((a,b)=>a+b,0);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function centralCargoPosition(progress){
 let rest=clamp(progress,0,routeLength);
 for(let i=1;i<CENTRAL_ROUTE.length;i++){
  const a=CENTRAL_ROUTE[i-1],b=CENTRAL_ROUTE[i],d=legLengths[i-1];
  if(rest<=d){const f=rest/d;return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,
   angle:Math.atan2(b.y-a.y,b.x-a.x)+Math.PI/2};}
  rest-=d;
 }
 return {...CENTRAL_ROUTE.at(-1),angle:0};
}

export function createCentralIndustry(time=0){
 const clock=Math.floor(time);
 const start={x:CENTRAL_INDUSTRY.sourceX+95,y:CENTRAL_INDUSTRY.sourceY-90};
 return {version:1,clock,ore:0,nextDispatch:clock+60,serial:0,
  convoys:[],reserves:0,pendingRaid:null,assemblyUntil:0,nextRaid:0,
  produced:0,delivered:0,intercepted:0,raids:0,
  worker:{centralWorker:true,x:start.x,y:start.y,hp:70,maxHp:70,r:16,phase:'seek',
   rockId:null,carry:0,from:{...start},to:{...start},at:clock,until:clock},
  history:[]};
}

export function centralWorkerPosition(worker,now){
 if(!worker)return null;
 const a=worker.from,b=worker.to;
 if(worker.phase!=='outbound'&&worker.phase!=='return')return {x:b.x,y:b.y};
 const f=clamp((now-worker.at)/Math.max(.001,worker.until-worker.at),0,1);
 return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}

export function centralEvent(s,kind,time){
 s.history.push({kind,time});s.history=s.history.slice(-8);
 return {kind,time,central:true};
}

function nearbyOre(world){
 const site=CENTRAL_ROUTE[0];
 return world.nearbyRocks(site.x,site.y,850)
  .filter(r=>r.alive&&r.hp>0&&distance(r,site)>190)
  .sort((a,b)=>distance(a,site)-distance(b,site)||a.id.localeCompare(b.id));
}

function workerTick(world,s,t){
 const w=s.worker,site=CENTRAL_ROUTE[0];
 if(!world.stations.get(CENTRAL_INDUSTRY.sourceId)?.enemy||w.hp<=0)return;
 if(w.phase==='seek'){
  if(s.ore>=CENTRAL_INDUSTRY.oreCapacity)return;
  const rock=nearbyOre(world)[0];
  if(!rock)return;
  w.phase='outbound';w.rockId=rock.id;w.from={...w.to};
  w.to={x:rock.x,y:rock.y};w.at=t;
  w.until=t+Math.max(1,Math.ceil(distance(w.from,w.to)/CENTRAL_INDUSTRY.workerSpeed));
 }else if(w.phase==='outbound'){
  if(t>=w.until){w.phase='mining';w.at=t;w.until=t;}
 }else if(w.phase==='mining'){
  const rock=nearbyOre(world).find(r=>r.id===w.rockId);
  if(rock&&distance(rock,w.to)<85&&w.carry<CENTRAL_INDUSTRY.workerCapacity){
   const mined=Math.min(rock.hp,CENTRAL_INDUSTRY.miningRate);
   rock.hp=Math.max(0,rock.hp-mined);
   if(rock.hp<=0)rock.alive=false;
   const ore=Math.min(CENTRAL_INDUSTRY.workerCapacity-w.carry,
    mined*CENTRAL_INDUSTRY.miningYield);
   w.carry+=ore;s.produced+=ore;
  }
  if(!rock||w.carry>=CENTRAL_INDUSTRY.workerCapacity-.001||
    !rock.alive||distance(rock,w.to)>=85){
   w.phase='return';w.from={...w.to};w.to={x:site.x+95,y:site.y-90};
   w.at=t;w.until=t+Math.max(1,Math.ceil(distance(w.from,w.to)/CENTRAL_INDUSTRY.workerSpeed));
  }
 }else if(w.phase==='return'&&t>=w.until){
  s.ore=Math.min(CENTRAL_INDUSTRY.oreCapacity,s.ore+w.carry);
  w.carry=0;w.rockId=null;w.phase='seek';w.from={...w.to};w.at=t;w.until=t;
 }
}

// One-second deterministic strategic ticks; fractional position is derived
// analytically for rendering, so a visible worker never jumps once a second.
export function advanceCentralIndustry(world,time){
 const s=world.regionalSupply?.central,events=[];
 if(!s)return events;
 const mine=world.stations.get(CENTRAL_INDUSTRY.sourceId);
 const depot=world.stations.get(CENTRAL_INDUSTRY.depotId);
 const emit=(kind,t)=>events.push(centralEvent(s,kind,t));
 while(s.clock<Math.floor(time)){
  const t=++s.clock;
  workerTick(world,s,t);
 if(mine?.enemy&&depot?.enemy&&s.ore+1e-8>=CENTRAL_INDUSTRY.cargoCost&&
    t>=s.nextDispatch&&s.convoys.length<1&&s.reserves<2){
   s.ore=Math.max(0,s.ore-CENTRAL_INDUSTRY.cargoCost);
   s.nextDispatch=t+CENTRAL_INDUSTRY.dispatchPeriod;
   s.convoys.push({id:'central-cargo-'+(++s.serial),regionalCargo:true,
    centralCargo:true,type:'fighter',distance:0,launchedAt:t,
    ...centralCargoPosition(0),r:29,hp:CENTRAL_INDUSTRY.cargoHp,
    maxHp:CENTRAL_INDUSTRY.cargoHp,hit:0,seen:false});
   emit('central-dispatch',t);
  }
  for(const cargo of s.convoys){
   if(cargo.hp<=0)continue;
   cargo.distance=(t-cargo.launchedAt)*CENTRAL_INDUSTRY.cargoSpeed;
   Object.assign(cargo,centralCargoPosition(cargo.distance));
   if(cargo.distance>=routeLength){
    cargo.hp=0;
    if(depot?.enemy){
     if(s.reserves<2){s.reserves++;s.delivered++;s.assemblyUntil=t+CENTRAL_INDUSTRY.assembly;
      emit('central-delivery',t);}
     else emit('central-overflow',t);
    }else emit('central-diverted',t);
   }
  }
  s.convoys=s.convoys.filter(c=>c.hp>0);
  if(!depot?.enemy){s.reserves=0;s.pendingRaid=null;}
  if(depot?.enemy&&s.reserves>0&&!s.pendingRaid&&
    t>=s.assemblyUntil&&t>=s.nextRaid){
   s.reserves--;s.pendingRaid={readyAt:t+CENTRAL_INDUSTRY.warning};
   emit('central-raid-warning',t);
  }
 }
 for(const cargo of s.convoys){
  cargo.distance=(time-cargo.launchedAt)*CENTRAL_INDUSTRY.cargoSpeed;
  Object.assign(cargo,centralCargoPosition(cargo.distance));
 }
 Object.assign(s.worker,centralWorkerPosition(s.worker,time));
 return events;
}

export function interceptCentralCargo(world,cargo,time){
 const s=world.regionalSupply?.central;
 if(!s?.convoys.includes(cargo)||cargo.rewarded||cargo.hp>0)return false;
 cargo.rewarded=true;s.intercepted++;
 s.convoys=s.convoys.filter(c=>c!==cargo);
 centralEvent(s,'central-intercept',time);return true;
}

export function disableCentralWorker(world,worker,time){
 const s=world.regionalSupply?.central;
 if(!s||s.worker!==worker||worker.hp>0||worker.phase==='disabled')return false;
 worker.phase='disabled';worker.carry=0;
 centralEvent(s,'central-worker-lost',time);return true;
}

export function centralIndustryValid(s,time){
 const valid=(x,a=0,b=1e9)=>Number.isFinite(x)&&x>=a&&x<=b;
 const point=p=>p&&valid(p.x,-1e9,1e9)&&valid(p.y,-1e9,1e9);
 const w=s?.worker;
 return !!s&&s.version===1&&Number.isInteger(s.clock)&&valid(s.clock,0,time)&&
  valid(s.ore,0,CENTRAL_INDUSTRY.oreCapacity)&&valid(s.nextDispatch)&&
  Number.isSafeInteger(s.serial)&&valid(s.serial)&&
  Number.isInteger(s.reserves)&&valid(s.reserves,0,2)&&
  valid(s.assemblyUntil)&&valid(s.nextRaid)&&
  (!s.pendingRaid||valid(s.pendingRaid.readyAt))&&
  ['produced','delivered','intercepted','raids'].every(k=>valid(s[k]))&&
  w?.centralWorker===true&&valid(w.hp,0,w.maxHp)&&w.maxHp===70&&w.r===16&&
  ['seek','outbound','mining','return','disabled','evacuated'].includes(w.phase)&&
  (w.rockId===null||typeof w.rockId==='string'&&w.rockId.length<100)&&
  valid(w.carry,0,CENTRAL_INDUSTRY.workerCapacity)&&point(w)&&point(w.from)&&point(w.to)&&
  valid(w.at)&&valid(w.until)&&w.until>=w.at&&
  Array.isArray(s.history)&&s.history.length<=8&&
  s.history.every(e=>/^central-/.test(e.kind)&&valid(e.time,0,time))&&
  Array.isArray(s.convoys)&&s.convoys.length<=1&&
  s.convoys.every(c=>c.centralCargo===true&&c.regionalCargo===true&&
   /^central-cargo-\d+$/.test(c.id)&&valid(c.launchedAt,0,time)&&
   valid(c.distance,0,routeLength+CENTRAL_INDUSTRY.cargoSpeed)&&
   point(c)&&valid(c.hp,.001,CENTRAL_INDUSTRY.cargoHp)&&
   c.maxHp===CENTRAL_INDUSTRY.cargoHp&&c.r===29);
}
