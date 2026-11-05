/* Survivor cockpit HUD: presentation only. World state and combat stay in game.js.
   The local radar is deliberately bounded to 1.1km and redraws <=5 times/sec. */
import {miningSignal} from './mining.js?v=arcade-extraction-risk-34';
import {missionHudText} from './mission-feedback.js?v=weapons-cycle-2-campaign-1';
import {openingArcActive,openingArcObjective,runClock} from './opening-arc.js?v=opening-arc-3';
import {homeConflictCue} from './home-conflict.js?v=home-conflict-1-campaign-1';
import {campaignCue,campaignProgress} from './regional-campaign.js?v=campaign-1-repair-qa-1';
import {stationInterdictionCue} from './strategic-command.js?v=campaign-1-repair-qa-1';
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
   survivalClock:el('survivalClock'),
   xpbar:el('xpbar'),xpmeter:el('xpmeter'),level:el('level'),
   shield:el('shield'),shieldmeter:el('shieldmeter'),shieldbar:el('shieldbar'),
   leftBurstMeter:el('leftBurstMeter'),leftBurstText:el('leftBurstText'),
   hudSupportRing:el('hudSupportRing'),hudStrikeCount:el('hudStrikeCount'),
   hudThermal:el('hudThermal'),hudThermalLabel:el('hudThermalLabel'),
   hudThermalText:el('hudThermalText'),hudThermalMeter:el('hudThermalMeter'),
   droneIcons:[el('hudDrone0'),el('hudDrone1')],
   ore:el('ore'),data:el('data'),bases:el('bases'),
   wing:el('wing'),hack:el('hack'),fps:el('fps'),enemies:el('enemies'),
   points:el('points'),burst:el('burst'),burstbar:el('burstbar'),
   bursttext:el('bursttext'),hudHackSlot:el('hudHackSlot'),hudStrikeSlot:el('hudStrikeSlot'),flightMode:el('flightMode'),
   wingStatus:el('wingStatus'),stateText:el('stateText'),flightStatus:el('flightStatus'),flightDistance:el('flightDistance'),
   radarDistance:el('radarDistance'),burstBtn:el('burstBtn'),message:el('message'),
   oreResource:el('oreResource'),oreGain:el('oreGain'),
   miningStatus:el('miningStatus'),miningPercent:el('miningPercent'),
   miningLabel:el('miningLabel'),
   contractObjective:el('contractObjective'),interactionCue:el('interactionCue')};
  this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.compactHud=window.matchMedia('(pointer: coarse)').matches;
  this.drawRadarShell();
 }
 update(game,nextXp,boostCooldown) {
  const p=game.player,n=this.n;
  if(n.survivalClock)display(n.survivalClock,'ВЫЛЕТ '+runClock(game.time)+
   ' · РЕКОРД '+runClock(Math.max(game.bestFlight||0,game.time)));
  const health=clamp01(p.hp/Math.max(1,p.maxHp));
  display(n.hp,Math.ceil(p.hp)+' / '+p.maxHp);
  n.hpbar.style.width=(health*100)+'%';
  n.hpmeter.style.setProperty('--meter-fill',(health*100)+'%');
  n.hpmeter.setAttribute('aria-valuenow',String(Math.ceil(p.hp)));
  n.hpmeter.setAttribute('aria-valuemax',String(p.maxHp));
  const progress=clamp01(p.xp/Math.max(1,nextXp));
  n.xpbar.style.width=(100*progress)+'%';
  n.xpmeter.style.setProperty('--meter-fill',(100*progress)+'%');
  n.xpmeter.setAttribute('aria-valuenow',String(Math.round(progress*100)));
  display(n.level,p.level);
  display(n.points,p.points>0?'Очков: '+p.points:'до ур. '+(p.level+1));
  display(n.shield,p.shield>0?Math.ceil(p.shield):'—');
  const shieldCap=Math.max(30,16+(game.skillRanks?.shield||0)*24,p.shield);
  const shieldFill=clamp01(p.shield/shieldCap);
  n.shieldmeter.style.setProperty('--meter-fill',(shieldFill*100)+'%');
  n.shieldmeter.setAttribute('aria-valuenow',String(Math.ceil(p.shield)));
  n.shieldmeter.setAttribute('aria-valuemax',String(Math.ceil(shieldCap)));
  display(n.ore,p.ore);display(n.data,p.data);display(n.bases,game.activeBases);
  display(n.wing,game.allies.length);display(n.hack,game.hacks.length);
  display(n.fps,Math.round(game.fps));display(n.enemies,game.enemies.length);
  const strikes=game.support?.charges||0;
  const bombers=game.support?.missions?.length||0;
  const cover=game.allies.filter(a=>a.state==='cover'||a.state==='guard').length;
  display(n.hudStrikeCount,'×'+strikes);
  n.hudSupportRing.classList.toggle('available',strikes>0);
  const liveAllies=game.allies.filter(a=>a.hp>0).length;
  for(let i=0;i<n.droneIcons.length;i++)n.droneIcons[i].classList.toggle('active',i<liveAllies);
  display(n.wingStatus,liveAllies+'/2');
  n.wingStatus.setAttribute('aria-label',bombers?'Авиагруппа выполняет удар; '+liveAllies+' дронов в строю':
   cover?'Прикрывают корабль: '+cover+'; '+liveAllies+' дронов в строю':
   liveAllies+' из 2 дронов в строю');
  const focus=game.actionHeld||game.interactionFocus;
  n.interactionCue.hidden=!focus||game.paused||game.dead||!game.overlay.hidden;
  if(!n.interactionCue.hidden) {
   const label=focus.kind==='station'?'Открыть станцию':
    focus.kind==='repair'?'Ремонт зонда':
    focus.kind==='opening-repair'?'Эвакуация капсулы':'Добыча породы';
   display(n.interactionCue,'E · '+label+(focus.kind==='station'?'':' · удерживать'));
  }
  const op=game.operation,c=game.contract,tracker=n.contractObjective;
  const opening=openingArcObjective(game.openingArc,game.time);
  // A standard station contract also unlocks the first free module. Never
  // hide that reward just because the optional opening dilemma was skipped.
  const unclaimedWeapon=game.firstHardwareReward==='pending'?
   'БЕСПЛАТНОЕ ОРУЖИЕ · выберите модуль на станции':'';
  const attack=stationInterdictionCue(game);
  const regional=campaignProgress(game.world).complete?campaignCue(game):homeConflictCue(game)||campaignCue(game);
  if(tracker){
   // Time-limited opening tasks remain readable even when the player picks up
   // another station assignment during the crisis.
   const urgent=openingArcActive(game.openingArc);
   const objective=attack||(urgent?opening:(op||c)?missionHudText(game):opening||unclaimedWeapon||regional);
   tracker.hidden=!objective;
   this.root.classList.toggle('has-objective',!!objective);
   tracker.classList.toggle('ready',!attack&&!urgent&&!op&&!!c&&c.progress>=c.goal);
   display(tracker,objective);
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
  const burstLabel=boosting?'ФОРСАЖ':cd>0?cd.toFixed(1)+' с':'ГОТОВ';
  display(n.bursttext,burstLabel);display(n.leftBurstText,burstLabel);
  const burstFill=100*(1-clamp01(cd/maxCd));
  n.leftBurstMeter.style.setProperty('--meter-fill',burstFill+'%');
  n.leftBurstMeter.setAttribute('aria-valuenow',String(Math.round(burstFill)));
  n.burst.classList.toggle('ready',cd<=0);
  // Art-only ability frames mirror actual available charges; never unlock controls.
  const hasCode=game.hacks.length>0,hasStrike=strikes>0;
  n.hudHackSlot.classList.toggle('available',hasCode);
  n.hudStrikeSlot.classList.toggle('available',hasStrike);
  n.hudHackSlot.setAttribute('aria-label',hasCode?'Коды доступны: '+game.hacks.length:'Кодов нет');
  n.hudStrikeSlot.setAttribute('aria-label',hasStrike?'Авиаудар: '+strikes:'Авиаудар недоступен');
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
  const systemStatus=condition==='critical'?'АВАРИЙНЫЙ РЕЖИМ':
   repairing?'ВОССТАНОВЛЕНИЕ ЗОНДА':extracting?'ДОБЫЧА ПОРОДЫ':boosting?'УСКОРЕНИЕ АКТИВНО':
   baseFocus?'ПРИОРИТЕТНАЯ ЦЕЛЬ':overcharge?'УСИЛЕНИЕ ЛУЧА · '+overcharge+' С':
   scan?'ГЕОРАЗВЕДКА · '+scan+' С':p.shield>0?'ЩИТ АКТИВЕН':
   condition==='wounded'?'КОРПУС ПОВРЕЖДЁН':
    game.doctrine?('ДОКТРИНА · '+({assault:'ШТУРМ',command:'КОМАНДИР',prospect:'СТАРАТЕЛЬ'}[game.doctrine]||'')):
    'СИСТЕМЫ В НОРМЕ';
  // The mission ribbon's right bay is reserved for real route distance.
  const goal=game.waypoint;
  const routeDistance=goal&&Number.isFinite(goal.x)&&Number.isFinite(goal.y)?
   Math.hypot(goal.x-p.x,goal.y-p.y):NaN;
  const hasRoute=Number.isFinite(routeDistance)&&!(op||c);
  n.flightDistance.hidden=!hasRoute;
  n.flightStatus.classList.toggle('has-route',hasRoute);
  if(hasRoute)display(n.flightDistance,routeDistance>=1000?
   (routeDistance/1000).toFixed(1)+' КМ':Math.round(routeDistance)+' М');
  const priorityStatus=condition==='critical'||repairing||extracting||boosting||
   baseFocus||overcharge>0||scan>0;
  display(n.stateText,hasRoute&&!priorityStatus?
   String(goal.label||'МАРШРУТ').toUpperCase():systemStatus);
  const modeFull=game.holdFire?'АВТООГОНЬ · ВЫКЛЮЧЕН':
   repairing?'ОРУЖИЕ ОТКЛ. · РЕМОНТ':
   extracting?(game.nearQuietLab?'ДОБЫЧА · ШУМ −32%':'ОРУЖИЕ ОТКЛ. · ДОБЫЧА'):
   boosting?'МАНЁВР · ФОРСАЖ':baseFocus?'АВТОЦЕЛЬ · БАЗА':
   overcharge?'ЛУЧ +20% · '+overcharge+' С':
   game.nearArsenalBonus?'РЕТРАНСЛЯТОР · ЛУЧ +18%':
   game.nearDockField||game.nearArsenalDefense?'ПОЛЕ СТАНЦИИ · УРОН −18%':
   game.nearDock?.module==='workshop'?'ДОК · РЕМОНТ +60%':
   game.nearQuietLab?'ЛАБОРАТОРИЯ · ШУМ −32%':'АВТООГОНЬ · АКТИВЕН';
  // Phone instrument uses short, readable states; full context stays available
  // as the accessible label. Desktop retains its detailed telemetry.
  const modeCompact=game.holdFire?'ТИХИЙ РЕЖИМ':
   repairing?'РЕМОНТ':extracting?(game.nearQuietLab?'ДОБЫЧА · ТИХО':'ДОБЫЧА'):
   boosting?'ФОРСАЖ':baseFocus?'БАЗА · ЦЕЛЬ':
   overcharge?'ЛУЧ +20%':game.nearArsenalBonus?'ЛУЧ +18%':
   game.nearDockField||game.nearArsenalDefense?'ЗАЩИТА +18%':
   game.nearDock?.module==='workshop'?'РЕМОНТ +60%':
   game.nearQuietLab?'ШУМ −32%':'АВТООГОНЬ';
  display(n.flightMode,this.compactHud?modeCompact:modeFull);
  n.flightMode.setAttribute('aria-label',modeFull);
  // Future thermal mechanics opt in explicitly. Without a real model, no
  // misleading empty heat gauge is rendered in the live cockpit.
  const thermal=game.weaponThermal;
  const thermalEnabled=!!thermal?.enabled&&Number.isFinite(thermal.current)&&
   Number.isFinite(thermal.limit)&&thermal.limit>0;
  n.hudThermal.hidden=!thermalEnabled;
  this.root.classList.toggle('thermal-enabled',thermalEnabled);
  if(thermalEnabled){
   const fill=100*clamp01(thermal.current/thermal.limit);
   const cooling=thermal.cooling===true,locked=thermal.locked===true;
   n.hudThermal.classList.toggle('warning',fill>=75&&!locked);
   n.hudThermal.classList.toggle('locked',locked);
   n.hudThermal.classList.toggle('cooling',cooling&&!locked);
   n.hudThermalMeter.style.setProperty('--meter-fill',fill+'%');
   n.hudThermalMeter.setAttribute('aria-valuenow',String(Math.round(fill)));
   display(n.hudThermalText,Math.round(fill)+'%');
   display(n.hudThermalLabel,locked?'ПЕРЕГРЕВ':cooling?'ОСТЫВАНИЕ':'НАГРЕВ');
   if(locked){
    display(n.flightMode,this.compactHud?'ПЕРЕГРЕВ':'ОГОНЬ ЗАБЛОКИРОВАН · ПЕРЕГРЕВ');
    n.flightMode.setAttribute('aria-label','ОГОНЬ ЗАБЛОКИРОВАН · ПЕРЕГРЕВ');
   }
  }
  n.message.style.opacity=game.messageUntil>game.time?'1':'0';
  // HUD remains stationary: no cockpit sway when the player steers.
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
 impact(relativeDamage,shieldOnly=false) {
  // A genuine hit is emitted by game.hurt() after shields and armor have absorbed
  // damage. A CSS-only effect never alters physics, input or HUD values.
  if(!Number.isFinite(relativeDamage)||relativeDamage<.075)return;
  const heavy=relativeDamage>=.17;
  this.root.classList.remove('is-hit','is-hit-heavy','is-hit-shield','is-hit-static');
  if(this.reducedMotion){
   // Keep a brief non-moving diagnostic flash for accessibility.
   void this.frame.offsetWidth;
   this.root.classList.add('is-hit-static');
   return;
  }
  // Invulnerability prevents combat hits from restarting the effect every frame.
  void this.frame.offsetWidth;
  this.root.classList.add('is-hit');
  if(heavy)this.root.classList.add('is-hit-heavy');
  if(shieldOnly)this.root.classList.add('is-hit-shield');
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
  // Selected route stays visible on the outer ring when beyond 1.1 km.
  const waypoint=game.waypoint;
  if(waypoint&&Number.isFinite(waypoint.x)&&Number.isFinite(waypoint.y)){
   const dx=waypoint.x-p.x,dy=waypoint.y-p.y,d=Math.hypot(dx,dy);
   if(Number.isFinite(d)){
    const r=Math.min(57,d/range*57),a=d>0?dx/d:0,b=d>0?dy/d:-1;
    ctx.save();ctx.translate(72+a*r,72+b*r);
    ctx.rotate(Math.PI/4);ctx.strokeStyle='#FFD178';ctx.lineWidth=1.7;
    ctx.shadowColor='#F5A849';ctx.shadowBlur=4;
    ctx.strokeRect(-4.5,-4.5,9,9);ctx.restore();
   }
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
