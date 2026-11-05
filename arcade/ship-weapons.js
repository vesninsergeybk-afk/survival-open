import {RULES,beamDamage} from './balance.js?v=arcade-balanced-bases-30';
import {weaponDamageFactor,penetrationFactor,plasmaDamageFactor,rocketFlight} from './weapon-specializations.js?v=weapons-cycle-2-weapon-mechanics-2';
import {MODULES,moduleStats,mountPosition,localMountPosition,heatWeapons,plasmaSplitWeights} from './ship-loadout.js?v=weapons-cycle-2-weapon-mechanics-2';
import {firstRockImpact} from './terrain.js?v=arcade-belt-26';
import {contactOnCircle,contactAtPoint} from './impact-geometry.js?v=arcade-impact-51';
import {combatTargets,targetAlive,selectTargets,targetDistance,targetRadius,lineContact,damageTarget} from './combat-targets.js?v=rpg-precision-audit-1';
import {emitWeaponFx} from './weapon-fx.js';
import {launchFlakVolley,updateFlakPellets,launchHeavyShell,updateHeavyShells,drawBallisticWeapons} from './ballistic-weapons.js';

export {updateFlakPellets,drawBallisticWeapons};

export const shipTargets=(game,range,limit=1,nearest=false,focus='precision')=>
 selectTargets(game,range,limit,!nearest&&focus==='precision');
export const damageShipTarget=damageTarget;
const statsFor=(g,id)=>moduleStats(id,g.skillRanks,g.shipLoadout.specializations?.[id]);
const positions=(g,id)=>{
 const slots=g.shipLoadout.slots.map((v,i)=>v===id?i:-1).filter(i=>i>=0);
 // Callers of the combat library may supply an aggregate profile without art.
 return (slots.length?slots:Array.from({length:g.weaponProfile[id]||0},(_,i)=>i)).map(i=>mountPosition(g.player,i));
};
function fireFlakFamily(game){
 const stats=statsFor(game,'flak'),targets=selectTargets(game,stats.range,stats.targets,false);
 if(!targets.length)return false;
 let fired=false,index=0;
 for(const from of positions(game,'flak')){
  // Separate mounts may cover different bearings. A wide-sweep upgrade widens
  // each sector instead of manufacturing hits around the whole ship.
  const anchor=targets[index%targets.length];index++;
  fired=launchFlakVolley(game,from,targets,anchor,stats)||fired;
 }
 if(!fired)return false;
 heatWeapons(game.weaponThermal,MODULES.flak.heat*game.weaponProfile.flak);
 game.heritage.play('flakShot',.28,{x:game.player.x,y:game.player.y});
 game.moduleClocks.flak=stats.interval;
 return true;
}
function fireBeamFamily(game,id){
 if(id==='flak')return fireFlakFamily(game);
 const stats=statsFor(game,id),targets=selectTargets(game,stats.range,stats.targets,id==='rail');
 if(!targets.length)return false;
 const weights=id==='plasma'?plasmaSplitWeights(targets.length):null;
 for(const from of positions(game,id)){
  let firstFiredTarget=null;
  for(let i=0;i<targets.length;i++){
   const item=targets[i],t=item.target,d=targetDistance(game.player,t);
   if(t.hp<=0)continue;
   let damage=stats.damage*weaponDamageFactor(game.shipLoadout,id,t);
   if(id==='plasma')damage=beamDamage(damage,d,RULES.nearBeam,stats.range,RULES.beamMinFactor)*
    plasmaDamageFactor(game.shipLoadout.specializations?.plasma,d,stats.range)*weights[i]*
    (game.doctrine==='assault'&&d<=180?1.22:1)*(game.nearArsenalBonus?1.18:1)*
    (game.overchargeUntil>game.time?1.2:1);
   const {cover,point}=lineContact(game,from,item);
   if(cover){
    game.damageRock(cover.rock,damage*.85,from.x,from.y,'auto',true,point);
    const penetration=id==='rail'?penetrationFactor(game.shipLoadout):0;
    if(penetration){
     const rocks=game.rockGrid.query((from.x+t.x)*.5,(from.y+t.y)*.5,targetDistance(from,t)*.5+60);
     const second=firstRockImpact(cover.x,cover.y,t.x,t.y,rocks.filter(r=>r!==cover.rock),2,game.player);
     const hit=second?contactAtPoint(second.rock.x,second.rock.y,second.x,second.y):
      contactOnCircle(t.x,t.y,targetRadius(item),cover.x,cover.y);
     if(second)game.damageRock(second.rock,damage*penetration,cover.x,cover.y,'auto',true,hit);
     else damageTarget(game,item,damage*penetration,id,hit);
     emitWeaponFx(game,'rail',cover,{x:hit?.x??t.x,y:hit?.y??t.y},
      {secondary:true,blocked:!!second});
    }
   }else damageTarget(game,item,damage,id==='plasma'?'beam':id,point);
   emitWeaponFx(game,id,from,{x:point?.x??t.x,y:point?.y??t.y},{blocked:!!cover});
   firstFiredTarget??=t;
  }
  // A second mount may find the target already destroyed by the first.
  // Do not invent a muzzle flash for a shot that never actually happened.
  if(firstFiredTarget){
   game.heritage.vfx.muzzle(from.x,from.y,Math.atan2(firstFiredTarget.y-from.y,firstFiredTarget.x-from.x),
    id==='rail'?'railgun':id==='flak'?'flak':undefined);
  }
 }
 heatWeapons(game.weaponThermal,MODULES[id].heat*game.weaponProfile[id]);
 game.heritage.play({plasma:'plasmaShot',rail:'railShot',flak:'flakShot'}[id],
  id==='plasma'?.32:.25,{x:game.player.x,y:game.player.y});
 if(id==='plasma'){
  // Only an actual emitted beam provides an observable combat rhythm.
  // Scouts never read the player's private cooldown or aim selection.
  game._irisLastPlasmaAt=game.time;
  game.beamClock=stats.interval;
 }
 else game.moduleClocks[id]=stats.interval;
 return true;
}
function fireRockets(game){
 const stats=statsFor(game,'rocket'),item=selectTargets(game,stats.range,1,true)[0];
 if(!item)return false;
 const t=item.target,tuning=rocketFlight(game.shipLoadout);
 for(const from of positions(game,'rocket')){
  if(game.missiles.length>=14)game.missiles.shift();
  game.missiles.push({x:from.x,y:from.y,prevX:from.x,prevY:from.y,trail:[{x:from.x,y:from.y}],
   target:t,targetKind:item.kind,targetBase:item.base||null,tx:t.x,ty:t.y,
   damage:stats.damage*weaponDamageFactor(game.shipLoadout,'rocket',t),speed:tuning.speed,life:tuning.life});
  emitWeaponFx(game,'rocket',from,t,{impact:false});
  game.heritage.vfx.muzzle(from.x,from.y,Math.atan2(t.y-from.y,t.x-from.x),'knife');
 }
 heatWeapons(game.weaponThermal,MODULES.rocket.heat*game.weaponProfile.rocket);
 game.rocketClock=stats.interval;game.heritage.play('rocketShot',.5,{x:game.player.x,y:game.player.y});return true;
}
export function updateAutomaticWeapons(game,dt,allowed){
 game.moduleClocks??={rail:0,flak:0};
 game.beamClock=(game.beamClock??0)-dt;game.rocketClock=(game.rocketClock??0)-dt;
 for(const id of ['rail','flak'])game.moduleClocks[id]=(game.moduleClocks[id]??0)-dt;
 if(!allowed)return;
 const clock=id=>id==='plasma'?game.beamClock:id==='rocket'?game.rocketClock:game.moduleClocks[id];
 // Overdue salvos fire first after cooling. A fixed family order must not
 // repeatedly spend the heat budget before another installed family can fire.
 const ready=['plasma','rail','flak','rocket'].filter(id=>
  game.weaponProfile[id]&&!(id==='rail'&&game.manualRailMode)&&clock(id)<=0)
  .sort((a,b)=>clock(a)-clock(b));
 for(const id of ready){
  if(game.weaponThermal.locked)break;
  if(id==='rocket')fireRockets(game);else fireBeamFamily(game,id);
 }
}
// Aimed rail fire shares the actual rail family's heat, installed mounts,
// cooldown and target/cover rules. It cannot be stacked on top of auto fire.
// A small tap assist centres a shot only on a genuinely nearby visible target;
// the beam still stops at the first hostile hull or solid asteroid on its line.
const shotCircle=(from,to,centre,radius)=>{
 const dx=to.x-from.x,dy=to.y-from.y,fx=from.x-centre.x,fy=from.y-centre.y;
 const a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-radius*radius;
 if(a<1e-9)return null;
 if(c<=0)return 0;
 const delta=b*b-4*a*c;
 if(delta<0)return null;
 const t=(-b-Math.sqrt(delta))/(2*a);
 return t>=0&&t<=1?t:null;
};
const onRay=(from,to,t)=>({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});
export function fireAimedRail(game,point){
 if(!game.manualRailMode||!game.weaponProfile?.rail)return {ok:false,reason:'Включите ручной режим установленного рельсового орудия'};
 if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return {ok:false,reason:'Укажите точку выстрела'};
 if(game.holdFire||game.mining?.active||game.probeRepairing||game.openingRepairing||
    game.actionHeld?.kind==='opening-repair'||game.heavyCharge)
  return {ok:false,reason:'Ручной выстрел недоступен во время тишины, добычи, ремонта или подготовки гаубицы'};
 if(game.weaponThermal.locked)return {ok:false,reason:'Оружие перегрето'};
 if((game.moduleClocks?.rail||0)>0)return {ok:false,reason:'Рельс перезаряжается: '+Math.ceil(game.moduleClocks.rail*10)/10+' с'};
 const stats=statsFor(game,'rail'),targets=combatTargets(game,stats.range+85,game.player,true);
 const assisted=targets.filter(item=>targetDistance(point,item.target)<=targetRadius(item)+24)
  .sort((a,b)=>targetDistance(point,a.target)-targetDistance(point,b.target))[0];
 const aim=assisted?assisted.target:point;
 const dx=aim.x-game.player.x,dy=aim.y-game.player.y,d=Math.hypot(dx,dy);
 if(d<10)return {ok:false,reason:'Наведите прицел дальше от корабля'};
 const ux=dx/d,uy=dy/d,penetration=penetrationFactor(game.shipLoadout);
 let hits=0,rocksHit=0;
 for(const from of positions(game,'rail')){
  const end={x:from.x+ux*stats.range,y:from.y+uy*stats.range};
  // Previous mounts may already have destroyed a hull. Re-evaluate its
  // presence before calculating this mount's actual interception point.
  const intersections=targets.filter(item=>targetAlive(game,item,true))
   .map(item=>({item,t:shotCircle(from,end,item.target,targetRadius(item))}))
   .filter(hit=>hit.t!==null).sort((a,b)=>a.t-b.t);
  const rocks=game.rockGrid.query((from.x+end.x)*.5,(from.y+end.y)*.5,stats.range*.5+80);
  const cover=firstRockImpact(from.x,from.y,end.x,end.y,rocks,2,game.player);
  const before=intersections.find(hit=>!cover||hit.t<=cover.t+1e-8);
  const damage=stats.damage*1.5*weaponDamageFactor(game.shipLoadout,'rail',before?.item?.target||
   intersections[0]?.item?.target);
  let impact=end,exitImpact=null,exitBlocked=false;
  if(before){
   impact=onRay(from,end,before.t);
   if(damageTarget(game,before.item,damage,'rail',impact,false,true)>0)hits++;
  }else if(cover){
   impact=cover;rocksHit++;
   game.damageRock(cover.rock,damage*.85,from.x,from.y,'auto',true,
    contactAtPoint(cover.rock.x,cover.rock.y,cover.x,cover.y));
   if(penetration){
    const beyond=intersections.find(hit=>hit.t>cover.t+1e-8);
    const second=firstRockImpact(cover.x+ux*2,cover.y+uy*2,end.x,end.y,
     rocks.filter(rock=>rock!==cover.rock),2,game.player);
    if(second&&(!beyond||targetDistance(from,second)<beyond.t*stats.range)){
     game.damageRock(second.rock,damage*penetration,from.x,from.y,'auto',true,
      contactAtPoint(second.rock.x,second.rock.y,second.x,second.y));
     exitImpact={x:second.x,y:second.y};exitBlocked=true;
    }else if(beyond){
     exitImpact=onRay(from,end,beyond.t);
     if(damageTarget(game,beyond.item,damage*penetration,'rail',exitImpact,false,true)>0)hits++;
    }
   }
  }
  emitWeaponFx(game,'rail',from,impact,{impact:!!before||!!cover,blocked:!!cover});
  if(exitImpact)emitWeaponFx(game,'rail',impact,exitImpact,{secondary:true,blocked:exitBlocked});
  game.heritage.vfx.muzzle(from.x,from.y,Math.atan2(uy,ux),'railgun');
 }
 heatWeapons(game.weaponThermal,MODULES.rail.heat*game.weaponProfile.rail);
 // The deliberate shot has more punch, but takes longer to reload. A miss
 // costs the same heat and time, so manual control is not free extra DPS.
 game.moduleClocks.rail=stats.interval*1.3;
 game.heritage.play('railShot',.34,{x:game.player.x,y:game.player.y});
 return {ok:true,hits,rocksHit,cooldown:game.moduleClocks.rail};
}
// Kept as the auxiliary-only public entry point for tools and isolated scenarios.
export function updateAuxiliaryWeapons(game,dt,allowed){
 game.moduleClocks??={};
 for(const id of ['rail','flak'])game.moduleClocks[id]=(game.moduleClocks[id]??0)-dt;
 if(!allowed)return;
 for(const id of ['rail','flak'].sort((a,b)=>game.moduleClocks[a]-game.moduleClocks[b]))
  if(game.weaponProfile[id]&&game.moduleClocks[id]<=0&&!game.weaponThermal.locked)fireBeamFamily(game,id);
}
export function planHowitzer(game){
 if(!game.weaponProfile?.howitzer)return {ok:false,reason:'Установите гаубицу в узел H в ангаре'};
 if(game.heavyCharge)return {ok:false,reason:'Гаубица уже готовит выстрел'};
 if(game.heavyShells?.length)return {ok:false,reason:'Снаряд гаубицы ещё в полёте'};
 if(game.weaponThermal.locked)return {ok:false,reason:'Оружие перегрето. Дождитесь охлаждения'};
 if(game.heavyCooldown>0)return {ok:false,reason:'Гаубица заряжается: '+Math.ceil(game.heavyCooldown)+' с'};
 const chosen=selectTargets(game,900,1,true)[0];
 if(!chosen)return {ok:false,reason:'Для гаубицы нет враждебной цели в пределах 900 м'};
 return {ok:true,charge:{x:chosen.target.x,y:chosen.target.y,remaining:1.25,total:1.25}};
}
export function updateHowitzer(game,dt){
 game.heavyCooldown=Math.max(0,(game.heavyCooldown||0)-dt);
 updateHeavyShells(game,dt);
 if(!game.heavyCharge)return;
 if(!game.weaponProfile.howitzer||game.mining?.active||game.probeRepairing||game.openingRepairing||
    game.actionHeld?.kind==='opening-repair'){game.heavyCharge=null;return;}
 const chargingFor=game.heavyCharge.remaining;
 game.heavyCharge.remaining-=dt;if(game.heavyCharge.remaining>0)return;
 const aim=game.heavyCharge;game.heavyCharge=null;
 if(targetDistance(game.player,aim)>900){game.notice?.('Подготовка гаубицы отменена: точка удара дальше 900 м',2.8);return;}
 game.heavyCooldown=12;heatWeapons(game.weaponThermal,70);
 launchHeavyShell(game,mountPosition(game.player,5),aim);
 // A 15 FPS frame may cross the precise end of the charging window. Only the
 // unspent part of that frame moves the newly launched shell.
 const flightDt=Math.max(0,dt-chargingFor);
 if(flightDt>0)updateHeavyShells(game,flightDt);
}
export function drawHowitzerAim(ctx,charge){
 if(!charge)return;
 ctx.save();ctx.strokeStyle='#e2b2ff';ctx.lineWidth=2;ctx.setLineDash([9,7]);
 ctx.beginPath();ctx.arc(charge.x,charge.y,110,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.lineWidth=3;ctx.beginPath();ctx.arc(charge.x,charge.y,22,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-charge.remaining/charge.total));ctx.stroke();ctx.restore();
}
// Tiny code-native module layers share the exact anchors with the hangar.
// Their render cost is at most six short paths on the single player ship.
export function drawInstalledModules(ctx,player){
 if(!player.weaponSlots)return;
 for(let i=0;i<6;i++){
  const id=player.weaponSlots[i];if(!id)continue;
  const {x,y}=localMountPosition(player,i),m=MODULES[id];if(!m)continue;
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#142a36';ctx.strokeStyle=m.color;ctx.lineWidth=.8;
  ctx.fillRect(-2,-2,4,5);ctx.strokeRect(-2,-2,4,5);
  ctx.beginPath();ctx.moveTo(0,-2);ctx.lineTo(0,id==='howitzer'?-9:-5);ctx.stroke();
  if(id==='rocket'){ctx.beginPath();ctx.moveTo(-2,-2);ctx.lineTo(-2,-5);ctx.stroke();}
  ctx.restore();
 }
}
