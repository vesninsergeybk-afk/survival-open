import {REGIONS,regionAt} from './regions.js?v=regions-1';
import {SUPPLY,SUPPLY_ROUTE,supplyStatus} from './regional-supply.js?v=living-world-2';
import {CENTRAL_INDUSTRY,CENTRAL_ROUTE} from './central-industry.js?v=living-world-1';
import {FRONTIERS} from './frontier-industry.js?v=living-world-2';
const enc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={dispatch:'Груз вышел из комплекса',delivery:'Руда доставлена военному узлу',
 'raid-warning':'Тяжёлый отряд подготовлен',raid:'Тяжёлый отряд прибыл',intercept:'Груз перехвачен',
 'mine-captured':'Источник руды захвачен','military-captured':'Военный узел захвачен',diverted:'Груз лишился военной базы назначения'};
export function renderRegionAtlas(game){
 const world=game.world,s=world.regionalSupply;if(!s)return '';
 const current=regionAt(game.player.x,game.player.y),mine=world.stations.get(SUPPLY.mineId);
 const q=p=>({x:150+p.x*.0022,y:120+p.y*.0022});
 const labels=REGIONS.map(r=>{const p=q(r);return '<text x="'+p.x+'" y="'+p.y+'" text-anchor="middle" fill="'+r.color+'" font-size="12">'+r.number+' · '+(r.id==='amethyst'?'Старт':r.id==='amber'?'Рудный пояс':r.id==='azure'?'Разлом':r.id==='lilac'?'Военный рубеж':'Обломки')+'</text>';}).join('');
 const player=q(game.player),buttons=REGIONS.map(r=>'<button type="button" data-act="waypoint" data-id="region-'+r.id+'" data-x="'+r.entry.x+'" data-y="'+r.entry.y+'" data-label="'+enc(r.name)+'">'+r.number+' · '+enc(r.name)+'</button>').join('');
 const cargo=[...s.convoys,...(s.central?.convoys||[]),
  ...(s.frontier?.azure?.convoys||[]),...(s.frontier?.teal?.convoys||[])].filter(c=>c.seen).map(c=>{
   const label=c.frontierCargo?(c.frontierNetwork==='azure'?'Энерготранспорт':'Ремонтный груз'):
    (c.centralCargo?'Местный груз':'Рудный транспорт');
   return '<button type="button" data-act="waypoint" data-id="'+c.id+'" data-x="'+c.x+'" data-y="'+c.y+'" data-label="'+label+'">Перехватить '+label.toLowerCase()+'</button>';
  }).join('');
 const history=mine?.discovered?s.history.slice(-2).reverse().map(e=>'<small>'+Math.floor(e.time/60)+':'+String(Math.floor(e.time%60)).padStart(2,'0')+' · '+titles[e.kind]+'</small>').join(''):'';
 const localMine=world.stations.get(CENTRAL_INDUSTRY.sourceId),localDepot=world.stations.get(CENTRAL_INDUSTRY.depotId),local=s.central;
 const localIntel=localMine?.discovered||localDepot?.discovered;
 const known=(station)=>station?.discovered?(station.enemy?'под контролем противника':'захвачена'):'не разведана';
 const localStatus=localIntel&&local?'<p>Местная промышленность: шахта — '+known(localMine)+', сборочный пост — '+known(localDepot)+'. Обнаружено грузов в пути: '+local.convoys.filter(c=>c.seen).length+'. Готовых резервов: '+(localDepot?.discovered?local.reserves:'неизвестно')+'.</p>':
  '<p>Недалеко от центра перехватываются сигналы промышленной сети. Разведайте источник на востоке, чтобы открыть её грузовой маршрут.</p>';
 const frontierStatus=['azure','teal'].filter(id=>current.id===id||
  world.stations.get(FRONTIERS[id].sourceId)?.discovered||
  world.stations.get(FRONTIERS[id].depotId)?.discovered).map(id=>{
   const cfg=FRONTIERS[id],net=s.frontier?.[id];
   const source=world.stations.get(cfg.sourceId),depot=world.stations.get(cfg.depotId);
   if(!net)return '';
   if(!source?.discovered&&!depot?.discovered)return '<p>'+(id==='azure'?
    'В разломе работают неизвестные индукционные установки. Их грузы питают новые отряды.':
    'В обломках действуют сборщики и ремонтная верфь. Найдите путь их снабжения.')+'</p>';
   return '<p><strong>'+(id==='azure'?'Энергосеть разлома':'Ремонтная сеть обломков')+'</strong>: источник — '+known(source)+
    ', сборка — '+known(depot)+'. Замечено грузов: '+net.convoys.filter(c=>c.seen).length+
    '. Резервов: '+(depot?.discovered?net.reserves:'неизвестно')+'. '+
    (id==='azure'?'Разряды бурь заряжают перехватчиков.':'Сборщики разбирают ограниченные залежи металла.')+'</p>';
  }).join('');
 return '<div class="map-objective region-status"><span>РЕГИОН '+current.number+' · '+enc(current.name)+'</span><p>'+enc(current.cue)+'</p>'+
  '<details class="region-atlas"><summary>Обзор регионов и выбор направления</summary><svg viewBox="0 0 300 240" role="img" aria-label="Старт в центре, рудный пояс на востоке, разлом на юге, военный рубеж на севере, обломки на западе">'+
  '<rect width="300" height="240" rx="12" fill="#08182b"/><path d="M 150 120 L 300 0 V 240 Z" fill="#ffbb7015"/>'+
  '<path d="M 150 120 L 0 0 H 300 Z" fill="#dfa1e315"/><path d="M 150 120 L 0 240 H 300 Z" fill="#82e8ff15"/>'+
  '<path d="M 150 120 L 0 0 V 240 Z" fill="#88e6c815"/><circle cx="150" cy="120" r="53" fill="#24233c" stroke="#caa0ff"/>'+labels+
  '<circle cx="'+Math.max(5,Math.min(295,player.x))+'" cy="'+Math.max(5,Math.min(235,player.y))+'" r="4" fill="#ffffff"/></svg><p>Контуры условны. Маршрут ведёт к границе выбранного региона. Станции открываются при разведке.</p><div class="region-directions">'+buttons+'</div></details>'+
  (mine?.discovered?'<p>'+enc(supplyStatus(world))+'</p>'+history:cargo?'':'<p>На востоке — богатый рудный пояс. Выберите направление в обзоре регионов.</p>')+localStatus+frontierStatus+cargo+'</div>';
}
export function regionalMapOverlay(game,point,visible){
 const s=game.world.regionalSupply;if(!s)return '';
 const mine=game.world.stations.get(SUPPLY.mineId);
 let out='';
 if(mine?.discovered){
  out+='<path d="M '+SUPPLY_ROUTE.map(p=>{const q=point(p);return q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' L ')+'" stroke="'+(mine.enemy?'#ffbc78':'#a4d8b1')+'" opacity=".7" stroke-width="2" stroke-dasharray="9 6" fill="none"/>';
 }
 if(game.world.stations.get(CENTRAL_INDUSTRY.sourceId)?.discovered){
  out+='<path d="M '+CENTRAL_ROUTE.map(p=>{const q=point(p);return q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' L ')+'" stroke="#83efcd" opacity=".7" stroke-width="2" stroke-dasharray="7 9" fill="none"/>';
 }
 for(const id of ['azure','teal']){
  const cfg=FRONTIERS[id];
  if(!game.world.stations.get(cfg.sourceId)?.discovered)continue;
  out+='<path d="M '+cfg.route.map(p=>{const q=point(p);return q.x.toFixed(1)+' '+q.y.toFixed(1);}).join(' L ')+
   '" stroke="'+(id==='azure'?'#90dcff':'#9fe9bb')+'" opacity=".72" stroke-width="2" stroke-dasharray="11 6" fill="none"/>';
 }
 for(const c of [...s.convoys,...(s.central?.convoys||[]),
   ...(s.frontier?.azure?.convoys||[]),...(s.frontier?.teal?.convoys||[])].filter(c=>c.seen)){
  const q=point(c);if(!visible(q))continue;
  const color=c.frontierCargo?(c.frontierNetwork==='azure'?'#90dcff':'#9fe9bb'):
   c.centralCargo?'#83efcd':'#ffc481';
  const label=c.frontierCargo?(c.frontierNetwork==='azure'?'ЭНЕРГОТРАНСПОРТ':'РЕМОНТНЫЙ ГРУЗ'):
   c.centralCargo?'МЕСТНЫЙ ГРУЗ':'РУДНЫЙ ТРАНСПОРТ';
  out+='<g><rect x="'+(q.x-5)+'" y="'+(q.y-5)+'" width="10" height="10" fill="'+color+'"/><text x="'+(q.x+9)+'" y="'+(q.y-9)+'" fill="#ffdbad" font-size="11">'+label+'</text></g>';
 }
 return out;
}
