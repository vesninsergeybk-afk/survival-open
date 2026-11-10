import {contactOnCircle} from './impact-geometry.js?v=arcade-impact-51';
import {advanceCoreRepulsion} from './core-rock-clearance.js';

/* Lightweight resource interaction: deterministic local rocks, no new particles or physics engine. */
// Holding E starts extraction: the primary alloy source. Incidental beam and meteor
// fragments are intentionally small rewards.
// Extractor emissions create a visible trade-off: richer ore is louder.
// A response patrol can arrive only after the opening encounter has begun.
export const MINING_NOISE=Object.freeze({
 ordinary:27,rich:42,warn:15,scout:20,patrol:75,clear:12,
 decay:2.4,firstPatrolAt:12
});
export const miningSignal=noise=>Math.max(0,Math.min(100,
 Math.round(Math.max(0,noise)/MINING_NOISE.patrol*100)));
// The first geology rank buys one quieter extraction choice, without changing yield.
// Quiet laboratory equipment remains a separate, multiplicative improvement.
export const extractionNoise=(rock,miningRank=0,quietLab=false)=>
 (rock.rich?MINING_NOISE.rich:MINING_NOISE.ordinary)*
 (miningRank>=1?.84:1)*(quietLab?.68:1);
// Extraction emissions follow visible damage to a rock. The cumulative fraction
// prevents partial mining, pauses, or prior weapon damage from avoiding the noise budget.
export function extractionNoiseDelta(rock,miningRank=0,quietLab=false){
 const maxHp=Math.max(1,rock.maxHp||rock.hp||1);
 const progress=Math.min(1,Math.max(0,(maxHp-rock.hp)/maxHp));
 const already=Math.min(1,Math.max(0,rock.extractionNoiseProgress||0));
 const next=Math.max(already,progress);
 rock.extractionNoiseProgress=next;
 return extractionNoise(rock,miningRank,quietLab)*(next-already);
}
export const extractorStats = (rank,miningRank=0) => ({
 range:172+Math.min(3,Math.max(0,rank))*10,
 damagePerSecond:27+Math.min(3,Math.max(0,rank))*7+Math.min(4,Math.max(0,miningRank))*2.5,
 bonus:1+Math.ceil(Math.min(3,Math.max(0,rank))/2)
});
export const rockYield = (rock,kind,skills={}) => {
 if(kind==='auto')return rock.rich?2:1;
 if(kind==='strike')return rock.rich?5:2;
 return (rock.rich?8:3)+Math.floor(Math.min(4,Math.max(0,skills.mining||0))/2)+
  extractorStats(skills.extractor||0,skills.mining||0).bonus+
  ((skills.prospectRank||0)>0||skills.doctrine==='prospect'?1:0);
};
export function miningTarget(rocks,player,previous,range) {
 if(previous?.alive&&Math.hypot(previous.x-player.x,previous.y-player.y)<range+previous.r*.3)
  return previous;
 let nearest=null,closest=range;
 for(const rock of rocks) {
  if(!rock.alive)continue;
  const distance=Math.hypot(rock.x-player.x,rock.y-player.y);
  if(distance<closest){nearest=rock;closest=distance;}
 }
 return nearest;
}
export function impactRock(rock,damage,sourceX,sourceY,kind='auto') {
 if(!rock.alive||damage<=0)return false;
 rock.hp=Math.max(0,rock.hp-damage);
 rock.flash=Math.max(rock.flash||0,kind==='extract'?.26:kind==='strike'?1:.68);
 if(kind==='strike')rock.heat=1;
 const dx=rock.x-sourceX,dy=rock.y-sourceY,d=Math.hypot(dx,dy);
 const angle=d>1?Math.atan2(dy,dx):(rock.x*.13+rock.y*.27);
 const impulse=Math.min(115,damage*1.18);
 rock.vx=(rock.vx||0)+Math.cos(angle)*impulse;
 rock.vy=(rock.vy||0)+Math.sin(angle)*impulse;
 rock.spinVelocity=(rock.spinVelocity||0)+Math.sin(angle*2)*impulse*.0014;
 if(rock.hp<=0){rock.alive=false;return true;}
 return false;
}
export function updateRockMotion(rock,dt) {
 if(!rock.alive)return;
 // A newly formed territorial socket is stronger than ordinary hit recoil.
 // Let its dedicated animation finish before applying the cell-bound leash.
 if(advanceCoreRepulsion(rock,dt))return;
 // Most procedural rocks are untouched. Their position, angle and overlays
 // cannot change until an impact wakes them, even in the wider zoomed view.
 if(!rock.vx&&!rock.vy&&!rock.spinVelocity&&!rock.flash&&!rock.heat)return;
 rock.flash=Math.max(0,(rock.flash||0)-dt*2.7);
 rock.heat=Math.max(0,(rock.heat||0)-dt*.65);
 const drag=Math.exp(-3.1*dt);
 rock.vx=(rock.vx||0)*drag;rock.vy=(rock.vy||0)*drag;
 rock.x+=(rock.vx||0)*dt;rock.y+=(rock.vy||0)*dt;
 rock.spin=(rock.spin||0)+(rock.spinVelocity||0)*dt;
 rock.spinVelocity=(rock.spinVelocity||0)*Math.exp(-2.3*dt);
 // Rocks live in their original procedural cell. Keep displacement bounded.
 const ox=rock.originX??rock.x,oy=rock.originY??rock.y;
 const away=Math.hypot(rock.x-ox,rock.y-oy);
 if(away>86){const k=86/away;rock.x=ox+(rock.x-ox)*k;rock.y=oy+(rock.y-oy)*k;
  rock.vx*=.12;rock.vy*=.12;}
}
export function drawRockScars(ctx,rock) {
 const max=Math.max(1,rock.maxHp),wound=Math.max(0,1-rock.hp/max);
 if(wound<.08 && (rock.flash||0)<.02 && (rock.heat||0)<.02)return;
 ctx.save();ctx.translate(rock.x,rock.y);ctx.rotate(rock.spin||0);
 ctx.beginPath();ctx.arc(0,0,rock.r*.95,0,Math.PI*2);ctx.clip();
 const count=Math.max(1,Math.ceil(wound*5));
 for(let i=0;i<count;i++){
  const a=(i*2.399963+rock.originX*.013+rock.originY*.021);
  const len=rock.r*(.35+Math.min(.5,wound*.7));
  ctx.beginPath();ctx.moveTo(Math.cos(a)*rock.r*.14,Math.sin(a)*rock.r*.14);
  ctx.lineTo(Math.cos(a+.22)*len*.55,Math.sin(a+.22)*len*.55);
  ctx.lineTo(Math.cos(a-.08)*len,Math.sin(a-.08)*len);
  ctx.strokeStyle=rock.rich?'rgba(255,168,82,.92)':'rgba(157,217,244,.83)';
  ctx.lineWidth=rock.rich?1.9:1.4;ctx.shadowBlur=4;ctx.shadowColor=ctx.strokeStyle;ctx.stroke();
 }
 if((rock.heat||0)>.02){ctx.globalAlpha=rock.heat*.26;
  ctx.fillStyle='#ff8732';ctx.beginPath();ctx.arc(0,0,rock.r,0,Math.PI*2);ctx.fill();}
 ctx.restore();
 if((rock.flash||0)>.01){ctx.save();ctx.globalAlpha=rock.flash*.8;ctx.strokeStyle='#ffe0ab';
  ctx.lineWidth=2;ctx.beginPath();ctx.arc(rock.x,rock.y,rock.r+2,0,Math.PI*2);ctx.stroke();ctx.restore();}
}
export function drawExtraction(ctx,player,rock,time,rank,active) {
 if(!rock?.alive)return;
 ctx.save();
 const progress=Math.max(0,Math.min(1,1-rock.hp/Math.max(1,rock.maxHp)));
 ctx.strokeStyle=active?'#81ffff':'#7ed7eb70';ctx.lineWidth=active?3:1.5;
 ctx.beginPath();ctx.arc(rock.x,rock.y,rock.r+9,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();
 if(active) {
  const x=player.x,y=player.y;
  const lengthToRock=Math.hypot(rock.x-x,rock.y-y);
  // The beam stops on the rock surface, not inside the mineral texture.
  // If the player overlaps the rock, keep the old center fallback.
  const hit=lengthToRock>rock.r+1?
   contactOnCircle(rock.x,rock.y,rock.r,x,y):null;
  const dx=(hit?.x??rock.x)-x,dy=(hit?.y??rock.y)-y;
  const len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const phase=time*24,amp=5+rank;
  ctx.globalCompositeOperation='lighter';
  ctx.lineCap='round';ctx.lineJoin='round';
  for(let layer=0;layer<2;layer++){
   ctx.beginPath();ctx.moveTo(x,y);
   for(let j=1;j<=6;j++){
    const t=j/6,jitter=Math.sin(phase+j*2.7)*amp*Math.sin(Math.PI*t);
    ctx.lineTo(x+dx*t+nx*jitter,y+dy*t+ny*jitter);
   }
   ctx.strokeStyle=layer===0?'#319bee88':'#bbfff2';
   ctx.lineWidth=layer===0?8:2.1;ctx.shadowColor='#6feaff';
   ctx.shadowBlur=layer===0?12:4;ctx.stroke();
  }
  for(let j=2;j<=4;j++){const t=j/6,ox=x+dx*t,oy=y+dy*t;
   const jitter=Math.sin(phase+j*2.7)*amp*.7;
   ctx.beginPath();ctx.moveTo(ox,oy);
   ctx.lineTo(ox+nx*jitter*3+dx*.06,oy+ny*jitter*3+dy*.06);
   ctx.strokeStyle='#9cfbf9b8';ctx.lineWidth=1.2;ctx.stroke();}
 }
 ctx.restore();
 ctx.save();ctx.font='600 10px Inter,system-ui,sans-serif';ctx.textAlign='center';
 ctx.fillStyle=active?'#b7fff6':'#91d9e7';ctx.shadowColor='#000';ctx.shadowBlur=4;
 if(active)ctx.fillText('РАСЩЕПЛЕНИЕ · '+Math.round(progress*100)+'%',rock.x,rock.y-rock.r-19);
 ctx.restore();
}

/** Cheap world-space sonar rings: the player can see each working extractor's
 * acoustic footprint even before an investigating patrol arrives. */
export function drawMiningNoiseRings(ctx,rock,time,quiet=false,reducedMotion=false){
 if(!rock?.alive)return;
 const waves=reducedMotion?1:3;
 ctx.save();ctx.lineWidth=2;ctx.setLineDash([]);
 for(let i=0;i<waves;i++){
  const phase=reducedMotion?.55:((time*1.35+i/waves)%1);
  const radius=rock.r+14+phase*(quiet?105:205);
  const fade=(1-phase)*(quiet?.24:.55);
  ctx.strokeStyle=quiet?'rgba(118,246,221,'+fade.toFixed(3)+')':
   'rgba(255,194,111,'+fade.toFixed(3)+')';
  ctx.beginPath();ctx.arc(rock.x,rock.y,radius,0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();
}
