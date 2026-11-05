import {CONTOURS,connectContour,contourFields,contourArea,createContours} from './territory-system.js?v=contours-1';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const area=(a,b,c)=>Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))/2;
const edgeKey=(a,b)=>[a,b].sort().join('|');
const eligible=b=>b&&!b.suppressed&&!(b.discovered&&b.enemy);
const usable=b=>!!b.active&&!b.enemy&&!b.suppressed;
const known=b=>!!(b.discovered||b.active||b.strategicRole);

// Read-only first-field adviser. Unknown stations are *candidates*, not
// secretly classified friends; a suggested site may require reconnaissance.
export function firstContourPlan(world,nodes,focus=null,origin={x:0,y:0}){
 if(contourFields(world).length)return null;
 const stations=[...new Map(nodes.filter(eligible).map(b=>[b.id,b])).values()];
 const anchors=stations.filter(usable).sort((a,b)=>
  Number(b.id===focus)-Number(a.id===focus)||distance(a,origin)-distance(b,origin)).slice(0,5);
 if(!anchors.length)return null;
 const linked=new Set((world.contours?.links||[]).map(([a,b])=>edgeKey(a,b)));
 const candidates=[];
 for(const anchor of anchors){
  const near=stations.filter(b=>b.id!==anchor.id&&
   distance(anchor,b)>=150&&distance(anchor,b)<=CONTOURS.maxLength)
   .sort((a,b)=>distance(anchor,a)-distance(anchor,b)).slice(0,22);
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
   const b=near[i],c=near[j],length=distance(b,c),surface=area(anchor,b,c);
   if(length>CONTOURS.maxLength||length<150||surface<CONTOURS.minFaceArea)continue;
   const triplet=[anchor,b,c],edges=[[anchor,b],[b,c],[c,anchor]];
   const already=edges.filter(([x,y])=>linked.has(edgeKey(x.id,y.id))).length;
   const powered=triplet.filter(usable).length;
   const surveyed=triplet.filter(known).length;
   candidates.push({triplet,edges,surface,already,powered,surveyed,
    distance:distance(anchor,b)+distance(anchor,c)+distance(b,c),
    selected:triplet.some(s=>s.id===focus)});
  }
 }
 candidates.sort((a,b)=>b.already-a.already||b.powered-a.powered||
  b.surveyed-a.surveyed||Number(b.selected)-Number(a.selected)||
  a.distance-b.distance||a.surface-b.surface);
 for(const candidate of candidates.slice(0,90)){
  const projected=new Map(world.stations);
  for(const b of candidate.triplet)projected.set(b.id,{...b,active:true,enemy:false,suppressed:false});
  const copy={stations:projected,contours:{...createContours(),links:(world.contours?.links||[]).map(e=>[...e])}};
  let valid=true;
  for(const [a,b] of candidate.edges){
   if(linked.has(edgeKey(a.id,b.id)))continue;
   if(!connectContour(copy,a.id,b.id).ok){valid=false;break;}
  }
  if(!valid||contourArea(contourFields(copy))<=contourArea(contourFields(world)))continue;
  const {triplet,edges}=candidate;
  return {stations:triplet,edges:edges.map(([a,b])=>({a,b,
   built:linked.has(edgeKey(a.id,b.id)),ready:usable(a)&&usable(b)})),
   active:triplet.filter(usable).length,uncertain:triplet.some(b=>!known(b)),
   area:candidate.surface,next:triplet.find(b=>!usable(b))||null};
 }
 return null;
}
