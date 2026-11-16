// Decorative, world-anchored background compositions. No hitboxes or game RNG.
const PI2=Math.PI*2,N=512,clip=(v,a,b)=>Math.max(a,Math.min(b,v));
const ellipse=(c,x,y,rx,ry,r=0,a=0,b=PI2)=>{c.beginPath();c.ellipse(x,y,rx,ry,r,a,b);};
const rad=(c,x,y,r,colors)=>{const g=c.createRadialGradient(x,y,0,x,y,r);
 for(const [t,col] of colors)g.addColorStop(t,col);return g;};
const aura=(c,x,y,r,rgba)=>{c.fillStyle=rad(c,x,y,r,[[0,rgba],[1,'rgba(0,0,0,0)']]);
 c.fillRect(x-r,y-r,2*r,2*r);};
export const CINEMATIC_LANDMARKS=Object.freeze([
 {id:'amethyst-ring',kind:'ring',x:-6500,y:-4600,factor:.085,size:650,alpha:.55},
 {id:'azure-ice-giant',kind:'planet',x:9700,y:36600,factor:.085,size:670,alpha:.77},
 {id:'amber-star-belt',kind:'belt',x:38700,y:3500,factor:.075,size:690,alpha:.63},
 {id:'lilac-broken-moon',kind:'moon',x:10200,y:-43100,factor:.085,size:620,alpha:.59},
 {id:'teal-veil',kind:'veil',x:-46900,y:3500,factor:.070,size:760,alpha:.42}
].map(o=>Object.freeze(o)));
export function landmarkPosition(spec,cam){
 return {x:cam.w/2+(spec.x-cam.x-cam.w/2)*spec.factor,
  y:cam.h/2+(spec.y-cam.y-cam.h/2)*spec.factor};
}
export function landmarkVisible(spec,cam,size){
 const p=landmarkPosition(spec,cam),m=size*.52;
 return p.x>=-m&&p.y>=-m&&p.x<=cam.w+m&&p.y<=cam.h+m;
}
function ring(c){
 aura(c,257,252,237,'rgba(143,91,209,.13)');
 c.save();c.translate(256,252);c.rotate(-.4);
 c.fillStyle='rgba(5,7,22,.41)';ellipse(c,0,0,201,71);c.fill();
 for(let i=0;i<18;i++){
  if(i===3||i===9||i===14)continue;
  c.strokeStyle=i%3===0?'rgba(118,160,204,.30)':'rgba(188,161,238,.53)';
  c.lineWidth=i%3===0?10:5;
  ellipse(c,0,0,208,77,0,i*PI2/18+.05,(i+1)*PI2/18-.06);c.stroke();
 }
 for(let i=0;i<28;i++){
  if(i%8===0)continue;
  const a=i*PI2/28,cs=Math.cos(a),sn=Math.sin(a);
  c.strokeStyle='rgba(152,179,221,.32)';c.lineWidth=i%4===0?4:2;
  c.beginPath();c.moveTo(191*cs,69*sn);c.lineTo(222*cs,83*sn);c.stroke();
  if(i%4===1){c.fillStyle='rgba(176,232,252,.46)';
   ellipse(c,208*cs,77*sn,2.7,1.3);c.fill();}
 }
 c.restore();
}
function planet(c,image){
 aura(c,256,250,235,'rgba(75,175,237,.20)');
 c.save();c.translate(256,256);c.rotate(-.27);
 for(let i=0;i<3;i++){
  c.strokeStyle=['rgba(181,239,254,.43)','rgba(109,202,244,.26)',
   'rgba(122,194,248,.12)'][i];c.lineWidth=[10,18,24][i];
  ellipse(c,0,0,206+i*13,64+i*7);c.stroke();
 }
 c.restore();
 c.save();c.beginPath();c.arc(256,256,137,0,PI2);c.clip();
 if(image?.naturalWidth)c.drawImage(image,115,115,282,282);
 else{
  c.fillStyle=rad(c,194,183,278,[[0,'#bde2e9'],[.40,'#558bb5'],
   [.68,'#1e4674'],[1,'#051729']]);c.fillRect(110,110,292,292);
  for(let k=0;k<7;k++){
   c.strokeStyle='rgba(226,245,254,.08)';c.lineWidth=8+k%3*3;
   c.beginPath();c.moveTo(111,169+k*18);
   c.bezierCurveTo(188,147+k*19,321,221+k*13,401,178+k*17);c.stroke();
  }
 }
 c.fillStyle=rad(c,174,174,300,[[0,'rgba(2,9,23,0)'],
  [.47,'rgba(4,16,37,.10)'],[1,'rgba(2,8,24,.81)']]);
 c.fillRect(108,108,296,296);c.restore();
 c.save();c.translate(256,256);c.rotate(-.27);
 c.strokeStyle='rgba(200,246,255,.59)';c.lineWidth=8;
 ellipse(c,0,0,209,65,0,.04,Math.PI-.04);c.stroke();
 c.strokeStyle='rgba(104,195,237,.27)';c.lineWidth=21;
 ellipse(c,0,0,223,74,0,.09,Math.PI-.09);c.stroke();
 c.restore();
}
function belt(c){
 aura(c,260,244,240,'rgba(235,143,72,.17)');
 c.save();c.translate(260,256);c.rotate(-.32);
 c.strokeStyle='rgba(245,183,114,.21)';c.lineWidth=43;
 ellipse(c,0,0,223,79);c.stroke();
 c.strokeStyle='rgba(255,215,160,.19)';c.lineWidth=10;
 ellipse(c,0,0,235,87);c.stroke();
 let seed=48123;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<62;i++){
  const a=i*PI2/62+(next()-.5)*.15,d=195+next()*62,s=1+next()*4;
  const x=Math.cos(a)*d,y=Math.sin(a)*(65+next()*32);
  c.save();c.translate(x,y);c.rotate(a*.7);
  c.fillStyle='rgba(245,185,144,'+(.12+next()*.25)+')';
  c.beginPath();c.moveTo(-s,-s*.4);c.lineTo(s*.8,-s);
  c.lineTo(s,s*.7);c.lineTo(-s*.5,s);c.closePath();c.fill();c.restore();
 }
 c.restore();
 aura(c,188,206,123,'rgba(255,206,123,.33)');
 c.fillStyle=rad(c,188,206,34,[[0,'rgba(255,251,221,.9)'],
  [.35,'rgba(255,235,170,.68)'],[1,'rgba(255,188,110,0)']]);
 c.fillRect(154,172,68,68);
}
function moon(c){
 aura(c,251,253,223,'rgba(160,96,202,.17)');
 c.fillStyle=rad(c,187,176,258,[[0,'#c2b1d3'],[.38,'#796e99'],
  [.64,'#332c58'],[.92,'#0e0b28'],[1,'rgba(0,0,0,0)']]);
 c.beginPath();c.arc(250,255,143,0,PI2);c.fill();
 c.lineCap='round';c.strokeStyle='rgba(3,4,17,.86)';c.lineWidth=19;
 c.beginPath();c.moveTo(210,119);c.lineTo(235,180);c.lineTo(204,236);
 c.lineTo(268,280);c.lineTo(282,343);c.lineTo(321,392);c.stroke();
 c.strokeStyle='rgba(213,176,249,.33)';c.lineWidth=3.4;
 c.beginPath();c.moveTo(198,117);c.lineTo(222,180);c.lineTo(191,238);
 c.lineTo(254,281);c.lineTo(269,343);c.lineTo(310,389);c.stroke();
 for(let i=0;i<9;i++){
  const a=i*2.399,r=170+i%3*14,s=7+i%3*7;
  c.save();c.translate(250+Math.cos(a)*r,255+Math.sin(a)*r);c.rotate(a*.5);
  c.fillStyle='rgba(164,139,187,.54)';c.strokeStyle='rgba(216,181,248,.23)';
  c.lineWidth=1.3;c.beginPath();c.moveTo(-s,-s*.3);c.lineTo(s*.8,-s);
  c.lineTo(s,s*.7);c.lineTo(-s*.4,s);c.closePath();c.fill();c.stroke();c.restore();
 }
}
function veil(c){
 // Low-information composition intentionally leaves this region almost empty.
 aura(c,250,246,244,'rgba(58,160,161,.08)');
 c.save();c.translate(247,256);c.rotate(.43);
 c.fillStyle='rgba(3,17,26,.36)';ellipse(c,0,0,189,110);c.fill();
 for(let k=0;k<5;k++){
  c.strokeStyle='rgba(136,238,217,'+(.27-k*.04)+')';c.lineWidth=k===0?3:1.7;
  ellipse(c,0,0,174+k*8,101+k*5,0,.18+k*.15,PI2-.47-k*.14);c.stroke();
 }
 c.strokeStyle='rgba(129,228,217,.14)';c.lineWidth=6;
 ellipse(c,0,0,211,126,0,Math.PI*.5,Math.PI*1.48);c.stroke();
 for(let k=0;k<13;k++){
  const y=-87+k*14;c.strokeStyle='rgba(146,242,219,.07)';c.lineWidth=.8;
  c.beginPath();c.moveTo(-179,y);c.bezierCurveTo(-64,y-22,65,y+22,177,y-4);c.stroke();
 }
 c.restore();
}
export class CinematicScenery {
 constructor({enabled=true}={}){this.enabled=!!enabled;this.cache=new Map();
  this.planetImage=null;this.planetRequested=false;}
 _requestPlanet(){
  if(this.planetRequested||typeof Image==='undefined')return;
  this.planetRequested=true;
  try{
   const im=new Image();im.decoding='async';
   im.onload=()=>{if(im.naturalWidth){this.planetImage=im;this.cache.delete('planet');}};
   im.onerror=()=>{};
   im.src=new URL('../assets/space/planet_ice_v1.png',import.meta.url).href;
  }catch{}
 }
 _tile(type){
  if(this.cache.has(type))return this.cache.get(type);
  if(typeof document==='undefined'||typeof document.createElement!=='function')return null;
  const tile=document.createElement('canvas');tile.width=tile.height=N;
  const c=tile.getContext?.('2d');if(!c)return null;
  if(type==='ring')ring(c);
  else if(type==='planet'){this._requestPlanet();planet(c,this.planetImage);}
  else if(type==='belt')belt(c);
  else if(type==='moon')moon(c);
  else if(type==='veil')veil(c);
  this.cache.set(type,tile);return tile;
 }
 draw(ctx,cam,time=0,fps=60,reducedMotion=false){
  if(!this.enabled||!ctx||!cam||fps<30||!(cam.w>0&&cam.h>0))return;
  const scale=clip(Math.min(cam.w,cam.h)/650,.60,1);
  for(const item of CINEMATIC_LANDMARKS){
   const size=item.size*scale;if(!landmarkVisible(item,cam,size))continue;
   const p=landmarkPosition(item,cam),tile=this._tile(item.kind);if(!tile)continue;
   ctx.save();ctx.globalAlpha=item.alpha*(fps<42?.72:1);
   ctx.drawImage(tile,p.x-size/2,p.y-size/2,size,size);ctx.restore();
  }
 }
}
