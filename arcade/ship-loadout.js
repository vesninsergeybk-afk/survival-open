import {ionDamage} from './ion-conductor.js?v=weapons-cycle-2-campaign-1';
import {applySpecialization} from './weapon-specializations.js?v=weapons-cycle-2';
// Run-owned hardware; saved blueprints contain choices, never resources/unlocks.
export const FRAME_STEPS=Object.freeze([
 {nodes:2,heavy:false,level:1,cost:0,name:'Лёгкий корпус'},
 {nodes:3,heavy:false,level:4,cost:48,name:'Третий узел'},
 {nodes:4,heavy:false,level:7,cost:72,name:'Боковая консоль'},
 {nodes:5,heavy:false,level:10,cost:96,name:'Полный контур'},
 {nodes:5,heavy:true,level:14,cost:140,name:'Сверхтяжёлый узел'}
]);
export const SHIP_UPGRADES=new Set(['beam','double','range','rocket','hull','engine','shield']);
export const MODULES=Object.freeze({
 plasma:{id:'plasma',name:'Плазменный луч',short:'Плазма',kind:'auto',role:'Ближний бой',level:1,cost:24,heat:6,color:'#6de7ef',
  desc:'Частые залпы. Самый сильный урон вблизи; к пределу дальности остаётся 28%. Несколько лучей стреляют общим залпом.'},
 rail:{id:'rail',name:'Рельсовое орудие',short:'Рельс',kind:'auto',role:'Дальний бой',level:3,cost:36,heat:18,color:'#a5bfff',
   desc:'Редкий дальний выстрел. Астероиды служат укрытием. После включения первого арсенала ЛКМ ведёт ручной огонь выбранным рельсом; R по умолчанию переключает режим. Нагрев и перезарядка общие.'},
 flak:{id:'flak',name:'Осколочный излучатель',short:'Картечь',kind:'auto',role:'Против роя',level:4,cost:42,heat:14,color:'#f7ce87',
  desc:'Три осколка на каждую цель в секторе перед стволом (до трёх целей за залп). Осколки летят по прямой: астероид или другой корабль могут их остановить. Дальность 245 м.'},
 rocket:{id:'rocket',name:'Самонаводящиеся ракеты',short:'Ракеты',kind:'auto',role:'Дальний бой',level:5,cost:48,heat:16,color:'#ffad85',
  desc:'Ракеты преследуют выбранный корабль. Требуется технология «Авторакеты». Её первый ранг даёт один ракетный модуль.'},
 ion:{id:'ion',name:'Ионный проводник',short:'Ион',kind:'manual',role:'Цепной разряд',level:1,cost:null,heat:0,color:'#a4f4ff',
  desc:'Space / «Ион»: разряд по меткам плазменного луча. Калибровка орудий усиливает цепь. Прокатный модуль: три заряда, возврат после задания. Занимает обычный узел.'},
 resonator:{id:'resonator',name:'Резонатор',short:'Резонанс',kind:'manual',role:'Связь целей',level:1,cost:null,heat:0,color:'#d5a1f0',
   desc:'Клавиша полевого устройства (по умолчанию пробел): связывает до трёх целей на 4 с. Между ними передаётся 35% нанесённого урона, если расстояние не больше 260 м и нет каменного экрана. Нужны минимум две цели. Три заряда, возврат после задания.'},
 howitzer:{id:'howitzer',name:'Осадная гаубица',short:'Гаубица',kind:'heavy',role:'Крупные цели',level:14,cost:160,heat:70,color:'#e1b2ff',
   desc:'ЛКМ / «Гаубица»: 1,25 с подготовки, затем тяжёлый снаряд летит к точке курсора. F по умолчанию сохраняет автоматический выбор цели. Камень или вражеский корпус на пути вызывают ранний взрыв радиусом 110 м. Цель может уйти.'}
});
export const BLUEPRINT_KEY='survivor.hangar.blueprints.v1';
export const PREVIEW_BLUEPRINT_KEY='survivor.hangar.preview.blueprints.v1';
export const BLUEPRINT_NAMES=['Штурм','Дистанция','Резерв'];
export const createLoadout=()=>({version:1,frame:0,slots:['plasma',null,null,null,null,null],owned:{plasma:1},specializations:{}});
export const cloneLoadout=value=>({...value,slots:[...value.slots],owned:{...value.owned},specializations:{...value.specializations}});
export const frameSpec=loadout=>FRAME_STEPS[loadout?.frame]||FRAME_STEPS[0];
export const slotOpen=(loadout,index)=>Number.isInteger(index)&&index>=0&&
 (index<frameSpec(loadout).nodes||(index===5&&frameSpec(loadout).heavy));
const countSlots=slots=>slots.reduce((out,id)=>{if(id)out[id]=(out[id]||0)+1;return out;},{});
export function loadoutProfile(loadout){
 const counts=countSlots(loadout.slots);
 return {plasma:counts.plasma||0,rail:counts.rail||0,flak:counts.flak||0,
  rocket:counts.rocket||0,ion:!!counts.ion,resonator:!!counts.resonator,howitzer:!!counts.howitzer,
  automatic:(counts.plasma||0)+(counts.rail||0)+(counts.flak||0)+(counts.rocket||0)};
}
export function moduleStats(id,ranks={},specialization=null){
 const beam=ranks.beam||0,range=ranks.range||0,rocket=ranks.rocket||0;
 const power=1+beam*.2,rate=1+beam*.08;
 const spread=specialization?.path==='sweep'&&id==='flak';
 return ({
  plasma:{damage:18*power,range:435+range*56,interval:.63/rate,targets:1+Math.min(2,ranks.double||0)},
  rail:{damage:38*power,range:700,interval:1.65/rate,targets:1},
  flak:{damage:(spread?11:14)*power,range:245,interval:1.15/rate,targets:spread?(specialization.rank>=2?5:4):3},
  rocket:{damage:(48+rocket*19)*power,range:720,interval:3.5/(1+rocket*.28)/rate,targets:1},
  ion:{damage:ionDamage(beam).map(d=>Number(d.toFixed(2)).toLocaleString('ru-RU')).join(' / '),range:485,interval:4.5,targets:3},
  resonator:{damage:'35% между целями',range:485,interval:6,targets:3},
  howitzer:{damage:180,range:900,interval:12,targets:'радиус 110 м'}
 })[id];
}
export const plasmaSplitWeights=count=>count>=3?[.45,.45,.45]:count===2?[.6,.6]:[1];
export const contextFieldLoan=context=>context.fieldLoan||context.ionLoan||null;
export const matchingFieldLoan=(context,id)=>{
 const loan=contextFieldLoan(context);return loan&&(loan.moduleId||'ion')===id?loan:null;
};
export function moduleLock(id,context){
 if(!Object.hasOwn(MODULES,id))return 'Неизвестный модуль';
 const m=MODULES[id];
 // The first contract can grant one higher-tier weapon early. Only that
 // particular, actually owned module may be removed and reinstalled early.
 const rewarded=id===context.firstHardwareReward&&(context.loadout?.owned?.[id]||0)>0;
 if((context.level||1)<m.level&&!(id==='rail'&&context.earlyRail)&&!rewarded)return 'Нужен уровень '+m.level;
 if(id==='rocket'&&!(context.ranks?.rocket>0))return 'Изучите «Авторакеты» в ангаре';
 if(m.kind==='manual'&&!matchingFieldLoan(context,id))return 'Возьмите этот модуль в прокат ниже';
 return '';
}
export function quoteLoadout(current,draft,context){
 const fail=reason=>({ok:false,reason,cost:0,missing:{}});
 if(!context.baseActive)return fail('Сначала включите станцию');
 if(!draft||draft.frame!==current.frame||!Array.isArray(draft.slots)||draft.slots.length!==6)
  return fail('Схема корпуса изменилась. Откройте ангар заново');
 for(let i=0;i<6;i++){
  const id=draft.slots[i];if(id===null)continue;
  if(!Object.hasOwn(MODULES,id))return fail('В схеме есть неизвестное оружие');
  if(!slotOpen(current,i))return fail('Узел '+(i===5?'H':i+1)+' ещё не открыт');
  if((i===5)!==(MODULES[id].kind==='heavy'))return fail('Гаубицу можно установить только в узел H');
  const lock=moduleLock(id,context);if(lock)return fail(lock);
 }
 const profile=loadoutProfile(draft);
 if(!profile.automatic)return fail('Оставьте хотя бы одно автоматическое орудие');
 if(profile.ion&&!profile.plasma)return fail('Ионному проводнику нужен луч для ионных меток');
 if(profile.ion&&profile.resonator)return fail('Выберите один полевой модуль на Space; узел H использует F');
 const counts=countSlots(draft.slots),missing={};let cost=0;
 for(const [id,number] of Object.entries(counts)){
  const manual=MODULES[id].kind==='manual';
  const owned=manual?(matchingFieldLoan(context,id)?1:0):(current.owned[id]||0);
  const need=Math.max(0,number-owned);
  if(manual&&need)return fail('Доступен только один прокатный полевой модуль');
  if(need){missing[id]=need;cost+=need*MODULES[id].cost;}
 }
 if(cost>(context.ore||0))return {ok:false,reason:'Не хватает '+(cost-(context.ore||0))+' ед. сплава',cost,missing};
 return {ok:true,reason:'',cost,missing};
}
export function applyLoadout(current,draft,context){
 const quote=quoteLoadout(current,draft,context);
 if(!quote.ok)return quote;
 const loadout=cloneLoadout(current);loadout.slots=[...draft.slots];
 for(const [id,n] of Object.entries(quote.missing))loadout.owned[id]=(loadout.owned[id]||0)+n;
 return {...quote,loadout,ore:context.ore-quote.cost};
}
// Recording a design does not manufacture it, so its budget is not a gate.
export const quoteBlueprint=(current,draft,context)=>
 quoteLoadout(current,draft,{...context,ore:Number.MAX_SAFE_INTEGER});
export function moduleStock(current,draft,context,id){
 const owned=MODULES[id]?.kind==='manual'?(matchingFieldLoan(context,id)?1:0):(current.owned[id]||0);
 const installed=current.slots.filter(value=>value===id).length;
 const planned=draft.slots.filter(value=>value===id).length;
 return {owned,installed,free:Math.max(0,owned-installed),needed:Math.max(0,planned-owned)};
}
// A received module may be suggested, but only Apply changes the live ship.
export function stageOwnedModule(current,session,id,context){
 if(session.dirty(current))return false;
 const slot=current.slots.findIndex((value,index)=>!value&&slotOpen(current,index)&&
  ((index===5)===(MODULES[id]?.kind==='heavy')));
 if(slot<0)return false;
 const draft=cloneLoadout(current);draft.slots[slot]=id;
 const quote=quoteLoadout(current,draft,context);
 if(!quote.ok||quote.cost)return false;
 session.draft=draft;session.slot=slot;session.selected=id;
 session.catalog=false;session.inspect=false;session.filter='all';
 return true;
}
export function upgradeFrame(current,context){
 const next=FRAME_STEPS[current.frame+1];
 const reason=!context.baseActive?'Сначала включите станцию':!next?'Все узлы открыты':
  context.level<next.level?'Нужен уровень '+next.level:
  context.ore<next.cost?'Не хватает '+(next.cost-context.ore)+' ед. сплава':'';
 if(reason)return {ok:false,reason};
 return {ok:true,loadout:{...cloneLoadout(current),frame:current.frame+1},ore:context.ore-next.cost,cost:next.cost};
}
export const createThermal=()=>({enabled:true,current:0,limit:100,locked:false,cooling:false});
export function coolWeapons(thermal,dt,quiet=false){
 thermal.current=Math.max(0,thermal.current-Math.max(0,dt)*(quiet?25:14));
 thermal.cooling=quiet||thermal.locked;
 if(thermal.locked&&thermal.current<=35)thermal.locked=false;
}
export function heatWeapons(thermal,amount){
 thermal.current=Math.min(thermal.limit,thermal.current+Math.max(0,amount));
 if(thermal.current>=thermal.limit)thermal.locked=true;
 thermal.cooling=false;
}

function validBlueprint(value){
 return value&&Array.isArray(value.slots)&&value.slots.length===6&&
  value.slots.every(id=>id===null||Object.hasOwn(MODULES,id));
}
export class HangarSession {
 constructor(storage=null,storageKey=BLUEPRINT_KEY){
  this.storage=storage;this.storageKey=storageKey;this.blueprints=[null,null,null];
  try{const saved=JSON.parse(storage?.getItem(storageKey)||'null');
   if(saved?.version===1&&Array.isArray(saved.items))
    this.blueprints=this.blueprints.map((_,i)=>validBlueprint(saved.items[i])?{slots:[...saved.items[i].slots]}:null);
  }catch{/* Storage is optional, including blocked or damaged storage. */}
  this.slot=0;this.filter='all';this.catalog=false;this.inspect=false;this.selected='plasma';this.message='';
 }
 begin(loadout){this.draft=cloneLoadout(loadout);this.catalog=false;this.inspect=false;this.message='';}
 dirty(loadout){return this.draft?.slots.some((id,i)=>id!==loadout.slots[i]);}
 dispatch(data,context){
  const current=context.loadout;if(!this.draft)this.begin(current);
  this.message='';
  const act=data.act;
  if(act==='hgSlot'){
   const slot=Number(data.id);if(!Number.isInteger(slot)||slot<0||slot>5)return;
   if((this.slot===5)!==(slot===5))this.filter='all';
   this.slot=slot;this.catalog=true;this.inspect=!slotOpen(current,slot);
   this.selected=this.draft.slots[slot]||(slot===5?'howitzer':'plasma');
  }
  if(act==='hgBrowse')this.catalog=true;
  if(act==='hgShip')this.catalog=false;
  if(act==='hgCatalog'){this.catalog=true;this.inspect=false;}
  if(act==='hgFilter'&&['all','auto','manual','heavy'].includes(data.id))this.filter=data.id;
  if(act==='hgSelect'&&Object.hasOwn(MODULES,data.id)){this.selected=data.id;this.inspect=true;}
  if(act==='hgInstall'){
   const id=this.selected,lock=moduleLock(id,context);
   if(!slotOpen(current,this.slot)||lock){this.message=lock||'Этот узел ещё закрыт';return;}
   if((this.slot===5)!==(MODULES[id].kind==='heavy')){this.message='Для гаубицы нужен узел H';return;}
   this.draft.slots[this.slot]=id;this.catalog=false;
   this.message='Предварительная сборка изменена. Нажмите «Применить»';
  }
  if(act==='hgRemove'&&slotOpen(current,this.slot)){
   this.draft.slots[this.slot]=null;this.message='Модуль вернётся на склад после применения';this.catalog=false;
  }
  if(act==='hgReset')this.begin(current);
  if(act==='hgSpec'){
   const [id,path]=String(data.id||'').split(':');
   const result=applySpecialization(current,id,path,context);
   if(!result.ok){this.message=result.reason;return;}
   this.message=(result.rank===1?'Ветка выбрана':'Мастерство достигнуто')+
    ' · потрачено 1 очко развития';
   return {type:'specialization',...result};
  }
  if(act==='hgApply'){
   const result=applyLoadout(current,this.draft,context);
   if(!result.ok){this.message=result.reason;return;}
   this.begin(result.loadout);this.message='Конфигурация установлена'+(result.cost?' · потрачено '+result.cost+' сплава':'');
   return {type:'apply',...result};
  }
  if(act==='hgFrame'){
   if(this.dirty(current)){this.message='Сначала примените или отмените замену оружия';return;}
   const result=upgradeFrame(current,context);
   if(!result.ok){this.message=result.reason;return;}
   this.begin(result.loadout);this.message='Новый узел открыт';return {type:'frame',...result};
  }
  if(act==='hgSave'){
   const index=Number(data.id);if(!Number.isInteger(index)||index<0||index>2)return;
   if(!quoteBlueprint(current,this.draft,context).ok){this.message='Исправьте состав вооружения перед сохранением';return;}
   this.blueprints[index]={slots:[...this.draft.slots]};
   try{if(!this.storage)throw Error('unavailable');
    this.storage.setItem(this.storageKey,JSON.stringify({version:1,items:this.blueprints}));
    this.message='Схема «'+BLUEPRINT_NAMES[index]+'» сохранена на этом устройстве';
   }catch{this.message='Схема доступна до закрытия игры: браузер не разрешил сохранить её на устройстве';}
  }
  if(act==='hgLoad'){
   const index=Number(data.id);if(!Number.isInteger(index)||index<0||index>2)return;
   const saved=this.blueprints[index];if(!saved)return;
   this.draft={...cloneLoadout(current),slots:[...saved.slots]};this.catalog=false;
   this.message='Схема «'+BLUEPRINT_NAMES[index]+'» загружена для просмотра. Нажмите «Применить»';
  }
 }
}

// Fractional coordinates in each original artwork, not in a stretched square.
export const SHIP_ART=Object.freeze([
 [.563,290,[.495,.57],[.631,.57],[.563,.70],[.408,.61],[.718,.61],[.563,.28]],
 [.445,290,[.377,.57],[.513,.57],[.445,.70],[.290,.61],[.600,.61],[.445,.28]],
 [.563,298,[.485,.54],[.641,.54],[.563,.70],[.368,.63],[.758,.63],[.563,.27]],
 [.445,298,[.367,.54],[.523,.54],[.445,.70],[.250,.63],[.640,.63],[.445,.27]],
 [.563,296,[.480,.53],[.646,.53],[.563,.70],[.365,.64],[.761,.64],[.563,.27]],
 [.445,296,[.362,.53],[.528,.53],[.445,.70],[.247,.64],[.643,.64],[.445,.27]],
 [.563,291,[.473,.52],[.653,.52],[.563,.70],[.345,.65],[.781,.65],[.563,.28]],
 [.445,291,[.355,.52],[.535,.52],[.445,.70],[.227,.65],[.663,.65],[.445,.28]],
 [.563,421,[.469,.54],[.657,.54],[.563,.65],[.323,.59],[.803,.59],[.563,.30]],
 [.445,421,[.351,.54],[.539,.54],[.445,.65],[.205,.59],[.685,.59],[.445,.30]]
]);
export const shipArtStage=level=>Math.min(9,Math.max(0,Math.floor(((level||1)-1)/3)));
// Damaged paintings have different framing; centres match their existing
// registered main-engine masks in src/hero-evolution.js.
const DAMAGED_HULL_CENTRES=[.541,.486,.563,.498,.562,.460,.540,.500,.535,.471];
export function localMountPosition(player,index){
 const stage=shipArtStage(player.level),art=SHIP_ART[stage],point=art[index+2];
 const painted=player.weaponGeometry?.stage===stage?player.weaponGeometry:null;
 const shift=painted?.damaged?DAMAGED_HULL_CENTRES[stage]-art[0]:0;
 const width=painted?.width||79.95,height=painted?.height||width*art[1]/512;
 return {x:(point[0]+shift-.5)*width,y:(point[1]-.5)*height};
}
export function mountPosition(player,index){
 const {x,y}=localMountPosition(player,index);
 const a=player.angle||0;
 return {x:player.x+x*Math.cos(a)-y*Math.sin(a),y:player.y+x*Math.sin(a)+y*Math.cos(a)};
}
