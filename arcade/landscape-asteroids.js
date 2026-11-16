import {hash} from './balance.js';
import {regionAt} from './regions.js?v=regions-1-living-world-population-1';

// Hansjörg Malthaner / Varkalandar, "24 bigger asteroids", CC BY 3.0.
// 18 selected rock variants, 12 true 3D-tumble views each, repacked to 96px.
// Provenance / required attribution: assets/space/varkalandar/CREDITS.md
export const LANDSCAPE_ATLAS=Object.freeze({
 cell:96,frames:12,variants:18,width:1152,height:1728
});
const TAU=Math.PI*2;
const POOLS=Object.freeze([
 [1,4,5,8,14],            // dark and stony: amethyst
 [3,7,9,12,16],           // pale icy: azure
 [0,2,8,10,11,13,15,17], // ochre and iron-oxide: amber
 [1,4,5,9,14,16],         // pale stone and graphite: lilac
 [5,6,7,9,14]            // teal deposits and dark stone: teal
]);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const origin=rock=>({
 x:Math.round(Number.isFinite(rock?.originX)?rock.originX:rock?.x||0),
 y:Math.round(Number.isFinite(rock?.originY)?rock.originY:rock?.y||0)
});

export function landscapeAsteroidChoice(rock,sector=null){
 if(!rock||rock.rich||!Number.isFinite(rock.r)||rock.r<29||rock.r>85)return null;
 const {x,y}=origin(rock);
 if(hash(x,y,6329)>=.22)return null;
 const region=Number.isInteger(sector)?sector:regionAt(x,y).theme;
 const pool=POOLS[clamp(region,0,4)];
 const variation=hash(x,y,7138);
 return pool[Math.min(pool.length-1,Math.floor(variation*pool.length))];
}

export function landscapeAsteroidPose(rock,time=0,sector=null){
 const row=landscapeAsteroidChoice(rock,sector);
 if(row===null)return null;
 const {x,y}=origin(rock);
 const period=1.95+hash(x,y,6293)*.75;
 const phase=hash(x,y,6282);
 const cycle=((Math.max(0,Number.isFinite(time)?time:0)/period+phase)%1)*LANDSCAPE_ATLAS.frames;
 const frame=Math.floor(cycle),next=(frame+1)%LANDSCAPE_ATLAS.frames;
 return {row,frame,next,blend:cycle-frame,period,
  rotation:(hash(x,y,6743)-.5)*TAU+(Number.isFinite(rock.spin)?rock.spin:0)*.25};
}

export class LandscapeAsteroids{
 constructor({enabled=true,reducedMotion=false,source=null}={}){
  this.enabled=!!enabled;this.reducedMotion=!!reducedMotion;
  this.image=null;this.failed=false;this.fps=60;this.blendBudget=0;
  if(!this.enabled||typeof Image==='undefined')return;
  try{
   const image=new Image();image.decoding='async';
   image.onload=()=>{
    if(image.naturalWidth===LANDSCAPE_ATLAS.width&&
       image.naturalHeight===LANDSCAPE_ATLAS.height)this.image=image;
    else this.failed=true;
   };
   image.onerror=()=>{this.failed=true;};
   image.src=source||new URL(
    '../assets/space/varkalandar/varkalandar-18x12.png',import.meta.url).href;
  }catch{this.failed=true;}
 }
 beginFrame(fps=60){
  this.fps=Number.isFinite(fps)?fps:60;
  this.blendBudget=this.reducedMotion?0:this.fps>=55?8:this.fps>=44?4:0;
 }
 draw(ctx,rock,time=0,ore=false){
  if(!this.image||!this.enabled||ore)return false;
  const pose=landscapeAsteroidPose(rock,this.reducedMotion?0:time);
  if(!pose)return false;
  const {row,frame,next,blend,rotation}=pose;
  const {cell}=LANDSCAPE_ATLAS;
  const size=rock.r*2.48,sy=row*cell;
  ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rotation);
  if(this.blendBudget>0&&blend>.035&&blend<.965){
   const a=ctx.globalAlpha,b=blend*blend*(3-2*blend);
   ctx.globalAlpha=a*(1-b);
   ctx.drawImage(this.image,frame*cell,sy,cell,cell,-size/2,-size/2,size,size);
   ctx.globalAlpha=a*b;
   ctx.drawImage(this.image,next*cell,sy,cell,cell,-size/2,-size/2,size,size);
   this.blendBudget--;
  }else{
   ctx.drawImage(this.image,frame*cell,sy,cell,cell,-size/2,-size/2,size,size);
  }
  ctx.restore();
  return true;
 }
}
