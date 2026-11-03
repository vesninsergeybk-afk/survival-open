/**
 * Mission 00 — The Last Signal.
 *
 * Uses exactly the same Player, Enemy, Weapon, FriendlyBases, rendering loop,
 * input, audio, HUD, upgrade economy and campaign victory contract as missions
 * 1–4. Only the room choreography, geometry and objective scripting live here.
 * The historical /prologue/ standalone page remains an archival test scene.
 */
import {playPrologueCue} from './prologue-audio-events.js?v=audio-prologue-125';
import {MissionLog} from './mission-log.js?v=design-127';
import {TRAINING_PULSE,TRAINING_LESSONS,prologueTurretProfile,COMMAND_GUARD,LIGHT_GUARD,SIEGE_DURATION,SIEGE_PLAN,foundryHazard} from './prologue-design.js?v=design-127';
import { Enemy } from './entities.js?v=design-127';
import { PrologueTactics } from './prologue-tactics.js?v=design-127';
import { ENEMIES, WEAPONS } from './data.js?v=tactics-106';
import { Weapon } from './weapons.js?v=design-127';
import { CONFIG, GameState } from './config.js?v=base-87';
import { drawStationPart, STATION_PARTS, stationArt } from './station-art.js?v=base-86';
import { drawTurretMount, drawTurretHead } from './turret-visuals.js?v=turret-visuals-1';
import { drawPrologueTurretSprite, PROLOGUE_TURRET_DEPLOY_SECONDS } from './prologue-turret-sprites.js?v=runtime-124';
import { reactorFrame, distributorFrame, gateFrame, gateOpenProgress,
    drawFirstRoomProp, warmFirstRoomProps } from './prologue-machine-sprites.js?v=runtime-124';
import { drawPowerLink } from './beam-art.js?v=runtime-124';
import { showMissionVictory } from './mission-world.js?v=design-127';
import { drawPrologueRobot, drawPrologueRobotDeath } from './prologue-robot-art.js?v=spac1-walk-134';
import { warmRobotWrecks, drawStationRobotWreck } from './robot-wreck-sprites.js?v=wreck-121';
import { warmSpac1, warmSpac1Wake, drawSpac1Wake,
    SPAC1_WAKE_SECONDS } from './spac1-sprites.js?v=spac1-walk-134';
import { getIdleHeroSprite, heroStageFromProgress, heroMotionPose } from './hero-evolution.js?v=runtime-124';

const TAU=Math.PI*2,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// Shared cycle with stellar-window-3d.js: sunlight and occlusion agree.
function solarActivity(time){
 const phase=.5+.5*Math.sin(time*.19-.9);
 return phase*phase*(3-2*phase);
}
// Cache the alpha outline of the approved hull, not the engine exhaust.
// Each of 10 stages and 10 damaged versions is rasterized only once.
const heroShadowMasks=[new Array(10),new Array(10)];
const softShadowMasks=new WeakMap();
function heroShadowMask(stage,damaged){
 const id=clamp(Math.floor(stage)||0,0,9),slot=heroShadowMasks[damaged?1:0];
 if(slot[id])return slot[id];
 const source=getIdleHeroSprite(id,damaged);
 if(!source?.width||!source.height||typeof document==='undefined')return null;
 const mask=document.createElement('canvas');
 mask.width=192;
 mask.height=Math.max(1,Math.round(192*source.height/source.width));
 const c=mask.getContext('2d');
 if(!c)return null;
 c.drawImage(source,0,0,mask.width,mask.height);
 c.globalCompositeOperation='source-in';
 c.fillStyle='#020914';c.fillRect(0,0,mask.width,mask.height);
 slot[id]=mask;
 return mask;
}
function paintHeroShadow(ctx,mask,x,y,size,angle,sx,sy,opacity,blur=0,shear=0){
 ctx.save();ctx.translate(x,y);
 // Ground-plane compression matches the raised view of the station deck.
 ctx.scale(1,.78);
 if(shear)ctx.transform(1,0,shear,1,0,0);
 ctx.rotate(angle);ctx.scale(sx,sy);
 ctx.globalAlpha=opacity;
 if(blur&&mask&&typeof document!=='undefined'){
  let soft=softShadowMasks.get(mask);
  if(!soft){soft=document.createElement('canvas');soft.width=mask.width;soft.height=mask.height;
   const c=soft.getContext('2d');if(c){c.filter='blur(4px)';c.drawImage(mask,0,0);}softShadowMasks.set(mask,soft);}
  mask=soft;
 }
 const w=size*4.1,h=mask?w*mask.height/mask.width:w;
 if(mask)ctx.drawImage(mask,-w/2,-h/2,w,h);
 else{
  // A pointed ship-shaped fallback for the first image-loading frames.
  ctx.fillStyle='#020914';ctx.beginPath();
  ctx.moveTo(0,-h*.47);ctx.lineTo(w*.14,-h*.22);
  ctx.lineTo(w*.47,h*.14);ctx.lineTo(w*.33,h*.35);
  ctx.lineTo(w*.11,h*.22);ctx.lineTo(0,h*.43);
  ctx.lineTo(-w*.11,h*.22);ctx.lineTo(-w*.33,h*.35);
  ctx.lineTo(-w*.47,h*.14);ctx.lineTo(-w*.14,-h*.22);
  ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
const ROOM_DEFS=[
 {name:'Ремонтный док',x:-500,y:-350,w:1000,h:700,tint:'#62dacf'},
 {name:'Охранный зал',x:860,y:-420,w:1080,h:840,tint:'#4b99cd'},
 {name:'Оружейный отсек',x:2240,y:-345,w:900,h:690,tint:'#d5b17d'},
 {name:'Литейная арена',x:3350,y:-430,w:1030,h:860,tint:'#fa9355'},
 {name:'Командный центр',x:4700,y:-375,w:930,h:750,tint:'#9eb8fa'},
 {name:'Оборонное ядро',x:5910,y:-465,w:1200,h:930,tint:'#75edc8'},
 {name:'Эвакуационный шлюз',x:7410,y:-360,w:900,h:720,tint:'#a99bff'}
];
// Three playable satellite sectors expand the station vertically. Their long
// crosswalks remain visible from the main route; objective markers lead back.
const WING_DEFS=[
 {name:'Обсерватория «Гелиос»',code:'А',x:1080,y:-1290,w:990,h:820,tint:'#d99c85'},
 {name:'Система охлаждения',code:'Б',x:2350,y:630,w:910,h:850,tint:'#7cd2dd'},
 {name:'Нижний реакторный контур',code:'В',x:6080,y:750,w:1040,h:870,tint:'#80db9f'}
];
const HALL_DEFS=[
 [380,-145,590,290],[1855,-130,520,260],[2940,-110,460,220],
 [4280,-130,520,260],[5540,-125,480,250],[7000,-125,520,250],
 [1450,-590,260,250],[2680,275,260,440],[6460,425,270,520]
];
const GATE_DEFS=[[535,240],[1930,220],[3128,200],[4350,220],[5580,220],[7100,220]];
const COVER_DEFS=[[1410,0,185,210],[1545,310,115,100],[3840,0,190,185],[5070,250,145,95],[6540,0,170,170]];
const DEVICES=[
 ['generator',-165,-195,0,'Резервный генератор','reactor'],
 ['dock-gate',155,185,0,'Аварийный шлюз','gate'],
 ['sentry-a',1160,245,1,'Защитная турель «Юг»','base'],
 ['sentry-b',1720,-245,1,'Защитная турель «Север»','base'],
 ['weapon',2690,0,2,'Монтажный стенд','forge'],
 ['relay-a',3585,-250,3,'Литейный стабилизатор А','reactor'],
 ['relay-b',4190,250,3,'Литейный стабилизатор Б','reactor'],
 ['terminal',5160,-60,4,'Командный терминал','terminal'],
 ['heavy-a',6230,-275,5,'Тяжёлая турель А','base'],
 ['heavy-b',6820,270,5,'Тяжёлая турель Б','base'],
 ['core-start',6540,-185,5,'Пульт протокола «Оплот»','terminal'],
 ['transmitter',8030,0,6,'Передатчик последнего сигнала','transmitter']
];
const WING_DEVICES=[
 ['helios',1550,-1020,1,'Сканер «Гелиос»','terminal'],
 ['coolant',2840,1020,2,'Блок охлаждения','reactor'],
 ['capacitor',6650,1130,5,'Конденсатор защиты','reactor']
];
// Optional story pickups, readable in-place without blocking the mission.
const LOG_DEVICES=[
 ['log-dock',-420,275,0,'Запись технической смены','log'],
 ['log-helios',1940,-850,1,'Журнал «Гелиос»','log'],
 ['log-cooling',2540,1180,2,'Аварийный журнал охлаждения','log'],
 ['log-command',5460,250,4,'Последний приказ штаба','log'],
 ['log-reactor',7000,1390,5,'Архив протокола «Оплот»','log']
];
const LOG_MESSAGES={
 'log-dock':'АРХИВ 01 · Инженер: мы сняли орудия с гражданских корветов, чтобы вооружить конвой. Я оставил одну пушку на монтажном стенде. Если кто-то вернётся — она ваша. Не задерживайтесь у охраны без работающих турелей.',
 'log-helios':'АРХИВ 02 · Оператор «Гелиоса»: общий канал молчит. Охрана получила приказ не выпускать суда, но приказ уже некому отменить. Сканер ещё может подтвердить гражданский транспондер и отключить часть патруля.',
 'log-cooling':'АРХИВ 03 · Техник: конвой прошёл литейный зал под аварийным нагревом. Запускайте охлаждение отсюда или отключайте оба стабилизатора в зале. Охрана сервисного отсека просыпается вместе с питанием.',
 'log-command':'АРХИВ 04 · Командир: штаб отменил эвакуацию. Мы нарушили приказ. В конвое двести сорок человек; передайте им маршрут через теневую сторону звезды. Тяжёлые батареи прикроют последний сеанс.',
 'log-reactor':'АРХИВ 05 · Инженер: основной контур не выдержит загрузку — одно орудие отключится на середине. Подключите резервный конденсатор заранее или чините батарею под огнём. «Оплот» снимет блокировку передатчика.'

};
// One opening scout fires weak, clearly telegraphed shots; its peers still pursue.
const SPAC1_SHOOTER=Object.freeze({...ENEMIES.SNIPER,name:'SPAC-1 · охранный робот',
 hp:72,speed:80,damage:8,aimTime:.85,fireCooldown:4.1,
 firingRange:275,keepDistance:155,projectileDamage:5,projectileSpeed:215,size:14});
const WAVE={
 security:[[1785,245],[1850,210],[1740,165]],
 observatory:[[1350,-1120],[1900,-1100],[1660,-850]],
 maintenance:[[2470,1270],[3030,1250],[2550,740],[3120,820]],
 reinforcement:[[1840,-290],[1790,290],[1710,-280],[1790,330],[1740,95],[1810,-120]],
 workshop:[[2955,-220],[2980,210]],
 forge:[[4175,-294],[4140,295],[4020,-315],[4200,80],[4070,315],[4260,-200]],
 command:[[5500,-275],[5440,225],[5350,310]],
 siege:[[6970,-330],[6050,335],[6940,340],[6015,-300],[6980,-130],[6070,165],
        [6910,165],[6025,-145],[6930,-260],[6060,290],[7000,275],[6000,-250]]
};
// Authoritative Interstellar Fleet GLBs already shared with the campaign.
const MISSION_SCENERY=[
 ['dock-cradle',19191,-325,-165,245,0,'#8bbbd3'],
 ['q-dock-crate','q-crate',-400,270,86,0,'#89a6b4'],
 ['q-dock-vent','q-vent',205,280,110,0.7,'#86b7cc'],
 ['q-dock-doorframe','q-doorframe',530,0,200,0.5,'#89c0bd'],
 ['q-observatory-computer','q-computer',1860,-790,105,0.3,'#a0b9c9'],
 ['q-observatory-console','q-access',1200,-890,87,-0.2,'#b9a3aa'],
 ['q-observatory-vent','q-vent',1960,-1220,78,0.9,'#b9afb0'],
 ['q-security-crate','q-crate',1060,330,92,0.3,'#81a3bf'],
 ['q-security-console','q-access',1780,320,110,0.6,'#82afd4'],
 ['q-workshop-computer','q-computer',2420,275,108,-0.2,'#b9aeaa'],
 ['q-workshop-crate','q-crate',3040,-275,82,0.4,'#b5a9a6'],
 ['q-cooling-vent','q-vent',2470,1410,114,0.2,'#80b9ca'],
 ['q-cooling-access','q-access',2560,790,100,0.4,'#a3cacc'],
 ['q-foundry-vent','q-vent',3660,-340,110,0,'#c6997d'],
 ['q-foundry-crate','q-crate',4000,350,80,0.3,'#a99b88'],
 ['q-command-console','q-computer',4800,285,105,0.5,'#90c5e7'],
 ['q-command-access','q-access',5510,265,80,-0.3,'#a4caeb'],
 ['q-defense-crate','q-crate',6170,375,92,0.6,'#96bbb7'],
 ['q-defense-vent','q-vent',6870,360,122,0,'#8dc9b5'],
 ['q-reactor-computer','q-computer',6230,900,130,0.3,'#93bfae'],
 ['q-reactor-access','q-access',6960,1130,92,0.5,'#83bfa7'],
 ['q-evac-crate','q-crate',7670,320,93,0.7,'#b0b6d3'],
 ['q-evac-doorframe','q-doorframe',7095,0,190,0,'#aab4d2'],
 ['helios-telescope',19178,1870,-1170,150,.4,'#b7acc1'],
 ['helios-truss',19203,1160,-1100,170,.1,'#bfa8a7'],
 ['helios-sensor',19167,1420,-1190,104,.6,'#c5aca9'],
 ['coolant-gantry',19192,2400,1220,185,.4,'#93b3c6'],
 ['coolant-depot',19193,3130,850,195,.2,'#80b9ca'],
 ['coolant-tank',19168,3100,1350,100,0,'#83acbc'],
 ['reactor-vault',19189,6950,1390,178,.5,'#96c5a6'],
 ['reactor-frame',19203,6240,1310,160,.4,'#80c19f'],
 ['reactor-pod',19164,6980,880,120,.2,'#98d3ab'],
 ['dock-gantry',19192,275,-270,208,.2,'#82acc9'],
 ['dock-wreck',19214,340,265,123,1.2,'#a3aab2'],
 ['security-platform',19194,1410,0,246,.65,'#8eabb8'],
 ['security-cargo',19199,1545,310,135,1.3,'#adaca3'],
 ['security-sensor',19165,975,-270,83,-.5,'#86beea'],
 ['workshop-hangar',19169,2400,-245,180,.1,'#b5c6d3'],
 ['workshop-gantry',19192,2915,248,220,.8,'#bcb4a5'],
 ['foundry-depot',19193,3840,0,248,.1,'#d3ad8c'],
 ['foundry-tank',19168,4260,-310,130,.2,'#c29a85'],
 ['foundry-spar',19203,3470,280,120,0,'#c19a8a'],
 ['command-listening',19207,5070,250,195,.6,'#8cbae8'],
 ['command-array',19178,5410,-260,170,.2,'#92bbdc'],
 ['command-sensor',19167,4720,-260,95,0,'#8eabd8'],
 ['defense-core',19189,6540,0,248,0,'#88c9d0'],
 ['defense-platform-a',19194,6040,290,170,0,'#73a7a8'],
 ['defense-platform-b',19194,7050,-310,170,1.1,'#73a7a8'],
 ['evac-docking-arm',19190,7530,-270,190,0,'#b5b6c6'],
 ['evac-pods',19180,7730,270,150,.5,'#adb8c8'],
 ['evac-shipyard',19200,8180,180,230,0,'#a6b1be']
];
// Only authored landmark props enter the hybrid 3D layer. Off-route
// equipment keeps the 2D paths readable; the renderer additionally culls
// by camera and caps instances. The low-budget mobile set is even smaller.
const PROLOGUE_SCENERY_DESKTOP=new Set([
 'dock-gantry','dock-wreck',
 'security-platform','security-cargo','security-sensor',
 'helios-telescope','helios-truss','helios-sensor',
 'workshop-hangar','workshop-gantry','q-workshop-computer',
 'coolant-gantry','coolant-depot','coolant-tank',
 'foundry-depot','foundry-tank','foundry-spar',
 'command-listening','command-array','command-sensor','q-command-console',
 'defense-core','defense-platform-a','defense-platform-b',
 'reactor-vault','reactor-frame',
 'evac-docking-arm','evac-shipyard','q-evac-crate'
]);
const PROLOGUE_SCENERY_MOBILE=new Set([
 'dock-gantry','helios-telescope','security-platform','workshop-hangar',
 'coolant-gantry','foundry-depot','command-array','defense-core',
 'reactor-vault','evac-docking-arm','evac-shipyard'
]);
const OBJECTIVES=[
 'Восстановите генератор, затем откройте шлюз',
 'Подключите две турели и отразите патруль',
 'Установите пушку и испытайте её на охранниках',
 'Отключите оба стабилизатора и отбейте машины',
 'Восстановите командный терминал',
 'Запустите оборону и защитите ядро',
 'Передайте последний сигнал'
];

// Floor-embedded navigation circuits. Coordinates are authored in station space:
// connected endpoints share graph nodes, and detours clear solid obstacles.
const GUIDE_WIRES=[
 {stage:0,kind:'main',pts:[[-165,-195],[-165,-80],[100,-80],[100,185],[155,185],[295,185],[295,0],[535,0]]},
 {stage:1,kind:'main',pts:[[535,0],[860,0],[1180,0],[1180,-160],[1580,-160],[1610,-160],[1610,0],[1930,0]]},
 {stage:2,kind:'main',pts:[[1930,0],[2240,0],[2690,0],[2810,0],[3128,0]]},
 {stage:3,kind:'main',pts:[[3128,0],[3350,0],[3580,0],[3610,-165],[4060,-165],[4110,0],[4350,0]]},
 {stage:4,kind:'main',pts:[[4350,0],[4700,0],[5160,0],[5580,0]]},
 {stage:5,kind:'main',pts:[[5580,0],[5910,0],[6230,0],[6380,0],[6400,-170],[6665,-170],[6750,-170],[6790,0],[7100,0]]},
 {stage:6,kind:'main',pts:[[7100,0],[7410,0],[8030,0]]},
 {stage:1,kind:'device',id:'sentry-a',pts:[[1180,0],[1160,0],[1160,245]]},
 {stage:1,kind:'device',id:'sentry-b',pts:[[1610,-160],[1720,-160],[1720,-245]]},
 {stage:1,kind:'wing',id:'helios',pts:[[1580,-160],[1580,-500],[1580,-950],[1550,-1020]]},
 {stage:2,kind:'wing',id:'coolant',pts:[[2810,0],[2810,345],[2810,630],[2810,1020],[2840,1020]]},
 {stage:3,kind:'device',id:'relay-a',pts:[[3610,-165],[3585,-165],[3585,-250]]},
 {stage:3,kind:'device',id:'relay-b',pts:[[4110,0],[4190,0],[4190,250]]},
 {stage:4,kind:'device',id:'terminal',pts:[[5160,0],[5160,-60]]},
 {stage:5,kind:'device',id:'heavy-a',pts:[[6230,0],[6230,-275]]},
 {stage:5,kind:'device',id:'heavy-b',pts:[[6790,0],[6820,0],[6820,270]]},
 {stage:5,kind:'wing',id:'capacitor',pts:[[6665,-170],[6665,465],[6665,750],[6665,1130],[6650,1130]]},
 {stage:5,kind:'defend',id:'core',pts:[[6665,-170],[6540,-170]]}
];
const GUIDE_WING_SIGNS=[
 {stage:1,id:'helios',x:1580,y:-265,label:'↑ А · ГЕЛИОС'},
 {stage:2,id:'coolant',x:2810,y:175,label:'↓ Б · ОХЛАЖДЕНИЕ'},
 {stage:5,id:'capacitor',x:6665,y:320,label:'↓ В · КОНТУР'}
];

const COLOR={mint:'#73f9ce',amber:'#ffc18b',red:'#f57c8f'};
// Action verbs, not cryptic object names, are the primary interaction cue.
const ACTION_LABELS=Object.freeze({
 'dock-gate':'ОТКРЫТЬ ШЛЮЗ','sentry-a':'ВКЛЮЧИТЬ ТУРЕЛЬ',
 'sentry-b':'ВКЛЮЧИТЬ ТУРЕЛЬ','weapon':'УСТАНОВИТЬ ПУШКУ',
 'relay-a':'ОТКЛЮЧИТЬ КОНТУР','relay-b':'ОТКЛЮЧИТЬ КОНТУР',
 'helios':'ЗАПУСТИТЬ СКАНЕР','coolant':'ВКЛЮЧИТЬ ОХЛАЖДЕНИЕ',
 'capacitor':'ПОДКЛЮЧИТЬ РЕЗЕРВ','heavy-a':'ВКЛЮЧИТЬ БАТАРЕЮ',
 'heavy-b':'ВКЛЮЧИТЬ БАТАРЕЮ','core-start':'НАЧАТЬ ОБОРОНУ · 54 С','transmitter':'ПЕРЕДАТЬ СИГНАЛ'
});
const ACTION_NOTES=Object.freeze({
 'dock-gate':'Шлюз откроет проход в охранный сектор.',
 'sentry-a':'Турель будет самостоятельно защищать станцию.',
 'sentry-b':'Турель будет самостоятельно защищать станцию.',
 weapon:'Первое оружие корабля. После установки появятся противники.',
 'relay-a':'Отключение аварийного стабилизатора.',
 'relay-b':'Отключение аварийного стабилизатора.',
 helios:'Необязательно. Опознаёт корвет и сокращает ещё не прибывшие подкрепления с шести до трёх.',
 coolant:'Необязательно. Убирает перегретые полосы в литейном зале и даёт 35 деталей. Проснутся три охранника.',
 capacitor:'Необязательно. Предотвращает отказ одного орудия во время обороны; восстанавливает 35 прочности ядра.',
 'core-start':'Сначала восстановите обе батареи. Затем запустите оборону, когда будете готовы.',
 'heavy-a':'Тяжёлая автоматическая батарея прикроет энергетическое ядро.',
 'heavy-b':'Тяжёлая автоматическая батарея прикроет энергетическое ядро.',
 transmitter:'Запуск последней передачи завершит миссию.',
});
const stationFloor=(typeof Image!=='undefined'&&typeof document!=='undefined')?new Image():null;
if(stationFloor)stationFloor.src=new URL('./prologue/assets/station-floor.webp',document.baseURI).href;
const solarDisk=(typeof Image!=='undefined'&&typeof document!=='undefined')?new Image():null;
const stationNebula=(typeof Image!=='undefined'&&typeof document!=='undefined')?new Image():null;
if(solarDisk)solarDisk.src=new URL('./assets/space/sdo-sun-304.webp',document.baseURI).href;
if(stationNebula)stationNebula.src=new URL('./assets/space/nebula_main.jpg',document.baseURI).href;
// CanvasPattern is expensive to recreate on every room every frame.
// Cache one pattern per renderer; the floor texture itself is already local.
const floorPatterns=new WeakMap();
function floorPattern(ctx){
 if(!stationFloor?.complete||!stationFloor.naturalWidth)return null;
 let pattern=floorPatterns.get(ctx);
 if(!pattern){pattern=ctx.createPattern(stationFloor,'repeat');if(pattern)floorPatterns.set(ctx,pattern);}
 return pattern||null;
}
// Authored deck fittings all use the same local CC0 Wenrexa station atlas.
// Placement hugs bulkheads; no decoration becomes a collision-only obstacle.
const DECK_FITTINGS=[
 [['wing',.14,.17,110,-.16],['cross',.86,.19,96,.2],['depot',.86,.82,99,.5]],
 [['wing',.13,.18,95,0],['cross',.86,.18,92,.3],['basic',.15,.82,80,.25]],
 [['hanger',.15,.19,112,0],['wing',.83,.18,96,0],['cross',.86,.82,84,0]],
 [['refinery',.13,.2,106,.2],['depot',.86,.2,112,-.2],['wing',.83,.82,96,.5]],
 [['lab',.14,.19,108,.15],['cross',.86,.19,90,-.1],['basic',.13,.81,84,.2]],
 [['wing',.14,.19,115,.2],['depot',.86,.19,105,0],['cross',.83,.84,94,.2]],
 [['hanger',.14,.20,98,0],['wing',.85,.20,104,.2],['depot',.84,.83,90,0]],
 [['basic',.14,.20,86,0],['wing',.86,.21,104,.1],['cross',.84,.81,96,0]],
 [['refinery',.14,.20,116,0],['wing',.85,.20,106,0],['basic',.84,.80,93,0]],
 [['refinery',.14,.18,108,0],['depot',.86,.19,109,0],['cross',.83,.82,95,0]]
];
function rectContains(r,x,y,rad=0){return x>=r.x+rad&&x<=r.x+r.w-rad&&y>=r.y+rad&&y<=r.y+r.h-rad;}
function near(a,b,r){return Math.hypot(a.x-b.x,a.y-b.y)<r;}
function glow(ctx,x,y,r,color){
 const g=ctx.createRadialGradient(x,y,1,x,y,r);
 g.addColorStop(0,color+'7a');g.addColorStop(.45,color+'2d');g.addColorStop(1,color+'00');
 ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);
}
// Tiny shared lamp atlases replace fourteen expensive per-frame shadow blurs.
// Only three tint variations are needed for all ten rooms.
const awakeningLampSprites=new Map();
function awakeningLampSprite(tint){
 if(awakeningLampSprites.has(tint))return awakeningLampSprites.get(tint);
 if(typeof document==='undefined')return null;
 const image=document.createElement('canvas');image.width=116;image.height=60;
 const c=image.getContext('2d');
 if(!c)return null;
 const halo=c.createRadialGradient(58,30,0,58,30,55);
 halo.addColorStop(0,tint+'a8');
 halo.addColorStop(.31,tint+'45');
 halo.addColorStop(1,tint+'00');
 c.fillStyle=halo;c.fillRect(3,0,110,60);
 c.strokeStyle=tint;c.lineWidth=1.3;
 c.fillStyle='#16303c';c.fillRect(26,22,64,16);
 c.strokeRect(26,22,64,16);
 c.fillStyle=tint;c.fillRect(31,26,54,8);
 c.fillStyle='#f1fff9';c.fillRect(36,28,44,3);
 awakeningLampSprites.set(tint,image);
 return image;
}
function tube(ctx,x,y,w,h,tint){ctx.fillStyle='#0a1726';ctx.fillRect(x,y,w,h);ctx.strokeStyle=tint+'9a';ctx.lineWidth=5;ctx.strokeRect(x,y,w,h);}
function sprite(ctx,type,x,y,size,rot=0,alpha=1){drawStationPart(ctx,STATION_PARTS[type]??STATION_PARTS.basic,x,y,size,rot,alpha);}
function createBase(template,id,x,y,type,turretLevel){
 const mounts=turretLevel?[2,4]:[];
 const t=mounts.map(mount=>({mount,level:turretLevel,path:turretLevel>=3?'rail':null,
    cooldown:.2,heat:0,overheat:0,learnedUntil:0,beam:null,lastShot:0,
    aimAngle:(mount-2)*Math.PI/4,tracked:null,scanDelay:0,flash:0,recoil:0,
    integrity:100,disabled:false}));
 return {...template,id,x,y,anchorX:x,anchorY:y,type,displayName:id,
    hp:180,maxHp:180,discovered:true,scanned:true,visited:false,activated:false,
    activationTime:0,vx:0,vy:0,turrets:t,sockets:Math.max(1,t.length),
    hangarCapacity:1,hangarTier:0,escortUpgrades:{hull:0,engine:0,gun:0},
    turretBeam:null,development:{defense:0,research:0,logistics:0},
    defense:{level:0,mode:null,active:0,cooldown:0,reserve:0,recent:0,recentTime:0,visual:0}};
}
// Disabled mechanisms already scattered through the station. Coordinates are
// inside room corners, away from objectives and mandatory movement corridors.
const STATION_WRECK_LAYOUT=[
 [-375,-265,'guard',0,102],[360,-270,'industrial',1,105],
 [970,-315,'guard_alt',2,104],[1810,310,'scrap',0,112],
 [2320,255,'industrial',3,108],[3040,-270,'guard',1,114],
 [3440,-340,'guard_alt',0,118],[4280,300,'scrap',2,110],
 [4780,-285,'guard',3,110],[5525,300,'industrial',0,104],
 [6005,345,'scrap',3,122],[7010,-375,'guard_alt',1,108],
 [7490,-270,'guard',2,116],[8200,270,'industrial',2,110],
 [1160,-1205,'scrap',1,120],[1950,-545,'guard_alt',3,105],
 [2450,730,'guard',1,116],[3160,1370,'scrap',2,114],
 [6160,900,'industrial',3,112],[7000,1510,'guard_alt',0,110]
];
export class PrologueMissionWorld{
 constructor(game){
  this.index=0;this.scene={name:'Последний сигнал'};
   this._audioGame=game;this.nextCoreHitCue=0;this.coreWarningLevel=0;
  this.cx=game.player.x;this.cy=game.player.y-95;
  this.rooms=ROOM_DEFS.map(r=>({...r,x:this.cx+r.x,y:this.cy+r.y}));
  this.wings=WING_DEFS.map(r=>({...r,x:this.cx+r.x,y:this.cy+r.y}));
  this.halls=HALL_DEFS.map(([x,y,w,h])=>({x:this.cx+x,y:this.cy+y,w,h}));
  this.cover=COVER_DEFS.map(([x,y,w,h])=>({x:this.cx+x-w/2,y:this.cy+y-h/2,w,h}));
  this.doors=GATE_DEFS.map(([x,width],i)=>({x:this.cx+x,y:this.cy,width,open:0,target:0,id:i,openingElapsed:0}));
  this.devices=DEVICES.concat(WING_DEVICES,LOG_DEVICES).map(([id,x,y,phase,name,kind])=>({id,x:this.cx+x,y:this.cy+y,phase,name,kind,done:false,activatedAt:null}));
  this.phase=0;this.entered=new Set([0]);this.victory=false;this.failed=false;
  // Emergency lamps wake when a sector is entered; the opening dock stays
  // dark until the player actually repairs its generator.
  this.roomEntryAt=Array(10).fill(null);
  this.paintedRooms=this.rooms.concat(this.wings);
  this.roomLayers=new Map();this.roomCacheStats={hits:0,paints:0,evictions:0};
  this.guideGraph=this._makeGuideNetwork();
  this.guideRouteCache=null;
  this.hallGaps=this.halls.map((hall,i)=>this._makeHallGap(hall,i));
  this.waves={security:0,reinforcement:0,observatory:0,workshop:0,maintenance:0,forge:0,command:0,siege:0};
  // These chassis exist physically before they awaken. Their living Enemy
  // objects are created only AFTER all 24 startup poses have played.
  this.spac1Spots=['security','reinforcement','observatory'].flatMap(group=>
   WAVE[group].map(([dx,dy],index)=>({
    group,index,x:this.cx+dx,y:this.cy+dy,
    direction:[2,4,0,6][index%4],wakeAt:Infinity,
    queued:false,active:false,spawnDef:null
   })));
  this.tactics=new PrologueTactics(this);
  this.waveAt={reinforcement:Infinity,forge:Infinity,siege:Infinity};
  this.securityClear=false;this.workshopClear=false;this.forgeClear=false;
  this.observatoryClear=false;this.maintenanceClear=false;this.reactorReady=false;
  this.commandClear=false;this.defenseClear=false;this.coreHp=200;this.coreMaxHp=200;
  this.siegeStarted=false;this.transmissionAt=Infinity;this.lastHud='';
  this.uploadProgress=0;this.uploadDuration=SIEGE_DURATION;this.heavyTowersOnline=false;
  // SPAC-1 wrecks persist through the short mission; cap the amount drawn.
  this.robotDeaths=[];
  this.stationWrecks=STATION_WRECK_LAYOUT.map(([x,y,family,variant,size],i)=>({
   x:this.cx+x,y:this.cy+y,family,variant,size,seed:i*1.73+1,opacity:.92
  }));
  warmFirstRoomProps();
  warmRobotWrecks();
  warmSpac1();warmSpac1Wake(true);
  this.logsCollected=0;this.lessonAwards=new Set();this.spawnWarnings=[];
  this.siegeStartAt=Infinity;this.siegePlanIndex=0;this.barrelFault=false;this.transmissionQueue=[];
  this.radioUntil=0;this.forgeStartedAt=Infinity;this.forgeStopped=false;
  this.evacuateReadyAt=Infinity;this.missileExplained=false;
  this.repairCooldown=0;
  this.repairHold=null;
  this.scenery=MISSION_SCENERY.map(([id,model,x,y,span,yaw,tint])=>({
   id,model,x:this.cx+x,y:this.cy+y,span,yaw,tint
  }));
 }
 point(dx,dy){return {x:this.cx+dx,y:this.cy+dy};}
 enemyTargetFor(enemy,player,game){return this.tactics.targetFor(enemy,player,game);}
 enemySteering(enemy,game,vx,vy){return this.tactics.steering(enemy,game,vx,vy);}
 canEnemyFire(enemy,game){return this.tactics.canFire(enemy,game);}
 get3DProps(){
  // Oversized decorative GLBs covered gameplay objects and became translucent
  // as the corvette approached. Leave station machinery in the 2D atlas and
  // reserve the GPU budget for animated robots and the observation windows.
  return [];
 }
 getSolarWindows(){
  return [
   {id:'helios',x:this.cx+1250,y:this.cy-1535,w:650,h:220,
    bulkheadY:this.wings[0].y,powered:this.done('generator')},
   {id:'command',x:this.cx+4875,y:this.cy-655,w:610,h:240,
    bulkheadY:this.rooms[4].y,powered:this.done('terminal')}
  ];
 }

 device(id){return this.devices.find(d=>d.id===id);}
 done(id){return !!this.device(id)?.done;}
 gate(i){return this.doors[i];}
 openGate(i,game){const d=this.doors[i];if(d.target)return;
  d.target=1;game._announce?.('Гермозатвор '+(i+1)+' открыт · следуйте по маршруту');
  playPrologueCue(game,'gate_motor',d,.9);
  game.worldVfx?.nova(d.x,d.y,160,'cyan');}
 enter(game){
  // The first room contains no patrols; let its machinery and HUD settle
  // before downloading the large SPAC-1 atlas bundle.
  game.worldObstacles=[];game.worldCaches=[];game.friendlyBases.nextRaidAt=Infinity;
  game.friendlyBases.credits=240;
  const template=game.friendlyBases.bases[0]||{};
  const defs=[
   ['generator',-165,-195,'dock',0],['sentry-a',1160,245,'outpost',2],
   ['sentry-b',1720,-245,'outpost',2],['heavy-a',6230,-275,'arsenal',3],
   ['heavy-b',6820,270,'arsenal',3]
  ];
  game.friendlyBases.bases=defs.map(([id,x,y,type,rank])=>{
    const p=this.point(x,y);
    const base=createBase(template,'prologue-'+id,p.x,p.y,type,rank);
    base.displayName=this.device(id)?.name||base.displayName;
    // Reveal installations as the story reaches their rooms.
    base.discovered=id==='generator';
    base.scanned=base.discovered;
    return base;
  });
  game.friendlyBases.navigationTargetId='prologue-generator';
  game.player.heal(game.player.maxHp);
  // Only this mission's *loadout* changes. The ship, combat rules and skill
  // tree are the same ones used in every other campaign level.
  game.player.weapons.length=0;
  game.player.trainingProgression=true;game.player.trainingEarned=0;game.player.trainingSpent=0;
  game.player.exp=0;game.player.expToNext=3;game.player.level=1;game._pendingLevelUps=0;
  if(typeof document!=='undefined'&&typeof window!=='undefined'){
   game.missionLog??=new MissionLog(game);game.missionLog.reset(this);
  }
  game._announce?.('БОРТОВОЙ КОМПЬЮТЕР · Станция не отвечает. Найдите последний приказ и передайте его за пределы системы. Орудие снято — начните с генератора: подлетите и удерживайте ремонтный луч.');
  this._hud(game);
 }
 base(id,game){return game.friendlyBases.bases.find(b=>b.id==='prologue-'+id);}
  alive(game,group){return this.spawnWarnings.some(w=>w.group===group)||game.enemies.some(e=>e.hp>0&&e.prologueGroup===group)||
   this.spac1Spots.some(s=>s.group===group&&s.queued&&!s.active);}
 spawn(game,group,points,index,limit,type,hp,velocity){
  const i=this.waves[group];if(i>=limit)return;
  const [dx,dy]=points[i%points.length],p=this.point(dx,dy);
   const sleeping=this.spac1Spots.find(s=>s.group===group&&s.index===i);
   if(sleeping){
    // Three security robots wake one after another. Later patrols use the
    // same animation at their pre-existing positions, without a spawn flash.
    const delay=group==='security'?i*.45:group==='observatory'?i*.35:0;
    sleeping.wakeAt=game.gameTime+delay;
    sleeping.queued=true;
    sleeping.spawnDef={type,hp,velocity};
    this.waves[group]++;
    return;
   }
   this.queueEnemy(game,group,i,p,type,hp,velocity);
   this.waves[group]++;
  }
  _spawnActive(game,group,i,p,type,hp,velocity,flash){
  const difficulty=game._computeDifficultyMults?.()||{hpMult:1,dmgMult:1};
  const e=new Enemy(p.x,p.y,type,difficulty.hpMult,difficulty.dmgMult);
  if(Number.isFinite(hp)){e.hp=hp*difficulty.hpMult;e.maxHp=e.hp;}
  if(Number.isFinite(velocity))e.speed=velocity;
  e.prologueGroup=group;e.missionStructure=true;
  this.tactics.onSpawn(e,group,i,game);
   // Carry the last activation orientation into the first living idle pose;
   // otherwise Enemy's default angle briefly shows its back to the player.
   if(Number.isFinite(p.direction))e.visualAngle=(p.direction-4)*Math.PI/4;
  if(group==='siege')e.prologueSiege=true;
   e.prologueHeavy=group==='command'||(group==='siege'&&type.hp>=80);
   game.enemies.push(e);
   if(flash&&i===0)playPrologueCue(game,'robot_spawn',p,.8);
   if(flash)game.worldVfx?.nova(p.x,p.y,56,'red');
   return e;
 }
 enterPhase(game,phase){
  if(this.entered.has(phase))return;
  this.endRepairBeam(false);
  this.entered.add(phase);this.phase=phase;
  this.roomEntryAt[phase]=game.gameTime;
  const revealed=phase>=5?['sentry-a','sentry-b','heavy-a','heavy-b']:
    phase>=1?['sentry-a','sentry-b']:[];
  for(const id of revealed){
    const base=this.base(id,game);
    if(base){base.discovered=true;base.scanned=true;}
  }
  game.player.heal(phase===5?30:24);
  playPrologueCue(game,'sector_entered',null,.65);
  const story=[
   'Резервный генератор подаёт признаки жизни. Шлюзы заклинило.',
   'Охранные дроны ещё исполняют старый приказ. Не вступайте в бой без орудия: используйте укрытия и турели.',
   'Стенд сохранил импульсную пушку. Автоогонь работает только вблизи и при прямой видимости. Нижний отсек охлаждения — необязательная подготовка.',
   'Перегрев отмечен полосами на полу: янтарный предупреждает, красный обжигает. Отключите два стабилизатора, чтобы остановить нагрев и пробуждение машин.',
   'КОМАНДНЫЙ ЦЕНТР: основной вычислительный узел повреждён. Восстановите его инженерным лучом.',
   'Передача заперта протоколом «Оплот». Почините обе батареи, затем сами запустите 54-секундную загрузку на пульте у ядра. Нижний контур даёт резерв питания.',
   'ПОСЛЕДНИЙ СИГНАЛ: передатчик ещё работает. Враг уже у внешнего шлюза.'
  ];
  game._announce?.('СЕКТОР 0'+(phase+1)+' · '+ROOM_DEFS[phase].name+' · '+story[phase]);
  if(phase===1){
   playPrologueCue(game,'reinforcements',null,.6);
    warmSpac1Wake(true);
   for(let i=0;i<3;i++)this.spawn(game,'security',WAVE.security,i,3,
     i===0?SPAC1_SHOOTER:ENEMIES.BAT,72,i===0?80:95);
  }
  if(phase===3){this.waveAt.forge=game.gameTime+2;this.forgeStartedAt=game.gameTime;}
 }
 canInteract(game){
  const available=this.devices.filter(d=>d.phase===this.phase&&!d.done&&near(game.player,d,133));
  for(const d of available){
   if(d.id==='dock-gate'&&!this.done('generator'))continue;
   if(d.id==='core-start'&&(!this.done('heavy-a')||!this.done('heavy-b')))continue;
   // Broken systems are restored via the same repair-beam action as Mission 01.
   if(d.id==='generator'||d.id==='terminal')continue;
   if(d.kind==='base')continue; // Guns are started by a sustained beam.
   return {type:'prologue',device:d,name:d.name};
  }
  return null;
 }
 interact(game){
  const action=this.canInteract(game);if(!action)return false;
  const d=action.device;
  if(d.kind==='log'){
   d.done=true;this.logsCollected++;
   playPrologueCue(game,'log_collected',d,.82);
   game.friendlyBases.credits+=12;
   game.createFloatingText?.('АРХИВ '+this.logsCollected+'/5 · +12 деталей',d.x,d.y-70,COLOR.mint);
   game.worldVfx?.nova(d.x,d.y,90,'cyan');
   game._announce?.(LOG_MESSAGES[d.id]);
   game.missionLog?.open(d.name,LOG_MESSAGES[d.id]);
   return true;
  }
  if(d.kind==='base'){
   const b=this.base(d.id,game);
   const result=game.friendlyBases.buy(game,b,'activate');
   if(!result?.ok){game._announce?.(result?.message||'Недостаточно ресурсов');return false;}
  }
   d.done=true;d.activatedAt=game.gameTime;
   const cue={helios:'scanner_online',coolant:'coolant_online',
    capacitor:'capacitor_online',weapon:'weapon_installed',
    'relay-a':'relay_disabled','relay-b':'relay_disabled',
    transmitter:'transmission_started'}[d.id];
   if(cue)playPrologueCue(game,cue,d);
  game.worldVfx?.nova(d.x,d.y,142,d.kind==='reactor'?'gold':'cyan');
  game.createFloatingText?.('АКТИВИРОВАНО',d.x,d.y-65,COLOR.mint);
   if(d.id==='dock-gate')this.openGate(0,game);
  if(d.id==='sentry-a'||d.id==='sentry-b'){
   if(this.done('sentry-a')&&this.done('sentry-b')){
    this.waveAt.reinforcement=game.gameTime+1.8;
    playPrologueCue(game,'reinforcements',null,.88);
    game._announce?.('Обе турели в сети! Зафиксированы вражеские подкрепления.');
   }
  }
  if(d.id==='helios'){
   for(const spot of this.spac1Spots)if(spot.group==='observatory')spot.isolated=true;
   game._announce?.('ГЕЛИОС · Ваш корвет опознан. Часть охраны остаётся в спящем режиме; оставшиеся подкрепления сокращены. Роботы выполняли приказ не выпускать суда со станции.');
  }
  if(d.id==='coolant'){
   for(let i=0;i<3;i++)this.spawn(game,'maintenance',WAVE.maintenance,i,3,ENEMIES.ZOMBIE,38,72);
   game.friendlyBases.credits+=35;
   game._announce?.('ОХЛАЖДЕНИЕ В СЕТИ · Полосы перегрева в литейном зале безопасны. +35 деталей. Сервисная охрана проснётся через секунду.');
  }
  if(d.id==='capacitor'){
   this.coreHp=Math.min(this.coreMaxHp,this.coreHp+35);
   const fault=this.base('heavy-b',game)?.turrets.find(t=>t.prologueFault);
   if(fault){fault.integrity=Math.max(50,fault.integrity||0);fault.disabled=false;fault.prologueFault=false;}
   game._announce?.('РЕЗЕРВ ПИТАНИЯ ПОДКЛЮЧЁН · Отказ орудия во время загрузки предотвращён. Прочность ядра +35.');
  }
  if(d.id==='weapon'){
   if(!game.player.weapons.some(w=>w.id==='starter_pulse'))game.player.weapons.push(new Weapon(TRAINING_PULSE));
   this.weaponInstalledAt=game.gameTime;
   game._announce?.('ПУШКА УСТАНОВЛЕНА · Стреляет автоматически в радиусе 150 м. Сблизьтесь с целью; стены и опоры перекрывают огонь.');
   for(let i=0;i<2;i++)this.spawn(game,'workshop',WAVE.workshop,i,2,ENEMIES.ZOMBIE,32,62);
  }
  if(d.id==='core-start'){
   this.siegeStarted=true;this.siegeStartAt=game.gameTime;
   playPrologueCue(game,'siege_started',null,1.05);
   game._announce?.('ОПЛОТ · Три группы атакуют с перерывами. Красные взломщики идут к ядру, перехватчики охотятся за корветом, стрелки готовят прицельный выстрел. Ремонтируйте в затишье.');
  }
  if(d.id==='transmitter'){
   this.transmissionAt=game.gameTime+4.2;
   game._announce?.('ПЕРЕДАЧА СИГНАЛА · удерживайте позицию до завершения связи');
  }
  return true;
 }

 // The beam is a sustained, targeted action, shared by keyboard and touch.
 repairCandidate(game){
  const p=game.player;
  const device=this.phase===0?this.device('generator'):
    this.phase===4?this.device('terminal'):null;
  if(device&&!device.done&&near(p,device,device.id==='generator'?140:165)){
   return {id:device.id,x:device.x,y:device.y,name:device.name,
     duration:device.id==='generator'?2.25:2.7};
  }
  // Unpowered turrets need continuous contact; the purchase happens once.
  const turretIds=this.phase===1?['sentry-a','sentry-b']:
     this.phase===5?['heavy-a','heavy-b']:[];
  for(const id of turretIds){
   const d=this.device(id),b=this.base(id,game);
   if(d&&!d.done&&!b?.activated&&near(p,d,180))
    return {id,x:d.x,y:d.y,name:d.name,duration:id.startsWith('heavy')?5:4.2};
  }
  if(this.phase===5&&this.siegeStarted&&this.coreHp<this.coreMaxHp-1){
   const core=this.point(6540,0);
   if(near(p,core,190))return {id:'core',x:core.x,y:core.y,
     name:'Энергетическое ядро',duration:1.8};
  }
  const range=(p.fieldSkills?.field_repair||0)>=1?195:145;
  let nearest=null,dist=Infinity;
  for(const b of game.friendlyBases.bases){
   if(!b.activated||b.hp<=0)continue;
   if(b.hp>=b.maxHp-1&&!b.turrets.some(t=>(t.integrity??100)<100))continue;
   const d=Math.hypot(p.x-b.x,p.y-b.y);
   if(d<range&&d<dist){nearest=b;dist=d;}
  }
  return nearest?{id:'fixture:'+nearest.id,x:nearest.x,y:nearest.y,
    name:'Повреждённая установка',duration:(p.fieldSkills?.field_repair||0)?1.1:1.65}:null;
 }
 beginRepairBeam(game){
  if(game.state!==GameState.PLAYING)return false;
  if(this.repairHold)return true;
  if(game.gameTime<this.repairCooldown){
   game._announce?.('Ремонтный контур перезаряжается.');return false;
  }
  const t=this.repairCandidate(game);
  if(!t){
   const d=this.phase===0?this.device('generator'):
     this.phase===4?this.device('terminal'):null;
   game._announce?.(d&&!d.done?
      'Подлетите ближе к '+d.name.toLowerCase()+' и удерживайте ремонтный луч.':
      'Для ремонта подлетите к повреждённому устройству.');
   return false;
  }
  this.repairHold={id:t.id,progress:0,duration:t.duration,beam:null};
  playPrologueCue(game,'beam_start',t,.62);
  return true;
 }
 endRepairBeam(interrupted=true){
  const hold=this.repairHold;
  if(interrupted&&hold?.progress>=.22&&this._audioGame?.state===GameState.PLAYING)
   playPrologueCue(this._audioGame,'beam_interrupted',
    this.device(hold.id)||this._audioGame.player,.42);
  if(hold?.beam)hold.beam.ttl=0;
  this.repairHold=null;
 }
 updateRepairBeam(game,dt){
  const hold=this.repairHold;
  if(!hold)return;
  const t=this.repairCandidate(game);
  if(game.state!==GameState.PLAYING||!t||t.id!==hold.id){
   this.endRepairBeam();
   game._announce?.('Луч прерван: подлетите к устройству и удерживайте кнопку.');
   return;
  }
  hold.progress=Math.min(1,hold.progress+dt/hold.duration);
  if(!hold.beam){
   hold.beam={x:game.player.x,y:game.player.y,x2:t.x,y2:t.y,
     color:'#45f7a0',coreColor:'#effff0',mode:'repair',ttl:.14,total:.14};
   game.beams.push(hold.beam);
  }else{
   hold.beam.x=game.player.x;hold.beam.y=game.player.y;
   hold.beam.x2=t.x;hold.beam.y2=t.y;hold.beam.ttl=.14;
  }
  if(hold.progress>=1){
   const completedId=hold.id;
   this.endRepairBeam(false);
   this._finishRepairBeam(game,completedId);
  }
 }
 // Shared economy applies the effect only after sustained contact.
 // Public calls only begin a hold, never instantly activate a machine.
 useRepairBeam(game){return this.beginRepairBeam(game);}
 // Commit the shared repair effect after uninterrupted contact.
 _finishRepairBeam(game,completedId=null){
  if(game.state!==GameState.PLAYING||game.gameTime<this.repairCooldown)return false;
  if(['sentry-a','sentry-b','heavy-a','heavy-b'].includes(completedId)){
   const d=this.device(completedId),b=this.base(completedId,game);
   if(!d||d.done||d.phase!==this.phase||!b||
      Math.hypot(game.player.x-d.x,game.player.y-d.y)>180)return false;
   const result=game.friendlyBases.buy(game,b,'activate');
   if(!result?.ok){game._announce?.(result?.message||'Не удалось подключить турель');return false;}
   d.done=true;this.repairCooldown=game.gameTime+.65;
   // Hatches take time to open; weapons stay safe until the turret is up.
   b.visualActivatedAt=game.gameTime;
   for(const turret of b.turrets){
    turret.visualLockUntil=game.gameTime+PROLOGUE_TURRET_DEPLOY_SECONDS;
    turret.disabled=true;
   }
   playPrologueCue(game,completedId.startsWith('heavy')?'heavy_boot':'turret_boot',d);
   game.worldVfx?.nova(d.x,d.y,142,'cyan');
   game.createFloatingText?.('ТУРЕЛЬ ПОДКЛЮЧЕНА',d.x,d.y-65,COLOR.mint);
   if(this.done('sentry-a')&&this.done('sentry-b')&&this.waveAt.reinforcement===Infinity){
    this.waveAt.reinforcement=game.gameTime+1.8;
    playPrologueCue(game,'reinforcements',null,.88);
    game._announce?.('Обе турели в сети! Зафиксированы вражеские подкрепления.');
   }
   return true;
  }
  for(const id of ['generator','terminal']){
   const device=this.device(id);
   if(!device||device.done||device.phase!==this.phase||
      Math.hypot(game.player.x-device.x,game.player.y-device.y)>
        (id==='generator'?140:165))continue;
   if(id==='generator'){
    const result=game.friendlyBases.buy(game,this.base('generator',game),'activate');
    if(!result?.ok){game._announce?.(result?.message||'Не удалось запустить генератор');return false;}
   }
   device.done=true;device.activatedAt=game.gameTime;
   this.repairCooldown=game.gameTime+2.5;
   game.beams.push({x:game.player.x,y:game.player.y,
    x2:device.x,y2:device.y,color:'#57fca4',coreColor:'#d7ffda',mode:'repair',ttl:.85,total:.85});
   game.worldVfx?.nova(device.x,device.y,190,'green');
   playPrologueCue(game,id==='generator'?'reactor_online':'terminal_online',device);
   if(id==='generator'){
    // Preload complete walk/attack sheets while the player opens the
    // gate and travels to the first patrol; initial repair remains smooth.
    warmSpac1();
     warmSpac1Wake(true);
    game._announce?.('ГЕНЕРАТОР ОЖИЛ · аварийное питание поступает к шлюзу');
   }else{
    game._announce?.('ОСНОВНОЙ УЗЕЛ НЕИСПРАВЕН · запускаю резервный протокол «ОПЛОТ»');
    for(let i=0;i<3;i++)this.spawn(game,'command',WAVE.command,i,3,i===0?COMMAND_GUARD:LIGHT_GUARD,i===0?96:38,i===0?52:88);
   }
   return true;
  }
  const enhanced=(game.player.fieldSkills?.field_repair||0)>=1;
  const core=this.point(6540,0);
  if(this.phase===5&&this.siegeStarted&&this.coreHp<this.coreMaxHp-1&&
     Math.hypot(game.player.x-core.x,game.player.y-core.y)<190){
    const price=enhanced?10:18;
    if(game.friendlyBases.credits<price){game._announce?.('Для ремонта ядра нужны детали.');return false;}
    game.friendlyBases.credits-=price;
    this.coreHp=Math.min(this.coreMaxHp,this.coreHp+(enhanced?42:27));
    this.repairCooldown=game.gameTime+(enhanced?9:13);
    game.beams.push({x:game.player.x,y:game.player.y,x2:core.x,y2:core.y,
      color:'#57fca4',coreColor:'#ffffff',mode:'repair',ttl:.55,total:.55});
    game.worldVfx?.boostCollect(core.x,core.y,'green');
    playPrologueCue(game,'repair_complete',core,.9);
    game.createFloatingText?.('ЯДРО ВОССТАНОВЛЕНО',core.x,core.y-145,'#8fffc3');
    return true;
  }
  const range=enhanced?195:145;
  const nearby=game.friendlyBases.bases.filter(b=>b.activated&&b.hp>0&&
   Math.hypot(b.x-game.player.x,b.y-game.player.y)<range)
   .sort((a,b)=>Math.hypot(a.x-game.player.x,a.y-game.player.y)-
                 Math.hypot(b.x-game.player.x,b.y-game.player.y));
  const base=nearby[0];
  if(!base){game._announce?.('Для ремонта подлетите к работающей турели или генератору.');return false;}
  const turret=base.turrets.find(v=>(v.integrity??100)<100);
  if(!turret&&base.hp>=base.maxHp-1){
   game._announce?.('Эти системы исправны.');return false;
  }
  const price=enhanced?10:18;
  if(game.friendlyBases.credits<price){
   game._announce?.('Не хватает деталей для ремонта: нужно '+price+'.');return false;
  }
  game.friendlyBases.credits-=price;
  if(turret){
   turret.integrity=Math.min(100,(turret.integrity??100)+(enhanced?50:30));
   if(turret.integrity>0)turret.disabled=false;
  }else base.hp=Math.min(base.maxHp,base.hp+(enhanced?45:28));
  this.repairCooldown=game.gameTime+(enhanced?13:20);
  game.beams.push({x:game.player.x,y:game.player.y,x2:base.x,y2:base.y,
   color:enhanced?'#5fff90':'#8ce1dc',coreColor:'#e0ffed',
   mode:'repair',ttl:enhanced?.65:.35,total:enhanced?.65:.35});
  game.worldVfx?.boostCollect(base.x,base.y,'green');
  playPrologueCue(game,'repair_complete',base,.8);
  game.createFloatingText?.(turret?'ТУРЕЛЬ ВОССТАНОВЛЕНА':'КОРПУС ВОССТАНОВЛЕН',
   base.x,base.y-100,'#91ffb9');
  return true;
 }
 useStationStasis(){return false;}
 insideWorld(x,y,rad=0){
  return this.rooms.some(r=>rectContains(r,x,y,rad))||
         this.wings.some(r=>rectContains(r,x,y,rad))||
         this.halls.some(r=>rectContains(r,x,y,rad));
 }
 solid(x,y,rad=18){
  if(!this.insideWorld(x,y,rad))return true;
  for(const c of this.cover){
   if(x>=c.x-rad&&x<=c.x+c.w+rad&&y>=c.y-rad&&y<=c.y+c.h+rad)return true;
  }
  return false;
 }
 // A turret can fire only along an unobstructed route through the station.
 // Test the same deck boundaries, cover and pressure doors used by movement.
 clearLineOfFire(x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);
  if(length<1)return false;
  // Exact segment/rectangle intersection prevents a thin pillar or door
  // from being skipped by samples taken between its two faces.
  const hits=(r,pad=0)=>{
   let enter=0,leave=1;
   for(const [origin,delta,min,max] of [
    [x1,dx,r.x-pad,r.x+r.w+pad],
    [y1,dy,r.y-pad,r.y+r.h+pad]
   ]){
    if(Math.abs(delta)<1e-8){
     if(origin<min||origin>max)return false;
     continue;
    }
    let near=(min-origin)/delta,far=(max-origin)/delta;
    if(near>far)[near,far]=[far,near];
    enter=Math.max(enter,near);leave=Math.min(leave,far);
    if(enter>leave)return false;
   }
   return enter<1&&leave>0;
  };
  for(const cover of this.cover)if(hits(cover,4))return false;
  for(const door of this.doors){
   if(door.open>=.84)continue;
   if(hits({x:door.x-18,y:door.y-door.width/2,w:36,h:door.width},4))
    return false;
  }
  // Station bulkheads outside corridors are implicit in the world geometry.
  // Samples are only needed for those broad empty regions between rooms.
  const steps=Math.ceil(length/12);
  for(let i=1;i<steps;i++){
   const t=i/steps;
   if(!this.insideWorld(x1+dx*t,y1+dy*t,4))return false;
  }
  return true;
 }
 walkable(x,y,rad=18){
  if(this.solid(x,y,rad))return false;
  return !this.doors.some(d=>d.open<=.84&&Math.abs(x-d.x)<rad+17&&
   Math.abs(y-d.y)<d.width/2+rad);
 }
 constrainEntity(entity,oldX,oldY){
  if(!entity||this.victory)return;
  const rad=entity.size||18;
  const valid=(x,y)=>{
   if(this.solid(x,y,rad))return false;
   for(const d of this.doors){
    if(d.open>.84)continue;
    if(Math.abs(x-d.x)<rad+17 && Math.abs(y-d.y)<d.width/2+rad)return false;
   }
   return true;
  };
  if(valid(entity.x,entity.y))return;
  const x=entity.x,y=entity.y;
  if(valid(x,oldY)){entity.y=oldY;entity.vy=0;return;}
  if(valid(oldX,y)){entity.x=oldX;entity.vx=0;return;}
  entity.x=oldX;entity.y=oldY;entity.vx=0;entity.vy=0;
 }
 _advanceIf(game,phase,dx,previousGate){
  if(this.phase!==phase-1||!this.doors[previousGate].target)return;
  if(game.player.x>this.cx+dx)this.enterPhase(game,phase);
 }
 _updateSiege(game,dt){
  const c=this.point(6540,0),now=game.gameTime,before=this.coreHp;
  for(const e of game.enemies){
   if(e.hp<=0||e.prologueDuty!=='core')continue;
   if(Math.hypot(e.x-c.x,e.y-c.y)>170){e.coreWindup=0;continue;}
   e.coreWindup=(e.coreWindup||0)+dt;
   if(e.coreWindup>=.75&&now>=(e.coreStrikeAt||0)){
    this.coreHp=Math.max(0,this.coreHp-6);e.coreWindup=0;e.coreStrikeAt=now+1.2;
    e.attackCooldown=.3;game.worldVfx?.hit?.(c.x,c.y,false,false);
   }
  }
  if(this.coreHp<before&&game.gameTime>=this.nextCoreHitCue){
   this.nextCoreHitCue=game.gameTime+1.65;playPrologueCue(game,'core_hit',c,.72);
  }
  const warning=this.coreHp<=50?2:this.coreHp<=120?1:0;
  if(warning>this.coreWarningLevel){
   this.coreWarningLevel=warning;playPrologueCue(game,'core_warning',null,warning===2?1.1:.85);
   game._announce?.(warning===2?'КРИТИЧЕСКОЕ ПОВРЕЖДЕНИЕ ЯДРА':'ВНИМАНИЕ · ПРОЧНОСТЬ ЯДРА ПАДАЕТ');
  }
  if(this.coreHp<=0&&!this.failed){this.failed=true;game._announce?.('ЭНЕРГЕТИЧЕСКОЕ ЯДРО ПОТЕРЯНО');game.gameOver();}
 }
 turretProfile(base){return prologueTurretProfile(base);}
 reinforcementBudget(){return Math.max(this.waves.reinforcement,this.done('helios')?3:6);}
 queueEnemy(game,group,index,point,type,hp,speed,duty=null){
  this.spawnWarnings.push({group,index,point,type,hp,speed,duty,at:game.gameTime+1.2});
 }
 _updateWarnings(game){
  for(let i=this.spawnWarnings.length-1;i>=0;i--){
   const w=this.spawnWarnings[i];if(game.gameTime<w.at)continue;
   const e=this._spawnActive(game,w.group,w.index,w.point,w.type,w.hp,w.speed,true);
   e.prologueDuty=w.duty;this.spawnWarnings.splice(i,1);
  }
 }
 trainingSafe(game){
  return !this.repairHold&&!this.spawnWarnings.length&&!this.spac1Spots.some(s=>s.queued&&!s.active)&&
   !game.enemies.some(e=>e.hp>0&&Math.hypot(e.x-game.player.x,e.y-game.player.y)<800);
 }
 awardLesson(game,id){
  if(!TRAINING_LESSONS.includes(id)||this.lessonAwards.has(id))return;
  this.lessonAwards.add(id);const p=game.player;p.trainingEarned=this.lessonAwards.size;
  p.level=1+p.trainingEarned;p.exp=p.trainingEarned;p.expToNext=3;
  game._pendingLevelUps=(game._pendingLevelUps||0)+1;
 }
 encounterLabel(){
  if(this.phase===5&&this.siegeStarted)return this.defenseClear?'Передача разблокирована':
   'Оборона · группа '+Math.min(3,Math.floor((this.uploadProgress/100*SIEGE_DURATION)/17)+1)+'/3';
  return 'Сектор '+(this.phase+1)+'/7 · '+(this.phase===0?'Ремонт':this.phase===2?'Первое оружие':this.phase===4?'Последний приказ':'Последний сигнал');
 }
 onAnnouncement(game,message){
  if(this.lastAnnouncement===message)return;this.lastAnnouncement=message;
  game.missionLog?.note(ROOM_DEFS[this.phase].name,message,this.objective());
  if(typeof document==='undefined'||!document.createElement)return;
  let radio=document.getElementById('prologueTransmission');
  if(!radio){radio=document.createElement('aside');radio.id='prologueTransmission';
   radio.className='prologue-transmission';radio.setAttribute('role','status');
   document.getElementById('gameContainer')?.append(radio);}
  // A short queue preserves closely spaced story beats instead of overwriting them.
  this.transmissionQueue.push(message);if(this.transmissionQueue.length>3)this.transmissionQueue.shift();
  this._updateRadio(game);
 }
 _updateRadio(game){
  const radio=typeof document!=='undefined'?document.getElementById('prologueTransmission'):null;
  if(!radio)return;
  if(game.gameTime>=this.radioUntil){
   const next=this.transmissionQueue.shift();radio.hidden=!next;
   if(next){radio.textContent=next;this.radioUntil=game.gameTime+Math.max(7,Math.min(12,next.length/19));}
  }
 }
 heatLanes(){return [this.point(3690,-320),this.point(4080,-320)];}
 heatState(game,lane){return this.done('coolant')||(this.done('relay-a')&&this.done('relay-b'))?'idle':foundryHazard(game.gameTime-this.forgeStartedAt,lane);}
 _updateHeat(game){
  if(this.phase!==3)return;
  for(const [i,zone] of this.heatLanes().entries()){
   if(this.heatState(game,i)!=='active')continue;
   if(Math.abs(game.player.x-zone.x)<47+game.player.size&&game.player.y>zone.y&&game.player.y<zone.y+640&&game.gameTime>=(this.heatDamageAt||0)){
    game.player.takeDamage?.(7,game);this.heatDamageAt=game.gameTime+1;
   }
  }
 }
  _updateSpac1Wake(game){
   for(const spot of this.spac1Spots){
    if(!spot.queued||spot.active)continue;
    if(!spot.soundStarted&&game.gameTime>=spot.wakeAt){
     spot.soundStarted=true;
     playPrologueCue(game,'robot_wake',spot,.7);
    }
    if(game.gameTime<spot.wakeAt+SPAC1_WAKE_SECONDS)continue;
    const {type,hp,velocity}=spot.spawnDef;
    this._spawnActive(game,spot.group,spot.index,spot,type,hp,velocity,false);
    spot.active=true;
    spot.spawnDef=null;
   }
  }
  update(game,dt){
   if(this.victory||this.failed)return;
   this._updateSpac1Wake(game);this._updateWarnings(game);this._updateRadio(game);this._updateHeat(game);
  // Side rooms have their own entry threshold, independent of main phases.
  for(let i=0;i<this.wings.length;i++){
   if(this.roomEntryAt[7+i]===null&&rectContains(this.wings[i],game.player.x,game.player.y))
    this.roomEntryAt[7+i]=game.gameTime;
  }
  this.tactics.update(dt,game);
  this.updateRepairBeam(game,dt);
  for(const id of ['sentry-a','sentry-b','heavy-a','heavy-b']){
   const base=this.base(id,game);
   if(!base?.activated)continue;
   let becameReady=false;
   for(const turret of base.turrets){
    if(turret.visualLockUntil&&game.gameTime>=turret.visualLockUntil){
     becameReady=true;
     turret.disabled=(turret.integrity??100)<=0;
     turret.visualLockUntil=0;
    }
   }
   if(becameReady)playPrologueCue(game,'turret_ready',base,.74);
  }
  for(let i=this.robotDeaths.length-1;i>=0;i--){
   const wreck=this.robotDeaths[i];
   wreck.age=(wreck.age||0)+dt;
   if(wreck.kind==='spac1')continue; // Keep its terminal debris sprite.
   wreck.ttl-=dt;
   if(wreck.ttl<=0)this.robotDeaths.splice(i,1);
  }
  for(const d of this.doors)if(d.target&&d.open<1){
   if(d.id===0){
    // The old collision interval still follows the visible gateway; the
    // distributor lights first, then the damaged leaf hesitates halfway.
    const control=this.device('dock-gate');
    const powerAt=Number.isFinite(control?.activatedAt)?control.activatedAt:-Infinity;
    if(game.gameTime<powerAt+.55)continue;
    d.openingElapsed+=dt;
    d.open=gateOpenProgress(d.openingElapsed);
   }else d.open=Math.min(1,d.open+dt/1.65);
   if(d.open>=1&&!d.soundDone){
    d.soundDone=true;playPrologueCue(game,'gate_open',null,.45);
   }
  }
  this._advanceIf(game,1,900,0);
  this._advanceIf(game,2,2310,1);
  this._advanceIf(game,3,3410,2);
  this._advanceIf(game,4,4740,3);
  this._advanceIf(game,5,5940,4);
  this._advanceIf(game,6,7430,5);
  if(this.phase===1&&!this.securityClear&&this.done('sentry-a')&&this.done('sentry-b')){
   if(this.waves.reinforcement<this.reinforcementBudget() && game.gameTime>=this.waveAt.reinforcement){
    this.spawn(game,'reinforcement',WAVE.reinforcement,0,6,ENEMIES.STALKER,84,95);
    this.waveAt.reinforcement=game.gameTime+3.1;
   }
   if(this.waves.reinforcement>=this.reinforcementBudget()&&
      !this.alive(game,'security')&&!this.alive(game,'reinforcement')&&
      !this.alive(game,'observatory')){
    this.securityClear=true;this.openGate(1,game);
   }
  }
  if(this.phase===2&&this.done('weapon')&&!this.workshopClear&&
     this.waves.workshop===2&&
   !this.alive(game,'workshop')&&!this.alive(game,'maintenance')){
   this.workshopClear=true;this.awardLesson(game,'workshop');this.openGate(2,game);
  }
  if(this.phase===3&&!this.forgeClear){
   if(this.done('relay-a')&&this.done('relay-b'))this.forgeStopped=true;
   const active=game.enemies.filter(e=>e.hp>0&&e.prologueGroup==='forge').length+this.spawnWarnings.filter(w=>w.group==='forge').length;
   if(!this.forgeStopped&&this.waves.forge<6&&active<3&&game.gameTime>=this.waveAt.forge){
    const i=this.waves.forge;
    this.spawn(game,'forge',WAVE.forge,i,6,i%3===0?ENEMIES.ZOMBIE:ENEMIES.BAT,i%3===0?58:34,i%3===0?62:100);
    this.waveAt.forge=game.gameTime+3.5;
   }
   if(this.forgeStopped&&!this.alive(game,'forge')){
    this.forgeClear=true;this.awardLesson(game,'forge');this.openGate(3,game);
    game._announce?.('ЛИТЕЙНАЯ ОСТАНОВЛЕНА · Обе цепи разомкнуты. Непробуждённые машины остаются без питания.');
   }
  }
  if(this.phase===4&&this.done('terminal')&&!this.commandClear&&
     this.waves.command===3&&!this.alive(game,'command')){
   this.commandClear=true;this.awardLesson(game,'command');this.openGate(4,game);
   game._announce?.('ПОСЛЕДНИЙ ПРИКАЗ · Эвакуацию отменили, но гражданский конвой всё же ушёл. На борту — люди. Передайте им безопасный маршрут; протокол обороны откроет передатчик.');
  }
  if(this.phase===5){
   if(this.siegeStarted){
    if(!this.defenseClear){
     this.uploadProgress=Math.min(100,this.uploadProgress+dt*100/this.uploadDuration);
     const age=game.gameTime-this.siegeStartAt;
     const count=game.enemies.filter(e=>e.hp>0&&e.prologueSiege).length+this.spawnWarnings.filter(w=>w.group==='siege').length;
     const next=SIEGE_PLAN[this.siegePlanIndex];
     if(next&&age>=next.at&&count<6){
      const point=this.point(6540+next.side*445,next.lane);
      this.queueEnemy(game,'siege',this.siegePlanIndex,point,next.type,next.type.hp,next.type.speed,next.duty);
      this.siegePlanIndex++;this.waves.siege++;
     }
     if(this.uploadProgress>=55&&!this.barrelFault){
      this.barrelFault=true;
      if(!this.done('capacitor')){
       const turret=this.base('heavy-b',game)?.turrets[0];
       if(turret){turret.integrity=0;turret.disabled=true;turret.prologueFault=true;}
       game._announce?.('ПЕРЕГРУЗКА · Одно орудие правой батареи отключилось. Подлетите и удерживайте ремонтный луч либо подключите резерв в нижнем контуре.');
      }
     }
     this._updateSiege(game,dt);
     if(this.failed)return;
     if(this.uploadProgress>=100&&this.coreHp>0){
      this.defenseClear=true;this.heavyTowersOnline=true;
      this.evacuateReadyAt=game.gameTime+3;
      for(const id of ['heavy-a','heavy-b']){
       const tower=this.base(id,game);
       if(tower){
        for(const turret of tower.turrets){
         turret.level=5;turret.flash=1.8;turret.integrity=100;
         turret.disabled=false;
        }
        game.worldVfx?.nova(tower.x,tower.y,290,'cyan');
       }
      }
      // Cinematic emergency battery sweep of the already-active station
      // attackers. Shared enemy and turret objects stay authoritative.
      this.spawnWarnings=this.spawnWarnings.filter(w=>w.group!=='siege');
      for(const enemy of game.enemies)
       if(enemy.prologueSiege&&enemy.hp>0)enemy.hp=0;
      game._announce?.('ЗАГРУЗКА 100% · ТЯЖЁЛЫЕ БАШНИ АКТИВНЫ · сектор очищен');
      playPrologueCue(game,'defense_success',null,1.12);
     }
    }
    if(this.defenseClear&&game.gameTime>=this.evacuateReadyAt&&!this.doors[5].target){
     this.openGate(5,game);
     game._announce?.('ЭВАКУАЦИОННЫЙ ШЛЮЗ ОТКРЫТ · передайте последний сигнал');
    }
   }
  }
  if(this.phase===6&&this.done('transmitter')&&game.gameTime>=this.transmissionAt){
   const result=game.completeMission(game.gameTime);
   if(result?.ok){
    this.victory=true;playPrologueCue(game,'transmission_finished',null,1.15);game.state=GameState.MENU;game.audio.stopMusic?.();
    game.missionLog?.hide();document.getElementById('prologueTransmission')?.remove();
    for(const id of ['missionObjectiveHud','missionAction','missionRepairAbility','missionStasisAbility']){
     const elem=document.getElementById(id);if(elem)elem.style.display='none';
    }
    showMissionVictory(game,this,result);
   }
  }
  this._hud(game);
 }
 objective(){
  if(this.phase===0)return this.done('generator')?'Откройте аварийный шлюз':'Подлетите к генератору и удерживайте ремонтный луч';
  if(this.phase===1)return !this.done('sentry-a')||!this.done('sentry-b')?
   'Подключите две турели ремонтным лучом':'Отразите патруль · сканер наверху сокращает подкрепления';
  if(this.phase===2)return this.done('weapon')?'Испытайте автоогонь вблизи · охлаждение внизу необязательно':'Установите импульсную пушку';
  if(this.phase===3)return 'Отключите два стабилизатора · затем уничтожьте активных роботов';
  if(this.phase===4)return this.done('terminal')?'Сначала лёгкая охрана, затем бронированный страж':'Восстановите командный терминал ремонтным лучом';
  if(this.phase===5){
   if(this.defenseClear)return 'Дождитесь открытия эвакуационного шлюза';
   if(this.siegeStarted)return '«Оплот» '+Math.floor(this.uploadProgress)+'% · ядро '+Math.ceil(this.coreHp)+'/200 · ремонтируйте в затишье';
   if(!this.done('heavy-a')||!this.done('heavy-b'))return 'Восстановите две батареи · резерв питания внизу необязателен';
   return 'Подготовьтесь и запустите «Оплот» на пульте у ядра';
  }
  return this.done('transmitter')?'Передача последнего сигнала…':'Передайте конвою безопасный маршрут';
 }
 target(game){
  const next=this.devices.find(d=>d.phase===this.phase&&!d.done&&
   d.kind!=='log'&&!['helios','coolant','capacitor'].includes(d.id)&&
   (d.id!=='dock-gate'||this.done('generator')));
  if(next)return next;
  if(this.phase===5&&this.siegeStarted&&!this.doors[5].target)return this.point(6540,0);
  return this.phase<6?this.doors[this.phase]:this.device('transmitter');
 }
 _hud(game){
  const hud=document.getElementById('missionObjectiveHud');
  const action=document.getElementById('missionAction');
  if(!hud||!action)return;
  const p=game.player,d=this.target(game);
  const dx=d?d.x-p.x:0,dy=d?d.y-p.y:0;
  const dst=d?Math.round(Math.hypot(dx,dy)):0;
  const directions=['→','↘','↓','↙','←','↖','↑','↗'];
  const direction=directions[Math.round(((Math.atan2(dy,dx)+TAU)%TAU)/(Math.PI/4))%8];
  const title='00 · '+ROOM_DEFS[this.phase].name+' · '+this.objective();
  const text=title+(dst>130?' · '+direction+' '+dst+' м':'');
  if(hud.textContent!==text)hud.textContent=text;
  hud.style.display='block';
  const a=this.canInteract(game);
  const closedGate=this.phase===0&&!this.done('generator')&&
   near(p,this.device('dock-gate'),155);
  action.style.display=(a||closedGate)?'block':'none';
  action.disabled=!a;
  if(closedGate&&!a){
   action.textContent='🔒 ШЛЮЗ БЕЗ ПИТАНИЯ';
   action.title='Вернитесь к генератору и удерживайте ремонтный луч до завершения восстановления.';
   action.setAttribute('aria-label',action.title);
  }
  if(a){
   const label=ACTION_LABELS[a.device.id]||
     (a.device.kind==='log'?'ПРОЧЕСТЬ АРХИВ':a.name.toUpperCase());
   action.textContent='✦ '+label+
    (window.matchMedia?.('(any-pointer: coarse)').matches?'':' · E');
   action.title=a.name+' — '+(ACTION_NOTES[a.device.id]||
     (a.device.kind==='log'?'Прослушать запись экипажа и получить детали.':'Взаимодействовать с оборудованием.'));
   action.setAttribute('aria-label',action.title);
  }
  const repair=document.getElementById('missionRepairAbility');
  if(repair){
   const mobile=!!window.matchMedia?.('(any-pointer: coarse)').matches;
   const cooldown=Math.ceil(Math.max(0,this.repairCooldown-game.gameTime));
   const candidate=this.repairCandidate(game);
   const waiting=this.phase===0&&!this.done('generator')?
     this.device('generator'):this.phase===4&&!this.done('terminal')?
     this.device('terminal'):this.phase===1?
     this.device(!this.done('sentry-a')?'sentry-a':'sentry-b'):
     this.phase===5&&(!this.done('heavy-a')||!this.done('heavy-b'))?
     this.device(!this.done('heavy-a')?'heavy-a':'heavy-b'):null;
   const validWaiting=waiting&&!waiting.done?waiting:null;
   repair.style.display=(candidate||validWaiting||this.phase===5)?'block':'none';
   // The previous mission may have left this shared button disabled.
   repair.disabled=!!cooldown&&!this.repairHold;
   if(this.repairHold)
    repair.textContent='🔧 УДЕРЖИВАЙ · '+Math.floor(this.repairHold.progress*100)+'%';
   else if(cooldown)
    repair.textContent='🔧 ПЕРЕЗАРЯДКА · '+cooldown+' с';
   else if(candidate)
    repair.textContent=mobile?
      '🔧 УДЕРЖИВАЙ · '+candidate.duration.toFixed(1)+' с':
      '🔧 УДЕРЖИВАЙ ПРОБЕЛ · '+candidate.duration.toFixed(1)+' с';
   else if(validWaiting)
    repair.textContent=mobile?'🔧 ПОДЛЕТИТЕ К ЦЕЛИ':
      '🔧 ПОДЛЕТИТЕ К '+validWaiting.name.toUpperCase();
   else
    repair.textContent='🔧 РЕМОНТНЫЙ ЛУЧ · для повреждённой техники';
   repair.setAttribute('aria-label',this.repairHold?
    'Ремонт '+Math.floor(this.repairHold.progress*100)+' процентов, удерживайте кнопку':
    'Подлетите к повреждённому устройству и удерживайте ремонтный луч');
  }
  const stasis=document.getElementById('missionStasisAbility');
  if(stasis)stasis.style.display='none';
 }
 _sectorPowered(index){
  // The service wings have their own activation sequence, independent of
  // the main corridor. Lamps must follow the actual physical subsystem.
  const systems=[
   ['generator'],['sentry-a','sentry-b'],['weapon'],
   ['relay-a','relay-b'],['terminal'],['capacitor'],['transmitter'],
   ['helios'],['coolant'],['capacitor']
  ];
  return (systems[index]||[]).some(id=>this.done(id));
 }

 // A single baked route per chamber: the current follows floor conduits,
 // turns through wall junctions and stops before the equipment silhouettes.
 _makeHallGap(hall,index){
  if(index<6){
   const left=this.rooms[index],right=this.rooms[index+1];
   const start=Math.max(hall.x,left.x+left.w),end=Math.min(hall.x+hall.w,right.x);
   return {x:start,y:hall.y,w:Math.max(0,end-start),h:hall.h,sector:index};
  }
  const room=this.rooms[index===6?1:index===7?2:5];
  const wing=this.wings[index-6];
  // The vertical crosswalk only needs shading in its exposed passage,
  // leaving the adjoining room overlays to handle the overlapping ends.
  const a=Math.min(room.y+room.h,wing.y+wing.h);
  const b=Math.max(room.y,wing.y);
  const start=Math.max(hall.y,Math.min(a,b)),end=Math.min(hall.y+hall.h,Math.max(a,b));
  return {x:hall.x,y:start,w:hall.w,h:Math.max(0,end-start),
   sector:index===6?1:index===7?2:5};
 }
 _makeGuideNetwork(){
  const nodes=[],edges=[],nodeByPosition=new Map();
  const nodeFor=(dx,dy)=>{
   const key=dx+','+dy;
   if(nodeByPosition.has(key))return nodeByPosition.get(key);
   const index=nodes.length;
   nodes.push({x:this.cx+dx,y:this.cy+dy,links:[]});
   nodeByPosition.set(key,index);
   return index;
  };
  for(const wire of GUIDE_WIRES){
   for(let i=1;i<wire.pts.length;i++){
    const [ax,ay]=wire.pts[i-1],[bx,by]=wire.pts[i];
    const a=nodeFor(ax,ay),b=nodeFor(bx,by);
    if(a===b)continue;
    const length=Math.hypot(bx-ax,by-ay);
    const edge={a,b,length,stage:wire.stage,kind:wire.kind,id:wire.id,
     bounds:{x:this.cx+Math.min(ax,bx),y:this.cy+Math.min(ay,by),
      w:Math.abs(ax-bx),h:Math.abs(ay-by)}};
    const edgeIndex=edges.length;
    edges.push(edge);
    nodes[a].links.push({to:b,edgeIndex});
    nodes[b].links.push({to:a,edgeIndex});
   }
  }
  return {nodes,edges};
 }
 _guideTarget(game){
  // During an unfinished attack the route ends at the defense position.
  // It must not beckon the player toward the still-locked exit.
  if(this.phase===1&&this.done('sentry-a')&&this.done('sentry-b')&&!this.securityClear)
   return {...this.point(1610,0),guideRole:'defend'};
  if(this.phase===2&&this.done('weapon')&&!this.workshopClear)
   return {...this.point(2690,0),guideRole:'defend'};
  if(this.phase===3&&this.done('relay-a')&&this.done('relay-b')&&!this.forgeClear)
   return {...this.point(4110,0),guideRole:'defend'};
  if(this.phase===4&&this.done('terminal')&&!this.commandClear)
   return {...this.point(5160,0),guideRole:'defend'};
  if(this.phase===5&&this.done('heavy-a')&&this.done('heavy-b')&&
   this.siegeStarted&&!this.defenseClear)
   return {...this.point(6540,-170),guideRole:'defend'};
  if(this.phase===6&&this.done('transmitter'))
   return {...this.point(8030,0),guideRole:'hold'};
  return this.target(game);
 }
 _guideRoute(game){
  const graph=this.guideGraph,{nodes,edges}=graph,player=game.player;
  const goal=this._guideTarget(game);
  if(!goal)return null;
  const nearest=(p)=>{
   let best=-1,bestDist=Infinity;
   for(let i=0;i<nodes.length;i++){
    if(!nodes[i].links.some(l=>edges[l.edgeIndex].stage<=this.phase))continue;
    const d=(nodes[i].x-p.x)**2+(nodes[i].y-p.y)**2;
    if(d<bestDist){best=i;bestDist=d;}
   }
   return best;
  };
  const start=nearest(player),end=nearest(goal);
  if(start<0||end<0)return null;
  const device=typeof goal.id==='string';
  const role=goal.guideRole||(device?
   (['generator','terminal','sentry-a','sentry-b','heavy-a','heavy-b'].includes(goal.id)?
    'repair':'interact'):'travel');
  const key=[this.phase,start,end,role,goal.x,goal.y].join(':');
  if(this.guideRouteCache?.key===key)return this.guideRouteCache.route;
  // A tiny Dijkstra search runs only when player crosses a junction or the
  // objective changes. The drawing loop never recomputes pathfinding.
  const dist=Array(nodes.length).fill(Infinity),prev=Array(nodes.length).fill(-1);
  const visited=new Set();
  dist[start]=0;
  while(true){
   let current=-1,best=Infinity;
   for(let i=0;i<nodes.length;i++)
    if(!visited.has(i)&&dist[i]<best){best=dist[i];current=i;}
   if(current<0||current===end)break;
   visited.add(current);
   for(const link of nodes[current].links){
    const edge=edges[link.edgeIndex];
    if(edge.stage>this.phase)continue;
    const candidate=best+edge.length;
    if(candidate<dist[link.to]){dist[link.to]=candidate;prev[link.to]=current;}
   }
  }
  const indices=[];
  if(Number.isFinite(dist[end])){
   for(let i=end;i>=0;i=prev[i]){
    indices.push(i);
    if(i===start)break;
   }
   indices.reverse();
  }
  const points=indices.map(i=>nodes[i]);
  const route={points,role,targetId:device?goal.id:null,
   targetX:goal.x,targetY:goal.y};
  this.guideRouteCache={key,route};
  return route;
 }
 _drawGuideNetwork(ctx,game,t){
  const {nodes,edges}=this.guideGraph;
  const visible=edge=>this._withinCamera(game,edge.bounds,24);
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  // Unified physical channels, including junctions and corridors.
  ctx.beginPath();
  for(const edge of edges){
   if(!visible(edge))continue;
   ctx.moveTo(nodes[edge.a].x,nodes[edge.a].y);
   ctx.lineTo(nodes[edge.b].x,nodes[edge.b].y);
  }
  ctx.strokeStyle='#061521';ctx.lineWidth=12;ctx.stroke();
  ctx.strokeStyle='#426d79';ctx.lineWidth=3;ctx.globalAlpha=.36;ctx.stroke();
  if(this.done('generator')){
   ctx.beginPath();
   for(const edge of edges){
    if(edge.stage>this.phase||!visible(edge))continue;
    ctx.moveTo(nodes[edge.a].x,nodes[edge.a].y);
    ctx.lineTo(nodes[edge.b].x,nodes[edge.b].y);
   }
   ctx.globalAlpha=.32;ctx.strokeStyle='#55b6ad';ctx.lineWidth=5;ctx.stroke();
   ctx.globalAlpha=1;ctx.strokeStyle='#8ddacf';ctx.lineWidth=1.6;ctx.stroke();
  }
  const route=this._guideRoute(game);
  if(route&&route.points.length>1){
   const color=route.role==='repair'?'#83ffd3':
    route.role==='interact'?'#ffd18a':
    route.role==='defend'?'#ffab80':route.role==='hold'?'#c2b2ff':'#93daff';
   ctx.beginPath();
   const first=route.points[0];
   ctx.moveTo(first.x,first.y);
   for(let i=1;i<route.points.length;i++)
    ctx.lineTo(route.points[i].x,route.points[i].y);
   const power=this.done('generator')?1:.55;
   ctx.strokeStyle=color;ctx.globalAlpha=.13*power;ctx.lineWidth=18;ctx.stroke();
   ctx.globalAlpha=.62*power;ctx.lineWidth=4.5;ctx.stroke();
   // Directional light packets follow every turn, continuously.
   ctx.globalAlpha=.93*power;ctx.lineWidth=3;
   ctx.strokeStyle='#fffdf0';ctx.setLineDash([13,92]);
   ctx.lineDashOffset=-(t*116)%105;ctx.stroke();
   ctx.setLineDash([]);ctx.globalAlpha=1;
  }
  if(route){
   const color=route.role==='repair'?'#83ffd3':
    route.role==='interact'?'#ffd18a':
    route.role==='defend'?'#ffab80':route.role==='hold'?'#c2b2ff':'#93daff';
   if(this._withinCamera(game,
    {x:route.targetX-50,y:route.targetY-50,w:100,h:100},20)){
    const pulse=.5+.5*Math.sin(t*3.1);
    ctx.globalAlpha=.64+.24*pulse;
    ctx.strokeStyle=color;ctx.lineWidth=2.5;
    ctx.beginPath();ctx.arc(route.targetX,route.targetY,28+5*pulse,0,TAU);ctx.stroke();
    ctx.fillStyle='#071b25';ctx.fillRect(route.targetX-27,route.targetY+34,54,21);
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(route.targetX-27,route.targetY+34,54,21);
    ctx.fillStyle=color;ctx.font='700 12px system-ui';ctx.textAlign='center';
    ctx.fillText(route.role==='repair'?'ЛУЧ':
     route.role==='interact'?'E':
     route.role==='defend'?'БОЙ':route.role==='hold'?'ЖДАТЬ':'→',route.targetX,route.targetY+49);
    ctx.globalAlpha=1;
   }
  }
  if(this.done('generator')){
   for(const sign of GUIDE_WING_SIGNS){
    if(sign.stage>this.phase)continue;
    const at=this.point(sign.x,sign.y);
    if(!this._withinCamera(game,{x:at.x-120,y:at.y-22,w:240,h:44},10))continue;
    const current=route?.targetId===sign.id;
    ctx.globalAlpha=current?.94:.43;
    ctx.font='700 14px system-ui';ctx.textAlign='center';
    const width=ctx.measureText(sign.label).width+25;
    ctx.fillStyle='#061822';ctx.fillRect(at.x-width/2,at.y-15,width,29);
    ctx.strokeStyle=current?'#ffd18a':'#518b91';ctx.lineWidth=1;
    ctx.strokeRect(at.x-width/2,at.y-15,width,29);
    ctx.fillStyle=current?'#ffdf9f':'#b2cbd0';
    ctx.fillText(sign.label,at.x,at.y+5);
    ctx.globalAlpha=1;
   }
  }
  ctx.restore();
 }
 _roomLightingAge(index,t){
  if(index===0){
   const gen=this.device('generator');
   return gen?.done&&Number.isFinite(gen.activatedAt)?Math.max(0,t-gen.activatedAt):-1;
  }
  const entry=this.roomEntryAt[index];
  return Number.isFinite(entry)?Math.max(0,t-entry):-1;
 }
 _withinCamera(game,r,padX=0,padY=padX){
  const camera=game.camera,player=game.player;
  const viewX=Number.isFinite(camera?.worldX)?camera.worldX:player.x-480;
  const viewY=Number.isFinite(camera?.worldY)?camera.worldY:player.y-300;
  const width=CONFIG.CANVAS_WIDTH||960,height=CONFIG.CANVAS_HEIGHT||600;
  const margin=32; // accommodates camera shake and antialiased edge pixels
  return r.x-padX<viewX+width+margin&&r.x+r.w+padX>viewX-margin&&
   r.y-padY<viewY+height+margin&&r.y+r.h+padY>viewY-margin;
 }
 _sectorDarkness(ctx,r,t,index,p,inset=17){
  const age=this._roomLightingAge(index,t);
  // Start with a tiny ship-borne pool of light. The permanent state retains
  // gentle atmospheric shading so the room never becomes uniformly flat.
  const light=age<0?0:clamp((age-.25)/3.6,0,1);
  const smooth=light*light*(3-2*light);
  const opacity=.89-.73*smooth;
  const nearShip=p.x>r.x-240&&p.x<r.x+r.w+240&&
   p.y>r.y-240&&p.y<r.y+r.h+240;
  ctx.save();
  ctx.beginPath();ctx.rect(r.x+inset,r.y+inset,r.w-2*inset,r.h-2*inset);ctx.clip();
  if(nearShip){
   const cone=ctx.createRadialGradient(p.x,p.y,38,p.x,p.y,340);
   cone.addColorStop(0,'rgba(2,8,19,'+(opacity*.07)+')');
   cone.addColorStop(.24,'rgba(2,8,19,'+(opacity*.22)+')');
   cone.addColorStop(.67,'rgba(2,8,19,'+(opacity*.80)+')');
   cone.addColorStop(1,'rgba(2,8,19,'+opacity+')');
   ctx.fillStyle=cone;
  }else ctx.fillStyle='rgba(2,8,19,'+opacity+')';
  ctx.fillRect(r.x+inset,r.y+inset,r.w-2*inset,r.h-2*inset);
  ctx.restore();
 }
 _sectorAwakening(ctx,r,t,index){
  const age=this._roomLightingAge(index,t);
  const active=age>=0;
  const cyan=index===3?'#ffd17a':index===6?'#c7acff':'#8cf9e2';
  const lampImage=active?awakeningLampSprite(cyan):null;
  ctx.save();
  ctx.beginPath();ctx.rect(r.x+28,r.y+28,r.w-56,r.h-56);ctx.clip();
  // Room lamps play once. The connected network supplies ongoing guidance.
  // Staggered fixtures along both bulkheads: several imperfect ignition
  // attempts, then a stable output. Same timings in every replay.
  for(let k=0;k<7;k++){
   const px=r.x+93+k*(r.w-186)/6;
   const start=.18+k*.26+(index%3)*.06;
   let brightness=0;
   if(active&&age>=start){
    if(age<start+.82){
     const local=age-start;
     brightness=(Math.sin(local*(21+k%3*8)+k*2.17)>-.12?.8:.07)*(.45+.55*local/.82);
    }else brightness=1;
    brightness*=clamp((age-start)/.11,0,1);
   }
   for(const top of [true,false]){
    const py=top?r.y+46:r.y+r.h-46;
    if(!active||brightness<.03){
     ctx.fillStyle='#071721';ctx.fillRect(px-31,py-8,62,16);
     ctx.strokeStyle='#688896';ctx.lineWidth=1;ctx.strokeRect(px-31,py-8,62,16);
     if(!active){ctx.fillStyle='#c37b5f';ctx.globalAlpha=.24;
      ctx.fillRect(px-4,py-2,8,4);ctx.globalAlpha=1;}
     continue;
    }
    ctx.globalAlpha=brightness;
    if(lampImage)ctx.drawImage(lampImage,px-58,py-30);
    else{
     // Headless canvas tests and non-DOM embedders retain a safe fallback.
     ctx.fillStyle=cyan;ctx.fillRect(px-26,py-3,52,6);
     ctx.fillStyle='#e8fff9';ctx.fillRect(px-20,py-1,40,2);
    }
    ctx.globalAlpha=1;
   }
  }
  // After boot the stations breathe slowly. The defense core increases its
  // output as the upload proceeds; the final transmitter produces a flash.
  if(active&&age>3.1&&index===5&&this.siegeStarted){
   const c=this.point(6540,0),pulse=.14+.22*this.uploadProgress/100;
   const g=ctx.createRadialGradient(c.x,c.y,30,c.x,c.y,280);
   g.addColorStop(0,'rgba(153,255,220,'+(pulse*(.82+.18*Math.sin(t*2)))+')');
   g.addColorStop(1,'rgba(80,244,196,0)');
   ctx.fillStyle=g;ctx.beginPath();ctx.arc(c.x,c.y,280,0,TAU);ctx.fill();
  }
  if(active&&index===6&&this.done('transmitter')){
   const tx=this.device('transmitter'),elapsed=t-(tx?.activatedAt??t);
   const radius=50+(elapsed*160)%360;
   ctx.globalAlpha=.23*Math.max(0,1-radius/420);
   ctx.strokeStyle='#d1b5ff';ctx.lineWidth=7;
   ctx.shadowColor='#c5aeff';ctx.shadowBlur=ctx.__lowFx?0:(18);
   ctx.beginPath();ctx.arc(tx.x,tx.y,radius,0,TAU);ctx.stroke();
   ctx.globalAlpha=1;
  }
  ctx.restore();
 }
 _roomArchitecture(ctx,r,t,index){
  // Machined bulkheads, recessed cable channels and power-dependent lights.
  const {x,y,w,h}=r;
  ctx.save();
  ctx.strokeStyle='#071322b8';ctx.lineWidth=17;
  ctx.strokeRect(x+21,y+21,w-42,h-42);
  ctx.strokeStyle='#617f91a8';ctx.lineWidth=3;
  ctx.strokeRect(x+31,y+31,w-62,h-62);
  ctx.strokeStyle='#b1c9d454';ctx.lineWidth=1;
  ctx.strokeRect(x+39,y+39,w-78,h-78);
  for(let k=0;k<5;k++){
   const px=x+74+k*(w-148)/4;
   for(const py of [y+41,y+h-41]){
    ctx.fillStyle='#0b1c2b';ctx.beginPath();
    ctx.arc(px,py,5,0,TAU);ctx.fill();
    ctx.fillStyle='#94aeb8a6';ctx.fillRect(px-2,py-1,4,2);
   }
  }
  for(const side of [-1,1]){
   const cy=side<0?y+72:y+h-72;
   ctx.fillStyle='#071723ba';ctx.fillRect(x+90,cy-11,w-180,21);
   ctx.strokeStyle=side<0?'#54788d':'#32546c';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(x+92,cy);ctx.lineTo(x+w-93,cy);ctx.stroke();
   for(let k=0;k<Math.floor((w-190)/36);k++){
    const vx=x+100+k*36;
    ctx.fillStyle=k%3?'#314b5a':'#55717b';
    ctx.fillRect(vx,cy-7,17,13);
   }
  }
  const special=index===3?'#e76d2b':index===7?'#f0a56b':
   index===8?'#6cd4e8':null;
  if(special){
   const cx=x+w*.54,cy=y+h*.57;
   const g=ctx.createRadialGradient(cx,cy,20,cx,cy,Math.min(w,h)*.57);
   g.addColorStop(0,special+'21');g.addColorStop(1,special+'00');
   ctx.fillStyle=g;ctx.fillRect(x+50,y+50,w-100,h-100);
  }
  ctx.restore();
 }
 _roomLamps(ctx,r,t,index){
  const {x,y,w,h}=r;ctx.save();
  const on=this._sectorPowered(index);
  const flicker=on?( .85+.15*Math.sin(t*3+index)):
    (.28+.25*Math.sin(t*6+index));
  const strip=on?'#73d8db':index===0?'#e2aa75':'#ff776b';
  ctx.globalAlpha=Math.max(.17,flicker);
  ctx.shadowBlur=ctx.__lowFx?0:(0);
  for(let k=0;k<5;k++){
   const lx=x+110+k*(w-220)/4;
   ctx.fillStyle=strip;
   ctx.fillRect(lx-24,y+40,48,4);
   ctx.fillRect(lx-24,y+h-44,48,4);
  }
  ctx.shadowBlur=ctx.__lowFx?0:(0);ctx.globalAlpha=1;
  ctx.restore();
 }
 _deckFittings(ctx,r,t,index){
  // Premade atlas parts, placed as bolted-down station equipment rather than
  // unrelated free-floating outposts. Each room has a distinct silhouette.
  const fitting=DECK_FITTINGS[index]||DECK_FITTINGS[0];
  for(let j=0;j<fitting.length;j++){
   const [part,fx,fy,size,rotation]=fitting[j];
   const x=r.x+r.w*fx,y=r.y+r.h*fy;
   ctx.save();
   ctx.fillStyle='#020c16a1';ctx.beginPath();ctx.ellipse(x+7,y+11,size*.50,size*.32,rotation,0,TAU);ctx.fill();
   ctx.strokeStyle='#66849791';ctx.lineWidth=2;
   ctx.beginPath();ctx.ellipse(x,y,size*.48,size*.35,rotation,0,TAU);ctx.stroke();
   sprite(ctx,part,x,y,size,rotation,.82);
   ctx.restore();
  }
 }
 _roomFaultLights(ctx,r,t,index){
  // Cable conduits, maintenance hatch banks and local fault lights are
  // deliberately close to the walls, leaving the flying corridor clear.
  for(let side=0;side<2;side++){
   const py=side?r.y+r.h-106:r.y+106;
   for(let k=0;k<3;k++){
    const px=r.x+150+k*(r.w-300)/2;
    ctx.save();ctx.translate(px,py);
    ctx.fillStyle='#071521';ctx.strokeStyle='#4d6b7b';ctx.lineWidth=2;
    ctx.fillRect(-42,-14,84,28);ctx.strokeRect(-42,-14,84,28);
    ctx.strokeStyle='#90a8b866';ctx.beginPath();ctx.moveTo(-32,-6);ctx.lineTo(30,-6);ctx.stroke();
    const live=this._sectorPowered(index);
    ctx.fillStyle=live?'#76d9cb':'#b95e56';
    ctx.globalAlpha=.52+(live?.25:.12)*Math.sin(t*1.7+k+index)**2;
    for(let p=0;p<3;p++)ctx.fillRect(-28+p*18,5,9,3);
    ctx.restore();
   }
  }
 }
 _sectorAtmosphere(ctx,r,t,index){
  // Distinct readable materials per sector. These decorations never affect
  // navigation or collision, and are culled with the existing room loop.
  if(![0,1,2,3,5,6,7,8,9].includes(index))return;
  const x=r.x,y=r.y,w=r.w,h=r.h;
  ctx.save();
  ctx.beginPath();ctx.rect(x+46,y+47,w-92,h-94);ctx.clip();
  if(index===0){
   // Dry-dock welding intermittently sparks around the broken gantry.
   const hx=x+w*.74,hy=y+h*.33,burst=.5+.5*Math.sin(t*3.2);
   ctx.strokeStyle='#ffbd80';ctx.lineWidth=2;ctx.shadowColor='#ff9a47';
   ctx.shadowBlur=ctx.__lowFx?0:(10);
   for(let j=0;j<8;j++){
    const a=t*4.1+j*2.399;
    const len=burst*(14+j%4*9);
    ctx.globalAlpha=(.2+burst*.65)*(1-j*.08);
    ctx.beginPath();ctx.moveTo(hx,hy);
    ctx.lineTo(hx+Math.cos(a)*len,hy+Math.sin(a)*len);ctx.stroke();
   }
  }
  if(index===1){
   // Red scanning cone only while the two security emplacements are disabled.
   if(!this.done('sentry-a')||!this.done('sentry-b')){
    const ox=x+w*.49,oy=y+h*.22,a=Math.sin(t*.55)*.9+.9;
    ctx.globalAlpha=.17;
    ctx.fillStyle='#f46e5e';
    ctx.beginPath();ctx.moveTo(ox,oy);
    ctx.arc(ox,oy,310,a-.15,a+.15);ctx.closePath();ctx.fill();
   }
  }
  if(index===2){
   // Workshop robotic test stand and diagnostic light bars.
   const sx=x+w*.59,sy=y+h*.57;
   for(let j=0;j<3;j++){
    const phase=t*.55+j*2.09;
    ctx.strokeStyle=j===0?'#f4c893':'#70bed0';ctx.lineWidth=4;
    ctx.globalAlpha=.36;
    ctx.beginPath();ctx.moveTo(sx-105+j*85,sy-55);
    ctx.lineTo(sx-95+j*85,sy+Math.sin(phase)*25);
    ctx.lineTo(sx-85+j*85+Math.cos(phase)*23,sy+55);ctx.stroke();
   }
  }
  if(index===3){
   // Animated foundry coolant/melt channels and occasional welding arcs.
   for(let j=0;j<4;j++){
    const ly=y+h*(.27+j*.14),pulse=.66+.34*Math.sin(t*1.2+j);
    ctx.strokeStyle=j%2?'#c86b4b':'#ffac5e';
    ctx.lineWidth=7;ctx.globalAlpha=.12+pulse*.16;
    ctx.beginPath();ctx.moveTo(x+95,ly);
    for(let k=0;k<7;k++)
     ctx.lineTo(x+95+k*104,ly+5*Math.sin(t*1.1+k*.8+j));
    ctx.stroke();
   }
   for(let j=0;j<11;j++){
    const bx=x+96+((j*101+t*(11+j%4))%(w-180));
    const by=y+h*.29+((j*39+t*5)%(h*.56));
    ctx.fillStyle='#ffba78';ctx.globalAlpha=.2+.22*Math.sin(t+j)**2;
    ctx.fillRect(bx,by,2.5,3);
   }
  }
  if(index===5||index===9){
   // Reserve reactor comes alive in wave-like rings only after repairs.
   if(this.done('capacitor')){
    const ox=x+w*.51,oy=y+h*.52;
    ctx.strokeStyle='#75e6d0';ctx.lineWidth=2.4;
    for(let j=0;j<3;j++){
     ctx.globalAlpha=.05+.13*(1-((t*.12+j/3)%1));
     ctx.beginPath();ctx.arc(ox,oy,90+((t*.12+j/3)%1)*225,0,TAU);
     ctx.stroke();
    }
   }
  }
  if(index===6){
   // Evacuation running lights guide the eye to the last transmitter.
   ctx.globalAlpha=.42;
   for(let j=0;j<12;j++){
    const lx=x+70+j*(w-140)/11,active=(j+Math.floor(t*4))%7===0;
    ctx.fillStyle=active?'#c1eddf':'#526f83';
    ctx.fillRect(lx,y+h*.63,13,4);
   }
  }
  if(index===7){
   // Projection of Helios's moving astronomical reticle onto the floor.
   const cx=x+w*.52,cy=y+h*.65;
   ctx.strokeStyle='#9fc2d6';ctx.lineWidth=1.2;ctx.globalAlpha=.19;
   for(const rad of [85,132,190]){
    ctx.beginPath();ctx.arc(cx,cy,rad,t*.035,t*.035+Math.PI*1.32);
    ctx.stroke();
   }
  }
  if(index===8){
   // Refrigerant vapor: translucent filaments drifting between service bays.
   for(let j=0;j<12;j++){
    const ox=x+90+j*(w-180)/11,
     oy=y+h*.45+25*Math.sin(j*1.7+t*.32);
    ctx.globalAlpha=.07+.05*Math.sin(t*.63+j)**2;
    ctx.strokeStyle='#b9f2fa';ctx.lineWidth=9+j%3*3;
    ctx.beginPath();ctx.moveTo(ox,oy+90);
    ctx.bezierCurveTo(ox-35,oy+40,ox+32,oy-5,ox+9,oy-110);
    ctx.stroke();
   }
  }
  ctx.restore();
 }
 _firstRoomDeck(ctx,t){
  const reactor=this.device('generator'),panel=this.device('dock-gate');
  if(!reactor||!panel)return;
  const active=this.done('generator'),gateActive=this.done('dock-gate');
  const ring=(x,y,rx,ry,powered,target)=>{
   ctx.save();
   // Inlaid machine bases remain transparent to the continuous metal floor.
   const halo=ctx.createRadialGradient(x,y+30,rx*.13,x,y+30,rx*1.17);
   halo.addColorStop(0,powered?'#75e7d615':'#e6ae6410');
   halo.addColorStop(.7,powered?'#5ee6d70f':'#e2a35c08');
   halo.addColorStop(1,'#00000000');
   ctx.fillStyle=halo;
   ctx.beginPath();ctx.ellipse(x,y+30,rx*1.19,ry*1.24,0,0,TAU);ctx.fill();
   ctx.strokeStyle=powered?'#5debcf73':'#b1ac8b5c';
   ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+35,rx,ry,0,0,TAU);ctx.stroke();
   ctx.globalAlpha=.57;ctx.strokeStyle=target?'#afeefa':'#607987';
   ctx.lineWidth=4;ctx.setLineDash([13,18]);ctx.lineDashOffset=-t*(target?13:2);
   ctx.beginPath();ctx.ellipse(x,y+35,rx+8,ry+7,0,0,TAU);ctx.stroke();
   ctx.restore();
  };
  // Launch cradle, reactor and remote control: one clear first-room route.
  ctx.save();
  ctx.strokeStyle='#789baa45';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(this.cx,this.cy+95,79,43,0,0,TAU);ctx.stroke();
  ctx.strokeStyle='#83b9be30';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(this.cx,this.cy+95,65,34,0,0,TAU);ctx.stroke();
  if(!active){
   ctx.strokeStyle='#d5ae666c';ctx.lineWidth=3;
   ctx.setLineDash([17,16]);ctx.lineDashOffset=-t*9;
   ctx.beginPath();ctx.moveTo(this.cx-46,this.cy+20);
   ctx.quadraticCurveTo(this.cx-115,this.cy-12,reactor.x,reactor.y+53);
   ctx.stroke();ctx.setLineDash([]);
  }
  // Deck rails follow the real 290-unit-wide passage to the gate.
  const x0=this.cx+383,x1=this.cx+945,centerY=this.cy;
  for(const side of [-1,1]){
   const y=centerY+side*109;
   ctx.strokeStyle='#8da7b353';ctx.lineWidth=3;
   ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();
   ctx.strokeStyle=gateActive?'#7dffe176':'#c18f6245';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(x0+10,y-side*7);ctx.lineTo(x1-10,y-side*7);ctx.stroke();
  }
  ctx.restore();
  ring(reactor.x,reactor.y,121,70,active,!active);
  ring(panel.x,panel.y,89,48,gateActive,active&&!gateActive);
 }
 _roomBase(ctx,r,i,game){
  if(!this.roomLayers)this.roomLayers=new Map();
  if(!this.roomCacheStats)this.roomCacheStats={hits:0,paints:0,evictions:0};
  // Each chamber has one cached state. Never keep stale powered/unpowered
  // versions: they would evict visible rooms at a branching junction.
  const key=!!stationArt?.ready+'|'+!!stationFloor?.naturalWidth+'|'+this._sectorPowered(i);
  let layer=this.roomLayers.get(i);
  if(layer&&layer.key!==key){
   this.roomLayers.delete(i);
   layer.canvas.width=0;layer.canvas.height=0;
   layer=null;
  }
  if(layer){
   // LRU rather than FIFO. Five chambers can overlap in the camera
   // at the workshop junction; a three-entry cache thrashed each frame.
   this.roomLayers.delete(i);this.roomLayers.set(i,layer);
   this.roomCacheStats.hits++;
  }else if(typeof document!=='undefined'){
   const halo=Math.max(r.w,r.h)*.7,pad=Math.ceil(halo-Math.min(r.w,r.h)/2+4);
   const canvas=document.createElement('canvas');
   canvas.width=r.w+pad*2;canvas.height=r.h+pad*2;
   const c=canvas.getContext('2d');
   if(c){
    c.translate(pad-r.x,pad-r.y);this._paintRoomBase(c,r,i);
    layer={canvas,pad,key};this.roomLayers.set(i,layer);
    this.roomCacheStats.paints++;
    // Six recent chambers bound memory without re-rasterizing five
    // simultaneously visible sectors in the workshop/cooling branch.
    while(this.roomLayers.size>6){
     const oldest=this.roomLayers.keys().next().value;
     const obsolete=this.roomLayers.get(oldest);
     this.roomLayers.delete(oldest);
     obsolete.canvas.width=0;obsolete.canvas.height=0;
     this.roomCacheStats.evictions++;
    }
   }
  }
  if(!layer){this._paintRoomBase(ctx,r,i);return;}
  const originX=r.x-layer.pad,originY=r.y-layer.pad;
  if(game?.camera&&Number.isFinite(game.camera.worldX)&&Number.isFinite(game.camera.worldY)){
   // Copy only the viewport of each large cached bitmap; preserve a
   // 48-world-unit margin for camera shake and antialiased edges.
   const margin=48,left=Math.max(0,Math.floor(game.camera.worldX-margin-originX));
   const top=Math.max(0,Math.floor(game.camera.worldY-margin-originY));
   const right=Math.min(layer.canvas.width,Math.ceil(game.camera.worldX+CONFIG.CANVAS_WIDTH+margin-originX));
   const bottom=Math.min(layer.canvas.height,Math.ceil(game.camera.worldY+CONFIG.CANVAS_HEIGHT+margin-originY));
   if(right>left&&bottom>top)
    ctx.drawImage(layer.canvas,left,top,right-left,bottom-top,
     originX+left,originY+top,right-left,bottom-top);
  }else ctx.drawImage(layer.canvas,originX,originY);
 }
 _paintRoomBase(ctx,r,i){
   ctx.save();
   glow(ctx,r.x+r.w/2,r.y+r.h/2,Math.max(r.w,r.h)*.7,r.tint);
   tube(ctx,r.x,r.y,r.w,r.h,r.tint);
   ctx.fillStyle='#0d1e30';ctx.fillRect(r.x+15,r.y+15,r.w-30,r.h-30);
   const texture=floorPattern(ctx);
   if(texture){
    ctx.save();ctx.globalAlpha=.61;ctx.fillStyle=texture;
    ctx.fillRect(r.x+16,r.y+16,r.w-32,r.h-32);ctx.restore();
   }

   // Quiet engraved deck seams, not giant squares resembling breakable rocks.
   ctx.strokeStyle='#57778929';ctx.lineWidth=1;
   for(let x=r.x+102;x<r.x+r.w-40;x+=196){
    ctx.beginPath();ctx.moveTo(x,r.y+82);ctx.lineTo(x,r.y+r.h-82);ctx.stroke();
   }
   for(let y=r.y+112;y<r.y+r.h-40;y+=184){
    ctx.beginPath();ctx.moveTo(r.x+69,y);ctx.lineTo(r.x+r.w-69,y);ctx.stroke();
   }
   ctx.fillStyle=r.tint+'29';ctx.fillRect(r.x+15,r.y+28,r.w-30,12);
   this._roomArchitecture(ctx,r,0,i);
   this._deckFittings(ctx,r,0,i);

   for(let x=r.x+95;x<r.x+r.w-50;x+=180){
    sprite(ctx,'bridge',x,r.y+25,130,Math.PI/2,.57);
    sprite(ctx,'bridge',x,r.y+r.h-25,130,Math.PI/2,.43);
   }
   ctx.fillStyle=r.tint;ctx.globalAlpha=.8;
   ctx.font='700 20px system-ui';ctx.textAlign='center';
   ctx.fillText((r.code?'УЧАСТОК '+r.code:'СЕКТОР 0'+(i+1))+' · '+r.name.toUpperCase(),r.x+r.w/2,r.y+62);
   ctx.restore();
 }
 drawBack(ctx,game){
  const t=game.gameTime,p=game.player;
  const paintedRooms=this.paintedRooms;
  for(let i=0;i<paintedRooms.length;i++){
   const r=paintedRooms[i],halo=Math.max(r.w,r.h)*.7;
   if(!this._withinCamera(game,r,
     Math.max(0,halo-r.w/2),Math.max(0,halo-r.h/2)))continue;
   this._roomBase(ctx,r,i,game);
   this._roomLamps(ctx,r,t,i);
   this._roomFaultLights(ctx,r,t,i);
   this._sectorAtmosphere(ctx,r,t,i);
  }
  for(const h of this.halls){
   if(!this._withinCamera(game,h,65))continue;
   tube(ctx,h.x,h.y,h.w,h.h,'#467e9a');
   ctx.fillStyle='#122a3b';ctx.fillRect(h.x+14,h.y+18,h.w-28,h.h-36);
   // Match the room's actual floor grain across the threshold. The old
   // untextured corridor strip looked like a rectangular foreign material.
   const corridorTexture=floorPattern(ctx);
   if(corridorTexture){
    ctx.save();ctx.globalAlpha=.47;ctx.fillStyle=corridorTexture;
    ctx.fillRect(h.x+15,h.y+19,h.w-30,h.h-38);ctx.restore();
   }
   const shade=ctx.createLinearGradient(0,h.y+15,0,h.y+h.h-15);
   shade.addColorStop(0,'#05111e9b');
   shade.addColorStop(.18,'#07192821');
   shade.addColorStop(.82,'#07192821');
   shade.addColorStop(1,'#05111e9b');
   ctx.fillStyle=shade;ctx.fillRect(h.x+14,h.y+18,h.w-28,h.h-36);
   for(let x=h.x+48;x<h.x+h.w-24;x+=130){
    sprite(ctx,'wing',x,h.y+10,92,Math.PI/2,.7);
    sprite(ctx,'wing',x,h.y+h.h-10,92,-Math.PI/2,.7);
   }
  }
  if(Math.abs(p.x-this.cx)<1080)this._firstRoomDeck(ctx,t);
  // These armored bulkheads are actual collision geometry. Draw them before
  // actors so no player collides with an invisible rectangular obstacle.
  for(const c of this.cover){
   if(!this._withinCamera(game,c,38))continue;
   ctx.save();
   ctx.fillStyle='#07131d7d';ctx.fillRect(c.x+11,c.y+13,c.w,c.h);
   ctx.fillStyle='#263c4b';ctx.fillRect(c.x,c.y,c.w,c.h);
   ctx.fillStyle='#455c6b';ctx.fillRect(c.x+8,c.y+8,c.w-16,c.h-16);
   ctx.fillStyle='#172a39';ctx.fillRect(c.x+19,c.y+19,c.w-38,c.h-38);
   ctx.strokeStyle='#9bb0ba';ctx.lineWidth=3;ctx.strokeRect(c.x+11,c.y+11,c.w-22,c.h-22);
   ctx.strokeStyle='#ffba65';ctx.lineWidth=5;
   ctx.beginPath();ctx.moveTo(c.x+12,c.y+c.h-12);
   ctx.lineTo(c.x+Math.min(62,c.w*.42),c.y+c.h-12);ctx.stroke();
   for(const xx of [c.x+13,c.x+c.w-13])
    for(const yy of [c.y+13,c.y+c.h-13]){
     ctx.fillStyle='#c5d9da';ctx.fillRect(xx-3,yy-3,6,6);
    }
   ctx.restore();
  }
  this._starWindow(ctx,t,p,game);
  if(Math.abs(p.x-(this.cx+3840))<1500){
   const c=this.point(3840,0),off=!this.done('relay-a')||!this.done('relay-b');
   for(const yy of [-300,300]){
    ctx.fillStyle='#192f3c';ctx.fillRect(this.cx+3440,this.cy+yy,850,34);
    ctx.fillStyle='#839b9d99';
    for(let x=0;x<800;x+=70)ctx.fillRect(this.cx+3450+x+(t*24)%70,this.cy+yy+12,40,7);
   }
   glow(ctx,c.x,c.y,265,off?'#f98443':'#47605e');
   sprite(ctx,'refinery',c.x,c.y,245,t*(off?.14:.025),.84);
  }
  if(Math.abs(p.x-(this.cx+5160))<1400){
   const c=this.point(5160,-60);glow(ctx,c.x,c.y,300,'#7ac7fa');
   ctx.save();ctx.strokeStyle='#74bbec91';ctx.lineWidth=2;ctx.translate(c.x,c.y);
   ctx.rotate(t*.11);
   for(let r=100;r<205;r+=49){ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();}
   for(let a=0;a<TAU;a+=Math.PI/4){ctx.beginPath();ctx.moveTo(100*Math.cos(a),100*Math.sin(a));ctx.lineTo(180*Math.cos(a+.4),180*Math.sin(a+.4));ctx.stroke();}
   ctx.restore();
  }
  // Hallways are also unpowered. Shade only the exposed gap between
  // neighboring rooms, avoiding double-darkened rectangular overlap seams.
  for(const gap of this.hallGaps){
   if(gap.w<=0||gap.h<=0||!this._withinCamera(game,gap,35))continue;
   this._sectorDarkness(ctx,gap,t,gap.sector,p,0);
  }
  // Atmosphere is applied after all architecture and window effects, while
  // interactable machinery and the player remain fully legible in drawFront.
  for(let i=0;i<paintedRooms.length;i++){
   const r=paintedRooms[i];
   if(!this._withinCamera(game,r,52))continue;
   this._sectorDarkness(ctx,r,t,i,p);
   this._sectorAwakening(ctx,r,t,i);
  }
  // Floor navigation runs across rooms, corridors and side wings.
  this._drawGuideNetwork(ctx,game,t);
  this._drawCombatCues(ctx,game);
  // The remote gate receives a clean, rounded energy beam only after the
  // room has flashed into life and the wall conduits have charged.
  if(this.done('generator')&&Math.abs(p.x-this.cx)<1050){
   const reactor=this.device('generator'),distributor=this.device('dock-gate');
   const beamAge=t-(reactor?.activatedAt??t)-2.9;
   if(beamAge>0)drawPowerLink(ctx,reactor,distributor,t,beamAge,this.done('dock-gate'));
  }
   // Station scouts are present in their niches before their power-up cue.
   // Culling avoids touching atlases in distant sectors during each frame.
   for(const spot of this.spac1Spots){
    if(spot.active||Math.abs(spot.x-p.x)>900||Math.abs(spot.y-p.y)>720)continue;
    if(spot.isolated){ctx.save();ctx.globalAlpha=.4;drawSpac1Wake(ctx,spot,t);ctx.restore();}
    else drawSpac1Wake(ctx,spot,t);
   }
 }
 _starWindow(ctx,t,p,game){
  // Both observation galleries look toward the same stellar orbit.
  // NASA/SDO AIA 304 solar imagery is the textured stellar disk.
  // The corona, metal occluders, parallax and sunlight are scene lighting.
  // The viewing bays sit outside the traversable rooms, behind the top
  // pressure bulkhead. The corvette can approach the glass but cannot overlap it.
  const windows=this.getSolarWindows().map((spec,i)=>({
   ...spec,near:i===0?1550:1560,scale:i===0?1:1.35
  }));
  for(const w of windows){
   if(!this._withinCamera(game,{x:w.x-100,y:w.y,w:w.w+200,h:w.bulkheadY-w.y+420}))continue;
   const sx=w.x+w.w*.63,sy=w.y+w.h*.43;
   ctx.save();
   ctx.beginPath();ctx.rect(w.x,w.y,w.w,w.h);ctx.clip();
   ctx.fillStyle='#030916';ctx.fillRect(w.x,w.y,w.w,w.h);
   if(stationNebula?.complete&&stationNebula.naturalWidth){
    const shift=((p.x-this.cx)*.013+t*.55)%(w.w*.16);
    ctx.save();ctx.globalAlpha=.73;
    ctx.drawImage(stationNebula,w.x-80-shift,w.y-102,w.w*1.55,w.h*1.9);
    ctx.restore();
   }else{
    const bg=ctx.createLinearGradient(w.x,w.y,w.x+w.w,w.y+w.h);
    bg.addColorStop(0,'#0a132c');bg.addColorStop(.42,'#38223c');
    bg.addColorStop(1,'#091b37');ctx.fillStyle=bg;ctx.fillRect(w.x,w.y,w.w,w.h);
   }
   // The observed star is deliberately larger than the viewport: a nearby
   // stellar photosphere, not a distant painted circle. The actual NASA/SDO
   // texture provides the surface and only the atmospheric corona is drawn.
   const starSize=w.h*(w.scale===1?1.45:1.68);
   const corona=ctx.createRadialGradient(sx,sy,18,sx,sy,starSize*.91);
   corona.addColorStop(0,'#fff4bca8');corona.addColorStop(.25,'#ffb36891');
   corona.addColorStop(.62,'#fc723829');corona.addColorStop(1,'#ff652000');
   ctx.fillStyle=corona;ctx.globalAlpha=.55+.45*solarActivity(t);
   ctx.fillRect(sx-starSize*.91,sy-starSize*.91,starSize*1.82,starSize*1.82);
   ctx.globalAlpha=1;
   // Slow edge plasma: small limb prominences erupt outside the measured
   // surface, with no texture reupload or new WebGL object per frame.
   const radius=starSize*.49;
   ctx.save();ctx.translate(sx,sy);ctx.rotate(t*.003);
   ctx.strokeStyle='#ffae6c';ctx.lineWidth=2.6;ctx.shadowColor='#ff863a';
   ctx.shadowBlur=ctx.__lowFx?0:(11);ctx.globalAlpha=.39+.1*Math.sin(t*.27);
   for(let k=0;k<5;k++){
    const angle=k*TAU/5+(.07*Math.sin(t*.09+k));
    const a=angle-.09,b=angle+.11;
    const x1=Math.cos(a)*radius,y1=Math.sin(a)*radius;
    const x2=Math.cos(b)*radius,y2=Math.sin(b)*radius;
    ctx.beginPath();ctx.moveTo(x1,y1);
    ctx.quadraticCurveTo(Math.cos(angle)*radius*1.23,
       Math.sin(angle)*radius*1.23,x2,y2);ctx.stroke();
   }
   ctx.restore();
   if(solarDisk?.complete&&solarDisk.naturalWidth){
    ctx.save();ctx.translate(sx,sy);ctx.rotate(t*.018);
    ctx.globalAlpha=.72+.28*solarActivity(t);
    ctx.shadowColor='#ffb15e';ctx.shadowBlur=ctx.__lowFx?0:(40*w.scale);
    ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.clip();
    ctx.drawImage(solarDisk,-starSize/2,-starSize/2,starSize,starSize);
    ctx.globalCompositeOperation='screen';
    ctx.lineWidth=8;
    for(let j=0;j<4;j++){
     const y=Math.sin(t*.24+j*1.9)*radius*.66;
     const x=Math.cos(t*.17+j*2.4)*radius*.48;
     ctx.strokeStyle=j%2?'#ffb16637':'#ffdb8730';
     ctx.beginPath();ctx.ellipse(x,y,radius*.42,radius*.12,
       t*.085+j*.7,0,TAU);ctx.stroke();
    }
    ctx.restore();
   }
   // Subtle warm overexposure on the glass is tied to the visible limb,
   // while reinforcement mullions remain sharply occluding in the next pass.
   const flare=ctx.createRadialGradient(sx,sy,starSize*.1,sx,sy,starSize*.95);
   flare.addColorStop(0,'#ffe8b01a');flare.addColorStop(.5,'#ffd59917');
   flare.addColorStop(1,'#ffbe7600');ctx.fillStyle=flare;
   ctx.fillRect(sx-starSize,sy-starSize,starSize*2,starSize*2);
   // Multi-layer glass: thermal tint, glancing reflection and depth edging.
   const glass=ctx.createLinearGradient(w.x,w.y,w.x+w.w,w.y+w.h);
   glass.addColorStop(0,'#9dc9ff20');glass.addColorStop(.52,'#18284607');
   glass.addColorStop(1,'#b8dfff17');
   ctx.fillStyle=glass;ctx.fillRect(w.x,w.y,w.w,w.h);
   ctx.strokeStyle='#dbeeff6b';ctx.lineWidth=1;
   for(let i=0;i<3;i++){
    const yy=w.y+18+i*12;
    ctx.beginPath();ctx.moveTo(w.x+18,yy);
    ctx.lineTo(w.x+70+i*13,yy);ctx.stroke();
   }
   ctx.restore();
   // Structural frame and mullions cast readable shadows.
   ctx.save();
   ctx.strokeStyle='#142a3a';ctx.lineWidth=26;ctx.strokeRect(w.x,w.y,w.w,w.h);
   ctx.strokeStyle='#94b3c9';ctx.lineWidth=5;ctx.strokeRect(w.x+7,w.y+7,w.w-14,w.h-14);
   const bays=Math.max(3,Math.round(w.w/160));
   for(let i=1;i<bays;i++){
    const bx=w.x+w.w*i/bays;
    ctx.strokeStyle='#1f3545';ctx.lineWidth=20;
    ctx.beginPath();ctx.moveTo(bx,w.y+13);ctx.lineTo(bx,w.y+w.h-13);ctx.stroke();
    ctx.strokeStyle='#638194';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(bx-8,w.y+13);ctx.lineTo(bx-8,w.y+w.h-13);ctx.stroke();
   }
   // The pressure bulkhead joins the glass to the upper wall of the room.
   // It closes the visual gap that otherwise makes this look like a floor hatch.
   const wallTop=w.y+w.h-4,wallBottom=w.bulkheadY;
   const bulkhead=ctx.createLinearGradient(0,wallTop,0,wallBottom+33);
   bulkhead.addColorStop(0,'#08131f');
   bulkhead.addColorStop(.47,'#304858');
   bulkhead.addColorStop(.70,'#101e2b');
   bulkhead.addColorStop(1,'#040c14');
   ctx.fillStyle=bulkhead;
   ctx.fillRect(w.x-25,wallTop,w.w+50,wallBottom-wallTop+35);
   ctx.fillStyle='#6d8897';
   ctx.fillRect(w.x-26,wallTop+4,w.w+52,4);
   ctx.fillStyle='#07111b';
   ctx.fillRect(w.x-25,wallBottom-7,w.w+50,12);
   ctx.fillStyle=w.powered?'#92e1cf':'#d19c78';
   ctx.globalAlpha=w.powered?.78:.48;
   ctx.fillRect(w.x+25,wallBottom+2,w.w-50,3);
   ctx.globalAlpha=1;
   for(let x=w.x+37;x<w.x+w.w-25;x+=83){
    ctx.fillStyle='#7591a0';ctx.beginPath();
    ctx.arc(x,wallBottom-12,3.4,0,TAU);ctx.fill();
    ctx.fillStyle='#10212f';ctx.beginPath();
    ctx.arc(x,wallBottom-12,1.4,0,TAU);ctx.fill();
   }
   // Solar shafts project through the glass, beginning on the room floor.
   // The wide-to-narrow penumbra follows window bars, and fine dust drifts
   // across the beam. Everything is world-space, not a UI overlay.
   const by=w.bulkheadY+22,reach=350;
   const shimmer=.42+.58*solarActivity(t);
   ctx.save();
   ctx.globalCompositeOperation='screen';
   const beam=ctx.createLinearGradient(0,by,0,by+reach);
   beam.addColorStop(0,'#ffe4a28c');
   beam.addColorStop(.30,'#ffd08350');
   beam.addColorStop(.72,'#e59f5521');
   beam.addColorStop(1,'#f8bd6700');
   ctx.globalAlpha=shimmer;
   for(let i=0;i<bays;i++){
    const left=w.x+w.w*i/bays+11;
    const right=w.x+w.w*(i+1)/bays-11;
    const lean=36+(i-1)*10;
    ctx.fillStyle=beam;ctx.beginPath();
    ctx.moveTo(left,by);ctx.lineTo(right,by);
    ctx.lineTo(right+lean+43,by+reach);
    ctx.lineTo(left+lean-42,by+reach);
    ctx.closePath();ctx.fill();
   }
   const pool=ctx.createRadialGradient(sx,by+100,6,sx+48,by+215,275);
   pool.addColorStop(0,'#ffe8b26b');
   pool.addColorStop(.32,'#ffca8040');
   pool.addColorStop(1,'#ffb45a00');
   ctx.fillStyle=pool;
   ctx.fillRect(w.x-100,by,w.w+200,reach+30);
   ctx.restore();
   // Metallic deck-edge reflection synchronized with stellar intensity.
   ctx.save();ctx.globalCompositeOperation='screen';
   ctx.globalAlpha=.15+.50*solarActivity(t);
   const bounce=ctx.createLinearGradient(0,by-8,0,by+60);
   bounce.addColorStop(0,'#ffe6b77a');bounce.addColorStop(1,'#d98c4800');
   ctx.fillStyle=bounce;ctx.fillRect(w.x+8,by-8,w.w-16,68);
   ctx.restore();
   // Strong, legible cold mullion shadows anchor the star to architecture.
   ctx.save();ctx.fillStyle='#07162583';
   ctx.globalAlpha=.28+.72*solarActivity(t);
   for(let i=1;i<bays;i++){
    const bx=w.x+w.w*i/bays;
    ctx.beginPath();ctx.moveTo(bx-13,by);ctx.lineTo(bx+13,by);
    ctx.lineTo(bx+61,by+reach);ctx.lineTo(bx+20,by+reach);
    ctx.closePath();ctx.fill();
   }
   // Dust motes are deterministic and inexpensive: no per-frame allocations.
   for(let j=0;j<16;j++){
    const dx=w.x+((j*113.7+t*(1.1+j%3))%w.w);
    const dy=by+((j*79.2-t*(1.3+j%2)+5000)%reach);
    const d=1.15+((j*7)%4)*.41;
    ctx.globalAlpha=(.12+.2*Math.sin(t*.83+j*2.7)**2);
    ctx.fillStyle=j%3?'#ffe2ac':'#d6f5ff';
    ctx.beginPath();ctx.arc(dx,dy,d,0,TAU);ctx.fill();
   }
   ctx.restore();
   ctx.restore();
  }
 }
 _drawCombatCues(ctx,game){
  const p=game.player,t=game.gameTime;
  ctx.save();ctx.lineWidth=2;
  for(const w of this.spawnWarnings){
   const q=w.point;if(Math.abs(q.x-p.x)>900||Math.abs(q.y-p.y)>650)continue;
   const progress=clamp(1-(w.at-t)/1.2,0,1);
   ctx.strokeStyle='#ffab7c';ctx.fillStyle='#8d2b252e';
   ctx.beginPath();ctx.arc(q.x,q.y,38+8*(1-progress),0,TAU);ctx.fill();ctx.stroke();
   ctx.fillStyle='#ffd6ac';ctx.textAlign='center';ctx.font='700 11px system-ui';
   ctx.fillText('ПРОБУЖДЕНИЕ',q.x,q.y-51);
  }
  if(this.phase===3)for(const [i,q] of this.heatLanes().entries()){
   const state=this.heatState(game,i);if(state==='idle')continue;
   ctx.fillStyle=state==='warning'?'#d18b2738':'#ff572d79';
   ctx.strokeStyle=state==='warning'?'#f6c372':'#ff9c66';
   ctx.fillRect(q.x-47,q.y,94,640);ctx.strokeRect(q.x-47,q.y,94,640);
   ctx.beginPath();for(let y=q.y+20;y<q.y+630;y+=38){ctx.moveTo(q.x-35,y);ctx.lineTo(q.x+35,y+18);}ctx.stroke();
   ctx.fillStyle='#fff0ce';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(state==='warning'?'ПЕРЕГРЕВ':'ОПАСНО',q.x,q.y-12);
  }
  if(this.done('weapon')&&(t-(this.weaponInstalledAt??-100)<12||this.phase===2)){
   const range=p.weapons.find(w=>w.id==='starter_pulse')?.getRange(p)||150;
   ctx.strokeStyle='#84d8ed72';ctx.setLineDash([5,9]);
   ctx.beginPath();ctx.arc(p.x,p.y,range,0,TAU);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle='#bceaf2';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText('АВТООГОНЬ · '+Math.round(range)+' м',p.x,p.y+range+19);
  }
  ctx.restore();
 }
 _drawRobotStatus(ctx,e){
  if(e.hp<=0)return;
  const color=e.prologueDuty==='core'?'#ff987a':e.ranged?'#e9bbff':e.shieldHp>0?'#8ee9ff':null;
  if(!color)return;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.globalAlpha=.8;
  ctx.beginPath();ctx.ellipse(e.x,e.y+8,23,14,0,0,TAU);ctx.stroke();
  if(e.shieldHp>0){
   ctx.fillStyle='#102b3e';ctx.fillRect(e.x-22,e.y-51,44,4);
   ctx.fillStyle=color;ctx.fillRect(e.x-22,e.y-51,44*clamp(e.shieldHp/(e.type.shieldHp||1),0,1),4);
  }
  if(e.prologueDuty==='core'&&e.coreWindup>0){ctx.strokeStyle='#ffe6bc';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,31,-Math.PI/2,-Math.PI/2+clamp(e.coreWindup/.75,0,1)*TAU);ctx.stroke();}
  ctx.restore();
 }
 drawRobot(ctx,e,time){
  // Real Kenney CC0 top-down chassis and animated running gear take priority.
  // The older lightweight drawing is used only before the PNG atlas loads.
  if(drawPrologueRobot(ctx,e,time)){this._drawRobotStatus(ctx,e);return;}
  if(e.hp<=0)return;
  const group=e.prologueGroup||'';
  const heavy=group==='command'||group==='siege';
  const spider=group==='security'||group==='observatory'||group==='reinforcement';
  const s=heavy?1.28:spider?.86:1;
  const stride=Math.sin(time*(heavy?5.4:8.2)+e.x*.015+e.y*.019);
  const alert=e.flashTimer>0;
  const steel=heavy?'#708997':spider?'#608e99':'#908879';
  const edge=alert?'#fff':'#b9d0d7';
  ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.visualAngle||0);
  // Floor shadow anchors walkers to the station instead of making them fly.
  ctx.fillStyle='#030c16a3';ctx.beginPath();ctx.ellipse(2,13*s,22*s,9*s,0,0,TAU);ctx.fill();
  ctx.scale(s,s);ctx.lineCap='round';ctx.lineJoin='round';
  // Three or four pairs of jointed legs advance in alternating phases.
  for(const side of [-1,1]){
   for(let limb=0;limb<(spider?3:2);limb++){
    const k=(limb%2?1:-1)*side*stride*7;
    const dy=-12+limb*(spider?12:21);
    ctx.strokeStyle='#102331';ctx.lineWidth=10;
    ctx.beginPath();ctx.moveTo(side*12,dy);
    ctx.lineTo(side*(spider?27:22),dy+3+k);
    ctx.lineTo(side*(spider?39:30),dy+14-k);ctx.stroke();
    ctx.strokeStyle=steel;ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(side*12,dy);
    ctx.lineTo(side*(spider?27:22),dy+3+k);
    ctx.lineTo(side*(spider?39:30),dy+14-k);ctx.stroke();
    ctx.fillStyle='#d2b995';ctx.beginPath();ctx.arc(side*(spider?27:22),dy+3+k,3,0,TAU);ctx.fill();
   }
  }
  ctx.fillStyle='#122836';ctx.strokeStyle=edge;ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-15,-20);ctx.lineTo(14,-20);
  ctx.lineTo(21,13);ctx.lineTo(0,23);ctx.lineTo(-21,13);ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.fillStyle=steel;ctx.fillRect(-12,-13,24,26);
  ctx.fillStyle=heavy?'#ef906b':'#ee5f70';
  ctx.fillRect(-8,-14,16,6);
  ctx.fillStyle=alert?'#fff':heavy?'#ffc996':'#ff788b';
  ctx.beginPath();ctx.arc(0,-8,spider?6:8,0,TAU);ctx.fill();
  ctx.strokeStyle='#a7c8d1';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(-10,11);ctx.lineTo(10,11);ctx.stroke();
  if(heavy){
   ctx.fillStyle='#455d6c';ctx.fillRect(-25,-17,11,32);ctx.fillRect(14,-17,11,32);
   ctx.fillStyle='#e1ac84';ctx.fillRect(-25,-19,11,6);ctx.fillRect(14,-19,11,6);
  }
  if(e.aimTimer>0){
   ctx.strokeStyle='#ff8b7a';ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(0,-7,25,0,TAU);ctx.stroke();
  }
  ctx.restore();
  if(e.hp<e.maxHp){
   const ratio=Math.max(0,e.hp/e.maxHp),w=heavy?53:38;
   ctx.fillStyle='#071522';ctx.fillRect(e.x-w/2,e.y-48*s,w,4);
   ctx.fillStyle=ratio>.35?'#8dedd6':'#ff8570';
   ctx.fillRect(e.x-w/2,e.y-48*s,w*ratio,4);
  }
 }
 onEnemyDestroyed(e){
  if(!e?.prologueGroup)return;
  const kind=['security','observatory','reinforcement'].includes(e.prologueGroup)?'spac1':
   e.prologueGroup==='command'||e.prologueGroup==='siege'?'sentry':'service';
  playPrologueCue(this._audioGame,e.prologueHeavy?'heavy_destroyed':'robot_destroyed',e,
   e.prologueHeavy?.62:.72);
  this.robotDeaths.push({x:e.x,y:e.y,angle:e.visualAngle||0,
   kind,age:0,ttl:.85,duration:.85});
  if(this.robotDeaths.length>48)this.robotDeaths.splice(0,this.robotDeaths.length-48);
 }
 drawShipShadow(ctx,player,time,campaign=null){
  if(!player)return;
  // Avoid painting an aircraft shadow into empty space between decks.
  let floor=null;
  for(const group of [this.rooms,this.wings,this.halls]){
   floor=group.find(r=>rectContains(r,player.x,player.y));
   if(floor)break;
  }
  if(!floor)return;
  const stage=heroStageFromProgress(player,campaign,this.done('weapon'));
  const health=player.maxHp>0?player.hp/player.maxHp:1;
  const damaged=health<.4;
  const mask=heroShadowMask(stage,damaged)||heroShadowMask(stage,false);
  const motion=heroMotionPose(player.size,player.enginePower);
  const now=typeof performance!=='undefined'?performance.now()*.001:time;
  const impact=Math.min(1,(player.hitPulse||0)/.23);
  const angle=(player.visualAngle||0)+(player.visualBank||0)+motion.angle+
   impact*Math.sin(now*25)*.014;
  const x=player.x+motion.x+impact*Math.sin(now*34)*player.size*.045;
  const y=player.y+motion.y;
  const bob=.5+.5*Math.sin(now*2.23);
  ctx.save();ctx.beginPath();
  ctx.rect(floor.x+16,floor.y+16,Math.max(0,floor.w-32),Math.max(0,floor.h-32));
  ctx.clip();
  // Directed star shadow: the projected contour changes with yaw, hull
  // upgrades, damage, height and the star's measured animation cycle.
  for(const w of this.getSolarWindows()){
   if(x<w.x-135||x>w.x+w.w+160||
      y<w.bulkheadY-20||y>w.bulkheadY+420)continue;
   const lx=w.x+w.w*.63,ly=w.y+w.h*.43;
   const vx=x-lx,vy=y-ly,d=Math.hypot(vx,vy)||1;
   const dx=vx/d,dy=vy/d;
   const intensity=solarActivity(time)*(w.powered?1:.8);
   const stretch=1.02+.12*bob;
   paintHeroShadow(ctx,mask,x+dx*(24+9*bob),y+dy*(24+9*bob),
    player.size,angle,stretch,stretch*.94,.38*intensity,4,dx*.15);
   break;
  }
  // Two lightweight hull-shaped contact layers remain after the solar
  // light fades, retaining the cue that the corvette hovers over the deck.
  paintHeroShadow(ctx,mask,x+3,y+8,player.size,angle,
   .91+.065*bob,.88+.055*bob,.26-.035*bob,4);
  paintHeroShadow(ctx,mask,x+2,y+6,player.size,angle,
   .77+.06*bob,.76+.06*bob,.17-.02*bob,0);
  ctx.restore();
 }
 drawFront(ctx,game){
  const t=game.gameTime,p=game.player;
  for(const wreck of this.stationWrecks||[])
   if(Math.abs(wreck.x-p.x)<1200&&Math.abs(wreck.y-p.y)<850)
    drawStationRobotWreck(ctx,wreck,t);
  for(const wreck of this.robotDeaths)
   if(Math.abs(wreck.x-p.x)<1200&&Math.abs(wreck.y-p.y)<850)
    drawPrologueRobotDeath(ctx,wreck);
  for(const dev of this.devices){
   if(dev.kind!=='base'||Math.abs(p.x-dev.x)>1250)continue;
   const base=this.base(dev.id,game);
   if(!base)continue;
   const powered=!!base.activated,heavy=dev.id.startsWith('heavy');
   ctx.save();ctx.translate(dev.x,dev.y);
   // Actual Wenrexa station hardware with the SAME turret-art pipeline as
   // the rest of Survivor. The underlying FriendlyBases guns still own aim,
   // projectile trajectories, damage, heat, integrity and cooldowns.
   ctx.fillStyle='#020a1499';ctx.beginPath();ctx.ellipse(7,12,107,80,0,0,TAU);ctx.fill();
   ctx.strokeStyle='#708f9d';ctx.lineWidth=5;
   ctx.strokeRect(-87,-59,174,118);
   sprite(ctx,'cross',0,0,143,0,powered?.90:.58);
   ctx.fillStyle='#091c2a';ctx.fillRect(-43,-14,86,28);
   ctx.fillStyle=powered?'#79f3da':'#de9569';ctx.fillRect(-36,-3,72,6);
   for(const turret of base.turrets){
    const a=(turret.mount-2)*Math.PI/4;
    const tx=Math.cos(a)*78,ty=Math.sin(a)*78;
    const alive=powered&&!turret.disabled&&(turret.integrity??100)>0;
    const aim=turret.aimAngle??a,recoil=turret.recoil||0;
    const rising=powered&&turret.visualLockUntil&&t<turret.visualLockUntil;
    ctx.save();ctx.globalAlpha=alive||rising?1:.52;
    const gx=tx-Math.cos(aim)*recoil,gy=ty-Math.sin(aim)*recoil;
    const drawn=drawPrologueTurretSprite(ctx,turret,gx,gy,{
     time:t,activatedAt:base.visualActivatedAt,powered,aim,
     flash:turret.flash||0,heavy
    });
    if(!drawn){
     // The existing station artwork stays visible until the atlases load.
     drawTurretMount(ctx,turret,tx,ty,t);
     const model=heavy?STATION_PARTS.rail:
       (turret.flash>0?STATION_PARTS.turretFireStart+
        Math.min(7,Math.floor((1-clamp(turret.flash/.19,0,1))*8)):
        STATION_PARTS.turretIdle);
     drawStationPart(ctx,model,gx,gy,heavy?83:69,aim-Math.PI/2);
     drawTurretHead(ctx,turret,gx,gy,aim,t);
     if((turret.flash||0)>0&&alive){
      const flash=clamp(turret.flash/.19,0,1);
      const tipX=gx+Math.cos(aim)*(heavy?43:36);
      const tipY=gy+Math.sin(aim)*(heavy?43:36);
      glow(ctx,tipX,tipY,42,heavy?'#c4eaff':'#81f5ed');
      ctx.fillStyle='#e8fcff';ctx.beginPath();
      ctx.arc(tipX,tipY,4+6*flash,0,TAU);ctx.fill();
     }
    }
    // Only the real FriendlyBases tracking target drives this optical cue.
    // The allied battery never shows a hostile detection warning.
    const locked=!!(alive&&turret.tracked?.hp>0);
    if(turret._visualTracked!==turret.tracked){
     turret._visualTracked=turret.tracked||null;
     if(locked)turret._visualTrackAt=t;
    }
    ctx.save();
    ctx.globalAlpha=alive?(locked?.95:.46):.22;
    ctx.fillStyle=locked?'#9bfff4':alive?'#79b7c7':'#b58363';
    ctx.shadowColor=locked?'#6dece9':'transparent';
    ctx.shadowBlur=ctx.__lowFx?0:(locked?6:0);
    const ledX=gx+Math.cos(aim)*13,ledY=gy+Math.sin(aim)*13;
    ctx.beginPath();ctx.arc(ledX,ledY,locked?2.8:1.8,0,TAU);ctx.fill();
    const lockAge=t-(turret._visualTrackAt??-100);
    if(locked&&lockAge>=0&&lockAge<.55){
     ctx.globalAlpha=(1-lockAge/.55)*.42;
     ctx.strokeStyle='#91f9f0';ctx.lineWidth=1.5;
     ctx.beginPath();ctx.arc(ledX,ledY,6+lockAge*15,0,TAU);ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    if(powered&&(turret.integrity??100)<100){
     ctx.fillStyle='#241f24';ctx.fillRect(tx-23,ty+39,46,5);
     ctx.fillStyle=turret.disabled?'#ff8d7d':'#a8e6b8';ctx.fillRect(tx-23,ty+39,46*clamp((turret.integrity??100)/100,0,1),5);
    }
   }
   // Labels are proximity-based: the station should not be a wall of HUD text.
   if(Math.hypot(p.x-dev.x,p.y-dev.y)<370){
    ctx.fillStyle='#e7fcff';ctx.font='700 13px system-ui';ctx.textAlign='center';
    ctx.fillText((heavy?'ТЯЖЁЛАЯ БАТАРЕЯ':'ОХРАННАЯ ТУРЕЛЬ')+
      (powered?' · В СЕТИ':' · ОТКЛЮЧЕНА'),0,-92);
   }
   ctx.restore();
  }
  // The next objective is labelled even BEFORE the ship enters tool range:
  // green marks hold-to-repair, cyan marks a one-tap console action.
  // Nearby optional interaction always overrides the distant story target.
  const repairTarget=this.repairCandidate(game);
  const tapTarget=this.canInteract(game)?.device;
  const mainTarget=this.target(game);
  const distant=mainTarget&&this.devices.includes(mainTarget)&&!mainTarget.done?
   mainTarget:null;
  const cueTarget=repairTarget||tapTarget||distant;
  const cueDistance=cueTarget?Math.hypot(p.x-cueTarget.x,p.y-cueTarget.y):Infinity;
  if(cueTarget&&cueDistance<590){
   const repairs=['generator','terminal','sentry-a','sentry-b','heavy-a','heavy-b','core'];
   const isRepair=repairs.includes(cueTarget.id);
   const nearby=isRepair?!!repairTarget:!!tapTarget;
   const mobile=!!globalThis.window?.matchMedia?.('(any-pointer: coarse)').matches;
   const color=isRepair?'#8dffca':'#8cdbff';
   const action=isRepair?(mobile?'РЕМОНТНЫЙ ЛУЧ · УДЕРЖИВАЙТЕ':'РЕМОНТНЫЙ ЛУЧ · ПРОБЕЛ'):
    (mobile?'ВЗАИМОДЕЙСТВИЕ · КНОПКА':'ВЗАИМОДЕЙСТВИЕ · E');
   const label=nearby?action:action+' · ПОДЛЕТИТЕ';
   const boxWidth=nearby?272:316;
   const y=cueTarget.y-123;
   ctx.save();
   ctx.globalAlpha=nearby?1:clamp(1-(cueDistance-325)/450,.5,.92);
   ctx.strokeStyle=color;ctx.lineWidth=2;
   ctx.setLineDash([3,7]);ctx.beginPath();
   ctx.moveTo(cueTarget.x,y+19);ctx.lineTo(cueTarget.x,cueTarget.y-57);ctx.stroke();
   ctx.setLineDash([]);
   ctx.fillStyle='#071b2cf0';
   ctx.shadowColor=color;ctx.shadowBlur=ctx.__lowFx?0:(nearby?12:4);
   ctx.beginPath();
   if(ctx.roundRect)ctx.roundRect(cueTarget.x-boxWidth/2,y-22,boxWidth,38,10);
   else ctx.rect(cueTarget.x-boxWidth/2,y-22,boxWidth,38);
   ctx.fill();ctx.stroke();ctx.shadowBlur=ctx.__lowFx?0:(0);
   ctx.fillStyle=color;ctx.textAlign='center';ctx.font='800 12px system-ui';
   ctx.fillText(label,cueTarget.x,y+2);
   ctx.beginPath();ctx.arc(cueTarget.x,cueTarget.y-57,4,0,TAU);ctx.fill();
   ctx.restore();
  }
  // A world-space progress indicator identifies exactly which machine
  // receives the continuous beam, even beneath a compact mobile HUD.
  if(this.repairHold){
   const t=this.repairCandidate(game);
   if(t&&t.id===this.repairHold.id){
    const progress=this.repairHold.progress;
    ctx.save();ctx.strokeStyle='#133343';ctx.lineWidth=8;
    ctx.beginPath();ctx.arc(t.x,t.y,84,0,TAU);ctx.stroke();
    ctx.strokeStyle='#89ffcf';ctx.shadowColor='#6df9b6';
    ctx.shadowBlur=ctx.__lowFx?0:(14);ctx.lineWidth=7;
    ctx.beginPath();ctx.arc(t.x,t.y,84,-Math.PI/2,
      -Math.PI/2+progress*TAU);ctx.stroke();
    ctx.shadowBlur=ctx.__lowFx?0:(0);ctx.textAlign='center';ctx.font='700 14px system-ui';
    ctx.fillStyle='#d8fff1';
    ctx.fillText('УДЕРЖИВАЙ · '+Math.floor(progress*100)+'%',t.x,t.y-100);
    ctx.restore();
   }
  }
  for(const d of this.doors){
   if(Math.abs(p.x-d.x)>1400)continue;
   // Only the first room has the new damaged isometric two-leaf gate.
   // Until its atlas is decoded, retain the existing collision-matched art.
   if(d.id===0&&drawFirstRoomProp(ctx,'gate',gateFrame(d.open),
      d.x,d.y,d.width+42,t))continue;
   const gap=d.width*d.open;
   ctx.save();
   // Powered armoured iris, with actual Wanrexa atlas frame segments.
   // Collision is unchanged: constrainEntity continues to use d.open.
   const top=d.y-d.width/2,bottom=d.y+d.width/2;
   ctx.fillStyle='#071625';ctx.fillRect(d.x-49,top-35,98,d.width+70);
   ctx.fillStyle='#405769';ctx.fillRect(d.x-42,top-34,84,16);
   ctx.fillRect(d.x-42,bottom+18,84,16);
   sprite(ctx,'wing',d.x,top-22,108,Math.PI/2,.93);
   sprite(ctx,'wing',d.x,bottom+22,108,-Math.PI/2,.93);
   ctx.strokeStyle=d.target?COLOR.mint:COLOR.red;ctx.lineWidth=3;
   ctx.strokeRect(d.x-49,top-35,98,d.width+70);
   if(d.open<1){
    const leaf=Math.max(0,(d.width-gap)/2);
    const steel=ctx.createLinearGradient(d.x-35,0,d.x+35,0);
    steel.addColorStop(0,'#111e2b');steel.addColorStop(.48,'#597185');
    steel.addColorStop(1,'#172b39');ctx.fillStyle=steel;
    ctx.fillRect(d.x-35,top,70,leaf);
    ctx.fillRect(d.x-35,bottom-leaf,70,leaf);
    for(const half of [top,bottom-leaf]){
     ctx.strokeStyle='#b6cfdd96';ctx.lineWidth=2;
     ctx.beginPath();ctx.moveTo(d.x-25,half+8);
     ctx.lineTo(d.x+25,half+8);ctx.stroke();
    }
   }
   ctx.fillStyle=d.target?'#83f7cf':'#fc826e';
   for(const y of [top-32,bottom+27]){
    ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=ctx.__lowFx?0:(12);
    ctx.fillRect(d.x-17,y,34,5);
   }
   ctx.shadowBlur=ctx.__lowFx?0:(0);
   ctx.restore();
  }
  for(const dev of this.devices){
   if(Math.abs(p.x-dev.x)>1200||Math.abs(p.y-dev.y)>1150||dev.kind==='base')continue;
   const on=dev.done;
   if(dev.id==='generator'||dev.id==='dock-gate'){
    const kind=dev.id==='generator'?'reactor':'distributor';
    const age=on?Math.max(0,t-(dev.activatedAt??t)):0;
    const frame=kind==='reactor'?reactorFrame(on,age):distributorFrame(on,age);
    if(drawFirstRoomProp(ctx,kind,frame,dev.x,dev.y,
       kind==='reactor'?194:162,t)){
     if(Math.hypot(p.x-dev.x,p.y-dev.y)<225){
      ctx.save();ctx.font='700 13px system-ui';ctx.textAlign='center';
      ctx.fillStyle='#e4f7ff';ctx.fillText(dev.name,dev.x,dev.y-113);
      ctx.restore();
     }
     continue;
    }
   }
   ctx.save();glow(ctx,dev.x,dev.y,114,on?COLOR.mint:COLOR.amber);
   // Inlaid oval floor mounts share the station deck texture. Previously,
   // a solid 114×94 rectangle made every terminal look like a pasted square.
   const housing=dev.kind==='forge'?'#d9a975':
     dev.kind==='terminal'?'#8cc6f5':dev.kind==='transmitter'?'#b5a7ef':
     dev.kind==='log'?'#9bafc0':dev.id==='coolant'?'#82e4ee':'#89cbb7';
   ctx.fillStyle='#051522b8';ctx.beginPath();
   ctx.ellipse(dev.x+4,dev.y+23,73,47,0,0,TAU);ctx.fill();
   ctx.strokeStyle=housing+'a8';ctx.lineWidth=2.5;ctx.beginPath();
   ctx.ellipse(dev.x,dev.y+19,66,41,0,0,TAU);ctx.stroke();
   ctx.strokeStyle=housing+'56';ctx.lineWidth=1;
   ctx.beginPath();ctx.ellipse(dev.x,dev.y+19,54,32,0,0,TAU);ctx.stroke();
   const art=dev.kind==='terminal'||dev.kind==='log'?'lab':
     dev.kind==='forge'?'hanger':dev.kind==='transmitter'?'arc':
     dev.kind==='gate'?'bridge':'basic';
   sprite(ctx,art,dev.x,dev.y,dev.kind==='forge'?106:86,0,on?.93:.68);
   ctx.strokeStyle=on?COLOR.mint:COLOR.amber;ctx.lineWidth=2.5;
   ctx.beginPath();ctx.arc(dev.x,dev.y,62,t*.12,t*.12+Math.PI*1.25);ctx.stroke();
   const lamps=on?'#86ffcb':'#eab16d';
   ctx.fillStyle=lamps;
   for(const side of [-1,1])
    for(let j=0;j<3;j++)ctx.fillRect(dev.x+side*58-2,dev.y-28+j*26,4,11);
   if(Math.hypot(p.x-dev.x,p.y-dev.y)<225){
    ctx.font='700 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#e4f7ff';
    ctx.fillText(dev.name,dev.x,dev.y-89);
   }
   // The single contextual control cue above replaces competing
   // instructions that previously labeled every inactive turret with E.
   ctx.restore();
  }
  if(Math.abs(p.x-(this.cx+6540))<1450){
   const c=this.point(6540,0),fraction=clamp(this.coreHp/this.coreMaxHp,0,1);
   glow(ctx,c.x,c.y,255,fraction>.25?COLOR.mint:COLOR.red);
   sprite(ctx,'carrier',c.x,c.y,245,t*.06,.94);
   ctx.save();ctx.strokeStyle=fraction>.25?COLOR.mint:COLOR.red;ctx.lineWidth=8;
   ctx.beginPath();ctx.arc(c.x,c.y,143,-Math.PI/2,-Math.PI/2+TAU*fraction);ctx.stroke();
   ctx.fillStyle='#f4ffff';ctx.font='700 21px system-ui';ctx.textAlign='center';
   ctx.fillText('ЭНЕРГЕТИЧЕСКОЕ ЯДРО',c.x,c.y-165);
   ctx.fillText(Math.ceil(this.coreHp)+' / '+this.coreMaxHp,c.x,c.y+174);ctx.restore();
  }
  if(Math.abs(p.x-(this.cx+8030))<1200){
   const c=this.point(8030,0),active=this.done('transmitter');
   glow(ctx,c.x,c.y,260,active?'#82f8db':'#9c82e2');
   sprite(ctx,'arc',c.x,c.y,212,t*(active?.5:.1),.95);
  }
 }
}


