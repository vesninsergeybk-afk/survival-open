// Earned, permanent micro-upgrades. Ranks have a high technical save limit;
// benefits approach a modest limit so long runs cannot break combat balance.
export const MASTERIES=Object.freeze({
 ace:{name:'Чистая охота',group:'Бой',first:8,growth:1.6,cap:.09,
  task:'Уничтожайте обычных врагов лично, не получая урона.',
  effect:'Урон личного оружия'},
 comet:{name:'Верная комета',group:'Оружие',first:3,growth:1.65,cap:.16,
  task:'Попадайте «Голубой кометой» по врагам несколько выстрелов подряд. Промах обнуляет серию.',
  effect:'Урон «Голубой кометы»'},
 wing:{name:'Слаженное звено',group:'Дроны',first:6,growth:1.65,cap:.13,
  task:'Помогайте наёмным дронам добивать врагов. Засчитывается решающий удар ведомого.',
  effect:'Урон наёмных дронов'},
 evasive:{name:'Пилотаж под огнём',group:'Пилот',first:8,growth:1.65,cap:.09,
  task:'На скорости уклоняйтесь от вражеских снарядов, проходящих вплотную к кораблю.',
  effect:'Скорость корабля'},
 survivor:{name:'Боевая выдержка',group:'Корпус',first:10,growth:1.55,cap:.08,
  task:'Переживайте попадания вне защитных полей станций с интервалом не менее трёх секунд.',
  effect:'Снижение входящего урона'}
});
export const createCombatMastery=()=>({version:1,tracks:Object.fromEntries(
 Object.keys(MASTERIES).map(id=>[id,{rank:0,progress:0}])),lastImpactAt:-1000});
export function masteryGoal(id,rank){
 const spec=MASTERIES[id];if(!spec)return 0;
 return Math.max(1,Math.min(100000,Math.ceil(spec.first*Math.pow(spec.growth,Math.min(32,Math.max(0,rank))))));
}
export const masteryBonus=(state,id)=>{
 const spec=MASTERIES[id],rank=state?.tracks?.[id]?.rank||0;
 return spec?spec.cap*(1-Math.pow(.73,Math.max(0,rank))):0;
};
export function masteryProgress(state,id,amount=1){
 if(!state||!MASTERIES[id]||!Number.isInteger(amount)||amount<0||amount>10000)return null;
 const track=state.tracks[id],old=track.rank;
 if(track.rank>=10000)return null;
 track.progress+=amount;
 while(track.progress>=masteryGoal(id,track.rank)&&track.rank<10000){
  track.progress-=masteryGoal(id,track.rank);track.rank++;
 }
 return track.rank>old?{id,name:MASTERIES[id].name,rank:track.rank}:null;
}
export function masteryMiss(state,id){
 if(state?.tracks?.[id])state.tracks[id].progress=0;
}
export function validCombatMastery(state){
 if(state===undefined)return true;
 if(!state||state.version!==1||!state.tracks||
  !Number.isFinite(state.lastImpactAt)||state.lastImpactAt< -1000||state.lastImpactAt>1e9)return false;
 return Object.keys(state.tracks).length===Object.keys(MASTERIES).length&&
  Object.keys(MASTERIES).every(id=>{
   const t=state.tracks[id];return t&&Number.isInteger(t.rank)&&t.rank>=0&&t.rank<=10000&&
    Number.isInteger(t.progress)&&t.progress>=0&&t.progress<masteryGoal(id,t.rank);
  });
}
