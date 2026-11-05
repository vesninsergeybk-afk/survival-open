import {CONTOURS,contourArea,contourFields,contourLinkOffer,contourProduction,
 insidePolygon} from './territory-system.js?v=contours-1';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// A proposed link is evaluated against a throwaway graph. Previewing must
// never change the production clock, the saved lines, or the active fields.
export function previewContourConnection(world,from,to){
 const offer=contourLinkOffer(world,from,to);
 if(!offer.ok)return {...offer,areaGain:0,productionGain:0,newFields:[]};
 const before=contourFields(world);
 const projected={stations:world.stations,contours:{links:[...world.contours.links,[from,to]]}};
 const after=contourFields(projected);
 const areaGain=Math.max(0,contourArea(after)-contourArea(before));
 const productionGain=Math.max(0,contourProduction(after)-contourProduction(before));
 const newFields=areaGain>1?after.filter(f=>
  !before.some(existing=>insidePolygon(f.center,existing.polygon))):[];
 return {...offer,areaGain,productionGain,newFields};
}

export function contourConnectionChoices(world,from,nodes){
 const source=world.stations.get(from);
 if(!source)return {ready:[],next:[]};
 const near=nodes.filter(b=>b.id!==from&&distance(source,b)>=150&&
  distance(source,b)<=CONTOURS.maxLength).map(node=>({
   node,distance:distance(source,node),
   preview:previewContourConnection(world,from,node.id)
  }));
 const ready=near.filter(item=>item.preview.ok).sort((a,b)=>
  Number(b.preview.areaGain>1)-Number(a.preview.areaGain>1)||
  b.preview.areaGain-a.preview.areaGain||a.distance-b.distance);
 const next=near.filter(item=>!item.node.active||item.node.enemy||item.node.suppressed)
  // Ownership of an undiscovered node is hidden; don't rank suggestions
  // by information the player has not earned yet.
  .sort((a,b)=>a.distance-b.distance);
 return {ready,next};
}
