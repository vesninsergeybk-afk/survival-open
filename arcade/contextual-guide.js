// Opt-in flight tutorial. The mission, combat and resources remain authoritative;
// this module only observes state and offers advice. No gameplay decisions here.
export const GUIDE_STORAGE_KEY='survivor.contextual-guide.v1';
export const GUIDE_LESSONS=Object.freeze([
 {id:'flight',group:'Первые минуты',title:'Первый вылет',icon:'flight',mode:'calm',
  body:'Двигайтесь клавишами WASD или стрелками. На телефоне используйте левый джойстик. Попробуйте подлететь к ближайшему астероиду.',
  detail:'Автоматическое оружие стреляет по врагам поблизости. Рывок помогает выйти из-под огня. Указанные клавиши можно изменить в настройках.'},
 {id:'ore',group:'Первые минуты',title:'Добыча сплава',icon:'ore',mode:'calm',
  body:'Подлетите к астероиду и удерживайте кнопку действия, пока экстрактор не расколет породу. Подберите выпавший сплав.',
  detail:'На компьютере действие обычно назначено на E. На телефоне используйте кнопку «Действие». Если объект слишком далеко, приблизьтесь, пока не появится подсказка.'},
 {id:'noise',group:'Первые минуты',title:'Шум привлекает патрули',icon:'ore',mode:'calm',
  body:'Экстрактор создаёт сигнал. Чем дольше вы добываете, тем выше риск привлечь патруль. Следите за шкалой «Сигнал» и вовремя отходите.',
  detail:'Это действующая механика: сигнал постепенно затухает, а высокий уровень может вызвать патруль. Первый ранг «Геологической подготовки» снижает шум добычи на 16%. Ручного регулятора мощности экстрактора пока нет.'},
 {id:'upgrade',group:'Первые минуты',title:'Первое улучшение',icon:'flight',mode:'calm',
  body:'У вас появилось очко развития. Откройте меню пилота и выберите полезное улучшение до следующего серьёзного боя.',
  detail:'Навыки пилота и установленное на корабле вооружение — разные вещи. Перед тратой очка проверьте, доступно ли выбранное оружие и установлено ли оно в ангаре.'},
 {id:'swarm',group:'Тактика боя',title:'Против вас — рой',icon:'combat',mode:'combat',
  body:'Не позволяйте группе окружить корабль. Подходите к бою с запасом дистанции; минный веер можно поставить на пути приближающихся врагов.',
  detail:'Колесо мыши выбирает ручное оружие, ПКМ позволяет прицелиться и выстрелить. На телефоне сначала выберите «Мины», затем коснитесь места установки. Мины нельзя бросать без перезарядки.'},
 {id:'heavy',group:'Тактика боя',title:'Тяжёлая цель',icon:'combat',mode:'combat',
  body:'У крупного противника больше прочности и огневой мощи. Лавируйте, сохраняйте расстояние и следите за предупреждениями о его выстрелах.',
  detail:'Рывок помогает уйти с линии огня. Перед продолжительным обстрелом оцените запас корпуса и возможности ремонта. Не стойте вплотную к тяжёлой цели.'},
 {id:'prepare',group:'Территория',title:'Подготовьтесь к обороне',icon:'territory',mode:'calm',
  body:'Когда три подходящие станции замкнут территорию, противник попытается её отбить. Перед подключением третьей станции желательно улучшить оружие и проверить корпус.',
  detail:'Это совет, а не обязательное условие. Три станции должны образовать действительный контур; сама антенна радиосвязи треугольник не замыкает. Оборона состоит из трёх волн.'},
 {id:'contour',group:'Территория',title:'Защитите новый контур',icon:'territory',mode:'calm',
  body:'Вас ждут три волны. Уничтожайте требуемое число целей, не выходите далеко за пределы зоны и следите за отметками орбитальных ударов.',
  detail:'Пока идёт отсчёт, игра показывает боевое предупреждение; эта статья остаётся в справочнике. Если отступить, бой начнётся заново, но станции сохранятся.'},
 {id:'core',group:'Территория',title:'Запустите воронку',icon:'territory',mode:'calm',
  body:'Все три волны отражены. Подлетите к красному ядру и удерживайте кнопку действия, пока воронка не запустится.',
  detail:'Победа над последним кораблём ещё не завершает захват. После запуска ядра территория принесёт награду, а сборщики начнут доставлять флюкс.'}
]);
export const GUIDE_BY_ID=Object.freeze(Object.fromEntries(GUIDE_LESSONS.map(x=>[x.id,x])));
const FIRST_STEPS=['flight','ore','noise'];
const safeArray=value=>Array.isArray(value)?value.filter(id=>Object.hasOwn(GUIDE_BY_ID,id)):[];
export function normalizeGuideState(value={}){
 return {enabled:!!value.enabled,seen:[...new Set(safeArray(value.seen))],
  mastered:[...new Set(safeArray(value.mastered))]};
}
export function recommendGuide(snapshot,state,triggered=[]){
 if(!state.enabled||snapshot.blocked)return null;
 const excluded=new Set([...state.seen,...state.mastered]);
 const can=id=>!excluded.has(id);
 // Urgent tactical advice stays small and never pauses combat.
 if(triggered.includes('heavy')&&can('heavy'))return 'heavy';
 if(triggered.includes('swarm')&&can('swarm'))return 'swarm';
 if(snapshot.battle||snapshot.threatNearby||snapshot.mining)return null;
 for(const id of FIRST_STEPS){
  if(!can(id))continue;
  if(id==='flight'&&snapshot.flightTime<90)return id;
  if(id==='ore'&&snapshot.distanceMoved>=55&&!snapshot.mined)return id;
  if(id==='noise'&&snapshot.mined)return id;
 }
 if(snapshot.points>0&&can('upgrade'))return 'upgrade';
 if(snapshot.stationCount>=2&&!snapshot.hasTerritory&&can('prepare'))return 'prepare';
 if(snapshot.pendingContour&&!snapshot.readyCore&&can('contour'))return 'contour';
 if(snapshot.readyCore&&can('core'))return 'core';
 return null;
}
export function masteryFromSnapshot(snapshot){
 return {
  flight:snapshot.distanceMoved>=55,
  ore:snapshot.mined,
  upgrade:snapshot.upgraded,
  prepare:snapshot.hasTerritory,
  contour:snapshot.readyCore,
  core:snapshot.contourCompleted
 };
}
