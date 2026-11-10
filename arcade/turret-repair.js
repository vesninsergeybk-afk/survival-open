import {artilleryLinks,artilleryConnection,FLUX_ARTILLERY} from './flux-artillery.js?v=turret-preload-20261109-1-audit-1-corecharge-20261110-turret-defense-20261110';
import {supportConfig} from './flux-supports.js?v=turret-preload-20261109-1-audit-1-corecharge-20261110-turret-defense-20261110';

export const TURRET_REPAIR=Object.freeze({range:128,seconds:3});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const turretNeedsRepair=t=>!!t&&(t.hp<=0||
 (t.hp>0&&t.hp<t.maxHp*.6));
export function repairableTurret(world,player){
 const structures=[...(world?.contours?.artillery||[]),
  ...(world?.contours?.supportTurrets||[])];
 return structures.filter(t=>turretNeedsRepair(t)&&distance(t,player)<=TURRET_REPAIR.range)
  .sort((a,b)=>Number(a.hp>0)-Number(b.hp>0)||distance(a,player)-distance(b,player))[0]||null;
}
export function turretRepairQuote(world,player,t){
 if(!turretNeedsRepair(t))return {ok:false,reason:'Сооружение исправно или не найдено'};
 const cfg=t.kind==='flux-artillery'?FLUX_ARTILLERY:supportConfig(t);
 if(!cfg)return {ok:false,reason:'Неизвестное сооружение'};
 if(!artilleryConnection(t,artilleryLinks(world)))
  return {ok:false,reason:'Сначала восстановите питание контурной линии'};
 const destroyed=t.hp<=0,
  ore=Math.ceil(cfg.oreCost*(destroyed?.4:.18)),
  flux=Math.ceil(cfg.fluxCost*(destroyed?5:2))/10;
 if((player.ore||0)<ore)return {ok:false,reason:'Для ремонта нужно '+ore+' сплава',ore,flux};
 if((world.contours.flux||0)+1e-8<flux)
  return {ok:false,reason:'Для ремонта нужно '+flux+' флюкса',ore,flux};
 return {ok:true,ore,flux,destroyed};
}
export function repairTurret(world,player,t,time){
 const quote=turretRepairQuote(world,player,t);if(!quote.ok)return quote;
 player.ore-=quote.ore;world.contours.flux-=quote.flux;
 if(quote.destroyed){
  t.hp=Math.ceil(t.maxHp*.6);t.ammo=0;t.chargeCredit=0;
  t.readyAt=time+1.8;t.nextShotAt=t.readyAt;t.lastDestroyedAt=-1;
  if(t.kind==='flux-artillery'){
   t.aimingUntil=0;t.closeNextShotAt=t.readyAt;
  }else{
   t.burstLeft=0;t.initialReady=false;
   if(t.type==='hive')t.drones=[];
  }
 }else{
  t.hp=Math.min(t.maxHp,t.hp+Math.ceil(t.maxHp*.38));
 }
 t.lastTurretHitAt=time;
 return {ok:true,ore:quote.ore,flux:quote.flux,hp:t.hp,destroyed:quote.destroyed};
}
