import {menuInfo} from './menu-screens.js?v=all-menus-1';
import {REGIONS,regionAt} from './regions.js?v=regions-1';
import {baseNames} from './balance.js?v=arcade-network-20';
import {CONTOURS,contourFields,contourArea,contourProduction,fieldAt,contourReserveEligible} from './territory-system.js?v=contours-2-operational-reserve-1-flux-offense-1';
import {contourConnectionChoices,contourCandidateInstruction} from './contour-preview.js?v=contour-visual-1-menu-focus-1-menu-reaudit-1-automatic-contours-1';
import {menuIcon} from './menu-icons.js?v=menu-focus-1';
import {visibleBackbone} from './enemy-backbone.js?v=enemy-backbone-2-flux-offense-1-territory-war-1';
import {labLogisticsUnlocked} from './station-progression.js?v=lab-logistics-qa-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-unified-controls-1';
import {renderWorldFeedbackMap} from './world-feedback.js?v=world-feedback-1';
import {atlasPoint,atlasGeography,atlasNebulae,atlasStars,atlasLiveObjects,atlasNavigation} from './contour-cartography.js?v=living-atlas-3-map-ux-1-map-art-1';
import {syncContourDynamics,activeContourTransition,fieldIsNew,enemyContourThreats} from './contour-dynamics.js?v=contour-dynamics-2-auto-1';
import {knownEnemyFields,enemyExpansionPlan} from './enemy-expansion.js?v=enemy-expansion-1-enemy-balance-2';
import {mapViewport,mapTools} from './map-navigation.js?v=map-ux-1';
import {firstContourPlan} from './contour-plan.js?v=map-ux-1';
import {fluxSortieOffer,FLUX_SORTIE} from './flux-offense.js?v=flux-offense-1-territory-war-1';
import {warFronts} from './war-fronts.js?v=campaign-1-repair-qa-1-enemy-balance-2-territory-war-1';
import {chartBackdrop,chartFrame,stationGlyph,pilotGlyph} from './map-art.js?v=map-art-1';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=b=>!b.discovered&&!b.active&&!b.strategicRole?'Неизвестный узел':
 b.title||baseNames[b.type]||'Станция';
const state=b=>!b.discovered&&!b.active&&!b.strategicRole?'не исследована':
 b.suppressed?'передатчик подавлен':b.enemy?'вражеская станция':
 b.active?'включена':'не включена';
const at=atlasPoint;
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

// The overview uses the same physical station coordinates as the regional map.
// The region controls frame each constellation but must not cover its nodes.
function regionOverview(world,center,scale,fields=[]){
 return REGIONS.map(r=>{
  const p=at(r.survey,center,scale);
  // The southern label belongs below its region; above it would sit in the
  // home-region halo and become almost indistinguishable from its title.
  const labelY=r.id==='azure'?70:-61;
  // The northern badge would collide with the home-region name if placed
  // below its cluster. Shift only this one to the free eastern side.
  const badgeX=r.id==='lilac'?27:-29,badgeY=r.id==='lilac'?-12:33;
  const sites=world.nearbyStations(r.survey.x,r.survey.y,5100,true);
  const count=new Set(sites.map(b=>b.id)).size;
  const owned=sites.filter(b=>b.active&&!b.enemy&&!b.suppressed).length;
  const occupied=fields.filter(f=>regionAt(f.center.x,f.center.y).id===r.id).length;
  return `<g class="contour-region" role="button" tabindex="0" data-act="contourRegion" data-id="${r.id}" aria-label="${esc(r.name)}. Работает ${owned} из ${count} узлов" transform="translate(${digits(p.x)} ${digits(p.y)})">
   <circle class="contour-region-halo" r="49" fill="${r.color}06" stroke="${r.color}70" stroke-width="1.5"/>
   <circle r="26" fill="none" stroke="${r.color}50" stroke-dasharray="3 6" stroke-width="1.2"/>
   <text class="contour-region-index" x="-44" y="-31">0${r.number}</text>
   <rect x="${badgeX}" y="${badgeY}" width="58" height="22" rx="10" fill="#071a2be8" stroke="${r.color}aa" stroke-width="1"/>
   <text x="${badgeX+29}" y="${badgeY+15}" text-anchor="middle" fill="#f1faff" font-size="12" font-weight="800" class="contour-region-count">${owned} / ${count}</text>
   <text y="${labelY}" text-anchor="middle" fill="${r.color}" font-size="12" font-weight="700" class="contour-region-name">${esc(r.name)}</text>
   <text y="${labelY}" text-anchor="middle" fill="${r.color}" class="contour-region-short" aria-hidden="true">${({amethyst:'Аметист',amber:'Янтарь',azure:'Разлом',lilac:'Предел',teal:'Бездна'})[r.id]}</text>
   ${occupied?`<text y="${labelY===70?-57:72}" text-anchor="middle" class="contour-region-claims">Контуров: ${occupied}</text>`:''}
   <circle r="53" fill="transparent"/></g>`;
 }).join('');
}
function overviewStations(world,center,scale){
 // Unknown dots reveal surveyed *positions*, not faction, type or enemy plans.
 // All five regions are generated by regionOverview before this is rendered.
 // An unsurveyed distant factory must not appear just because some other
 // subsystem has instantiated it in memory.
 const known=b=>b.discovered||b.active||b.strategicRole;
 const charted=b=>REGIONS.some(r=>Math.hypot(b.x-r.survey.x,b.y-r.survey.y)<5500);
 return '<g class="contour-global-constellations" aria-hidden="true">'+[...world.stations.values()].filter(b=>known(b)||charted(b)).map(b=>{
  const p=at(b,center,scale);
  if(p.x<6||p.x>674||p.y<6||p.y>474)return '';
  const revealed=known(b);
  const kind=!revealed?'unknown':b.enemy?'hostile':b.active?'owned':'known';
  const radius=!revealed?1.6:b.active?3.2:2.6;
  return `<circle class="contour-global-station ${kind}" cx="${digits(p.x)}" cy="${digits(p.y)}" r="${radius}"><title>${esc(name(b))}</title></circle>`;
 }).join('')+'</g>';
}

function stationMarks(nodes,center,scale,selectedId,sourceId,readyIds,goalIds,waypoint=null,planIds=new Set()){
 return nodes.map(b=>{
  const p=at(b,center,scale),picked=b.id===selectedId||b.id===sourceId;
  const ready=readyIds.has(b.id),goal=goalIds.has(b.id),known=!!(b.discovered||b.active||b.strategicRole);
  const fill=b.suppressed?'#cf95ec':b.enemy&&known?'#ff7786':b.active?'#86f5d7':
   known?'#edc783':'#9baebc';
  const ring=ready?'#7effd8':goal?'#ffcc85':picked?'#ffe5aa':planIds.has(b.id)?'#ffdb90':null;
  const mark=stationGlyph(b.type,{known,color:fill,hostile:known&&b.enemy,active:b.active&&!b.enemy});
  const labelWidth=name(b).length*6.5;
  const labelConflict=waypoint&&Math.abs(waypoint.y-(p.y-17))<22&&
   waypoint.x>=p.x+5&&waypoint.x<=p.x+labelWidth+28;
  const label=(picked||ready||goal||b.active)&&known?
   '<text x="'+digits(p.x+(labelConflict?-13:13))+'" y="'+digits(p.y-13)+
   '" data-label-priority="'+(picked?'selected':goal?'next':'node')+'" class="contour-map-label"'+(labelConflict?' text-anchor="end"':'')+'>'+esc(name(b))+'</text>':'';
  return `<g class="contour-node${picked?' selected':''}${ready?' connectable':''}${goal?' suggested':''}${planIds.has(b.id)?' planned':''}" transform="translate(${digits(p.x)} ${digits(p.y)})" tabindex="0" role="button" data-act="contourNode" data-id="${esc(b.id)}" aria-label="${esc(name(b)+', '+state(b))}">
   <circle r="19" fill="transparent" class="contour-hit"/>
   ${ring?'<circle class="contour-ring" r="13.5" fill="none" stroke="'+ring+'" stroke-width="2"'+(ready||goal?' stroke-dasharray="4 3"':'')+'/>':''}
   ${mark}<title>${esc(name(b)+': '+state(b))}</title></g>${label}`;
 }).join('');
}

function proposedContourArtwork(plan,center,scale){
 if(!plan)return '';
 return `<g class="contour-first-plan" aria-hidden="true">
  <path d="${svgPath(plan.stations,center,scale)}" class="contour-plan-area"/>
  ${plan.edges.filter(e=>!e.built).map(e=>`<path d="${pathLine(e.a,e.b,center,scale)}" class="${e.ready?'contour-plan-ready':'contour-plan-future'}"/>`).join('')}
  </g>`;
}

function firstContourGuide(plan,showNext=true){
 if(!plan)return '';
 const list=plan.stations.map((b,i)=>{
  const working=b.active&&!b.enemy&&!b.suppressed;
  const known=b.active||b.discovered||b.strategicRole;
  const caption=working?'Включена':!known?'Нужно разведать':'Нужно включить';
  return `<li class="${working?'done':''}"><span>${i+1}. ${esc(name(b))}</span><small>${caption}</small></li>`;
 }).join('');
 return `<section class="contour-first-guide" aria-label="План первого энергетического контура">
  <b>ПЕРВЫЙ ЭНЕРГЕТИЧЕСКИЙ КОНТУР</b>
  <div class="contour-first-progress">Работают ${plan.active} из 3 станций</div>
  <p>Включите три отмеченные станции. Как только они смогут образовать треугольник, линии соединятся сами, территория заполнится энергией и появится воронка.</p>
  <button class="contour-plan-focus" data-act="mapFocusPlan" data-ids="${plan.stations.map(b=>esc(b.id)).join(',')}">Показать треугольник целиком</button>
  <ol>${list}</ol>
  ${plan.uncertain?'<small>Неизвестные станции пока только кандидаты. Их принадлежность выяснится после разведки.</small>':''}
  ${showNext?(plan.next?`<p>Следующий шаг: ${esc(contourCandidateInstruction(plan.next))}</p>${route(plan.next)}`:
   '<p>Все три станции работают. Проверьте, не мешают ли связи расстояние и соседние узлы.</p>'):''}
  <small>Площадь будущего поля: ${(plan.area/1000000).toFixed(2)} усл. км². Максимальная длина связи — ${CONTOURS.maxLength} м.</small>
 </section>`;
}

function fieldArtwork(fields,world,center,scale,transition,overview=false){
 const claiming=transition?.kind==='claim';
 const fresh=f=>claiming&&fieldIsNew(f,transition.previous);
 const paths=fields.map(f=>`<path d="${svgPath(f.polygon,center,scale)}" class="contour-owned-field"/>`).join('');
 // Draw the already owned intersection immediately, but animate *all* new
 // area even when its polygon surrounds the old land. Centre tests fail here.
 const filled=claiming?`<defs><mask id="contourOldLand" maskUnits="userSpaceOnUse" x="0" y="0" width="680" height="480"><rect width="680" height="480" fill="black"/>${transition.previous.map(f=>`<path d="${svgPath(f.polygon,center,scale)}" fill="white"/>`).join('')}</mask>
  <mask id="contourAddedLand" maskUnits="userSpaceOnUse" x="0" y="0" width="680" height="480"><rect width="680" height="480" fill="white"/>${transition.previous.map(f=>`<path d="${svgPath(f.polygon,center,scale)}" fill="black"/>`).join('')}</mask></defs>
  <g mask="url(#contourOldLand)">${paths}</g><g mask="url(#contourAddedLand)">${fields.map(f=>`<path d="${svgPath(f.polygon,center,scale)}" class="contour-owned-field contour-forming"/>`).join('')}</g>`:paths;
 // The old boundary is a temporary afterimage only where land was actually
 // lost. Mask surviving polygons, otherwise a redraw would look like a loss.
 const loss=transition?.kind==='loss'?`<defs><mask id="contourRetreatMask" maskUnits="userSpaceOnUse" x="0" y="0" width="680" height="480"><rect width="680" height="480" fill="white"/>${fields.map(f=>`<path d="${svgPath(f.polygon,center,scale)}" fill="black"/>`).join('')}</mask></defs>
  <g class="contour-retreat" mask="url(#contourRetreatMask)">${transition.previous.map(f=>`<path d="${svgPath(f.polygon,center,scale)}"/>`).join('')}</g>`:'';
 const changed=claiming?[...new Map(transition.current.filter(f=>fresh(f)).flatMap(f=>
  f.vertices.map((id,i)=>{
   const other=f.vertices[(i+1)%f.vertices.length];
   return [[id,other].sort().join('|'),[id,other]];
  }))).values()]:[];
 // Energy runs along real physical links before the land fills.
 const surge=claiming?`<g class="contour-claim-surges">${changed.map(([a,b])=>{
  const x=world.stations.get(a),y=world.stations.get(b);
  return x&&y?`<path d="${pathLine(x,y,center,scale)}" pathLength="100"/>`:'';
 }).join('')}</g>`:'';
 const vortices=fields.map(f=>{
  const p=at(f.center,center,scale),a=at(f.anchor,center,scale);
  const size=overview ? .45 : 1,side=36*size;
  return `<g class="contour-vortex-map${fresh(f)?' contour-vortex-forming':''}">${overview?'':`<path d="M${digits(a.x)} ${digits(a.y)}L${digits(p.x)} ${digits(p.y)}" class="contour-harvest-route"/>`}
   <circle cx="${digits(p.x)}" cy="${digits(p.y)}" r="${digits(17*size)}" fill="#ff923010" stroke="#ee8e4666"/>
   <circle cx="${digits(p.x)}" cy="${digits(p.y)}" r="${digits(10*size)}" fill="#f7793155" stroke="#ffc074"/>
   <circle cx="${digits(p.x)}" cy="${digits(p.y)}" r="${digits(4*size)}" fill="#241323" stroke="#ffe2a1"/>
   <image class="contour-vortex-icon" href="../assets/space/contour-vortex-icon.webp" x="${digits(p.x-side/2)}" y="${digits(p.y-side/2)}" width="${digits(side)}" height="${digits(side)}" preserveAspectRatio="xMidYMid meet"/>
   <title>Огненная воронка · сбор флюкса</title></g>`;
 }).join('');
 if(overview)return `<g class="contour-global-ownership">${loss+filled+surge+vortices}</g>`;
 const byId=new Map(fields.map(f=>[f.id,f]));
 const harvesters=world.contours.harvesters.map(h=>{
  const f=byId.get(h.fieldId);if(!f)return '';
  const t=h.phase==='out'?Math.min(1,h.progress):h.phase==='back'?1-Math.min(1,h.progress):1;
  const p=at({x:f.anchor.x+(f.center.x-f.anchor.x)*t,
   y:f.anchor.y+(f.center.y-f.anchor.y)*t},center,scale);
  return `<g class="contour-courier"><circle cx="${digits(p.x)}" cy="${digits(p.y)}" r="4" fill="${h.phase==='back'?'#ffd17f':'#91f8df'}" stroke="#112c3a" stroke-width="1.5"/><title>${h.phase==='back'?'Флюкс возвращается на станцию':'Сборщик летит к воронке'}</title></g>`;
 }).join('');
 return loss+filled+surge+vortices+harvesters;
}

function enemyThreatArtwork(threats,center,scale){
 return `<g class="contour-enemy-threats">${threats.map((plan,i)=>{
  const p=at(plan.target,center,scale);
  const mask='contourThreatRisk'+i;
  return `<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="680" height="480"><rect width="680" height="480" fill="white"/>${plan.remaining.map(f=>`<path d="${svgPath(f.polygon,center,scale)}" fill="black"/>`).join('')}</mask></defs>
   <g mask="url(#${mask})">${plan.area>1?plan.fields.map(f=>`<path d="${svgPath(f.polygon,center,scale)}" class="contour-threat-field"/>`).join(''):''}</g>
   ${plan.ship?`<path d="${pathLine(plan.ship,plan.target,center,scale)}" class="contour-threat-route"/>`:''}
   ${plan.supports.slice(0,5).map(s=>{const q=at(s,center,scale);return `<circle class="contour-threat-support" cx="${digits(q.x)}" cy="${digits(q.y)}" r="11"><title>Опора того же поля: ${esc(name(s))}</title></circle>`;}).join('')}
   <g transform="translate(${digits(p.x)} ${digits(p.y)})" class="contour-threat-target" role="img" aria-label="Под угрозой: ${esc(name(plan.target))}">
   <circle r="19"/><path d="M-6 0H6M0-6V6"/><title>Носитель помех направлен на ${esc(name(plan.target))}. При подавлении связь контура оборвётся.</title></g>`;
 }).join('')}</g>`;
}

function enemyDomainArtwork(world,enemyFields,plan,center,scale,region,now){
 const born=world.enemyExpansion?.events?.find(e=>e.kind==='claim'&&now>=e.at&&now-e.at<6);
 const owned=enemyFields.map(f=>{
  const p=at(f.center,center,scale);
  const forming=born&&f.vertices.includes(born.a)&&f.vertices.includes(born.b);
  return `<path class="contour-enemy-land${forming?' contour-enemy-forming':''}" d="${svgPath(f.polygon,center,scale)}"><title>Территория машин · захват опорной станции разорвёт её сеть</title></path>
   <circle class="contour-enemy-reactor" cx="${digits(p.x)}" cy="${digits(p.y)}" r="${region?6:3}"><title>Вражеский источник сырья</title></circle>`;
 }).join('');
 const projected=plan&&(!region||plan.region===region.id)&&plan.seen.length?(
  plan.seen.length===3?`<g class="contour-enemy-projection">
   <path class="contour-enemy-proposed-field" d="${svgPath(plan.polygon,center,scale)}"/>
   ${plan.missing.map(([a,b])=>`<path class="contour-enemy-proposed-link" d="${pathLine(a,b,center,scale)}"/>`).join('')}</g>`:''
  )+plan.seen.map(s=>{
   const p=at(s,center,scale);
   return `<circle class="contour-enemy-objective" cx="${digits(p.x)}" cy="${digits(p.y)}" r="${region?13:7}"><title>Противник собирается соединить эту станцию</title></circle>`;
  }).join(''):'';
 return `<g class="contour-enemy-domains">${owned}${projected}</g>`;
}

function enemyExpansionPanel(plan){
 if(!plan?.seen.length)return '';
 const known=plan.seen.length;
 const visible=plan.seen.slice(0,3).map(s=>esc(name(s))).join(', ');
 return `<section class="contour-expansion-panel" aria-label="Территориальные планы противника">
  <b>РАСШИРЕНИЕ ВРАЖЕСКОЙ СЕТИ</b>
  <p>${known===3?'Три узла известны. Красный пунктир показывает возможное новое поле.':
   'Из трёх опор разведано '+known+'. Два вида предупреждений не раскрывают координат неизвестных узлов.'}</p>
  <small>Известные опоры: ${visible}. Противник расходует запасы промышленной сети на новые линии. Захват опоры или перехват снабжения мешает расширению.</small>
  ${route(plan.seen[0])}</section>`;
}

function enemyThreatPanel(threats){
 if(!threats.length)return '';
 return `<section class="contour-threat-panel" aria-label="Вражеские планы"><b>ВРАЖЕСКОЕ НАСТУПЛЕНИЕ · ${threats.length}</b>
  <p>Носители помех получили приказ атаковать опоры сети. Красная область показывает, какое поле может исчезнуть, если не защитить станцию. Это угроза подавления, а не уже захваченная территория.</p>
  ${threats.slice(0,2).map(plan=>`<div><strong>${esc(name(plan.target))}</strong><small>${plan.area>0?`Под угрозой ${(plan.area/1000000).toFixed(2)} усл. км². `:''}${plan.supports.length?`Другие опоры: ${esc(plan.supports.slice(0,3).map(name).join(', '))}. `:''}Связь можно сохранить, перехватив корабль.</small>${route(plan.target)}</div>`).join('')}
  </section>`;
}

// Only events with a confirmed world position get a map symbol. The feed
// intentionally omits locations for unseen factories and untraced radio calls.
function incidentArtwork(game,region,center,scale){
 const events=(game.worldFeedback?.history||[]).filter(event=>{
  const p=event.position,age=game.time-event.at;
  if(!p||age<0||age>180)return false;
  const q=at(p,center,scale);
  return q.x>=28&&q.x<=652&&q.y>=28&&q.y<=452;
 });
 const used=[];
 return events.map(event=>{
  const q=at(event.position,center,scale);
  if(used.length>=(region?3:4)||used.some(other=>Math.hypot(other.x-q.x,other.y-q.y)<(region?37:26)))return '';
  used.push(q);
  const label=esc(event.label.slice(0,22));
  const full=esc(event.cause+' → '+event.effect);
  return `<g class="contour-incident-pin ${event.kind==='loss'?'loss':'change'}" role="img"
   aria-label="${full}" transform="translate(${digits(q.x)} ${digits(q.y)})">
   <circle r="14" class="contour-incident-halo"/><path d="M0 -7L7 0L0 7L-7 0Z"/>
   <text x="12" y="-13">${label}</text><title>${full}</title></g>`;
 }).join('');
}

function selectedPanel(game,selected,choices,region){
 const lead='<div class="contour-guide-kicker">СЕТЬ РАБОТАЕТ САМА</div>';
 if(!region){
  const first=!contourFields(game.world).length;
  return `<section class="contour-guide">${lead}<h3>${first?'Начните первый контур':'Выберите регион'}</h3>
   <p>${first?'Включите или захватите три достаточно близкие станции. Их связи появятся автоматически, а замкнутый треугольник станет вашей территорией.':
    'На большой карте показаны все пять областей. Нажмите область, чтобы увидеть станции и линии.'}</p>
   ${first?`<button class="contour-choice" data-act="contourRegion" data-id="${regionAt(game.player.x,game.player.y).id}">Показать первые станции ↗</button>`:''}</section>`;
 }
 if(!selected){
  const own=[...game.world.stations.values()].filter(b=>b.active&&!b.enemy&&
   Math.hypot(b.x-region.survey.x,b.y-region.survey.y)<5300);
  return `<section class="contour-guide">${lead}<h3>${own.length?'Выберите свою станцию':'Найдите первую станцию'}</h3>
   <p>${own.length?'Светящиеся бирюзовые узлы уже работают. Выберите станцию, чтобы проверить её связи и соседей.':
    'В этом участке пока нет работающего узла. Выберите станцию на карте и проложите к ней маршрут.'}</p></section>`;
 }
 const title=esc(name(selected));
 if(!selected.active||selected.enemy||selected.suppressed){
  const reason=contourCandidateInstruction(selected);
  return `<section class="contour-guide">${lead}<h3>${title}</h3><span class="contour-guide-state blocked">${esc(state(selected))}</span>
   <p>${reason}</p>${route(selected)}</section>`;
 }
 const linked=(game.world.contours?.links||[]).filter(pair=>pair.includes(selected.id)).length;
 const next=choices.next[0]?.node;
 return `<section class="contour-guide">${lead}<h3>${title}</h3>
  <p>Связей: ${linked}. ${linked?'Станция включена в территориальную сеть.':'Пока рядом нет подходящей работающей опоры.'}
  Новые линии появятся сами при включении соседних узлов в пределах ${CONTOURS.maxLength} м.</p>
  ${next?`<p>Ближайшая цель: ${esc(name(next))}. ${esc(contourCandidateInstruction(next))}</p>${route(next)}`:route(selected)}
  </section>`;
}

export function renderContourMap(game){
 const world=game.world,region=REGIONS.find(r=>r.id===game.contourRegion)||null;
 syncContourDynamics(game);
 const transition=activeContourTransition(game),threats=enemyContourThreats(game);
 const view=mapViewport(game),{center,scale}=view;
 const radius=Math.max(5300,Math.hypot(340,240)/scale+500);
 const nearby=region?world.nearbyStations(center.x,center.y,radius,true):[];
 const geography=atlasGeography(center,scale),nebulae=atlasNebulae(world.seed,center,scale,!region);
 const stars=atlasStars(world.seed,center,scale,!region);
 const physical=atlasLiveObjects(game,center,scale,!region);
 const navigation=atlasNavigation(game,center,scale,!region);
 const map=new Map(nearby.map(s=>[s.id,s]));
 if(region)for(const s of world.stations.values())if(s.active||s.discovered||s.strategicRole)map.set(s.id,s);
 const nodes=[...map.values()].filter(s=>{const p=at(s,center,scale);
  return p.x>18&&p.x<662&&p.y>18&&p.y<462;});
 const fields=contourFields(world),area=contourArea(fields),production=contourProduction(fields);
 const plan=region&&!fields.length?firstContourPlan(world,[...map.values()],
  game.contourFirst||game.contourSelection,game.player):null;
 // This also materializes the surveyed station locations for the full atlas.
 // Evaluate before overviewStations so the overview contains every node.
 const overview=region?'':regionOverview(world,center,scale,fields);
 const enemyFields=knownEnemyFields(world),enemyPlan=enemyExpansionPlan(world);
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
 const selected=world.stations.get(game.contourSelection);
 const choices=selected&&region?contourConnectionChoices(world,selected.id,[...map.values()]):{ready:[],next:[]};
 const planIds=new Set(plan?.stations.map(s=>s.id)||[]);
 const goals=selected&&!choices.ready.length?choices.next.slice(0,1):[];
 // Label only the strongest proposals; a thicket of labels would hide the map.
 const readyIds=new Set(choices.ready.slice(0,4).map(c=>c.node.id));
 const goalIds=new Set(goals.map(c=>c.node.id));
 const paths=world.contours.links.map(([a,b])=>{
  const x=world.stations.get(a),y=world.stations.get(b);if(!x||!y)return '';
  const healthy=x.active&&y.active&&!x.enemy&&!y.enemy&&!x.suppressed&&!y.suppressed;
  return `<path d="${pathLine(x,y,center,scale)}" class="${healthy?'contour-live-link':'contour-broken-link'}"/>`;
 }).join('');
 const prospects=selected&&region?goals.map(c=>
  `<path d="${pathLine(selected,c.node,center,scale)}" class="contour-goal-link"/>`).join(''):'';
 const player=at(game.player,center,scale),visiblePlayer=player.x>14&&player.x<666&&player.y>14&&player.y<466;
 const regions='<button data-act="contourRegion" data-id="all" aria-pressed="'+!region+'">Вся карта</button>'+
  REGIONS.map(r=>'<button data-act="contourRegion" data-id="'+r.id+'" aria-pressed="'+(region?.id===r.id)+'">'+r.number+' · '+esc(r.name)+'</button>').join('');
 const stage=transition?.kind==='claim'?'Контур замкнут · энергия заполняет новую территорию':
  transition?.kind==='loss'?'Связь потеряна · границы поля отступают':
  area>0?'Поле действует · сборщики перевозят флюкс':
  plan?'Включите три отмеченные станции · '+plan.active+'/3 работают':
  region?'Выберите станцию на карте':'Выберите регион, чтобы приблизить карту';
 const feedback=game.contourFeedback;
 const flash=feedback&&game.time-feedback.at<15?`<div class="contour-feedback" role="status"><b>${esc(feedback.title)}</b><span>${esc(feedback.text)}</span></div>`:'';
 const current=regionAt(game.player.x,game.player.y);
 const broken=world.contours.links.filter(([a,b])=>{
  const x=world.stations.get(a),y=world.stations.get(b);
  return !x?.active||!y?.active||x.enemy||y.enemy||x.suppressed||y.suppressed;
 }).length;
 const activeSource=selected&&selected.active&&!selected.enemy&&!selected.suppressed;
 const reserve=world.contours.reserve,reservedNode=reserve&&world.stations.get(reserve.stationId);
 const reserveEligible=selected&&contourReserveEligible(world,selected.id);
 const reservePanel=fields.length&&(activeSource||reserve?.stationId===selected?.id)?`<section class="contour-economy contour-reserve" aria-label="Флюксовый резерв">
  <b>Опора для вылазки</b>
  ${reserve?`<p>Ложный маяк: <strong>${esc(reservedNode?name(reservedNode):reserve.stationId)}</strong> · ${reserve.readyAt>game.time?
    'готов через '+Math.ceil(reserve.readyAt-game.time)+' с':'готов к налёту'}.</p>
   <small>Один маяк на всю сеть. Если носитель помех преодолеет ПВО выбранной станции, маяк один раз собьёт его с цели. Сам вражеский корабль останется в мире.</small>`:
   `<p>${reserveEligible?'Выбрана станция «'+esc(name(selected))+'».':'Выберите на карте работающую лабораторию, авианосную станцию или ретранслятор в замкнутом контуре.'}</p>
   ${reserveEligible?`<button data-act="contourReserve" data-id="${esc(selected.id)}"${world.contours.flux>=CONTOURS.reserveCost?'':' disabled'}>Установить ложный маяк · ${CONTOURS.reserveCost} флюкса</button>`:''}
   <small>Подготовка — ${CONTOURS.reserveArmSeconds} с. Защищает от одной попытки подавить связь, только если обычная ПВО не справится. Флюкс списывается сразу.</small>`}</section>`:'';
 const reservePin=reservedNode&&reserve?(()=>{
  const q=at(reservedNode,center,scale);
  return q.x>0&&q.x<680&&q.y>0&&q.y<480?
   `<g class="contour-reserve-pin" transform="translate(${digits(q.x)} ${digits(q.y)})" role="img" aria-label="Ложный маяк: ${esc(name(reservedNode))}">
   <circle r="18"/><path d="M-5 2L0 -8L5 2L0 8Z"/><title>Ложный маяк: ${esc(name(reservedNode))}</title></g>`:'';
 })():'';
 const sortie=world.contours.sortie,sortieTarget=sortie&&world.stations.get(sortie.targetId);
 const offensiveOffer=selected&&selected.enemy&&selected.discovered?
  fluxSortieOffer(world,selected.id,game.time):null;
 const selectedFront=selected&&warFronts(world).find(f=>f.depotId===selected.id);
 const knownRaid=labLogisticsUnlocked(world)&&selectedFront?.pool?.pendingRaid?.announced?
  selectedFront.pool.pendingRaid:null;
 const flightSeconds=offensiveOffer?.ok?Math.ceil(offensiveOffer.distance/FLUX_SORTIE.speed):0;
 const raidForecast=knownRaid?Math.ceil(Math.max(0,knownRaid.readyAt-game.time)):null;
 const sortieTiming=raidForecast===null?'':raidForecast<=flightSeconds?
  `<p class="contour-offense-warning">Разведка сообщает: подкрепление уже готово или отправится в ближайшие ${raidForecast} с. Постановщик летит ${flightSeconds} с и может не успеть остановить этот вылет.</p>`:
  `<p class="contour-offense-intel">Разведка: до ожидаемого вылета ${raidForecast} с. Постановщик может успеть перерезать связь.</p>`;
 const activeJam=selected?.enemy&&selected.discovered&&(selected.fluxJamUntil||0)>game.time;
 const activeBreach=selected?.enemy&&selected.discovered&&(selected.fluxBreachUntil||0)>game.time;
 const breachProgress=activeJam&&!activeBreach?Math.round(selected.fluxBreachProgress||0):0;
 const offensePanel=sortie&&sortieTarget?
  `<section class="contour-economy contour-offense" aria-label="Наступательная вылазка">
   <b>Постановщик помех в пути</b>
   <p>Цель: <strong>${esc(name(sortieTarget))}</strong> · до цели ${Math.ceil(Math.hypot(sortie.x-sortieTarget.x,sortie.y-sortieTarget.y))} м.</p>
   <small>Корабль можно перехватить. Если он долетит, связь пропадёт на ${FLUX_SORTIE.duration} с. В это время бейте по турелям, а после их уничтожения — по корпусу поста, чтобы остановить новые грузы.</small></section>`:
  offensiveOffer||activeJam?`<section class="contour-economy contour-offense" aria-label="Наступательная вылазка">
   <b>Нарушить снабжение противника</b>
   <p>${esc(name(selected))}${activeBreach?` · <strong>грузы остановлены до ${Math.ceil(selected.fluxBreachUntil-game.time)} с</strong>`:
    activeJam?` · <strong>радиопомехи ещё ${Math.ceil(selected.fluxJamUntil-game.time)} с</strong>`:''}</p>
   ${activeJam&&!activeBreach?`<p class="contour-offense-intel">ПРОРЫВ: нанесите ${110-breachProgress} урона лично своим оружием по турелям или открытому корпусу поста (${breachProgress}/110), пока действуют помехи.</p>`:''}
   ${activeBreach?'<p class="contour-offense-intel">Диверсия удалась. Для досрочного ремонта врагу придётся потратить промышленное сырьё. Уже отправленные конвои остаются в пути.</p>':''}
   ${sortieTiming}
   ${offensiveOffer?.ok?
    `<button data-act="contourSortie" data-id="${esc(selected.id)}">Отправить постановщик помех · ${FLUX_SORTIE.cost} флюкса</button>
     <small>Из контура до цели: ${Math.ceil(offensiveOffer.distance)} м · полёт около ${Math.ceil(offensiveOffer.distance/FLUX_SORTIE.speed)} с.</small>`:
    `<small>${esc(offensiveOffer?.reason||'Пост уже подавлен')}</small>`}
   <small>Помехи откладывают подкрепления. Длительная остановка производства требует боя у поста. Постановщик уязвим, старые грузы сохраняются.</small></section>`:'';
 const chartedDepots=warFronts(world).filter(f=>f.depot?.enemy&&f.depot.discovered);
 const offenseTargets=fields.length&&chartedDepots.length?
  `<details class="contour-offense-targets"${chartedDepots.some(f=>f.depot.id===selected?.id)||sortie?' open':''}>
   <summary>Промышленные цели · ${chartedDepots.length}</summary>
   <p>Налёт начинается из действующего контура. Выберите разведанный пост: карта переместится к нему и покажет условия запуска.</p>
   ${chartedDepots.map(f=>{
    const offer=fluxSortieOffer(world,f.depot.id,game.time);
    const label=f.depot.id===sortie?.targetId?'Постановщик в пути':
     (f.depot.fluxBreachUntil||0)>game.time?'Производство остановлено':
     (f.depot.fluxJamUntil||0)>game.time?'Помехи · атакуйте пост':
     offer.ok?'В досягаемости':offer.distance>FLUX_SORTIE.maxRange?'Вне зоны вылета':'Проверить условия';
    return `<button data-act="contourTarget" data-id="${esc(f.depot.id)}"${f.depot.id===selected?.id?' aria-current="true"':''}>
     <span>${esc(name(f.depot))}</span><small>${esc(label)}</small></button>`;
   }).join('')}</details>`:'';
 const sortiePin=sortie&&sortieTarget?(()=>{
  const p=at(sortie,center,scale),q=at(sortieTarget,center,scale);
  if(p.x<0||p.x>680||p.y<0||p.y>480)return '';
  return `<g class="contour-sortie-pin" role="img" aria-label="Постановщик помех летит к ${esc(name(sortieTarget))}">
   <path d="M${digits(p.x)} ${digits(p.y)}L${digits(q.x)} ${digits(q.y)}"/>
   <circle class="contour-sortie-halo" cx="${digits(p.x)}" cy="${digits(p.y)}" r="11"/>
   <path class="contour-sortie-ship" d="M${digits(p.x)} ${digits(p.y-7)}l6 12 -6 -3 -6 3Z"/>
   <title>Корабль-постановщик в пути: ${esc(name(sortieTarget))}</title></g>`;
 })():'';
 const jamPins=[...world.stations.values()].filter(b=>b.enemy&&b.discovered&&
  (b.fluxJamUntil||0)>game.time&&!(b.fluxBreachUntil>game.time)).map(b=>{
  const p=at(b,center,scale);
  return p.x<0||p.x>680||p.y<0||p.y>480?'':
   `<g class="contour-jam-pin" transform="translate(${digits(p.x)} ${digits(p.y)})" role="img" aria-label="Связь нарушена: ${esc(name(b))}">
   <circle r="17"/><path d="M-8 0H8M0 -8V8"/><title>Помехи ещё ${Math.ceil(b.fluxJamUntil-game.time)} с</title></g>`;
 }).join('');
 const breachPins=[...world.stations.values()].filter(b=>b.enemy&&b.discovered&&
  (b.fluxBreachUntil||0)>game.time).map(b=>{
  const p=at(b,center,scale);
  return p.x<0||p.x>680||p.y<0||p.y>480?'':
   `<g class="contour-jam-pin" transform="translate(${digits(p.x)} ${digits(p.y)})" role="img" aria-label="Производство остановлено: ${esc(name(b))}">
   <circle r="23" stroke="#ffcf7b" stroke-width="3" stroke-dasharray="7 4"/>
   <path d="M-11 -11L11 11M11 -11L-11 11" stroke="#ffcf7b" stroke-width="3"/>
   <title>Грузы не выходят. Восстановление не позже ${Math.ceil(b.fluxBreachUntil-game.time)} с, возможно раньше за сырьё.</title></g>`;
 }).join('');
 return `<div class="dialog map-dialog contour-dialog" role="dialog" aria-modal="true" aria-labelledby="map-menu-title">
  <header class="map-heading"><div><span class="map-kicker">СТРАТЕГИЧЕСКАЯ СЕТЬ</span><h2 id="map-menu-title">Контуры территорий</h2>
  ${menuInfo('Как пользоваться контурами','Захватывайте и включайте станции. Подходящие соседние станции соединяются автоматически. Три замкнутых узла образуют территорию и создают энергетическую воронку. Нажатие на станцию показывает её состояние и ближайшие цели; на карте можно поставить путевую метку. Линии вручную строить не нужно.')}</div>
  <div class="map-heading-actions"><span class="contour-wallet">Флюкс <b>${digits(world.contours.flux)}</b> / ${CONTOURS.fluxCap}</span>
  ${game.mapReturnToBase&&game.docked?'<button data-act="baseBack">← К станции</button>':''}<button data-act="close">Продолжить полёт</button></div></header>
  <nav class="map-view-switch" aria-label="Режим карты"><button data-act="mapView" data-id="map">${menuIcon('map')}Рядом</button>
  <button data-act="mapView" data-id="territory" aria-pressed="true">${menuIcon('network')}Контуры</button><button data-act="mapView" data-id="targets">${menuIcon('navigation')}Список</button></nav>
  <div class="contour-region-switch">${regions}</div>
  <section class="map-shell contour-shell"><div class="map-canvas contour-map-canvas">
  <div class="contour-map-caption"><span>${region?esc(region.name):'КАРТА ПЯТИ РЕГИОНОВ'}</span><small>${esc(stage)}</small></div>
  <div class="map-plot"><svg class="contour-chart" data-map-world="true" viewBox="0 0 680 480" role="group" aria-label="${region?'Выбор станций и линий':'Выбор региона'}">
  ${chartBackdrop(world.seed,center,scale,{overview:!region})}
  ${geography}${nebulae}${stars}
  <path d="M0 120H680M0 240H680M0 360H680M170 0V480M340 0V480M510 0V480" stroke="#5b9cb21a" stroke-dasharray="3 8"/>
  ${physical.backdrop}${physical.signals}${navigation}
  ${region?enemyDomainArtwork(world,enemyFields,enemyPlan,center,scale,region,game.time)+
   fieldArtwork(fields,world,center,scale,transition)+enemyThreatArtwork(threats.filter(t=>{
    const p=at(t.target,center,scale);return p.x>=20&&p.x<=660&&p.y>=20&&p.y<=460;
   }),center,scale)+proposedContourArtwork(plan,center,scale)+paths+prospects+
   (selected?.active&&!selected.enemy?`<circle class="contour-reach-ring" cx="${digits(at(selected,center,scale).x)}" cy="${digits(at(selected,center,scale).y)}" r="${digits(CONTOURS.maxLength*scale)}"/>`:'')+
   stationMarks(nodes,center,scale,selected?.id,null,readyIds,goalIds,
    (game.manualWaypoint||game.waypoint)&&at(game.manualWaypoint||game.waypoint,center,scale),planIds)+
   incidentArtwork(game,region,center,scale):overviewStations(world,center,scale)+
   enemyDomainArtwork(world,enemyFields,enemyPlan,center,scale,null,game.time)+
   fieldArtwork(fields,world,center,scale,transition,true)+paths+
   trunkLines+enemyThreatArtwork(threats,center,scale)+incidentArtwork(game,null,center,scale)+
   overview}
  ${reservePin}${sortiePin}${jamPins}${breachPins}${visiblePlayer?`<g class="contour-player-pin">${pilotGlyph(player.x,player.y)}<title>Ваш корабль</title></g>`:''}
  ${chartFrame(center,scale,{overview:!region})}</svg>
  ${mapTools(game)}</div>
  <div class="contour-legend"><span><i class="contour-key mine"></i> Своя</span><span><i class="contour-key unknown"></i> Не разведана</span><span><i class="contour-key dormant"></i> Не включена</span>
  <span><i class="contour-key hostile"></i> Враг</span><span><i class="contour-key available"></i> Будущая связь</span><span><i class="contour-key vortex"></i> Воронка</span>
  ${physical.visibleRelays?'<span><i class="contour-key relay"></i> Ретрансляторы</span>':''}
  ${physical.visibleStorms?'<span><i class="contour-key storm"></i> Буря</span>':''}
  ${physical.visibleCargo?'<span><i class="contour-key cargo"></i> Замеченный груз</span>':''}
  ${threats.length?'<span><i class="contour-key enemy-threat"></i> Угроза узлу</span>':''}
  ${reserve?'<span><i class="contour-key reserve"></i> Ложный маяк</span>':''}
  ${sortie?'<span><i class="contour-key sortie"></i> Постановщик помех</span>':''}
  ${jamPins?'<span><i class="contour-key jammed"></i> Радиопомехи</span>':''}
  ${breachPins?'<span><i class="contour-key jammed"></i> Сорван выпуск грузов</span>':''}
  ${enemyFields.length?'<span><i class="contour-key enemy-land"></i> Поле машин</span>':''}
  ${enemyPlan?.seen.length?'<span><i class="contour-key enemy-plan"></i> Намеченный контур</span>':''}
  ${region?'<span><i class="contour-key incident"></i> Замеченное событие</span>':''}</div>
  <div class="contour-context">${esc(current.name)} · ${esc(stage)}</div>
  </div><aside class="map-side contour-side"><div class="contour-summary" aria-label="Итоги сети">
  <div><small>ТЕРРИТОРИИ</small><strong>${fields.length}</strong></div><div><small>ДОБЫЧА / 3 МИН</small><strong>${digits(production)}</strong></div>
  <div><small>СБОРЩИКИ В ПУТИ</small><strong>${world.contours.harvesters.length}</strong></div></div>
  ${flash}${game.contourError?`<p class="contour-error" role="status">${esc(game.contourError)}</p>`:''}
  ${!flash&&game.contourInfo?`<p class="contour-info" role="status">${esc(game.contourInfo)}</p>`:''}
  ${enemyThreatPanel(threats)}
  ${enemyExpansionPanel(enemyPlan&&(!region||enemyPlan.region===region.id)?enemyPlan:null)}
  ${selectedPanel(game,selected,choices,region)}
  ${offensePanel}
  ${reservePanel}
  ${firstContourGuide(plan,!selected)}
  ${offenseTargets}
  ${trunkPanel}
  ${fields.length?`<div class="contour-economy"><b>Воронки работают</b><p>Флюкс доставлен: ${digits(world.contours.delivered)} · потери сборщиков: ${world.contours.lost}. Желтые точки возвращаются с грузом, бирюзовые летят к воронке.</p>
   <button data-act="contourPulse"${pulseReady?'':' disabled'}>${(world.contours.pulseReadyAt||0)>game.time?'Импульс через '+Math.ceil(world.contours.pulseReadyAt-game.time)+' с':
   'Защитный импульс · 5 флюкса · +22 щита'}</button><small>Доступен, когда корабль находится внутри поля и щит ниже 42.</small></div>`:''}
  ${broken?`<p class="contour-warning">⚠ Нарушено связей: ${broken}. Красный пунктир показывает линии без питания.</p>`:''}
  ${renderWorldFeedbackMap(game)}
  <details class="contour-rules"><summary>Как устроена сеть</summary><p>После включения или захвата станции сеть автоматически прокладывает допустимые связи: до ${CONTOURS.maxLength} м, не более ${CONTOURS.maxDegree} на узел и без пересечений. Три станции, образовавшие замкнутую область, сразу создают территорию и воронку. Никаких подтверждений на карте не требуется.</p><p>Если станция подавлена или захвачена врагом, её связи временно не питают поле. После восстановления станции территория возвращается сама.</p></details>
  </aside></section></div>`;
}
