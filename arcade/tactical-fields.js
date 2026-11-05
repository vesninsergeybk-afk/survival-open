// One active, non-damaging tactical tool. All distances use world units.
// Equipment and upgrades are run-owned; no purchased module creates ammunition.
export const TACTICAL_DEVICES=Object.freeze({
 pulse:{name:'Инерционный импульс',short:'Импульс',role:'Прервать сближение',cooldown:14,
  desc:'Короткая волна замедляет ближайших врагов. Применяйте перед тараном или окружением.'},
 decoy:{name:'Ложный маяк',short:'Маяк',role:'Разделить патруль',cooldown:21,cost:30,bases:2,
  desc:'Поставьте ложный сигнал в точке курсора. Часть противников пойдёт проверять его.'},
 trap:{name:'Гравитационная ловушка',short:'Ловушка',role:'Удержать проход',cooldown:19,cost:48,bases:3,
  desc:'Создаёт неподвижное поле у курсора. Замедляет врагов, которые в него входят.'},
 jam:{name:'Радиопомеха',short:'Помеха',role:'Разорвать связь',cooldown:24,cost:64,bases:4,
  desc:'На время подавляет вражескую mesh-связь в области вокруг корабля. Не мешает врагам видеть и стрелять.'}
});
export const TACTICAL_BRANCHES=Object.freeze({
 pulse:{shell:{name:'Защитная оболочка',desc:'Вместо волны: движущееся с кораблём тормозящее поле на 3–3,6 с.'},
  burst:{name:'Векторный выброс',desc:'Вместо длительного замедления: отталкивает ближайших врагов и срывает таран.'}},
 decoy:{lure:{name:'Сборщик патрулей',desc:'Маяк привлекает больше разведчиков, но быстрее исчезает.'},
  ghost:{name:'Долгий след',desc:'Маяк действует дольше; опытные патрули чаще распознают подделку.'}},
 trap:{sink:{name:'Гравитационный узел',desc:'Тянет лёгкие корабли к центру, облегчая площадные атаки.'},
  snare:{name:'Вязкая среда',desc:'Сильнее замедляет корабли, которые пересекают поле.'}},
 jam:{wide:{name:'Широкий диапазон',desc:'Подавляет более удалённые узлы, но работает меньше времени.'},
  deep:{name:'Долгая тишина',desc:'Дольше удерживает область без связи, но не увеличивает радиус.'}}
});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const limit=(v,min,max)=>Math.max(min,Math.min(max,v));
export const createTactical=()=>({equipped:'pulse',owned:['pulse'],branches:{},readyAt:0,effects:[],uses:0});
export function validTactical(value,now=0){
 if(!value||typeof value!=='object'||!Object.hasOwn(TACTICAL_DEVICES,value.equipped)||
  !Array.isArray(value.owned)||value.owned.length>4||!value.owned.includes('pulse')||
  new Set(value.owned).size!==value.owned.length||
  value.owned.some(id=>!Object.hasOwn(TACTICAL_DEVICES,id))||
  !value.owned.includes(value.equipped)||!Number.isFinite(value.readyAt)||
  value.readyAt<0||value.readyAt>now+30||!Number.isInteger(value.uses)||value.uses<0||
  !value.branches||typeof value.branches!=='object'||Object.keys(value.branches).length>4||
  !Array.isArray(value.effects)||value.effects.length>3)return false;
 for(const [id,choice] of Object.entries(value.branches))
  if(!value.owned.includes(id)||!choice||!Object.hasOwn(TACTICAL_BRANCHES[id],choice.path)||
   !Number.isInteger(choice.rank)||choice.rank<1||choice.rank>2)return false;
 return value.effects.every(e=>e&&['decoy','trap','jam','shell'].includes(e.kind)&&
  Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.until)&&
  e.until>=0&&e.until<=now+12&&Number.isFinite(e.radius)&&e.radius>=0&&e.radius<=850);
}
export function tacticalQuote(state,act,id,context={}){
 const fail=reason=>({ok:false,reason});
 const spec=TACTICAL_DEVICES[id],branch=TACTICAL_BRANCHES[id];
 if(!spec||!state)return fail('Неизвестное устройство');
 if(!context.baseActive)return fail('Откройте действующую станцию');
 if(act==='equip')return state.owned.includes(id)?
  (state.equipped===id?fail('Уже установлено'):{ok:true,oreCost:0,pointsCost:0}):
  fail('Устройство ещё не получено');
 if(act==='unlock'){
  if(state.owned.includes(id))return fail('Уже получено');
  if((context.activeBases||0)<spec.bases)return fail('Нужно станций: '+spec.bases);
  if((context.ore||0)<spec.cost)return fail('Нужно сплава: '+spec.cost);
  return {ok:true,oreCost:spec.cost,pointsCost:0};
 }
 if(act==='upgrade'){
  const choice=context.path,old=state.branches[id];
  if(!state.owned.includes(id))return fail('Сначала получите устройство');
  if(!Object.hasOwn(branch,choice))return fail('Неизвестная ветка');
  if(old?.path!==undefined&&old.path!==choice)return fail('Другая ветка уже выбрана');
  if(old?.rank===2)return fail('Мастерство достигнуто');
  const rank=(old?.rank||0)+1;
  if((context.level||1)<(rank===1?3:7))return fail('Нужен уровень '+(rank===1?3:7));
  if((context.activeBases||0)<(rank===1?1:2))return fail('Нужно станций: '+(rank===1?1:2));
  if((context.points||0)<1)return fail('Нужно 1 очко развития');
  return {ok:true,oreCost:0,pointsCost:1,rank};
 }
 return fail('Неизвестное действие');
}
export function applyTacticalChoice(state,act,id,context={}){
 const quote=tacticalQuote(state,act,id,context);if(!quote.ok)return quote;
 const next={...state,owned:[...state.owned],branches:{...state.branches},effects:[...state.effects]};
 if(act==='unlock')next.owned.push(id);
 if(act==='equip')next.equipped=id;
 if(act==='upgrade')next.branches[id]={path:context.path,rank:quote.rank};
 return {...quote,state:next,ore:(context.ore||0)-quote.oreCost,
  points:(context.points||0)-quote.pointsCost};
}
export function tacticalSpec(state){
 const id=state?.equipped||'pulse',branch=state?.branches?.[id]||null;
 const upgraded=branch?.rank===2;
 if(id==='pulse')return branch?.path==='shell'?{id,branch,cooldown:upgraded?14:16,
   radius:upgraded?170:143,duration:upgraded?3.6:3,slow:.68}:
  branch?.path==='burst'?{id,branch,cooldown:upgraded?15:18,
   radius:upgraded?192:165,duration:upgraded?.75:.5,slow:1}:
  {id,branch,cooldown:14,radius:165,duration:2.2,slow:.6};
 if(id==='decoy')return {id,branch,cooldown:21,radius:branch?.path==='lure'?700:590,
  duration:branch?.path==='ghost'?(upgraded?11:9):branch?.path==='lure'?5.7:7,
  decoyChance:branch?.path==='lure'?(upgraded?.9:.78):branch?.path==='ghost'?.5:.66};
 if(id==='trap')return {id,branch,cooldown:19,radius:branch?.path==='snare'?(upgraded?178:155):178,
  duration:branch?.path==='sink'?(upgraded?5.2:4.2):4.7,
  slow:branch?.path==='snare'?(upgraded?.25:.36):branch?.path==='sink'?.73:.53};
 return {id,branch,cooldown:24,radius:branch?.path==='wide'?(upgraded?750:650):480,
  duration:branch?.path==='wide'?4.2:branch?.path==='deep'?(upgraded?10:8):6.4,slow:1};
}
export function tacticalAim(player,target,maxRange=420){
 const dx=(target?.x??player.x+Math.cos(player.angle-Math.PI/2)*maxRange)-player.x,
  dy=(target?.y??player.y+Math.sin(player.angle-Math.PI/2)*maxRange)-player.y;
 const d=Math.hypot(dx,dy);return {x:player.x+dx/Math.max(1,d)*Math.min(d,maxRange),
  y:player.y+dy/Math.max(1,d)*Math.min(d,maxRange)};
}
const field=(kind,p,until,radius,other={})=>({kind,x:p.x,y:p.y,until,radius,...other});
export function activateTactical(game,target=null){
 const state=game.tactical||(game.tactical=createTactical()),now=game.time||0,player=game.player;
 if(now<state.readyAt)return {ok:false,reason:'Перезарядка: '+Math.ceil(state.readyAt-now)+' с'};
 const spec=tacticalSpec(state),choice=spec.branch?.path;
 let affected=0;
 if(spec.id==='pulse'){
  if(choice==='shell')state.effects.push(field('shell',player,now+spec.duration,spec.radius));
  else for(const e of game.enemies||[]){
   if(e.hp<=0||e.converted||e.boss||dist(e,player)>spec.radius+(e.r||0))continue;
   affected++;
   if(choice==='burst'){
    const dx=e.x-player.x,dy=e.y-player.y,d=Math.max(1,Math.hypot(dx,dy));
    e._tacticalRepel={x:dx/d,y:dy/d,until:now+spec.duration};
    if(e.state==='charge'||e.state==='windup'){e.state='hunt';e.chargeReadyAt=0;}
    game.enemyComms?.reportField?.(e,now);
   }else{
    e.tacticalSlowUntil=Math.max(e.tacticalSlowUntil||0,now+spec.duration);
    e.tacticalSlowFactor=spec.slow;
   }
  }
 }else{
  const point=spec.id==='jam'?player:tacticalAim(player,target);
  state.effects.push(field(spec.id,point,now+spec.duration,spec.radius,
   spec.id==='decoy'?{decoyChance:spec.decoyChance}:{}));
 }
 state.effects=state.effects.slice(-3);state.readyAt=now+spec.cooldown;state.uses++;
 return {ok:true,name:TACTICAL_DEVICES[spec.id].short,kind:spec.id,affected,
  duration:spec.duration,cooldown:spec.cooldown,point:spec.id==='pulse'?player:state.effects.at(-1)};
}
export function tacticalRadioJammed(game,point){
 return (game?.tactical?.effects||[]).some(e=>e.kind==='jam'&&e.until>game.time&&
  dist(e,point)<=e.radius);
}
export function tacticalDecoy(game,enemy){
 const now=game.time,decoy=(game.tactical?.effects||[]).findLast(e=>e.kind==='decoy'&&e.until>now&&
  dist(e,enemy)<=e.radius);
 if(!decoy||enemy.boss||enemy.converted||enemy.missionStructure||enemy.stationRaid||
  enemy.relayAssault||enemy.interceptCargo||enemy.protect?.hp>0||
  enemy.signalIntel?.mode==='engaged'&&now-(enemy.signalIntel?.lastSeenAt??-Infinity)<1.3||
  enemy._enemyLearningSaw)return null;
 // A consistent subset remains suspicious; this is not a faction-wide mind control.
 const serial=Math.abs(Math.trunc(enemy.serial||0));
 return serial%100/100<decoy.decoyChance?decoy:null;
}
export function updateTactical(game){
 const state=game.tactical;if(!state)return;
 const now=game.time;state.effects=state.effects.filter(e=>e.until>now);
 for(const e of game.enemies||[]){
  e._tacticalSpeed=1;e._tacticalPull=null;e._tacticalNow=now;
  if(e.hp<=0||e.converted||e.boss)continue;
  if(e.tacticalSlowUntil>now)e._tacticalSpeed=Math.min(e._tacticalSpeed,e.tacticalSlowFactor||.6);
  for(const effect of state.effects){
   if(effect.kind!=='trap'&&effect.kind!=='shell')continue;
   const center=effect.kind==='shell'?game.player:effect;
   if(dist(e,center)>effect.radius+(e.r||0))continue;
   const spec=tacticalSpec({...state,equipped:effect.kind==='shell'?'pulse':'trap'});
   e._tacticalSpeed=Math.min(e._tacticalSpeed,spec.slow);
   if(effect.kind==='trap'&&spec.branch?.path==='sink'&&
    !e.stationRaid&&!e.missionStructure&&!e.relayAssault&&!e.interceptCargo&&!e.protect?.hp)
    e._tacticalPull=center;
  }
  if(e._tacticalSpeed<1)game.enemyComms?.reportField?.(e,now);
 }
}
export function drawTactical(ctx,game){
 const state=game.tactical;if(!state)return;
 const now=game.time;
 ctx.save();
 for(const e of state.effects){
  const p=e.kind==='shell'?game.player:e,remaining=limit((e.until-now)/.55,0,1),
   colors={shell:'#86eafb',decoy:'#ffd28c',trap:'#bd9fff',jam:'#83e5ca'};
  ctx.strokeStyle=colors[e.kind];ctx.fillStyle=colors[e.kind];ctx.globalAlpha=.15*remaining;
  ctx.beginPath();ctx.arc(p.x,p.y,e.radius,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.75*remaining;ctx.lineWidth=2;ctx.setLineDash(e.kind==='jam'?[6,8]:[]);
  ctx.stroke();ctx.setLineDash([]);
  if(e.kind==='decoy'){
   ctx.beginPath();ctx.moveTo(p.x-11,p.y);ctx.lineTo(p.x+11,p.y);
   ctx.moveTo(p.x,p.y-11);ctx.lineTo(p.x,p.y+11);ctx.stroke();
  }
 }
 if(state.pulseAt!==undefined&&now-state.pulseAt<.42){
  const t=limit((now-state.pulseAt)/.3,0,1),r=(state.pulseRadius||165)*t;
  ctx.strokeStyle='#9ae9ff';ctx.globalAlpha=(1-t)*.9;ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(state.pulseX,state.pulseY,r,0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
}
