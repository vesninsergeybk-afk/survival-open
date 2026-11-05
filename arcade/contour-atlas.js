import {REGIONS,regionAt} from './regions.js?v=regions-1';
import {baseNames} from './balance.js?v=arcade-network-20';
import {CONTOURS,contourFields,contourArea,contourProduction,fieldAt} from './territory-system.js?v=contours-1';
import {contourConnectionChoices} from './contour-preview.js?v=contour-visual-1';
import {visibleBackbone} from './enemy-backbone.js?v=enemy-backbone-2';
import {labLogisticsUnlocked} from './station-progression.js?v=lab-logistics-qa-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-unified-controls-1';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=b=>!b.discovered&&!b.active&&!b.strategicRole?'Неизвестный узел':
 b.title||baseNames[b.type]||'Станция';
const state=b=>!b.discovered&&!b.active&&!b.strategicRole?'не исследована':
 b.suppressed?'передатчик подавлен':b.enemy?'вражеская станция':
 b.active?'включена':'не включена';
const at=(p,center,scale)=>({x:340+(p.x-center.x)*scale,y:240+(p.y-center.y)*scale});
const digits=n=>Number(n).toFixed(1);
const svgPath=(polygon,center,scale)=>polygon.map((p,i)=>{
 const q=at(p,center,scale);return (i?'L':'M')+digits(q.x)+' '+digits(q.y);
}).join(' ')+'Z';
const pathLine=(a,b,center,scale)=>{
 const p=at(a,center,scale),q=at(b,center,scale);
 return `M${digits(p.x)} ${digits(p.y)}L${digits(q.x)} ${digits(q.y)}`;
};
const route=b=>'<button class="contour-route" data-act="waypoint" data-id="'+esc(b.id)+
 '" data-x="'+b.x+'" data-y="'+b.y+'" data-label="'+esc(name(b))+'">'+
 'Отметить маршрут к станции</button>';

// The whole-atlas view is a geographic overview. Detailed station points only
// appear at regional scale, where they are large enough to choose accurately.
function regionOverview(world,center,scale){
 return REGIONS.map(r=>{
  const p=at(r.survey,center,scale);
  const sites=world.nearbyStations(r.survey.x,r.survey.y,5100,true);
  const count=new Set(sites.map(b=>b.id)).size;
  const owned=sites.filter(b=>b.active&&!b.enemy&&!b.suppressed).length;
  return `<g class="contour-region" role="button" tabindex="0" data-act="contourRegion" data-id="${r.id}" aria-label="${esc(r.name)}. Работает ${owned} из ${count} узлов" transform="translate(${digits(p.x)} ${digits(p.y)})">
   <circle class="contour-region-halo" r="49" fill="${r.color}12" stroke="${r.color}70" stroke-width="1.5"/>
   <circle r="30" fill="#0b2333" stroke="${r.color}" stroke-width="1.5"/>
   <path d="M-18 0H18M0-18V18" stroke="${r.color}55" stroke-width="1"/>
   <text y="-3" text-anchor="middle" fill="#f1faff" font-size="18" font-weight="800">${owned}</text>
   <text y="13" text-anchor="middle" fill="${r.color}" font-size="9">из ${count}</text>
   <text y="-61" text-anchor="middle" fill="${r.color}" font-size="12" font-weight="700">${esc(r.name)}</text>
   <circle r="53" fill="transparent"/></g>`;
 }).join('');
}

function stationMarks(nodes,center,scale,selectedId,sourceId,readyIds,goalIds){
 return nodes.map(b=>{
  const p=at(b,center,scale),picked=b.id===selectedId||b.id===sourceId;
  const ready=readyIds.has(b.id),goal=goalIds.has(b.id),known=b.discovered||b.active||b.strategicRole;
  const fill=b.suppressed?'#cf95ec':b.enemy&&known?'#ff7786':b.active?'#86f5d7':
   known?'#edc783':'#9baebc';
  const ring=ready?'#7effd8':goal?'#ffcc85':picked?'#ffe5aa':null;
  const mark=b.enemy&&known?'<path d="M0 -7L7 0L0 7L-7 0Z" fill="'+fill+'"/>':
   b.active?'<circle r="7" fill="'+fill+'"/><circle r="3" fill="#113f43"/>':
   '<circle r="5.5" fill="'+fill+'" stroke="#102c3b" stroke-width="1.2"/>';
  const label=(picked||ready||goal||b.active)&&known?
   '<text x="'+digits(p.x+13)+'" y="'+digits(p.y-13)+'" class="contour-map-label">'+esc(name(b))+'</text>':'';
  return `<g class="contour-node${picked?' selected':''}${ready?' connectable':''}${goal?' suggested':''}" transform="translate(${digits(p.x)} ${digits(p.y)})" tabindex="0" role="button" data-act="contourNode" data-id="${esc(b.id)}" aria-label="${esc(name(b)+', '+state(b))}">
   <circle r="19" fill="transparent" class="contour-hit"/>
   ${ring?'<circle class="contour-ring" r="13.5" fill="none" stroke="'+ring+'" stroke-width="2"'+(ready||goal?' stroke-dasharray="4 3"':'')+'/>':''}
   ${mark}<title>${esc(name(b)+': '+state(b))}</title></g>${label}`;
 }).join('');
}

function fieldArtwork(fields,world,center,scale){
 const filled=fields.map(f=>`<path d="${svgPath(f.polygon,center,scale)}" class="contour-owned-field"/>`).join('');
 const vortices=fields.map(f=>{
  const p=at(f.center,center,scale),a=at(f.anchor,center,scale);
  return `<g class="contour-vortex-map"><path d="M${digits(a.x)} ${digits(a.y)}L${digits(p.x)} ${digits(p.y)}" class="contour-harvest-route"/>
   <circle cx="${digits(p.x)}" cy="${digits(p.y)}" r="17" fill="#ff923010" stroke="#ee8e4666"/>
   <circle cx="${digits(p.x)}" cy="${digits(p.y)}" r="10" fill="#f7793155" stroke="#ffc074"/>
   <circle cx="${digits(p.x)}" cy="${digits(p.y)}" r="4" fill="#241323" stroke="#ffe2a1"/>
   <title>Огненная воронка · сбор флюкса</title></g>`;
 }).join('');
 const byId=new Map(fields.map(f=>[f.id,f]));
 const harvesters=world.contours.harvesters.map(h=>{
  const f=byId.get(h.fieldId);if(!f)return '';
  const t=h.phase==='out'?Math.min(1,h.progress):h.phase==='back'?1-Math.min(1,h.progress):1;
  const p=at({x:f.anchor.x+(f.center.x-f.anchor.x)*t,
   y:f.anchor.y+(f.center.y-f.anchor.y)*t},center,scale);
  return `<g class="contour-courier"><circle cx="${digits(p.x)}" cy="${digits(p.y)}" r="4" fill="${h.phase==='back'?'#ffd17f':'#91f8df'}" stroke="#112c3a" stroke-width="1.5"/><title>${h.phase==='back'?'Флюкс возвращается на станцию':'Сборщик летит к воронке'}</title></g>`;
 }).join('');
 return filled+vortices+harvesters;
}

function selectedPanel(game,selected,source,choices,region){
 const lead='<div class="contour-guide-kicker">СЛЕДУЮЩЕЕ ДЕЙСТВИЕ</div>';
 if(!region)return `<section class="contour-guide">${lead}<h3>Выберите регион</h3>
  <p>На большой карте показаны все пять областей. Нажмите область, чтобы увидеть станции и линии.</p></section>`;
 if(!selected){
  const own=[...game.world.stations.values()].filter(b=>b.active&&!b.enemy&&
   Math.hypot(b.x-region.survey.x,b.y-region.survey.y)<5300);
  return `<section class="contour-guide">${lead}<h3>${own.length?'Выберите свою станцию':'Найдите первую станцию'}</h3>
   <p>${own.length?'Светящиеся бирюзовые узлы уже работают. Выберите один, чтобы увидеть возможные соединения.':
    'В этом участке пока нет работающего узла. Выберите станцию на карте и проложите к ней маршрут.'}</p></section>`;
 }
 const title=esc(name(selected));
 if(!selected.active||selected.enemy||selected.suppressed){
  const unknown=!selected.discovered&&!selected.strategicRole&&!selected.active;
  const reason=unknown?'Подлетите к узлу, чтобы выяснить, работает ли он и кому принадлежит.':
   selected.suppressed?'Восстановите передатчик, чтобы вернуть его связи.':
   selected.enemy?'Захватите станцию в полёте, прежде чем соединять её со своей сетью.':
   'Доберитесь до станции и включите её. Только после этого от неё можно проводить линии.';
  return `<section class="contour-guide">${lead}<h3>${title}</h3><span class="contour-guide-state blocked">${esc(state(selected))}</span>
   <p>${reason}</p>${route(selected)}</section>`;
 }
 const suggestions=source&&choices.ready.slice(0,3).map(({node,preview},index)=>{
  const closes=preview.areaGain>1;
  const extra=closes?'Замкнёт поле · +'+digits(preview.areaGain/1000000)+' усл. км² · +'+digits(preview.productionGain)+' флюкса / 3 мин':
   'Новая связь · территория появится после замыкания';
  return `<button class="contour-choice${closes?' closing':''}" data-act="contourConnect" data-from="${esc(source.id)}" data-id="${esc(node.id)}">
   <span><b>${index+1}. ${esc(name(node))}</b><small>${extra}</small></span><span aria-hidden="true">↗</span></button>`;
 }).join('');
 if(suggestions)return `<section class="contour-guide">${lead}<h3>${title}</h3>
  <p>Выберите вторую станцию на карте или нажмите подходящее соединение:</p><div class="contour-choices">${suggestions}</div>
  <button class="contour-cancel" data-act="contourCancel">Снять выбор</button></section>`;
 if(source){
  const next=choices.next[0]?.node;
  return `<section class="contour-guide">${lead}<h3>Нужна ещё одна станция</h3>
   <p>У выбранной станции пока нет работающего соседа в пределах ${CONTOURS.maxLength} м. ${next?'Ближайший кандидат отмечен янтарным кольцом.':'Исследуйте соседние участки.'}</p>
   ${next?route(next):''}<button class="contour-cancel" data-act="contourCancel">Снять выбор</button></section>`;
 }
 return `<section class="contour-guide">${lead}<h3>${title}</h3><p>Станция включена. Выберите её, чтобы начать соединение.</p>${route(selected)}</section>`;
}

export function renderContourMap(game){
 const world=game.world,region=REGIONS.find(r=>r.id===game.contourRegion)||null;
 const center=region?region.survey:{x:0,y:0},scale=region?(region.id==='amethyst'?.055:.049):.0035;
 const nearby=region?world.nearbyStations(center.x,center.y,5300,true):[];
 const map=new Map(nearby.map(s=>[s.id,s]));
 if(region)for(const s of world.stations.values())if(s.active||s.discovered||s.strategicRole)map.set(s.id,s);
 const nodes=[...map.values()].filter(s=>{const p=at(s,center,scale);
  return p.x>18&&p.x<662&&p.y>18&&p.y<462;});
 const fields=contourFields(world),area=contourArea(fields),production=contourProduction(fields);
 // Enemy trunks are a separate, opt-in layer. Discovery of both ends and a
 // player's laboratory are prerequisites; no unseen map data can leak here.
 const enemyTrunks=labLogisticsUnlocked(world)?visibleBackbone(game):[];
 const showTrunks=!!game.enemyBackboneMap&&enemyTrunks.length>0;
 const trunkLines=showTrunks&&!region?enemyTrunks.map(link=>{
  const a=world.stations.get(link.a),b=world.stations.get(link.b);
  return `<path d="${pathLine(a,b,center,scale)}" class="${link.active?'contour-hostile-trunk':'contour-hostile-broken'}"><title>${esc(link.titleA)} — ${esc(link.titleB)}: ${link.active?'передача возможна':'связь прервана'}</title></path>`;
 }).join(''):'';
 const trunkPanel=enemyTrunks.length?`<details class="contour-radio"${showTrunks?' open':''}><summary>Радиосеть машин · ${enemyTrunks.filter(l=>l.active).length} из ${enemyTrunks.length} известных линий работают</summary>
  <p>Известные соединения между вражескими станциями. По ним предупреждения переходят из региона в регион с задержкой.</p>
  <button data-act="contourEnemyRadio" aria-pressed="${showTrunks}">${showTrunks?'Скрыть радиолинии':'Показать радиолинии на всей карте'}</button>
  <ul>${enemyTrunks.slice(0,8).map(link=>`<li><b>${link.active?'Передаёт':'Оборвана'}</b> · ${esc(link.titleA)} — ${esc(link.titleB)}</li>`).join('')}</ul>
  <small>Захват станции и радиопомехи разрывают соединение. Архивные сведения не содержат текущего положения корабля.</small></details>`:'';
 const inside=fieldAt(world,game.player.x,game.player.y,fields);
 const pulseReady=inside&&world.contours.flux>=5&&game.time>=(world.contours.pulseReadyAt||0)&&game.player.shield<42;
 const source=world.stations.get(game.contourFirst),selected=world.stations.get(game.contourSelection)||source;
 const choices=source&&region?contourConnectionChoices(world,source.id,nodes):{ready:[],next:[]};
 const best=choices.ready[0],goals=source&&!choices.ready.length?choices.next.slice(0,1):[];
 // Label only the strongest proposals; a thicket of labels would hide the map.
 const readyIds=new Set(choices.ready.slice(0,4).map(c=>c.node.id));
 const goalIds=new Set(goals.map(c=>c.node.id));
 const paths=world.contours.links.map(([a,b])=>{
  const x=world.stations.get(a),y=world.stations.get(b);if(!x||!y)return '';
  const healthy=x.active&&y.active&&!x.enemy&&!y.enemy&&!x.suppressed&&!y.suppressed;
  return `<path d="${pathLine(x,y,center,scale)}" class="${healthy?'contour-live-link':'contour-broken-link'}"/>`;
 }).join('');
 const prospects=source&&region?choices.ready.slice(0,4).map((c,i)=>
  `<path d="${pathLine(source,c.node,center,scale)}" class="${i===0?'contour-best-link':'contour-possible-link'}"/>`).join('')+
  goals.map(c=>`<path d="${pathLine(source,c.node,center,scale)}" class="contour-goal-link"/>`).join(''):'';
 const ghost=best?.preview.areaGain>1?best.preview.newFields.map(f=>
  `<path d="${svgPath(f.polygon,center,scale)}" class="contour-future-field"/>`).join(''):'';
 const player=at(game.player,center,scale),visiblePlayer=region&&player.x>14&&player.x<666&&player.y>14&&player.y<466;
 const regions='<button data-act="contourRegion" data-id="all" aria-pressed="'+!region+'">Вся карта</button>'+
  REGIONS.map(r=>'<button data-act="contourRegion" data-id="'+r.id+'" aria-pressed="'+(region?.id===r.id)+'">'+r.number+' · '+esc(r.name)+'</button>').join('');
 const stage=area>0?'Поле действует · сборщики перевозят флюкс':source?'Выберите вторую станцию или цель для разведки':
  region?'Выберите станцию на карте':'Выберите регион, чтобы приблизить карту';
 const feedback=game.contourFeedback;
 const flash=feedback&&game.time-feedback.at<15?`<div class="contour-feedback" role="status"><b>${esc(feedback.title)}</b><span>${esc(feedback.text)}</span></div>`:'';
 const current=regionAt(game.player.x,game.player.y);
 const broken=world.contours.links.filter(([a,b])=>{
  const x=world.stations.get(a),y=world.stations.get(b);
  return !x?.active||!y?.active||x.enemy||y.enemy||x.suppressed||y.suppressed;
 }).length;
 const links=selected?world.contours.links.filter(pair=>pair.includes(selected.id)).map(pair=>
  world.stations.get(pair.find(id=>id!==selected.id))).filter(Boolean):[];
 const extra=links.length?`<details class="contour-links"><summary>Связи узла (${links.length})</summary>${links.map(b=>
  `<div><span>${esc(name(b))}</span><button data-act="contourUnlink" data-id="${esc(b.id)}" data-from="${esc(selected.id)}">Разорвать</button></div>`).join('')}</details>`:'';
 const activeSource=selected&&selected.active&&!selected.enemy&&!selected.suppressed;
 return `<div class="dialog map-dialog contour-dialog" role="dialog" aria-modal="true" aria-labelledby="map-menu-title">
  <header class="map-heading"><div><span class="map-kicker">СТРАТЕГИЧЕСКАЯ СЕТЬ</span><h2 id="map-menu-title">Контуры территорий</h2>
  <p>Станции → линии → замкнутая территория → флюкс. Каждая новая связь меняет реальный космос.</p></div>
  <div class="map-heading-actions"><span class="contour-wallet">Флюкс <b>${digits(world.contours.flux)}</b> / ${CONTOURS.fluxCap}</span>
  ${game.mapReturnToBase&&game.docked?'<button data-act="baseBack">← К станции</button>':''}<button data-act="close">В полёт · Esc</button></div></header>
  <nav class="map-view-switch"><button data-act="mapView" data-id="map">Ближняя карта</button>
  <button data-act="mapView" data-id="territory" aria-pressed="true">Контуры</button><button data-act="mapView" data-id="targets">Регионы и цели</button></nav>
  <div class="contour-region-switch">${regions}</div>
  <section class="map-shell contour-shell"><div class="map-canvas contour-map-canvas">
  <div class="contour-map-caption"><span>${region?esc(region.name):'КАРТА ПЯТИ РЕГИОНОВ'}</span><small>${esc(stage)}</small></div>
  <svg class="contour-chart" viewBox="0 0 680 480" role="group" aria-label="${region?'Выбор станций и линий':'Выбор региона'}">
  <defs><radialGradient id="contourAtlasGlow"><stop offset="0" stop-color="#1a5064" stop-opacity=".45"/><stop offset="1" stop-color="#071a2b" stop-opacity="0"/></radialGradient></defs>
  <rect width="680" height="480" rx="12" fill="#081a2a"/><circle cx="340" cy="240" r="300" fill="url(#contourAtlasGlow)"/>
  <path d="M0 120H680M0 240H680M0 360H680M170 0V480M340 0V480M510 0V480" stroke="#5b9cb21a" stroke-dasharray="3 8"/>
  ${region?fieldArtwork(fields,world,center,scale)+ghost+paths+prospects+
   stationMarks(nodes,center,scale,selected?.id,source?.id,readyIds,goalIds):trunkLines+regionOverview(world,center,scale)}
  ${visiblePlayer?`<g class="contour-player-pin" transform="translate(${digits(player.x)} ${digits(player.y)})"><circle r="12" fill="#9dd9ff12" stroke="#d7faff" stroke-dasharray="3 3"/><path d="M0 -7L-5 5L0 2L5 5Z" fill="#fff"/><title>Ваш корабль</title></g>`:''}</svg>
  <div class="contour-legend"><span><i class="contour-key mine"></i> Своя</span><span><i class="contour-key dormant"></i> Не включена</span>
  <span><i class="contour-key hostile"></i> Враг</span><span><i class="contour-key available"></i> Возможная связь</span><span><i class="contour-key vortex"></i> Воронка</span></div>
  <div class="contour-context">${esc(current.name)} · ${esc(stage)}${source?'<button data-act="contourCancel">Снять выбор</button>':''}</div>
  </div><aside class="map-side contour-side"><div class="contour-summary" aria-label="Итоги сети">
  <div><small>ТЕРРИТОРИИ</small><strong>${fields.length}</strong></div><div><small>ДОБЫЧА / 3 МИН</small><strong>${digits(production)}</strong></div>
  <div><small>СБОРЩИКИ В ПУТИ</small><strong>${world.contours.harvesters.length}</strong></div></div>
  ${flash}${game.contourError?`<p class="contour-error" role="status">${esc(game.contourError)}</p>`:''}
  ${selectedPanel(game,selected,source,choices,region)}
  ${trunkPanel}
  ${fields.length?`<div class="contour-economy"><b>Воронки работают</b><p>Флюкс доставлен: ${digits(world.contours.delivered)} · потери сборщиков: ${world.contours.lost}. Желтые точки возвращаются с грузом, бирюзовые летят к воронке.</p>
   <button data-act="contourPulse"${pulseReady?'':' disabled'}>${(world.contours.pulseReadyAt||0)>game.time?'Импульс через '+Math.ceil(world.contours.pulseReadyAt-game.time)+' с':
   'Защитный импульс · 5 флюкса · +22 щита'}</button><small>Доступен, когда корабль находится внутри поля и щит ниже 42.</small></div>`:''}
  ${broken?`<p class="contour-warning">⚠ Нарушено связей: ${broken}. Красный пунктир показывает линии без питания.</p>`:''}
  ${activeSource?extra:''}
  <details class="contour-rules"><summary>Как устроена сеть</summary><p>Соединяйте только работающие станции. Линия не длиннее ${CONTOURS.maxLength} м; на один узел приходится не более ${CONTOURS.maxDegree} связей. Замкните три или более узлов — область станет вашей, а внутри появится воронка. Линии не должны пересекаться.</p><p>Если станция подавлена или захвачена, связанные с ней линии перестают питать поле. Восстановите узел, чтобы вернуть территорию.</p></details>
  </aside></section></div>`;
}
