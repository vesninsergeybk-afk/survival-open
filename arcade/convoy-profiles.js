// A small authored grammar makes generated industrial shipments recognizable.
// All decisions are made at dispatch, then stored with the physical cargo.
export const POPULATION_CONVOY_PROFILES=Object.freeze({
 ore:Object.freeze({name:'Тяжёлый рудовоз',hull:1.25,speed:.82,radius:42,
  ore:22,data:12,color:'#ffc36f',
  escort:['fighter','gunship','fighter','flanker','fighter','scout','fighter','gunship']}),
 courier:Object.freeze({name:'Шифрокурьер',hull:.7,speed:1.32,radius:28,
  ore:8,data:20,color:'#79e7ff',
  escort:['flanker','scout','flanker','fighter']}),
 military:Object.freeze({name:'Военный эшелон',hull:1.12,speed:.94,radius:40,
  ore:17,data:21,color:'#ff8d97',
  escort:['gunship','fighter','flanker','fighter','healer','fighter','gunship']}),
 technical:Object.freeze({name:'Технический конвой',hull:.94,speed:1.04,radius:34,
  ore:14,data:17,color:'#a2efc2',
  escort:['healer','fighter','flanker','fighter','healer']})
});

export const LEGACY_POPULATION_ESCORT=Object.freeze([
 'fighter','flanker','fighter','scout','fighter','gunship','flanker','fighter'
]);

export function choosePopulationConvoyProfile(roll){
 const n=Number.isFinite(roll)?Math.max(0,Math.min(.999999,roll)):0;
 return n<.30?'ore':n<.50?'courier':n<.75?'military':'technical';
}

export function populationConvoyStats(role,tier,baseHp,baseSpeed){
 const spec=POPULATION_CONVOY_PROFILES[role];
 if(!spec)return null;
 const rank=Math.max(1,Math.min(5,Math.floor(tier)||1));
 return {
  cargoRole:role,
  hp:Math.round(baseHp*spec.hull),
  speed:Math.round(baseSpeed*spec.speed),
  r:spec.radius,
  rewardOre:spec.ore+2*(rank-1),
  rewardData:spec.data+(rank-1)
 };
}

export function populationConvoyEscort(cargo){
 return [...(POPULATION_CONVOY_PROFILES[cargo?.cargoRole]?.escort||LEGACY_POPULATION_ESCORT)];
}

export function populationConvoyTitle(cargo){
 return POPULATION_CONVOY_PROFILES[cargo?.cargoRole]?.name||'Промышленный конвой';
}

export function populationConvoyReward(cargo){
 return {ore:Number.isInteger(cargo?.rewardOre)&&cargo.rewardOre>=0?cargo.rewardOre:12,
  data:Number.isInteger(cargo?.rewardData)&&cargo.rewardData>=0?cargo.rewardData:9};
}
