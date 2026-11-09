// Deliberate field work has a distinct silhouette from the narrow extractor.
// Branches are deterministic within each 80 ms slice to avoid sprite jumping.
const TAU=Math.PI*2;
const jitter=(seed)=>{const x=Math.sin(seed*127.1+78.233)*43758.5453;return x-Math.floor(x);};

export function drawBranchedInteraction(ctx,from,target,{kind='vortex',time=0,progress=0,reduced=false}={}){
 if(!from||!target||!Number.isFinite(from.x)||!Number.isFinite(target.x))return;
 const green=kind==='repair',color=green?'#70ffc0':'#ff5c65',bright=green?'#d5ffe4':'#ffe1d7';
 const dx=target.x-from.x,dy=target.y-from.y,length=Math.hypot(dx,dy)||1;
 const nx=-dy/length,ny=dx/length,seed=Math.floor(time*12);
 const chains=reduced?2:5,steps=reduced?6:11;
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 for(let chain=0;chain<chains;chain++){
  const offsets=[],width=green?19:27;
  for(let i=0;i<=steps;i++){
   const fraction=i/steps,fade=Math.sin(Math.PI*fraction);
   offsets.push((jitter(seed+chain*41+i*7)-.5)*width*fade);
  }
  const path=[];
  for(let i=0;i<=steps;i++){
   const f=i/steps;
   path.push({x:from.x+dx*f+nx*offsets[i],y:from.y+dy*f+ny*offsets[i]});
  }
  ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
  ctx.strokeStyle=chain%2?bright:color;ctx.globalAlpha=.48+.1*(chain%3);
  ctx.lineWidth=chain%2?1.4:2.4;ctx.stroke();
  if(!reduced)for(let i=2;i<steps-1;i+=3){
   const p=path[i],f=.08+.1*jitter(seed+i+chain*9),side=i%2?1:-1;
   ctx.beginPath();ctx.moveTo(p.x,p.y);
   ctx.lineTo(p.x+dx*f+nx*side*(21+chain*3),p.y+dy*f+ny*side*(21+chain*3));
   ctx.strokeStyle=color;ctx.lineWidth=1.1;ctx.stroke();
  }
 }
 // Three visible curls wrap around the socket instead of covering the hull.
 const r=kind==='vortex'?40:34;
 for(let i=0;i<3;i++){
  const a=i*TAU/3+(reduced?0:time*.5);
  ctx.beginPath();ctx.arc(target.x,target.y,r+i*6,a,a+TAU*.48);
  ctx.strokeStyle=i===0?bright:color;ctx.globalAlpha=.5+.12*i;ctx.lineWidth=2;ctx.stroke();
 }
 ctx.beginPath();ctx.arc(target.x,target.y,r+18,-Math.PI/2,
  -Math.PI/2+TAU*Math.max(0,Math.min(1,progress)));
 ctx.strokeStyle=bright;ctx.globalAlpha=.95;ctx.lineWidth=3.4;ctx.stroke();
 ctx.restore();
}
