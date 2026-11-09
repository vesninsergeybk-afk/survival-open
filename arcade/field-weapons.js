import {combatTargets,targetAlive,targetDistance,clearLine,damageTarget} from './combat-targets.js?v=mouse-area-1-triangle-defense-1-frontier-siege-1';
import {contactOnCircle} from './impact-geometry.js?v=arcade-impact-51';
import {emitWeaponFx} from './weapon-fx.js';

export const FIELD_WEAPONS=Object.freeze({
 ion:{id:'ion',name:'Ионный проводник',short:'Ион',capacity:3,rentalCost:26,chargeCost:8,cooldown:4.5},
 resonator:{id:'resonator',name:'Резонатор',short:'Резонанс',capacity:3,rentalCost:26,chargeCost:8,cooldown:6}
});
export const RESONANCE=Object.freeze({range:485,linkRange:260,duration:4,fraction:.35,maxTargets:3});
export const fieldWeapon=loan=>FIELD_WEAPONS[loan?.moduleId||'ion'];
export function createFieldLoan(moduleId,sourceId,now=0,assignment=null){
 const spec=FIELD_WEAPONS[moduleId];if(!spec)return null;
 return {moduleId,sourceId,charges:spec.capacity,cooldownUntil:now,used:0,missionStarted:!!assignment,
  assignment,returnDue:false};
}
export function missionAssignment(operation,contract){
 return operation?{kind:'operation',id:operation.id,baseId:operation.baseId}:
  contract&&!(Number.isFinite(contract.goal)&&contract.progress>=contract.goal)?
   {kind:'contract',id:contract.choiceId||contract.kind,baseId:contract.baseId}:null;
}
export function bindFieldLoan(loan,assignment){
 if(loan&&!loan.assignment&&!loan.returnDue&&assignment){loan.assignment=assignment;loan.missionStarted=true;}
}
export function finishFieldAssignment(loan,kind,mission){
 if(loan?.assignment?.kind===kind&&loan.assignment.baseId===mission?.baseId&&
  loan.assignment.id===(kind==='operation'?mission.id:mission.choiceId||mission.kind))loan.returnDue=true;
}
export function fieldLoanOffer(base,state,moduleId='ion'){
 if(!base?.active||base.enemy)return null;
 const spec=FIELD_WEAPONS[moduleId];if(!spec)return null;
 const loan=state.fieldLoan||state.ionLoan;
 if(loan)return {mode:'return',cost:0,charges:loan.charges,reason:'Сначала верните текущий полевой модуль.'};
 if(base.type==='dock'&&base.id==='0:0'&&!(state.fieldTrialTaken??state.ionTrialTaken))
  return {mode:'trial',cost:0,charges:spec.capacity,reason:''};
 if(base.type==='arsenal')return {mode:'rent',cost:spec.rentalCost,charges:spec.capacity,
  reason:(state.ore||0)<spec.rentalCost?'Не хватает '+(spec.rentalCost-(state.ore||0))+' ед. сплава':''};
 return null;
}
export function refillQuote(loan,ore){
 const spec=loan&&fieldWeapon(loan);
 return !spec?{ok:false,reason:'Сначала возьмите полевой модуль'}:
  loan.returnDue?{ok:false,reason:'Верните модуль после задания'}:
  loan.charges>=spec.capacity?{ok:false,reason:'Боезапас полон'}:
  ore<spec.chargeCost?{ok:false,reason:'Не хватает '+(spec.chargeCost-ore)+' ед. сплава'}:
  {ok:true,cost:spec.chargeCost,charges:loan.charges+1};
}
export function fieldReady(loan,now){
 if(!loan)return {ok:false,reason:'Возьмите полевой модуль на станции и установите его в ангаре.'};
 if(loan.charges<=0)return {ok:false,reason:'Заряды закончились. Пополните боезапас на станции.'};
 if(loan.cooldownUntil>now)return {ok:false,reason:'Модуль заряжается: '+Math.ceil(loan.cooldownUntil-now)+' с'};
 return {ok:true};
}
export function planResonance(game){
 if(game.fieldLoan&&(game.fieldLoan.moduleId||'ion')!=='resonator')return {ok:false,reason:'Для связи группы нужен резонатор.'};
 const ready=fieldReady(game.fieldLoan,game.time);if(!ready.ok)return ready;
 const candidates=combatTargets(game,RESONANCE.range).sort((a,b)=>
  targetDistance(game.player,a.target)-targetDistance(game.player,b.target)).slice(0,24);
 let best=[];
 for(const start of candidates){
  if(!clearLine(game,game.player,start.target))continue;
  const linked=[start,...candidates.filter(c=>c!==start&&targetDistance(c.target,start.target)<=RESONANCE.linkRange&&
   clearLine(game,start.target,c.target)).slice(0,RESONANCE.maxTargets-1)];
  if(linked.length>best.length)best=linked;
  if(best.length===RESONANCE.maxTargets)break;
 }
 if(best.length<2)return {ok:false,reason:'Резонатору нужны две близкие цели без каменного экрана.'};
 return {ok:true,effect:{until:game.time+RESONANCE.duration,targets:best},
  chargesAfter:game.fieldLoan.charges-1,cooldownUntil:game.time+FIELD_WEAPONS.resonator.cooldown};
}
export function resonanceDamage(game,item,dealt){
 for(const group of game.fieldEffects||[]){
  if(group.until<=game.time||!group.targets.some(x=>x.target===item.target))continue;
  for(const other of group.targets){
   if(other.target===item.target||!targetAlive(game,other)||
    targetDistance(other.target,item.target)>RESONANCE.linkRange||!clearLine(game,item.target,other.target))continue;
   const p=contactOnCircle(other.target.x,other.target.y,other.target.r||22,item.target.x,item.target.y);
   damageTarget(game,other,dealt*RESONANCE.fraction,'resonance',p,true);
   emitWeaponFx(game,'resonator',item.target,p);
  }
 }
}
export function updateFieldEffects(game){
 game.fieldEffects=(game.fieldEffects||[]).filter(effect=>{
  effect.targets=effect.targets.filter(t=>targetAlive(game,t));
  return effect.until>game.time&&effect.targets.length>=2;
 }).slice(-1);
}
export function drawFieldEffects(ctx,game){
 for(const effect of game.fieldEffects||[]){
  if(effect.until<=game.time)continue;
  const targets=effect.targets.filter(t=>targetAlive(game,t));
  const quality=game.fps>=33;
  const remaining=Math.min(1,(effect.until-game.time)/.6);
  ctx.save();ctx.strokeStyle='#bc8ae5';ctx.lineWidth=quality?1.7:1.3;
  ctx.globalAlpha=.7*remaining;
  for(let i=0;i<targets.length;i++){
   const a=targets[i].target;
   ctx.beginPath();ctx.arc(a.x,a.y,(a.r||25)+7,0,Math.PI*2);ctx.stroke();
   // A marked target is visibly part of the network, even when no damage is
   // being transferred. Fixed cardinal notches do not rely on animation.
   ctx.strokeStyle='#efd4ff';ctx.lineWidth=quality?2.2:1.6;
   const radius=(a.r||25)+11;
   for(let j=0;j<4;j++){
    const angle=j*Math.PI/2;
    ctx.beginPath();ctx.moveTo(a.x+Math.cos(angle)*(radius-3),a.y+Math.sin(angle)*(radius-3));
    ctx.lineTo(a.x+Math.cos(angle)*(radius+4),a.y+Math.sin(angle)*(radius+4));ctx.stroke();
   }
   ctx.strokeStyle='#bc8ae5';ctx.lineWidth=quality?1.7:1.3;
   for(const item of targets.slice(i+1))if(targetDistance(a,item.target)<=RESONANCE.linkRange&&clearLine(game,a,item.target)){
    ctx.setLineDash([7,8]);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(item.target.x,item.target.y);ctx.stroke();
    ctx.setLineDash([]);
   }
  }
  ctx.restore();
 }
}
