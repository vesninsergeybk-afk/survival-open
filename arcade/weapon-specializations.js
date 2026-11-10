// Exclusive, run-owned specializations for the permanent weapon families.
// Stages 1 and 2 deepen one chosen branch; presets never confer unlocks or resources.
export const WEAPON_SPECIALIZATIONS=Object.freeze({
 plasma:Object.freeze({
  furnace:{name:'Плазменный резак',desc:'В пределах 150 м: +25% урона; мастерство +45%. Нужно держаться рядом с целью.'},
  focus:{name:'Дальний фокус',desc:'На пределе дальности луч сохраняет 48% силы; мастерство — 60% вместо обычных 28%.'}
 }),
 rail:Object.freeze({
  breaker:{name:'Охотник на тяжёлые цели',desc:'Урон по канонеркам и ремонтникам +25% (мастерство +45%). Попадание по канонерке срывает подготовку её залпа, но не чаще раза в 8 с (с мастерством — 6 с).'},
  penetrator:{name:'Сквозной сердечник',desc:'Выстрел через астероид сохраняет 65% урона по цели; мастерство — 85%.'}
 }),
 flak:Object.freeze({
  sweep:{name:'Широкий веер',desc:'Сектор осыпи шире; до 4 целей за залп (5 с мастерством). Тройка осколков наносит до 11 урона вместо 14, если все три попадут.'},
  interceptor:{name:'Перехватчик',desc:'По разведчикам и фланкерам +30% урона (мастерство +50%). Когда снаряд угрожает вашему кораблю, орудие вместо атаки выпускает по нему настоящие перехватывающие осколки; мастерство позволяет прикрыться от двух снарядов за залп.'}
 }),
 rocket:Object.freeze({
  seeker:{name:'Преследователь',desc:'Быстрые ракеты. Если цель погибла в полёте, ракета ищет новую рядом: в радиусе 160 м, с мастерством — 260 м.'},
  payload:{name:'Тяжёлая боеголовка',desc:'По канонеркам и берсеркам +25% урона (мастерство +45%). Медленная ракета наносит ещё и ослабленный урон по соседним целям в радиусе 65 м (с мастерством — 85 м); нагрев на 25% выше.'}
 })
});
export const specializationState=(loadout,id)=>loadout?.specializations?.[id]||null;
export function quoteSpecialization(loadout,id,path,context={}){
 const fail=reason=>({ok:false,reason});
 if(!context.baseActive)return fail('Нужна действующая станция');
 if(!Object.hasOwn(WEAPON_SPECIALIZATIONS,id)||
  !Object.hasOwn(WEAPON_SPECIALIZATIONS[id],path))return fail('Неизвестная специализация');
 if(!loadout?.slots?.includes(id))return fail('Сначала установите это оружие на корабль');
 const current=specializationState(loadout,id);
 if(current&&current.path!==path)return fail('Ветка уже выбрана. Бесплатная смена недоступна');
 if(current?.rank>=2)return fail('Мастерство этой ветки уже достигнуто');
 const rank=current?2:1,requiredLevel=rank===1?7:11,requiredBases=rank===1?2:3;
 if((context.level||1)<requiredLevel)return fail('Нужен уровень '+requiredLevel);
 if((context.activeBases||0)<requiredBases)return fail('Активируйте '+requiredBases+' станции');
 if((context.points||0)<1)return fail('Нужно 1 очко развития');
 return {ok:true,reason:'',rank,pointsCost:1};
}
export function applySpecialization(loadout,id,path,context={}){
 const quote=quoteSpecialization(loadout,id,path,context);
 if(!quote.ok)return quote;
 const upgraded={...loadout,slots:[...loadout.slots],owned:{...loadout.owned},
  specializations:{...loadout.specializations,[id]:{path,rank:quote.rank}}};
 return {...quote,loadout:upgraded,points:context.points-1,ore:context.ore};
}
export function plasmaDamageFactor(spec,d,range){
 if(!spec)return 1;
 if(spec.path==='furnace')return d<=150?(spec.rank>=2?1.45:1.25):1;
 if(spec.path==='focus'){
  const fraction=Math.max(0,Math.min(1,(d-115)/Math.max(1,range-115)));
  return (1-(1-(spec.rank>=2?.60:.48))*fraction)/(1-.72*fraction);
 }
 return 1;
}
export function weaponDamageFactor(loadout,id,target){
 const spec=specializationState(loadout,id),type=target?.type;
 if(!spec)return 1;
 if(id==='rail'&&spec.path==='breaker'&&['gunship','healer'].includes(type))
  return spec.rank>=2?1.45:1.25;
 if(id==='flak'&&spec.path==='interceptor'&&['scout','flanker'].includes(type))
  return spec.rank>=2?1.50:1.30;
 if(id==='rocket'&&spec.path==='payload'&&['gunship','berserker'].includes(type))
  return spec.rank>=2?1.45:1.25;
 return 1;
}
export function penetrationFactor(loadout){
 const spec=specializationState(loadout,'rail');
 return spec?.path==='penetrator'?(spec.rank>=2?.85:.65):0;
}
export function rocketFlight(loadout){
 const spec=specializationState(loadout,'rocket');
 if(spec?.path==='payload')return {speed:470,life:2.55};
 return spec?.path==='seeker'?
  (spec.rank>=2?{speed:720,life:3}:{speed:620,life:2.65}):
  {speed:540,life:2.3};
}

export function rocketPayload(loadout){
 const spec=specializationState(loadout,'rocket');
 return spec?.path==='payload'?{
  radius:spec.rank>=2?85:65,
  fraction:spec.rank>=2?.42:.30,
  heatMultiplier:1.25
 }:null;
}
export function seekerRetargetRange(loadout){
 const spec=specializationState(loadout,'rocket');
 return spec?.path==='seeker'?(spec.rank>=2?260:160):0;
}

/** An accurate hit interrupts only an actually warned heavy shot, not an idle enemy. */
export function disruptHeavyAim(loadout,target,now){
 const spec=specializationState(loadout,'rail');
 if(spec?.path!=='breaker'||target?.type!=='gunship'||!target._gunAiming||
  !Number.isFinite(now)||now<(target._railDisruptReadyAt||0))return false;
 target._gunAiming=null;
 target._gunBurst=null;
 target._gunNextAt=Math.max(target._gunNextAt||0,now+1.5);
 target._railDisruptReadyAt=now+(spec.rank>=2?6:8);
 return true;
}
