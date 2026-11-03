// One manual weapon choice on top of the existing automatic plasma beam.
// No permanent inventory or persistence: all loans belong to the current run.
export const ION_CONDUCTOR = Object.freeze({
 charges:3,
 rentalCost:26,
 markDuration:5,
 markRadius:185,
 dischargeRange:485,
 chainRadius:235,
 maxTargets:3,
 cooldown:4.5,
 damage:Object.freeze([24,18,14])
});

const inRange=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<=r;
const markable=e=>!!e&&e.hp>0&&!e.converted&&!e.interceptCargo;

export function ionLoanOffer(base,state){
 if(!base?.active)return null;
 if(state.ionLoan)return {mode:'return',cost:0,charges:state.ionLoan.charges,
  reason:'Верните текущий модуль, прежде чем брать другой.'};
 if(base.type==='dock'&&base.id==='0:0'&&!state.ionTrialTaken)
  return {mode:'trial',cost:0,charges:ION_CONDUCTOR.charges,reason:''};
 if(base.type==='arsenal')return {
  mode:'rent',cost:ION_CONDUCTOR.rentalCost,charges:ION_CONDUCTOR.charges,
  reason:(state.ore||0)<ION_CONDUCTOR.rentalCost?
   'Не хватает '+(ION_CONDUCTOR.rentalCost-(state.ore||0))+' ед. сплава':''
 };
 return null;
}

export function createIonLoan(sourceId,now=0){
 return {sourceId,charges:ION_CONDUCTOR.charges,cooldownUntil:now,
  used:0,missionStarted:false};
}

export function markIonCluster(enemies,primary,now,loan){
 if(!loan||loan.charges<=0||!markable(primary))return [];
 const neighbors=enemies.filter(e=>e!==primary&&markable(e)&&
  inRange(primary,e,ION_CONDUCTOR.markRadius))
  .sort((a,b)=>Math.hypot(a.x-primary.x,a.y-primary.y)-
   Math.hypot(b.x-primary.x,b.y-primary.y));
 const targets=[primary,...neighbors.slice(0,ION_CONDUCTOR.maxTargets-1)];
 for(const e of targets)e.ionMarkUntil=now+ION_CONDUCTOR.markDuration;
 return targets;
}

export function planIonDischarge(enemies,player,now,loan){
 if(!loan)return {ok:false,reason:'Сначала возьмите пробный модуль в ангаре станции.'};
 if(loan.charges<=0)return {ok:false,reason:'Заряды закончились. Верните модуль в ангаре.'};
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
  const remaining=candidates.filter(e=>e!==start),chain=[start];
  while(chain.length<ION_CONDUCTOR.maxTargets){
   const from=chain[chain.length-1];
   const nearby=remaining.filter(e=>inRange(from,e,ION_CONDUCTOR.chainRadius))
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
 return {ok:true,targets:chain,damage:chain.map((_,i)=>ION_CONDUCTOR.damage[i]),
  chargesAfter:loan.charges-1,cooldownUntil:now+ION_CONDUCTOR.cooldown};
}
