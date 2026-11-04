/**
 * I.R.I.S. («Зрачок») — default hostile scout visuals with ?iris=0 rollback.
 * Nine painted shell positions and six ion-thrust levels.
 * Visual state is deterministic and never changes gameplay AI or RNG.
 */
const CELL=160;
const OPEN_SECONDS=.9;
let body=null, ion=null, loadingStarted=false;
function loadIrisAssets(){
  if(loadingStarted||typeof Image==='undefined')return;
  loadingStarted=true;
  const shellImage=new Image();
  shellImage.decoding='async';
  shellImage.onload=()=>{
    if(shellImage.naturalWidth===480&&shellImage.naturalHeight===480)body=shellImage;
  };
  shellImage.onerror=()=>{body=null;};
  shellImage.src=new URL('./studio/assets/iris-drone/iris-body.webp',import.meta.url).href;
  const thrustImage=new Image();
  thrustImage.decoding='async';
  thrustImage.onload=()=>{
    if(thrustImage.naturalWidth===960&&thrustImage.naturalHeight===320)ion=thrustImage;
  };
  thrustImage.onerror=()=>{ion=null;};
  thrustImage.src=new URL('./studio/assets/iris-drone/iris-ion.webp',import.meta.url).href;
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function irisEnabledByQuery(search=''){
  return new URLSearchParams(search).get('iris')!=='0';
}

export function irisFrameAt(ageSeconds,reducedMotion=false){
  if(reducedMotion)return 8;
  const t=clamp((Number(ageSeconds)||0)/OPEN_SECONDS,0,1);
  const eased=t*t*(3-2*t);
  return clamp(Math.round(eased*8),0,8);
}
export function irisThrustLevel(speed){
  if(!Number.isFinite(speed)||speed<5)return -1;
  return clamp(2+Math.floor(speed/90),0,5);
}
export const isIrisDroneReady=()=>body!==null;

/** Returns false if the optional sprite cannot replace the existing scout. */
export function drawIrisDrone(ctx,enemy,time=0,reducedMotion=false){
  if(!enemy||enemy.type!=='scout'||enemy.boss||
      enemy.missionStructure||enemy.interceptCargo)return false;
  if(!loadingStarted)loadIrisAssets();
  if(!body)return false;
  if(!Number.isFinite(enemy._irisFirstPaintTime))enemy._irisFirstPaintTime=time;
  const frame=irisFrameAt(Math.max(0,time-enemy._irisFirstPaintTime),reducedMotion);
  const side=clamp((enemy.r||14)*3,32,46);
  ctx.save();
  ctx.translate(enemy.x,enemy.y);
  ctx.rotate(Number.isFinite(enemy.visualAngle)?enemy.visualAngle:0);
  ctx.imageSmoothingEnabled=true;
  // Ion plume is rendered behind the body and follows the same orientation.
  if(ion&&frame>=3){
    const level=irisThrustLevel(Math.hypot(enemy.vx||0,enemy.vy||0));
    if(level>=0)ctx.drawImage(ion,level*CELL,0,CELL,320,
      -side/2,-side/2+side*.30,side,side*2);
  }
  ctx.drawImage(body,(frame%3)*CELL,Math.floor(frame/3)*CELL,
    CELL,CELL,-side/2,-side/2,side,side);
  ctx.restore();
  return true;
}
