// Shared, deterministic 80-frame vortex animation for the physical world.
// The 512 px source artwork is packed into two 192 px WebP atlases: no GIF
// transparency threshold, no video decoder and no 80 individual requests.
export const VORTEX_ART=Object.freeze({
 frameSize:192,columns:10,rows:4,frameCount:80,fps:20,period:4,
 worldSize:220,
 urls:Object.freeze([
  '../assets/space/contour-vortex-atlas-0.webp',
  '../assets/space/contour-vortex-atlas-1.webp'
 ])
});

let sheets=null;
const seedFromId=id=>{
 let hash=2166136261;
 for(const char of String(id||'')){
  hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 }
 return (hash>>>0)/4294967296;
};

export function vortexFrameAt(seconds,id='',reducedMotion=false){
 if(reducedMotion)return 0;
 const duration=VORTEX_ART.period;
 const shifted=((Number(seconds)||0)+seedFromId(id)*duration)%duration;
 return Math.floor(((shifted+duration)%duration)*VORTEX_ART.fps)%VORTEX_ART.frameCount;
}

export function vortexAtlasCell(frame){
 const normalized=((Math.trunc(frame)%VORTEX_ART.frameCount)+VORTEX_ART.frameCount)%VORTEX_ART.frameCount;
 const sheet=Math.floor(normalized/40),cell=normalized%40;
 return {sheet,x:(cell%VORTEX_ART.columns)*VORTEX_ART.frameSize,
  y:Math.floor(cell/VORTEX_ART.columns)*VORTEX_ART.frameSize,
  size:VORTEX_ART.frameSize};
}

// A failed sheet is not re-requested on every animation frame. Both sheets
// begin loading once, and the procedural canvas fallback remains available.
export function primeContourVortexArt(){
 if(sheets||typeof Image==='undefined')return;
 sheets=VORTEX_ART.urls.map(url=>{
  const slot={image:new Image(),ready:false,failed:false};
  slot.image.onload=()=>{slot.ready=slot.image.naturalWidth===1920&&slot.image.naturalHeight===768;
   if(!slot.ready)slot.failed=true;};
  slot.image.onerror=()=>{slot.failed=true;};
  slot.image.src=url;
  return slot;
 });
}

export function drawContourVortexArt(ctx,seconds,field,pulse=1,
  {reducedMotion=false,birth=1}={}){
 primeContourVortexArt();
 // Wait until both halves are decoded: otherwise the vortex alternates
 // between sprite art and its procedural fallback every two seconds.
 if(!sheets||!sheets.every(slot=>slot.ready))return false;
 const frame=vortexFrameAt(seconds,field?.id,reducedMotion);
 const cell=vortexAtlasCell(frame),slot=sheets[cell.sheet];
 if(!slot?.ready)return false;
 const scale=Math.max(0,Math.min(1,birth));
 if(scale<=0)return true;
 const worldSize=VORTEX_ART.worldSize*pulse*(0.54+0.46*scale);
 ctx.save();
 ctx.globalCompositeOperation='source-over';
 ctx.globalAlpha=scale;
 ctx.drawImage(slot.image,cell.x,cell.y,cell.size,cell.size,
  -worldSize/2,-worldSize/2,worldSize,worldSize);
 ctx.restore();
 return true;
}

// Start preloading during normal browser startup, long before the first
// triangle is likely to close. Node.js unit tests have no Image constructor.
primeContourVortexArt();
