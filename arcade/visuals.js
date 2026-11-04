import {drawInstalledModules} from './ship-weapons.js?v=hangar-2';
/**
 * Arcade presentation uses the artwork and animation systems already approved
 * for Survivor. Visual variants never consume gameplay randomness.
 * The original src/ modules own their shared sprite atlases and licenses.
 */
import {drawEvolvedHero, heroMotionPose} from '../src/hero-evolution.js?v=hangar-2';
import {drawAnimatedEnemyShip} from '../src/disruptor-ship-sprites.js';
import {drawIrisDrone,irisEnabledByQuery} from './iris-drone-renderer.js?v=scout-evasion-1';
import {drawStationPart, STATION_PARTS} from '../src/station-art.js?v=base-86';
import {drawTurretMount,drawTurretHead} from '../src/turret-visuals.js?v=turret-visuals-1';
import {drawEnemyBolt} from '../src/combat-art.js?v=art-888';
import {getFXSprite} from '../src/vfx-textures.js?v=arcade-vfx-mask-19';
import {drawStationMechanisms} from '../src/station-mechanics.js?v=dock-audit-2';
import {drawRepairDock} from './repair-dock-art.js?v=dock-identity-1';
import {hash,RULES} from './balance.js';
import {stripCapitalMatte,CAPITAL_PAINTINGS} from './capital-art.js?v=arcade-capital-mask-56';
import {drawCapitalDamage} from './capital-hit-wear.js?v=arcade-capital-hit-63';

const TAU=Math.PI*2;
const HULLS=Object.freeze({
 dock:[[-34,-68],[33,-68],[70,-34],[70,31],[34,69],[-34,69],[-70,31],[-70,-34]],
 arsenal:[[-35,-75],[0,-83],[35,-75],[77,-41],[58,0],[77,41],[35,75],[0,83],[-35,75],[-77,41],[-58,0],[-77,-41]],
 carrier:[[-92,-33],[-58,-55],[58,-55],[92,-33],[92,33],[58,55],[-58,55],[-92,33]],
 lab:[[0,-78],[37,-67],[67,-37],[78,0],[67,37],[37,67],[0,78],[-37,67],[-67,37],[-78,0],[-67,-37],[-37,-67]]
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const SKINS=Object.freeze({
 scout:['bat','slimeling','ghost','slime'],
 fighter:['zombie','skeleton','wolf','minelayer'],
 flanker:['stalker','illusionist','mage','sniper'],
 healer:['repairer','repairer','commander'],
 berserker:['rammer','bomber','golem'],
 gunship:['gunship','carrier','commander']
});
const ALLY_SKINS=Object.freeze({
 scout:['bat','ghost','slimeling'],
 fighter:['stalker','wolf','sniper'],
 bomber:['bomber','carrier','gunship']
});
const THEMES=Object.freeze([
 {name:'Аметистовая туманность',base:'#07081d',haze:'#8044c966',mist:'#24347c88',star:'#d8c7ff'},
 {name:'Лазурный разлом',base:'#041624',haze:'#1b86b066',mist:'#126d8a88',star:'#b5f4ff'},
 {name:'Янтарные облака',base:'#190d12',haze:'#c76b3866',mist:'#85446b88',star:'#ffe4be'},
 {name:'Сиреневый предел',base:'#0c0927',haze:'#904cc166',mist:'#9a3e7288',star:'#e9d7ff'},
 {name:'Бирюзовая бездна',base:'#041b23',haze:'#168b9b66',mist:'#654bba88',star:'#c5fff2'}
]);
// Distinct space paintings are loaded only when their sector becomes active.
// The original purple nebula remains the starting-sector background.
const SKY_IMAGES=Object.freeze([
 'nebula_main.jpg','nebula_azure_v1.png','nebula_amber_v1.png',
 'nebula_lilac_v1.png','nebula_teal_v1.png'
].map(name=>new URL('../assets/space/'+name,import.meta.url).href));
const PLANET_ICE=new URL('../assets/space/planet_ice_v1.png',import.meta.url).href;
const DERELICT_CRUISER=new URL('../assets/space/derelict-cruiser-v1.png',import.meta.url).href;
const DERELICT_ANCHOR=Object.freeze({x:-2100,y:1150,width:510,height:236});

export function enemySkin(type,serial){
 const list=SKINS[type]||SKINS.scout;
 return list[Math.abs(Math.imul(serial,17)+(serial>>>3))%list.length];
}
export function allySkin(role,serial){
 const list=ALLY_SKINS[role]||ALLY_SKINS.scout;
 return list[Math.abs(Math.imul(serial,5)+1)%list.length];
}
export function sectorAt(x,y){
 const sx=Math.floor(x/5600),sy=Math.floor(y/5600);
 return ((sx*7+sy*11)%THEMES.length+THEMES.length)%THEMES.length;
}
export const sectorName=index=>THEMES[index]?.name||THEMES[0].name;

function openPolygon(ctx,points,fill,stroke){
 ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
 ctx.closePath();ctx.fillStyle=fill;ctx.fill();
 ctx.strokeStyle=stroke;ctx.lineWidth=3;ctx.stroke();
}
function halo(ctx,r,color,level=1,tint='cyan'){
 ctx.save();
 const sprite=getFXSprite('glow',tint);
 if(sprite){
  // Kenney's soft light replaces the old solid disk, with no per-frame
  // radial gradients. It remains behind the station's actual silhouette.
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=.27*level;
  ctx.drawImage(sprite,-r*1.48,-r*1.48,r*2.96,r*2.96);
  ctx.globalCompositeOperation='source-over';
 }else{
  ctx.globalAlpha=.12*level;ctx.fillStyle=color;
  ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();
 }
 ctx.globalAlpha=.45*level;ctx.strokeStyle=color;ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(0,0,r-12,-.42,2.25);ctx.stroke();
 ctx.beginPath();ctx.arc(0,0,r-12,2.5,5.8);ctx.stroke();
 ctx.restore();
}
/** World-space render dimensions; game collision radii and AI stay unchanged. */
export const COMPACT_ESCORT_SPECS=Object.freeze({
 scout:Object.freeze({width:24,height:22,color:'#75f3e3',asset:'../assets/space/drone-guardian-v1.png'}),
 fighter:Object.freeze({width:28,height:24,color:'#82beff',asset:'../assets/space/drone-blade-v1.png'})
});

/** Trim transparent margins and downsample once, never inside the render loop. */
function prepareEscortSprite(image,width,height){
 if(typeof document==='undefined'||!image.naturalWidth)return image;
 try{
  const probe=document.createElement('canvas');probe.width=96;probe.height=96;
  const p=probe.getContext('2d',{willReadFrequently:true});
  if(!p)return image;
  p.drawImage(image,0,0,96,96);
  const data=p.getImageData(0,0,96,96).data;
  let left=96,top=96,right=-1,bottom=-1;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
   if(data[(y*96+x)*4+3]<36)continue;
   left=Math.min(left,x);right=Math.max(right,x);
   top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left||bottom<top)return image;
  const pad=2,sx=Math.max(0,left-pad),sy=Math.max(0,top-pad),
   ex=Math.min(96,right+pad+1),ey=Math.min(96,bottom+pad+1);
  const tile=document.createElement('canvas');
  tile.width=width*4;tile.height=height*4;
  const t=tile.getContext('2d');
  if(!t)return image;
  t.imageSmoothingEnabled=true;t.imageSmoothingQuality='high';
  t.drawImage(image,sx/96*image.naturalWidth,sy/96*image.naturalHeight,
   (ex-sx)/96*image.naturalWidth,(ey-sy)/96*image.naturalHeight,
   0,0,tile.width,tile.height);
  return tile;
 }catch{return image;}
}

// A single half-resolution cache avoids full-size PNG decoding on every
// frame. A blank/opaque rectangle is rejected, letting the game's sprite
// fallback paint the enemy while the asset is absent or unusable.
function prepareCapitalSprite(image){
 if(typeof document==='undefined'||!image?.naturalWidth)return null;
 try{
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=768;
  const c=canvas.getContext('2d',{willReadFrequently:true});
  if(!c)return null;
  c.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels=c.getImageData(0,0,canvas.width,canvas.height);
  const result=stripCapitalMatte(pixels.data,canvas.width,canvas.height);
  if(!result.usable)return null;
  c.putImageData(pixels,0,0);
  return canvas;
 }catch{return null;}
}

export class ArcadeVisuals {
 constructor(){
  this.sector=-1;this.layer=0;
  this.irisDroneEnabled=irisEnabledByQuery(typeof location==='undefined'?'':location.search);
  this.rockAtlases=Object.create(null);this.roughRocks=Object.create(null);
  this.legacyMeteors=[];this.capitalSprites=Object.create(null);
  this.derelictImage=null;
  if(typeof Image!=='undefined'){
   const image=new Image();image.decoding='async';
   image.onload=()=>{this.derelictImage=image;};
   image.src=DERELICT_CRUISER;
  }
  // Each escort is one transparent source image and a single cached small tile.
  // The bomber keeps its existing independent rendering path.
  this.compactEscortSprites=Object.create(null);
  if(typeof Image!=='undefined')for(const [role,spec] of Object.entries(COMPACT_ESCORT_SPECS)){
   const sprite=new Image();sprite.decoding='async';
   sprite.onload=()=>{
    this.compactEscortSprites[role]=prepareEscortSprite(sprite,spec.width,spec.height);
   };
   sprite.src=new URL(spec.asset,import.meta.url).href;
  }
  // Reuse the eight individually transparent Kenney meteor sprites.
  // They are optional, and only a subset of rocks uses them.
  if(typeof Image!=='undefined')for(const stone of ['Brown','Grey'])
   for(let i=1;i<=4;i++){
    const image=new Image();image.decoding='async';
    image.src=new URL('../assets/upgrade/asteroids/meteor'+stone+
      '_big'+i+'.png',import.meta.url).href;
    this.legacyMeteors.push(image);
   }
  this.skies=[document.getElementById('sky0'),document.getElementById('sky1')];
  this.reducedMotion=typeof matchMedia==='function'&&
   matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.updateSky(0,0,true);
 }
 updateSky(x,y,force=false){
  const id=sectorAt(x,y);
  if(!force&&id===this.sector){
   this.positionPlanet(x,y);
   return false;
  }
  this.sector=id;
  const theme=THEMES[id];this.starColor=theme.star;
  this.layer=force?0:1-this.layer;
  const sky=this.skies[this.layer];
  if(sky){
   sky.style.setProperty('--deep',theme.base);
   sky.style.setProperty('--haze',theme.haze);
   sky.style.setProperty('--mist',theme.mist);
   sky.style.setProperty('--sector-image','url("'+SKY_IMAGES[id]+'")');
   // One true distant landmark with world-coordinate parallax.
   // Other sectors keep a clean sky instead of a screen-locked fake planet.
   const planet=id===1&&Math.floor(x/5600)===0&&Math.floor(y/5600)===1;
   sky.style.setProperty('--planet-image',planet?'url("'+PLANET_ICE+'")':'none');
   sky.style.setProperty('--planet-opacity',planet?'.36':'0');
   sky.classList.add('visible');
   this.skies[1-this.layer]?.classList.remove('visible');
  }
  this.planetPosition='';
  this.positionPlanet(x,y,true);
  const text=document.getElementById('sector');
  if(text)text.textContent=theme.name;
  return !force;
 }
 positionPlanet(x,y,force=false){
  if(this.sector!==1||Math.floor(x/5600)!==0||Math.floor(y/5600)!==1)return;
  const px=(80-12*x/5600).toFixed(1)+'%';
  const py=(15-8*(y-5600)/5600).toFixed(1)+'%';
  const key=px+':'+py;
  if(!force&&key===this.planetPosition)return;
  this.planetPosition=key;
  const sky=this.skies[this.layer];
  sky?.style.setProperty('--planet-x',px);
  sky?.style.setProperty('--planet-y',py);
 }

 // Sparse near-space ion dust from the earlier SpaceArt atmosphere.
 // Skip the additional layer when the frame budget falls below 32 FPS.
 drawAtmosphere(ctx,cam,time,fps=60){
  if(this.reducedMotion||fps<32)return;
  const count=fps<50?7:14,w=cam.w,h=cam.h;
  const wrap=(x,size)=>((x%size)+size)%size;
  ctx.save();ctx.fillStyle=this.starColor||'#def7ff';
  for(let i=0;i<count;i++){
   const px=wrap(hash(i*5+82,19,17)*w-cam.x*.17+time*(2+i%4),w);
   const py=wrap(hash(i*5+87,23,17)*h-cam.y*.14+time*(1+i%3),h);
   ctx.globalAlpha=.16+hash(i*19+3,3,9)*.32;
   ctx.fillRect(px,py,i%5===0?2:1.2,i%5===0?2:1.2);
  }
  ctx.restore();
 }
 // Preprocess the original asteroid sprite sheets once. Their pale atlas
 // backing is connected to each frame edge and must not cover the nebula.
 framesFromAtlas(image,key){
  if(!image?.complete||!image.naturalWidth||typeof document.createElement!=='function')return null;
  if(this.rockAtlases[key])return this.rockAtlases[key];
  const width=Math.floor(image.naturalWidth/6),height=Math.floor(image.naturalHeight/5);
  const frames=[];
  try{
   for(let row=0;row<2;row++)for(let col=0;col<6;col++){
    const tile=document.createElement('canvas');tile.width=width;tile.height=height;
    const tc=tile.getContext('2d',{willReadFrequently:true});
    tc.drawImage(image,col*width,row*height,width,height,0,0,width,height);
    const raw=tc.getImageData(0,0,width,height),pixels=raw.data;
    const bg=[pixels[0],pixels[1],pixels[2]];
    const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);
    let head=0,tail=0;
    const test=i=>{
     if(i<0||i>=width*height||seen[i])return;
     const p=i*4;
     if(pixels[p+3]<20||
      (Math.abs(pixels[p]-bg[0])<32&&
       Math.abs(pixels[p+1]-bg[1])<32&&
       Math.abs(pixels[p+2]-bg[2])<32)){
       seen[i]=1;queue[tail++]=i;
     }
    };
    for(let x=0;x<width;x++){test(x);test((height-1)*width+x);}
    for(let y=1;y<height-1;y++){test(y*width);test(y*width+width-1);}
    while(head<tail){
     const i=queue[head++],x=i%width,y=(i/width)|0;
     if(x>0)test(i-1);if(x<width-1)test(i+1);
     if(y>0)test(i-width);if(y<height-1)test(i+width);
    }
    for(let i=0;i<seen.length;i++)if(seen[i])pixels[i*4+3]=0;
    // On some devices the flood-fill can erase a nearly uniform rock.
    // A transparent canvas is still a valid drawImage source, so the game
    // used to report success while showing nothing. Reject empty frames.
    let solid=0;
    for(let k=3;k<pixels.length;k+=4)if(pixels[k]>=96)solid++;
    if(solid<Math.max(24,Math.floor(width*height*.025))){
     frames.push(null);continue;
    }
    tc.putImageData(raw,0,0);
    frames.push(tile);
   }
  }catch(_error){return null;}
  return this.rockAtlases[key]=frames;
 }
 // Canvas-baked fallback for the first loading frames and legacy browsers.
 // It is drawn once per variant, not rebuilt for every asteroid/frame.
 rockFallback(index){
  if(this.roughRocks[index])return this.roughRocks[index];
  if(typeof document.createElement!=='function')return null;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const c=canvas.getContext('2d');
  const ore=index%2===0;let seed=index*4357+1729;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const poly=[];
  for(let i=0;i<17;i++){
   const a=i*TAU/17,r=45+rnd()*14;
   poly.push([64+Math.cos(a)*r,64+Math.sin(a)*r]);
  }
  c.beginPath();c.moveTo(...poly[0]);
  for(let i=1;i<poly.length;i++)c.lineTo(...poly[i]);
  c.closePath();
  const grad=c.createRadialGradient(43,39,4,66,68,66);
  grad.addColorStop(0,ore?'#bcaa7c':'#adb6c2');
  grad.addColorStop(.55,ore?'#65594d':'#68717b');
  grad.addColorStop(1,ore?'#2e313a':'#272e3c');
  c.fillStyle=grad;c.fill();
  c.save();c.clip();
  for(let i=0;i<27;i++){
   const a=poly[i%poly.length],b=poly[(i+3)%poly.length];
   const x=30+rnd()*70,y=27+rnd()*74;
   c.beginPath();c.moveTo(...a);c.lineTo(x,y);c.lineTo(...b);
   c.fillStyle=i%3===0?'#d7d1c31a':'#050e202b';c.fill();
  }
  for(let i=0;i<13;i++){
   const x=27+rnd()*75,y=27+rnd()*75,r=2+rnd()*8;
   c.beginPath();c.ellipse(x,y,r,r*.67,rnd()*TAU,0,TAU);
   c.fillStyle='#131b2c77';c.fill();
   c.strokeStyle='#e6e9e333';c.lineWidth=1.4;c.stroke();
  }
  if(ore)for(let i=0;i<9;i++){
   const x=28+rnd()*72,y=27+rnd()*74;
   c.strokeStyle='#f7ca5b';c.lineWidth=1.1+rnd()*1.8;
   c.shadowColor='#ffc544';c.shadowBlur=5;
   c.beginPath();c.moveTo(x-8,y-6);c.lineTo(x,y);
   c.lineTo(x+5+rnd()*8,y+7);c.stroke();
  }
  c.restore();this.roughRocks[index]=canvas;return canvas;
 }
 drawRock(ctx,rock,image,ore=false){
  const key=ore?'ore':'stone',frames=this.framesFromAtlas(image,key);
  const index=(Math.abs(Math.floor((rock.originX??rock.x)*13+(rock.originY??rock.y)*7))>>>2)%12;
  const oldMeteor=this.legacyMeteors[(ore?0:4)+(index%4)];
  // Detailed pre-existing WebP atlas drives the big rocks. Kenney's
  // flatter sprites are reserved for a few small fragments only.
  const sprite=index%12===0&&rock.r<26&&oldMeteor?.naturalWidth?oldMeteor:
   frames?.[index]||this.rockFallback((index%6)*2+(ore?0:1));
  if(!sprite)return false;
  ctx.save();ctx.translate(rock.x,rock.y);
  ctx.rotate(((rock.originX*0.017+rock.originY*0.031)%1)*TAU+(rock.spin||0));
  ctx.drawImage(sprite,-rock.r*1.12,-rock.r*1.12,rock.r*2.24,rock.r*2.24);
  ctx.restore();return true;
 }
 drawPlayer(ctx,p,level,time){
  const thrust=clamp(Math.hypot(p.vx,p.vy)/310,0,1);
  const pose=heroMotionPose(20,thrust,time);
  ctx.save();ctx.translate(p.x+pose.x,p.y+pose.y);
  ctx.rotate((p.angle||0)+pose.angle);
  const stage=Math.min(9,Math.max(0,Math.floor((level-1)/3)));
  const ratio=p.hp/Math.max(1,p.maxHp);
  p.weaponGeometry??={};
  const ok=drawEvolvedHero(ctx,19.5,stage,ratio,thrust,p.weaponGeometry);
  if(ok)drawInstalledModules(ctx,p);
  ctx.restore();
  return ok;
 }
 // Heavy ships use cached transparent paintings, never 3D scene downloads.
 drawCapital(ctx,e,time=0){
  if(typeof Image==='undefined'||!(e.r>0))return false;
  // Defer expensive painted capitals on data-saving / very low-memory devices;
  // the regular enemy sprite fallback remains available.
  if(typeof navigator!=='undefined'&&
     (navigator.connection?.saveData||
      (Number.isFinite(navigator.deviceMemory)&&navigator.deviceMemory<=2)))
   return false;
  // The transparent PNG originals replace the old flat-matte WebP exports.
  const ids=['cruiser','carrier','dreadnought'];
  const kind=ids[Math.abs(Math.floor(e.serial||0))%ids.length];
  const types=CAPITAL_PAINTINGS;
  if(!this.capitalSprites[kind]){
   this.capitalSprites[kind]={state:'loading'};
   const image=new Image();image.decoding='async';
   image.onload=()=>{
    const sprite=prepareCapitalSprite(image);
    this.capitalSprites[kind]=sprite?
     {state:'ready',sprite}:{state:'unusable'};
   };
   image.onerror=()=>{this.capitalSprites[kind]={state:'unusable'};};
   image.src=new URL('../assets/space/boss-capital-'+kind+'.'+types[kind],
    import.meta.url).href;
  }
  const prepared=this.capitalSprites[kind];
  if(prepared?.state!=='ready')return false;
  // Keep the source image's 2:3 aspect ratio. The existing circular
  // gameplay hitbox remains unchanged and is not derived from this painting.
  const h=e.r*3.85,w=h*2/3;
  ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle||0);
  ctx.imageSmoothingEnabled=true;
  if(this.capitalDamageQA){
   e.capitalWearPainted=drawCapitalDamage(ctx,e,kind,prepared.sprite,w,h,
    time,this.reducedMotion);
  }else ctx.drawImage(prepared.sprite,-w/2,-h/2,w,h);
  ctx.restore();return true;
 }
 drawEnemy(ctx,e,time=0){
  e.capitalWearPainted=false;
  if(!e.id)e.id=enemySkin(e.type,e.serial);
  e.visualAngle=e.angle||0;
  e.size=e.type==='gunship'?23:e.type==='berserker'?18:15;
  const capital=e.type==='gunship'&&e.serial%2===0&&this.drawCapital(ctx,e,time);
  const drawn=capital||(this.irisDroneEnabled&&
    drawIrisDrone(ctx,e,time,this.reducedMotion))||drawAnimatedEnemyShip(ctx,e);
  if(!drawn||e.converted)return drawn;
  // A minimal faction bracket and archetype signal: quick recognition in a
  // crowd without nameplates covering the battlefield.
  const color=e.type==='healer'?'#79edb5':e.type==='berserker'?'#ff9e57':
   e.type==='flanker'?'#c1a5ff':'#ff7889';
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.globalAlpha=.81;
  const r=e.r+6;
  ctx.beginPath();
  ctx.arc(e.x,e.y,r,Math.PI*.12,Math.PI*.42);
  ctx.arc(e.x,e.y,r,Math.PI*1.12,Math.PI*1.42);ctx.stroke();
  if(e.type==='healer'){
   ctx.beginPath();ctx.moveTo(e.x-4,e.y-e.r-12);
   ctx.lineTo(e.x+4,e.y-e.r-12);
   ctx.moveTo(e.x,e.y-e.r-16);ctx.lineTo(e.x,e.y-e.r-8);ctx.stroke();
  }else if(e.type==='berserker'){
   ctx.beginPath();ctx.moveTo(e.x-4,e.y-e.r-13);
   ctx.lineTo(e.x,e.y-e.r-19);ctx.lineTo(e.x+4,e.y-e.r-13);ctx.stroke();
  }
  ctx.restore();return drawn;
 }
 drawHostileShot(ctx,s){
  ctx.save();ctx.translate(s.x,s.y);
  ctx.rotate(Math.atan2(s.vy,s.vx));
  const ok=drawEnemyBolt(ctx,'laser');
  ctx.restore();return ok;
 }
 friendlySprite(image){
  if(!image?.complete||!image.naturalWidth)return null;
  this.friendlyMasks??=new WeakMap();
  const cached=this.friendlyMasks.get(image);
  if(cached)return cached;
  const c=document.createElement('canvas');
  c.width=image.naturalWidth;c.height=image.naturalHeight;
  const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(image,0,0);
  // Older ship PNGs contain opaque white space around otherwise useful art.
  // Flood-fill only edge-connected near-white pixels, preserving the ship's
  // white armour panels enclosed by coloured contours.
  const pixels=g.getImageData(0,0,c.width,c.height),d=pixels.data;
  const w=c.width,h=c.height,seen=new Uint8Array(w*h),stack=[];
  for(let x=0;x<w;x++){stack.push(x,(h-1)*w+x);}
  for(let y=0;y<h;y++){stack.push(y*w,y*w+w-1);}
  while(stack.length){
   const p=stack.pop();if(p<0||p>=w*h||seen[p])continue;
   seen[p]=1;
   const i=p*4,r=d[i],gr=d[i+1],b=d[i+2],a=d[i+3];
   const white=r>=222&&gr>=222&&b>=222&&
     Math.max(r,gr,b)-Math.min(r,gr,b)<24;
   if(!white&&a!==0)continue;
   if(white)d[i+3]=0;
   if(p%w>0)stack.push(p-1);
   if(p%w<w-1)stack.push(p+1);
   if(p>=w)stack.push(p-w);
   if(p<(h-1)*w)stack.push(p+w);
  }
  g.putImageData(pixels,0,0);
  this.friendlyMasks.set(image,c);
  return c;
 }
 drawCompactAlly(ctx,a,time){
  const role=a.role||'scout',spec=COMPACT_ESCORT_SPECS[role];
  if(!spec)return false;
  const w=spec.width,h=spec.height;
  const throttle=clamp(Math.hypot(a.vx||0,a.vy||0)/345,0,1);
  const flicker=.88+.12*Math.sin(time*16+(a.serial||0)*1.9);
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle||0);
  // Compact, restrained exhaust is attached to the aft end of the sprite.
  // It never grows into a second ship-shaped glow behind the drone.
  const plume=(1+5*throttle)*flicker;
  ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle=role==='scout'?'#60e6dc':'#73adff';
  ctx.lineWidth=role==='scout'?1.65:1.45;
  ctx.globalAlpha=.36+.45*throttle;
  for(const x of (role==='fighter'?[-4.3,4.3]:[0])){
   ctx.beginPath();ctx.moveTo(x,h*.36);ctx.lineTo(x,h*.36+plume);ctx.stroke();
  }
  ctx.restore();
  const tile=this.compactEscortSprites?.[role];
  if(tile){
   ctx.drawImage(tile,-w/2,-h/2,w,h);
  }else{
   // The silhouette is ready before the PNG finishes downloading.
   ctx.fillStyle='#152738';ctx.strokeStyle=spec.color;ctx.lineWidth=1.15;
   ctx.beginPath();
   if(role==='scout'){
    ctx.moveTo(0,-h*.42);
    ctx.bezierCurveTo(-5,-h*.39,-6,-h*.05,-3,h*.30);
    ctx.lineTo(-w*.43,h*.14);ctx.lineTo(-w*.32,-h*.22);
    ctx.lineTo(-w*.14,-h*.34);ctx.lineTo(0,-h*.42);
    ctx.lineTo(w*.14,-h*.34);ctx.lineTo(w*.32,-h*.22);
    ctx.lineTo(w*.43,h*.14);ctx.lineTo(3,h*.30);
    ctx.bezierCurveTo(6,-h*.05,5,-h*.39,0,-h*.42);
   }else{
    ctx.moveTo(-w*.42,-h*.48);ctx.lineTo(-w*.14,-h*.28);
    ctx.lineTo(0,-h*.35);ctx.lineTo(w*.14,-h*.28);
    ctx.lineTo(w*.42,-h*.48);ctx.lineTo(w*.29,h*.35);
    ctx.lineTo(0,h*.22);ctx.lineTo(-w*.29,h*.35);
   }
   ctx.closePath();ctx.fill();ctx.stroke();
   ctx.fillStyle=spec.color;
   ctx.beginPath();ctx.arc(0,-h*.04,role==='scout'?3.2:2.8,0,TAU);ctx.fill();
  }
  // A tiny live sensor confirms allegiance without the old oversized halo.
  ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=.16+.12*Math.sin(time*4+(a.serial||0));
  ctx.fillStyle=spec.color;
  ctx.beginPath();ctx.arc(0,-h*.04,role==='scout'?2.7:2.3,0,TAU);ctx.fill();
  ctx.restore();
  ctx.restore();
  if(a.hit>0){
   ctx.save();ctx.globalAlpha=clamp(a.hit*4,0,.75);
   ctx.strokeStyle='#fff2ba';ctx.lineWidth=1.55;
   ctx.beginPath();ctx.arc(a.x,a.y,(a.r||12)+2,0,TAU);ctx.stroke();
   ctx.restore();
  }
  return true;
 }
 drawAlly(ctx,a,time,image){
  if(a.role==='fighter'||!a.role||a.role==='scout')
   return this.drawCompactAlly(ctx,a,time);

  // Friendly craft use their dedicated sprites, never the hostile eight-frame
  // creature atlas. Thrusters and hull accent follow their actual velocity.
  const role=a.role||'scout';
  const color=role==='scout'?'#74ffe5':role==='bomber'?'#ffce86':'#81caff';
  const w=role==='bomber'?70:role==='fighter'?61:54;
  const h=role==='bomber'?53:role==='fighter'?42:41;
  const speed=Math.hypot(a.vx||0,a.vy||0),throttle=clamp(speed/345,0,1);
  const flicker=.82+.18*Math.sin(time*22+(a.serial||0)*2.1);
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle||0);
  // Engine fire begins behind the hull; on brake it shrinks instead of
  // blinking to a false, static "on" state.
  const plume=7+15*throttle*flicker;
  ctx.save();ctx.globalCompositeOperation='lighter';
  ctx.fillStyle=role==='bomber'?'#ffd184':'#67e9ff';
  ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;
  for(const lane of (role==='fighter'?[-10,10]:[-8,8])){
    ctx.beginPath();ctx.moveTo(lane-3,h*.35);
    ctx.lineTo(lane,h*.35+plume);
    ctx.lineTo(lane+3,h*.35);ctx.fill();
  }
  ctx.restore();
  const sprite=this.friendlySprite(image);
  if(sprite){
    if(role==='scout')ctx.filter='hue-rotate(165deg) saturate(1.2)';
    ctx.drawImage(sprite,-w/2,-h/2,w,h);
    ctx.filter='none';
  }else{
    ctx.fillStyle=role==='fighter'?'#5dbafa':'#63decf';
    ctx.beginPath();ctx.moveTo(0,-h*.43);ctx.lineTo(-w*.41,h*.32);
    ctx.lineTo(0,h*.2);ctx.lineTo(w*.41,h*.32);ctx.closePath();ctx.fill();
  }
  // Two faction winglets and a diamond marker stay legible on dark/bright
  // nebulae and distinguish escorts from red outlined enemies at a glance.
  ctx.strokeStyle=color;ctx.lineWidth=2.1;
  ctx.beginPath();ctx.moveTo(-w*.45,-1);ctx.lineTo(-w*.28,4);
  ctx.moveTo(w*.45,-1);ctx.lineTo(w*.28,4);ctx.stroke();
  ctx.restore();
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.8;
  ctx.globalAlpha=.72+.18*Math.sin(time*3.5+(a.serial||0));
  ctx.beginPath();ctx.arc(a.x,a.y,a.r+6,Math.PI*.05,Math.PI*.38);
  ctx.arc(a.x,a.y,a.r+6,Math.PI*1.05,Math.PI*1.38);ctx.stroke();
  ctx.restore();
  if(a.hit>0){
   ctx.save();ctx.globalAlpha=clamp(a.hit*4,0,.8);
   ctx.strokeStyle='#fff6bd';ctx.lineWidth=2.7;
   ctx.beginPath();ctx.arc(a.x,a.y,a.r+10,0,TAU);ctx.stroke();
   ctx.restore();
  }
  return true;
 }
 drawDerelict(ctx,cam,time,fps=60){
  const w=DERELICT_ANCHOR;
  // Only the Lilac-sector landmark is drawn. It is scenery, not loot or cover.
  if(!this.derelictImage?.naturalWidth)return;
  if(w.x+w.width<cam.x||w.x-w.width>cam.x+cam.w||
   w.y+350<cam.y||w.y-350>cam.y+cam.h)return;
  ctx.save();ctx.translate(w.x,w.y);ctx.rotate(-.1);
  // A recognizable field of quiet salvage surrounds this unique landmark.
  // These dim plates have no hitboxes and must not resemble asteroid cover.
  ctx.fillStyle='#4b596d';ctx.strokeStyle='#8896a7';ctx.lineWidth=1.1;
  for(let i=0;i<12;i++){
   const a=i*2.39996,spread=142+hash(i,7,83)*310;
   const dx=Math.cos(a)*spread*1.28,dy=Math.sin(a)*spread*.74;
   const size=4+hash(i,3,47)*11;
   ctx.globalAlpha=.18+hash(i,17,51)*.17;
   ctx.save();ctx.translate(dx,dy);ctx.rotate(a*.48);
   ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size*.3,-size*.48);
   ctx.lineTo(size*.82,size*.47);ctx.closePath();ctx.fill();ctx.stroke();
   ctx.restore();
  }
  ctx.globalAlpha=.95;
  ctx.drawImage(this.derelictImage,-w.width/2,-w.height/2,w.width,w.height);
  // Failing emergency transponder; read as a remote wreck, never an attack.
  if(fps>=32){
   const pulse=this.reducedMotion?.48:.34+.14*Math.sin(time*2.4);
   ctx.globalCompositeOperation='lighter';
   ctx.globalAlpha=pulse;ctx.fillStyle='#80e3ed';
   ctx.beginPath();ctx.arc(-92,-4,4,0,TAU);ctx.fill();
   ctx.strokeStyle='#7cdbe4';ctx.lineWidth=1.4;
   ctx.beginPath();ctx.arc(-92,-4,11,Math.PI*.1,Math.PI*1.7);ctx.stroke();
  }
  ctx.restore();
 }
 drawBase(ctx,b,time,focusX,focusY,network=null,linked=false){
  const hostile=b.enemy&&!b.captured;
  const color=hostile?'#f45b6e':b.type==='dock'?'#69e5e4':
    b.type==='carrier'?'#aaa9ff':b.type==='arsenal'?'#ffc17f':'#c9a3ff';
  const powered=b.active||b.captured;
  // Captured hostile docks retain their original battle-damaged structure.
  // A change of ownership cannot instantly replace the entire metal hull.
  const friendlyDock=b.type==='dock'&&!hostile&&!b.captured;
  ctx.save();ctx.translate(b.x,b.y);
  if(friendlyDock){
   // Full replacement, not an overlay: old generic hull/art/arms are hidden.
   drawRepairDock(ctx,b,time,{connected:linked,reducedMotion:this.reducedMotion});
  }else{
  halo(ctx,107,color,powered?1:.7,
   hostile?'red':b.type==='arsenal'?'orange':
    b.type==='carrier'||b.type==='lab'?'violet':'cyan');
  // A substantial silhouette stays visible even when individual modular
  // atlas cells are transparent: no hollow square-placeholder stations.
  const hull=hostile?'#3b1826':powered?'#17354b':'#162b3b';
  openPolygon(ctx,HULLS[b.type]||HULLS.dock,hull,color);
  ctx.fillStyle=hostile?'#562132':'#102738';
  ctx.fillRect(-45,-42,90,84);
  for(const side of [-1,1]){
   drawStationPart(ctx,STATION_PARTS.bridge,side*54,0,67,
     side*Math.PI/2,powered?1:.65);
   ctx.strokeStyle=color;ctx.lineWidth=4;
   ctx.beginPath();ctx.moveTo(side*40,-30);ctx.lineTo(side*72,-46);
   ctx.moveTo(side*40,30);ctx.lineTo(side*72,46);ctx.stroke();
  }
  const art=STATION_PARTS[b.type]??STATION_PARTS.outpost;
  drawStationPart(ctx,art,0,0,156,0,powered?1:.67);
  // Role-specific details, borrowed from the existing station design.
  if(b.type==='carrier'){
   ctx.strokeStyle='#b0b6fa';ctx.lineWidth=3;
   for(const x of [-40,40]){ctx.beginPath();ctx.moveTo(x,-36);
    ctx.lineTo(x,36);ctx.stroke();}
   ctx.fillStyle='#7a85e9';ctx.fillRect(-12,-48,24,13);
  }else if(b.type==='lab'){
   ctx.strokeStyle='#d6b4ff';ctx.lineWidth=4;
   ctx.beginPath();ctx.ellipse(0,0,43,28,time*.15,0,TAU);ctx.stroke();
  }else if(b.type==='arsenal'){
   ctx.fillStyle='#efad74';ctx.fillRect(-29,-8,58,16);
   ctx.fillStyle='#ffdda5';ctx.fillRect(-6,-34,12,68);
  }else{
   ctx.strokeStyle='#93dfe9';ctx.lineWidth=3;
   ctx.strokeRect(-33,-38,66,76);
  }
  if(powered){
   // Source module handles the original animated arms, hangar and scan ring.
   // Rendering never mutates station state. Activation is recorded in game.js.
   drawStationMechanisms(ctx,b,156,time,this.reducedMotion);
  }
  } // end existing body for non-dock stations
  // Four modest illuminated ports report the shared network upgrades.
  // These indicators are circuitry, not fictional local turrets.
  if(powered&&!hostile&&network&&!friendlyDock){
   const ports=[['armor','#7ee7ff'],['armament','#ffd089'],
    ['engine','#77f6c2'],['strikePower','#b7a3ff']];
   for(let i=0;i<ports.length;i++){
    const [key,tint]=ports[i],rank=network[key]||0;
    const a=-Math.PI/2+i*Math.PI/2,x=Math.cos(a)*58,y=Math.sin(a)*58;
    ctx.fillStyle=rank?tint:'#183246';
    ctx.globalAlpha=rank?.65+.25*Math.sin(time*2+i):.72;
    ctx.beginPath();ctx.arc(x,y,rank?3+Math.min(3,rank):3,0,TAU);ctx.fill();
   }
   ctx.globalAlpha=1;
  }
  // Existing reactor overlay belongs only to the legacy station bodies.
  if(!friendlyDock){
  const pulse=this.reducedMotion?.82:.72+.28*Math.sin(time*2.2+b.x*.004);
  const coreGlow=powered||hostile?
   getFXSprite('glow',hostile?'red':b.type==='lab'?'violet':'cyan'):null;
  if(coreGlow){
   ctx.save();ctx.globalCompositeOperation='lighter';
   ctx.globalAlpha=.29*pulse;
   ctx.drawImage(coreGlow,-47,-47,94,94);ctx.restore();
  }
  ctx.fillStyle=hostile?'#f2767a':powered?'#90fff1':'#46647b';
  ctx.globalAlpha=pulse;ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.fill();
  ctx.globalAlpha=1;
  }
  ctx.fillStyle='#eaf6ff';ctx.textAlign='center';ctx.font='bold 13px system-ui';
  ctx.fillText(hostile?'ВРАЖЕСКАЯ БАЗА':
   {dock:'Ремонтный док',arsenal:'Военный арсенал',
    carrier:'Авианосец',lab:'Лаборатория'}[b.type],0,-118);
  ctx.font='11px system-ui';ctx.fillStyle=color;
  const nearPanel=Math.hypot(b.x-focusX,b.y-focusY)<=RULES.baseInteract;
  ctx.fillText(hostile?(b.coreExposed?'ЯДРО ОТКРЫТО · АТАКУЙТЕ':'Оборона '+b.rank):
   nearPanel?(powered?'E · УСЛУГИ БАЗЫ':'E · ОТКРЫТЬ БАЗУ'):
    powered?(linked?'СЕТЬ ПОДКЛЮЧЕНА':'АВТОНОМНЫЙ УЗЕЛ'):
      'ПОДЛЕТИТЕ · '+Math.round(Math.hypot(b.x-focusX,b.y-focusY))+' М',0,123);
  ctx.restore();
  if(hostile){
   for(const t of b.turrets){
    if(t.hp<=0)continue;
    const aim=Math.atan2(focusY-t.y,focusX-t.x);
    const path=b.type==='arsenal'?'rail':b.type==='carrier'?'missile':
      b.type==='lab'?'arc':'basic';
    const rig={path,level:Math.min(5,b.rank),mount:1,tracked:true,
      aimAngle:aim,overheat:0,cooldown:t.shot||0};
    ctx.save();ctx.translate(t.x,t.y);
    halo(ctx,32,'#f46973',.6,'red');
    drawStationPart(ctx,STATION_PARTS.turretIdle,0,0,51,0,.7);
    drawTurretMount(ctx,rig,0,0,time);
    drawTurretHead(ctx,rig,0,0,aim,time);
    if(t.flash>0){
     ctx.fillStyle='#fff2bb';ctx.globalAlpha=Math.min(1,t.flash*7);
     ctx.beginPath();ctx.arc(Math.cos(aim)*35,Math.sin(aim)*35,8,0,TAU);ctx.fill();
    }
    ctx.restore();
   }
  }
 }
}
