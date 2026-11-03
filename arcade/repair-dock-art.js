/**
 * Survivor Arcade — first station-identity pilot: civilian repair dock.
 *
 * Artistic source: ../assets/space/station-dock-v1.svg (original, top-down).
 * The one immutable SVG hull is decoded once and shared by every dock.
 * Only connected indicators and two pivoting mechanical arms draw per frame.
 * Does not control any gameplay, spawn particles, or consume random numbers.
 */
export const REPAIR_DOCK_SPEC=Object.freeze({
 source:'../assets/space/station-dock-v1.svg',
 frame:224,
 hullBounds:Object.freeze({left:-90,top:-83,right:90,bottom:83}),
 interactionRadius:165,
 armPivots:Object.freeze([{x:-50,y:-19},{x:50,y:-19}]),
 silhouette:'U-shaped bay open toward the top',
 eventSeconds:Object.freeze({activate:1.8,repair:1.55,repairDrones:1.55,hire:1.1,upgrade:1.3,service:1.2})
});
const TAU=Math.PI*2;
const clip=(n,min,max)=>Math.max(min,Math.min(max,n));
const image=typeof Image==='undefined'?null:new Image();
let imageReady=false;
if(image){
 image.decoding='async';
 image.onload=()=>{imageReady=!!image.naturalWidth;};
 image.onerror=()=>{imageReady=false;};
 image.src=new URL(REPAIR_DOCK_SPEC.source,import.meta.url).href;
}
export const dockArtReady=()=>imageReady;

export function dockVariant(base){
 const s=String(base?.id??'0:0');
 let hash=2166136261;
 for(let i=0;i<s.length;i++)hash=Math.imul(hash^s.charCodeAt(i),16777619)>>>0;
 return hash%3;
}
export function dockSerial(base){
 const s=String(base?.id??'0:0');
 let hash=2166136261;
 for(let i=0;i<s.length;i++)hash=Math.imul(hash^s.charCodeAt(i),16777619)>>>0;
 return 'RD-'+String(hash%1000).padStart(3,'0');
}
export function dockVisualState(base,connected=false){
 const active=!!base?.active||!!base?.captured;
 const max=Number(base?.maxHp);
 const ratio=max>0&&Number.isFinite(max)?clip(Number(base?.hp)/max,0,1):1;
 return {
  active,
  connected:active&&!!connected,
  variant:dockVariant(base),
  upgraded:active&&!!base?.usedUpgrade,
  damage:ratio<.55?ratio<.25?2:1:0
 };
}
export function markDockEvent(base,kind,time){
 if(base?.type!=='dock'||!Object.hasOwn(REPAIR_DOCK_SPEC.eventSeconds,kind)||
  !Number.isFinite(time))return false;
 base.stationVisualEvent={kind,at:time};
 return true;
}
export function dockEventPhase(base,time){
 const e=base?.stationVisualEvent;
 const duration=REPAIR_DOCK_SPEC.eventSeconds[e?.kind];
 if(!duration||!Number.isFinite(time)||!Number.isFinite(e.at))return null;
 const age=time-e.at;
 // Floating-point addition may land one ulp below the exact end.
 return age>=0&&age<duration-1e-9?{kind:e.kind,progress:age/duration}:null;
}
function poly(ctx,coordinates,fill,stroke='#0c1b2a',width=1.7){
 ctx.beginPath();
 ctx.moveTo(coordinates[0][0],coordinates[0][1]);
 for(let i=1;i<coordinates.length;i++)ctx.lineTo(coordinates[i][0],coordinates[i][1]);
 ctx.closePath();ctx.fillStyle=fill;ctx.fill();
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
/** Minimal recognizable emergency hull while the SVG is loading. */
function fallbackHull(ctx){
 poly(ctx,[[-77,-82],[-41,-82],[-36,23],[36,23],[41,-82],[77,-82],
  [74,62],[-73,62]],'#2b4055','#91aeb9',2);
 poly(ctx,[[-34,-73],[-24,-73],[-23,31],[23,31],[24,-73],[34,-73],
  [33,40],[-33,40]],'#152c40','#658398',1);
 ctx.fillStyle='#112336';ctx.fillRect(-23,-59,46,75);
 ctx.fillStyle='#3c5b6c';ctx.fillRect(-31,31,62,12);
}
/** One rigid, mirrored arm. The pivot never moves; only the small claw rotates. */
function drawArm(ctx,side,fold,powered,repairing){
 ctx.save();
 ctx.translate(side*50,-19);
 ctx.scale(side,1);
 // In local space both arms extend from right toward the open central bay.
 ctx.rotate(-.12-fold*.26);
 ctx.lineJoin='round';
 poly(ctx,[[-2,-6],[-17,-8],[-30,-2],[-29,5],[-17,3],[-3,5]],
  '#526e84','#0b1c2b',1.7);
 poly(ctx,[[-8,-4],[-20,-4],[-25,0],[-20,1],[-8,1]],
  '#9bb1ba','#344e62',1);
 poly(ctx,[[-28,-4],[-34,-8],[-39,-7],[-38,-2],[-32,1],[-38,4],
  [-37,8],[-32,8],[-27,4]],'#3b566a','#a0bcc6',1.2);
 ctx.fillStyle=repairing?'#b9f8e7':powered?'#78b5ba':'#536b7d';
 ctx.fillRect(-21,-2.4,7,2);
 ctx.beginPath();ctx.arc(0,0,6.3,0,TAU);
 ctx.fillStyle='#122438';ctx.fill();ctx.strokeStyle='#a2b7c1';ctx.lineWidth=1.6;ctx.stroke();
 ctx.beginPath();ctx.arc(0,0,2.7,0,TAU);
 ctx.fillStyle=powered?'#77d4d0':'#496878';ctx.fill();
 ctx.restore();
}
function lamp(ctx,x,y,on,tint,opacity=1){
 ctx.save();ctx.globalAlpha=opacity;
 ctx.fillStyle=on?tint:'#304b5b';
 ctx.fillRect(x-2.1,y-2.1,4.2,4.2);
 if(on){
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=opacity*.18;ctx.beginPath();ctx.arc(x,y,5.3,0,TAU);ctx.fill();
 }
 ctx.restore();
}
/**
 * Draw dock at the caller's current origin (b.x,b.y).
 * IMPORTANT: no writes to base, no use of b.x/b.y for anchor movement,
 * no randomization, no per-frame Image or offscreen canvas allocation.
 */
export function drawRepairDock(ctx,base,time,{connected=false,reducedMotion=false}={}){
 const state=dockVisualState(base,connected);
 const event=dockEventPhase(base,time);
 const serving=state.active&&(event?.kind==='repair'||event?.kind==='repairDrones');
 const unfolding=serving&&!reducedMotion?Math.sin(Math.PI*event.progress):0;
 const pulse=(state.active&&!reducedMotion)?(.9+.1*Math.sin(time*2.4)):1;
 ctx.save();
 if(imageReady)ctx.drawImage(image,-112,-112,224,224);
 else fallbackHull(ctx);
 // Individual hull signature is stable for this station ID, not a new layout.
 const stripe=state.variant;
 // Three stable equipment profiles; secondary silhouette differences remain
 // within the station's existing free approach radius.
 if(stripe===0){
  poly(ctx,[[-76,-24],[-85,-29],[-90,-25],[-88,-14],[-76,-11]],
   '#2d485b','#9cb5b9',1.4);
  lamp(ctx,-84,-21,state.active,'#9cdbd1',.72);
 }else if(stripe===1){
  poly(ctx,[[76,-24],[85,-29],[90,-25],[88,-14],[76,-11]],
   '#2d485b','#9cb5b9',1.4);
  lamp(ctx,84,-21,state.active,'#9cdbd1',.72);
 }else{
  poly(ctx,[[-12,57],[-12,81],[12,81],[12,57]],
   '#273e54','#9fb4bd',1.4);
  ctx.strokeStyle='#7196a4';ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(-7,65);ctx.lineTo(7,65);
  ctx.moveTo(-7,71);ctx.lineTo(7,71);ctx.stroke();
 }
 ctx.save();ctx.fillStyle='#c8c4a3';ctx.globalAlpha=.76;
 for(let i=0;i<stripe+1;i++){
  const y=-59+i*7;ctx.fillRect(-69,y,9,2.4);
 }
 ctx.restore();
 ctx.save();ctx.fillStyle='#a7c4cc';ctx.font='bold 8px monospace';
 ctx.textAlign='center';ctx.globalAlpha=.75;
 ctx.fillText(dockSerial(base),0,57);
 ctx.restore();
 // Active bay guidance is intentionally confined to the inner rail.
 ctx.save();
 ctx.globalAlpha=state.active?.34*pulse:.09;
 ctx.strokeStyle=state.active?'#69e7db':'#8196a6';
 ctx.lineWidth=2;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-38,-61);ctx.lineTo(-38,19);
 ctx.moveTo(38,-61);ctx.lineTo(38,19);ctx.stroke();
 ctx.restore();
 // Both clamps are drawn once and share their coordinate system.
 drawArm(ctx,-1,unfolding,state.active,serving);
 drawArm(ctx,1,unfolding,state.active,serving);
 // Local reactor and network radio are separate, truthful statuses.
 lamp(ctx,0,40,state.active,'#80ebde',pulse);
 lamp(ctx,63,24,state.connected,'#baf7cb',state.connected?pulse:.5);
 lamp(ctx,-63,24,state.active&&!state.connected,'#f2c989',.68);
 if(state.upgraded){
  // An installed part appears only if this specific dock sold an upgrade.
  poly(ctx,[[36,29],[47,28],[51,39],[38,43]],'#314d62','#a7cfce',1.3);
  lamp(ctx,43,35,true,'#9bcfff',.85);
 }
 // Actual damage; normal civilian docks should never smoke without HP loss.
 if(state.damage){
  ctx.save();ctx.strokeStyle='#a66c5d';
  ctx.lineWidth=state.damage===2?2.6:1.8;
  ctx.beginPath();ctx.moveTo(52,-41);ctx.lineTo(60,-25);ctx.lineTo(56,-14);
  ctx.moveTo(49,-32);ctx.lineTo(57,-29);ctx.stroke();
  ctx.fillStyle='#192734';ctx.globalAlpha=.56;
  ctx.fillRect(49,-48,state.damage===2?18:11,6);ctx.restore();
 }
 if(event&&state.active){
  const t=reducedMotion?1:event.progress;
  ctx.save();
  if(event.kind==='activate'){
   const opacity=reducedMotion?.5:(1-t)*.65;
   ctx.globalAlpha=opacity;ctx.strokeStyle='#b2fff0';ctx.lineWidth=2.2;
   ctx.beginPath();ctx.arc(0,-5,30+t*45,-.68,1.15);
   ctx.arc(0,-5,30+t*45,2.5,4);ctx.stroke();
  }else if(serving){
   ctx.globalAlpha=reducedMotion?.65:(1-t)*.54;
   ctx.strokeStyle='#a5ffdf';ctx.lineWidth=1.4;
   ctx.setLineDash([5,6]);
   ctx.beginPath();ctx.ellipse(0,-4,20+8*t,24+8*t,0,0,TAU);ctx.stroke();
   ctx.setLineDash([]);
  }else if(event.kind==='hire'){
   ctx.globalAlpha=reducedMotion?.7:(1-t)*.66;
   ctx.fillStyle='#b2e5ff';ctx.fillRect(-14,43,28,2);
  }else if(event.kind==='upgrade'){
   ctx.globalAlpha=reducedMotion?.7:(1-t)*.63;
   ctx.strokeStyle='#9ecfff';ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(43,35,8+8*t,0,TAU);ctx.stroke();
  }else if(event.kind==='service'){
   // Emergency condenser is a real purchased shield, not a fictitious weapon.
   ctx.globalAlpha=reducedMotion?.65:(1-t)*.6;
   ctx.strokeStyle='#a5cffa';ctx.lineWidth=1.7;
   ctx.beginPath();ctx.arc(0,40,6+16*t,-.4,Math.PI*1.4);
   ctx.stroke();
  }
  ctx.restore();
 }
 ctx.restore();
 return true;
}
