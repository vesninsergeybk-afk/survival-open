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
 const phase=hash(x,y,2206),period=8.5+hash(x,y,3115)*8;
 const progress=(Math.max(0,finite(time))/period+phase)%1;
 const frame=Math.floor(progress*ASTEROID_ANIMATION.columns);
 const rotation=(hash(x,y,4701)-.5)*TAU+finite(rock?.spin)*.28;
 return {row,frame,rotation,period};
}

export function asteroidAnimationEligible(rock,ore=false){
 if(!rock||ore||rock.rich||!Number.isFinite(rock.r)||rock.r<23||rock.r>110)return false;
 const x=Math.round(finite(rock.originX,finite(rock.x)));
 const y=Math.round(finite(rock.originY,finite(rock.y)));
 // Stable minority of the field; keep original ore art and small debris.
 return hash(x,y,8743)<.58;
}

export class AnimatedAsteroids {
 constructor({enabled=true,source=null}={}){
  this.enabled=!!enabled;this.image=null;this.failed=false;
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
 draw(ctx,rock,time=0,ore=false){
  if(!this.enabled||!this.image||!asteroidAnimationEligible(rock,ore))return false;
  const {row,frame,rotation}=asteroidAnimationPose(rock,time);
  const size=rock.r*2.8;
  ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rotation);
  ctx.drawImage(this.image,frame*ASTEROID_ANIMATION.cell,row*ASTEROID_ANIMATION.cell,
   ASTEROID_ANIMATION.cell,ASTEROID_ANIMATION.cell,
   -size/2,-size/2,size,size);
  ctx.restore();return true;
 }
 drawIncoming(ctx,active,index,age,size){
  if(!this.enabled||!this.image)return false;
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
