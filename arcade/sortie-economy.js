import {MODULES,slotOpen} from './ship-loadout.js?v=weapons-cycle-2-campaign-1-menu-focus-1';
import {emptySortieDetails,detailsForSave,validDetails} from './sortie-ledger.js?v=economy-ledger-1';
import {validStationId} from './station-ids.js?v=living-world-checkpoint-1';

// A sortie begins when the player actually leaves a station. Checkpoints are
// station-only: the baseline never needs to be saved halfway through a flight.
export const MAX_SORTIE_REPORTS=24;

export function startSortie(game){
 return {time:game.time,id:Math.round(game.time*1000),ore:game.player.ore,data:game.player.data,
  hp:game.player.hp,level:game.player.level,allies:game.allies.length,
  details:emptySortieDetails()};
}

export function finishSortie(start,game,base,outcome='returned'){
 if(!start||!base||!Number.isFinite(game.time)||game.time<start.time)return null;
 const seconds=Math.round(game.time-start.time);
 const ore=Math.round(game.player.ore-start.ore),data=Math.round(game.player.data-start.data);
 const hull=Math.round(game.player.hp-start.hp),drones=game.allies.length-start.allies;
 const levels=game.player.level-start.level;
 // Keep empty flights >=5 seconds and every fatal attempt: failed strategies
 // must not disappear from the player's evidence. Ignore accidental taps.
 if(outcome==='returned'&&seconds<5&&ore===0&&data===0&&hull===0&&drones===0&&levels===0)return null;
 return {seconds,ore,data,hull,drones,levels,baseId:base.id,
  id:Number.isSafeInteger(start.id)?start.id:Math.round(start.time*1000),
  outcome,details:detailsForSave(start.details)};
}

export function appendSortieReport(reports,report){
 return report?[...(Array.isArray(reports)?reports:[]),report].slice(-MAX_SORTIE_REPORTS):
  (Array.isArray(reports)?reports:[]);
}

// The summary explains already available spending options. Purchases still go
// through the existing hangar/station validators, never through this helper.
export function nextEconomyChoices(base,state,offer,lastSortie=null){
 if(!base.active)return [];
 const choices=[];
 const add=(title,detail,cost,act,role='',reason='')=>choices.push({title,detail,cost,act,role,reason});
 const usable=reason=>!reason||reason.startsWith('Не хватает');
 const ore=Math.max(0,state.ore||0);
 const missing=Math.max(0,state.maxHp-state.hp),losses=lastSortie?.details;
 // A free healing dock is better for minor scratches. Recommend paying only
 // when the hull is critical, or when a remote base cannot heal the player.
 if((state.hp<state.maxHp*.45||(base.type!=='dock'&&missing>=18))&&usable(offer.reasons.repair))
  add('Срочный ремонт корпуса',base.type==='dock'?
   'Восстановит корпус сразу. Если рядом безопасно, док починит его бесплатно за несколько секунд.':
   'На этой станции нет бесплатного восстановления корпуса.',
   offer.repairCost,'repair','',offer.reasons.repair);
 if(usable(offer.reasons.hire))
  add('Дрон сопровождения',losses?.dronesLost?'В прошлом вылете потерян дрон. Верните прикрытие.':
   'Постоянный помощник: прикрывает в бою и при добыче, но покупка отложит расширение сети.',
   offer.hireCost,'hire',offer.drone.role,offer.reasons.hire);
 if(base.type==='dock'&&offer.localService?.key==='shield'&&usable(offer.reasons.service))
  add('Аварийный щит','Одноразовые 30 ед. защиты перед опасным вылетом. Дешевле дрона, но после боя щит придётся пополнять.',
   offer.localService.cost,'service','',offer.reasons.service);
 const loadout=state.loadout;
 if(loadout?.slots&&loadout.owned){
  const free=loadout.slots.findIndex((id,index)=>!id&&index<5&&slotOpen(loadout,index));
  if(free>=0){
   if(state.earlyRail&&!loadout.slots.includes('rail')){
    const price=(loadout.owned.rail||0)>0?0:MODULES.rail.cost;
    add('Рельсовое орудие','Первый успех открыл чертёж. Редкие выстрелы до 700 м; удобно атаковать цель операции издалека.',
     price,'baseTab','hangar');
   }
   if(base.id==='0:0'&&base.type==='dock'&&!state.fieldTrialTaken&&!state.fieldLoan)
    add('Испытать полевое оружие','Бесплатная проба перед покупкой второго луча.',
     0,'showFieldTrial');
   else{
    const installed=loadout.slots.filter(id=>id==='plasma').length;
    const price=(loadout.owned.plasma||0)>installed?0:MODULES.plasma.cost;
    add('Дополнительный плазменный луч',
     'Больше урона вблизи, но выше нагрев.',price,'baseTab','hangar');
   }
  }
 }
 if(offer.relayCost>0)
  add('Расширить сеть','Сохраните сплав для нового узла: он откроет другие услуги и маршруты. На карте можно выбрать цель.',
   offer.relayCost,'baseMap');
 if(Number.isFinite(offer.upgradeCost)&&usable(offer.reasons.upgrade))
  add('Технология сети','Постоянное улучшение, если станция связана с сетью.',
   offer.upgradeCost,'baseTab','network',offer.reasons.upgrade);
 if(!choices.length){
  add('Выбрать задание','Полевые заказы дают сплав, операции меняют сектор.',
   null,'baseTab','operations');
  add('Пересмотреть сборку','Сравните вооружение перед следующим вылетом.',
   null,'baseTab','hangar');
 }
 // The first cards must represent different strategies, not merely the first
 // entries of a list of unaffordable items. Reserve room for a long-term goal
 // and a free experiment even when the hull is damaged.
 const result=[];
 const select=c=>{if(c&&!result.includes(c))result.push(c);};
 const immediate=choices.filter(c=>c.cost>0&&c.cost<=ore&&!c.reason&&c.act!=='baseMap')
  .sort((a,b)=>{
   const rank=c=>c.act==='repair'?0:c.title==='Рельсовое орудие'?1:
    c.act==='hire'?2:c.act==='service'?3:4;
   return rank(a)-rank(b);
  });
 immediate.slice(0,2).forEach(select);
 select(choices.find(c=>c.act==='baseMap'));
 select(choices.find(c=>c.cost===0&&!c.reason));
 if(result.length<4){
  const canUseContract=offer.contractOptions?.length&&
   (offer.contract?.status==='available'||
    (state.contract?.baseId===base.id&&['active','ready'].includes(offer.contract?.status)));
  if(canUseContract){
   const bonus=offer.contractOptions.map(c=>c.ore);
   add(state.contract?'Продолжить заказ':'Заработать сплав',state.contract?
    'Проверьте цели уже принятого задания и вернитесь за наградой.':
    'Два полевых заказа: от '+Math.min(...bonus)+' до '+Math.max(...bonus)+' ед. сплава после сдачи. Можно копить на следующую станцию.',
    null,'baseTab','operations');
  }else{
   add('Добыть сплав','Вылетите к астероидам и удерживайте E для извлечения руды. Вернитесь на станцию, когда станет опасно.',
    null,'close');
  }
  select(choices.at(-1));
 }
 choices.forEach(c=>{if(result.length<4)select(c);});
 return result.slice(0,4);
}

export function validSortieReports(reports){
 return Array.isArray(reports)&&reports.length<=MAX_SORTIE_REPORTS&&reports.every(r=>{
  if(!r||typeof r!=='object'||Array.isArray(r))return false;
  const legacy=Object.keys(r).length===7;
  if(!legacy&&Object.keys(r).length!==10)return false;
  if(!['seconds','ore','data','hull','drones','levels','baseId',
   ...(legacy?[]:['id','outcome','details'])].every(k=>Object.hasOwn(r,k)))return false;
  if(!['seconds','ore','data','hull','drones','levels'].every(k=>
   Number.isInteger(r[k])&&Math.abs(r[k])<=1e9)||r.seconds<0||r.levels<0||r.levels>1000||
   !validStationId(r.baseId))return false;
  return legacy||(Number.isSafeInteger(r.id)&&r.id>=0&&r.id<=1e12&&
   ['returned','lost'].includes(r.outcome)&&validDetails(r.details));
 });
}
