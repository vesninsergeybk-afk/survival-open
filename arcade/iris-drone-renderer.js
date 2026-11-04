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
/** Full closure and reopening recur while the scout is visible, even in combat.
 * Serial-based timing spreads the gestures through large enemy formations. */
export function irisCycleFrameAt(ageSeconds,serial=0,reducedMotion=false){
  if(reducedMotion)return 8;
  const age=Math.max(0,Number(ageSeconds)||0);
  if(age<=OPEN_SECONDS)return irisFrameAt(age);
  const seed=Number.isFinite(serial)?Math.abs(Math.trunc(serial)):0;
  const hold=.52+(seed%7)*.15;
  const period=3.5+(seed%5)*.25;
  const phase=(age-OPEN_SECONDS)%period;
  if(phase<hold)return 8;
  const closing=(phase-hold)/.52;
  if(closing<1)return clamp(Math.round(8*(1-closing)),0,8);
  if(phase<hold+.76)return 0;
  const reopening=(phase-hold-.76)/.62;
  if(reopening<1)return clamp(Math.round(8*reopening),0,8);
  return 8;
}
/** A shorter protective half-close while steering sharply. */
export function irisManeuverFrameAt(elapsed){
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=.72)return 8;
  return clamp(Math.round(8-5*Math.sin(Math.PI*elapsed/.72)),3,8);
}
/** Engine levels 0–5 plus -1 for off. Acceleration and turning add thrust. */
export function irisThrustLevel(speed,acceleration=0,turnRate=0,pulse=0){
  if(!Number.isFinite(speed)||speed<7)return -1;
  const base=clamp(Math.floor(speed/36),0,5);
  const boost=(Number.isFinite(acceleration)&&acceleration>90?1:0)+
    (Number.isFinite(turnRate)&&turnRate>1.1?1:0);
  const shimmer=pulse>.82?1:pulse<-.82?-1:0;
  return clamp(base+boost+shimmer,0,5);
}
export const isIrisDroneReady=()=>body!==null;

/** Returns false if the atlas is unavailable; gameplay stays untouched. */
export function drawIrisDrone(ctx,enemy,time=0,reducedMotion=false){
  if(!enemy||enemy.type!=='scout'||enemy.boss||
      enemy.missionStructure||enemy.interceptCargo)return false;
  if(!loadingStarted)loadIrisAssets();
  if(!body)return false;
  const now=Number.isFinite(time)?time:0;
  if(!Number.isFinite(enemy._irisFirstPaintTime))enemy._irisFirstPaintTime=now;
  const age=Math.max(0,now-enemy._irisFirstPaintTime);
  const vx=Number.isFinite(enemy.vx)?enemy.vx:0;
  const vy=Number.isFinite(enemy.vy)?enemy.vy:0;
  const speed=Math.hypot(vx,vy);
  let acceleration=0,turnRate=0;
  // Per-drone motion history, updated in place: no per-frame object allocation.
  const motion=enemy._irisMotion;
  if(motion){
    const dt=now-motion.time;
    if(dt>.005&&dt<.3){
      acceleration=Math.hypot(vx-motion.vx,vy-motion.vy)/dt;
      if(speed>25&&Math.hypot(motion.vx,motion.vy)>25){
        const current=Math.atan2(vy,vx),previous=Math.atan2(motion.vy,motion.vx);
        const difference=Math.atan2(Math.sin(current-previous),
          Math.cos(current-previous));
        turnRate=Math.abs(difference)/dt;
      }
    }
    motion.time=now;motion.vx=vx;motion.vy=vy;
  }else enemy._irisMotion={time:now,vx,vy};
  if(!reducedMotion&&age>OPEN_SECONDS&&
     (acceleration>140||turnRate>1.1)&&
     now>=(enemy._irisNextManeuverAt??(enemy._irisFirstPaintTime+1.1))){
    enemy._irisManeuverAt=now;
    const seed=Number.isFinite(enemy.serial)?Math.abs(enemy.serial):0;
    enemy._irisNextManeuverAt=now+1.6+(seed%3)*.22;
  }
  const scanFrame=irisCycleFrameAt(age,enemy.serial,reducedMotion);
  const maneuverFrame=reducedMotion?8:
    irisManeuverFrameAt(now-(enemy._irisManeuverAt??-Infinity));
  const frame=Math.min(scanFrame,maneuverFrame);
  const side=clamp((enemy.r||14)*3,32,46);
  ctx.save();
  ctx.translate(enemy.x,enemy.y);
  ctx.rotate(Number.isFinite(enemy.visualAngle)?enemy.visualAngle:0);
  ctx.imageSmoothingEnabled=true;
  // Thrust remains visible with the armor fully closed.
  if(ion){
    const seed=Number.isFinite(enemy.serial)?enemy.serial:0;
    const pulse=reducedMotion?0:Math.sin(now*7.5+(seed%23)*.8);
    const level=irisThrustLevel(speed,acceleration,turnRate,pulse);
    if(level>=0)ctx.drawImage(ion,level*CELL,0,CELL,320,
      -side/2,-side/2+side*.30,side,side*2);
  }
  ctx.drawImage(body,(frame%3)*CELL,Math.floor(frame/3)*CELL,
    CELL,CELL,-side/2,-side/2,side,side);
  ctx.restore();
  return true;
}
