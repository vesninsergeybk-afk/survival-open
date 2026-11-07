/**
 * I.R.I.S. («Зрачок») — default hostile scout visuals with ?iris=0 rollback.
 * Nine painted shell positions and six ion-thrust levels.
 * Scanning uses original painted armor as three articulated jaws over a
 * separate painted copper underlay; movement comes from the real sensor AI.
 */
import {irisScanExtension,IRIS_SCAN} from './iris-scanning.js?v=iris-predator-scan-1';
const CELL=160;
const OPEN_SECONDS=.9;
let body=null, ion=null, scanCore=null, jawSprites=null, loadingStarted=false;
function loadIrisAssets(){
  if(loadingStarted||typeof Image==='undefined')return;
  loadingStarted=true;
  const shellImage=new Image();
  shellImage.decoding='async';
  shellImage.onload=()=>{
    if(shellImage.naturalWidth===480&&shellImage.naturalHeight===480){
      body=shellImage;prepareJawSprites();
    }
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
  const coreImage=new Image();
  coreImage.decoding='async';
  coreImage.onload=()=>{
    if(coreImage.naturalWidth===CELL&&coreImage.naturalHeight===CELL)scanCore=coreImage;
  };
  coreImage.onerror=()=>{scanCore=null;};
  coreImage.src=new URL('./studio/assets/iris-drone/iris-scan-core.webp',import.meta.url).href;
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
/** A fast defensive blink synchronized with the scout's actual side-dash. */
export function irisDodgeFrameAt(elapsed){
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>=.49)return 8;
  return clamp(Math.round(8-6*Math.sin(Math.PI*elapsed/.49)),2,8);
}
export function irisDrawSize(radius=14){
  return clamp((radius||14)*2.3,27,35);
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

// Masks follow the THREE ivory plates in the ORIGINAL bottom-right source
// cell. Their pivots stay fixed on the copper machine while each plate moves
// outward. Continuous transforms avoid mid-frame shape jumps entirely.
const JAWS=[
  {pivot:[80,56],shift:[0,-19],turn:-.04,
   points:[[45,23],[52,8],[70,1],[92,1],[107,10],[117,27],[111,48],
     [97,60],[75,65],[53,55],[43,39]]},
  {pivot:[67,86],shift:[-19,11],turn:-.29,
   points:[[10,73],[25,62],[41,57],[59,67],[77,87],[76,105],
     [58,128],[32,132],[14,121],[5,99]]},
  {pivot:[94,87],shift:[19,11],turn:.29,
   points:[[86,85],[102,65],[121,58],[141,63],[155,77],[158,101],
     [150,120],[130,132],[103,126],[87,106]]}
];
function jawClip(ctx,jaw){
  ctx.beginPath();
  for(let i=0;i<jaw.points.length;i++){
    const [x,y]=jaw.points[i];
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.clip();
}
function prepareJawSprites(){
  // Clip painted plates ONCE, not for each of 200 drones on every frame.
  const makeCanvas=typeof OffscreenCanvas!=='undefined'?
    ()=>new OffscreenCanvas(CELL,CELL):
    typeof document!=='undefined'&&document.createElement?
      ()=>{const c=document.createElement('canvas');c.width=CELL;c.height=CELL;return c;}:
      null;
  if(!makeCanvas||!body)return;
  try{
    jawSprites=JAWS.map(jaw=>{
      const canvas=makeCanvas(),ctx=canvas.getContext('2d');
      if(!ctx)throw Error('jaw canvas unavailable');
      ctx.save();jawClip(ctx,jaw);
      ctx.drawImage(body,320,320,CELL,CELL,0,0,CELL,CELL);
      ctx.restore();return canvas;
    });
  }catch{jawSprites=null;}
}
function drawOriginalPetal(ctx,art,amount,jaw,index){
  ctx.save();
  const [pivotX,pivotY]=jaw.pivot;
  ctx.translate(pivotX+jaw.shift[0]*amount,pivotY+jaw.shift[1]*amount);
  ctx.rotate(jaw.turn*amount);
  ctx.translate(-pivotX,-pivotY);
  if(jawSprites)ctx.drawImage(jawSprites[index],0,0);
  else{
    jawClip(ctx,jaw);
    ctx.drawImage(art,320,320,CELL,CELL,0,0,CELL,CELL);
  }
  ctx.restore();
}
function scanAntenna(ctx,x,y,tx,ty,amount){
  const endX=x+(tx-x)*amount,endY=y+(ty-y)*amount;
  ctx.lineCap='round';
  ctx.strokeStyle='#28202a';ctx.lineWidth=5.8;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(endX,endY);ctx.stroke();
  ctx.strokeStyle='#b78e71';ctx.lineWidth=2.3;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(endX,endY);ctx.stroke();
  ctx.fillStyle='#a66aff';ctx.beginPath();ctx.arc(endX,endY,3.8,0,Math.PI*2);ctx.fill();
}
/** Layered scanner puppet, drawn only during actual detection/search pauses. */
function drawPredatorScan(ctx,art,core,amount,time,serial,reducedMotion){
  ctx.save();
  ctx.drawImage(core,0,0,CELL,CELL);
  for(let i=0;i<JAWS.length;i++)drawOriginalPetal(ctx,art,amount,JAWS[i],i);
  if(amount>.2){
    // The scanner stalks grow FROM the outer edges of the unfolded plates;
    // the final silhouette looks like three fangs, not a bare floating eye.
    const antenna=(amount-.2)/.8;
    scanAntenna(ctx,80,12,80,-35,antenna);
    scanAntenna(ctx,20,118,-38,145,antenna);
    scanAntenna(ctx,140,118,198,145,antenna);
  }
  // The eye really changes to violet throughout sensing; blue-white scanning
  // arcs show the field sweep while the body is stationary.
  ctx.fillStyle='rgba(110,43,210,.89)';ctx.beginPath();ctx.arc(80,78,11,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(230,197,255,.95)';ctx.beginPath();ctx.arc(80,77,4.2,0,Math.PI*2);ctx.fill();
  if(!reducedMotion){
    const a=time*4+(Math.abs(serial||0)%9)*.54;
    ctx.strokeStyle='rgba(182,125,255,.65)';ctx.lineWidth=2.1;
    ctx.beginPath();ctx.arc(80,78,42,a,a+.72);ctx.stroke();
    ctx.beginPath();ctx.arc(80,78,52,a+Math.PI,a+Math.PI+.45);ctx.stroke();
  }
  ctx.restore();
}

/** Returns false if the atlas is unavailable; gameplay stays untouched. */
export function drawIrisDrone(ctx,enemy,time=0,reducedMotion=false){
  if(!enemy||enemy.type!=='scout'||enemy.boss||
      enemy.missionStructure||enemy.interceptCargo)return false;
  if(!loadingStarted)loadIrisAssets();
  if(!body)return false;
  const now=Number.isFinite(time)?time:0;
  if(!Number.isFinite(enemy._irisFirstPaintTime))enemy._irisFirstPaintTime=now;
  let age=Math.max(0,now-enemy._irisFirstPaintTime);
  const missionScan=Number.isFinite(enemy._missionScanStarted)&&
   now>=enemy._missionScanStarted&&now<(enemy._missionScanUntil??-Infinity);
  const scanStarted=missionScan?enemy._missionScanStarted:enemy._irisScanStarted;
  const scanElapsed=now-(scanStarted??-Infinity);
  const scanDuration=IRIS_SCAN.open+IRIS_SCAN.hold+IRIS_SCAN.close;
  const scanning=scanElapsed>=0&&scanElapsed<=scanDuration;
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
  if(!scanning&&!reducedMotion&&age>OPEN_SECONDS&&
     (acceleration>140||turnRate>1.1)&&
     now>=(enemy._irisNextManeuverAt??(enemy._irisFirstPaintTime+1.1))){
    enemy._irisManeuverAt=now;
    const seed=Number.isFinite(enemy.serial)?Math.abs(enemy.serial):0;
    enemy._irisNextManeuverAt=now+1.6+(seed%3)*.22;
  }
  if(Number.isFinite(enemy._irisScanStarted)&&scanElapsed>scanDuration&&
     enemy._irisCycleRestartScan!==enemy._irisScanStarted){
    // The scanning puppet retracts to source frame 8. Resume the standard
    // shell loop at that exact pose, or a mid-cycle frame would visibly snap.
    enemy._irisCycleRestartScan=enemy._irisScanStarted;
    enemy._irisFirstPaintTime=now-OPEN_SECONDS;
    age=OPEN_SECONDS;
  }
  const scanFrame=irisCycleFrameAt(age,enemy.serial,reducedMotion);
  const maneuverFrame=reducedMotion?8:
    irisManeuverFrameAt(now-(enemy._irisManeuverAt??-Infinity));
  const dodgeElapsed=now-(enemy._scoutDodgeStarted??-Infinity);
  const dodgeFrame=reducedMotion?8:irisDodgeFrameAt(dodgeElapsed);
  const jawExtension=scanning?irisScanExtension(now,scanStarted,reducedMotion):0;
  const frame=scanning?8:Math.min(scanFrame,maneuverFrame,dodgeFrame);
  // The player's ship is ~39 px across. Scout body shrinks from 42 to 32 px,
  // while its gameplay collision radius remains 14 world units.
  const side=irisDrawSize(enemy.r);
  const banking=(!reducedMotion&&dodgeElapsed>=0&&dodgeElapsed<.49)?
    (enemy._scoutDodgeSide||0)*.16*Math.sin(Math.PI*dodgeElapsed/.49):0;
  ctx.save();
  ctx.translate(enemy.x,enemy.y);
  ctx.rotate((Number.isFinite(enemy.visualAngle)?enemy.visualAngle:0)+banking);
  ctx.imageSmoothingEnabled=true;
  // Thrust remains visible with the armor fully closed. During the physical
  // post-scan acceleration, short violet wakes announce the sideways dash.
  // They follow the existing ship angle and cost only two line strokes.
  const burstAge=now-(enemy._irisBurstStarted??-Infinity);
  const burstGlow=!scanning&&!reducedMotion&&burstAge>=0&&
    burstAge<IRIS_SCAN.burstSeconds?
    Math.sin(Math.PI*burstAge/IRIS_SCAN.burstSeconds):0;
  if(burstGlow>.05){
    ctx.save();
    ctx.strokeStyle=`rgba(177,110,255,${.43*burstGlow})`;
    ctx.lineWidth=Math.max(.9,side*.042);
    ctx.lineCap='round';
    for(const x of [-side*.19,side*.19]){
      ctx.beginPath();ctx.moveTo(x,side*.35);
      ctx.lineTo(x,side*(.48+.67*burstGlow));ctx.stroke();
    }
    ctx.restore();
  }
  const escaping=now<(enemy._irisRetreatUntil||0);
  const winging=!escaping&&now<(enemy._irisWingUntil||0);
  if(!reducedMotion&&(escaping||winging)){
    // A twin, low-cost thruster wake makes the bait/wing handoff legible.
    // Cyan = breaking contact, violet = answering the pack's call.
    const flicker=.72+.28*Math.sin(now*19+(enemy.serial||0));
    ctx.save();ctx.strokeStyle=escaping?
      `rgba(100,241,237,${.82*flicker})`:
      `rgba(182,122,255,${.65*flicker})`;
    ctx.lineWidth=Math.max(1.2,side*.055);ctx.lineCap='round';
    for(const x of [-side*.25,side*.25]){
      ctx.beginPath();ctx.moveTo(x,side*.39);
      ctx.lineTo(x,side*(escaping?1.45:1.0));ctx.stroke();
    }
    ctx.restore();
  }
  // Engine power is inferred from actual velocity and acceleration.
  if(ion){
    const seed=Number.isFinite(enemy.serial)?enemy.serial:0;
    const pulse=reducedMotion?0:Math.sin(now*7.5+(seed%23)*.8);
    const level=irisThrustLevel(speed,
      dodgeFrame<8?Math.max(180,acceleration):acceleration,turnRate,pulse);
    if(level>=0)ctx.drawImage(ion,level*CELL,0,CELL,320,
      -side/2,-side/2+side*.30,side,side*1.65);
  }
  if(scanning&&scanCore){
    const mix=clamp(jawExtension*4,0,1);
    if(mix<1){
      ctx.globalAlpha=1-mix;
      ctx.drawImage(body,320,320,CELL,CELL,-side/2,-side/2,side,side);
      ctx.globalAlpha=1;
    }
    if(mix>0){
      ctx.save();ctx.globalAlpha=mix;
      ctx.translate(-side/2,-side/2);ctx.scale(side/CELL,side/CELL);
      drawPredatorScan(ctx,body,scanCore,jawExtension,now,enemy.serial,reducedMotion);
      ctx.restore();
    }
  }else ctx.drawImage(body,(frame%3)*CELL,Math.floor(frame/3)*CELL,
    CELL,CELL,-side/2,-side/2,side,side);
  // During territorial counterattacks the familiar IRIS lens heats from
  // violet to bright rose. The approved body atlas stays unchanged.
  const trialDiving=enemy._trialDive?.phase;
  if(trialDiving==='windup'||trialDiving==='rush'){
    ctx.save();ctx.globalCompositeOperation='lighter';
    const ramp=trialDiving==='rush'?1:
      clamp((now-enemy._trialDive.started)/.78,0,1);
    ctx.fillStyle=`rgba(255,95,155,${.3+.47*ramp})`;
    ctx.beginPath();ctx.arc(0,0,side*(.085+.035*ramp),0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  const activePackStrike=now<(enemy._irisPackCueUntil||0)&&
    enemy._irisPackPhase==='strike'&&enemy._irisPackRole&&
    enemy._irisPackRole!=='reserve'&&
    !enemy._irisPackRole.startsWith('sentry');
  if(activePackStrike){
    // Only the 2–4 committed attackers show a world-space warning chevron.
    // The rest of a large flock stays visually quiet and is not a projectile.
    const pulse=reducedMotion?1:.77+.23*Math.sin(now*12+(enemy.serial||0));
    ctx.save();ctx.strokeStyle=`rgba(233,171,255,${pulse})`;
    ctx.lineWidth=1.65;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-side*.19,-side*.63);
    ctx.lineTo(0,-side*.82);ctx.lineTo(side*.19,-side*.63);ctx.stroke();
    ctx.restore();
  }
  const chargeAge=now-(enemy._irisChargeStarted??-Infinity);
  if(!scanning&&!reducedMotion&&enemy.fire<=0&&
     chargeAge>=0&&chargeAge<1.1){
    // The contracting ring warns of the next shot without a costly particle.
    const progress=clamp(chargeAge/.36,0,1);
    ctx.save();ctx.strokeStyle=`rgba(207,153,255,${.45+.48*progress})`;
    ctx.lineWidth=1.2+progress*.7;
    ctx.beginPath();ctx.arc(0,0,side*(.27-.16*progress),0,Math.PI*2);
    ctx.stroke();ctx.restore();
  }
  ctx.restore();
  if(scanning&&!enemy.signalIntel){
    // Signal patrols already render their shared !/? indicator in game.js.
    // Ordinary scouts get the same readable first-contact/search cue.
    ctx.save();
    ctx.fillStyle='rgba(12,8,26,.86)';
    ctx.strokeStyle='#b78cff';ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(enemy.x+side*.64,enemy.y-side*.80,6,0,Math.PI*2);
    ctx.fill();ctx.stroke();
    ctx.fillStyle='#e9d8ff';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='bold 9px system-ui';
    ctx.fillText(enemy._irisScanMode==='lost'?'?':'!',
      enemy.x+side*.64,enemy.y-side*.80+.4);
    ctx.restore();
  }
  return true;
}

