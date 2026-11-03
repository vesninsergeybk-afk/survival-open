import { isSpac1Scout, drawSpac1Robot, drawSpac1Death } from './spac1-sprites.js?v=spac1-walk-134';
import { drawSpac1WreckDeath } from './robot-wreck-sprites.js?v=wreck-121';
/**
 * Mission 00 station robot visual system.
 * Kenney Robot Pack (CC0): top-down chassis + original animated side-view
 * drive, hurt and damage frames. Authoritative Enemy physics remain untouched.
 * The legs, treads, muzzle and break-up are small Canvas2D transforms;
 * no WebGL, texture uploads or allocations per actor/frame.
 * https://kenney.nl/assets/robot-pack
 */
const TAU=Math.PI*2;
const atlas={top:null,side:null,topReady:false,sideReady:false};
for(const [key,file] of [['top','kenney-robots-top.png'],['side','kenney-robots-side.png']]){
  if(typeof Image==='undefined')continue;
  const image=new Image();image.decoding='async';
  image.onload=()=>{atlas[key+'Ready']=!!image.naturalWidth;};
  image.onerror=()=>{atlas[key+'Ready']=false;};
  image.src=new URL('../assets/prologue/'+file,import.meta.url).href;
  atlas[key]=image;
}
const TOP=Object.freeze({
 spider:[300,156,148,154],  // Kenney 3D red, spider patrol
 service:[300,0,148,154], // yellow shell / repair machine
 sentry:[0,156,148,154],  // reinforced blue
 scout:[150,0,148,154],
 damaged:[150,312,148,154]
});
const SIDE=Object.freeze({
 spider:{walk:[[198,163,180,150],[204,0,180,146]],hurt:[370,587,179,128],wreck:[[371,315,179,128],[371,445,179,128]]},
 service:{walk:[[0,327,184,150],[0,479,184,146]],hurt:[0,627,183,128],wreck:[[186,457,183,128],[185,627,183,128]]},
 sentry:{walk:[[551,575,158,150],[551,727,158,146]],hurt:[711,500,157,128],wreck:[[552,312,157,128],[711,370,157,128]]}
});
const movingState=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function prologueRobotKind(e){
  const group=e?.prologueGroup||'';
  if(group==='command'||group==='siege')return 'sentry';
  if(group==='security'||group==='observatory'||group==='reinforcement')return 'spider';
  return 'service';
}
function part(ctx,img,src,w,h,alpha=1){
 if(!img)return;
 ctx.save();ctx.globalAlpha*=alpha;
 ctx.drawImage(img,src[0],src[1],src[2],src[3],-w/2,-h/2,w,h);
 ctx.restore();
}
function leg(ctx,side,row,kind,phase,motion){
 const isSpider=kind==='spider',heavy=kind==='sentry';
 const rise=heavy?1.25:1,spread=isSpider?1.4:1.0;
 const sy=(row-1)*(isSpider?19:25)*rise;
 const swing=Math.sin(phase+(row+side+2)*Math.PI/2)*motion;
 const x=side*21,y=sy;
 const kneeX=side*(32+spread*7)+swing*5,kneeY=y+8+swing*5;
 const toeX=side*(42+spread*10)+swing*9,toeY=y+19-swing*9;
 ctx.lineCap='round';ctx.lineJoin='round';
 ctx.strokeStyle='#061624';ctx.lineWidth=12*rise;
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(kneeX,kneeY);ctx.lineTo(toeX,toeY);ctx.stroke();
 ctx.strokeStyle=heavy?'#86abb9':isSpider?'#718c9b':'#a7a495';
 ctx.lineWidth=5.2*rise;
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(kneeX,kneeY);ctx.lineTo(toeX,toeY);ctx.stroke();
 ctx.fillStyle=heavy?'#b5c8d5':'#d2b9a0';
 ctx.beginPath();ctx.arc(kneeX,kneeY,3.5*rise,0,TAU);ctx.fill();
 ctx.fillStyle='#122632';ctx.beginPath();
 ctx.ellipse(toeX,toeY,6.5*rise,3.5*rise,.3,0,TAU);ctx.fill();
}
function drawTraction(ctx,kind,time,motion){
 if(kind!=='service')return;
 // Track-belt markers move in alternating directions beneath a Kenney hull.
 ctx.fillStyle='#07151e';
 for(const side of [-1,1]){
  ctx.fillRect(side*30-5,-22,10,45);
  for(let j=0;j<5;j++){
   const y=-20+((j*11+time*44*motion)%45);
   ctx.fillStyle=j%2?'#728e94':'#9bb4b1';
   ctx.fillRect(side*30-4,y,8,3);
  }
 }
}
function motionOf(e,t){
 let prev=movingState.get(e);
 if(!prev){prev={x:e.x,y:e.y,time:t,velocity:0};movingState.set(e,prev);return 0;}
 const dt=t-prev.time;
 if(dt>.001){
   const distance=Math.hypot(e.x-prev.x,e.y-prev.y);
   const speed=dt>.3?0:distance/dt;
   prev.velocity=clamp((prev.velocity*.55+speed*.45)/125,0,1);
   prev.x=e.x;prev.y=e.y;prev.time=t;
 }
 return prev.velocity;
}
/**
 * Complete station-robot actor sprite: direction, locomotion, frame-based
 * chassis, alternating mechanical limb steps, aiming cannon, hit and recoil.
 * Returns false only while the bundled PNG is unavailable.
 */
export function drawPrologueRobot(ctx,e,time){
 if(isSpac1Scout(e) && drawSpac1Robot(ctx,e,time))return true;
 if(!atlas.topReady||!e||e.hp<=0)return false;
 const kind=prologueRobotKind(e),heavy=kind==='sentry',spider=kind==='spider';
 const motion=motionOf(e,time);
 const scale=heavy?1.14:spider?.82:.92;
 const phase=time*(heavy?7.3:spider?10.8:8.8)+(e.x*.005+e.y*.009);
 const alert=(e.flashTimer||0)>0;
 const width=75*scale,height=76*scale;
 ctx.save();ctx.translate(e.x,e.y);
 ctx.fillStyle='#020913a8';ctx.beginPath();
 ctx.ellipse(5,13*scale,37*scale,15*scale,0,0,TAU);ctx.fill();
 ctx.rotate(e.visualAngle||0);
 // Articulated legs behind the asset's real shaded armor chassis.
 ctx.save();ctx.scale(scale,scale);
 for(const side of [-1,1])
  for(let row=0;row<(spider?3:2);row++)
   leg(ctx,side,row,kind,phase,motion);
 drawTraction(ctx,kind,time,motion);
 ctx.restore();
 const bob=motion*Math.sin(phase*2)*2.3;
 ctx.translate(0,bob);
 // Camera-top Kenney chassis, rather than a hand-drawn polygon stand-in.
 part(ctx,atlas.top,TOP[kind],width,height,alert?.84:1);
 if(alert){
  ctx.save();ctx.globalAlpha=.30;ctx.fillStyle='#fff3db';
  ctx.beginPath();ctx.ellipse(0,0,width*.42,height*.36,0,0,TAU);ctx.fill();
  ctx.restore();
 }
 const charge=(e.aimTimer||0)>0;
 const canAttack=charge||((e.attackCooldown||0)>0&&Math.sin(time*18+e.x)>.75);
 if(canAttack){
  ctx.save();ctx.rotate(Math.sin(time*16)*.035);
  ctx.strokeStyle=heavy?'#ffc6a0':'#f37a80';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(0,-18*scale);
  ctx.lineTo(0,-(heavy?52:42)*scale);ctx.stroke();
  ctx.fillStyle=charge?'#ff596b':'#ffd6b4';
  ctx.beginPath();ctx.arc(0,-(heavy?50:41)*scale,5+3*Math.sin(time*19)**2,0,TAU);ctx.fill();
  ctx.restore();
 }
 if(heavy){
  // Twin armored shoulder guns and heat vents make the sentinel read heavy.
  ctx.fillStyle='#1a3245';ctx.strokeStyle='#a9c4d2';ctx.lineWidth=2;
  for(const side of [-1,1]){
   ctx.save();ctx.translate(side*35*scale,4*scale);
   ctx.fillRect(-9*scale,-17*scale,18*scale,28*scale);
   ctx.strokeRect(-9*scale,-17*scale,18*scale,28*scale);
   ctx.fillStyle='#e6a16d';
   ctx.fillRect(-5*scale,-12*scale,10*scale,4*scale);
   ctx.restore();
  }
 }
 ctx.restore();
 if(e.hp<e.maxHp){
  const pct=clamp(e.hp/e.maxHp,0,1),bar=heavy?54:40;
  ctx.fillStyle='#061522';ctx.fillRect(e.x-bar/2,e.y-48*scale,bar,4);
  ctx.fillStyle=pct<.35?'#ff9478':'#79e3dc';
  ctx.fillRect(e.x-bar/2,e.y-48*scale,bar*pct,4);
 }
 return true;
}
export function drawPrologueRobotDeath(ctx,death){
 if(death?.kind==='spac1') {
  if(drawSpac1WreckDeath(ctx,death))return true;
  // The old animation remains an offline fallback while the atlas decodes.
  return death.age < death.duration && drawSpac1Death(ctx,death);
 }
 if(!death||death.ttl<=0||!atlas.sideReady)return false;
 const kind=death.kind||'service';
 const frames=SIDE[kind]||SIDE.service;
 const alpha=clamp(death.ttl/death.duration,0,1);
 const frame=death.ttl<death.duration*.45?frames.wreck[1]:frames.hurt;
 const width=kind==='sentry'?76:59;
 ctx.save();
 ctx.globalAlpha=alpha;
 ctx.translate(death.x,death.y);
 ctx.rotate((death.angle||0)+Math.PI*.43*(1-alpha));
 // Real Kenney 'hurt' and 'damage' frames, animated as the machine falls.
 ctx.fillStyle='#020814a5';ctx.beginPath();ctx.ellipse(4,12,width*.57,14,0,0,TAU);ctx.fill();
 part(ctx,atlas.side,frame,width,kind==='sentry'?63:53);
 ctx.restore();
 if(alpha>.25){
  ctx.save();ctx.globalAlpha=.65*alpha;ctx.fillStyle='#f8bb7b';
  const t=(1-alpha)*14;
  for(let i=0;i<4;i++){
   const a=i*TAU/4+death.x*.003;
   ctx.fillRect(death.x+Math.cos(a)*t,death.y+Math.sin(a)*t,2,3);
  }
  ctx.restore();
 }
 return true;
}
export const ROBOT_ART_MANIFEST=Object.freeze({
 source:'https://kenney.nl/assets/robot-pack',
 license:'CC0-1.0',
 top:'../assets/prologue/kenney-robots-top.png',
 side:'../assets/prologue/kenney-robots-side.png',
 topChassis:['spider','service','sentry'],
 states:['idle','walk','aim','hit','death'],
 drawnWith:'Canvas2D only'
});

