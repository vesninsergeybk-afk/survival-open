import {hash} from './balance.js';

// Jarusca, Asteroids Pack (2D), CC0, 2020-08-19.
// Source atlas: 23 frames along X, nine variants along Y, 75 px per frame.
// Keep rotation visual-only: do not add clocks, velocities or save fields to rocks.
export const ASTEROID_ANIMATION=Object.freeze({
 columns:23,rows:9,cell:75,width:1725,height:675
});
const TAU=Math.PI*2;
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;

export function asteroidAnimationPose(rock,time=0){
 const x=Math.round(finite(rock?.originX,finite(rock?.x)));
 const y=Math.round(finite(rock?.originY,finite(rock?.y)));
 const variant=hash(x,y,1729);
 const row=Math.min(ASTEROID_ANIMATION.rows-1,Math.floor(variant*ASTEROID_ANIMATION.rows));
 // The previous 8.5–16.5 s revolution advanced the 23-frame atlas only
 // 1.4–2.7 times per second; it looked frozen even at 60 game FPS.
 const phase=hash(x,y,2206),period=2.0+hash(x,y,3115)*.95;
 const progress=(Math.max(0,finite(time))/period+phase)%1;
 const position=progress*ASTEROID_ANIMATION.columns;
 const frame=Math.floor(position);
 const nextFrame=(frame+1)%ASTEROID_ANIMATION.columns;
 const blend=position-frame;
 const rotation=(hash(x,y,4701)-.5)*TAU+finite(rock?.spin)*.28;
 return {row,frame,nextFrame,blend,rotation,period};
}

export function asteroidAnimationEligible(rock,ore=false,portion=.58){
 if(!rock||ore||rock.rich||!Number.isFinite(rock.r)||rock.r<23||rock.r>110)return false;
 const x=Math.round(finite(rock.originX,finite(rock.x)));
 const y=Math.round(finite(rock.originY,finite(rock.y)));
 // Same rocks stay selected as quality falls; never use gameplay RNG.
 return hash(x,y,8743)<Math.min(.58,Math.max(0,portion));
}

export class AnimatedAsteroids {
 constructor({enabled=true,source=null}={}){
  this.enabled=!!enabled;this.image=null;this.failed=false;
  this.fps=60;this.qualityTier=3;this.blendBudget=0;
  this.animatedDraws=0;this.blendedDraws=0;
  this.debug=typeof location!=='undefined'&&
   new URLSearchParams(location.search).get('asteroidperf')==='1';
  this.perfElement=null;this.lastReport=-Infinity;this.avgRockMs=null;
  if(!this.enabled||typeof Image==='undefined')return;
  try{
   const image=new Image();image.decoding='async';
   image.onload=()=>{
    if(image.naturalWidth===ASTEROID_ANIMATION.width&&
      image.naturalHeight===ASTEROID_ANIMATION.height)this.image=image;
    else this.failed=true;
   };
   image.onerror=()=>{this.failed=true;};
   image.src=source||new URL('../assets/space/jarusca-asteroids-diffuse.png',import.meta.url).href;
  }catch{this.failed=true;}
 }
 beginFrame(fps=60){
  this.fps=Number.isFinite(fps)?fps:60;
  // Hysteresis prevents rapidly replacing 2D/3D asteroid sprites when the
  // smoothed FPS hovers around a quality threshold.
  if(this.qualityTier===3&&this.fps<48)this.qualityTier=2;
  else if(this.qualityTier===2){
   if(this.fps<39)this.qualityTier=1;
   else if(this.fps>55)this.qualityTier=3;
  }else if(this.qualityTier===1){
   if(this.fps<31)this.qualityTier=0;
   else if(this.fps>45)this.qualityTier=2;
  }else if(this.qualityTier===0&&this.fps>37)this.qualityTier=1;
  this.blendBudget=this.qualityTier===3&&this.fps>=54?12:0;
  this.animatedDraws=0;this.blendedDraws=0;
 }
 draw(ctx,rock,time=0,ore=false){
  if(!this.enabled||!this.image||this.qualityTier===0)return false;
  const portion=[0,.16,.35,.58][this.qualityTier];
  if(!asteroidAnimationEligible(rock,ore,portion))return false;
  const {row,frame,nextFrame,blend,rotation}=asteroidAnimationPose(rock,time);
  const size=rock.r*2.8,cell=ASTEROID_ANIMATION.cell,sourceY=row*cell;
  ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rotation);
  // Blend only a few large, prominent rocks on healthy frames. A full
  // two-sprite blend for all rocks would double GPU work in crowded fields.
  if(rock.r>=45&&this.blendBudget>0&&blend>.04&&blend<.96){
   const mix=blend*blend*(3-2*blend),baseAlpha=ctx.globalAlpha;
   ctx.globalAlpha=baseAlpha*(1-mix);
   ctx.drawImage(this.image,frame*cell,sourceY,cell,cell,
    -size/2,-size/2,size,size);
   ctx.globalAlpha=baseAlpha*mix;
   ctx.drawImage(this.image,nextFrame*cell,sourceY,cell,cell,
    -size/2,-size/2,size,size);
   this.blendBudget--;this.blendedDraws++;
  }else{
   ctx.drawImage(this.image,frame*cell,sourceY,cell,cell,
    -size/2,-size/2,size,size);
  }
  ctx.restore();this.animatedDraws++;return true;
 }
 finishFrame(rockMs,rockCount,fps,time=0){
  if(!this.debug)return;
  const ms=Number.isFinite(rockMs)?rockMs:0;
  this.avgRockMs=this.avgRockMs===null?ms:this.avgRockMs*.9+ms*.1;
  if(time-this.lastReport<.8)return;
  this.lastReport=time;
  const report={fps:Math.round(fps),rockCount,
   animated:this.animatedDraws,blended:this.blendedDraws,
   rockLayerMs:Math.round(this.avgRockMs*100)/100};
  if(typeof window!=='undefined')window.__asteroidVisualStats=report;
  if(typeof document==='undefined'||!document.body?.appendChild)return;
  if(!this.perfElement){
   this.perfElement=document.createElement('output');
   this.perfElement.id='asteroidPerfOverlay';
   this.perfElement.setAttribute('aria-label','Диагностика астероидов');
   this.perfElement.style.cssText='position:fixed;right:7px;top:58px;z-index:12;pointer-events:none;'+
    'background:#071324de;color:#e5f9ff;font:11px/1.4 monospace;'+
    'padding:5px 7px;border:1px solid #79c9df55;border-radius:6px';
   document.body.appendChild(this.perfElement);
  }
  this.perfElement.textContent=report.fps+' FPS | камней '+rockCount+
   ' | аним. '+report.animated+' | плавных '+report.blended+
   ' | слой '+report.rockLayerMs+' мс';
 }
 drawIncoming(ctx,active,index,age,size){
  if(!this.enabled||!this.image||this.fps<34)return false;
  const row=Math.floor(hash(active.serial,index,1729)*ASTEROID_ANIMATION.rows);
  const phase=hash(index,active.serial,2206);
  const frame=Math.floor(((age/2.8+phase)%1)*ASTEROID_ANIMATION.columns);
  const box=Math.max(15,size*1.43);
  ctx.save();ctx.rotate(age*1.1+index*.3);
  ctx.drawImage(this.image,frame*ASTEROID_ANIMATION.cell,row*ASTEROID_ANIMATION.cell,
   ASTEROID_ANIMATION.cell,ASTEROID_ANIMATION.cell,-box/2,-box/2,box,box);
  ctx.restore();return true;
 }
}
