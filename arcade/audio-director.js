/**
 * Аркадный музыкальный режиссёр. Оценивает угрозу без вмешательства
 * в боевой баланс; подбор конкретных композиций выполняет музыкальный плеер.
 */
export const MUSIC_SCENES = Object.freeze({
  drift: {track:'exploration',level:0,volume:1,label:'Исследование'},
  alert: {track:'tension',level:1,volume:.88,label:'Нарастание угрозы'},
  battle: {track:'combat',level:2,volume:1,label:'Схватка'},
  siege: {track:'boss',level:3,volume:.94,label:'Штурм базы'},
  recovery: {track:'exploration',level:0,volume:.79,label:'Передышка'}
});
const clamp = (value,low,high)=>Math.max(low,Math.min(high,value));
export function spatialCue(point,listener,viewWidth=960){
  if(!point||!listener||!Number.isFinite(point.x)||!Number.isFinite(point.y))return {};
  const dx=point.x-listener.x,dy=point.y-listener.y;
  const distance=Math.hypot(dx,dy);
  return {
    pan:clamp(dx/Math.max(200,viewWidth*.52),-.85,.85),
    intensity:clamp(1-distance/1250,0,1)
  };
}
export function assessMusicThreat({nearby=0,heavy=false,siege=false,
  warning=false,recentDamage=false,critical=false}={}){
  if(siege||heavy)return 'siege';
  if(nearby>=3||(nearby>=1&&recentDamage))return 'battle';
  if(nearby>0||warning||recentDamage||critical)return 'alert';
  return 'drift';
}
export class AdaptiveMusicDirector {
 constructor(){
  this.scene='drift';this.pending='';this.pendingTime=0;
  this.recoveryTime=0;this.pulseClock=0;this.openingElapsed=0;
 }
 reset(){this.scene='drift';this.pending='';this.pendingTime=0;this.recoveryTime=0;this.pulseClock=0;this.openingElapsed=0;}
 update(dt,signals={}){
  const step=clamp(Number(dt)||0,0,4);
  this.openingElapsed+=step;
  let wanted=assessMusicThreat(signals);
  // Give the opening a chance to establish the world. Actual damage,
  // critical hull and danger warnings still interrupt immediately.
  if(this.openingElapsed<24&&wanted==='alert'&&!signals.recentDamage&&
     !signals.critical&&!signals.warning)wanted='drift';
  const prior=this.scene;
  const currentLevel=MUSIC_SCENES[prior].level;
  const wantedLevel=MUSIC_SCENES[wanted].level;
  if(wanted===prior||(prior==='recovery'&&wanted==='drift')){
   this.pending='';this.pendingTime=0;
  }else if(wantedLevel>currentLevel){
   this.scene=wanted;this.pending='';this.pendingTime=0;this.recoveryTime=0;
  }else if(wantedLevel<currentLevel){
   if(this.pending!==wanted){this.pending=wanted;this.pendingTime=0;}
   this.pendingTime+=step;
   if(this.pendingTime>=5.5){
    this.scene=wanted==='drift'&&currentLevel>=2?'recovery':wanted;
    this.pending='';this.pendingTime=0;this.recoveryTime=0;
   }
  }else if(wanted!==prior){
   this.scene=wanted;this.pending='';this.pendingTime=0;
  }
  if(this.scene==='recovery'){
   if(wanted!=='drift')this.scene=wanted;
   else {this.recoveryTime+=step;if(this.recoveryTime>=9)this.scene='drift';}
  }
  this.pulseClock+=step;
  const pulse=this.scene==='alert'&&this.pulseClock>=9;
  if(pulse)this.pulseClock=0;
  return {scene:this.scene,...MUSIC_SCENES[this.scene],changed:this.scene!==prior,pulse};
 }
}
