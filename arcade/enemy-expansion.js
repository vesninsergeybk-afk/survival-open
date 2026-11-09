import {REGIONS,regionAt} from './regions.js?v=regions-1-living-world-population-1';
import {warFronts,FRONT_KEYS} from './war-fronts.js?v=campaign-1-repair-qa-1-enemy-balance-2-territory-war-1';
import {CONTOURS,contourFields,contourArea,connectContour} from './territory-system.js?v=contours-1-triangle-defense-1';

// Enemy influence is real, paid for out of the *existing* industrial stock.
// It is not an independent free spawning economy. Only the five surveyed
// regions advance, and only while the game simulation advances.
export const EXPANSION=Object.freeze({interval:85,firstAt:90,cycle:180,cost:2,
 maxLinks:180,maxFields:90});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const key=(a,b)=>[a,b].sort().join('|');
const hostile=s=>!!s?.enemy&&!s.captured&&!s.suppressed&&s.hp>0;
const owner=front=>front.key==='home'||front.key==='north'?'ore':'resource';
// Expansion is optional investment. It must never consume the material for
// the next transport or the first response to an ambush. That material is
// mined normally; this reserve is not a free grant or an untouchable wallet.
export function expansionReserve(front){
 if(!front?.working)return 0;
 return front.cost+(front.key==='home'||front.key==='north'?4:2);
}
const canInvest=front=>!!front?.source?.enemy&&!!front?.depot?.enemy&&front.working&&
 Number.isFinite(front.pool?.[owner(front)])&&
 front.pool[owner(front)]>=EXPANSION.cost+expansionReserve(front);

export const createEnemyExpansion=(now=0)=>({version:1,links:[],plan:null,
 nextAt:now+EXPANSION.firstAt,incomeAt:now+EXPANSION.cycle,
 spent:0,earned:0,events:[],prepared:false});

function enemyView(world,links){
 const stations=new Map([...world.stations].map(([id,s])=>[id,
  {...s,active:hostile(s),enemy:!hostile(s)}]));
 return {stations,contours:{links:links.map(([a,b])=>[a,b])}};
}

export function enemyTerritoryFields(world){
 if(!world?.enemyExpansion?.links?.length)return [];
 return contourFields(enemyView(world,world.enemyExpansion.links));
}

// A revealed enemy face requires all its vertices to have been discovered.
// Neither the all-region atlas nor the local map reveals secret machine nodes.
export function knownEnemyFields(world){
 return enemyTerritoryFields(world).filter(f=>f.vertices.every(id=>world.stations.get(id)?.discovered));
}

const planValid=(world,plan)=>plan&&FRONT_KEYS.includes(plan.front)&&
 Array.isArray(plan.ids)&&plan.ids.length===3&&new Set(plan.ids).size===3&&
 plan.ids.every(id=>hostile(world.stations.get(id)))&&
 plan.ids.every(id=>regionAt(world.stations.get(id).x,world.stations.get(id).y).id===plan.region);

function choosePlan(world,fronts,links){
 const already=new Set(links.map(([a,b])=>key(a,b)));
 const current=enemyView(world,links),base=contourArea(contourFields(current));
 const options=[];
 for(const front of fronts){
  if(!canInvest(front))continue;
  for(const region of REGIONS.filter(r=>front.regions.includes(r.id))){
   const nodes=[...world.stations.values()].filter(s=>hostile(s)&&
    regionAt(s.x,s.y).id===region.id&&dist(s,region.survey)<6500);
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];if(dist(a,b)>CONTOURS.maxLength)continue;
    for(let k=j+1;k<nodes.length;k++){
     const c=nodes[k];if(dist(a,c)>CONTOURS.maxLength||dist(b,c)>CONTOURS.maxLength)continue;
     const triangle=[[a.id,b.id],[b.id,c.id],[c.id,a.id]];
     const missing=triangle.filter(([x,y])=>!already.has(key(x,y)));
     if(!missing.length)continue;
     const preview=enemyView(world,links);
     if(missing.some(([x,y])=>!connectContour(preview,x,y).ok))continue;
     const gain=contourArea(contourFields(preview))-base;
     if(gain<CONTOURS.minFaceArea)continue;
     const reused=3-missing.length;
     options.push({front:front.key,region:region.id,ids:[a.id,b.id,c.id],
      gain,missing:missing.length,score:gain+reused*650000});
    }
   }
  }
 }
 options.sort((a,b)=>b.score-a.score||a.missing-b.missing||
  a.front.localeCompare(b.front)||a.ids.join('|').localeCompare(b.ids.join('|')));
 const chosen=options[0];
 return chosen?{front:chosen.front,region:chosen.region,ids:chosen.ids}:null;
}

export function enemyExpansionPlan(world){
 const state=world?.enemyExpansion,plan=state?.plan;
 if(!planValid(world,plan))return null;
 const stations=plan.ids.map(id=>world.stations.get(id));
 const seen=stations.filter(s=>s.discovered),missing=[];
 const links=new Set(state.links.map(([a,b])=>key(a,b)));
 for(const [a,b] of [[0,1],[1,2],[2,0]])if(!links.has(key(plan.ids[a],plan.ids[b])))
  missing.push([stations[a],stations[b]]);
 return {front:plan.front,region:plan.region,stations,seen,missing,
  polygon:stations.map(s=>({x:s.x,y:s.y})),nextAt:state.nextAt};
}

/** Advances at most one paid link per call, including after a time jump. */
export function advanceEnemyExpansion(world,time){
 const state=world?.enemyExpansion;if(!state||!Number.isFinite(time))return [];
 if(!state.prepared){
  // Deterministic station generation is cheap and does not discover nodes or
  // generate rocks. Territory must not depend on the player opening a menu.
  for(const region of REGIONS)world.nearbyStations(region.survey.x,region.survey.y,5400,true);
  state.prepared=true;
 }
 const events=[];
 if(time>=state.incomeAt){
  state.incomeAt=time+EXPANSION.cycle;
  const fields=enemyTerritoryFields(world);
  for(const front of warFronts(world)){
   if(!front.source?.enemy||!front.depot?.enemy||!front.working)continue;
   const count=fields.filter(f=>front.regions.includes(regionAt(f.center.x,f.center.y).id)).length;
   if(!count)continue;
   const stock=owner(front),limit=front.key==='home'?16:front.key==='north'?24:
    front.key==='azure'?12:16;
   const reward=Math.min(2,count),before=front.pool[stock];
   front.pool[stock]=Math.min(limit,before+reward);
   state.earned+=front.pool[stock]-before;
  }
 }
 if(time<state.nextAt||state.links.length>=EXPANSION.maxLinks)return events;
 state.nextAt=time+EXPANSION.interval;
 const fronts=warFronts(world);
 if(!planValid(world,state.plan)||
  !canInvest(fronts.find(f=>f.key===state.plan?.front)))state.plan=null;
 if(!state.plan)state.plan=choosePlan(world,fronts,state.links);
 if(!state.plan)return events;
 const front=fronts.find(f=>f.key===state.plan.front);
 const stock=front&&owner(front);
 if(!canInvest(front))return events;
 const plan=enemyExpansionPlan(world);
 if(!plan?.missing.length){state.plan=null;return events;}
 const [a,b]=plan.missing[0],preview=enemyView(world,state.links);
 if(!connectContour(preview,a.id,b.id).ok){state.plan=null;return events;}
 front.pool[stock]-=EXPANSION.cost;
 state.spent+=EXPANSION.cost;
 state.links.push([a.id,b.id,state.plan.front]);
 const closed=!enemyExpansionPlan(world)?.missing.length;
 events.push({kind:closed?'claim':'link',front:front.key,region:plan.region,
  a:a.id,b:b.id,x:(a.x+b.x)/2,y:(a.y+b.y)/2,
  witnessed:a.discovered&&b.discovered,at:time});
 state.events=events.concat(state.events).slice(0,8);
 if(closed)state.plan=null;
 return events;
}

export function validEnemyExpansion(state,stations,time){
 if(state===undefined)return true; // Existing checkpoints predate the system.
 if(!state||state.version!==1||!Array.isArray(state.links)||state.links.length>EXPANSION.maxLinks||
  !Number.isFinite(state.nextAt)||state.nextAt<0||state.nextAt>1e9||
  !Number.isFinite(state.incomeAt)||state.incomeAt<0||state.incomeAt>1e9||
  !Number.isFinite(state.spent)||state.spent<0||state.spent>1e7||
  !Number.isFinite(state.earned)||state.earned<0||state.earned>1e7||
  typeof state.prepared!=='boolean'||!Array.isArray(state.events)||state.events.length>8)return false;
 const ids=new Set(stations.map(([id])=>id)),unique=new Set();
 for(const link of state.links){
  if(!Array.isArray(link)||link.length!==3||!FRONT_KEYS.includes(link[2])||
   !ids.has(link[0])||!ids.has(link[1])||link[0]===link[1]||
   unique.has(key(link[0],link[1])))return false;
  unique.add(key(link[0],link[1]));
 }
 if(state.plan!==null&&(!state.plan||!FRONT_KEYS.includes(state.plan.front)||
  !REGIONS.some(r=>r.id===state.plan.region)||!Array.isArray(state.plan.ids)||
  state.plan.ids.length!==3||new Set(state.plan.ids).size!==3||
  state.plan.ids.some(id=>!ids.has(id))))return false;
 return state.events.every(e=>e&&['link','claim'].includes(e.kind)&&
  FRONT_KEYS.includes(e.front)&&REGIONS.some(r=>r.id===e.region)&&
  typeof e.a==='string'&&ids.has(e.a)&&typeof e.b==='string'&&ids.has(e.b)&&
  Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.at)&&e.at>=0&&
  e.at<=time&&typeof e.witnessed==='boolean');
}
