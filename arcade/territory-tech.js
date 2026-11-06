// Permanent run abilities follow the capture of actual industrial depots.
// No separate inventory, currency or claim button: saved station ownership is
// the authoritative unlock and old checkpoints recover it automatically.
import {warFronts} from './war-fronts.js?v=campaign-1-repair-qa-1-enemy-balance-2-territory-war-1';

export const TERRITORY_TECH=Object.freeze({
 home:{name:'Трофейная авиасвязь',description:'Захваченный сборочный авианосец поддерживает пилота в соседних собственных контурах.'},
 north:{name:'Противоконвойное наведение',description:'Прикрытие в первую очередь атакует настоящие вражеские конвои и наносит им полный урон.'},
 azure:{name:'Ионный боеприпас',description:'Попадания авиакрыла на короткое время замедляют боевые корабли противника.'},
 teal:{name:'Аварийная мастерская',description:'При вызове оплаченного прикрытия внутри поля борт ремонтируется один раз.'}
});

export function territoryTech(world){
 const fronts=warFronts(world);
 return Object.fromEntries(Object.keys(TERRITORY_TECH).map(key=>
  [key,fronts.some(f=>f.key===key&&f.outcome==='captured')]));
}
