import {REGIONS} from './regions.js?v=regions-1-living-world-population-1';

export const MAP_WIDTH=680;
export const MAP_HEIGHT=480;
const limits={overview:[.0025,.014],region:[.018,.24],local:[.025,.24]};
const validNumber=n=>Number.isFinite(n);

export function mapViewSpec(game){
 if(game.mapView==='territory'){
  const region=REGIONS.find(r=>r.id===game.contourRegion);
  if(region)return {key:'region:'+region.id,center:region.survey,
   scale:region.id==='amethyst'?.055:.049,limits:limits.region};
  return {key:'overview',center:{x:0,y:0},scale:.0035,limits:limits.overview};
 }
 return {key:'local',center:game.player,scale:208/3300,limits:limits.local};
}

export function mapViewport(game){
 const spec=mapViewSpec(game),saved=game.mapViewports?.[spec.key];
 if(saved&&validNumber(saved.center?.x)&&validNumber(saved.center?.y)&&
  validNumber(saved.scale)&&saved.scale>=spec.limits[0]&&saved.scale<=spec.limits[1])
  return {key:spec.key,center:{...saved.center},scale:saved.scale};
 return {key:spec.key,center:{x:spec.center.x,y:spec.center.y},scale:spec.scale};
}

export const worldAtMapPoint=(view,pixel)=>({
 x:view.center.x+(pixel.x-MAP_WIDTH/2)/view.scale,
 y:view.center.y+(pixel.y-MAP_HEIGHT/2)/view.scale
});

export function zoomMap(view,pixel,factor,range){
 if(!validNumber(factor)||factor<=0)return view;
 const scale=Math.max(range[0],Math.min(range[1],view.scale*factor));
 const anchor=worldAtMapPoint(view,pixel);
 return {...view,scale,center:{
  x:anchor.x-(pixel.x-MAP_WIDTH/2)/scale,
  y:anchor.y-(pixel.y-MAP_HEIGHT/2)/scale
 }};
}

export function panMap(view,delta){
 return {...view,center:{x:view.center.x-delta.x/view.scale,
  y:view.center.y-delta.y/view.scale}};
}

export function pointerOnMap(svg,clientX,clientY){
 if(!svg||!validNumber(clientX)||!validNumber(clientY))return null;
 // SVG's own matrix accounts for responsive letterboxing and device scaling.
 const matrix=svg.getScreenCTM?.();
 if(matrix&&svg.createSVGPoint){
  const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;
  const result=point.matrixTransform(matrix.inverse());
  return {x:result.x,y:result.y};
 }
 const rect=svg.getBoundingClientRect?.();
 if(!rect?.width||!rect?.height)return null;
 return {x:(clientX-rect.left)*MAP_WIDTH/rect.width,
  y:(clientY-rect.top)*MAP_HEIGHT/rect.height};
}

export const insideMap=point=>!!point&&point.x>=0&&point.x<=MAP_WIDTH&&
 point.y>=0&&point.y<=MAP_HEIGHT;

export function mapTools(game){
 return `<div class="map-nav-tools" role="group" aria-label="Масштаб и перемещение карты">
  <button type="button" data-act="mapZoom" data-id="in" aria-label="Приблизить карту">＋</button>
  <button type="button" data-act="mapZoom" data-id="out" aria-label="Отдалить карту">−</button>
  <button type="button" data-act="mapCenter" aria-label="Сбросить положение и масштаб карты">⌖</button>
  <button type="button" data-act="mapMarkMode" class="map-mark-tool" aria-pressed="${!!game?.mapMarkMode}" aria-label="Поставить метку касанием карты">Метка</button>
  ${game?.manualWaypoint?'<button type="button" data-act="mapClearWaypoint" class="map-clear-mark" aria-label="Убрать свою метку с карты">Снять метку</button>':''}
  <span>Колесо — масштаб · перетащить — обзор · ПКМ — маршрут</span></div>`;
}
