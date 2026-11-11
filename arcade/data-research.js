// Collected blue cores are a second, spendable progression currency. Research
// is permanent within a run, requires no level points, and can be bought in flight.
export const DATA_RESEARCH=Object.freeze({
 analysis:{name:'Бортовая аналитика',max:4,step:.075,
  description:'Каждый ранг даёт +7,5% опыта за новые действия: бои, задания и исследования.'},
 learning:{name:'Самообучение',max:4,step:.15,
  description:'Каждый ранг ускоряет развитие всех семи направлений автоматического мастерства на 15%.'},
 targeting:{name:'Адаптивное наведение',max:4,step:.035,
  description:'Каждый ранг увеличивает урон личного оружия на 3,5%, в том числе в поздней игре.'},
 thrusters:{name:'Бортовая навигация',max:4,step:.035,
  description:'Каждый ранг увеличивает обычную скорость корабля на 3,5%. Улучшение двигателя остаётся самостоятельным.'}
});
export const DATA_RESEARCH_COSTS=Object.freeze([40,90,160,250]);
export const DATA_PROTOCOL=Object.freeze({name:'Боевой протокол',cost:120,duration:90,
 damage:.15,speed:.10,
 description:'На 90 секунд усиливает личное оружие на 15% и скорость корабля на 10%. Можно включить снова после завершения.'});
export const createDataResearch=()=>({ranks:{},xpRemainder:0,aceRemainder:0,masteryRemainder:{},protocolUntil:0});
export function researchRank(state,id){
 const n=state?.research?.ranks?.[id];
 return Object.hasOwn(DATA_RESEARCH,id)&&Number.isInteger(n)?Math.max(0,Math.min(4,n)):0;
}
export const researchBonus=(state,id)=>researchRank(state,id)*(DATA_RESEARCH[id]?.step||0);
export function researchOffer(state,data,id){
 const spec=DATA_RESEARCH[id];if(!spec)return {ok:false,reason:'Неизвестное исследование'};
 const rank=researchRank(state,id),cost=DATA_RESEARCH_COSTS[rank];
 if(rank>=spec.max)return {ok:false,reason:'Исследование завершено',rank,cost:0};
 if(!Number.isFinite(data)||data<cost)return {ok:false,reason:'Нужно '+cost+' данных',rank,cost};
 return {ok:true,rank,cost};
}
export function buyDataResearch(state,player,id){
 if(!state||!player)return {ok:false,reason:'Данные пилота недоступны'};
 const offer=researchOffer(state,player?.data,id);
 if(!offer.ok)return offer;
 state.research??=createDataResearch();
 state.research.ranks[id]=offer.rank+1;
 player.data-=offer.cost;
 return {ok:true,cost:offer.cost,rank:offer.rank+1,data:player.data};
}
export const researchProtocolRemaining=(state,now)=>Math.max(0,Math.ceil(
 (state?.research?.protocolUntil||0)-(Number.isFinite(now)?now:0)));
export function researchProtocolOffer(state,data,now){
 const remaining=researchProtocolRemaining(state,now);
 if(remaining)return {ok:false,cost:DATA_PROTOCOL.cost,reason:'Действует ещё '+remaining+' с',remaining};
 if(!Number.isFinite(data)||data<DATA_PROTOCOL.cost)return {ok:false,cost:DATA_PROTOCOL.cost,
  reason:'Нужно '+DATA_PROTOCOL.cost+' данных',remaining:0};
 return {ok:true,cost:DATA_PROTOCOL.cost,remaining:0};
}
export function buyResearchProtocol(state,player,now){
 if(!state||!player||!Number.isFinite(now)||now<0)return {ok:false,reason:'Протокол недоступен'};
 const offer=researchProtocolOffer(state,player.data,now);
 if(!offer.ok)return offer;
 state.research??=createDataResearch();
 state.research.protocolUntil=now+DATA_PROTOCOL.duration;
 player.data-=DATA_PROTOCOL.cost;
 return {ok:true,cost:DATA_PROTOCOL.cost,until:state.research.protocolUntil,data:player.data};
}
export const researchProtocolBonus=(state,now,kind)=>
 researchProtocolRemaining(state,now)>0?(kind==='damage'?DATA_PROTOCOL.damage:
  kind==='speed'?DATA_PROTOCOL.speed:0):0;
export function researchedExperience(state,amount){
 if(!Number.isFinite(amount)||amount<=0)return 0;
 const bonus=researchBonus(state,'analysis');
 if(!bonus)return amount;
 state.research??=createDataResearch();
 const fractional=amount*bonus+state.research.xpRemainder;
 const whole=Math.floor(fractional+1e-9);
 state.research.xpRemainder=Math.max(0,Math.min(.999999999,fractional-whole));
 return amount+whole;
}
export function validDataResearch(research){
 if(research===undefined)return true;
 if(!research||typeof research!=='object'||Array.isArray(research)||
  !research.ranks||typeof research.ranks!=='object'||Array.isArray(research.ranks)||
  !Number.isFinite(research.xpRemainder)||research.xpRemainder<0||research.xpRemainder>=1||
  (research.aceRemainder!==undefined&&(!Number.isFinite(research.aceRemainder)||
   research.aceRemainder<0||research.aceRemainder>=1))||
  (research.protocolUntil!==undefined&&(!Number.isFinite(research.protocolUntil)||
   research.protocolUntil<0||research.protocolUntil>1e9+DATA_PROTOCOL.duration))||
  !research.masteryRemainder||typeof research.masteryRemainder!=='object'||Array.isArray(research.masteryRemainder))return false;
 return Object.entries(research.ranks).every(([id,n])=>Object.hasOwn(DATA_RESEARCH,id)&&
  Number.isInteger(n)&&n>=0&&n<=DATA_RESEARCH[id].max)&&
  Object.entries(research.masteryRemainder).every(([id,n])=>
   ['ace','comet','wing','evasive','survivor','mining','operations'].includes(id)&&
   Number.isFinite(n)&&n>=0&&n<1);
}
