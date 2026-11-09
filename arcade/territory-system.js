import {newTrialLedger,productiveContourFields,validContourTrials} from './contour-trials.js?v=first-loops-1';

// Territorial links appear automatically between powered friendly stations.
// They remain distinct from the shorter-range radio tree for station services.
export const CONTOURS=Object.freeze({maxLength:2800,maxDegree:5,maxLinks:160,
 minFaceArea:200000,launchInterval:5,cycleSeconds:180,maxHarvestersPerField:6,
 reserveCost:6,reserveArmSeconds:12});
const EPS=1e-7;
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const edgeKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const active=b=>!!b?.active&&!b.enemy&&!b.suppressed;
const geometryCache=new WeakMap();
const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<.01&&
 p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&
 p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
const properCross=(a,b,c,e)=>{
 if(onSegment(a,b,c)||onSegment(a,b,e)||onSegment(c,e,a)||onSegment(c,e,b))return true;
 return (cross(a,b,c)>0)!==(cross(a,b,e)>0)&&
  (cross(c,e,a)>0)!==(cross(c,e,b)>0);
};

export const createContours=()=>({links:[],flux:0,launches:{},harvesters:[],delivered:0,lost:0,
 nextLaunchAt:0,pulseReadyAt:0,reserve:null,sortie:null,nextSortieAt:0,
 trials:newTrialLedger(),artillery:[],artilleryPackets:[],artilleryShells:[],artillerySerial:0});

export function contourLinkOffer(world,firstId,secondId){
 const state=world.contours,a=world.stations.get(firstId),b=world.stations.get(secondId);
 if(!a||!b||a.id===b.id)return {ok:false,reason:'Выберите две разные станции'};
 if(!active(a)||!active(b))return {ok:false,reason:'Обе станции должны быть включены и не подавлены'};
 if(state.links.length>=CONTOURS.maxLinks)return {ok:false,reason:'Достигнут предел линий'};
 if(state.links.some(([x,y])=>edgeKey(x,y)===edgeKey(a.id,b.id)))
  return {ok:false,reason:'Эти станции уже соединены'};
 const length=d(a,b);
 if(length>CONTOURS.maxLength)return {ok:false,reason:'Станции слишком далеко: предел 2800 м'};
 if(length<150)return {ok:false,reason:'Станции расположены слишком близко'};
 if([a.id,b.id].some(id=>state.links.filter(pair=>pair.includes(id)).length>=CONTOURS.maxDegree))
  return {ok:false,reason:'Станция уже использует пять контурных линий'};
 for(const [x,y] of state.links){
  const c=world.stations.get(x),e=world.stations.get(y);
  if(!c||!e)continue;
  const shared=[x,y].includes(a.id)||[x,y].includes(b.id);
  if(shared){
   // Sharing one endpoint is legal; overlapping a collinear line is not.
   if(([a,b].some(p=>p.id!==x&&p.id!==y&&onSegment(c,e,p)))||
      ([c,e].some(p=>p.id!==a.id&&p.id!==b.id&&onSegment(a,b,p))))
    return {ok:false,reason:'Новая линия накладывается на существующую'};
   continue;
  }
  if(c&&e&&properCross(a,b,c,e))return {ok:false,reason:'Новая линия пересекает существующую'};
 }
 for(const node of world.stations.values()){
  if(node.id!==a.id&&node.id!==b.id&&onSegment(a,b,node))
   return {ok:false,reason:'Линия проходит через другую станцию'};
 }
 return {ok:true,length};
}
export function connectContour(world,a,b){
 const result=contourLinkOffer(world,a,b);
 if(result.ok)world.contours.links.push([a,b]);
 return result;
}
export function disconnectContour(world,a,b){
 const links=world.contours?.links;
 if(!links)return false;
 const index=links.findIndex(pair=>edgeKey(...pair)===edgeKey(a,b));
 if(index<0)return false;
 links.splice(index,1);return true;
}

/** Extend the saved planar mesh whenever the player gains a working station.
 * Existing links are retained (including temporarily jammed ones), so a
 * jammer cannot permanently destroy the network or change its layout.
 * Stable ordering makes the result independent of map visits and frame rate.
 */
export function autoConnectContours(world){
 if(!world?.contours?.links||!world.stations)return [];
 const stations=[...world.stations.values()].filter(active).sort((a,b)=>a.id.localeCompare(b.id));
 const candidates=[];
 for(let i=0;i<stations.length;i++)for(let j=i+1;j<stations.length;j++){
  const a=stations[i],b=stations[j],length=d(a,b);
  if(length>=150&&length<=CONTOURS.maxLength)candidates.push({a:a.id,b:b.id,length});
 }
 candidates.sort((a,b)=>a.length-b.length||edgeKey(a.a,a.b).localeCompare(edgeKey(b.a,b.b)));
 const added=[];
 // In an unclaimed sector, connecting the nearest pairs first can complete
 // tiny loops that block a larger, viable triangle. Seed one valid face before
 // filling the rest of the mesh. Keep this bounded: established, busy sectors
 // retain the cheaper incremental nearest-neighbour pass below.
 if(stations.length>=3&&stations.length<=48&&!contourFields(world).length){
  const triangles=[];
  for(let i=0;i<stations.length;i++)for(let j=i+1;j<stations.length;j++)
   for(let k=j+1;k<stations.length;k++){
    const a=stations[i],b=stations[j],c=stations[k],
     ab=d(a,b),bc=d(b,c),ca=d(c,a);
    if(Math.min(ab,bc,ca)<150||Math.max(ab,bc,ca)>CONTOURS.maxLength)continue;
    const area=Math.abs(cross(a,b,c))/2;
    if(area>=CONTOURS.minFaceArea)triangles.push({edges:[
     {a:a.id,b:b.id,length:ab},{a:b.id,b:c.id,length:bc},
     {a:c.id,b:a.id,length:ca}].sort((x,y)=>x.length-y.length),area,
     key:a.id+'|'+b.id+'|'+c.id});
   }
  triangles.sort((a,b)=>b.area-a.area||a.key.localeCompare(b.key));
  for(const triangle of triangles){
   const projected={stations:world.stations,contours:{links:[...world.contours.links]}};
   const missing=[];
   for(const {a,b} of triangle.edges){
    if(projected.contours.links.some(pair=>edgeKey(...pair)===edgeKey(a,b)))continue;
    if(!connectContour(projected,a,b).ok){missing.length=0;break;}
    missing.push([a,b]);
   }
   if(!missing.length||!contourFields(projected).length)continue;
   for(const [a,b] of missing)if(connectContour(world,a,b).ok)added.push([a,b]);
   break;
  }
 }
 for(const {a,b} of candidates){
  if(world.contours.links.length>=CONTOURS.maxLinks)break;
  if(world.contours.links.some(pair=>edgeKey(...pair)===edgeKey(a,b)))continue;
  if(connectContour(world,a,b).ok)added.push([a,b]);
 }
 return added;
}

const polygonArea=points=>points.reduce((sum,p,i)=>{
 const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;
},0)/2;
export const insidePolygon=(point,polygon)=>{
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if(onSegment(a,b,point))return true;
  if((a.y>point.y)!==(b.y>point.y)&&
   point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
};
const centerInside=polygon=>{
 let twice=0,cx=0,cy=0;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],crossing=a.x*b.y-b.x*a.y;
  twice+=crossing;cx+=(a.x+b.x)*crossing;cy+=(a.y+b.y)*crossing;
 }
 const center=Math.abs(twice)>EPS?{x:cx/(3*twice),y:cy/(3*twice)}:polygon[0];
 if(insidePolygon(center,polygon))return center;
 // For a concave face, move toward an interior point of a triangle fan.
 for(let i=1;i<polygon.length-1;i++){
  const p={x:(polygon[0].x+polygon[i].x+polygon[i+1].x)/3,
   y:(polygon[0].y+polygon[i].y+polygon[i+1].y)/3};
  if(insidePolygon(p,polygon))return p;
 }
 return polygon[0];
};

export function contourFields(world){
 const signature=(world.contours?.links||[]).map(([a,b])=>[a,b].map(id=>{
  const node=world.stations.get(id);
  return id+':'+(active(node)?1:0)+':'+(node?.x??0)+':'+(node?.y??0);
 }).join('>')).join('|');
 const cached=geometryCache.get(world);
 if(cached?.signature===signature)return cached.fields;
 const neighbours=new Map(),edges=[];
 for(const [x,y] of world.contours?.links||[]){
  const a=world.stations.get(x),b=world.stations.get(y);
  if(!active(a)||!active(b))continue;
  if(!neighbours.has(x))neighbours.set(x,[]);
  if(!neighbours.has(y))neighbours.set(y,[]);
  neighbours.get(x).push(y);neighbours.get(y).push(x);edges.push([x,y]);
 }
 for(const [id,list] of neighbours){
  const p=world.stations.get(id);
  list.sort((a,b)=>{
   const q=world.stations.get(a),r=world.stations.get(b);
   return Math.atan2(q.y-p.y,q.x-p.x)-Math.atan2(r.y-p.y,r.x-p.x);
  });
 }
 const walked=new Set(),faces=[];
 for(const [a,b] of edges)for(const [from,to] of [[a,b],[b,a]]){
  if(walked.has(from+'>'+to))continue;
  const vertices=[];let x=from,y=to,closed=false;
  for(let k=0;k<=edges.length*2;k++){
   const key=x+'>'+y;
   if(walked.has(key))break;
   walked.add(key);vertices.push(x);
   const around=neighbours.get(y),index=around?.indexOf(x)??-1;
   if(index<0)break;
   const next=around[(index-1+around.length)%around.length];
   x=y;y=next;
   if(x===from&&y===to){closed=true;break;}
  }
  if(!closed||vertices.length<3)continue;
  const polygon=vertices.map(id=>world.stations.get(id));
  const area=polygonArea(polygon);
  if(area<=EPS)continue; // Excludes the exterior clockwise face and degenerate loops.
  const center=centerInside(polygon);
  const anchor=polygon.reduce((best,p)=>d(p,center)<d(best,center)?p:best);
  faces.push({id:vertices.slice().sort().join('~'),vertices,polygon,area,center,anchor});
 }
 // Disconnected nested loops may exist. Their interiors are already owned;
 // a second loop cannot mint land or production inside the same polygon.
 const unique=faces.filter(f=>!faces.some(g=>g!==f&&g.area>f.area+EPS&&
  insidePolygon(f.center,g.polygon)&&f.polygon.every(p=>insidePolygon(p,g.polygon))));
 // The minimum territory size applies to a contiguous piece of land, not
 // each face of its triangulation. Otherwise a newly powered interior node
 // can split a valid field into three smaller faces and erase all its flux.
 // Only faces sharing an actual border qualify together; distant tiny loops
 // cannot combine their areas to create a fictitious productive territory.
 const owners=new Map(),adjacent=unique.map(()=>new Set());
 unique.forEach((face,index)=>face.vertices.forEach((id,i)=>{
  const key=edgeKey(id,face.vertices[(i+1)%face.vertices.length]);
  const other=owners.get(key);
  if(other===undefined)owners.set(key,index);
  else{adjacent[index].add(other);adjacent[other].add(index);}
 }));
 const kept=new Set(),visited=new Set();
 for(let i=0;i<unique.length;i++){
  if(visited.has(i))continue;
  const component=[],queue=[i];visited.add(i);
  while(queue.length){
   const index=queue.pop();component.push(index);
   for(const neighbor of adjacent[index])if(!visited.has(neighbor)){
    visited.add(neighbor);queue.push(neighbor);
   }
  }
  if(component.reduce((sum,index)=>sum+unique[index].area,0)+EPS>=CONTOURS.minFaceArea)
   for(const index of component)kept.add(index);
 }
 const fields=unique.filter((_,index)=>kept.has(index));
 geometryCache.set(world,{signature,fields});return fields;
}
export function contourArea(fields){return fields.reduce((sum,f)=>sum+f.area,0);}
export function contourProduction(fields){
 const area=contourArea(fields);
 return area>0?8*Math.sqrt(area/1000000):0;
}
export function fieldAt(world,x,y,fields=contourFields(world)){
 const p={x,y};return fields.find(field=>insidePolygon(p,field.polygon))||null;
}

// A paid decoy protects one strategically important contour node from a
// *specific* supply-funded jamming order. It does not intercept weapons,
// create defenders, or provide free passive income.
export function contourReserveEligible(world,stationId){
 const b=world.stations.get(stationId);
 return !!b&&active(b)&&!!(b.type==='lab'||b.type==='carrier'||b.relayBoost)&&
  contourFields(world).some(f=>f.vertices.includes(stationId));
}
export function armContourReserve(world,stationId,time){
 const state=world.contours;
 if(!state||!Number.isFinite(time)||time<0)return {ok:false,reason:'Недоступна сеть'};
 if(state.reserve)return {ok:false,reason:'Один ложный маяк уже установлен. Дождитесь его срабатывания.'};
 if(!contourReserveEligible(world,stationId))return {ok:false,reason:'Выберите работающую лабораторию, авианосную станцию или ретранслятор в действующем контуре.'};
 if(state.flux<CONTOURS.reserveCost)return {ok:false,reason:'Недостаточно доставленного флюкса'};
 state.flux-=CONTOURS.reserveCost;
 state.reserve={stationId,readyAt:time+CONTOURS.reserveArmSeconds};
 return {ok:true,readyAt:state.reserve.readyAt};
}
export function consumeContourReserve(world,stationId,time){
 const r=world.contours?.reserve;
 if(!r||r.stationId!==stationId||time<r.readyAt||
  !contourReserveEligible(world,stationId))return false;
 world.contours.reserve=null;
 return true;
}

export function advanceContours(world,time,dt,enemies=[],player=null){
 const state=world.contours;if(!state||dt<=0)return [];
 const fields=productiveContourFields(world,contourFields(world)),byId=new Map(fields.map(f=>[f.id,f]));
 const area=contourArea(fields),production=contourProduction(fields),events=[];
 if(state.reserve){
  const base=world.stations.get(state.reserve.stationId);
  if(!base?.active||base.enemy){
   events.push({kind:'reserveLost',stationId:state.reserve.stationId});
   state.reserve=null;
  }
 }
 state.harvesters=state.harvesters.filter(h=>byId.has(h.fieldId));
 // One shared departure clock prevents remaking the same land as new faces
 // from granting free shipments every time the player redraws a diagonal.
 if(fields.length&&time>=state.nextLaunchAt){
  state.nextLaunchAt=time+CONTOURS.launchInterval;
  for(const field of fields){
   if(state.harvesters.filter(h=>h.fieldId===field.id).length>=CONTOURS.maxHarvestersPerField)continue;
   state.launches[field.id]=time;
   state.harvesters.push({fieldId:field.id,progress:0,phase:'out',hp:2,launchedAt:time,
    value:production*(field.area/area)*CONTOURS.launchInterval/CONTOURS.cycleSeconds});
  }
 }
 for(const h of state.harvesters){
  const field=byId.get(h.fieldId);if(!field)continue;
  const distance=d(field.anchor,field.center);
  const speed=Math.max(.004,190/Math.max(100,distance));
  h.progress+=dt*speed;
  if(h.phase==='out'&&h.progress>=1){h.phase='gather';h.progress=0;}
  else if(h.phase==='gather'&&h.progress>=.24){h.phase='back';h.progress=0;}
  else if(h.phase==='back'&&h.progress>=1){
   state.flux+=h.value;
   state.delivered+=h.value;h.phase='done';
   events.push({kind:'delivered',amount:h.value,fieldId:h.fieldId});continue;
  }
  const t=h.phase==='out'?Math.min(1,h.progress):h.phase==='back'?1-Math.min(1,h.progress):1;
  const x=field.anchor.x+(field.center.x-field.anchor.x)*t;
  const y=field.anchor.y+(field.center.y-field.anchor.y)*t;
  // A raid can intercept visible collectors; remote simulation never invents
  // an off-screen loss while the player cannot possibly respond.
  if(player&&Math.hypot(player.x-x,player.y-y)<1700&&
   enemies.some(e=>e.hp>0&&!e.converted&&Math.hypot(e.x-x,e.y-y)<65)){
   h.hp-=dt*1.5;
   if(h.hp<=0){h.phase='done';state.lost++;events.push({kind:'lost',fieldId:h.fieldId,x,y});}
  }
 }
 state.harvesters=state.harvesters.filter(h=>h.phase!=='done');
 // No unbounded historical field IDs in long play sessions.
 if(Object.keys(state.launches).length>256){
  const valid=new Set(fields.map(f=>f.id));
  for(const id of Object.keys(state.launches))if(!valid.has(id))delete state.launches[id];
 }
 return events;
}

export function validContours(state,stations){
 if(!state||typeof state!=='object'||!Array.isArray(state.links)||state.links.length>CONTOURS.maxLinks||
  !validContourTrials(state.trials)||
  !Number.isFinite(state.flux)||state.flux<0||state.flux>1e12||
  !Number.isFinite(state.delivered)||state.delivered<0||
  !Number.isInteger(state.lost)||state.lost<0||
  !Number.isFinite(state.nextLaunchAt??0)||(state.nextLaunchAt??0)<0||
  !Number.isFinite(state.pulseReadyAt??0)||(state.pulseReadyAt??0)<0||
  !Number.isFinite(state.nextSortieAt??0)||(state.nextSortieAt??0)<0||
  (state.nextSortieAt??0)>1e9||
  !state.launches||typeof state.launches!=='object'||Array.isArray(state.launches)||
  Object.keys(state.launches).length>256||!Array.isArray(state.harvesters)||state.harvesters.length>320)return false;
 const ids=new Set(stations.map(([id])=>id)),unique=new Set();
 if(state.reserve!==undefined&&state.reserve!==null&&
  (!state.reserve||typeof state.reserve!=='object'||Array.isArray(state.reserve)||
   typeof state.reserve.stationId!=='string'||!ids.has(state.reserve.stationId)||
   !Number.isFinite(state.reserve.readyAt)||state.reserve.readyAt<0||
   state.reserve.readyAt>1e9))return false;
 if(state.sortie!==undefined&&state.sortie!==null){
  const s=state.sortie;
  if(!s||typeof s!=='object'||Array.isArray(s)||
   !['home','north','azure','teal'].includes(s.front)||
   typeof s.originId!=='string'||!ids.has(s.originId)||
   typeof s.targetId!=='string'||!ids.has(s.targetId)||
   !Number.isFinite(s.x)||!Number.isFinite(s.y)||
   Math.abs(s.x)>1e9||Math.abs(s.y)>1e9||
   !Number.isFinite(s.hp)||s.hp<=0||s.hp>2||
   !Number.isFinite(s.launchedAt)||s.launchedAt<0||s.launchedAt>1e9||
   !Number.isFinite(s.expiresAt)||s.expiresAt<s.launchedAt||
   s.expiresAt>s.launchedAt+55)return false;
 }
 for(const pair of state.links){
  if(!Array.isArray(pair)||pair.length!==2||!pair.every(id=>typeof id==='string'&&ids.has(id))||
   pair[0]===pair[1]||unique.has(edgeKey(...pair)))return false;
  unique.add(edgeKey(...pair));
 }
 if(Object.values(state.launches).some(v=>!Number.isFinite(v)||v<0||v>1e9))return false;
 for(const h of state.harvesters)if(!h||typeof h.fieldId!=='string'||
  !['out','gather','back'].includes(h.phase)||!Number.isFinite(h.progress)||h.progress<0||h.progress>2||
  !Number.isFinite(h.value)||h.value<0||h.value>100||!Number.isFinite(h.hp)||h.hp<0||h.hp>2||
  (h.launchedAt!==undefined&&(!Number.isFinite(h.launchedAt)||h.launchedAt<0||h.launchedAt>1e9)))return false;
 return true;
}
