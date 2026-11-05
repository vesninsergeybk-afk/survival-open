import {contourFields,contourArea,insidePolygon} from './territory-system.js?v=contours-1-world-feedback-1';

// A presentation-only timeline. Ownership, production and raids continue to
// come exclusively from the world simulation. Frozen geometry prevents a
// suppressed station from retroactively moving a departing boundary.
const copyField=f=>({id:f.id,vertices:[...f.vertices],polygon:f.polygon.map(p=>({x:p.x,y:p.y})),
 center:{...f.center},area:f.area});
const working=(world,id)=>{
 const s=world.stations.get(id);return !!s?.active&&!s.enemy&&!s.suppressed;
};
const snapshot=world=>({fields:contourFields(world).map(copyField),
 links:(world.contours?.links||[]).map(([a,b])=>[a,b,working(world,a)&&working(world,b)]),
 area:contourArea(contourFields(world))});
const signature=s=>s.links.map(([a,b,ok])=>[a,b].sort().join('~')+':'+Number(ok)).sort().join('|');
const realTime=()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now();

/** Detect topology changes, including an enemy jammer cutting existing links.
 * No event is created at first observation (load, checkpoint, or first map).
 */
export function syncContourDynamics(game){
 if(!game?.world?.contours)return null;
 const next=snapshot(game.world),prev=game.contourDynamics?.state;
 if(!prev){game.contourDynamics={state:next,transition:null};return null;}
 if(signature(prev)===signature(next))return game.contourDynamics.transition;
 const delta=next.area-prev.area;
 const kind=delta>1?'claim':delta< -1?'loss':'reconfigure';
 const transition={kind,at:Number.isFinite(game.time)?game.time:0,realAt:realTime(),
  previous:prev.fields,current:next.fields,area:Math.abs(delta),
  // An exact copy of the changed energized lines is sufficient to explain
  // which structure was connected or severed, without inventing a new one.
  changedLinks:next.links.filter(([a,b,ok])=>{
   const key=[a,b].sort().join('~');
   return !prev.links.some(([x,y,was])=>[x,y].sort().join('~')===key&&was===ok);
  })};
 game.contourDynamics={state:next,transition};
 return transition;
}

export function activeContourTransition(game){
 const t=game?.contourDynamics?.transition;
 return t&&Number.isFinite(game.time)&&game.time-t.at<6&&realTime()-t.realAt<6500? t:null;
}

export const fieldWasOwned=(point,oldFields)=>oldFields.some(f=>insidePolygon(point,f.polygon));

/** Only orders issued to a real, still-alive ship are shown as plans. A
 * jammer can deny a face; it does not acquire ownership of that face. */
export function enemyContourThreats(game){
 const world=game?.world;
 if(!world?.contours)return [];
 const fields=contourFields(world),used=new Set(),plans=[];
 for(const ship of game.enemies||[]){
  const raid=ship.stationRaid;
  if(!raid||ship.hp<=0||ship.converted||raid.expiresAt<=game.time||used.has(raid.stationId))continue;
  const target=world.stations.get(raid.stationId);
  if(!target?.active||target.enemy||!target.discovered)continue;
  used.add(target.id);
  const endangered=fields.filter(f=>f.vertices.includes(target.id));
  // Predict the *actual* surviving faces through the same authoritative
  // topology function. A bypass triangle may keep some land alive even when
  // an attacked station is taken offline.
  const projectedStations=new Map(world.stations);
  projectedStations.set(target.id,{...target,suppressed:true});
  const remaining=contourFields({stations:projectedStations,contours:world.contours});
  plans.push({target,ship:game.player&&Math.hypot((ship.x||0)-game.player.x,(ship.y||0)-game.player.y)<900?ship:null,
   fields,remaining,area:Math.max(0,contourArea(fields)-contourArea(remaining)),
   supports:[...new Set(endangered.flatMap(f=>f.vertices))].filter(id=>id!==target.id)
    .map(id=>world.stations.get(id)).filter(b=>b?.discovered)});
 }
 return plans.slice(0,4);
}
