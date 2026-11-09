import {contourFields} from './territory-system.js';
import {productiveContourFields} from './contour-trials.js';

// A field emplacement is ammunition-fed, not another player ship. The pilot
// must finish the first territorial trial before any emplacement is available.
export const FLUX_ARTILLERY=Object.freeze({
 buildRadius:560,clearance:125,stationClearance:105,oreCost:20,fluxCost:1,
 maxHp:110,magazine:15,chargeCost:.25,damage:50,blastRadius:110,
 range:740,aimSeconds:1.45,cooldown:8,buildSeconds:3,
 cableScale:700,baseFluxPerMinute:3.6,packetSpeed:520,maxTurrets:72,maxPackets:256,
 maxShells:96,shellSpeed:830,impactLifetime:.9,wreckLifetime:5,
 collisionRadius:38,turnSpeed:2.9,muzzleOffset:60,
 closeRange:235,closeDamage:11,closeCooldown:.19
});
export const ARTILLERY_MODES=Object.freeze(['smart','group','strong','weak']);
export const EDGE_SLOT_UPGRADES=Object.freeze([{ore:15,flux:4},{ore:25,flux:8}]);
export const ARTILLERY_UPGRADES=Object.freeze([{ore:23,flux:2},{ore:34,flux:4}]);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const normalizeAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const shortestTurn=(from,to)=>normalizeAngle(to-from);
export const turnArtilleryGun=(angle,target,dt)=>normalizeAngle(angle+
 clamp(shortestTurn(angle,target),-FLUX_ARTILLERY.turnSpeed*Math.max(0,dt),
  FLUX_ARTILLERY.turnSpeed*Math.max(0,dt)));
const recoilAt=age=>age<0||age>=.34?0:age<.065?age/.065:
 Math.pow(1-(age-.065)/.275,2);
const key=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const working=s=>!!s?.active&&!s.enemy&&!s.suppressed;
const ARTILLERY_SPRITE_PATH='./assets/artillery/flux-howitzer-base-v1.svg';
const ARTILLERY_HEAD_PATH='./assets/artillery/flux-howitzer-head-v2.svg';
let artillerySprite=null,artilleryHead=null;
if(typeof Image!=='undefined'){
 artillerySprite=new Image();artillerySprite.src=new URL(ARTILLERY_SPRITE_PATH,import.meta.url).href;
 artilleryHead=new Image();artilleryHead.src=new URL(ARTILLERY_HEAD_PATH,import.meta.url).href;
}

export function artilleryLinks(world){
 const fields=productiveContourFields(world,contourFields(world));
 const seen=new Set(),edges=[];
 for(const field of fields)for(let i=0;i<field.vertices.length;i++){
  const aId=field.vertices[i],bId=field.vertices[(i+1)%field.vertices.length];
  const id=key(aId,bId);if(seen.has(id))continue;seen.add(id);
  const a=world.stations.get(aId),b=world.stations.get(bId);
  if(working(a)&&working(b))edges.push({id,a,b});
 }
 return edges;
}
export function artilleryConnection(point,edges){
 let chosen=null;
 for(const edge of edges){
  const dx=edge.b.x-edge.a.x,dy=edge.b.y-edge.a.y;
  const length2=dx*dx+dy*dy;if(!length2)continue;
  const u=clamp(((point.x-edge.a.x)*dx+(point.y-edge.a.y)*dy)/length2,0,1);
  const attach={x:edge.a.x+u*dx,y:edge.a.y+u*dy};
  const cable=distance(point,attach);
  if(chosen&&cable>=chosen.cable)continue;
  const source=u<=.5?edge.a:edge.b;
  chosen={edgeId:edge.id,attach,source:{id:source.id,x:source.x,y:source.y},cable,
   route:[{x:source.x,y:source.y},attach,{x:point.x,y:point.y}]};
 }
 return chosen;
}
export const edgeTurretLimit=world=>1+Math.min(2,Math.max(0,world?.contours?.turretSlotRank||0));
export function edgeTurretOccupancy(world,edgeId,edges=artilleryLinks(world)){
 return [...(world?.contours?.artillery||[]),...(world?.contours?.supportTurrets||[])]
  .filter(t=>artilleryConnection(t,edges)?.edgeId===edgeId).length;
}
export function edgeTurretUpgradeOffer(world,player){
 const rank=world?.contours?.turretSlotRank||0,price=EDGE_SLOT_UPGRADES[rank];
 if(!price)return {ok:false,reason:'На каждой грани уже можно установить три сооружения'};
 if(!(world?.contours?.trials?.completed>0))return {ok:false,reason:'Сначала защитите первый треугольник'};
 if((player?.ore||0)<price.ore)return {ok:false,reason:'Нужно '+price.ore+' сплава',...price};
 if((world?.contours?.flux||0)+1e-8<price.flux)return {ok:false,reason:'Нужно '+price.flux+' флюкса',...price};
 return {ok:true,...price};
}
export function upgradeEdgeTurretCapacity(world,player){
 const quote=edgeTurretUpgradeOffer(world,player);if(!quote.ok)return quote;
 player.ore-=quote.ore;world.contours.flux-=quote.flux;
 world.contours.turretSlotRank=(world.contours.turretSlotRank||0)+1;
 return {ok:true,limit:edgeTurretLimit(world)};
}
export function artilleryUpgradeOffer(world,player,t,time=0){
 if(!t||t.kind!=='flux-artillery'||t.hp<=0)return {ok:false,reason:'Сооружение разрушено: сначала восстановите его'};
 const price=ARTILLERY_UPGRADES[(t.level||1)-1];
 if(!price)return {ok:false,reason:'Достигнут максимальный уровень'};
 if(time<t.readyAt)return {ok:false,reason:'Дождитесь окончания строительства'};
 if((player?.ore||0)<price.ore)return {ok:false,reason:'Нужно '+price.ore+' сплава',...price};
 if((world?.contours?.flux||0)<price.flux)return {ok:false,reason:'Нужно '+price.flux+' флюкса',...price};
 return {ok:true,...price};
}
export function upgradeArtillery(world,player,t,time=0){
 const quote=artilleryUpgradeOffer(world,player,t,time);if(!quote.ok)return quote;
 player.ore-=quote.ore;world.contours.flux-=quote.flux;
 t.level=(t.level||1)+1;
 return {ok:true,level:t.level};
}
const artilleryState=world=>{
 const state=world.contours;
 state.artillery??=[];state.artilleryPackets??=[];state.artilleryShells??=[];
 state.artillerySerial??=0;
 return state;
};
export function artilleryOffer(world,player,point){
 const state=world?.contours;
 if(!state||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))
  return {ok:false,reason:'Укажите место строительства'};
 if(!(state.trials?.completed>0))
  return {ok:false,reason:'Сначала самостоятельно защитите первый треугольник'};
 const edges=artilleryLinks(world);
 if(!edges.length)return {ok:false,reason:'Нет работающего замкнутого контура'};
 if(distance(player,point)>FLUX_ARTILLERY.buildRadius)
  return {ok:false,reason:'Слишком далеко от корабля-строителя'};
 if(distance(player,point)<75)return {ok:false,reason:'Освободите место рядом с кораблём'};
 const live=[...(state.artillery||[]),...(state.supportTurrets||[])];
 if(live.filter(t=>t.hp>0).length>=FLUX_ARTILLERY.maxTurrets)
  return {ok:false,reason:'Достигнут технический предел сооружений'};
 if(live.some(t=>t.hp>0&&distance(t,point)<FLUX_ARTILLERY.clearance))
  return {ok:false,reason:'Слишком близко к другому сооружению'};
 if([...world.stations.values()].some(s=>distance(s,point)<FLUX_ARTILLERY.stationClearance))
  return {ok:false,reason:'Слишком близко к станции'};
 const connection=artilleryConnection(point,edges);
 if(!connection)return {ok:false,reason:'Не удалось подключиться к сети'};
 if(edgeTurretOccupancy(world,connection.edgeId,edges)>=edgeTurretLimit(world))
  return {ok:false,reason:'Грань занята · улучшите вместимость опорных линий за флюкс'};
 if((player.ore||0)<FLUX_ARTILLERY.oreCost)
  return {ok:false,reason:'Недостаточно сплава: нужно '+FLUX_ARTILLERY.oreCost};
 if(state.flux+1e-8<FLUX_ARTILLERY.fluxCost)
  return {ok:false,reason:'Недостаточно флюкса: нужна '+FLUX_ARTILLERY.fluxCost+' ед.'};
 return {ok:true,connection};
}
export function deployArtillery(world,player,point,time){
 const offer=artilleryOffer(world,player,point);
 if(!offer.ok)return offer;
 const state=artilleryState(world);
 // A fading wreck is decoration, not a reason to invalidate an otherwise
 // legal replacement or exceed the bounded checkpoint array.
 if(state.artillery.length>=FLUX_ARTILLERY.maxTurrets)
  state.artillery=state.artillery.filter(t=>t.hp>0);
 state.flux=Math.max(0,state.flux-FLUX_ARTILLERY.fluxCost);
 player.ore-=FLUX_ARTILLERY.oreCost;
 const turret={id:++state.artillerySerial,kind:'flux-artillery',x:point.x,y:point.y,
  r:FLUX_ARTILLERY.collisionRadius,hp:FLUX_ARTILLERY.maxHp,maxHp:FLUX_ARTILLERY.maxHp,ammo:0,
  chargeCredit:0,readyAt:time+FLUX_ARTILLERY.buildSeconds,nextShotAt:time,
  aimingUntil:0,aimX:point.x,aimY:point.y,mode:'smart',lastShotAt:-1,
  lastImpactAt:-1,lastImpactX:point.x,lastImpactY:point.y,lastChargeAt:-1,
  lastDestroyedAt:-1,gunAngle:-Math.PI/2};
 turret.level=1;
 state.artillery.push(turret);
 return {ok:true,turret,connection:offer.connection};
}
export function artilleryAt(world,point,radius=46){
 let best=null,bestDist=radius;
 for(const turret of world?.contours?.artillery||[]){
  if(turret.hp<=0)continue;
  const d=distance(turret,point);
  if(d<bestDist){bestDist=d;best=turret;}
 }
 return best;
}
export function setArtilleryMode(turret,mode){
 if(!turret||!ARTILLERY_MODES.includes(mode))return false;
 turret.mode=mode;turret.aimingUntil=0;return true;
}

function targetsInRange(game,turret){
 const targets=[];
 for(const enemy of game.enemies||[]){
  if(enemy.hp<=0||enemy.converted||enemy.trialRetreatUntil||
     distance(enemy,turret)>FLUX_ARTILLERY.range)continue;
  targets.push({kind:'enemy',object:enemy});
 }
 // Production defenses can draw fire before the pilot attacks the exposed core.
 const bases=game.world.nearbyStations(turret.x,turret.y,FLUX_ARTILLERY.range+120);
 for(const base of bases){
  if(!base.enemy||base.captured||base.hp<=0)continue;
  const fortifications=(base.turrets||[]).filter(t=>t.hp>0&&
   distance(t,turret)<=FLUX_ARTILLERY.range);
  if(fortifications.length)for(const t of fortifications)
   targets.push({kind:'fort',object:t});
  else if(distance(base,turret)<=FLUX_ARTILLERY.range)
   targets.push({kind:'base',object:base});
 }
 return targets;
}
function predicted(object){
 // Do not aim beyond a short, fallible lead: agile scouts can still dodge.
 const lead=Math.min(1.1,FLUX_ARTILLERY.aimSeconds);
 return {x:object.x+clamp(object.vx||0,-190,190)*lead,
  y:object.y+clamp(object.vy||0,-190,190)*lead};
}
export function chooseArtilleryAim(game,turret){
 const targets=targetsInRange(game,turret);
 let best=null,bestScore=-Infinity;
 for(const target of targets){
  const pos=predicted(target.object);
  if(distance(pos,turret)>FLUX_ARTILLERY.range)continue;
  const hp=target.object.hp||1,maxHp=target.object.maxHp||hp;
  const cluster=targets.filter(other=>distance(predicted(other.object),pos)<
    FLUX_ARTILLERY.blastRadius).length;
  const closest=distance(pos,turret);
  const score=turret.mode==='strong'?maxHp-closest*.025:
   turret.mode==='weak'?-hp-closest*.015:
   turret.mode==='group'?cluster*80-closest*.025:
   cluster*45+Math.min(90,maxHp)*.28-closest*.03;
  if(score>bestScore){bestScore=score;best={x:pos.x,y:pos.y,target};}
 }
 return best;
}
function impactShell(game,state,shell){
 const center={x:shell.targetX,y:shell.targetY};
 const source=state.artillery.find(t=>t.id===shell.turretId)||
  {kind:'flux-artillery',id:shell.turretId,x:shell.startX,y:shell.startY};
 for(const target of targetsInRange(game,center)){
  const victim=target.object,range=distance(victim,center);
  if(range>FLUX_ARTILLERY.blastRadius+(victim.r||0))continue;
  const fraction=clamp(range/FLUX_ARTILLERY.blastRadius,0,1);
  const damage=FLUX_ARTILLERY.damage*(1-.67*fraction*fraction);
  if(target.kind==='enemy')game.damageEnemy(victim,damage,source);
  else if(target.kind==='fort')game.hitTurret(victim,damage,null,'artillery');
  else game.hitEnemyBase(victim,damage,'artillery');
 }
 source.lastImpactAt=game.time;source.lastImpactX=center.x;source.lastImpactY=center.y;
 game.fluxArtilleryFx??=[];
 game.fluxArtilleryFx.push({x:center.x,y:center.y,at:game.time,
  id:shell.turretId+shell.launchedAt*31});
 if(game.fluxArtilleryFx.length>32)game.fluxArtilleryFx.splice(0,game.fluxArtilleryFx.length-32);
 game.heritage?.vfx?.rocketImpact?.(center.x,center.y,FLUX_ARTILLERY.blastRadius*.75);
 game.heritage?.play?.('artilleryImpact',.32,center);
}
function segmentPosition(path,fraction){
 let total=0;for(let i=1;i<path.length;i++)total+=distance(path[i-1],path[i]);
 let remaining=total*clamp(fraction,0,1);
 for(let i=1;i<path.length;i++){
  const length=distance(path[i-1],path[i]);
  if(remaining<=length||i===path.length-1){const t=length?remaining/length:0;
   return {x:path[i-1].x+(path[i].x-path[i-1].x)*t,
    y:path[i-1].y+(path[i].y-path[i-1].y)*t};}
  remaining-=length;
 }
 return path.at(-1)||{x:0,y:0};
}
export function advanceFluxArtillery(game,dt){
 const state=artilleryState(game.world),time=game.time;
 // Fired shells survive the loss of their gun. Hits happen only at impact.
 for(const shell of state.artilleryShells){
  if(time<shell.arriveAt)continue;
  impactShell(game,state,shell);shell.done=true;
 }
 state.artilleryShells=state.artilleryShells.filter(s=>!s.done);
 if(game.fluxArtilleryFx)game.fluxArtilleryFx=game.fluxArtilleryFx.filter(
  fx=>time>=fx.at&&time-fx.at<FLUX_ARTILLERY.impactLifetime);
 // A destroyed emplacement keeps its socket for deliberate E repair.
 for(const turret of state.artillery)if(turret.hp<=0&&
   (!Number.isFinite(turret.lastDestroyedAt)||turret.lastDestroyedAt<0))
  turret.lastDestroyedAt=time;
 const edges=artilleryLinks(game.world),edgeMap=new Map(edges.map(e=>[e.id,e]));
 const links=new Map();const sideCounts=new Map();
 for(const turret of state.artillery){
  if(turret.hp<=0)continue;
  const link=artilleryConnection(turret,edges);if(!link)continue;
  links.set(turret.id,link);
  sideCounts.set(link.edgeId,(sideCounts.get(link.edgeId)||0)+1);
 }
 for(const turret of state.supportTurrets||[]){
  if(turret.hp<=0)continue;
  const link=artilleryConnection(turret,edges);if(!link)continue;
  sideCounts.set(link.edgeId,(sideCounts.get(link.edgeId)||0)+1);
 }
 // Reserved energy is either delivered or lost in an interrupted cable; it is
 // never charged twice and cannot be reproduced by saving/loading the run.
 for(const packet of state.artilleryPackets){
  const turret=state.artillery.find(t=>t.id===packet.turretId&&t.hp>0);
  if(!turret||!edgeMap.has(packet.edgeId)){packet.done=true;continue;}
  if(time<packet.arriveAt)continue;
  turret.ammo=Math.min(FLUX_ARTILLERY.magazine,turret.ammo+packet.charges);
  turret.lastChargeAt=time;
  game.heritage?.play?.('artilleryCharge',.25,turret);
  packet.done=true;
 }
 state.artilleryPackets=state.artilleryPackets.filter(p=>!p.done);
 for(const turret of state.artillery){
  if(turret.hp<=0)continue;
  if(turret.r!==FLUX_ARTILLERY.collisionRadius)turret.r=FLUX_ARTILLERY.collisionRadius;
  const link=links.get(turret.id);
  if(!Number.isFinite(turret.gunAngle))turret.gunAngle=-Math.PI/2;
  if(turret.aimingUntil>0||turret.lastShotAt>=0){
   const facing=Math.atan2(turret.aimY-turret.y,turret.aimX-turret.x);
   turret.gunAngle=turnArtilleryGun(turret.gunAngle,facing,dt);
  }
  if(time<turret.readyAt)continue;
  if(time-dt<turret.readyAt)game.heritage?.play?.('artilleryOnline',.9,turret);
  // A short-range anti-ram gun uses its own clock. It never fires artillery
  // shells, spends artillery magazine charges or reaches distant gunships.
  if(link&&time>=(turret.closeNextShotAt??0)){
   const threat=(game.enemies||[]).filter(e=>e.hp>0&&!e.converted&&!e.trialRetreatUntil&&
    distance(e,turret)<=FLUX_ARTILLERY.closeRange+25*((turret.level||1)-1))
    .sort((a,b)=>(a.type==='berserker'?-50:0)+distance(a,turret)-
      ((b.type==='berserker'?-50:0)+distance(b,turret)))[0];
   if(threat){
    turret.closeNextShotAt=time+FLUX_ARTILLERY.closeCooldown;
    turret.lastCloseAt=time;
    game.damageEnemy(threat,FLUX_ARTILLERY.closeDamage+5*((turret.level||1)-1),turret);
    game.fluxArtilleryFx??=[];
    game.fluxArtilleryFx.push({kind:'close',x:turret.x,y:turret.y,
     tx:threat.x,ty:threat.y,at:time});
    if(game.fluxArtilleryFx.length>48)game.fluxArtilleryFx.shift();
    game.heritage?.play?.('supportDroneShot',.20,turret);
   }
  }
  if(link){
   const congestion=sideCounts.get(link.edgeId)||1;
   // The farther the platform is from the powered side, the less energy it
   // receives per second. The offset avoids a singularity on the edge.
   const cableRate=Math.pow(1+link.cable/FLUX_ARTILLERY.cableScale,-2);
   const rate=FLUX_ARTILLERY.baseFluxPerMinute/60*cableRate/congestion;
   turret.chargeCredit=Math.min(1,turret.chargeCredit+rate*dt);
   const pending=state.artilleryPackets.filter(p=>p.turretId===turret.id)
    .reduce((sum,p)=>sum+p.charges,0);
   const needed=FLUX_ARTILLERY.magazine-turret.ammo-pending;
   const affordable=Math.floor((state.flux+1e-8)/FLUX_ARTILLERY.chargeCost);
   const earned=Math.floor((turret.chargeCredit+1e-8)/FLUX_ARTILLERY.chargeCost);
   const charges=Math.min(4,needed,affordable,earned);
   if(charges>0&&state.artilleryPackets.length<FLUX_ARTILLERY.maxPackets){
    const amount=charges*FLUX_ARTILLERY.chargeCost;
    state.flux=Math.max(0,state.flux-amount);
    turret.chargeCredit=Math.max(0,turret.chargeCredit-amount);
    const path=link.route,travel=distance(path[0],path[1])+distance(path[1],path[2]);
    state.artilleryPackets.push({turretId:turret.id,edgeId:link.edgeId,
     amount,charges,launchedAt:time,arriveAt:time+.5+travel/FLUX_ARTILLERY.packetSpeed,path});
   }
  }
  if(turret.aimingUntil>0){
   if(time<turret.aimingUntil)continue;
   turret.aimingUntil=0;
   if(turret.ammo<=0)continue;
   if(state.artilleryShells.length>=FLUX_ARTILLERY.maxShells)continue;
   turret.ammo--;turret.nextShotAt=time+FLUX_ARTILLERY.cooldown;
   turret.lastShotAt=time;
   const startX=turret.x+Math.cos(turret.gunAngle)*FLUX_ARTILLERY.muzzleOffset;
   const startY=turret.y+Math.sin(turret.gunAngle)*FLUX_ARTILLERY.muzzleOffset;
   const travel=distance({x:startX,y:startY},{x:turret.aimX,y:turret.aimY});
   state.artilleryShells.push({turretId:turret.id,startX,startY,
    targetX:turret.aimX,targetY:turret.aimY,launchedAt:time,
    arriveAt:time+.25+travel/FLUX_ARTILLERY.shellSpeed});
   game.heritage?.play?.('artilleryLaunch',.18,turret);
   continue;
  }
  // Distant autonomous battles are not silently simulated or rewarded.
  if(turret.ammo<=0||time<turret.nextShotAt||
    distance(game.player,turret)>Math.max(1400,game.vw||1200))continue;
  const aim=chooseArtilleryAim(game,turret);
  if(aim){
   const aimAngle=Math.atan2(aim.y-turret.y,aim.x-turret.x);
   // A real motor turns the barrel into position: the short recorded servo
   // cue accompanies a substantial turn, never every animation frame.
   if(Math.abs(shortestTurn(turret.gunAngle,aimAngle))>.3)
    game.heritage?.play?.('artilleryServo',.9,turret);
   turret.aimX=aim.x;turret.aimY=aim.y;
   turret.aimingUntil=time+FLUX_ARTILLERY.aimSeconds;
   game.heritage?.play?.('artilleryAcquire',.9,turret);}
 }
}
function drawArtilleryChassis(ctx,size=82){
 if(artillerySprite?.complete&&artillerySprite.naturalWidth){
  ctx.drawImage(artillerySprite,-size/2,-size/2,size,size);
 }else{
  // Keep the game readable while the real sprite is still loading.
  ctx.fillStyle='#203144';ctx.strokeStyle='#5ba7bd';ctx.lineWidth=3;
  ctx.beginPath();
  for(let i=0;i<8;i++){const a=i*Math.PI/4;
   const x=Math.cos(a)*37,y=Math.sin(a)*37;
   if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#278bcb';ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.stroke();
 }
}
function drawGun(ctx,rotation,recoil=0,fire=0){
 ctx.save();ctx.rotate(rotation+Math.PI/2);
 ctx.translate(0,recoil*9);
 if(artilleryHead?.complete&&artilleryHead.naturalWidth){
  // The image has a shared pivot at 66% of its height. Rotation only moves
  // the detachable head: the mounting chassis always remains fixed.
  ctx.drawImage(artilleryHead,-51,-67,102,102);
 }else{
  ctx.shadowColor='#091020';ctx.shadowBlur=4;ctx.fillStyle='#172330';
  ctx.fillRect(-13,-31,26,40);
  ctx.shadowBlur=0;ctx.fillStyle='#506175';ctx.fillRect(-9,-36,18,36);
  ctx.fillStyle='#1f334b';ctx.fillRect(-5,-61,10,59);
  ctx.fillStyle='#dba75b';ctx.fillRect(-7,-20,3,20);
  ctx.fillRect(4,-20,3,20);
  ctx.fillStyle='#23354b';ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#69ccea';ctx.lineWidth=3;ctx.beginPath();
  ctx.arc(0,0,11,Math.PI*.16,Math.PI*1.84);ctx.stroke();
 }
 if(fire>0){
  ctx.globalAlpha=fire;
  ctx.shadowColor='#ff9d39';ctx.shadowBlur=23;
  ctx.fillStyle='#fff6c3';ctx.beginPath();ctx.ellipse(0,-60,8,12,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ff9a45';ctx.beginPath();ctx.moveTo(-9,-57);
  ctx.lineTo(0,-81);ctx.lineTo(9,-57);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
function drawDamage(ctx,turret,time,deadAge=null,reduced=false){
 const severity=clamp(1-turret.hp/turret.maxHp,0,1);
 const intensity=clamp((severity-.22)/.5,0,1);
 if(!intensity&&!Number.isFinite(deadAge))return;
 ctx.save();
 ctx.lineWidth=2.3;ctx.lineCap='round';
 for(let i=0;i<5;i++){
  const angle=i*2.39996+.4,r=25+(i%2)*9;
  const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
  ctx.strokeStyle=`rgba(12,17,23,${.63*intensity})`;
  ctx.beginPath();ctx.moveTo(x-7,y-7);ctx.lineTo(x+1,y+3);
  ctx.lineTo(x+7,y+8);ctx.stroke();
  ctx.strokeStyle=`rgba(242,112,59,${.4*intensity})`;ctx.lineWidth=1.1;
  ctx.beginPath();ctx.moveTo(x-5,y-6);ctx.lineTo(x+1,y+2);ctx.stroke();
 }
 const flicker=deadAge===null?(.35+.25*Math.sin(time*9)):.65;
 ctx.fillStyle=`rgba(255,124,53,${intensity*flicker})`;
 for(let i=0;i<3;i++){
  const angle=i*2.1+1.3;
  ctx.beginPath();ctx.arc(Math.cos(angle)*30,Math.sin(angle)*30,2.2,0,Math.PI*2);ctx.fill();
 }
 if(deadAge!==null){
  const release=clamp(deadAge/.65,0,1);
  // Charred armour is anchored to the same pivot as the undamaged chassis.
  // It never swaps to a different-sized image at the instant of destruction.
  const soot=ctx.createRadialGradient(-4,-5,3,0,0,43);
  soot.addColorStop(0,'rgba(8,11,17,.81)');
  soot.addColorStop(.62,'rgba(13,17,22,.64)');
  soot.addColorStop(1,'rgba(8,11,17,0)');
  ctx.fillStyle=soot;ctx.beginPath();ctx.arc(0,0,43,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,137,75,.66)';ctx.lineWidth=1.7;
  ctx.beginPath();ctx.moveTo(-24,-13);ctx.lineTo(-8,4);
  ctx.lineTo(3,-8);ctx.lineTo(22,14);ctx.stroke();
  for(let i=0;i<9;i++){
   const angle=i*2.4,dist=36+release*(14+i%3*3);
   ctx.strokeStyle=`rgba(184,146,116,${(1-release)*.8})`;
   ctx.lineWidth=3+(i%2);ctx.beginPath();
   ctx.moveTo(Math.cos(angle)*(dist-7),Math.sin(angle)*(dist-7));
   ctx.lineTo(Math.cos(angle)*(dist+6),Math.sin(angle)*(dist+6));ctx.stroke();
  }
  if(deadAge<3.8)for(let i=0;i<(reduced?2:5);i++){
   const rise=deadAge*(11+i*3)+i*6;
   const x=Math.sin(deadAge*1.7+i*2.3)*9+(i-2)*4;
   const fade=(1-deadAge/3.8)*(.19+i*.025);
   ctx.fillStyle=`rgba(107,132,145,${fade})`;
   ctx.beginPath();ctx.arc(x,-10-rise,5+i*.75+deadAge*1.8,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
}
function drawWarning(ctx,turret,time,reduced=false){
 const countdown=clamp((turret.aimingUntil-time)/FLUX_ARTILLERY.aimSeconds,0,1);
 const radius=FLUX_ARTILLERY.blastRadius;
 ctx.save();ctx.translate(turret.aimX,turret.aimY);
 ctx.fillStyle='rgba(255,135,41,.035)';ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='rgba(255,175,91,.83)';ctx.lineWidth=2;
 ctx.setLineDash([13,8]);ctx.lineDashOffset=reduced?0:-time*20;
 ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([]);
 ctx.strokeStyle='rgba(255,212,136,.95)';ctx.lineWidth=3;
 ctx.beginPath();ctx.arc(0,0,radius,-Math.PI/2,-Math.PI/2+(1-countdown)*Math.PI*2);ctx.stroke();
 ctx.strokeStyle='#ffc47e';ctx.lineWidth=1.5;
 for(let i=0;i<4;i++){const a=Math.PI/2*i;
  ctx.beginPath();ctx.moveTo(Math.cos(a)*11,Math.sin(a)*11);
  ctx.lineTo(Math.cos(a)*23,Math.sin(a)*23);ctx.stroke();}
 ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.stroke();
 ctx.restore();
}
function drawImpact(ctx,burst,time,reduced=false){
 const age=time-burst.at,phase=clamp(age/FLUX_ARTILLERY.impactLifetime,0,1);
 const r=FLUX_ARTILLERY.blastRadius,fade=(1-phase)**1.7;
 ctx.save();ctx.translate(burst.x,burst.y);
 const bloom=ctx.createRadialGradient(0,0,4,0,0,r*.9);
 bloom.addColorStop(0,`rgba(255,238,169,${.45*fade})`);
 bloom.addColorStop(.32,`rgba(255,111,38,${.3*fade})`);
 bloom.addColorStop(1,'rgba(255,79,20,0)');
 ctx.fillStyle=bloom;ctx.beginPath();ctx.arc(0,0,r*.9,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=`rgba(255,193,109,${.95*fade})`;ctx.lineWidth=8*(1-phase)+1;
 ctx.beginPath();ctx.arc(0,0,r*(.1+.9*clamp(phase*1.65,0,1)),0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle=`rgba(112,202,230,${.45*fade})`;ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(0,0,r*(.04+.93*clamp(phase*2,0,1)),0,Math.PI*2);ctx.stroke();
 for(let i=0;i<(reduced?4:14);i++){
  const angle=(i*2.39996+burst.id*1.73)%(Math.PI*2);
  const distance=r*(.24+.6*phase)*(i%3===0?1:.78);
  ctx.strokeStyle=i%3===0?`rgba(255,224,151,${fade})`:`rgba(235,106,62,${fade*.8})`;
  ctx.lineWidth=i%3===0?2.8:1.7;ctx.beginPath();
  ctx.moveTo(Math.cos(angle)*(distance-11*fade),Math.sin(angle)*(distance-11*fade));
  ctx.lineTo(Math.cos(angle)*(distance+9*fade),Math.sin(angle)*(distance+9*fade));ctx.stroke();
 }
 ctx.restore();
}
function drawFlyingShell(ctx,shell,time,reduced=false){
 const fraction=clamp((time-shell.launchedAt)/(shell.arriveAt-shell.launchedAt),0,1);
 const x=shell.startX+(shell.targetX-shell.startX)*fraction;
 const y=shell.startY+(shell.targetY-shell.startY)*fraction;
 const height=Math.sin(Math.PI*fraction)*31;
 const dx=shell.targetX-shell.startX,dy=shell.targetY-shell.startY;
 const length=Math.max(1,Math.hypot(dx,dy));
 ctx.save();
 ctx.fillStyle='rgba(4,9,19,.28)';ctx.beginPath();
 ctx.ellipse(x+10,y+10,7+height*.17,4+height*.07,0,0,Math.PI*2);ctx.fill();
 for(let i=reduced?1:5;i>=0;i--){
  const offset=(i+1)*7;
  const alpha=(1-i/7)*.6;
  ctx.fillStyle=`rgba(255,${112+i*18},60,${alpha})`;
  ctx.beginPath();ctx.arc(x-dx/length*offset,y-dy/length*offset-height,2.8-i*.28,0,Math.PI*2);ctx.fill();
 }
 ctx.shadowColor='#ff9d48';ctx.shadowBlur=17;ctx.fillStyle='#fff3bc';
 ctx.beginPath();ctx.arc(x,y-height,5,0,Math.PI*2);ctx.fill();
 ctx.shadowBlur=0;ctx.strokeStyle='#f0914f';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(x-dy/length*4,y-height+dx/length*4);
 ctx.lineTo(x+dy/length*4,y-height-dx/length*4);ctx.stroke();
 ctx.restore();
}
export function drawFluxArtillery(ctx,game,cam,preview=null){
 const state=game.world?.contours;if(!state)return;
 const edges=artilleryLinks(game.world),time=game.time;
 const reduced=!!game.visuals?.reducedMotion;
 for(const turret of state.artillery||[]){
  if(turret.x<cam.x-140||turret.x>cam.x+cam.w+140||
    turret.y<cam.y-140||turret.y>cam.y+cam.h+140)continue;
  const live=turret.hp>0;
  const link=live?artilleryConnection(turret,edges):null;
  ctx.save();
  if(link){
   const active=turret.ammo<FLUX_ARTILLERY.magazine;
   ctx.strokeStyle='rgba(63,169,220,.12)';ctx.lineWidth=8;
   ctx.beginPath();ctx.moveTo(link.attach.x,link.attach.y);
   ctx.lineTo(turret.x,turret.y);ctx.stroke();
   ctx.strokeStyle=active?'rgba(99,221,251,.58)':'rgba(79,162,195,.32)';
   ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(link.attach.x,link.attach.y);
   ctx.lineTo(turret.x,turret.y);ctx.stroke();
   // The cable feels energized even between discrete charge deliveries.
   if(active&&!reduced)for(let i=0;i<3;i++){
    const u=((time*.2+i/3)%1),p=segmentPosition([link.attach,turret],u);
    ctx.fillStyle=`rgba(245,166,79,${.17+.23*Math.sin(Math.PI*u)})`;
    ctx.beginPath();ctx.arc(p.x,p.y,2.1,0,Math.PI*2);ctx.fill();
   }
  }
  const building=live&&time<turret.readyAt;
  const progress=building?clamp(1-(turret.readyAt-time)/FLUX_ARTILLERY.buildSeconds,0,1):1;
  const chargeGlow=live?clamp(1-(time-(turret.lastChargeAt??-100))/1.1,0,1):0;
  const shotAge=time-turret.lastShotAt;
  const fire=live&&shotAge>=0?clamp(1-shotAge/.16,0,1):0;
  const recoil=live?recoilAt(shotAge):0;
  const wreckAge=live?null:Math.max(0,time-(turret.lastDestroyedAt??time));
  ctx.translate(turret.x,turret.y);
  if(!live)ctx.globalAlpha=Math.max(.42,1-clamp((wreckAge-3.8)/1.2,0,1));
  ctx.save();
  ctx.globalAlpha*=building?.2+.8*progress:live?1:.6;
  drawArtilleryChassis(ctx);
  const angle=Number.isFinite(turret.gunAngle)?turret.gunAngle:-Math.PI/2;
  drawGun(ctx,angle+(wreckAge===null?0:.05*clamp(wreckAge/.8,0,1)),recoil,fire);
  drawDamage(ctx,turret,time,wreckAge,reduced);
  ctx.restore();
  if(building){
   ctx.strokeStyle='#7bebea';ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(0,0,47,-Math.PI/2,-Math.PI/2+progress*Math.PI*2);ctx.stroke();
   for(let i=0;i<8;i++){
    const plateAngle=i*Math.PI/4+(reduced?0:time*.15);
    const smooth=progress*progress*(3-2*progress),radius=57-17*smooth;
    ctx.save();ctx.globalAlpha*=.75*(1-smooth);
    ctx.translate(Math.cos(plateAngle)*radius,Math.sin(plateAngle)*radius);
    ctx.rotate(plateAngle);
    ctx.fillStyle=i%2?'#68d9ef':'#f6a65e';ctx.fillRect(-5,-3,10,6);
    ctx.restore();
   }
  }
  if(chargeGlow>0){
   ctx.strokeStyle=`rgba(255,183,78,${chargeGlow*.8})`;ctx.lineWidth=4*chargeGlow;
   ctx.beginPath();ctx.arc(0,0,35+chargeGlow*7,0,Math.PI*2);ctx.stroke();
  }
  if(!live){
   ctx.strokeStyle='rgba(238,105,67,.9)';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.moveTo(-18,-16);ctx.lineTo(8,7);ctx.lineTo(16,21);ctx.stroke();
   ctx.fillStyle='#f0744f';ctx.beginPath();ctx.arc(1,4,3,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle='rgba(5,19,32,.9)';ctx.fillRect(-33,-58,66,18);
  ctx.font='bold 12px system-ui';ctx.textAlign='center';
  ctx.fillStyle=live?(turret.ammo?'#ffd8a2':'#8aaec2'):'#f3997b';
  ctx.fillText(!live?'РАЗРУШЕНА':building?'СБОРКА':`${turret.ammo}/${FLUX_ARTILLERY.magazine}`,0,-44);
  if(live){
   ctx.fillStyle='#23495a';ctx.fillRect(-29,43,58,5);
   ctx.fillStyle='#7ae6dd';ctx.fillRect(-29,43,58*clamp(turret.hp/turret.maxHp,0,1),5);
  }
  ctx.restore();
  if(live&&turret.aimingUntil>time)drawWarning(ctx,turret,time,reduced);
 }
 for(const packet of state.artilleryPackets||[]){
  const fraction=clamp((time-packet.launchedAt)/(packet.arriveAt-packet.launchedAt),0,1);
  const p=segmentPosition(packet.path,fraction);
  if(p.x<cam.x-20||p.x>cam.x+cam.w+20||p.y<cam.y-20||p.y>cam.y+cam.h+20)continue;
  ctx.save();ctx.shadowBlur=17;ctx.shadowColor='#ffba58';ctx.fillStyle='#ffdf91';
  ctx.beginPath();ctx.arc(p.x,p.y,3.7+Math.min(2,packet.charges*.5),0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,139,53,.53)';ctx.lineWidth=2;
  for(let i=1;i<=3;i++){
   const behind=segmentPosition(packet.path,Math.max(0,fraction-i*.015));
   ctx.beginPath();ctx.moveTo(behind.x-1,behind.y-1);ctx.lineTo(behind.x+1,behind.y+1);ctx.stroke();
  }
  ctx.restore();
 }
 for(const shell of state.artilleryShells||[]){
  const minX=Math.min(shell.startX,shell.targetX),maxX=Math.max(shell.startX,shell.targetX);
  const minY=Math.min(shell.startY,shell.targetY),maxY=Math.max(shell.startY,shell.targetY);
  if(maxX<cam.x-80||minX>cam.x+cam.w+80||maxY<cam.y-80||minY>cam.y+cam.h+80)continue;
  drawFlyingShell(ctx,shell,time,reduced);
 }
 for(const impact of game.fluxArtilleryFx||[]){
  if(impact.kind==='close'){
   const fade=clamp(1-(time-impact.at)/.18,0,1);if(!fade)continue;
   ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle='#a6f6ff';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.moveTo(impact.x,impact.y);ctx.lineTo(impact.tx,impact.ty);ctx.stroke();
   ctx.fillStyle='#ffdb99';ctx.beginPath();ctx.arc(impact.x,impact.y,4,0,Math.PI*2);ctx.fill();
   ctx.restore();continue;
  }
  if(impact.x<cam.x-140||impact.x>cam.x+cam.w+140||
    impact.y<cam.y-140||impact.y>cam.y+cam.h+140)continue;
  drawImpact(ctx,impact,time,reduced);
 }
 if(preview){
  const {point,player}=preview;
  ctx.save();ctx.strokeStyle='#76dbe5b0';ctx.lineWidth=1.8;ctx.setLineDash([12,9]);
  ctx.beginPath();ctx.arc(player.x,player.y,FLUX_ARTILLERY.buildRadius,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([]);
  if(point){
   const link=artilleryConnection(point,edges),valid=artilleryOffer(game.world,player,point).ok;
   if(link){ctx.strokeStyle=valid?'#74f5d9':'#eaa16e';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(link.attach.x,link.attach.y);
    ctx.lineTo(point.x,point.y);ctx.stroke();}
   ctx.translate(point.x,point.y);ctx.globalAlpha=valid?.5:.24;
   drawArtilleryChassis(ctx);ctx.globalAlpha=1;
   ctx.strokeStyle=valid?'#8efde0':'#ffa0a0';ctx.lineWidth=2.5;
   ctx.beginPath();ctx.arc(0,0,46,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
 }
}
export function validFluxArtillery(state){
 if(state.artillery===undefined&&state.artilleryPackets===undefined&&
    (!state.artilleryShells||Array.isArray(state.artilleryShells)&&
     state.artilleryShells.length===0))return true;
 if(!Array.isArray(state.artillery)||state.artillery.length>FLUX_ARTILLERY.maxTurrets||
   !Array.isArray(state.artilleryPackets)||state.artilleryPackets.length>FLUX_ARTILLERY.maxPackets||
   (state.artilleryShells!==undefined&&(!Array.isArray(state.artilleryShells)||
    state.artilleryShells.length>FLUX_ARTILLERY.maxShells))||
   !Number.isInteger(state.artillerySerial)||state.artillerySerial<0||state.artillerySerial>1e9)return false;
 const finite=(n,min=0,max=1e9)=>Number.isFinite(n)&&n>=min&&n<=max;
 const ids=new Set();
 for(const t of state.artillery){
  if(!t||!Number.isInteger(t.id)||t.id<1||t.id>state.artillerySerial||ids.has(t.id)||
    t.kind!=='flux-artillery'||!finite(t.x,-1e9)||!finite(t.y,-1e9)||
    !finite(t.hp,0,FLUX_ARTILLERY.maxHp)||t.maxHp!==FLUX_ARTILLERY.maxHp||
    !Number.isInteger(t.ammo)||t.ammo<0||t.ammo>FLUX_ARTILLERY.magazine||
    !ARTILLERY_MODES.includes(t.mode)||!finite(t.chargeCredit,0,1.00001)||
    !finite(t.readyAt)||!finite(t.nextShotAt)||!finite(t.aimingUntil)||
    !finite(t.aimX,-1e9)||!finite(t.aimY,-1e9)||
    !finite(t.lastShotAt,-1)||!finite(t.lastImpactAt,-1)||
    (t.level!==undefined&&(!Number.isInteger(t.level)||t.level<1||t.level>3))||
    !finite(t.lastImpactX,-1e9)||!finite(t.lastImpactY,-1e9)||
    (t.gunAngle!==undefined&&(!Number.isFinite(t.gunAngle)||
     Math.abs(t.gunAngle)>Math.PI+.00001))||
    (t.lastChargeAt!==undefined&&!finite(t.lastChargeAt,-1))||
    (t.lastDestroyedAt!==undefined&&!finite(t.lastDestroyedAt,-1)))return false;
  ids.add(t.id);
 }
 for(const p of state.artilleryPackets){
  if(!p||!ids.has(p.turretId)||typeof p.edgeId!=='string'||p.edgeId.length>160||
    !Number.isInteger(p.charges)||p.charges<1||p.charges>4||
    !finite(p.amount,.25,1)||Math.abs(p.amount-p.charges*.25)>1e-8||
    !finite(p.launchedAt)||!finite(p.arriveAt,p.launchedAt)||
    p.arriveAt-p.launchedAt>1e6||!Array.isArray(p.path)||p.path.length!==3||
    p.path.some(q=>!q||!finite(q.x,-1e9)||!finite(q.y,-1e9)))return false;
 }
 for(const s of state.artilleryShells||[]){
  if(!s||!Number.isInteger(s.turretId)||s.turretId<1||s.turretId>state.artillerySerial||
    !finite(s.startX,-1e9)||!finite(s.startY,-1e9)||
    !finite(s.targetX,-1e9)||!finite(s.targetY,-1e9)||
    !finite(s.launchedAt)||!finite(s.arriveAt,s.launchedAt)||
    s.arriveAt-s.launchedAt>2)return false;
 }
 return true;
}
