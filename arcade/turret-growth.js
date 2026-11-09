// Every paid rank changes a concrete combat behavior. The four independently
// purchased paths belong to a single emplacement and are saved with it.
// Cost is up front (alloy + flux); ammunition and replacement drones still
// require a working contour and paid deliveries.
export const TURRET_GROWTH=Object.freeze({
 artillery:{name:'Громовая батарея',branches:{
  salvo:{name:'Орудийный залп',summary:'Дополнительные стволы. Каждый снаряд расходует заряд.',
   levels:[['Два ствола',24,3],['Три ствола',34,4],['Четыре ствола',46,6],
    ['Шесть стволов',62,9],['Десять стволов',90,14]]},
  tempo:{name:'Ритм батареи',summary:'Меньше пауза между залпами и быстрее зарядка магазина.',
   levels:[['Наводчик',19,2],['Облегчённый затвор',29,4],['Синхронизатор',42,6],['Шквал',60,9]]},
  radius:{name:'Площадь накрытия',summary:'Широкая зона взрыва полезнее против роёв.',
   levels:[['Осколочная оболочка',22,3],['Расширенный заряд',34,5],['Волновой взрыв',49,8],['Площадной огонь',70,11]]},
  reach:{name:'Дальность артиллерии',summary:'Снаряды летят дальше. Дальность стрельбы и радиус взрыва — разные характеристики.',
   levels:[['Дальний прицел',23,3],['Баллистический вычислитель',37,6],['Тяжёлый ускоритель',56,10]]},
  power:{name:'Мощность снаряда',summary:'Каждый выстрел наносит больше урона, но тратит больше флюкса. Вся батарея остаётся автоматической.',
   levels:[['Усиленный сердечник · 0,5 флюкса/снаряд',28,3],
    ['Тяжёлый заряд · 1 флюкс/снаряд',44,6],
    ['Осадный заряд · 2 флюкса/снаряд',66,10],
    ['Сверхмассивный заряд · 5 ед. флюкса/снаряд',95,16]]},
  seeker:{name:'Ракетная кассета',summary:'Автоматические ракеты корректируют полёт за манёвренной целью. Каждый ракетный заряд расходует дополнительный флюкс.',
   levels:[['Самонаведение · +0,25 флюкса/снаряд',35,5],
    ['Дальняя коррекция · ещё +0,25',56,9],
    ['Ударная ракета · ещё +0,50',85,15]]},
  anomaly:{name:'Экспериментальный заряд',summary:'Ионный удар, затем ложные цели и срыв строя.',
   levels:[['Ионный след',30,5],['Рой помех',46,8],['Контурный разряд',66,12]]}
 }},
 arc:{name:'Цепной разрядник',branches:{
  chain:{name:'Цепь разрядов',summary:'Разряд поражает больше соседних целей.',
   levels:[['Четыре цели',18,2],['Пять целей',27,3],['Семь целей',40,5]]},
  tempo:{name:'Частота импульсов',summary:'Чаще разряды и быстрее подача новых зарядов.',
   levels:[['Быстрый конденсатор',18,2],['Ускоритель',29,4],['Грозовой цикл',44,6]]},
  hold:{name:'Электрозахват',summary:'Дольше замедление и сильнее контроль толпы.',
   levels:[['Длинный импульс',20,3],['Полярная ловушка',31,5],['Обездвиживание',49,8]]},
  reach:{name:'Дальность разряда',summary:'Первая цель может находиться дальше; электрическая цепь по-прежнему перескакивает между соседями.',
   levels:[['Длинная дуга',22,3],['Дальняя катушка',34,5],['Грозовой проводник',49,8]]},
  anomaly:{name:'Возвратный разряд',summary:'Заряд отскакивает к плотному рою и наносит добавочный урон.',
   levels:[['Усилитель потенциала',22,3],['Отражение',37,6],['Грозовой узел',54,9]]}
 }},
 laser:{name:'Лазерное гнездо',branches:{
  emitters:{name:'Излучатели',summary:'Больше параллельных лучей, каждый расходует заряд.',
   levels:[['Двойная установка',24,3],['Тройная',35,5],['Четверная',49,7],['Шестизарядная',72,11]]},
  tempo:{name:'Плотность огня',summary:'Дольше поливает цель и быстрее получает заряды.',
   levels:[['Частые очереди',20,2],['Длинная очередь',30,4],['Стабильный залп',45,7]]},
  reach:{name:'Оптическая фокусировка',summary:'Увеличивает дальность, но край остаётся слабым.',
   levels:[['Узкий луч',21,3],['Линза',33,5],['Дальний контур',48,8]]},
  anomaly:{name:'Тепловой резонанс',summary:'Повторные попадания создают взрывной перегрев цели.',
   levels:[['Горячая метка',23,3],['Резонанс',37,6],['Цепная вспышка',54,9]]}
 }},
 hive:{name:'Дроновая матка',branches:{
  squad:{name:'Численность роя',summary:'Больше настоящих сбиваемых дронов, каждый стоит флюкс.',
   levels:[['Третий дрон',23,3],['Четвёртый',34,5],['Пятый',48,7],['Шестой',66,10]]},
  reach:{name:'Радиус вылета',summary:'Дроны прикрывают больше пространства вокруг матки.',
   levels:[['Расширенный патруль',20,3],['Дальний вылет',32,5],['Передовой рой',46,7]]},
  hull:{name:'Броня дронов',summary:'Дроны живут дольше под ответным огнём.',
   levels:[['Каркас',20,3],['Экранирование',34,5],['Живучий рой',49,8]]},
  anomaly:{name:'Тактический рой',summary:'Приманка для вражеских кораблей, затем замедление их двигателей.',
   levels:[['Ложная цель',23,4],['Помеховое облако',38,6],['Срыв тяги',58,10]]}
 }}
});
export const turretGrowthType=t=>t?.kind==='flux-artillery'?'artillery':
 t?.kind==='flux-support'?t.type:null;
export const turretBranchRank=(t,key)=>Number.isInteger(t?.branches?.[key])?t.branches[key]:0;
export function turretGrowthRows(t){
 const cfg=TURRET_GROWTH[turretGrowthType(t)];
 return cfg?Object.entries(cfg.branches).map(([key,branch])=>({
  key,...branch,rank:turretBranchRank(t,key),max:branch.levels.length,
  next:branch.levels[turretBranchRank(t,key)]||null})):[];
}
export function turretBranchOffer(world,player,t,key,time=0){
 const cfg=TURRET_GROWTH[turretGrowthType(t)],branch=cfg?.branches[key];
 if(!branch)return {ok:false,reason:'Неизвестная ветка развития'};
 if(!(t?.hp>0))return {ok:false,reason:'Сначала восстановите установку'};
 if(time<t.readyAt)return {ok:false,reason:'Дождитесь окончания строительства'};
 const rank=turretBranchRank(t,key),next=branch.levels[rank];
 if(!next)return {ok:false,reason:'Ветка полностью развита'};
 const [,ore,flux]=next;
 if((player?.ore||0)<ore)return {ok:false,reason:'Недостаточно сплава',ore,flux};
 if((world?.contours?.flux||0)+1e-8<flux)
  return {ok:false,reason:'Недостаточно флюкса',ore,flux};
 return {ok:true,ore,flux,title:next[0],rank:rank+1};
}
export function buyTurretBranch(world,player,t,key,time=0){
 const quote=turretBranchOffer(world,player,t,key,time);
 if(!quote.ok)return quote;
 player.ore-=quote.ore;world.contours.flux=Math.max(0,world.contours.flux-quote.flux);
 t.branches??={};t.branches[key]=quote.rank;
 if(t.type==='hive'&&key==='hull'){
  const newMax=hiveArmor(t);
  for(const drone of t.drones||[]){
   const health=drone.hp/Math.max(1,drone.maxHp);
   drone.maxHp=newMax;drone.hp=Math.min(newMax,Math.max(0,health*newMax));
  }
 }
 return {...quote,key};
}
export function validTurretBranches(t){
 if(t.branches===undefined)return true; // old checkpoints
 const cfg=TURRET_GROWTH[turretGrowthType(t)];
 return !!cfg&&!!t.branches&&!Array.isArray(t.branches)&&
  Object.keys(t.branches).every(key=>!!cfg.branches[key]&&
   Number.isInteger(t.branches[key])&&t.branches[key]>=0&&
   t.branches[key]<=cfg.branches[key].levels.length);
}
export const artilleryBarrels=t=>[1,2,3,4,6,10][turretBranchRank(t,'salvo')]||1;
export const artilleryCooldown=t=>[8,6.8,5.7,4.7,4][turretBranchRank(t,'tempo')]||8;
export const ARTILLERY_BASE_FLUX_PER_MINUTE=15;
export const artillerySupply=t=>ARTILLERY_BASE_FLUX_PER_MINUTE*(1+.35*turretBranchRank(t,'tempo'))*
 [1,1.5,2.4,4,7][turretBranchRank(t,'power')]*(1+.38*turretBranchRank(t,'seeker'));
export const artilleryBlast=t=>[110,126,145,165,185][turretBranchRank(t,'radius')]||110;
export const artilleryRange=t=>[740,850,980,1160][turretBranchRank(t,'reach')]||740;
export const artilleryShotUnits=t=>([1,2,4,8,20][turretBranchRank(t,'power')]||1)+
 [0,1,2,4][turretBranchRank(t,'seeker')];
export const artilleryShellDamage=t=>([18,36,82,185,480][turretBranchRank(t,'power')]||18)*
 (1+.2*turretBranchRank(t,'seeker'));
export const artilleryShotFlux=t=>artilleryShotUnits(t)*.25;
export const artilleryMagazine=t=>Math.max(15,Math.max(3,artilleryBarrels(t))*artilleryShotUnits(t));
export const artillerySalvoSize=t=>Math.max(3,artilleryBarrels(t));
export const artilleryReadyShells=t=>Math.floor(Math.max(0,t?.ammo||0)/artilleryShotUnits(t));
export const arcChainCount=t=>[3,4,5,7][turretBranchRank(t,'chain')]||3;
export const arcRange=t=>[440,520,610,720][turretBranchRank(t,'reach')]||440;
export const arcCooldown=t=>[3.5,3,2.55,2.15][turretBranchRank(t,'tempo')]||3.5;
export const supportSupply=(t,base)=>base*(1+.23*turretBranchRank(t,'tempo'));
export const arcSlowSeconds=t=>[2.5,3.2,4,5.2][turretBranchRank(t,'hold')]||2.5;
export const laserEmitters=t=>Math.max(t?.level>=2?2:1,[1,2,3,4,6][turretBranchRank(t,'emitters')]||1);
export const laserCooldown=t=>[2.2,1.9,1.65,1.4][turretBranchRank(t,'tempo')]||2.2;
export const laserBurst=t=>[8,10,13,16][turretBranchRank(t,'tempo')]||8;
export const laserRange=t=>[440,490,550,620][turretBranchRank(t,'reach')]||440;
export const hiveLimit=t=>Math.max(Math.min(4,t?.level+1||2),[2,3,4,5,6][turretBranchRank(t,'squad')]||2);
export const hiveRange=t=>260+(t?.level-1||0)*85+[0,75,145,220][turretBranchRank(t,'reach')];
export const hiveArmor=t=>[28,39,52,70][turretBranchRank(t,'hull')]||28;
export function turretCombatRadii(t){
 switch(turretGrowthType(t)){
  case 'artillery':return {range:artilleryRange(t),blast:artilleryBlast(t)};
  case 'arc':return {range:arcRange(t)};
  case 'laser':return {range:laserRange(t)};
  case 'hive':return {range:hiveRange(t)};
  default:return null;
 }
}
