/**
 * Seven distinctive, truthful weapon signatures on the existing world canvas.
 * This module never selects targets, changes damage or invents hit locations.
 * Every endpoint comes from a resolved shot in the combat code; rocket is a
 * launch-only mark because its missile already has a moving world sprite.
 *
 * No shadows, gradients, sprites or per-frame random numbers. Inexpensive
 * silhouettes remain visible at low FPS and with reduced motion enabled.
 */
export const WEAPON_FX_KINDS=Object.freeze([
 'plasma','rail','flak','rocket','ion','resonator','howitzer'
]);
export const WEAPON_FX_CAP=64;
const TAU=Math.PI*2;
const LIFE=Object.freeze({plasma:.23,rail:.29,flak:.28,rocket:.30,ion:.34,resonator:.43,howitzer:.48});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);

/** Capture real shot geometry once, so visual time cannot move its impact. */
export function emitWeaponFx(game,kind,from,to,options={}){
 if(!LIFE[kind]||!validPoint(from)||!validPoint(to))return false;
 const distance=Math.hypot(to.x-from.x,to.y-from.y);
 if(distance<.01)return false;
 const effects=game.weaponFx??(game.weaponFx=[]);
 if(effects.length>=WEAPON_FX_CAP)effects.splice(0,effects.length-WEAPON_FX_CAP+1);
 const seed=Math.abs(Math.round(from.x*13+from.y*17+to.x*23+to.y*29+(game.time||0)*71));
 effects.push({kind,x:from.x,y:from.y,x2:to.x,y2:to.y,
  age:0,life:LIFE[kind],seed:seed%997,
  impact:kind==='rocket'?false:options.impact!==false,
  secondary:!!options.secondary,
  blocked:!!options.blocked});
 return true;
}

/** Age and compact the bounded queue in place; no allocations each frame. */
export function updateWeaponFx(game,dt){
 const fx=game.weaponFx;if(!fx?.length)return;
 for(let i=fx.length-1;i>=0;i--){
  fx[i].age+=Math.max(0,dt);
  if(fx[i].age>=fx[i].life)fx.splice(i,1);
 }
}

function line(c,x,y,x2,y2,width,color,alpha=1){
 c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;
 c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();
}
function circle(c,x,y,r,width,color,alpha=1){
 if(!(r>0))return;
 c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;
 c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();
}
function orb(c,x,y,r,color,alpha=1){
 c.globalAlpha=alpha;c.fillStyle=color;
 c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
}
function spoke(c,x,y,ux,uy,r,width,color,alpha=1){
 line(c,x-ux*r*.4,y-uy*r*.4,x+ux*r,y+uy*r,width,color,alpha);
}
function star(c,x,y,size,color,alpha=1){
 spoke(c,x,y,1,0,size,1.7,color,alpha);
 spoke(c,x,y,0,1,size,1.7,color,alpha);
}

// Parameter t is always on the resolved segment; shimmer never implies a hit
// outside it. The perpendicular only offsets the appearance of the trace.
function along(e,ux,uy,t,offset=0){
 const nx=-uy,ny=ux;
 return {x:e.x+(e.x2-e.x)*t+nx*offset,y:e.y+(e.y2-e.y)*t+ny*offset};
}
function drawPlasma(c,e,ux,uy,dist,fade,high,reducedMotion){
 const primary=e.blocked?'#ffc884':'#53dbff';
 if(high)line(c,e.x,e.y,e.x2,e.y2,e.secondary?9:18,primary,fade*.31);
 line(c,e.x,e.y,e.x2,e.y2,e.secondary?3.8:6.5,primary,fade*.94);
 if(high)line(c,e.x,e.y,e.x2,e.y2,1.8,'#ecffff',fade*.96);
 // Three packets give plasma its own rhythm at a glance. They travel only
 // along the already resolved hit segment and cannot strike another target.
 const shift=reducedMotion?0:clamp(e.age/e.life*.19,0,.19);
 for(let i=0;i<3;i++){
  const p=along(e,ux,uy,.19+i*.29+shift);
  if(high)orb(c,p.x,p.y,i===1?10:7.3,primary,fade*.26);
  orb(c,p.x,p.y,high?4.3:3.3,'#dffeff',fade*.94);
 }
 circle(c,e.x,e.y,high?10:7,2,'#92efff',fade);
 orb(c,e.x,e.y,high?5:4,'#b5f9ff',fade*.88);
 if(e.impact){
  circle(c,e.x2,e.y2,high?15:9,2.4,primary,fade*.9);
  orb(c,e.x2,e.y2,high?5:4,'#eaffff',fade*.9);
 }
}
function drawRail(c,e,ux,uy,dist,fade,high){
 const primary=e.blocked?'#ffcf8b':'#8eb7ff';
 if(high){
  line(c,e.x,e.y,e.x2,e.y2,e.secondary?7:15,'#5067d7',fade*.31);
  const nx=-uy*5,ny=ux*5;
  line(c,e.x+nx,e.y+ny,e.x2+nx,e.y2+ny,high?2.2:1,'#7b9eff',fade*.77);
  line(c,e.x-nx,e.y-ny,e.x2-nx,e.y2-ny,high?2.2:1,'#7b9eff',fade*.77);
 }
 line(c,e.x,e.y,e.x2,e.y2,e.secondary?2.6:4.6,primary,fade);
 line(c,e.x,e.y,e.x2,e.y2,1.5,'#fffefa',fade*.96);
 // Mechanical crossbars echo paired magnetic rails rather than plasma beads.
 for(let i=0;i<3;i++){
  const p=along(e,ux,uy,.24+i*.28);
  line(c,p.x+uy*8,p.y-ux*8,p.x-uy*8,p.y+ux*8,
   high?2:1.5,primary,fade*.75);
 }
 // Paired muzzle brackets distinguish rail from the rounded plasma emitter.
 const nx=-uy,ny=ux;
 for(const sign of [-1,1]){
  const ax=e.x+nx*sign*6,ay=e.y+ny*sign*6;
  line(c,ax-ux*6,ay-uy*6,ax+ux*11,ay+uy*11,1.9,primary,fade);
 }
 if(e.impact){star(c,e.x2,e.y2,high?20:12,'#f8f7ff',fade);
  circle(c,e.x2,e.y2,high?11:6.5,2,primary,fade*.9);}
}
function drawFlak(c,e,ux,uy,dist,fade,high){
 // Short separated strokes signal a burst, not a continuous beam; all strokes
 // terminate on the confirmed hit line. No simulated collateral impacts.
 const strokes=dist<85?3:5;
 c.lineCap='butt';
 if(high)line(c,e.x,e.y,e.x2,e.y2,9,'#e37c39',fade*.17);
 for(let i=0;i<strokes;i++){
  const a=.06+i*.87/strokes,b=Math.min(.97,a+.50/strokes);
  const p=along(e,ux,uy,a),q=along(e,ux,uy,b);
  line(c,p.x,p.y,q.x,q.y,high?5.2:4,'#ffa85d',fade*.94);
  if(high)line(c,p.x,p.y,q.x,q.y,1.7,'#ffe8bd',fade);
 }
 circle(c,e.x,e.y,high?5:3.5,2,'#ffc28a',fade);
 if(e.impact){
  const nx=-uy,ny=ux,r=high?14:10;
  line(c,e.x2-nx*r*.6,e.y2-ny*r*.6,e.x2+nx*r*.6,e.y2+ny*r*.6,2.2,'#ffbd73',fade);
  line(c,e.x2-ux*r*.45,e.y2-uy*r*.45,e.x2+ux*r*.65,e.y2+uy*r*.65,2,'#ffe6bb',fade);
 }
 c.lineCap='round';
}
function drawRocket(c,e,ux,uy,fade,high){
 // Launch plume only. The real missile is drawn by drawSeekingMissile and can
 // change course: a line to the originally selected target would be false.
 const nx=-uy,ny=ux;
 const size=high?25:18;
 const backX=e.x-ux*size,backY=e.y-uy*size;
 line(c,e.x,e.y,backX,backY,high?8:5,'#fa7b42',fade*.62);
 line(c,e.x,e.y,e.x-ux*size*.65,e.y-uy*size*.65,2.4,'#ffe1a7',fade);
 line(c,e.x-nx*5,e.y-ny*5,backX-nx*3,backY-ny*3,1.4,'#ffb56a',fade*.9);
 line(c,e.x+nx*5,e.y+ny*5,backX+nx*3,backY+ny*3,1.4,'#ffb56a',fade*.9);
}
function drawIon(c,e,ux,uy,dist,fade,high){
 const steps=high?11:7,jitter=Math.min(high?15:9,dist*.10);
 c.lineJoin='bevel';c.lineCap='round';
 const segments=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps;
  const variation=.57+.43*Math.abs(Math.sin((i*7.71+e.seed)*2.47));
  const k=i===0||i===steps?0:(i%2?1:-1)*variation*jitter;
  segments.push(along(e,ux,uy,t,k));
 }
 c.globalAlpha=fade*.72;c.strokeStyle='#46c5ed';c.lineWidth=high?10:6;
 c.beginPath();c.moveTo(e.x,e.y);
 for(let i=1;i<segments.length;i++)c.lineTo(segments[i].x,segments[i].y);
 c.stroke();
 c.globalAlpha=fade;c.strokeStyle='#dffaff';c.lineWidth=high?2.4:1.7;
 c.beginPath();c.moveTo(e.x,e.y);
 for(let i=1;i<segments.length;i++)c.lineTo(segments[i].x,segments[i].y);
 c.stroke();
 if(high)for(const i of [3,7]){
  const p=segments[i],d=(i%2?1:-1);
  line(c,p.x,p.y,p.x-uy*18*d+ux*9,p.y+ux*18*d+uy*9,2,'#a4ecff',fade*.72);
 }
 circle(c,e.x,e.y,high?7:4,1.7,'#9bf6ff',fade);
 if(e.impact)circle(c,e.x2,e.y2,high?9:6,2,'#c0f9ff',fade);
}
function drawResonator(c,e,ux,uy,dist,fade,high,reducedMotion){
 const pulse=reducedMotion ? .27 : e.age/e.life,primary='#d6a8ff';
 if(high)line(c,e.x,e.y,e.x2,e.y2,7,'#b169f2',fade*.21);
 c.setLineDash([high?12:8,high?7:6]);
 line(c,e.x,e.y,e.x2,e.y2,high?2.7:2.2,primary,fade);
 c.setLineDash([]);
 if(high){const p=along(e,ux,uy,clamp(.15+.7*pulse,0,1));
  circle(c,p.x,p.y,6,2,'#f5dcff',fade);}
 circle(c,e.x,e.y,8+9*pulse,1.7,primary,fade*.85);
 if(e.impact)circle(c,e.x2,e.y2,9+13*pulse,2,'#f2c4ff',fade);
}
function drawHowitzer(c,e,ux,uy,dist,fade,high,reducedMotion){
 if(high)line(c,e.x,e.y,e.x2,e.y2,28,'#9d56e8',fade*.26);
 line(c,e.x,e.y,e.x2,e.y2,high?11:7.5,'#d598ff',fade*.95);
 line(c,e.x,e.y,e.x2,e.y2,high?3:2,'#fff2ff',fade);
 const nx=-uy,ny=ux;
 // Focusing hoops and barbed energy bands create a siege-lance silhouette.
 for(let i=0;i<4;i++){
  const p=along(e,ux,uy,.18+i*.21),r=high?16:11;
  line(c,p.x-nx*r-ux*8,p.y-ny*r-uy*8,p.x+ux*5,p.y+uy*5,
   high?3:2,'#f0b2ff',fade*.86);
  line(c,p.x+nx*r-ux*8,p.y+ny*r-uy*8,p.x+ux*5,p.y+uy*5,
   high?3:2,'#f0b2ff',fade*.86);
 }
 circle(c,e.x,e.y,high?17:11,2.5,'#e6b1ff',fade);
 for(const sign of [-1,1]){
  line(c,e.x+nx*sign*11,e.y+ny*sign*11,e.x+ux*20+nx*sign*4,
   e.y+uy*20+ny*sign*4,2,'#efb5ff',fade);
 }
 if(e.impact){
  const pulse=reducedMotion ? .2 : clamp(e.age/e.life,0,1);
  circle(c,e.x2,e.y2,16+42*pulse,high?4.5:3.2,'#e5b3ff',fade*.92);
  if(high)circle(c,e.x2,e.y2,9+25*pulse,2.1,'#fff1ff',fade);
  star(c,e.x2,e.y2,high?28:18,'#ffdbff',fade*.92);
 }
}

/** Render world-space signatures. camera is optional for test/lab use. */
export function drawWeaponFx(ctx,effects,fps=60,reducedMotion=false,camera=null){
 if(!effects?.length)return;
 const high=fps>=33;
 for(const e of effects){
  if(!LIFE[e.kind]||e.age>=e.life)continue;
  if(camera){
   const left=e.kind==='rocket'?e.x:Math.min(e.x,e.x2),
    right=e.kind==='rocket'?e.x:Math.max(e.x,e.x2),
    top=e.kind==='rocket'?e.y:Math.min(e.y,e.y2),
    bottom=e.kind==='rocket'?e.y:Math.max(e.y,e.y2);
   if(right<camera.x-120||left>camera.x+camera.w+120||
    bottom<camera.y-120||top>camera.y+camera.h+120)continue;
  }
  const dx=e.x2-e.x,dy=e.y2-e.y,dist=Math.hypot(dx,dy);
  if(!(dist>0))continue;
  const ux=dx/dist,uy=dy/dist;
  // Sustained silhouette followed by a brief, smooth fade. Reduced motion
  // keeps the same signature without moving pulses or strobing.
  const fade=clamp((e.life-e.age)/Math.min(.17,e.life*.72),0,1);
  if(fade<=0)continue;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  switch(e.kind){
   case 'plasma':drawPlasma(ctx,e,ux,uy,dist,fade,high,reducedMotion);break;
   case 'rail':drawRail(ctx,e,ux,uy,dist,fade,high);break;
   case 'flak':drawFlak(ctx,e,ux,uy,dist,fade,high);break;
   case 'rocket':drawRocket(ctx,e,ux,uy,fade,high);break;
   case 'ion':drawIon(ctx,e,ux,uy,dist,fade,high);break;
   case 'resonator':drawResonator(ctx,e,ux,uy,dist,fade,high,reducedMotion);break;
   case 'howitzer':drawHowitzer(ctx,e,ux,uy,dist,fade,high,reducedMotion);break;
  }
  ctx.restore();
 }
}
