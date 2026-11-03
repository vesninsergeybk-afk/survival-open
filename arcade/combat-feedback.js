/**
 * Lightweight, deterministic Canvas feedback for arcade combat.
 * All primitives use the existing world-space camera transform.
 */
import {getFXSprite} from '../src/vfx-textures.js?v=arcade-vfx-mask-19';
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function drawOrbitalWarning(ctx,zone,time=0,reducedMotion=false){
 const radius=Math.max(1,zone.r||1);
 const total=Math.max(.01,zone.fuseStart||zone.fuse||.01);
 const remaining=clamp((zone.fuse||0)/total,0,1);
 const imminent=remaining<.28;
 ctx.save();
 ctx.fillStyle=imminent?'#ff657028':'#e1435316';
 ctx.beginPath();ctx.arc(zone.x,zone.y,radius,0,TAU);ctx.fill();
 ctx.strokeStyle=imminent?'#ffab7b':'#ff687e';
 ctx.lineWidth=2.5;
 ctx.beginPath();ctx.arc(zone.x,zone.y,radius,0,TAU);ctx.stroke();
 // Exact countdown segment, anchored to the same radius as the hit zone.
 ctx.strokeStyle=imminent?'#fff0be':'#ffc48b';
 ctx.lineWidth=5;
 ctx.beginPath();
 ctx.arc(zone.x,zone.y,radius,-Math.PI/2,-Math.PI/2+TAU*remaining);
 ctx.stroke();
 // Target reticle stays legible without animation or color vision.
 ctx.strokeStyle='#ffe4c1';ctx.lineWidth=1.6;
 const cross=radius*.13,inner=radius*.24;
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2+(reducedMotion?0:Math.sin(time*2)*.012);
  ctx.beginPath();
  ctx.moveTo(zone.x+Math.cos(a)*inner,zone.y+Math.sin(a)*inner);
  ctx.lineTo(zone.x+Math.cos(a)*(inner+cross),zone.y+Math.sin(a)*(inner+cross));
  ctx.stroke();
 }
 ctx.fillStyle=imminent?'#fff0bd':'#ffd0ca';
 ctx.font='bold 12px system-ui';ctx.textAlign='center';
 ctx.fillText(Math.max(0,zone.fuse).toFixed(1)+' с',zone.x,zone.y-radius-12);
 ctx.restore();
}

/** A cached Kenney glow replaces per-frame radial-gradient allocation. */
export function drawOrbitalAfterglow(ctx,zone){
 const progress=clamp(1-(zone.ttl||0)/.62,0,1);
 if(progress>=1)return;
 const fade=1-progress,radius=(zone.r||0)*1.75;
 ctx.save();ctx.globalCompositeOperation='lighter';
 const glow=getFXSprite('glow','orange');
 if(glow){
  ctx.globalAlpha=fade*.82;
  ctx.drawImage(glow,zone.x-radius,zone.y-radius,radius*2,radius*2);
 }
 // The ring remains visible even while the image is still loading.
 ctx.globalAlpha=fade;
 ctx.strokeStyle='#ffc66a';ctx.lineWidth=7*fade+1;
 ctx.beginPath();ctx.arc(zone.x,zone.y,(zone.r||0)*(.45+progress*1.3),0,TAU);ctx.stroke();
 ctx.restore();
}

export function drawEnergyFlash(ctx,flash,fps=60){
 const fade=clamp(flash.ttl/.16,0,1);
 if(fade===0)return;
 ctx.save();
 ctx.lineCap='round';
 if(fps>=33){
  ctx.globalAlpha=fade*.18;
  ctx.strokeStyle=flash.color;ctx.lineWidth=10;
  ctx.beginPath();ctx.moveTo(flash.x,flash.y);ctx.lineTo(flash.x2,flash.y2);ctx.stroke();
 }
 ctx.globalAlpha=fade*.85;
 ctx.strokeStyle=flash.color;ctx.lineWidth=3.6;
 ctx.beginPath();ctx.moveTo(flash.x,flash.y);ctx.lineTo(flash.x2,flash.y2);ctx.stroke();
 if(fps>=33){
  ctx.globalAlpha=fade*.7;ctx.strokeStyle='#fff9df';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(flash.x,flash.y);ctx.lineTo(flash.x2,flash.y2);ctx.stroke();
 }
 ctx.restore();
}

/** A readable, fixed-size scorch pattern that follows the actual hull health. */
export function drawHullDamage(ctx,unit,time=0,fps=60,reducedMotion=false){
 const max=unit.maxHp||0;
 if(!(max>0)||!(unit.hp>0))return false;
 const ratio=clamp(unit.hp/max,0,1);
 if(ratio>=.68)return false;
 const stage=ratio<.22?3:ratio<.43?2:1;
 const r=Math.max(9,unit.r||16),serial=Math.abs(unit.serial||0);
 const points=[[-.26,-.2],[.28,.04],[-.04,.36]];
 ctx.save();ctx.translate(unit.x,unit.y);ctx.rotate(unit.angle||0);
 for(let i=0;i<stage;i++){
  const [ox,oy]=points[(i+serial)%points.length];
  const x=ox*r,y=oy*r,mark=r*(i===0?.22:.16);
  ctx.globalAlpha=.78;
  ctx.fillStyle='#0d1720';ctx.beginPath();ctx.arc(x,y,mark,0,TAU);ctx.fill();
  ctx.strokeStyle='#9b5b50';ctx.lineWidth=Math.max(.8,r*.035);
  ctx.beginPath();ctx.moveTo(x-mark*.75,y-mark*.6);
  ctx.lineTo(x+mark*.1,y);ctx.lineTo(x+mark*.9,y+mark*.65);ctx.stroke();
  // Small hot seam; suppressed at low frame rate and with reduced motion.
  if(i===stage-1&&stage>=2&&fps>=36&&!reducedMotion){
   ctx.fillStyle='#ffad64';
   ctx.globalAlpha=.28+.25*(.5+.5*Math.sin(time*8+serial));
   ctx.beginPath();ctx.arc(x+mark*.4,y-mark*.25,Math.max(.9,mark*.23),0,TAU);ctx.fill();
  }
 }
 ctx.restore();
 return true;
}

export function drawSeekingMissile(ctx,missile,fps=60){
 const angle=Math.atan2(missile.ty-missile.y,missile.tx-missile.x);
 const trail=missile.trail||[];
 ctx.save();
 ctx.lineCap='round';
 if(trail.length>1){
  if(fps>=34){
   ctx.globalAlpha=.2;ctx.strokeStyle='#ff6035';ctx.lineWidth=9;
   ctx.beginPath();ctx.moveTo(trail[0].x,trail[0].y);
   for(let i=1;i<trail.length;i++)ctx.lineTo(trail[i].x,trail[i].y);
   ctx.lineTo(missile.x,missile.y);ctx.stroke();
  }
  ctx.globalAlpha=.75;ctx.strokeStyle='#ffbc68';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(trail[Math.max(0,trail.length-5)].x,trail[Math.max(0,trail.length-5)].y);
  for(let i=Math.max(1,trail.length-4);i<trail.length;i++)ctx.lineTo(trail[i].x,trail[i].y);
  ctx.lineTo(missile.x,missile.y);ctx.stroke();
 }
 ctx.translate(missile.x,missile.y);ctx.rotate(angle);
 ctx.globalAlpha=1;ctx.globalCompositeOperation='lighter';
 ctx.fillStyle='#ff8c45';ctx.beginPath();
 ctx.moveTo(-14,0);ctx.lineTo(-8,-4.5);ctx.lineTo(-7,4.5);ctx.closePath();ctx.fill();
 ctx.fillStyle='#fff1bd';ctx.beginPath();
 ctx.moveTo(10,0);ctx.lineTo(-5,-4);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();
 ctx.fillStyle='#ff633c';ctx.fillRect(-8,-3,3,6);
 ctx.restore();
}
