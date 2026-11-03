import {EXPLOSION_ASSETS,EXPLOSION_TYPES,EXPLOSION_BUDGET} from './explosion-design.js?v=explosions-2';

// Read-only interactive rendering. This module is never imported by the game.
const W=960,H=450,TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const randgen=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const stellar=(()=>{const rand=randgen(28119);return Array.from({length:95},()=>({x:rand()*W,y:rand()*H,r:.4+rand()*1.4,a:.2+rand()*.5}));})();
const palettes={
 hot:{core:'#fff1c7',inner:'#ffb85e',fire:'#ff742b',dust:'#8895a0',light:'#ffd088',shard:'#8b9eae'},
 dust:{core:'#e4e6e1',inner:'#c1b8a7',fire:'#c0b4a2',dust:'#8b918e',light:'#cbd2c8',shard:'#9da6a6'},
 ion:{core:'#fbffff',inner:'#91eeff',fire:'#357cf4',dust:'#6074a8',light:'#7ddfff',shard:'#73c2ec'}
};

function image(url,onReady){
 const img=new Image();
 img.decoding='async';
 img.onload=()=>onReady(img);
 img.onerror=()=>onReady(null);
 img.src=url;
}
function makeTint(img,color){
 const canvas=document.createElement('canvas');canvas.width=img.naturalWidth||img.width;canvas.height=img.naturalHeight||img.height;
 const c=canvas.getContext('2d');c.drawImage(img,0,0);
 c.globalCompositeOperation='source-in';c.fillStyle=color;c.fillRect(0,0,canvas.width,canvas.height);
 return canvas;
}
function makeGlow(){
 const cv=document.createElement('canvas');cv.width=256;cv.height=256;
 const ctx=cv.getContext('2d');const g=ctx.createRadialGradient(128,128,0,128,128,128);
 g.addColorStop(0,'#ffffff');g.addColorStop(.16,'#fff8e4');g.addColorStop(.35,'#ffba5f88');g.addColorStop(.7,'#e46b2f14');g.addColorStop(1,'#00000000');
 ctx.fillStyle=g;ctx.fillRect(0,0,256,256);return cv;
}

/** One genuine ore tile, with only contiguous border-colored backing removed. */
function prepareRockTile(image){
 const width=Math.floor(image.naturalWidth/6),height=Math.floor(image.naturalHeight/5);
 if(width<8||height<8)return null;
 try{
  const cv=document.createElement('canvas');cv.width=width;cv.height=height;
  const ctx=cv.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,width,0,width,height,0,0,width,height);
  const raw=ctx.getImageData(0,0,width,height),pix=raw.data,back=[pix[0],pix[1],pix[2]];
  const visited=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;
  function visit(i){
   if(visited[i])return;
   const p=i*4;
   if(pix[p+3]<20||Math.abs(pix[p]-back[0])<32&&Math.abs(pix[p+1]-back[1])<32&&Math.abs(pix[p+2]-back[2])<32){
    visited[i]=1;queue[tail++]=i;
   }
  }
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=1;y<height-1;y++){visit(y*width);visit(y*width+width-1);}
  while(head<tail){
   const i=queue[head++],x=i%width,y=(i/width)|0;
   if(x>0)visit(i-1);if(x<width-1)visit(i+1);
   if(y>0)visit(i-width);if(y<height-1)visit(i+width);
  }
  let solid=0;
  for(let i=0;i<visited.length;i++){if(visited[i])pix[i*4+3]=0;else if(pix[i*4+3]>=96)solid++;}
  if(solid<width*height*.025)return null;
  ctx.putImageData(raw,0,0);return cv;
 }catch{return null;}
}
/** Three baked, irregular energy fronts. Their gradients are built only once. */
function makeBlastStamp(kind){
 const cv=document.createElement('canvas');cv.width=384;cv.height=384;
 const c=cv.getContext('2d'),r=randgen(11219+kind.length*947);
 const colors=kind==='dust'?['#f7eee0','#d6d2c5','#9a9b90']:kind==='ion'?['#ffffff','#85eaff','#3576f2']:['#fff9ce','#ffbe65','#fa5529'];
 c.save();c.translate(192,192);
 c.beginPath();
 for(let i=0;i<64;i++){
  const a=i*TAU/64,radius=(i%5===0?155:112)*(0.65+r()*.52);
  const x=Math.cos(a)*radius,y=Math.sin(a)*radius*.82;
  if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
 }
 c.closePath();c.clip();
 const g=c.createRadialGradient(-12,-8,8,0,0,170);
 g.addColorStop(0,colors[0]);g.addColorStop(.21,colors[1]);g.addColorStop(.53,colors[2]+'ed');g.addColorStop(1,colors[2]+'00');
 c.fillStyle=g;c.fillRect(-192,-192,384,384);
 c.restore();
 // Energy jets break the perfect circle, with hot centres and cold ragged margins.
 c.save();c.translate(192,192);c.globalCompositeOperation='screen';
 for(let j=0;j<14;j++){
  const a=r()*TAU,dist=36+r()*100,size=10+r()*28;
  const x=Math.cos(a)*dist,y=Math.sin(a)*dist*.79;
  const g=c.createRadialGradient(x,y,0,x,y,size);
  g.addColorStop(0,colors[1]+'cb');g.addColorStop(.5,colors[2]+'7a');g.addColorStop(1,colors[2]+'00');
  c.fillStyle=g;c.beginPath();c.arc(x,y,size,0,TAU);c.fill();
 }
 c.restore();return cv;
}

function sceneSeed(spec,index,mode){
 const r=randgen(3049+spec.id.length*2003+index*9169);
 const density=EXPLOSION_BUDGET.modes[mode].density;
 const particles={sparks:[],smoke:[],shards:[]};
 for(const kind of ['sparks','smoke','shards']){
  const count=Math.max(1,Math.round(spec.max[kind]*density));
  for(let i=0;i<count;i++){
   const a=TAU*r(),v=.45+r()*.95;
   particles[kind].push({a,r:r(),life:.65+r()*.7,delay:r()*.15,
    speed:(kind==='sparks'?135:kind==='shards'?68:25)*v,
    length:8+r()*21,size:5+r()*(kind==='smoke'?49:kind==='shards'?9:3),
    spin:r()*6.3,turn:r()*7-3.5,stretch:.5+r()*1.0});
  }
 }
 return particles;
}

export function initExplosionLab(){
 const root=document.getElementById('explosion-workbench');if(!root)return;
 const by=id=>document.getElementById(id);
 const large=by('explosion-canvas'),small=by('explosion-small');
 const ctx=large.getContext('2d',{alpha:false}),mini=small.getContext('2d',{alpha:false});
 const sprites={},tints={},glow=makeGlow(),blastStamps={hot:makeBlastStamp('hot'),dust:makeBlastStamp('dust'),ion:makeBlastStamp('ion')},reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let selected='fighter',quality='balanced',parallel=1,lightOn=true,paused=false,elapsed=0,last=performance.now(),lastDraw=0,frames=0,averageFps=0,frameBucket=0,mediaDirty=true;
 let particles=[],snap={particles:0,lights:0},assetReady=0,sceneBackdrop=null;
 const types=Object.values(EXPLOSION_TYPES);
 for(const [key,asset]of Object.entries(EXPLOSION_ASSETS)){
  image(asset.path,img=>{sprites[key]=key==='rock'&&img?prepareRockTile(img):img;
   if(sprites[key]&&['glow','fire','smoke','spark','star','scorch'].includes(key)){
    tints[key]={};
    const colors={fire:['#ffba71','#817967','#80abff'],smoke:['#85929d'],star:['#ffffff']};
    for(const color of colors[key]||[])tints[key][color]=makeTint(sprites[key],color);
   }
   if(key==='nebula')sceneBackdrop=null;
   assetReady++;mediaDirty=true;drawAll();
  });
 }
 function sprite(c,key,x,y,w,h,alpha=1,paint){
  if(alpha<=.008)return;
  const im=paint&&tints[key]?.[paint]||sprites[key];
  if(!im||!im.width)return;
  c.save();c.globalAlpha=clamp(alpha);
  c.drawImage(im,x-w/2,y-h/2,w,h);c.restore();
 }
 function disk(c,x,y,size,alpha,ion=false){
  if(alpha<.01)return;
  c.save();c.globalAlpha=clamp(alpha);c.globalCompositeOperation='screen';
  c.drawImage(glow,x-size/2,y-size/2,size,size);
  if(ion){c.globalCompositeOperation='source-over';c.fillStyle='#8fd6ff';c.globalAlpha=alpha*.13;c.beginPath();c.arc(x,y,size*.16,0,TAU);c.fill();}
  c.restore();
 }
 function noiseBackground(c){
  if(!sceneBackdrop){
   const backing=document.createElement('canvas');backing.width=W;backing.height=H;
   const p=backing.getContext('2d');p.fillStyle='#040d19';p.fillRect(0,0,W,H);
   if(sprites.nebula){p.save();p.globalAlpha=.22;p.drawImage(sprites.nebula,0,0,W,H);p.restore();}
   p.fillStyle='#fff';
   for(const star of stellar){p.globalAlpha=star.a;p.fillRect(star.x,star.y,star.r,star.r);}
   p.globalAlpha=1;p.strokeStyle='#2e506129';p.lineWidth=1;
   for(let y=75;y<H;y+=93){p.beginPath();p.moveTo(0,y);p.lineTo(W,y);p.stroke();}
   sceneBackdrop=backing;
  }
  c.drawImage(sceneBackdrop,0,0);
 }
 function objectDims(key){
  if(key==='capital')return [435,232];
  if(key==='rock')return [165,157];
  return [140,124];
 }
 function drawObject(c,key,x,y,w,h,flash=0,alpha=1){
  if(alpha<=0)return;
  c.save();c.globalAlpha=alpha;
  if(sprites[key]){
   c.drawImage(sprites[key],x-w/2,y-h/2,w,h);
   if(lightOn&&flash>.01){
    // The tinted image is masked by the sprite's own alpha, so only hull lights up.
    const im=sprites[key];
    if(!tints[key])tints[key]={};
    const color='#ffd088';
    if(!tints[key][color])tints[key][color]=makeTint(im,color);
    c.globalAlpha=clamp(flash*.64);
    c.globalCompositeOperation='screen';c.drawImage(tints[key][color],x-w/2,y-h/2,w,h);
    snap.lights++;
   }
  }else{
   // Only visible before an image loads or if the asset URL fails.
   c.fillStyle='#324c60';c.beginPath();c.moveTo(x-w*.52,y);c.lineTo(x,y-h*.48);c.lineTo(x+w*.5,y);c.lineTo(x,y+h*.45);c.closePath();c.fill();
  }
  c.restore();
 }
 function stageOf(spec,at){
  if(at<0)return -1;
  return spec.stages.reduce((index,item,i)=>at>=item.at?i:index,0);
 }
 function eventOrigin(spec,index){
  if(index===0)return {x:480,y:224};
  const pos=[[-225,-110],[242,108],[-260,135],[230,-115],[-58,150]];
  const [dx,dy]=pos[(index-1)%pos.length];return {x:480+dx,y:224+dy};
 }
 function nodeAt(spec,o,pulseIndex){
  if(spec.id==='capital'){
   const pos=[[-12,-15],[-126,20],[120,-16],[42,53]];
   const p=pos[pulseIndex%pos.length];return{x:o.x+p[0],y:o.y+p[1]};
  }
  if(spec.id==='rocket')return{x:o.x+43,y:o.y-17};
  return o;
 }
 function activeFlash(spec,t){
  let weight=0;
  for(let i=0;i<spec.pulseTimes.length;i++){
   const age=t-spec.pulseTimes[i];
   if(age<0)continue;
   weight=Math.max(weight,Math.pow(Math.max(0,1-age/.25),1.45)*(i===0?1:.55));
  }
  return weight;
 }
 function sceneObjects(c,spec,t){
  const bright=lightOn?activeFlash(spec,t):0;
  // Neighboring craft and rocks provide a measurable reference for the light response.
  const source=eventOrigin(spec,0);
  const neighboring=[{key:'fighter',x:253,y:116,w:89,h:77},{key:'rock',x:735,y:329,w:106,h:95}];
  for(const n of neighboring){
   const d=Math.hypot(n.x-source.x,n.y-source.y),r=spec.id==='capital'?420:spec.id==='orbital'?420:300;
   const index=neighboring.indexOf(n);
   const f=index<EXPLOSION_BUDGET.modes[quality].lightTargets?bright*clamp(1-d/r)*.86:0;
   drawObject(c,n.key,n.x,n.y,n.w,n.h,f);
  }
  if(spec.object==='none')return;
  const [w,h]=objectDims(spec.object);
  let alpha=1;
  if(spec.id==='fighter')alpha=1-smooth((t-.33)/.45)*.94;
  if(spec.id==='capital')alpha=1-smooth((t-.48)/.49)*.90;
  if(spec.id==='asteroid')alpha=1-smooth((t-.23)/.35)*.93;
  drawObject(c,spec.object,source.x,source.y,w,h,bright,alpha);
 }
 function warning(c,spec,t,o){
  if(spec.id!=='orbital')return;
  if(t>.34)return;
  const strength=t<.29?1:clamp(1-(t-.29)/.05);
  c.save();c.globalAlpha=strength;
  c.strokeStyle='#ffbc73';c.setLineDash([12,7]);c.lineWidth=2;
  c.beginPath();c.ellipse(o.x,o.y,106,65,0,0,TAU);c.stroke();c.setLineDash([]);
  c.strokeStyle='#ffd7a366';c.beginPath();c.ellipse(o.x,o.y,115,71,0,0,TAU);c.stroke();
  c.fillStyle='#ffe2ba';c.font='700 15px system-ui';c.textAlign='center';
  c.fillText('ЗОНА ОРБИТАЛЬНОГО УДАРА',o.x,o.y-87);
  c.restore();
 }
 function smokeLayer(c,spec,t,o,ps,palette,mode){
  const smokeEnabled=EXPLOSION_BUDGET.modes[mode].smokeFactor;
  if(!smokeEnabled)return;
  const count=Math.round(ps.smoke.length*smokeEnabled);
  for(let i=0;i<count;i++){
   const p=ps.smoke[i],pulse=i%spec.pulseTimes.length;
   const node=nodeAt(spec,o,pulse),age=(t-spec.pulseTimes[pulse]-.07)*spec.duration-p.delay*.4;
   if(age<=0||age>p.life)continue;
   const k=age/p.life,dist=p.speed*age;
   const x=node.x+Math.cos(p.a)*dist,y=node.y+Math.sin(p.a)*dist-age*7;
   const size=(p.size+16+30*k)*spec.scale;
   sprite(c,'smoke',x,y,size*1.15,size*.87,(1-smooth(k))*.44*(spec.palette==='dust'?1.16:1),'#85929d');
   snap.particles++;
  }
 }
 function shockwave(c,spec,t,o){
  if(spec.id==='asteroid')return;
  const start=spec.pulseTimes[0]+.04,d=(t-start)/.43;
  if(d<0||d>=1)return;
  const r=(19+d*(spec.id==='capital'?135:spec.id==='orbital'?160:72))*spec.scale;
  c.save();c.lineWidth=spec.id==='orbital'?2.2:1.4;c.globalAlpha=(1-smooth(d))*.34;
  c.strokeStyle=spec.palette==='ion'?'#a7ebff':'#ffd58c';
  for(let i=0;i<3;i++){
   c.beginPath();c.arc(o.x,o.y,r,i*TAU/3+.13,i*TAU/3+1.35);c.stroke();
  }
  c.restore();
 }
 function coreLayer(c,spec,t,o,pal){
  for(let i=0;i<spec.pulseTimes.length;i++){
   const pulse=spec.pulseTimes[i],age=t-pulse;
   if(age<0||age>.42)continue;
   const q=age/.42,point=nodeAt(spec,o,i),impact=1-smooth(q);
   const radius=(spec.id==='capital'?205:spec.id==='orbital'?240:145)*spec.scale*(.35+.85*smooth(age/.18));
   disk(c,point.x,point.y,radius,impact*(i===0?.51:.31),spec.palette==='ion');
   const burstSize=(spec.id==='capital'?150:spec.id==='orbital'?188:spec.id==='asteroid'?112:122)*spec.scale*(.52+.64*smooth(age/.16));
   c.save();c.globalCompositeOperation='screen';c.globalAlpha=impact*(spec.id==='asteroid'?.49:.84);
   c.drawImage(blastStamps[spec.palette],point.x-burstSize/2,point.y-burstSize/2,burstSize,burstSize);
   c.restore();
   c.save();c.globalCompositeOperation='screen';
   sprite(c,'fire',point.x+Math.cos(.55+i*2.3)*radius*.1,point.y+Math.sin(.55+i*2.3)*radius*.1,
    radius*.56,radius*.36,impact*.52,spec.palette==='dust'?'#817967':spec.palette==='ion'?'#80abff':'#ffba71');
   sprite(c,'star',point.x,point.y,radius*.32,radius*.27,impact*.89,'#ffffff');
   c.restore();
   if(age<.10){c.save();c.globalAlpha=clamp((.1-age)/.1)*.65;c.fillStyle=pal.core;c.beginPath();c.ellipse(point.x,point.y,9*spec.scale,5*spec.scale,-.3,0,TAU);c.fill();c.restore();}
  }
  if(spec.id==='orbital'&&t>.28&&t<.48){
   const a=1-smooth((t-.28)/.2);
   c.save();c.globalAlpha=a*.68;c.strokeStyle='#a8e5ff';c.lineWidth=8;
   c.beginPath();c.moveTo(o.x-15,-15);c.bezierCurveTo(o.x+34,73,o.x-20,135,o.x,o.y);c.stroke();
   c.strokeStyle='#f4ffff';c.lineWidth=2.1;c.stroke();c.restore();
  }
 }
 function shards(c,spec,t,o,ps,pal){
  for(const [index,p] of ps.shards.entries()){
   const pulse=index%spec.pulseTimes.length,node=nodeAt(spec,o,pulse);
   const age=(t-spec.pulseTimes[pulse]-.04)*spec.duration-p.delay*.6;
   if(age<=0||age>=p.life)continue;
   const k=age/p.life;let angle=p.a;
   if(spec.id==='rocket')angle=-.18+(p.a%TAU-TAU/2)*.3;
   const dist=p.speed*age*spec.scale,px=node.x+Math.cos(angle)*dist,py=node.y+Math.sin(angle)*dist;
   const size=(spec.id==='capital'?p.size*2.1:p.size*1.2)*(.9-.25*k);
   c.save();c.translate(px,py);c.rotate(p.spin+p.turn*k);c.globalAlpha=clamp((1-k)*.82);
   c.fillStyle=spec.palette==='dust'?'#9a9f9a':'#8797a3';
   c.beginPath();c.moveTo(-size,-size*.25);c.lineTo(size*.48,-size*.56);
   c.lineTo(size*.75,size*.3);c.lineTo(-size*.32,size*.63);c.closePath();c.fill();
   c.strokeStyle=pal.inner;c.globalAlpha*=.75;c.lineWidth=.7;c.stroke();c.restore();
   snap.particles++;
  }
 }
 function sparks(c,spec,t,o,ps,pal){
  for(const [index,p] of ps.sparks.entries()){
   const pulse=index%spec.pulseTimes.length,node=nodeAt(spec,o,pulse);
   const age=(t-spec.pulseTimes[pulse])*spec.duration-p.delay*.45;
   if(age<0||age>=p.life)continue;
   const k=age/p.life;
   const angle=spec.id==='rocket'?-.30+(p.a-TAU/2)*.3:p.a;
   const dist=p.speed*age*spec.scale;
   const x=node.x+Math.cos(angle)*dist,y=node.y+Math.sin(angle)*dist;
   const length=p.length*(1-k)*(spec.id==='capital'?1.45:1);
   c.save();c.lineCap='round';
   c.globalAlpha=(1-smooth(k))*.95;
   c.strokeStyle=spec.palette==='dust'?'#dae0da':spec.palette==='ion'?'#b2eaff':'#ffce74';
   c.lineWidth=p.size*.26;
   c.beginPath();c.moveTo(x-Math.cos(angle)*length,y-Math.sin(angle)*length);c.lineTo(x,y);c.stroke();
   if(k<.26){c.fillStyle=pal.core;c.beginPath();c.arc(x,y,1.5,0,TAU);c.fill();}
   c.restore();snap.particles++;
  }
 }
 function eventLayers(c,spec,t,origin,particleSet,mode,layer){
  const pal=palettes[spec.palette];if(t<0)return;
  if(layer===0)smokeLayer(c,spec,t,origin,particleSet,pal,mode);
  if(layer===1){shockwave(c,spec,t,origin);coreLayer(c,spec,t,origin,pal);}
  if(layer===2){shards(c,spec,t,origin,particleSet,pal);sparks(c,spec,t,origin,particleSet,pal);}
 }
 function drawOne(c,realSeconds){
  const spec=EXPLOSION_TYPES[selected],full=spec.duration,normalized=clamp(realSeconds/full);
  const base=eventOrigin(spec,0);
  noiseBackground(c);
  const count=parallel;
  const active=[];
  for(let i=0;i<count;i++){
   const shift=i?Math.min(.16,full*.10)*i:0;
   const sec=realSeconds-shift;
   const time=sec/full;
   if(sec>=0&&time<1.06)active.push({origin:eventOrigin(spec,i),t:time,ps:particles[i]});
  }
  // Draw all background smoke, then ship hulls, then energy cores and sparks.
  for(const e of active)eventLayers(c,spec,e.t,e.origin,e.ps,quality,0);
  sceneObjects(c,spec,normalized);
  for(const e of active)warning(c,spec,e.t,e.origin);
  for(const e of active)eventLayers(c,spec,e.t,e.origin,e.ps,quality,1);
  for(const e of active)eventLayers(c,spec,e.t,e.origin,e.ps,quality,2);
  // Lightweight scale guide; neither label nor faint guide is gameplay HUD.
  c.fillStyle='#bfd4e2';c.font='12px system-ui';c.textAlign='left';
  c.fillText('КОНЦЕПТ · ПОКАДРОВЫЙ ЭСКИЗ',19,29);
  c.fillStyle='#83b5c6';c.fillText('Свет и обломки — испытательные',19,H-18);
 }
 function renderCanvas(context,canvas,t){
  context.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  context.clearRect(0,0,W,H);drawOne(context,t);
  context.setTransform(1,0,0,1,0,0);
 }
 function drawAll(){
  if(!ctx||!mini)return;
  snap={particles:0,lights:0};
  const spec=EXPLOSION_TYPES[selected],time=elapsed;
  renderCanvas(ctx,large,time);
  // The small image is rendered with the same deterministic trajectories and textures.
  const drawn=snap.particles,lights=snap.lights;snap={particles:0,lights:0};
  renderCanvas(mini,small,time);snap={particles:drawn,lights};
  by('explosion-counter').textContent='Элементов в большом кадре: '+drawn+' · откликов света: '+lights+' · текстуры: '+assetReady+'/'+Object.keys(EXPLOSION_ASSETS).length;
  by('explosion-time-label').textContent=(elapsed).toFixed(2)+' / '+spec.duration.toFixed(2)+' с';
  by('explosion-scrub').value=String(Math.round(clamp(elapsed/spec.duration)*1000));
  const progress=clamp(elapsed/spec.duration),stage=stageOf(spec,progress);
  root.querySelectorAll('.explosion-stage').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===stage)));
  if(frames>0)by('explosion-fps').textContent='Стенд: '+Math.round(averageFps)+' кадр/с (не FPS игры)';
 }
 function change(type){
  selected=type;elapsed=0;paused=false;by('explosion-toggle').textContent='Пауза';
  particles=Array.from({length:EXPLOSION_BUDGET.simulatedEvents},(_,i)=>sceneSeed(EXPLOSION_TYPES[selected],i,quality));
  root.querySelectorAll('[data-explosion-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.explosionType===type)));
  const spec=EXPLOSION_TYPES[type];
  by('explosion-subtitle').textContent=spec.subtitle+' · '+spec.material;
  by('explosion-trigger').textContent=spec.trigger;
  by('explosion-truth').textContent=spec.truth;
  by('explosion-warning').textContent=spec.warning;
  by('explosion-check').textContent=spec.check;
  by('explosion-timeline').replaceChildren();
  for(const [i,step]of spec.stages.entries()){
   const b=document.createElement('button');b.type='button';b.className='explosion-stage';
   b.innerHTML='<b>0'+(i+1)+' · '+step.label+'</b><span></span>';
   b.querySelector('span').textContent=step.note;
   b.addEventListener('click',()=>{elapsed=step.at*spec.duration;paused=true;by('explosion-toggle').textContent='Продолжить';drawAll();});
   by('explosion-timeline').append(b);
  }
  drawAll();
 }
 for(const item of types){
  const b=document.createElement('button');b.type='button';b.dataset.explosionType=item.id;b.textContent=item.name;
  b.addEventListener('click',()=>change(item.id));by('explosion-types').append(b);
 }
 by('explosion-quality').addEventListener('change',e=>{quality=e.target.value;change(selected);});
 by('explosion-parallel').addEventListener('change',e=>{parallel=Number(e.target.value);drawAll();});
 by('explosion-light').addEventListener('change',e=>{lightOn=e.target.checked;drawAll();});
 by('explosion-scrub').addEventListener('input',e=>{elapsed=EXPLOSION_TYPES[selected].duration*Number(e.target.value)/1000;paused=true;by('explosion-toggle').textContent='Продолжить';drawAll();});
 by('explosion-toggle').addEventListener('click',()=>{paused=!paused;by('explosion-toggle').textContent=paused?'Продолжить':'Пауза';});
 by('explosion-replay').addEventListener('click',()=>{elapsed=0;paused=false;by('explosion-toggle').textContent='Пауза';drawAll();});
 const list=by('explosion-assets');
 for(const [key,asset]of Object.entries(EXPLOSION_ASSETS)){
  const li=document.createElement('li');const a=document.createElement('a');a.href=asset.path;a.target='_blank';a.rel='noopener';a.textContent=asset.path.split('/').pop();
  const note=document.createElement('span');note.textContent=asset.role+' · '+asset.license;
  li.append(a,note);list.append(li);
 }
 by('explosion-budget').replaceChildren();
 for(const rule of EXPLOSION_BUDGET.priority){
  const item=document.createElement('div');item.className='explosion-budget-row';
  const p=document.createElement('strong');p.textContent=rule.id+' · '+rule.label;
  const q=document.createElement('span');q.textContent=rule.items;item.append(p,q);by('explosion-budget').append(item);
 }
 change(selected);
 function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden||root.closest('.tab-panel')?.hidden){last=now;return;}
  if(now-lastDraw<1000/EXPLOSION_BUDGET.prototypeFps&&!mediaDirty)return;
  const dt=Math.min(.12,(now-last)/1000);last=now;
  lastDraw=now;mediaDirty=false;
  if(!paused&&!reduced.matches){elapsed+=dt;if(elapsed>EXPLOSION_TYPES[selected].duration)elapsed=0;}
  // FPS of this workshop only; cannot be used to claim in-game performance.
  frameBucket+=dt;frames++;
  if(frameBucket>=.9){averageFps=frames/frameBucket;frames=0;frameBucket=0;}
  drawAll();
 }
 reduced.addEventListener?.('change',()=>{paused=reduced.matches;by('explosion-toggle').textContent=paused?'Продолжить':'Пауза';drawAll();});
 requestAnimationFrame(frame);
}
