/**
 * One deterministic Azure anomaly prototype.
 * Geometry and timing are shared by danger checks and Canvas feedback.
 * No gameplay randomness and no new per-frame particle systems.
 */
export const ION_FIELD=Object.freeze({x:6000,y:40000,r:145});
export const ION_PERIOD=9;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2;

export function ionPhase(time){
 const t=Math.max(0,time),cycle=Math.floor(t/ION_PERIOD);
 const local=t-cycle*ION_PERIOD;
 if(local<4)return {state:'idle',cycle,remaining:4-local};
 if(local<6.5)return {state:'warning',cycle,remaining:6.5-local,progress:(local-4)/2.5};
 if(local<7.1)return {state:'discharge',cycle,remaining:7.1-local};
 return {state:'recovery',cycle,remaining:ION_PERIOD-local};
}
export function inIonField(target,field=ION_FIELD){
 return Math.hypot(target.x-field.x,target.y-field.y)<field.r+(target.r||0);
}
export function ionApproach(target,field=ION_FIELD,margin=0){
 return Math.hypot(target.x-field.x,target.y-field.y)<field.r+margin;
}

export function drawIonField(ctx,field,phase,time=0,fps=60,reducedMotion=false){
 const {x,y,r}=field;
 ctx.save();
 // The exact physical boundary remains visible at every graphics quality.
 ctx.strokeStyle=phase.state==='discharge'?'#f0ffff':
  phase.state==='warning'?'#7cf4ff':'#4e9aa7';
 ctx.lineWidth=phase.state==='discharge'?4:phase.state==='warning'?2.7:1.3;
 ctx.globalAlpha=phase.state==='idle'?.44:phase.state==='recovery'?.3:1;
 ctx.setLineDash(phase.state==='warning'||phase.state==='discharge'?[]:[9,12]);
 ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();
 ctx.setLineDash([]);
 if(phase.state==='warning'){
  // A contracting inner ring and an explicit time label mark the strike time.
  const radius=r*(.28+.68*(1-phase.progress));
  ctx.strokeStyle='#b3f5ff';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.stroke();
  ctx.fillStyle='#ddffff';ctx.font='bold 13px system-ui';
  ctx.textAlign='center';ctx.fillText('РАЗРЯД '+Math.max(0,phase.remaining).toFixed(1)+' с',x,y-r-15);
 }else if(phase.state==='discharge'){
  ctx.strokeStyle='#a5efff';ctx.lineWidth=2.8;
  // The arcs stay inside the same collision circle.
  for(let i=0;i<4;i++){
   const a=i*TAU/4+(reducedMotion?0:time*.2);
   ctx.beginPath();
   ctx.moveTo(x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82);
   ctx.lineTo(x+Math.cos(a+.25)*r*.35,y+Math.sin(a+.25)*r*.35);
   ctx.lineTo(x+Math.cos(a+.6)*r*.62,y+Math.sin(a+.6)*r*.62);
   ctx.stroke();
  }
  if(fps>=36&&!reducedMotion){
   ctx.globalAlpha=.14;ctx.fillStyle='#79e7ff';
   ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
  }
 }else if(phase.state==='idle'&&fps>=40&&!reducedMotion){
  ctx.globalAlpha=.25;ctx.strokeStyle='#70cfd9';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(x,y,r*.4,0,TAU*.65);ctx.stroke();
 }
 ctx.restore();
}
