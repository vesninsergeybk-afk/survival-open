import {hash} from './balance.js?v=arcade-network-20';
import {regionAt} from './regions.js?v=regions-1';
import {drawIonField} from './ion-field.js?v=regions-1';
export const STORM=Object.freeze({cell:2200,period:48,warningAt:28,dischargeAt:34,recoveryAt:38,chargeSeconds:18,disableSeconds:8});
export function stormFields(x,y,range=1600){
 const found=[],cell=STORM.cell;
 for(let cy=Math.floor((y-range)/cell);cy<=Math.floor((y+range)/cell);cy++)
  for(let cx=Math.floor((x-range)/cell);cx<=Math.floor((x+range)/cell);cx++){
   const field={id:cx+':'+cy,x:(cx+.2+hash(cx,cy,371)*.6)*cell,
    y:(cy+.2+hash(cx,cy,383)*.6)*cell,r:430+hash(cx,cy,391)*130,
    offset:Math.floor(hash(cx,cy,397)*STORM.period)};
   if(regionAt(field.x,field.y).id==='azure'&&Math.hypot(field.x-x,field.y-y)<range+field.r)found.push(field);
  }
 return found;
}
export function stormPhase(field,time){
 const t=Math.max(0,time)+field.offset,cycle=Math.floor(t/STORM.period),local=t%STORM.period;
 if(local<STORM.warningAt)return {state:'idle',cycle,remaining:STORM.warningAt-local};
 if(local<STORM.dischargeAt)return {state:'warning',cycle,remaining:STORM.dischargeAt-local,progress:(local-STORM.warningAt)/6};
 if(local<STORM.recoveryAt)return {state:'discharge',cycle,remaining:STORM.recoveryAt-local};
 return {state:'recovery',cycle,remaining:STORM.period-local};
}
const inside=(actor,field)=>Math.hypot(actor.x-field.x,actor.y-field.y)<field.r+(actor.r||0);
export function stormContact(actor,field,phase,now){
 if(phase.state!=='discharge'||!inside(actor,field))return 'none';
 const token=field.id+'/'+phase.cycle;
 actor.regionalStormHits??=[];
 if(actor.regionalStormHits.includes(token))return 'none';
 actor.regionalStormHits.push(token);actor.regionalStormHits=actor.regionalStormHits.slice(-8);
 if(actor.stormAdapted){
  if(now>=(actor.chargeDisabledUntil||0))actor.stormChargedUntil=now+STORM.chargeSeconds;
  return 'charge';
 }
 return 'damage';
}
export function stormWeaponDamage(enemy,damage,source,now){
 if(enemy.stormAdapted&&source==='ion'){
  const charged=enemy.stormChargedUntil>now;
  enemy.stormChargedUntil=0;enemy.chargeDisabledUntil=now+STORM.disableSeconds;
  return damage*(charged?1.5:1);
 }
 return damage;
}
export function updateRegionalStorms(game,dt){
 const p=game.player;
 // Geometry updates at most twice a second, independent of enemy count.
 if(game.time>=(game._stormQueryAt||0)){
  game.regionalStormFields=regionAt(p.x,p.y).id==='azure'?stormFields(p.x,p.y,Math.max(game.vw||1200,game.vh||800)):[];
  game._stormQueryAt=game.time+.5;
 }
 for(const field of game.regionalStormFields||[]){
  const phase=stormPhase(field,game.time);
  if(phase.state==='warning'&&inside(p,{...field,r:field.r+200})){
   const token=field.id+'/'+phase.cycle;
   game._stormWarnings??=[];
   if(!game._stormWarnings.includes(token)){
    game._stormWarnings.push(token);game._stormWarnings=game._stormWarnings.slice(-12);
    game.notice('Электрическая буря: покиньте отмеченную область. Светящиеся перехватчики используют разряд для зарядки.',6);
    game.heritage.play('ionWarning',2,field);
   }
  }
  if(stormContact(p,field,phase,game.time)==='damage')game.hurt(18,field);
  for(const e of game.enemies){
   if(e.hp>0&&stormContact(e,field,phase,game.time)==='damage')game.damageEnemy(e,22,'storm');
  }
  for(const a of game.allies){
   if(a.hp>0&&stormContact(a,field,phase,game.time)==='damage')game.hitAlly(a,18);
  }
 }
 for(const e of game.enemies)if(e.stormChargedUntil>game.time)e.fire=Math.max(-1,(e.fire??1)-dt*.5);
}
// Adapted interceptors visibly seek a charging field before resuming combat.
// Normal learning/tactics take over whenever no reachable field is active.
export function stormSeek(enemy,game,dt){
 if(!enemy.stormAdapted||enemy.stormChargedUntil>game.time||game.time<(enemy.chargeDisabledUntil||0))return false;
 const target=(game.regionalStormFields||[]).filter(f=>{
  const state=stormPhase(f,game.time).state;
  return (state==='warning'||state==='discharge')&&Math.hypot(f.x-enemy.x,f.y-enemy.y)<1000;
 }).sort((a,b)=>Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(b.x-enemy.x,b.y-enemy.y))[0];
 if(!target)return false;
 const dx=target.x-enemy.x,dy=target.y-enemy.y,d=Math.hypot(dx,dy)||1;
 const speed=d<target.r*.65?25:180;
 const blend=1-Math.exp(-4*dt),avoid=game.avoidance?.(enemy.x,enemy.y,38)||{x:0,y:0};
 enemy.vx+=((dx/d+avoid.x*.8)*speed-enemy.vx)*blend;
 enemy.vy+=((dy/d+avoid.y*.8)*speed-enemy.vy)*blend;
 enemy.x+=enemy.vx*dt;enemy.y+=enemy.vy*dt;
 enemy.angle=Math.atan2(enemy.vy,enemy.vx)+Math.PI/2;enemy.state='storm-charge';
 return true;
}
export function drawRegionalStorms(game,c,cam){
 for(const f of game.regionalStormFields||[]){
  if(f.x+f.r<cam.x||f.x-f.r>cam.x+cam.w||f.y+f.r<cam.y||f.y-f.r>cam.y+cam.h)continue;
  const phase=stormPhase(f,game.time);
  drawIonField(c,f,phase,game.time,game.fps,game.visuals.reducedMotion);
  if(phase.state==='warning'||phase.state==='discharge'){
   const x=Math.max(cam.x+160,Math.min(cam.x+cam.w-160,f.x));
   const y=Math.max(cam.y+115,Math.min(cam.y+cam.h-150,f.y-f.r-30));
   c.save();c.fillStyle='#071f31ed';c.fillRect(x-145,y-18,290,29);
   c.fillStyle='#dcffff';c.font='bold 12px system-ui';c.textAlign='center';
   c.fillText(phase.state==='warning'?'БУРЯ · РАЗРЯД ЧЕРЕЗ '+phase.remaining.toFixed(1)+' с':'БУРЯ · ОПАСНАЯ ОБЛАСТЬ',x,y);c.restore();
  }
 }
}
export function drawStormCharge(c,e,time){
 if(!e.stormAdapted)return;
 const charged=e.stormChargedUntil>time;
 c.save();c.strokeStyle=charged?'#d2fdff':'#6bc7dd';c.lineWidth=charged?3:1.5;c.setLineDash(charged?[]:[4,6]);
 c.beginPath();c.arc(e.x,e.y,e.r+7,0,Math.PI*2);c.stroke();
 if(charged||e.state==='storm-charge'){
  c.fillStyle='#bff5ff';c.font='bold 10px system-ui';c.textAlign='center';
  c.fillText(charged?'ЗАРЯЖЕН':'СБОР ЗАРЯДА',e.x,e.y-e.r-17);
 }
 c.restore();
}
