// Independent pilot disciplines. Each successive rank costs one more level
// point; old single-choice saves are read as the first rank of that discipline.
export const DOCTRINE_LEVELS=Object.freeze([4,7,11]);
export const DOCTRINES=Object.freeze([
 {id:'assault',title:'Штурмовик',max:3,desc:'Ближний бой: плазма сильнее вблизи, рывок усиливает наступление, мастерство создаёт ударную волну.'},
 {id:'command',title:'Командир',max:3,desc:'Назначает приоритетную цель даже без ведомых. Развивает совместный огонь и автоматически передаёт метку после уничтожения врага.'},
 {id:'prospect',title:'Старатель',max:3,desc:'Быстрее и тише добывает сплав. Добыча восстанавливает корабль, а затем даёт краткий боевой форсаж.'},
 {id:'countermaneuver',title:'Контрманёвр',max:3,desc:'Ускоряет восстановление рывка и отражает опасные выстрелы. Дальнейшие ранги расширяют защиту и возвращают энергию за успешный манёвр.'}
]);
export const doctrineRank=(state,id)=>{
 const saved=state?.doctrineRanks;
 const value=saved?.[id];
 if(Number.isInteger(value)&&value>=0)return Math.min(3,value);
 // Legacy single-doctrine save; never grant this rank twice once converted.
 return !saved||Object.values(saved).every(n=>!n)?(state?.doctrine===id?1:0):0;
};
export const doctrineCost=rank=>rank>=0&&rank<3?rank+1:Infinity;
export const doctrinePointsWord=count=>count===1?'очко':count<5?'очка':'очков';
export const doctrineMinLevel=rank=>DOCTRINE_LEVELS[rank]??Infinity;
export const doctrineSpent=ranks=>Object.values(ranks||{}).reduce((sum,rank)=>
  sum+(Number.isInteger(rank)&&rank>0?Math.min(3,rank)*(Math.min(3,rank)+1)/2:0),0);
export function normalizedDoctrineRanks(state={}){
 const result={};
 for(const {id} of DOCTRINES){const rank=doctrineRank(state,id);if(rank)result[id]=rank;}
 return result;
}
export const doctrineBuyReason=(state,id)=>{
 if(!DOCTRINES.some(d=>d.id===id))return 'Неизвестная доктрина';
 const rank=doctrineRank(state,id),cost=doctrineCost(rank);
 return rank>=3?'Ветка завершена':(state?.level||1)<doctrineMinLevel(rank)?
  'Нужен уровень '+doctrineMinLevel(rank):(state?.points||0)<cost?
  'Нужно '+cost+' '+doctrinePointsWord(cost)+' развития':'';
};
export function doctrineNextEffect(id,rank){
 const steps={
  assault:['В пределах 180 м плазма наносит на 22% больше урона, рельс и ракеты — на 12%.',
   'После рывка на 2,5 с ближний урон плазмы, рельса и ракет возрастает ещё на 18%.',
   'Ближнее попадание плазмы или рельса раз в 4 с поражает ударной волной соседние цели в радиусе 80 м.'],
  command:['Автоматические орудия помечают цель на 3 с; повторные попадания по ней сильнее на 10%. Ведомые рядом получают +25% к урону.',
   'Метка держится 4 с; ваши повторные попадания сильнее на 16%, ведомые — на 35% в расширенном радиусе.',
   'При уничтожении отмеченной цели метка переходит ближайшему врагу. Повторные попадания сильнее на 22%, ведомые — на 45%.'],
  prospect:['Экстрактор +15% мощности, +1 сплав за добытый астероид, шум добычи −20%.',
   'Каждый добытый экстрактором астероид чинит 4 ед. корпуса или восстанавливает 8 ед. щита.',
   'После добычи на 7 с корабль ускоряется на 12%, а автоматическая плазма бьёт на 10% сильнее.'],
  countermaneuver:['Перезарядка рывка быстрее на 12%. Рывок отражает до 2 небольших снарядов, которые действительно летят в корабль.',
   'Перезарядка быстрее на 18%. Рывок отражает до 3 снарядов, включая средние, в большем радиусе.',
   'Перезарядка быстрее на 24%. До 4 отражений за рывок; успешная защита восполняет щит на 6 ед. или корпус на 3 ед.']
 };
 return steps[id]?.[rank]||'Ветка завершена';
}
export function assaultPlasmaBonus(game,distance,weapon='plasma'){
 const rank=doctrineRank(game,'assault');
 if(!rank||distance>180)return 1;
 return (weapon==='plasma'?1.22:1.12)+((rank>=2&&game.assaultBurstUntil>game.time)?0.18:0);
}
export function commandMarkHit(game,target){
 const rank=doctrineRank(game,'command');
 if(!rank||!target||!Number.isFinite(game.time))return 1;
 const mark=game.commandMark;
 if(!mark||mark.target?.hp<=0||mark.until<game.time){
  game.commandMark={target,until:game.time+(rank>=2?4:3)};
  game.heritage?.vfx?.nova?.(target.x,target.y,23,'cyan');
  return 1;
 }
 if(mark.target!==target)return 1;
 mark.until=game.time+(rank>=2?4:3);
 return 1+[0,.10,.16,.22][rank];
}
export function commandAllyBonus(game,ally){
 const rank=doctrineRank(game,'command'),range=rank>=3?360:rank>=2?300:240;
 if(!rank||!ally||!game.player||Math.hypot(ally.x-game.player.x,ally.y-game.player.y)>range)return 1;
 return [1,1.25,1.35,1.45][rank];
}
export function transferCommandMark(game,defeated){
 if(doctrineRank(game,'command')<3||game.commandMark?.target!==defeated)return false;
 const next=(game.enemies||[]).filter(e=>e!==defeated&&e.hp>0&&
  Math.hypot(e.x-defeated.x,e.y-defeated.y)<300)
  .sort((a,b)=>Math.hypot(a.x-defeated.x,a.y-defeated.y)-Math.hypot(b.x-defeated.x,b.y-defeated.y))[0];
 game.commandMark=next?{target:next,until:game.time+4}:null;
 if(next)game.heritage?.vfx?.nova?.(next.x,next.y,29,'cyan');
 return !!next;
}
export function assaultShockwave(game,target,damage){
 if(doctrineRank(game,'assault')<3||game.assaultPulseReadyAt>game.time||!target||
  Math.hypot(target.x-game.player.x,target.y-game.player.y)>180)return 0;
 const nearby=(game.enemies||[]).filter(enemy=>enemy!==target&&enemy.hp>0&&
  Math.hypot(enemy.x-target.x,enemy.y-target.y)<=80).slice(0,3);
 if(!nearby.length)return 0;
 game.assaultPulseReadyAt=game.time+4;
 for(const enemy of nearby)game.damageEnemy?.(enemy,Math.min(28,damage*.3),'beam');
 game.heritage?.vfx?.nova?.(target.x,target.y,80,'orange');
 return nearby.length;
}
export function prospectMiningBonus(game){return 1+(doctrineRank(game,'prospect')>=1?0.15:0);}
export function prospectNoiseMultiplier(game){return doctrineRank(game,'prospect')>=1?0.8:1;}
export function prospectMineCompleted(game){
 const rank=doctrineRank(game,'prospect'),p=game.player;
 if(!p||rank<2)return false;
 const shieldLimit=Math.max(p.shield||0,16+(game.skillRanks?.shield||0)*24);
 if(((game.skillRanks?.shield||0)>0||p.shield>0)&&p.shield<shieldLimit)
  p.shield=Math.min(shieldLimit,p.shield+8);
 else p.hp=Math.min(p.maxHp,p.hp+4);
 if(rank>=3)game.prospectSurgeUntil=game.time+7;
 return true;
}
export function doctrinePlasmaSurge(game){return doctrineRank(game,'prospect')>=3&&game.prospectSurgeUntil>game.time?1.1:1;}
export function doctrineEngineSurge(game){return doctrineRank(game,'prospect')>=3&&game.prospectSurgeUntil>game.time?1.12:1;}
export function doctrineDashCooldown(game){return [1,0.88,0.82,0.76][doctrineRank(game,'countermaneuver')];}
