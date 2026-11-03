/* Survivor cockpit HUD: presentation only. World state and combat stay in game.js.
   The local radar is deliberately bounded to 1.1km and redraws <=5 times/sec. */
import {miningSignal} from './mining.js?v=arcade-extraction-risk-34';
import {missionHudText} from './mission-feedback.js?v=corridor-return-3';
const el = id => document.getElementById(id);
const clamp01 = value => Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
export const hullCondition = (hp,maxHp) => {
 const fraction=clamp01(hp/Math.max(1,maxHp));
 return fraction<=.3?'critical':fraction<=.65?'wounded':'normal';
};
export const radarPoint = (x,y,player,range=1100) => {
 const dx=x-player.x,dy=y-player.y;
 const distance=Math.hypot(dx,dy);
 if(!Number.isFinite(distance)||distance>range)return null;
 return {x:72+(dx/range)*61,y:72+(dy/range)*61,distance};
};
const display = (node,value) => {const s=String(value);if(node.textContent!==s)node.textContent=s;};
export class CockpitDisplay {
 constructor() {
  this.root=el('hud');this.frame=el('cockpitFrame');
  this.radar=el('radar');this.ctx=this.radar.getContext('2d',{alpha:true});
  this.lastRadar=-Infinity;this.lastCondition='';this.oreGained=0;this.oreGainTime=-Infinity;
  this.n={hp:el('hp'),hpbar:el('hpbar'),hpmeter:el('hpmeter'),
   xpbar:el('xpbar'),xpmeter:el('xpmeter'),level:el('level'),
   shield:el('shield'),ore:el('ore'),data:el('data'),bases:el('bases'),
   wing:el('wing'),hack:el('hack'),fps:el('fps'),enemies:el('enemies'),
   points:el('points'),burst:el('burst'),burstbar:el('burstbar'),
   bursttext:el('bursttext'),flightMode:el('flightMode'),
   wingStatus:el('wingStatus'),stateText:el('stateText'),
   radarDistance:el('radarDistance'),burstBtn:el('burstBtn'),message:el('message'),
   oreResource:el('oreResource'),oreGain:el('oreGain'),
   miningStatus:el('miningStatus'),miningPercent:el('miningPercent'),
   miningLabel:el('miningLabel'),
   contractObjective:el('contractObjective')};
  this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.drawRadarShell();
 }
 update(game,nextXp,boostCooldown) {
  const p=game.player,n=this.n;
  const health=clamp01(p.hp/Math.max(1,p.maxHp));
  display(n.hp,Math.ceil(p.hp)+' / '+p.maxHp);
  n.hpbar.style.width=(health*100)+'%';
  n.hpmeter.setAttribute('aria-valuenow',String(Math.ceil(p.hp)));
  n.hpmeter.setAttribute('aria-valuemax',String(p.maxHp));
  const progress=clamp01(p.xp/Math.max(1,nextXp));
  n.xpbar.style.width=(100*progress)+'%';
  n.xpmeter.setAttribute('aria-valuenow',String(Math.round(progress*100)));
  display(n.level,p.level);
  display(n.points,p.points>0?'Очков: '+p.points:'до ур. '+(p.level+1));
  display(n.shield,p.shield>0?Math.ceil(p.shield):'—');
  display(n.ore,p.ore);display(n.data,p.data);display(n.bases,game.activeBases);
  display(n.wing,game.allies.length);display(n.hack,game.hacks.length);
  display(n.fps,Math.round(game.fps));display(n.enemies,game.enemies.length);
  const strikes=game.support?.charges||0;
  const bombers=game.support?.missions?.length||0;
  const cover=game.allies.filter(a=>a.state==='cover'||a.state==='guard').length;
  display(n.wingStatus,bombers?'АВИАГРУППА В БОЮ':
   strikes?'ДРОНЫ '+game.allies.length+' · УДАР B: '+strikes:
   !game.allies.length?'ДРОНЫ: 0/2':cover?'ПРИКРЫТИЕ · '+cover:
    'ДРОНЫ В СТРОЮ · '+game.allies.length+'/2');
  const op=game.operation,c=game.contract,tracker=n.contractObjective;
  if(tracker){
   tracker.hidden=!(op||c);
   tracker.classList.toggle('ready',!op&&!!c&&c.progress>=c.goal);
   display(tracker,missionHudText(game));
  }
  const extracting=!!game.mining?.active,repairing=!!game.probeRepairing;
  const noise=miningSignal(game.miningNoise||0);
  const response=game.enemies.find(e=>e.hp>0&&!e.converted&&e.signalIntel&&
    e.signalIntel.mode!=='withdraw')?.signalIntel;
  const responseVisible=!!response&&
    (response.mode!=='engaged'||game.time<response.cueUntil);
  const intercepted=!!game.noiseAlert&&game.noiseAlert.until>game.time;
  n.miningStatus.hidden=!extracting&&noise<12&&!responseVisible&&!intercepted;
  n.miningStatus.classList.toggle('alert',noise>=60||responseVisible||intercepted);
  n.miningStatus.classList.toggle('critical',noise>=100||
    (responseVisible&&response?.mode==='engaged'));
  display(n.miningLabel,responseVisible&&response.mode==='engaged'?'◉ ЦЕЛЬ ОБНАРУЖЕНА':
    responseVisible?'◉ ПАТРУЛЬ ИЩЕТ ИСТОЧНИК':
    intercepted?'◉ СИГНАЛ ПЕРЕХВАЧЕН':
    extracting?'⚡ ЭКСТРАКТОР':'◉ СЛЕД ДОБЫЧИ');
  if(extracting&&game.mining.target){
   const progress=Math.round(100*(1-game.mining.target.hp/
    Math.max(1,game.mining.target.maxHp)));
   display(n.miningPercent,progress+'% · '+(responseVisible?
     (response.mode==='engaged'?'ПАТРУЛЬ АТАКУЕТ':'ПАТРУЛЬ НА ПОДХОДЕ'):
     intercepted?'СИГНАЛ ПЕРЕХВАЧЕН':'СИГНАЛ '+noise+'%'));
  }else if(responseVisible){
   display(n.miningPercent,response.mode==='engaged'?'ПЕРЕХОД В АТАКУ':
    response.mode==='search'?'ПРОВЕРКА КООРДИНАТ':'ПРИБЛИЖЕНИЕ К СИГНАЛУ');
  }else if(intercepted)display(n.miningPercent,'ПАТРУЛЬ НА ПОДХОДЕ');
  else display(n.miningPercent,'СИГНАЛ '+noise+'%');
  if(game.time-this.oreGainTime>.8){
   n.oreResource.classList.remove('is-gaining');this.oreGained=0;
  }
  const cd=Math.max(0,p.burstCooldown),maxCd=Math.max(.01,boostCooldown);
  n.burstbar.style.width=(100*(1-clamp01(cd/maxCd)))+'%';
  const boosting=p.burstRemaining>0;
  display(n.bursttext,boosting?'ФОРСАЖ':cd>0?cd.toFixed(1)+' с':'ГОТОВ');
  n.burst.classList.toggle('ready',cd<=0);
  n.burstBtn.disabled=cd>0;
  const condition=hullCondition(p.hp,p.maxHp);
  if(condition!==this.lastCondition) {
   this.root.classList.toggle('is-critical',condition==='critical');
   this.root.classList.toggle('is-wounded',condition==='wounded');
   this.lastCondition=condition;
  }
  const enemyBase=game.nearbyEnemyBase(390);
  const baseFocus=!!enemyBase&&(enemyBase.turrets.some(t=>t.hp>0&&
   Math.hypot(t.x-p.x,t.y-p.y)<=235)||
   !enemyBase.turrets.some(t=>t.hp>0)&&Math.hypot(enemyBase.x-p.x,enemyBase.y-p.y)<=245);
  const overcharge=Math.max(0,Math.ceil((game.overchargeUntil||0)-game.time));
  const scan=Math.max(0,Math.ceil((game.geoScanUntil||0)-game.time));
  display(n.stateText,condition==='critical'?'АВАРИЙНЫЙ РЕЖИМ':
   repairing?'ВОССТАНОВЛЕНИЕ ЗОНДА':extracting?'ДОБЫЧА ПОРОДЫ':boosting?'УСКОРЕНИЕ АКТИВНО':
   baseFocus?'ПРИОРИТЕТНАЯ ЦЕЛЬ':overcharge?'УСИЛЕНИЕ ЛУЧА · '+overcharge+' С':
   scan?'ГЕОРАЗВЕДКА · '+scan+' С':p.shield>0?'ЩИТ АКТИВЕН':
   condition==='wounded'?'КОРПУС ПОВРЕЖДЁН':
    game.doctrine?('ДОКТРИНА · '+({assault:'ШТУРМ',command:'КОМАНДИР',prospect:'СТАРАТЕЛЬ'}[game.doctrine]||'')):
    'СИСТЕМЫ В НОРМЕ');
  display(n.flightMode,game.holdFire?'АВТООГОНЬ · ВЫКЛЮЧЕН':
   repairing?'ОРУЖИЕ ОТКЛ. · РЕМОНТ':
   extracting?(game.nearQuietLab?'ДОБЫЧА · ШУМ −32%':'ОРУЖИЕ ОТКЛ. · ДОБЫЧА'):
   boosting?'МАНЁВР · ФОРСАЖ':baseFocus?'АВТОЦЕЛЬ · БАЗА':
   overcharge?'ЛУЧ +20% · '+overcharge+' С':
   game.nearArsenalBonus?'РЕТРАНСЛЯТОР · ЛУЧ +18%':
   game.nearDockField||game.nearArsenalDefense?'ПОЛЕ СТАНЦИИ · УРОН −18%':
   game.nearDock?.module==='workshop'?'ДОК · РЕМОНТ +60%':
   game.nearQuietLab?'ЛАБОРАТОРИЯ · ШУМ −32%':'АВТООГОНЬ · АКТИВЕН');
  n.message.style.opacity=game.messageUntil>game.time?'1':'0';
  // Perspective responds to dampened ship motion rather than to every canvas frame.
  // No motion on reduced-motion devices, low frame rate or when game is paused.
  if(!this.reducedMotion&&game.fps>=36&&!game.paused) {
   const vx=Math.max(-1,Math.min(1,p.vx/400)),vy=Math.max(-1,Math.min(1,p.vy/400));
   this.frame.style.setProperty('--hud-yaw',(-vx*.65).toFixed(2)+'deg');
   this.frame.style.setProperty('--hud-dx',(vx*1.3).toFixed(1)+'px');
   this.frame.style.setProperty('--hud-dy',(vy*.7).toFixed(1)+'px');
  } else {
   this.frame.style.setProperty('--hud-yaw','0deg');
   this.frame.style.setProperty('--hud-dx','0px');
   this.frame.style.setProperty('--hud-dy','0px');
  }
  const interval=game.fps<35?.34:.2;
  if(game.time-this.lastRadar>=interval||game.time<this.lastRadar) {
   this.lastRadar=game.time;
   this.drawRadar(game);
  }
 }
 resourceGain(amount,time) {
  if(time-this.oreGainTime>.7)this.oreGained=0;
  this.oreGained+=amount;this.oreGainTime=time;
  display(this.n.oreGain,'+'+this.oreGained);
  this.n.oreResource.classList.remove('is-gaining');
  void this.n.oreResource.offsetWidth;
  this.n.oreResource.classList.add('is-gaining');
 }
 impact(relativeDamage) {
  if(this.reducedMotion||relativeDamage<.075)return;
  this.root.classList.remove('is-hit');
  // A hit is rare and i-frames prevent successive reflows.
  void this.frame.offsetWidth;
  this.root.classList.add('is-hit');
 }
 drawRadarShell() {
  const ctx=this.ctx;
  ctx.clearRect(0,0,144,144);
  ctx.save();
  ctx.translate(72,72);
  ctx.strokeStyle='rgba(90,194,217,.20)';ctx.lineWidth=1;
  for(const r of [22,42,61]){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(-63,0);ctx.lineTo(63,0);ctx.moveTo(0,-63);ctx.lineTo(0,63);ctx.stroke();
  ctx.strokeStyle='rgba(115,231,237,.5)';
  for(let a=0;a<Math.PI*2;a+=Math.PI/4){
   const x=Math.cos(a),y=Math.sin(a);ctx.beginPath();
   ctx.moveTo(x*63,y*63);ctx.lineTo(x*67,y*67);ctx.stroke();
  }
  ctx.restore();
 }
 drawRadar(game) {
  const ctx=this.ctx,p=game.player,range=1100;
  this.drawRadarShell();
  const sweep=game.time*.31;
  ctx.save();
  ctx.translate(72,72);ctx.rotate(sweep);
  ctx.fillStyle='rgba(85,226,214,.045)';ctx.beginPath();ctx.moveTo(0,0);
  ctx.arc(0,0,61,-.48,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(85,226,214,.20)';ctx.beginPath();
  ctx.moveTo(0,0);ctx.lineTo(61,0);ctx.stroke();ctx.restore();
  let stations=[];
  try {stations=game.world.nearbyStations(p.x,p.y,range,true);} catch(e) {
   // Radar is auxiliary; a temporary world-query error must not stop the game.
   stations=[];
  }
  let nearest=Infinity;
  for(const base of stations) {
   if(base.enemy&&!game.enemyBasesUnlocked())continue;
   const point=radarPoint(base.x,base.y,p,range);if(!point)continue;
   if(!base.enemy&&!base.active)nearest=Math.min(nearest,point.distance);
   ctx.save();ctx.translate(point.x,point.y);ctx.rotate(Math.PI/4);
   ctx.fillStyle=base.enemy&&!base.captured?'#ff797a':base.active?'#6cffd6':'#ffd797';
   ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=4;
   ctx.fillRect(-3.7,-3.7,7.4,7.4);ctx.restore();
  }
  const drawContacts=(ships,color,limit,radius)=>{
   let count=0;ctx.fillStyle=color;
   for(let i=0;i<ships.length&&count<limit;i++) {
    const ship=ships[i];if(ship.hp<=0)continue;
    const point=radarPoint(ship.x,ship.y,p,range);if(!point)continue;
    ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();count++;
   }
  };
  drawContacts(game.enemies,'#ff7b83',40,2.3);
  drawContacts(game.allies,'#6ce5ff',25,2.7);
  // Only one amber ring per responding group; the radar stays legible in crowds.
  const marked=new Set();
  for(const e of game.enemies){
   const intel=e.signalIntel;
   if(e.hp<=0||e.converted||!intel||marked.has(intel))continue;
   marked.add(intel);
   const point=radarPoint(e.x,e.y,p,range);if(!point)continue;
   ctx.strokeStyle=intel.mode==='engaged'?'#ff7b83':'#ffca81';
   ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(point.x,point.y,4.5,0,Math.PI*2);ctx.stroke();
  }
  if(game.noiseAlert?.until>game.time){
   const point=radarPoint(game.noiseAlert.x,game.noiseAlert.y,p,range);
   if(point){
    ctx.strokeStyle='#ffd58e';ctx.lineWidth=1.1;ctx.setLineDash([2,3]);
    ctx.beginPath();ctx.arc(point.x,point.y,5.5,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
   }
  }
  // Approaching orbital strike is marked as an outlined danger area.
  for(const zone of game.zones.slice(0,5)) {
   if(zone.fuse<=0)continue;
   const point=radarPoint(zone.x,zone.y,p,range);if(!point)continue;
   ctx.strokeStyle='#ffa86e';ctx.lineWidth=1.3;ctx.beginPath();
   ctx.arc(point.x,point.y,Math.max(2,zone.r/range*61),0,Math.PI*2);ctx.stroke();
  }
  ctx.save();ctx.translate(72,72);ctx.rotate(p.angle||0);
  ctx.fillStyle='#f6ffff';ctx.shadowColor='#a1ffff';ctx.shadowBlur=7;
  ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(4,5);ctx.lineTo(0,2);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();
  ctx.restore();
  display(this.n.radarDistance,Number.isFinite(nearest)?
   'СТАНЦИЯ · '+Math.round(nearest)+' М':'БЛИЖНИЙ СЕКТОР');
 }
}
