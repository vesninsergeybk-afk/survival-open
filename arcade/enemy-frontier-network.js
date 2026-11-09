// Industrial defense fronts belong to the same paid economy as convoys and
// patrols. Only a handful of threatened colonies simulate physical barriers.
export const FRONTIER=Object.freeze({
 count:7,spacing:390,radius:1880,nodeHp:210,nodeCost:3,
 buildSeconds:7,repairSeconds:115,maxFronts:2,
 detectRadius:6700,approachRadius:3400,warningRange:190,
 contactWidth:42,impactDamage:30
});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const roleId=(colony,role)=>colony.id+':'+role;
const live=(world,id)=>{const s=world.stations?.get(id);
 return !!s?.enemy&&!s.captured&&!s.suppressed&&s.hp>0;};
const outward=(colony,point)=>{
 const dx=point.x-colony.x,dy=point.y-colony.y,d=Math.hypot(dx,dy)||1;
 return {x:dx/d,y:dy/d};
};

function createFront(colony,vector,time,constructed=false){
 const v=outward(colony,vector);
 const x=colony.x+v.x*FRONTIER.radius,y=colony.y+v.y*FRONTIER.radius;
 const index=colony.fronts?.length||0;
 const nodes=Array.from({length:FRONTIER.count},(_,slot)=>{
  const offset=(slot-(FRONTIER.count-1)/2)*FRONTIER.spacing;
  return {id:colony.id+':front:'+index+':'+slot,colonyId:colony.id,
   x:x-v.y*offset,y:y+v.x*offset,slot,r:46,
   hp:constructed?FRONTIER.nodeHp:0,maxHp:FRONTIER.nodeHp,
   buildAt:constructed?0:time+FRONTIER.buildSeconds*(slot+1),
   repairAt:0,hit:0};
 });
 return {id:colony.id+':front:'+index,
  bearing:Math.atan2(v.y,v.x),x,y,createdAt:time,
  targetX:vector.x,targetY:vector.y,announced:false,nodes};
}

// Established citadels and selected mature colonies have defended territory
// from the first second. Newly threatened fronts, by contrast, are built one
// buoy at a time and must pay from a real factory stockpile.
export function seedFrontierNetwork(colony){
 if(Array.isArray(colony.fronts))return colony.fronts;
 colony.fronts=[];
 if(colony.fortress||colony.tier>=4&&colony.index%11===0){
  const vector={x:colony.x+Math.cos(colony.rotation)*2500,
   y:colony.y+Math.sin(colony.rotation)*2500};
  colony.fronts.push(createFront(colony,vector,0,true));
 }
 return colony.fronts;
}

export function orderFrontierNetwork(world,colony,playerField,time){
 seedFrontierNetwork(colony);
 if(!playerField||colony.fronts.length>=FRONTIER.maxFronts||
  !live(world,roleId(colony,'relay'))||!live(world,roleId(colony,'factory'))||
  !(colony.pool>=FRONTIER.nodeCost)||
  dist(colony,playerField)>FRONTIER.detectRadius)return null;
 const dir=outward(colony,playerField),angle=Math.atan2(dir.y,dir.x);
 if(colony.fronts.some(w=>Math.cos(w.bearing-angle)>.60))return null;
 const front=createFront(colony,playerField,time);
 colony.fronts.push(front);
 return front;
}

export function advanceFrontierNetwork(world,colony,time){
 seedFrontierNetwork(colony);
 const relay=live(world,roleId(colony,'relay'));
 const factory=live(world,roleId(colony,'factory'));
 if(!relay||!factory)return [];
 const results=[];
 // Exactly one construction or repair payment per colony per economy tick.
 for(const front of colony.fronts){
  for(const buoy of front.nodes){
   if(buoy.hp>0)continue;
   if(time<buoy.buildAt||time<buoy.repairAt||colony.pool<FRONTIER.nodeCost)continue;
   colony.pool-=FRONTIER.nodeCost;
   buoy.hp=buoy.maxHp;
   buoy.buildAt=0;buoy.repairAt=0;
   results.push({kind:'front-built',colonyId:colony.id,frontId:front.id,buoyId:buoy.id,time});
   return results;
  }
 }
 return results;
}

export function frontierBuoysNear(world,x,y,r){
 const found=[];
 for(const colony of world?.population?.colonies||[]){
  if(!colony.fronts?.length||Math.hypot(colony.x-x,colony.y-y)>FRONTIER.radius+r+2100||
   !live(world,roleId(colony,'relay')))continue;
  for(const front of colony.fronts)for(const buoy of front.nodes)
   if(buoy.hp>0&&Math.hypot(buoy.x-x,buoy.y-y)<r+buoy.r)found.push(buoy);
 }
 return found;
}

export function damageFrontierBuoy(world,buoy,amount,time){
 const colony=world?.population?.colonies.find(c=>c.id===buoy?.colonyId);
 if(!colony||!colony.fronts?.some(f=>f.nodes.includes(buoy))||
  !live(world,roleId(colony,'relay'))||buoy.hp<=0)return {hit:false};
 const before=buoy.hp;
 buoy.hp=Math.max(0,before-Math.max(0,amount));buoy.hit=.25;
 if(buoy.hp===0)buoy.repairAt=time+FRONTIER.repairSeconds;
 return {hit:true,dealt:before-buoy.hp,destroyed:buoy.hp===0,colony};
}

export function activeFrontierSegments(world,near=null,r=Infinity){
 const segments=[];
 for(const colony of world?.population?.colonies||[]){
  if(!colony.fronts?.length||near&&dist(colony,near)>FRONTIER.radius+r+2200||
   !live(world,roleId(colony,'relay')))continue;
  for(const front of colony.fronts)for(let i=1;i<front.nodes.length;i++){
   const a=front.nodes[i-1],b=front.nodes[i];
   if(a.hp>0&&b.hp>0&&(!near||Math.min(dist(a,near),dist(b,near))<r+420))
    segments.push({a,b,colony,front});
  }
 }
 return segments;
}

function contact(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
 const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1,len),0,1);
 const x=a.x+dx*t,y=a.y+dy*t;
 return {x,y,d:Math.hypot(p.x-x,p.y-y),t};
}

function crossedWall(from,to,a,b){
 // Intersect the finite movement segment with the finite buoy span.
 // Crossing an imaginary extension beyond a wall end must not cause damage.
 const vx=to.x-from.x,vy=to.y-from.y,wx=b.x-a.x,wy=b.y-a.y;
 const det=vx*wy-vy*wx;
 if(Math.abs(det)<1e-7)return false;
 const ax=a.x-from.x,ay=a.y-from.y;
 const t=(ax*wy-ay*wx)/det,u=(ax*vy-ay*vx)/det;
 return t>=0&&t<=1&&u>=0&&u<=1;
}

export function frontierBarrierContact(world,player,previous){
 // Checking the swept path prevents a fast Shift dash from tunnelling through.
 const candidates=activeFrontierSegments(world,player,FRONTIER.approachRadius);
 let warning=null,impact=null;
 for(const s of candidates){
  const {a,b}=s,next=contact(player,a,b),old=contact(previous,a,b);
  const swept=crossedWall(previous,player,a,b);
  if(next.d<FRONTIER.warningRange&&(!warning||next.d<warning.distance))
   warning={...s,distance:next.d,at:{x:next.x,y:next.y}};
  if(next.d<FRONTIER.contactWidth||old.d<FRONTIER.contactWidth||swept){
   if(!impact||next.d<impact.distance)
    impact={...s,distance:next.d,at:{x:next.x,y:next.y}};
  }
 }
 return {warning,impact};
}

export function frontierThreatNear(world,p,r=2500){
 return activeFrontierSegments(world,p,r).some(({a,b})=>
  Math.min(dist(a,p),dist(b,p))<r);
}
