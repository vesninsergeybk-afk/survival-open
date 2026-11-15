const TAU=Math.PI*2;
const TILE=768;
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
 const kind=['comet','distant-burst','micro-meteors'][(index+Math.max(0,sector))%3];
 return {kind,index,age,duration:13};
}
export class CosmicAmbience {
 constructor({enabled=true,demo=false}={}){
  this.enabled=!!enabled;this.demo=!!demo;
  this.tiles=[];this.haze=null;this.hazeSector=-1;
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
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
  const c=canvas.getContext?.('2d');if(!c)return null;
  const color=PALETTES[sector]?.haze||PALETTES[0].haze;
  const random=rand32(9107+sector*7129);
  for(let i=0;i<14;i++){
   const x=85+random()*475,y=80+random()*475;
   const radius=105+random()*135;
   c.save();c.translate(x,y);c.rotate(-.8+random()*1.6);
   c.scale(1.15+random()*.65,.32+random()*.45);
   const g=c.createRadialGradient(0,0,0,0,0,radius);
   g.addColorStop(0,colorA(color,.085+random()*.035));
   g.addColorStop(.4,colorA(color,.028));g.addColorStop(1,colorA(color,0));
   c.fillStyle=g;c.fillRect(-radius,-radius,radius*2,radius*2);
   c.restore();
  }
  return canvas;
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
  this._stars(ctx,steady?{x:0,y:0}:cam,0,layers[0],width,height,.42);
  if(!low&&!steady){
   this._stars(ctx,cam,1,layers[1],width,height,.28);
   if(fps>49)this._stars(ctx,cam,2,layers[2],width,height,.16);
   if(this.hazeSector!==s){this.haze=this._makeHaze(s);this.hazeSector=s;}
   if(this.haze){
    const size=Math.max(width,height)*1.3;
    const x=width*.48-size*.5-cam.x*.007+Math.sin(time*.017)*18;
    const y=height*.56-size*.5-cam.y*.006+Math.cos(time*.015)*12;
    ctx.globalAlpha=.42;
    ctx.drawImage(this.haze,x,y,size,size);
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
