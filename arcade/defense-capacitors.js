// Shared ammunition capacitors are physical outbuildings inside a protected face.
// Basic turret fire uses the powered cable, never withdraws harvested flux.
export const DEFENSE_CAPACITOR=Object.freeze({
 capacity:2.4,harvestShare:.18,buildSeconds:2.5,packetSpeed:360,
 specialGap:16,artilleryCost:.48,arcCost:.38,laserCost:.48,hiveCost:.6,
 maxCells:64,maxPackets:256
});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const isFinitePoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const stateOf=world=>world?.contours;
// On shared borders the containing triangle wins over a merely closer centre.
function inPolygon(point,polygon){
 if(!Array.isArray(polygon)||polygon.length<3)return false;
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];
  if((a.y>point.y)!==(b.y>point.y)&&
   point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside;
}
const fieldFor=(point,fields)=>
 fields.find(field=>inPolygon(point,field.polygon))||
 [...fields].sort((a,b)=>distance(a.center,point)-distance(b.center,point))[0];
const pendingFor=(state,id)=>(state.defenseCapacitorPackets||[])
 .filter(p=>p.fieldId===id).reduce((n,p)=>n+p.amount,0);

export function defenseCapacitorLocation(world,point,fields=[]){
 if(!isFinitePoint(point)||!fields.length)return null;
 const field=fieldFor(point,fields);
 if(!field||typeof field.id!=='string'||!isFinitePoint(field.center))return null;
 if((world?.contours?.defenseCapacitors||[]).some(cell=>cell.fieldId===field.id))
  return null;
 // The player sees the extra structure BEFORE confirming the first turret.
 // All placements stay inside this triangle: the centroid-to-edge segment is
 // convex, so its interior fraction cannot leave a valid triangle.
 const dx=point.x-field.center.x,dy=point.y-field.center.y;
 const scale=distance(point,field.center)<140?.0:.40;
 let x=field.center.x+dx*scale,y=field.center.y+dy*scale;
 if(scale===0){
  const corner=field.polygon?.[0]||field.anchor||field.center;
  x=field.center.x+(corner.x-field.center.x)*.24;
  y=field.center.y+(corner.y-field.center.y)*.24;
 }
 return {fieldId:field.id,x,y,sourceX:field.anchor?.x??field.center.x,
  sourceY:field.anchor?.y??field.center.y};
}
export function ensureDefenseCapacitor(world,point,time,fields=[]){
 const state=stateOf(world);if(!state)return null;
 state.defenseCapacitors??=[];state.defenseCapacitorPackets??=[];
 const field=fieldFor(point,fields);
 if(!field)return null;
 const existing=state.defenseCapacitors.find(c=>c.fieldId===field.id);
 if(existing)return existing;
 if(state.defenseCapacitors.length>=DEFENSE_CAPACITOR.maxCells)return null;
 const location=defenseCapacitorLocation(world,point,fields);if(!location)return null;
 const cell={...location,charge:0,readyAt:time+DEFENSE_CAPACITOR.buildSeconds,
  lastSpecialAt:-1};
 state.defenseCapacitors.push(cell);return cell;
}
const capacitorSyncCache=new WeakMap();
export function ensureLegacyDefenseCapacitors(world,time,fields=[]){
 const state=stateOf(world);if(!state)return;
 if(time-(capacitorSyncCache.get(state)??-1e9)<3)return;
 capacitorSyncCache.set(state,time);
 const structures=[...(world?.contours?.artillery||[]),...(world?.contours?.supportTurrets||[])];
 for(const t of structures){
  if(t.hp>0&&isFinitePoint(t)&&fields.length)ensureDefenseCapacitor(world,t,time,fields);
 }
}
// Called when a real harvester RETURNS to its station. An airborne packet is
// reserved from that delivery, not minted. A full cell leaves the whole harvest
// available to normal station logistics.
export function shipDefenseFlux(world,field,harvested,time){
 const state=stateOf(world),cell=(state?.defenseCapacitors||[]).find(c=>
  c.fieldId===field?.id&&c.readyAt<=time);
 if(!cell||!Number.isFinite(harvested)||harvested<=0||!Array.isArray(state.defenseCapacitorPackets)||
  state.defenseCapacitorPackets.length>=DEFENSE_CAPACITOR.maxPackets)return 0;
 const room=DEFENSE_CAPACITOR.capacity-cell.charge-pendingFor(state,cell.fieldId);
 const amount=Math.min(harvested*DEFENSE_CAPACITOR.harvestShare,Math.max(0,room));
 if(amount<.000001)return 0;
 const start={x:field.anchor?.x??cell.sourceX,y:field.anchor?.y??cell.sourceY};
 state.defenseCapacitorPackets.push({fieldId:cell.fieldId,amount,
  startX:start.x,startY:start.y,
  launchedAt:time,arriveAt:time+.35+distance(start,cell)/DEFENSE_CAPACITOR.packetSpeed});
 return amount;
}
export function advanceDefenseCapacitors(world,time){
 const state=stateOf(world);if(!state)return;
 state.defenseCapacitors??=[];state.defenseCapacitorPackets??=[];
 const cells=new Map(state.defenseCapacitors.map(c=>[c.fieldId,c]));
 state.defenseCapacitorPackets=state.defenseCapacitorPackets.filter(packet=>{
  if(time<packet.arriveAt)return true;
  const cell=cells.get(packet.fieldId);
  if(cell)cell.charge=clamp(cell.charge+packet.amount,0,DEFENSE_CAPACITOR.capacity);
  else state.flux=(state.flux||0)+packet.amount; // a lost structure refunds its cargo
  return false;
 });
}
// Each face has one AI-controlled reserve. Spending immediately prevents two
// towers in the same frame from duplicating a salvo or double-claiming flux.
export function spendDefenseCharge(world,turret,amount,time){
 const state=stateOf(world),cells=state?.defenseCapacitors||[];
 const cell=cells.find(c=>c.fieldId===turret?.defenseCellFieldId)||
  [...cells].sort((a,b)=>distance(a,turret)-distance(b,turret))[0];
 if(!cell||cell.readyAt>time||cell.charge+1e-8<amount||
  cell.lastSpecialAt>=0&&time-cell.lastSpecialAt<DEFENSE_CAPACITOR.specialGap)return false;
 cell.charge=Math.max(0,cell.charge-amount);cell.lastSpecialAt=time;return true;
}
export function specialThreat(game,turret,point,radius=160){
 if(!point)return false;
 const group=(game.enemies||[]).filter(e=>e.hp>0&&!e.converted&&!e.trialRetreatUntil&&
  distance(e,point)<radius+(e.r||0));
 return group.length>=3||group.some(e=>e.type==='gunship'||e.type==='boss'||
  e.type==='carrier'||e.type==='corvette'||e.openingCommander||
  e.stationRaid||e.relayAssault||e.maxHp>=175)||
  group.length>=2&&group.some(e=>distance(e,turret)<185);
}
export function validDefenseCapacitors(state){
 if(state?.defenseCapacitors===undefined&&state?.defenseCapacitorPackets===undefined)return true;
 const cs=state?.defenseCapacitors,ps=state?.defenseCapacitorPackets;
 if(!Array.isArray(cs)||cs.length>DEFENSE_CAPACITOR.maxCells||
  !Array.isArray(ps)||ps.length>DEFENSE_CAPACITOR.maxPackets)return false;
 const ids=new Set(),finite=(x,a=-1e9,b=1e9)=>Number.isFinite(x)&&x>=a&&x<=b;
 for(const c of cs){
  if(!c||typeof c.fieldId!=='string'||c.fieldId.length>200||ids.has(c.fieldId)||
   !finite(c.x)||!finite(c.y)||!finite(c.sourceX)||!finite(c.sourceY)||
   !finite(c.charge,0,DEFENSE_CAPACITOR.capacity+.00001)||
   !finite(c.readyAt,0)||!finite(c.lastSpecialAt,-1))return false;
  ids.add(c.fieldId);
 }
 for(const p of ps)if(!p||!ids.has(p.fieldId)||
   !finite(p.amount,0,DEFENSE_CAPACITOR.capacity)||!finite(p.startX)||!finite(p.startY)||
   !finite(p.launchedAt,0)||!finite(p.arriveAt,p.launchedAt,p.launchedAt+1e5))return false;
 return true;
}
export function drawDefenseCapacitors(ctx,game,cam,preview=null){
 const state=stateOf(game.world),now=game.time;
 if(!state)return;
 const draw=(c,ghost=false)=>{
  if(c.x<cam.x-70||c.x>cam.x+cam.w+70||c.y<cam.y-70||c.y>cam.y+cam.h+70)return;
  ctx.save();ctx.translate(c.x,c.y);ctx.globalAlpha=ghost?0.6:1;
  ctx.strokeStyle=ghost?'#b7f0ef':'#9bdcff';ctx.lineWidth=2.5;
  ctx.fillStyle=ghost?'rgba(38,80,95,.38)':'#102d43';
  ctx.beginPath();for(let i=0;i<6;i++){
   const angle=i*Math.PI/3+Math.PI/6,r=27;
   if(i===0)ctx.moveTo(Math.cos(angle)*r,Math.sin(angle)*r);
   else ctx.lineTo(Math.cos(angle)*r,Math.sin(angle)*r);
  }ctx.closePath();ctx.fill();ctx.stroke();
  const fraction=clamp(c.charge/DEFENSE_CAPACITOR.capacity,0,1);
  ctx.strokeStyle='#ffca71';ctx.lineWidth=5;
  ctx.beginPath();ctx.arc(0,0,18,-Math.PI/2,-Math.PI/2+Math.PI*2*fraction);ctx.stroke();
  ctx.fillStyle='#e6faff';ctx.font='bold 10px system-ui';ctx.textAlign='center';
  ctx.fillText(ghost?'ПРЕВЬЮ':'ЗАРЯД',0,4);ctx.restore();
 };
 for(const cell of state.defenseCapacitors||[]){
  if(cell.readyAt<=now&&cell.sourceX!==undefined){
   ctx.save();ctx.strokeStyle='rgba(255,195,106,.20)';ctx.lineWidth=1.5;
   ctx.setLineDash([7,10]);ctx.beginPath();ctx.moveTo(cell.sourceX,cell.sourceY);
   ctx.lineTo(cell.x,cell.y);ctx.stroke();ctx.restore();
  }
  draw(cell);
 }
 for(const p of state.defenseCapacitorPackets||[]){
  const target=(state.defenseCapacitors||[]).find(c=>c.fieldId===p.fieldId);
  if(!target)continue;
  const t=clamp((now-p.launchedAt)/Math.max(.1,p.arriveAt-p.launchedAt),0,1);
  const x=p.startX+(target.x-p.startX)*t,y=p.startY+(target.y-p.startY)*t;
  if(x<cam.x-30||x>cam.x+cam.w+30||y<cam.y-30||y>cam.y+cam.h+30)continue;
  ctx.save();ctx.fillStyle='#ffdb85';ctx.shadowColor='#ffb64c';
  ctx.shadowBlur=game.visuals?.reducedMotion?0:8;
  ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 if(preview?.point&&preview?.fields){
  const location=defenseCapacitorLocation(game.world,preview.point,preview.fields);
  if(location){
   ctx.save();ctx.strokeStyle='rgba(255,196,109,.48)';ctx.lineWidth=2;
   ctx.setLineDash([7,10]);ctx.beginPath();ctx.moveTo(location.sourceX,location.sourceY);
   ctx.lineTo(location.x,location.y);ctx.stroke();ctx.restore();
   draw({...location,charge:0},true);
  }
 }
}
