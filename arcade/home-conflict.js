import {CENTRAL_INDUSTRY,centralCargoRemaining,centralCargoSpeed,centralRoute,centralExtractionAvailable} from './central-industry.js?v=home-conflict-1-enemy-balance-2-territory-war-1';
import {cargoLastContact} from './regional-supply.js?v=enemy-economy-1-enemy-balance-2-territory-war-1';
import {labLogisticsIntel} from './station-progression.js?v=lab-logistics-qa-1-home-conflict-1-campaign-1-repair-qa-1';

export const HOME_CONFLICT=Object.freeze({radius:10500,offerAt:150,backgroundCap:36,raidShips:3});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const enc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localStations=world=>({source:world.stations.get(CENTRAL_INDUSTRY.sourceId),
 depot:world.stations.get(CENTRAL_INDUSTRY.depotId)});
export function homeIndustryState(world){
 const s=world?.regionalSupply?.central;
 if(!s)return null;
 const {source,depot}=localStations(world);
 const working=!!source?.enemy&&centralExtractionAvailable(s);
 const payload=s.convoys.some(c=>c.hp>0)||s.reserves>0||!!s.pendingRaid||
  !!source?.enemy&&s.ore>=CENTRAL_INDUSTRY.cargoCost+(s.strategy?.screened?2:0);
 return {s,source,depot,working,payload,
  outcome:!depot?.enemy?'captured':!working&&!payload?'starved':null};
}

// A functioning enemy industry does not override the starter threat curve:
// that would silently turn every planned 4–8 ship formation into two scouts.
// Its *paid* raids remain a separate source of danger. Destroying its supply
// still earns the pilot the old, strong and lasting reduction of ambient traffic.
export function homeConflictPressure(director,world,player){
 const state=homeIndustryState(world);
 if(!state||!world.home||distance(player,world.home)>HOME_CONFLICT.radius||!director.types?.length)return director;
 const cap=state.outcome==='captured'?7:state.outcome==='starved'?9:
  Math.min(HOME_CONFLICT.backgroundCap,Math.max(8,Math.ceil(director.cap*.75)));
 const interval=state.outcome==='captured'?12:state.outcome==='starved'?10:
  director.interval*1.07;
 const groupSize=state.outcome==='captured'?2:state.outcome==='starved'?3:
  Math.max(2,Math.ceil(director.groupSize*.72));
 return {...director,cap:Math.min(director.cap,cap),
  interval:Math.max(director.interval,interval),
  groupSize:Math.min(director.groupSize,groupSize)};
}

export function homeConflictTarget(game,plan){
 const state=homeIndustryState(game.world);if(!state)return null;
 const {s,source,depot,outcome}=state;
 const offered=s.conflict?.offeredAt!==null&&s.conflict?.offeredAt!==undefined;
 if(!offered&&!source?.discovered&&!depot?.discovered)return null;
 const intel=labLogisticsIntel(game.world,game.player);
 const signal=(station,id,label)=>station?.discovered?
  {id:station.id,x:station.x,y:station.y,label:station.title}:
  {id,x:station.x-180,y:station.y+130,label};
 if(['lab','arsenal','carrier'].includes(plan)){
  const linked=plan==='carrier'?game.world.networkTopology().linked:new Set();
  const priority=b=>plan==='carrier'&&linked.has(b.id)?0:b.active?1:2;
  const station=[...game.world.stations.values()].filter(b=>b.discovered&&!b.enemy&&b.type===plan)
   .sort((a,b)=>priority(a)-priority(b)||distance(a,game.player)-distance(b,game.player))[0];
  return station?{id:station.id,x:station.x,y:station.y,
   label:({lab:'Лаборатория · радиоперехват',arsenal:'Арсенал · прицельный рельс',carrier:'Авианосец · ударная поддержка'})[plan]}:null;
 }
 if(outcome)return null;
 if(plan==='survey'||plan==='source')return state.working?
  signal(source,'conflict:source','Район сигнала добычи'):null;
 if(plan==='depot')return source?.discovered||depot?.discovered||intel.contacts.some(c=>c.kind==='depot')?
  signal(depot,'conflict:depot','Район сигнала сборки'):null;
 if(plan==='intercept'&&depot?.enemy){
  const cargo=s.convoys.find(c=>c.hp>0&&(cargoLastContact(c,game.time)||
   intel.contacts.some(i=>i.id===c.id)));
  if(cargo){
   const last=cargoLastContact(cargo,game.time),radio=!last;
   return {id:cargo.id,x:last?.x??cargo.x,y:last?.y??cargo.y,label:'Местный рудный груз',
    ...(radio?{radioContact:true,signalLabel:'Местный рудный груз',signalLive:true}:{})};
  }
  if(source?.discovered){
   const point=centralRoute(s.strategy?.rerouted?'diversion':'direct')[1];
   return {id:'conflict:watch',...point,label:'Наблюдать грузовой путь'};
  }
 }
 return null;
}

export function updateHomeConflict(game){
 const state=homeIndustryState(game.world);if(!state)return;
 const {s,source,depot,outcome}=state;
 const conflict=s.conflict??={version:1,offeredAt:null,plan:null,outcome:null};
 if(conflict.offeredAt===null&&game.openingArc?.status!=='active'&&
   (source?.discovered||depot?.discovered||game.time>=HOME_CONFLICT.offerAt||
    game.time>=90&&game.openingArc?.status==='complete')&&
   distance(game.player,game.world.home)<=HOME_CONFLICT.radius){
  conflict.offeredAt=game.time;
  game.notice('Домашний док: на востоке работает вражеская промышленная сеть. Цель — остановить её налёты. Выберите план на карте или на станции.',8);
 }
 if(conflict.offeredAt===null)return;
 if(outcome&&conflict.outcome!==outcome){
  conflict.outcome=outcome;
  game.notice(outcome==='captured'?
   'Сборочный пост захвачен. Местные налёты прекращены, фоновые патрули у домашнего дока стали реже. Пристыкуйтесь к активной станции и сохраните результат.':
   'Снабжение иссякло: местная сеть больше не может выпускать налёты. Патрули у домашнего дока стали реже. Уже вышедшие корабли остаются опасны.',8);
 }
 // Only replace a marker belonging to this plan; contracts and the player's
 // own navigation always retain control. Live cargo needs visual/radio contact.
 if(game.waypoint?.id?.startsWith('conflict:')){
  const target=homeConflictTarget(game,conflict.plan||'survey');
  if(target)game.waypoint=target;
  else if(outcome)game.waypoint=null;
 }
}

export function homeConflictCue(game){
 const state=homeIndustryState(game.world);if(!state)return '';
 const {s,source,depot,outcome}=state;
 if(s.conflict?.offeredAt==null&&!source?.discovered&&!depot?.discovered)return '';
 if(distance(game.player,game.world.home)>HOME_CONFLICT.radius)return '';
 if(outcome)return outcome==='captured'?'ДОМАШНИЙ СЕКТОР · сборочный пост захвачен':
  'ДОМАШНИЙ СЕКТОР · снабжение иссякло';
 if(s.pendingRaid?.announced){
  const left=Math.ceil(s.pendingRaid.readyAt-game.time);
  return left>0?'МЕСТНЫЙ НАЛЁТ · готовность через '+left+' с · 3 корабля':
   'МЕСТНЫЙ НАЛЁТ · отряд готов · 3 корабля';
 }
 if(depot?.discovered&&s.reserves>0&&s.assemblyUntil>game.time)
  return 'СБОРОЧНЫЙ ПОСТ · сборка отряда · '+Math.ceil(s.assemblyUntil-game.time)+' с';
 const intel=labLogisticsIntel(game.world,game.player);
 const cargo=s.convoys.find(c=>cargoLastContact(c,game.time)||intel.contacts.some(i=>i.id===c.id));
 if(cargo)return 'ГРУЗ К СБОРОЧНОМУ ПОСТУ · до доставки '+
  Math.ceil(centralCargoRemaining(cargo)/centralCargoSpeed(cargo))+' с';
 return ({survey:'ДОМАШНИЙ СЕКТОР · разведайте источник налётов',
  source:'ПЛАН · остановить добычу · грузы в пути останутся',
  depot:'ПЛАН · захватить сборочный пост и остановить налёты',
  intercept:'ПЛАН · перехватывать грузы · лаборатория поможет их найти',
  lab:'ЛАБОРАТОРИЯ · откройте радиоперехват снабжения',
  arsenal:'АРСЕНАЛ · откройте прицельный режим рельса',
  carrier:'АВИАНОСЕЦ · подготовьте удар по сборочному посту'})[s.conflict?.plan||'survey'];
}

export function renderHomeConflict(game,{compact=false}={}){
 const state=homeIndustryState(game.world);if(!state)return '';
 const {s,source,depot,working,outcome}=state;
 if(s.conflict?.offeredAt==null&&!source?.discovered&&!depot?.discovered)return '';
 if(distance(game.player,game.world.home)>HOME_CONFLICT.radius)return '';
 const button=(plan,label)=>homeConflictTarget(game,plan)?
  '<button type="button" data-act="conflictPlan" data-role="'+plan+'">'+
   (s.conflict?.plan===plan?'✓ ':'')+enc(label)+'</button>':'';
 const known=!!source?.discovered||!!depot?.discovered;
 const status=outcome==='captured'?'Сборочный пост захвачен. Новые местные налёты остановлены; фоновые патрули стали реже.':
  outcome==='starved'?'Добыча остановлена, грузы и резервы исчерпаны. Новых местных налётов не будет.':
  !working?'Добыча остановлена. Грузы в пути и прежние запасы ещё позволяют выпускать отряды.':
  'Шахта добывает сырьё. Доставленный груз оплачивает один отряд: тяжёлый корабль и два истребителя.';
 const stock=depot?.discovered?' Резервных партий: '+s.reserves+
  '. '+(s.pendingRaid?'Один отряд уже оплачен.':''):'';
 const cue=homeConflictCue(game);
 const choices=outcome?'':
  '<details class="home-conflict-plans"'+(!s.conflict?.plan&&!compact?' open':'')+'><summary>Выбрать план · три способа ослабить врага</summary>'+
  '<div class="home-conflict-choices"><article><strong>Перехватывать поставки</strong><p>Каждый уничтоженный груз предотвращает один налёт из трёх кораблей. Нужны повторные перехваты.</p>'+
  button('intercept','К грузу или месту перехвата')+button('survey','Разведать источник')+'</article>'+
  '<article><strong>Остановить добычу</strong><p>Щёлкните по рабочему или коснитесь его, чтобы назначить целью автооружия; затем подлетите на дальность огня. Можно также захватить шахту. Грузы в пути и прежние запасы останутся.</p>'+
  button('source','К источнику снабжения')+'</article>'+
  '<article><strong>Захватить сборочный пост</strong><p>Потребуется штурм. Захват немедленно отменит сборку и оставшиеся резервы.</p>'+
  (button('depot','К сборочному посту')||'<p>Координаты поста пока неизвестны. Разведайте шахту или найдите след сборки через лабораторию.</p>')+'</article></div></details>';
 const tools=outcome?'':
  '<details class="home-conflict-tools"><summary>Какая станция поможет моему плану?</summary><p>Активная лаборатория отслеживает настоящие грузы поблизости; включённый арсенал открывает ручной прицел установленного рельса; подключённый к сети авианосец снаряжает бомбардировщики для штурма по B / «Авиаудар».</p>'+
  button('lab','К известной лаборатории')+button('arsenal','К известному арсеналу')+
  button('carrier','К известному авианосцу')+
  '<p>Если нужная станция ещё не разведана, исследуйте неопознанные сигналы на карте. Эти возможности помогают разным тактикам; обязательного порядка открытия нет.</p></details>';
 return '<section class="home-conflict '+(outcome?'resolved':'')+'" aria-label="Цель домашнего региона">'+
  '<span class="base-kicker">ЦЕЛЬ РЕГИОНА</span><h3>'+(outcome?'Домашний сектор: преимущество достигнуто':'Остановить налёты в домашнем секторе')+'</h3>'+
  '<p>'+enc(status+stock)+'</p>'+(cue?'<p class="home-conflict-live">'+enc(cue)+'</p>':'')+
  (known?'<p class="home-conflict-result">Перехвачено грузов: '+s.intercepted+' · доставлено: '+s.delivered+' · вышло отрядов: '+s.raids+'</p>':'')+
  choices+tools+(outcome?'<p>'+(compact?
   (game.world.regionalSupply?.command?.victoryAt!=null?'Все промышленные сети подавлены. Можно продолжать исследование.':
    'Выберите следующую цель прохождения ниже.'):
   'Стыковка с активной станцией закрепляет результат в контрольной точке. Дальше можно исследовать снабжение других регионов.')+'</p>':'')+'</section>';
}
