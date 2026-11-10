// Repeatable, stateful station sorties. Each objective is a real world event;
// enemy kills alone never satisfy the assignment.
import {ENEMY_TYPES} from './ai.js?v=field-operations-1-triangle-defense-1-ai-commander-20261110-corvette-20261110-1-pilot-value-2';
import {RULES} from './balance.js?v=field-operations-1';
import {recordEconomyExpense} from './sortie-ledger.js?v=economy-ledger-1';
import {drawRelayArt,drawConvoyEngineArt,drawConvoyHullArt,drawConvoySurfaceArt,
 drawConvoyWreckArt,drawSalvageCrateArt} from './field-operation-art.js?v=mission-art-6';
import {paintMissionCell,paintMissionMorph,paintMissionImpact} from './mission-objective-art.js?v=mission-pack-1';

export const FIELD_TACTICS=Object.freeze({shieldStrength:40,shieldHold:2.8,
 shieldTransferHold:2.6,shieldTransferCost:4,
 convoyRepairCost:6,convoyRepairStrength:35,convoyRepairHold:4,
 beaconDecodeSeconds:4.5,beaconDecodeRadius:240,convoyFullIntegrity:75,
 relaySyncSeconds:6.5,relaySyncHp:90,beaconUplinkSeconds:5.5,beaconUplinkHp:90,
 reactorCoolSeconds:4,reactorCoolPeriod:11.6});
const FIELD_PROP_CUTOUTS=Object.freeze({relay:[95,0,410,600],reactor:[649,60,561,520],
 beacon:[92,608,390,580],cargo:[620,690,655,420]});

export const FIELD_OPERATIONS=Object.freeze({
 'line-break':{id:'line-break',name:'Линия разрыва',station:'dock',
  ore:25,data:23,partialOre:12,partialData:9,
  desc:'Восстановите два узла связи в любом порядке, затем синхронизируйте линию в промежуточном пункте. Налётчики мешают работе; во время ремонта огонь приостановлен. После первого узла можно вернуться с частичной наградой.'},
 'deep-resonance':{id:'deep-resonance',name:'Глубинный резонанс',station:'lab',
  ore:26,data:25,partialOre:9,partialData:10,
  desc:'Получите два образца на богатых залежах. Раскалывающий удар портит образец. Шум привлекает патрули: на второй залежи возможен новый перехват. Можно прерывать добычу, чтобы снизить резонанс, или отступить после первого образца.'},
 'reverse-hunt':{id:'reverse-hunt',name:'Обратная охота',station:'lab',
  ore:18,data:37,partialOre:13,partialData:8,
  desc:'Сохраните два спектра опасного «зрачка»: первый снимайте с безопасной дистанции, второй потребует точнее выбрать позицию. В повторных вылазках сканер может раскрывать направленный сектор — его видно во время зарядки. Можно уничтожить цель раньше, но тогда останутся только обломки и часть данных.'},
 'false-call':{id:'false-call',name:'Чужой позывной',station:'lab',
  ore:17,data:30,partialOre:12,partialData:14,
  desc:'По двойному импульсу найдите поддельный маяк. Перехватите ответный сигнал, затем доберитесь до узла ретрансляции и закрепите запись под огнём. Ошибочные проверки вызывают охранение и снижают награду.'},
 'two-fronts':{id:'two-fronts',name:'Два фронта',station:'arsenal',
  ore:32,data:32,partialOre:17,partialData:17,
  desc:'Защитите два разнесённых узла. Следующая цель налёта обозначается заранее: враги могут сосредоточить огонь на одном узле. Один раз зарядите щит; между волнами можно перенести остаток барьера на второй узел за 4 сплава. Спасение одного узла тоже засчитывается.'}
 ,
 'sleeping-reactor':{id:'sleeping-reactor',name:'Спящий реактор',station:'arsenal',
  ore:30,data:31,partialOre:12,partialData:11,
  desc:'Извлеките обе кассеты. Начать с внешней безопаснее; внутренняя первой ускоряет выбросы. После первой кассеты можно сделать крюк к охлаждающему клапану: это займёт время, но увеличит интервалы между разрядами. Можно отступить с одной кассетой.'},
 'broken-convoy':{id:'broken-convoy',name:'Конвой на изломе',station:'carrier',
  ore:34,data:31,partialOre:17,partialData:13,
  desc:'Сопроводите транспорт: короткий маршрут опаснее, обходной дольше. Если корпус сильно повреждён, можно один раз остановиться для ремонта за 6 сплава — под огнём, без автострельбы. После гибели транспорта можно спасти часть груза.'}
});
export const fieldOperationIds=type=>type==='dock'?['line-break']:
 type==='lab'?['deep-resonance','reverse-hunt','false-call']:
 type==='arsenal'?['two-fronts','sleeping-reactor']:
 type==='carrier'?['broken-convoy']:[];
export const fieldThreatTier=(level=1,runs=0)=>Math.min(3,Math.max(0,
 Math.floor((Math.max(1,level)-1)/6),Math.floor(Math.max(0,runs)/3)));
export const fieldRewardFactor=tier=>1+.2*Math.max(0,Math.min(3,tier||0));
export const isFieldOperation=op=>!!op&&Object.hasOwn(FIELD_OPERATIONS,op.id);
// Each sortie exposes a readable attack plan. The starter pattern preserves
// the original split assault; later sorties force different shield priorities.
export function twoFrontsWaveTargets(op,index=op.wave){
 const plans=[[[0,1],[0,1],[0,1]],[[0,0],[1,0],[1,1]],[[1,1],[0,1],[0,0]]];
 const pattern=op.assaultPattern??0;
 return plans[pattern][Math.min(2,Math.max(0,index))].map(i=>
  op.nodes[i].hp>0?i:op.nodes[1-i].hp>0?1-i:i);
}
export function reverseHuntBand(op){
 if(op.scans===0)return [130,op.scanStyle===2?290:310];
 return op.scanStyle===2?[190,275]:op.scanStyle===1?[160,280]:[170,270];
}
export function reverseHuntInSector(op,enemy,player){
 if(op.scans!==1||!op.scanStyle)return true;
 const bearing=Math.atan2(player.y-enemy.y,player.x-enemy.x);
 const angle=Math.atan2(Math.sin(bearing-op.scanHeading),Math.cos(bearing-op.scanHeading));
 return Math.abs(angle)<=(op.scanStyle===2?.87:1.15);
}
const twoFrontsTransferSource=op=>op.nodes.find(n=>n.hp>0&&n.fieldShield>0);
const fieldLink=op=>({x:(op.nodes[0].x+op.nodes[1].x)/2,
 y:(op.nodes[0].y+op.nodes[1].y)/2,progress:0,goal:FIELD_TACTICS.relaySyncSeconds,
 hp:FIELD_TACTICS.relaySyncHp,done:false});
const fieldUplink=op=>({x:op.beacons[(op.correct+1)%3].x,
 y:op.beacons[(op.correct+1)%3].y,progress:0,goal:FIELD_TACTICS.beaconUplinkSeconds,
 hp:FIELD_TACTICS.beaconUplinkHp,done:false});
// The first painted objective is not an invisible prerequisite for entering a
// multi-site sortie. Use the same set of approachable sites for its cue and
// phase transition; only uncompleted sites can attract the pilot afterward.
export function fieldApproachSites(op){
 if(!isFieldOperation(op))return [];
 if(op.id==='line-break'||op.id==='sleeping-reactor')
  return op.nodes.filter(n=>!n.done&&n.hp!==0);
 if(op.id==='false-call')return op.beacons.filter(b=>!b.checked);
 if(op.id==='deep-resonance')return op.samples.filter(s=>!s.done);
 if(op.id==='two-fronts')return op.nodes.filter(n=>n.hp>0);
 return [op];
}
export function fieldApproachDistance(op,player){
 return Math.min(...fieldApproachSites(op).map(site=>distance(site,player)),Infinity);
}
export function convoyRaidPlan(op){
 const fast=op.routeChoice==='fast',tier=op.threatTier||0;
 // A safe detour brings fewer, weaker escorts despite its longer exposure.
 // The direct route has more interceptors and faster flanking craft.
 const marks=fast?[0,.29,.60]:[0,.48];
 if(tier>=1&&!fast)marks.push(.76);
 if(tier>=2&&fast)marks.push(.83);
 if(tier>=3&&!fast)marks.push(.88);
 return {marks,firstDelay:fast?4.5:7,interval:fast?3.2:4.5};
}
export function validFieldOperation(op){
 if(!isFieldOperation(op)||!['approach','active','return','salvage','failed'].includes(op.phase)||
  !Number.isFinite(op.x)||!Number.isFinite(op.y)||typeof op.baseId!=='string'||
  (op.threatTier!==undefined&&(!Number.isInteger(op.threatTier)||op.threatTier<0||op.threatTier>3)))return false;
 if(op.id==='deep-resonance')return Array.isArray(op.samples)&&op.samples.length===2&&
  op.samples.every(s=>typeof s.id==='string'&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&typeof s.done==='boolean')&&
  Number.isInteger(op.progress)&&op.progress>=0&&op.progress<=2&&Number.isFinite(op.resonance)&&
  op.resonance>=0&&op.resonance<=100&&
  (op.secondRaidSent===undefined||typeof op.secondRaidSent==='boolean');
 if(op.id==='reverse-hunt')return Number.isInteger(op.scans)&&op.scans>=0&&op.scans<=2&&
  Number.isFinite(op.scanAt)&&Number.isFinite(op.scanUntil)&&
  (op.scanStyle===undefined||Number.isInteger(op.scanStyle)&&op.scanStyle>=0&&op.scanStyle<=2)&&
  (op.scanHeading===undefined||Number.isFinite(op.scanHeading))&&
  (op.coverSent===undefined||typeof op.coverSent==='boolean');
 if(op.id==='false-call')return Array.isArray(op.beacons)&&op.beacons.length===3&&
  op.beacons.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&typeof b.checked==='boolean')&&
  Number.isInteger(op.correct)&&op.correct>=0&&op.correct<=2&&
  (op.decoding===undefined||typeof op.decoding==='boolean')&&
  (op.decodeProgress===undefined||Number.isFinite(op.decodeProgress)&&op.decodeProgress>=0&&
   op.decodeProgress<=FIELD_TACTICS.beaconDecodeSeconds)&&
  (!op.decoding||Number.isFinite(op.decodeProgress)&&op.beacons[op.correct].checked)&&
  (op.signalStage===undefined||['identify','uplink'].includes(op.signalStage))&&
  (!op.uplink||Number.isFinite(op.uplink.x)&&Number.isFinite(op.uplink.y)&&
   Number.isFinite(op.uplink.hp)&&op.uplink.hp>=0&&op.uplink.hp<=FIELD_TACTICS.beaconUplinkHp&&
   Number.isFinite(op.uplink.goal)&&op.uplink.goal>0&&
   Number.isFinite(op.uplink.progress)&&op.uplink.progress>=0&&
   op.uplink.progress<=op.uplink.goal&&typeof op.uplink.done==='boolean');
 if(op.id==='line-break'||op.id==='sleeping-reactor')return Array.isArray(op.nodes)&&
  op.nodes.length===2&&op.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&
   Number.isFinite(n.goal)&&n.goal>0&&Number.isFinite(n.progress)&&n.progress>=0&&n.progress<=n.goal&&
   (op.id!=='line-break'||Number.isFinite(n.hp)&&n.hp>=0&&n.hp<=100))&&
  (op.id!=='sleeping-reactor'||op.innerFirst===undefined||typeof op.innerFirst==='boolean')&&
  (op.id!=='sleeping-reactor'||op.cooled===undefined||typeof op.cooled==='boolean')&&
  (op.id!=='sleeping-reactor'||!op.coolant||Number.isFinite(op.coolant.x)&&
   Number.isFinite(op.coolant.y)&&Number.isFinite(op.coolant.goal)&&op.coolant.goal>0&&
   Number.isFinite(op.coolant.progress)&&op.coolant.progress>=0&&
   op.coolant.progress<=op.coolant.goal&&typeof op.coolant.done==='boolean')&&
  (op.id!=='line-break'||!op.link||Number.isFinite(op.link.x)&&Number.isFinite(op.link.y)&&
   Number.isFinite(op.link.hp)&&op.link.hp>=0&&op.link.hp<=FIELD_TACTICS.relaySyncHp&&
   Number.isFinite(op.link.progress)&&op.link.progress>=0&&
   Number.isFinite(op.link.goal)&&op.link.goal>0&&op.link.progress<=op.link.goal&&
   typeof op.link.done==='boolean');
 if(op.id==='broken-convoy')return Number.isFinite(op.hp)&&op.hp>=0&&op.hp<=100&&
  Array.isArray(op.route)&&op.route.length===3&&Number.isInteger(op.routeIndex)&&
  op.routeIndex>=0&&op.routeIndex<=2&&op.route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))&&
  (op.artHeading===undefined||Number.isFinite(op.artHeading))&&
  (op.fieldDestroyedAt===undefined||Number.isFinite(op.fieldDestroyedAt))&&
  (!op.crate||(Number.isFinite(op.crate.x)&&Number.isFinite(op.crate.y)&&
   Number.isFinite(op.crate.goal)&&op.crate.goal>0&&
   Number.isFinite(op.crate.progress)&&op.crate.progress>=0&&
   op.crate.progress<=op.crate.goal&&typeof op.crate.done==='boolean'))&&
  (!op.fieldRepair||
   (Number.isFinite(op.fieldRepair.progress)&&op.fieldRepair.progress>=0&&
    Number.isFinite(op.fieldRepair.goal)&&op.fieldRepair.goal>0&&
    op.fieldRepair.progress<=op.fieldRepair.goal&&typeof op.fieldRepair.used==='boolean'));
 return Array.isArray(op.nodes)&&op.nodes.length===2&&op.nodes.every(n=>
  Number.isFinite(n.x)&&Number.isFinite(n.y)&&Number.isFinite(n.hp)&&n.hp>=0&&n.hp<=100&&
  (n.fieldShield===undefined||Number.isFinite(n.fieldShield)&&n.fieldShield>=0&&
   n.fieldShield<=FIELD_TACTICS.shieldStrength))&&
  (op.shieldChargeUsed===undefined||typeof op.shieldChargeUsed==='boolean')&&
  (op.shieldTransferUsed===undefined||typeof op.shieldTransferUsed==='boolean')&&
  (op.intermissionActive===undefined||typeof op.intermissionActive==='boolean')&&
  (op.assaultPattern===undefined||Number.isInteger(op.assaultPattern)&&op.assaultPattern>=0&&op.assaultPattern<=2)&&
  Number.isInteger(op.wave)&&op.wave>=0&&op.wave<=(op.wavesTotal||2)&&
  [undefined,2,3].includes(op.wavesTotal)&&Array.isArray(op.enemySerials)&&
  op.enemySerials.length<=6;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const convoyRouteProgress=op=>{
 const [start,middle,end]=op.route;
 const first=distance(start,middle),second=distance(middle,end),total=first+second;
 if(total<=0)return 1;
 const traveled=op.routeIndex>=2?total:op.routeIndex>=1?
  first+Math.min(second,distance(middle,op)):Math.min(first,distance(start,op));
 return Math.min(1,Math.max(0,traveled/total));
};
const convoyHeading=op=>{
 if(Number.isFinite(op.artHeading))return op.artHeading;
 const index=Math.min(2,Math.max(1,op.routeIndex+1));
 const from=op.route[index-1],to=op.route[index];
 return Math.atan2(to.y-from.y,to.x-from.x);
};
function beginConvoySalvage(game,op,message){
 op.phase='salvage';op.artMoving=false;op.fieldDestroyedAt=game.time;
 const a=convoyHeading(op)+Math.PI/2;
 op.crate={x:op.x+Math.cos(a)*120,y:op.y+Math.sin(a)*120,
  goal:3.2,progress:0,done:false};
 game.heritage.vfx.nova(op.x,op.y,90,'red');
 game.heritage.play('largeExplosion',.28,{x:op.x,y:op.y});
 game.notice(message,5);
}
const validSite=(world,p,r=80)=>!world.nearbyRocks(p.x,p.y,r+70).some(rock=>
 rock.alive&&distance(rock,p)<rock.r+r)&&
 !world.nearbyStations(p.x,p.y,r+110,true).some(station=>distance(station,p)<r+95);
function siteNear(base,world,radius,heading){
 for(let i=0;i<16;i++){
  const a=heading+i*2.399963229728653;
  const p={x:base.x+Math.cos(a)*(radius+(i%3)*75),y:base.y+Math.sin(a)*(radius+(i%3)*75)};
  if(validSite(world,p))return p;
 }
 return {x:base.x+radius,y:base.y};
}
export function createFieldOperation(id,base,world,attempt=0,routeChoice='safe',pilotLevel=1,
 completedRuns=attempt){
 const spec=FIELD_OPERATIONS[id];
 if(!spec||!base?.active||base.enemy||base.type!==spec.station)return null;
 const bearing=(attempt*2.17+(base.x*0.002+base.y*0.0007))%(Math.PI*2);
 const site=siteNear(base,world,710,bearing);
 const threatTier=fieldThreatTier(pilotLevel,completedRuns);
 const common={...spec,baseId:base.id,x:site.x,y:site.y,phase:'approach',
  startedAt:0,attempt,partial:false,threatTier};
 if(id==='deep-resonance'){
  const rocks=world.nearbyRocks(site.x,site.y,1400)
   .filter(r=>r.alive&&r.rich&&distance(r,base)>250)
   .sort((a,b)=>distance(a,site)-distance(b,site));
  if(rocks.length<2)return null;
  const samples=rocks.slice(0,2).map(r=>({id:r.id,x:r.x,y:r.y,done:false}));
  return {...common,x:samples[0].x,y:samples[0].y,samples,progress:0,
   resonance:0,nextPulse:0,pulseUntil:0,alerted:false,secondRaidSent:false,nextGeologyCheck:0};
 }
 if(id==='reverse-hunt')return {...common,scans:0,scanAt:0,scanUntil:0,
  scanStyle:attempt%3,scanHeading:0,
  enemySerial:null,cycle:0,enemyDestroyed:false,coverSent:false};
 if(id==='line-break'){
  const a=siteNear(base,world,590,bearing+.3),b=siteNear(base,world,790,bearing+2.65);
  return {...common,x:a.x,y:a.y,nodes:[{...a,progress:0,goal:5,done:false,hp:100},
   {...b,progress:0,goal:6,done:false,hp:100}],progress:0,alarmAt:0,
   guardsSent:false,stage:'repair',linkThreatSent:false};
 }
 if(id==='false-call'){
  const beacons=[0,1,2].map(i=>({...siteNear(base,world,690,bearing+i*2.094),
   checked:false,progress:0,goal:1.6}));
  const signature=Math.sin((attempt+1)*12.9898+base.x*.015+base.y*.023)*100000;
  return {...common,x:beacons[0].x,y:beacons[0].y,beacons,
   correct:Math.abs(Math.trunc(signature))%3,checks:0,progress:0,
   decoding:false,decodeProgress:0,signalStage:'identify',uplinkThreatSent:false};
 }
 if(id==='sleeping-reactor'){
  const outer={x:site.x+275,y:site.y+75,progress:0,goal:3.3,done:false};
  const inner={x:site.x+84,y:site.y-42,progress:0,goal:5,done:false};
  return {...common,core:{...site},nodes:[outer,inner],progress:0,pulseAt:0,pulseUntil:0,
   innerFirst:false,cooled:false,coolant:{x:site.x-315,y:site.y+250,
    progress:0,goal:FIELD_TACTICS.reactorCoolSeconds,done:false}};
 }
 if(id==='broken-convoy'){
  const end=siteNear(base,world,1790,bearing+1.7);
  const perpendicular={x:-(end.y-site.y),y:end.x-site.x};
  const length=Math.hypot(perpendicular.x,perpendicular.y)||1;
  const detour=routeChoice==='fast'?70:620;
  const middle={x:(site.x+end.x)/2+perpendicular.x/length*detour,
   y:(site.y+end.y)/2+perpendicular.y/length*detour};
  return {...common,x:site.x,y:site.y,hp:100,maxHp:100,route:[site,middle,end],
   artHeading:Math.atan2(middle.y-site.y,middle.x-site.x),
   routeIndex:0,progress:0,cargo:2,crate:null,escortSerials:[],
   nextRaidAt:0,started:false,routeChoice,fieldRepair:{x:site.x,y:site.y,
    goal:FIELD_TACTICS.convoyRepairHold,progress:0,used:false}};
 }
 const first=siteNear(base,world,670,bearing+.65);
 const second=siteNear(base,world,700,bearing+3.1);
 return {...common,x:(first.x+second.x)/2,y:(first.y+second.y)/2,
  nodes:[{...first,hp:100,maxHp:100,fieldShield:0,goal:FIELD_TACTICS.shieldHold,
   progress:0,stabilized:false},
   {...second,hp:100,maxHp:100,fieldShield:0,goal:FIELD_TACTICS.shieldHold,
    progress:0,stabilized:false}],
  shieldChargeUsed:false,shieldTransferUsed:false,intermissionActive:false,
  assaultPattern:attempt%3,wave:0,wavesTotal:threatTier?3:2,nextWaveAt:0,
  enemySerials:[],warningShown:false};
}
export function fieldOperationOffer(base,op,now,id,pilotLevel=1){
 const spec=FIELD_OPERATIONS[id];if(!spec||base?.type!==spec.station||base.enemy)return null;
 const active=op?.id===id&&op.baseId===base.id;
 const completed=base.fieldOperationRuns?.[id]||0;
 const wait=Math.max(0,Math.ceil((base.fieldOperationCooldowns?.[id]||0)-now));
 const threatTier=active?(op.threatTier||0):fieldThreatTier(pilotLevel,
  base.fieldOperationFullRuns?.[id]??completed);
 const factor=fieldRewardFactor(threatTier)*(completed?.75:1);
 return {...spec,status:active?'active':!base.active?'locked':wait?'cooldown':'available',
  remaining:wait,runs:completed,threatTier,
  rewardOre:Math.round(spec.ore*factor),rewardData:Math.round(spec.data*factor),
  rewardPartialOre:Math.round(spec.partialOre*factor),rewardPartialData:Math.round(spec.partialData*factor),
  progress:active?(op.progress??op.scans??op.wave):0};
}
export function fieldOperationCue(op,game){
 if(!isFieldOperation(op))return '';
 if(op.phase==='salvage')return '◈ ТРАНСПОРТ ПОТЕРЯН · ЗАБЕРИТЕ УЦЕЛЕВШИЙ КОНТЕЙНЕР'+
  (op.crate?.progress>0?' · ИЗВЛЕЧЕНИЕ '+Math.round(op.crate.progress/op.crate.goal*100)+'%':'');
 if(op.phase==='failed')return '✕ ВЫЛАЗКА СОРВАНА · ВЕРНИТЕСЬ НА СТАНЦИЮ И ЗАКРОЙТЕ ЗАДАНИЕ';
 if(op.phase==='return')return '✓ '+op.name.toUpperCase()+' · ВЕРНИТЕСЬ НА СТАНЦИЮ';
 if(op.phase==='approach')return '◈ '+op.name.toUpperCase()+' · ДО ЦЕЛИ '+
  Math.round(fieldApproachDistance(op,game.player))+' М';
 const workCue=game.actionHeld?.kind==='field-work'?' · ОГОНЬ ПРИОСТАНОВЛЕН':'';
 if(op.id==='deep-resonance')return '◈ ОБРАЗЦЫ '+op.progress+'/2 · РЕЗОНАНС '+Math.round(op.resonance)+'%'+
  (op.pulseUntil>game.time?' · РАЗРЯД!':op.resonance>65?' · ПАТРУЛЬ СЛЫШИТ ДОБЫЧУ':'');
 if(op.id==='reverse-hunt'){
  const [min,max]=reverseHuntBand(op);
  return '◈ СКАНИРОВАНИЕ '+op.scans+'/2 · ДИСТАНЦИЯ '+min+'–'+max+' М'+
   (op.scanUntil>game.time?' · ИМПУЛЬС!':'')+
   (op.scans===1&&op.scanStyle?' · ВОЙДИТЕ В СВЕТЯЩИЙСЯ СЕКТОР':'');
 }
 if(op.id==='line-break')return op.stage==='sync'?
  '◈ СИНХРОНИЗАЦИЯ ЛИНИИ · '+Math.round((op.link?.progress||0)/(op.link?.goal||1)*100)+
  '% · УЗЕЛ '+Math.ceil(op.link?.hp||0)+'% · '+
  (op.linkThreatSent?'ПЕРЕХВАТЧИК МЕШАЕТ СВЯЗИ':'ПОДОЙДИТЕ К УЗЛУ СОПРЯЖЕНИЯ')+workCue:
  '◈ ЛИНИЯ СВЯЗИ '+op.progress+'/2 · УЗЛЫ '+
  op.nodes.map(n=>Math.round(n.hp)+'%').join(' / ')+' · ЗАЩИТИТЕ РЕМОНТ'+workCue;
 if(op.id==='false-call')return op.decoding?
  '◈ ПЕРЕХВАТ СИГНАЛА · '+Math.round((op.decodeProgress||0)/FIELD_TACTICS.beaconDecodeSeconds*100)+
  '% · ДЕРЖИТЕСЬ В '+FIELD_TACTICS.beaconDecodeRadius+' М ОТ МАЯКА':
  op.signalStage==='uplink'?
   '◈ ОТВЕТНЫЙ УЗЕЛ · ЗАПИСЬ '+Math.round((op.uplink?.progress||0)/(op.uplink?.goal||1)*100)+
   '% · ПРОЧНОСТЬ '+Math.ceil(op.uplink?.hp||0)+'% · ЗАЩИТИТЕ ПЕРЕДАТЧИК'+workCue:
  '◈ МАЯКИ · ПРОВЕРЕНО '+op.checks+'/3 · ИЩИТЕ ДВОЙНОЙ ИМПУЛЬС'+workCue;
 if(op.id==='sleeping-reactor')return '◈ КАССЕТЫ '+op.progress+'/2'+
  (op.pulseUntil>game.time?' · ВЫБРОС!':op.cooled?' · ОХЛАЖДЕНИЕ ВКЛЮЧЕНО':
   op.innerFirst?' · УСКОРЕННЫЙ ЦИКЛ':' · СЛЕДИТЕ ЗА ЯДРОМ')+
  (op.progress===1&&!op.cooled?' · КЛАПАН ДОСТУПЕН':'')+workCue;
 if(op.id==='broken-convoy')return '◈ КОНВОЙ · КОРПУС '+Math.ceil(op.hp)+'% · '+
  (op.routeIndex===2?'ПУНКТ НАЗНАЧЕНИЯ':op.fieldRepair?.used?'РЕМОНТ ИЗРАСХОДОВАН':
   op.hp<=78?(game.player?.ore!==undefined&&game.player.ore<FIELD_TACTICS.convoyRepairCost?
    'НЕДОСТАТОЧНО СПЛАВА · ДЛЯ РЕМОНТА НУЖНО 6':'РЕМОНТ У ТРАНСПОРТА · 6 СПЛАВА'):
   'ДЕРЖИТЕСЬ РЯДОМ')+
  (game.actionHeld?.target===op.fieldRepair&&!op.fieldRepair?.used?
   ' · РЕМОНТ '+Math.round((op.fieldRepair?.progress||0)/(op.fieldRepair?.goal||4)*100)+'%':'')+workCue;
 const hp=op.nodes.map(n=>Math.ceil(n.hp/n.maxHp*100)+'%'+
  (n.fieldShield>0?' · ЩИТ '+Math.ceil(n.fieldShield):'')).join(' / ');
 const preparing=op.nodes.find(n=>!n.stabilized&&n.progress>0);
 const next=twoFrontsWaveTargets(op);
 const nextThreat=op.wave<(op.wavesTotal||2)&&op.nextWaveAt>game.time&&
  Number.isFinite(op.nextWaveAt)?' · СЛЕДУЮЩАЯ АТАКА: '+
   (next[0]===next[1]?'ДВА КОРАБЛЯ → УЗЕЛ '+(next[0]+1):'ОБА УЗЛА'):'';
 const transferable=op.intermissionActive&&op.shieldChargeUsed&&!op.shieldTransferUsed&&
  twoFrontsTransferSource(op);
 return '◈ ДВА УЗЛА '+hp+' · РЕЗЕРВНЫЙ ЩИТ '+(op.shieldChargeUsed?'0':'1')+'/1 · ВОЛНА '+op.wave+'/'+(op.wavesTotal||2)+' · '+
  (op.nextWaveAt>game.time&&Number.isFinite(op.nextWaveAt)?
   'АТАКА ЧЕРЕЗ '+Math.ceil(op.nextWaveAt-game.time)+' С':'ПЕРЕХВАТИТЕ НАЛЁТЧИКОВ')+
   (preparing?' · ЗАРЯД '+Math.round(preparing.progress/(preparing.goal||FIELD_TACTICS.shieldHold)*100)+'%':'')+
   nextThreat+(transferable?' · ПЕРЕНОС ЩИТА: 4 СПЛАВА':'')+workCue;
}
export function fieldOperationMining(op,rock,kind){
 if(op?.id!=='deep-resonance'||op.phase!=='active'||kind!=='extract')return false;
 const sample=op.samples.find(s=>s.id===rock.id&&!s.done);
 if(!sample)return false;
 sample.done=true;op.progress++;
 // Even a powerful extractor must reveal the first find. Otherwise two
 // instant kills of mineral rocks would complete the entire sortie quietly.
 op.resonance=op.progress===1?Math.max(60,Math.min(100,op.resonance+27)):
  Math.min(100,op.resonance+27);
 const next=op.samples.find(s=>!s.done);
 if(next){op.x=next.x;op.y=next.y;}else op.phase='return';
 return true;
}
export function fieldOperationInteraction(op,player){
 if(!isFieldOperation(op)||!['active','salvage'].includes(op.phase))return null;
 if(op.id==='false-call'&&op.decoding)return null;
 if(op.id==='false-call'&&op.signalStage==='uplink'){
  const uplink=op.uplink;
  return uplink&&!uplink.done&&uplink.hp>0&&distance(uplink,player)<=125?
   {kind:'field-work',target:uplink,label:'Закрепить запись',hold:true}:null;
 }
 if(op.id==='line-break'&&op.stage==='sync'){
  const link=op.link;
  return link&&!link.done&&link.hp>0&&distance(link,player)<=125?
   {kind:'field-work',target:link,label:'Синхронизировать узлы',hold:true}:null;
 }
 if(op.id==='sleeping-reactor'&&op.progress===1&&!op.cooled&&op.coolant&&
  distance(op.coolant,player)<=125)
  return {kind:'field-work',target:op.coolant,label:'Охладить реактор',hold:true};
 if(op.id==='two-fronts'&&!op.shieldChargeUsed){
  const node=op.nodes.find(n=>n.hp>0&&!n.stabilized&&distance(n,player)<=125);
  if(node){node.goal??=FIELD_TACTICS.shieldHold;node.progress??=0;
   return {kind:'field-work',target:node,label:'Зарядить щит',hold:true};}
 }
 if(op.id==='two-fronts'&&op.intermissionActive&&op.shieldChargeUsed&&
  !op.shieldTransferUsed&&player.ore>=FIELD_TACTICS.shieldTransferCost){
  const donor=twoFrontsTransferSource(op);
  const receiver=op.nodes.find(n=>n!==donor&&n.hp>0&&distance(n,player)<=125);
  if(donor&&receiver){receiver.goal=FIELD_TACTICS.shieldTransferHold;
   receiver.progress??=0;
   return {kind:'field-work',target:receiver,label:'Перенести щит · 4 сплава',hold:true};}
 }
 if(op.id==='broken-convoy'&&op.phase==='active'&&op.hp>0&&op.hp<=78&&
  player.ore>=FIELD_TACTICS.convoyRepairCost){
  op.fieldRepair??={x:op.x,y:op.y,progress:0,goal:FIELD_TACTICS.convoyRepairHold,used:false};
  op.fieldRepair.x=op.x;op.fieldRepair.y=op.y;
  if(!op.fieldRepair.used&&distance(op,player)<=125)
   return {kind:'field-work',target:op.fieldRepair,label:'Починить конвой · 6 сплава',hold:true};
 }
 const targets=op.id==='false-call'?op.beacons.filter(b=>!b.checked):
  op.id==='line-break'?op.nodes.filter(n=>!n.done&&n.hp>0):
  op.id==='sleeping-reactor'?op.nodes.filter(n=>!n.done):
  op.id==='broken-convoy'&&op.crate&&!op.crate.done?[op.crate]:[];
 const close=targets.filter(t=>distance(t,player)<=125)
  .sort((a,b)=>distance(a,player)-distance(b,player))[0];
 return close?{kind:'field-work',target:close,label:op.id==='false-call'?'Проверка маяка':
  op.id==='broken-convoy'?'Спасти контейнер':op.id==='line-break'?'Ремонт узла':'Извлечение',hold:true}:null;
}
function advanceFieldWork(game,op,dt){
 const held=game.actionHeld;
 if(held?.kind!=='field-work'||distance(game.player,held.target)>125)return;
 const target=held.target;
 const valid=op.id==='false-call'&&op.signalStage==='uplink'?
  op.uplink===target&&!target.done&&target.hp>0:
  op.id==='false-call'?op.beacons.includes(target)&&!target.checked:
  op.id==='line-break'&&op.stage==='sync'?op.link===target&&!target.done&&target.hp>0:
  op.id==='line-break'?op.nodes.includes(target)&&!target.done&&target.hp>0:
  op.id==='sleeping-reactor'&&op.coolant===target?op.progress===1&&!op.cooled&&!target.done:
  op.id==='sleeping-reactor'?op.nodes.includes(target)&&!target.done:
  op.id==='two-fronts'?op.nodes.includes(target)&&target.hp>0&&
   (!op.shieldChargeUsed||op.intermissionActive&&!op.shieldTransferUsed&&
    target!==twoFrontsTransferSource(op)&&twoFrontsTransferSource(op)&&
    game.player.ore>=FIELD_TACTICS.shieldTransferCost):
  op.id==='broken-convoy'&&op.phase==='active'?op.fieldRepair===target&&!target.used&&op.hp>0:
  op.id==='broken-convoy'?op.crate===target&&!target.done:false;
 if(!valid)return;
 if(game.time-(op.lastWorkCueAt??-Infinity)>=1.1){
  op.lastWorkCueAt=game.time;
  game.heritage.play('fieldWork',.9,{x:target.x,y:target.y});
 }
 const pressured=(op.id==='false-call'&&op.signalStage==='uplink'||
  op.id==='line-break'&&op.stage==='sync')&&game.enemies.some(e=>
   e.fieldOperation===op.id&&e.hp>0&&!e.converted&&e.target===target);
 target.progress=Math.min(target.goal,target.progress+dt*(pressured?.55:1));
 if(target.progress<target.goal)return;
 if(op.id==='line-break'&&op.stage==='sync'){
  target.done=true;op.phase='return';op.partial=false;
  game.heritage.play('fieldLinkSync',.25,{x:target.x,y:target.y});
  game.heritage.vfx.nova(target.x,target.y,105,'cyan');
  game.notice('Оба узла работают как единая линия. Вернитесь в док и передайте результат.',5);
 }else if(op.id==='false-call'&&op.signalStage==='uplink'){
  target.done=true;op.phase='return';
  game.heritage.play('fieldUplinkReady',.25,{x:target.x,y:target.y});
  game.heritage.vfx.nova(target.x,target.y,88,'violet');
  game.notice('Ответный маршрут перехвачен и запись сохранена. Возвращайтесь в лабораторию.',5);
 }else if(op.id==='sleeping-reactor'&&target===op.coolant){
  target.done=true;op.cooled=true;
  op.pulseAt=Math.max(op.pulseAt,game.time+6);
  game.heritage.play('fieldReactorCool',.25,{x:target.x,y:target.y});
  game.heritage.vfx.nova(target.x,target.y,80,'cyan');
  game.notice('Клапан охлаждения открыт. Разряды станут реже. Вернитесь к оставшейся кассете.',4.5);
 }else if(op.id==='two-fronts'){
  if(op.shieldChargeUsed){
   const donor=twoFrontsTransferSource(op);
   if(!donor||game.player.ore<FIELD_TACTICS.shieldTransferCost){target.progress=0;return;}
   const remaining=donor.fieldShield;
   donor.fieldShield=0;donor.stabilized=false;
   target.fieldShield=Math.min(FIELD_TACTICS.shieldStrength,remaining);
   target.stabilized=true;target.fieldPoweredAt=game.time;
   op.shieldTransferUsed=true;
   game.player.ore-=FIELD_TACTICS.shieldTransferCost;
   recordEconomyExpense(game,'repairs',FIELD_TACTICS.shieldTransferCost);
   game.heritage.play('fieldShieldUp',.2,{x:target.x,y:target.y});
   game.heritage.vfx.nova(donor.x,donor.y,55,'cyan');
   game.heritage.vfx.nova(target.x,target.y,70,'cyan');
   game.notice('Остаток барьера перенесён на другой узел. Первый остался без щита; ещё один перенос невозможен.',5);
  }else{
   target.stabilized=true;target.fieldShield=FIELD_TACTICS.shieldStrength;
   target.fieldPoweredAt=game.time;
   op.shieldChargeUsed=true;
   game.heritage.play('fieldShieldUp',.2,{x:target.x,y:target.y});
   game.heritage.vfx.nova(target.x,target.y,70,'cyan');
   game.notice('Резервный щит заряжен на одном узле. Второй остаётся без дополнительной защиты.',4.5);
  }
 }else if(op.id==='broken-convoy'&&op.phase==='active'){
  if(game.player.ore<FIELD_TACTICS.convoyRepairCost){target.progress=0;
   game.notice('Для аварийного ремонта не хватает 6 сплава.',3);}
  else{game.player.ore-=FIELD_TACTICS.convoyRepairCost;
   recordEconomyExpense(game,'repairs',FIELD_TACTICS.convoyRepairCost);
   op.hp=Math.min(100,op.hp+FIELD_TACTICS.convoyRepairStrength);target.used=true;
   op.fieldRepairedAt=game.time;
   game.heritage.play('fieldConvoyRepair',.2,{x:op.x,y:op.y});
   game.heritage.vfx.nova(op.x,op.y,80,'cyan');
   game.notice('Транспорт восстановил 35% корпуса. Ремонтный комплект израсходован. Продолжайте сопровождение.',5);}
 }else if(op.id==='false-call'){
  target.checked=true;op.checks++;
  const index=op.beacons.indexOf(target);
  if(index===op.correct){op.decoding=true;op.decodeProgress=0;op.partial=op.checks>1;
   op.x=target.x;op.y=target.y;
   game.heritage.play('fieldBeaconOk',.2,{x:target.x,y:target.y});
   game.heritage.vfx.nova(target.x,target.y,44,'violet');
   const hunter=spawnFieldEnemy(game,op,(op.threatTier||0)>=2?'flanker':
    (op.threatTier||0)>=1?'fighter':'scout',target);
   if(hunter)game.heritage.play('fieldRaid',.2,{x:hunter.x,y:hunter.y});
   game.notice('Поддельный маяк найден. Оставайтесь в 240 м от него для перехвата ответа. '+
    'Вражеский корабль пытается сорвать связь.',5);
  }else{
   game.heritage.play('fieldBeaconAlarm',.2,{x:target.x,y:target.y});
   game.heritage.vfx.nova(target.x,target.y,53,'red');
   spawnFieldEnemy(game,op,'scout',target);
   game.notice('Неверный позывной! Перехватчики получили сигнал тревоги. Сравните оставшиеся импульсы.',4);
   const next=op.beacons.find(b=>!b.checked);if(next){op.x=next.x;op.y=next.y;}
  }
 }else if(op.id==='broken-convoy'){
  target.done=true;op.partial=true;op.phase='return';
  game.heritage.play('fieldSalvage',.2,{x:target.x,y:target.y});
  game.heritage.vfx.nova(target.x,target.y,42,'gold');
  game.notice('Уцелевший контейнер спасён. Вернитесь на авианосец за частичной наградой.',5);
 }else{
  target.done=true;op.progress++;
  if(op.id==='sleeping-reactor')target.extractedAt=game.time;
  game.heritage.play(op.id==='line-break'?'fieldRelayRepair':'fieldCassette',.2,
   {x:target.x,y:target.y});
  game.heritage.vfx.nova(target.x,target.y,op.id==='line-break'?47:32,
   op.id==='line-break'?'cyan':'gold');
  if(op.id==='line-break'&&op.progress===1){
   op.guardsSent=true;
   const unserviced=op.nodes.find(n=>!n.done&&n.hp>0);
   if(unserviced){
    spawnFieldEnemy(game,op,'fighter',unserviced);
    spawnFieldEnemy(game,op,'flanker',unserviced,unserviced,1);
   }
   game.notice('Один узел восстановлен. Противник атакует оставшийся: перехватите его. Можно отступить с частичной наградой.',5);
  }
   if(op.progress>=2){
    if(op.id==='line-break'){
     op.stage='sync';op.link??=fieldLink(op);
     op.x=op.link.x;op.y=op.link.y;
     for(const enemy of game.enemies)if(enemy.fieldOperation===op.id&&enemy.hp>0&&
      enemy.missionStrike){delete enemy.missionStrike;delete enemy.missionFlight;
      enemy.target=game.player;enemy.state='hunt';}
     game.heritage.play('fieldLinkSync',.3,{x:op.link.x,y:op.link.y});
     game.notice('Оба узла отремонтированы. Сойдитесь в промежуточном пункте, чтобы закрепить соединение. Противник ещё может сорвать передачу.',6);
    }else{op.phase='return';
     game.notice('Обе кассеты извлечены. Уходите из опасной зоны к арсеналу.',5);}
  }else{
   const next=op.nodes.find(n=>!n.done);op.x=next.x;op.y=next.y;
   if(op.id==='sleeping-reactor'){
    if(target===op.nodes[1]){
     op.innerFirst=true;
     op.pulseAt=Math.min(op.pulseAt,game.time+.25);
     game.notice('Вы начали с внутренней кассеты. Реактор ускоряет разряды! '+
      'Внешняя находится за пределами опасного кольца.',4.5);
    }else game.notice('Внешняя кассета извлечена. Внутренняя находится ближе к опасному реактору.',4.5);
   }
  }
 }
 // A held action must be released before attempting another target.
 game.actionHeld=null;
}
export function spawnFieldEnemy(game,op,type,location,target=null,index=0){
 if(game.enemies.length>=RULES.maxEnemies)return null;
 const def=ENEMY_TYPES[type];if(!def)return null;
 const heading=index*2.4+.3;
 const x=location.x+Math.cos(heading)*260,y=location.y+Math.sin(heading)*260;
 const hp=Math.round(def.hp*(1+.27*(op.threatTier||0)));
 const enemy={serial:++game.enemySerial,group:++game.groupSerial,type,x,y,vx:0,vy:0,
  r:type==='gunship'?22:14,hp,maxHp:hp,damage:Math.round(def.dmg*(1+.12*(op.threatTier||0))),
  think:.1,fire:1.2,state:'hunt',commitUntil:0,target:target||game.player,
  angle:0,hit:0,expAwarded:true,scenario:'field-'+op.id,fieldOperation:op.id,
  operationGuard:true,protect:null,entryPortalPending:false};
 if(target)game.prepareMissionStrike(enemy,target,{target:op.id==='broken-convoy'?'field-convoy':'field-node',range:380,
  damage:Math.round((type==='flanker'?17:14)*(1+.12*(op.threatTier||0))),
  charge:type==='flanker'?2.8:3.4,angle:heading});
 if(op.id==='broken-convoy'&&target){
  enemy.escortApproachAngle=Math.atan2(y-target.y,x-target.x);
 }
 game.enemies.push(enemy);return enemy;
}
function releaseFieldReturnThreats(game,op){
 if(op.returnThreatsReleased)return;
 op.returnThreatsReleased=true;
 let pursuers=0;
 for(const enemy of game.enemies){
  if(enemy.fieldOperation!==op.id||enemy.hp<=0||enemy.converted||!enemy.missionFlight)continue;
  // A surviving raider can now chase the pilot rather than continuing to
  // aim at an objective that has ceased to update after mission completion.
  delete enemy.missionFlight;delete enemy.missionStrike;
  enemy.relayChargeUntil=0;enemy.target=game.player;enemy.state='hunt';
  pursuers++;
 }
 if(pursuers)game.notice('Задание выполнено, но уцелевшие налётчики преследуют вас. Возвращайтесь на станцию.',4);
}
export function advanceFieldOperation(game,dt){
 const op=game.operation;if(!isFieldOperation(op)||game.dead)return;
 // Missions saved by a previous build can continue with their newly added
 // final phase. Do not invalidate or discard the pilot's existing sortie.
 if(op.id==='line-break'){op.stage??='repair';op.link??=fieldLink(op);}
 if(op.id==='false-call'){
  op.signalStage??='identify';op.uplink??=fieldUplink(op);
 }
 if(op.id==='sleeping-reactor'){
  op.cooled??=false;
  op.coolant??={x:(op.core||op).x-315,y:(op.core||op).y+250,
   progress:0,goal:FIELD_TACTICS.reactorCoolSeconds,done:false};
 }
 if(op.phase==='return'){releaseFieldReturnThreats(game,op);return;}
 if(op.phase==='failed')return;
 if(op.phase==='approach'){
  if(fieldApproachDistance(op,game.player)>420)return;
  op.phase='active';op.startedAt=game.time;
  if(op.id==='reverse-hunt'){
   const enemy=spawnFieldEnemy(game,op,'scout',op);
   if(enemy){enemy.hp=enemy.maxHp=Math.round(165*(1+.2*(op.threatTier||0)));op.enemySerial=enemy.serial;
    op.scanAt=game.time+5.5;}
   else {op.phase='approach';return;}
   const [min,max]=reverseHuntBand(op);
   game.notice('Зрачок обнаружен. Сначала наблюдайте его с дистанции '+min+'–'+max+
    ' м. Для второго импульса потребуется другая позиция. Автоогонь можно отключить.',5);
  }else if(op.id==='two-fronts'){
   op.nextWaveAt=game.time+6;
   game.notice('Два узла под угрозой! Изучите метки первой атаки и зарядите щит нужного узла удержанием действия. Во время зарядки орудия молчат.',5);
  }else if(op.id==='sleeping-reactor'){
   op.pulseAt=game.time+7;
   game.notice('Реактор просыпается. Внешняя кассета безопаснее; внутренняя первой ускорит выбросы. Следите за ядром.',5);
  }else if(op.id==='broken-convoy'){
   op.started=true;op.nextRaidAt=game.time+convoyRaidPlan(op).firstDelay;
   game.notice('Транспорт начал рейс. Держитесь ближе 500 м. Если корпус упадёт ниже 78%, можно разово остановить и починить его за 6 сплава.',5);
  }else if(op.id==='false-call'){
   game.notice('У фальшивого маяка двойной фиолетовый импульс. Наблюдайте сигналы перед проверкой.',5);
  }else if(op.id==='line-break'){
   game.notice('Удерживайте действие у повреждённого узла. После первого ремонта можно отступить.',4.5);
  }else game.notice('Две залежи отмечены на карте. Образцы даёт только удерживаемая добыча: раскалывающий удар испортит образец и усилит резонанс.',5);
 }
 advanceFieldWork(game,op,dt);
 if(op.phase==='return'){releaseFieldReturnThreats(game,op);return;}
 if(op.id==='line-break'){
  if(op.stage==='sync'){
   if(op.link.hp<=0){op.phase='return';op.partial=true;
    game.notice('Промежуточный узел уничтожен. Ремонт сохранился, но линию не удалось связать. Вернитесь за частичной наградой.',5);
    return;}
   if(!op.linkThreatSent&&distance(game.player,op.link)<420){
    const raider=spawnFieldEnemy(game,op,(op.threatTier||0)>=2?'fighter':'scout',
     op.link,op.link,2);
    if(raider){op.linkThreatSent=true;
     game.heritage.play('fieldRaid',.2,{x:raider.x,y:raider.y});
     game.notice('Перехватчик атакует узел сопряжения. Можно прервать синхронизацию и сбить его до залпа.',4.5);}
   }
   for(const enemy of game.enemies)if(enemy.fieldOperation===op.id&&enemy.hp>0&&
    !enemy.converted&&enemy.missionStrike&&enemy.target===op.link)
    game.updateMissionStrike(enemy,op.link);
   return;
  }
  const unserviced=op.nodes.find(n=>!n.done);
  if(unserviced?.hp<=0){
   op.partial=op.progress>0;op.phase=op.partial?'return':'failed';
   game.notice(op.partial?'Неотремонтированный узел уничтожен! Возвращайтесь с результатом первого ремонта.':
    'Оборудование потеряно, ремонт сорван.',5);
   return;
  }
  for(const enemy of game.enemies){
   if(enemy.fieldOperation!==op.id||!enemy.missionStrike||enemy.hp<=0||enemy.converted)continue;
   if(unserviced)game.updateMissionStrike(enemy,unserviced);
  }
 }else if(op.id==='deep-resonance'){
  if(game.time>=(op.nextGeologyCheck||0)){
   op.nextGeologyCheck=game.time+.5;
   for(const sample of op.samples){
    if(sample.done)continue;
    const original=game.world.nearbyRocks(sample.x,sample.y,60).find(r=>r.id===sample.id&&r.alive);
    if(original)continue;
    const substitute=game.world.nearbyRocks(op.x,op.y,1050).filter(r=>r.alive&&r.rich&&
     !op.samples.some(s=>s.id===r.id));
    if(substitute.length){
     const next=substitute.sort((a,b)=>distance(a,op)-distance(b,op))[0];
     sample.id=next.id;sample.x=next.x;sample.y=next.y;
     op.x=next.x;op.y=next.y;
     game.notice('Залежь разрушена до взятия образца. Сканер отметил запасную точку.',4);
    }else{
     op.partial=op.progress>0;op.phase=op.progress>0?'return':'failed';
     game.notice('Месторождение разрушено. '+(op.partial?'Возвращайтесь с добытым образцом.':'Добыть образцы не удалось.'),4);
     return;
    }
   }
  }
  const miningSample=op.samples.find(s=>!s.done&&game.mining?.target?.id===s.id);
  if(miningSample&&game.mining.active){op.resonance=Math.min(100,op.resonance+dt*(13+3*(op.threatTier||0)+Math.min(12,game.miningNoise/14)));}
  else op.resonance=Math.max(0,op.resonance-dt*5);
  if(op.resonance>=58&&!op.alerted){
   const enemy=spawnFieldEnemy(game,op,'flanker',miningSample||op);
   if(enemy){op.alerted=true;
    game.heritage.play('fieldRaid',.2,{x:enemy.x,y:enemy.y});
    game.notice('Резонанс заметили перехватчики! Продолжайте добычу или отступайте.',4);}
  }
  // Quietly waiting lowers resonance and can prevent the second interception;
  // rushing the second sample creates a different, finite combat problem.
  if(op.progress===1&&miningSample&&op.resonance>=76&&!op.secondRaidSent){
   const hunter=spawnFieldEnemy(game,op,(op.threatTier||0)>=2?'flanker':
    (op.threatTier||0)>=1?'fighter':'scout',miningSample);
   if(hunter){op.secondRaidSent=true;
    game.heritage.play('fieldRaid',.2,{x:hunter.x,y:hunter.y});
    game.notice('ВТОРОЙ ПЕРЕХВАТ! Резонанс выдал положение новой залежи. '+
     'Прервите добычу или успейте забрать образец.',4.5);}
  }
  if(op.resonance>=90&&game.time>=op.nextPulse){
   op.nextPulse=game.time+5;op.pulseUntil=game.time+1.5;
   game.heritage.play('fieldReactorCharge',.2,{x:op.x,y:op.y});
   game.notice('КРИТИЧЕСКИЙ РЕЗОНАНС: отойдите от залежи!',2.5);
  }
  if(op.pulseUntil>0&&game.time>=op.pulseUntil){
   op.pulseUntil=0;
   const source=op.samples.find(s=>!s.done)||op;
   op.lastPulseAt=game.time;
   // The expanding discharge stays at the emitting deposit even if the
   // next sample becomes active before the painted flash has faded.
   op.lastPulseX=source.x;op.lastPulseY=source.y;
   game.heritage.vfx.nova(source.x,source.y,160,'violet');
   game.heritage.play('fieldPulse',.2,{x:source.x,y:source.y});
   if(distance(game.player,source)<165)game.hurt(12,source);
   op.resonance=38;
  }
 }else if(op.id==='reverse-hunt'){
  const enemy=game.enemies.find(e=>e.serial===op.enemySerial&&e.hp>0&&!e.converted);
  if(!enemy){op.enemyDestroyed=true;op.partial=op.scans<2;op.phase='return';
   game.notice(op.partial?'Зрачок уничтожен. Доставьте обломки — данные сканирования неполные.':
    'Сканер уничтожен, данные собраны. Возвращайтесь в лабораторию.',4);return;}
  op.x=enemy.x;op.y=enemy.y;
  if(game.time>=op.scanAt&&op.scanUntil<=game.time){
   op.scanUntil=game.time+1.6;op.scanAt=game.time+7.4;op.cycle++;
   if(op.scans===1&&op.scanStyle){
    const angle=Math.atan2(game.player.y-enemy.y,game.player.x-enemy.x);
    // The sector is frozen when the petals open: the pilot can deliberately
    // move into it instead of chasing an invisible rotating hitbox.
    op.scanHeading=angle+(op.scanStyle===2?1.04:-.38);
   }
   // Drive the already-painted I.R.I.S. antenna animation from this mission's
   // scan window; its autonomous predator logic keeps its own clock.
   enemy._missionScanStarted=game.time;enemy._missionScanUntil=op.scanUntil;
   game.heritage.play('fieldScan',.2,{x:enemy.x,y:enemy.y});
   const [min,max]=reverseHuntBand(op);
   game.notice('ЗРАЧОК РАСКРЫВАЕТ СКАНЕР! Дистанция '+min+'–'+max+' м.'+
    (op.scans===1&&op.scanStyle?' Для записи войдите в видимый сектор импульса.':''),3.3);
  }
  if(op.scanUntil>0&&game.time>=op.scanUntil){
   op.scanUntil=0;
   op.lastScanAt=game.time;
   op.lastScanDirectional=op.scans===1&&!!op.scanStyle;
   op.lastScanHeading=op.scanHeading;
   [op.lastScanInner,op.lastScanOuter]=reverseHuntBand(op);
   // A released wave is a world-space event, not a decal attached to
   // the scout's later movement.
   op.lastScanX=enemy.x;op.lastScanY=enemy.y;
   game.heritage.play('fieldPulse',.3,{x:enemy.x,y:enemy.y});
   const d=distance(enemy,game.player);
   game.heritage.vfx.nova(enemy.x,enemy.y,op.lastScanDirectional?45:315,'violet');
   const [inner,outer]=reverseHuntBand(op);
   const inSector=reverseHuntInSector(op,enemy,game.player);
   if(d<inner&&inSector)game.hurt(13,enemy);
   else if(d>=inner&&d<=outer&&inSector){op.scans=Math.min(2,op.scans+1);
    game.heritage.play('fieldScanCaptured',.3,{x:enemy.x,y:enemy.y});
    game.notice('Спектр получен: '+op.scans+'/2.'+(op.scans===2?
     ' Данных достаточно, можно возвращаться.':op.scanStyle?
     ' Второй импульс будет направленным: следите за светящимся сектором и нужной дистанцией.':
      ' Второй импульс: держитесь в 170–270 м.'),4);
    if(op.scans===1&&(op.threatTier||0)>=2&&!op.coverSent){
     const cover=spawnFieldEnemy(game,op,'fighter',enemy);
     if(cover){op.coverSent=true;
      game.heritage.play('fieldRaid',.2,{x:cover.x,y:cover.y});
      game.notice('Зрачок вызвал прикрытие. Второй спектр придётся получить под огнём.',4.5);}
    }
   }else if(!inSector&&op.scans===1){
    game.heritage.play('fieldScanMiss',.2,{x:enemy.x,y:enemy.y});
    game.notice('Направленный импульс прошёл мимо: спектр не записан. Следите за сектором следующего сканирования.',3.5);
   }
   if(op.scans===2){op.phase='return';op.partial=false;}
  }
 }else if(op.id==='false-call'){
  if(op.decoding){
   const beacon=op.beacons[op.correct];
   if(distance(game.player,beacon)<=FIELD_TACTICS.beaconDecodeRadius)
    op.decodeProgress=Math.min(FIELD_TACTICS.beaconDecodeSeconds,(op.decodeProgress||0)+dt);
   const hostile=game.enemies.some(e=>e.fieldOperation===op.id&&e.hp>0&&!e.converted);
   if(op.decodeProgress>=FIELD_TACTICS.beaconDecodeSeconds||
     op.decodeProgress>=1.8&&!hostile){
    op.decoding=false;op.signalStage='uplink';op.uplink??=fieldUplink(op);
    op.x=op.uplink.x;op.y=op.uplink.y;
    game.heritage.play('fieldScanCaptured',.3,{x:beacon.x,y:beacon.y});
    game.heritage.vfx.nova(beacon.x,beacon.y,75,'violet');
    game.heritage.play('fieldUplinkStart',.4,{x:op.uplink.x,y:op.uplink.y});
    game.notice('Ответный позывной принят, но запись неполная: сигнал перешёл на другой маяк. Доберитесь до отмеченного узла и закрепите данные под охраной.',6);
   }
  }
  if(op.signalStage==='uplink'){
   if(op.uplink.hp<=0){op.phase='return';op.partial=true;
    game.notice('Ответный узел уничтожен. Сохранилась лишь часть перехвата. Вернитесь в лабораторию.',5);
    return;}
   if(!op.uplinkThreatSent&&distance(game.player,op.uplink)<440){
    const raider=spawnFieldEnemy(game,op,(op.threatTier||0)>=2?'flanker':'fighter',
     op.uplink,op.uplink,2);
    if(raider){op.uplinkThreatSent=true;
     game.heritage.play('fieldRaid',.2,{x:raider.x,y:raider.y});
     game.notice('Ответный маяк под атакой! Защитите его, затем удерживайте действие у передатчика.',5);}
   }
   for(const enemy of game.enemies)if(enemy.fieldOperation===op.id&&enemy.hp>0&&
    !enemy.converted&&enemy.missionStrike&&enemy.target===op.uplink)
    game.updateMissionStrike(enemy,op.uplink);
  }
 }else if(op.id==='two-fronts'){
  if(op.nodes.every(n=>n.hp<=0)){op.partial=false;op.phase='failed';return;}
  if(op.phase==='failed')return;
  const wavesTotal=op.wavesTotal||2;
  if(game.time>=op.nextWaveAt&&op.wave<wavesTotal&&game.enemies.length>RULES.maxEnemies-2)return;
  if(game.time>=op.nextWaveAt&&op.wave<wavesTotal){
   if(op.intermissionActive&&game.actionHeld?.kind==='field-work'&&
    op.nodes.includes(game.actionHeld.target))game.actionHeld=null;
   op.intermissionActive=false;
   const types=op.wave===0?['fighter','flanker']:op.wave===1?['flanker','fighter']:
    [(op.threatTier||0)>=2?'gunship':'fighter','flanker'];
   const targets=twoFrontsWaveTargets(op);
   const spawned=[];
   for(let i=0;i<2;i++){
    const intended=targets[i];
    const target=op.nodes[intended].hp>0?op.nodes[intended]:op.nodes[1-intended];
    const e=spawnFieldEnemy(game,op,types[i],target,target,i);
    if(e)spawned.push(e.serial);
   }
   if(spawned.length){op.wave++;op.enemySerials.push(...spawned);op.nextWaveAt=Infinity;
    game.heritage.play('fieldRaid',.2,{x:op.x,y:op.y});
    game.notice('ВОЛНА '+op.wave+'/'+wavesTotal+': '+
     (targets[0]===targets[1]?'оба перехватчика бьют по узлу '+(targets[0]+1):
      'перехватчики разделились между двумя узлами')+'. Перехватывайте заряжающиеся корабли.',4.5);}
  }
  for(const enemy of game.enemies){
   if(enemy.fieldOperation!==op.id||!enemy.missionStrike||enemy.hp<=0||enemy.converted)continue;
   let target=op.nodes.find(n=>n===enemy.target&&n.hp>0);
   if(!target){target=op.nodes.find(n=>n.hp>0);if(!target)continue;
    enemy.target=target;game.prepareMissionStrike(enemy,target,{target:'field-node',range:380,
     damage:17,charge:3,angle:enemy.serial*1.1});}
   game.updateMissionStrike(enemy,target);
  }
  if(op.wave>0&&!game.enemies.some(e=>op.enemySerials.includes(e.serial)&&e.hp>0&&!e.converted)){
   if(op.wave>=wavesTotal){op.phase='return';op.partial=op.nodes.some(n=>n.hp<=0);
    game.notice('Атаки отражены. '+(op.partial?'Один узел потерян.':'Оба узла уцелели.')+' Вернитесь в арсенал.',5);
   }else if(op.nextWaveAt===Infinity){op.nextWaveAt=game.time+7.5;
    op.intermissionActive=true;
    const next=twoFrontsWaveTargets(op);
    game.notice('Волна отбита. Следующая через 8 секунд: '+
     (next[0]===next[1]?'оба врага ударят по узлу '+(next[0]+1):
      'атака по двум узлам')+'. При необходимости перенесите оставшийся щит за 4 сплава.',5);}
  }
 }else if(op.id==='sleeping-reactor'){
  const core=op.core||op;
  if(game.time>=op.pulseAt&&op.pulseUntil<=game.time){
   op.pulseUntil=game.time+1.6;
   op.pulseAt=game.time+(op.cooled?FIELD_TACTICS.reactorCoolPeriod:
    op.innerFirst?6.4:8.4)-.5*(op.threatTier||0);
   game.heritage.play('fieldReactorCharge',.2,{x:core.x,y:core.y});
   game.notice('РЕАКТОР ЗАРЯЖАЕТСЯ! Выйдите за 270 м до выброса.',2.8);
  }
  if(op.pulseUntil>0&&game.time>=op.pulseUntil){
   op.pulseUntil=0;
   op.lastPulseAt=game.time;
   game.heritage.vfx.nova(core.x,core.y,270,'violet');
   game.heritage.play('fieldPulse',.2,{x:core.x,y:core.y});
   if(distance(game.player,core)<270)game.hurt(15+4*(op.threatTier||0),core);
  }
 }else if(op.id==='broken-convoy'){
  if(op.phase==='salvage')return;
  op.artMoving=false;
  op.fieldRepair??={x:op.x,y:op.y,goal:FIELD_TACTICS.convoyRepairHold,progress:0,used:false};
  op.fieldRepair.x=op.x;op.fieldRepair.y=op.y;
  if(op.hp<=0){
   beginConvoySalvage(game,op,'Конвой уничтожен! Спасите контейнер из обломков, затем отступайте.');
   return;
  }
   const stoppedForRepair=game.actionHeld?.kind==='field-work'&&
    game.actionHeld.target===op.fieldRepair&&distance(game.player,op)<=125;
   if(!stoppedForRepair&&distance(game.player,op)<=500){
   const target=op.route[Math.min(op.routeIndex+1,2)];
   const d=distance(op,target),speed=op.routeChoice==='fast'?105:83;
   const step=Math.min(d,speed*dt);
   if(d>.001){
    const desired=Math.atan2(target.y-op.y,target.x-op.x);
    const last=convoyHeading(op),turn=Math.atan2(Math.sin(desired-last),Math.cos(desired-last));
    op.artHeading=last+Math.max(-dt*1.8,Math.min(dt*1.8,turn));
   }
   if(d>0){op.x+=(target.x-op.x)/d*step;op.y+=(target.y-op.y)/d*step;
    op.artMoving=step>.01;}
   if(d<=step+.001){op.routeIndex++;
    if(op.routeIndex>=2){op.phase='return';op.partial=op.hp<FIELD_TACTICS.convoyFullIntegrity;
     game.notice((op.partial?'Повреждённый':'Целый')+' транспорт доставлен. Возвращайтесь за наградой.',5);return;}}
  }
  op.fieldRepair.x=op.x;op.fieldRepair.y=op.y;
  // An escort's threats must have time to act before delivery. Separate route
  // milestones keep pauses for repair from consuming all later encounters.
  const raidPlan=convoyRaidPlan(op),raidMarks=raidPlan.marks;
  if(game.time>=op.nextRaidAt&&op.escortSerials.length<raidMarks.length&&
    convoyRouteProgress(op)>=raidMarks[op.escortSerials.length]){
   const index=op.escortSerials.length;
   const type=(op.threatTier||0)>=3&&index===raidMarks.length-1?'gunship':
    op.routeChoice==='fast'&&index!==1?'flanker':'fighter';
   const raid=spawnFieldEnemy(game,op,type,op,op,index);
   if(raid){op.escortSerials.push(raid.serial);
    op.nextRaidAt=game.time+raidPlan.interval;
    game.heritage.play('fieldRaid',.2,{x:raid.x,y:raid.y});
    game.notice('Нападение на конвой! Перехватите корабль до прицельного залпа.',4);}
  }
  for(const enemy of game.enemies)if(enemy.fieldOperation===op.id&&enemy.missionStrike&&
   enemy.hp>0&&!enemy.converted){
   // Keep an attacker's actual flight destination attached to its moving target.
   // The enemy steers there on its next AI tick; its position never teleports.
   if(enemy.missionFlight){
    const angle=enemy.escortApproachAngle??Math.atan2(enemy.y-op.y,enemy.x-op.x);
    enemy.missionFlight.x=op.x+Math.cos(angle)*265;
    enemy.missionFlight.y=op.y+Math.sin(angle)*265;
   }
   game.updateMissionStrike(enemy,op);
  }
  if(op.hp<=0)beginConvoySalvage(game,op,
   'Транспорт потерян. Заберите уцелевший контейнер из обломков.');
 }
}
export function drawFieldOperation(game,c,cam){
 const op=game.operation;if(!isFieldOperation(op))return;
 if(['return','failed'].includes(op.phase)&&
  !['line-break','two-fronts','broken-convoy'].includes(op.id))return;
 if(op.phase==='active'&&['line-break','false-call','two-fronts','broken-convoy'].includes(op.id))
  for(const enemy of game.enemies)if(enemy.fieldOperation===op.id&&enemy.missionStrike&&enemy.hp>0)
   game.drawMissionStrikeWarning(c,cam,enemy,enemy.target);
 const visible=p=>Math.abs(p.x-cam.x)<cam.w*.65+180&&Math.abs(p.y-cam.y)<cam.h*.65+180;
 const atlas=game.images?.fieldProps;
 const hasAtlas=atlas?.complete&&atlas.naturalWidth>0&&atlas.naturalHeight>0;
 // Exact transparent cutouts: the freighter's thrusters cross the 2×2 grid line.
 const prop=(p,id,w,h,angle=0)=>{
  if(!hasAtlas||!visible(p))return false;
  const [sx,sy,sw,sh]=FIELD_PROP_CUTOUTS[id];
  c.save();c.translate(p.x,p.y);c.rotate(angle);c.globalAlpha=.97;
  c.drawImage(atlas,sx,sy,sw,sh,-w/2,-h/2,w,h);
  c.restore();return true;
 };
 const activity=(p,r,color,phase=0)=>{
  if(!visible(p))return;
  const t=game.time*2.2+phase,spread=r+5+Math.sin(t)*5;
  c.save();c.strokeStyle=color;c.globalAlpha=.35+.2*(1+Math.sin(t))/2;
  c.lineWidth=2.6;c.beginPath();c.arc(p.x,p.y,spread,t,t+Math.PI*.8);c.stroke();
  c.globalAlpha=.2;c.beginPath();c.arc(p.x,p.y,spread+8,t+Math.PI,t+Math.PI*1.5);c.stroke();
  c.restore();
 };
 const ring=(p,r,color,label,fill=false)=>{
  if(!visible(p))return;c.save();c.strokeStyle=color;c.lineWidth=2.2;
  c.setLineDash([10,7]);c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();c.setLineDash([]);
  if(fill){c.fillStyle=color+'20';c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();}
  c.fillStyle='#e8f9ff';c.textAlign='center';c.font='bold 11px system-ui';c.fillText(label,p.x,p.y-r-15);c.restore();
 };
 if(op.id==='deep-resonance'){
  for(const sample of op.samples)if(!sample.done){
   ring(sample,100,'#ffca76','ОБРАЗЕЦ · '+(op.progress+1)+'/2');
   activity(sample,91,'#ffca76');
  }
  if(op.resonance>=58){const p=op.samples.find(s=>!s.done)||op;
   ring(p,165,'#f182af',op.pulseUntil>game.time?'РАЗРЯД':'РЕЗОНАНС '+Math.round(op.resonance)+'%',true);}
  const source=op.samples.find(s=>!s.done)||op;
  paintMissionImpact(game,c,'emp',op.lastPulseX??source.x,op.lastPulseY??source.y,
   op.lastPulseAt,194,.7);
 }else if(op.id==='reverse-hunt'){
  const [inner,outer]=reverseHuntBand(op),scanning=op.scanUntil>game.time;
  ring(op,scanning?outer:140,'#c794ff',
   scanning?'СКАНИРОВАНИЕ '+inner+'–'+outer+' М':'ЗРАЧОК · '+op.scans+'/2',scanning);
  if(scanning){
   ring(op,inner,'#f9a7d2','БЛИЖЕ — ОПАСНО');
   if(op.scans===1&&op.scanStyle&&visible(op)){
    const half=op.scanStyle===2?.87:1.15,h=op.scanHeading;
    c.save();c.fillStyle='rgba(173,137,255,.24)';c.strokeStyle='#f3ccff';c.lineWidth=3;
    c.beginPath();c.arc(op.x,op.y,outer,h-half,h+half);
    c.arc(op.x,op.y,inner,h+half,h-half,true);c.closePath();c.fill();c.stroke();
    c.restore();
   }
  }
  activity(op,scanning?outer-12:125,'#cb9cff');
  if(op.lastScanDirectional){
   const age=game.time-(op.lastScanAt??-Infinity);
   if(age>=0&&age<.7&&visible({x:op.lastScanX,y:op.lastScanY})){
    const h=op.lastScanHeading,half=op.scanStyle===2?.87:1.15;
    c.save();c.fillStyle='rgba(227,170,255,'+(.32*(1-age/.7)).toFixed(3)+')';
    c.beginPath();c.arc(op.lastScanX,op.lastScanY,op.lastScanOuter,h-half,h+half);
    c.arc(op.lastScanX,op.lastScanY,op.lastScanInner,h+half,h-half,true);
    c.closePath();c.fill();c.restore();
   }
  }else paintMissionImpact(game,c,'emp',op.lastScanX??op.x,op.lastScanY??op.y,
   op.lastScanAt,132,.58);
 }else if(op.id==='false-call'){
  if(op.signalStage==='uplink'){
   const p=op.uplink;
   prop(p,'beacon',66,96);
   ring(p,82,p.hp>0?'#c8a2ff':'#ff8d91',
    'ОТВЕТНЫЙ УЗЕЛ · '+Math.ceil(p.hp)+'% · ЗАПИСЬ '+
    Math.round(p.progress/p.goal*100)+'%',true);
   activity(p,76,'#dcb8ff');
   paintMissionImpact(game,c,'metal',p.x,p.y,p.fieldHullHitAt,78,.5);
   if(p.progress>0&&visible(p))paintMissionCell(c,game.images?.missionImpacts,3,
    p.x,p.y,73,73,{alpha:.2+.28*Math.sin(game.time*5)**2});
   return;
  }
  for(const [i,beacon] of op.beacons.entries()){
   if(beacon.checked&&!(op.decoding&&i===op.correct))continue;
   prop(beacon,'beacon',59,88);
   if(op.decoding){
    ring(beacon,FIELD_TACTICS.beaconDecodeRadius,'#bc99f8',
     'ПЕРЕХВАТ · '+Math.round(op.decodeProgress/FIELD_TACTICS.beaconDecodeSeconds*100)+'%');
    activity(beacon,64,'#d8b6ff',i);continue;
   }
   const phase=game.time%3.6;
   const double=i===op.correct&&phase>.37&&phase<.63;
   const regular=phase<.22;
   ring(beacon,regular||double?64:31,'#bc99f8',
    double?'ДВОЙНОЙ СИГНАЛ':'МАЯК '+(i+1),regular||double);
   if(regular||double)activity(beacon,double?64:35,'#d8b6ff',i);
  }
 }else if(op.id==='broken-convoy'){
  const facing=convoyHeading(op);
  if(op.phase==='salvage'||op.hp<=0){
   if(visible(op))drawConvoyWreckArt(game,c,op,facing);
   if(op.crate&&!op.crate.done){
    if(visible(op.crate))drawSalvageCrateArt(game,c,op.crate);
    const retrieving=op.phase==='salvage'&&op.crate.progress>0;
    ring(op.crate,55,'#ffd18e',retrieving?
     'ИЗВЛЕЧЕНИЕ · '+Math.round(op.crate.progress/op.crate.goal*100)+'%':
     'УЦЕЛЕВШИЙ КОНТЕЙНЕР',true);
    if(retrieving&&visible(op.crate)){
     c.save();c.strokeStyle='#ffe2a2';c.lineWidth=4;
     c.beginPath();c.arc(op.crate.x,op.crate.y,37,-Math.PI/2,
      -Math.PI/2+Math.PI*2*Math.min(1,op.crate.progress/op.crate.goal));c.stroke();c.restore();
    }
   }
  }else{
   const stopped=game.actionHeld?.kind==='field-work'&&game.actionHeld?.target===op.fieldRepair;
   if(visible(op))drawConvoyEngineArt(game,c,op,facing);
   let painted=false;
   if(visible(op))drawConvoyHullArt(game,c,op,facing,()=>{painted=prop(op,'cargo',172,103,facing);});
   if(!painted&&!game.images?.convoyHealth?.naturalWidth&&visible(op)&&!hasAtlas){
    c.save();c.translate(op.x,op.y);c.fillStyle='#254b58';c.strokeStyle='#b6f5df';c.lineWidth=2;
    c.beginPath();c.roundRect(-28,-15,56,30,9);c.fill();c.stroke();
    c.fillStyle='#ffd59a';c.fillRect(-13,-6,26,12);c.restore();
   }
   if(visible(op))drawConvoySurfaceArt(game,c,op,facing);
   ring(op,84,'#a5f4d0',(op.phase==='return'?'ДОСТАВЛЕН · ':'ТРАНСПОРТ · ')+
    Math.ceil(op.hp)+'%',true);
   if(op.phase==='active'&&op.hp<=78&&!op.fieldRepair?.used){
    // The welding drone depicts actual repair. The single outer cue stays legible.
    if(!stopped)ring(op,112,'#f6c17e','РЕМОНТ · 6 СПЛАВА');
   }
   if(op.phase!=='return'){
    c.save();c.strokeStyle='#a2eac977';c.setLineDash([12,10]);c.lineWidth=2;
    c.beginPath();c.moveTo(op.x,op.y);
    for(const p of op.route.slice(op.routeIndex+1))c.lineTo(p.x,p.y);
    c.stroke();c.restore();
   }
  }
 }else if(op.id==='sleeping-reactor'){
  prop(op.core||op,'reactor',143,143);
  ring(op.core||op,270,op.pulseUntil>game.time?'#ff8e89':'#c49bff',
   op.pulseUntil>game.time?'ВЫБРОС · УХОДИТЕ':'РЕАКТОР',op.pulseUntil>game.time);
  activity(op.core||op,op.pulseUntil>game.time?256:80,'#e5a4ff');
  paintMissionImpact(game,c,'emp',(op.core||op).x,(op.core||op).y,
   op.lastPulseAt,252,.64);
  if(op.progress>=1&&op.coolant&&visible(op.coolant)){
   const valve=op.coolant;
   paintMissionCell(c,game.images?.missionHardware,valve.done?1:0,
    valve.x,valve.y,72,72);
   // The coolant assembly is physically distinct from the removable
   // cartridges: a framed pump and four rotating blades atop painted metal.
   // Its moving part uses the existing clock and stops under reduced motion.
   c.save();c.translate(valve.x,valve.y);
   c.fillStyle='#1d3e4c';c.strokeStyle=valve.done?'#80e9db':'#dda565';
   c.lineWidth=2;c.fillRect(-20,-20,40,40);c.strokeRect(-20,-20,40,40);
   c.fillStyle=valve.done?'#438c9e':'#68534a';
   c.fillRect(-16,-16,32,32);
   c.rotate(valve.done&&!game.visuals?.reducedMotion?game.time*.6:0);
   for(let blade=0;blade<4;blade++){
    c.rotate(Math.PI/2);
    c.fillStyle=valve.done?'#8ce4d5':'#c9a785';
    c.fillRect(-4,-19,8,12);
   }
   c.beginPath();c.arc(0,0,7,0,Math.PI*2);
   c.fillStyle=valve.done?'#b6fff1':'#ffcf8c';c.fill();c.restore();
   ring(valve,59,valve.done?'#8fe0d5':'#ffc878',valve.done?
    'КЛАПАН ОТКРЫТ':'ОХЛАЖДЕНИЕ · '+Math.round(valve.progress/valve.goal*100)+'%',true);
   if(valve.done)activity(valve,49,'#8fe0d5');
  }
  for(const [i,node] of op.nodes.entries()){
   if(node.done){
    const age=game.time-(node.extractedAt??-Infinity);
    if(age>=0&&age<.65&&visible(node)){
     const rise=age/.65;
     paintMissionCell(c,game.images?.missionHardware,1,node.x,node.y-rise*25,
      57,57,{alpha:1-rise});
    }
    continue;
   }
   ring(node,47,'#ffc878','КАССЕТА '+(i+1)+' · '+Math.round(node.progress/node.goal*100)+'%');
   if(visible(node)&&!paintMissionMorph(c,game.images?.missionHardware,0,1,
    node.x,node.y,57,57,node.progress/node.goal)){
    c.save();c.translate(node.x,node.y);c.rotate(.65);
    c.fillStyle='#4c4543';c.strokeStyle='#ffd083';c.lineWidth=1.8;
    c.fillRect(-12,-18,24,36);c.strokeRect(-12,-18,24,36);
    c.fillStyle='#ffa964';c.fillRect(-4,-12,8,24);c.restore();
   }
  }
 }else if(op.id==='line-break'){
  for(const [i,node] of op.nodes.entries()){
   if(!visible(node))continue;
   drawRelayArt(game,c,node,{fallback:()=>prop(node,'relay',66,90)});
   if(node.done)continue;
   ring(node,52,node.hp>0?'#7eead9':'#ff8585','УЗЕЛ '+(i+1)+' · '+
    (node.hp>0?Math.round(node.progress/node.goal*100)+'% · ЩИТ '+Math.ceil(node.hp)+'%':'РАЗРУШЕН'),true);
  }
  if(op.stage==='sync'&&op.link&&visible(op.link)){
   const link=op.link;
   paintMissionCell(c,game.images?.missionHardware,link.hp>0?2:3,
    link.x,link.y,76,76);
   ring(link,89,link.hp>0?'#83e6df':'#ff9791',
    'СОПРЯЖЕНИЕ · '+Math.round(link.progress/link.goal*100)+'% · '+Math.ceil(link.hp)+'%',true);
   activity(link,74,'#8cddde');
   paintMissionImpact(game,c,'metal',link.x,link.y,link.fieldHullHitAt,82,.55);
  }
 }else if(op.id==='two-fronts')for(const [i,node] of op.nodes.entries()){
  if(!visible(node))continue;
  drawRelayArt(game,c,node,{fallback:()=>prop(node,'relay',68,92),shieldMax:FIELD_TACTICS.shieldStrength});
  const next=twoFrontsWaveTargets(op),warn=op.nextWaveAt>game.time&&
   Number.isFinite(op.nextWaveAt)&&op.wave<(op.wavesTotal||2);
  const incoming=warn?next.filter(target=>target===i).length:0;
  ring(node,90,node.hp>0?(incoming?'#ffc28a':'#7eead9'):'#ff7f79',
   'УЗЕЛ '+(i+1)+(incoming?' · АТАКА ×'+incoming:'')+' · '+Math.ceil(node.hp)+'%'+
    (node.fieldShield>0?' · БАРЬЕР '+Math.ceil(node.fieldShield):
     node.progress>0&&!op.shieldChargeUsed?' · ЗАРЯД '+
      Math.round(node.progress/(node.goal||FIELD_TACTICS.shieldHold)*100)+'%':''),false);
  if(node.fieldShield<=0&&!op.shieldChargeUsed&&node.hp>0&&node.progress===0)
   activity(node,58,'#9addeb',i*1.5);
 }
}
