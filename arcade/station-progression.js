// First-of-type discoveries teach a new action without adding another currency,
// another station tab, or a second copy of run progression in the save file.
// Station activation is already checkpointed, so restored runs keep the unlock.
import {CENTRAL_INDUSTRY} from './central-industry.js?v=living-world-1-home-conflict-1';
import {SUPPLY} from './regional-supply.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1';
import {FRONTIERS} from './frontier-industry.js?v=living-world-3-radio-shadow-1-expedition-1-repair-qa-1';
import {warFronts} from './war-fronts.js?v=campaign-1-repair-qa-1';

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

// Laboratories turn world simulation into information the pilot can act on.
// The first laboratory triangulates an approximate central supply lead;
// every additional active laboratory extends live cargo coverage around it.
// All observations are derived from existing stations and real, paid cargo.
export const LAB_LOGISTICS_TECH=Object.freeze({
 name:'Радиоперехват снабжения',
 range:4300,
 promise:'Первая лаборатория откроет радиоперехват: научные узлы смогут отслеживать проходящие поблизости грузы и находить промышленные источники в своём районе.',
 unlocked:'Радиоперехват работает. На карте можно выбрать промышленный сигнал или радиометку груза. Другие лаборатории расширяют область слежения.'
});

export function labLogisticsUnlocked(world){
 return !!world?.stations?.values&&[...world.stations.values()].some(station=>
  station.type==='lab'&&station.active&&!station.enemy);
}

export function labDiscoveryPromise(station,world){
 if(station?.type!=='lab'||station.enemy)return '';
 if(station.active&&station.suppressed)return 'Связь этой лаборатории подавлена: её радиоперехват временно не работает. После восстановления она снова будет отслеживать местные сигналы.';
 if(!labLogisticsUnlocked(world))return LAB_LOGISTICS_TECH.promise;
 return station.active?LAB_LOGISTICS_TECH.unlocked:
  'Подключите эту лабораторию, чтобы расширить район слежения за вражескими грузами на 4300 м вокруг неё.';
}

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function cargoStrengthensEnemy(world,item){
 if(!item||!(item.hp>0))return false;
 const destinationId=item.frontierRepair?
  FRONTIERS[item.frontierNetwork]?.[item.targetKind==='source'?'sourceId':'depotId']:
  item.centralCargo?CENTRAL_INDUSTRY.depotId:
  item.frontierCargo?FRONTIERS[item.frontierNetwork]?.depotId:SUPPLY.militaryId;
 return !!destinationId&&!!world?.stations?.get(destinationId)?.enemy;
}
export function labLogisticsIntel(world,player={x:0,y:0}){
 const labs=world?.stations?.values?[...world.stations.values()].filter(station=>
  station.type==='lab'&&station.active&&!station.enemy&&!station.suppressed):[];
 if(!labs.length){
  const unlocked=labLogisticsUnlocked(world);
  return {unlocked,contacts:[],status:unlocked?
   'Радиоперехват временно недоступен: связь действующих лабораторий подавлена. Уничтожьте носитель помех или дождитесь восстановления в полёте.':''};
 }
 const contacts=[],network=world?.regionalSupply;
 const mine=world.stations.get(CENTRAL_INDUSTRY.sourceId);
 const depot=world.stations.get(CENTRAL_INDUSTRY.depotId);
 const worker=network?.central?.worker;
 // A stationary industrial emitter is detectable from farther away than a
 // moving cargo tag, but a distant lab cannot know the whole sector for free.
 const localReach=!!mine&&labs.some(lab=>distance(lab,mine)<=9800);
 if(localReach&&depot?.enemy&&mine?.enemy&&worker?.hp>0){
  const discovered=!!mine.discovered;
  contacts.push({id:'intel:central-source',kind:'source',
   x:mine.x+(discovered?0:190),y:mine.y+(discovered?0:-140),
   label:discovered?'Местная шахта':'Радиослед добычи',
   detail:discovered?'Добыча снабжает сборочный пост. Захватите шахту или остановите рабочего.':
    'Примерная область: здесь добывают сырьё для вражеского сборочного поста. Приблизьтесь, чтобы найти источник.'});
 }else if(localReach&&depot?.enemy){
  const discovered=!!depot.discovered;
  contacts.push({id:'intel:central-depot',kind:'depot',
   x:depot.x+(discovered?0:-180),y:depot.y+(discovered?0:130),
   label:discovered?'Сборочный пост':'Радиослед сборки',
   detail:'Добыча остановлена, но сборочный пост ещё принадлежит противнику. В его запасах могут оставаться материалы.'});
 }
 for(const f of warFronts(world).filter(f=>f.key!=='home'&&f.pool&&f.depot?.enemy)){
  const emitter=f.working&&f.source?.enemy?f.source:f.depot;
  if(!labs.some(l=>distance(l,emitter)<=9800))continue;
  const discovered=!!emitter.discovered;
  contacts.push({id:'intel:'+f.key+(emitter===f.source?'-source':'-depot'),
   kind:emitter===f.source?'source':'depot',
   x:emitter.x+(discovered?0:190),y:emitter.y+(discovered?0:-140),
   label:discovered?emitter.title:'Радиослед · '+f.name,
   detail:emitter===f.source?'Источник снабжает вражескую сборку. Найдите путь грузов или остановите источник.':
    'Нового снабжения нет. Сборочный узел ещё может расходовать прежние запасы.'});
 }
 const cargo=[...(network?.convoys||[]),...(network?.central?.convoys||[]),
  ...(network?.frontier?.azure?.convoys||[]),...(network?.frontier?.teal?.convoys||[]),
  network?.frontier?.azure?.repairExpedition,network?.frontier?.teal?.repairExpedition].filter(Boolean);
 for(const item of cargo){
  // A shipment heading to a captured destination no longer funds enemies.
  // Do not tempt the player to chase a worthless, already diverted cargo.
  if(!cargoStrengthensEnemy(world,item)||!Number.isFinite(item.x)||!Number.isFinite(item.y)||
    !labs.some(lab=>distance(lab,item)<=LAB_LOGISTICS_TECH.range))continue;
  const label=item.frontierRepair?'Вражеская ремонтная экспедиция':
   item.centralCargo?'Местный рудный груз':item.frontierCargo?
   (item.frontierNetwork==='azure'?'Транспорт батарей':'Транспорт запчастей'):'Рудный транспорт';
  contacts.push({id:item.id,kind:'cargo',x:item.x,y:item.y,label,
   detail:item.frontierRepair?
    'Ремонтный корабль идёт к повреждённой станции. Перехватите его до прибытия, чтобы не допустить ремонта.':
    'Радиометка движется вместе с транспортом. Уничтожение груза лишит вражескую сеть этой поставки.'});
 }
 const counters=network?.central;
 const sourceWorking=!!mine?.enemy&&worker?.hp>0;
 const situation=!depot?.enemy?'Сборочный пост захвачен: местная сеть больше не создаёт подкрепления.':
  !sourceWorking?'Добыча остановлена. Оставшиеся в пути грузы и прежние запасы ещё могут помочь противнику.':
   'Шахта продолжает снабжать сборочный пост. Можно захватить источник или перехватить уже вышедший груз.';
 const history=counters&&counters.intercepted+counters.delivered>0?
  ' Результат: перехвачено рейсов — '+counters.intercepted+', доставлено — '+counters.delivered+'.':'';
 const status=localReach?situation+history:
  contacts.some(c=>c.kind==='source'||c.kind==='depot')?
   'Местная лаборатория обнаружила промышленный сигнал. Неизвестные объекты указаны приблизительно; подлетите для разведки.':
  contacts.some(c=>c.kind==='cargo')?
   'Обнаружены действующие перевозки противника. Их метки пропадут, когда груз покинет зону лабораторий.':
   'Радиоперехват действует рядом с лабораториями. Для поиска промышленных источников в других секторах нужны местные научные узлы.';
 return {unlocked:true,localSecured:localReach&&!depot?.enemy,contacts:contacts.sort((a,b)=>
  (a.kind==='cargo'?0:1)-(b.kind==='cargo'?0:1)||distance(a,player)-distance(b,player)),status};
}
