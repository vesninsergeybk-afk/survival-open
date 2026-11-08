import {menuInfo,renderMapActions} from './menu-screens.js?v=all-menus-1-menu-audit-1';
import {menuIcon} from './menu-icons.js?v=menu-focus-1';
import {DEFAULT_CONTROLS,readableKey,interactionCopy} from './control-layout.js?v=unified-controls-1-first-loops-1';
import {renderTerritoryProgress} from './territory-benefits.js?v=first-loops-1';
import {pendingContourTrials} from './contour-trials.js?v=first-loops-1';
import {pendingTrialMapArtwork} from './contour-trial-vfx.js?v=first-loops-1';
import {renderRegionAtlas,regionalMapOverlay} from './regional-map.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-enemy-economy-1-enemy-balance-2-supply-stronghold-1';
import {visibleBackbone} from './enemy-backbone.js?v=enemy-backbone-2-flux-offense-1-territory-war-1';
import {CORRIDOR_OPERATION,corridorPosition,corridorAmbush,corridorScanBonus,probeSearchArea,operationDestination,
 isCorridorDock,isProbeLab,PROBE_OPERATION} from './operations.js?v=station-operations-2-ops-audit-2';
import {isFieldOperation,fieldOperationCue} from './field-operations.js?v=field-operations-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2';
import {baseNames} from './balance.js?v=arcade-base-ops-38';
import {contractReturnStation,contractDefenseZone,corridorCue,automaticRange,abandonOperationLabel} from './mission-feedback.js?v=weapons-cycle-2-campaign-1-station-ops-2-ops-audit-2-field-ops-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2';
import {RELAY_DEFENSE,isRelayArsenal,relayPosition,relayDefenseCue} from './relay-defense.js?v=station-operations-2-ops-audit-2';
import {CARRIER_INTERCEPTION,isCarrierBase,carrierRoute,carrierDistanceRemaining,carrierTacticalCue} from './carrier-interception.js?v=carrier-intercept-2-campaign-1';
import {enemyIntentMapPaths} from './enemy-intentions.js?v=enemy-intents-2-enemy-world-response-2';
import {STATION_DEFENSE,defenseRadius,defenseLinked} from './network-defense.js?v=network-defense-4';
import {precisionRailUnlocked,labLogisticsIntel,LAB_LOGISTICS_TECH} from './station-progression.js?v=lab-logistics-qa-1-home-conflict-1-campaign-1-repair-qa-1';
import {renderHomeConflict} from './home-conflict.js?v=home-conflict-1-campaign-1-repair-qa-1-enemy-balance-2';
import {renderCampaignProgress} from './regional-campaign.js?v=menu-rebuild-territory-war-20261106';
import {renderStationThreats} from './strategic-command.js?v=menu-rebuild-territory-war-20261106';
import {renderContourMap} from './contour-atlas.js?v=living-atlas-3-enemy-radio-2-world-feedback-1-contour-dynamics-2-all-menus-1-enemy-domains-1-global-constellations-1-spacing-1-map-ux-1-menu-focus-1-flux-reserve-1-menu-reaudit-1-flux-offense-1-menu-rebuild-1-territory-war-1-map-art-1-breach-fix-1-automatic-contours-1-contour-trials-1-counterattack-1-first-loops-1-menu-audit-1';
import {renderWorldFeedbackMap} from './world-feedback.js?v=world-feedback-1';
import {mapViewport,mapTools} from './map-navigation.js?v=map-ux-1';
import {chartBackdrop,chartFrame,stationGlyph,pilotGlyph} from './map-art.js?v=map-art-1';
import {atlasStars} from './contour-cartography.js?v=living-atlas-3-map-ux-1-map-art-1';
// Tactical navigation: exact locations belong only to revealed contacts.
// A radio signal is deliberately offset from its true location.
const enc=value=>String(value).replace(/[&<>"']/g,char=>
 ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const distance=(a,b)=>Math.round(Math.hypot(a.x-b.x,a.y-b.y));
const point=(x,y,p,scale)=>({x:340+(x-p.x)*scale,y:240+(y-p.y)*scale});
const dot=(x,y,color,r=6,shape='circle')=>shape==='square'?
 '<rect x="'+(x-r).toFixed(1)+'" y="'+(y-r).toFixed(1)+'" width="'+(r*2)+
 '" height="'+(r*2)+'" rx="2" fill="'+color+'"/>':
 '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r+'" fill="'+color+'"/>';

// A miniature of known sector geometry; unknown stations remain hidden.
export function renderStationRoutePreview(base,state={}){
 const world=state.world;
 const stations=world?[...world.stations.values()].filter(s=>s.discovered&&!s.enemy):[];
 const active=state.operation?.baseId===base.id?state.operation:null;
 const resolvedCorridor=isCorridorDock(base)&&!!base.corridorSecured;
 const corridor=isCorridorDock(base)&&!base.corridorSecured;
 const probe=isProbeLab(base)&&!base.probeRecovered&&!base.probeTelemetryDelivered&&base.probeMission?.phase!=='return';
 const carrier=isCarrierBase(base)&&!base.supplyIntercepted;
 const target=operationDestination(active,world)||
  (corridor||resolvedCorridor?corridorPosition(base):probe?probeSearchArea(base,world):carrier?carrierRoute(base)[0]:null);
 const uncertain=(probe||carrier)&&(!active||active.located===false),w=440,h=206;
 const cx=target?(base.x+target.x)/2:base.x,cy=target?(base.y+target.y)/2:base.y;
 const dx=target?Math.abs(target.x-base.x):1600,dy=target?Math.abs(target.y-base.y):800;
 const scale=Math.min(.24,310/Math.max(900,dx),130/Math.max(650,dy));
 const q=p=>({x:w/2+(p.x-cx)*scale,y:h/2+(p.y-cy)*scale});
 const b=q(base),t=target?q(target):null;
 const known=stations.filter(st=>st.id!==base.id).map(st=>{
  const p=q(st);
  if(p.x<12||p.x>w-12||p.y<14||p.y>h-14)return '';
  return '<g><circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+
   '" r="5" fill="'+(st.active?'#8bedd1':'#ffca8b')+'"/>'+
   '<title>'+enc(baseNames[st.type]||'Станция')+'</title></g>';
 }).join('');
 const visibleIds=new Set(stations.map(st=>st.id));
 const links=world?world.networkTopology().links.filter(([a,c])=>visibleIds.has(a.id)&&visibleIds.has(c.id)).map(([a,c])=>{
  const x=q(a),y=q(c);
  return '<path d="M '+x.x.toFixed(1)+' '+x.y.toFixed(1)+' L '+y.x.toFixed(1)+' '+
   y.y.toFixed(1)+'" stroke="#61c9bb" opacity=".4" stroke-width="2"/>';
 }).join(''):'';
 const end=t?'<path d="M '+b.x.toFixed(1)+' '+b.y.toFixed(1)+' L '+t.x.toFixed(1)+
  ' '+t.y.toFixed(1)+'" fill="none" stroke="'+(resolvedCorridor?'#8ae4bf':'#e3bded')+'" stroke-width="2" stroke-dasharray="6 6"/>'+
  '<circle cx="'+t.x.toFixed(1)+'" cy="'+t.y.toFixed(1)+'" r="'+(uncertain?15:9)+
  '" fill="#bb70d923" stroke="'+(resolvedCorridor?'#9bf4c8':'#ebbcff')+'" stroke-width="2"'+(uncertain?' stroke-dasharray="3 4"':'')+'/>'+
  '<text x="'+t.x.toFixed(1)+'" y="'+(t.y-18).toFixed(1)+
  '" text-anchor="middle" fill="#f1d5fa" font-size="12">'+
  (uncertain?(carrier?'РАЙОН ВСТРЕЧИ':'ПОИСК ЗОНДА'):resolvedCorridor?'КОРИДОР ОТКРЫТ':corridor?'ИСТОЧНИК ПОМЕХ':'ЦЕЛЬ')+'</text>':'';
 return '<div class="base-route-graphic"><svg viewBox="0 0 440 206" role="img" aria-label="Расположение станции, известных узлов и цели">'+
  '<rect width="440" height="206" rx="12" fill="#071c2b"/>'+
  '<path d="M 0 51 H 440 M 0 103 H 440 M 0 155 H 440 M 110 0 V 206 M 220 0 V 206 M 330 0 V 206" stroke="#6195b01c"/>'+
  links+known+end+
  '<circle cx="'+b.x.toFixed(1)+'" cy="'+b.y.toFixed(1)+'" r="11" fill="#3e9e8d35" stroke="#9bfae6"/>'+
  '<circle cx="'+b.x.toFixed(1)+'" cy="'+b.y.toFixed(1)+'" r="4" fill="#c5fff1"/>'+
  '<text x="'+(b.x+13).toFixed(1)+'" y="'+(b.y+22).toFixed(1)+'" fill="#a4e4d8" font-size="12">СТАНЦИЯ</text></svg>'+
  '<div class="base-route-actions"><small>'+(target?
   (uncertain?'Предполагаемая область · ':resolvedCorridor?'Открытый маршрут · ':
    corridor&&!active?'Метка разведки · ':'Расстояние · ')+distance(base,target)+' м':
   'Известные узлы сети')+'</small>'+
   '<button type="button" data-act="baseMap">Изучить карту</button></div></div>';
}

export function renderWorldMap(game){
 if(game.mapView==='territory')return renderContourMap(game);
 const p=game.player,world=game.world,enemyVisible=game.enemyBasesUnlocked();
 const topology=world.networkTopology();
 const precisionUnlocked=precisionRailUnlocked(world);
 const intel=labLogisticsIntel(world,p);
 const localControl=world.sectorControl?.(p.x,p.y)||{kind:'neutral',base:null};
 const control=enemyVisible||localControl.base?.strategicRole?localControl:{kind:'neutral',base:null};
 const territory=control.kind==='hostile'?'Вражеский сектор: патрули прибывают примерно на 18% чаще. Захватите базу, чтобы снизить угрозу.':
  control.kind==='secured'?'Безопасный сектор: захваченная база сокращает число патрулей и даёт передышку.':
  'Нейтральный сектор: обычная активность патрулей.';
 const known=[...world.stations.values()]
  .filter(b=>b.discovered&&(enemyVisible||b.strategicRole||!b.enemy))
  .sort((a,b)=>distance(a,p)-distance(b,p));
 const survey=[...world.stations.values()].some(b=>
  b.active&&b.type==='lab'&&b.module==='survey'&&distance(b,p)<1900);
 const probeScan=[...world.stations.values()].some(b=>b.active&&b.type==='lab'&&
  b.probeRecovered&&distance(b,p)<1900);
 const relayScan=known.some(b=>b.active&&b.relaySite?.antenna?.hp>0&&distance(b,p)<1900);
 const home=world.home;
 const homeScan=distance(home,p)<1550?corridorScanBonus(home):0;
 const scanRadius=2200+(survey?650:0)+homeScan+(probeScan?300:0)+
  (relayScan?RELAY_DEFENSE.bonusScan:0);
 const signals=world.signals(p.x,p.y,scanRadius,enemyVisible)
  .filter(b=>!known.some(k=>k.id===b.id));
 const viewCamera=mapViewport(game),{center,scale}=viewCamera;
 const navigator=game.manualWaypoint||game.waypoint;
 const visible=pos=>Math.abs(pos.x-340)<315&&Math.abs(pos.y-240)<215;
 const grid=[];
 for(let x=Math.ceil((center.x-340/scale)/1000)*1000;x<center.x+340/scale;x+=1000){
  const q=point(x,center.y,center,scale);
  grid.push('<path d="M '+q.x.toFixed(1)+' 0 V 480" stroke="#4f89a53b" stroke-width="1"/>');
 }
 for(let y=Math.ceil((center.y-240/scale)/1000)*1000;y<center.y+240/scale;y+=1000){
  const q=point(center.x,y,center,scale);
  grid.push('<path d="M 0 '+q.y.toFixed(1)+' H 680" stroke="#4f89a53b" stroke-width="1"/>');
 }
 const activeLinks=topology.links.map(([a,b])=>{
  const x=point(a.x,a.y,center,scale),y=point(b.x,b.y,center,scale);
  return '<path d="M '+x.x.toFixed(1)+' '+x.y.toFixed(1)+' L '+y.x.toFixed(1)+' '+y.y.toFixed(1)+
   '" stroke="#77e2d3" opacity=".52" stroke-width="2" stroke-dasharray="7 5"/>';
 }).join('');
 const enemyOrders=enemyIntentMapPaths(game,(x,y)=>point(x,y,center,scale),visible);
 const parasiteEchoes=(game.fieldEvolution?.reveals||[])
  .filter(e=>e.until>game.time).map(e=>{
   const q=point(e.x,e.y,center,scale);
   return visible(q)?'<g><circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+
    '" r="10" fill="#57f8ca21" stroke="#6af9d7" stroke-width="1.5" stroke-dasharray="3 3"/>'+
    '<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+'" r="3" fill="#c5fff2"/></g>':'';
  }).join('');
 const readyStation=(game.operation?.id==='silent-corridor'||game.operation?.id===CARRIER_INTERCEPTION.id)&&game.operation.phase==='return'?
   world.stations.get(game.operation.baseId):contractReturnStation(game.contract,world);
 const defenseZone=contractDefenseZone(game.contract,world);
 const defenseRing=defenseZone?(()=>{
  const q=point(defenseZone.station.x,defenseZone.station.y,center,scale),r=defenseZone.radius*scale;
  return '<g><circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+'" r="'+r.toFixed(1)+
   '" fill="#6fe6d20b" stroke="#78e4d6" stroke-width="2" stroke-dasharray="7 7"/>'+
   '<text x="'+q.x.toFixed(1)+'" y="'+(q.y-r-6).toFixed(1)+
   '" text-anchor="middle" fill="#b8fff0" font-size="11">ЗОНА ЗАЩИТЫ · 650 М</text></g>';
 })():'';
 const nearestFriendly=known.find(b=>!b.enemy);
 const marks=known.map(b=>{
  const q=point(b.x,b.y,center,scale);if(!visible(q))return '';
  const color=b.suppressed?'#eda1ff':b.enemy?'#ff777d':b.active?'#84ead2':'#ffca84';
  const protectedNode=b.active&&!b.enemy;
  const linkedDefense=protectedNode&&defenseLinked(b,topology);
  const pvoRing=protectedNode?'<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+
   '" r="'+(defenseRadius(linkedDefense)*scale).toFixed(1)+'" fill="#6debd608" stroke="#7ce7d1" stroke-width="1.2" stroke-dasharray="4 5"/>'+
   (linkedDefense?'<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+
    '" r="'+(STATION_DEFENSE.stasisRadius*scale).toFixed(1)+'" fill="none" stroke="#b790f0" stroke-width="1"/>':''):'';
  const returnCue=readyStation?.id===b.id;
  const selected=navigator?.id===b.id;
  return '<g>'+pvoRing+(selected?'<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+
   '" r="22" fill="#ffd58a18" stroke="#ffe2a0" stroke-width="2" stroke-dasharray="4 3"/>':'')+
   (returnCue?'<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+
   '" r="17" fill="#ffd27e1a" stroke="#ffd27e" stroke-width="2.5"/>'+
   '<text x="'+q.x.toFixed(1)+'" y="'+(q.y-20).toFixed(1)+
   '" text-anchor="middle" fill="#ffe2a0" font-size="17" font-weight="700">!</text>':'')+
   (b.relayBoost?'<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+'" r="16" fill="none" stroke="#6fffee" stroke-width="1.5"/>':'')+
   '<g transform="translate('+q.x.toFixed(1)+' '+q.y.toFixed(1)+')">'+stationGlyph(b.type,{color,active:b.active&&!b.enemy,hostile:b.enemy})+'</g>'+
   '<text class="local-station-label" data-mobile-label="'+(selected||returnCue||b.id===nearestFriendly?.id)+'" x="'+(q.x+17).toFixed(1)+'" y="'+(q.y-12).toFixed(1)+
   '" fill="#e3f4f4" font-size="11">'+enc(baseNames[b.type]||'Станция')+'</text></g>';
 }).join('');
 const echoes=signals.map(s=>{
  const q=point(s.x,s.y,center,scale);if(!visible(q))return '';
  return '<g opacity=".82"><circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+
   '" r="14" fill="none" stroke="#f8dc8a" stroke-dasharray="3 5"/>'+
   '<text x="'+q.x.toFixed(1)+'" y="'+(q.y+4).toFixed(1)+
   '" text-anchor="middle" fill="#f8dc8a" font-size="15">?</text></g>';
 }).join('');
 const intelMarks=intel.contacts.map(c=>{
  const q=point(c.x,c.y,center,scale);if(!visible(q))return '';
  const moving=c.kind==='cargo',color=moving?'#ffcb77':'#9df1e3';
  return '<g><circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+
   '" r="12" fill="none" stroke="'+color+'" stroke-width="2" stroke-dasharray="3 3"/>'+
   dot(q.x,q.y,color,4,moving?'square':'circle')+'</g>';
 }).join('');
 const operation=game.operation;
 const previewBase=game.mapReturnToBase?game.docked:null;
 const previewProbe=!operation&&previewBase&&isProbeLab(previewBase)&&!previewBase.probeRecovered&&
  !previewBase.probeTelemetryDelivered&&previewBase.probeMission?.phase!=='return';
 const previewCorridor=!operation&&previewBase&&isCorridorDock(previewBase)&&!previewBase.corridorSecured;
 const previewRelay=!operation&&previewBase&&isRelayArsenal(previewBase)&&!previewBase.relayDefenseDone;
 const previewCarrier=!operation&&previewBase&&isCarrierBase(previewBase)&&!previewBase.supplyIntercepted;
 const previewTarget=previewProbe?probeSearchArea(previewBase,world):
  previewCorridor?corridorPosition(previewBase):
  previewRelay?relayPosition(previewBase,world):
   previewCarrier?carrierRoute(previewBase)[0]:null;
 const objectiveMarker=operationDestination(operation,world)||previewTarget||
  (home.corridorSecured?corridorPosition(home):null);
 const marker=objectiveMarker?point(objectiveMarker.x,objectiveMarker.y,center,scale):null;
 const searching=previewProbe||(operation?.id===PROBE_OPERATION.id&&operation.located===false);
 const operationMark=marker&&visible(marker)?
  '<circle cx="'+marker.x.toFixed(1)+'" cy="'+marker.y.toFixed(1)+'" r="'+(searching?Math.max(16,PROBE_OPERATION.searchRadius*scale).toFixed(1):13)+'" fill="none" '+
  (searching?'stroke-dasharray="5 4" ':'')+'stroke="'+
  (operation||previewTarget?'#edacf9':'#7ce9bf')+'" stroke-width="2"/>'+
  '<circle cx="'+marker.x.toFixed(1)+'" cy="'+marker.y.toFixed(1)+'" r="4" fill="'+
  (operation||previewTarget?'#edacf9':'#7ce9bf')+'"/>'+
  '<text x="'+(marker.x+16).toFixed(1)+'" y="'+(marker.y-12).toFixed(1)+
  '" fill="#edd7fa" font-size="11">'+(operation?(operation.id===PROBE_OPERATION.id?
   (operation.phase==='return'?'Лаборатория · сдать данные':searching?'Район поиска зонда':'Аварийный зонд'):
   operation.id===RELAY_DEFENSE.id?'Ретранслятор':
    operation.id===CARRIER_INTERCEPTION.id?(operation.phase==='return'?'Авианосец · сдача сведений':
     operation.phase==='approach'?'Район встречи':'Движущийся груз'):
    isFieldOperation(operation)?(operation.phase==='return'?'Сдать вылазку':operation.name):
    operation.phase==='return'?'Док · передать данные':'Глушитель'):
   previewProbe?'Область поиска зонда':previewRelay?'Ретранслятор':
   previewCarrier?'Район встречи':previewCorridor?'Источник помех':'Коридор открыт')+'</text>':'';
 const numberedSites=sites=>sites.map((site,index)=>({site,index}));
 const fieldSites=isFieldOperation(operation)?(
  operation.id==='deep-resonance'?numberedSites(operation.samples).filter(v=>!v.site.done):
  operation.id==='two-fronts'?numberedSites(operation.nodes):
  ['line-break','sleeping-reactor'].includes(operation.id)?numberedSites(operation.nodes).filter(v=>!v.site.done):
  operation.id==='false-call'?numberedSites(operation.beacons).filter(v=>!v.site.checked):
  operation.id==='broken-convoy'?(operation.crate?[{site:operation.crate,index:0}]:
   numberedSites(operation.route).filter(v=>v.index>operation.routeIndex)):[]):[];
 const fieldMarks=fieldSites.map(({site,index})=>{
  const mark=point(site.x,site.y,center,scale);
  if(!visible(mark))return '';
  const intact=site.hp===undefined||site.hp>0;
  return '<circle cx="'+mark.x.toFixed(1)+'" cy="'+mark.y.toFixed(1)+
   '" r="11" fill="'+(intact?'#e9bdff33':'#e56f8033')+'" stroke="'+
   (intact?'#ddafff':'#ff918e')+'" stroke-width="2"/>'+
   '<text x="'+(mark.x+14).toFixed(1)+'" y="'+(mark.y+14).toFixed(1)+
   '" fill="#edd7fa" font-size="10">'+
   (['two-fronts','line-break'].includes(operation.id)?'Узел ':
    operation.id==='false-call'?'Маяк ':operation.id==='sleeping-reactor'?'Кассета ':
    operation.id==='broken-convoy'?'Маршрут ':'Руда ')+(index+1)+'</text>';
 }).join('');
 const ambush=operation?.radio==='sent'&&!operation.pursuitStarted&&world.stations.get(operation.baseId);
 const ambushMark=ambush?(()=>{
  const spot=corridorAmbush(ambush,operation),q=point(spot.x,spot.y,center,scale);
  return visible(q)?'<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+'" r="'+(CORRIDOR_OPERATION.ambushRadius*scale).toFixed(1)+
   '" fill="#ef8e5430" stroke="#ffb371" stroke-dasharray="5 4"/>'+
   '<text x="'+(q.x+8).toFixed(1)+'" y="'+(q.y-8).toFixed(1)+'" fill="#ffd1a4" font-size="11">ЗАСАДА</text>':'';
 })():'';
 const carrierPath=operation?.id===CARRIER_INTERCEPTION.id&&operation.route?
  '<path d="M '+operation.route.map(r=>{
   const q=point(r.x,r.y,center,scale);return q.x.toFixed(1)+' '+q.y.toFixed(1);
  }).join(' L ')+'" fill="none" stroke="#e4ad65" opacity=".8" stroke-width="2.4" stroke-dasharray="8 7"/>'+
  (()=>{const q=point(operation.route[2].x,operation.route[2].y,center,scale);
   return visible(q)?'<circle cx="'+q.x.toFixed(1)+'" cy="'+q.y.toFixed(1)+
    '" r="13" fill="none" stroke="#ffbd6c" stroke-width="2.6"/>'+
    '<text x="'+(q.x+18).toFixed(1)+'" y="'+(q.y-12).toFixed(1)+
    '" fill="#ffdbad" font-size="11">ВЫХОД КОНВОЯ</text>':'';})():'';
 const securedSupply=[...world.stations.values()].filter(b=>b.discovered&&b.supplyIntercepted);
 const securedRoutes=securedSupply.map(base=>{
  const points=carrierRoute(base).map(r=>point(r.x,r.y,center,scale));
  return '<path d="M '+points.map(q=>q.x.toFixed(1)+' '+q.y.toFixed(1)).join(' L ')+
   '" fill="none" stroke="#7ce7b4" opacity=".65" stroke-width="3" stroke-dasharray="14 8"/>';
 }).join('');
 const goal=navigator?point(navigator.x,navigator.y,center,scale):null;
 const pilot=point(p.x,p.y,center,scale);
 const route=goal&&visible(goal)?
  '<path d="M '+pilot.x.toFixed(1)+' '+pilot.y.toFixed(1)+' L '+goal.x.toFixed(1)+' '+goal.y.toFixed(1)+
   '" stroke="#f4e6a0" stroke-width="2.4" stroke-dasharray="8 6"/>'+dot(goal.x,goal.y,'#fff0b8',4):'';
 const objective=game.contract;
 const operationText=operation?(operation.id===PROBE_OPERATION.id?
  (operation.phase==='return'?'Зонд потерян. Вернитесь в лабораторию и сдайте сохранённые данные в разделе операций.':
   searching?'«Последний сигнал»: подлетите в отмеченный район. Бортовой сканер уточнит положение зонда.':
   '«Последний сигнал»: удерживайте E в 150 м от зонда. Ремонт '+Math.round(operation.repair)+'%. '+
    (operation.repair>=PROBE_OPERATION.telemetryAt?'Данные можно сдать в лаборатории.':'Отпускайте E, чтобы перехватить налётчика.')):
  operation.id===RELAY_DEFENSE.id?
  'Особая операция «Оборона ретранслятора»: '+relayDefenseCue(operation,game.time)+'. Передатчик: '+
   Math.ceil(operation.hp/operation.maxHp*100)+'% прочности. У налётчиков есть прицельный залп: перехватывайте до его завершения.':
  operation.id===CARRIER_INTERCEPTION.id?(operation.phase==='return'?
   'Особая операция «Перехват снабжения»: груз остановлен. Вернитесь на авианосец и нажмите E для передачи сведений и получения награды.':
   operation.phase==='approach'?'Особая операция «Перехват снабжения»: подлетите к району встречи. До обнаружения груза время не ограничено.':
   'Особая операция «Перехват снабжения»: транспорт '+Math.ceil(operation.hp/operation.maxHp*100)+
    '% прочности, до линии выхода '+Math.ceil(carrierDistanceRemaining(operation))+
    ' м. '+carrierTacticalCue(operation,p)+'. Нос бронирован, двигатели уязвимы с кормы. Разряд поражает только в пределах 230 м; затем броня открыта 3 с.'):
  isFieldOperation(operation)?'Особая операция «'+operation.name+'». '+fieldOperationCue(operation,game)+'. '+operation.desc:
  operation.phase==='return'?'Особая операция «Глухой коридор»: глушитель отключён. Телеметрия сохранена. Вернитесь в док.'+
   (ambush?' На карте отмечена засада. Проложите маршрут в обход круга или прорывайтесь.':''):
   'Особая операция «Глухой коридор»: уничтожьте отмеченный передатчик. Осталось '+Math.ceil(operation.hp/operation.maxHp*100)+'% прочности. Фаза: '+
  (corridorCue(operation,game.time,distance(operation,p),automaticRange(game))?.label||'неизвестна')+'. После отключения вернитесь в док за наградой.'):
  previewTarget?(previewProbe?'Предварительная разведка: здесь ожидается аварийный зонд. Место пока известно приблизительно.':
   previewRelay?'Предварительный маршрут: ретранслятор арсенала. Отразите три конечные волны.':
   previewCarrier?'Предварительная разведка: район встречи конвоя. Груз появится после сближения; затем уйдёт к обозначенной границе.':
   'Предварительная разведка: источник помех отмечен на карте к востоку от дока. Операция ещё не принята.'):
  home.corridorSecured?'Восточный коридор открыт. Разведка возле дока расширена на '+corridorScanBonus(home)+' м, патрулей стало меньше.':'';
 const objectiveText=objective?
  (objective.progress>=objective.goal?'Награда готова. Вернитесь на '+
    (readyStation?baseNames[readyStation.type]:'станцию')+'.':
   'Поручение: '+objective.name+' · '+objective.progress+'/'+objective.goal):
  'Активных поручений нет. На включённых станциях доступны задания.';
 const readyRoute=readyStation?'<button type="button" data-act="waypoint" data-id="'+enc(readyStation.id)+
  '" data-x="'+Number(readyStation.x).toFixed(2)+'" data-y="'+Number(readyStation.y).toFixed(2)+
  '" data-label="'+enc(baseNames[readyStation.type]||'Станция')+'">Построить маршрут к награде</button>':'';
 const row=(b,isSignal)=>{
  const label=isSignal?'Неопознанный сигнал':b.title||baseNames[b.type]||'Станция';
  const d=distance(b,p),same=navigator?.id===b.id;
  const status=isSignal?'координаты приблизительные (погрешность до 170 м)':
   b.enemy?'вражеская база':b.suppressed?'связь подавлена · восстановление через '+Math.max(0,Math.ceil(b.suppressedUntil-game.time))+' с':readyStation?.id===b.id?'НАГРАДА ГОТОВА':b.active?(topology.linked.has(b.id)?'узел сети · ПВО'+(topology.count>=2?' и стазис':'')+(b.relayBoost?' · усиленная связь':''):'автономный узел · ПВО'+(b.relayBoost?' · усиленная связь':'')):'ожидает включения';
  const value=isSignal?'Проложить курс к сигналу':'Построить маршрут';
  const discovery=!isSignal&&!b.enemy&&b.type==='arsenal'&&!precisionUnlocked?
   ' · ОТКРЫТИЕ: ручной прицел для рельсового орудия':
   !isSignal&&!b.enemy&&b.type==='lab'&&!b.active?
    (intel.unlocked?' · РАЗВЕДКА: ещё 4300 м радионаблюдения':
     ' · ОТКРЫТИЕ: перехват вражеского снабжения'):'';
  return '<article class="map-contact'+(same?' selected':'')+'">'+
   '<div><strong>'+enc(label)+'</strong><small>'+Math.round(d)+' м · '+status+discovery+'</small></div>'+
   '<button type="button" data-act="waypoint" data-id="'+enc(b.id)+
   '" data-x="'+Number(b.x).toFixed(2)+'" data-y="'+Number(b.y).toFixed(2)+
   '" data-label="'+enc(label)+'"'+(isSignal?' data-signal="1"':'')+
   '>'+ (same?'✓ Маршрут выбран':value)+'</button></article>';
 };
 const discovered=[...known].sort((a,b)=>Number(readyStation?.id===b.id)-Number(readyStation?.id===a.id)||
  Number(navigator?.id===b.id)-Number(navigator?.id===a.id)||distance(a,p)-distance(b,p))
  .map(b=>row(b,false)).join('');
 const unidentified=signals.map(b=>row(b,true)).join('');
 const intercepted=game.enemyComms?.intercepted?.(game.time)||[];
 const radioHistory=intercepted.length?
  '<details class="map-objective map-radio-log"><summary>Перехваченные приказы · '+
  intercepted.length+'</summary><ul>'+intercepted.slice(0,3).map(order=>
   '<li><span>'+enc(({press:'Нажим',pincer:'Обход',intercept:'Перехват',
    screen:'Прикрытие',close:'Сближение',scatter:'Рассредоточение',network:'Сетевое донесение'})[order.mode]||'Манёвр')+
   '</span> '+enc(order.message)+'</li>').join('')+'</ul></details>':'';
 // Only an active friendly laboratory lets the player inspect hostile
 // radio activity. Both endpoint stations must already be discovered.
 const knownTrunks=intel.unlocked?visibleBackbone(game):[];
 const trunkLines=knownTrunks.map(link=>{
  const a=world.stations.get(link.a),b=world.stations.get(link.b);
  const x=point(a.x,a.y,center,scale),y=point(b.x,b.y,center,scale);
  return '<path d="M '+x.x.toFixed(1)+' '+x.y.toFixed(1)+
   ' L '+y.x.toFixed(1)+' '+y.y.toFixed(1)+'" fill="none" '+
   'stroke="'+(link.active?'#f5b46d':'#a7758b')+
   '" opacity=".48" stroke-width="1.6" stroke-dasharray="8 7">'+
   '<title>'+enc(link.titleA)+' — '+enc(link.titleB)+
   (link.active?' · связь работает':' · линия нарушена')+'</title></path>';
 }).join('');
 const trunkPanel=knownTrunks.length?
  '<details class="map-objective map-radio-log"><summary>Магистрали машин · '+
  knownTrunks.filter(l=>l.active).length+'/'+knownTrunks.length+
  ' действуют</summary><ul>'+knownTrunks.slice(0,6).map(link=>
   '<li><span>'+(link.active?'СВЯЗЬ':'ОБРЫВ')+'</span> '+
   enc(link.titleA)+' — '+enc(link.titleB)+'</li>').join('')+
  '</ul><small>Захват и радиопомехи нарушают передачу.</small></details>':'';
 const intelContacts=intel.contacts.map(c=>'<article class="map-contact">'+
  '<div><strong>'+enc(c.label)+'</strong><small>'+enc(c.detail)+'</small></div>'+
  '<button type="button" data-act="waypoint" data-id="'+enc(c.id)+'" data-x="'+
  Number(c.x).toFixed(2)+'" data-y="'+Number(c.y).toFixed(2)+'" data-label="'+
  enc(c.label)+'">'+(navigator?.id===c.id?'✓ Маршрут выбран':'Построить маршрут')+'</button></article>').join('');
 const discoveryCues=[!precisionUnlocked?'найдите и включите либо захватите арсенал — получите ручной прицел рельса.':'',
  !intel.unlocked?'найдите и включите либо захватите лабораторию — получите радиоперехват снабжения.':''].filter(Boolean);
 const discoveryLead=discoveryCues.length?'<b>Открытия станций:</b> '+discoveryCues.join(' ')+
  ' Ищите их среди неопознанных сигналов.':'';
 const intelLead=intel.unlocked?' <b>Радиоперехват:</b> '+(intelContacts?
  'найдены промышленные сигналы.':'новых целей пока нет.')+
  ' <span class="map-intel-wide">Выберите маршрут в списке справа.</span>'+
  '<span class="map-intel-compact">Откройте «Цели», чтобы выбрать маршрут.</span>':'';
 const view=game.mapView==='targets'?'targets':'map';
 const activeMission=operation?'<div class="map-operation-cue" role="status"><div><small>ПРИНЯТАЯ ОСОБАЯ ОПЕРАЦИЯ</small><strong>'+enc(operation.name)+
  (operation.phase==='return'?' · сдача результатов':' · цель на карте')+'</strong><span>'+
  (operation.phase==='return'?'Вернитесь на станцию, где приняли операцию.':
   operation.id===PROBE_OPERATION.id?(searching?'Летите в район поиска.':'Удерживайте E для ремонта; отпустите, чтобы стрелять.'):
   operation.id===RELAY_DEFENSE.id?'Подлетите к передатчику и отразите три волны.':
   operation.id===CARRIER_INTERCEPTION.id?'Перехватите груз до выхода из сектора.':
   isFieldOperation(operation)?fieldOperationCue(operation,game):
   'Отключите глушитель и вернитесь с телеметрией.')+'</span></div>'+
  '<button type="button" data-act="operationWaypoint">'+(operation.phase==='return'?'Проложить путь обратно':'Проложить курс к цели')+'</button></div>':'';
 return interactionCopy('<div class="dialog map-dialog map-mode-'+view+'" role="dialog" aria-modal="true" aria-labelledby="map-menu-title"><header class="map-heading"><div>'+
  '<span class="map-kicker">НАВИГАЦИОННЫЙ КОМПЛЕКС</span><h2 id="map-menu-title">Карта сектора</h2>'+
  menuInfo('Как пользоваться картой','Выберите станцию или сигнал и постройте маршрут. Связь действует на 1450 м; каждая усиленная антенна добавляет 500 м. Неизвестные сигналы указаны приблизительно.')+
  '</div><div class="map-heading-actions"><span>В сети <b>'+topology.count+'</b> · Открыто <b>'+known.length+
  '</b></span></div></header>'+
  '<nav class="map-view-switch" aria-label="Режим карты"><button type="button" data-act="mapView" data-id="map" aria-pressed="'+(view==='map')+'">'+menuIcon('map')+'Рядом</button>'+
  '<button type="button" data-act="mapView" data-id="territory" aria-pressed="false">'+menuIcon('network')+'Территории</button>'+
  '<button type="button" data-act="mapView" data-id="targets" aria-pressed="'+(view==='targets')+'">'+menuIcon('navigation')+'Цели</button></nav>'+
  activeMission+(pendingContourTrials(world).length?renderTerritoryProgress(world,p,{map:true}):'')+
  (discoveryLead||intelLead?'<details class="map-discovery-lead"><summary>Что можно открыть на станциях</summary>'+discoveryLead+intelLead+'</details>':'')+
  '<section class="map-shell"><div class="map-canvas"><div class="map-plot"><svg class="local-chart" data-map-world="true" viewBox="0 0 680 480" role="img" aria-label="Известные станции, сигналы и маршруты сети">'+
  chartBackdrop(world.seed,center,scale)+atlasStars(world.seed,center,scale,false)+
  '<circle cx="'+pilot.x.toFixed(1)+'" cy="'+pilot.y.toFixed(1)+'" r="'+(scanRadius*scale).toFixed(1)+'" fill="#367f9c15" stroke="#68c8df33" stroke-dasharray="4 7"/>'+
  grid.join('')+regionalMapOverlay(game,r=>point(r.x,r.y,center,scale),visible)+trunkLines+activeLinks+defenseRing+securedRoutes+carrierPath+ambushMark+route+echoes+intelMarks+marks+operationMark+fieldMarks+enemyOrders+parasiteEchoes+
  pendingTrialMapArtwork(world,center,scale,(entry,c,s)=>point(entry.x,entry.y,c,s))+
  pilotGlyph(pilot.x,pilot.y)+chartFrame(center,scale,{local:true})+
  '<text x="'+(pilot.x+11).toFixed(1)+'" y="'+(pilot.y+26).toFixed(1)+'" fill="#dcffff" font-size="12">ВЫ</text></svg>'+
  mapTools(game)+'</div>'+
  '<div class="map-legend"><span><i class="local-key pilot"></i>Вы</span><span><i class="local-key active"></i>Включена</span><span><i class="local-key inactive"></i>Выключена</span>'+
  '<span><i class="local-key hostile"></i>Противник</span><span><i class="local-key maneuver"></i>Манёвр</span><span><i class="local-key signal">?</i>Сигнал</span><span><i class="local-key operation"></i>Операция</span>'+
  (parasiteEchoes?'<span>◌ бирюзовые метки — живые сигналы паразита-передатчика</span>':'')+
  (intel.unlocked?'<span>Бирюзовый круг — промышленный сигнал · янтарный квадрат — радиометка груза</span>':'')+
  (known.some(b=>b.active&&!b.enemy)?'<span>бирюзовый круг — ПВО корабля · фиолетовый — радиус станции для стазиса (нужны 2 врага рядом с вами)</span>':'')+'</div>'+
  '</div>'+
  '<aside class="map-side">'+
  renderStationThreats(game)+
  (operationText?'<div class="map-objective"><span>'+(previewTarget?'ПРЕДВАРИТЕЛЬНЫЙ МАРШРУТ':operation?.id===PROBE_OPERATION.id?'АВАРИЙНАЯ ТЕЛЕМЕТРИЯ':
     operation?.id===RELAY_DEFENSE.id?'ОБОРОНА РЕТРАНСЛЯТОРА':operation?.id===CARRIER_INTERCEPTION.id?'ПЕРЕХВАТ КОНВОЯ':'ВОСТОЧНЫЙ КОРИДОР')+'</span><p>'+enc(operationText)+'</p>'+
   (operation?'<button type="button" data-act="abandonOperation">'+enc(abandonOperationLabel(operation))+'</button>':'')+'</div>':'')+
  '<div class="map-objective"><span>ПОЛЕВОЙ ЗАКАЗ</span><p>'+enc(objectiveText)+'</p>'+readyRoute+
  (objective&&objective.progress<objective.goal?'<details class="map-cancel-contract"><summary>Отказаться от заказа</summary><p>Выполненная часть заказа будет потеряна.</p><button type="button" data-act="abandonContract">Подтвердить отказ</button></details>':'')+'</div>'+
  '<h3>Обнаруженные станции</h3><div class="map-contact-list">'+(discovered||
    '<p class="map-empty">Станций ещё нет. Продвигайтесь по сигналам радара.</p>')+'</div>'+
  '<h3>Сигналы сканера <small>до '+scanRadius+' м</small></h3>'+
  '<div class="map-contact-list">'+(unidentified||
   '<p class="map-empty">Новых сигналов поблизости нет. Исследуйте следующий сектор.</p>')+
  '</div><details class="map-world-details"><summary>Сектор, регионы и разведданные</summary>'+
  renderWorldFeedbackMap(game)+
  renderHomeConflict(game)+
  renderCampaignProgress(game)+
  (intel.unlocked?'<section class="map-objective map-intel"><span>'+enc(LAB_LOGISTICS_TECH.name.toUpperCase())+'</span><p>'+enc(intel.status)+'</p>'+
   (intelContacts?'<div class="map-contact-list">'+intelContacts+'</div>':
    (intel.localSecured?'<p>Местная цепочка снабжения подавлена. Другие действующие лаборатории могут обнаружить грузы в дальних регионах.</p>':
     '<p>Сейчас нет новых радиометок. Подключите лабораторию ближе к маршрутам грузов.</p>'))+'</section>':'')+
  renderRegionAtlas(game)+radioHistory+trunkPanel+
  '<div class="map-objective"><span>ОБСТАНОВКА В СЕКТОРЕ</span><p>'+enc(territory)+'</p>'+
  (securedSupply.length?'<p>Зелёным отмечены перехваченные маршруты снабжения. В пределах 740 м от них вражеские патрули появляются реже.</p>':'')+'</div>'+
  '</details></aside></section><footer class="map-foot">'+
  enc(readableKey((game.controls||DEFAULT_CONTROLS).map))+' — карта · '+
  enc(readableKey((game.controls||DEFAULT_CONTROLS).skills))+' — развитие · '+
  'Дистанции до сигналов приблизительные.</footer>'+renderMapActions(game)+'</div>',game.controls);
}
