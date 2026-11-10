import {artilleryLinks,artilleryConnection,edgeTurretOccupancy,edgeTurretLimit,ARTILLERY_MODES,FLUX_ARTILLERY,
 turnArtilleryGun} from './flux-artillery.js?v=turret-preload-20261109-1-audit-1-frontier-siege-1-territory-logistics-1-corecharge-20261110';
import {frontierBuoysNear,damageFrontierBuoy} from './enemy-frontier-network.js?v=frontier-fence-1';
import {arcChainCount,arcRange,arcCooldown,arcSlowSeconds,laserEmitters,laserCooldown,
 laserBurst,laserRange,hiveLimit,hiveRange,hiveArmor,supportSupply,turretBranchRank,
 validTurretBranches} from './turret-growth.js?v=turret-preload-20261109-1-audit-1-guided-1';
import {worldTextScale} from './camera-zoom.js?v=flight-zoom-2-text-scale-1';
import {nearestSupplyDepot,takeDepotFlux} from './flux-depots.js?v=territory-logistics-1-flux-siphon-roads-1';
import {hasPoweredContour} from './contour-trials.js';

// All three structures spend delivered flux. A nest pays for each replacement
// drone; the other two consume prepaid charges instead of free damage ticks.
export const SUPPORT_TYPES=Object.freeze({
 arc:Object.freeze({name:'Разрядник',oreCost:24,fluxCost:1.4,maxHp:95,r:35,
  buildSeconds:3.2,range:440,magazine:12,chargeCost:.22,fluxPerMinute:3.4,
  cooldown:3.5,damage:4.5,capacity:1,color:'#a28bff'}),
 laser:Object.freeze({name:'Лазерное гнездо',oreCost:26,fluxCost:1.8,maxHp:100,r:36,
  buildSeconds:3.4,range:440,magazine:10,chargeCost:.20,fluxPerMinute:9.6,
  cooldown:2.2,damage:3.6,capacity:1,color:'#ff9762'}),
 hive:Object.freeze({name:'Дроновая матка',oreCost:32,fluxCost:4,maxHp:125,r:43,
  buildSeconds:4.3,range:320,magazine:0,chargeCost:2.5,fluxPerMinute:4.6,
  cooldown:1.45,damage:5.5,capacity:2,color:'#70e7be'})
});
export const SUPPORT_MAX=60, SUPPORT_PACKET_MAX=256;
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
// The beam loses almost all power before acquisition ends: its outer edge
// must not remain a visibly strong shot followed by an abrupt cutoff.
export const laserFalloff=(distance,range)=>{
 const ratio=clamp(distance/Math.max(1,range),0,1);
 return .025+.975*Math.pow(Math.max(0,1-ratio*ratio),1.35);
};
const liveStructures=world=>[
 ...(world?.contours?.artillery||[]),...(world?.contours?.supportTurrets||[])]
 .filter(t=>t.hp>0);
const stateOf=world=>{
 const s=world.contours;s.supportTurrets??=[];s.supportPackets??=[];
 s.supportSerial??=0;return s;
};
export const supportConfig=t=>SUPPORT_TYPES[typeof t==='string'?t:t?.type]||null;
export function supportOffer(world,player,point,type){
 const cfg=supportConfig(type),s=world?.contours;
 if(!cfg)return {ok:false,reason:'Неизвестный тип сооружения'};
 if(!s||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))
  return {ok:false,reason:'Укажите место строительства'};
 if(!hasPoweredContour(world))
  return {ok:false,reason:'Сначала зарядите ядро первого треугольника'};
 const edges=artilleryLinks(world);
 if(!edges.length)return {ok:false,reason:'Нет работающего замкнутого контура'};
 if(d(player,point)>FLUX_ARTILLERY.buildRadius)
  return {ok:false,reason:'Слишком далеко от корабля-строителя'};
 if(d(player,point)<75)return {ok:false,reason:'Освободите место рядом с кораблём'};
 if(liveStructures(world).length>=FLUX_ARTILLERY.maxTurrets)
  return {ok:false,reason:'Достигнут предел сооружений'};
 if((s.supportTurrets||[]).filter(t=>t.hp>0).length>=SUPPORT_MAX)
  return {ok:false,reason:'Достигнут предел вспомогательных установок'};
 if([...(s.artillery||[]),...(s.supportTurrets||[]),...(s.fluxDepots||[]).filter(t=>t.hp>0),
  ...(s.fluxSiphonHives||[]).filter(t=>t.hp>0)]
  .some(t=>d(t,point)<FLUX_ARTILLERY.clearance))
  return {ok:false,reason:'Слишком близко к другому сооружению'};
 if([...world.stations.values()].some(st=>d(st,point)<FLUX_ARTILLERY.stationClearance))
  return {ok:false,reason:'Слишком близко к станции'};
 const connection=artilleryConnection(point,edges);
 if(!connection)return {ok:false,reason:'Не удалось подключиться к сети'};
 if(edgeTurretOccupancy(world,connection.edgeId,edges)>=edgeTurretLimit(world))
  return {ok:false,reason:'На этой грани нет свободных мест · улучшите сеть турелей'};
 if((player.ore||0)<cfg.oreCost)
  return {ok:false,reason:'Нужно сплава: '+cfg.oreCost};
 if(s.flux+1e-8<cfg.fluxCost)
  return {ok:false,reason:'Нужно флюкса: '+cfg.fluxCost};
 return {ok:true,connection};
}
export function deploySupport(world,player,point,time,type){
 const offer=supportOffer(world,player,point,type);if(!offer.ok)return offer;
 const s=stateOf(world),cfg=supportConfig(type);
 if(s.supportTurrets.length>=SUPPORT_MAX)
  s.supportTurrets=s.supportTurrets.filter(t=>t.hp>0);
 if(s.supportTurrets.length>=SUPPORT_MAX)return {ok:false,reason:'Достигнут предел установок'};
 player.ore-=cfg.oreCost;s.flux=Math.max(0,s.flux-cfg.fluxCost);
 const turret={id:++s.supportSerial,kind:'flux-support',type,x:point.x,y:point.y,
  r:cfg.r,hp:cfg.maxHp,maxHp:cfg.maxHp,level:1,mode:'smart',ammo:0,
  chargeCredit:0,readyAt:time+cfg.buildSeconds,nextShotAt:time,
  lastShotAt:-1,lastChargeAt:-1,lastDestroyedAt:-1,gunAngle:-Math.PI/2,
  aimX:point.x,aimY:point.y,burstLeft:0,burstAt:0,
  initialReady:false,drones:[],branches:{}};
 s.supportTurrets.push(turret);return {ok:true,turret,connection:offer.connection};
}
export function supportAt(world,point,radius=49){
 let found=null,min=radius;
 for(const t of world?.contours?.supportTurrets||[]){
  if(t.hp<=0)continue;const distance=d(t,point);
  if(distance<min){min=distance;found=t;}
 }
 return found;
}
export function setSupportMode(t,mode){
 if(!t||!ARTILLERY_MODES.includes(mode))return false;
 t.mode=mode;return true;
}
export function supportUpgradeOffer(world,player,t,time=0){
 if(!t||t.hp<=0||!['laser','hive'].includes(t.type)||t.type==='laser'&&t.level>=2||
    t.type==='hive'&&t.level>=3)return {ok:false,reason:'Улучшения исчерпаны'};
 if(t.readyAt>time)
  return {ok:false,reason:'Дождитесь постройки'};
 const ore=t.type==='laser'?26:20+(t.level-1)*9,
  flux=t.type==='laser'?2:2.5+(t.level-1);
 if((player?.ore||0)<ore)return {ok:false,reason:'Нужно сплава: '+ore,ore,flux};
 if((world?.contours?.flux||0)+1e-8<flux)
  return {ok:false,reason:'Нужно флюкса: '+flux,ore,flux};
 return {ok:true,ore,flux};
}
export function upgradeSupport(world,player,t,time=0){
 const quote=supportUpgradeOffer(world,player,t,time);if(!quote.ok)return quote;
 player.ore-=quote.ore;world.contours.flux=Math.max(0,world.contours.flux-quote.flux);
 t.level++;return {ok:true,level:t.level,ore:quote.ore,flux:quote.flux};
}
const availableTargets=(game,center,range)=>{
 const targets=[];
 for(const e of game.enemies||[]){
  if(e.hp<=0||e.converted||e.trialRetreatUntil||d(e,center)>range)continue;
  targets.push({kind:'enemy',object:e});
 }
 for(const st of game.world.nearbyStations(center.x,center.y,range+130)){
  if(!st.enemy||st.captured||st.hp<=0)continue;
  const forts=(st.turrets||[]).filter(t=>t.hp>0&&d(t,center)<=range);
  if(forts.length)targets.push(...forts.map(object=>({kind:'fort',object})));
  else if(d(st,center)<=range)targets.push({kind:'base',object:st});
 }
 for(const buoy of frontierBuoysNear(game.world,center.x,center.y,range))
  targets.push({kind:'buoy',object:buoy});
 return targets;
};
const supportTargetCache=new WeakMap(),SUPPORT_TARGET_SCAN_SECONDS=.12;
function chooseTarget(game,origin,range,mode='smart'){
 const previous=supportTargetCache.get(origin),now=game.time;
 if(previous&&now>=previous.at&&now-previous.at<SUPPORT_TARGET_SCAN_SECONDS&&
   previous.range===range&&previous.mode===mode&&previous.enemies===game.enemies&&
   previous.enemyCount===(game.enemies||[]).length&&
   (!previous.target||(previous.target.object.hp>0&&
    d(origin,previous.target.object)<=range&&
    (previous.target.kind!=='enemy'||
     (!previous.target.object.converted&&!previous.target.object.trialRetreatUntil))&&
    (previous.target.kind!=='base'||
     (previous.target.object.enemy&&!previous.target.object.captured)))))return previous.target;
 const list=availableTargets(game,origin,range),cell=160,limit2=cell*cell,
  buckets=new Map();
 for(let i=0;i<list.length;i++){
  const o=list[i].object,ix=Math.floor(o.x/cell),iy=Math.floor(o.y/cell),key=ix+','+iy;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(i);
 }
 let best=null,score=-Infinity;
 for(const target of list){
  const o=target.object,dist=d(origin,o),hp=o.hp||1,maxHp=o.maxHp||hp;
  const ix=Math.floor(o.x/cell),iy=Math.floor(o.y/cell);
  let cluster=0;
  // Sixteen nearby targets already represent a saturated swarm. A hard cap
  // keeps tightly packed late-game waves from reintroducing an O(n²) scan.
  clusterSearch: for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)
   for(const index of buckets.get((ix+x)+','+(iy+y))||[]){
    const other=list[index].object,dx=other.x-o.x,dy=other.y-o.y;
    if(dx*dx+dy*dy<limit2&&++cluster>=16)break clusterSearch;
   }
  const value=mode==='weak'?-hp-dist*.02:
   mode==='strong'?maxHp-dist*.04:
   mode==='group'?cluster*75-dist*.06:
   cluster*24+Math.min(130,maxHp)*.17-dist*.08;
  if(value>score){score=value;best=target;}
 }
 supportTargetCache.set(origin,{at:now,range,mode,enemies:game.enemies,
  enemyCount:(game.enemies||[]).length,target:best});
 return best;
}
function damageTarget(game,target,power,source){
 if(!target||target.object.hp<=0)return;
 if(target.kind==='enemy')game.damageEnemy(target.object,power,source);
 else if(target.kind==='buoy'){
  const hit=damageFrontierBuoy(game.world,target.object,power,game.time);
  if(hit.destroyed){
   game.heritage?.vfx?.nova?.(target.object.x,target.object.y,85,'magenta');
   game.heritage?.play?.('shieldBreak',.5,target.object);
  }
 }
 else if(target.kind==='fort')game.hitTurret(target.object,power,null,'artillery');
 else game.hitEnemyBase(target.object,power,'artillery');
}
const fx=(game,data)=>{
 game.fluxSupportFx??=[];game.fluxSupportFx.push({...data,at:game.time});
 if(game.fluxSupportFx.length>80)game.fluxSupportFx.splice(0,game.fluxSupportFx.length-80);
};
function createDrone(t,time){
 const slot=Math.max(0,...t.drones.map(x=>x.slot))+1;
 if(t.drones.filter(x=>x.hp>0).length>=hiveLimit(t))return;
 // Broken drones are kept only as a short death animation, not as extra slots.
 const armor=hiveArmor(t);
 t.drones.push({slot,x:t.x+22,y:t.y+12,hp:armor,maxHp:armor,r:10,
  nextShotAt:time+1.1,angle:slot*2.39996,lastShotAt:-1});
 if(t.drones.length>20)t.drones=t.drones.filter(x=>x.hp>0);
}
function chargePacket(t,link,cfg,time,charges,kind,depot=null){
 const route=depot?[{x:depot.x,y:depot.y},
  {x:(depot.x+t.x)/2,y:(depot.y+t.y)/2},
  {x:t.x,y:t.y}]:link.route;
 const travel=d(route[0],route[1])+d(route[1],route[2]);
 return {turretId:t.id,edgeId:link.edgeId,kind,charges,
  amount:charges*cfg.chargeCost,launchedAt:time,
  arriveAt:time+.55+travel/FLUX_ARTILLERY.packetSpeed,path:route};
}
function electricShot(game,t,cfg){
 const first=chooseTarget(game,t,arcRange(t),t.mode);if(!first)return false;
 const pool=availableTargets(game,t,arcRange(t)),hits=[first];
 while(hits.length<arcChainCount(t)){
  const previous=hits.at(-1).object;
  const next=pool.filter(x=>!hits.some(hit=>hit.object===x.object)&&
    d(x.object,previous)<155+15*turretBranchRank(t,'chain'))
   .sort((a,b)=>d(a.object,previous)-d(b.object,previous))[0];
  if(!next)break;hits.push(next);
 }
 for(const [i,target]of hits.entries()){
  const experimental=turretBranchRank(t,'anomaly');
  damageTarget(game,target,(cfg.damage+experimental*1.2)*Math.max(.28,1-i*.13),t);
  if(target.kind==='enemy'&&target.object.hp>0){
   const enemy=target.object,now=game.time;
   if((enemy.tacticalSlowUntil||0)>now)
    enemy.tacticalSlowFactor=Math.min(enemy.tacticalSlowFactor||1,.55);
   else enemy.tacticalSlowFactor=.55;
   enemy.tacticalSlowUntil=Math.max(enemy.tacticalSlowUntil||0,now+arcSlowSeconds(t));
   if(turretBranchRank(t,'hold')>=3&&enemy.type!=='boss'&&!enemy.openingCommander&&
     !enemy.relayAssault&&!enemy.stationRaid)
    enemy.stasisUntil=Math.max(enemy.stasisUntil||0,now+.26);
  }
 }
 const experimental=turretBranchRank(t,'anomaly');
 if(experimental>=2&&hits.length>1){
  const bounce=hits[0],last=hits.at(-1);
  damageTarget(game,bounce,cfg.damage*(experimental===3?.75:.4),t);
  fx(game,{kind:'arc',points:[{x:last.object.x,y:last.object.y},
   {x:bounce.object.x,y:bounce.object.y}],hold:turretBranchRank(t,'hold'),
   anomaly:experimental});
 }
 fx(game,{kind:'arc',points:[{x:t.x,y:t.y},...hits.map(x=>({x:x.object.x,y:x.object.y}))],
  hold:turretBranchRank(t,'hold'),anomaly:experimental});
 game.heritage?.play?.('supportArc',.45,t);return true;
}
function laserPulse(game,t,cfg){
 const target=chooseTarget(game,t,laserRange(t),t.mode);if(!target)return;
 const range=d(t,target.object),falloff=laserFalloff(range,laserRange(t));
 const shots=laserEmitters(t);
 damageTarget(game,target,cfg.damage*falloff*shots,t);
 t.aimX=target.object.x;t.aimY=target.object.y;
 fx(game,{kind:'laser',x:t.x,y:t.y,tx:target.object.x,ty:target.object.y,
  fade:falloff,shots,range:laserRange(t),reach:turretBranchRank(t,'reach')});
 const heat=turretBranchRank(t,'anomaly'),victim=target.object;
 if(heat&&target.kind==='enemy'&&victim.hp>0){
  if((victim.fluxHeatUntil||0)<game.time)victim.fluxHeatStacks=0;
  victim.fluxHeatUntil=game.time+2.2;
  victim.fluxHeatStacks=(victim.fluxHeatStacks||0)+1;
  if(victim.fluxHeatStacks>=Math.max(3,7-heat)){
   victim.fluxHeatStacks=0;
   damageTarget(game,target,(5+heat*3)*falloff,t);
   fx(game,{kind:'heat',x:victim.x,y:victim.y,r:24+heat*12});
   if(heat>=3)for(const other of availableTargets(game,victim,75)){
    if(other===target||other.object===victim||other.kind!=='enemy')continue;
    damageTarget(game,other,3*falloff,t);
   }
  }
 }
}
function updateDrones(game,t,cfg,dt){
 const radius=hiveRange(t),now=game.time;
 if(!t.drones.some(drone=>drone.hp>0))return;
 const target=chooseTarget(game,t,radius,t.mode);
 for(const drone of t.drones){
  if(drone.hp<=0)continue;
  const angle=now*.48+drone.slot*2.39996;
  const orbit={x:t.x+Math.cos(angle)*(60+drone.slot%2*19),
   y:t.y+Math.sin(angle)*(59+drone.slot%2*19)};
  const enemy=target?.object,engaged=enemy&&d(enemy,t)<radius&&d(drone,enemy)<radius+90;
  const point=engaged?{x:enemy.x+(drone.x-enemy.x)*.24,
   y:enemy.y+(drone.y-enemy.y)*.24}:orbit;
  const dx=point.x-drone.x,dy=point.y-drone.y,dist=Math.hypot(dx,dy)||1;
  const speed=Math.min(dist,dt*(engaged?155:125));
  drone.x+=dx/dist*speed;drone.y+=dy/dist*speed;
  drone.angle=Math.atan2(engaged?enemy.y-drone.y:dy,engaged?enemy.x-drone.x:dx);
  if(!engaged||d(drone,enemy)>200||now<drone.nextShotAt||
     d(game.player,t)>Math.max(1400,game.vw||1200))continue;
  drone.nextShotAt=now+cfg.cooldown;drone.lastShotAt=now;
  const tactic=turretBranchRank(t,'anomaly');
  damageTarget(game,target,cfg.damage*(t.level>=3?1.3:1)*(1+tactic*.09),t);
  if(tactic>=2&&target.kind==='enemy'&&enemy.hp>0){
   enemy.tacticalSlowFactor=Math.min(enemy.tacticalSlowFactor||1,tactic>=3?.72:.86);
   enemy.tacticalSlowUntil=Math.max(enemy.tacticalSlowUntil||0,now+(tactic>=3?1.6:.75));
  }
  fx(game,{kind:'drone',x:drone.x,y:drone.y,tx:enemy.x,ty:enemy.y});
  game.heritage?.play?.('supportDroneShot',.3,drone);
 }
}
export function advanceFluxSupports(game,dt){
 const s=stateOf(game.world),now=game.time;
 game.fluxSupportFx=(game.fluxSupportFx||[]).filter(x=>now>=x.at&&now-x.at<.48);
 // Leave a stable, repairable mount after destruction; only the build cap can
 // retire an old wreck when the pilot deliberately places a replacement.
 const edges=artilleryLinks(game.world),edgeMap=new Map(edges.map(x=>[x.id,x]));
 const links=new Map(),counts=new Map();
 for(const t of liveStructures(game.world)){
  const link=artilleryConnection(t,edges);if(!link)continue;
  counts.set(link.edgeId,(counts.get(link.edgeId)||0)+1);
  if(t.kind==='flux-support')links.set(t.id,link);
 }
 for(const packet of s.supportPackets){
  const t=s.supportTurrets.find(x=>x.id===packet.turretId&&x.hp>0);
  if(!t||!edgeMap.has(packet.edgeId)){packet.done=true;continue;}
  if(now<packet.arriveAt)continue;
  if(packet.kind==='drone'){
   if(t.type==='hive')createDrone(t,now);
  }else t.ammo=Math.min(supportConfig(t).magazine,t.ammo+packet.charges);
  t.lastChargeAt=now;packet.done=true;
  game.heritage?.play?.('supportCharge',.55,t);
 }
 s.supportPackets=s.supportPackets.filter(x=>!x.done);
 for(const t of s.supportTurrets){
  if(t.hp<=0){
   if(t.lastDestroyedAt<0)t.lastDestroyedAt=now;
   // A dead carrier must not leave motionless, untargetable drones orbiting
   // forever. It also prevents stale drone counts in an old checkpoint.
   if(t.type==='hive'){
    let lost=0;
    for(const drone of t.drones){
     if(drone.hp<=0)continue;
     drone.hp=0;lost++;
     game.heritage?.vfx?.shipExplosion?.(drone.x,drone.y,18,'#83f5c9');
    }
    if(lost)game.heritage?.play?.('supportDroneLost',.45,t);
   }
   continue;
  }
  const cfg=supportConfig(t);if(!cfg)continue;
  if(t.readyAt>now)continue;
  if(now-dt<t.readyAt)game.heritage?.play?.('supportOnline',.8,t);
  if(t.type==='hive'&&!t.initialReady){
   createDrone(t,now);t.initialReady=true;
   game.heritage?.play?.('supportDroneLaunch',.8,t);
  }
  const link=links.get(t.id);
  if(link){
   const depot=nearestSupplyDepot(game.world,t,now,cfg.chargeCost);
   const congestion=counts.get(link.edgeId)||1,
    supply=(1+(depot?d(depot,t):link.cable)/FLUX_ARTILLERY.cableScale)**-2;
   t.chargeCredit=Math.min(cfg.chargeCost,
    t.chargeCredit+supportSupply(t,cfg.fluxPerMinute)/60*
     supply/congestion*(depot?1.7:1)*Math.max(0,dt));
   const pending=s.supportPackets.filter(p=>p.turretId===t.id)
    .reduce((sum,p)=>sum+p.charges,0);
   const liveDrones=t.type==='hive'?t.drones.filter(x=>x.hp>0).length:0;
   const needed=t.type==='hive'?hiveLimit(t)-liveDrones-pending:
    cfg.magazine-t.ammo-pending;
   const affordable=Math.floor(((depot?depot.stored:s.flux)+1e-8)/cfg.chargeCost),
    earned=Math.floor((t.chargeCredit+1e-8)/cfg.chargeCost);
   const charges=Math.min(t.type==='hive'?1:3,needed,affordable,earned);
   if(charges>0&&s.supportPackets.length<SUPPORT_PACKET_MAX){
    const packet=chargePacket(t,link,cfg,now,charges,t.type==='hive'?'drone':'energy',depot);
    if(depot)takeDepotFlux(depot,packet.amount);
    else s.flux=Math.max(0,s.flux-packet.amount);
    t.chargeCredit=Math.max(0,t.chargeCredit-packet.amount);
    s.supportPackets.push(packet);
   }
  }
  if(t.type==='hive'){updateDrones(game,t,cfg,dt);continue;}
  if(t.type==='laser'&&t.burstLeft>0){
   if(now>=t.burstAt){
    laserPulse(game,t,cfg);t.burstLeft--;
    t.burstAt=now+.14;
   }
   continue;
  }
  if(t.ammo<(t.type==='laser'?laserEmitters(t):1))continue;
  const target=chooseTarget(game,t,t.type==='laser'?laserRange(t):
   t.type==='arc'?arcRange(t):cfg.range,t.mode);
  if(target){
   t.aimX=target.object.x;t.aimY=target.object.y;
   const angle=Math.atan2(t.aimY-t.y,t.aimX-t.x);
   t.gunAngle=turnArtilleryGun(t.gunAngle,angle,Math.max(0,dt));
  }
  if(!target||now<t.nextShotAt||t.ammo<(t.type==='laser'?laserEmitters(t):1)||
    d(game.player,t)>Math.max(1400,game.vw||1200))continue;
  if(Math.abs(Math.atan2(Math.sin(Math.atan2(t.aimY-t.y,t.aimX-t.x)-t.gunAngle),
    Math.cos(Math.atan2(t.aimY-t.y,t.aimX-t.x)-t.gunAngle)))>.24)continue;
  t.nextShotAt=now+(t.type==='arc'?arcCooldown(t):laserCooldown(t));t.lastShotAt=now;
  if(t.type==='arc'){
   t.ammo--;electricShot(game,t,cfg);
  }else{
   t.ammo-=laserEmitters(t);t.burstLeft=laserBurst(t);t.burstAt=now;
   game.heritage?.play?.('supportLaser',.65,t);
  }
 }
}

const spritePaths={arc:'./assets/artillery/flux-arc-node.svg',
 laser:'./assets/artillery/flux-laser-battery.svg',
 laserBase:'./assets/artillery/flux-laser-base.svg',
 laserSingle:'./assets/artillery/flux-laser-single.svg',
 laserTwin:'./assets/artillery/flux-laser-twin.svg',
 hive:'./assets/artillery/flux-drone-hive.svg',
 drone:'./assets/artillery/flux-hive-drone.svg'};
const sprites={};
if(typeof Image!=='undefined')for(const [kind,path] of Object.entries(spritePaths)){
 const image=new Image();image.src=new URL(path,import.meta.url).href;
 sprites[kind]=image;
}
function imageAt(ctx,type,size){
 const image=sprites[type];
 if(image?.complete&&image.naturalWidth)ctx.drawImage(image,-size/2,-size/2,size,size);
 else{
  ctx.fillStyle=type==='arc'?'#6055a8':type==='laser'?'#965b43':'#31776e';
  ctx.strokeStyle='#bde9eb';ctx.lineWidth=2.5;
  ctx.beginPath();
  for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?size*.35:size*.45;
   if(!i)ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
   else ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
  ctx.closePath();ctx.fill();ctx.stroke();
 }
}
function pointOnPath(path,fraction){
 const lengths=[d(path[0],path[1]),d(path[1],path[2])];
 const total=lengths[0]+lengths[1],along=clamp(fraction,0,1)*total;
 const segment=along<=lengths[0]?0:1,
  part=(along-(segment?lengths[0]:0))/Math.max(.001,lengths[segment]);
 return {x:path[segment].x+(path[segment+1].x-path[segment].x)*part,
  y:path[segment].y+(path[segment+1].y-path[segment].y)*part};
}
export function drawFluxSupports(ctx,game,cam,preview=null){
 const textScale=worldTextScale(game.cameraZoom);
 const s=game.world?.contours;if(!s)return;
 const now=game.time,reduced=!!game.visuals?.reducedMotion,edges=artilleryLinks(game.world);
 const pointer=game.tacticalPointer,rect=pointer&&game.canvas?.getBoundingClientRect?.();
 const hover=rect?.width&&rect?.height?{
  x:cam.x+(pointer.x-rect.left)/rect.width*cam.w,
  y:cam.y+(pointer.y-rect.top)/rect.height*cam.h}:null;
 for(const packet of s.supportPackets||[]){
  const p=pointOnPath(packet.path,(now-packet.launchedAt)/
   Math.max(.001,packet.arriveAt-packet.launchedAt));
  if(p.x<cam.x-30||p.x>cam.x+cam.w+30||p.y<cam.y-30||p.y>cam.y+cam.h+30)continue;
  ctx.save();ctx.shadowColor='#ffa853';ctx.shadowBlur=13;
  ctx.fillStyle='#ffe2a1';ctx.beginPath();ctx.arc(p.x,p.y,3.6,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 for(const t of s.supportTurrets||[]){
  if(t.x<cam.x-150||t.x>cam.x+cam.w+150||t.y<cam.y-150||t.y>cam.y+cam.h+150)continue;
  const cfg=supportConfig(t);if(!cfg)continue;
  const live=t.hp>0,building=live&&now<t.readyAt;
  const age=live?0:Math.max(0,now-(t.lastDestroyedAt>=0?t.lastDestroyedAt:now));
  const link=live?artilleryConnection(t,edges):null;
  const radius=t.type==='hive'?hiveRange(t):t.type==='laser'?laserRange(t):arcRange(t);
  const old=game.turretRangeBefore;
  const compare=old?.turret===t&&now<old.expires;
  if(live&&((hover&&d(hover,t)<t.r+15)||game.artilleryMenuTarget===t||compare)){
   ctx.save();ctx.lineWidth=2;
   if(compare){ctx.setLineDash([9,7]);ctx.strokeStyle='rgba(140,179,205,.85)';
    ctx.beginPath();ctx.arc(t.x,t.y,old.range,0,Math.PI*2);ctx.stroke();}
   ctx.setLineDash([]);ctx.strokeStyle=t.type==='hive'?'#6af2cb':cfg.color;
   ctx.beginPath();ctx.arc(t.x,t.y,radius,0,Math.PI*2);ctx.stroke();
   ctx.fillStyle='#dcf7fa';ctx.font='bold 12px system-ui';ctx.textAlign='center';
   ctx.fillText((t.type==='hive'?'Вылет ':'Дальность ')+radius,t.x,t.y+80);
   ctx.restore();
  }
  if(link){
   ctx.save();ctx.strokeStyle='rgba(76,188,215,.15)';ctx.lineWidth=8;
   ctx.beginPath();ctx.moveTo(link.attach.x,link.attach.y);ctx.lineTo(t.x,t.y);ctx.stroke();
   ctx.strokeStyle='rgba(114,219,237,.61)';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(link.attach.x,link.attach.y);ctx.lineTo(t.x,t.y);ctx.stroke();
   if(!reduced){
    const u=(now*.19+t.id*.11)%1;
    const x=link.attach.x+(t.x-link.attach.x)*u,y=link.attach.y+(t.y-link.attach.y)*u;
    ctx.fillStyle='#ffb35c';ctx.shadowColor='#ff9d45';ctx.shadowBlur=9;
    ctx.beginPath();ctx.arc(x,y,2.6,0,Math.PI*2);ctx.fill();
   }
   ctx.restore();
  }
  ctx.save();ctx.translate(t.x,t.y);
  // Ruins reserve their edge slot for repair. Keep a dim but visible socket
  // indefinitely so the pilot can actually find and restore it.
  if(!live)ctx.globalAlpha=Math.max(.42,1-clamp((age-3.8)/1.2,0,1));
  if(t.type==='hive'&&!building&&live&&!reduced)
   ctx.translate(Math.sin(now*.8+t.id)*1.7,Math.cos(now*.66+t.id)*2.2);
  ctx.save();
  if(building)ctx.globalAlpha*=.24+.76*clamp(1-(t.readyAt-now)/cfg.buildSeconds,0,1);
  if(!live)ctx.globalAlpha*=.7;
  if(t.type==='laser'){
   // Keep the octagonal foot perfectly still; only its independently centered
   // head turns. Beyond two emitters, identical pods share the same pivot:
   // no sprite-frame jumping, and each added muzzle is actually visible.
   imageAt(ctx,'laserBase',83);
   ctx.rotate(t.gunAngle+Math.PI/2);
   const count=laserEmitters(t);
   if(count<=2)imageAt(ctx,count===2?'laserTwin':'laserSingle',83);
   else{
    const pods=count===6?3:count;
    for(let i=0;i<pods;i++){
     ctx.save();ctx.translate((i-(pods-1)/2)*(count===6?16:12),0);
     ctx.scale(count===6?.58:.65,count===6?.58:.65);
     imageAt(ctx,count===6?'laserTwin':'laserSingle',83);
     ctx.restore();
    }
   }
  }else imageAt(ctx,t.type,t.type==='hive'?99:83);
  ctx.restore();
  if(t.type==='arc'&&!building&&live&&!reduced){
   ctx.strokeStyle=`rgba(168,148,255,${.5+.25*Math.sin(now*8)})`;
   ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,33,now*.8,now*.8+Math.PI*1.4);ctx.stroke();
  }
  if(building){
   const progress=clamp(1-(t.readyAt-now)/cfg.buildSeconds,0,1);
   ctx.strokeStyle=cfg.color;ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(0,0,49,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();
  }
  const charge=clamp(1-(now-t.lastChargeAt)/.8,0,1);
  if(live&&charge>0){
   ctx.strokeStyle=`rgba(255,195,105,${charge*.8})`;
   ctx.lineWidth=charge*3;ctx.beginPath();ctx.arc(0,0,37+7*charge,0,Math.PI*2);ctx.stroke();
  }
  if(!live){
   ctx.fillStyle='rgba(8,14,20,.64)';ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle='#ff825f';ctx.lineWidth=2.2;
   ctx.beginPath();ctx.moveTo(-23,-12);ctx.lineTo(-5,10);
   ctx.lineTo(11,-8);ctx.lineTo(25,16);ctx.stroke();
   if(!reduced&&age<3.8)for(let i=0;i<4;i++){
    ctx.fillStyle=`rgba(130,152,165,${(1-age/3.8)*.2})`;
    ctx.beginPath();ctx.arc(Math.sin(now+i)*13,-15-age*(10+i*2),4+i+age,0,Math.PI*2);ctx.fill();
   }
  }
  const remaining=t.type==='hive'?t.drones.filter(x=>x.hp>0).length+'/'+hiveLimit(t):
   t.ammo+'/'+cfg.magazine;
  ctx.save();ctx.scale(textScale,textScale);
  ctx.fillStyle='rgba(5,19,32,.93)';ctx.fillRect(-38,-61,76,18);
  ctx.font='bold 11px system-ui';ctx.textAlign='center';
  ctx.fillStyle=!live?'#ef9d81':cfg.color;
  ctx.fillText(!live?'РАЗРУШЕНА':building?'СБОРКА':remaining,0,-48);
  ctx.restore();
  if(live){
   ctx.fillStyle='#143747';ctx.fillRect(-30,44,60,5);
   ctx.fillStyle=cfg.color;ctx.fillRect(-30,44,60*t.hp/t.maxHp,5);
  }
  if(live&&hover&&d(hover,t)<t.r+14&&!building&&!preview){
   ctx.strokeStyle='#9ae9f3';ctx.lineWidth=1.7;ctx.setLineDash([4,5]);
   ctx.beginPath();ctx.arc(0,0,t.r+12,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
   ctx.save();ctx.scale(textScale,textScale);
   ctx.fillStyle='#d9f7ff';ctx.font='bold 11px system-ui';ctx.textAlign='center';
   ctx.fillText('ПКМ · РЕЖИМ / УЛУЧШЕНИЕ',0,71);
   ctx.restore();
  }
  ctx.restore();
  if(t.type!=='hive')continue;
  for(const drone of t.drones){
   if(drone.hp<=0||drone.x<cam.x-30||drone.x>cam.x+cam.w+30||
     drone.y<cam.y-30||drone.y>cam.y+cam.h+30)continue;
   ctx.save();ctx.translate(drone.x,drone.y);ctx.rotate(drone.angle+Math.PI/2);
   ctx.shadowColor=cfg.color;ctx.shadowBlur=6;imageAt(ctx,'drone',30);
   const hull=turretBranchRank(t,'hull');
   if(hull){
    ctx.strokeStyle=`rgba(161,243,223,${.22+hull*.1})`;
    ctx.lineWidth=1+hull*.35;ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.stroke();
   }
   ctx.restore();
  }
 }
 for(const effect of game.fluxSupportFx||[]){
  const fade=clamp(1-(now-effect.at)/.48,0,1);
  if(!fade)continue;
  ctx.save();ctx.lineCap='round';
  if(effect.kind==='arc'){
   const points=effect.points;
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    ctx.strokeStyle=`rgba(163,140,255,${fade*.8})`;
    ctx.lineWidth=(4.2+Math.min(3,effect.anomaly||0)*.65)*fade;
    ctx.shadowColor='#aa8bff';ctx.shadowBlur=13;
    ctx.beginPath();ctx.moveTo(a.x,a.y);
    for(let j=1;j<7;j++){
     const u=j/7,offset=(j%2?1:-1)*Math.sin((i*31+j)*1.7)*10*fade;
     const len=Math.max(1,d(a,b));
     ctx.lineTo(a.x+(b.x-a.x)*u-(b.y-a.y)/len*offset,
      a.y+(b.y-a.y)*u+(b.x-a.x)/len*offset);
    }
    ctx.lineTo(b.x,b.y);ctx.stroke();
   }
   if(effect.hold){
    // Electro-capture is a real slow/stasis effect: a restrained ring on the
    // last affected hull displays its purchased duration, not extra damage.
    const target=points.at(-1);
    ctx.shadowBlur=0;ctx.strokeStyle=`rgba(194,171,255,${fade*.8})`;
    ctx.lineWidth=1.5+effect.hold*.45;
    ctx.beginPath();ctx.arc(target.x,target.y,12+effect.hold*3,0,Math.PI*2);ctx.stroke();
   }
  }else if(effect.kind==='heat'){
   ctx.strokeStyle=`rgba(255,147,84,${fade})`;ctx.lineWidth=4*fade;
   ctx.shadowColor='#ff944d';ctx.shadowBlur=15;
   ctx.beginPath();ctx.arc(effect.x,effect.y,effect.r*(1-fade*.65),0,Math.PI*2);ctx.stroke();
  }else{
   const dx=effect.tx-effect.x,dy=effect.ty-effect.y,length=Math.max(1,Math.hypot(dx,dy));
   const normalX=-dy/length,normalY=dx/length;
   for(let i=0;i<(effect.kind==='laser'?effect.shots:1);i++){
    const offset=effect.kind==='laser'?(i-(effect.shots-1)/2)*8:0;
    ctx.shadowColor=effect.kind==='laser'?'#ff8256':'#6ef6b9';ctx.shadowBlur=12;
    if(effect.kind==='laser'){
     // Each segment follows the *actual* nonlinear laserFalloff curve.
     // Extended-range ranks add focusing at the emitter; the distant edge
     // still looks thin and weak even with six separate emitters.
     const count=6,reach=effect.reach||0;
     for(let j=0;j<count;j++){
      const a=j/count,b=(j+1)/count;
      const power=laserFalloff(length*b,effect.range||440);
      ctx.strokeStyle=`rgba(255,147,84,${fade*(.2+.8*power)})`;
      ctx.lineWidth=(3.5+reach*.4)*(.19+.81*power);
      ctx.beginPath();
      ctx.moveTo(effect.x+dx*a+normalX*offset*(1-a*.9),
       effect.y+dy*a+normalY*offset*(1-a*.9));
      ctx.lineTo(effect.x+dx*b+normalX*offset*(1-b*.9),
       effect.y+dy*b+normalY*offset*(1-b*.9));ctx.stroke();
     }
    }else{
     ctx.strokeStyle=`rgba(107,245,184,${fade})`;ctx.lineWidth=2;
     ctx.beginPath();ctx.moveTo(effect.x,effect.y);
     ctx.lineTo(effect.tx,effect.ty);ctx.stroke();
    }
   }
  }
  ctx.restore();
 }
 if(preview){
  const cfg=supportConfig(preview.type),point=preview.point,player=preview.player;
  if(!cfg)return;
  ctx.save();ctx.lineWidth=1.8;ctx.strokeStyle='#76dbe5b0';ctx.setLineDash([12,9]);
  ctx.beginPath();ctx.arc(player.x,player.y,FLUX_ARTILLERY.buildRadius,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([]);
  if(point){
   const link=artilleryConnection(point,edges),valid=supportOffer(game.world,player,point,preview.type).ok;
   if(link){ctx.strokeStyle=valid?'#74f5d9':'#eaa16e';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(link.attach.x,link.attach.y);ctx.lineTo(point.x,point.y);ctx.stroke();}
   ctx.translate(point.x,point.y);ctx.globalAlpha=valid?.6:.25;
   imageAt(ctx,preview.type,preview.type==='hive'?99:83);ctx.globalAlpha=1;
   ctx.strokeStyle=valid?'#8efde0':'#ffa0a0';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.arc(0,0,49,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
 }
}

export function validFluxSupports(s){
 if(s.supportTurrets===undefined&&s.supportPackets===undefined&&
   s.supportSerial===undefined)return true;
 if(!Array.isArray(s.supportTurrets)||s.supportTurrets.length>SUPPORT_MAX||
   !Array.isArray(s.supportPackets)||s.supportPackets.length>SUPPORT_PACKET_MAX||
   !Number.isSafeInteger(s.supportSerial)||s.supportSerial<0||s.supportSerial>1e9)return false;
 const finite=(v,min=0,max=1e9)=>Number.isFinite(v)&&v>=min&&v<=max;
 const ids=new Set();
 for(const t of s.supportTurrets){
  const cfg=supportConfig(t);
  if(!cfg||t.kind!=='flux-support'||!Number.isSafeInteger(t.id)||
    t.id<1||t.id>s.supportSerial||ids.has(t.id)||
    !finite(t.x,-1e9)||!finite(t.y,-1e9)||
    !finite(t.hp,0,cfg.maxHp)||t.maxHp!==cfg.maxHp||t.r!==cfg.r||
    !Number.isInteger(t.level)||t.level<1||t.level>(t.type==='hive'?3:t.type==='laser'?2:1)||
    !ARTILLERY_MODES.includes(t.mode)||!validTurretBranches(t)||!Number.isInteger(t.ammo)||
    t.ammo<0||t.ammo>cfg.magazine||!finite(t.chargeCredit,0,cfg.chargeCost+.0001)||
    !finite(t.readyAt)||!finite(t.nextShotAt)||!finite(t.lastShotAt,-1)||
    !finite(t.lastChargeAt,-1)||!finite(t.lastDestroyedAt,-1)||
    !finite(t.aimX,-1e9)||!finite(t.aimY,-1e9)||
    !finite(t.gunAngle,-Math.PI-.0001,Math.PI+.0001)||
    !Number.isInteger(t.burstLeft)||t.burstLeft<0||t.burstLeft>16||
    !finite(t.burstAt)||typeof t.initialReady!=='boolean'||
    !Array.isArray(t.drones)||t.drones.length>20)return false;
  const slots=new Set();
  for(const drone of t.drones){
   if(t.type!=='hive'||!Number.isInteger(drone.slot)||drone.slot<1||drone.slot>1e9||
      slots.has(drone.slot)||!finite(drone.x,-1e9)||!finite(drone.y,-1e9)||
      !finite(drone.hp,0,hiveArmor(t))||drone.maxHp!==hiveArmor(t)||drone.r!==10||
      !finite(drone.nextShotAt)||!finite(drone.lastShotAt,-1)||
      !finite(drone.angle,-Math.PI*4,Math.PI*4))return false;
   slots.add(drone.slot);
  }
  if(t.type==='hive'&&t.drones.filter(x=>x.hp>0).length>hiveLimit(t))return false;
  ids.add(t.id);
 }
 for(const p of s.supportPackets){
  const t=s.supportTurrets.find(x=>x.id===p?.turretId),cfg=supportConfig(t);
  if(!cfg||!ids.has(p.turretId)||typeof p.edgeId!=='string'||p.edgeId.length>160||
    !['energy','drone'].includes(p.kind)||p.kind==='drone'&&t.type!=='hive'||
    p.kind==='energy'&&t.type==='hive'||!Number.isInteger(p.charges)||
    p.charges<1||p.charges>(p.kind==='drone'?1:3)||
    !finite(p.amount,cfg.chargeCost,3*cfg.chargeCost)||
    Math.abs(p.amount-p.charges*cfg.chargeCost)>1e-6||
    !finite(p.launchedAt)||!finite(p.arriveAt,p.launchedAt)||
    p.arriveAt-p.launchedAt>1e6||!Array.isArray(p.path)||p.path.length!==3||
    p.path.some(q=>!finite(q?.x,-1e9)||!finite(q?.y,-1e9)))return false;
 }
 return true;
}
