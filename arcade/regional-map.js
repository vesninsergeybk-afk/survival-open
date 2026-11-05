import {REGIONS,regionAt} from './regions.js?v=regions-audit-1';
import {SUPPLY,SUPPLY_ROUTE,supplyStatus} from './regional-supply.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1';
import {CENTRAL_INDUSTRY,CENTRAL_ROUTE,centralRoute} from './central-industry.js?v=home-conflict-1';
import {FRONTIERS,FRONTIER_RESPONSE,frontierRoute} from './frontier-industry.js?v=living-world-3-radio-shadow-1-expedition-1';
const enc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={dispatch:'Груз вышел из комплекса',delivery:'Руда доставлена военному узлу',
 'raid-warning':'Тяжёлый отряд подготовлен',raid:'Тяжёлый отряд прибыл',intercept:'Груз перехвачен',
 'mine-captured':'Источник руды захвачен','military-captured':'Военный узел захвачен',diverted:'Груз лишился военной базы назначения'};
const REGION_BRIEF=Object.freeze({
  amethyst:{goal:'Остановить налёты в домашнем секторе: перехватить снабжение, остановить шахту или захватить сборочный пост.',
  danger:'Стартовые патрули и местная промышленная сеть.',
  preparation:'Можно начинать без дополнительного оснащения.',
  result:'Без снабжения прекращаются новые местные налёты; захват сборочного поста также уменьшает фоновые патрули.'},
 amber:{goal:'Добывать сплав и нарушить доставку руды на военный рубеж.',
  danger:'Патрули среди крупных астероидов, которые могут служить укрытием.',
  preparation:'Полезны улучшенный экстрактор и запас прочности.',
  result:'Захват источника прекращает новые отправки; грузы в пути остаются.'},
 azure:{goal:'Остановить перевозку батарей и ослабить вражеские перехватчики.',
  danger:'Электрические бури усиливают перехватчики и угрожают кораблю.',
  preparation:'Полезны ионное вооружение и скорость для выхода из кольца бури.',
  result:'Перехват батарей предотвращает усиление одного патруля; подавление сети надолго ослабляет регион.'},
 lilac:{goal:'Найти военный узел и остановить тяжёлые подкрепления.',
  danger:'Тяжёлые корабли и защищённая военная инфраструктура.',
  preparation:'Рекомендуются улучшенный корпус, щит и дальнобойное оружие.',
  result:'Захват военного узла лишает врага оставшихся резервов этого узла.'},
 teal:{goal:'Нарушить сбор обломков и снабжение ремонтной верфи.',
  danger:'Группы с ремонтниками; залежи и рабочие требуют выбора цели.',
  preparation:'Полезны прицельный огонь по ремонтникам и прочный корпус.',
  result:'Перехват запчастей предотвращает появление одного ремонтника; подавление сети надолго ослабляет регион.'}
});
export function renderRegionAtlas(game){
 const world=game.world,s=world.regionalSupply;if(!s)return '';
 const current=regionAt(game.player.x,game.player.y),mine=world.stations.get(SUPPLY.mineId);
 const q=p=>({x:150+p.x*.0022,y:120+p.y*.0022});
 const labels=REGIONS.map(r=>{const p=q(r);return '<text x="'+p.x+'" y="'+p.y+'" text-anchor="middle" fill="'+r.color+'" font-size="12">'+r.number+' · '+(r.id==='amethyst'?'Старт':r.id==='amber'?'Рудный пояс':r.id==='azure'?'Разлом':r.id==='lilac'?'Военный рубеж':'Обломки')+'</text>';}).join('');
 const player=q(game.player),buttons=REGIONS.map(r=>{
  const intel=REGION_BRIEF[r.id],route=game.waypoint?.id==='region-'+r.id;
  const distance=Math.round(Math.hypot(game.player.x-r.survey.x,game.player.y-r.survey.y));
  return '<details class="region-card"'+(route||current.id===r.id?' open':'')+'><summary><strong>'+r.number+' · '+enc(r.name)+'</strong><small>'+
   (current.id===r.id?'Вы здесь · ':route?'Маршрут выбран · ':'')+distance+' м до точки разведки</small></summary>'+
   '<p><b>Зачем лететь:</b> '+enc(intel.goal)+'</p><p><b>Опасность:</b> '+enc(intel.danger)+'</p>'+
   '<p><b>Подготовка:</b> '+enc(intel.preparation)+'</p><p><b>Что изменится:</b> '+enc(intel.result)+'</p>'+
   '<button type="button" data-act="waypoint" data-id="region-'+r.id+'" data-x="'+r.survey.x+'" data-y="'+r.survey.y+'" data-label="'+enc(r.name)+'">'+
   (route?'✓ Маршрут выбран · изменить':'Построить маршрут к ориентиру')+'</button></details>';
 }).join('');
 const cargo=[...s.convoys,...(s.central?.convoys||[]),
  ...(s.frontier?.azure?.convoys||[]),...(s.frontier?.teal?.convoys||[]),
  s.frontier?.azure?.repairExpedition,s.frontier?.teal?.repairExpedition]
  .filter(c=>c?.seen).map(c=>{
   const label=c.frontierRepair?'Ремонтный корабль':
    c.frontierCargo?(c.frontierNetwork==='azure'?'Энерготранспорт':'Ремонтный груз'):
    (c.centralCargo?'Местный груз':'Рудный транспорт');
   return '<button type="button" data-act="waypoint" data-id="'+c.id+'" data-x="'+c.x+'" data-y="'+c.y+'" data-label="'+label+'">Перехватить '+label.toLowerCase()+'</button>';
  }).join('');
 const history=mine?.discovered?s.history.slice(-2).reverse().map(e=>'<small>'+Math.floor(e.time/60)+':'+String(Math.floor(e.time%60)).padStart(2,'0')+' · '+titles[e.kind]+'</small>').join(''):'';
 const localMine=world.stations.get(CENTRAL_INDUSTRY.sourceId),localDepot=world.stations.get(CENTRAL_INDUSTRY.depotId),local=s.central;
 const localIntel=localMine?.discovered||localDepot?.discovered;
 const known=(station)=>station?.discovered?(station.enemy?'под контролем противника':'захвачена'):'не разведана';
 const localStatus=localIntel&&local?'<p>Местная промышленность: шахта — '+known(localMine)+', сборочный пост — '+known(localDepot)+'. Обнаружено грузов в пути: '+local.convoys.filter(c=>c.seen).length+'. Готовых резервов: '+(localDepot?.discovered?local.reserves:'неизвестно')+'.</p>':
  '<p>Недалеко от центра перехватываются сигналы промышленной сети. Разведайте источник на востоке, чтобы открыть её грузовой маршрут.</p>';
 const localResults=localIntel&&local?'<p>Перехвачено местных грузов: '+local.intercepted+'. Доставка оплачивает налёт: тяжёлый корабль и два истребителя; '+
  (localDepot?.discovered?'выпущено подкреплений: '+local.raids+'.':'о резерве сборочного поста пока нет сведений.')+'</p>':'';
 const frontierStatus=['azure','teal'].filter(id=>current.id===id||
  world.stations.get(FRONTIERS[id].sourceId)?.discovered||
  world.stations.get(FRONTIERS[id].depotId)?.discovered).map(id=>{
   const cfg=FRONTIERS[id],net=s.frontier?.[id];
   const source=world.stations.get(cfg.sourceId),depot=world.stations.get(cfg.depotId);
   if(!net)return '';
   if(!source?.discovered&&!depot?.discovered)return '<p>'+(id==='azure'?
    'В разломе работают неизвестные индукционные установки. Их грузы питают новые отряды.':
    'В обломках действуют сборщики и ремонтная верфь. Найдите путь их снабжения.')+'</p>';
   const strat=net.strategy;
   const tactics=source?.discovered&&strat?
    ' Текущий грузовой путь: '+(strat.route==='diversion'?'обходной':'прямой')+
    (strat.routePlan?' (готовится изменение)':'')+'. Охранение: '+
    (strat.screenPlan?'готовится усиленное':strat.screenUntil>game.time?'усиленное, требует дополнительных материалов':'обычное')+'.'+
    ' Радиосвязь действует возле вражеских станций (тонкие окружности на карте вокруг разведанных передатчиков). В радиотени пропажу груза заметят только после ожидаемой доставки.':
    '';
   return '<p><strong>'+(id==='azure'?'Энергосеть разлома':'Ремонтная сеть обломков')+'</strong>: источник — '+known(source)+
    ', сборка — '+known(depot)+'. Замечено грузов: '+net.convoys.filter(c=>c.seen).length+
    '. Резервов: '+(depot?.discovered?net.reserves:'неизвестно')+'. '+
    (id==='azure'?'Разряды бурь заряжают перехватчиков.':'Сборщики разбирают ограниченные залежи металла.')+
    tactics+(source?.discovered||depot?.discovered?
     ' Ремонтные экспедиции: отправлено '+(net.repairsLaunched||0)+
     ', доставлено '+(net.repairsCompleted||0)+', перехвачено '+(net.repairsIntercepted||0)+
     (net.repairExpedition?'. Сейчас ремонтный корабль направляется к '+
      (net.repairExpedition.targetKind==='source'?'источнику':'сборочной станции')+'.':'.'):'')+
    '</p><p>Перехвачено поставок: '+net.intercepted+'. Каждая доставленная партия позволяет добавить '+
    (id==='azure'?'заряженного перехватчика':'ремонтника')+' к обычному патрулю. '+
    (depot?.discovered?'Уже отправлено усиленных патрулей: '+net.raids+'.':'Резервы пока неизвестны.')+'</p>';
  }).join('');
 return '<div class="map-objective region-status"><span>РЕГИОН '+current.number+' · '+enc(current.name)+'</span><p>'+enc(current.cue)+'</p>'+
  '<details class="region-atlas"><summary>Выбрать регион · угрозы, подготовка и цель</summary><svg viewBox="0 0 300 240" role="img" aria-label="Старт в центре, рудный пояс на востоке, разлом на юге, военный рубеж на севере, обломки на западе">'+
  '<rect width="300" height="240" rx="12" fill="#08182b"/><path d="M 150 120 L 300 0 V 240 Z" fill="#ffbb7015"/>'+
  '<path d="M 150 120 L 0 0 H 300 Z" fill="#dfa1e315"/><path d="M 150 120 L 0 240 H 300 Z" fill="#82e8ff15"/>'+
  '<path d="M 150 120 L 0 0 V 240 Z" fill="#88e6c815"/><circle cx="150" cy="120" r="53" fill="#24233c" stroke="#caa0ff"/>'+labels+
  '<circle cx="'+Math.max(5,Math.min(295,player.x))+'" cy="'+Math.max(5,Math.min(235,player.y))+'" r="4" fill="#ffffff"/></svg><p>Контуры условны. Точка разведки ведёт внутрь региона, но не раскрывает расположение неизвестных станций. Сначала изучите описание и подготовьте корабль.</p><p><b>Маршевый перелёт:</b> удерживайте курс к выбранному региону или разведанной дружественной станции. Через 2,2 с в спокойном пространстве корабль ускорится. Вблизи врагов, станций и бурь скорость станет обычной. Время полёта продолжается. В разведанных регионах фоновая опасность ограничена. Остановка снабжения или захват сборки уменьшает местный натиск; готовые отряды остаются опасными.</p><div class="region-directions">'+buttons+'</div></details>'+
  (mine?.discovered?'<p>'+enc(supplyStatus(world))+'</p><p>Рудных грузов перехвачено: '+s.intercepted+'. '+
   (world.stations.get(SUPPLY.militaryId)?.discovered?'Тяжёлых подкреплений вышло: '+s.raids+'. Резервов в узле: '+s.reserves+'.':
    'Оставшийся запас военного узла неизвестен.')+'</p>'+history:
   cargo?'':'<p>На востоке — богатый рудный пояс. Выберите направление в обзоре регионов.</p>')+
  localStatus+localResults+frontierStatus+cargo+'</div>';
}
export function regionalMapOverlay(game,point,visible){
 const s=game.world.regionalSupply;if(!s)return '';
 const mine=game.world.stations.get(SUPPLY.mineId);
 let out='';
 if(mine?.discovered){
  out+='<path d="M '+SUPPLY_ROUTE.map(p=>{const q=point(p);return q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' L ')+'" stroke="'+(mine.enemy?'#ffbc78':'#a4d8b1')+'" opacity=".7" stroke-width="2" stroke-dasharray="9 6" fill="none"/>';
 }
 if(game.world.stations.get(CENTRAL_INDUSTRY.sourceId)?.discovered){
  out+='<path d="M '+centralRoute(s.central?.strategy?.rerouted?'diversion':'direct').map(p=>{const q=point(p);return q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' L ')+'" stroke="#83efcd" opacity=".7" stroke-width="2" stroke-dasharray="7 9" fill="none"/>';
  // A diversion affects future launches. Keep a departing cargo's old course
  // visible while it is still in flight, instead of moving its route under it.
  for(const cargo of s.central?.convoys||[])if(cargo.seen&&cargo.route!==
    (s.central?.strategy?.rerouted?'diversion':'direct'))
   out+='<path d="M '+centralRoute(cargo.route).map(p=>{const q=point(p);return q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' L ')+'" stroke="#83efcd" opacity=".35" stroke-width="1" stroke-dasharray="3 7" fill="none"/>';
 }
 for(const id of ['azure','teal']){
  const cfg=FRONTIERS[id];
  if(game.world.stations.get(cfg.sourceId)?.discovered){
   const mode=s.frontier?.[id]?.strategy?.route;
   out+='<path d="M '+frontierRoute(id,mode).map(p=>{const q=point(p);return q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' L ')+
    '" stroke="'+(id==='azure'?'#90dcff':'#9fe9bb')+'" opacity=".72" stroke-width="2" stroke-dasharray="11 6" fill="none"/>';
  }
  // Display only explored, still-hostile transmitters: no hidden-base leaks.
  for(const key of [cfg.sourceId,cfg.depotId]){
   const station=game.world.stations.get(key);
   if(!station?.discovered||!station.enemy)continue;
   const center=point(station),edge=point({x:station.x+FRONTIER_RESPONSE.radioRadius,y:station.y});
   const radius=Math.hypot(center.x-edge.x,center.y-edge.y);
   if(!(radius>0))continue;
   out+='<circle cx="'+center.x.toFixed(1)+'" cy="'+center.y.toFixed(1)+
    '" r="'+radius.toFixed(1)+'" fill="none" stroke="'+(id==='azure'?'#90dcff':'#9fe9bb')+
    '" stroke-width="1.3" stroke-dasharray="3 5" opacity=".45"/>';
  }
 }
 for(const c of [...s.convoys,...(s.central?.convoys||[]),
   ...(s.frontier?.azure?.convoys||[]),...(s.frontier?.teal?.convoys||[]),
   s.frontier?.azure?.repairExpedition,s.frontier?.teal?.repairExpedition].filter(c=>c?.seen)){
  const q=point(c);if(!visible(q))continue;
  const color=c.frontierRepair?'#ffc78b':c.frontierCargo?(c.frontierNetwork==='azure'?'#90dcff':'#9fe9bb'):
   c.centralCargo?'#83efcd':'#ffc481';
  const label=c.frontierRepair?'РЕМОНТНЫЙ КОРАБЛЬ':c.frontierCargo?(c.screened?'УСИЛЕННЫЙ ГРУЗ':
   (c.frontierNetwork==='azure'?'ЭНЕРГОТРАНСПОРТ':'РЕМОНТНЫЙ ГРУЗ')):
   c.centralCargo?'МЕСТНЫЙ ГРУЗ':'РУДНЫЙ ТРАНСПОРТ';
  out+='<g><rect x="'+(q.x-5)+'" y="'+(q.y-5)+'" width="10" height="10" fill="'+color+'"/><text x="'+(q.x+9)+'" y="'+(q.y-9)+'" fill="#ffdbad" font-size="11">'+label+'</text></g>';
 }
 return out;
}
