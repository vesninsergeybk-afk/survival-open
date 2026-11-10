import {artilleryLinks,artilleryConnection} from './flux-artillery.js?v=turret-defense-20261110';
import {nearestSupplyDepot,takeDepotFlux} from './flux-depots.js';
import {TURRET_SCREEN} from './turret-growth.js?v=trial-station-defense-20261110';

// Emplacements cannot evade. A modest powered shield buys reaction time;
// neither the hull nor shield can regenerate under uninterrupted attack.
export const TURRET_DEFENSE=Object.freeze({
 shieldFraction:TURRET_SCREEN.base,armor:.34,
 rankShield:TURRET_SCREEN.perFortify,rankArmor:.05,
 shieldDelay:7,repairDelay:10,shieldRate:5.5,repairRate:2.3,
 shieldFluxPerHp:.009,repairFluxPerHp:.022,interceptCooldown:8,
 alertInterval:9
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const fortifyRank=t=>Math.max(0,Math.min(3,t?.branches?.fortify||0));
export const turretShieldCapacity=t=>Math.round((t?.maxHp||0)*
 (TURRET_DEFENSE.shieldFraction+TURRET_DEFENSE.rankShield*fortifyRank(t)));
export const turretStructureName=t=>t?.kind==='flux-artillery'?'Громовая батарея':
 t?.type==='arc'?'Разрядник':t?.type==='laser'?'Лазерное гнездо':'Дроновая матка';
export const friendlyTurrets=world=>[
 ...(world?.contours?.artillery||[]),...(world?.contours?.supportTurrets||[])];
function spendFlux(world,t,time,amount){
 if(!(amount>0))return true;
 const depot=nearestSupplyDepot(world,t,time,amount);
 if(depot&&takeDepotFlux(depot,amount))return true;
 if((world?.contours?.flux||0)+1e-8<amount)return false;
 world.contours.flux=Math.max(0,world.contours.flux-amount);return true;
}
export function advanceTurretDefenses(game,dt){
 const world=game?.world,now=game?.time;
 if(!world?.contours||!Number.isFinite(now)||!(dt>0))return;
 const edges=artilleryLinks(world);
 for(const t of friendlyTurrets(world)){
  if(t.hp<=0)continue;
  const active=t.readyAt<=now&&!!artilleryConnection(t,edges);
  t._defensePowered=active;
  const capacity=turretShieldCapacity(t);
  if(t.defenseSchema!==2){
   // Old checkpoints stored the smaller shield. Preserve its charge *ratio*
   // once, otherwise a restored turret would quietly start almost empty.
   const oldCap=Math.round(t.maxHp*(.34+.11*fortifyRank(t)));
   if(Number.isFinite(t.shield)&&oldCap>0)
    t.shield=clamp(t.shield,0,oldCap)/oldCap*capacity;
   t.defenseSchema=2;
  }
  if(t.shield===undefined)t.shield=active?capacity:0;
  // A new mount gets its charged screen when construction completes. The
  // first frame of its build period must not permanently initialise it to 0.
  if(active&&!t._defenseCommissioned){
   if(t.lastTurretHitAt===undefined)t.shield=capacity;
   t._defenseCommissioned=true;
  }
  t.shield=clamp(t.shield,0,capacity);
  if(!active){t._repairing=false;continue;}
  const quiet=now-(t.lastTurretHitAt??-1000);
  if(quiet>=TURRET_DEFENSE.shieldDelay&&t.shield<capacity){
   const gain=Math.min(capacity-t.shield,TURRET_DEFENSE.shieldRate*dt),
    cost=gain*TURRET_DEFENSE.shieldFluxPerHp;
   if(spendFlux(world,t,now,cost))t.shield+=gain;
  }
  const repairing=fortifyRank(t)>=2&&quiet>=TURRET_DEFENSE.repairDelay&&
   t.hp<t.maxHp&&t.hp>0;
  t._repairing=repairing;
  if(repairing){
   const gain=Math.min(t.maxHp-t.hp,TURRET_DEFENSE.repairRate*dt);
   if(spendFlux(world,t,now,gain*TURRET_DEFENSE.repairFluxPerHp)){
    t.hp+=gain;t._repairingUntil=now+.25;
   }
  }
 }
}
export function damageFriendlyTurret(game,t,shot){
 const now=game?.time??0,raw=Math.max(0,shot?.damage||0),
  rank=fortifyRank(t),siege=shot?.kind==='siege-bolt';
 if(!(t?.hp>0))return {destroyed:false,hull:0,shield:0};
 if(t.shield===undefined)t.shield=t._defensePowered?turretShieldCapacity(t):0;
 t.lastTurretHitAt=now;t._repairing=false;
 const capacity=turretShieldCapacity(t);
 t.shield=clamp(t.shield,0,capacity);
 // A reinforced artillery mount can destroy one incoming shell on a real
 // cooldown. It is visible and costs power, so it cannot cancel a whole wave.
 if(t.kind==='flux-artillery'&&rank>=1&&!siege&&t._defensePowered&&
    now>=(t.nextInterceptAt||0)&&
    spendFlux(game.world,t,now,.045)){
  t.nextInterceptAt=now+TURRET_DEFENSE.interceptCooldown;
  game.heritage?.vfx?.nova?.(shot.x,shot.y,25,'cyan');
  return {destroyed:false,hull:0,shield:0,intercepted:true};
 }
 const shieldFactor=siege?1.55:1,
  spent=Math.min(t.shield,raw*shieldFactor),
  remainder=Math.max(0,raw-spent/shieldFactor),
  hull=remainder*(siege?1:1-TURRET_DEFENSE.armor-TURRET_DEFENSE.rankArmor*rank);
 t.shield-=spent;t.hp=Math.max(0,t.hp-hull);
 if(now>=(game._turretAlertAt||-1000)&&now>=(t._turretAlertAt||-1000)){
  game._turretAlertAt=now+TURRET_DEFENSE.alertInterval;
  t._turretAlertAt=now+15;
  game.notice?.('ПОД ОБСТРЕЛОМ · '+turretStructureName(t)+
   (t.shield<=0?' · ЩИТ ПРОБИТ!':' · защитный экран держится'),4);
 }
 return {destroyed:t.hp<=0,hull,shield:spent,intercepted:false};
}
export function drawTurretDefenses(ctx,game,cam){
 const now=game?.time||0;
 for(const t of friendlyTurrets(game?.world)){
  if(t.hp<=0||t.x<cam.x-90||t.x>cam.x+cam.w+90||
      t.y<cam.y-90||t.y>cam.y+cam.h+90)continue;
  const cap=turretShieldCapacity(t),fraction=cap>0?clamp((t.shield||0)/cap,0,1):0;
  ctx.save();
  if(fraction>.01){
   ctx.strokeStyle='rgba(99,220,255,.74)';ctx.lineWidth=2.3;
   ctx.beginPath();ctx.arc(t.x,t.y,(t.r||38)+9,-Math.PI/2,
    -Math.PI/2+Math.PI*2*fraction);ctx.stroke();
  }
  const danger=now-(t.lastTurretHitAt??-1000)<2.4;
  if(danger){
   ctx.strokeStyle='rgba(255,112,112,.86)';ctx.lineWidth=1.8;
   ctx.setLineDash([7,5]);ctx.beginPath();ctx.arc(t.x,t.y,(t.r||38)+16,0,Math.PI*2);
   ctx.stroke();ctx.setLineDash([]);
  }
  if(now<(t._repairingUntil||0)){
   for(let i=0;i<2;i++){
    const angle=now*2.3+i*Math.PI+t.id*.4;
    ctx.fillStyle='#8efbdc';ctx.beginPath();
    ctx.arc(t.x+Math.cos(angle)*((t.r||38)+18),
     t.y+Math.sin(angle)*((t.r||38)+18),3.5,0,Math.PI*2);ctx.fill();
   }
  }
  ctx.restore();
 }
}
