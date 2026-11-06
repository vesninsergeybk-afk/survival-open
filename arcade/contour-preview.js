import {CONTOURS,contourArea,contourFields,contourLinkOffer,contourProduction,
 insidePolygon} from './territory-system.js?v=contours-1';
import {REGIONS} from './regions.js?v=regions-1';
import {mapViewport} from './map-navigation.js?v=map-ux-1';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// Describe only states the pilot can know. An unvisited enemy remains an
// unknown candidate until reconnaissance reveals its ownership.
export function contourCandidateInstruction(node){
 if(!node)return 'Выберите станцию на карте.';
 const known=node.discovered||node.active||node.strategicRole;
 if(!known)return 'Разведайте станцию. После сближения станет ясно, нужно ли её включить или захватить.';
 if(node.enemy)return 'Захватите станцию в полёте, затем соедините её со своей сетью.';
 if(node.suppressed)return 'Дождитесь восстановления передатчика в полёте. Уничтожьте носитель помех, чтобы он не подавил станцию снова.';
 if(!node.active)return 'Включите станцию в полёте, затем проведите к ней линию на карте контуров.';
 return 'Станция работает. Проверьте доступные соединения на карте контуров.';
}

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

// Use the same visible nodes for the automatic suggestion and the actual atlas.
export function contourRegionNodes(world,region,viewport=null){
 if(!region)return [];
 const center=viewport?.center||region.survey,scale=viewport?.scale||(region.id==='amethyst'?.055:.049);
 const radius=Math.max(5300,Math.hypot(340,240)/scale+500);
 const nodes=new Map(world.nearbyStations(center.x,center.y,radius,true).map(s=>[s.id,s]));
 for(const s of world.stations.values())if(s.active||s.discovered||s.strategicRole)nodes.set(s.id,s);
 return [...nodes.values()].filter(s=>{
  const x=340+(s.x-center.x)*scale,y=240+(s.y-center.y)*scale;
  return x>18&&x<662&&y>18&&y<462;
 });
}

// Select a starting point for suggestions only. Never construct a line, spend
// resources, change ownership or reveal an unvisited station here.
export function focusContourRegion(game,id,preferredId=null){
 const region=REGIONS.find(r=>r.id===id);
 game.contourRegion=region?.id||'all';game.contourFirst=null;game.contourSelection=null;
 game.contourError='';game.contourInfo='';game.contourFeedback=null;
 if(!region)return null;
 const nodes=contourRegionNodes(game.world,region,mapViewport({...game,mapView:'territory'}));
 const own=nodes.filter(s=>s.active&&!s.enemy&&!s.suppressed);
 const preferred=own.find(s=>s.id===preferredId);
 const proposals=own.map(node=>({node,choices:contourConnectionChoices(game.world,node.id,nodes)}));
 proposals.sort((a,b)=>Number(b.choices.ready.some(c=>c.preview.areaGain>1))-Number(a.choices.ready.some(c=>c.preview.areaGain>1))||
  Number(b.choices.ready.length>0)-Number(a.choices.ready.length>0)||
  Number(!b.choices.ready.length&&b.choices.next.length>0)-Number(!a.choices.ready.length&&a.choices.next.length>0)||
  distance(a.node,game.player)-distance(b.node,game.player));
 const source=preferred||proposals[0]?.node;
 if(source)game.contourFirst=game.contourSelection=source.id;
 return source||null;
}
