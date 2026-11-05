// The same 80 hand-rigged frames are used by the playable world and its QA lab.
// The source illustration faces right: all rotation happens around one fixed pivot.
export const SIPHON3_ATLAS_COLUMNS=10;
export const SIPHON3_ATLAS_ROWS=8;
export const SIPHON3_TILE=128;
export const SIPHON3_FRAME_COUNT=80;
export const SIPHON3_FRAME_RATE=20;
export const SIPHON3_WORLD_SIZE=84;

let sprite=null;

export function siphon3AtlasUrl(){
 return new URL('./studio/assets/siphon3/siphon3-atlas.webp',import.meta.url).href;
}

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
 const atlas=sheet||readySprite();
 if(!atlas?.complete||atlas.naturalWidth<SIPHON3_ATLAS_COLUMNS*SIPHON3_TILE||
  atlas.naturalHeight<SIPHON3_ATLAS_ROWS*SIPHON3_TILE)return false;
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)||size<=0)return false;
 const frame=siphon3Frame(time,seed,reducedMotion);
 const sx=(frame%SIPHON3_ATLAS_COLUMNS)*SIPHON3_TILE;
 const sy=Math.floor(frame/SIPHON3_ATLAS_COLUMNS)*SIPHON3_TILE;
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
 c.drawImage(atlas,sx,sy,SIPHON3_TILE,SIPHON3_TILE,-size/2,-size/2,size,size);

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
