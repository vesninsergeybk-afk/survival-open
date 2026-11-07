// Repeatable, stateful station sorties. Each objective is a real world event;
// enemy kills alone never satisfy the assignment.
import {ENEMY_TYPES} from './ai.js?v=field-operations-1';
import {RULES} from './balance.js?v=field-operations-1';

export const FIELD_OPERATIONS=Object.freeze({
 'line-break':{id:'line-break',name:'Линия разрыва',station:'dock',
  ore:25,data:23,partialOre:12,partialData:9,
  desc:'Восстановите два повреждённых узла связи, удерживая действие рядом с ними. После первого ремонта можно отступить. Противник попытается помешать второму.'},
 'deep-resonance':{id:'deep-resonance',name:'Глубинный резонанс',station:'lab',
  ore:26,data:25,partialOre:9,partialData:10,
  desc:'Добудьте образцы из двух богатых залежей. Шум вызывает резонанс и привлекает охотников. После первого образца можно отступить с частью данных.'},
 'reverse-hunt':{id:'reverse-hunt',name:'Обратная охота',station:'lab',
  ore:18,data:37,partialOre:13,partialData:8,
  desc:'Выдержите два цикла сканирования опасного «зрачка» на расстоянии 130–310 м. Можно уничтожить его раньше, но тогда лаборатория получит лишь обломки.'},
 'false-call':{id:'false-call',name:'Чужой позывной',station:'lab',
  ore:17,data:30,partialOre:12,partialData:14,
  desc:'Найдите среди трёх передатчиков поддельный маяк. У него двойной фиолетовый импульс. Проверка неверного маяка поднимает тревогу, но не завершает поиск.'},
 'two-fronts':{id:'two-fronts',name:'Два фронта',station:'arsenal',
  ore:32,data:32,partialOre:17,partialData:17,
  desc:'Защитите два разнесённых узла. Враги заранее показывают направление атаки и целятся в оборудование. Спасение одного узла тоже засчитывается.'}
 ,
 'sleeping-reactor':{id:'sleeping-reactor',name:'Спящий реактор',station:'arsenal',
  ore:30,data:31,partialOre:12,partialData:11,
  desc:'Извлеките внешнюю и внутреннюю кассеты из аварийного реактора. Перед круговым выбросом ядро светится. Можно ограничиться внешней кассетой.'},
 'broken-convoy':{id:'broken-convoy',name:'Конвой на изломе',station:'carrier',
  ore:34,data:31,partialOre:17,partialData:13,
  desc:'Сопроводите повреждённый транспорт. Он ждёт рядом с пилотом и показывает маршрут. Быстрый путь опаснее, обходной дольше. После потери груза можно спасти часть контейнеров.'}
});
export const fieldOperationIds=type=>type==='dock'?['line-break']:
 type==='lab'?['deep-resonance','reverse-hunt','false-call']:
 type==='arsenal'?['two-fronts','sleeping-reactor']:
 type==='carrier'?['broken-convoy']:[];
export const isFieldOperation=op=>!!op&&Object.hasOwn(FIELD_OPERATIONS,op.id);
export function validFieldOperation(op){
 if(!isFieldOperation(op)||!['approach','active','return','salvage'].includes(op.phase)||
  !Number.isFinite(op.x)||!Number.isFinite(op.y)||typeof op.baseId!=='string')return false;
 if(op.id==='deep-resonance')return Array.isArray(op.samples)&&op.samples.length===2&&
  op.samples.every(s=>typeof s.id==='string'&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&typeof s.done==='boolean')&&
  Number.isInteger(op.progress)&&op.progress>=0&&op.progress<=2&&Number.isFinite(op.resonance)&&
  op.resonance>=0&&op.resonance<=100;
 if(op.id==='reverse-hunt')return Number.isInteger(op.scans)&&op.scans>=0&&op.scans<=2&&
  Number.isFinite(op.scanAt)&&Number.isFinite(op.scanUntil);
 if(op.id==='false-call')return Array.isArray(op.beacons)&&op.beacons.length===3&&
  op.beacons.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)&&typeof b.checked==='boolean')&&
  Number.isInteger(op.correct)&&op.correct>=0&&op.correct<=2;
 if(op.id==='line-break'||op.id==='sleeping-reactor')return Array.isArray(op.nodes)&&
  op.nodes.length===2&&op.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&
   Number.isFinite(n.goal)&&n.goal>0&&Number.isFinite(n.progress)&&n.progress>=0&&n.progress<=n.goal&&
   (op.id!=='line-break'||Number.isFinite(n.hp)&&n.hp>=0&&n.hp<=100));
 if(op.id==='broken-convoy')return Number.isFinite(op.hp)&&op.hp>=0&&op.hp<=100&&
  Array.isArray(op.route)&&op.route.length===3&&Number.isInteger(op.routeIndex)&&
  op.routeIndex>=0&&op.routeIndex<=2;
 return Array.isArray(op.nodes)&&op.nodes.length===2&&op.nodes.every(n=>
  Number.isFinite(n.x)&&Number.isFinite(n.y)&&Number.isFinite(n.hp)&&n.hp>=0&&n.hp<=100)&&
  Number.isInteger(op.wave)&&op.wave>=0&&op.wave<=2&&Array.isArray(op.enemySerials)&&
  op.enemySerials.length<=4;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
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
export function createFieldOperation(id,base,world,attempt=0,routeChoice='safe'){
 const spec=FIELD_OPERATIONS[id];
 if(!spec||!base?.active||base.enemy||base.type!==spec.station)return null;
 const bearing=(attempt*2.17+(base.x*0.002+base.y*0.0007))%(Math.PI*2);
 const site=siteNear(base,world,710,bearing);
 const common={...spec,baseId:base.id,x:site.x,y:site.y,phase:'approach',
  startedAt:0,attempt,partial:false};
 if(id==='deep-resonance'){
  const rocks=world.nearbyRocks(site.x,site.y,1400)
   .filter(r=>r.alive&&r.rich&&distance(r,base)>250)
   .sort((a,b)=>distance(a,site)-distance(b,site));
  if(rocks.length<2)return null;
  const samples=rocks.slice(0,2).map(r=>({id:r.id,x:r.x,y:r.y,done:false}));
  return {...common,x:samples[0].x,y:samples[0].y,samples,progress:0,
   resonance:0,nextPulse:0,pulseUntil:0,alerted:false,nextGeologyCheck:0};
 }
 if(id==='reverse-hunt')return {...common,scans:0,scanAt:0,scanUntil:0,
  enemySerial:null,cycle:0,enemyDestroyed:false};
 if(id==='line-break'){
  const a=siteNear(base,world,590,bearing+.3),b=siteNear(base,world,790,bearing+2.65);
  return {...common,x:a.x,y:a.y,nodes:[{...a,progress:0,goal:5,done:false,hp:100},
   {...b,progress:0,goal:6,done:false,hp:100}],progress:0,alarmAt:0,guardsSent:false};
 }
 if(id==='false-call'){
  const beacons=[0,1,2].map(i=>({...siteNear(base,world,690,bearing+i*2.094),
   checked:false,progress:0,goal:1.6}));
  return {...common,x:beacons[0].x,y:beacons[0].y,beacons,
   correct:(attempt+Math.abs(Math.trunc(base.x+base.y)))%3,checks:0,progress:0};
 }
 if(id==='sleeping-reactor'){
  const outer={x:site.x+275,y:site.y+75,progress:0,goal:3.3,done:false};
  const inner={x:site.x+84,y:site.y-42,progress:0,goal:5,done:false};
  return {...common,core:{...site},nodes:[outer,inner],progress:0,pulseAt:0,pulseUntil:0};
 }
 if(id==='broken-convoy'){
  const end=siteNear(base,world,1790,bearing+1.7);
  const perpendicular={x:-(end.y-site.y),y:end.x-site.x};
  const length=Math.hypot(perpendicular.x,perpendicular.y)||1;
  const detour=routeChoice==='fast'?70:620;
  const middle={x:(site.x+end.x)/2+perpendicular.x/length*detour,
   y:(site.y+end.y)/2+perpendicular.y/length*detour};
  return {...common,x:site.x,y:site.y,hp:100,maxHp:100,route:[site,middle,end],
   routeIndex:0,progress:0,cargo:2,crate:null,escortSerials:[],
   nextRaidAt:0,started:false,routeChoice};
 }
 const first=siteNear(base,world,670,bearing+.65);
 const second=siteNear(base,world,700,bearing+3.1);
 return {...common,x:(first.x+second.x)/2,y:(first.y+second.y)/2,
  nodes:[{...first,hp:100,maxHp:100},{...second,hp:100,maxHp:100}],
  wave:0,nextWaveAt:0,enemySerials:[],warningShown:false};
}
export function fieldOperationOffer(base,op,now,id){
 const spec=FIELD_OPERATIONS[id];if(!spec||base?.type!==spec.station||base.enemy)return null;
 const active=op?.id===id&&op.baseId===base.id;
 const completed=base.fieldOperationRuns?.[id]||0;
 const wait=Math.max(0,Math.ceil((base.fieldOperationCooldowns?.[id]||0)-now));
 return {...spec,status:active?'active':!base.active?'locked':wait?'cooldown':'available',
  remaining:wait,runs:completed,progress:active?(op.progress??op.scans??op.wave):0};
}
export function fieldOperationCue(op,game){
 if(!isFieldOperation(op))return '';
 if(op.phase==='salvage')return '◈ ТРАНСПОРТ ПОТЕРЯН · ЗАБЕРИТЕ УЦЕЛЕВШИЙ КОНТЕЙНЕР';
 if(op.phase==='return')return '✓ '+op.name.toUpperCase()+' · ВЕРНИТЕСЬ НА СТАНЦИЮ';
 if(op.phase==='approach')return '◈ '+op.name.toUpperCase()+' · ДО ЦЕЛИ '+Math.round(distance(game.player,op))+' М';
 if(op.id==='deep-resonance')return '◈ ОБРАЗЦЫ '+op.progress+'/2 · РЕЗОНАНС '+Math.round(op.resonance)+'%'+
  (op.pulseUntil>game.time?' · РАЗРЯД!':op.resonance>65?' · ОТОЙДИТЕ ОТ ПОРОДЫ':'');
 if(op.id==='reverse-hunt')return '◈ СКАНИРОВАНИЕ '+op.scans+'/2'+
  (op.scanUntil>game.time?' · ИМПУЛЬС!':' · ДЕРЖИТЕСЬ В 130–310 М');
 if(op.id==='line-break')return '◈ ЛИНИЯ СВЯЗИ '+op.progress+'/2 · УЗЛЫ '+
  op.nodes.map(n=>Math.round(n.hp)+'%').join(' / ')+' · ЗАЩИТИТЕ РЕМОНТ';
 if(op.id==='false-call')return '◈ МАЯКИ · ПРОВЕРЕНО '+op.checks+'/3 · ИЩИТЕ ДВОЙНОЙ ИМПУЛЬС';
 if(op.id==='sleeping-reactor')return '◈ КАССЕТЫ '+op.progress+'/2'+
  (op.pulseUntil>game.time?' · ВЫБРОС!':' · СЛЕДИТЕ ЗА ЯДРОМ');
 if(op.id==='broken-convoy')return '◈ КОНВОЙ · КОРПУС '+Math.ceil(op.hp)+'% · '+
  (op.routeIndex===2?'ПУНКТ НАЗНАЧЕНИЯ':'ДЕРЖИТЕСЬ РЯДОМ');
 const hp=op.nodes.map(n=>Math.ceil(n.hp/n.maxHp*100)+'%').join(' / ');
 return '◈ ДВА УЗЛА '+hp+' · '+(op.nextWaveAt>game.time?'АТАКА ЧЕРЕЗ '+Math.ceil(op.nextWaveAt-game.time)+' С':'ПЕРЕХВАТИТЕ НАЛЁТЧИКОВ');
}
export function fieldOperationMining(op,rock,kind){
 if(op?.id!=='deep-resonance'||op.phase!=='active'||!['extract','strike'].includes(kind))return false;
 const sample=op.samples.find(s=>s.id===rock.id&&!s.done);
 if(!sample)return false;
 sample.done=true;op.progress++;
 op.resonance=Math.min(100,op.resonance+(kind==='strike'?48:27));
 const next=op.samples.find(s=>!s.done);
 if(next){op.x=next.x;op.y=next.y;}else op.phase='return';
 return true;
}
export function fieldOperationInteraction(op,player){
 if(!isFieldOperation(op)||!['active','salvage'].includes(op.phase))return null;
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
 const valid=op.id==='false-call'?op.beacons.includes(target)&&!target.checked:
  op.id==='line-break'?op.nodes.includes(target)&&!target.done&&target.hp>0:
  op.id==='sleeping-reactor'?op.nodes.includes(target)&&!target.done:
  op.id==='broken-convoy'?op.crate===target&&!target.done:false;
 if(!valid)return;
 target.progress=Math.min(target.goal,target.progress+dt);
 if(target.progress<target.goal)return;
 if(op.id==='false-call'){
  target.checked=true;op.checks++;
  const index=op.beacons.indexOf(target);
  if(index===op.correct){op.phase='return';op.partial=op.checks>1;
   game.notice('Поддельный маяк раскрыт. '+(op.partial?'Тревога уже поднята. ':'')+'Вернитесь в лабораторию.',5);
  }else{
   spawnFieldEnemy(game,op,'scout',target);
   game.notice('Неверный позывной! Перехватчики получили сигнал тревоги. Сравните оставшиеся импульсы.',4);
   const next=op.beacons.find(b=>!b.checked);if(next){op.x=next.x;op.y=next.y;}
  }
 }else if(op.id==='broken-convoy'){
  target.done=true;op.partial=true;op.phase='return';
  game.notice('Уцелевший контейнер спасён. Вернитесь на авианосец за частичной наградой.',5);
 }else{
  target.done=true;op.progress++;
  if(op.id==='line-break'&&op.progress===1){
   op.guardsSent=true;
   spawnFieldEnemy(game,op,'fighter',op.nodes[1]);
   spawnFieldEnemy(game,op,'flanker',op.nodes[1],op.nodes[1],1);
   game.notice('Первый узел восстановлен. Противник атакует оборудование второго: перехватите его. Можно отступить с частичной наградой.',5);
  }
  if(op.progress>=2){op.phase='return';
   game.notice(op.id==='line-break'?'Обе линии восстановлены. Вернитесь в док.':
    'Обе кассеты извлечены. Уходите из опасной зоны к арсеналу.',5);
  }else{
   const next=op.nodes.find(n=>!n.done);op.x=next.x;op.y=next.y;
   if(op.id==='sleeping-reactor')game.notice('Внешняя кассета извлечена. Внутренняя находится ближе к опасному реактору.',4.5);
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
 const enemy={serial:++game.enemySerial,group:++game.groupSerial,type,x,y,vx:0,vy:0,
  r:type==='gunship'?22:14,hp:def.hp,maxHp:def.hp,damage:def.dmg,
  think:.1,fire:1.2,state:'hunt',commitUntil:0,target:target||game.player,
  angle:0,hit:0,expAwarded:true,scenario:'field-'+op.id,fieldOperation:op.id,
  operationGuard:true,protect:null,entryPortalPending:false};
 if(target)game.prepareMissionStrike(enemy,target,{target:op.id==='broken-convoy'?'field-convoy':'field-node',range:380,
  damage:type==='flanker'?17:14,charge:type==='flanker'?2.8:3.4,angle:heading});
 game.enemies.push(enemy);return enemy;
}
export function advanceFieldOperation(game,dt){
 const op=game.operation;if(!isFieldOperation(op)||game.dead)return;
 if(op.phase==='return')return;
 if(op.phase==='approach'){
  if(distance(game.player,op)>420)return;
  op.phase='active';op.startedAt=game.time;
  if(op.id==='reverse-hunt'){
   const enemy=spawnFieldEnemy(game,op,'scout',op);
   if(enemy){enemy.hp=enemy.maxHp=165;op.enemySerial=enemy.serial;
    op.scanAt=game.time+5.5;}
   else {op.phase='approach';return;}
   game.notice('Зрачок обнаружен. Выдержите два сканирования на дистанции 130–310 м. Автоогонь можно отключить.',5);
  }else if(op.id==='two-fronts'){
   op.nextWaveAt=game.time+6;
   game.notice('Два узла под угрозой! Направления нападения отмечены. Перехватывайте налётчиков до их залпа.',5);
  }else if(op.id==='sleeping-reactor'){
   op.pulseAt=game.time+7;
   game.notice('Реактор просыпается. Сначала извлеките внешнюю кассету. Ядро предупреждает о разряде.',5);
  }else if(op.id==='broken-convoy'){
   op.started=true;op.nextRaidAt=game.time+(op.routeChoice==='fast'?5:12);
   game.notice('Транспорт начал рейс. Держитесь в радиусе 500 м. При отдалении он ждёт прикрытие.',4.5);
  }else if(op.id==='false-call'){
   game.notice('У фальшивого маяка двойной фиолетовый импульс. Наблюдайте сигналы перед проверкой.',5);
  }else if(op.id==='line-break'){
   game.notice('Удерживайте действие у повреждённого узла. После первого ремонта можно отступить.',4.5);
  }else game.notice('Две залежи отмечены на карте. Шум усиливает резонанс. Первый образец можно сдать отдельно.',5);
 }
 advanceFieldWork(game,op,dt);
 if(op.phase==='return')return;
 if(op.id==='line-break'){
  if(op.nodes[1].hp<=0&&!op.nodes[1].done){
   op.partial=op.progress>0;op.phase=op.partial?'return':'failed';
   game.notice(op.partial?'Второй узел уничтожен! Возвращайтесь с результатом первого ремонта.':
    'Оба узла потеряны, ремонт сорван.',5);
   return;
  }
  for(const enemy of game.enemies){
   if(enemy.fieldOperation!==op.id||!enemy.missionStrike||enemy.hp<=0||enemy.converted)continue;
   game.updateMissionStrike(enemy,op.nodes[1]);
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
     game.notice('Залежь разрушена посторонним огнём. Сканер отметил запасную точку.',4);
    }else{
     op.partial=op.progress>0;op.phase=op.progress>0?'return':'failed';
     game.notice('Месторождение разрушено. '+(op.partial?'Возвращайтесь с добытым образцом.':'Добыть образцы не удалось.'),4);
     return;
    }
   }
  }
  const nearby=op.samples.find(s=>!s.done&&distance(game.player,s)<210);
  if(nearby&&game.mining.active){op.resonance=Math.min(100,op.resonance+dt*(13+Math.min(12,game.miningNoise/14)));}
  else op.resonance=Math.max(0,op.resonance-dt*5);
  if(op.resonance>=58&&!op.alerted){
   const enemy=spawnFieldEnemy(game,op,'flanker',nearby||op);
   if(enemy){op.alerted=true;game.notice('Резонанс заметили перехватчики! Продолжайте добычу или отступайте.',4);}
  }
  if(op.resonance>=90&&game.time>=op.nextPulse){
   op.nextPulse=game.time+5;op.pulseUntil=game.time+1.5;
   game.notice('КРИТИЧЕСКИЙ РЕЗОНАНС: отойдите от залежи!',2.5);
  }
  if(op.pulseUntil>0&&game.time>=op.pulseUntil){
   op.pulseUntil=0;
   const source=op.samples.find(s=>!s.done)||op;
   game.heritage.vfx.nova(source.x,source.y,160,'violet');
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
   game.notice('ЗРАЧОК РАСКРЫВАЕТ СКАНЕР! Держитесь на дистанции 130–310 м.',2.7);
  }
  if(op.scanUntil>0&&game.time>=op.scanUntil){
   op.scanUntil=0;
   const d=distance(enemy,game.player);
   game.heritage.vfx.nova(enemy.x,enemy.y,315,'violet');
   if(d<=125)game.hurt(13,enemy);
   else if(d<=310){op.scans=Math.min(2,op.scans+1);
    game.notice('Спектр получен: '+op.scans+'/2.'+(op.scans===2?' Данных достаточно, можно возвращаться.':''),4);}
   if(op.scans===2){op.phase='return';op.partial=false;}
  }
 }else if(op.id==='two-fronts'){
  if(op.nodes.every(n=>n.hp<=0)){op.partial=false;op.phase='failed';return;}
  if(op.phase==='failed')return;
  if(game.time>=op.nextWaveAt&&op.wave<2&&game.enemies.length>RULES.maxEnemies-2)return;
  if(game.time>=op.nextWaveAt&&op.wave<2){
   const types=op.wave===0?['fighter','flanker']:['flanker','fighter'];
   const spawned=[];
   for(let i=0;i<2;i++){
    const target=op.nodes[i].hp>0?op.nodes[i]:op.nodes[1-i];
    const e=spawnFieldEnemy(game,op,types[i],target,target,i);
    if(e)spawned.push(e.serial);
   }
   if(spawned.length){op.wave++;op.enemySerials.push(...spawned);op.nextWaveAt=Infinity;
    game.notice('ВОЛНА '+op.wave+'/2: перехватчики выходят к двум узлам. Смотрите направления залпов.',4.5);}
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
   if(op.wave>=2){op.phase='return';op.partial=op.nodes.some(n=>n.hp<=0);
    game.notice('Атаки отражены. '+(op.partial?'Один узел потерян.':'Оба узла уцелели.')+' Вернитесь в арсенал.',5);
   }else if(op.nextWaveAt===Infinity){op.nextWaveAt=game.time+5;
    game.notice('Первую атаку отбили. Следующая через 5 секунд — успейте сменить позицию.',4);}
  }
 }else if(op.id==='sleeping-reactor'){
  const core=op.core||op;
  if(game.time>=op.pulseAt&&op.pulseUntil<=game.time){
   op.pulseUntil=game.time+1.6;op.pulseAt=game.time+8.4;
   game.notice('РЕАКТОР ЗАРЯЖАЕТСЯ! Выйдите за 270 м до выброса.',2.8);
  }
  if(op.pulseUntil>0&&game.time>=op.pulseUntil){
   op.pulseUntil=0;
   game.heritage.vfx.nova(core.x,core.y,270,'violet');
   if(distance(game.player,core)<270)game.hurt(15,core);
  }
 }else if(op.id==='broken-convoy'){
  if(op.phase==='salvage')return;
  if(op.hp<=0){
   op.phase='salvage';op.crate={x:op.x+40,y:op.y+30,goal:3.2,progress:0,done:false};
   game.notice('Конвой уничтожен! Спасите контейнер из обломков, затем отступайте.',5);return;
  }
  if(distance(game.player,op)<=500){
   const target=op.route[Math.min(op.routeIndex+1,2)];
   const d=distance(op,target),speed=op.routeChoice==='fast'?105:83;
   const step=Math.min(d,speed*dt);
   if(d>0){op.x+=(target.x-op.x)/d*step;op.y+=(target.y-op.y)/d*step;}
   if(d<=step+.001){op.routeIndex++;
    if(op.routeIndex>=2){op.phase='return';op.partial=op.hp<50;
     game.notice((op.partial?'Повреждённый':'Целый')+' транспорт доставлен. Возвращайтесь за наградой.',5);return;}}
  }
  if(game.time>=op.nextRaidAt&&op.escortSerials.length<6){
   const raid=spawnFieldEnemy(game,op,op.routeChoice==='fast'?'flanker':'fighter',op,op,op.escortSerials.length);
   if(raid){op.escortSerials.push(raid.serial);
    op.nextRaidAt=game.time+(op.routeChoice==='fast'?7:18);
    game.notice('Нападение на конвой! Перехватите корабль до прицельного залпа.',4);}
  }
  for(const enemy of game.enemies)if(enemy.fieldOperation===op.id&&enemy.missionStrike&&
   enemy.hp>0&&!enemy.converted)game.updateMissionStrike(enemy,op);
  if(op.hp<=0){op.phase='salvage';op.crate={x:op.x+40,y:op.y+30,goal:3.2,progress:0,done:false};
   game.notice('Транспорт потерян. Заберите уцелевший контейнер из обломков.',5);}
 }
}
export function drawFieldOperation(game,c,cam){
 const op=game.operation;if(!isFieldOperation(op)||op.phase==='return')return;
 if(['line-break','two-fronts','broken-convoy'].includes(op.id))
  for(const enemy of game.enemies)if(enemy.fieldOperation===op.id&&enemy.missionStrike&&enemy.hp>0)
   game.drawMissionStrikeWarning(c,cam,enemy,enemy.target);
 const visible=p=>Math.abs(p.x-cam.x)<cam.w*.65+180&&Math.abs(p.y-cam.y)<cam.h*.65+180;
 const ring=(p,r,color,label,fill=false)=>{
  if(!visible(p))return;c.save();c.strokeStyle=color;c.lineWidth=2.2;
  c.setLineDash([10,7]);c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();c.setLineDash([]);
  if(fill){c.fillStyle=color+'20';c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();}
  c.fillStyle='#e8f9ff';c.textAlign='center';c.font='bold 11px system-ui';c.fillText(label,p.x,p.y-r-15);c.restore();
 };
 if(op.id==='deep-resonance'){
  for(const sample of op.samples)if(!sample.done)ring(sample,100,'#ffca76','ОБРАЗЕЦ · '+(op.progress+1)+'/2');
  if(op.resonance>=58){const p=op.samples.find(s=>!s.done)||op;
   ring(p,165,'#f182af',op.pulseUntil>game.time?'РАЗРЯД':'РЕЗОНАНС '+Math.round(op.resonance)+'%',true);}
 }else if(op.id==='reverse-hunt'){
  ring(op,op.scanUntil>game.time?310:140,'#c794ff',
   op.scanUntil>game.time?'СКАНИРОВАНИЕ':'ЗРАЧОК · '+op.scans+'/2',op.scanUntil>game.time);
 }else if(op.id==='false-call'){
  for(const [i,beacon] of op.beacons.entries()){
   if(beacon.checked)continue;
   const phase=game.time%3.6;
   const double=i===op.correct&&phase>.37&&phase<.63;
   const regular=phase<.22;
   ring(beacon,regular||double?64:31,'#bc99f8',
    double?'ДВОЙНОЙ СИГНАЛ':'МАЯК '+(i+1),regular||double);
  }
 }else if(op.id==='broken-convoy'){
  if(op.phase==='salvage')ring(op.crate,55,'#ffd18e','УЦЕЛЕВШИЙ КОНТЕЙНЕР',true);
  else{
   ring(op,60,'#a5f4d0','ТРАНСПОРТ · '+Math.ceil(op.hp)+'%',true);
   if(visible(op)){
    c.save();c.translate(op.x,op.y);c.fillStyle='#254b58';c.strokeStyle='#b6f5df';c.lineWidth=2;
    c.beginPath();c.roundRect(-28,-15,56,30,9);c.fill();c.stroke();
    c.fillStyle='#ffd59a';c.fillRect(-13,-6,26,12);c.restore();
   }
   c.save();c.strokeStyle='#a2eac977';c.setLineDash([12,10]);c.lineWidth=2;
   c.beginPath();c.moveTo(op.x,op.y);
   for(const p of op.route.slice(op.routeIndex+1))c.lineTo(p.x,p.y);
   c.stroke();c.restore();
  }
 }else if(op.id==='sleeping-reactor'){
  ring(op.core||op,270,op.pulseUntil>game.time?'#ff8e89':'#c49bff',
   op.pulseUntil>game.time?'ВЫБРОС · УХОДИТЕ':'РЕАКТОР',op.pulseUntil>game.time);
  for(const [i,node] of op.nodes.entries())if(!node.done)
   ring(node,47,'#ffc878','КАССЕТА '+(i+1)+' · '+Math.round(node.progress/node.goal*100)+'%');
 }else if(op.id==='line-break'){
  for(const [i,node] of op.nodes.entries())if(!node.done)
   ring(node,52,node.hp>0?'#7eead9':'#ff8585','УЗЕЛ '+(i+1)+' · '+
    (node.hp>0?Math.round(node.progress/node.goal*100)+'% · ЩИТ '+Math.ceil(node.hp)+'%':'РАЗРУШЕН'),true);
 }else if(op.id==='two-fronts')for(const [i,node] of op.nodes.entries()){
  ring(node,55,node.hp>0?'#7eead9':'#ff7f79',
   'УЗЕЛ '+(i+1)+' · '+Math.ceil(node.hp)+'%',node.hp>0);
  if(node.hp>0&&visible(node)){
   c.save();c.fillStyle='#8ef0e2';c.fillRect(node.x-14,node.y-9,28,18);c.restore();}
 }
}
