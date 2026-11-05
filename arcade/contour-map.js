import {REGIONS,regionAt} from './regions.js?v=regions-1';
import {baseNames} from './balance.js?v=arcade-network-20';
import {CONTOURS,contourFields,contourArea,contourProduction,contourLinkOffer,fieldAt} from './territory-system.js?v=contours-1';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>Math.round(n).toLocaleString('ru-RU');
const label=b=>!b.discovered&&!b.active&&!b.strategicRole?'Неизвестный узел':
 b.title||baseNames[b.type]||'Станция';
const stationColor=b=>b.enemy?'#fa818c':b.active?'#85f6d6':'#edc783';
const point=(b,center,scale)=>({x:340+(b.x-center.x)*scale,y:240+(b.y-center.y)*scale});
const path=(polygon,center,scale)=>polygon.map((p,i)=>{
 const q=point(p,center,scale);return (i?'L':'M')+q.x.toFixed(2)+' '+q.y.toFixed(2);
}).join(' ')+' Z';

export function renderContourMap(game){
 const world=game.world,region=REGIONS.find(r=>r.id===game.contourRegion)||null;
 const center=region?region.survey:{x:0,y:0},scale=region?.id==='amethyst'?.055:region?.id? .049:.0035;
 // The atlas covers the five authored regions. The procedural world beyond
 // them remains playable and retains the detailed local navigation map.
 const stations=region?world.nearbyStations(center.x,center.y,5300,true):
  REGIONS.flatMap(r=>world.nearbyStations(r.survey.x,r.survey.y,5100,true));
 const unique=new Map(stations.map(s=>[s.id,s]));
 for(const s of world.stations.values())if(s.strategicRole||s.active||s.discovered)unique.set(s.id,s);
 const nodes=[...unique.values()].filter(s=>{
  const q=point(s,center,scale);return q.x>12&&q.x<668&&q.y>12&&q.y<468;
 });
 const fields=contourFields(world),area=contourArea(fields),production=contourProduction(fields);
 const inside=fieldAt(world,game.player.x,game.player.y,fields);
 const pulseReady=inside&&world.contours.flux>=5&&game.time>=(world.contours.pulseReadyAt||0)&&game.player.shield<42;
 const selected=world.stations.get(game.contourFirst||game.contourSelection);
 const complete=fields.map(f=>'<path d="'+path(f.polygon,center,scale)+'" fill="#1ac9b41c" stroke="#44e1c7" stroke-opacity=".3" stroke-width="1.4"/>').join('');
 const vortex=fields.map(f=>{
  const q=point(f.center,center,scale);
  return '<g><circle cx="'+q.x+'" cy="'+q.y+'" r="10" fill="#f9731633" stroke="#ffb65a" stroke-width="1.5"/>'+
   '<circle cx="'+q.x+'" cy="'+q.y+'" r="4" fill="#ffda7f"/></g>';
 }).join('');
 const lines=world.contours.links.map(([a,b])=>{
  const x=world.stations.get(a),y=world.stations.get(b);if(!x||!y)return '';
  const p=point(x,center,scale),q=point(y,center,scale),enabled=x.active&&y.active&&!x.enemy&&!y.enemy&&!x.suppressed&&!y.suppressed;
  return '<path d="M'+p.x+' '+p.y+'L'+q.x+' '+q.y+'" stroke="'+(enabled?'#7ef4dc':'#ee8e86')+
   '" opacity="'+(enabled?.7:.45)+'" stroke-width="2.2"'+(enabled?'':' stroke-dasharray="5 5"')+'/>';
 }).join('');
 const selectedPoint=selected?point(selected,center,scale):null;
 const possible=game.contourFirst?nodes.filter(n=>n.id!==game.contourFirst&&
  contourLinkOffer(world,game.contourFirst,n.id).ok).map(n=>n.id):[];
 const marks=nodes.map(b=>{
  const q=point(b,center,scale),picked=selected?.id===b.id;
  const active=b.active&&!b.enemy&&!b.suppressed,clickable=region!==null;
  const small=!b.discovered&&!b.active&&!b.strategicRole;
  const ring=possible.includes(b.id)?'<circle r="13" fill="none" stroke="#7fffd9" stroke-dasharray="3 4"/>':'';
  const accessible=clickable?' tabindex="0" role="button" aria-label="'+esc(label(b))+'" data-act="contourNode" data-id="'+esc(b.id)+'"':'';
  return '<g class="contour-node'+(picked?' selected':'')+'" transform="translate('+q.x.toFixed(2)+' '+q.y.toFixed(2)+')"'+accessible+'>'+ring+
   (picked?'<circle r="15" fill="#fff2ae18" stroke="#ffe0a0" stroke-width="2"/>':'')+
   '<circle r="'+(small?3.7:active?7:5.5)+'" fill="'+(small?'#a4b7c9':stationColor(b))+'"'+
    (b.enemy?' stroke="#772d48" stroke-width="2"':'')+'/>'+
   (small?'':'<title>'+esc(label(b))+'</title>')+'</g>';
 }).join('');
 const player=point(game.player,center,scale);
 const regionButtons='<button data-act="contourRegion" data-id="all" aria-pressed="'+!region+'">Вся карта</button>'+
  REGIONS.map(r=>'<button data-act="contourRegion" data-id="'+r.id+'" aria-pressed="'+(region?.id===r.id)+'">'+
  r.number+' · '+esc(r.name)+'</button>').join('');
 const overview=region?'':'<g>'+REGIONS.map(r=>{
  const q=point(r.survey,center,scale);
  return '<circle cx="'+q.x+'" cy="'+q.y+'" r="22" fill="'+r.color+'12" stroke="'+r.color+'66" stroke-dasharray="4 5"/>'+
   '<text x="'+q.x+'" y="'+(q.y-27)+'" fill="'+r.color+'" font-size="13" font-weight="700" text-anchor="middle">'+esc(r.name)+'</text>';
 }).join('')+'</g>';
 const status=selected?(!selected.discovered&&!selected.active&&!selected.strategicRole?
  'Узел ещё не исследован. Подлетите, чтобы узнать его назначение и владельца.':
  selected.enemy?'Вражеская станция: захватите её в полёте.':
  !selected.active?'Станция ещё не включена. Сначала доберитесь до неё.':
  selected.suppressed?'Передатчик подавлен; после восстановления связи линия заработает.':
  game.contourFirst===selected.id?'Выберите вторую включённую станцию, чтобы провести линию.':
  'Станция готова к соединению.'):'Выберите регион, затем станцию. Для первого контура нужны три работающие станции.';
 const near=selected&&game.contourFirst?nodes.filter(b=>b.id!==selected.id&&contourLinkOffer(world,game.contourFirst,b.id).ok).length:0;
 const connected=selected?world.contours.links.filter(pair=>pair.includes(selected.id)).map(pair=>
  world.stations.get(pair.find(id=>id!==selected.id))).filter(Boolean):[];
 const action=selected?'<div class="contour-selection"><b>'+esc(label(selected))+'</b><p>'+esc(status)+'</p>'+
  (game.contourFirst?'<small>Подходящих станций на этом участке: '+near+'. Нажмите вторую точку на карте.</small>':'')+
  '<button data-act="waypoint" data-id="'+esc(selected.id)+'" data-x="'+selected.x+'" data-y="'+selected.y+'" data-label="'+esc(label(selected))+'">Проложить маршрут</button>'+
  (connected.length?'<details class="contour-links"><summary>Связи этой станции · '+connected.length+'</summary>'+
   connected.map(b=>'<div><span>'+esc(label(b))+'</span><button data-act="contourUnlink" data-id="'+esc(b.id)+'" data-from="'+esc(selected.id)+'">Разорвать</button></div>').join('')+
   '</details>':'')+'</div>':'';
 const activeRegion=regionAt(game.player.x,game.player.y);
 return '<div class="dialog map-dialog contour-dialog" role="dialog" aria-modal="true" aria-labelledby="map-menu-title">'+
  '<header class="map-heading"><div><span class="map-kicker">СТРАТЕГИЧЕСКАЯ СЕТЬ</span><h2 id="map-menu-title">Контуры территорий</h2>'+
  '<p>Все пять регионов видны сразу. Выберите регион и соединяйте включённые станции. Замкнутая область создаёт воронку и приносит флюкс.</p></div>'+
  '<div class="map-heading-actions"><span>Флюкс <b>'+world.contours.flux.toFixed(1)+'</b> / '+CONTOURS.fluxCap+
  '</span>'+(game.mapReturnToBase&&game.docked?'<button data-act="baseBack">← К станции</button>':'')+
  '<button data-act="close">В полёт · Esc</button></div></header>'+
  '<nav class="map-view-switch"><button data-act="mapView" data-id="map">Ближняя карта</button>'+
  '<button data-act="mapView" data-id="territory" aria-pressed="true">Контуры</button>'+
  '<button data-act="mapView" data-id="targets">Регионы и цели</button></nav>'+
  '<div class="contour-region-switch">'+regionButtons+'</div>'+
  '<section class="map-shell contour-shell"><div class="map-canvas"><svg class="contour-chart" viewBox="0 0 680 480" role="group" aria-label="Станции и соединённые контуры">'+
  '<rect width="680" height="480" rx="15" fill="#071b2c"/>'+
  '<path d="M0 240H680M340 0V480" stroke="#45698555" stroke-dasharray="6 8"/>'+
  overview+complete+lines+vortex+marks+
  (player.x>10&&player.x<670&&player.y>10&&player.y<470?
   '<circle cx="'+player.x+'" cy="'+player.y+'" r="6" fill="none" stroke="#fff" stroke-width="2"/>':'')+
  '</svg><div class="map-legend"><span>● свой узел</span><span>● не включён</span><span>● враг</span><span>◉ воронка</span></div>'+
  '<div class="map-active-route"><b>Сейчас:</b> '+esc(activeRegion.name)+' · '+(game.contourFirst?'Первый узел выбран':'Выберите узел')+
  (game.contourFirst?'<button data-act="contourCancel">Отменить выбор</button>':'')+'</div></div>'+
  '<aside class="map-side contour-side"><div class="map-objective"><span>ВЛАДЕНИЯ</span><p>Замкнутых областей: <b>'+fields.length+
  '</b> · площадь: <b>'+number(area/1000000)+'</b> км² условной карты.</p><p>Производство: <b>'+production.toFixed(1)+
  '</b> флюкса за 3 минуты. Сборщики доставляют его на станции; перевозки могут перехватывать враги.</p>'+
  '<button data-act="contourPulse"'+(pulseReady?'':' disabled')+'>'+((world.contours.pulseReadyAt||0)>game.time?
   'Импульс через '+Math.ceil(world.contours.pulseReadyAt-game.time)+' с':
   'Защитный импульс · 5 флюкса · +22 щита')+'</button><small>Работает только внутри своего поля; щит до 42 единиц.</small></div>'+
  (game.contourError?'<p class="contour-error" role="status">'+esc(game.contourError)+'</p>':'')+
  (action||'<div class="map-objective"><span>ПЕРВОЕ ДЕЙСТВИЕ</span><p>Выберите ближайший к старту регион и включённую станцию. Нажмите вторую станцию — появится линия. Третья замкнёт территорию.</p></div>')+
  '<div class="map-objective"><span>ПРАВИЛА</span><p>Длина линии до '+CONTOURS.maxLength+' м; до '+CONTOURS.maxDegree+
  ' связей у станции. Пересечения запрещены. Линия через подавленный или потерянный узел перестаёт питать поле.</p></div>'+
  '</aside></section></div>';
}
