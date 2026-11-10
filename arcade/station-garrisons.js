import {fieldAt} from './territory-system.js';

// Emergency defenses belong to the three stations, not to a free-floating
// turret slot. They can be commissioned once the pilot has begun charging the
// contested core, and remain useful as nearby safe pockets after victory.
export const STATION_GARRISONS=Object.freeze({
 dock:Object.freeze({name:'Сторожевая турель',ore:12,range:255,
  hp:165,shield:105,damage:13,reload:1.65,color:'#79d9ff'}),
 arsenal:Object.freeze({name:'Сдвоенная батарея',ore:16,range:285,
  hp:180,shield:115,damage:20,reload:1.9,color:'#ffc477'}),
 lab:Object.freeze({name:'Импульсный разрядник',ore:14,range:245,
  hp:160,shield:110,damage:10,reload:2.2,color:'#b6a0ff'}),
 carrier:Object.freeze({name:'Патрульное звено',ore:20,range:280,
  hp:185,shield:125,damage:9,reload:.95,droneCount:8,
  droneHp:20,rebuildSeconds:5.5,color:'#7af2c8'})
});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const usable=s=>s?.active&&!s.enemy&&!s.ruined&&!s.suppressed&&s.hp>0;
const specFor=s=>STATION_GARRISONS[s?.type];

export function stationTrialField(world,station){
 if(!world||!station)return null;
 const entries=[...(world.contours?.trials?.entries||[])].reverse();
 for(const entry of entries){
  const field=fieldAt(world,entry.x,entry.y);
  if(field?.vertices?.includes(station.id)&&
    (entry.charge>0||entry.activated||entry.status==='complete'))
   return {entry,field};
 }
 return null;
}

export function stationGarrisonOffer(world,player,station){
 const spec=specFor(station);
 if(!spec||!usable(station))return {ok:false,reason:'Станция должна работать и принадлежать вам'};
 const field=stationTrialField(world,station);
 if(!field)return {ok:false,reason:'Начните заряжать ядро треугольника удержанием E'};
 if(station.garrison?.hp>0)return {ok:false,reason:'Местная оборона уже включена'};
 const rebuilding=!!station.garrison,cost=rebuilding?Math.ceil(spec.ore*.4):spec.ore;
 if((player?.ore||0)<cost)return {ok:false,reason:'Нужно '+cost+' сплава',cost};
 return {ok:true,cost,rebuilding,field,name:spec.name};
}

const newDrone=(slot,x,y,hp)=>({slot,x,y,hp,maxHp:hp,r:6});
export function commissionStationGarrison(world,player,station,time){
 const offer=stationGarrisonOffer(world,player,station);
 if(!offer.ok)return offer;
 const spec=specFor(station);
 player.ore-=offer.cost;
 if(offer.rebuilding){
  const g=station.garrison;
  g.hp=Math.ceil(g.maxHp*.62);g.shield=Math.round(spec.shield*.3);
  g.readyAt=time+2;g.lastHitAt=time;g.nextShotAt=g.readyAt;
  g.drones=[];g.nextDroneAt=g.readyAt+(spec.rebuildSeconds||0);
 }else{
  const x=station.x+48,y=station.y-47;
  station.garrison={kind:'station-garrison',type:station.type,x,y,r:28,
   hp:spec.hp,maxHp:spec.hp,shield:spec.shield,
   readyAt:time+2.2,lastHitAt:time,nextShotAt:time+2.2,
   nextDroneAt:time+(spec.rebuildSeconds||0),droneCursor:0,
   drones:spec.droneCount?Array.from({length:spec.droneCount},(_,i)=>
    newDrone(i,x+Math.cos(i*Math.PI/4)*36,y+Math.sin(i*Math.PI/4)*36,spec.droneHp)):[]};
 }
 return {...offer,ok:true,garrison:station.garrison};
}

export function activeStationGarrisons(game,radius=1750){
 if(!game?.player)return [];
 if(game._garrisonCacheAt!==game.time||game._garrisonCacheRadius<radius){
  game._garrisonCacheAt=game.time;game._garrisonCacheRadius=radius;
  game._garrisonCache=(game.world?.nearbyStations?.(game.player.x,game.player.y,radius)||[])
   .filter(s=>usable(s)&&s.garrison)
   .map(s=>({station:s,garrison:s.garrison}));
 }
 return game._garrisonCache.filter(({station,garrison})=>
  usable(station)&&garrison.hp>0&&game.time>=garrison.readyAt);
}

function defenseTarget(game,g,range){
 let nearest=null,best=Infinity;
 for(const e of game.enemies||[]){
  if(!(e.hp>0)||e.converted||e.trialRetreatUntil)continue;
  const rangeTo=dist(e,g);
  if(rangeTo>range||rangeTo>=best||
     game.enemyCanSee&&!game.enemyCanSee(g,e))continue;
  best=rangeTo;nearest=e;
 }
 return nearest;
}

function droneGoals(g,station,enemy,now,dt){
 for(const drone of g.drones){
  if(drone.hp<=0)continue;
  const orbit=now*.8+drone.slot*Math.PI/4;
  const anchor=enemy&&dist(enemy,station)<245?enemy:station;
  const radius=anchor===enemy?65:71;
  const tx=anchor.x+Math.cos(orbit)*radius,ty=anchor.y+Math.sin(orbit)*radius;
  const dx=tx-drone.x,dy=ty-drone.y,len=Math.hypot(dx,dy)||1;
  const step=Math.min(len,285*dt);
  drone.x+=dx/len*step;drone.y+=dy/len*step;
 }
}

export function advanceStationGarrisons(game,dt){
 if(!(dt>0)||!Number.isFinite(game?.time))return;
 const now=game.time;
 for(const station of game.world?.nearbyStations?.(game.player.x,game.player.y,1750)||[]){
  const g=station.garrison,spec=specFor(station);
  if(!g||!spec||!usable(station))continue;
  const target=defenseTarget(game,g,spec.range);
  const quiet=now-g.lastHitAt;
  if(g.hp<=0){
   // A captured station's workshop rebuilds a wreck in a true lull. It
   // cannot regenerate while enemies are still pressing the position.
   if(quiet>=24&&!target){
    g.hp=Math.ceil(g.maxHp*.5);g.shield=0;g.readyAt=now+3;
    g.lastHitAt=now;g.nextShotAt=g.readyAt;
   }
   continue;
  }
  if(quiet>=5)g.shield=Math.min(spec.shield,g.shield+6*dt);
  if(quiet>=9)g.hp=Math.min(g.maxHp,g.hp+2.5*dt);
  if(now<g.readyAt)continue;
  if(spec.droneCount){
   droneGoals(g,station,target,now,dt);
   if(g.drones.filter(d=>d.hp>0).length<spec.droneCount&&now>=g.nextDroneAt){
    const missing=Array.from({length:spec.droneCount},(_,slot)=>slot)
     .find(slot=>!g.drones.some(d=>d.slot===slot&&d.hp>0));
    g.drones=g.drones.filter(d=>d.hp>0||d.slot!==missing);
    g.drones.push(newDrone(missing,g.x,g.y,spec.droneHp));
    g.nextDroneAt=now+spec.rebuildSeconds;
   }
  }
  if(!target||now<g.nextShotAt)continue;
  let source=g;
  if(spec.droneCount){
   const live=g.drones.filter(drone=>drone.hp>0&&dist(drone,target)<=spec.range);
   if(!live.length)continue;
   source=live[g.droneCursor%live.length];g.droneCursor++;
  }
  target.hp=Math.max(0,target.hp-spec.damage);
  target.hit=Math.max(target.hit||0,.14);
  if(station.type==='lab')target.stasisUntil=Math.max(target.stasisUntil||0,now+.3);
  g.nextShotAt=now+spec.reload;
  game.flash?.(source.x,source.y,target.x,target.y,spec.color);
  game.heritage?.play?.('enemyShot',.13,source);
 }
}

export function damageStationGarrison(game,station,object,damage){
 const g=station?.garrison,spec=specFor(station);
 if(!g||!spec||!(object?.hp>0))return {destroyed:false};
 const raw=Math.max(0,damage||0);
 object.lastHitAt=game.time;g.lastHitAt=game.time;
 if(object!==g){
  object.hp=Math.max(0,object.hp-raw);
  g.nextDroneAt=Math.max(g.nextDroneAt,game.time+spec.rebuildSeconds);
  return {destroyed:object.hp<=0};
 }
 const shield=Math.min(g.shield,raw),hull=(raw-shield)*.66;
 g.shield-=shield;g.hp=Math.max(0,g.hp-hull);
 if(g.hp<=0){g.drones=[];g.nextDroneAt=game.time+(spec.rebuildSeconds||0);}
 return {destroyed:g.hp<=0,hull,shield};
}

export function drawStationGarrisons(ctx,game,cam){
 for(const station of game.world?.nearbyStations?.(game.player.x,game.player.y,1750)||[]){
  const g=station.garrison;if(!g)continue;
  if(g.x<cam.x-100||g.x>cam.x+cam.w+100||
     g.y<cam.y-100||g.y>cam.y+cam.h+100)continue;
  const spec=specFor(station),alive=g.hp>0,ratio=clamp(g.hp/g.maxHp,0,1);
  ctx.save();ctx.translate(g.x,g.y);
  ctx.fillStyle=alive?'#102c39':'#312b35';ctx.strokeStyle=alive?spec.color:'#b3a1a1';ctx.lineWidth=2.6;
  ctx.beginPath();ctx.arc(0,0,g.r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=alive?spec.color:'#a87878';ctx.globalAlpha=.9;
  ctx.fillRect(-17,-4,34*ratio,8);
  if(!alive){
   ctx.strokeStyle='#fa8d88';ctx.beginPath();ctx.moveTo(-8,-8);ctx.lineTo(8,8);
   ctx.moveTo(-8,8);ctx.lineTo(8,-8);ctx.stroke();
  }
  ctx.globalAlpha=.75;ctx.strokeStyle=spec.color;
  ctx.beginPath();ctx.arc(0,0,g.r+7,-Math.PI/2,
   -Math.PI/2+Math.PI*2*clamp(g.shield/spec.shield,0,1));ctx.stroke();
  ctx.restore();
  for(const drone of g.drones||[]){
   if(drone.hp<=0)continue;
   ctx.save();ctx.translate(drone.x,drone.y);ctx.rotate(game.time*1.5+drone.slot);
   ctx.fillStyle=spec.color;ctx.beginPath();ctx.moveTo(0,-6);
   ctx.lineTo(5,4);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();ctx.restore();
  }
 }
}

export function validStationGarrison(station,time){
 const g=station?.garrison;if(g===undefined)return true;
 const spec=specFor(station);
 const finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
 return !!spec&&g?.kind==='station-garrison'&&g.type===station.type&&
  finite(g.x,station.x-100,station.x+100)&&finite(g.y,station.y-100,station.y+100)&&
  g.r===28&&g.maxHp===spec.hp&&finite(g.hp,0,g.maxHp)&&
  finite(g.shield,0,spec.shield+.001)&&finite(g.readyAt,0,1e9)&&
  finite(g.lastHitAt,0,1e9)&&finite(g.nextShotAt,0,1e9)&&
  finite(g.nextDroneAt,0,1e9)&&Number.isInteger(g.droneCursor)&&
  g.droneCursor>=0&&g.droneCursor<=1e9&&Array.isArray(g.drones)&&
  g.drones.length<=(spec.droneCount||0)&&
  g.drones.every(d=>Number.isInteger(d.slot)&&d.slot>=0&&d.slot<(spec.droneCount||0)&&
   finite(d.hp,0,spec.droneHp)&&d.maxHp===spec.droneHp&&d.r===6&&
   finite(d.x,station.x-2000,station.x+2000)&&finite(d.y,station.y-2000,station.y+2000))&&
  new Set(g.drones.map(d=>d.slot)).size===g.drones.length;
}
