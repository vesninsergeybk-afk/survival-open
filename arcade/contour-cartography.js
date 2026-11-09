import {REGIONS,REGION_LIMIT,centralOutline,regionAt} from './regions.js?v=regions-1-living-world-population-1';
import {hash,RULES} from './balance.js?v=arcade-network-20';
import {stormFields,stormPhase} from './regional-storms.js?v=regions-1';

// This is a projection of game-world coordinates, not an independently drawn
// diagram. Every marker and polygon uses the same transform at both scales.
export const ATLAS_WIDTH=680;
export const ATLAS_HEIGHT=480;
export const atlasPoint=(p,center,scale)=>({
 x:ATLAS_WIDTH/2+(p.x-center.x)*scale,
 y:ATLAS_HEIGHT/2+(p.y-center.y)*scale
});
const fmt=n=>Number(n).toFixed(1);
const visible=p=>p.x>=-20&&p.x<=ATLAS_WIDTH+20&&p.y>=-20&&p.y<=ATLAS_HEIGHT+20;
const poly=(points,center,scale)=>points.map((p,i)=>{
 const q=atlasPoint(p,center,scale);
 return (i?'L':'M')+fmt(q.x)+' '+fmt(q.y);
}).join(' ')+'Z';

// True strategic geography: four sectors meet at diagonal boundaries; the
// irregular home region is taken from the same boundary as the flight world.
// Outside the initial charted radius we deliberately show uncharted space.
export function atlasGeography(center,scale){
 const origin=atlasPoint({x:0,y:0},center,scale);
 const r=REGION_LIMIT*scale,far=120000;
 const sectors=[
  {id:'amber',points:[{x:0,y:0},{x:far,y:-far},{x:far,y:far}]},
  {id:'azure',points:[{x:0,y:0},{x:far,y:far},{x:-far,y:far}]},
  {id:'lilac',points:[{x:0,y:0},{x:-far,y:-far},{x:far,y:-far}]},
  {id:'teal',points:[{x:0,y:0},{x:-far,y:far},{x:-far,y:-far}]}
 ];
 const fills=sectors.map(s=>{
  const region=REGIONS.find(item=>item.id===s.id);
  return `<path d="${poly(s.points,center,scale)}" fill="${region.color}" fill-opacity=".015"/>`;
 }).join('');
 const home=REGIONS[0];
 return `<g class="contour-world-geography" aria-hidden="true">
  <defs><clipPath id="contour-survey-limit"><circle cx="${fmt(origin.x)}" cy="${fmt(origin.y)}" r="${fmt(r)}"/></clipPath></defs>
  <g clip-path="url(#contour-survey-limit)">${fills}</g>
  <path d="${poly(centralOutline(),center,scale)}" fill="${home.color}" fill-opacity=".025" stroke="${home.color}" stroke-opacity=".2" stroke-width=".8"/>
  <circle cx="${fmt(origin.x)}" cy="${fmt(origin.y)}" r="${fmt(r)}" fill="none" stroke="#7db1c7" stroke-opacity=".14" stroke-width=".6" stroke-dasharray="2 9"/>
  </g>`;
}

// Low-detail spectral weather on the chart. The colors and broad sector
// boundaries are the same as in flight; soft wisps deliberately abstract the
// much denser world-space fog instead of pretending to be exact asteroids.
export function atlasNebulae(seed,center,scale,overview){
 const cell=overview?23000:2800;
 const spanX=ATLAS_WIDTH/(2*scale),spanY=ATLAS_HEIGHT/(2*scale);
 const bx0=Math.floor((center.x-spanX)/cell)-1,bx1=Math.ceil((center.x+spanX)/cell)+1;
 const by0=Math.floor((center.y-spanY)/cell)-1,by1=Math.ceil((center.y+spanY)/cell)+1;
 const wisps=[];
 for(let by=by0;by<=by1;by++)for(let bx=bx0;bx<=bx1;bx++){
  if(hash(bx,by,seed+233)>.57)continue;
  const p={x:(bx+.2+.6*hash(bx,by,seed+239))*cell,
   y:(by+.2+.6*hash(bx,by,seed+241))*cell};
  const q=atlasPoint(p,center,scale);
  if(q.x< -140||q.x>ATLAS_WIDTH+140||q.y< -140||q.y>ATLAS_HEIGHT+140)continue;
  const region=regionAt(p.x,p.y);
  const radius=cell*scale*(.52+.35*hash(bx,by,seed+251));
  const rotation=Math.floor(hash(bx,by,seed+257)*180);
  wisps.push(`<ellipse cx="${fmt(q.x)}" cy="${fmt(q.y)}" rx="${fmt(radius*1.7)}" ry="${fmt(radius*.85)}" transform="rotate(${rotation} ${fmt(q.x)} ${fmt(q.y)})" fill="url(#contour-nebula-${region.id})"/>`);
 }
 const gradients=REGIONS.map(r=>`<radialGradient id="contour-nebula-${r.id}"><stop offset="0" stop-color="${r.color}" stop-opacity=".16"/><stop offset=".5" stop-color="${r.color}" stop-opacity=".065"/><stop offset="1" stop-color="${r.color}" stop-opacity="0"/></radialGradient>`).join('');
 return `<g class="contour-nebulae" aria-hidden="true" opacity="${overview?'1':'.62'}"><defs>${gradients}</defs>${wisps.join('')}</g>`;
}

// Each star is a genuine point of the flight renderer's deterministic grid:
// at strategic zoom we select a bounded subset instead of drawing millions.
export function atlasStars(seed=0,center,scale,overview){
 const step=overview?24:3,grid=260;
 const spanX=ATLAS_WIDTH/(2*scale),spanY=ATLAS_HEIGHT/(2*scale);
 const startX=Math.floor((center.x-spanX)/(grid*step))-1;
 const endX=Math.ceil((center.x+spanX)/(grid*step))+1;
 const startY=Math.floor((center.y-spanY)/(grid*step))-1;
 const endY=Math.ceil((center.y+spanY)/(grid*step))+1;
 const stars=[];
 for(let by=startY;by<=endY;by++)for(let bx=startX;bx<=endX;bx++){
  if(hash(bx,by,seed+65)>(overview?.16:.47))continue;
  // Choose an actual star cell inside each coarse chart cell. The subset is
  // spatially stable, but avoids the artificial rows of a regular sampler.
  const gx=bx*step+Math.floor(hash(bx,by,seed+73)*step);
  const gy=by*step+Math.floor(hash(bx,by,seed+79)*step);
  const p=atlasPoint({x:(gx+hash(gx*9,gy,seed))*grid,
   y:(gy+hash(gx,gy*9,seed+7))*grid},center,scale);
  if(!visible(p))continue;
  const bright=hash(gx,gy,seed+83);
  stars.push(`<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt((overview?.4:.5)+bright*(overview?.8:.95))}" opacity="${fmt(.25+bright*.65)}"/>`);
 }
 return `<g class="contour-world-stars" aria-hidden="true">${stars.join('')}</g>`;
}

// World objects appear only if the player has actually encountered them or
// their position has been recorded by the normal simulation. No unseen cargo
// or distant AI fleet is scanned by this map.
export function atlasLiveObjects(game,center,scale,overview){
 const world=game.world,player=game.player;
 const layers={rocks:[],storms:[],cargo:[],contacts:[],relay:[],viewport:''};
 // The flight camera may show more (or less) world than the fixed logical
 // viewport. The atlas outline must represent what the pilot actually sees.
 const flightCamera=typeof game.camera==='function'?game.camera():null;
 const cameraWidth=Number.isFinite(flightCamera?.w)&&flightCamera.w>0?
  flightCamera.w:Number.isFinite(game.vw)&&game.vw>0?game.vw:1200;
 const cameraHeight=Number.isFinite(flightCamera?.h)&&flightCamera.h>0?
  flightCamera.h:Number.isFinite(game.vh)&&game.vh>0?game.vh:760;
 if(!overview){
  const q=atlasPoint(player,center,scale);
  const w=cameraWidth*scale,h=cameraHeight*scale;
  if(visible(q))layers.viewport=`<rect class="contour-flight-window" x="${fmt(q.x-w/2)}" y="${fmt(q.y-h/2)}" width="${fmt(w)}" height="${fmt(h)}" rx="3"/>`;
  // Already generated asteroid cells belong to the simulated field; avoid
  // generating thousands of distant rocks simply by opening the atlas.
  const rockCell=RULES.rockCell,reach=1800;
  for(let cy=Math.floor((player.y-reach)/rockCell);cy<=Math.floor((player.y+reach)/rockCell);cy++){
   for(let cx=Math.floor((player.x-reach)/rockCell);cx<=Math.floor((player.x+reach)/rockCell);cx++){
    for(const rock of world.rocks.get(cx+':'+cy)||[]){
     if(layers.rocks.length>=62)break;
     if(!rock.alive||Math.hypot(rock.x-player.x,rock.y-player.y)>reach)continue;
     const p=atlasPoint(rock,center,scale);
     if(visible(p))layers.rocks.push(`<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${Math.max(1.1,rock.r*scale*.55).toFixed(1)}"/>`);
    }
   }
  }
  // Electric rings come from the identical deterministic storm generator.
  if(regionAt(center.x,center.y).id==='azure')for(const storm of stormFields(center.x,center.y,7200)){
   const p=atlasPoint(storm,center,scale);
   if(!visible(p))continue;
   const phase=stormPhase(storm,game.time||0).state;
   const label=phase==='warning'?'Буря: готовится разряд':phase==='discharge'?'Буря: разряд':
    phase==='recovery'?'Буря: затухание':'Электрическая буря';
   layers.storms.push(`<circle class="contour-storm ${phase}" cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(storm.r*scale)}"><title>${label}</title></circle>`);
  }
  for(const enemy of game.enemies||[]){
   if(layers.contacts.length>=9)break;
   if(!(enemy.hp>0)||enemy.converted||Math.hypot(enemy.x-player.x,enemy.y-player.y)>750)continue;
   const p=atlasPoint(enemy,center,scale);
   if(visible(p))layers.contacts.push(`<path class="contour-radar-contact" d="M${fmt(p.x)} ${fmt(p.y-5)}l4 8h-8Z"><title>Противник вблизи корабля</title></path>`);
  }
 }
 const supply=world.regionalSupply||{};
 const knownCargo=[...(supply.convoys||[]),...(supply.central?.convoys||[]),
  ...(supply.frontier?.azure?.convoys||[]),...(supply.frontier?.teal?.convoys||[]),
  supply.frontier?.azure?.repairExpedition,supply.frontier?.teal?.repairExpedition];
 for(const cargo of knownCargo){
  if(layers.cargo.length>=12)break;
  if(!cargo?.seen||cargo.hp===0||!Number.isFinite(cargo.x)||!Number.isFinite(cargo.y))continue;
  // A once-seen distant transport is not necessarily being tracked now.
  // Only local visual sightings or an actively tracked waypoint are precise.
  const local=Math.hypot(cargo.x-player.x,cargo.y-player.y)<=850;
  const tracked=game.waypoint?.id===cargo.id&&
   (!game.waypoint.radioContact||game.waypoint.signalLive===true);
  if(!local&&!tracked)continue;
  const p=atlasPoint(cargo,center,scale);
  if(!visible(p))continue;
  const type=cargo.frontierRepair?'Ремонтный корабль':'Наблюдаемый транспорт';
  layers.cargo.push(`<g class="contour-map-cargo" transform="translate(${fmt(p.x)} ${fmt(p.y)})" role="img" aria-label="${type}"><circle r="9"/><path d="M-4 -3L5 0L-4 3Z"/><title>${type} · положение известно</title></g>`);
 }
 if(world.networkTopology){
  for(const [a,b] of world.networkTopology().links||[]){
   const p=atlasPoint(a,center,scale),q=atlasPoint(b,center,scale);
   if(!visible(p)&&!visible(q))continue;
   layers.relay.push(`<path class="contour-relay-link" d="M${fmt(p.x)} ${fmt(p.y)}L${fmt(q.x)} ${fmt(q.y)}"/>`);
  }
 }
 const draw=(cls,items)=>`<g class="${cls}" aria-hidden="true">${items.join('')}</g>`;
 return {
  backdrop:draw('contour-rocks',layers.rocks)+draw('contour-map-storms',layers.storms),
  signals:draw('contour-map-relays',layers.relay)+draw('contour-radar-contacts',layers.contacts)+
   `<g class="contour-cargo-layer">${layers.cargo.join('')}</g>`+layers.viewport,
  visibleCargo:layers.cargo.length,visibleStorms:layers.storms.length,
  visibleContacts:layers.contacts.length,visibleRelays:layers.relay.length
 };
}

export function atlasNavigation(game,center,scale,overview){
 const player=atlasPoint(game.player,center,scale);
 const waypoint=game.manualWaypoint||game.waypoint;
 const target=waypoint&&Number.isFinite(waypoint.x)&&Number.isFinite(waypoint.y)?
  atlasPoint(waypoint,center,scale):null;
 const guide=target&&visible(player)?`<path class="contour-navigation-path" d="M${fmt(player.x)} ${fmt(player.y)}L${fmt(target.x)} ${fmt(target.y)}"/>`:'';
 const marker=target&&visible(target)?`<g class="contour-navigation-target" transform="translate(${fmt(target.x)} ${fmt(target.y)})"><circle r="8"/><path d="M-12 0H-5M5 0H12M0 -12V-5M0 5V12"/><title>Выбранная цель маршрута</title></g>`:'';
 const step=overview?20000:1000,px=step*scale;
 const scaleBar=`<g class="contour-scale-bar"><path d="M23 441v-5h${fmt(px)}v5M23 441h${fmt(px)}"/><text x="23" y="430">${overview?'20 км':'1 км'}</text></g>`;
 return guide+marker+scaleBar;
}
