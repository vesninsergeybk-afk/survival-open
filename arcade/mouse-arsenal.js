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
export const createMouseArsenal=()=>({cometReadyAt:0,minesReadyAt:0,projectiles:[],mines:[],bursts:[],mineArmCuePlayed:true});
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
  game.heritage?.play?.('cometLaunch',.3,{x:p.x,y:p.y});
 }else{
  arsenal.minesReadyAt=now+plan.spec.cooldown;
  // The previous minefield disappears before new pods are deployed.
  arsenal.mines=[];
  arsenal.mineArmCuePlayed=false;
  const angle=Math.atan2(point.y-p.y,point.x-p.x)+Math.PI/2;
  for(let i=0;i<plan.spec.count;i++){
   const spacing=(i-(plan.spec.count-1)/2)*43;
   const target={x:point.x+Math.cos(angle)*spacing,y:point.y+Math.sin(angle)*spacing};
   launch(arsenal,'mine',p,target,MOUSE_ARMS.mines.flight,now,
    {radius:plan.spec.radius,damage:plan.spec.damage});
  }
  game.heritage?.play?.('mineLaunch',.24,{x:p.x,y:p.y});
 }
 return {ok:true,kind,count:kind==='mines'?plan.spec.count:1};
}
const structural=target=>target.kind!=='enemy';
const safeCombatTarget=item=>!item.target.centralWorker&&!item.target.frontierWorker&&
 !item.target.frontierSalvage;
const eligibleParasite=t=>!t.microSwarm&&['scout','fighter','flanker','healer','berserker','gunship'].includes(t.type)&&
 !t.boss&&!t.missionStructure&&!t.interceptCargo&&!t.regionalCargo&&!t.centralWorker&&!t.frontierWorker;
const canSlow=item=>!structural(item)&&!item.target.converted&&!item.target.boss&&
 !item.target.missionStructure&&!item.target.centralWorker&&!item.target.frontierWorker;
function detonate(game,arsenal,point,radius,damage,kind){
 const ranks=game.skillRanks||{},core=kind==='comet'?(ranks.cometCore||0):0,
  cryo=kind==='comet'?(ranks.cometCryo||0):0,
  pierce=kind==='mine'?(ranks.minePierce||0):0,
  snare=kind==='mine'?(ranks.mineSnare||0):0;
 const modifier=cryo?'cryo':snare?'snare':core?'core':pierce?'pierce':null;
 arsenal.bursts.push({x:point.x,y:point.y,radius,age:0,kind,modifier});
 if(arsenal.bursts.length>20)arsenal.bursts.shift();
 game.heritage?.play?.(kind==='comet'?'cometBurst':'mineBurst',.15,point);
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
 let hits=0,slowed=false,pierced=false;
 for(const item of targets){
  const d=Math.max(0,targetDistance(point,item.target)-targetRadius(item));
  const falloff=.42+.58*(1-clamp(d/radius,0,1));
  const centerPower=core?(core===1?.25:.45)*(1-clamp(d/radius,0,1)):0;
  const heavyBonus=pierce&&['berserker','gunship'].includes(item.target.type)?
   (pierce===1?.3:.5):0;
  const hit=damageTarget(game,item,damage*falloff*(1+centerPower+heavyBonus),kind,
   {x:point.x,y:point.y,directed:true},false,true);
  if(hit){hits++;if(heavyBonus>0)pierced=true;}
  if(hit&&item.target.hp>0&&canSlow(item)&&(cryo||snare)){
   const duration=cryo?(cryo===1?2.2:3.2):(snare===1?1.8:2.8);
   const factor=cryo?(cryo===1?.66:.52):(snare===1?.6:.42);
   const now=game.time||0;
   if((item.target.tacticalSlowUntil||0)>now)
    item.target.tacticalSlowFactor=Math.min(item.target.tacticalSlowFactor||1,factor);
   else item.target.tacticalSlowFactor=factor;
   item.target.tacticalSlowUntil=Math.max(item.target.tacticalSlowUntil||0,now+duration);
   slowed=true;
  }
 }
 // Distinct, quiet recorded accents describe the actual combat effect.
 // A volley of mines must not play an accent for every empty explosion.
 const accent=kind==='comet'?(cryo&&slowed?'cometCryoAccent':core&&hits?'cometCoreAccent':null):
  snare&&slowed?'mineSnareAccent':pierce&&pierced?'minePierceAccent':null;
 if(accent)game.heritage?.play?.(accent,kind==='comet'?.7:1.1,point);
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
   }else{
    arsenal.bursts.push({x:projectile.x,y:projectile.y,radius:18,age:0,kind:'mineBlocked'});
    if(arsenal.bursts.length>20)arsenal.bursts.shift();
    game.heritage?.play?.('armorHit',.18,projectile);
   }
  }
 }
 arsenal.projectiles=arsenal.projectiles.filter(p=>p.life>0);
 if(!arsenal.mineArmCuePlayed){
  const armed=arsenal.mines.find(m=>m.armedAt<=now&&m.expiresAt>now);
  if(armed){arsenal.mineArmCuePlayed=true;game.heritage?.play?.('mineArm',.4,armed);}
 }
 for(const mine of arsenal.mines){
  if(mine.expiresAt<=now||mine.armedAt>now||mine.nextScanAt>now)continue;
  mine.nextScanAt=now+.12;
  const trigger=combatTargets(game,105,mine,true).some(item=>safeCombatTarget(item)&&
   targetDistance(mine,item.target)<23+targetRadius(item));
  if(trigger){mine.expiresAt=now;detonate(game,arsenal,mine,mine.radius,mine.damage,'mine');}
 }
 arsenal.mines=arsenal.mines.filter(m=>m.expiresAt>now);
 for(const burst of arsenal.bursts)burst.age+=dt;
 arsenal.bursts=arsenal.bursts.filter(b=>b.age<(b.kind==='comet'?.72:.52));
}
export function drawMouseArsenal(ctx,game){
 const arsenal=game.mouseArsenal;if(!arsenal)return;
 const reduced=game.visuals?.reducedMotion;
 const quality=!reduced&&game.fps>=32;
 ctx.save();
 for(const mine of arsenal.mines){
  const active=game.time>=mine.armedAt,pulse=reduced?0:Math.sin(game.time*5)*1.2;
  const progress=clamp(1-(mine.armedAt-game.time)/MOUSE_ARMS.mines.armTime,0,1);
  ctx.strokeStyle=active?'#9ef9e8':'#9ba8b9';ctx.fillStyle=active?'#50dbca':'#7d869b';
  ctx.globalAlpha=active?.9:.5;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(mine.x,mine.y,7+pulse,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.arc(mine.x,mine.y,3,0,TAU);ctx.fill();
  if(!active){
   ctx.strokeStyle='#f0c99e';ctx.globalAlpha=.65;ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(mine.x,mine.y,12,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke();
  }else{
   ctx.strokeStyle='#63dccc';ctx.globalAlpha=.18;
   ctx.beginPath();ctx.arc(mine.x,mine.y,mine.radius,0,TAU);ctx.stroke();
   for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    ctx.globalAlpha=.45;ctx.beginPath();ctx.moveTo(mine.x+Math.cos(a)*10,mine.y+Math.sin(a)*10);
    ctx.lineTo(mine.x+Math.cos(a)*14,mine.y+Math.sin(a)*14);ctx.stroke();
   }
  }
 }
 for(const p of arsenal.projectiles){
  const mine=p.kind==='mine',speed=Math.hypot(p.vx,p.vy)||1;
  const nx=p.vx/speed,ny=p.vy/speed,tail=mine?16:48;
  ctx.lineCap='round';ctx.globalAlpha=mine?.6:.4;
  ctx.strokeStyle=mine?'#8caace':'#1a8fba';ctx.lineWidth=mine?3:11;
  ctx.beginPath();ctx.moveTo(p.x-nx*tail,p.y-ny*tail);ctx.lineTo(p.x,p.y);ctx.stroke();
  ctx.globalAlpha=.95;ctx.strokeStyle=mine?'#d1e7ff':'#8cf5ff';ctx.lineWidth=mine?1.3:3.4;
  ctx.beginPath();ctx.moveTo(p.x-nx*tail*.65,p.y-ny*tail*.65);ctx.lineTo(p.x,p.y);ctx.stroke();
  ctx.shadowColor=mine?'#c4d3ec':'#36e9fd';ctx.shadowBlur=quality?(mine?8:19):0;
  ctx.fillStyle=mine?'#d3e5f8':'#edfeff';ctx.beginPath();ctx.arc(p.x,p.y,mine?3.5:7,0,TAU);ctx.fill();
  ctx.shadowBlur=0;
 }
 for(const b of arsenal.bursts){
  const comet=b.kind==='comet',blocked=b.kind==='mineBlocked';
  const duration=comet?.72:.52,k=clamp(b.age/duration,0,1);
  const radius=b.radius*(.2+.8*k),fade=(1-k)*(1-k);
  const bright=blocked?'#ffe3ab':comet?'#c5fbff':'#e2e3ff';
  const outer=blocked?'#e0a66c':b.modifier==='cryo'?'#83b5ff':b.modifier==='snare'?'#92d7bf':
   b.modifier==='core'?'#fcdb9f':b.modifier==='pierce'?'#ffc69b':comet?'#4bdff4':'#8ba3f7';
  ctx.globalAlpha=fade*.85;ctx.strokeStyle=outer;ctx.lineWidth=2.2+3*(1-k);
  ctx.beginPath();ctx.arc(b.x,b.y,radius,0,TAU);ctx.stroke();
  ctx.globalAlpha=fade*.75;ctx.strokeStyle=bright;ctx.lineWidth=1.3;
  ctx.beginPath();ctx.arc(b.x,b.y,radius*.72,0,TAU);ctx.stroke();
  if(b.modifier){
   // The branch is legible by its secondary arcs even without the status text.
   ctx.globalAlpha=fade*.68;ctx.strokeStyle=outer;ctx.lineWidth=1.5;
   const cuts=reduced?2:4;
   for(let i=0;i<cuts;i++){
    const start=i*TAU/cuts+Math.PI/7;
    ctx.beginPath();ctx.arc(b.x,b.y,radius*.84,start,start+(b.modifier==='core'||b.modifier==='pierce'?.3:.53));ctx.stroke();
   }
  }
  ctx.globalAlpha=fade*.3;ctx.fillStyle=bright;
  ctx.beginPath();ctx.arc(b.x,b.y,b.radius*.28*(1-k),0,TAU);ctx.fill();
  // A weaker device keeps the silhouette of the blast; only detail count falls.
  const shards=blocked||reduced?0:game.fps<24?3:game.fps<36?5:comet?12:7;
  if(shards){
   ctx.strokeStyle=bright;ctx.lineWidth=comet?2.1:1.4;
   for(let i=0;i<shards;i++){
    const a=i*TAU/shards+.42,inner=b.radius*(.22+.43*k);
    const outerEdge=inner+b.radius*(comet?.2:.14)*(1-k);
    ctx.globalAlpha=fade*(i%3===0?.8:.48);
    ctx.beginPath();ctx.moveTo(b.x+Math.cos(a)*inner,b.y+Math.sin(a)*inner);
    ctx.lineTo(b.x+Math.cos(a)*outerEdge,b.y+Math.sin(a)*outerEdge);ctx.stroke();
   }
  }
  if(!comet&&!blocked&&!reduced){
   // Mine detonation: four angular electrical cuts, unlike the comet's
   // broad, circular shock front. Keep only two on a slow device.
   const cuts=game.fps<28?2:4;
   ctx.strokeStyle='#b6c9ff';ctx.lineWidth=1.3;ctx.globalAlpha=fade*.62;
   for(let i=0;i<cuts;i++){
    const a=i*TAU/cuts+Math.PI/4+k*.22;
    const start=b.radius*(.18+.26*k),end=start+b.radius*.13*(1-k);
    ctx.beginPath();ctx.moveTo(b.x+Math.cos(a)*start,b.y+Math.sin(a)*start);
    ctx.lineTo(b.x+Math.cos(a+.07)*end,b.y+Math.sin(a+.07)*end);ctx.stroke();
   }
  }
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
  if(aim.kind==='comet'){
   // The inner circle shows where the blast retains its strongest damage.
   ctx.globalAlpha=.48;ctx.strokeStyle=good?'#d1fbff':'#ffc0b2';ctx.lineWidth=1.1;
   ctx.beginPath();ctx.arc(aim.point.x,aim.point.y,spec.radius*.42,0,TAU);ctx.stroke();
  }
  ctx.globalAlpha=.95;ctx.font='bold 10px system-ui';ctx.textAlign='center';
  ctx.fillText(good?(aim.kind==='comet'?'КОМЕТА · отпустите ЛКМ':'МИНЫ · отпустите ПКМ'):'ВНЕ ДАЛЬНОСТИ',aim.point.x,aim.point.y-previewRadius-13);
 }
 ctx.restore();
}
