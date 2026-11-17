// Decorative, deterministic space art for Survivor: Protocol.
// No combat RNG, simulation time, saved state or network requests are changed.
// Images are the same approved CC0 512px nebula details as the original arcade.
export const SPACE_PALETTES=Object.freeze([
 Object.freeze({name:'Окраина',base:'#071220',deep:'#040a16',mid:'#172844',glow:'#2c8ba6',warm:'#cc9b70',planet:'#32627f'}),
 Object.freeze({name:'Сигнальный разлом',base:'#0c1127',deep:'#070b18',mid:'#2a244b',glow:'#8461bd',warm:'#d1a06e',planet:'#66518e'}),
 Object.freeze({name:'Багровый рубеж',base:'#100f22',deep:'#080b17',mid:'#352039',glow:'#a95d78',warm:'#d6a17b',planet:'#704b6d'}),
 Object.freeze({name:'Тихая дуга',base:'#06171e',deep:'#041015',mid:'#173d48',glow:'#3eaa9a',warm:'#a3b8aa',planet:'#3b8b87'})
]);
const imagePaths=Object.freeze([
 '../assets/space/deep-nebula/cloud-0.webp',
 '../assets/space/deep-nebula/cloud-1.webp',
 '../assets/space/deep-nebula/cloud-2.webp',
 '../assets/space/deep-nebula/cloud-3.webp',
 '../assets/space/deep-nebula/cloud-4.webp'
]);
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=(v,range)=>((v%range)+range)%range;
function randomSeed(seed,mission){
 let v=(((Number(seed)||1729)>>>0)^(Math.imul((mission|0)+1,0x9e3779b1)))>>>0;
 return ()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return (v>>>0)/4294967296;};
}
export function createSpaceScene(seed=1729,mission=0){
 const sector=clamp(Math.trunc(mission)||0,0,SPACE_PALETTES.length-1),rnd=randomSeed(seed,sector);
 const layers=[{depth:.028,count:115,size:.65},{depth:.095,count:82,size:1.05},{depth:.22,count:44,size:1.55}]
  .map((layer,i)=>({...layer,stars:Array.from({length:layer.count},()=>({
   x:rnd(),y:rnd(),size:layer.size*(.62+rnd()*.9),
   brightness:.34+rnd()*.65,phase:rnd()*TAU,
   cross:rnd()>.945,tint:rnd()>.86
  }))}));
 const clouds=Array.from({length:4},(_,i)=>({
  x:[.14,.82,.54,1.02][i]+(rnd()-.5)*.12,
  y:[.27,.30,.8,.7][i]+(rnd()-.5)*.18,
  radius:[.53,.57,.48,.38][i],depth:[.055,.09,.14,.2][i],
  opacity:[.25,.16,.12,.08][i],image:(sector+i)%imagePaths.length,
  phase:rnd()*TAU
 }));
 const motes=Array.from({length:55},()=>({x:rnd(),y:rnd(),size:.7+rnd()*1.3,depth:.16+rnd()*.13,opacity:.12+rnd()*.22}));
 return {seed:seed>>>0,mission:sector,palette:SPACE_PALETTES[sector],layers,clouds,motes,
  planet:{x:[.84,.17,.88,.77][sector],y:[.14,.82,.18,.82][sector],radius:[.15,.115,.19,.16][sector],
   depth:.06,ring:sector===2}};
}
// The approved textures are optional: procedural haze remains visible while
// files load or if a browser refuses WebP. No large image is ever downloaded.
export function loadSpaceClouds(onReady=()=>{},ImageClass=typeof Image==='undefined'?null:Image){
 const images=[];
 if(!ImageClass)return images;
 for(const path of imagePaths){
  const img=new ImageClass();
  img.decoding='async';
  img.addEventListener('load',()=>onReady());
  img.addEventListener('error',()=>onReady());
  img.src=path;
  images.push(img);
 }
 return images;
}
function cloudCenter(cloud,view,cam,now,reducedMotion){
 const shiftX=(cam.x-900)*cam.s*cloud.depth;
 const shiftY=(cam.y-530)*cam.s*cloud.depth;
 const drift=reducedMotion?0:Math.sin(now*.000065+cloud.phase)*6;
 return {x:cloud.x*view.w-shiftX+drift,y:cloud.y*view.h-shiftY+drift*.5};
}
function drawPlanet(ctx,scene,view,cam){
 const p=scene.planet,r=Math.min(view.w,view.h)*p.radius+18;
 const x=p.x*view.w-(cam.x-900)*cam.s*p.depth,y=p.y*view.h-(cam.y-530)*cam.s*p.depth;
 if(x+r<0||x-r>view.w||y+r<0||y-r>view.h)return;
 ctx.save();
 let g=ctx.createRadialGradient(x,y,r*.4,x,y,r*1.45);
 g.addColorStop(0,'#7fa5c200');g.addColorStop(.65,scene.palette.glow+'10');
 g.addColorStop(.8,scene.palette.glow+'22');g.addColorStop(1,scene.palette.glow+'00');
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r*1.45,0,TAU);ctx.fill();
 if(p.ring){
  ctx.save();ctx.translate(x,y);ctx.rotate(-.32);
  ctx.strokeStyle=scene.palette.warm+'38';ctx.lineWidth=Math.max(2,r*.11);
  ctx.beginPath();ctx.ellipse(0,0,r*1.65,r*.39,0,Math.PI*.99,Math.PI*1.99);ctx.stroke();ctx.restore();
 }
 g=ctx.createLinearGradient(x-r,y-r,x+r,y+r);
 g.addColorStop(0,scene.palette.planet);g.addColorStop(.44,scene.palette.mid);g.addColorStop(1,scene.palette.deep);
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
 // The terminator supplies volume without a busy photo competing with units.
 g=ctx.createRadialGradient(x-r*.38,y-r*.5,0,x-r*.12,y-r*.10,r*1.65);
 g.addColorStop(0,'#f5dca526');g.addColorStop(.6,'#19334a08');g.addColorStop(1,'#02060bd9');
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r-.7,0,TAU);ctx.fill();
 ctx.strokeStyle=scene.palette.glow+'63';ctx.lineWidth=1.4;
 ctx.beginPath();ctx.arc(x,y,r+.6,0,TAU);ctx.stroke();
 if(p.ring){
  ctx.save();ctx.translate(x,y);ctx.rotate(-.32);
  ctx.strokeStyle=scene.palette.warm+'74';ctx.lineWidth=Math.max(2,r*.065);
  ctx.beginPath();ctx.ellipse(0,0,r*1.65,r*.39,0,0,Math.PI);ctx.stroke();ctx.restore();
 }
 ctx.restore();
}
export function drawSpaceBackdrop(ctx,scene,images=[],view,cam,now=0,{reducedMotion=false,simple=false}={}){
 if(!ctx||!scene||!view||!cam||view.w<=0||view.h<=0)return;
 const {w,h}=view,p=scene.palette,small=w<570||h<335;
 ctx.save();
 const bg=ctx.createLinearGradient(0,0,w,h);
 bg.addColorStop(0,p.mid);bg.addColorStop(.52,p.base);bg.addColorStop(1,p.deep);
 ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 if(!simple){
  // Broad, quiet color fields; they move more slowly than foreground units.
  for(const cloud of scene.clouds.slice(0,small?3:4)){
   const at=cloudCenter(cloud,view,cam,now,reducedMotion),radius=Math.max(w,h)*cloud.radius;
   if(at.x+radius<0||at.x-radius>w||at.y+radius<0||at.y-radius>h)continue;
   const g=ctx.createRadialGradient(at.x,at.y,0,at.x,at.y,radius);
   g.addColorStop(0,p.glow+'2f');g.addColorStop(.35,p.mid+'23');g.addColorStop(1,p.deep+'00');
   ctx.globalAlpha=cloud.opacity*2.4;ctx.fillStyle=g;
   ctx.fillRect(at.x-radius,at.y-radius,radius*2,radius*2);
   const img=images[cloud.image];
   if(img?.complete&&img.naturalWidth){
    const size=radius*1.95;ctx.globalAlpha=cloud.opacity*.68;
    ctx.drawImage(img,at.x-size/2,at.y-size/2,size,size);
   }
  }
  ctx.globalAlpha=1;
  drawPlanet(ctx,scene,view,cam);
 }
 const maxLayers=simple?1:small?2:3;
 const colors=['#b0d5eb','#a4c6ea','#f6eee1'];
 for(let i=0;i<maxLayers;i++){
  const layer=scene.layers[i],cx=(cam.x-900)*cam.s*layer.depth,cy=(cam.y-530)*cam.s*layer.depth;
  const drift=reducedMotion?0:Math.sin(now*.000075+i)*[1,2,3][i];
  ctx.fillStyle=colors[i];
  const count=simple?55:small?Math.round(layer.stars.length*.78):layer.stars.length;
  for(let j=0;j<count;j++){
   const s=layer.stars[j],x=wrap(s.x*w-cx+drift,w),y=wrap(s.y*h-cy+drift*.38,h);
   const lum=reducedMotion?1:1+Math.sin(now*.00045+s.phase)*.07; // slow, never flashing
   ctx.globalAlpha=clamp(s.brightness*lum*(i===0?.47:i===1?.72:.87),.13,.87);
   const sz=s.size;
   ctx.fillRect(x,y,sz,sz);
   if(s.cross&&!small&&!simple){
    ctx.globalAlpha*=.35;
    ctx.fillRect(x-2.2,y+.2,sz+4.4,.6);
    ctx.fillRect(x+.2,y-2.2,.6,sz+4.4);
   }
  }
 }
 if(!simple){
  ctx.fillStyle=p.warm;
  const count=small?18:scene.motes.length;
  for(let i=0;i<count;i++){
   const mote=scene.motes[i],x=wrap(mote.x*w-(cam.x-900)*cam.s*mote.depth,w),
    y=wrap(mote.y*h-(cam.y-530)*cam.s*mote.depth,h);
   ctx.globalAlpha=mote.opacity;ctx.fillRect(x,y,mote.size,mote.size);
  }
 }
 ctx.globalAlpha=1;
 // Darken the rim, retaining contrast for target rings and forecast lines.
 const vignette=ctx.createRadialGradient(w*.52,h*.46,Math.min(w,h)*.16,w*.52,h*.46,Math.max(w,h)*.72);
 vignette.addColorStop(0,'#02071600');vignette.addColorStop(1,small?'#02081364':'#02081385');
 ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
 ctx.restore();
}
