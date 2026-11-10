import {RULES} from './balance.js?v=escort-squad-20261110';

// Persistent escorts are bought at stations. Every station uses the same
// catalogue and price list: a model costs the same regardless of its vendor.
export const ESCORT_LIMIT=RULES.maxAllies;
export const ESCORTS=Object.freeze({
 scout:Object.freeze({name:'Страж',tag:'Перехват',cost:20,maxHp:58,r:13,
  speed:365,damage:12,reload:.98,range:330,color:'#77e7eb',
  desc:'Быстро перехватывает таранщиков и фланговые атаки. Особенно полезен при добыче.'}),
 fighter:Object.freeze({name:'Клинок',tag:'Истребитель',cost:40,maxHp:78,r:15,
  speed:335,damage:18,reload:.85,range:355,color:'#8fc6ff',
  desc:'Прицельно атакует крупные корабли и ремонтников. Надёжная основа ударного звена.'}),
 brawler:Object.freeze({name:'Таран',tag:'Ближний бой',cost:36,maxHp:94,r:17,
  speed:400,damage:35,reload:2.1,range:52,color:'#ffb97b',
  desc:'Бронированный штурмовик сближается с противником и наносит мощные короткие удары.'}),
 rocket:Object.freeze({name:'Оса',tag:'Ракетный',cost:46,maxHp:65,r:14,
  speed:315,damage:29,reload:2.45,range:465,color:'#ffa5ad',
  desc:'Выпускает настоящие самонаводящиеся ракеты с небольшим радиусом взрыва. Хорош против групп.'}),
 medic:Object.freeze({name:'Искра',tag:'Поддержка',cost:40,maxHp:70,r:14,
  speed:345,damage:5,reload:1.7,range:285,color:'#9df1be',
  desc:'Восстанавливает повреждённых ведомых и понемногу подпитывает щит пилота в затишье.'})
});
export const ESCORT_TECH=Object.freeze({
 armor:Object.freeze({name:'Броня ведомых',desc:'Каждый уровень уменьшает получаемый дронами урон на 7%.'}),
 engine:Object.freeze({name:'Двигатели звена',desc:'Каждый уровень ускоряет ведомых на 7,5%.'}),
 armament:Object.freeze({name:'Вооружение звена',desc:'Каждый уровень усиливает выстрелы, ракеты и ближние удары.'})
});
export const escortCapacity=connectedBases=>Math.min(ESCORT_LIMIT,
 Math.max(1,Math.floor(Number.isFinite(connectedBases)?connectedBases:1)));
export const escortName=role=>ESCORTS[role]?.name||role;
export function escortHireOffer(base,state,role){
 const spec=ESCORTS[role],cap=escortCapacity(state?.connectedBases),
  inSquad=Math.max(0,state?.allies||0),price=spec?.cost||0;
 const reason=!spec?'Неизвестная модель':
  !base?.active||base?.enemy||base?.ruined?'Сначала включите дружественную станцию':
  inSquad>=cap?'Все места заняты · '+inSquad+'/'+cap:
  (state?.ore||0)<price?'Не хватает '+(price-(state?.ore||0))+' сплава':'';
 return {ok:!reason,reason,price,cap,spec,role};
}
export function escortTrainingOffer(base,state,key){
 const tech=ESCORT_TECH[key],rank=state?.network?.[key]||0,
  price=36+rank*28;
 const reason=!tech?'Неизвестная технология':
  !base?.active||base?.enemy||base?.ruined?'Сначала включите дружественную станцию':
  rank>=6?'Технология изучена полностью':
  (state?.ore||0)<price?'Не хватает '+(price-(state?.ore||0))+' сплава':'';
 return {ok:!reason,reason,price,key,rank,nextRank:rank+1,tech};
}
export function createEscort(role,serial,x,y,time=0){
 const spec=ESCORTS[role];if(!spec)return null;
 return {serial,role,x,y,vx:0,vy:0,r:spec.r,hp:spec.maxHp,
  maxHp:spec.maxHp,fire:.3,think:0,state:'follow',commitUntil:0,
  message:'Вылетаю с базы',messageUntil:time+2.2,angle:0,
  serviceAt:time+3};
}
export function escortRetirementRefund(ally){
 const spec=ESCORTS[ally?.role];if(!spec)return 0;
 return Math.floor(spec.cost*.4*Math.max(0,Math.min(1,
  (ally.hp||0)/Math.max(1,ally.maxHp||spec.maxHp))));
}
export function escortFocusBonus(role,enemy){
 if(role==='scout')return enemy.type==='berserker'?145:enemy.type==='flanker'?105:0;
 if(role==='fighter')return enemy.type==='gunship'?135:enemy.type==='healer'?115:0;
 if(role==='brawler')return enemy.type==='berserker'?105:enemy.type==='fighter'?75:0;
 if(role==='rocket')return enemy.type==='gunship'?105:enemy.type==='fighter'?45:0;
 if(role==='medic')return enemy.type==='berserker'?70:0;
 return 0;
}
