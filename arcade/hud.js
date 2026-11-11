/* Survivor cockpit HUD: presentation only. World state and combat stay in game.js.
   The local radar is deliberately bounded to 1.1km and redraws <=5 times/sec. */
import {miningSignal} from './mining.js?v=arcade-extraction-risk-34-pressure-response-1';
import {missionHudText,missionHomeText} from './mission-feedback.js?v=mission-home-20261111';
import {openingArcActive,openingArcObjective,runClock} from './opening-arc.js?v=opening-arc-5';
import {homeConflictCue} from './home-conflict.js?v=home-conflict-1-campaign-1-enemy-balance-2';
import {campaignCue,campaignProgress} from './regional-campaign.js?v=campaign-1-repair-qa-1-territory-war-1-enemy-growth-1';
import {stationInterdictionCue} from './strategic-command.js?v=campaign-1-repair-qa-1-world-feedback-1-territory-war-1';
import {expForNext} from './balance.js?v=xp-feedback-pass1-1-pressure-response-1';
import {normalizedDoctrineRanks,doctrineRank} from './pilot-doctrines.js?v=pilot-depth-1-pilot-value-2-hud-merge-20261110';
import {weaponDeckState} from './weapon-hud.js?v=unlimited-rental-hud-2-space-impact-20261110-weapon-deck-audit-2-hud-merge-20261110';
import {ESCORTS,escortCapacity} from './escort-squad.js?v=escort-squad-20261110-wingmastery-20261110-escort-art-20261110';
const el = id => document.getElementById(id);
const mountCountLabel=count=>{
 const last=count%10,teens=count%100>=11&&count%100<=14;
 return count+' '+(teens||last===0||last>=5?'УЗЛОВ':last===1?'УЗЕЛ':'УЗЛА');
};
const WEAPON_ICONS=Object.freeze({
 plasma:'weapon-plasma.svg',rail:'weapon-rail.svg',flak:'weapon-flak.svg',
 rocket:'weapon-rocket.svg',comet:'weapon-comet.svg',mines:'weapon-mines.svg',
 howitzer:'weapon-howitzer.svg',pulse:'tactical-pulse.svg',
 trap:'tactical-trap.svg',decoy:'tactical-decoy.svg',jam:'tactical-jam.svg',
 ion:'ion.svg',resonator:'field-resonator.svg'
});
const weaponIcon=id=>'./studio/hud-kit/'+(WEAPON_ICONS[id]||'weapon.svg');
const DRONE_CODES=Object.freeze({scout:'СТР',fighter:'КЛН',brawler:'ТРН',rocket:'ОСА',medic:'ИСК'});
const clamp01 = value => Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const count = value => Math.round(value).toLocaleString('ru-RU');
export const HUD_RADAR_RANGE=1100;
// XP is stored within the current level, so a rollover cannot be measured by
// subtracting the two visible XP counters.
export const experienceDifference = (before,after) => {
 if(!before||!after||![before.xp,after.xp,before.level,after.level].every(Number.isFinite)||
  before.level<1||after.level<before.level)return null;
 if(after.level===before.level)return after.xp-before.xp;
 let earned=expForNext(before.level)-before.xp+after.xp;
 for(let level=before.level+1;level<after.level;level++)earned+=expForNext(level);
 return earned;
};
export const hullCondition = (hp,maxHp) => {
 const fraction=clamp01(hp/Math.max(1,maxHp));
 return fraction<=.3?'critical':fraction<=.65?'wounded':'normal';
};
export const radarPoint = (x,y,player,range=HUD_RADAR_RANGE) => {
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
  this.dataGained=0;this.dataGainTime=-Infinity;
  this.lastWallet=null;this.rewardBurst=null;this.lastRewardTime=-Infinity;
  this.n={hp:el('hp'),hpbar:el('hpbar'),hpmeter:el('hpmeter'),
   survivalClock:el('survivalClock'),
   xpbar:el('xpbar'),xpmeter:el('xpmeter'),xpValue:el('xpValue'),level:el('level'),
   shield:el('shield'),shieldmeter:el('shieldmeter'),shieldbar:el('shieldbar'),
   leftBurstMeter:el('leftBurstMeter'),leftBurstText:el('leftBurstText'),
   hudSupportRing:el('hudSupportRing'),hudStrikeCount:el('hudStrikeCount'),
   hudThermal:el('hudThermal'),hudThermalLabel:el('hudThermalLabel'),
   hudThermalText:el('hudThermalText'),hudThermalMeter:el('hudThermalMeter'),
   droneIcons:Array.from({length:6},(_,i)=>el('hudDrone'+i)),
   droneSlots:Array.from({length:6},(_,i)=>el('hudDroneSlot'+i)),wingAlert:el('wingAlert'),
   droneMeters:Array.from({length:6},(_,i)=>el('hudDroneHp'+i)),
   droneNames:Array.from({length:6},(_,i)=>el('hudDroneName'+i)),
   hudTrophy:el('hudTrophy'),hudTrophyName:el('hudTrophyName'),hudTrophyTime:el('hudTrophyTime'),hudTrophyIcon:el('hudTrophyIcon'),
   ore:el('ore'),data:el('data'),bases:el('bases'),
   flux:el('flux'),fluxResource:el('fluxResource'),fluxGain:el('fluxGain'),
   hack:el('hack'),fps:el('fps'),enemies:el('enemies'),
   points:el('points'),burst:el('burst'),burstbar:el('burstbar'),
   bursttext:el('bursttext'),hudHackSlot:el('hudHackSlot'),hudStrikeSlot:el('hudStrikeSlot'),flightMode:el('flightMode'),
   wingStatus:el('wingStatus'),stateText:el('stateText'),flightStatus:el('flightStatus'),flightDistance:el('flightDistance'),
   radarDistance:el('radarDistance'),burstBtn:el('burstBtn'),message:el('message'),
   oreResource:el('oreResource'),oreGain:el('oreGain'),
   dataResource:el('dataResource'),dataGain:el('dataGain'),
   rewardFeed:el('rewardFeed'),rewardOre:el('rewardOre'),rewardData:el('rewardData'),
   rewardXp:el('rewardXp'),rewardLevel:el('rewardLevel'),
   miningStatus:el('miningStatus'),miningPercent:el('miningPercent'),
   miningLabel:el('miningLabel'),
   contractObjective:el('contractObjective'),missionHome:el('missionHome'),interactionCue:el('interactionCue'),territoryStatus:el('territoryStatus'),
   meteorAlert:el('meteorAlert'),
   weaponDeckAuto:el('weaponDeckAuto'),weaponDeckDirect:el('weaponDeckDirect'),
   weaponDeckCount:el('weaponDeckCount'),
   weaponDeckSpaceQuick:el('weaponDeckSpaceQuick'),weaponDeckSpaceKey:el('weaponDeckSpaceKey'),
   weaponDeckSpaceName:el('weaponDeckSpaceName'),weaponDeckSpaceStatus:el('weaponDeckSpaceStatus'),
   weaponDeckFieldQuick:el('weaponDeckFieldQuick'),weaponDeckFieldKey:el('weaponDeckFieldKey'),
   weaponDeckFieldName:el('weaponDeckFieldName'),weaponDeckFieldStatus:el('weaponDeckFieldStatus')};
  this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.compactHud=window.matchMedia('(pointer: coarse)').matches;
  this.weaponDeckRows=new Map();this.weaponDeckSignature='';
  const toggle=el('weaponDeckToggle'),deck=el('weaponDeck');
  if(toggle&&deck)toggle.onclick=()=>{
   const open=deck.classList.toggle('is-open');
   toggle.setAttribute('aria-expanded',String(open));
  };
  this.drawRadarShell();
 }
 update(game,nextXp,boostCooldown) {
  const p=game.player,n=this.n;
  this.root.classList.toggle('has-contour-trial',!!game.contourTrial||!!(game.contourFeedback?.victory&&game.time-game.contourFeedback.at<7));
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
  n.xpmeter.setAttribute('aria-valuenow',String(Math.floor(p.xp)));
  n.xpmeter.setAttribute('aria-valuemax',String(nextXp));
  display(n.xpValue,count(p.xp)+' / '+count(nextXp));
  display(n.level,p.level);
  display(n.points,' · '+p.points+' очк.');
  display(n.shield,p.shield>0?Math.ceil(p.shield):'—');
  const shieldCap=Math.max(30,16+(game.skillRanks?.shield||0)*24,p.shield);
  const shieldFill=clamp01(p.shield/shieldCap);
  n.shieldmeter.style.setProperty('--meter-fill',(shieldFill*100)+'%');
  n.shieldmeter.setAttribute('aria-valuenow',String(Math.ceil(p.shield)));
  n.shieldmeter.setAttribute('aria-valuemax',String(Math.ceil(shieldCap)));
  display(n.ore,p.ore);display(n.data,p.data);display(n.bases,game.activeBases);
  const contour=game.world?.contours,flux=contour?.flux||0;
  if(n.flux)display(n.flux,flux.toLocaleString('ru-RU',{maximumFractionDigits:1}));
  if(n.fluxResource){
   const known=(contour?.delivered||0)>0||!!game.fluxFirstSeenAt;
   n.fluxResource.hidden=!known;
   n.fluxResource.classList.toggle('first-delivery',known&&
    game.time-(game.fluxFirstSeenAt??-Infinity)<8);
   n.fluxResource.classList.toggle('is-gaining',known&&
    game.time-(game.fluxLastGainAt??-Infinity)<2.5);
   if(n.fluxGain&&known&&game.time-(game.fluxLastGainAt??-Infinity)<2.5)
    display(n.fluxGain,'+'+(game.fluxLastGain||0).toLocaleString('ru-RU',
     {maximumFractionDigits:2}));
  }
  this.trackWallet(p,game.time);
  display(n.hack,game.hacks.length);
  display(n.fps,Math.round(game.fps));display(n.enemies,game.enemies.length);
  const strikes=game.support?.charges||0;
  const bombers=game.support?.missions?.length||0;
  const cover=game.allies.filter(a=>a.state==='cover'||a.state==='guard').length;
  display(n.hudStrikeCount,'×'+strikes);
  n.hudSupportRing.classList.toggle('available',strikes>0);
  const liveUnits=game.allies.filter(a=>a.hp>0),liveAllies=liveUnits.length;
  if((this.nextWingCapacityUpdate||-Infinity)<=game.time){
   const connected=typeof game.world?.networkTopology==='function'?
    game.world.networkTopology().count:game.activeBases||1;
   this.wingCapacity=escortCapacity(connected);
   this.nextWingCapacityUpdate=game.time+1;
  }
  const capacity=this.wingCapacity||1;
  const critical=liveUnits.filter(a=>a.hp/a.maxHp<=.28),damaged=liveUnits.filter(a=>a.hp<a.maxHp);
  for(let i=0;i<n.droneIcons.length;i++){
   const icon=n.droneIcons[i],slot=n.droneSlots[i],unit=liveUnits[i];
   slot.classList.toggle('active',!!unit);
   slot.classList.toggle('locked',i>=capacity);
   const fraction=unit?clamp01(unit.hp/Math.max(1,unit.maxHp)):0;
   slot.classList.toggle('critical',!!unit&&fraction<=.28);
   slot.classList.toggle('wounded',!!unit&&fraction>.28&&fraction<=.6);
   const sprite=unit&&ESCORTS[unit.role]?
    './studio/hud-kit/escort-'+unit.role+'.svg':'./studio/hud-kit/drone.svg';
   if(icon.getAttribute?.('src')!==sprite)icon.src=sprite;
   slot.title=unit?(ESCORTS[unit.role]?.name||'Ведомый')+' · '+Math.ceil(unit.hp)+' / '+Math.ceil(unit.maxHp)+' ОЗ':
    i>=capacity?'Место откроется после подключения ещё одной станции':'Свободное место';
   display(n.droneNames[i],unit?DRONE_CODES[unit.role]||'?':'—');
   icon.style.filter=unit?'drop-shadow(0 0 4px '+(ESCORTS[unit.role]?.color||'#68eeeb')+')':'';
   const meter=n.droneMeters[i];
   meter.style.setProperty('--hp',(fraction*100)+'%');
   meter.setAttribute('aria-label',unit?(ESCORTS[unit.role]?.name||'Дрон')+' · прочность':
    'Место '+(i+1)+(i>=capacity?' закрыто':' свободно'));
   meter.setAttribute('aria-valuenow',String(unit?Math.ceil(unit.hp):0));
   meter.setAttribute('aria-valuemax',String(unit?Math.ceil(unit.maxHp):100));
  }
  display(n.wingStatus,(critical.length?'⚠ ':'')+liveAllies+'/'+capacity);
  n.wingStatus.classList.toggle('has-critical',critical.length>0);
  display(n.wingAlert,critical.length?'Критическая прочность: '+critical.map(a=>ESCORTS[a.role]?.name).join(', '):
   damaged.length?'Повреждены дроны: '+damaged.length:'Все ведомые исправны');
  const relic=game.convoyRelic?.active,seconds=relic?Math.max(0,Math.ceil(relic.until-game.time)):0;
  n.hudTrophy.hidden=!relic||!seconds;
  if(relic&&seconds){
   display(n.hudTrophyName,({storm:'ПЛАЗМА',salvo:'КАСКАД',arc:'ИОННАЯ ГРОЗА'})[relic.id]||'ТРОФЕЙ');
   display(n.hudTrophyTime,seconds+' с');
   const sprite='./studio/hud-kit/'+({storm:'relic-storm.svg',salvo:'relic-salvo.svg',arc:'relic-arc.svg'})[relic.id];
   if(n.hudTrophyIcon.getAttribute('src')!==sprite)n.hudTrophyIcon.src=sprite;
   n.hudTrophy.classList.toggle('ending',seconds<=15);
   n.hudTrophy.title='Трофейный автоматический модуль · '+seconds+' секунд';
  }
  n.wingStatus.setAttribute('aria-label',bombers?'Авиагруппа выполняет удар; '+liveAllies+' дронов в строю':
   cover?'Прикрывают корабль: '+cover+'; '+liveAllies+' дронов в строю':
   liveAllies+' из '+capacity+' доступных дронов в строю');
  const focus=game.actionHeld||game.interactionFocus;
  n.interactionCue.hidden=!focus||game.paused||game.dead||!game.overlay.hidden||
   !!game.contourTrial&&!['station','repair','opening-repair','vortex'].includes(focus?.kind);
  if(!n.interactionCue.hidden) {
   const label=focus.kind==='station'?'Открыть станцию':
    focus.kind==='vortex'?'Заряд ядра · '+Math.floor(focus.target?.charge||0)+' / 18 с · удерживать (прогресс сохранится)':
    focus.kind==='turret-repair'?'Восстановить турель · удерживать':
    focus.kind==='repair'?'Ремонт зонда':
    focus.kind==='opening-repair'?'Эвакуация капсулы':'Добыча породы';
   display(n.interactionCue,(game.controlLabel?.('interact')||'E')+' · '+label+
    (['station','vortex','turret-repair'].includes(focus.kind)?'':' · удерживать'));
  }
  if(n.territoryStatus){
   const support=game.territorySupport;
   n.territoryStatus.hidden=!support?.inside||game.dead||game.paused;
   if(!n.territoryStatus.hidden)display(n.territoryStatus,'СВОЯ ТЕРРИТОРИЯ · ЩИТ +18'+(support.dashRate>1?' · РЫВОК ×1,3':'')+(support.magnetBonus?' · СБОР +60 м':''));
  }
  const op=game.operation,c=game.contract,tracker=n.contractObjective;
  const opening=openingArcObjective(game.openingArc,game.time,this.compactHud);
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
  if(n.missionHome){
   const text=missionHomeText(game);
   n.missionHome.hidden=!text||game.dead;
   if(text)display(n.missionHome,text);
  }
  if(n.meteorAlert){
   const meteor=game.meteorFront?.active;
   n.meteorAlert.hidden=!meteor||game.dead;
   if(meteor){
    const warning=Math.max(0,Math.ceil(12-(game.time-meteor.at)));
    n.meteorAlert.classList.toggle('passing',warning===0);
    display(n.meteorAlert,warning?'⚠ МЕТЕОРИТНЫЙ ФРОНТ · до ударов '+warning+' с · маршрут на карте':
     '☄ МЕТЕОРИТНЫЙ ФРОНТ · опасный коридор · уклоняйтесь или используйте ПВО станции');
   }
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
  if(game.time-this.oreGainTime>2.4){
   n.oreResource.classList.remove('is-gaining');this.oreGained=0;
  }
  if(game.time-this.dataGainTime>2.4){
   n.dataResource.classList.remove('is-gaining');this.dataGained=0;
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
  n.hudStrikeSlot.setAttribute('aria-label',hasStrike?'Авиаудар или прикрытие внутри собственного контура: '+strikes:'Авиаудар недоступен');
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
  const doctrineCount=Object.keys(normalizedDoctrineRanks(game)).length;
  const assaultWindow=doctrineRank(game,'assault')>=2&&game.assaultBurstUntil>game.time;
  const prospectCharge=doctrineRank(game,'prospect')>=3&&game.prospectChargeUntil>game.time?
   Math.max(0,game.prospectCharges||0):0;
  const quietProspect=doctrineRank(game,'prospect')>=1;
  const counterguard=doctrineRank(game,'countermaneuver')>=2&&game.counterguardUntil>game.time;
  const systemStatus=condition==='critical'?'АВАРИЙНЫЙ РЕЖИМ':
   repairing?'ВОССТАНОВЛЕНИЕ ЗОНДА':extracting?'ДОБЫЧА ПОРОДЫ':boosting?'УСКОРЕНИЕ АКТИВНО':
   baseFocus?'ПРИОРИТЕТНАЯ ЦЕЛЬ':overcharge?'УСИЛЕНИЕ ЛУЧА · '+overcharge+' С':
   scan?'ГЕОРАЗВЕДКА · '+scan+' С':counterguard?'КОНТРМАНЁВР · ЗАЩИТА':
   assaultWindow?'ШТУРМОВОЙ РЫВОК · ЗАЩИТА':
   prospectCharge?'ГЕОЗАРЯД · '+prospectCharge+'/6 ПОПАДАНИЙ':p.shield>0?'ЩИТ АКТИВЕН':
   condition==='wounded'?'КОРПУС ПОВРЕЖДЁН':
    doctrineRank(game,'prospect')>=3&&game.prospectSurgeUntil>game.time?'ГЕОФОРСАЖ':
    doctrineCount?('ДОКТРИНЫ · '+doctrineCount+'/4'):
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
   extracting?(game.nearQuietLab?'ДОБЫЧА · ШУМ −32%':
    quietProspect||(game.skillRanks?.mining||0)>=1?'ДОБЫЧА · СНИЖЕН ШУМ':'ОРУЖИЕ ОТКЛ. · ДОБЫЧА'):
   boosting?'МАНЁВР · ФОРСАЖ':baseFocus?'АВТОЦЕЛЬ · БАЗА':
   overcharge?'ЛУЧ +20% · '+overcharge+' С':
   prospectCharge?'ГЕОЗАРЯД · ПЛАЗМА +45% · '+prospectCharge+'/6 ПОПАДАНИЙ':
   counterguard?'КОНТРМАНЁВР · ЗАЩИТА +'+(doctrineRank(game,'countermaneuver')>=3?30:15)+'%':
   assaultWindow?'ШТУРМОВОЙ РЫВОК · ЗАЩИТА +25%':
   game.nearArsenalBonus?'РЕТРАНСЛЯТОР · ЛУЧ +18%':
   game.nearDockField||game.nearArsenalDefense?'ПОЛЕ СТАНЦИИ · УРОН −18%':
   game.nearDock?.module==='workshop'?'ДОК · РЕМОНТ +60%':
   game.nearQuietLab?'ЛАБОРАТОРИЯ · ШУМ −32%':'АВТООГОНЬ · АКТИВЕН';
  // Phone instrument uses short, readable states; full context stays available
  // as the accessible label. Desktop retains its detailed telemetry.
  const modeCompact=game.holdFire?'ТИХИЙ РЕЖИМ':
   repairing?'РЕМОНТ':extracting?(game.nearQuietLab||quietProspect?'ДОБЫЧА · ТИХО':'ДОБЫЧА'):
   boosting?'ФОРСАЖ':baseFocus?'БАЗА · ЦЕЛЬ':
   overcharge?'ЛУЧ +20%':prospectCharge?'ГЕОЗАРЯД · '+prospectCharge+'/6':
   counterguard?'ЗАЩИТА +'+(doctrineRank(game,'countermaneuver')>=3?30:15)+'%':
   assaultWindow?'ЗАЩИТА +25%':game.nearArsenalBonus?'ЛУЧ +18%':
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
  this.renderWeaponDeck(game);
  n.message.style.opacity=game.messageUntil>game.time?'1':'0';
  // HUD remains stationary: no cockpit sway when the player steers.
  const interval=game.fps<35?.34:.2;
  if(game.time-this.lastRadar>=interval||game.time<this.lastRadar) {
   this.lastRadar=game.time;
   this.drawRadar(game);
  }
 }
 renderWeaponDeck(game){
  // Headless combat tests use a minimal DOM; constructing elements is only
  // needed by the real browser. No weapons are simulated from this view.
  if(!this.n.weaponDeckAuto||typeof document.createElement!=='function')return;
  const state=weaponDeckState(game),n=this.n;
  display(n.weaponDeckCount,mountCountLabel(state.installedCount));
  const quick=(item,base)=>{
   display(n[base+'Key'],item.key);
   display(n[base+'Name'],item.name);
   display(n[base+'Status'],item.status);
   n[base+'Quick'].dataset.state=item.state;
  };
  quick(state.quick.tactical,'weaponDeckSpace');
  n.weaponDeckFieldQuick.hidden=!state.quick.field;
  if(state.quick.field)quick(state.quick.field,'weaponDeckField');
  const toggle=el('weaponDeckToggle');
  const toggleText='Оружие: '+[state.quick.tactical,state.quick.field].filter(Boolean)
   .map(item=>item.key+' '+item.name+' '+(item.seconds>.05?
    Math.ceil(item.seconds)+' секунд до готовности':item.status)).join('; ')+'. Подробности';
  if(toggle&&toggle.getAttribute?.('aria-label')!==toggleText)toggle.setAttribute('aria-label',toggleText);
  const ordered=[...state.rows].sort((a,b)=>{
   const priority={tactical:0,field:1,manual:2,howitzer:3};
   return (priority[a.id]??10)-(priority[b.id]??10);
  });
  const signature=ordered.map(item=>item.id+':'+item.name+':'+item.icon+':'+item.key).join('|');
  if(signature!==this.weaponDeckSignature){
   this.weaponDeckSignature=signature;this.weaponDeckRows.clear();
   const auto=document.createDocumentFragment(),direct=document.createDocumentFragment();
   for(const item of ordered){
    const element=document.createElement('div');element.className='weapon-deck-row';
    element.dataset.slot=item.id;
    element.style.setProperty('--weapon-color',item.color);
    const header=document.createElement('div');header.className='weapon-deck-row-head';
    const icon=document.createElement('img');icon.className='weapon-deck-icon';
    icon.src=weaponIcon(item.icon);icon.alt='';icon.setAttribute('aria-hidden','true');
    header.append(icon);
    if(item.key){const key=document.createElement('kbd');key.className='weapon-deck-key';
     key.textContent=item.key;header.append(key);}
    const name=document.createElement('strong');name.className='weapon-deck-name';
    const status=document.createElement('span');status.className='weapon-deck-status';
    header.append(name,status);
    const detail=document.createElement('small');detail.className='weapon-deck-detail';
    const charge=document.createElement('span');charge.className='weapon-deck-charge';
    charge.setAttribute('aria-hidden','true');
    element.append(header,detail,charge);
    this.weaponDeckRows.set(item.id,{element,name,status,detail});
    (item.kind==='auto'?auto:direct).append(element);
   }
   n.weaponDeckAuto.replaceChildren(auto);n.weaponDeckDirect.replaceChildren(direct);
  }
  for(const item of state.rows){
   const entry=this.weaponDeckRows.get(item.id);if(!entry)continue;
   display(entry.name,item.name);display(entry.status,item.status);
   display(entry.detail,item.detail);
   if(entry.state!==item.state){entry.element.dataset.state=item.state;entry.state=item.state;}
   entry.element.style.setProperty('--charge-fill',item.chargePercent+'%');
   const spoken=(item.key?item.key+'; ':'')+item.name+'; '+item.detail+'; '+item.status;
   if(entry.spoken!==spoken){entry.element.setAttribute('aria-label',spoken);entry.spoken=spoken;}
  }
 }
 trackWallet(player,time){
  const current={ore:player.ore,data:player.data,xp:player.xp,level:player.level,time};
  const before=this.lastWallet;
  this.lastWallet=current;
  // Starting a run, restoring a checkpoint or rewinding the simulation must
  // never be presented as newly earned loot.
  if(!before||time<before.time||current.level<before.level||
    ![current.ore,current.data,current.xp,current.level].every(Number.isFinite)){
   this.rewardBurst=null;this.n.rewardFeed.hidden=true;return;
  }
  const ore=current.ore-before.ore,data=current.data-before.data;
  const xp=experienceDifference(before,current);
  const changed=ore!==0||data!==0||(xp!==null&&xp>0)||current.level!==before.level;
  if(changed){
   if(ore>0&&this.oreGainTime!==time)this.resourceGain(ore,time);
   if(data>0)this.dataResourceGain(data,time);
   const continuing=this.rewardBurst&&time-this.lastRewardTime<=.7;
   this.rewardBurst={start:continuing?this.rewardBurst.start:before,end:current};
   this.lastRewardTime=time;
   this.renderRewardBurst();
  }
  if(this.rewardBurst&&time-this.lastRewardTime>2.8){
   this.rewardBurst=null;this.n.rewardFeed.hidden=true;
  }
 }
 renderRewardBurst(){
  const n=this.n,{start,end}=this.rewardBurst;
  const show=(node,label,previous,current)=>{
   const delta=current-previous;
   node.hidden=delta===0;
   if(!node.hidden){
    display(node,label+' '+count(previous)+' → '+count(current)+
     ' ('+(delta>0?'+':'−')+count(Math.abs(delta))+')');
    node.classList.toggle('spent',delta<0);
   }
  };
  show(n.rewardOre,'СПЛАВ',start.ore,end.ore);
  show(n.rewardData,'ДАННЫЕ',start.data,end.data);
  const earned=experienceDifference(start,end);
  n.rewardXp.hidden=earned===null||earned<=0;
  if(!n.rewardXp.hidden)display(n.rewardXp,start.level===end.level?
   'ОПЫТ '+count(start.xp)+' → '+count(end.xp)+' (+'+count(earned)+')':
   'ОПЫТ +'+count(earned));
  n.rewardLevel.hidden=end.level<=start.level;
  if(!n.rewardLevel.hidden)display(n.rewardLevel,'УРОВЕНЬ '+end.level+'!');
  n.rewardFeed.hidden=[n.rewardOre,n.rewardData,n.rewardXp,n.rewardLevel]
   .every(node=>node.hidden);
 }
 dataResourceGain(amount,time){
  if(time-this.dataGainTime>.7)this.dataGained=0;
  this.dataGained+=amount;this.dataGainTime=time;
  display(this.n.dataGain,'+'+count(this.dataGained));
  this.n.dataResource.classList.remove('is-gaining');
  void this.n.dataResource.offsetWidth;
  this.n.dataResource.classList.add('is-gaining');
 }
 resourceGain(amount,time) {
  if(time-this.oreGainTime>.7)this.oreGained=0;
  this.oreGained+=amount;this.oreGainTime=time;
  display(this.n.oreGain,'+'+this.oreGained);
  this.n.oreResource.classList.remove('is-gaining');
  void this.n.oreResource.offsetWidth;
  this.n.oreResource.classList.add('is-gaining');
 }
 impact(relativeDamage,shieldDominant=false) {
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
  if(shieldDominant)this.root.classList.add('is-hit-shield');
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
  const ctx=this.ctx,p=game.player,range=HUD_RADAR_RANGE;
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
  // This reading intentionally excludes the active dock. Make that
  // distinction explicit so a dock beside the pilot is not shown as far away.
  const inactiveStationNearby=Number.isFinite(nearest);
  display(this.n.radarDistance,inactiveStationNearby?
   'НЕАКТ. СТАНЦИЯ · '+Math.round(nearest)+' М':'БЛИЖНИЙ СЕКТОР');
  this.n.radarDistance.title=inactiveStationNearby?
   'До ближайшей неактивной станции в радиусе радара':
   'Нет неактивных станций в радиусе радара';
 }
}
