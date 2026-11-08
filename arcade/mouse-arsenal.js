// Two deliberately aimed weapons complement the ship's automatic guns.
// Gameplay uses world units; these values are prototypes, not pixel sizes.
import {combatTargets,targetDistance,targetRadius,clearLine,damageTarget} from './combat-targets.js?v=mouse-arms-1';
import {firstRockImpact} from './terrain.js?v=arcade-belt-26';

const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const MOUSE_ARMS=Object.freeze({
 comet:{name:'Голубая комета',range:670,cooldown:5.5,speed:580},
 mines:{name:'Минный веер',range:520,cooldown:17,flight:570,life:12,armTime:.65}
});
export const createMouseArsenal=()=>({cometReadyAt:0,minesReadyAt:0,projectiles:[],mines:[],bursts:[]});
export const cometSpec=ranks=>({
 radius:90+Math.min(2,Math.max(0,ranks?.cometRadius||0))*17,
 damage:35,cooldown:MOUSE_ARMS.comet.cooldown,range:MOUSE_ARMS.comet.range
});
export const minesSpec=ranks=>({
 count:4+Math.min(2,Math.max(0,ranks?.mineArray||0)),
 radius:47,damage:24,cooldown:MOUSE_ARMS.mines.cooldown,range:MOUSE_ARMS.mines.range
});
export function canAimMouseWeapon(game,kind){
 if(!['comet','mines'].includes(kind))return {ok:false,reason:'Неизвестное оружие'};
 if(!game?.player||game.dead||game.paused||game.overlay?.hidden===false||
  game.mining?.active||game.probeRepairing||game.openingRepairing||game.actionHeld)
  return {ok:false,reason:'Во время действия оружие недоступно'};
 const arsenal=game.mouseArsenal||(game.mouseArsenal=createMouseArsenal());
 const remaining=(arsenal[kind+'ReadyAt']||0)-(game.time||0);
 if(remaining>0)return {ok:false,reason:MOUSE_ARMS[kind].name+' · зарядка '+remaining.toFixed(1).replace('.',',')+' с'};
 return {ok:true};
}
export function planMouseWeapon(game,kind,point){
 const ready=canAimMouseWeapon(game,kind);
 if(!ready.ok)return ready;
 const spec=kind==='comet'?cometSpec(game.skillRanks):minesSpec(game.skillRanks);
 if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))
  return {ok:false,reason:'Укажите точку на поле боя'};
 const d=targetDistance(game.player,point);
 if(d>spec.range)return {ok:false,reason:'Слишком далеко · максимальная дальность '+spec.range+' м'};
 return {ok:true,kind,point:{x:point.x,y:point.y},spec};
}
const launch=(arsenal,kind,origin,point,speed,now,extra={})=>{
 const d=targetDistance(origin,point),safe=Math.max(1,d);
 arsenal.projectiles.push({kind,x:origin.x,y:origin.y,fromX:origin.x,fromY:origin.y,
  targetX:point.x,targetY:point.y,vx:(point.x-origin.x)/safe*speed,
  vy:(point.y-origin.y)/safe*speed,remaining:d/speed,life:d/speed+.1,
  createdAt:now,...extra});
};
export function fireMouseWeapon(game,kind,point){
 const plan=planMouseWeapon(game,kind,point);
 if(!plan.ok)return plan;
 const arsenal=game.mouseArsenal;
 const now=game.time||0,p=game.player;
 if(kind==='comet'){
  arsenal.cometReadyAt=now+plan.spec.cooldown;
  launch(arsenal,'comet',p,point,MOUSE_ARMS.comet.speed,now,{radius:plan.spec.radius,damage:plan.spec.damage});
  game.heritage?.play?.('plasmaShot',.36,{x:p.x,y:p.y});
 }else{
  arsenal.minesReadyAt=now+plan.spec.cooldown;
  // The previous minefield disappears before new pods are deployed.
  arsenal.mines=[];
  const angle=Math.atan2(point.y-p.y,point.x-p.x)+Math.PI/2;
  for(let i=0;i<plan.spec.count;i++){
   const spacing=(i-(plan.spec.count-1)/2)*43;
   const target={x:point.x+Math.cos(angle)*spacing,y:point.y+Math.sin(angle)*spacing};
   launch(arsenal,'mine',p,target,MOUSE_ARMS.mines.flight,now,
    {radius:plan.spec.radius,damage:plan.spec.damage});
  }
  game.heritage?.play?.('flakShot',.24,{x:p.x,y:p.y});
 }
 return {ok:true,kind,count:kind==='mines'?plan.spec.count:1};
}
const structural=target=>target.kind!=='enemy';
const safeCombatTarget=item=>!item.target.centralWorker&&!item.target.frontierWorker&&
 !item.target.frontierSalvage;
const eligibleParasite=t=>!t.microSwarm&&['scout','fighter','flanker','healer','berserker','gunship'].includes(t.type)&&
 !t.boss&&!t.missionStructure&&!t.interceptCargo&&!t.regionalCargo&&!t.centralWorker&&!t.frontierWorker;
function detonate(game,arsenal,point,radius,damage,kind){
 arsenal.bursts.push({x:point.x,y:point.y,radius,age:0,kind});
 if(arsenal.bursts.length>20)arsenal.bursts.shift();
 const targets=combatTargets(game,radius+90,point,true).filter(item=>
  safeCombatTarget(item)&&
  targetDistance(point,item.target)<=radius+targetRadius(item)&&
  clearLine(game,point,item.target));
 // Directly hitting a target primes the parasite: no extra key or 14 s mark.
 if(kind==='comet'&&(game.skillRanks?.capture||game.skillRanks?.signal)){
  const chosen=targets.filter(item=>!structural(item)&&eligibleParasite(item.target))
   .sort((a,b)=>targetDistance(point,a.target)-targetDistance(point,b.target))[0];
  if(chosen)game.designatedTarget={target:chosen.target,expiresAt:(game.time||0)+3.5};
 }
 let hits=0;
 for(const item of targets){
  const d=Math.max(0,targetDistance(point,item.target)-targetRadius(item));
  const falloff=.42+.58*(1-clamp(d/radius,0,1));
  if(damageTarget(game,item,damage*falloff,kind,
   {x:point.x,y:point.y,directed:true},false,true))hits++;
 }
 game.heritage?.vfx?.nova?.(point.x,point.y,Math.min(95,radius*.7),kind==='comet'?'cyan':'violet');
 return hits;
}
export function updateMouseArsenal(game,dt){
 const arsenal=game.mouseArsenal;if(!arsenal)return;
 const now=game.time||0;
 for(const projectile of arsenal.projectiles){
  const step=Math.min(dt,projectile.remaining),nx=projectile.x+projectile.vx*step,
   ny=projectile.y+projectile.vy*step;
  const distance=Math.hypot(nx-projectile.x,ny-projectile.y);
  const cover=distance>0?firstRockImpact(projectile.x,projectile.y,nx,ny,
   game.rockGrid?.query((projectile.x+nx)*.5,(projectile.y+ny)*.5,distance*.5+55)||[],
   projectile.kind==='comet'?8:4,null):null;
  projectile.x=cover?.x??nx;projectile.y=cover?.y??ny;
  projectile.remaining-=step;
  if(cover||projectile.remaining<=.0001){
   projectile.life=0;
   if(projectile.kind==='comet'){
    detonate(game,arsenal,projectile,projectile.radius,projectile.damage,'comet');
   }else if(!cover){
    arsenal.mines.push({x:projectile.x,y:projectile.y,radius:projectile.radius,
     damage:projectile.damage,armedAt:now+MOUSE_ARMS.mines.armTime,
     expiresAt:now+MOUSE_ARMS.mines.life,nextScanAt:now+MOUSE_ARMS.mines.armTime});
   }
  }
 }
 arsenal.projectiles=arsenal.projectiles.filter(p=>p.life>0);
 for(const mine of arsenal.mines){
  if(mine.expiresAt<=now||mine.armedAt>now||mine.nextScanAt>now)continue;
  mine.nextScanAt=now+.12;
  const trigger=combatTargets(game,105,mine,true).some(item=>safeCombatTarget(item)&&
   targetDistance(mine,item.target)<23+targetRadius(item));
  if(trigger){mine.expiresAt=now;detonate(game,arsenal,mine,mine.radius,mine.damage,'mine');}
 }
 arsenal.mines=arsenal.mines.filter(m=>m.expiresAt>now);
 for(const burst of arsenal.bursts)burst.age+=dt;
 arsenal.bursts=arsenal.bursts.filter(b=>b.age<.5);
}
export function drawMouseArsenal(ctx,game){
 const arsenal=game.mouseArsenal;if(!arsenal)return;
 const reduced=game.visuals?.reducedMotion;
 ctx.save();
 for(const mine of arsenal.mines){
  const active=game.time>=mine.armedAt,pulse=reduced?0:Math.sin(game.time*5)*2;
  ctx.strokeStyle=active?'#9ef9e8':'#9ba8b9';ctx.fillStyle=active?'#50dbca':'#7d869b';
  ctx.globalAlpha=active?.85:.35;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(mine.x,mine.y,7+pulse,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.arc(mine.x,mine.y,3,0,TAU);ctx.fill();
  if(active){ctx.globalAlpha=.13;ctx.beginPath();ctx.arc(mine.x,mine.y,mine.radius,0,TAU);ctx.stroke();}
 }
 for(const p of arsenal.projectiles){
  const mine=p.kind==='mine';ctx.globalAlpha=.95;
  ctx.shadowColor=mine?'#c4d3ec':'#36e9fd';ctx.shadowBlur=mine?8:20;
  ctx.fillStyle=mine?'#b9d3f2':'#8ffbff';ctx.beginPath();ctx.arc(p.x,p.y,mine?4:9,0,TAU);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle=mine?'#a0b6df':'#1b9ecb';ctx.lineWidth=mine?1.3:3;
  ctx.beginPath();ctx.moveTo(p.x-p.vx*.06,p.y-p.vy*.06);ctx.lineTo(p.x,p.y);ctx.stroke();
 }
 for(const b of arsenal.bursts){
  const k=b.age/.5;ctx.globalAlpha=(1-k)*.65;ctx.strokeStyle=b.kind==='comet'?'#78f4ff':'#b1b9ff';
  ctx.lineWidth=4*(1-k)+1;ctx.beginPath();ctx.arc(b.x,b.y,b.radius*(.28+.72*k),0,TAU);ctx.stroke();
 }
 const aim=game.mouseAim;if(aim&&['comet','mines'].includes(aim.kind)){
  const spec=aim.kind==='comet'?cometSpec(game.skillRanks):minesSpec(game.skillRanks);
  const good=targetDistance(game.player,aim.point)<=spec.range;
  ctx.globalAlpha=.8;ctx.strokeStyle=good?(aim.kind==='comet'?'#68e4f5':'#b6d8fa'):'#ff927c';
  ctx.setLineDash([7,7]);ctx.lineWidth=1.8;ctx.beginPath();
  const previewRadius=aim.kind==='comet'?spec.radius:(spec.count-1)*43/2+spec.radius;
  ctx.arc(aim.point.x,aim.point.y,previewRadius,0,TAU);ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=.07;ctx.fillStyle=ctx.strokeStyle;ctx.fill();
  if(aim.kind==='mines'){
   const line=Math.atan2(aim.point.y-game.player.y,aim.point.x-game.player.x)+Math.PI/2;
   for(let i=0;i<spec.count;i++){
    const offset=(i-(spec.count-1)/2)*43;
    const x=aim.point.x+Math.cos(line)*offset,y=aim.point.y+Math.sin(line)*offset;
    ctx.globalAlpha=.35;ctx.beginPath();ctx.arc(x,y,4,0,TAU);ctx.fill();
    ctx.globalAlpha=.16;ctx.beginPath();ctx.arc(x,y,spec.radius,0,TAU);ctx.stroke();
   }
  }
  ctx.globalAlpha=.45;ctx.beginPath();ctx.moveTo(game.player.x,game.player.y);
  ctx.lineTo(aim.point.x,aim.point.y);ctx.stroke();
  ctx.globalAlpha=.95;ctx.font='bold 10px system-ui';ctx.textAlign='center';
  ctx.fillText(good?(aim.kind==='comet'?'КОМЕТА · отпустите ЛКМ':'МИНЫ · отпустите ПКМ'):'ВНЕ ДАЛЬНОСТИ',aim.point.x,aim.point.y-previewRadius-13);
 }
 ctx.restore();
}
