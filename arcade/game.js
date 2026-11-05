import {updateRegionalStorms,drawRegionalStorms,drawStormCharge,stormWeaponDamage} from './regional-storms.js?v=regions-1';
import {updateRegionalWorld,drawRegionalWorld,hitRegionalCargo,spawnRegionalRaid,spawnCentralRaid,spawnFrontierRaid} from './region-runtime.js?v=living-world-4-logistics-audit-1-lab-logistics-1-enemy-gunnery-1-opening-arc-1-lab-logistics-qa-1-enemy-objectives-1';
import {REGIONS,regionAt} from './regions.js?v=regions-audit-1';
import {EXPEDITION_CRUISE,updateCruise} from './expedition-cruise.js?v=expedition-1';
import {strategicCapture} from './regional-supply.js?v=living-world-3';
import {disableCentralWorker} from './central-industry.js?v=living-world-1';
import {damageFrontierAsset} from './frontier-industry.js?v=living-world-3-logistics-audit-1';
import {RULES, clamp, dist, length, hash, expForNext, spawnOutside, outsideCamera, SpatialGrid, baseNames, baseColor, openingThreat, burstStats} from './balance.js?v=arcade-balanced-bases-30';
import {World} from './world.js?v=living-world-3';
import {updateStationDefense,drawStationDefense,defenseLinked,ensureStationDefense,
 synchronizeStationDefenses} from './network-defense.js?v=network-defense-4';
import {firstRockImpact,nearAmberBelt} from './terrain.js?v=arcade-belt-26';
import {contactOnCircle,contactAtPoint} from './impact-geometry.js?v=arcade-impact-51';
import {ENEMY_TYPES, updateEnemy, updateAlly} from './ai.js?v=enemy-learning-1-enemy-comms-1-regions-1-enemy-world-response-1-network-defense-4-enemy-audit-5-enemy-gunnery-1-opening-arc-1-enemy-plans-1';
import {drawEnemyGunWarnings,drawEnemyDefenseGoals} from './enemy-gunnery.js?v=enemy-gunnery-1-opening-arc-1';
import {EnemyLearning,learnedTurretAim} from './enemy-learning.js?v=enemy-learning-1-enemy-audit-2';
import {EnemyComms,ENEMY_COMMS,incomingFireEstimate,estimatedWeaponRange} from './enemy-comms.js?v=enemy-comms-1-enemy-world-response-1-enemy-audit-5-enemy-gunnery-1-enemy-plans-1';
import {drawEnemyIntentions} from './enemy-intentions.js?v=enemy-intents-2-enemy-world-response-2';
import {enemySalvage,enemyDataReward} from './combat-rewards.js?v=economy-balance-1-regions-1-enemy-audit-3-enemy-gunnery-1-opening-arc-1-enemy-objectives-1';
import {createSignalIntel,alertSignalIntel,alertSignalThreat} from './signal-perception.js?v=arcade-perception-61-enemy-world-response-2';
import {planEncounter} from './encounters.js?v=arcade-balanced-bases-30';
import {ArcadeVisuals} from './visuals.js?v=regions-1';
import {ReactorLandmark} from './reactor-landmark.js?v=reactor-fog-motion-v8';
import {recordCapitalHit} from './capital-hit-wear.js?v=arcade-capital-hit-63';
import {markDockEvent} from './repair-dock-art.js?v=dock-identity-1';
import {CockpitDisplay} from './hud.js?v=weapons-cycle-2-opening-arc-1-opening-balance-1';
import {chooseInteraction,activeInteraction,automaticFireAllowed} from './controls.js?v=arcade-controls-63';
import {MINING_NOISE,extractionNoiseDelta,extractorStats,rockYield,miningTarget,impactRock,updateRockMotion,drawRockScars,drawExtraction} from './mining.js?v=checkpoint-1';
import {ArcadeHeritage} from './heritage.js?v=foley-autofire-03-carrier-2-weapon-feel-1';
import {drawOrbitalWarning,drawOrbitalAfterglow,drawEnergyFlash,drawSeekingMissile,drawHullDamage} from './combat-feedback.js?v=arcade-vfx-viewport-44';
import {emitWeaponFx,updateWeaponFx,drawWeaponFx} from './weapon-fx.js';
import {ION_FIELD,ionPhase,inIonField,ionApproach,drawIonField} from './ion-field.js?v=regions-1';
import {renderBasePanel,baseOffer,transitCost,eligibleContractProgress,stationModule} from './base-panel.js?v=first-contract-reward-1-regions-1-network-defense-4-station-flow-1-defense-rules-1-frontier-3-station-layout-2-station-audit-2-rpg-precision-1-logistics-audit-1-lab-logistics-qa-1';
import {CORRIDOR_OPERATION,isCorridorDock,createCorridorOperation,corridorPosition,PROBE_OPERATION,isProbeLab,createProbeOperation,chooseOperationLead} from './operations.js?v=weapons-cycle-2';
import {renderWorldMap} from './map-panel.js?v=menu-exit-1-enemy-intents-2-regions-1-enemy-world-response-2-network-defense-4-living-world-3-frontier-3-rpg-precision-1-logistics-audit-1-rpg-audit-1-lab-logistics-qa-1';
import {contractReturnStation,contractDefenseZone,corridorCue,automaticRange} from './mission-feedback.js?v=weapons-cycle-2';
import {RELAY_DEFENSE,isRelayArsenal,createRelayDefense,relayDefenseCue} from './relay-defense.js?v=relay-def-1';
import {CARRIER_INTERCEPTION,isCarrierBase,createCarrierInterception,carrierInFlight,carrierDistanceRemaining,moveCarrierCargo,carrierPatrolModifier,carrierRoute,advanceCarrierSystems,hitCarrierCargo,carrierPulseState,carrierTacticalCue} from './carrier-interception.js?v=carrier-intercept-2';
import {ION_CONDUCTOR,markIonCluster,planIonDischarge,ionMasteryAward,drawIonMark} from './ion-conductor.js?v=weapons-cycle-2';

import {createLoadout,loadoutProfile,stageOwnedModule,HangarSession,SHIP_UPGRADES,createThermal,coolWeapons,moduleStats,MODULES,matchingFieldLoan} from './ship-loadout.js?v=first-contract-reward-1-rpg-precision-1';
import {claimFirstContractModule} from './first-contract-reward.js?v=first-contract-reward-1';
import {captureHangarView,restoreHangarView} from './hangar-view.js?v=hangar-2';
import {keepTabInMenu,focusMenu,captureMenuControl,restoreMenuControl,setMenuBackgroundInert} from './menu-dialog.js?v=menu-exit-1';
import {updateAutomaticWeapons,fireAimedRail,planHowitzer,updateHowitzer,drawHowitzerAim} from './ship-weapons.js?v=rpg-precision-1-rpg-audit-1-weapon-feel-1-opening-arc-1';
import {precisionRailUnlocked,PRECISION_RAIL_TECH,labLogisticsUnlocked,labLogisticsIntel,LAB_LOGISTICS_TECH} from './station-progression.js?v=lab-logistics-qa-1';
import {combatTargets,targetAlive,targetRadius,clearLine,damageTarget} from './combat-targets.js?v=living-world-2';
import {pickDesignatedTarget,activeDesignatedTarget,designationLabel,TARGET_DESIGNATION} from './target-designation.js?v=living-world-3';
import {FIELD_WEAPONS,fieldWeapon,createFieldLoan,fieldLoanOffer,refillQuote,missionAssignment,bindFieldLoan,finishFieldAssignment,planResonance,resonanceDamage,updateFieldEffects,drawFieldEffects} from './field-weapons.js?v=living-world-2-weapon-feel-1';
import {RunCheckpointStore,captureCheckpoint,restoreCheckpoint} from './run-checkpoint.js?v=first-contract-reward-1-radio-checkpoint-1-regions-1-network-defense-3-living-world-1-living-world-3-opening-arc-1-opening-balance-1';
import {startSortie,finishSortie,appendSortieReport} from './sortie-economy.js?v=economy-integrity-1-econ-audit-2';
import {recordSortieIncome,recordSortieDamage,recordSortieRepair,recordSortieDroneLoss,
 creditContractReward,recordEconomyExpense,emptyEconomyExpenses} from './sortie-ledger.js?v=economy-ledger-1';
import {OPENING_ARC,createOpeningArc,beginOpeningArc,advanceOpeningArc,
 openingArcActive,openingArcPressure,openingArcObjective,runClock} from './opening-arc.js?v=opening-arc-2';

const $=id=>document.getElementById(id);
const TAU=Math.PI*2;
const SKILLS=[
 {id:'beam',branch:'Оружие',title:'Калибровка орудий',max:5,from:2,desc:'Каждый ранг усиливает урон автоматических орудий и ионной цепи на 20%, темп автоогня на 8% от базового'},
 {id:'double',branch:'Оружие',title:'Разделение луча',max:2,from:4,requires:'beam',desc:'Делит плазменный залп между двумя или тремя ближайшими целями. По одиночной цели сохраняет всю мощность'},
 {id:'range',branch:'Оружие',title:'Фокусировка',max:3,from:3,desc:'Увеличивает рабочую дальность, не убирая спад силы'},
 {id:'rocket',branch:'Оружие',title:'Авторакеты',max:3,from:5,desc:'Редкий сильный залп с полной дальнобойной силой'},
 {id:'hull',branch:'Корабль',title:'Укрепление корпуса',max:5,from:2,desc:'+22 к прочности и частичный ремонт'},
 {id:'engine',branch:'Корабль',title:'Импульсный форсаж',max:4,from:2,desc:'Ускоряет корабль и улучшает короткий рывок на Shift'},
 {id:'shield',branch:'Корабль',title:'Энергощит',max:3,from:4,requires:'hull',desc:'Часть урона поглощает восстанавливаемый щит'},
 {id:'dodge',branch:'Корабль',title:'Уклонение',max:3,from:3,desc:'Короткий ускоренный рывок после попадания'},
 {id:'magnet',branch:'Добыча',title:'Магнитный захват',max:3,from:2,desc:'Притягивает сплав и данные с большей дистанции'},
 {id:'mining',branch:'Добыча',title:'Геологическая подготовка',max:4,from:2,desc:'Усиливает экстрактор; первый ранг уменьшает шум добычи на 16%, каждый второй добавляет сплав'},
 {id:'extractor',branch:'Добыча',title:'Дуговой экстрактор',max:3,from:3,requires:'mining',desc:'Экстрактор быстрее расщепляет астероиды и отделяет больше сплава'},
 {id:'radar',branch:'Технологии',title:'Навигационный радар',max:2,from:3,desc:'Раньше отмечает нейтральные базы'},
 {id:'tactics',branch:'Технологии',title:'Боевой протокол',max:3,from:5,desc:'Союзники быстрее выбирают опасные цели'}
];

const DOCTRINES=[
 {id:'assault',title:'Штурмовик',desc:'Плазменный луч наносит на 22% больше урона в пределах 180 м. Подходите ближе к опасным целям.'},
 {id:'command',title:'Командир',desc:'Ведомые рядом с вами наносят на 25% больше урона. Сильнее всего с развитой эскадрой.'},
 {id:'prospect',title:'Старатель',desc:'Экстрактор на 15% мощнее и приносит ещё 1 сплав за астероид.'}
];
const fmt=n=>Number(n.toFixed(2)).toString().replace('.',',');
const pointsWord=n=>n%100>=11&&n%100<=14?'очков':n%10===1?'очко':
 n%10>=2&&n%10<=4?'очка':'очков';
function nextSkillEffect(id,rank,levels={}){
 const n=rank+1;
 switch(id){
  case 'beam':return 'Автооружие: урон ×'+fmt(1+rank*.2)+' → ×'+fmt(1+n*.2)+
    ' · темп ×'+fmt(1+rank*.08)+' → ×'+fmt(1+n*.08)+' · тот же прирост урона ионной цепи';
  case 'double':return n===1?'Две цели получают по 60% залпа; одиночная — 100%':
    'Три цели получают по 45% залпа; две — по 60%; одиночная — 100%';
  case 'range':return 'Дальность луча: '+(435+rank*56)+' → '+(435+n*56);
  case 'rocket':{
   const before=moduleStats('rocket',levels),after=moduleStats('rocket',{...levels,rocket:n});
   return rank===0?'Даст ракетный модуль: '+fmt(after.damage)+' урона каждые '+fmt(after.interval)+
    ' с. Установите его в узел и примените сборку.':'Урон ракеты: '+fmt(before.damage)+' → '+fmt(after.damage)+
    ' · интервал '+fmt(before.interval)+' → '+fmt(after.interval)+' с';
  }
  case 'hull':return 'Прочность корпуса: ещё +22 · сразу частичный ремонт';
  case 'engine':return 'Скорость: '+(272+rank*35)+' → '+(272+n*35)+
    ' · перезарядка рывка: '+fmt(burstStats(rank).cooldown)+' → '+fmt(burstStats(n).cooldown)+' с';
  case 'shield':return rank===0?'Откроет щит: до 40 ед. · восстановление после 3 с без урона':
    'Запас щита: '+(16+rank*24)+' → '+(16+n*24)+' · быстрее восстановление вне боя';
  case 'dodge':return 'Аварийный отход: '+(rank*120)+' → '+(n*120)+
    ' · неуязвимость после удара: '+fmt(.55+rank*.12)+' → '+fmt(.55+n*.12)+' с';
  case 'magnet':return 'Притяжение трофеев: '+(105+rank*55)+' → '+(105+n*55);
  case 'mining':return 'Мощность экстрактора: '+extractorStats(levels.extractor||0,rank).damagePerSecond+' → '+
    extractorStats(levels.extractor||0,n).damagePerSecond+' урона/с'+
    (n%2===0?' · +1 сплав за астероид':'')+
    (n===1?' · шум добычи −16%':'');
  case 'extractor':return 'Разряд: '+extractorStats(rank,levels.mining||0).damagePerSecond+
    ' → '+extractorStats(n,levels.mining||0).damagePerSecond+' урона/с'+
    (n===1||n===3?' · +1 сплав за астероид':'');
  case 'radar':return 'Радиус обнаружения баз: '+(570+rank*190)+' → '+(570+n*190);
  case 'tactics':return 'Решения ведомых: чаще на '+(Math.round(n*.2*100))+
    '% относительно базового темпа';
  default:return '';
 }
}
const MODELS={
 scout:'../assets/space/enemy_drone.png',
 fighter:'../assets/space/enemy_fighter.png',
 flanker:'../assets/space/enemy_interceptor.png',
 healer:'../assets/space/enemy_shield.png',
 berserker:'../assets/space/enemy_bomber.png',
 gunship:'../assets/space/enemy_caster.png',
 allyfighter:'../assets/space/ship_fighter.png',
 allyscout:'../assets/space/ship_scout.png',
 allybomber:'../assets/space/ship_mage.png',
 rock:'../assets/space/asteroid-ore.webp',
 rock2:'../assets/space/asteroid-realistic.webp'
};
const sprite=(url,table,key)=>{
 const img=new Image();img.decoding='async';img.src=url;table[key]=img;return img;
};
export class ArcadeGame {
 constructor(){
  this.canvas=$('game');this.ctx=this.canvas.getContext('2d',{alpha:true});
  this.overlay=$('overlay');this.message=$('message');this.keys=new Set();
  this.touch={x:0,y:0};this.seed=20261102;
  this.world=new World(this.seed);this.visuals=new ArcadeVisuals();
  this.reactor=new ReactorLandmark();
  // Capital hull impact painting is explicitly opt-in for visual QA.
  this.visuals.capitalDamageQA=typeof location!=='undefined'&&
   new URLSearchParams(location.search).get('capitalDamageQa')==='1';
  this.cockpit=new CockpitDisplay();
  this.heritage=new ArcadeHeritage();this.grid=new SpatialGrid(110);
  this.lastIonAudioCycle=-1;
  this.shotGrid=new SpatialGrid(95);
  this.rockGrid=new SpatialGrid(140);
  this.player={x:0,y:0,vx:0,vy:0,r:19,hp:110,maxHp:110,shield:0,
    xp:0,level:1,points:0,ore:0,data:0,invul:0,angle:0,
     burstRemaining:0,burstCooldown:0,burstX:0,burstY:-1};
  this.skillRanks=Object.fromEntries(SKILLS.map(s=>[s.id,0]));
  this.shipLoadout=createLoadout();
  this.firstHardwareReward=null;
  let hangarStorage=null;try{hangarStorage=window.localStorage;}catch{}
  this.recordStorage=hangarStorage;
  let priorBest=0;try{priorBest=Number(hangarStorage?.getItem('survivor.best-flight.v1')||0);}catch{}
  this.bestFlight=Number.isFinite(priorBest)&&priorBest>=0?priorBest:0;
  this.hangarSession=new HangarSession(hangarStorage);
  this.enemyLearning=this.visuals.capitalDamageQA?null:new EnemyLearning(hangarStorage);
  this.enemyComms=new EnemyComms();
  this.designatedTarget=null;
  this.lastTargetHintAt=-Infinity;
  this.cruiseCharge=0;this.cruising=false;
  window.addEventListener?.('pagehide',()=>this.enemyLearning?.flush(this.time));
  this.manualRailMode=false;this.precisionRailAvailable=false;
  this.weaponThermal=createThermal();this.moduleClocks={rail:0,flak:0};
  this.heavyCharge=null;this.heavyCooldown=0;this.syncShipLoadout();
  this.doctrine=null;this.lastDamageAt=-Infinity;
  this.network={armor:0,armament:0,engine:0,strikePower:0};
  this.enemies=[];this.allies=[];this.drops=[];this.shots=[];this.missiles=[];this.flashes=[];this.weaponFx=[];
   this.support={charges:0,cooldown:0,missions:[]};
  this.zones=[];this.images={};this.time=0;this.spawnClock=9;this.miningNoise=0;
  this.lastNoiseSource=null;this.noiseAlert=null;
  this.miningNoiseWarned=false;this.miningIntroShown=false;this.coverWearWarned=false;
  this.contract=null;this.operation=null;this.probeRepairing=false;this.baseTab='summary';this.mapReturnToBase=false;
  this.openingArc=createOpeningArc(this.world.home);this.openingRepairing=false;
  this.sortieStart=null;this.sortieReports=[];this.stationExitArmed=false;
  this.lastContractReceipt=null;
  this.economyExpenses=emptyEconomyExpenses();
   this.geoScanUntil=0;this.overchargeUntil=0;
   this.fieldLoan=null;this.fieldTrialTaken=false;this.fieldReturnAt=-Infinity;this.fieldEffects=[];
   this.ionMasteryAwarded=false;
  this.mining={active:false,target:null,fxClock:0};
  this.actionHeld=null;this.interactionFocus=null;this.holdFire=false;this.localStations=[];
  this.beamClock=.25;this.rocketClock=4;this.zoneClock=80;
  this.stationary=0;this.lastX=0;this.lastY=0;this.hacks=[];this.activeBases=0;
  this.enemySerial=0;this.allySerial=0;this.groupSerial=0;this.heavyPortalShown=false;
  this.lastEncounter='';this.lastEncounterLabelAt=-30;this.paused=false;
  this.pausedRenderPending=false;
  this.dead=false;this.deathSceneEnd=0;this.deathVfxAt=0;this.fps=60;this.frameSamples=[];this.lastHud=0;
  this.nearRocks=[];this.worldQueryClock=0;this.worldQueryX=0;this.worldQueryY=0;
  this.amberBeltSeen=false;this.ionFieldSeen=false;
   this.renderScale=1;this.qualityTimer=0;
  this.messageUntil=0;this.vw=1200;this.vh=800;
  this.worldVisualLast=-Infinity;this.cachedWorldLinks=[];
  this.cachedNetworkLinked=new Set();this.cachedTarget=null;
  this.nextDefenseCheckAt=0;this.lastDefenseNoticeAt=-Infinity;
  this.defenseTopology=null;this.defenseTopologyAt=0;
   this.waypoint={id:this.world.home.id,x:this.world.home.x,y:this.world.home.y,label:'Домашний док'};
   this.nearArsenalBonus=false;this.nearArsenalDefense=false;this.nearDockField=false;this.nearQuietLab=false;
  for(const [k,url] of Object.entries(MODELS))sprite(url,this.images,k);
  // One ordinary heavy AI ship is exposed only for capital hull visual QA.
  if(this.visuals.capitalDamageQA){
   const kind=new URLSearchParams(location.search).get('capitalShip')||'cruiser';
   const serial=({cruiser:6,carrier:4,dreadnought:2})[kind]||6;
   const def=ENEMY_TYPES.gunship;
   this.enemySerial=serial;
   this.enemies.push({serial,group:++this.groupSerial,type:'gunship',
    x:this.player.x+185,y:this.player.y-92,vx:0,vy:0,r:22,
    hp:def.hp,maxHp:def.hp,damage:def.dmg,think:0,fire:1.1,
    state:'hunt',commitUntil:0,target:this.player,angle:0,hit:0,
    expAwarded:false,scenario:'capital-visual-qa',protect:null,
    entryPortalPending:false});
  }
  this.bind();this.resize();this.world.discover(0,0);
  this.notice(matchMedia('(pointer: coarse)').matches?
   'Подлетите к доку и нажмите «Действие».':
   'WASD — полёт · E — домашний док · В доке можно выбрать пробное оружие · Shift — рывок.',9);
  this.runStore=this.visuals.capitalDamageQA?null:new RunCheckpointStore(hangarStorage);
  const saved=this.runStore?.load();
  if(saved||['damaged','unsupported'].includes(this.runStore?.issue))this.offerContinuation(saved);
  else this.runStore?.startNew();
  this.last=performance.now();this.loop=this.loop.bind(this);
  requestAnimationFrame(this.loop);
 }
 resize(){
  const w=window.innerWidth,h=window.innerHeight;
  const mobile=matchMedia('(pointer: coarse)').matches;
  this.isTouchLayout=mobile;
  this.vw=mobile&&w<h?620:1200;
  this.vh=this.vw*h/Math.max(1,w);
  const scale=Math.min(window.devicePixelRatio||1,1.45)*this.renderScale;
  this.canvas.width=Math.max(1,Math.round(w*scale));
  this.canvas.height=Math.max(1,Math.round(h*scale));
  this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';
  this.ctx.setTransform(this.canvas.width/this.vw,0,0,this.canvas.height/this.vh,0,0);
 }
 camera(){return {x:this.player.x-this.vw/2,y:this.player.y-this.vh/2,w:this.vw,h:this.vh};}
 bind(){
  window.addEventListener('resize',()=>this.resize());
  document.addEventListener('keydown',e=>{
   const launchOpen=document.getElementById?.('mobileLaunch')?.hidden===false;
   if(!launchOpen&&!this.overlay.hidden&&keepTabInMenu(e,this.overlay))return;
   if(launchOpen)return;
   if(!this.overlay.hidden&&this.overlay.dataset.mode==='run-start')return;
   // A menu owns Tab for focus navigation; during flight Tab opens the map.
   if(e.code==='Escape'&&!this.overlay.hidden){
    e.preventDefault();
    if(this.overlay.querySelector('.departure-confirm')){this.cancelDeparture();return;}
    if(this.pendingStationModule&&this.overlay.dataset.mode==='base'){
     this.cancelStationModule(this.pendingStationModule.role);return;
    }
    this.dismiss();return;
   }
   if(e.code==='Tab'&&!this.overlay.hidden)return;
   // Let focused mixer sliders and buttons handle their own keys.
   if(e.ctrlKey||e.metaKey||e.altKey)return;
   if(e.target?.closest?.('input,textarea,select,button,summary,a'))return;
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Space'].includes(e.code))e.preventDefault();
   if(!e.repeat){
    if(e.code==='KeyE')this.beginInteraction('keyboard');
    if(e.code==='KeyC')this.toggleHoldFire();
    if(e.code==='KeyQ')this.hack();
     if(e.code==='Space')this.callFieldWeapon();
     if(e.code==='KeyF')this.callHowitzer();
     if(e.code==='KeyB')this.callStrike();
     if(e.code==='KeyR'&&!this.dead)this.toggleManualRail();
    if(e.code==='Tab'||e.code==='KeyM')this.openMap();
     if(e.code==='KeyU')this.skills();
    if(e.code==='Escape')this.dismiss();
    if(e.code==='KeyR'&&this.dead)location.reload();
   }
   this.keys.add(e.code);
   if(!e.repeat&&(e.code==='ShiftLeft'||e.code==='ShiftRight'))this.startBurst();
  });
  document.addEventListener('keyup',e=>{
   this.keys.delete(e.code);
   if(e.code==='KeyE')this.endInteraction('keyboard');
  });
  window.addEventListener('blur',()=>{this.keys.clear();this.endInteraction();});
  document.addEventListener('survivor:mobile-launch-closed',()=>{
   if(!this.overlay.hidden)focusMenu(this.overlay);
   else this.canvas?.focus?.({preventScroll:true});
  });
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden){this.keys.clear();this.endInteraction();}
   this.heritage.visibility(document.hidden);
  });
  this.overlay.addEventListener('click',e=>{
   const b=e.target.closest('button[data-act]');if(!b)return;
   const act=b.dataset.act;
   if(b.disabled)return;
   if(this.pendingStationModule&&this.overlay.dataset.mode==='base'&&
    !b.closest('.base-module-confirm'))return;
   if(act==='runContinue'){this.continueRun();return;}
   if(act==='runNew'){
    this.pendingCheckpoint=null;this.runStore?.startNew();
    this.overlay.dataset.mode='';this.dismiss();
    this.notice('Новый вылет. На активных станциях прогресс сохраняется.',5);return;
   }
   if(act==='openingPick'){this.chooseOpeningRoute(b.dataset.role);return;}
   if(act==='openingSkip'){this.skipOpeningRoute();return;}
   if(act==='openingReward'){this.claimOpeningReward(b.dataset.role);return;}
   if(act.startsWith('hg')){this.hangarAction(b.dataset);return;}
   if(act==='skillBranch'&&['Корабль','Технологии','Добыча'].includes(b.dataset.id)){
    this.skillBranch=b.dataset.id;this.renderSkills();
    this.overlay.querySelector('.skill-branch-tabs [aria-pressed="true"]')?.focus({preventScroll:true});return;
   }
   if(act==='mapView'&&['map','targets'].includes(b.dataset.id)){
    this.mapView=b.dataset.id;this.overlay.innerHTML=renderWorldMap(this);
    this.overlay.querySelector('.map-view-switch [aria-pressed="true"]')?.focus({preventScroll:true});return;
   }
   if(act==='installModule'){this.askStationModule(b.dataset.role);return;}
   if(act==='confirmModule'){this.confirmStationModule(b.dataset.role||'');return;}
   if(act==='cancelModule'){this.cancelStationModule(b.dataset.role||'');return;}
   if(act==='cancelDeparture'){this.cancelDeparture();return;}
   if(act==='returnHangar'){this.returnToHangar();return;}
   if(act==='discardDeparture'){this.confirmDeparture();return;}
   if(act==='close'){this.dismiss();return;}
    if(act==='baseTab'&&['summary','operations','hangar','network'].includes(b.dataset.role)){
     this.baseTab=b.dataset.role;this.heritage.ui('tab');this.renderDock();
     this.overlay.querySelector('.base-tabs [aria-selected="true"]')?.focus({preventScroll:true});}
   if(act==='showFieldTrial'&&this.docked?.id==='0:0'&&
    !this.fieldTrialTaken&&!this.fieldLoan){
    this.baseTab='summary';this.fieldTrialPickerOpen=!this.fieldTrialPickerOpen;
    this.heritage.ui('tab');this.renderDock();
    this.overlay.querySelector('.base-trial-picker')?.scrollIntoView({block:'nearest'});
    this.overlay.querySelector(this.fieldTrialPickerOpen?
     '.base-trial-picker [data-act="loanField"]':'[data-act="showFieldTrial"]')?.focus({preventScroll:true});
   }
    if(act==='baseMap')this.openMap();
   if(act==='toggleMeteorDefense'&&this.docked?.active){
    const base=this.docked;
    const linked=defenseLinked(base,this.world.networkTopology());
    const defense=ensureStationDefense(base,linked,this.time);
    defense.meteorEnabled=!defense.meteorEnabled;
    this.heritage.ui('tab');
    this.renderDock();
    this.overlay.querySelector('[data-act="toggleMeteorDefense"]')?.focus({preventScroll:true});
    return;
   }
    if(act==='baseBack'&&this.mapReturnToBase&&this.docked){
     this.mapReturnToBase=false;this.overlay.dataset.mode='base';
     this.heritage.pause('base');this.renderDock();
     this.overlay.querySelector('.base-tabs [aria-selected="true"]')?.focus({preventScroll:true});
    }
    if(act==='abandonOperation')this.abandonOperation();
   if(act==='skill')this.buySkill(b.dataset.id);
   if(act==='doctrine')this.buyDoctrine(b.dataset.id);
    if(act==='waypoint')this.selectWaypoint(b.dataset);
    if(act==='abandonContract')this.abandonContract();
    if(['loanField','returnField','fieldCharge','loanIon','returnIon'].includes(act)){
     this.baseAction(act,b.dataset.role||'');return;
    }
   if(act==='acceptOperation'||act==='activate'||act==='upgrade'||act==='hire'||act==='repair'||act==='repairDrones'||act==='supply'||act==='service'||act==='respec'||act==='transfer'||act==='acceptContract'||act==='claimContract'||act==='claimFirstModule'||act==='installModule'||act==='antenna')
    this.baseAction(act,b.dataset.role||'');
   if(act==='restart')location.reload();
  });
  this.overlay.addEventListener('keydown',e=>{
   const button=e.target.closest('.base-tabs button[role="tab"]');
   if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   const tabs=['summary','operations','hangar','network'];
   const current=tabs.indexOf(button.dataset.role);
   const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:
    (current+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   e.preventDefault();this.baseTab=tabs[next];this.heritage.ui('tab');this.renderDock();
   this.overlay.querySelector('.base-tabs [aria-selected="true"]')?.focus({preventScroll:true});
  });
  $('audioBtn').onclick=()=>this.toggleAudio();
  const credits = $('creditsDialog'), creditsButton = $('audioCredits');
  if (credits && creditsButton) {
   creditsButton.addEventListener('click', () => {
    if (credits.open) return;
    this._creditsRestore={paused:this.paused,modal:this.heritage.modal};
    this.paused=true;this.pausedRenderPending=true;
    this.heritage.pause('credits');
    credits.showModal();
    $('creditsClose')?.focus({preventScroll:true});
   });
   credits.addEventListener('close', () => {
    const prior=this._creditsRestore;
    if (!prior) return;
    this._creditsRestore=null;
    this.paused=prior.paused;
    this.pausedRenderPending=true;
    if(prior.paused)this.heritage.pause(prior.modal || 'map');
    else this.heritage.resume();
    creditsButton.focus({preventScroll:true});
   });
   credits.addEventListener('keydown',e=>e.stopPropagation());
   credits.addEventListener('click',e=>{if(e.target===credits)credits.close();});
  }
  for(const control of document.querySelectorAll('[data-audio-channel]')){
   const channel=control.dataset.audioChannel;
   control.value=String(Math.round(this.heritage.settings[channel]*100));
   control.addEventListener('input',()=>{
    this.heritage.setVolume(channel,Number(control.value)/100);
    const output=document.querySelector('[data-audio-value="'+channel+'"]');
    if(output)output.textContent=control.value+'%';
   });
   control.addEventListener('change',()=>this.heritage.ui('slider'));
   const output=document.querySelector('[data-audio-value="'+channel+'"]');
   if(output)output.textContent=control.value+'%';
  }
  $('skillBtn').onclick=()=>this.skills();
   const mapButton=$('mapBtn');if(mapButton)mapButton.onclick=()=>this.openMap();
  $('quietBtn').onclick=()=>this.toggleHoldFire();
  $('hackBtn').onclick=()=>this.hack();
   const ionButton=$('ionBtn');if(ionButton)ionButton.onclick=()=>this.callFieldWeapon();
   const heavyButton=$('heavyBtn');if(heavyButton)heavyButton.onclick=()=>this.callHowitzer();
   const railButton=$('precisionBtn');if(railButton)railButton.onclick=()=>this.toggleManualRail();
   const strikeButton=$('strikeBtn');if(strikeButton)strikeButton.onclick=()=>this.callStrike();
  $('burstBtn').onclick=()=>this.startBurst();
  const actionButton=$('actionBtn');
  if(actionButton){
   actionButton.addEventListener('pointerdown',e=>{
    if(actionButton.disabled)return;
    actionButton.setPointerCapture(e.pointerId);
    this.beginInteraction('touch');e.preventDefault();
   });
   const stopAction=()=>this.endInteraction('touch');
   actionButton.addEventListener('pointerup',stopAction);
   actionButton.addEventListener('pointercancel',stopAction);
   actionButton.addEventListener('lostpointercapture',stopAction);
  }
  const pad=$('stick');let active=null;
  const pointer=e=>{
   const r=pad.getBoundingClientRect();const dx=e.clientX-(r.left+r.width/2);
   const dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy);
   const n=Math.max(1,m);const k=Math.min(1,m/(r.width*.34));
   this.touch.x=dx/n*k;this.touch.y=dy/n*k;
   $('knob').style.transform='translate('+this.touch.x*35+'px,'+this.touch.y*35+'px)';
  };
  pad.addEventListener('pointerdown',e=>{active=e.pointerId;pad.setPointerCapture(active);pointer(e);});
  pad.addEventListener('pointermove',e=>{if(e.pointerId===active)pointer(e);});
  const release=e=>{if(e.pointerId!==active)return;active=null;this.touch.x=0;this.touch.y=0;$('knob').style.transform='';};
  pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
  // In ordinary flight a tap chooses auto-target priority. Manual rail mode
  // explicitly replaces that tap with a precision shot; R / the mode button
  // restores ordinary designation. Both use the same camera projection.
  let aimStart=null;
  this.canvas?.addEventListener('pointerdown',e=>{
   if(e.button!==0||this.paused||this.dead)return;
   aimStart={id:e.pointerId,x:e.clientX,y:e.clientY};
  });
  this.canvas?.addEventListener('pointerup',e=>{
   if(!aimStart||e.pointerId!==aimStart.id)return;
   const moved=Math.hypot(e.clientX-aimStart.x,e.clientY-aimStart.y);
   aimStart=null;if(moved>14||this.paused||this.dead)return;
   const rect=this.canvas.getBoundingClientRect(),cam=this.camera();
   if(!rect.width||!rect.height)return;
   const worldPoint={x:cam.x+(e.clientX-rect.left)/rect.width*cam.w,
     y:cam.y+(e.clientY-rect.top)/rect.height*cam.h};
   if(this.manualRailMode){this.fireManualRailAt(worldPoint);return;}
   const item=pickDesignatedTarget(this,worldPoint,
     Math.max(34,28*cam.w/rect.width));
   if(!item){
    if(this.designatedTarget){
     this.designatedTarget=null;this.notice('Приоритет цели снят.',1.8);
    }else if(this.time-this.lastTargetHintAt>=8){
     this.lastTargetHintAt=this.time;
     this.notice('Коснитесь видимой цели в пределах 900 м: автооружие будет выбирать её 14 с.',3.8);
    }
    return;
   }
   if(this.designatedTarget?.target===item.target){
    this.designatedTarget=null;this.notice('Приоритет цели отменён',1.7);
   }else{
    this.designatedTarget={target:item.target,expiresAt:this.time+TARGET_DESIGNATION.duration};
    this.notice('Приоритет: '+designationLabel(item)+' · '+TARGET_DESIGNATION.duration+
     ' с. Автооружие выберет цель, когда она в зоне огня.',3.6);
   }
  });
  this.canvas?.addEventListener('pointercancel',()=>{aimStart=null;});
 }
 notice(text,seconds=3){this.message.textContent=text;this.messageUntil=this.time+seconds;}
 toggleAudio(){
  const enabled=this.heritage.toggleSound();
  $('audioBtn').textContent=enabled?'🔊 Звук включён':'♫ Начать со звуком';
  $('audioBtn').setAttribute('aria-pressed',String(enabled));
  if(enabled)this.heritage.ui('audioOn');
  this.notice(enabled?'Звук и музыка включены':'Звук и музыка выключены',2.3);
 }
 startBurst(){
   const p=this.player;
   if(this.dead||this.paused||p.burstCooldown>0)return false;
   let dx=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-
     Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))+this.touch.x;
   let dy=Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-
     Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))+this.touch.y;
   let m=length(dx,dy);
   if(m<.1){dx=p.vx;dy=p.vy;m=length(dx,dy);}
   if(m<.1){dx=Math.sin(p.angle);dy=-Math.cos(p.angle);m=1;}
   p.burstX=dx/m;p.burstY=dy/m;
   const stats=burstStats(this.skillRanks.engine);
   p.burstRemaining=stats.duration;
   p.burstCooldown=stats.cooldown;
   this.heritage.vfx.engineTrail(p.x,p.y,p.angle,'fighter',true,.12);
   this.heritage.play('boost',.6,{x:p.x,y:p.y});
   return true;
  }
  presentMenu(preferred=''){
   if(typeof document!=='undefined'&&!this.menuFocusOrigin&&
    !this.overlay.contains?.(document.activeElement))
    this.menuFocusOrigin=document.activeElement;
   setMenuBackgroundInert(this.overlay,true);
   if(typeof document!=='undefined'&&document.getElementById?.('mobileLaunch')?.hidden===false)return;
   focusMenu(this.overlay,preferred);
  }
  releaseMenu(){
   setMenuBackgroundInert(this.overlay,false);
   const previous=this.menuFocusOrigin;
   this.menuFocusOrigin=null;
   if(typeof document==='undefined')return;
   const target=previous&&previous!==document.body&&previous.isConnected?previous:this.canvas;
   target?.focus?.({preventScroll:true});
  }
  askDepartureConfirmation(){
   if(this.overlay.querySelector('.departure-confirm'))return;
   const dialog=this.overlay.querySelector('.dialog');
   if(!dialog)return;
   dialog.inert=true;
   this.overlay.insertAdjacentHTML('beforeend',
    '<section class="departure-confirm" role="alertdialog" aria-modal="true" '+
    'aria-labelledby="departure-title" aria-describedby="departure-description">'+
    '<span class="departure-kicker">АНГАР · НЕЗАВЕРШЁННАЯ ПОДГОТОВКА</span>'+
    '<h2 id="departure-title">Оружие ещё не установлено</h2>'+
    '<p id="departure-description">Вы изменили предварительную сборку, но не нажали «Применить». '+
    'Если вылететь сейчас, корабль сохранит прежнее вооружение, а новые настройки пропадут. '+
    'Сплав за предварительную сборку не списан.</p>'+
    '<div class="departure-actions">'+
    '<button type="button" data-act="returnHangar" class="departure-primary">Вернуться к сборке</button>'+
    '<button type="button" data-act="cancelDeparture">Остаться здесь</button>'+
    '<button type="button" data-act="discardDeparture" class="departure-discard">Вылететь без изменений</button>'+
    '</div></section>');
   focusMenu(this.overlay,'[data-act="returnHangar"]');
  }
  cancelDeparture(){
   this.pendingWaypointSelection=null;
   this.overlay.querySelector('.departure-confirm')?.remove();
   const dialog=this.overlay.querySelector('.dialog');
   if(dialog)dialog.inert=false;
   focusMenu(this.overlay,'[data-act="close"]');
  }
  returnToHangar(){
   this.cancelDeparture();
   if(!this.docked)return;
   this.baseTab='hangar';this.mapReturnToBase=false;
   this.overlay.dataset.mode='base';this.heritage.pause('base');this.renderDock();
   focusMenu(this.overlay,'[data-act="hgReset"]:not([disabled])');
  }
  confirmDeparture(){
   if(!this.overlay.querySelector?.('.departure-confirm'))return false;
   const planned=this.pendingWaypointSelection;this.pendingWaypointSelection=null;
   if(planned){this.waypoint=planned.waypoint;if(planned.waypoint)this.heritage.world('contract');}
   const departed=this.dismiss(true);
   if(departed&&planned)this.notice(planned.message,4);
   return departed;
  }
 showOpeningChoice(){
  if(this.openingArc?.status!=='offer'||!this.overlay.hidden||this.paused||this.dead)return;
  this.paused=true;this.pausedRenderPending=true;
  this.overlay.dataset.mode='opening-choice';this.overlay.hidden=false;
  this.heritage.pause('map');
  this.overlay.innerHTML='<div class="dialog opening-choice" role="dialog" aria-modal="true" '+
   'aria-labelledby="opening-title"><span class="opening-kicker">ПЕРЕХВАТ · ДОМАШНИЙ СЕКТОР</span>'+
   '<h2 id="opening-title">Два срочных сигнала</h2>'+
   '<p>Наводчик противника ведёт патрули к доку. В другой стороне осталась аварийная капсула. '+
   'Помочь можно только в одном месте — сигнал второй цели будет потерян.</p>'+
   '<div class="opening-options">'+
   '<button data-act="openingPick" data-role="intercept"><strong>Перехватить наводчика</strong>'+
   '<small>Уничтожить отмеченный корабль. Данные для развития и заметно более редкие патрули на две минуты.</small></button>'+
   '<button data-act="openingPick" data-role="rescue"><strong>Эвакуировать капсулу</strong>'+
   '<small>Подлететь и удерживать E / «Действие» 3,5 с. Больше сплава и аварийный щит, но враг заметит спасение.</small></button>'+
   '</div><p class="opening-note">Первое успешно выполненное поручение даёт один бесплатный оружейный модуль за забег. '+
   'На выполнение — около двух с половиной минут игрового времени.</p>'+
   '<button data-act="openingSkip" class="opening-skip">Продолжить свободный полёт</button></div>';
  this.presentMenu('[data-act="openingPick"]');
 }
 skipOpeningRoute(){
  if(this.overlay.dataset.mode!=='opening-choice')return;
  this.openingArc.status='skipped';this.dismiss();
  this.notice('Сигналы пропущены. Все обычные задания и операции доступны.',4);
 }
 chooseOpeningRoute(kind){
  if(this.overlay.dataset.mode!=='opening-choice'||
   !beginOpeningArc(this.openingArc,kind,this.time))return;
  const arc=this.openingArc;
  arc.returnWaypoint=this.waypoint?.id&&Number.isFinite(this.waypoint.x)&&
   Number.isFinite(this.waypoint.y)?{...this.waypoint}:null;
  if(kind==='intercept'){
   const spec=ENEMY_TYPES.fighter,serial=++this.enemySerial;
   const group=++this.groupSerial;
   const commander={serial,group,type:'fighter',
    x:arc.interceptX,y:arc.interceptY,vx:0,vy:0,r:18,
    hp:Math.max(100,spec.hp*1.8),maxHp:Math.max(100,spec.hp*1.8),
    damage:spec.dmg,think:.2,fire:1.1,state:'hunt',commitUntil:0,
    target:this.player,angle:0,hit:0,expAwarded:false,scenario:'opening-intercept',
    protect:null,openingCommander:true,missionStructure:true,entryPortalPending:false};
   this.enemies.push(commander);
   for(const offset of [-1,1]){
    const scout=ENEMY_TYPES.scout;
    this.enemies.push({serial:++this.enemySerial,group,type:'scout',
     x:arc.interceptX+offset*78,y:arc.interceptY+offset*64,vx:0,vy:0,r:14,
     hp:scout.hp,maxHp:scout.hp,damage:scout.dmg,think:.15,fire:1.3,
     state:'hunt',commitUntil:0,target:this.player,angle:0,hit:0,
     expAwarded:false,scenario:'opening-escort',protect:commander,
     entryPortalPending:false});
   }
   arc.commanderSerial=serial;
  }
  this.waypoint={id:'opening-'+kind,
   x:kind==='intercept'?arc.interceptX:arc.rescueX,
   y:kind==='intercept'?arc.interceptY:arc.rescueY,
   label:kind==='intercept'?'Вражеский наводчик':'Аварийная капсула'};
  this.dismiss();
  this.notice(kind==='intercept'?
   'Цель отмечена: наводчик окружён патрулями. Подойдите на дистанцию оружия и назначьте приоритет.':
   'Капсула отмечена. Удерживайте E рядом с ней; отпускайте кнопку для стрельбы.',6);
 }
 showOpeningReward(){
  if(this.firstHardwareReward!=='pending'||!this.overlay.hidden||this.dead)return;
  this.paused=true;this.pausedRenderPending=true;
  this.overlay.dataset.mode='opening-reward';this.overlay.hidden=false;
  this.heritage.pause('base');
  this.overlay.innerHTML='<div class="dialog opening-choice" role="dialog" aria-modal="true" '+
   'aria-labelledby="opening-reward-title"><span class="opening-kicker">УСПЕХ · НОВОЕ ОСНАЩЕНИЕ</span>'+
   '<h2 id="opening-reward-title">Выберите второе оружие</h2>'+
   '<p>Модуль бесплатный и сразу устанавливается в свободный узел корабля. '+
   'Это выбор тактики, а не улучшение урона на несколько процентов.</p>'+
   '<div class="opening-options">'+
   '<button data-act="openingReward" data-role="rail"><strong>Рельс · держать дистанцию</strong>'+
   '<small>Автоматический выстрел на 700 м. Можно атаковать раньше, чем враг войдёт в радиус плазмы.</small></button>'+
   '<button data-act="openingReward" data-role="flak"><strong>Картечь · встречать рои</strong>'+
   '<small>Поражает до трёх близких целей. Подпускайте группы примерно на 245 м.</small></button>'+
   '<button data-act="openingReward" data-role="plasma"><strong>Вторая плазма · сближаться</strong>'+
   '<small>Сильный ближний залп по одиночному кораблю; следите за общим перегревом.</small></button>'+
   '</div><button data-act="close" class="opening-skip">Позже — выбрать на станции</button></div>';
  this.presentMenu('[data-act="openingReward"]');
 }
 claimOpeningReward(id){
  if(this.overlay.dataset.mode!=='opening-reward')return;
  const preserveDraft=!!this.hangarSession?.dirty?.(this.shipLoadout);
  const reward=claimFirstContractModule(this.shipLoadout,this.firstHardwareReward,id,{preserveDraft});
  if(!reward.ok){this.notice(reward.reason,3);return;}
  this.shipLoadout=reward.loadout;this.firstHardwareReward=reward.status;
  if(this.lastContractReceipt){
   this.lastContractReceipt.firstHardwareReward=id;
   this.lastContractReceipt.firstHardwareInstalled=reward.installed;
  }
  if(!preserveDraft)this.hangarSession?.begin(this.shipLoadout);
  this.syncShipLoadout();this.dismiss();
  this.heritage.ui('upgrade');
  const criticalHull=this.player?.maxHp>0&&this.player.hp/this.player.maxHp<.45;
  this.notice(reward.installed?
   'ОРУЖИЕ УСТАНОВЛЕНО: '+MODULES[id].name+'. '+
    (criticalHull?'Корпус повреждён — возвращайтесь к доку для ремонта!':
     'Попробуйте его в следующем бою!'):
   'Орудие на складе. Освободите узел в ангаре и примените сборку.',6);
 }
 updateOpeningArc(dt){
  const arc=this.openingArc;
  if(!arc||this.visuals.capitalDamageQA)return;
  if(arc.status==='offer'){
   if(this.time>130){arc.status='skipped';return;}
   if(this.time>=OPENING_ARC.offerAt&&!this.operation&&
     Math.hypot(this.player.x-this.world.home.x,this.player.y-this.world.home.y)<2200)
    this.showOpeningChoice();
   return;
  }
  if(!openingArcActive(arc))return;
  const commander=arc.kind==='intercept'?
   this.enemies.find(e=>e.serial===arc.commanderSerial&&e.openingCommander):null;
  const near=arc.kind==='rescue'&&
   Math.hypot(this.player.x-arc.rescueX,this.player.y-arc.rescueY)<=OPENING_ARC.repairRange;
  const result=advanceOpeningArc(arc,this.time,dt,{
   commanderAlive:!!commander&&commander.hp>0,
   repairing:!!this.openingRepairing,withinRange:near});
  if(result==='failed'){
   if(this.waypoint?.id==='opening-'+arc.kind)this.waypoint=arc.returnWaypoint;
   this.notice('Срочный сигнал потерян. Забег продолжается; обычные операции доступны.',5);
   return;
  }
  if(!result.endsWith('-complete'))return;
  this.endInteraction();
  if(this.waypoint?.id==='opening-'+arc.kind)this.waypoint=arc.returnWaypoint;
  if(arc.kind==='intercept'){
   this.player.ore+=OPENING_ARC.interceptRewardOre;
   recordSortieIncome(this,'ore','operation',OPENING_ARC.interceptRewardOre);
   this.cockpit.resourceGain(OPENING_ARC.interceptRewardOre,this.time);
   this.collect({type:'data',value:OPENING_ARC.interceptRewardData,source:'operation'});
   this.spawnClock=Math.max(this.spawnClock,15);
   this.notice('Наводчик уничтожен: патрули у дока стали реже на 2 минуты. '+
    '+'+OPENING_ARC.interceptRewardData+' данных!',6);
  }else{
   this.player.ore+=OPENING_ARC.rescueRewardOre;
   recordSortieIncome(this,'ore','operation',OPENING_ARC.rescueRewardOre);
   this.cockpit.resourceGain(OPENING_ARC.rescueRewardOre,this.time);
   this.player.shield=Math.max(this.player.shield,OPENING_ARC.rescueShield);
   this.spawnClock=Math.max(this.spawnClock,9);
   if(!this.waypoint&&this.player.hp/this.player.maxHp<.45){
    const dock=this.world.home;
    this.waypoint={id:dock.id,x:dock.x,y:dock.y,label:'Вернуться на ремонт'};
   }
   this.notice('Эвакуация завершена: +'+OPENING_ARC.rescueRewardOre+
    ' сплава и аварийный щит. Враг получил сигнал: патрули участятся.',6);
  }
  if(this.firstHardwareReward==null)this.firstHardwareReward='pending';
  this.showOpeningReward();
 }
  dismiss(discardDraft=false){
   if(!this.overlay.hidden&&['run-start','death'].includes(this.overlay.dataset.mode))return false;
   if(!this.overlay.hidden&&this.overlay.dataset.mode==='opening-choice'&&
      this.openingArc?.status==='offer')this.openingArc.status='skipped';
   if(!discardDraft&&!this.overlay.hidden&&this.docked&&this.stationExitArmed&&
    typeof this.hangarSession?.dirty==='function'&&this.hangarSession.dirty(this.shipLoadout)){
    this.askDepartureConfirmation();return false;
   }
   this.overlay.querySelector?.('.departure-confirm')?.remove();
   this.pendingWaypointSelection=null;
   const dialog=this.overlay.querySelector?.('.dialog');if(dialog)dialog.inert=false;
   if(discardDraft)this.hangarSession?.begin(this.shipLoadout);
   this.pendingStationModule=null;
   // A player can depart directly, through the map or through another panel.
   // The station arms one departure until the overlay actually closes; maps
   // opened later during a flight must not reset that flight's baseline.
   if(!this.overlay.hidden&&this.docked&&
    (this.stationExitArmed||this.overlay.dataset.mode==='base'))
    this.sortieStart=startSortie(this);
   if(this.sortieStart)this.lastContractReceipt=null;
   this.stationExitArmed=false;
   this.saveAtStation();
   this.endInteraction();
   if(!this.overlay.hidden)this.heritage.ui('close');
   this.overlay.hidden=true;this.paused=false;this.mapReturnToBase=false;this.heritage.resume();
   this.releaseMenu();
   return true;
  }
  abandonOperation(){
   if(!this.operation||this.dead)return;
   const name=this.operation.name,operationId=this.operation.id;
   finishFieldAssignment(this.fieldLoan,'operation',this.operation);
   const preservingCarrierReturn=operationId===CARRIER_INTERCEPTION.id&&this.operation.phase==='return';
   if(operationId===RELAY_DEFENSE.id){
    const base=this.world.stations.get(this.operation.baseId);
    if(base)base.relayMission=null;
    this.enemies=this.enemies.filter(e=>e.relayAssault!==this.operation.baseId);
   }
   if(operationId===CARRIER_INTERCEPTION.id){
    const base=this.world.stations.get(this.operation.baseId);
    if(base&&this.operation.phase!=='return')base.carrierMission=null;
    this.enemies=this.enemies.filter(e=>!e.interceptCargo&&e.carrierEscort!==this.operation.baseId);
   }
   this.operation=null;this.probeRepairing=false;
   if(this.waypoint?.id===operationId)this.waypoint=null;
   this.heritage.ui('cancel');this.notice('Операция «'+name+'» отложена. '+
    (operationId===RELAY_DEFENSE.id?'Налёт отменён. При повторном запуске волны начнутся заново.':
     operationId===CARRIER_INTERCEPTION.id?(preservingCarrierReturn?
      'Сведения сохранены. Передайте их при следующем посещении авианосца.':
      'Погоня отменена. Новый груз появится при следующем вылете.'):
     operationId===PROBE_OPERATION.id?'Прогресс ремонта сохранён.':
     operationId===CORRIDOR_OPERATION.id&&this.world.stations.get(this.world.home.id)?.corridorMission?.phase==='return'?
      'Телеметрия сохранена. Возобновите операцию в доке, чтобы сдать её.':'Повреждения передатчика сохранены.'),4);
   if(this.overlay.dataset.mode==='map')this.overlay.innerHTML=renderWorldMap(this);
   else if(this.overlay.dataset.mode==='base')this.renderDock();
  }
  abandonContract(){
   if(!this.contract||this.dead||this.contract.progress>=this.contract.goal)return;
   const name=this.contract.name;finishFieldAssignment(this.fieldLoan,'contract',this.contract);this.contract=null;
   this.heritage.ui('cancel');
   this.notice('Поручение «'+name+'» отменено. Прогресс потерян.',3.4);
   if(this.overlay.dataset.mode==='map')this.overlay.innerHTML=renderWorldMap(this);
   else if(this.overlay.dataset.mode==='base')this.renderDock();
  }
  openMap(){
   if(this.dead)return;
   this.endInteraction();
   if(!this.overlay.hidden&&this.overlay.dataset.mode==='map'){this.dismiss();return;}
   this.mapReturnToBase=!this.overlay.hidden&&this.overlay.dataset.mode==='base'&&!!this.docked;
   this.paused=true;this.pausedRenderPending=true;this.heritage.pause('map');
   this.overlay.dataset.mode='map';this.overlay.hidden=false;
   this.overlay.innerHTML=renderWorldMap(this);
   this.presentMenu(this.mapReturnToBase?'[data-act="baseBack"]':'[data-act="close"]');
   this.heritage.ui('map');
  }
  selectWaypoint(data){
   if(this.overlay.dataset.mode!=='map')return;
   if(data.id==='clear'){
    this.requestWaypointDeparture(null,'Маршрут сброшен. Откройте карту, чтобы выбрать новую цель.');return;
   }
   const x=Number(data.x),y=Number(data.y);
   if(!Number.isFinite(x)||!Number.isFinite(y))return;
   const base=this.world.stations.get(data.id);
   const region=REGIONS.find(r=>'region-'+r.id===data.id);
   const cargo=[...(this.world.regionalSupply?.convoys||[]),
    ...(this.world.regionalSupply?.central?.convoys||[]),
    ...(this.world.regionalSupply?.frontier?.azure?.convoys||[]),
    ...(this.world.regionalSupply?.frontier?.teal?.convoys||[])].find(c=>c.id===data.id&&c.seen);
   const intel=labLogisticsIntel(this.world,this.player).contacts.find(c=>c.id===data.id);
   if(!region&&!cargo&&!intel&&(!base||(!base.discovered&&!data.signal)))return;
   const waypoint=intel?{id:intel.id,x:intel.x,y:intel.y,label:intel.label,
    ...(intel.kind==='cargo'?{radioContact:true,signalLabel:intel.label,signalLive:true}:{})}:
    region?{id:data.id,...region.survey,label:region.name}:
    cargo?{id:cargo.id,x:cargo.x,y:cargo.y,label:cargo.frontierCargo?
     (cargo.frontierNetwork==='azure'?'Энерготранспорт':'Ремонтный груз'):
     cargo.centralCargo?'Местный груз':'Рудный транспорт'}:
    {id:data.id,x,y,label:data.label||'Сигнал станции'};
   this.requestWaypointDeparture(waypoint,'Маршрут: '+waypoint.label+' · '+Math.round(dist(this.player,waypoint))+' м');
  }
  requestWaypointDeparture(waypoint,message){
   if(!this.overlay.hidden&&this.docked&&this.stationExitArmed&&
    typeof this.hangarSession?.dirty==='function'&&this.hangarSession.dirty(this.shipLoadout)){
    this.pendingWaypointSelection={waypoint,message};this.askDepartureConfirmation();return;
   }
   this.waypoint=waypoint;
   if(waypoint)this.heritage.world('contract');
   if(this.dismiss()!==false)this.notice(message,4);
  }
 skills(){
  if(this.dead)return;
  this.endInteraction();
  if(!this.overlay.hidden&&this.overlay.dataset.mode==='skills'){this.dismiss();return;}
  this.paused=true;this.pausedRenderPending=true;
  this.heritage.pause('skills');
  this.overlay.dataset.mode='skills';this.overlay.hidden=false;
  this.heritage.ui('open');
  this.renderSkills();
 }
 renderSkills(){
  const focusIdentity=captureMenuControl(this.overlay);
  const previousScroll=this.overlay.querySelector('.skill-dialog')?.scrollTop||0;
  const p=this.player;
  let content='<header class="skill-head"><h2 id="skill-menu-title">Развитие пилота · '+p.points+' '+pointsWord(p.points)+
   '</h2><p>Уровень '+p.level+' · опыт '+Math.floor(p.xp)+' / '+expForNext(p.level)+
   '. Данные с врагов дают опыт и очки развития; сплав из метеоритов нужен для флота и баз.</p></header>'+
   '<p class="skill-hangar-note">Оружие, двигатель, корпус и щиты улучшайте в ангаре активной станции. Изученные навыки сохраняются и после следующей стыковки.</p>'+
   '<section class="doctrine-strip"><div class="doctrine-header"><strong>БОЕВАЯ ДОКТРИНА</strong><small>'+(
    this.doctrine?'Выбрано направление. Сменить его можно на активной базе за 12 сплава.':
    'Один мощный стиль на выбор с 4-го уровня · стоит 1 очко · смена на базе.'
   )+'</small></div><div class="doctrine-grid">'+
   DOCTRINES.map(d=>{
    const chosen=this.doctrine===d.id;
    const reason=chosen?'ВЫБРАНО':this.doctrine?'Выбрана другая доктрина':
     p.level<4?'Нужен уровень 4':p.points<1?'Нужно 1 очко':'ИЗУЧИТЬ';
    const enabled=!this.doctrine&&p.level>=4&&p.points>0;
    return '<button class="doctrine-choice'+(chosen?' selected':enabled?' ready':'')+
      '" data-act="doctrine" data-id="'+d.id+'"'+(enabled?'':' disabled')+
      '><strong>'+d.title+'</strong><small>'+d.desc+'</small><em>'+reason+'</em></button>';
   }).join('')+'</div></section>'+
   '<nav class="skill-branch-tabs" aria-label="Выберите ветвь развития">'+
   [['Корабль','Пилотирование'],['Технологии','Технологии'],['Добыча','Добыча']].map(([key,label])=>
    '<button type="button" data-act="skillBranch" data-id="'+key+'" aria-pressed="'+((this.skillBranch||'Корабль')===key)+'">'+label+'</button>').join('')+
   '</nav><div class="skill-columns">';
  const branches=[
   ['Корабль','Пилотирование и аварийный отход'],
   ['Технологии','Поиск станций и тактика ведомых'],
   ['Добыча','Раскалывание породы, электрический разряд и магнитный сбор']
  ];
  for(const [branch,subtitle] of branches){
   content+='<section class="skill-branch'+((this.skillBranch||'Корабль')===branch?' active':'')+'"><h3>'+(branch==='Корабль'?'Пилотирование':branch)+'</h3><p class="branch-subtitle">'+subtitle+'</p>';
   for(const skill of SKILLS.filter(s=>s.branch===branch&&!SHIP_UPGRADES.has(s.id))){
    const rank=this.skillRanks[skill.id],mastered=rank>=skill.max;
    const prereq=skill.requires?SKILLS.find(x=>x.id===skill.requires):null;
    const reason=mastered?'Максимум':
     p.level<skill.from?'Нужен уровень '+skill.from:
     prereq&&!this.skillRanks[prereq.id]?'Сначала '+prereq.title:
     p.points<=0?'Нужно очко развития':'Можно изучить';
    const unlocked=!mastered&&p.level>=skill.from&&
     (!prereq||this.skillRanks[prereq.id]>0);
    const canBuy=unlocked&&p.points>0;
    const cls=mastered?'mastered':canBuy?'ready':'locked';
    content+='<button class="skill-node '+cls+'" data-act="skill" data-id="'+skill.id+'" '+
      (!canBuy?'disabled':'')+'><span class="skill-node-head"><strong>'+skill.title+
      '</strong><em>'+rank+' / '+skill.max+'</em></span><small class="skill-effect">'+(mastered?'Изучено полностью':nextSkillEffect(skill.id,rank,this.skillRanks))+
      '</small><small>'+skill.desc+
      '</small><span class="skill-state">'+(prereq?'↳ '+prereq.title+' · ':'')+reason+
      '</span></button>';
   }
   content+='</section>';
  }
  content+='</div><button class="close" data-act="close">Продолжить полёт</button>';
  this.overlay.innerHTML='<div class="dialog wide skill-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-menu-title">'+
   '<button class="skill-close-corner" data-act="close" aria-label="Закрыть дерево развития">×</button>'+
   content+'</div>';
  this.overlay.querySelector('.skill-dialog').scrollTop=previousScroll;
  this.presentMenu();
  restoreMenuControl(this.overlay,focusIdentity,'[data-act="close"]');
 }
 buyDoctrine(id){
  if(this.dead||this.doctrine||this.player.level<4||this.player.points<1||
    !DOCTRINES.some(d=>d.id===id))return;
  this.player.points--;this.doctrine=id;
  this.notice('Доктрина: '+DOCTRINES.find(d=>d.id===id).title,3);
  this.heritage.play('doctrine');
  this.renderSkills();
 }
 buySkill(id){
  const skill=SKILLS.find(s=>s.id===id),p=this.player;
  if(SHIP_UPGRADES.has(id)&&(!this.docked?.active||this.overlay.hidden||this.overlay.dataset.mode!=='base'||this.baseTab!=='hangar'))return;
  if(!skill||p.points<=0||p.level<skill.from||
    (skill.requires&&!this.skillRanks[skill.requires])||this.skillRanks[id]>=skill.max)return;
  this.skillRanks[id]++;p.points--;
  if(id==='hull'){p.maxHp+=22;p.hp=Math.min(p.maxHp,p.hp+32);}
  if(id==='shield')p.shield+=18;
  let moduleSuggested=false;
  if(id==='rocket'&&this.skillRanks.rocket===1){
   this.shipLoadout.owned.rocket=(this.shipLoadout.owned.rocket||0)+1;
   moduleSuggested=this.suggestShipModule('rocket');
  }
  this.heritage.play('upgrade',.14);
  this.notice('Улучшение: '+skill.title,2.4);
  if(SHIP_UPGRADES.has(id)){
   this.hangarSession.message=moduleSuggested?'Ракетный модуль добавлен в предварительную сборку. Нажмите «Применить».':
    id==='rocket'&&this.skillRanks.rocket===1?'Ракетный модуль получен. Выберите узел, установите его и примените сборку.':'Улучшение изучено: '+skill.title;
   this.renderDock();
   if(moduleSuggested)this.revealLoadoutApply();
   else this.overlay.querySelector('[data-act="hgUpgrade"][data-id="'+id+'"]')?.focus({preventScroll:true});
  }else this.renderSkills();
 }

 advanceContract(kind,subject=null){
  const c=this.contract;
  const station=c?this.world.stations.get(c.baseId):null;
  if(!eligibleContractProgress(c,kind,subject,station))return;
  c.progress++;
  if(c.progress===c.goal){
   c.completedSortieId=this.sortieStart?.id??null;
   this.notice('Задание выполнено! '+
    'Вернитесь на '+(station?baseNames[station.type]:'станцию')+' за наградой. Золотая отметка покажет её на карте.',4.5);
  }
 }

 // Finite assault on a fragile relay. Leaving the sector never grants a free win.
 spawnRelayWave(op,index){
  const roster=RELAY_DEFENSE.waves[index];if(!roster)return;
  op.enemySerials=[];op.wave=index+1;op.phase='wave';
  for(let i=0;i<roster.length;i++){
   const spec=roster[i],def=ENEMY_TYPES[spec.type],radius=630+i*85;
   let angle=spec.angle,x=op.x+Math.cos(angle)*radius,y=op.y+Math.sin(angle)*radius;
   for(let step=0;step<6;step++){
    angle=spec.angle+step*.3;
    const px=op.x+Math.cos(angle)*radius,py=op.y+Math.sin(angle)*radius;
    const obstructed=this.world.nearbyRocks(px,py,62).some(r=>r.alive&&dist(r,{x:px,y:py})<r.r+28);
    if(!obstructed){x=px;y=py;break;}
   }
   const serial=++this.enemySerial;
   this.enemies.push({serial,group:++this.groupSerial,type:spec.type,
    x,y,vx:0,vy:0,r:spec.type==='gunship'?22:14,
    hp:def.hp,maxHp:def.hp,damage:def.dmg,think:0,fire:1.4,
    state:'hunt',commitUntil:0,target:op,angle:0,hit:0,
    expAwarded:true,scenario:'relay-assault',protect:null,
    relayAssault:op.baseId,relayCooldownUntil:this.time+2.4,relayChargeUntil:0,
    operationGuard:true,fieldChargeOperation:this.operation?.id,fieldChargeBaseId:this.operation?.baseId,entryPortalPending:false});
   op.enemySerials.push(serial);
  }
  this.notice('Бортовой ИИ: волна '+op.wave+'/3. '+(index===2?
   'Тяжёлый корабль атакует ретранслятор — перехватите его!':
   'Перехватите налётчиков до их залпа по передатчику.'),4.5);
 }
 updateRelayDefense(dt){
  const op=this.operation;
  if(!op||op.id!==RELAY_DEFENSE.id||this.dead)return;
  if(op.hp<=0){this.failRelayDefense(op);return;}
  if(op.hp<=RELAY_DEFENSE.maxHp*.35&&!op.criticalWarned){
   op.criticalWarned=true;
   this.notice('ТРЕВОГА: ретранслятор повреждён! Перехватывайте заряжающиеся корабли.',4);
  }
  if(op.phase==='approach'){
   if(dist(this.player,op)<=RELAY_DEFENSE.triggerRange){
    op.phase='warning';op.nextAt=this.time+RELAY_DEFENSE.preparation;
    this.notice('Бортовой ИИ: на ретранслятор наводятся противники. Первая атака через 8 секунд.',4.5);
   }
   return;
  }
  if(op.phase==='warning'||op.phase==='intermission'){
   if(this.time>=op.nextAt)this.spawnRelayWave(op,op.wave);
   return;
  }
  if(op.phase!=='wave')return;
  let surviving=0;
  for(const e of this.enemies){
   if(e.relayAssault!==op.baseId||!op.enemySerials.includes(e.serial)||
      e.hp<=0||e.converted)continue;
   surviving++;
   if(dist(e,op)>RELAY_DEFENSE.assaultRange){
    e.relayChargeUntil=0;continue;
   }
   if(this.time<(e.relayCooldownUntil||0))continue;
   if(!e.relayChargeUntil){
    e.relayChargeUntil=this.time+1.3;
   }else if(this.time>=e.relayChargeUntil){
    const damage=e.type==='gunship'?23:e.type==='fighter'?14:e.type==='flanker'?13:10;
    op.hp=Math.max(0,op.hp-damage);
    e.relayChargeUntil=0;e.relayCooldownUntil=this.time+3.1;
    this.flash(e.x,e.y,op.x,op.y,'#ffb585');
    this.heritage.play(e.type==='gunship'?'rocket':'damage',.2,{x:e.x,y:e.y});
    if(op.hp<=RELAY_DEFENSE.maxHp*.35&&!op.criticalWarned){
     op.criticalWarned=true;
     this.notice('ТРЕВОГА: ретранслятор повреждён! Перехватывайте заряжающиеся корабли.',4);
    }
   }
  }
  if(op.hp<=0){this.failRelayDefense(op);return;}
  if(!surviving){
   if(op.wave>=RELAY_DEFENSE.waves.length){this.completeRelayDefense(op);return;}
   op.phase='intermission';op.nextAt=this.time+RELAY_DEFENSE.intermission;
   this.notice('Волна '+op.wave+'/3 отражена. Передышка '+RELAY_DEFENSE.intermission+
    ' секунд — выберите позицию для следующего перехвата.',4.3);
  }
 }
 failRelayDefense(op){
  if(this.operation!==op)return;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  const base=this.world.stations.get(op.baseId);
  if(base){base.relayMission=null;base.relayRetryAt=this.time+45;}
  this.enemies=this.enemies.filter(e=>e.relayAssault!==op.baseId);
  this.operation=null;
  if(this.waypoint?.id===RELAY_DEFENSE.id)this.waypoint=null;
  this.heritage.vfx.nova(op.x,op.y,125,'red');
  this.notice('Ретранслятор потерян. Арсенал цел; повторить оборону можно через 45 секунд.',5);
 }
 completeRelayDefense(op){
  const base=this.world.stations.get(op.baseId);
  if(!base||base.relayDefenseDone||this.operation!==op)return;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  base.relayDefenseDone=true;base.relayMission=null;this.operation=null;
  if(this.waypoint?.id===RELAY_DEFENSE.id)this.waypoint=null;
  const next=chooseOperationLead(this.world,op,base.id,'carrier',2500);
  if(next){next.discovered=true;this.world.discovered.add(next.id);
   if(!this.waypoint)this.waypoint={id:next.id,x:next.x,y:next.y,
    label:baseNames[next.type]||'Станция'};}
  this.player.ore+=RELAY_DEFENSE.rewardOre;
  recordSortieIncome(this,'ore','operation',RELAY_DEFENSE.rewardOre);
  this.cockpit.resourceGain(RELAY_DEFENSE.rewardOre,this.time);
  this.collect({type:'data',value:RELAY_DEFENSE.rewardData});
  recordSortieIncome(this,'data','operation',RELAY_DEFENSE.rewardData);
  this.heritage.vfx.nova(op.x,op.y,130,'green');
  this.heritage.station('claimContract',base.type);
  this.notice('РЕТРАНСЛЯТОР ЗАЩИЩЁН! +'+RELAY_DEFENSE.rewardOre+' сплава, +'+
   RELAY_DEFENSE.rewardData+' данных.'+(next?' На карте отмечен следующий узел.':''),5.5);
 }

  // A carrier operation begins only when the player reaches the contact area.
  // Cargo coordinates are shared by navigation, combat and rendering.
  updateCarrierInterception(dt){
   const op=this.operation;
   if(!op||op.id!==CARRIER_INTERCEPTION.id||this.dead)return;
   if(op.phase==='return')return;
   if(op.phase==='approach'){
    if(dist(this.player,op)>CARRIER_INTERCEPTION.triggerRange)return;
    op.phase='contact';op.contactAt=this.time;
    op.serial=++this.enemySerial;op.group=++this.groupSerial;
    op.fire=999;op.damage=0;op.state='transit';op.think=999;
    op.target=this.player;op.protect=null;op.entryPortalPending=false;
    this.enemies.push(op);
    this.spawnCarrierEscort(op,'fighter',0);
    this.spawnCarrierEscort(op,'scout',1);
    this.notice('Конвой обнаружен! Нос бронирован, двигатели уязвимы с кормы. Повредите их, чтобы замедлить груз.',5);
   }
   if(!carrierInFlight(op))return;
   const events=advanceCarrierSystems(op,dt);
   const result=moveCarrierCargo(op,dt);
   // A massive transport fractures small asteroids instead of passing through
   // their artwork. Hostile destruction yields neither alloy nor mining credit.
   for(const rock of this.world.nearbyRocks(op.x,op.y,110)){
    if(rock.alive&&dist(rock,op)<rock.r+op.r+8)
     this.damageRock(rock,rock.hp,op.x,op.y,'cover');
   }
   if(events.boostWarning)this.notice('Транспорт готовит форсаж! Заходите на корму: попадания по двигателям замедляют груз.',3.5);
   if(events.pulseWarning){
    this.heritage.play('ramWarning',1.8,{x:op.x,y:op.y});
    this.notice('КРУГОВОЙ РАЗРЯД: выйдите за отмеченные 230 м. После разряда броня откроется на 3 секунды.',3.5);
   }
   if(events.discharge){
    this.heritage.vfx.nova(op.x,op.y,CARRIER_INTERCEPTION.pulseRange,'violet');
    this.heritage.play('carrierPulse',.3,{x:op.x,y:op.y});
    if(dist(this.player,op)<=CARRIER_INTERCEPTION.pulseRange)this.hurt(CARRIER_INTERCEPTION.pulseDamage,op);
   }
   // Updating our own target leaves a manually selected station route untouched.
   if(this.waypoint?.id===CARRIER_INTERCEPTION.id){
    this.waypoint.x=op.x;this.waypoint.y=op.y;
   }
   if(!op.warningSent&&op.routeIndex===0&&
      dist(op,op.route[1])<=CARRIER_INTERCEPTION.warningDistance){
    op.warningSent=true;
    this.notice('Конвой готовится изменить курс. Срезайте угол и держите его в дальности оружия!',4.5);
   }
   if(result.turned&&!op.reinforcementSent){
    op.phase='turn';op.reinforcementSent=true;
    this.spawnCarrierEscort(op,'flanker',2);
    this.notice('Конвой сменил курс! К выходу подтягивается последний перехватчик.',4);
   }
   const remaining=carrierDistanceRemaining(op);
   if(remaining<=CARRIER_INTERCEPTION.lastChanceDistance&&!op.lastChanceSent){
    op.phase='last';op.lastChanceSent=true;
    this.notice('ПОСЛЕДНИЙ ШАНС: до выхода груза '+Math.ceil(remaining)+' м. Сблизьтесь для атаки!',5);
   }else if(op.phase==='contact'&&this.time-op.contactAt>=4){
    op.phase='pursuit';
   }
   if(result.escaped)this.failCarrierInterception(op);
  }
  spawnCarrierEscort(op,type,index){
   if(this.enemies.length>=RULES.maxEnemies)return false;
   const def=ENEMY_TYPES[type];if(!def)return false;
   const angles=[-.95,1.18,2.6],angle=angles[index]??0;
   let x=op.x+Math.cos(angle)*115,y=op.y+Math.sin(angle)*115;
   for(let step=0;step<7;step++){
    const a=angle+step*TAU/7,px=op.x+Math.cos(a)*115,py=op.y+Math.sin(a)*115;
    if(!this.world.nearbyRocks(px,py,55).some(r=>r.alive&&dist(r,{x:px,y:py})<r.r+22)){
     x=px;y=py;break;
    }
   }
   const serial=++this.enemySerial;
   this.enemies.push({serial,group:++this.groupSerial,type,
    x,y,vx:0,vy:0,r:14,hp:def.hp,maxHp:def.hp,damage:def.dmg,
    think:.12+index*.08,fire:1.15,state:'hunt',commitUntil:0,target:this.player,
    angle:0,hit:0,expAwarded:false,scenario:'carrier-escort',protect:op,
    carrierEscort:op.baseId,operationGuard:true,fieldChargeOperation:this.operation?.id,fieldChargeBaseId:this.operation?.baseId,entryPortalPending:false});
   op.escortSerials.push(serial);
   return true;
  }
  failCarrierInterception(op){
   if(this.operation!==op||op.phase==='return')return;
   finishFieldAssignment(this.fieldLoan,'operation',op);
   const base=this.world.stations.get(op.baseId);
   if(base){base.carrierMission=null;base.carrierRetryAt=this.time+CARRIER_INTERCEPTION.retryDelay;}
   this.enemies=this.enemies.filter(e=>e!==op&&e.carrierEscort!==op.baseId);
   this.operation=null;
   if(this.waypoint?.id===CARRIER_INTERCEPTION.id)this.waypoint=null;
   this.heritage.vfx.nova(op.x,op.y,72,'red');
   this.notice('Груз ушёл через обозначенную границу. Награда не выдана. Повторите попытку на авианосце через 35 секунд.',6);
  }
  completeCarrierInterception(op){
   if(this.operation!==op||!carrierInFlight(op))return;
   const base=this.world.stations.get(op.baseId);
   if(!base)return;
   op.phase='return';op.hp=0;op.vx=0;op.vy=0;
   this.enemies=this.enemies.filter(e=>e!==op);
   this.waypoint={id:CARRIER_INTERCEPTION.id,x:base.x,y:base.y,
    label:'Вернуться на авианосец с телеметрией'};
   this.heritage.vfx.shipExplosion(op.x,op.y,64,'#ffc47d',true);
   this.heritage.vfx.nova(op.x,op.y,114,'red');
   this.heritage.play('largeExplosion',.22,{x:op.x,y:op.y});
   this.notice('ГРУЗ ПЕРЕХВАЧЕН! Доставьте телеметрию на авианосец (E), чтобы получить награду и ослабить патрули.',6);
  }
  deliverCarrierInterception(){
   const op=this.operation;
   if(!op||op.id!==CARRIER_INTERCEPTION.id||op.phase!=='return')return;
   const base=this.world.stations.get(op.baseId);
   if(!base||base.supplyIntercepted)return;
   finishFieldAssignment(this.fieldLoan,'operation',op);
   base.supplyIntercepted=true;base.carrierMission=null;this.operation=null;
   if(this.waypoint?.id===CARRIER_INTERCEPTION.id)this.waypoint=null;
   this.player.ore+=CARRIER_INTERCEPTION.rewardOre;
   recordSortieIncome(this,'ore','operation',CARRIER_INTERCEPTION.rewardOre);
   this.cockpit.resourceGain(CARRIER_INTERCEPTION.rewardOre,this.time);
   this.collect({type:'data',value:CARRIER_INTERCEPTION.rewardData});
   recordSortieIncome(this,'data','operation',CARRIER_INTERCEPTION.rewardData);
   this.spawnClock=Math.max(this.spawnClock||0,10);
   this.heritage.vfx.nova(base.x,base.y,132,'green');
   this.heritage.station('claimContract',base.type);
   this.notice('СНАБЖЕНИЕ ПЕРЕХВАЧЕНО! +38 сплава, +30 данных. Вдоль маршрута вражеские патрули станут реже.',6);
  }

 // After a successful intercept, the telemetry is valuable only when delivered.
 // Pursuers can be fought or outrun; they are not mandatory kill targets.
 updateCorridorReturn(op){
  const base=this.world.stations.get(op.baseId);
  if(!base||op.pursuitStarted||dist(this.player,base)>900)return;
  op.pursuitStarted=true;
  const angle=Math.atan2(this.player.y-base.y,this.player.x-base.x);
  let spawned=0;
  for(const spec of [{type:'scout',back:255,side:-85},{type:'fighter',back:325,side:100}]){
   if(this.enemies.length>=RULES.maxEnemies)break;
   const def=ENEMY_TYPES[spec.type];if(!def)continue;
   const x=this.player.x+Math.cos(angle)*spec.back-Math.sin(angle)*spec.side;
   const y=this.player.y+Math.sin(angle)*spec.back+Math.cos(angle)*spec.side;
   if(this.world.nearbyRocks(x,y,70).some(rock=>rock.alive&&Math.hypot(x-rock.x,y-rock.y)<rock.r+35))continue;
   const hp=def.hp*(1+Math.min(1,this.time/900));
   this.enemies.push({serial:++this.enemySerial,group:++this.groupSerial,
    type:spec.type,x,y,vx:0,vy:0,r:14,hp,maxHp:hp,
    damage:def.dmg,think:.12,fire:1.2,state:'hunt',commitUntil:0,
    target:this.player,angle:0,hit:0,expAwarded:false,
    scenario:'corridor-pursuit',protect:null,operationGuard:true,fieldChargeOperation:this.operation?.id,fieldChargeBaseId:this.operation?.baseId});
   spawned++;
  }
  if(spawned)this.notice('Бортовой ИИ: преследователи на обратном маршруте. Сражайтесь или уходите к доку на форсаже!',5);
 }

 // A tangible, single-use operation: a jammer, an EMP duel, and a return leg.
 updateCorridor(dt=0){
  const op=this.operation;
  if(!op||op.id!==CORRIDOR_OPERATION.id||this.dead)return;
  if(op.phase==='return'){this.updateCorridorReturn(op);return;}
  if(op.hp<=0)return;
  const d=dist(this.player,op);
  // The actual charge controls warnings; after discharge there is a tactical window.
  if(this.time<(op.overheatedUntil||0)){
   op.pulseCharge=0;op.pulseLocked=false;
  }else if(d<=CORRIDOR_OPERATION.pulseRange||op.pulseLocked){
   op.pulseCharge=Math.min(CORRIDOR_OPERATION.pulsePeriod,(op.pulseCharge||0)+Math.max(0,dt));
   if(op.pulseCharge>=CORRIDOR_OPERATION.pulsePeriod*.28)op.pulseLocked=true;
   if(!op.pulseWarned&&op.pulseCharge>.25){
    op.pulseWarned=true;
    this.notice('Бортовой ИИ: глушитель заряжает ЭМ-импульс. Выйдите за 315 м.',3.5);
   }
   if(op.pulseCharge>=CORRIDOR_OPERATION.pulsePeriod){
    op.pulseCharge=0;
    op.pulseLocked=false;op.pulseWarned=false;
    op.pulseFlashUntil=this.time+.55;
    op.overheatedUntil=this.time+2.3;
    this.heritage.vfx.nova(op.x,op.y,180,'cyan');
    this.heritage.play?.('damage',.27);
    if(d<=CORRIDOR_OPERATION.pulseRange)
     this.hurt(CORRIDOR_OPERATION.pulseDamage,{x:op.x,y:op.y});
    this.notice('Бортовой ИИ: разряд! Глушитель перегревается — сейчас его защита слабее.',2.7);
   }
  }else{
   op.pulseCharge=Math.max(0,(op.pulseCharge||0)-Math.max(0,dt)*1.5);
   if(op.pulseCharge<=.01)op.pulseWarned=false;
  }
  if(d>op.escortTrigger&&op.hp>=op.maxHp)return;
  if(!op.guardsSpawned){
   const first=this.spawnCorridorGuard('scout',0);
   if(first)this.spawnCorridorGuard('fighter',1);
   if(first){
    op.guardsSpawned=true;op.reinforcementsAt=this.time+32;
    this.notice('Передатчик передаёт сигнал тревоги. Уничтожьте его, чтобы остановить подкрепления.',3.8);
   }
  }else if(op.waves<1&&this.time>=op.reinforcementsAt){
   if(this.spawnCorridorGuard('fighter',2)){
    op.waves++;this.notice('Глушитель вызвал подкрепление!',2.8);
   }
  }
 } spawnCorridorGuard(type,index){
  if(this.enemies.length>=RULES.maxEnemies)return false;
  const op=this.operation;if(!op)return false;
  const def=ENEMY_TYPES[type];if(!def)return false;
  const angle=[-1.15,1.12,2.55][index]??0,offset=125+index*34;
  let x=op.x+Math.cos(angle)*offset,y=op.y+Math.sin(angle)*offset;
  // Do not place an escort inside a procedurally generated asteroid.
  for(let step=0;step<7;step++){
   const a=angle+step*TAU/7;
   const px=op.x+Math.cos(a)*offset,py=op.y+Math.sin(a)*offset;
   if(!this.world.nearbyRocks(px,py,55).some(rock=>dist(rock,{x:px,y:py})<rock.r+24)){
    x=px;y=py;break;
   }
  }
  const hp=def.hp*(1+Math.min(1,this.time/900));
  this.enemies.push({serial:++this.enemySerial,group:++this.groupSerial,type,
   x,y,vx:0,vy:0,
   r:14,hp,maxHp:hp,damage:def.dmg,think:.12+index*.09,fire:1.2,
   state:'hunt',commitUntil:0,target:this.player,angle:0,hit:0,
   expAwarded:false,scenario:'corridor-escort',protect:null,
   operationGuard:true,fieldChargeOperation:this.operation?.id,fieldChargeBaseId:this.operation?.baseId});
  return true;
 }
 completeCorridor(){
  const op=this.operation;
  if(!op||op.id!==CORRIDOR_OPERATION.id||op.phase==='return')return;
  const base=this.world.stations.get(op.baseId);if(!base)return;
  op.phase='return';op.hp=0;op.pulseCharge=0;op.pulseLocked=false;
  this.waypoint={id:CORRIDOR_OPERATION.id,x:base.x,y:base.y,label:'Вернуться с телеметрией в док'};
  this.heritage.vfx.shipExplosion(op.x,op.y,55,'#b876ff');
  this.heritage.vfx.nova(op.x,op.y,160,'green');
  this.notice('Глушитель отключён. Телеметрия сохранена! Вернитесь в домашний док (E) за наградой. Возможна погоня.',6);
 }
 deliverCorridor(){
  const op=this.operation;
  if(!op||op.id!==CORRIDOR_OPERATION.id||op.phase!=='return')return;
  const base=this.world.stations.get(op.baseId);if(!base||base.corridorSecured)return;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  base.corridorSecured=true;base.corridorMission=null;this.operation=null;
  if(this.waypoint?.id===CORRIDOR_OPERATION.id)this.waypoint=null;
  // The reclaimed corridor yields a lead to the next station, not free resources.
  const nextStation=chooseOperationLead(this.world,op,base.id,'lab',2400);
  if(nextStation){
   nextStation.discovered=true;
   this.world.discovered.add(nextStation.id);
   if(!this.waypoint)this.waypoint={id:nextStation.id,x:nextStation.x,y:nextStation.y,
    label:baseNames[nextStation.type]||'Станция'};
  }
  this.player.ore+=CORRIDOR_OPERATION.rewardOre;
  recordSortieIncome(this,'ore','operation',CORRIDOR_OPERATION.rewardOre);
  this.cockpit.resourceGain(CORRIDOR_OPERATION.rewardOre,this.time);
  this.collect({type:'data',value:CORRIDOR_OPERATION.rewardData});
  recordSortieIncome(this,'data','operation',CORRIDOR_OPERATION.rewardData);
  this.heritage.vfx.nova(base.x,base.y,130,'green');
  this.heritage.station('claimContract',base.type);
  this.notice('КОРИДОР ОТКРЫТ! +'+CORRIDOR_OPERATION.rewardOre+' сплава, +'+CORRIDOR_OPERATION.rewardData+
   ' данных. Патрулей у дока станет меньше. В ангаре открыт чертёж рельса: изготовление — 36 сплава.'+
   (nextStation?' На карте отмечена станция: '+(baseNames[nextStation.type]||'неизвестная')+'.':''),6);
 }

 // The player chooses between repairing under fire and releasing E to fight.
 repairProbe(dt){
  const op=this.operation;
  if(!op||op.id!==PROBE_OPERATION.id||this.dead)return;
  op.repair=Math.min(PROBE_OPERATION.maxRepair,op.repair+PROBE_OPERATION.repairPerSecond*dt);
  if(!op.waves&&op.repair>=30){
   op.waves=1;
   this.spawnCorridorGuard('scout',0);
   this.spawnCorridorGuard('scout',1);
   this.notice('Зонд передал сигнал. Приближаются разведчики! Отпустите E, чтобы отбиться.',4);
  }else if(op.waves===1&&op.repair>=70){
   op.waves=2;
   this.spawnCorridorGuard('fighter',2);
   this.notice('Перехватчик вышел на сигнал зонда. Можно прервать ремонт и отступить.',4);
  }
  if(op.repair>=PROBE_OPERATION.maxRepair)this.completeProbe();
 }
 completeProbe(){
  const op=this.operation;
  if(!op||op.id!==PROBE_OPERATION.id)return;
  const base=this.world.stations.get(op.baseId);if(!base)return;
  finishFieldAssignment(this.fieldLoan,'operation',op);
  base.probeRecovered=true;base.probeMission=null;
  this.operation=null;this.probeRepairing=false;
  if(this.waypoint?.id===PROBE_OPERATION.id)this.waypoint=null;
  const next=chooseOperationLead(this.world,op,base.id,'arsenal',2300);
  if(next){
   next.discovered=true;this.world.discovered.add(next.id);
   if(!this.waypoint)this.waypoint={id:next.id,x:next.x,y:next.y,
    label:baseNames[next.type]||'Станция'};
  }
  this.player.ore+=PROBE_OPERATION.rewardOre;
  recordSortieIncome(this,'ore','operation',PROBE_OPERATION.rewardOre);
  this.cockpit.resourceGain(PROBE_OPERATION.rewardOre,this.time);
  this.collect({type:'data',value:PROBE_OPERATION.rewardData});
  recordSortieIncome(this,'data','operation',PROBE_OPERATION.rewardData);
  this.heritage.vfx.nova(op.x,op.y,105,'cyan');
  this.heritage.station('claimContract',base.type);
  this.notice('СИГНАЛ ВОССТАНОВЛЕН! +'+PROBE_OPERATION.rewardOre+' сплава, +'+
   PROBE_OPERATION.rewardData+' данных. Местная разведка усилена.'+
   (next?' Отмечен новый узел сети.':''),5.5);
 }
 syncShipLoadout(){
  if(!this.shipLoadout)return;
  const available=id=>MODULES[id]?.kind!=='manual'||!!matchingFieldLoan({fieldLoan:this.fieldLoan},id);
  this.shipLoadout.slots=this.shipLoadout.slots.map(id=>available(id)?id:null);
  if(this.hangarSession?.draft)this.hangarSession.draft.slots=this.hangarSession.draft.slots.map(id=>available(id)?id:null);
  this.weaponProfile=loadoutProfile(this.shipLoadout);
   if(!this.weaponProfile.rail){this.manualRailMode=false;this.canvas?.classList?.remove('rail-manual');}
  if(!this.weaponProfile.resonator)this.fieldEffects=[];
  this.player.weaponSlots=this.shipLoadout.slots;
 }
 suggestShipModule(id){
  return stageOwnedModule(this.shipLoadout,this.hangarSession,id,{baseActive:!!this.docked?.active,
   level:this.player.level,ore:this.player.ore,ranks:this.skillRanks,fieldLoan:this.fieldLoan,
   loadout:this.shipLoadout,firstHardwareReward:this.firstHardwareReward,earlyRail:!!this.world.home?.corridorSecured});
 }
 revealLoadoutApply(){
  this.overlay.querySelector('.hg-apply-bar')?.scrollIntoView({block:'center'});
  this.overlay.querySelector('[data-act="hgApply"]')?.focus({preventScroll:true});
 }
 hangarUpgrades(){
  return SKILLS.filter(s=>SHIP_UPGRADES.has(s.id)).map(s=>{
   const rank=this.skillRanks[s.id],maxed=rank>=s.max;
   const reason=maxed?'Максимум':this.player.level<s.from?'Нужен уровень '+s.from:
    s.requires&&!this.skillRanks[s.requires]?'Сначала '+SKILLS.find(x=>x.id===s.requires).title:
    !this.player.points?'Нужно очко развития':'Изучить · 1 очко';
   return {...s,rank,effect:maxed?'Изучено полностью':nextSkillEffect(s.id,rank,this.skillRanks),
    reason,canBuy:!maxed&&this.player.level>=s.from&&(!s.requires||this.skillRanks[s.requires])&&this.player.points>0};
  });
 }
 hangarAction(data){
  if(this.dead||!this.paused||this.overlay.hidden||this.overlay.dataset.mode!=='base'||
   this.baseTab!=='hangar'||!this.docked?.active)return;
  if(data.act==='hgUpgrade'){this.buySkill(data.id);return;}
  const result=this.hangarSession.dispatch(data,{loadout:this.shipLoadout,level:this.player.level,
   ore:this.player.ore,points:this.player.points,activeBases:this.activeBases,
   ranks:this.skillRanks,fieldLoan:this.fieldLoan,baseActive:this.docked.active,
   firstHardwareReward:this.firstHardwareReward,earlyRail:!!this.world.home?.corridorSecured});
  if(result?.ok){
   recordEconomyExpense(this,'weapons',Math.max(0,this.player.ore-result.ore));
   this.shipLoadout=result.loadout;this.player.ore=result.ore;
   if(result.type==='specialization')this.player.points=result.points;
   this.syncShipLoadout();
   this.heritage.ui('upgrade');
  }else this.heritage.ui('tab');
  this.renderDock();
  const selector='[data-act="'+data.act+'"]'+(data.id?'[data-id="'+data.id+'"]':'');
  const focus=this.overlay.querySelector(selector);
  if(focus&&!focus.disabled)focus.focus({preventScroll:true});
  if(data.act==='hgInstall'||data.act==='hgRemove')this.revealLoadoutApply();
  if(data.act==='hgSelect'){
   const choice=this.overlay.querySelector('.hg-inspector [data-act="hgInstall"]:not(:disabled)')||
    this.overlay.querySelector('.hg-inspector [data-act="hgCatalog"]');
   choice?.focus({preventScroll:true});
  }
  if((this.isTouchLayout||(typeof matchMedia==='function'&&matchMedia('(max-width:700px)').matches))&&
   ['hgSlot','hgShip','hgInstall','hgSelect','hgCatalog'].includes(data.act)){
   this.overlay.querySelector('.base-dialog').scrollTop=0;
  }
 }
 updateShipWeapons(dt){
  updateAutomaticWeapons(this,dt,!this.heavyCharge&&automaticFireAllowed(this.holdFire,
   this.mining.active,this.probeRepairing||this.openingRepairing));
 }
  toggleManualRail(){
   if(this.dead||this.paused||!this.overlay.hidden)return false;
   if(!precisionRailUnlocked(this.world)){
    this.notice('Ручной прицел откроется после включения или захвата арсенала. Затем установите рельсовое орудие в ангаре.',5);return false;
   }
   if(!this.weaponProfile.rail){this.notice('Ручной прицел открыт. Установите рельсовое орудие в ангаре.',4);return false;}
   this.manualRailMode=!this.manualRailMode;
   this.canvas?.classList?.toggle('rail-manual',this.manualRailMode);
   this.notice(this.manualRailMode?
    'РЕЛЬС · РУЧНОЙ РЕЖИМ. Нажмите на цель или точку выстрела. Остальные орудия работают автоматически.':
    'РЕЛЬС · АВТООГОНЬ. Нажатие на врага снова назначает приоритетную цель.',4);
   this.heritage.ui('tab');this.hud();return true;
  }
  fireManualRailAt(point){
   if(this.dead||this.paused||!this.overlay.hidden||this.openingRepairing||
    this.actionHeld?.kind==='opening-repair')return false;
   const result=fireAimedRail(this,point);
   if(!result.ok){this.notice(result.reason,2);return false;}
   this.notice(result.hits?'ТОЧНЫЙ ВЫСТРЕЛ · попадание'+(result.hits>1?' ×'+result.hits:''):
    result.rocksHit?'Выстрел перехвачен астероидом':'Рельсовый выстрел прошёл мимо цели',1.6);
   this.hud();return true;
  }
 callHowitzer(){
  if(this.dead||this.paused||!this.overlay.hidden||this.mining.active||
   this.probeRepairing||this.openingRepairing||this.actionHeld?.kind==='opening-repair')return false;
  const plan=planHowitzer(this);
  if(!plan.ok){this.notice(plan.reason,2.8);return false;}
  this.heavyCharge=plan.charge;this.heritage.play('rocket',.2);this.hud();return true;
 }
 baseState(){
  const topology=this.world.networkTopology();
  return {loadout:this.shipLoadout,hangarSession:this.hangarSession,skillRanks:this.skillRanks,points:this.player.points,hangarUpgrades:this.hangarUpgrades(),ore:this.player.ore,data:this.player.data,xp:this.player.xp,level:this.player.level,
   firstHardwareReward:this.firstHardwareReward,
   nextXp:expForNext(this.player.level),world:this.world,hp:this.player.hp,maxHp:this.player.maxHp,time:this.time,
   civilianBases:[...this.world.stations.values()].filter(b=>b.active&&!b.captured).length,
   relayGain:this.docked&&!this.docked.relayBoost?
    Math.max(0,this.world.networkTopology(this.docked.id).count-topology.count):0,
   activeBases:this.activeBases,connectedBases:topology.count,
   connected:!!this.docked?.active&&topology.linked.has(this.docked.id),
   allies:this.allies.length,droneRoles:this.allies.map(a=>a.role),network:this.network,doctrine:this.doctrine,
   droneDamage:this.allies.reduce((sum,a)=>sum+Math.max(0,a.maxHp-a.hp),0),
   charges:this.support.charges,contract:this.contract,operation:this.operation,baseTab:this.baseTab,
   sortieReports:this.sortieReports,economyExpenses:this.economyExpenses,
   lastContractReceipt:this.lastContractReceipt,
    fieldLoan:this.fieldLoan,fieldTrialTaken:this.fieldTrialTaken,fieldTrialPickerOpen:!!this.fieldTrialPickerOpen,
    earlyRail:!!this.world.home?.corridorSecured,
    fieldReturnNotice:this.time-this.fieldReturnAt<6,
    position:{x:this.player.x,y:this.player.y},shield:this.player.shield,
   scanRemaining:Math.max(0,this.geoScanUntil-this.time),
   overchargeRemaining:Math.max(0,this.overchargeUntil-this.time),
   transfers:this.docked&&this.docked.active&&topology.linked.has(this.docked.id)?
    [...topology.linked].map(id=>this.world.stations.get(id))
     .filter(b=>b&&b.id!==this.docked.id)
     .map(b=>({id:b.id,x:b.x,y:b.y,type:b.type})):[]};
 }
 renderDock(){
  if(!this.docked)return;
  const focusIdentity=captureMenuControl(this.overlay);
  this.pendingStationModule=null;
  if(this.fieldLoan?.returnDue)this.returnBorrowedWeapon();
  this.syncShipLoadout();
  const view=captureHangarView(this.overlay);
  const checkpointNote=this.saveAtStation();
  this.overlay.innerHTML=renderBasePanel(this.docked,{...this.baseState(),checkpointNote});
  restoreHangarView(this.overlay,view);
  this.presentMenu();
  restoreMenuControl(this.overlay,focusIdentity,'[data-act="baseTab"][aria-selected="true"]');
  this.hud();
 }
 returnBorrowedWeapon(){
  this.fieldLoan=null;this.fieldReturnAt=this.time;this.syncShipLoadout();
 }
 offerContinuation(saved){
  this.pendingCheckpoint=saved;this.paused=true;this.pausedRenderPending=true;
  this.overlay.dataset.mode='run-start';this.overlay.hidden=false;this.heritage.pause('base');
  const base=saved?.world.stations.find(([id])=>id===saved.baseId)?.[1];
  const p=saved?.state.player;
  this.overlay.innerHTML='<div class="dialog" role="dialog" aria-modal="true" aria-label="Сохранённый вылет">'+
   '<h2>'+(saved?'Продолжить вылет?':'Сохранённый вылет недоступен')+'</h2><p>'+
   (saved?(baseNames[base.type]||'Станция')+' · уровень '+p.level+' · сплав '+p.ore+' · данные '+p.data:
    this.runStore?.issue==='unsupported'?'Этот вылет сохранён более новой версией игры. Прежняя запись останется; новый вылет в этой версии можно начать без сохранений.':
     'Не удалось прочитать контрольную точку. Можно начать новый вылет.')+'</p><p>'+
   'Прогресс сохраняется на активных станциях и после подготовки корабля. Продолжение возвращает к последней контрольной точке. После гибели начинается новый вылет.</p>'+
   (saved?'<button data-act="runContinue">Продолжить со станции</button><p>Новый вылет заменит это сохранение.</p>':'')+
   '<button data-act="runNew">Новый вылет</button></div>';
  this.presentMenu('[data-act="'+(saved?'runContinue':'runNew')+'"]');
 }
 continueRun(){
  if(!this.pendingCheckpoint)return;
  try{restoreCheckpoint(this,this.pendingCheckpoint);}
  catch{this.notice('Сохранённый вылет не удалось восстановить. Запись оставлена без изменений.',6);return;}
  this.precisionRailAvailable=precisionRailUnlocked(this.world);
  this.manualRailMode=false;
  this.canvas?.classList?.remove('rail-manual');
  // Existing saves predate the reward: preserve their contract progress and
  // offer the choice once instead of requiring another completed contract.
  if(this.firstHardwareReward==null&&[...this.world.stations.values()].some(b=>
   (b.contractRuns||0)>0||b.contractClaimed||b.completedContract))this.firstHardwareReward='pending';
  this.visuals.updateSky(this.player.x,this.player.y);
  this.nearRocks=this.world.nearbyRocks(this.player.x,this.player.y,Math.max(this.vw,this.vh)*.85+450);
  this.localStations=this.world.nearbyStations(this.player.x,this.player.y,1000,false);
  this.pendingCheckpoint=null;this.syncShipLoadout();this.hangarSession.begin(this.shipLoadout);
  this.baseTab='summary';this.overlay.dataset.mode='base';this.overlay.hidden=false;
  this.stationExitArmed=true;
  this.heritage.pause('base');this.renderDock();
  this.notice('Вылет продолжен с последней стыковки.',4);
 }
 saveAtStation(){
  if(!this.runStore||this.dead||!this.paused||!this.docked?.active||this.docked.enemy||
   dist(this.player,this.docked)>RULES.baseInteract||this.overlay.dataset.mode==='run-start')return '';
  let result;
  try{result=this.runStore.save(captureCheckpoint(this,this.docked));}
  catch{result={ok:false,reason:'invalid'};}
  if(result.ok)return 'Вылет сохранён на этой станции. После перезагрузки продолжите отсюда.';
  if(result.reason==='conflict')return 'Вылет изменён в другой вкладке. Эта вкладка не перезаписывает сохранение; для продолжения перезагрузите игру.';
  if(result.reason==='unsupported')return 'Прежнее сохранение оставлено без изменений. Этот вылет пока не сохраняется.';
  return 'Не удалось сохранить вылет. Чтобы продолжить его, оставьте эту вкладку открытой.';
 }
 nearestInteractionStation(){
  let nearest=null,closest=RULES.baseInteract;
  for(const b of this.localStations){
   if(b.enemy)continue;
   const d=dist(b,this.player);
   if(d<=closest){closest=d;nearest=b;}
  }
  return nearest;
 }
 currentInteraction(){
  const arc=this.openingArc;
  if(openingArcActive(arc)&&arc.kind==='rescue'&&
   Math.hypot(this.player.x-arc.rescueX,this.player.y-arc.rescueY)<=OPENING_ARC.repairRange)
   return {kind:'opening-repair',target:{x:arc.rescueX,y:arc.rescueY},
    label:'Эвакуация',hold:true};
  const probe=this.operation?.id===PROBE_OPERATION.id?this.operation:null;
  const rock=this.mining.target;
  const range=extractorStats(this.skillRanks.extractor||0,this.skillRanks.mining||0).range;
  return chooseInteraction({player:this.player,probe,station:this.nearestInteractionStation(),
   rock,probeRange:PROBE_OPERATION.repairRange,
   stationRange:RULES.baseInteract,rockRange:range+(rock?.r||0)*.3});
 }
 beginInteraction(source){
  if(this.dead||this.paused||!this.overlay.hidden||this.actionHeld)return false;
  const action=this.currentInteraction();
  if(!action)return false;
  if(action.kind==='station'){this.dock(action.target);return true;}
  this.heavyCharge=null;
  this.actionHeld={kind:action.kind,source,target:action.target};
  return true;
 }
 endInteraction(source=null){
  if(!this.actionHeld)return;
  if(source&&this.actionHeld.source!==source)return;
  this.actionHeld=null;this.probeRepairing=false;this.openingRepairing=false;this.mining.active=false;
  this.heritage.extraction(false);
 }
 toggleHoldFire(){
  if(this.dead||this.paused||!this.overlay.hidden)return;
  this.holdFire=!this.holdFire;
  this.heritage.ui('tab');
  this.notice(this.holdFire?
   'Автоогонь выключен: корабль и ведомые прекращают атаки; оружие остывает быстрее. Добыча по-прежнему создаёт сигнал.':
   'Автоогонь включён: корабль и ведомые вновь защищаются.',3.8);
  this.hud();
 }
 syncControlUI(){
  const button=$('actionBtn');
  if(button){
   const focus=this.actionHeld||this.interactionFocus;
   const label=focus?.kind==='repair'?'Ремонт':focus?.kind==='mine'?'Добыча':
    focus?.kind==='opening-repair'?'Эвакуация':
    focus?.kind==='station'?'Станция':'Действие';
   if(button.textContent!==label)button.textContent=label;
   button.disabled=!focus;
   button.setAttribute('aria-label',focus?(focus.kind==='station'?'Открыть станцию':
    focus.kind==='opening-repair'?'Удерживать для эвакуации капсулы':
    focus.kind==='repair'?'Удерживать для ремонта зонда':'Удерживать для добычи'):'Нет объектов для взаимодействия');
  }
  const quiet=$('quietBtn');
  if(quiet){
   quiet.setAttribute('aria-pressed',String(this.holdFire));
   quiet.classList.toggle('is-quiet',this.holdFire);
   quiet.textContent=this.holdFire?'Огонь выкл.':'Огонь вкл.';
  }
  const hack=$('hackBtn');if(hack)hack.hidden=!this.hacks.length;
  const strike=$('strikeBtn');if(strike)strike.hidden=!(this.support?.charges>0);
   const ion=$('ionBtn'),spec=this.fieldLoan&&fieldWeapon(this.fieldLoan);
   const fitted=!!spec&&!!this.weaponProfile[spec.id];
   const ready=fitted&&this.fieldLoan.charges>0&&this.fieldLoan.cooldownUntil<=this.time;
   const fieldText=spec?spec.short+' · '+this.fieldLoan.charges+'/'+spec.capacity+
    (this.fieldLoan.cooldownUntil>this.time?' · зарядка '+Math.ceil(this.fieldLoan.cooldownUntil-this.time)+' с':' · Space'):'';
   if(ion){ion.hidden=!fitted;ion.disabled=!ready;ion.textContent=fieldText.replace(' · Space','');}
   const status=$('fieldWeaponStatus');if(status){
    const railText=this.manualRailMode?'РЕЛЬС: ручное прицеливание · R — авто · нажмите на цель':'';
    const text=[railText,fitted?fieldText:''].filter(Boolean).join(' · ');
    status.hidden=!text||this.paused||this.dead||!this.overlay.hidden;
    status.textContent=text;status.setAttribute('aria-label',text);
   }
   const precision=$('precisionBtn'),precisionAvailable=!!this.weaponProfile.rail&&
    (this.precisionRailAvailable??precisionRailUnlocked(this.world));
   if(precision){
    precision.hidden=!precisionAvailable;
    precision.setAttribute('aria-pressed',String(!!this.manualRailMode));
    precision.textContent=this.manualRailMode?'Рельс · руч.':'Рельс · авто';
    precision.setAttribute('aria-label',this.manualRailMode?
     'Перевести рельсовое орудие в автоматический режим':
     'Перевести рельсовое орудие в ручной режим прицеливания');
   }
   const heavy=$('heavyBtn');if(heavy){heavy.hidden=!this.weaponProfile.howitzer;
    heavy.disabled=!!this.heavyCharge||this.heavyCooldown>0||this.weaponThermal.locked;
    heavy.textContent=this.heavyCharge?'Подготовка…':this.heavyCooldown>0?'Гаубица · '+Math.ceil(this.heavyCooldown)+'с':'Гаубица';}
   const tip=$('tips');if(tip){
    const base='WASD / стрелки — полёт · E — действие · C — автоогонь · Shift — рывок · Q — код · B — авиаудар · Tab — карта · U — развитие';
    const hint=fitted?' · SPACE — '+fieldText.replace(' · Space',''):'';
    const heavyHint=this.weaponProfile.howitzer?' · F — ГАУБИЦА':'';
    const railHint=precisionAvailable?' · R — рельс '+(this.manualRailMode?'вручную (нажмите на точку)':'авто/вручную'):'';
    if(tip.textContent!==base+hint+heavyHint+railHint)tip.textContent=base+hint+heavyHint+railHint;
   }
  const skills=$('skillBtn');
  if(skills)skills.classList.toggle('has-points',this.player.points>0);
 }
 drawInteractionFocus(c,cam){
  const held=this.actionHeld;
  const focus=held?
   (held.kind==='mine'&&this.mining.target?.alive?
    {kind:'mine',target:this.mining.target,label:'Добыча'}:
    held.kind==='opening-repair'&&openingArcActive(this.openingArc)?
     {kind:'opening-repair',target:{x:this.openingArc.rescueX,y:this.openingArc.rescueY},label:'Эвакуация'}:
    held.kind==='repair'&&this.operation?.id===PROBE_OPERATION.id?
     {kind:'repair',target:this.operation,label:'Ремонт'}:null):this.interactionFocus;
  if(!focus?.target||outsideCamera(focus.target.x,focus.target.y,cam,85))return;
  const t=focus.target,r=focus.kind==='mine'?t.r+12:focus.kind==='station'?61:38;
  c.save();c.lineWidth=1.7;c.strokeStyle=['repair','opening-repair'].includes(focus.kind)?'#ffc678':
   focus.kind==='station'?'#87f0cf':'#7de5f5';
  c.setLineDash([7,6]);c.beginPath();c.arc(t.x,t.y,r,0,TAU);c.stroke();
  c.setLineDash([]);c.fillStyle='#c9f6f6';c.font='bold 12px system-ui';
  c.textAlign='center';
  if(!(focus.kind==='mine'&&this.mining.active))
   c.fillText(focus.label+(this.isTouchLayout?'':' · E'),t.x,t.y-r-13);
  c.restore();
 }
 drawOpeningBeacon(c,cam){
  const arc=this.openingArc;
  if(!openingArcActive(arc)||arc.kind!=='rescue'||
    outsideCamera(arc.rescueX,arc.rescueY,cam,105))return;
  const x=arc.rescueX,y=arc.rescueY;
  const glow=this.visuals.reducedMotion?0:Math.sin(this.time*3)*4;
  c.save();c.translate(x,y);
  c.fillStyle='#10283c';c.strokeStyle='#f4c17c';c.lineWidth=2.5;
  c.beginPath();c.roundRect(-30,-17,60,34,8);c.fill();c.stroke();
  c.fillStyle='#f9c887';c.fillRect(-12,-7,24,14);
  c.strokeStyle='#78f5de';c.lineWidth=2;
  c.beginPath();c.arc(0,0,44+glow,0,TAU);c.stroke();
  c.strokeStyle='#ffda92';c.lineWidth=4;
  c.beginPath();c.arc(0,0,53,-Math.PI/2,
   -Math.PI/2+TAU*(arc.repair/OPENING_ARC.repairSeconds));c.stroke();
  c.textAlign='center';c.font='bold 12px system-ui';c.fillStyle='#fff1d0';
  c.fillText('АВАРИЙНАЯ КАПСУЛА',0,-66);
  c.font='11px system-ui';
  c.fillText(Math.round(arc.repair/OPENING_ARC.repairSeconds*100)+'% · УДЕРЖИВАЙТЕ E',0,-51);
  c.restore();
  if(this.openingRepairing){
   c.save();c.strokeStyle='#83fbe4';c.lineWidth=3;
   c.beginPath();c.moveTo(this.player.x,this.player.y);c.lineTo(x,y);c.stroke();c.restore();
  }
 }
  dock(selected=null){
  if(this.dead)return;
  if(!this.overlay.hidden&&this.overlay.dataset.mode==='base'){this.dismiss();return;}
  const b=selected?
   (dist(selected,this.player)<=RULES.baseInteract?selected:null):
   this.world.nearbyStations(this.player.x,this.player.y,210,false)
    .filter(s=>dist(s,this.player)<=RULES.baseInteract)
    .sort((a,c)=>dist(a,this.player)-dist(c,this.player))[0];
  if(!b){this.heritage.ui('deny');this.notice('Подлетите ближе к станции (E)',2);return;}
  if(this.operation?.id===CORRIDOR_OPERATION.id&&this.operation.phase==='return'&&this.operation.baseId===b.id)this.deliverCorridor();
   if(this.operation?.id===CARRIER_INTERCEPTION.id&&this.operation.phase==='return'&&this.operation.baseId===b.id)this.deliverCarrierInterception();
   if(this.fieldLoan?.returnDue||(this.fieldLoan?.missionStarted&&!this.fieldLoan.assignment&&!this.operation&&!this.contract))this.returnBorrowedWeapon();
  const report=finishSortie(this.sortieStart,this,b);
  this.sortieReports=appendSortieReport(this.sortieReports,report);
  this.sortieStart=null;
  this.endInteraction();
  this.hangarSession?.begin(this.shipLoadout);
  this.fieldTrialPickerOpen=false;
  this.docked=b;this.baseTab='summary';this.paused=true;this.pausedRenderPending=true;
  this.stationExitArmed=true;
  this.heritage.pause('base');
  this.overlay.dataset.mode='base';this.overlay.hidden=false;
  this.heritage.ui('dock');
  this.renderDock();
 }
 askStationModule(role){
  this.pendingStationModule=null;
  this.overlay.querySelector('.base-module-confirm')?.remove();
  const base=this.docked,spec=base?stationModule(base.type,role):null;
  if(this.overlay.dataset.mode!=='base'||!base?.active||!spec||base.module||this.player.ore<spec.cost){
   this.heritage.ui('deny');this.notice('Недостаточно сплава или модуль уже выбран',2.5);return;
  }
  const container=this.overlay.querySelector('.base-modules');if(!container)return;
  const panel=document.createElement('aside');panel.className='base-module-confirm';
  panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-labelledby','base-module-confirm-title');
  panel.setAttribute('aria-describedby','base-module-confirm-desc');
  const heading=document.createElement('strong');heading.textContent='Подтвердить выбор: '+spec.name;
  heading.id='base-module-confirm-title';
  const explanation=document.createElement('p');explanation.textContent=spec.desc+' Стоимость: '+spec.cost+
   ' сплава. После установки изменить специализацию этой станции в этом прохождении нельзя.';
  explanation.id='base-module-confirm-desc';
  const buttons=document.createElement('div');
  const cancel=document.createElement('button');cancel.type='button';cancel.dataset.act='cancelModule';cancel.dataset.role=role;cancel.textContent='Вернуться к выбору';
  const confirm=document.createElement('button');confirm.type='button';confirm.dataset.act='confirmModule';confirm.dataset.role=role;confirm.className='base-decision-primary';confirm.textContent='Установить за '+spec.cost+' сплава';
  confirm.setAttribute('aria-describedby','base-module-confirm-desc');
  buttons.append(cancel,confirm);panel.append(heading,explanation,buttons);container.append(panel);
  this.pendingStationModule={baseId:base.id,role,cost:spec.cost};
  panel.scrollIntoView({block:'nearest'});
  // Keep focus on the safe choice: holding Enter on the first purchase button
  // must not accidentally accept the newly created, irreversible decision.
  cancel.focus({preventScroll:true});
 }
 confirmStationModule(role){
  const pending=this.pendingStationModule,base=this.docked;
  const panel=this.overlay.querySelector('.base-module-confirm');
  const spec=base?stationModule(base.type,role):null;
  if(this.overlay.dataset.mode!=='base'||!panel||!pending||!base||
   pending.baseId!==base.id||pending.role!==role||pending.cost!==spec?.cost){
   this.heritage.ui('deny');return false;
  }
  this.pendingStationModule=null;
  this.baseAction('installModule',role);
  return true;
 }
 cancelStationModule(role){
  this.pendingStationModule=null;
  this.overlay.querySelector('.base-module-confirm')?.remove();
  this.overlay.querySelector('[data-act="installModule"][data-role="'+role+'"]')?.focus({preventScroll:true});
 }
 baseAction(act,role){
  const b=this.docked,p=this.player;if(!b||this.dead)return;
  const o=baseOffer(b,this.baseState());
  if(act==='loanField'||act==='loanIon'){
   const id=act==='loanIon'?'ion':role,offer=fieldLoanOffer(b,this.baseState(),id);
   if(!offer||offer.mode==='return'||offer.reason){this.heritage.ui('deny');return;}
   p.ore-=offer.cost;
   recordEconomyExpense(this,'services',offer.cost);
   this.fieldLoan=createFieldLoan(id,b.id,this.time,missionAssignment(this.operation,this.contract));
   const suggested=this.suggestShipModule(id);
   if(offer.mode==='trial')this.fieldTrialTaken=true;
   this.fieldTrialPickerOpen=false;
   this.baseTab='hangar';
   const name=FIELD_WEAPONS[id].name;
   this.hangarSession.message=suggested?name+' добавлен в предварительную сборку. Нажмите «Применить».':
    name+' получен. Выберите свободный узел в ангаре и примените сборку.';
   this.notice(this.hangarSession.message,5);this.heritage.ui('upgrade');this.renderDock();
   if(suggested)this.revealLoadoutApply();return;
  }
  if(act==='returnField'||act==='returnIon'){
   if(!this.fieldLoan)return;
   const name=fieldWeapon(this.fieldLoan).name;this.returnBorrowedWeapon();
   this.notice(name+' возвращён на станцию',3.2);this.heritage.ui('dock');this.renderDock();return;
  }
  if(act==='fieldCharge'){
   const quote=refillQuote(this.fieldLoan,p.ore);
   if(!quote.ok){this.notice(quote.reason,2.5);this.heritage.ui('deny');return;}
   p.ore-=quote.cost;this.fieldLoan.charges=quote.charges;
   recordEconomyExpense(this,'services',quote.cost);
   this.notice(fieldWeapon(this.fieldLoan).short+': зарядов '+quote.charges+'/3 · −'+quote.cost+' сплава',3);
   this.heritage.ui('upgrade');this.renderDock();return;
  }
   if(act==='acceptOperation'){
   const corridor=isCorridorDock(b),probe=isProbeLab(b),relay=isRelayArsenal(b),carrier=isCarrierBase(b);
   if(!b.active||this.operation||(!corridor&&!probe&&!relay&&!carrier)||
    (corridor&&b.corridorSecured)||(probe&&b.probeRecovered)||
    (relay&&(b.relayDefenseDone||b.relayRetryAt>this.time))||
     (carrier&&(b.supplyIntercepted||b.carrierRetryAt>this.time))){
    this.heritage.ui('deny');this.notice('Особая операция сейчас недоступна',2.3);return;
   }
   this.operation=corridor?(b.corridorMission||createCorridorOperation(b)):
    probe?(b.probeMission||createProbeOperation(b,this.world)):
    relay?(b.relayMission||createRelayDefense(b,this.world)):
     (b.carrierMission||createCarrierInterception(b));
   if(!this.operation)return;
    bindFieldLoan(this.fieldLoan,missionAssignment(this.operation,this.contract));
   if(corridor)b.corridorMission=this.operation;
   else if(probe)b.probeMission=this.operation;
   else if(relay)b.relayMission=this.operation;
   else b.carrierMission=this.operation;
   const returning=(corridor||carrier)&&this.operation.phase==='return';
   this.waypoint={id:this.operation.id,x:returning?b.x:this.operation.x,y:returning?b.y:this.operation.y,
    label:returning?(carrier?'Вернуться на авианосец':'Вернуться с телеметрией в док'):
     corridor?'Вражеский глушитель':probe?'Аварийный зонд':relay?'Боевой ретранслятор':'Район перехвата груза'};
   this.baseTab='operations';
   if(returning){if(carrier)this.deliverCarrierInterception();else this.deliverCorridor();
    this.pausedRenderPending=true;this.renderDock();return;}
   this.heritage.station('acceptContract',b.type);
   this.notice(corridor?'«Глухой коридор»: цель отмечена на карте. Подготовьте корабль и вылетайте.':
    probe?'«Последний сигнал»: зонд отмечен. Подлетите и удерживайте E для ремонта; отпустите E, чтобы стрелять.':
    relay?'«Оборона ретранслятора»: подлетите к отмеченному узлу. Налёт начнётся после сближения.':
     '«Перехват снабжения»: найдите отмеченный район встречи. Груз тронется только при обнаружении.',5);
   this.pausedRenderPending=true;this.renderDock();return;
  }
  if(act==='antenna'){
   if(o.reasons.antenna){this.heritage.ui('deny');this.notice(o.reasons.antenna,2.6);return;}
   p.ore-=o.antennaCost;b.relayBoost=true;
   recordEconomyExpense(this,'stations',o.antennaCost);
   const topology=this.world.networkTopology();
   this.cachedNetworkLinked=topology.linked;
   this.defenseTopology=null;
   synchronizeStationDefenses(this.world,this.time,topology);
   this.notice('Антенна усилена · в сети '+topology.count+' станций',3.5);
   this.heritage.vfx.nova(b.x,b.y,105,'cyan');
   this.heritage.station('upgrade',b.type,{tech:'relay'});
   this.pausedRenderPending=true;this.renderDock();return;
  }
  if(act==='installModule'){
   const spec=stationModule(b.type,role);
   if(!b.active||!spec||b.module||p.ore<spec.cost){this.heritage.ui('deny');this.notice('Модуль недоступен: проверьте сплав и оснащение станции',3);return;}
   p.ore-=spec.cost;b.module=role;
   recordEconomyExpense(this,'stations',spec.cost);
   this.notice('Оснащение станции: '+spec.name+' · −'+spec.cost+' сплава',3.2);
   this.heritage.vfx.nova(b.x,b.y,96,'cyan');
   this.heritage.station('upgrade',b.type,{tech:'module'});
   this.pausedRenderPending=true;this.renderDock();return;
  }
  if(act==='acceptContract'){
   if(!b.active||this.contract||(b.contractCooldownUntil||0)>this.time)return;
   const c=o.contractOptions.find(item=>item.id===role)||(!role?o.contractOptions[0]:null);
   if(!c)return;
   this.contract={baseId:b.id,kind:c.kind,goal:c.goal,progress:0,choiceId:c.id,
    name:c.name,ore:c.ore,data:c.data};
    bindFieldLoan(this.fieldLoan,missionAssignment(this.operation,this.contract));
   this.notice('Задание принято: '+c.name+' · '+c.goal+' целей',3.2);
   this.heritage.station(act,b.type);
   this.pausedRenderPending=true;this.renderDock();return;
  }else if(act==='claimContract'){
   const c=this.contract;
   if(!b.active||!c||c.baseId!==b.id||c.progress<c.goal)return;
   b.contractClaimed=true;b.completedContract=c.choiceId;
   b.contractRuns=(b.contractRuns||0)+1;b.contractCooldownUntil=this.time+150;
   this.contract=null;
   finishFieldAssignment(this.fieldLoan,'contract',c);
   p.ore+=c.ore;this.cockpit.resourceGain(c.ore,this.time);
   this.collect({type:'data',value:c.data});
   this.sortieReports=creditContractReward(this.sortieReports||[],c,b);
   this.lastContractReceipt={ore:c.ore,data:c.data,
    credited:this.sortieReports.some(r=>r.id===c.completedSortieId&&r.details?.oreContracts>=c.ore)||
     (c.completedSortieId==null&&this.sortieReports.some(r=>r.baseId===b.id))};
   if(this.firstHardwareReward==null)this.firstHardwareReward='pending';
   this.baseTab='summary';
   this.notice('Поручение выполнено: +'+c.ore+' сплава · +'+c.data+
    ' данных. Выберите бесплатное оружие!',5);
   this.heritage.station(act,b.type);
   this.pausedRenderPending=true;this.renderDock();return;
  }else if(act==='claimFirstModule'){
   if(!b.active||!this.paused||this.overlay?.hidden||this.overlay?.dataset?.mode!=='base')return;
   const preserveDraft=!!this.hangarSession?.dirty?.(this.shipLoadout);
   const reward=claimFirstContractModule(this.shipLoadout,this.firstHardwareReward,role,{preserveDraft});
   if(!reward.ok){this.heritage.ui('deny');this.notice(reward.reason,3);return;}
   this.shipLoadout=reward.loadout;this.firstHardwareReward=reward.status;
   if(this.lastContractReceipt){
    this.lastContractReceipt.firstHardwareReward=role;
    this.lastContractReceipt.firstHardwareInstalled=reward.installed;
   }
   if(!preserveDraft)this.hangarSession?.begin(this.shipLoadout);
   this.syncShipLoadout();
   this.notice(MODULES[role].name+(reward.installed?' установлен на корабль!':
    ' получен на склад; освободите узел в ангаре.'),5);
   this.heritage.ui('upgrade');
   this.pausedRenderPending=true;this.renderDock();return;
  }else if(act==='respec'){
   if(!b.active||!this.doctrine||p.ore<12){this.notice('Нужны активная база и 12 сплава',2);return;}
   p.ore-=12;this.doctrine=null;p.points++;
   recordEconomyExpense(this,'services',12);
   this.heritage.station('respec',b.type);
   this.heritage.pause('skills');
   this.overlay.dataset.mode='skills';this.renderSkills();return;
  }
  if(act==='activate'){
   if(o.reasons.activate){this.notice(o.reasons.activate,2);return;}
    const precisionUnlockedHere=b.type==='arsenal'&&!precisionRailUnlocked(this.world);
    const labUnlockedHere=b.type==='lab'&&!labLogisticsUnlocked(this.world);
   p.ore-=o.relayCost;
   recordEconomyExpense(this,'stations',o.relayCost);
   b.active=true;b.discovered=true;this.activeBases++;b.activationIndex=this.activeBases;
    if(precisionUnlockedHere)this.precisionRailAvailable=true;
    if(this.waypoint?.id===b.id)this.waypoint=null;
   b.activated=true;b.activationTime=this.time;
   p.ore+=o.rewardAlloy;
   p.hp=Math.min(p.maxHp,p.hp+o.rewardRepair);
   const topology=this.world.networkTopology();
   this.cachedNetworkLinked=topology.linked;
   this.defenseTopology=null;
   synchronizeStationDefenses(this.world,this.time,topology);
    this.notice('Станция активна'+(topology.linked.has(b.id)?
    ' · подключено узлов: '+topology.count:' · ищите ретранслятор')+
    (o.rewardAlloy?' · +'+o.rewardAlloy+' сплава':'')+
     (o.relayCost?' · −'+o.relayCost+' сплава':'')+
     (precisionUnlockedHere?' · ОТКРЫТО: '+PRECISION_RAIL_TECH.name+' (R)':'')+
     (labUnlockedHere?' · ОТКРЫТО: '+LAB_LOGISTICS_TECH.name+' (карта)':
      b.type==='lab'?' · Область радиоперехвата расширена':''),
     precisionUnlockedHere||labUnlockedHere?7:3.8);
   this.heritage.vfx.nova(b.x,b.y,130,'cyan');
  }else if(!b.active){this.notice('Сначала активируйте станцию',2);return;}
  else if(act==='hire'){
   if(o.reasons.hire||role!==o.drone.role){this.notice(o.reasons.hire||'Нет такого дрона',2);return;}
   p.ore-=o.hireCost;
   recordEconomyExpense(this,'drones',o.hireCost);
   if(o.replacing)this.allies.splice(o.replacementIndex,1);
   const maxHp=role==='fighter'?78:58;
   this.allies.push({serial:++this.allySerial,role,x:b.x,y:b.y,vx:0,vy:0,
    r:role==='fighter'?15:13,hp:maxHp,maxHp,fire:.3,think:0,
    state:'follow',commitUntil:0,message:'Вылетаю с базы',
    messageUntil:this.time+2.2,angle:0});
   this.notice((o.replacing?'Дрон заменён: ':'Нанят ')+o.drone.name+' · '+this.allies.length+' / '+o.cap,2.6);
   this.heritage.vfx.nova(b.x,b.y,58,'cyan');
  }else if(act==='upgrade'){
   if(o.reasons.upgrade){this.notice(o.reasons.upgrade,2);return;}
   p.ore-=o.upgradeCost;this.network[o.tech.key]++;b.usedUpgrade=true;
   recordEconomyExpense(this,'stations',o.upgradeCost);
   this.notice('Технология: '+o.tech.name+' · уровень '+this.network[o.tech.key],3);
   this.heritage.vfx.nova(b.x,b.y,90,'violet');
  }else if(act==='repair'){
   if(o.reasons.repair){this.notice(o.reasons.repair,2);return;}
   p.ore-=o.repairCost;p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*.45));
   recordEconomyExpense(this,'repairs',o.repairCost);
   this.notice('Корпус восстановлен',2.4);
   this.heritage.vfx.nova(p.x,p.y,70,'green');
  }else if(act==='repairDrones'){
   if(o.reasons.drones){this.notice(o.reasons.drones,2);return;}
   p.ore-=o.droneRepairCost;
   recordEconomyExpense(this,'repairs',o.droneRepairCost);
   for(const a of this.allies)a.hp=a.maxHp;
   this.notice('Дроны восстановлены',2.4);
   this.heritage.vfx.nova(b.x,b.y,60,'green');
  }else if(act==='service'){
   if(!o.localService||o.reasons.service){
    this.notice(o.reasons.service||'Услуга недоступна',2);return;
   }
   p.ore-=o.localService.cost;
   recordEconomyExpense(this,'services',o.localService.cost);
   if(b.type==='dock')p.shield=Math.max(30,p.shield);
   else if(b.type==='lab')this.geoScanUntil=this.time+o.localService.duration;
   else if(b.type==='arsenal')this.overchargeUntil=this.time+o.localService.duration;
   this.notice(o.localService.name+' · −'+o.localService.cost+' сплава',3);
   this.heritage.vfx.nova(b.x,b.y,78,'cyan');
  }else if(act==='supply'){
   if(o.reasons.supply){this.notice(o.reasons.supply,2);return;}
   p.ore-=o.chargeCost;this.support.charges++;
   recordEconomyExpense(this,'services',o.chargeCost);
   this.notice('Вылетов: '+this.support.charges+' / 2 · B у вражеской базы',3.4);
   this.heritage.vfx.nova(b.x,b.y,70,'cyan');
  }else if(act==='transfer'){
   const topology=this.world.networkTopology(),target=this.world.stations.get(role);
   if(!b.active||!topology.linked.has(b.id)||topology.count<2||
      !target?.active||target.enemy||target.id===b.id||!topology.linked.has(target.id)){
    this.notice('Маршрут недоступен: соедините станции с сетью',2.5);return;
   }
   const price=transitCost(b,target);
   if(p.ore<price){this.notice('Для перелёта нужно ещё '+(price-p.ore)+' сплава',2.5);return;}
   // Teleporting is a departure too: never discard a pending hangar draft
   // without the same explicit decision required for an ordinary launch.
   if(this.hangarSession?.dirty?.(this.shipLoadout)){
    this.baseTab='hangar';this.renderDock();
    this.notice('Сначала примените или отмените изменения в ангаре',3.5);return;
   }
   p.ore-=price;
   recordEconomyExpense(this,'travel',price);
   this.heritage.vfx.nova(b.x,b.y,110,'cyan');
   p.x=target.x+75;p.y=target.y+30;p.vx=0;p.vy=0;p.burstRemaining=0;
   for(let i=0;i<this.allies.length;i++){
    const ally=this.allies[i];ally.x=p.x+(i?45:-45);ally.y=p.y+34;
    ally.vx=0;ally.vy=0;ally.state='follow';ally.target=null;
   }
   this.mining.target=null;this.mining.active=false;
   this.heritage.vfx.nova(p.x,p.y,100,'cyan');
   // The fare is a station expense, not earnings lost during the new flight.
   // Capture the post-payment baseline BEFORE dismiss() loses the dock.
   this.sortieStart=startSortie(this);
   this.docked=null;this.dismiss();
   this.notice('Сетевой перелёт: '+(baseNames[target.type]||'станция')+' · −'+price+' сплава',3.2);
   this.heritage.station('transfer',target.type);
   return;
  }else return;
  // Do not replay the dock animation on rejected purchases.
  markDockEvent(b,act,this.time);
  this.heritage.station(act,b.type,{tech:act==='upgrade'?o.tech.key:null});
  this.pausedRenderPending=true;this.renderDock();
 }
 callFieldWeapon(){
  if((this.fieldLoan?.moduleId||'ion')!=='resonator')return this.callIonDischarge();
  if(this.dead||this.paused||!this.overlay.hidden)return false;
  if(this.mining.active||this.probeRepairing||this.openingRepairing){
   this.notice('Отпустите E, чтобы применить полевой модуль.',2.5);return false;}
  if(!this.weaponProfile.resonator){this.notice('Установите резонатор в ангаре и примените сборку.',3);return false;}
  if(this.weaponThermal.locked||this.heavyCharge){this.notice('Дождитесь охлаждения или завершения выстрела гаубицы.',2.5);return false;}
  const plan=planResonance(this);
  if(!plan.ok){this.notice(plan.reason,2.8);return false;}
  this.fieldEffects=[plan.effect];this.fieldLoan.charges=plan.chargesAfter;
  this.fieldLoan.cooldownUntil=plan.cooldownUntil;this.fieldLoan.used++;
  this.heritage.vfx.nova(plan.effect.targets[0].target.x,plan.effect.targets[0].target.y,43,'violet');
  this.heritage.play('resonatorShot',.26,{x:this.player.x,y:this.player.y});
  this.notice('РЕЗОНАНС · '+plan.effect.targets.length+' цели · 4 секунды связи · зарядов '+this.fieldLoan.charges+'/3',3);
  this.hud();return true;
 }
 weaponHit(item,dealt,source){
  if(source==='beam'&&this.fieldLoan&&this.weaponProfile.ion){
   const targets=combatTargets(this,ION_CONDUCTOR.dischargeRange+ION_CONDUCTOR.markRadius).map(x=>x.target);
   markIonCluster(targets,item.target,this.time,this.fieldLoan,(a,b)=>clearLine(this,a,b));
  }
  if(['beam','rail','flak','rocket','howitzer','ion'].includes(source))resonanceDamage(this,item,dealt);
 }
 callIonDischarge(){
  if(this.dead||this.paused||!this.overlay.hidden)return false;
  if(this.mining.active||this.probeRepairing||this.openingRepairing){
   this.notice('Во время добычи и ремонта ионный разряд недоступен',2.5);return false;
  }
  if(this.fieldLoan&&!this.weaponProfile.ion){this.notice('Установите ионный проводник в свободный узел ангара',3);return false;}
  if(this.weaponThermal.locked||this.heavyCharge){this.notice('Разряд недоступен: перегрев или подготовка гаубицы',2.5);return false;}
  if(this.fieldLoan&&(this.fieldLoan.moduleId||'ion')!=='ion')return false;
  const candidates=combatTargets(this,ION_CONDUCTOR.dischargeRange);
  const plan=planIonDischarge(candidates.map(x=>x.target),this.player,this.time,this.fieldLoan,(a,b)=>clearLine(this,a,b),this.skillRanks.beam);
  if(!plan.ok){this.notice(plan.reason,2.5);return false;}
  let from=this.player;
  for(let i=0;i<plan.targets.length;i++){
   const target=plan.targets[i];
   target.ionMarkUntil=0;
   const item=candidates.find(x=>x.target===target);
   const point=contactOnCircle(target.x,target.y,targetRadius(item),from.x,from.y);
   emitWeaponFx(this,'ion',from,point);
   damageTarget(this,item,plan.damage[i],'ion',point);
   from=target;
  }
  this.fieldLoan.charges=plan.chargesAfter;
  this.fieldLoan.cooldownUntil=plan.cooldownUntil;
  this.fieldLoan.used++;
  const mastery=ionMasteryAward(plan.targets.length,this.ionMasteryAwarded);
  if(mastery){this.ionMasteryAwarded=true;this.collect({type:'data',value:mastery});
   recordSortieIncome(this,'data','other',mastery);}
  this.heritage.vfx.nova(plan.targets[0].x,plan.targets[0].y,43,'cyan');
  this.heritage.play('ionShot',.26,{x:plan.targets[0].x,y:plan.targets[0].y});
  this.notice(mastery?'Цепной разряд освоен: '+plan.targets.length+
   ' цели · +'+mastery+' данных · ион '+this.fieldLoan.charges+'/'+ION_CONDUCTOR.charges:
   'Ионный разряд: '+plan.targets.length+' '+
   (plan.targets.length===1?'цель':'цели')+' · осталось '+this.fieldLoan.charges,mastery?4.2:2.3);
  this.hud();return true;
 }
 callStrike(){
  if(this.dead||this.paused)return false;
  const sup=this.support;
  if(!sup.charges){this.notice('Снарядите авиаудар на подключённом авианосце',3);return false;}
  if(sup.cooldown>0){this.notice('Перезарядка связи: '+Math.ceil(sup.cooldown)+' с',2);return false;}
  const enemy=this.nearbyEnemyBase(720);
  if(!enemy){this.notice('Подлетите ближе к вражеской базе',3);return false;}
  const topology=this.world.networkTopology();
  const carriers=[...this.world.stations.values()].filter(b=>
   b.active&&!b.enemy&&b.type==='carrier'&&topology.linked.has(b.id));
  if(!carriers.length){this.notice('Нет связи с авианосцем',3);return false;}
  carriers.sort((a,b)=>dist(a,enemy)-dist(b,enemy));
  const carrier=carriers[0],dx=enemy.x-carrier.x,dy=enemy.y-carrier.y,n=Math.hypot(dx,dy)||1;
  const ux=dx/n,uy=dy/n,approach=Math.max(this.vw,this.vh)*.8+240;
  const bomberHp=carrier.module==='armor'?Math.round(68*1.45):68;
   const craft=[-1,1].map((side,i)=>({
   x:enemy.x-ux*approach-uy*side*46,
   y:enemy.y-uy*approach+ux*side*46,
   r:17,hp:bomberHp,maxHp:bomberHp,role:'bomber',angle:Math.atan2(uy,ux)+Math.PI/2,
   lane:side,serial:i+1}));
  sup.missions.push({base:enemy,carrier,craft,age:0,shotAt:2.3,volleys:0});
  sup.charges--;sup.cooldown=35;
  this.notice('Ударная группа на подходе! Прикрывайте заход.',4);
  this.heritage.play('strikeCall',.5,{x:this.player.x,y:this.player.y});
  this.heritage.vfx.nova(this.player.x,this.player.y,85,'cyan');
  return true;
 }
 updateStrikes(dt){
  const sup=this.support;sup.cooldown=Math.max(0,sup.cooldown-dt);
  for(const mission of sup.missions){
   mission.age+=dt;
   const b=mission.base,c=mission.carrier;
   const dx=b.x-c.x,dy=b.y-c.y,n=Math.hypot(dx,dy)||1;
   const ux=dx/n,uy=dy/n,range=Math.max(this.vw,this.vh)*.8+240;
   for(const craft of mission.craft){
    craft.hit=Math.max(0,(craft.hit||0)-dt);
    if(craft.hp<=0)continue;
    const travel=mission.age<2.4?-range*(1-mission.age/2.4):
     Math.min(range,(mission.age-2.4)*195);
    const side=craft.lane*46;
    craft.x=b.x+ux*travel-uy*side;
    craft.y=b.y+uy*travel+ux*side;
    craft.angle=Math.atan2(uy,ux)+Math.PI/2;
    craft.vx=ux*(mission.age<2.4?range/2.4:195);
    craft.vy=uy*(mission.age<2.4?range/2.4:195);
   }
   if(mission.age>=mission.shotAt&&mission.volleys<4){
    mission.shotAt+=1.03;mission.volleys++;
    const alive=mission.craft.filter(c=>c.hp>0);
    if(!alive.length)continue;
    const craft=alive[(mission.volleys-1)%alive.length];
    const target=b.turrets?.find(t=>t.hp>0)||b;
    if(target.hp<=0)continue;
    const damage=(44+Math.min(6,this.network.strikePower)*10)*(c.module==='guidance'?1.2:1);
    if(target===b)this.hitEnemyBase(b,damage,'bomber');
    else this.hitTurret(target,damage);
    this.heritage.vfx.meteorStrike(target.x,target.y,26,false);
    this.flash(craft.x,craft.y,target.x,target.y,'#ffcf7b');
    this.heritage.play('rocket',.32,{x:craft.x,y:craft.y});
   }
  }
  sup.missions=sup.missions.filter(m=>m.age<7.5&&m.craft.some(c=>c.hp>0));
 }

 hack(){
  if(this.dead)return;
  if(!this.hacks.length){this.notice('Нужен код захваченной вражеской базы',2);return;}
  const charge=this.hacks.shift(),cam=this.camera();
  let count=0;
  for(const e of this.enemies){
   if(e.hp<=0||e.converted||e.type==='gunship')continue;
   const eligible=charge==='screen'? !outsideCamera(e.x,e.y,cam,e.r):
      dist(e,this.player)<260;
   if(eligible&&count<24){
    e.converted=true;e.convertedTime=19;e.state='converted';e.fire=.2;count++;
    e.stasisUntil=0;e.stasisLabelUntil=0;e.stasisImmuneUntil=0;
    this.flashes.push({x:e.x,y:e.y,x2:e.x,y2:e.y,color:'#78ffd6',ttl:.5});
   }
  }
  this.heritage.vfx.nova(this.player.x,this.player.y,260,'green');
  this.heritage.play('hack');
  this.notice('Перепрограммировано кораблей: '+count,3.5);
 }
 hurt(damage,source=null){
  const p=this.player;if(p.invul>0)return;
  if(this.nearDockField||this.nearArsenalDefense)damage*=.82;
  const absorbed=Math.min(p.shield,damage);p.shield-=absorbed;
  const remaining=Math.max(0,damage-absorbed);
  const previousHp=p.hp;
  p.hp-=remaining;p.invul=.55+this.skillRanks.dodge*.12;this.lastDamageAt=this.time;
  recordSortieDamage(this,Math.min(previousHp,remaining),absorbed);
  if(previousHp/p.maxHp>.3&&p.hp/p.maxHp<=.3&&p.hp>0)
   this.heritage.play('criticalHull',3);
  const contact=source?contactOnCircle(p.x,p.y,p.r,source.x,source.y):null;
  this.heritage.vfx.arcadePlayerHurt(p.x,p.y,absorbed>0,remaining>0,contact);
  this.heritage.play('damage',.35);
  this.cockpit.impact(damage/Math.max(1,p.maxHp),absorbed>0&&remaining===0);
  const boost=this.skillRanks.dodge;
  if(boost){
   const sx=source? p.x-source.x : p.vx,sy=source? p.y-source.y : p.vy;
   const m=length(sx,sy);
   const dx=m>1?sx/m:Math.sin(p.angle),dy=m>1?sy/m:-Math.cos(p.angle);
   p.vx+=dx*boost*120;p.vy+=dy*boost*120;
   this.heritage.vfx.engineTrail(p.x,p.y,p.angle,'fighter',false,.13);
  }
  if(p.hp<=0){p.hp=0;this.die();}
 }
 die(){
  if(this.dead)return;
  for(const e of this.enemies)this.enemyLearning?.finish(e,this.time);
  this.enemyLearning?.flush(this.time);
  const failed=finishSortie(this.sortieStart,this,this.docked||this.world.home,'lost');
  this.sortieReports=appendSortieReport(this.sortieReports,failed);
  this.sortieStart=null;
  this.heritage.vfx.shipExplosion(this.player.x,this.player.y,35,'#83e9ff',false);
  this.heritage.vfx.nova(this.player.x,this.player.y,100,'cyan');
  this.heritage.play('death',.1);
  this.heritage.onDeath();
  this.dead=true;this.paused=true;this.pausedRenderPending=true;
  if(this.time>this.bestFlight){
   this.bestFlight=Math.floor(this.time);
   try{this.recordStorage?.setItem('survivor.best-flight.v1',String(this.bestFlight));}catch{}
  }
  this.runStore?.end();
  this.deathVfxAt=performance.now();this.deathSceneEnd=this.deathVfxAt+1100;
  this.overlay.hidden=true;this.overlay.dataset.mode='death';
  this.overlay.innerHTML='<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="death-title"><h2 id="death-title">Корабль потерян</h2><p>Время полёта: '+
    Math.floor(this.time/60)+' мин · уровень '+this.player.level+
    ' · открыто станций '+this.activeBases+'</p><p>Личный рекорд: '+
    runClock(this.bestFlight)+' · новый забег позволяет выбрать другую тактику.</p>'+
    (failed?'<p>Последний вылет: '+failed.seconds+' с · сплав '+(failed.ore>=0?'+':'')+failed.ore+
     ' · данные '+(failed.data>=0?'+':'')+failed.data+
     ' · получено повреждений '+failed.details.damageTaken+
     ' · потеряно дронов '+failed.details.dronesLost+'.</p>':'')+
    '<button data-act="restart">Новый вылет</button></div>';
 }
 updateMissiles(dt){
  for(const m of this.missiles){
   const item={kind:m.targetKind||'enemy',target:m.target,base:m.targetBase};
   if(targetAlive(this,item)){m.tx=m.target.x;m.ty=m.target.y;}
   m.prevX=m.x;m.prevY=m.y;
   if(!m.trail)m.trail=[];
   if(!m.trail.length||Math.hypot(m.x-m.trail[m.trail.length-1].x,m.y-m.trail[m.trail.length-1].y)>5){
    m.trail.push({x:m.x,y:m.y});if(m.trail.length>9)m.trail.shift();
   }
   const dx=m.tx-m.x,dy=m.ty-m.y,d=Math.hypot(dx,dy);
   const step=Math.min(d,m.speed*dt);
   if(d>0){m.x+=dx/d*step;m.y+=dy/d*step;}
   m.life-=dt;
   const cover=firstRockImpact(m.prevX,m.prevY,m.x,m.y,
    this.rockGrid.query((m.prevX+m.x)*.5,(m.prevY+m.y)*.5,step*.5+60),3,this.player);
   if(cover){
    const contact=contactAtPoint(cover.rock.x,cover.rock.y,cover.x,cover.y);
    this.damageRock(cover.rock,m.damage*.85,m.prevX,m.prevY,'auto',true,contact);
    this.heritage.vfx.rocketImpact(cover.x,cover.y,26,contact);
    this.heritage.play('rocketImpact',.2,{x:cover.x,y:cover.y});
    m.life=-1;continue;
   }
   const arrived=d<=m.speed*dt+8;
   if(arrived||m.life<=0){
    const e=m.target;
    const hit=targetAlive(this,item)&&Math.hypot(m.x-e.x,m.y-e.y)<targetRadius(item)+24;
    const contact=hit?contactOnCircle(e.x,e.y,targetRadius(item),m.prevX,m.prevY):null;
    if(hit)damageTarget(this,item,m.damage,'rocket',contact);
    if(hit)this.heritage.vfx.rocketImpact(contact?.x??m.x,contact?.y??m.y,26,contact);
    else this.heritage.vfx.rocketImpact(m.x,m.y,12);
    // The warhead has an audible detonation, not just a visual flash.
    this.heritage.play('rocketImpact',.2,{x:contact?.x??m.x,y:contact?.y??m.y});
    m.life=-1;
   }
  }
  this.missiles=this.missiles.filter(m=>m.life>0);
 }
 hitAlly(a,damage){
  if(!a||a.hp<=0||damage<=0)return;
  a.hp-=damage;a.hit=.18;
  if(this.time>(a.nextVfxHit||0)){
   this.heritage.vfx.hullImpact(a.x,a.y,false);
   a.nextVfxHit=this.time+.24;
  }
 }
 damageEnemy(e,damage,source='other',contact=null){
  if(e.hp<=0)return;
  if(e.regionalCargo){hitRegionalCargo(this,e,damage,contact,source);return;}
  if(e.centralWorker){
   e.hp=Math.max(0,e.hp-damage);e.hit=.15;
   this.heritage.vfx.hullImpact(contact?.x??e.x,contact?.y??e.y,damage>30,contact);
   if(disableCentralWorker(this.world,e,this.time)){
    this.enemyComms?.reportIncident(e,this,'mining');
    this.heritage.vfx.shipExplosion(e.x,e.y,35,'#90f7d7',false);
    this.notice('Рудный рабочий уничтожен: местная добыча остановилась. Уже отправленные грузы ещё опасны.',7);
   }
   return;
  }
  if(e.frontierWorker||e.frontierSalvage){
   const result=damageFrontierAsset(this.world,e,damage,this.time);
   if(result){
    e.hit=.16;
    this.heritage.vfx.hullImpact(contact?.x??e.x,contact?.y??e.y,damage>30,contact);
    if(result==='worker'||result==='wreck'){
     this.enemyComms?.reportIncident(e,this,
      result==='worker'?'recycling':'salvage');
     this.heritage.vfx.shipExplosion(e.x,e.y,34,'#8bdfbe',false);
     if(result==='wreck')this.addDrop('ore',e.x,e.y,3,{source:'salvage',life:60});
     this.notice(result==='worker'?
      'Сборщик выведен из строя. Утилизационный комбинат больше не получает новые материалы.':
      'Одна залежь обломков уничтожена. У комбината стало меньше материала для будущих рейсов.',6);
    }
   }
   return;
  }
  if(e.interceptCargo){
   const origin=contact?.directed?contact:
    source&&typeof source==='object'?source:this.player;
   const hit=hitCarrierCargo(e,damage,origin);damage=hit.damage;e.hit=.15;
   if(hit.engineDisabled)this.notice('ДВИГАТЕЛИ ПОВРЕЖДЕНЫ! Груз замедлен на 4 секунды.',2.8);
   if(this.time>(e.nextVfxHit||0)){
    this.heritage.vfx.hullImpact(contact?.x??e.x,contact?.y??e.y,damage>30,contact);
    e.nextVfxHit=this.time+.14;
   }
   this.heritage.play('armorHit',.24,{x:e.x,y:e.y});
   if(e.hp<=0)this.completeCarrierInterception(e);
   return;
  }
  // A surviving ship can infer an approximate firing sector from an impact.
  // Other attackers cannot reveal the player's coordinates by proxy.
  const aggressor=(['beam','rocket','ion','rail','flak','howitzer'].includes(source))?this.player:
    (source&&typeof source==='object'&&Number.isFinite(source.x)&&
     Number.isFinite(source.y)&&source.hp>0)?source:null;
  // A damaged patrol does not obtain a live target coordinate through a wall.
  // Actual optical contact is allowed to identify an attacker; otherwise it
  // can only investigate a coarse direction inferred from the impact.
  const sawAttacker=!!aggressor&&this.enemyCanSee(e,aggressor);
  const attackRange=aggressor===this.player&&!sawAttacker?
    estimatedWeaponRange(source):aggressor?dist(e,aggressor):0;
  const impactEstimate=aggressor===this.player&&!sawAttacker?
    incomingFireEstimate(e,attackRange,contact):null;
  if(e.signalIntel&&aggressor){
    if(sawAttacker)alertSignalIntel(e.signalIntel,aggressor,this.time);
    else alertSignalThreat(e.signalIntel,impactEstimate,this.time);
  }
  const hpBefore=e.hp;
  damage=stormWeaponDamage(e,damage,source,this.time);
  e.hp-=damage;e.hit=.12;
  this.enemyLearning?.damaged(e,Math.min(hpBefore,Math.max(0,damage)));
  this.enemyComms?.reportHit(e,Math.min(hpBefore,Math.max(0,damage)),this.time);
  if(aggressor===this.player&&e.hp>0)
   this.enemyComms?.reportAttack(e,source,attackRange,this.time,contact);
  if(e.hp<=0)this.enemyComms?.reportLoss(e,this,
    aggressor===this.player?{weapon:source,range:attackRange,contact}:null);
  if(this.visuals?.capitalDamageQA&&e.type==='gunship'&&e.serial%2===0)
   recordCapitalHit(e,contact,this.time);
  if(this.time>(e.nextVfxHit||0)){
   this.heritage.vfx.hullImpact(
    contact?.directed?contact.x:e.x,contact?.directed?contact.y:e.y,
    damage>45,contact);
   e.nextVfxHit=this.time+.13;
  }
  this.heritage.play('hit',.24,{x:e.x,y:e.y});
 }
 flash(x,y,x2,y2,color='#a7eeff'){
  if(this.flashes.length>=90)this.flashes.shift();
  this.flashes.push({x,y,x2,y2,color,ttl:.16});
 }
 hitTurret(t,damage,contact=null){
  if(t.hp<=0)return;
  this.enemyLearning?.damaged(t,Math.min(t.hp,Math.max(0,damage)));
  t.hp-=damage;t.flash=.1;
  if(t.hp<=0)this.enemyLearning?.finish(t,this.time);
  if(this.time>(t.nextVfxHit||0)){
   this.heritage.vfx.hullImpact(
    contact?.directed?contact.x:t.x,contact?.directed?contact.y:t.y,
    damage>=40,contact);
   t.nextVfxHit=this.time+.15;
  }
  this.heritage.play('armorHit',.35,{x:t.x,y:t.y});
  if(t.hp<=0){this.heritage.vfx.shipExplosion(t.x,t.y,21,'#ff6974');
   this.heritage.play('explosion',.25,{x:t.x,y:t.y});}
 }
 hitEnemyBase(base,damage,source='player'){
  // A captured base is friendly even though the repaired structure has positive HP.
  if(base.hp<=0||base.captured||!base.enemy)return;
  if(base.turrets.some(t=>t.hp>0))return;
  if(this.time>(base.nextVfxHit||0)){
   this.heritage.vfx.hullImpact(base.x,base.y,damage>=40);
   base.nextVfxHit=this.time+.2;
  }
  if(source==='bomber'){
   const reserve=base.maxHp*.2;
   base.hp=Math.max(reserve,base.hp-damage);
   if(base.hp<=reserve&&!base.coreExposed){
    base.coreExposed=true;
    this.notice('Ядро базы открыто! Подлетите и добейте его своим лучом.',4);
    this.heritage.vfx.nova(base.x,base.y,120,'red');
   }
   return;
  }
  base.hp-=damage;
  if(base.hp<=0){
   const precisionUnlockedHere=base.type==='arsenal'&&!precisionRailUnlocked(this.world);
   const labUnlockedHere=base.type==='lab'&&!labLogisticsUnlocked(this.world);
   base.hp=Math.max(1,Math.round(base.maxHp*.3));base.captured=true;base.enemy=false;base.active=true;
   if(precisionUnlockedHere)this.precisionRailAvailable=true;
   this.defenseTopology=null;
   base.activated=true;base.activationTime=this.time;
   this.activeBases++;base.activationIndex=this.activeBases;
   synchronizeStationDefenses(this.world,this.time);
   this.hacks.push(base.rank>=3?'screen':'area');
   if(this.hacks.length>3)this.hacks.shift();
   this.heritage.vfx.nova(base.x,base.y,200,'green');
   this.heritage.play('capturedBase',.2,{x:base.x,y:base.y});
   if(strategicCapture(this.world,base,this.time)){
    this.addDrop('ore',base.x,base.y,25,{source:'salvage',life:60});
    const notice={mine:'Добывающий комплекс захвачен. Новые грузы не выйдут; транспорт в пути ещё нужно перехватить.',
     military:'Военный узел захвачен. Подготовка тяжёлых подкреплений остановлена.',
     'central-source':'Местная шахта захвачена. Добыча остановлена, но уже отправленные грузы ещё в пути.',
     'central-depot':'Сборочный пост захвачен. Новые местные патрули не появятся, транспорт теперь идёт впустую.',
     'frontier-azure-source':'Индукционная вышка захвачена. Электроангар перестанет получать новые батареи.',
     'frontier-azure-depot':'Электроангар захвачен. Организованные рейсы ионных перехватчиков остановлены.',
     'frontier-teal-source':'Комбинат захвачен. Разбор обломков и отправка запчастей остановлены.',
     'frontier-teal-depot':'Ремонтная верфь захвачена. Подготовка новых ремонтных караулов прекращена.'};
    this.notice((notice[base.strategicRole]||'Промышленный узел захвачен.')+
     (precisionUnlockedHere?' Открыт ручной прицел рельса (R).':'')+
     (labUnlockedHere?' Открыт радиоперехват снабжения (карта).':''),7);
   }else this.notice('Вражеская база захвачена! Заряд кода: Q'+
    (precisionUnlockedHere?' · Ручной прицел рельса открыт (R)':'')+
    (labUnlockedHere?' · Радиоперехват снабжения открыт (карта)':
     base.type==='lab'?' · Радионаблюдение расширено':''),6);
  }
 }
 nearbyEnemyBase(radius=900){
  return this.world.nearbyStations(this.player.x,this.player.y,radius)
   .filter(b=>b.enemy&&!b.captured&&(b.strategicRole||this.enemyBasesUnlocked())).sort((a,b)=>dist(this.player,a)-dist(this.player,b))[0]||null;
 }
 enemyBasesUnlocked(){return this.player.level>=RULES.enemyBaseUnlockLevel&&
  this.activeBases>=RULES.enemyBaseUnlockStations;}
 assaulting(b){return dist(this.player,b)<430 && !b.captured;}
 enemyShot(x,y,tx,ty,damage,options=null){
  if(this.shots.length>=RULES.maxShots)return false;
  const d=length(tx-x,ty-y)||1,speed=options?.speed||230;
  this.shots.push({x,y,vx:(tx-x)/d*speed,vy:(ty-y)/d*speed,
   damage,r:options?.r||6,life:3.3,alive:true,kind:options?.kind||'laser',
   learnToken:options?.learnToken||null});
  this.heritage.play('enemyShot',.28,{x,y});
  return true;
 }
 shotsNear(x,y,r){return this.shotGrid.query(x,y,r);}
 avoidance(x,y,r){
  let vx=0,vy=0;
  for(const z of this.zones){
   if(z.fuse<=0)continue;
   const d=length(x-z.x,y-z.y),reach=z.r+r+65;
   if(d<reach){
    const k=(reach-d)/Math.max(1,d);
    vx+=(x-z.x)*k;vy+=(y-z.y)*k;
   }
  }
  const phase=ionPhase(this.time);
  if(phase.state==='warning'||phase.state==='discharge'){
   const d=length(x-ION_FIELD.x,y-ION_FIELD.y),reach=ION_FIELD.r+r+65;
   if(d>1&&d<reach){
    vx+=(x-ION_FIELD.x)/d*(reach-d);
    vy+=(y-ION_FIELD.y)/d*(reach-d);
   }
  }
  for(const rock of this.nearRocks||[]){
   if(!rock.alive)continue;
   const dx=x-rock.x,dy=y-rock.y;
   if(Math.abs(dx)>100||Math.abs(dy)>100)continue;
   const d=length(dx,dy),reach=rock.r+r+22;
   if(d>1&&d<reach){vx+=dx/d*(reach-d);vy+=dy/d*(reach-d);}
  }
  const m=length(vx,vy);
  return m>0?{x:clamp(vx/m*clamp(m/60,0,1),-1,1),y:clamp(vy/m*clamp(m/60,0,1),-1,1)}:{x:0,y:0};
 }
 enemyCanSee(enemy,target){
  const d=dist(enemy,target);
  if(d>290)return false;
  const dx=target.x-enemy.x,dy=target.y-enemy.y;
  const speed=length(enemy.vx,enemy.vy);
  // A nearby contact is detected from any angle. At distance, a moving
  // patrol must be facing roughly toward the contact.
  if(d>88&&speed>24&&(enemy.vx*dx+enemy.vy*dy)/(speed*Math.max(1,d))<-.2)
   return false;
  const rocks=this.rockGrid.query((enemy.x+target.x)*.5,(enemy.y+target.y)*.5,d*.5+80);
  return !firstRockImpact(enemy.x,enemy.y,target.x,target.y,rocks,0,target);
 }
 playerCanInspectEnemyIntent(enemy){
  const p=this.player,d=dist(p,enemy);
  if(d>290)return false;
  // Player visibility depends on cover, not on where an enemy is facing.
  // This is deliberately different from the enemy's directional sensor.
  const rocks=this.rockGrid.query((p.x+enemy.x)*.5,(p.y+enemy.y)*.5,d*.5+80);
  return !firstRockImpact(p.x,p.y,enemy.x,enemy.y,rocks,0,enemy);
 }
 playerCanInterceptEnemyRadio(enemy){
  // Listening to nearby broadcasts does not reveal the broadcaster's position.
  return !!enemy&&dist(this.player,enemy)<=ENEMY_COMMS.interceptRange;
 }
 sectorDirector(director){
  let adjusted=director;
  if(director.types.length){
   const control=this.world.sectorControl?.(this.player.x,this.player.y)||{kind:'neutral',base:null};
   if(control.kind==='hostile'&&(control.base?.strategicRole||this.enemyBasesUnlocked()))adjusted={...adjusted,
    cap:Math.min(RULES.maxEnemies,adjusted.cap+3),interval:adjusted.interval*.82};
   else if(control.kind==='secured')adjusted={...adjusted,
    cap:Math.max(4,adjusted.cap-3),interval:adjusted.interval*1.2};
  }
  const carrierModifier=Math.max(1,...[...this.world.stations.values()]
   .filter(b=>b.type==='carrier'&&b.supplyIntercepted)
   .map(b=>carrierPatrolModifier(b,this.player.x,this.player.y)));
  if(carrierModifier>1&&adjusted.types.length)adjusted={...adjusted,
   cap:Math.max(3,adjusted.cap-1),interval:adjusted.interval*carrierModifier};
  const home=this.world.home;
  const modifier=home?.corridorSecured&&Math.hypot(this.player.x-home.x,this.player.y-home.y)<1250?1.17:1;
  if(modifier>1&&adjusted.types.length)adjusted={...adjusted,
   cap:Math.max(4,adjusted.cap-1),interval:adjusted.interval*modifier};
  const region=regionAt(this.player.x,this.player.y);
  if(Math.hypot(this.player.x,this.player.y)<=70000&&['amethyst','amber'].includes(region.id)&&this.world.regionalSupply)
   adjusted={...adjusted,types:adjusted.types.filter(type=>type!=='gunship')};
  return openingArcPressure(adjusted,this.openingArc,this.time,this.player,home);
 }
 spawnGroup(director=openingThreat(this.time,this.player.level),noiseSignal=null){
  if(!director.types.length||this.enemies.length>=RULES.maxEnemies)return 0;
  const cap=Math.min(RULES.maxEnemies,director.cap);
  const available=cap-this.enemies.length;
  if(available<=0)return 0;
  const side=Math.floor(Math.random()*4),middle=.2+Math.random()*.6;
  const plan=planEncounter(this.time,director,available,side,middle,
    Math.random(),noiseSignal?'':this.lastEncounter);
  if(!plan.members.length)return 0;
  if(!noiseSignal)this.lastEncounter=plan.pattern;
  const group=++this.groupSerial,cam=this.camera(),created=[];
  const intelSource=noiseSignal;
  for(let i=0;i<plan.members.length;i++){
   const member=plan.members[i];
   const xy=spawnOutside(cam,member.side,member.position,170+i*12);
   const type=member.type,def=ENEMY_TYPES[type],serial=++this.enemySerial;
   const hp=def.hp*(1+Math.min(2.5,this.time/550));
   const enemy={serial,group,type,x:xy.x,y:xy.y,vx:0,vy:0,
    r:type==='gunship'?22:14,hp,maxHp:hp,damage:def.dmg,
    think:Math.random()*.32,fire:1+Math.random(),state:'hunt',
    commitUntil:0,target:this.player,angle:0,hit:0,expAwarded:false,
    scenario:plan.pattern,protect:null,
    _awarenessDispatch:noiseSignal?null:
      {x:this.player.x,y:this.player.y,at:this.time},
    stormAdapted:regionAt(xy.x,xy.y).id==='azure'&&type==='flanker',
    entryPortalPending:type==='gunship'&&!this.heavyPortalShown};
   if(intelSource)Object.assign(enemy,{signalIntel:createSignalIntel(
      intelSource.x,intelSource.y,this.time),signalLeader:i===0,
     signalSlot:i,signalExitX:xy.x,signalExitY:xy.y});
   if(!intelSource&&i===0&&plan.label&&this.time-this.lastEncounterLabelAt>=14){
    enemy.encounterLabel=plan.label;this.lastEncounterLabelAt=this.time;
   }
   created.push(enemy);
  }
  // Direct references keep formations cheap: no squad-wide search each frame.
  for(let i=0;i<created.length;i++){
   const index=plan.members[i].protectIndex;
   if(index>=0)created[i].protect=created[index];
  }
  this.enemies.push(...created);
  return plan.pause;
 }
 damageRock(rock,damage,sourceX,sourceY,kind='auto',showImpact=true,contact=null){
  if(!rock?.alive)return;
  const destroyed=impactRock(rock,damage,sourceX,sourceY,kind);
  // Emit noise as the ore fractures so the player can judge danger in time.
  if(kind==='extract'&&damage>0){
   const emitted=extractionNoiseDelta(rock,this.skillRanks.mining||0,this.nearQuietLab);
   if(emitted>0){
    this.miningNoise+=emitted;
    this.lastNoiseSource={x:rock.x,y:rock.y};
   }
  }
  if(showImpact){
   const point=contact||contactOnCircle(rock.x,rock.y,rock.r,sourceX,sourceY);
   this.heritage.vfx.asteroidImpact(
    point?.directed?point.x:rock.x,point?.directed?point.y:rock.y,
    rock.r,kind==='extract'&&!!rock.rich,point);
   if(kind==='auto')this.heritage.play('stone',.27,{x:rock.x,y:rock.y});
   // Electric extraction has one continuous tool sound, managed in heritage.
  }
  if(!destroyed)return;
  if(kind==='extract'){
   this.advanceContract('mine',rock);
  }
  this.heritage.vfx.asteroidBreak(rock.x,rock.y,rock.r);
  this.heritage.play('rockBreak',.22,{x:rock.x,y:rock.y});
  // Hostile fire consumes stone cover; only player actions can yield alloy.
  if(kind==='cover')return;
  const total=rockYield(rock,kind,{...this.skillRanks,doctrine:this.doctrine}),count=kind==='strike'?3:kind==='auto'?1:2;
  for(let i=0;i<count;i++){
   const value=Math.floor(total/count)+(i<total%count?1:0);
   const a=i*Math.PI*2/count+rock.x*.13,scatter=22+rock.r*.25;
   this.addDrop('ore',rock.x+Math.cos(a)*scatter,rock.y+Math.sin(a)*scatter,
    value,{life:kind==='strike'?25:34,hot:kind==='strike',
     vx:Math.cos(a)*(kind==='strike'?120:70),
     vy:Math.sin(a)*(kind==='strike'?120:70)});
  }
 }
 addDrop(type,x,y,value,options={}){
  if(this.drops.length>=RULES.maxDrops){
   // When the cap is reached, award pickups directly rather than lose progress.
   return this.collect({type,value,source:options.source})!==false;
  }
  this.drops.push({type,x,y,value,source:options.source||null,
   vx:options.vx??(Math.random()-.5)*55,
   vy:options.vy??(Math.random()-.5)*55,
   hot:!!options.hot,life:options.life??34});
 }
 issueFieldCharge(e){
  if(e.fieldDropChecked||e.hp>0||e.converted)return false;
  e.fieldDropChecked=true;
  const id=e.fieldChargeOperation,base=this.world.stations.get(e.fieldChargeBaseId),loan=this.fieldLoan;
  if(!id||!base||!loan||(base.fieldChargeIssued||{})[id]||loan.charges>=fieldWeapon(loan).capacity)return false;
  if(this.addDrop('fieldCell',e.x+12,e.y,1,{life:34})===false)return false;
  base.fieldChargeIssued??={};base.fieldChargeIssued[id]=true;return true;
 }
 collect(item){
  const p=this.player;
  if(item.type==='fieldCell'){
   const spec=this.fieldLoan&&fieldWeapon(this.fieldLoan);
   if(!spec||this.fieldLoan.charges>=spec.capacity)return false;
   this.fieldLoan.charges=Math.min(spec.capacity,this.fieldLoan.charges+1);
   this.heritage.play('pickup',.21);
   this.notice(spec.short+': подобран заряд · '+this.fieldLoan.charges+'/'+spec.capacity,2.5);return true;
  }
  this.heritage.play('pickup',.21);
  if(item.type==='ore'){
   p.ore+=item.value;this.cockpit.resourceGain(item.value,this.time);
   recordSortieIncome(this,'ore',item.source||'mining',item.value);
  }
  else{
   if(item.source)recordSortieIncome(this,'data',item.source,item.value);
   p.data+=item.value;p.xp+=item.value;
   while(p.xp>=expForNext(p.level)){
    p.xp-=expForNext(p.level);p.level++;p.points++;
    this.heritage.play('levelUp',.4);
    if(p.level<=18 || p.level%3===0)this.notice('Новый уровень! Навыки пилота — U, оружие и системы — в ангаре.',3);
   }
  }
 }
 update(dt){
  const p=this.player;this.time+=dt;this.visuals.updateSky(p.x,p.y);
  if(this.enemyLearning?.dirty&&this.time>=this.enemyLearning.nextSave)
   this.enemyLearning.flush(this.time);
  updateFieldEffects(this);
  coolWeapons(this.weaponThermal,dt,this.holdFire);
  updateHowitzer(this,dt);
  this.heritage.tick(dt,this);
  this.updateCarrierInterception(dt);
  this.updateCorridor(dt);
  this.updateRelayDefense(dt);
  updateRegionalWorld(this,dt);
  let mx=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-
    (this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.touch.x;
  let my=(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-
    (this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)+this.touch.y;
  const m=length(mx,my);if(m>1){mx/=m;my/=m;}
  const cruiseStarted=updateCruise(this,mx,my,dt);
  if(cruiseStarted&&this.time>this.messageUntil)
   this.notice('Маршевый перелёт ×'+EXPEDITION_CRUISE.multiplier+
    ': при угрозе корабль возвращается к обычной скорости.',3.5);
  const speed=(272+this.skillRanks.engine*35)*(this.mining.active?.78:1)*
   (this.cruising?EXPEDITION_CRUISE.multiplier:1);
  const boosting=p.burstRemaining>0;
  const targetX=boosting?p.burstX*speed*2.25:mx*speed;
  const targetY=boosting?p.burstY*speed*2.25:my*speed;
  const response=1-Math.exp(-(boosting?17:5.6)*dt);
  p.vx+=(targetX-p.vx)*response;
  p.vy+=(targetY-p.vy)*response;
  p.burstRemaining=Math.max(0,p.burstRemaining-dt);
  p.burstCooldown=Math.max(0,p.burstCooldown-dt);
  p.x+=p.vx*dt;p.y+=p.vy*dt;
  // Cull decorative effects at creation, not only when painting the frame.
  this.heritage.vfx.setViewport(this.camera());
  if(length(p.vx,p.vy)>9)p.angle=Math.atan2(p.vy,p.vx)+Math.PI/2;
  if(Math.hypot(p.vx,p.vy)>150)
   this.heritage.vfx.engineTrail(p.x,p.y,p.angle,'fighter',boosting,dt);
  p.invul=Math.max(0,p.invul-dt);
  if(this.skillRanks.shield && this.time-this.lastDamageAt>3 &&
   p.shield<16+this.skillRanks.shield*24)
   p.shield=Math.min(16+this.skillRanks.shield*24,
    p.shield+dt*(1.8+this.skillRanks.shield*1.2));
  if(length(p.x-this.lastX,p.y-this.lastY)>120){
   this.lastX=p.x;this.lastY=p.y;this.stationary=0;
  }else this.stationary+=dt;
  if(this.time>55&&this.stationary>8){
   this.stationary=0;this.zones.push({x:p.x+35,y:p.y-25,r:85,fuse:1.8,fuseStart:1.8,ttl:.3});
   this.heritage.play('orbitalWarning',1.3,{x:p.x+35,y:p.y-25});
   this.notice('Орбитальная наводка — уходите из круга!',2);
  }
  this.zoneClock-=dt;
  if(this.zoneClock<=0){
   this.zoneClock=Math.max(12,28-this.time/110);
   const a=Math.random()*TAU;
   const zone={x:p.x+Math.cos(a)*135,y:p.y+Math.sin(a)*110,
     r:64,fuse:2.4,fuseStart:2.4,ttl:.3};
   this.zones.push(zone);
   this.heritage.play('orbitalWarning',1.3,zone);
  }
  // Rock positions and station discovery are spatially stable. Recheck only
  // after travel or a short interval instead of traversing world cells each AI tick.
  this.worldQueryClock-=dt;
  if(this.worldQueryClock<=0||Math.hypot(p.x-this.worldQueryX,p.y-this.worldQueryY)>75){
   this.nearRocks=this.world.nearbyRocks(p.x,p.y,Math.max(this.vw,this.vh)*.85+450);
   for(const b of this.world.discover(p.x,p.y,570+this.skillRanks.radar*190)){
    if(this.waypoint?.id===b.id)this.waypoint={id:b.id,x:b.x,y:b.y,label:b.title||baseNames[b.type]};
    if(!b.enemy&&!b.active){
    this.heritage.world('discover');
    this.notice('Обнаружена станция: '+baseNames[b.type],3);
   }
   }
   this.localStations=this.world.nearbyStations(p.x,p.y,1000,false);
   const localStations=this.localStations.filter(b=>b.active);
   this.nearDock=localStations.find(b=>b.type==='dock'&&dist(b,p)<185)||null;
   this.nearArsenalBonus=localStations.some(b=>b.type==='arsenal'&&b.module==='amplifier'&&dist(b,p)<650);
   this.nearArsenalDefense=localStations.some(b=>b.type==='arsenal'&&b.module==='jammer'&&dist(b,p)<650);
   this.nearDockField=localStations.some(b=>b.type==='dock'&&b.module==='bulwark'&&dist(b,p)<650);
   this.nearQuietLab=localStations.some(b=>b.type==='lab'&&b.module==='quiet'&&dist(b,p)<900);
    this.worldQueryX=p.x;this.worldQueryY=p.y;this.worldQueryClock=.18;
  }
  this.rockGrid.clear();
  for(const rock of this.nearRocks){
   updateRockMotion(rock,dt);
   if(rock.alive&&rock.r>=34)this.rockGrid.insert(rock);
  }
  if(!this.amberBeltSeen&&nearAmberBelt(p.x,p.y)){
   this.amberBeltSeen=true;
   this.heritage.world('amber');
   this.notice('Малый янтарный пояс: крупные астероиды задерживают вражеские снаряды. Используйте их как укрытие!',5);
  }
  if(!this.ionFieldSeen&&ionApproach(p,ION_FIELD,650)){
   this.ionFieldSeen=true;
   this.heritage.world('ion');
   this.notice('Лазурный разлом: голубое кольцо — область ионного разряда. Следите за отсчётом и обходите опасную зону.',6);
  }
  if(this.nearDock&&dist(this.nearDock,p)<165&&this.time-this.lastDamageAt>4){
   const before=p.hp;
   p.hp=Math.min(p.maxHp,p.hp+2.9*dt*(this.nearDock.module==='workshop'?1.6:1));
   recordSortieRepair(this,p.hp-before);
   let serviced=p.hp>before;
   for(const a of this.allies)if(dist(a,this.nearDock)<200){
    const prior=a.hp;
    a.hp=Math.min(a.maxHp,a.hp+3.4*dt*(this.nearDock.module==='workshop'?1.6:1));
    serviced=serviced||a.hp>prior;
   }
   if(serviced&&this.time-(this.nearDock.lastRepairVisualAt??-Infinity)>2.1){
    markDockEvent(this.nearDock,'repair',this.time);
    this.nearDock.lastRepairVisualAt=this.time;
   }
  }
  const miningStats=extractorStats(this.skillRanks.extractor||0,this.skillRanks.mining||0);
  const candidate=miningTarget(this.nearRocks,p,this.mining.target,miningStats.range);
  this.mining.target=candidate;
  const probe=this.operation?.id===PROBE_OPERATION.id?this.operation:null;
  const atProbe=!!probe&&dist(p,probe)<=PROBE_OPERATION.repairRange;
  this.interactionFocus=this.currentInteraction();
  // Action kind is locked when pressed. Neither docking nor repair may hijack mining.
  this.probeRepairing=activeInteraction(this.actionHeld,'repair',atProbe);
  this.openingRepairing=activeInteraction(this.actionHeld,'opening-repair',
   openingArcActive(this.openingArc)&&this.openingArc.kind==='rescue'&&
   Math.hypot(p.x-this.openingArc.rescueX,p.y-this.openingArc.rescueY)<=OPENING_ARC.repairRange);
  this.mining.active=activeInteraction(this.actionHeld,'mine',candidate?.alive);
  this.updateOpeningArc(dt);
  if(this.mining.active&&!this.miningIntroShown){
   this.miningIntroShown=true;
   this.notice(matchMedia('(pointer: coarse)').matches?
    'Добыча: удерживайте «Действие». Шум привлекает патрули.':
    'Удерживайте E для добычи. Техногенный сигнал привлекает патрули — выбирайте момент.',4.5);
  }
  this.heritage.extraction(this.mining.active);
  if(this.mining.active){
   const effect=this.mining.fxClock<=0;
   this.damageRock(candidate,miningStats.damagePerSecond*(this.doctrine==='prospect'?1.15:1)*dt,
    p.x,p.y,'extract',effect);
   this.mining.fxClock=effect?.20:this.mining.fxClock-dt;
  }else this.mining.fxClock=0;
  if(this.probeRepairing)this.repairProbe(dt);
  this.grid.clear();
  for(const e of this.enemies)if(e.hp>0)this.grid.insert(e);
  this.enemyComms?.update(this);
  this.shotGrid.clear();
  for(const s of this.shots)if(s.alive)this.shotGrid.insert(s);
  this.miningNoise=Math.max(0,Math.min(110,this.miningNoise-dt*MINING_NOISE.decay));
  if(this.miningNoise<MINING_NOISE.clear)this.miningNoiseWarned=false;
  if(this.miningNoise>=MINING_NOISE.warn&&!this.miningNoiseWarned){
   this.miningNoiseWarned=true;
   this.notice('Сигнал добычи усиливается. Следующий патруль может засечь вас!',3.6);
  }
  if(this.miningNoise>=MINING_NOISE.patrol&&this.time>=MINING_NOISE.firstPatrolAt){
   const alarm=this.sectorDirector(openingThreat(this.time,this.player.level));
   if(this.enemies.length<alarm.cap){
    const before=this.enemies.length;
    const source=this.lastNoiseSource||{x:p.x,y:p.y};
    const responders=alarm.types.filter(type=>
      type==='scout'||type==='fighter'||type==='flanker');
    const recovery=this.spawnGroup({...alarm,types:responders,
      groupSize:Math.min(2,alarm.groupSize)},source);
    if(this.enemies.length>before){
     this.noiseAlert={x:source.x,y:source.y,startedAt:this.time,until:this.time+2.8};
     // The patrol replaces the next scheduled group instead of surrounding
     // the player with two unrelated arrivals in the same moment.
     this.spawnClock=Math.max(this.spawnClock,4.5+recovery);
     this.miningNoise=0;this.miningNoiseWarned=false;
     this.notice('Экстрактор выдал позицию! Патруль идёт на сигнал.',4);
    }
   }
  }
  this.spawnClock-=dt;
  if(this.spawnClock<=0){
   if((this.operation?.id===RELAY_DEFENSE.id&&this.operation.phase!=='approach')||
       carrierInFlight(this.operation)){
    // The authored assault replaces ambient patrols; cap combat pressure.
    this.spawnClock=4.5;
   }else{
   const director=this.sectorDirector(openingThreat(this.time,this.player.level));
   const frontier=spawnFrontierRaid(this,director);
   const central=frontier?0:spawnCentralRaid(this,director);
   // Paid reinforcements now accompany a regular encounter. They must not
   // silently grant six seconds of relief after the larger formation.
   const recovery=frontier||central||spawnRegionalRaid(this,director)||this.spawnGroup(director);
   // Give the player room to clear an overwhelming formation, without
   // suppressing the large waves when a strong build is mowing them down.
   const pressure=this.enemies.length/Math.max(1,director.cap);
   this.spawnClock=director.interval+recovery+
    Math.min(3.5,Math.max(0,pressure-.48)*8.5);
   }
  }
  this.updateStrikes(dt);
  for(const e of this.enemies){
   if(!e.interceptCargo)updateEnemy(e,this,dt);
   if(e.entryPortalPending){
    if(this.heavyPortalShown)e.entryPortalPending=false;
    else if(e.hp>0&&!outsideCamera(e.x,e.y,this.camera(),e.r+12)){
     e.entryPortalPending=false;this.heavyPortalShown=true;
     this.heritage.vfx.bossPortal(e.x,e.y,35);
     this.heritage.play('boss',.1,{x:e.x,y:e.y});
    }
   }
  }
  this.enemyComms?.confirmExecution(this);
  for(const a of this.allies){
   a.hit=Math.max(0,(a.hit||0)-dt);
   updateAlly(a,this,dt);
  }
  this.updateMissiles(dt);
  // Defense resolves warned impacts and imminent shots before collision damage.
  // It does not kill enemies or award loot/experience while the player waits.
  updateStationDefense(this);
  for(const s of this.shots){
   if(!s.alive)continue;
   const nextX=s.x+s.vx*dt,nextY=s.y+s.vy*dt;
   const travel=Math.hypot(nextX-s.x,nextY-s.y);
   const candidates=this.rockGrid.query((s.x+nextX)*.5,(s.y+nextY)*.5,65+travel*.5);
   const cover=firstRockImpact(s.x,s.y,nextX,nextY,candidates,s.r,p);
   s.x=cover?.x??nextX;s.y=cover?.y??nextY;s.life-=dt;
   if(cover){
    s.alive=false;
    const rock=cover.rock;
    // Stone stops this projectile, but repeated fire can destroy the shelter.
    this.damageRock(rock,Math.min(12,Math.max(1,s.damage*.5)),s.x,s.y,'cover',false);
    if(!this.coverWearWarned&&rock.alive&&rock.hp<=rock.maxHp*.52&&dist(rock,p)<310){
     this.coverWearWarned=true;
     this.notice('Укрытие осыпается под огнём. Пора менять позицию.',3.2);
    }
    if(this.time-(rock.lastCoverVfxAt??-Infinity)>.12){
     rock.lastCoverVfxAt=this.time;
     this.heritage.vfx.coverImpact(s.x,s.y,rock.r,
      contactAtPoint(rock.x,rock.y,s.x,s.y));
    }
   }
   if(s.life<=0)s.alive=false;
   if(s.alive){
    let wing=null;
    for(const mission of this.support.missions){
     wing=mission.craft.find(c=>c.hp>0&&dist(s,c)<s.r+c.r);
     if(wing)break;
    }
    if(wing){s.alive=false;wing.hp-=s.damage;wing.hit=.18;
     if(wing.hp<=0)this.heritage.vfx.shipExplosion(wing.x,wing.y,24,'#80d9ff');
     else {
      const point=contactOnCircle(wing.x,wing.y,wing.r,s.x,s.y);
      this.heritage.vfx.hullImpact(point?.x??wing.x,point?.y??wing.y,false,point);
     }}
    else if(dist(s,p)<s.r+p.r){
      s.alive=false;
      const before=p.hp+p.shield;
      this.hurt(s.damage,{x:s.x,y:s.y});
      this.enemyLearning?.dealt(s.learnToken,Math.max(0,before-p.hp-p.shield));
    }
   }
  }
  this.shots=this.shots.filter(s=>s.alive);
  for(const e of this.enemies){
   e.hit=Math.max(0,(e.hit||0)-dt);
   if(e.hp>0)continue;
   if(!e.visualDeath){
    e.visualDeath=true;
    const heavy=e.type==='gunship';
    this.heritage.vfx.shipExplosion(e.x,e.y,e.r*(heavy?1.65:1),
     e.converted?'#73ffda':'#ff8594',heavy);
    if(heavy)this.heritage.vfx.nova(e.x,e.y,110,'red');
    this.heritage.play(heavy?'largeExplosion':'explosion',.18,{x:e.x,y:e.y});
   }
   this.enemyLearning?.finish(e,this.time);
   this.issueFieldCharge(e);
   if(!e.expAwarded&&!e.converted){
    e.expAwarded=true;
    this.advanceContract('kill',e);
    this.addDrop('data',e.x,e.y,enemyDataReward(e),{source:'combat'});
    const salvage=enemySalvage(e);
    // The dock repairs the ship for free. Standing inside its healing field
    // should never become a safe, automatic source of alloy.
    if(salvage&&!(this.nearDock&&dist(this.nearDock,p)<180))
     this.addDrop('ore',e.x+10,e.y-9,salvage,{source:'salvage',life:24});
   }
  }
  this.enemies=this.enemies.filter(e=>e.hp>0&&
   (e.interceptCargo||e.relayAssault||
    (e.openingCommander&&openingArcActive(this.openingArc))||
    dist(e,p)<Math.max(this.vw,this.vh)*1.65+500));
  for(const a of this.allies){
   for(const e of this.grid.query(a.x,a.y,a.r+35)){
    if(e.hp<=0||e.converted||dist(a,e)>a.r+e.r)continue;
    this.hitAlly(a,e.damage*dt*.8);
   }
  }
  this.updateShipWeapons(dt);
  updateRegionalStorms(this,dt);
  const radar=400+this.skillRanks.radar*220;
  for(const b of this.world.nearbyStations(p.x,p.y,Math.max(900,radar))){
   if(!b.enemy||(!b.strategicRole&&!this.enemyBasesUnlocked())||b.captured)continue;
   if(dist(b,p)>850)continue;
   for(const t of b.turrets){
    if(t.hp<=0)continue;
    const turretStyle=this.enemyLearning?.styleFor(t,this.time,'turret');
    t.shot-=dt;t.flash=Math.max(0,(t.flash||0)-dt);
    if(t.shot<=0){
     t.shot=2.2+Math.random()*.35;
     const target=this.support.missions.flatMap(m=>m.craft)
      .filter(a=>a.hp>0&&dist(a,t)<350)
      .sort((a,c)=>dist(t,a)-dist(t,c))[0]||p;
     if(dist(t,target)<530){
      // Turrets track only a target within their own weapon envelope.
      // Other patrols' motion sightings cannot adjust this gun's aim.
      if(target===p)this.enemyLearning?.observePlayer(p,this.time,t);
      const aim=target===p?learnedTurretAim(target,turretStyle,
       t._learningObservation?.turnSign||0):{x:target.x,y:target.y};
      if(this.enemyShot(t.x,t.y,aim.x,aim.y,16+b.rank*2,
       {learnToken:this.enemyLearning?.shotToken(t)})!==false)
       this.enemyLearning?.fired(t);
     }
    }
   }
  }
  for(const z of this.zones){
   if(z.fuse>0){z.fuse-=dt;continue;}
   z.ttl-=dt;
   if(!z.done){
    z.done=true;z.ttl=.62;
    this.heritage.vfx.meteorStrike(z.x,z.y,z.r,z.r>80);
    this.heritage.play('largeExplosion',.28,{x:z.x,y:z.y});
    if(dist(z,p)<z.r+p.r)this.hurt(27,{x:z.x,y:z.y});
    for(const e of this.grid.query(z.x,z.y,z.r+30))
     if(e.hp>0&&dist(z,e)<z.r+e.r)this.damageEnemy(e,32);
    for(const a of this.allies)if(a.hp>0&&dist(z,a)<z.r+a.r)this.hitAlly(a,31);
    // The same orbital strike breaks mineral rocks: a risky free mining opportunity.
    let cracked=0;
    for(const rock of this.nearRocks){
     if(!rock.alive||Math.hypot(rock.x-z.x,rock.y-z.y)>z.r+rock.r*.65)continue;
     this.damageRock(rock,62,z.x,z.y,'strike',cracked<5);
     if(++cracked>=16)break;
    }
   }
  }
  this.zones=this.zones.filter(z=>z.fuse>0||z.ttl>0).slice(-9);
  // A pulse affects each ship at most once per cycle, even with substeps.
  // The visible ring and these exact contact checks share ION_FIELD.r.
  const ion=ionPhase(this.time);
  if(ion.state==='warning'&&this.lastIonAudioCycle!==ion.cycle&&
    Math.hypot(p.x-ION_FIELD.x,p.y-ION_FIELD.y)<ION_FIELD.r+180){
   this.lastIonAudioCycle=ion.cycle;
   this.heritage.play('ionWarning',3,ION_FIELD);
  }
  if(ion.state==='discharge'){
   if(inIonField(p)&&p.lastIonCycle!==ion.cycle){
    p.lastIonCycle=ion.cycle;this.hurt(16,ION_FIELD);
   }
   for(const e of this.enemies)if(e.hp>0&&inIonField(e)&&e.lastIonCycle!==ion.cycle){
    e.lastIonCycle=ion.cycle;this.damageEnemy(e,20);
   }
   for(const a of this.allies)if(a.hp>0&&inIonField(a)&&a.lastIonCycle!==ion.cycle){
    a.lastIonCycle=ion.cycle;this.hitAlly(a,16);
   }
  }
  for(const a of this.allies)if(a.hp<=0&&!a.visualDeath){
   a.visualDeath=true;
   this.heritage.vfx.shipExplosion(a.x,a.y,a.r*1.2,'#8df5e2');
   this.heritage.play('droneDestroyed',.22,{x:a.x,y:a.y});
  }
  recordSortieDroneLoss(this,this.allies.filter(a=>a.hp<=0).length);
  this.allies=this.allies.filter(a=>a.hp>0);
  for(const d of this.drops){
   d.life-=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;
   d.vx*=Math.exp(-2*dt);d.vy*=Math.exp(-2*dt);
   const dx=p.x-d.x,dy=p.y-d.y,m=length(dx,dy);
   const pull=105+this.skillRanks.magnet*55;
   if(m<pull){d.x+=dx*dt*4;d.y+=dy*dt*4;}
   if(m<27&&this.collect(d)!==false)d.life=-1;
  }
  this.drops=this.drops.filter(d=>d.life>0);
  for(const f of this.flashes)f.ttl-=dt;
  this.flashes=this.flashes.filter(f=>f.ttl>0);
  updateWeaponFx(this,dt);
 }
 drawSprite(image,x,y,w,h,angle=0){
  const c=this.ctx;
  if(!image?.complete||!image.naturalWidth)return false;
  c.save();c.translate(x,y);c.rotate(angle);
  c.drawImage(image,-w/2,-h/2,w,h);c.restore();return true;
 }
 drawCarrierRoute(c,cam){
  const op=this.operation?.id===CARRIER_INTERCEPTION.id?this.operation:null;
  const missions=op?[{route:op.route,phase:op.phase}]:[];
  for(const base of this.world.stations.values()){
   if(base.type==='carrier'&&base.supplyIntercepted&&dist(base,this.player)<4200)
    missions.push({route:carrierRoute(base),phase:'secured'});
  }
  for(const mission of missions){
   const route=mission.route;if(!route)continue;
   const secured=mission.phase==='secured',returning=mission.phase==='return';
   c.save();c.lineWidth=secured?2.7:2.2;
   c.strokeStyle=secured?'#74e8a797':returning?'#e3c17b65':'#ffbb7099';
   c.setLineDash(secured?[18,10]:[10,12]);
   c.beginPath();c.moveTo(route[0].x,route[0].y);
   c.lineTo(route[1].x,route[1].y);c.lineTo(route[2].x,route[2].y);c.stroke();
   c.setLineDash([]);
   const exit=route[2];
   if(!outsideCamera(exit.x,exit.y,cam,150)){
    c.translate(exit.x,exit.y);
    const a=Math.atan2(exit.y-route[1].y,exit.x-route[1].x);
    c.rotate(a+Math.PI/2);
    c.strokeStyle=secured?'#9af8c0':'#ffc078';c.lineWidth=3;
    c.beginPath();c.moveTo(-100,-48);c.lineTo(-100,48);
    c.moveTo(100,-48);c.lineTo(100,48);c.stroke();
    c.setLineDash([6,6]);c.beginPath();c.moveTo(-100,0);c.lineTo(100,0);c.stroke();
    c.setLineDash([]);c.rotate(-a-Math.PI/2);
    c.fillStyle=secured?'#b8f8c9':'#ffe0b3';c.textAlign='center';
    c.font='bold 12px system-ui';c.fillText(secured?'МАРШРУТ ОТКРЫТ':'ЛИНИЯ УХОДА ГРУЗА',0,-65,240);
   }
   c.restore();
   if(op&&mission.phase==='approach'&&!outsideCamera(route[0].x,route[0].y,cam,160)){
    c.save();c.strokeStyle='#ffdba1';c.lineWidth=2;c.setLineDash([8,7]);
    c.beginPath();c.arc(route[0].x,route[0].y,CARRIER_INTERCEPTION.triggerRange,0,TAU);c.stroke();
    c.setLineDash([]);c.font='bold 12px system-ui';c.textAlign='center';c.fillStyle='#ffe9bd';
    c.fillText('РАЙОН ВСТРЕЧИ КОНВОЯ',route[0].x,route[0].y-63,230);c.restore();
   }
  }
 }
 drawCarrierCargo(c,e){
  const pulse=carrierPulseState(e);
  if(pulse.key==='charging'){
   c.save();c.translate(e.x,e.y);c.fillStyle='#bb82ff12';c.strokeStyle='#d6a6ff';c.lineWidth=2.5;
   c.beginPath();c.arc(0,0,CARRIER_INTERCEPTION.pulseRange,0,TAU);c.fill();
   c.setLineDash([10,7]);c.stroke();c.setLineDash([]);
   c.lineWidth=4;c.beginPath();c.arc(0,0,60,-Math.PI/2,-Math.PI/2+TAU*pulse.charge);c.stroke();c.restore();
  }
  c.save();c.translate(e.x,e.y);c.rotate(e.angle||0);
  const flash=e.hit>0;
  c.shadowColor='#ffb46c';c.shadowBlur=this.fps<34?2:flash?19:8;
  c.fillStyle='#111e36';c.strokeStyle=flash?'#fff0ca':'#ffb882';c.lineWidth=3;
  c.beginPath();c.moveTo(0,-55);c.lineTo(35,-29);c.lineTo(43,18);
  c.lineTo(28,48);c.lineTo(-28,48);c.lineTo(-43,18);
  c.lineTo(-35,-29);c.closePath();c.fill();c.stroke();
  c.shadowBlur=0;
  for(const x of [-25,0,25]){
   c.fillStyle=x===0?'#5b554a':'#554c42';c.fillRect(x-10,-24,20,55);
   c.strokeStyle='#e7ae68';c.lineWidth=1.7;c.strokeRect(x-10,-24,20,55);
   c.fillStyle='#f2c88f';c.fillRect(x-7,-15,14,3);c.fillRect(x-7,5,14,3);
  }
  c.fillStyle='#78d5f5';c.fillRect(-25,42,12,7);c.fillRect(13,42,12,7);
  c.strokeStyle=pulse.key==='vent'?'#8af0ca':'#afc5ff';c.lineWidth=4;
  c.setLineDash(pulse.key==='vent'?[5,8]:[]);
  c.beginPath();c.arc(0,0,62,-Math.PI/2-1.1,-Math.PI/2+1.1);c.stroke();c.setLineDash([]);
  c.strokeStyle=e.flightTime<(e.engineDisabledUntil||0)?'#ffbd75':'#83e6c2';c.lineWidth=3;
  c.beginPath();c.moveTo(-26,54);c.lineTo(0,63);c.lineTo(26,54);c.stroke();
  c.restore();
  const pct=Math.max(0,Math.ceil(e.hp/e.maxHp*100));
  c.save();c.textAlign='center';c.font='bold 12px system-ui';
  c.fillStyle='#ffdfb3';c.fillText('ТРАНСПОРТ · '+pct+'%',e.x,e.y-77,230);
  c.fillStyle='#142338';c.fillRect(e.x-48,e.y-68,96,7);
  c.fillStyle=pct<26?'#ff8569':'#ffcb78';c.fillRect(e.x-47,e.y-67,94*pct/100,5);
  c.font='bold 11px system-ui';c.fillStyle=pulse.key==='charging'?'#e6beff':'#a8f0d8';
  c.fillText(carrierTacticalCue(e,this.player),e.x,e.y+88,430);
  c.restore();
 }

 drawRelayDefense(c,cam){
  const op=this.operation;
  if(!op||op.id!==RELAY_DEFENSE.id)return;
  if(!outsideCamera(op.x,op.y,cam,560)){
   const phase=relayDefenseCue(op,this.time);
   const hp=Math.max(0,op.hp/op.maxHp);
   c.save();c.translate(op.x,op.y);
   const pulse=this.visuals.reducedMotion?0:.5+.5*Math.sin(this.time*2.8);
   c.strokeStyle='#81e4df';c.lineWidth=3;
   c.beginPath();c.arc(0,0,39,0,TAU);c.stroke();
   c.strokeStyle='rgba(130,237,221,'+(.22+pulse*.28).toFixed(3)+')';
   c.lineWidth=1.7;c.beginPath();c.arc(0,0,55+pulse*5,0,TAU);c.stroke();
   c.fillStyle='#09304a';c.beginPath();
   for(let i=0;i<6;i++){
    const a=i*TAU/6-Math.PI/2;
    if(i===0)c.moveTo(Math.cos(a)*29,Math.sin(a)*29);
    else c.lineTo(Math.cos(a)*29,Math.sin(a)*29);
   }
   c.closePath();c.fill();c.stroke();
   c.fillStyle='#b4fff6';c.fillRect(-15,-5,30,10);
   c.fillStyle='#082835';c.fillRect(-8,-2,16,4);
   c.strokeStyle='#1a3945';c.lineWidth=4;c.beginPath();c.moveTo(-42,67);c.lineTo(42,67);c.stroke();
   c.strokeStyle=hp<.35?'#ff9c88':'#82e8bb';c.beginPath();
   c.moveTo(-42,67);c.lineTo(-42+84*hp,67);c.stroke();
   c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle='#bcfff3';
   c.fillText('БОЕВОЙ РЕТРАНСЛЯТОР',0,-77,210);
   c.fillStyle=hp<.35?'#ffac98':'#ffe8b7';
   c.fillText(phase,0,-61,250);
   c.restore();
  }
  if(op.phase==='wave'){
   c.save();c.setLineDash([8,7]);c.strokeStyle='#ffb078bb';c.lineWidth=2;
   for(const e of this.enemies){
    if(e.relayAssault!==op.baseId||e.hp<=0||e.converted||
       !(e.relayChargeUntil>this.time)||outsideCamera(e.x,e.y,cam,60))continue;
    c.beginPath();c.moveTo(e.x,e.y);c.lineTo(op.x,op.y);c.stroke();
    c.font='bold 10px system-ui';c.fillStyle='#ffcca4';c.textAlign='center';
    c.fillText('ЗАРЯДКА ЗАЛПА',e.x,e.y-32,125);
   }
   c.restore();
  }
 }
 drawCorridorBeacon(c,cam){
  const home=this.world.home,op=this.operation;
  const returning=op?.id===CORRIDOR_OPERATION.id&&op.phase==='return';
  const active=op?.id===CORRIDOR_OPERATION.id&&op.hp>0&&!returning,secured=!!home.corridorSecured;
  if(!active&&!secured&&!returning)return;
  const site=active?op:corridorPosition(home);
  if(secured){
   // A quiet, persistent change in the environment after the mission.
   c.save();c.lineWidth=2.5;c.strokeStyle='#66d6ae55';c.setLineDash([19,12]);
   c.beginPath();c.moveTo(home.x,home.y);c.lineTo(site.x,site.y);c.stroke();
   c.restore();
  }
  if(outsideCamera(site.x,site.y,cam,90))return;
  const pulse=.5+.5*Math.sin(this.time*3.6);
  c.save();c.translate(site.x,site.y);
  if(active){
   // The focusing perimeter is faint and only appears as the ship approaches.
   if(dist(this.player,site)<510){
    c.save();c.strokeStyle='#d6a0ff25';c.lineWidth=2;c.setLineDash([8,15]);
    c.beginPath();c.arc(0,0,automaticRange(this),0,TAU);c.stroke();
    c.setLineDash([]);c.lineWidth=1.6;c.strokeStyle='#d699cf70';
    c.beginPath();c.arc(0,0,CORRIDOR_OPERATION.pulseRange,0,TAU);c.stroke();
    const charge=(op.pulseCharge||0)/CORRIDOR_OPERATION.pulsePeriod;
    if(this.time<(op.overheatedUntil||0)){
     c.strokeStyle='#81f0c0a8';c.lineWidth=3.5;
     c.beginPath();c.arc(0,0,CORRIDOR_OPERATION.pulseRange,0,TAU);c.stroke();
    }else if(charge>.01){
     c.strokeStyle=charge>.73?'#ffd499de':'#f1abffaf';c.lineWidth=4;
     c.beginPath();c.arc(0,0,CORRIDOR_OPERATION.pulseRange,-Math.PI/2,-Math.PI/2+TAU*charge);c.stroke();
    }
    c.restore();
   }
   c.shadowColor='#b455e7';c.shadowBlur=this.fps<34?4:15;
   c.fillStyle='#181b38';c.strokeStyle='#bc74ed';c.lineWidth=3;
  }else{
   c.fillStyle='#142530';c.strokeStyle='#4a897f';c.lineWidth=2;
  }
  c.beginPath();
  for(let i=0;i<6;i++){const a=-Math.PI/2+i*TAU/6;
   const x=Math.cos(a)*40,y=Math.sin(a)*40;
   if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.closePath();c.fill();c.stroke();c.shadowBlur=0;
  c.save();c.rotate(active?this.time*.45:.18);
  for(let i=0;i<3;i++){
   const a=i*TAU/3;
   c.save();c.rotate(a);c.fillStyle=active?'#472357':'#29434a';
   c.fillRect(-8,-52,16,29);
   c.strokeStyle=active?'#de82f6':'#668e84';c.lineWidth=2;
   c.strokeRect(-8,-52,16,29);c.restore();
  }
  c.restore();
  c.beginPath();c.arc(0,0,active?15+pulse*3:13,0,TAU);
  c.fillStyle=active?'#d680ff':'#546c71';c.fill();
  if(active){
   c.strokeStyle='#f3c5ff';c.lineWidth=2;c.beginPath();
   c.arc(0,0,29,-Math.PI/2,-Math.PI/2+TAU*op.hp/op.maxHp);c.stroke();
   c.font='bold 11px system-ui';c.textAlign='center';
   c.fillStyle='#f8d7ff';c.fillText('ГЛУШИТЕЛЬ',0,-68);
   const distanceToJammer=dist(this.player,op);
   const cue=corridorCue(op,this.time,distanceToJammer,automaticRange(this));
   if(cue){
    // One small solid backing keeps the mission status readable over bright asteroids.
    // The same phase appears in the cockpit when the target leaves the screen.
    c.save();c.shadowBlur=0;
    c.fillStyle='#081a2be8';c.strokeStyle=cue.color;c.lineWidth=1.2;
    c.fillRect(-160,-127,320,47);
    c.strokeRect(-160,-127,320,47);
    c.textAlign='center';c.fillStyle=cue.color;c.font='bold 11px system-ui';
    c.fillText('БОРТОВОЙ ИИ · '+cue.label,0,-107,302);
    c.fillStyle='#e1eef4';c.font='10px system-ui';
    c.fillText(cue.hint,0,-90,300);
    c.restore();
   }
   c.fillStyle='#e3b9f4';c.font='10px system-ui';
   const attackDistanceOk=distanceToJammer<=automaticRange(this);
   c.fillText(Math.ceil(op.hp/op.maxHp*100)+'% · '+
    (attackDistanceOk?'В ДАЛЬНОСТИ АВТООРУДИЙ':'СБЛИЗЬТЕСЬ ДЛЯ АТАКИ'),0,-54);
  }else{
   c.fillStyle='#9adac8';c.font='bold 10px system-ui';c.textAlign='center';
   c.fillText(returning?'ПЕРЕДАТЧИК ОТКЛЮЧЁН':'СИГНАЛ ВОССТАНОВЛЕН',0,-57);
  }
  c.restore();
 }

 drawProbe(c,cam){
  const op=this.operation;
  if(op?.id!==PROBE_OPERATION.id||outsideCamera(op.x,op.y,cam,95))return;
  const pulse=.5+.5*Math.sin(this.time*3.1);
  c.save();c.translate(op.x,op.y);
  c.lineWidth=2;c.strokeStyle='#73d6edbd';c.fillStyle='#102b3c';
  c.shadowColor='#66c9ed';c.shadowBlur=this.fps<34?4:14;
  c.beginPath();c.moveTo(-33,0);c.lineTo(-13,-20);c.lineTo(14,-20);
  c.lineTo(33,0);c.lineTo(14,20);c.lineTo(-13,20);c.closePath();c.fill();c.stroke();
  c.shadowBlur=0;
  c.strokeStyle='#bbf4ff';c.lineWidth=3;
  c.beginPath();c.arc(0,0,8+pulse*2,0,TAU);c.stroke();
  c.fillStyle='#a5e7ed';c.fillRect(-41,-5,9,10);c.fillRect(32,-5,9,10);
  c.lineWidth=4;c.strokeStyle='#67e7dc';
  c.beginPath();c.arc(0,0,43,-Math.PI/2,-Math.PI/2+TAU*op.repair/100);c.stroke();
  c.textAlign='center';c.font='bold 12px system-ui';c.fillStyle='#dbfbff';
  c.fillText('АВАРИЙНЫЙ ЗОНД',0,-69);
  c.font='11px system-ui';c.fillStyle='#9fe7e7';
  c.fillText(Math.round(op.repair)+'% · '+(dist(this.player,op)>PROBE_OPERATION.repairRange?
   'СБЛИЗЬТЕСЬ':'E / РЕМОНТ'),0,-52);
  c.restore();
  if(this.probeRepairing){
   c.save();c.strokeStyle='#81f7e0a9';c.lineWidth=4;c.setLineDash([11,7]);
   c.beginPath();c.moveTo(this.player.x,this.player.y);c.lineTo(op.x,op.y);c.stroke();
   c.restore();
  }
 }
 drawBase(b,readyBaseId=null){
  this.visuals.drawBase(this.ctx,b,this.time,this.player.x,this.player.y,
   this.network,this.cachedNetworkLinked.has(b.id));
  if(this.weaponProfile.ion&&this.fieldLoan?.charges>0){
   drawIonMark(this.ctx,b,this.time,60);
   for(const t of b.turrets||[])drawIonMark(this.ctx,t,this.time,22);
  }
  if(b.strategicRole){
   const c=this.ctx;c.save();c.font='bold 12px system-ui';c.textAlign='center';
   c.fillStyle=b.enemy?'#ffd2a1':'#b1f2d0';c.fillText(b.title,b.x,b.y-138);c.restore();
  }
  if(b.id!==readyBaseId)return;
  // The return cue never affects station behavior or mission rewards.
  const c=this.ctx,steady=this.visuals.reducedMotion;
  const wave=steady?0:.5+.5*Math.sin(this.time*2.5);
  c.save();c.translate(b.x,b.y);
  c.lineWidth=2.5;c.strokeStyle='rgba(255,205,103,'+(.55+wave*.36).toFixed(3)+')';
  c.beginPath();c.arc(0,0,122+wave*6,0,TAU);c.stroke();
  c.lineWidth=1.4;c.strokeStyle='rgba(255,230,154,.52)';
  c.beginPath();c.arc(0,0,136+wave*4,0,TAU);c.stroke();
  c.fillStyle='#ffe09c';c.textAlign='center';c.font='bold 13px system-ui';
  c.fillText('!',0,-145,30);
  c.font='bold 10px system-ui';
  c.fillText('НАГРАДА ГОТОВА',0,-161,160);
  c.restore();
 }
 render(){
  const c=this.ctx,p=this.player,cam=this.camera();
  c.setTransform(this.canvas.width/this.vw,0,0,this.canvas.height/this.vh,0,0);
  // Keep full-screen nebula in CSS compositor instead of resampling per Canvas frame.
  c.clearRect(0,0,this.vw,this.vh);
  this.visuals.drawAtmosphere(c,cam,this.time,this.fps);
  // Deterministic fixed stars: no allocations or scrolling canvas buffers.
  c.save();c.translate(-cam.x,-cam.y);
  drawRegionalWorld(this,c,cam);
  drawHowitzerAim(c,this.heavyCharge);
  const grid=260;
  for(let gy=Math.floor(cam.y/grid)-1;gy<=Math.ceil((cam.y+cam.h)/grid);gy++)
   for(let gx=Math.floor(cam.x/grid)-1;gx<=Math.ceil((cam.x+cam.w)/grid);gx++)
    for(let i=0;i<5;i++){
     const x=(gx+hash(gx*9+i,gy,this.seed))*grid;
     const y=(gy+hash(gx,gy*9+i,this.seed+7))*grid;
     c.fillStyle=i===0?'#9aafd0':'#526984';
     c.fillRect(x,y,i===0?2:1,i===0?2:1);
    }
  // Reactor hull and core share a world anchor; nearby gameplay is drawn above them.
  this.reactor.draw(c,cam,this.time,this.fps,this.visuals.reducedMotion);
  if(this.time-this.worldVisualLast>.35){
   this.worldVisualLast=this.time;
   const topology=this.world.networkTopology();
   this.cachedNetworkLinked=topology.linked;
   this.cachedWorldLinks=topology.links.filter(([a,b])=>
    Math.min(dist(a,p),dist(b,p))<2600);
   const mission=this.contract;
   this.cachedTarget=this.waypoint||this.operation||(mission&&mission.progress>=mission.goal?
    this.world.stations.get(mission.baseId):null);
  }
  for(const [a,b] of this.cachedWorldLinks){
   c.lineWidth=2;c.strokeStyle='#59dbc180';c.setLineDash([14,8]);
   c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.setLineDash([]);
  }
  this.heritage.vfx.render(c,'back',
   {worldX:cam.x,worldY:cam.y,width:cam.w,height:cam.h});
  this.visuals.drawDerelict(c,cam,this.time,this.fps);
  drawRegionalStorms(this,c,cam);
  if(!outsideCamera(ION_FIELD.x,ION_FIELD.y,cam,ION_FIELD.r+30))
   drawIonField(c,ION_FIELD,ionPhase(this.time),this.time,this.fps,this.visuals.reducedMotion);
  for(const rock of this.nearRocks||[]){
   if(!rock.alive||outsideCamera(rock.x,rock.y,cam,rock.r+10))continue;
   const ore=!!rock.rich;
   if(!this.visuals.drawRock(c,rock,this.images[ore?'rock':'rock2'],ore)){
    c.fillStyle='#8a7e72';c.beginPath();c.arc(rock.x,rock.y,rock.r,0,TAU);c.fill();
   }
   drawRockScars(c,rock);
   if(rock.rich&&this.geoScanUntil>this.time){
    // Static highlight to avoid flicker and costly animation.
    c.save();c.lineWidth=2;c.strokeStyle='#ffc56e';
    c.setLineDash([7,5]);c.beginPath();c.arc(rock.x,rock.y,rock.r+12,0,TAU);
    c.stroke();c.restore();
   }
  }
  if(this.mining.target?.alive && !outsideCamera(this.mining.target.x,this.mining.target.y,cam,50))
   drawExtraction(c,p,this.mining.target,this.time,this.skillRanks.extractor||0,this.mining.active);
  // A brief field pulse connects the intercepted emission with its source.
  const intercept=this.noiseAlert;
  if(intercept&&intercept.until>this.time&&!outsideCamera(intercept.x,intercept.y,cam,180)){
   const age=this.time-intercept.startedAt,fade=Math.max(0,1-age/2.8);
   c.save();c.lineWidth=1.8;c.setLineDash([7,8]);
   for(let ring=0;ring<2;ring++){
    const radius=26+Math.max(0,age-ring*.34)*85;
    c.strokeStyle='rgba(255,198,111,'+(fade*(ring? .28:.58)).toFixed(3)+')';
    c.beginPath();c.arc(intercept.x,intercept.y,radius,0,TAU);c.stroke();
   }
   c.restore();
  }
  const defenseZone=contractDefenseZone(this.contract,this.world);
  if(defenseZone&&!outsideCamera(defenseZone.station.x,defenseZone.station.y,cam,defenseZone.radius+30)){
   const base=defenseZone.station,r=defenseZone.radius;
   c.save();c.lineWidth=2;c.setLineDash([14,12]);c.strokeStyle='#78e4d68c';
   c.beginPath();c.arc(base.x,base.y,r,0,TAU);c.stroke();c.setLineDash([]);
   c.fillStyle='#b8fff0';c.font='bold 12px system-ui';c.textAlign='center';
   c.fillText('ЗОНА ЗАЩИТЫ · 650 М',base.x,base.y-r-13,190);
   c.restore();
  }
  const returnBase=this.operation?.id===CARRIER_INTERCEPTION.id&&this.operation.phase==='return'?
    this.world.stations.get(this.operation.baseId):
    this.operation?.id===CORRIDOR_OPERATION.id&&this.operation.phase==='return'?
   this.world.stations.get(this.operation.baseId):contractReturnStation(this.contract,this.world);
  for(const b of this.world.nearbyStations(p.x,p.y,Math.max(cam.w,cam.h)+350)){
   if(b.enemy&&!b.strategicRole&&!this.enemyBasesUnlocked())continue;
   if(!outsideCamera(b.x,b.y,cam,170)){
    this.drawBase(b,returnBase?.id);
    if(b.active&&!b.enemy)
     drawStationDefense(c,b,defenseLinked(b,{count:this.cachedNetworkLinked.size,
      linked:this.cachedNetworkLinked}),this.time,p,this.visuals.reducedMotion,this.enemies);
   }
  }
  this.drawInteractionFocus(c,cam);
  this.drawOpeningBeacon(c,cam);
  for(const d of this.drops){
   if(outsideCamera(d.x,d.y,cam,20))continue;
   if(d.hot){c.fillStyle='#ff96323d';c.beginPath();c.arc(d.x,d.y,12,0,TAU);c.fill();}
   c.fillStyle=d.type==='fieldCell'?'#d5a1f0':d.type==='ore'?(d.hot?'#ffd296':'#efbb70'):'#69e7ec';
   c.beginPath();c.arc(d.x,d.y,d.type==='fieldCell'?7:d.type==='ore'?6:4,0,TAU);c.fill();
   if(d.type==='fieldCell'){c.font='bold 10px system-ui';c.textAlign='center';c.fillStyle='#ffffff';c.fillText('+',d.x,d.y+3);c.fillText('ЗАРЯД',d.x,d.y-13);}
  }
  for(const z of this.zones){
   if(z.fuse>0){
    drawOrbitalWarning(c,z,this.time,this.visuals.reducedMotion);
   }else if(z.done&&z.ttl>0){
    if(!outsideCamera(z.x,z.y,cam,z.r*1.75))drawOrbitalAfterglow(c,z);
   }
  }
  this.drawCorridorBeacon(c,cam);
  if(this.weaponProfile.ion&&this.fieldLoan?.charges>0&&this.operation?.id===CORRIDOR_OPERATION.id)drawIonMark(c,this.operation,this.time,30);
  this.drawCarrierRoute(c,cam);
  this.drawRelayDefense(c,cam);
  this.drawProbe(c,cam);
  this.heritage.vfx.beginSurfaceLights();
  const chosenTarget=activeDesignatedTarget(this);
  if(this.cruising){
   c.save();c.textAlign='center';c.font='bold 11px system-ui';c.fillStyle='#9afce5';
   c.fillText('МАРШЕВЫЙ ПЕРЕЛЁТ ×'+EXPEDITION_CRUISE.multiplier,p.x,p.y+56);c.restore();
  }
  if(chosenTarget&&!outsideCamera(chosenTarget.x,chosenTarget.y,cam,60)){
   const radius=(chosenTarget.r||24)+14;
   c.save();c.strokeStyle='#b7f9e0';c.lineWidth=1.8;
   c.setLineDash([7,5]);c.beginPath();
   c.arc(chosenTarget.x,chosenTarget.y,radius,0,TAU);c.stroke();
   c.setLineDash([]);c.textAlign='center';c.font='bold 10px system-ui';
   c.fillStyle='#c9fff1';c.fillText('ПРИОРИТЕТ · '+Math.max(0,Math.ceil(this.designatedTarget.expiresAt-this.time))+' С',
    chosenTarget.x,chosenTarget.y-radius-12);
   c.restore();
  }
  // Heading previews belong to the tactical world, not to the cockpit HUD.
  drawEnemyIntentions(c,cam,this,this.visuals.reducedMotion,this.fps);
  const signaledGroups=new Set();
  for(const e of this.enemies){
   if(outsideCamera(e.x,e.y,cam,e.r+30))continue;
   if(e.interceptCargo){this.drawCarrierCargo(c,e);continue;}
   if(e.converted){
    c.strokeStyle='#77ffcb';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,e.r+8,0,TAU);c.stroke();
   }else if(e.type==='healer'){
    c.strokeStyle='#8be5a7';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,e.r+7,0,TAU);c.stroke();
   }else if(e.state==='charge'||e.state==='windup'){
    const preparing=e.state==='windup';
    c.strokeStyle=preparing?'#ffc070':'#ff7552';c.lineWidth=preparing?2.5:3;
    c.beginPath();c.arc(e.x,e.y,e.r+(preparing?8+3*Math.sin(this.time*19):9),0,TAU);c.stroke();
   }
   if(e.openingCommander&&openingArcActive(this.openingArc)&&
      this.openingArc.commanderSerial===e.serial){
    c.save();c.strokeStyle='#ffd08f';c.lineWidth=3;
    c.setLineDash([9,5]);c.beginPath();c.arc(e.x,e.y,e.r+19,0,TAU);c.stroke();
    c.setLineDash([]);c.fillStyle='#ffe2a9';c.font='bold 11px system-ui';
    c.textAlign='center';c.fillText('НАВОДЧИК',e.x,e.y-e.r-34);c.restore();
   }
   const spriteKey=e.type;
   if(!this.visuals.drawEnemy(c,e,this.time)&&
      !this.drawSprite(this.images[spriteKey],e.x,e.y,e.r*3,e.r*3,e.angle)){
    c.fillStyle=e.converted?'#6fe7ba':'#f07887';c.beginPath();c.arc(e.x,e.y,e.r,0,TAU);c.fill();
   }
   this.heritage.vfx.renderSurfaceLight(c,e.x,e.y,e.r);
   drawStormCharge(c,e,this.time);
   if(e.frontierRole){
    const specialist=e.stormAdapted?'ЭНЕРГО':e.type==='healer'?'РЕМОНТ':'ОХРАНА';
    c.save();c.strokeStyle=e.frontierRole==='azure'?'#8de4ff':'#94e8b7';
    c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.arc(e.x,e.y,e.r+12,0,TAU);c.stroke();
    c.setLineDash([]);c.font='bold 10px system-ui';c.fillStyle=c.strokeStyle;c.textAlign='center';
    c.fillText(specialist,e.x,e.y-e.r-21);c.restore();
   }
   if(this.time<(e.stasisUntil||0)){
    c.save();c.strokeStyle='#d5a6ff';c.lineWidth=2.5;
    c.beginPath();c.arc(e.x,e.y,e.r+10,0,TAU);c.stroke();
    if(this.time<(e.stasisLabelUntil||0)){
     c.fillStyle='#f4d8ff';c.textAlign='center';c.font='bold 10px system-ui';
     c.fillText('СТАЗИС',e.x,e.y-e.r-16,90);
    }
    c.restore();
   }
   if(this.weaponProfile.ion&&this.fieldLoan?.charges>0)drawIonMark(c,e,this.time);
   // The painted rupture supersedes the old circular damage decal.
   if(!e.capitalWearPainted)
    drawHullDamage(c,e,this.time,this.fps,this.visuals.reducedMotion);
   const intel=e.signalIntel;
   if(intel&&!e.converted&&!signaledGroups.has(intel)){
    signaledGroups.add(intel);
    const engaged=intel.mode==='engaged',leaving=intel.mode==='withdraw';
    if((!leaving||this.time<intel.cueUntil)&&
       (!engaged||this.time<intel.cueUntil)){
     const tint=engaged?'#ff7474':leaving?'#8ed8ea':'#ffd08a';
     const glyph=engaged?'!':leaving?'↗':'?';
     c.save();c.translate(e.x,e.y-e.r-26);
     c.fillStyle='rgba(7,15,30,.89)';c.strokeStyle=tint;c.lineWidth=1.6;
     c.beginPath();c.arc(0,0,9.5,0,TAU);c.fill();c.stroke();
     c.fillStyle=tint;c.textAlign='center';c.textBaseline='middle';
     c.font='bold 13px system-ui';c.fillText(glyph,0,.5);c.restore();
    }
   }
   if(e.encounterLabel&&!e.converted){
    if(e.encounterLabelStart===undefined)e.encounterLabelStart=this.time;
    if(this.time-e.encounterLabelStart<2.3){
     c.save();c.textAlign='center';c.font='bold 11px system-ui';
     c.shadowColor='#170d22';c.shadowBlur=5;c.fillStyle='#ffd4aa';
     c.fillText(e.encounterLabel,e.x,e.y-e.r-28);c.restore();
    }
   }
   if(e.hit>0){c.fillStyle='#fff9';c.beginPath();c.arc(e.x,e.y,e.r*.65,0,TAU);c.fill();}
   if(e.hp<e.maxHp*.65&&!e.converted){
    c.fillStyle='#542836';c.fillRect(e.x-15,e.y-e.r-14,30,3);
    c.fillStyle='#e77e7e';c.fillRect(e.x-15,e.y-e.r-14,30*clamp(e.hp/e.maxHp,0,1),3);
   }
   if(e.healFlash>0){c.fillStyle='#b4ffbd';c.font='bold 12px system-ui';c.fillText('+',e.x+20,e.y-18);}
  }
  for(const a of this.allies){
   if(outsideCamera(a.x,a.y,cam,50))continue;
   const image=this.images[a.role==='fighter'?'allyfighter':'allyscout'];
   this.visuals.drawAlly(c,a,this.time,image);
   this.heritage.vfx.renderSurfaceLight(c,a.x,a.y,a.r);
   drawHullDamage(c,a,this.time,this.fps,this.visuals.reducedMotion);
   if(a.messageUntil>this.time){
    c.font='11px system-ui';c.textAlign='center';c.fillStyle='#9af8ff';
    c.fillText(a.message,a.x,a.y-a.r-19);
   }
  }
  for(const mission of this.support.missions){
   for(const craft of mission.craft){
    if(craft.hp<=0||outsideCamera(craft.x,craft.y,cam,45))continue;
    this.visuals.drawAlly(c,craft,this.time,this.images.allybomber);
    this.heritage.vfx.renderSurfaceLight(c,craft.x,craft.y,craft.r);
    drawHullDamage(c,craft,this.time,this.fps,this.visuals.reducedMotion);
    c.save();c.fillStyle='#ffe1a4';c.textAlign='center';c.font='bold 10px system-ui';
    c.fillText('АВИАГРУППА',craft.x,craft.y-34);c.restore();
   }
  }
  drawFieldEffects(c,this);
  drawEnemyGunWarnings(c,this,cam,this.fps);
  drawEnemyDefenseGoals(c,this,cam,this.fps);
  // Actual radio-message receipts, drawn in world space behind ship sprites.
  this.enemyComms?.render(c,cam,this.time,this.visuals.reducedMotion,this.fps,this);
  for(const m of this.missiles){
   if(outsideCamera(m.x,m.y,cam,80))continue;
   drawSeekingMissile(c,m,this.fps);
  }
  for(const s of this.shots){
   if(outsideCamera(s.x,s.y,cam,15))continue;
   if(this.fps>=28&&this.visuals.drawHostileShot(c,s))continue;
   const d=Math.hypot(s.vx,s.vy)||1,ux=s.vx/d,uy=s.vy/d;
   c.save();c.strokeStyle=s.kind==='iris'?'#c49aff':'#ff7186';
   c.lineWidth=s.kind==='iris'?3.2:4;c.lineCap='round';
   c.beginPath();c.moveTo(s.x-ux*12,s.y-uy*12);
   c.lineTo(s.x+ux*5,s.y+uy*5);c.stroke();c.restore();
  }
  if(!this.dead&&(p.invul<=0||Math.sin(this.time*35)>.1)){
   if(!this.visuals.drawPlayer(c,p,p.level,this.time)){
    c.fillStyle='#8cecff';c.beginPath();c.moveTo(p.x,p.y-25);c.lineTo(p.x-16,p.y+20);
    c.lineTo(p.x+16,p.y+20);c.fill();
   }
   this.heritage.vfx.renderSurfaceLight(c,p.x,p.y,22);
  }
  if(!this.dead&&p.shield>0){
   c.strokeStyle='#73dffc77';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,37,0,TAU);c.stroke();
  }
  for(const f of this.flashes)drawEnergyFlash(c,f,this.fps);
  drawWeaponFx(c,this.weaponFx,this.fps,this.visuals.reducedMotion,cam);
  this.heritage.vfx.render(c,'front',
   {worldX:cam.x,worldY:cam.y,width:cam.w,height:cam.h});
  c.restore();
  // Directional station indicator is screen-fixed and never covers the ship.
  const target=this.cachedTarget;
  if(target){
   const dx=target.x-p.x,dy=target.y-p.y,d=length(dx,dy);
   if(d>140){
    const a=Math.atan2(dy,dx),r=Math.min(this.vw,this.vh)*.36;
    const x=this.vw/2+Math.cos(a)*r,y=this.vh/2+Math.sin(a)*r;
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);
    c.fillStyle='#71f4e0';c.beginPath();c.moveTo(0,-12);c.lineTo(-8,7);
    c.lineTo(8,7);c.fill();c.restore();
    c.font='12px system-ui';c.textAlign='center';c.fillStyle='#b4edec';
    c.fillText(Math.round(d)+' м',x,y+25);
   }
  }
 }
 hud(){
  this.cockpit.update(this,expForNext(this.player.level),burstStats(this.skillRanks.engine).cooldown);
  this.syncControlUI();
 }
 loop(now){
  const frameMs=clamp(now-this.last,0,220);this.last=now;
  if(frameMs>0){this.frameSamples.push(frameMs);if(this.frameSamples.length>100)this.frameSamples.shift();
   this.fps=this.fps*.92+(.08*1000/Math.max(1,frameMs));}
  if(!this.paused&&!this.dead&&frameMs>0){
   this.qualityTimer+=frameMs;
   if(this.qualityTimer>5000){
    if(this.fps<34&&this.renderScale>.72){this.renderScale=.72;this.resize();}
    else if(this.fps>55&&this.renderScale<1){this.renderScale=1;this.resize();}
    this.heritage.setBudget(this.fps);
    this.qualityTimer=0;
   }
  }
  if(!this.paused&&!this.dead&&frameMs>0){
   // Never skip simulation solely because the rendering device is slow.
   // Bound catch-up work and subdivide large steps to keep collisions stable.
   const simMs=Math.min(frameMs,130);
   const n=Math.min(4,Math.max(1,Math.ceil(simMs/35)));
   const dt=simMs/1000/n;
   for(let i=0;i<n&&!this.paused;i++)this.update(dt);
  }
  // A fatal explosion needs its own short presentation clock. Gameplay stays
  // stopped; the damage, loot and enemy simulation never advance after death.
  if(this.dead&&now<this.deathSceneEnd){
   this.heritage.vfx.update(Math.min(.05,(now-this.deathVfxAt)/1000));
   this.deathVfxAt=now;
   this.render();this.pausedRenderPending=false;
  }else{
   if(this.dead&&this.overlay.hidden){
    this.overlay.hidden=false;this.pausedRenderPending=true;
    this.presentMenu('[data-act="restart"]');
   }
   // Other paused dialogs need one static backdrop, not a permanent redraw.
   if((!this.paused&&!this.dead)||this.pausedRenderPending){
    this.render();this.pausedRenderPending=false;
   }
  }
  if(!this.paused&&now-this.lastHud>180){this.lastHud=now;this.hud();}
  requestAnimationFrame(this.loop);
 }
}
new ArcadeGame();
