// First-of-type discoveries teach a new action without adding another currency,
// another station tab, or a second copy of run progression in the save file.
// Station activation is already checkpointed, so restored runs keep the unlock.
export const PRECISION_RAIL_TECH=Object.freeze({
 name:'Прицельный режим рельса',
 promise:'Первый включённый или захваченный арсенал откроет прицельный режим рельсового орудия. Для стрельбы нужен установленный рельс.',
 unlocked:'Прицельный режим рельса открыт. Переключите его клавишей R или кнопкой «Рельс: авто» на телефоне. В ручном режиме укажите точку выстрела.'
});

export function precisionRailUnlocked(world){
 if(!world?.stations?.values)return false;
 for(const station of world.stations.values())
  if(station.type==='arsenal'&&station.active&&!station.enemy)return true;
 return false;
}

export function arsenalDiscoveryPromise(station,world){
 if(station?.type!=='arsenal'||station.enemy)return '';
 if(!precisionRailUnlocked(world))return PRECISION_RAIL_TECH.promise;
 return station.active?PRECISION_RAIL_TECH.unlocked:'';
}
