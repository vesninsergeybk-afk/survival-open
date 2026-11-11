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
 const mine=zone.kind==='displacement-mine';
 ctx.save();
 ctx.fillStyle=imminent?'#ff657028':mine?'#ff7b391b':'#e1435316';
 ctx.beginPath();ctx.arc(zone.x,zone.y,radius,0,TAU);ctx.fill();
 ctx.strokeStyle=imminent?'#ffab7b':mine?'#ff9d58':'#ff687e';
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
 if(mine){
  // A visible device at the centre distinguishes the grenade from a generic
  // orbital reticle, even at reduced motion or with colour perception limits.
  const pin=13+(reducedMotion?0:Math.sin(time*10)*1.5);
  ctx.fillStyle='#ffba72';ctx.strokeStyle='#fff5d5';ctx.lineWidth=1.7;
  ctx.beginPath();ctx.moveTo(zone.x,zone.y-pin);
  ctx.lineTo(zone.x+pin*.68,zone.y);ctx.lineTo(zone.x,zone.y+pin);
  ctx.lineTo(zone.x-pin*.68,zone.y);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#682c26';ctx.beginPath();ctx.arc(zone.x,zone.y,4.5,0,TAU);ctx.fill();
 }
 ctx.fillStyle=imminent?'#fff0bd':'#ffd0ca';
 ctx.font='bold 12px system-ui';ctx.textAlign='center';
 ctx.fillText((mine?'МИНА · ':'')+Math.max(0,zone.fuse).toFixed(1)+' с',
  zone.x,zone.y-radius-12);
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
 const rank=Math.max(0,Math.min(6,missile.fxRank||0));
 const seeker=missile.fxBranch==='seeker',payload=missile.fxBranch==='payload';
 const edge=seeker?'#7fe9ff':payload?'#ff9c55':'#ff6035';
 const core=seeker?'#e0ffff':payload?'#ffe0a1':'#ffbc68';
 ctx.save();
 ctx.lineCap='round';
 if(trail.length>1){
  if(fps>=34){
   ctx.globalAlpha=.2+rank*.02;ctx.strokeStyle=seeker||payload?edge:rank>=3?'#e38cfa':edge;
   ctx.lineWidth=9+rank*1.1;
   ctx.beginPath();ctx.moveTo(trail[0].x,trail[0].y);
   for(let i=1;i<trail.length;i++)ctx.lineTo(trail[i].x,trail[i].y);
   ctx.lineTo(missile.x,missile.y);ctx.stroke();
  }
  ctx.globalAlpha=.75;ctx.strokeStyle=seeker||payload?core:rank>=3?'#ffe1ee':core;
  ctx.beginPath();ctx.moveTo(trail[Math.max(0,trail.length-5)].x,trail[Math.max(0,trail.length-5)].y);
  for(let i=Math.max(1,trail.length-4);i<trail.length;i++)ctx.lineTo(trail[i].x,trail[i].y);
  ctx.lineTo(missile.x,missile.y);ctx.stroke();
 }
 ctx.translate(missile.x,missile.y);ctx.rotate(angle);
 ctx.globalAlpha=1;ctx.globalCompositeOperation='lighter';
 ctx.fillStyle=edge;ctx.beginPath();
 ctx.moveTo(-14,0);ctx.lineTo(-8,-4.5);ctx.lineTo(-7,4.5);ctx.closePath();ctx.fill();
 ctx.fillStyle=core;ctx.beginPath();
 ctx.moveTo(10,0);ctx.lineTo(-5,-4);ctx.lineTo(-5,4);ctx.closePath();ctx.fill();
 ctx.fillStyle='#ff633c';ctx.fillRect(-8,-3,3,6);
 if(rank>0){
  // The upgraded motor is visible throughout flight, not only at launch.
  ctx.strokeStyle=rank>=3?'#d7a6ff':'#ffd69a';ctx.lineWidth=1+rank*.2;
  for(const side of [-1,1]){
   ctx.beginPath();ctx.moveTo(-13,side*(4+rank*.4));
   ctx.lineTo(-3,side*(6+rank*.6));ctx.lineTo(3,side*2);ctx.stroke();
  }
 }
 if(seeker){
  // Navigation fins make the retargeting missile recognizable even at 15 FPS.
  ctx.strokeStyle='#c2faff';ctx.lineWidth=1.5;
  for(const side of [-1,1]){
   ctx.beginPath();ctx.moveTo(-7,side*4);ctx.lineTo(-14,side*8);
   ctx.lineTo(-2,side*5);ctx.stroke();
  }
 }else if(payload){
  ctx.strokeStyle='#ffd496';ctx.lineWidth=2.2;
  ctx.beginPath();ctx.moveTo(-4,-6.5);ctx.lineTo(6,-6.5);
  ctx.lineTo(6,6.5);ctx.lineTo(-4,6.5);ctx.closePath();ctx.stroke();
 }
 ctx.restore();
}
