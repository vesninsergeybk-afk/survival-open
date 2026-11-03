/**
 * Experimental visual-only capital-ship wear for the QA gallery.
 *
 * The original image remains untouched. A stage is baked once into a separate
 * canvas; source-atop confines dark marks to existing opaque ship pixels.
 * No damage roll, collision radius or gameplay state is changed.
 */
const LAYOUT=Object.freeze({
 cruiser:Object.freeze([[165,449,-.25],[345,295,.32],[253,594,-.08]]),
 carrier:Object.freeze([[165,295,-.1],[343,427,.14],[255,570,.04]]),
 dreadnought:Object.freeze([[150,390,.15],[362,417,-.35],[262,221,.06]])
});
export const CAPITAL_WEAR_ANCHORS=LAYOUT;

export function capitalWearStage(hp,maxHp){
 if(!Number.isFinite(hp)||!Number.isFinite(maxHp)||maxHp<=0||hp<=0)return 0;
 const ratio=Math.max(0,Math.min(1,hp/maxHp));
 return ratio<.22?3:ratio<.43?2:ratio<.68?1:0;
}
const rough=(i,seed)=>.86+.17*Math.sin(i*2.39+seed*4.41)+.08*Math.cos(i*5.28+seed*1.31);
function ragged(ctx,rx,ry,seed){
 ctx.beginPath();
 const total=20;
 for(let i=0;i<=total;i++){
  const a=i*2*Math.PI/total,r=rough(i,seed);
  const x=Math.cos(a)*rx*r,y=Math.sin(a)*ry*r;
  if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }
 ctx.closePath();
}
function scorchSoft(ctx,x,y,angle,seed,critical){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 // Broad muted heat discoloration around a charred impact, never pure red ink.
 ctx.globalAlpha=critical?.44:.30;ctx.fillStyle='#745449';
 ragged(ctx,47,35,seed+2);ctx.fill();
 ctx.globalAlpha=critical?.73:.64;ctx.fillStyle='#101820';
 ragged(ctx,34,26,seed+4);ctx.fill();
 ctx.globalAlpha=.50;ctx.fillStyle='#060b10';
 ragged(ctx,20,16,seed+7);ctx.fill();
 // Small broken seams read as fractured metal at the actual game scale.
 ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=4.2;
 ctx.strokeStyle='#100e0d';ctx.globalAlpha=.75;
 ctx.beginPath();ctx.moveTo(-30,-13);ctx.lineTo(-10,-4);
 ctx.lineTo(8,5);ctx.lineTo(27,19);ctx.stroke();
 ctx.lineWidth=2.4;ctx.strokeStyle=critical?'#ffb15b':'#ca8653';
 ctx.globalAlpha=critical?.70:.42;
 ctx.beginPath();ctx.moveTo(-17,-7);ctx.lineTo(-2,0);ctx.lineTo(15,8);ctx.stroke();
 if(critical){
  ctx.fillStyle='#ffbe71';ctx.globalAlpha=.53;
  ctx.beginPath();ctx.arc(5,4,5,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}

/**
 * At 60-ish on-screen pixels, minute dark soot is nearly invisible.
 * The higher-contrast treatment adds a short torn-metal rim and a hot
 * fracture bounded by the hull alpha. It remains deterministic and static.
 */
function scorchContrast(ctx,x,y,angle,seed,critical){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 const heat=critical?1:.84;
 ctx.globalAlpha=.58*heat;ctx.fillStyle='#9b694c';
 ragged(ctx,62,46,seed+2);ctx.fill();
 ctx.globalAlpha=.88;ctx.fillStyle='#20232a';
 ragged(ctx,50,37,seed+4);ctx.fill();
 ctx.globalAlpha=.91;ctx.fillStyle='#090f17';
 ragged(ctx,31,23,seed+7);ctx.fill();
 // Broken outer rim: pale exposed metal contrasts with dark armor.
 ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=9;
 ctx.globalAlpha=.82;ctx.strokeStyle='#d1b5a1';
 ctx.beginPath();
 ctx.moveTo(-51,-9);ctx.lineTo(-38,-27);ctx.lineTo(-17,-33);
 ctx.moveTo(19,32);ctx.lineTo(42,19);ctx.lineTo(51,4);
 ctx.stroke();
 ctx.lineWidth=6;ctx.globalAlpha=.70;ctx.strokeStyle='#49392f';
 ctx.beginPath();ctx.moveTo(-47,14);ctx.lineTo(-35,30);
 ctx.moveTo(31,-29);ctx.lineTo(49,-19);ctx.stroke();
 // Split seam: a black irregular opening with a thin molten edge.
 ctx.beginPath();ctx.moveTo(-36,-18);ctx.lineTo(-13,-7);
 ctx.lineTo(2,-4);ctx.lineTo(21,12);ctx.lineTo(36,22);
 ctx.globalAlpha=1;ctx.lineWidth=13;ctx.strokeStyle='#050b10';ctx.stroke();
 ctx.globalAlpha=critical?1:.89;ctx.lineWidth=6.5;
 ctx.strokeStyle=critical?'#ffb04c':'#e8954a';ctx.stroke();
 ctx.globalAlpha=critical?.96:.72;ctx.lineWidth=2.2;
 ctx.strokeStyle='#fff0bc';ctx.stroke();
 // Short branching fractures, not long diagonals across the entire ship.
 ctx.globalAlpha=.85;ctx.lineWidth=7;ctx.strokeStyle='#111820';
 ctx.beginPath();ctx.moveTo(-13,-7);ctx.lineTo(-18,13);ctx.lineTo(-26,23);
 ctx.moveTo(21,12);ctx.lineTo(30,-3);ctx.stroke();
 ctx.lineWidth=3.4;ctx.strokeStyle='#ca8347';
 ctx.globalAlpha=critical?.93:.69;ctx.stroke();
 if(critical){
  ctx.globalAlpha=.78;ctx.fillStyle='#ffde95';
  ctx.beginPath();ctx.arc(2,-4,7,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.43;ctx.fillStyle='#ed7233';
  ctx.beginPath();ctx.arc(2,-4,13,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}

/**
 * Third preview: a dark impact crater with exposed metal flecks.
 * Its animated vent is drawn separately so soot remains legible without
 * bright ribbon-like fractures painted across the ship.
 */
function scorchBreach(ctx,x,y,angle,seed,critical){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.beginPath();ragged(ctx,70,51,seed+2);ctx.clip();
 const g=ctx.createRadialGradient(-9,-5,5,0,0,68);
 g.addColorStop(0,'rgba(5,10,15,0.98)');
 g.addColorStop(.42,'rgba(18,24,31,0.92)');
 g.addColorStop(.68,'rgba(71,63,58,0.68)');
 g.addColorStop(1,'rgba(125,120,111,0.03)');
 ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(-75,-60,150,120);
 ctx.globalAlpha=.80;ctx.fillStyle='#060b11';
 ragged(ctx,31,22,seed+5);ctx.fill();
 // Scraped, cool-grey armour at the perimeter, deliberately irregular.
 for(let i=0;i<9;i++){
  const theta=(i+.22*Math.sin(seed+i*5.1))*Math.PI*2/9;
  const rx=Math.cos(theta)*49,ry=Math.sin(theta)*36;
  ctx.save();ctx.translate(rx,ry);ctx.rotate(theta+.2);
  ctx.globalAlpha=.47+.18*((i+seed)%3)/3;
  ctx.fillStyle=i%3?'#a2a7a5':'#c6aaa0';
  ctx.beginPath();ctx.moveTo(-9,-3);ctx.lineTo(1,-7);
  ctx.lineTo(11,0);ctx.lineTo(1,4);ctx.closePath();ctx.fill();
  ctx.restore();
 }
 // A tiny inner heat source, not a bright line across the whole surface.
 if(critical){
  ctx.globalAlpha=.68;ctx.fillStyle='#cb663c';
  ctx.beginPath();ctx.ellipse(5,1,13,9,.2,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.82;ctx.fillStyle='#ffd39a';
  ctx.beginPath();ctx.arc(6,1,3.5,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}


/**
 * Fourth candidate: a longitudinal hull rupture rather than a round dot.
 * Broad soot lies under torn plate edges; the actual opening is narrow.
 * Its shape is baked once, never generated in the render loop.
 */
function scorchRupture(ctx,x,y,angle,seed,critical){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);
 ctx.beginPath();ragged(ctx,83,39,seed+19);ctx.clip();
 const g=ctx.createRadialGradient(0,0,2,0,0,88);
 g.addColorStop(0,'rgba(6,11,17,.96)');
 g.addColorStop(.35,'rgba(20,27,34,.84)');
 g.addColorStop(.7,'rgba(46,48,48,.42)');
 g.addColorStop(1,'rgba(65,63,59,0)');
 ctx.fillStyle=g;ctx.fillRect(-88,-44,176,88);
 // The cut bends with the hull. Darkness, then cool fractured steel,
 // not a long hot orange lightning bolt.
 ctx.lineJoin='round';ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-52,-12);ctx.lineTo(-31,-3);
 ctx.lineTo(-5,-6);ctx.lineTo(22,10);ctx.lineTo(47,12);
 ctx.globalAlpha=.92;ctx.lineWidth=16;ctx.strokeStyle='#060b10';ctx.stroke();
 ctx.beginPath();ctx.moveTo(-51,-20);ctx.lineTo(-29,-10);
 ctx.lineTo(-3,-13);ctx.lineTo(22,3);ctx.lineTo(46,5);
 ctx.globalAlpha=.77;ctx.lineWidth=4;ctx.strokeStyle='#7a8a90';ctx.stroke();
 ctx.beginPath();ctx.moveTo(-50,-4);ctx.lineTo(-34,8);
 ctx.lineTo(-8,1);ctx.lineTo(21,18);ctx.lineTo(42,20);
 ctx.globalAlpha=.75;ctx.lineWidth=4.5;ctx.strokeStyle='#333c43';ctx.stroke();
 // Three broken plating tabs catch side-light, no repeated circle of flecks.
 for(let i=0;i<3;i++){
  const px=-39+i*32,py=(i%2?8:-4);
  ctx.fillStyle=i===1?'#889396':'#a5a5a1';
  ctx.globalAlpha=.48;
  ctx.beginPath();ctx.moveTo(px-8,py-10);ctx.lineTo(px+4,py-13);
  ctx.lineTo(px+9,py-4);ctx.lineTo(px-2,py+1);ctx.closePath();ctx.fill();
 }
 if(critical){
  ctx.globalAlpha=.5;ctx.fillStyle='#b64c2f';
  ctx.beginPath();ctx.ellipse(7,5,13,5,.3,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.9;ctx.fillStyle='#ffe0b1';
  ctx.beginPath();ctx.arc(9,4,2.7,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}

let vaporStamp=null;
function cachedVapor(){
 if(vaporStamp||typeof document==='undefined')return vaporStamp;
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
 const c=canvas.getContext('2d');if(!c)return null;
 const g=c.createRadialGradient(15,16,1,16,16,16);
 g.addColorStop(0,'rgba(102,115,123,.72)');
 g.addColorStop(.35,'rgba(125,135,140,.52)');
 g.addColorStop(.72,'rgba(145,154,160,.20)');
 g.addColorStop(1,'rgba(145,154,160,0)');
 c.fillStyle=g;c.fillRect(0,0,32,32);
 vaporStamp=canvas;return canvas;
}
/** Soft tapered exhaust of ruptured hull, using a cached 32px sprite. */
export function drawCapitalWearTrail(ctx,kind,stage,width,height,time,reducedMotion=false){
 const anchors=LAYOUT[kind];
 if(!ctx||!anchors||!Number.isFinite(time)||!(width>0)||!(height>0)||
    !Number.isInteger(stage)||stage<1||stage>3)return 0;
 const stamp=cachedVapor();if(!stamp)return 0;
 const vents=stage>=2?2:1;
 ctx.save();
 for(let i=0;i<vents;i++){
  const a=anchors[i],x=(a[0]/512-.5)*width,y=(a[1]/768-.5)*height;
  for(let n=0;n<5;n++){
   const p=reducedMotion?(n+.5)/5:((time*.23+n/5+i*.13)%1+1)%1;
   const wander=reducedMotion?0:Math.sin(time*.75+n*2.1+i*3.7)*p*3.1;
   const length=(stage===3?25:stage===2?19:13)*p;
   const size=(1.35+p*2.7)*(stage===3?1.1:1);
   ctx.globalAlpha=(1-p)*(.62+stage*.08);
   ctx.drawImage(stamp,x+wander-size,y+length-size,size*2,size*2);
  }
  if(stage>=2){
   ctx.fillStyle='#f0a073';
   ctx.globalAlpha=reducedMotion?.34:.31+.21*Math.sin(time*5+i*2.3);
   ctx.beginPath();ctx.arc(x+1.2,y+1,stage===3?1.25:.85,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();return vents;
}

/**
 * Texture study: reuse the locally bundled CC0 Kenney smoke_05 image.
 * Its pale opaque source background is removed from a small 128px cache once.
 * The actual render loop uses only drawImage; no new network request per puff.
 * This remains an isolated gallery experiment until it is visually accepted.
 */
let texturedSmoke=null,textureRequested=false;
function cachedTexturedSmoke(){
 if(texturedSmoke||textureRequested||typeof Image==='undefined'||typeof document==='undefined')
  return texturedSmoke;
 textureRequested=true;
 const img=new Image();img.decoding='async';
 img.onload=()=>{
  try{
   const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
   ctx.drawImage(img,0,0,128,128);
   const frame=ctx.getImageData(0,0,128,128),pixels=frame.data;
   const corner=[0,127*4,127*128*4,(128*128-1)*4];
   const luminance=j=>pixels[j]*.2126+pixels[j+1]*.7152+pixels[j+2]*.0722;
   const baseline=corner.reduce((s,j)=>s+luminance(j),0)/4;
   const opaque=corner.every(j=>pixels[j+3]>245);
   for(let j=0;j<pixels.length;j+=4){
    const originalAlpha=pixels[j+3];
    const dark=Math.max(0,baseline-luminance(j)-3);
    const mask=opaque?Math.min(220,Math.round(dark*3.8)):originalAlpha;
    pixels[j]=116;pixels[j+1]=129;pixels[j+2]=138;
    pixels[j+3]=opaque?Math.min(originalAlpha,mask):originalAlpha;
   }
   ctx.putImageData(frame,0,0);texturedSmoke=canvas;
  }catch{ /* Cached radial vapor is the safe fallback. */ }
 };
 img.onerror=()=>{};
 img.src=new URL('../assets/fx/smoke_05.png',import.meta.url).href;
 return null;
}
export function drawCapitalWearTrailTextured(ctx,kind,stage,width,height,time,reducedMotion=false){
 const anchors=LAYOUT[kind];
 if(!ctx||!anchors||!Number.isFinite(time)||!(width>0)||!(height>0)||
    !Number.isInteger(stage)||stage<1||stage>3)return 0;
 const sprite=cachedTexturedSmoke();
 if(!sprite)return drawCapitalWearTrail(ctx,kind,stage,width,height,time,reducedMotion);
 const vents=stage>=2?2:1;
 ctx.save();
 for(let i=0;i<vents;i++){
  const a=anchors[i],x=(a[0]/512-.5)*width,y=(a[1]/768-.5)*height;
  for(let n=0;n<5;n++){
   const p=reducedMotion?(n+.5)/5:((time*.25+n/5+i*.17)%1+1)%1;
   const move=reducedMotion?0:Math.sin(time*.73+n*1.8+i*3)*p*2.6;
   const drift=(stage===3?28:stage===2?21:15)*p;
   const size=(1.8+p*3.3)*(stage===3?1.1:1);
   ctx.globalAlpha=(1-p)*(.65+stage*.08);
   ctx.drawImage(sprite,x+move-size,y+drift-size,size*2,size*2);
  }
 }
 ctx.restore();return vents;
}
/**
 * A few deterministic, world-space vapour puffs drifting aft from a
 * damaged hull socket. Caller has already translated/rotated to ship space.
 * No object mutation or random sampling occurs during a frame.
 */
export function drawCapitalWearVent(ctx,kind,stage,width,height,time,reducedMotion=false){
 const anchors=LAYOUT[kind];
 if(!ctx||!anchors||!Number.isFinite(time)||!(width>0)||!(height>0)||
    !Number.isInteger(stage)||stage<1||stage>3)return 0;
 const vents=stage>=2?2:1;
 ctx.save();
 for(let i=0;i<vents;i++){
  const a=anchors[i],x=(a[0]/512-.5)*width,y=(a[1]/768-.5)*height;
  const intensity=stage===3?1.15:stage===2?.87:.55;
  // Sustained venting is restricted to two sockets, not every hit particle.
  for(let n=0;n<4;n++){
   const p=reducedMotion?(n+.5)/4:((time*.31+n/4+i*.17)%1+1)%1;
   const drift=(9+stage*2)*p;
   const wave=reducedMotion?0:Math.sin(time*1.1+n*2.3+i*4.1)*p*2.2;
   const radius=1.15+p*2.7;
   const alpha=(1-p)*(.25+stage*.038)*intensity;
   ctx.globalAlpha=alpha;
   ctx.fillStyle='#c2c7c3';
   ctx.beginPath();ctx.arc(x+wave,y+drift,radius,0,Math.PI*2);ctx.fill();
   ctx.globalAlpha=alpha*.55;
   ctx.fillStyle='#637c85';
   ctx.beginPath();ctx.arc(x+wave-1,y+drift+1.5,radius*.75,0,Math.PI*2);ctx.fill();
  }
  if(stage>=2){
   // Small intermittent electrical spit near the vent itself.
   const pulse=reducedMotion?.45:.35+.25*Math.sin(time*7+i*2.8);
   ctx.globalAlpha=pulse;ctx.fillStyle='#f6a469';
   ctx.beginPath();ctx.arc(x+1.3,y+1,stage===3?1.8:1.2,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
 return vents;
}
/**
 * Only used for visual comparison until screenshots are accepted.
 * Returns null in Node/tests or on malformed input. Does not mutate base.
 */
export function createCapitalWearFrame(base,kind,stage,variant='contrast'){
 const anchors=LAYOUT[kind];
 if(typeof document==='undefined'||!base||!anchors||
    !Number.isInteger(stage)||stage<1||stage>3||
    !['soft','contrast','breach','rupture','textured'].includes(variant))return null;
 const canvas=document.createElement('canvas');
 canvas.width=base.width;canvas.height=base.height;
 if(canvas.width!==512||canvas.height!==768)return null;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.drawImage(base,0,0);
 ctx.save();ctx.globalCompositeOperation='source-atop';
 for(let i=0;i<stage;i++){
  const a=anchors[i];
  (variant==='soft'?scorchSoft:variant==='contrast'?scorchContrast:variant==='breach'?scorchBreach:scorchRupture)(
   ctx,a[0],a[1],a[2],i+kind.length*3,i===2);
 }
 ctx.restore();
 return canvas;
}
