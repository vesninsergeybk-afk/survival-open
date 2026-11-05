import {cloneLoadout,slotOpen} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-menu-focus-1';

// The first ordinary contract lets a new pilot choose a fighting style.
// This is a one-time run reward, not another currency or a purchase discount.
export const FIRST_CONTRACT_MODULES=Object.freeze({
 rail:{title:'Держать дистанцию',detail:'Рельсовое орудие: точный залп на 700 м. Уходите от противника и стреляйте издалека.',test:'В следующем бою попробуйте атаковать с 500–700 м.'},
 flak:{title:'Разбивать рой',detail:'Осколочный излучатель: поражает до трёх целей в пределах 245 м. Подпускайте группу ближе.',test:'В следующем бою подведите рой на расстояние до 245 м.'},
 plasma:{title:'Усилить натиск',detail:'Второй плазменный луч: два залпа по одной цели. Сильнее всего вблизи, но оружие быстрее нагревается.',test:'В следующем бою сблизьтесь с одиночной целью и следите за нагревом.'}
});

export function claimFirstContractModule(loadout,status,id,{preserveDraft=false}={}){
 if(status!=='pending'||!Object.hasOwn(FIRST_CONTRACT_MODULES,id))
  return {ok:false,reason:'Награда уже получена или модуль недоступен'};
 if(!loadout||!Array.isArray(loadout.slots)||!loadout.owned)return {ok:false,reason:'Нет схемы корабля'};
 const next=cloneLoadout(loadout);
 next.owned[id]=(next.owned[id]||0)+1;
 const slot=preserveDraft?-1:next.slots.findIndex((value,index)=>
  value===null&&index<5&&slotOpen(next,index));
 if(slot>=0)next.slots[slot]=id;
 return {ok:true,id,status:id,loadout:next,installed:slot>=0,slot};
}
