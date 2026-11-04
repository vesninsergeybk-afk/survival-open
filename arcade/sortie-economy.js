import {MODULES,slotOpen} from './ship-loadout.js?v=weapons-cycle-2';

// A sortie begins when the player actually leaves a station. Checkpoints are
// station-only: the baseline never needs to be saved halfway through a flight.
export const MAX_SORTIE_REPORTS=24;

export function startSortie(game){
 return {time:game.time,ore:game.player.ore,data:game.player.data,
  hp:game.player.hp,level:game.player.level,allies:game.allies.length};
}

export function finishSortie(start,game,base){
 if(!start||!base||!Number.isFinite(game.time)||game.time<start.time)return null;
 const seconds=Math.round(game.time-start.time);
 const ore=Math.round(game.player.ore-start.ore),data=Math.round(game.player.data-start.data);
 const hull=Math.round(game.player.hp-start.hp),drones=game.allies.length-start.allies;
 const levels=game.player.level-start.level;
 // Reopening a station without a real flight must not replace a useful report.
 if(seconds<12&&ore===0&&data===0&&hull===0&&drones===0&&levels===0)return null;
 return {seconds,ore,data,hull,drones,levels,baseId:base.id};
}

export function appendSortieReport(reports,report){
 return report?[...(Array.isArray(reports)?reports:[]),report].slice(-MAX_SORTIE_REPORTS):
  (Array.isArray(reports)?reports:[]);
}

// The summary explains already available spending options. Purchases still go
// through the existing hangar/station validators, never through this helper.
export function nextEconomyChoices(base,state,offer){
 if(!base.active)return [];
 const choices=[];
 const add=(title,detail,cost,act,role='',reason='')=>choices.push({title,detail,cost,act,role,reason});
 if(!offer.reasons.hire||offer.reasons.hire.startsWith('Не хватает'))
  add('Дрон сопровождения','Прикрывает корабль в бою и при добыче.',offer.hireCost,
   'hire',offer.drone.role,offer.reasons.hire);
 if(base.type==='dock'&&offer.localService?.key==='shield'&&
  (!offer.reasons.service||offer.reasons.service.startsWith('Не хватает')))
  add('Аварийный щит','Запас прочности для рискованного вылета; расходуется в бою.',
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
   const installed=loadout.slots.filter(id=>id==='plasma').length;
   const price=(loadout.owned.plasma||0)>installed?0:MODULES.plasma.cost;
   add(price?(installed===1?'Второй плазменный луч':'Ещё один плазменный луч'):
    'Установить запасной луч',
    'Усиливает ближний залп; два луча быстрее нагревают оружие.',price,'baseTab','hangar');
  }
 }
 if((state.civilianBases??state.activeBases??0)<2&&offer.relayCost>0)
  add('Следующий узел сети','Отложить сплав для будущей станции. Включить её можно на месте.',
   offer.relayCost,'baseMap');
 return choices.slice(0,4);
}

export function validSortieReports(reports){
 return Array.isArray(reports)&&reports.length<=MAX_SORTIE_REPORTS&&reports.every(r=>
  r&&typeof r==='object'&&!Array.isArray(r)&&
  Object.keys(r).length===7&&
  ['seconds','ore','data','hull','drones','levels'].every(k=>
   Number.isInteger(r[k])&&Math.abs(r[k])<=1e9)&&
  r.seconds>=0&&r.seconds<=1e9&&r.levels>=0&&r.levels<=1000&&
  typeof r.baseId==='string'&&/^-?\d+:-?\d+$/.test(r.baseId));
}
