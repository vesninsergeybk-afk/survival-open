import {RULES,beamDamage} from './balance.js?v=arcade-balanced-bases-30';
import {weaponDamageFactor,penetrationFactor,plasmaDamageFactor,rocketFlight} from './weapon-specializations.js?v=weapons-cycle-2';
import {MODULES,moduleStats,mountPosition,localMountPosition,heatWeapons,plasmaSplitWeights} from './ship-loadout.js?v=weapons-cycle-2';
import {firstRockImpact} from './terrain.js?v=arcade-belt-26';
import {contactOnCircle,contactAtPoint} from './impact-geometry.js?v=arcade-impact-51';
import {combatTargets,selectTargets,targetDistance,targetRadius,lineContact,clearLine,damageTarget} from './combat-targets.js?v=weapons-cycle-2';

export const shipTargets=(game,range,limit=1,nearest=false,focus='precision')=>
 selectTargets(game,range,limit,!nearest&&focus==='precision');
export const damageShipTarget=damageTarget;
const statsFor=(g,id)=>moduleStats(id,g.skillRanks,g.shipLoadout.specializations?.[id]);
const positions=(g,id)=>{
 const slots=g.shipLoadout.slots.map((v,i)=>v===id?i:-1).filter(i=>i>=0);
 // Callers of the combat library may supply an aggregate profile without art.
 return (slots.length?slots:Array.from({length:g.weaponProfile[id]||0},(_,i)=>i)).map(i=>mountPosition(g.player,i));
};
function fireBeamFamily(game,id){
 const stats=statsFor(game,id),targets=selectTargets(game,stats.range,stats.targets,id==='rail');
 if(!targets.length)return false;
 const weights=id==='plasma'?plasmaSplitWeights(targets.length):null;
 for(const from of positions(game,id)){
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
     game.flash(cover.x,cover.y,hit?.x??t.x,hit?.y??t.y,'#a5bfff');
    }
   }else damageTarget(game,item,damage,id==='plasma'?'beam':id,point);
   game.flash(from.x,from.y,point?.x??t.x,point?.y??t.y,cover?'#f6ca87':MODULES[id].color);
  }
  const t=targets[0].target;
  game.heritage.vfx.muzzle(from.x,from.y,Math.atan2(t.y-from.y,t.x-from.x),id==='rail'?'railgun':undefined);
 }
 heatWeapons(game.weaponThermal,MODULES[id].heat*game.weaponProfile[id]);
 game.heritage.play(id==='rail'?'rocket':'laser',id==='plasma'?.32:.25,{x:game.player.x,y:game.player.y});
 if(id==='plasma')game.beamClock=stats.interval;
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
  game.heritage.vfx.muzzle(from.x,from.y,Math.atan2(t.y-from.y,t.x-from.x),'railgun');
 }
 heatWeapons(game.weaponThermal,MODULES.rocket.heat*game.weaponProfile.rocket);
 game.rocketClock=stats.interval;game.heritage.play('rocket',.5,{x:game.player.x,y:game.player.y});return true;
}
export function updateAutomaticWeapons(game,dt,allowed){
 game.moduleClocks??={rail:0,flak:0};
 game.beamClock=(game.beamClock??0)-dt;game.rocketClock=(game.rocketClock??0)-dt;
 for(const id of ['rail','flak'])game.moduleClocks[id]=(game.moduleClocks[id]??0)-dt;
 if(!allowed)return;
 const clock=id=>id==='plasma'?game.beamClock:id==='rocket'?game.rocketClock:game.moduleClocks[id];
 // Overdue salvos fire first after cooling. A fixed family order must not
 // repeatedly spend the heat budget before another installed family can fire.
 const ready=['plasma','rail','flak','rocket'].filter(id=>game.weaponProfile[id]&&clock(id)<=0)
  .sort((a,b)=>clock(a)-clock(b));
 for(const id of ready){
  if(game.weaponThermal.locked)break;
  if(id==='rocket')fireRockets(game);else fireBeamFamily(game,id);
 }
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
 if(game.weaponThermal.locked)return {ok:false,reason:'Оружие перегрето. Дождитесь охлаждения'};
 if(game.heavyCooldown>0)return {ok:false,reason:'Гаубица заряжается: '+Math.ceil(game.heavyCooldown)+' с'};
 const chosen=selectTargets(game,900,1,true)[0];
 if(!chosen)return {ok:false,reason:'Для гаубицы нет враждебной цели в пределах 900 м'};
 return {ok:true,charge:{x:chosen.target.x,y:chosen.target.y,remaining:1.25,total:1.25}};
}
export function updateHowitzer(game,dt){
 game.heavyCooldown=Math.max(0,(game.heavyCooldown||0)-dt);
 if(!game.heavyCharge)return;
 if(!game.weaponProfile.howitzer||game.mining?.active||game.probeRepairing){game.heavyCharge=null;return;}
 game.heavyCharge.remaining-=dt;if(game.heavyCharge.remaining>0)return;
 const aim=game.heavyCharge;game.heavyCharge=null;
 if(targetDistance(game.player,aim)>900){game.notice?.('Подготовка гаубицы отменена: точка удара дальше 900 м',2.8);return;}
 game.heavyCooldown=12;heatWeapons(game.weaponThermal,70);
 const from=mountPosition(game.player,5),d=targetDistance(from,aim);
 const cover=firstRockImpact(from.x,from.y,aim.x,aim.y,
  game.rockGrid.query((from.x+aim.x)*.5,(from.y+aim.y)*.5,d*.5+60),3,game.player);
 const hit=cover?{x:cover.x,y:cover.y}:aim;
 game.flash(from.x,from.y,hit.x,hit.y,'#e4b7ff');game.heritage.vfx.nova(hit.x,hit.y,110,'violet');
 game.heritage.play('largeExplosion',.3,hit);
 // Snapshot exposed targets before damage: killing the last turret in this
 // explosion does not retroactively expose the core to that same explosion.
 for(const item of combatTargets(game,180,hit)){
  const t=item.target;if(targetDistance(t,hit)>110+targetRadius(item))continue;
  const dx=t.x-hit.x,dy=t.y-hit.y,n=Math.hypot(dx,dy)||1;
  const start={x:hit.x+dx/n*2,y:hit.y+dy/n*2};
  if(!clearLine(game,start,t,false))continue;
  damageTarget(game,item,180,'howitzer',contactOnCircle(t.x,t.y,targetRadius(item),hit.x,hit.y));
 }
 if(cover)game.damageRock(cover.rock,180,from.x,from.y,'auto',true);
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
