// Siphon-3 uses one immutable painting, with three anatomically fixed hinges.
// The rig is cut once at load time, never reinterpreted from individual AI poses.
// The 80-frame sheet remains a fallback on older/unsupported Canvas runtimes.
export const SIPHON3_ATLAS_COLUMNS=10;
export const SIPHON3_ATLAS_ROWS=8;
export const SIPHON3_TILE=128;
export const SIPHON3_FRAME_COUNT=80;
export const SIPHON3_FRAME_RATE=20;
export const SIPHON3_WORLD_SIZE=84;

let sprite=null;
let rigImage=null;
let rig=null;

const MASTER_WIDTH=1254,PADDING=112,RIG_TILE=512;
const factor=RIG_TILE/(MASTER_WIDTH+PADDING*2);
const coord=v=>(v+PADDING)*factor;
const PARTS={
 dorsal:{
  polygon:[[218,96],[293,54],[379,39],[469,59],[557,109],[611,190],[654,254],
   [626,297],[585,316],[544,294],[502,283],[442,301],[372,306],[335,262],[278,221],[252,159]],
  pivot:[518,352],radius:48,
 },
 ventralRight:{
  polygon:[[806,696],[835,738],[880,764],[942,773],[1018,750],[1070,737],[1090,780],
   [1068,835],[1020,898],[951,942],[866,958],[793,941],[751,900],[741,845],
   [783,795],[788,739]],
  pivot:[766,708],radius:48,
 },
 ventralLeft:{
  polygon:[[272,821],[316,831],[357,826],[394,843],[413,883],[410,943],[380,994],
   [385,1062],[404,1136],[378,1186],[320,1196],[253,1168],[195,1110],[159,1023],
   [145,953],[179,878],[220,839]],
  pivot:[378,815],radius:45,
 },
};

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};

// The mechanical pose is derived directly from game phase + progress. No
// per-frame accumulation, no detached joints, no sudden change of silhouette.
export function siphon3Pose(phase,progress,time,seed=0,reducedMotion=false){
 const p=clamp(Number.isFinite(progress)?progress:0);
 const t=Number.isFinite(time)?time:0;
 let spread;
 if(phase==='gather'){
  const q=p/.24;
  spread=.85-.75*Math.sin(Math.PI*2*clamp(q))**2;
 }else if(phase==='back'){
  spread=.85-.63*smooth(0,.22,p)+.24*smooth(.82,1,p);
 }else{
  spread=.20+.65*smooth(.68,1,p);
 }
 const flutter=reducedMotion?0:
  Math.sin(t*(phase==='gather'?17:phase==='back'?7:9)+seed*.43)*
  (phase==='gather'?3.8:phase==='back'?1.6:2.8);
 return {
  spread,
  angles:{
   dorsal:(spread-.5)*43+flutter,
   ventralRight:-(spread-.5)*41-flutter*.75,
   ventralLeft:(spread-.5)*38+flutter*.85,
  },
 };
}

export function siphon3AtlasUrl(){
 return new URL('./studio/assets/siphon3/siphon3-atlas.webp',import.meta.url).href;
}

export function siphon3RigUrl(){
 return new URL('./studio/assets/siphon3/siphon3-rig-master.webp',import.meta.url).href;
}

function emptyCanvas(){
 const canvas=document.createElement('canvas');canvas.width=RIG_TILE;canvas.height=RIG_TILE;
 return canvas;
}

function polygonPath(c,points){
 c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(coord(x),coord(y)):
  c.moveTo(coord(x),coord(y)));c.closePath();
}

function makeRig(image){
 // A 512px padded coordinate system matches the first rig exactly.
 const master=emptyCanvas(),mc=master.getContext('2d');
 if(!mc)return null;
 mc.drawImage(image,coord(0),coord(0),MASTER_WIDTH*factor,MASTER_WIDTH*factor);
 const base=emptyCanvas(),bc=base.getContext('2d');bc.drawImage(master,0,0);
 const limbs={},caps=[];
 for(const [name,spec] of Object.entries(PARTS)){
  const part=emptyCanvas(),pc=part.getContext('2d');
  pc.drawImage(master,0,0);pc.globalCompositeOperation='destination-in';
  polygonPath(pc,spec.polygon);pc.fill();pc.globalCompositeOperation='source-over';
  limbs[name]=part;
  bc.globalCompositeOperation='destination-out';
  polygonPath(bc,spec.polygon);bc.fill();bc.globalCompositeOperation='source-over';
  const cap=emptyCanvas(),cc=cap.getContext('2d');
  cc.drawImage(master,0,0);cc.globalCompositeOperation='destination-in';
  cc.beginPath();cc.arc(coord(spec.pivot[0]),coord(spec.pivot[1]),spec.radius*factor,
   0,Math.PI*2);cc.fill();cc.globalCompositeOperation='source-over';
  caps.push(cap);
 }
 return {base,limbs,caps};
}

function readyRig(){
 if(!rigImage&&typeof Image==='function'&&typeof document!=='undefined'){
  rigImage=new Image();rigImage.decoding='async';rigImage.src=siphon3RigUrl();
 }
 if(!rig&&rigImage?.complete&&rigImage.naturalWidth===MASTER_WIDTH&&
  rigImage.naturalHeight===MASTER_WIDTH&&typeof document!=='undefined'){
  try{rig=makeRig(rigImage);}catch{rig=null;}
 }
 return rig;
}

export function siphon3RigReady(){return Boolean(readyRig());}

function readySprite(){
 if(!sprite&&typeof Image==='function'){
  sprite=new Image();sprite.decoding='async';sprite.src=siphon3AtlasUrl();
 }
 return sprite?.complete&&sprite.naturalWidth>=SIPHON3_ATLAS_COLUMNS*SIPHON3_TILE&&
  sprite.naturalHeight>=SIPHON3_ATLAS_ROWS*SIPHON3_TILE?sprite:null;
}

export function siphon3Frame(time,seed=0,reducedMotion=false){
 if(reducedMotion)return 0;
 const t=Number.isFinite(time)?Math.max(0,time):0;
 const offset=Number.isFinite(seed)?Math.trunc(seed)*17:0;
 return ((Math.floor(t*SIPHON3_FRAME_RATE)+offset)%SIPHON3_FRAME_COUNT+
  SIPHON3_FRAME_COUNT)%SIPHON3_FRAME_COUNT;
}

// Returns false only while the atlas is unavailable, letting the game keep its
// lightweight old drawing as a fallback. Does not mutate the harvester state.
export function drawSiphon3(c,{
 x,y,angle=0,phase='out',progress=0,time=0,seed=0,
 size=SIPHON3_WORLD_SIZE,reducedMotion=false,sheet=null,
}={}){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)||size<=0)return false;
 const movingRig=readyRig();
 const atlas=movingRig?null:(sheet||readySprite());
 if(!movingRig&&(!atlas?.complete||atlas.naturalWidth<SIPHON3_ATLAS_COLUMNS*SIPHON3_TILE||
  atlas.naturalHeight<SIPHON3_ATLAS_ROWS*SIPHON3_TILE))return false;
 const pulse=reducedMotion?0:Math.sin(time*8+seed*2.1);

 c.save();c.translate(x,y);c.rotate(angle);
 // These cues are tied to the actual game's phases, not to a simulated cargo.
 if(phase==='back'){
  c.shadowColor='#ffb45e';c.shadowBlur=reducedMotion?0:14;
  c.fillStyle='rgba(255,171,65,.27)';c.beginPath();
  c.arc(-size*.16,0,size*(.19+.015*pulse),0,Math.PI*2);c.fill();
  c.shadowBlur=0;
 } else if(phase==='gather'){
  c.strokeStyle='rgba(89,250,241,.68)';c.lineWidth=Math.max(1.2,size*.026);
  c.beginPath();c.arc(size*.27,-size*.03,size*(.09+.016*pulse),-.8,1.75);c.stroke();
 }
 if(movingRig){
  const pose=siphon3Pose(phase,progress,time,seed,reducedMotion);
  c.save();c.scale(size/RIG_TILE,size/RIG_TILE);c.translate(-RIG_TILE/2,-RIG_TILE/2);
  c.drawImage(movingRig.base,0,0);
  for(const [name,spec] of Object.entries(PARTS)){
   const px=coord(spec.pivot[0]),py=coord(spec.pivot[1]);
   c.save();c.translate(px,py);c.rotate(pose.angles[name]*Math.PI/180);
   c.translate(-px,-py);c.drawImage(movingRig.limbs[name],0,0);c.restore();
  }
  for(const cap of movingRig.caps)c.drawImage(cap,0,0);
  c.restore();
 }else{
  // Fully animated 80-frame fallback, used only while rig loading/fails.
  const frame=siphon3Frame(time,seed,reducedMotion);
  const sx=(frame%SIPHON3_ATLAS_COLUMNS)*SIPHON3_TILE;
  const sy=Math.floor(frame/SIPHON3_ATLAS_COLUMNS)*SIPHON3_TILE;
  c.drawImage(atlas,sx,sy,SIPHON3_TILE,SIPHON3_TILE,-size/2,-size/2,size,size);
 }

 // A visible trail makes full and empty trips distinct at gameplay scale.
 if(phase==='back'){
  c.fillStyle='#ffe3a2';c.shadowColor='#ffbf65';c.shadowBlur=reducedMotion?0:7;
  c.beginPath();c.arc(-size*.38,size*.06,size*.043,0,Math.PI*2);c.fill();
 } else if(phase==='gather'){
  c.fillStyle='rgba(126,255,239,.8)';
  c.beginPath();c.arc(size*.38,-size*.03,size*(.024+.008*Math.abs(pulse)),0,Math.PI*2);c.fill();
 }
 c.restore();
 return true;
}
