import {FIELD_WEAPONS,fieldLoanOffer,createFieldLoan} from './field-weapons.js?v=weapons-cycle-2-regions-1-campaign-1';
// Ion behavior is one choice in the shared field-weapon rental.
// Loans are saved with the run and never enter the permanent blueprint inventory.
export const ION_CONDUCTOR = Object.freeze({
 charges:FIELD_WEAPONS.ion.capacity,
 masteryData:12,
 rentalCost:FIELD_WEAPONS.ion.rentalCost,
 markDuration:5,
 markRadius:185,
 dischargeRange:485,
 chainRadius:235,
 maxTargets:3,
 cooldown:FIELD_WEAPONS.ion.cooldown,
 damage:Object.freeze([38,30,22])
});

const inRange=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<=r;
const markable=e=>!!e&&e.hp>0&&!e.converted;

export const ionLoanOffer=(base,state)=>fieldLoanOffer(base,state,'ion');
export const createIonLoan=(sourceId,now=0)=>createFieldLoan('ion',sourceId,now);

export function markIonCluster(enemies,primary,now,loan,canLink=()=>true){
 if(!loan||loan.charges<=0||!primary||primary.converted)return [];
 const neighbors=enemies.filter(e=>e!==primary&&markable(e)&&
  inRange(primary,e,ION_CONDUCTOR.markRadius)&&canLink(primary,e))
  .sort((a,b)=>Math.hypot(a.x-primary.x,a.y-primary.y)-
   Math.hypot(b.x-primary.x,b.y-primary.y));
 const targets=[...(markable(primary)?[primary]:[]),...neighbors].slice(0,ION_CONDUCTOR.maxTargets);
 for(const e of targets)e.ionMarkUntil=now+ION_CONDUCTOR.markDuration;
 return targets;
}

export const ionDamage=(rank=0)=>ION_CONDUCTOR.damage.map(d=>d*(1+rank*.2));

export function planIonDischarge(enemies,player,now,loan,canLink=()=>true,calibrationRank=0){
 if(!loan)return {ok:false,reason:'Возьмите ионный проводник на станции и установите его в ангаре.'};
 if((loan.moduleId||'ion')!=='ion')return {ok:false,reason:'Для разряда нужен ионный проводник.'};
 if(loan.charges<=0)return {ok:false,reason:'Заряды закончились. Пополните боезапас на станции.'};
 if(loan.cooldownUntil>now)return {ok:false,
  reason:'Ионный проводник заряжается: '+Math.ceil(loan.cooldownUntil-now)+' с'};
 const candidates=enemies.filter(e=>markable(e)&&e.ionMarkUntil>now&&
  inRange(player,e,ION_CONDUCTOR.dischargeRange)).sort((a,b)=>
   Math.hypot(a.x-player.x,a.y-player.y)-
   Math.hypot(b.x-player.x,b.y-player.y));
 if(!candidates.length)return {ok:false,
  reason:'Нет ионных меток. Подлетите к врагу: автоогонь подготовит разряд.'};
 // Prefer the largest available chain over an isolated nearest mark.
 // A small bounded set is evaluated only on a manual key press, never per frame.
 const chainFrom=start=>{
  if(!canLink(player,start))return [];
  const remaining=candidates.filter(e=>e!==start),chain=[start];
  while(chain.length<ION_CONDUCTOR.maxTargets){
   const from=chain[chain.length-1];
   const nearby=remaining.filter(e=>inRange(from,e,ION_CONDUCTOR.chainRadius)&&canLink(from,e))
    .sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-
     Math.hypot(b.x-from.x,b.y-from.y));
   if(!nearby.length)break;
   const target=nearby[0];
   chain.push(target);
   remaining.splice(remaining.indexOf(target),1);
  }
  return chain;
 };
 let chain=[];
 for(const start of candidates){
  const candidate=chainFrom(start);
  if(candidate.length>chain.length)chain=candidate;
  if(chain.length===ION_CONDUCTOR.maxTargets)break;
 }
 if(!chain.length)return {ok:false,reason:'Метки закрыты камнем. Смените позицию для разряда.'};
 return {ok:true,targets:chain,damage:chain.map((_,i)=>ionDamage(calibrationRank)[i]),
  chargesAfter:loan.charges-1,cooldownUntil:now+ION_CONDUCTOR.cooldown};
}

// A one-time learning reward, not repeatable per rental or per discharge.
export function ionMasteryAward(targetCount,alreadyAwarded){
 return !alreadyAwarded&&targetCount>=2?ION_CONDUCTOR.masteryData:0;
}

export function drawIonMark(ctx,target,now,radius=target?.r||22){
 if(!target||target.hp<=0||target.converted||target.captured||!(target.ionMarkUntil>now))return;
 ctx.save();ctx.strokeStyle='#77eaff';ctx.lineWidth=1.8;ctx.setLineDash([4,3]);
 ctx.beginPath();ctx.arc(target.x,target.y,radius+12,0,Math.PI*2);ctx.stroke();
 ctx.setLineDash([]);ctx.fillStyle='#c8ffff';ctx.font='bold 10px system-ui';ctx.textAlign='center';
 ctx.fillText('⚡',target.x,target.y-radius-16);ctx.restore();
}
