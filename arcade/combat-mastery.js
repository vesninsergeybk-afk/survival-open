// Earned skills: regular ranks improve familiar moves; milestone ranks unlock
// visible tactical properties. Diminishing bonuses keep very long saves fair.
export const MASTERIES=Object.freeze({
 ace:{name:'Чистая охота',group:'Бой',first:8,growth:1.6,cap:.09,
  task:'Уничтожайте обычных врагов лично, не получая урона.',
  effect:'Урон личного оружия',perk:'Дополнительный опыт за личные победы'},
 comet:{name:'Верная комета',group:'Оружие',first:3,growth:1.65,cap:.16,
  task:'Попадайте «Голубой кометой» по врагам несколько выстрелов подряд. Промах обнуляет серию.',
  effect:'Урон «Голубой кометы»',perk:'Шире область взрыва кометы'},
 wing:{name:'Слаженное звено',group:'Дроны',first:6,growth:1.65,cap:.13,
  task:'Помогайте наёмным дронам добивать врагов. Засчитывается решающий удар ведомого.',
  effect:'Урон наёмных дронов',perk:'Ведомые понемногу чинятся рядом с пилотом'},
 evasive:{name:'Пилотаж под огнём',group:'Пилот',first:8,growth:1.65,cap:.09,
  task:'На скорости уклоняйтесь от вражеских снарядов, проходящих вплотную к кораблю.',
  effect:'Скорость корабля',perk:'Быстрее восстанавливается рывок'},
 survivor:{name:'Боевая выдержка',group:'Корпус',first:10,growth:1.55,cap:.08,
  task:'Переживайте попадания вне защитных полей станций с интервалом не менее трёх секунд.',
  effect:'Снижение входящего урона',perk:'Щит быстрее восстанавливается после удара'},
 mining:{name:'Геологическая сноровка',group:'Добыча',first:3,cap:.08,
  task:'Добывайте экстрактором богатые астероиды с янтарными прожилками.',
  effect:'Скорость расщепления породы',perk:'Повышенная эффективность экстрактора'},
 operations:{name:'Полевой опыт',group:'Операции',first:2,cap:.06,
  task:'Завершайте поручения и особые операции с полной наградой.',
  effect:'Опыт за полностью выполненные задания',perk:'Ещё +4% опыта за каждую особую ступень'}
});
export const MASTERY_MILESTONES=Object.freeze([3,8,16,32]);
export const createCombatMastery=()=>({version:2,tracks:Object.fromEntries(
 Object.keys(MASTERIES).map(id=>[id,{rank:0,progress:0}])),lastImpactAt:-1000});
export function masteryGoal(id,rank){
 const spec=MASTERIES[id];if(!spec)return 0;
 const n=Math.max(0,rank);
 return Math.max(1,Math.min(100000,Math.ceil(spec.first*(1+.82*n+.105*n*n))));
}
export const masteryBonus=(state,id)=>{
 const spec=MASTERIES[id],rank=state?.tracks?.[id]?.rank||0;
 return spec?spec.cap*(1-Math.pow(.947,Math.max(0,rank))):0;
};
export function masteryPerkTier(state,id){
 const rank=state?.tracks?.[id]?.rank||0;
 return MASTERY_MILESTONES.filter(goal=>rank>=goal).length;
}
export function masteryNextMilestone(state,id){
 const rank=state?.tracks?.[id]?.rank||0;
 return MASTERY_MILESTONES.find(goal=>goal>rank)||null;
}
export function masteryOperationReward(state,data){
 if(!Number.isFinite(data)||data<0)return 0;
 return Math.round(data*(1+masteryBonus(state,'operations')+
  .04*masteryPerkTier(state,'operations')));
}
export function masteryProgress(state,id,amount=1){
 if(!state||!MASTERIES[id]||!Number.isInteger(amount)||amount<0||amount>10000)return null;
 const track=state.tracks[id],old=track.rank;
 if(track.rank>=10000)return null;
 track.progress+=amount;
 while(track.progress>=masteryGoal(id,track.rank)&&track.rank<10000){
  track.progress-=masteryGoal(id,track.rank);track.rank++;
 }
 return track.rank>old?{id,name:MASTERIES[id].name,rank:track.rank,
  perkUnlocked:MASTERY_MILESTONES.some(goal=>goal>old&&goal<=track.rank)}:null;
}
export function masteryMiss(state,id){
 if(state?.tracks?.[id])state.tracks[id].progress=0;
}
export function validCombatMastery(state){
 if(state===undefined)return true;
 if(!state||![1,2].includes(state.version)||!state.tracks||
  !Number.isFinite(state.lastImpactAt)||state.lastImpactAt< -1000||state.lastImpactAt>1e9)return false;
 const ids=state.version===1?['ace','comet','wing','evasive','survivor']:Object.keys(MASTERIES);
 return Object.keys(state.tracks).length===ids.length&&ids.every(id=>{
  const t=state.tracks[id];
  const legacyGoal=Math.min(100000,Math.ceil(MASTERIES[id].first*
   Math.pow(MASTERIES[id].growth,Math.min(32,Math.max(0,t?.rank||0)))));
  return t&&Number.isInteger(t.rank)&&t.rank>=0&&t.rank<=10000&&
   Number.isInteger(t.progress)&&t.progress>=0&&
   t.progress<(state.version===1?legacyGoal:masteryGoal(id,t.rank));
 });
}
export function migrateCombatMastery(state){
 if(!state)return createCombatMastery();
 if(state.version===2)return state;
 if(!validCombatMastery(state))return createCombatMastery();
 const next=createCombatMastery();next.lastImpactAt=state.lastImpactAt;
 for(const id of Object.keys(state.tracks)){
  const old=state.tracks[id];
  const legacyGoal=Math.min(100000,Math.ceil(MASTERIES[id].first*
   Math.pow(MASTERIES[id].growth,Math.min(32,old.rank))));
  next.tracks[id]={rank:old.rank,progress:Math.min(masteryGoal(id,old.rank)-1,
   Math.floor(old.progress/legacyGoal*masteryGoal(id,old.rank)))};
 }
 return next;
}
