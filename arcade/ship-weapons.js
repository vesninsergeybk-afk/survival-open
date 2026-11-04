import {CORRIDOR_OPERATION} from './operations.js?v=operation-leads-1';
import {MODULES,moduleStats,mountPosition,localMountPosition,heatWeapons} from './ship-loadout.js?v=hangar-2';
import {firstRockImpact} from './terrain.js?v=arcade-belt-26';
import {contactOnCircle,contactAtPoint} from './impact-geometry.js?v=arcade-impact-51';
import {canAutoTarget} from './signal-perception.js?v=arcade-perception-61';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function shipTargets(game,range,limit=1,nearest=false){
 const p=game.player,base=game.nearbyEnemyBase(range+150),op=game.operation;
 const objectives=[];
 if(op?.id===CORRIDOR_OPERATION.id&&op.hp>0&&op.phase!=='return'&&distance(p,op)<=Math.min(range,CORRIDOR_OPERATION.focusRange))
  objectives.push({kind:'jammer',target:op});
 if(base){
  for(const target of base.turrets||[])if(target.hp>0&&distance(p,target)<=range)
   objectives.push({kind:'turret',target});
  if(!(base.turrets||[]).some(t=>t.hp>0)&&distance(p,base)<=range)
   objectives.push({kind:'base',target:base});
 }
 objectives.sort((a,b)=>distance(p,a.target)-distance(p,b.target));
 const enemies=game.grid.query(p.x,p.y,range).filter(e=>e.hp>0&&!e.converted&&canAutoTarget(e)&&distance(p,e)<=range)
  .sort((a,b)=>distance(p,a)-distance(p,b)).map(target=>({kind:'enemy',target}));
 const candidates=[...objectives,...enemies];
 if(nearest)candidates.sort((a,b)=>distance(p,a.target)-distance(p,b.target));
 return candidates.slice(0,limit);
}
export function damageShipTarget(game,item,damage,source='beam',point=null){
 if(item.kind==='enemy')game.damageEnemy(item.target,damage,source,point);
 else if(item.kind==='turret')game.hitTurret(item.target,damage,point);
 else if(item.kind==='base')game.hitEnemyBase(item.target,damage);
 else{
  item.target.hp=Math.max(0,item.target.hp-damage);
  if(item.target.hp<=0)game.completeCorridor();
 }
}
export function updateAuxiliaryWeapons(game,dt,allowed){
 for(const id of ['rail','flak']){
  game.moduleClocks[id]=Math.max(0,(game.moduleClocks[id]||0)-dt);
  const count=game.weaponProfile[id];
  if(!allowed||!count||game.weaponThermal.locked||game.moduleClocks[id]>0)continue;
  const stats=moduleStats(id,game.skillRanks),targets=shipTargets(game,stats.range,stats.targets,id==='flak');
  if(!targets.length)continue; // No target means no ammunition, heat or effect.
  game.moduleClocks[id]=stats.interval;
  heatWeapons(game.weaponThermal,MODULES[id].heat*count);
  const slot=game.shipLoadout.slots.indexOf(id),from=mountPosition(game.player,slot);
  for(const item of targets){
   const target=item.target,d=distance(from,target),
    cover=firstRockImpact(from.x,from.y,target.x,target.y,
     game.rockGrid.query((from.x+target.x)*.5,(from.y+target.y)*.5,d*.5+45),2,game.player);
   const point=cover?contactAtPoint(cover.rock.x,cover.rock.y,cover.x,cover.y):
    contactOnCircle(target.x,target.y,target.r||22,from.x,from.y);
   const damage=stats.damage*count;
   if(cover)game.damageRock(cover.rock,damage*.85,from.x,from.y,'auto',true,point);
   else damageShipTarget(game,item,damage,id,point);
   for(let i=0;i<6;i++)if(game.shipLoadout.slots[i]===id){
    const muzzle=mountPosition(game.player,i);
    game.flash(muzzle.x,muzzle.y,point?.x??target.x,point?.y??target.y,MODULES[id].color);
   }
  }
  const first=targets[0].target;
  game.heritage.vfx.muzzle(from.x,from.y,Math.atan2(first.y-from.y,first.x-from.x),id==='rail'?'railgun':undefined);
  game.heritage.play(id==='rail'?'rocket':'laser',.25,{x:from.x,y:from.y});
 }
}

export function planHowitzer(game){
 if(!game.weaponProfile?.howitzer)return {ok:false,reason:'Установите гаубицу в узел H в ангаре'};
 if(game.heavyCharge)return {ok:false,reason:'Гаубица уже готовит выстрел'};
 if(game.weaponThermal.locked)return {ok:false,reason:'Оружие перегрето. Дождитесь охлаждения'};
 if(game.heavyCooldown>0)return {ok:false,reason:'Гаубица заряжается: '+Math.ceil(game.heavyCooldown)+' с'};
 const targets=shipTargets(game,900,24);
 const chosen=targets.find(x=>x.kind!=='enemy')||targets.find(x=>x.target.type==='gunship')||targets[0];
 if(!chosen)return {ok:false,reason:'Для гаубицы нет видимой цели в пределах 900 м'};
 // A fixed ground point is telegraphed, not a guaranteed homing hit.
 return {ok:true,charge:{x:chosen.target.x,y:chosen.target.y,remaining:1.25,total:1.25}};
}
export function updateHowitzer(game,dt){
 game.heavyCooldown=Math.max(0,(game.heavyCooldown||0)-dt);
 if(!game.heavyCharge)return;
 if(!game.weaponProfile.howitzer||game.mining?.active||game.probeRepairing){game.heavyCharge=null;return;}
 game.heavyCharge.remaining-=dt;if(game.heavyCharge.remaining>0)return;
 const aim=game.heavyCharge;game.heavyCharge=null;
 if(distance(game.player,aim)>900){
  game.notice?.('Подготовка гаубицы отменена: точка удара дальше 900 м',2.8);return;
 }
 game.heavyCooldown=12;
 heatWeapons(game.weaponThermal,70);
 const from=mountPosition(game.player,5),d=distance(from,aim),
  cover=firstRockImpact(from.x,from.y,aim.x,aim.y,
   game.rockGrid.query((from.x+aim.x)*.5,(from.y+aim.y)*.5,d*.5+45),3,game.player);
 const hit=cover?{x:cover.x,y:cover.y}:aim;
 game.flash(from.x,from.y,hit.x,hit.y,'#e4b7ff');
 game.heritage.vfx.nova(hit.x,hit.y,110,'violet');
 game.heritage.play('largeExplosion',.3,hit);
 for(const target of game.grid.query(hit.x,hit.y,160)){
  if(target.hp<=0||target.converted||distance(target,hit)>110+(target.r||0))continue;
  game.damageEnemy(target,180,'howitzer',contactOnCircle(target.x,target.y,target.r||20,hit.x,hit.y));
 }
 const base=game.nearbyEnemyBase(1100);
 if(base){
  const exposed=!(base.turrets||[]).some(t=>t.hp>0);
  for(const target of base.turrets||[])if(target.hp>0&&distance(target,hit)<=132)game.hitTurret(target,180);
  if(exposed&&distance(base,hit)<=180)game.hitEnemyBase(base,180);
 }
 const op=game.operation;
 if(op?.id===CORRIDOR_OPERATION.id&&op.hp>0&&op.phase!=='return'&&distance(op,hit)<=140){
  op.hp=Math.max(0,op.hp-180);if(op.hp<=0)game.completeCorridor();
 }
 if(cover)game.damageRock(cover.rock,180,from.x,from.y,'auto',true);
}
export function drawHowitzerAim(ctx,charge){
 if(!charge)return;
 ctx.save();ctx.strokeStyle='#e2b2ff';ctx.lineWidth=2;ctx.setLineDash([9,7]);
 ctx.beginPath();ctx.arc(charge.x,charge.y,110,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([]);ctx.lineWidth=3;ctx.beginPath();
 ctx.arc(charge.x,charge.y,22,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-charge.remaining/charge.total));ctx.stroke();
 ctx.restore();
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
