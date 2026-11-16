const TAU=Math.PI*2;
const TILE=768;
// Optional, preprocessed CC0 nebula gas. The original approved sector images
// remain behind Canvas in CSS; failures here must never stop the game.
const DETAIL_IMAGES=[
 '../assets/space/deep-nebula/cloud-0.webp',
 '../assets/space/deep-nebula/cloud-1.webp',
 '../assets/space/deep-nebula/cloud-2.webp',
 '../assets/space/deep-nebula/cloud-3.webp',
 '../assets/space/deep-nebula/cloud-4.webp'
];
export const NEBULA_DETAIL_SIZE=512;

// Purely scenic. World physics, saves, combat RNG, and controls are untouched.
const PALETTES=[
 {haze:'#9672d4',star:'#c9d9ff'},
 {haze:'#4fc1e9',star:'#c2efff'}, // azure, sector 1
 {haze:'#e9a366',star:'#ffe4bd'}, // amber, sector 2
 {haze:'#b87bcb',star:'#f2d6ff'},
 {haze:'#59b7ad',star:'#c7fff1'}
];
const layers=[
 {factor:.018,count:135,alpha:.42,seed:0x2fc031},
 {factor:.055,count:70,alpha:.52,seed:0x7221a1},
 {factor:.13,count:29,alpha:.36,seed:0x4a34b7}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=(n,m)=>((n%m)+m)%m;
const rand32=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const hexRgb=hex=>{const h=hex.slice(1);return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));};
const colorA=(hex,alpha)=>{const [r,g,b]=hexRgb(hex);return `rgba(${r},${g},${b},${alpha})`;};

// Deterministic and clock-based: returning to a checkpoint needs no extra state.
export function cosmicEventAt(time,sector=0){
 if(!Number.isFinite(time)||time<42)return null;
 const index=Math.floor((time-42)/126);
 const age=time-42-index*126;
 if(age>=13)return null;
 // Crossing a sector boundary must not replace an event halfway through.
 const kind=['comet','distant-burst','micro-meteors'][index%3];
 return {kind,index,age,duration:13};
}
export class CosmicAmbience {
 constructor({enabled=true,demo=false,textures=true}={}){
  this.enabled=!!enabled;this.demo=!!demo;
  this.tiles=[];this.haze=null;this.hazeSector=-1;
  this.previousHaze=null;this.hazeChangedAt=0;
  const option=typeof location==='undefined'?null:
   new URLSearchParams(location.search).get('skytexture');
  this.textures=!!textures&&!['off','0','false'].includes(option);
  this.detailImages=Array(5).fill(null);
  this.detailStates=Array(5).fill('idle');
  this.detailPatterns=Array(5).fill(null);
  this.detailReadyAt=Array(5).fill(Infinity);
  this.detailSector=-1;this.detailPrevious=-1;
  this.detailChangedAt=0;this.lastTime=0;
 }
 _createTile(spec){
  if(typeof document==='undefined'||typeof document.createElement!=='function')return null;
  const canvas=document.createElement('canvas');canvas.width=TILE;canvas.height=TILE;
  const c=canvas.getContext?.('2d');if(!c)return null;
  const random=rand32(spec.seed);
  const stamp=(x,y,r,bright,glow)=>{
   c.fillStyle=`rgba(230,242,255,${bright})`;
   c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
   if(glow){
    const g=c.createRadialGradient(x,y,0,x,y,r*6);
    g.addColorStop(0,`rgba(188,221,255,${bright*.22})`);
    g.addColorStop(1,'rgba(188,221,255,0)');
    c.fillStyle=g;c.fillRect(x-r*6,y-r*6,r*12,r*12);
   }
  };
  for(let i=0;i<spec.count;i++){
   const x=random()*TILE,y=random()*TILE;
   const bright=.23+random()*.63;
   const size=.48+random()*(random()>.94?1.28:.55);
   const glow=i%23===0;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const px=x+dx*TILE,py=y+dy*TILE;
    if(px>-18&&px<TILE+18&&py>-18&&py<TILE+18)stamp(px,py,size,bright,glow);
   }
  }
  return canvas;
 }
 _makeHaze(sector){
  if(typeof document==='undefined'||typeof document.createElement!=='function')return null;
  // Bake turbulent, translucent galactic gas once per region. No shaders per frame.
  const SIZE=256,canvas=document.createElement('canvas');
  canvas.width=SIZE;canvas.height=SIZE;
  const c=canvas.getContext?.('2d');if(!c)return null;
  const rgba=c.createImageData?.(SIZE,SIZE);
  const tint=PALETTES[sector]?.haze||PALETTES[0].haze;
  if(!rgba?.data){
   const gradient=c.createRadialGradient?.(SIZE*.52,SIZE*.48,8,SIZE*.52,SIZE*.48,SIZE*.46);
   if(gradient){gradient.addColorStop(0,colorA(tint,.24));gradient.addColorStop(1,colorA(tint,0));
    c.fillStyle=gradient;c.fillRect(0,0,SIZE,SIZE);}
   return canvas;
  }
  const [red,green,blue]=hexRgb(tint),rand=rand32(126017+sector*137);
  const octaves=[6,12,24,48].map(n=>{
   const data=new Float32Array((n+1)*(n+1));
   for(let i=0;i<data.length;i++)data[i]=rand();
   return {n,data};
  });
  const sample=(grid,x,y)=>{
   const n=grid.n,px=x*n,py=y*n,ix=Math.min(n-1,px|0),iy=Math.min(n-1,py|0);
   const sx=px-ix,sy=py-iy,u=sx*sx*(3-2*sx),v=sy*sy*(3-2*sy),q=grid.data;
   const k=iy*(n+1)+ix,a=q[k],b=q[k+1],d=q[k+n+1],e=q[k+n+2];
   return (a+(b-a)*u)*(1-v)+(d+(e-d)*u)*v;
  };
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   const u=x/(SIZE-1),v=y/(SIZE-1);
   const n0=sample(octaves[0],u,v),n1=sample(octaves[1],u,v),
    n2=sample(octaves[2],u,v),n3=sample(octaves[3],u,v);
   const fbm=n0*.46+n1*.29+n2*.17+n3*.08;
   const spine=.45+.20*Math.sin(u*3.4+sector*.38)+.11*Math.sin(u*8.1+fbm*4.5);
   const ribbon=Math.exp(-Math.pow((v-spine)/(.16+fbm*.19),2));
   const y2=.37+.23*Math.sin(u*2.7+2.2+sector*.49);
   const secondary=Math.exp(-Math.pow((v-y2)/(.13+fbm*.11),2))*.46;
   const edge=Math.pow(Math.max(0,1-Math.pow((u-.5)/.51,4)),1.8)*
    Math.pow(Math.max(0,1-Math.pow((v-.5)/.51,4)),1.8);
   const concentration=Math.max(0,(fbm-.33)*2.65),light=(ribbon+secondary)*edge*concentration;
   const alpha=Math.max(0,Math.min(210,Math.round(light*150)));
   const k=(y*SIZE+x)*4,highlight=Math.min(1,Math.max(0,(fbm-.55)*2.8));
   rgba.data[k]=Math.min(255,red*(.7+.32*highlight)+36*highlight);
   rgba.data[k+1]=Math.min(255,green*(.65+.36*highlight)+40*highlight);
   rgba.data[k+2]=Math.min(255,blue*(.75+.28*highlight)+27*highlight);
   rgba.data[k+3]=alpha;
  }
  c.putImageData(rgba,0,0);
  return canvas;
 }
 _loadDetail(sector){
  if(!this.textures||this.detailStates[sector]!=='idle')return;
  // A single local image for the active sector, loaded asynchronously.
  // The original game still paints if WebP or network loading fails.
  if(typeof Image==='undefined')return;
  this.detailStates[sector]='loading';
  try{
   const img=new Image();
   img.decoding='async';
   img.onload=()=>{
    if(img.naturalWidth===NEBULA_DETAIL_SIZE&&
       img.naturalHeight===NEBULA_DETAIL_SIZE){
     this.detailImages[sector]=img;
     this.detailReadyAt[sector]=this.lastTime;
     this.detailStates[sector]='ready';
    }else this.detailStates[sector]='failed';
   };
   img.onerror=()=>{this.detailStates[sector]='failed';};
   img.src=new URL(DETAIL_IMAGES[sector],import.meta.url).href;
  }catch{this.detailStates[sector]='failed';}
 }
 _drawDetails(ctx,cam,time,fps,sector,reducedMotion){
  if(!this.textures)return;
  if(sector!==this.detailSector){
   this.detailPrevious=this.detailSector;
   this.detailSector=sector;
   this.detailChangedAt=time;
  }
  this.lastTime=time;
  this._loadDetail(sector);
  const transition=clamp((time-this.detailChangedAt)/2.6,0,1);
  const steady=!!reducedMotion||fps<34;
  const scale=1.6;
  for(let pass=0;pass<2;pass++){
   const index=pass===0?this.detailPrevious:sector;
   if(index<0||index===sector&&pass===0)continue;
   const img=this.detailImages[index];
   if(!img)continue;
   let pattern=this.detailPatterns[index];
   if(!pattern){
    pattern=ctx.createPattern?.(img,'repeat');
    if(!pattern)continue;
    this.detailPatterns[index]=pattern;
   }
   const changed=pass===0?1-transition:transition;
   const loaded=clamp((time-this.detailReadyAt[index])/1.7,0,1);
   const alpha=.62*changed*loaded;
   if(alpha<.004)continue;
   // One repeated texture over the entire screen, not hundreds of
   // per-star/per-cloud draw calls. Drift slowly with the camera.
   const dx=steady?0:-cam.x*.009+Math.sin(time*.019)*17;
   const dy=steady?0:-cam.y*.007+Math.cos(time*.015)*14;
   const ox=((dx%(NEBULA_DETAIL_SIZE*scale))+(NEBULA_DETAIL_SIZE*scale))%
     (NEBULA_DETAIL_SIZE*scale);
   const oy=((dy%(NEBULA_DETAIL_SIZE*scale))+(NEBULA_DETAIL_SIZE*scale))%
     (NEBULA_DETAIL_SIZE*scale);
   ctx.save();
   ctx.globalAlpha=alpha;
   ctx.translate(ox,oy);ctx.scale(scale,scale);
   ctx.fillStyle=pattern;
   ctx.fillRect(-ox/scale,-oy/scale,cam.w/scale,cam.h/scale);
   ctx.restore();
  }
  if(transition>=1)this.detailPrevious=-1;
 }
 _stars(ctx,cam,layer,spec,width,height,alpha){
  const texture=this.tiles[layer];if(!texture)return;
  const offsetX=wrap(-cam.x*spec.factor,TILE)-TILE;
  const offsetY=wrap(-cam.y*spec.factor,TILE)-TILE;
  ctx.globalAlpha=alpha;
  for(let y=offsetY;y<height;y+=TILE)
   for(let x=offsetX;x<width;x+=TILE)
    ctx.drawImage(texture,Math.floor(x),Math.floor(y));
 }
 _comet(ctx,w,h,event,palette){
  const seed=event.index;
  const reverse=seed%2===1;
  const t=event.age/event.duration;
  const ease=clamp(t/.12,0,1)*clamp((1-t)/.15,0,1);
  if(!ease)return;
  const x=(reverse?1.09-t*1.27:-.09+t*1.27)*w;
  const y=(.19+t*.36+(seed%3)*.09)*h;
  const vx=reverse?-1:1,vy=.38;
  ctx.save();ctx.globalAlpha=ease*.75;
  const tail=Math.min(w*.36,440),len=Math.hypot(vx,vy),ux=vx/len,uy=vy/len;
  const grad=ctx.createLinearGradient(x-ux*tail,y-uy*tail,x,y);
  grad.addColorStop(0,'rgba(72,153,230,0)');
  grad.addColorStop(.55,colorA(palette.star,.075));
  grad.addColorStop(1,'rgba(230,250,255,.80)');
  // The broad, low-opacity dust fan follows the bright ion tail.
  const px=x-ux*tail,py=y-uy*tail;
  ctx.globalAlpha=ease*.24;
  ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(x,y);
  ctx.bezierCurveTo(x-ux*tail*.28-uy*9,y-uy*tail*.28+ux*9,
   px-uy*20,py+ux*20,px-uy*32,py+ux*32);
  ctx.quadraticCurveTo(px+uy*18,py-ux*18,x,y);
  ctx.fill();ctx.globalAlpha=ease*.76;
  for(let i=0;i<13;i++){
   const f=(i+.55)/14,scatter=Math.sin((seed+1)*5.3+i*14.17)*f*17;
   const sx=x-ux*tail*f-uy*scatter,sy=y-uy*tail*f+ux*scatter;
   ctx.globalAlpha=ease*(1-f)*.26;
   ctx.fillStyle='#c2e7ff';ctx.fillRect(sx,sy,.8,.8);
  }
  ctx.globalAlpha=ease*.76;
  ctx.strokeStyle=grad;ctx.lineWidth=2.5;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(x-ux*tail,y-uy*tail);ctx.lineTo(x,y);ctx.stroke();
  const bloom=ctx.createRadialGradient(x,y,0,x,y,18);
  bloom.addColorStop(0,'rgba(255,255,255,.95)');
  bloom.addColorStop(.18,'rgba(197,235,255,.55)');bloom.addColorStop(1,'rgba(80,166,230,0)');
  ctx.fillStyle=bloom;ctx.fillRect(x-18,y-18,36,36);ctx.restore();
 }
 _burst(ctx,w,h,event,palette){
  const a=event.age;
  const x=w*(.68-.13*(event.index%3)),y=h*(.32+.09*(event.index%2));
  const rise=clamp((a-1)/1.4,0,1),fade=clamp((13-a)/7,0,1);
  const strength=rise*fade;if(strength<=0)return;
  const r=22+Math.min(1,a/4)*110;
  ctx.save();ctx.globalAlpha=strength*.58;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,'rgba(255,255,255,.82)');
  g.addColorStop(.12,colorA(palette.star,.56));
  g.addColorStop(.38,colorA(palette.haze,.14));g.addColorStop(1,colorA(palette.haze,0));
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  ctx.strokeStyle=colorA(palette.star,.14*(1-a/13));
  ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x,y,15+a*12,0,TAU);ctx.stroke();
  ctx.restore();
 }
 _smallMeteors(ctx,w,h,event,palette){
  const a=event.age,fade=clamp(a/2,0,1)*clamp((13-a)/3,0,1);
  if(!fade)return;
  ctx.save();ctx.lineCap='round';
  for(let i=0;i<8;i++){
   const trigger=i*.95,progress=a-trigger;
   if(progress<0||progress>3)continue;
   const x=((i*151+95)%760)/760*w+progress*w*.09;
   const y=((i*67+87)%430)/430*h+progress*h*.16;
   const tail=60+i%3*22;
   ctx.strokeStyle=colorA(palette.star,fade*(1-progress/3)*.32);
   ctx.lineWidth=i%3===0?1.8:1.1;
   ctx.beginPath();ctx.moveTo(x-tail*.6,y-tail);ctx.lineTo(x,y);ctx.stroke();
  }
  ctx.restore();
 }
 draw(ctx,cam,time,fps=60,sector=0,reducedMotion=false){
  if(!this.enabled||!ctx||!cam)return;
  const width=cam.w,height=cam.h;
  if(!(width>0&&height>0))return;
  if(!this.tiles.length)this.tiles=layers.map(spec=>this._createTile(spec));
  const s=clamp(sector|0,0,PALETTES.length-1),palette=PALETTES[s];
  const low=fps<34,steady=!!reducedMotion;
  ctx.save();
  // CC0 cloud filaments are behind all moving stars and world objects.
  this._drawDetails(ctx,cam,time,fps,s,steady);
  this._stars(ctx,steady?{x:0,y:0}:cam,0,layers[0],width,height,.42);
  if(!low&&!steady){
   this._stars(ctx,cam,1,layers[1],width,height,.28);
   if(fps>49)this._stars(ctx,cam,2,layers[2],width,height,.16);
   if(this.hazeSector!==s){
    this.previousHaze=this.haze;
    this.haze=this._makeHaze(s);this.hazeSector=s;this.hazeChangedAt=time;
   }
   if(this.haze){
    const size=Math.max(width,height)*1.55;
    // Bounded, continuous drift keeps the cloud in view at remote world positions.
    // A single cached draw avoids a large tiled overdraw on mobile.
    const x=(width-size)*.5+Math.sin(cam.x*.00016)*width*.10+
     Math.sin(time*.017)*19;
    const y=(height-size)*.5+Math.sin(cam.y*.00014)*height*.10+
     Math.cos(time*.013)*15;
    const transition=clamp((time-this.hazeChangedAt)/2.4,0,1);
    if(this.previousHaze&&transition<1){
     ctx.globalAlpha=.61*(1-transition);
     ctx.drawImage(this.previousHaze,x,y,size,size);
    }
    ctx.globalAlpha=.61*(this.previousHaze?transition:1);
    ctx.drawImage(this.haze,x,y,size,size);
    if(transition>=1)this.previousHaze=null;
   }
   const eventTime=this.demo?42+Math.floor(time/17)*126+time%17:time;
   const event=cosmicEventAt(eventTime,s);
   if(event){
    ctx.globalAlpha=1;
    if(event.kind==='comet')this._comet(ctx,width,height,event,palette);
    else if(event.kind==='distant-burst')this._burst(ctx,width,height,event,palette);
    else this._smallMeteors(ctx,width,height,event,palette);
   }
  }
  ctx.restore();
 }
}
