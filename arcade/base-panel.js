import {renderShipHangar} from './hangar-panel.js?v=first-contract-reward-1-station-layout-2-station-clarity-1-campaign-1-weapon-mechanics-2-tactical-field-2-unified-controls-1-direct-fit-2';
import {readableKey,DEFAULT_CONTROLS} from './control-layout.js?v=unified-controls-1';
import {renderStationRoutePreview} from './map-panel.js?v=menu-exit-1-enemy-intents-2-regions-1-network-defense-4-living-world-3-frontier-3-rpg-precision-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-mesh-log-1-backbone-2-world-feedback-1';
import {RULES, baseNames} from './balance.js?v=arcade-network-20';
import {RELAY_RANGE, RELAY_EXTENSION} from './world.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1';
import {defenseStatus} from './network-defense.js?v=network-defense-4';
import {corridorOffer,CORRIDOR_OPERATION,probeOffer,PROBE_OPERATION} from './operations.js?v=weapons-cycle-2';
import {RELAY_DEFENSE,relayOffer,relayDefenseCue} from './relay-defense.js?v=relay-def-1';
import {CARRIER_INTERCEPTION,carrierOffer,autonomousStrikeCarrier} from './carrier-interception.js?v=carrier-intercept-2-campaign-1';
import {FIELD_WEAPONS,fieldWeapon,fieldLoanOffer,refillQuote} from './field-weapons.js?v=weapons-cycle-2-regions-1-campaign-1';
import {nextEconomyChoices} from './sortie-economy.js?v=economy-integrity-1-econ-audit-2-campaign-1';
import {FIRST_CONTRACT_MODULES} from './first-contract-reward.js?v=first-contract-reward-1-campaign-1';
import {arsenalDiscoveryPromise,labDiscoveryPromise} from './station-progression.js?v=lab-logistics-qa-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-unified-controls-1';
import {slotOpen} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-unified-controls-1-direct-fit-2';
import {renderHomeConflict} from './home-conflict.js?v=home-conflict-1-campaign-1-repair-qa-1';
import {renderCampaignProgress} from './regional-campaign.js?v=campaign-1-repair-qa-1';
import {renderStationThreats} from './strategic-command.js?v=campaign-1-repair-qa-1-world-feedback-1';

// Only two distinct combat drones can accompany the player. Bomber wings are
// consumable station support, never persistent escorts.
const DRONES = Object.freeze({
 dock:{role:'scout',name:'Дрон «Страж»',cost:20,desc:'Лёгкий защитник. Сбивает таранщиков, держится рядом при добыче.'},
 lab:{role:'scout',name:'Дрон «Страж»',cost:20,desc:'Лёгкий защитник. Сбивает таранщиков, держится рядом при добыче.'},
 arsenal:{role:'fighter',name:'Дрон «Клинок»',cost:54,desc:'Ударный перехватчик. Выбирает опасные корабли и ремонтников.'},
 carrier:{role:'fighter',name:'Дрон «Клинок»',cost:54,desc:'Ударный перехватчик. Защищает от крупных противников.'}
});
const TECH = Object.freeze({
 dock:{key:'armor',name:'Броня дронов',desc:'Повышает живучесть ваших дронов. На ПВО станции не влияет.'},
 lab:{key:'engine',name:'Приводы дронов',desc:'Помощники быстрее возвращаются и прикрывают добычу.'},
 arsenal:{key:'armament',name:'Вооружение дронов',desc:'Оба дрона сильнее бьют при перехвате.'},
 carrier:{key:'strikePower',name:'Авиационная связь',desc:'Открывает ударные вылеты B. Каждый следующий уровень усиливает бомбардировку.'}
});
// One irreversible local specialization per station. It never creates extra
// permanent followers or automatic player-owned turrets.
export const STATION_MODULES=Object.freeze({
 dock:[
  {key:'workshop',name:'Ремонтные манипуляторы',cost:38,desc:'Вблизи дока корпус и ведомые восстанавливаются быстрее на 60%.'},
  {key:'bulwark',name:'Защитное поле',cost:38,desc:'В радиусе 650 м от дока получаемый кораблём урон уменьшается на 18%.'}
 ],
 arsenal:[
  {key:'amplifier',name:'Орудийный ретранслятор',cost:42,desc:'В радиусе 650 м плазменный луч корабля наносит на 18% больше урона.'},
  {key:'jammer',name:'Станция помех',cost:42,desc:'В радиусе 650 м получаемый кораблём урон уменьшается на 18%.'}
 ],
 lab:[
  {key:'survey',name:'Дальний спектрометр',cost:38,desc:'Открывает на карте приблизительные сигналы на 650 м дальше. Помогает выбирать маршрут.'},
  {key:'quiet',name:'Экранирование добычи',cost:38,desc:'В пределах 900 м от лаборатории добыча создаёт на 32% меньше шума.'}
 ],
 carrier:[
  {key:'guidance',name:'Точное наведение',cost:46,desc:'Бомбардировщики, вылетевшие с этой базы, наносят на 20% больше урона.'},
  {key:'armor',name:'Защита авиагруппы',cost:46,desc:'Бомбардировщики, вылетевшие с этой базы, получают на 45% больше прочности.'}
 ]
});
export const stationModule=(type,key)=>(STATION_MODULES[type]||[]).find(item=>item.key===key)||null;

const shortfall=(price,ore)=>ore<price?'Не хватает '+(price-ore)+' ед. сплава':'';
const LOCAL_SERVICES=Object.freeze({
 dock:{key:'shield',name:'Аварийный конденсатор',cost:16,
  desc:'Одноразовый запас щита до 30 ед. Доступен даже без изучения навыка «Энергощит».'},
 lab:{key:'scan',name:'Спектральный поиск руды',cost:12,duration:90,
  desc:'На 90 с выделяет богатые астероиды янтарным контуром. Помогает выбирать добычу под огнём.'},
 arsenal:{key:'overcharge',name:'Боевой усилитель',cost:28,duration:55,
  desc:'На 55 с усиливает плазменный луч против вражеских кораблей на 20%.'}
});
const CONTRACTS=Object.freeze({
 dock:{kind:'kill',goal:4,ore:16,data:15,name:'Зачистка патрулей',
  desc:'Уничтожьте 4 корабля противника и вернитесь за наградой.'},
 lab:{kind:'rich',goal:2,ore:22,data:19,name:'Геологические образцы',
  desc:'Найдите 2 богатых астероида с янтарной рудой и разберите их экстрактором, удерживая E.'},
 arsenal:{kind:'defend',goal:5,ore:30,data:26,name:'Оборона периметра',
  desc:'Уничтожьте 5 врагов в радиусе 650 м от арсенала. Защищайте подходы к станции.'},
 carrier:{kind:'intercept',goal:5,ore:36,data:32,name:'Прикрытие авиагруппы',
  desc:'Перехватите 5 боевых кораблей: истребителей, фланкеров, таранщиков или тяжёлых. Разведчики не учитываются.'}
});
export const contractFor=type=>CONTRACTS[type]||CONTRACTS.dock;
// A station offers two tasks; only one is active at a time. Rewards renew after a cooldown.
const ALT_CONTRACTS=Object.freeze({
 dock:{kind:'rich',goal:1,ore:10,data:24,name:'Геологические сведения',desc:'Разберите один богатый астероид, удерживая E. Меньше сплава, зато больше данных.'},
 lab:{kind:'kill',goal:4,ore:31,data:9,name:'Очистка маршрута',desc:'Уничтожьте 4 корабля противника. Больше сплава, но мало исследовательских данных.'},
 arsenal:{kind:'intercept',goal:3,ore:18,data:35,name:'Охота на перехватчики',desc:'Уничтожьте 3 боевых корабля, кроме разведчиков. Меньше сплава, больше данных.'},
 carrier:{kind:'defend',goal:5,ore:28,data:45,name:'Оборона авианосца',desc:'Уничтожьте 5 врагов в радиусе 650 м от авианосца. Меньше сплава, больше данных.'}
});
export const contractChoices=(type,runs=0)=>[
 {id:'standard',tag:'Основное поручение',...contractFor(type)},
 {id:'alternate',tag:'Альтернативное поручение',...(ALT_CONTRACTS[type]||ALT_CONTRACTS.dock)}
].map(choice=>runs>0?{...choice,
 ore:Math.max(8,Math.round(choice.ore*.65)),
 data:Math.max(6,Math.round(choice.data*.65))}:choice);
// A contract counts a real field event, not any action with the same name.
export function eligibleContractProgress(contract,kind,subject=null,station=null){
 if(!contract||contract.progress>=contract.goal)return false;
 if(contract.kind==='kill')return kind==='kill';
 if(contract.kind==='rich')return kind==='mine'&&subject?.rich===true;
 if(contract.kind==='defend')return kind==='kill'&&!!subject&&!!station&&
  Math.hypot(subject.x-station.x,subject.y-station.y)<=650;
 if(contract.kind==='intercept')return kind==='kill'&&
  ['fighter','flanker','berserker','gunship'].includes(subject?.type);
 return false;
}
export const contractOffer=(base,state)=>{
 const choices=contractChoices(base.type,base.contractRuns||0),current=state.contract;
 const chosen=choices.find(c=>c.id===(current?.baseId===base.id?current.choiceId:base.completedContract))||choices[0];
 if(current&&current.baseId!==base.id)return {...choices[0],status:'other',progress:0};
 if(current)return {...chosen,status:current.progress>=current.goal?'ready':'active',
  progress:Math.min(current.progress,current.goal)};
 const remaining=Math.ceil((base.contractCooldownUntil||0)-(state.time||0));
 if(remaining>0)return {...chosen,status:'cooldown',remaining,progress:0};
 return {...choices[0],status:base.active?'available':'locked',progress:0};
};
export const strikeCost=level=>40+Math.max(0,level-1)*5;
// Only the home dock starts for free. Remote relays consume material and are
// worth powering because they unlock a reusable travel network.
export const activationCost=activeBases=>activeBases<=0?0:Math.min(84,24+(activeBases-1)*10);
export const transitCost=(origin,destination)=>
 Math.max(20,12+Math.ceil(Math.hypot(origin.x-destination.x,origin.y-destination.y)/750)*8);
export function baseOffer(base,state){
 const ore=Math.max(0,state.ore|0),connected=!!state.connected;
 const drone=DRONES[base.type]||DRONES.dock,tech=TECH[base.type]||TECH.dock;
 const level=state.network[tech.key]|0;
 const cap=Math.min(RULES.maxAllies,state.connectedBases>=2?2:1);
 const upgradeCost=52+level*34;
 const relayCost=activationCost(state.civilianBases??state.activeBases??0);
 const antennaCost=34;
 const transfers=(state.transfers||[]).filter(t=>t.id!==base.id)
  .map(t=>({...t,cost:transitCost(base,t),distance:Math.round(Math.hypot(base.x-t.x,base.y-t.y))}))
  .sort((a,b)=>a.distance-b.distance);
 const missing=Math.max(0,state.maxHp-state.hp);
 // An instant repair is a convenience purchase. A fixed 9-alloy minimum once
 // charged players nine alloy even for a single missing hull point.
 const repairAmount=Math.min(missing,Math.round(state.maxHp*.45));
 const repairCost=Math.max(1,Math.ceil(repairAmount*.36));
 const droneDamage=Math.max(0,state.droneDamage||0);
 const droneRepairCost=droneDamage>0?Math.max(8,Math.ceil(droneDamage*.32)):0;
 const chargeCost=strikeCost(state.network.strikePower||0),contract=contractOffer(base,state);
 const contractOptions=contractChoices(base.type,base.contractRuns||0);
 const localService=LOCAL_SERVICES[base.type]||null;
 const moduleOptions=(STATION_MODULES[base.type]||[]).map(item=>({...item,
  reason:!base.active?'Сначала включите станцию':base.module?'Специализация уже выбрана':shortfall(item.cost,ore)}));
 const serviceActive=localService?.key==='shield'?(state.shield||0)>=15:
  localService?.key==='scan'?(state.scanRemaining||0)>0:
  localService?.key==='overcharge'?(state.overchargeRemaining||0)>0:false;
 const serviceRemaining=localService?.key==='scan'?state.scanRemaining||0:
  localService?.key==='overcharge'?state.overchargeRemaining||0:0;
 const replacementIndex=state.allies>=cap?(state.droneRoles||[])
  .findIndex(role=>role!==drone.role):-1;
 const replacing=replacementIndex>=0;
 const hireCost=replacing?Math.max(18,drone.cost-
  (state.droneRoles[replacementIndex]==='fighter'?20:12)):drone.cost;
 const reasons={
  activate:base.active?'Уже включена':shortfall(relayCost,ore),
  antenna:!base.active?'Сначала включите станцию':
   base.relayBoost?'Антенна уже усилена':shortfall(antennaCost,ore),
  hire:!base.active?'Сначала включите станцию':
   state.allies>=cap&&!replacing?'Лимит '+cap+' · дрон этого типа уже в строю':
   shortfall(hireCost,ore),
  upgrade:!base.active?'Сначала включите станцию':
   !connected?'Соедините станцию с домашним доком':
   base.usedUpgrade?'Технология этой станции изучена':
   level>=6?'Максимальный уровень':shortfall(upgradeCost,ore),
  repair:!base.active?'Сначала включите станцию':
   missing<=0?'Корпус цел':shortfall(repairCost,ore),
  drones:!base.active?'Сначала включите станцию':
   droneDamage<=0?'Дроны исправны':shortfall(droneRepairCost,ore),
  supply:!base.active?'Сначала включите станцию':
   !connected&&!autonomousStrikeCarrier(base)?'Нужна связь с сетью':
   base.type!=='carrier'?'Снаряжение доступно на авианосце':
   (state.network.strikePower||0)<1&&!autonomousStrikeCarrier(base)?'Сначала улучшите авиационную связь':
   state.charges>=2?'Два вылета уже снаряжены':shortfall(chargeCost,ore),
  service:!base.active?'Сначала включите станцию':
   !localService?'Нет местной услуги':
   serviceActive?(localService.key==='shield'?'Щит уже заряжен':
    'Действует ещё '+Math.ceil(serviceRemaining)+' с'):
   shortfall(localService.cost,ore)
 };
 return {ore,drone,tech,level,cap,connected,relayCost,antennaCost,transfers,upgradeCost,repairAmount,repairCost,droneRepairCost,chargeCost,hireCost,replacementIndex,replacing,contract,contractOptions,repeatReward:(base.contractRuns||0)>0,
  localService,moduleOptions,rewardAlloy:state.activeBases===0?20:0,
  rewardRepair:Math.round(state.maxHp*.1),reasons};
}
const card=(cls,kicker,title,description,control,reason='')=>
 '<section class="base-card '+cls+'"><span class="base-kicker">'+kicker+'</span>'+
 '<strong>'+title+'</strong><small>'+description+'</small>'+control+
 (reason?'<span class="base-reason">'+reason+'</span>':'')+'</section>';
const action=(name,label,reason='',role='',help='')=>
 '<button type="button" data-act="'+name+'"'+(help?' data-help="'+help.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'"':'')+(role?' data-role="'+role+'"':'')+
 (reason?' disabled':'')+'>'+label+'</button>';
function firstContractRewardPanel(state){
 if(state.firstHardwareReward==='pending'){
  const draftDirty=!!state.hangarSession?.dirty?.(state.loadout);
  const freeSlot=state.loadout?.slots?.some((id,i)=>i<5&&slotOpen(state.loadout,i)&&id===null);
  return '<section class="base-first-reward" aria-label="Выбор первого боевого модуля">'+
  '<span class="base-kicker">ПЕРВЫЙ ЗАКАЗ · ОСОБАЯ НАГРАДА</span>'+
  '<h3>Выберите, как будет сражаться Ваш корабль</h3>'+
  '<p>Вы заслужили один модуль. Он бесплатный и остаётся до конца прохождения. '+
  (draftDirty?'В ангаре есть незавершённая сборка: модуль поступит на склад.':
   freeSlot?'Модуль сразу займёт свободный узел.':'Если свободных узлов нет, модуль поступит на склад.')+
  ' Выберите один из трёх вариантов:</p>'+
  '<div class="base-first-reward-choices">'+Object.entries(FIRST_CONTRACT_MODULES).map(([id,choice])=>
   '<article><strong>'+choice.title+'</strong><p>'+choice.detail+'</p>'+
   action('claimFirstModule',draftDirty||!freeSlot?'Получить на склад':'Получить и установить','',id)+'</article>').join('')+'</div>'+
  '<small>После выбора попробуйте новую тактику в следующем бою. Можно позже переставить оружие в ангаре.</small></section>';
 }
 if(Object.hasOwn(FIRST_CONTRACT_MODULES,state.firstHardwareReward)&&
  state.lastContractReceipt?.firstHardwareReward===state.firstHardwareReward){
  const id=state.firstHardwareReward,choice=FIRST_CONTRACT_MODULES[id];
  const installed=typeof state.lastContractReceipt.firstHardwareInstalled==='boolean'?
   state.lastContractReceipt.firstHardwareInstalled:state.loadout?.slots.includes(id);
  return '<section class="base-first-reward base-first-reward-done" role="status">'+
   '<span class="base-kicker">ОРУЖИЕ ПОЛУЧЕНО</span><h3>'+choice.title+'</h3>'+
   '<p>'+(installed?'Модуль уже на корабле. ':'Модуль на складе: установите его в ангаре. ')+choice.test+'</p>'+
   (!installed?action('baseTab','Открыть ангар','','hangar'):'')+'</section>';
 }
 return '';
}
const contractPanel=(o,state)=>{
 const c=o.contract;
 if(c.status==='other'&&state.contract){
  const origin=state.world?.stations?.get(state.contract.baseId);
  return '<section class="base-contract other"><span class="base-kicker">УЖЕ ЕСТЬ ЗАКАЗ</span>'+
   '<strong>'+state.contract.name+'</strong><small>Выполнено '+state.contract.progress+
   ' из '+state.contract.goal+'. Новый заказ можно взять после завершения или отказа от текущего.</small>'+
   '<p>Награда выдаётся там, где Вы приняли заказ'+
   (origin?' — '+(baseNames[origin.type]||'исходная станция'):'')+'.</p>'+
   action('baseMap','Посмотреть маршрут')+'</section>';
 }
 if(c.status==='available')return '<section class="base-contract-board"><div class="base-contract-copy">'+
  '<span class="base-kicker">НА ВЫБОР</span><strong>Возьмите один заказ</strong>'+
  '<small>Можно взять один. Награду получите после возвращения сюда.</small></div>'+
  '<div class="base-contract-choices">'+o.contractOptions.map(choice=>
   '<article class="base-contract-choice"><strong>'+choice.name+'</strong>'+
   '<small>'+choice.desc+'</small><em>Награда: '+choice.ore+' сплава · '+choice.data+' данных</em>'+
   action('acceptContract','Принять заказ','',choice.id)+'</article>').join('')+
  '</div></section>';
 const summary={
  available:c.desc,active:c.desc,ready:'Задание выполнено. Заберите награду.',
  cooldown:'Пока здесь нет новых поручений. Можно отправиться к другим станциям.',
  other:'Сначала завершите поручение другой станции.'
 };
 const contractActions=c.status==='active'?
  '<div class="base-contract-actions"><div class="base-contract-progress" role="status">'+
  '<strong>В работе · '+c.progress+' из '+c.goal+'</strong>'+
  '<progress value="'+c.progress+'" max="'+c.goal+'" aria-label="Выполнение полевого заказа"></progress></div>'+
  '<details class="base-contract-abandon"><summary>Отказаться от заказа</summary><p>Текущий прогресс будет потерян. Награду за этот заказ Вы не получите.</p>'+
  action('abandonContract','Подтвердить отказ')+'</details></div>':
  c.status==='cooldown'?'<span class="base-contract-wait">Новый заказ через '+c.remaining+' с</span>':
  action(c.status==='ready'?'claimContract':'acceptContract',c.status==='ready'?'Забрать награду':'Принять задание',
   ['ready','available'].includes(c.status)?'':'Недоступно');
 return '<section class="base-contract '+c.status+'"><div class="base-contract-copy">'+
  '<span class="base-kicker">ПОЛЕВОЙ ЗАКАЗ</span><strong>'+c.name+'</strong>'+
  '<small>'+summary[c.status]+'</small><span class="base-contract-reward">Награда: '+
  c.ore+' сплава · '+c.data+' данных</span></div>'+contractActions+'</section>';
};
// Tactical station briefing. The mission is a world object, not a kill counter.
const corridorPanel=(base,state,compact=false)=>{
 const op=corridorOffer(base,state.operation);
 if(!op)return '';
 const done=op.status==='complete',active=op.status==='active',returning=op.phase==='return';
 const hp=active||op.resumable?Math.ceil(op.hp/CORRIDOR_OPERATION.maxHp*100):100;
 const body=done?'Передатчик уничтожен, телеметрия доставлена. Разведка дока работает дальше.':
  returning?'Глушитель отключён. Бортовой ИИ сохранил телеметрию. Вернитесь в домашний док и передайте её при стыковке (E). По дороге можно обойти преследователей или отбиться.':
  active?'Цель отмечена. Выберите дистанцию по установленному оружию: плазма до 435 м, рельс до 700 м. В пределах 315 м заряжается ЭМ-импульс. Охранение можно обойти. После отключения глушителя доставьте телеметрию в домашний док за наградой.':
  'Глушитель обнаружен примерно в 1,3 км к востоку. Стартовая плазма поражает передатчик до 435 м и сильнее вблизи; в радиусе 315 м заряжается ЭМ-импульс. Охранение можно устранить или обойти. После отключения передатчика вернитесь в док с телеметрией за наградой.';
 const actions=done?'<span class="base-op-done">✓ Изменения действуют в секторе</span>':
  active?action('baseMap',returning?'Маршрут к доку':'Показать маршрут')+(compact?'':action('abandonOperation',returning?'Отложить передачу':'Отложить · сохранить повреждения')):
  action('baseMap','Посмотреть маршрут')+
   action('acceptOperation','Принять операцию',op.status==='available'&&!state.operation?'':'Сначала завершите другую операцию или включите станцию');
 const warning=!done&&!active&&op.status!=='available'?'Сначала включите станцию.':
  !done&&!active&&state.operation?'Сначала завершите или отложите текущую особую операцию.':'';
 const facts='<div class="base-op-details">'+
  '<div><span>ЗАДАЧА</span><b>Подавить помехи и доставить телеметрию</b></div>'+
  '<div><span>ОПАСНОСТЬ</span><b>Охранение · ЭМ-импульс</b></div>'+
  '<div><span>ИЗМЕНЕНИЕ МИРА</span><b>Разведка +350 м · патрули реже</b></div></div>';
 return '<article class="base-featured-op mission-corridor '+(done?'resolved':active?'underway':'')+'">'+
  '<div class="base-featured-head"><span class="base-kicker">ОСОБАЯ ОПЕРАЦИЯ · ДОК</span><span>'+
  (done?'КОРИДОР ОТКРЫТ':returning?'ОСТАЛОСЬ ВЕРНУТЬСЯ':active?'ОПЕРАЦИЯ ПРИНЯТА':'РАЗВЕДКА ПОД ПОМЕХАМИ')+'</span></div>'+
  '<strong>'+CORRIDOR_OPERATION.name+'</strong><p>'+body+'</p>'+
  (compact?'':facts)+
  (returning?'<small>Телеметрия получена. Награда и разведка откроются после возвращения в док.</small>':
   active||op.resumable?'<small>Передатчик: '+hp+'% прочности. Повреждения сохраняются при отступлении.</small>':'')+
  (warning?'<small class="base-op-warning">'+warning+'</small>':'')+
  '<div class="base-featured-foot"><span>'+(done?'Получено: +':'Награда: +')+
  CORRIDOR_OPERATION.rewardOre+' сплава · +'+CORRIDOR_OPERATION.rewardData+
  ' данных (опыт)</span><div>'+actions+'</div></div></article>';
};
const probePanel=(base,state,compact=false)=>{
 const op=probeOffer(base,state.operation);
 if(!op)return '';
 const done=op.status==='complete',active=op.status==='active';
 const pct=Math.round((op.repair||0)/PROBE_OPERATION.maxRepair*100);
 const body=done?'Зонд снова передаёт телеметрию. Разведка лаборатории работает дальше.':
  active?'Подлетите к зонду на 150 м и удерживайте E для ремонта. Пока идёт восстановление, корабль не стреляет. Отпустите E, чтобы отразить атаку.':
  'Повреждённый зонд находится в соседнем районе. Ремонт может привлечь перехватчиков; уже выполненная работа сохранится.';
 const actions=done?'<span class="base-op-done">✓ Разведка восстановлена</span>':
  active?action('baseMap','Показать цель')+(compact?'':action('abandonOperation','Отложить · сохранить ремонт')):
  action('baseMap','Посмотреть район поиска')+
   action('acceptOperation','Принять операцию',op.status==='available'&&!state.operation?'':'Сначала завершите другую операцию или включите лабораторию');
 const warning=!done&&!active&&op.status!=='available'?'Сначала включите лабораторию.':
  !done&&!active&&state.operation?'Сначала завершите или отложите текущую особую операцию.':'';
 const facts='<div class="base-op-details">'+
  '<div><span>ЗАДАЧА</span><b>Восстановить зонд</b></div>'+
  '<div><span>ОПАСНОСТЬ</span><b>Возможны перехватчики</b></div>'+
  '<div><span>ИЗМЕНЕНИЕ МИРА</span><b>Разведка +300 м; возможен новый сигнал</b></div></div>';
 return '<article class="base-featured-op mission-probe '+(done?'resolved':active?'underway':'')+'">'+
  '<div class="base-featured-head"><span class="base-kicker">ОСОБАЯ ОПЕРАЦИЯ · ЛАБОРАТОРИЯ</span><span>'+
  (done?'СИГНАЛ ВОССТАНОВЛЕН':active?'РЕМОНТ В ПОЛЁТЕ':'СИГНАЛ БЕДСТВИЯ')+'</span></div>'+
  '<strong>'+PROBE_OPERATION.name+'</strong><p>'+body+'</p>'+
  (compact?'':facts)+
  (active||op.resumable?'<div class="base-op-progress"><span>Восстановлено: '+pct+'%</span>'+
   '<progress value="'+pct+'" max="100" aria-label="Ход восстановления зонда"></progress></div>':'')+
  (warning?'<small class="base-op-warning">'+warning+'</small>':'')+
  '<div class="base-featured-foot"><span>'+(done?'Получено: +':'Награда: +')+
  PROBE_OPERATION.rewardOre+' сплава · +'+PROBE_OPERATION.rewardData+
  ' данных (опыт)</span><div>'+actions+'</div></div></article>';
};
const relayPanel=(base,state,compact=false)=>{
 const op=relayOffer(base,state.operation,state.time);
 if(!op)return '';
 const done=op.status==='complete',active=op.status==='active';
 const body=done?'Ретранслятор защищён. Связь сохранена, разведчики получили новые координаты.':
  active?'Налётчики атакуют передатчик, а не только корабль игрока. Сбивайте их до заряженного залпа. Всего три волны с передышками.':
  'Недалеко от арсенала под угрозой ретранслятор. Подлетите к узлу — начнётся отсчёт до трёх конечных волн. При неудаче арсенал сохранится.';
 const warning=op.status==='cooldown'?'Повторная попытка через '+op.remaining+' с.':
  op.status==='locked'?'Сначала включите станцию.':
  state.operation&&!active?'Завершите или отложите текущую особую операцию.':'';
 const actions=done?'<span class="base-op-done">✓ РЕТРАНСЛЯТОР ЗАЩИЩЁН</span>':
  active?action('baseMap','Показать цель')+
   (compact?'':action('abandonOperation','Прервать · волны начнутся заново')):
  action('baseMap','Посмотреть расположение')+
   action('acceptOperation','Начать оборону',op.status==='available'&&!state.operation?'':'Сначала завершите текущую операцию или дождитесь доступа');
 const facts='<div class="base-op-details">'+
  '<div><span>ЗАДАЧА</span><b>Сохранить передатчик · 3 волны</b></div>'+
  '<div><span>ОПАСНОСТЬ</span><b>Заряжающиеся залпы · тяжёлый перехватчик</b></div>'+
  '<div><span>ПОСЛЕДСТВИЕ</span><b>Разведка следующего узла · одноразовая награда</b></div></div>';
 return '<article class="base-featured-op mission-relay '+(done?'resolved':active?'underway':'')+'">'+
  '<div class="base-featured-head"><span class="base-kicker">ОСОБАЯ ОПЕРАЦИЯ · АРСЕНАЛ</span><span>'+
  (done?'ОБОРОНА ЗАВЕРШЕНА':active?'РЕТРАНСЛЯТОР ПОД УГРОЗОЙ':'ОЖИДАЕТ ПОДМОГИ')+'</span></div>'+
  '<strong>'+RELAY_DEFENSE.name+'</strong><p>'+body+'</p>'+
  (compact?'':facts)+
  (active?'<small>Передатчик: '+Math.ceil(op.hp/op.maxHp*100)+'% · '+relayDefenseCue(op,state.time)+'</small>':'')+
  (warning?'<small class="base-op-warning">'+warning+'</small>':'')+
  '<div class="base-featured-foot"><span>'+(done?'Получено: +':'Награда: +')+
  RELAY_DEFENSE.rewardOre+' сплава · +'+RELAY_DEFENSE.rewardData+
  ' данных</span><div>'+actions+'</div></div></article>';
};
const carrierPanel=(base,state,compact=false)=>{
 const op=carrierOffer(base,state.operation,state.time);
 if(!op)return '';
 const done=op.status==='complete',active=op.status==='active',returning=op.phase==='return';
 const ongoing=active&&['contact','pursuit','turn','last'].includes(op.phase);
 const body=done?'Перехваченные сведения доставлены. На маршруте снабжения меньше вражеских патрулей.':
  returning?'Груз остановлен. Вернитесь на этот авианосец и нажмите E, чтобы сдать сведения и получить награду.':
  ongoing?'Нос прикрыт бронёй; с кормы урон выше и можно повредить двигатели. Выйдите за 230 м перед разрядом и атакуйте в трёхсекундное окно открытой брони. Охранение можно обойти или уничтожить.':
  active?'Найдите отмеченный район. Транспорт начнёт движение только после сближения; до этого времени ограничение отсутствует.':
  'Снабжение противника проходит поблизости. '+CARRIER_INTERCEPTION.desc;
 const actions=done?'<span class="base-op-done">✓ ПАТРУЛИ ОСЛАБЛЕНЫ</span>':
  active?action('baseMap',returning?'Маршрут к авианосцу':'Показать конвой')+
   (compact?'':action('abandonOperation','Отложить · начать погоню заново')):
  action('baseMap','Район встречи')+
   action('acceptOperation',returning?'Сдать сохранённые сведения':'Принять перехват',
    op.status==='available'&&!state.operation?'':'Завершите текущую операцию или дождитесь новой попытки');
 const warning=op.status==='cooldown'?'Новый конвой через '+op.remaining+' с.':
  op.status==='locked'?'Сначала включите авианосец.':
  state.operation&&!active?'Сначала завершите или отложите текущую особую операцию.':'';
 const facts='<div class="base-op-details">'+
  '<div><span>ЗАДАЧА</span><b>Догнать груз до выхода · вернуться</b></div>'+
  '<div><span>УГРОЗА</span><b>Охранение · носовая броня · разряд 230 м</b></div>'+
  '<div><span>ПОСЛЕДСТВИЕ</span><b>Патрули реже вдоль маршрута</b></div></div>';
 return '<article class="base-featured-op mission-carrier '+(done?'resolved':active?'underway':'')+'">'+
  '<div class="base-featured-head"><span class="base-kicker">ОСОБАЯ ОПЕРАЦИЯ · АВИАНОСЕЦ</span><span>'+
   (done?'МАРШРУТ ОСЛАБЛЕН':returning?'ВЕРНИТЕСЬ С ДАННЫМИ':ongoing?'ПОГОНЯ':'КОНВОЙ НА ПОДХОДЕ')+'</span></div>'+
  '<strong>'+CARRIER_INTERCEPTION.name+'</strong><p>'+body+'</p>'+
  (compact?'':facts)+
  (ongoing?'<small>Транспорт: '+Math.ceil(op.hp/CARRIER_INTERCEPTION.maxHp*100)+
   '% · до выхода '+Math.ceil(op.distanceRemaining)+' м.</small>':'')+
  (warning?'<small class="base-op-warning">'+warning+'</small>':'')+
  '<div class="base-featured-foot"><span>'+(done?'Получено: +':'Награда: +')+
   CARRIER_INTERCEPTION.rewardOre+' сплава · +'+CARRIER_INTERCEPTION.rewardData+
   ' данных</span><div>'+actions+'</div></div></article>';
};
const specialOffer=(base,state)=>corridorOffer(base,state.operation)||
 probeOffer(base,state.operation)||relayOffer(base,state.operation,state.time)||
 carrierOffer(base,state.operation,state.time);
const specialPanel=(base,state,compact=false)=>
 corridorOffer(base,state.operation)?corridorPanel(base,state,compact):
 probeOffer(base,state.operation)?probePanel(base,state,compact):
 relayOffer(base,state.operation,state.time)?relayPanel(base,state,compact):carrierPanel(base,state,compact);
const baseBrief=(base,state,o)=>{
 const op=corridorOffer(base,state.operation);
 if(op){
  if(op.status==='complete')return ['ПОМЕХИ УСТРАНЕНЫ','Коридор открыт',
   'Дальность местной разведки выросла, патрули возле дома стали реже. Станция больше не заглушена.'];
  if(op.phase==='return')return ['ПОМЕХИ СНЯТЫ','Вернитесь с телеметрией',
   'Передатчик отключён. Сохранённые данные нужно доставить в док. По дороге возможен перехват; вступать в бой необязательно.'];
  if(op.status==='active')return ['ОПЕРАЦИЯ ВЫПОЛНЯЕТСЯ','Найдите передатчик',
   'Можно прорваться к глушителю или сначала уничтожить охранение. Передатчик заряжает ЭМ-импульс вблизи; затяжной бой привлечёт подкрепление. Награда — после возвращения в док.'];
  return ['РАЗВЕДКА ПОД ПОМЕХАМИ','Глушитель на востоке',
   'Сеть станций работает, но передатчик мешает местной разведке. Отключите его и вернитесь с телеметрией в док, чтобы сделать маршрут спокойнее.'];
 }
 const probe=probeOffer(base,state.operation);
 if(probe){
  if(probe.status==='complete')return ['ТЕЛЕМЕТРИЯ ПОЛУЧЕНА','Новый участок разведан',
   'Зонд восстановлен, местная разведка расширена. Если поблизости найден ещё один узел, его отметка появилась на карте.'];
  if(probe.status==='active')return ['ВОССТАНОВЛЕНИЕ ЗОНДА','Последний сигнал',
   'Удерживайте E возле зонда для ремонта. Отпускайте E, чтобы стрелять по врагам. Ремонт не обнуляется при отступлении.'];
  return ['СИГНАЛ БЕДСТВИЯ','Потерян разведывательный зонд',
   'В космосе поблизости остался повреждённый зонд. Его можно вернуть и получить данные для дальнейшего исследования.'];
 }
 const relay=relayOffer(base,state.operation,state.time);
 if(relay){
  if(relay.status==='complete')return ['ОБОРОНА УДАЛАСЬ','Ретранслятор сохранён',
   'Станция отбила нападение, разведка получила координаты дополнительного узла.'];
  if(relay.status==='active')return ['НАЛЁТ НА РЕТРАНСЛЯТОР','Удержите связь',
   'Перехватывайте корабли, которые сближаются с передатчиком. После каждой волны можно сменить позицию.'];
  return ['ТРЕВОГА НА АРСЕНАЛЕ','Нужна защита ретранслятора',
   'Три короткие волны налётчиков стремятся уничтожить ближайший передатчик. Успейте перехватить их.'];
 }
 const carrier=carrierOffer(base,state.operation,state.time);
 if(carrier){
  if(carrier.status==='complete')return ['КОНВОЙ ПЕРЕХВАЧЕН','Снабжение нарушено',
   'Сведения сданы. Вдоль перехваченного маршрута патрули противника появляются реже.'];
  if(carrier.phase==='return')return ['ГРУЗ ОСТАНОВЛЕН','Доставьте сведения',
   'Подлетите к авианосцу и нажмите E, чтобы сдать телеметрию. Охранение может продолжать погоню.'];
  if(carrier.status==='active')return ['ПЕРЕХВАТ НАЧАТ','Остановите транспорт',
   'Сначала найдите район встречи. После обнаружения груз начнёт двигаться к линии выхода; его можно атаковать вместе с охранением.'];
  return ['РАЗВЕДКА СНАБЖЕНИЯ','Перехват конвоя',
   'На маршруте обнаружен груз противника. После сближения с районом встречи начнётся погоня; награда — за доставленные сведения.'];
 }
 if(!o.connected)return ['УЗЕЛ АВТОНОМЕН','Связь отсутствует',
  'Местные услуги работают. Чтобы получить доступ к сети, соедините включённые станции.'];
 const brief={
  arsenal:['ОБОРОННЫЙ УЗЕЛ','Подготовка к бою','Арсенал оснащает ударных дронов и позволяет укреплять оборону ближайшего сектора.'],
  lab:['РАЗВЕДЫВАТЕЛЬНЫЙ УЗЕЛ','Исследование сектора','Лаборатория помогает обнаруживать богатую руду и дополнительные сигналы.'],
  carrier:['УДАРНАЯ ПОДДЕРЖКА','Авиагруппа готовится','Здесь можно снарядить бомбардировщиков для штурма вражеских укреплений.'],
  dock:['ДОМАШНИЙ ДОК','Убежище и ремонт','Рядом с доком корабль восстанавливается. Подготовьте дронов к следующему вылету.']
 };
 return brief[base.type]||brief.dock;
};
const basePreview=(base,state)=>renderStationRoutePreview(base,state);

const stationNoun=n=>n%10===1&&n%100!==11?'узел':
 n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'узла':'узлов';
// Show what an antenna purchase would actually change, without revealing undiscovered stations.
// An opposite node's antenna can add another 500 m to a radio link.
const networkPreview=(base,state)=>{
 const world=state.world;
 if(!base.active||!world?.stations||typeof world.networkTopology!=='function')return '';
 const now=world.networkTopology();
 const after=base.relayBoost?now:world.networkTopology(base.id);
 const currentRadius=RELAY_RANGE+(base.relayBoost?RELAY_EXTENSION:0);
 const nextRadius=base.relayBoost?currentRadius:currentRadius+RELAY_EXTENSION;
 const gain=Math.max(0,after.count-now.count);
 const visible=[...world.stations.values()].filter(s=>
  s.active&&s.discovered&&!s.enemy&&s.id!==base.id);
 const newly=visible.filter(s=>!now.linked.has(s.id)&&after.linked.has(s.id));
 const scale=.044,cx=220,cy=104;
 const circle=(radius,stroke,dash='')=>'<circle cx="'+cx+'" cy="'+cy+'" r="'+
  (radius*scale).toFixed(1)+'" fill="none" stroke="'+stroke+
  '" stroke-width="2"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
 const markers=visible.map(s=>{
  const x=cx+(s.x-base.x)*scale,y=cy+(s.y-base.y)*scale;
  if(x<15||x>425||y<14||y>196)return '';
  const added=!now.linked.has(s.id)&&after.linked.has(s.id);
  const color=added?'#b7f68c':now.linked.has(s.id)?'#82ecd8':'#ffc884';
  return '<g><title>'+(baseNames[s.type]||'Станция')+' · '+
   Math.round(Math.hypot(s.x-base.x,s.y-base.y))+' м'+
   (added?' · подключится после усиления':'')+'</title>'+
   '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(added?7:5)+
   '" fill="'+color+'"'+(added?' stroke="#efffd2" stroke-width="1.5"':'')+'/></g>';
 }).join('');
 const result=base.relayBoost?'Антенна уже усилена. Учитывайте дальность соседних узлов.':
  gain>0?'После усиления в сети будет '+after.count+' '+stationNoun(after.count)+
   ' (сейчас '+now.count+').':
   'Сейчас усиление не подключит новых станций. Оно пригодится для более дальних узлов.';
 const names=newly.length?'<small>Подключатся: '+newly.slice(0,3).map(s=>
  (baseNames[s.type]||'Станция')+' · '+Math.round(Math.hypot(s.x-base.x,s.y-base.y))+
  ' м').join('; ')+(newly.length>3?' и другие':'')+'.</small>':'';
 return '<section class="base-network-preview"><span class="base-kicker">СВЯЗЬ · ПРОГНОЗ</span>'+
  '<strong>Радиус антенны: '+currentRadius+
  (base.relayBoost?' м':' → '+nextRadius+' м')+'</strong>'+
  '<p>'+result+'</p>'+names+
  '<details><summary>Посмотреть действие антенны на карте</summary>'+
  '<svg viewBox="0 0 440 210" role="img" aria-label="Текущий радиус связи, радиус после усиления и известные действующие станции">'+
  '<rect width="440" height="210" rx="12" fill="#071c2b"/>'+
  '<path d="M 0 104 H 440 M 220 0 V 210" stroke="#568fa132"/>'+
  circle(currentRadius,'#68c8d5')+
  (base.relayBoost?'':circle(nextRadius,'#e8c37e','6 5'))+markers+
  '<circle cx="220" cy="104" r="8" fill="#a8fff0" stroke="#ffffff"/>'+
  '<text x="231" y="122" fill="#dbfff5" font-size="12">ВАША СТАНЦИЯ</text>'+
  '</svg><small>Бирюзовый узел — в сети, янтарный — автономен, зелёный — подключится. '+
  'Показаны только известные включённые станции. Усиления на обоих концах радиоканала складываются.</small></details>'+
  '<div class="base-network-preview-actions">'+
  '<button type="button" data-act="baseMap">Открыть полную карту</button></div></section>';
};
const tabHelp={summary:'Награды, ремонт и дроны.',operations:'Заказы, операции и цели в регионах.',hangar:'Выберите узел корабля, затем оружие. Оно устанавливается сразу.',network:'Защита, улучшения станции и перелёты.'};
const tabButton=(id,name,selected,notice='')=>'<button type="button" role="tab" id="base-tab-'+id+'" aria-controls="base-panel-'+id+'"'+(notice?' data-notice="'+notice+'" aria-label="'+name+' · '+notice+'"':'')+' tabindex="'+(id===selected?'0':'-1')+'" data-act="baseTab" data-role="'+id+
 '" aria-selected="'+(id===selected)+'" class="'+(id===selected?'selected':'')+'">'+name+'</button>';
const tabPanel=(id,selected,body)=>'<section class="base-tab-panel" id="base-panel-'+id+'" aria-labelledby="base-tab-'+id+'" role="tabpanel" data-tab="'+id+'"'+
 (id===selected?'':' hidden')+'>'+body+'</section>';

// Station entry should tell the pilot what to do now. Awards still go through
// their existing game handlers; this only changes where the actions appear.
function stationNextStep(base,state,o,regionalGoal=false){
 const c=state.contract;
 const local=c?.baseId===base.id;
 const ready=local&&c.progress>=c.goal;
 const origin=c&&!local?state.world?.stations?.get(c.baseId):null;
 const destination=origin?(baseNames[origin.type]||'исходную станцию'):'станцию, где Вы приняли заказ';
 const op=state.operation;
 let kind='standard',title='Выберите следующее задание';
 let description='Начните с небольшого заказа или особой операции. Награда и условия видны до принятия.';
 let buttons=action('baseTab','Посмотреть задания','','operations');
 if(ready){
  kind='reward';title='Заказ выполнен — заберите награду';
  description=c.name+': +'+c.ore+' сплава и +'+c.data+' данных. Награда ещё не зачислена.';
  buttons=action('claimContract','Забрать награду');
 }else if(c&&!local&&c.progress>=c.goal){
  kind='return';title='Награда ждёт на другой станции';
  description='Заказ «'+c.name+'» выполнен. Вернитесь на '+destination+
   ' и пристыкуйтесь. Здесь получить награду нельзя.';
  buttons=action('baseMap','Показать станцию на карте');
 }else if(op?.phase==='return'&&op.baseId!==base.id){
  kind='return';title='Доставьте сведения на исходную станцию';
  description='Цель особой операции достигнута. Для завершения вернитесь на станцию, где приняли её, и нажмите E.';
  buttons=action('baseMap','Показать маршрут');
 }else if(state.firstHardwareReward==='pending'){
  kind='reward';title='Вы получили новое оружие';
  description='Первый заказ уже оплачен. Осталось бесплатно выбрать один из трёх боевых модулей. Сплав не тратится.';
  buttons=action('baseTab','Выбрать оружие','','operations');
 }else if(c){
  kind='active';title='Заказ в работе: '+c.progress+' из '+c.goal;
  description='«'+c.name+'». '+(local?o.contract.desc+' Здесь Вы сможете сдать заказ после выполнения.':
   'Для получения награды вернитесь на '+destination+'.');
  buttons=action('baseTab','Посмотреть задание','','operations');
 }else if(state.lastContractReceipt?.firstHardwareReward===state.firstHardwareReward&&
  Object.hasOwn(FIRST_CONTRACT_MODULES,state.firstHardwareReward)){
  kind='complete';title='Оружие получено';
  const equipped=typeof state.lastContractReceipt?.firstHardwareInstalled==='boolean'?
   state.lastContractReceipt.firstHardwareInstalled:
   state.loadout?.slots?.includes(state.firstHardwareReward);
  description=equipped?'Модуль установлен на корабль и готов к бою.':
   'Модуль на складе. Откройте корабль, выберите свободный узел и установите его.';
  buttons=action('baseTab','Посмотреть корабль','','hangar');
 }else if(op&&op.status!=='complete'){
  kind='active';title='Особая операция в работе';
  description=op.baseId===base.id?
   'Цель отмечена на карте. Посмотрите условия и подготовьте корабль перед вылетом.':
   'Вы приняли операцию на другой станции. Её цель отмечена на карте; здесь можно обслужить корабль.';
  buttons=op.baseId===base.id?action('baseTab','Посмотреть операцию','','operations'):
   action('baseMap','Показать цель на карте');
 }
 if(kind==='standard'&&regionalGoal){
  title='Выберите цель следующего вылета';
  description='В заданиях доступны заказы с наградой и планы действий против вражеских станций.';
 }
 return '<section class="base-next-step '+kind+'" aria-label="Что делать сейчас">'+
  '<div><span class="base-kicker">ЧТО СЕЙЧАС ВАЖНО</span><h3>'+title+'</h3><p>'+description+'</p></div>'+
  '<div class="base-next-actions">'+buttons+'</div></section>';
}

export function renderBasePanel(base,state){
 const fieldKey=readableKey((state.controls||DEFAULT_CONTROLS).field);
 const o=baseOffer(base,state),active=!!base.active;
 const status=base.suppressed?'СВЯЗЬ ПОДАВЛЕНА':active?(o.connected?'СЕТЬ ПОДКЛЮЧЕНА':'АВТОНОМНЫЙ УЗЕЛ'):'СТАНЦИЯ ВЫКЛЮЧЕНА';
 const activation=card('base-power'+(active?' connected':''),
  '01 · УЗЕЛ СЕТИ',active?'Станция активна':'Включить станцию',
  active?(o.connected?'Связь с домашним доком. Услуги сети доступны.':
   'Работает локально. Активируйте промежуточные станции, чтобы соединить её с сетью.'):
   (o.relayCost?'Запуск узла требует '+o.relayCost+' сплава. После включения появятся местные услуги и доступ к сети.':'Первый док: +20 сплава и небольшой ремонт. Другие базы дают доступ к услугам и технологиям.'),
  active?'<span class="base-ready">✓ Питание включено</span>':
   action('activate',o.relayCost?'Подключить · '+o.relayCost+' сплава':'Запустить бесплатно',o.reasons.activate));
 const hire=card('base-service'+(!active?' inactive':''),
  '02 · БОЕВОЙ ДРОН',o.drone.name+' · '+state.allies+'/'+o.cap,
  o.drone.desc+' Дрон остаётся рядом.'+(o.replacing?' Заменяет дрона другого типа с частичным зачётом стоимости.':''),
  action('hire',(o.replacing?'Заменить · ':'Нанять · ')+o.hireCost+' сплава',o.reasons.hire,o.drone.role),
  o.reasons.hire);
 const upgrade=card('base-service'+(!active?' inactive':''),
  '03 · ТЕХНОЛОГИЯ СЕТИ',o.tech.name+' · '+o.level+' / 6',
  o.tech.desc+' Один шаг на каждой станции этого типа.',
  action('upgrade','Развить · '+o.upgradeCost+' сплава',o.reasons.upgrade),
  o.reasons.upgrade);
 const repair=card('base-service'+(!active?' inactive':''),
  '04 · ТЕХОБСЛУЖИВАНИЕ','Ремонт корабля и дронов',
  base.type==='dock'?
   'Бесплатно: если вокруг безопасно, отстыкуйтесь и держитесь в 165 м от дока. Через 4 с без попаданий корпус будет восстанавливаться примерно на 3 ед./с. Платный ремонт возвращает до '+Math.ceil(o.repairAmount)+' ед. сразу; при небольших повреждениях обычно выгоднее подождать.':
   'Платный ремонт восстанавливает до '+Math.ceil(o.repairAmount)+' ед. корпуса сразу. Повреждённых дронов можно починить отдельно.',
  action('repair','Корпус · '+o.repairCost+' сплава',o.reasons.repair)+
  action('repairDrones','Дроны · '+o.droneRepairCost+' сплава',o.reasons.drones),
  o.reasons.repair&&o.reasons.drones?'':undefined);
 const local=o.localService?card('base-service base-local',
   '05 · МЕСТНАЯ УСЛУГА',o.localService.name,
   o.localService.desc,
   action('service','Применить · '+o.localService.cost+' сплава',o.reasons.service),
   o.reasons.service):'';
 const supply=base.type==='carrier'?
  '<div class="base-support"><div><b>✧ УДАРНАЯ ЭСКАДРИЛЬЯ</b><small>Снарядите до двух вылетов. Нажмите B у вражеской базы: бомбардировщики появятся на время и уйдут. Перезарядка 35 с.</small></div>'+
  action('supply','Снарядить · '+o.chargeCost+' сплава',o.reasons.supply)+
  '<span>Зарядов: '+state.charges+' / 2</span></div>':'';
 const transit=o.connected&&state.connectedBases>=2&&o.transfers.length?
  '<section class="base-transit"><div class="base-transit-head"><b>06 · МАРШРУТЫ СЕТИ</b><small>Между включёнными станциями можно перелететь за сплав. Сопровождающие дроны следуют за вами.</small></div><div class="base-transit-routes">'+
  o.transfers.map(t=>action('transfer',(baseNames[t.type]||'Станция')+' · '+t.distance+' м · '+t.cost+' сплава',shortfall(t.cost,o.ore),t.id)).join('')+
  '</div></section>':'';
 const modules=active?'<section class="base-modules"><div class="base-modules-heading"><span class="base-kicker">СПЕЦИАЛИЗАЦИЯ СТАНЦИИ</span><strong>'+
  (base.module?'Модуль установлен':'Выберите одно оснащение')+'</strong><small>'+
  (base.module?'Модуль закреплён за этой станцией: при следующей стыковке заменить его нельзя.':
   'Можно установить только один модуль. После установки заменить его в этом прохождении нельзя; перед покупкой потребуется подтверждение.')+
  '</small></div><div class="base-module-options">'+o.moduleOptions.map(m=>
  '<div class="base-module-option'+(base.module===m.key?' selected':'')+'"><strong>'+m.name+'</strong><small>'+m.desc+'</small>'+
  (base.module===m.key?'<span class="base-module-installed">✓ УСТАНОВЛЕНО</span>':
   action('installModule','Установить · '+m.cost+' сплава',m.reason,m.key))+'</div>').join('')+
  '</div></section>':'';
 const antenna=active?card('base-service base-antenna',
  'СВЯЗЬ · РЕТРАНСЛЯТОР',base.relayBoost?'Антенна усилена':'Усилить антенну',
  'Стандартная связь '+RELAY_RANGE+' м. Усиление добавляет '+RELAY_EXTENSION+' м к дальности узла. '+
  ((state.relayGain||0)>0?'Сейчас подключит ещё '+state.relayGain+' узл(а).':
   'Помогает соединить удалённые станции. На карте видно, какие узлы пока автономны.'),
  base.relayBoost?'<span class="base-ready">✓ УСТАНОВЛЕНО</span>':
   action('antenna','Усилить · '+o.antennaCost+' сплава',o.reasons.antenna),o.reasons.antenna):'';
 const selected=['summary','operations','hangar','network'].includes(state.baseTab)?state.baseTab:'summary';
 const firstReward=active?firstContractRewardPanel(state):'';
 const firstRewardPromise=active&&state.firstHardwareReward==null;
 const stationPromise=arsenalDiscoveryPromise(base,state.world)||labDiscoveryPromise(base,state.world);
 const brief=baseBrief(base,state,o);
 const lastSortie=state.sortieReports?.at(-1);
 const signed=n=>(n>0?'+':'')+n;
 const choices=lastSortie?nextEconomyChoices(base,state,o,lastSortie):[];
 const details=lastSortie?.details;
 const oreTracked=details?details.oreMining+details.oreSalvage+details.oreOperations+details.oreContracts:0;
 const dataTracked=details?details.dataCombat+details.dataOperations+details.dataContracts+details.dataOther:0;
 const recent=(state.sortieReports||[]).slice(-5).reverse();
 const expenses=state.economyExpenses;
 const expenseTotal=expenses?Object.values(expenses).reduce((sum,n)=>sum+n,0):0;
 const expenseText=expenses?'<p>Потрачено за это прохождение: '+expenseTotal+
  ' сплава (вооружение '+expenses.weapons+', дроны '+expenses.drones+
  ', ремонт '+expenses.repairs+', станции '+expenses.stations+
  ', снаряжение '+expenses.services+', перелёты '+expenses.travel+').</p>':'';
 const flightsWord=n=>n%10===1&&n%100!==11?'вылет':
  n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'вылета':'вылетов';
 const history='<details class="base-economy-breakdown"><summary>История: '+recent.length+' '+
  flightsWord(recent.length)+' и расходы</summary>'+expenseText+
  '<div class="base-economy-history"><table><thead><tr><th scope="col">Время</th><th scope="col">Сплав</th>'+
  '<th scope="col">Данные</th><th scope="col">Итог корпуса</th></tr></thead><tbody>'+
  recent.map(r=>'<tr><td>'+Math.floor(r.seconds/60)+' мин '+r.seconds%60+' с'+
   (r.outcome==='lost'?' · гибель':'')+'</td><td>'+signed(r.ore)+'</td><td>'+signed(r.data)+
   '</td><td>'+signed(r.hull)+'</td></tr>').join('')+'</tbody></table></div></details>';
 const claim=state.lastContractReceipt;
 const claimNote=claim?'<p class="base-economy-claim" role="status">Награда за полевой заказ получена: +'+
  claim.ore+' сплава, +'+claim.data+' данных. '+(claim.credited?
   'Она включена в отчёт того вылета, где выполнен заказ.':
   'В прежней истории нет подходящего отчёта; награда зачислена на счёт.')+'</p>':'';
 const breakdown=details?'<details class="base-economy-breakdown"><summary>Источники ресурсов и последствия боя</summary>'+
  '<div class="base-economy-sources"><p><b>Сплав:</b> добыча '+signed(details.oreMining)+
  ' · трофеи '+signed(details.oreSalvage)+' · операции '+signed(details.oreOperations)+
  ' · заказы '+signed(details.oreContracts)+
  (lastSortie.ore!==oreTracked?' · прочие изменения '+signed(lastSortie.ore-oreTracked):'')+'</p>'+
  '<p><b>Данные:</b> сражения '+signed(details.dataCombat)+
  ' · операции '+signed(details.dataOperations)+' · заказы '+signed(details.dataContracts)+
  (details.dataOther?' · другие достижения '+signed(details.dataOther):'')+
  (lastSortie.data!==dataTracked?' · прочие изменения '+signed(lastSortie.data-dataTracked):'')+'</p>'+
  '<p><b>Повреждения корпуса:</b> '+details.damageTaken+
  ' · поглощено щитом '+details.shieldDamage+' · восстановлено в полёте '+details.hullRepaired+
  ' · уничтожено дронов '+details.dronesLost+'.</p></div></details>':'';
 const experienceNote=Number.isFinite(state.xp)&&Number.isFinite(state.nextXp)&&
  Number.isInteger(state.level)?'<p>Данные дают опыт пилоту: до уровня '+(state.level+1)+
  ' осталось '+Math.max(0,Math.ceil(state.nextXp-state.xp))+
  '. Новый уровень даёт очко развития; навыки доступны по U и в ангаре.</p>':'';
 const shortage=o.relayCost>o.ore?o.relayCost-o.ore:0;
 const reserveRoute=state.contract?
  (state.contract.progress>=state.contract.goal?
   'Принятый заказ выполнен: сдайте его на станции, где получили.':
   'Завершите уже принятый заказ и сдайте его на исходной станции.'):
  o.contract?.status==='cooldown'?
   'Повторные заказы станут доступны здесь через '+o.contract.remaining+' с.':
  o.contract?.status==='available'?
   'Здесь можно выбрать полевой заказ с наградой от '+
    Math.min(...o.contractOptions.map(c=>c.ore))+' до '+
    Math.max(...o.contractOptions.map(c=>c.ore))+' ед. сплава.':
   'Ищите месторождения и доступные задания на карте.';
 const reserveNote=shortage&&o.contractOptions?.length?'<p>Можно пока ничего не покупать: до следующей станции не хватает '+shortage+
  ' ед. сплава. '+reserveRoute+'</p>':'';
 const report=active&&lastSortie?'<section class="base-economy" aria-label="Итоги последнего вылета">'+
  '<div class="base-economy-head"><div><span class="base-kicker">ПОСЛЕ ВЫЛЕТА</span>'+
  '<h3>Итоги последнего вылета</h3></div><small>'+Math.floor(lastSortie.seconds/60)+' мин '+
  (lastSortie.seconds%60)+' с · '+((state.sortieReports?.length||1)>=24?'последние 24 вылета':
   'вылетов учтено: '+(state.sortieReports?.length||1))+'</small></div>'+
  '<div class="base-economy-deltas"><span>Сплав <b>'+signed(lastSortie.ore)+'</b></span>'+
  '<span>Данные <b>'+signed(lastSortie.data)+'</b></span>'+
  '<span>Корпус, итог <b>'+signed(lastSortie.hull)+'</b></span>'+
  (details?'<span>Получено повреждений <b>'+details.damageTaken+'</b></span>':'')+
  (details?.dronesLost?'<span>Потеряно дронов <b>'+details.dronesLost+'</b></span>':'')+
  (lastSortie.levels?'<span>Уровни <b>+'+lastSortie.levels+'</b></span>':'')+'</div>'+
  '<p>Ресурсы за вылет и награды за сданные заказы. Изменение корпуса показано после восстановления. Покупки на станции в доход не включены.</p>'+experienceNote+
  claimNote+breakdown+history+
  (choices.length?'<div class="base-economy-head"><div><span class="base-kicker">СЛЕДУЮЩЕЕ РЕШЕНИЕ</span>'+
   '<h3>Как распорядиться '+o.ore+' ед. сплава?</h3></div></div>'+
   '<div class="base-economy-choices">'+choices.map(choice=>
    '<article><strong>'+choice.title+'</strong><small>'+choice.detail+'</small>'+
    '<span>'+(choice.cost===null?'Посмотреть варианты':choice.cost?choice.cost+' сплава':'Бесплатно')+
     (choice.cost===null?'':choice.cost===0?' · сплав не расходуется':' · '+
     (choice.reason?choice.reason:choice.act==='baseMap'?
      (o.ore>=choice.cost?'уже достаточно для запуска':'до цели '+(choice.cost-o.ore)):
      o.ore>=choice.cost?'после покупки останется '+(o.ore-choice.cost):
      'нужно ещё '+(choice.cost-o.ore)))+'</span>'+
    action(choice.act,choice.act==='baseMap'?'Открыть карту':
     choice.act==='close'?'Вылететь за рудой':
     choice.act==='showFieldTrial'?'Испытать бесплатно':
     choice.act==='baseTab'?({hangar:'Перейти в ангар',network:'Открыть сеть',
      operations:'Открыть задания'}[choice.role]||'Открыть раздел'):
     choice.act==='hire'?'Нанять дрона':choice.act==='repair'?'Ремонтировать':'Зарядить щит',choice.reason,choice.role)+
    '</article>').join('')+'</div>'+reserveNote:'')+'</section>':'';
 const repairHint=state.hp<state.maxHp?
  'Корпус '+Math.ceil(state.hp)+'/'+state.maxHp+'. Быстрый ремонт восстановит до '+
  Math.ceil(o.repairAmount)+' ед. за '+o.repairCost+' сплава.':
  'Корпус '+Math.ceil(state.hp)+'/'+state.maxHp+' — ремонт не требуется.';
 const quickTrial=state.fieldTrialPickerOpen&&base.id==='0:0'&&!state.fieldTrialTaken&&!state.fieldLoan?
  '<section class="base-trial-picker" aria-label="Бесплатное пробное оружие">'+
  '<strong>Выберите одно пробное оружие</strong><p>На выбор один бесплатный модуль с тремя зарядами. При наличии свободного узла модуль установится сразу.</p>'+
  '<div class="base-trial-options">'+
  '<div><b>Ионный проводник</b><small>Цепной разряд по целям с плазменными метками · '+fieldKey+'</small>'+
  action('loanField','Выбрать ионный','','ion')+'</div>'+
  '<div><b>Резонатор</b><small>Связывает несколько целей и передаёт между ними часть урона · '+fieldKey+'</small>'+
  action('loanField','Выбрать резонатор','','resonator')+'</div></div></section>':'';
 const regionalGoal=state.world&&state.position?renderHomeConflict({world:state.world,player:state.position,
  time:state.time,openingArc:state.openingArc},{compact:true}):'';
 const campaign=state.world&&state.position?renderCampaignProgress({world:state.world,player:state.position,
  time:state.time},{compact:true}):'';
 const capturedWing=autonomousStrikeCarrier(base)?'<section class="home-conflict"><strong>Открыта трофейная авиагруппа</strong><p>Этот сборочный узел может снаряжать бомбардировщики без связи с домашним доком. Они поддержат штурм вражеской базы в пределах 9800 м отсюда. Один вылет стоит '+o.chargeCost+' сплава; запас — до двух.</p>'+
  action('supply','Снарядить авиаудар · '+o.chargeCost+' сплава',o.reasons.supply)+'</section>':'';
 const suppression=base.suppressed?'<section class="home-conflict"><strong>Связь станции подавлена</strong><p>Радиоперехват, перелёты и услуги сети временно недоступны. Местный ремонт работает. Отстыкуйтесь и уничтожьте носитель помех или дождитесь восстановления в полёте. Меню останавливает игровое время.</p></section>':'';
 const threats=state.world?renderStationThreats({world:state.world,enemies:state.enemies||[],time:state.time,player:state.position}):'';
 const dashboard=stationNextStep(base,state,o,!!(regionalGoal||campaign))+suppression+
  (threats?'<aside class="base-alert" role="status"><span>Противник угрожает связи станций.</span>'+
   action('baseTab','Посмотреть угрозы','','network')+'</aside>':'')+
  '<div class="base-quick-services">'+
  '<section class="base-quick-service"><span class="base-kicker">КОРАБЛЬ</span><h3>Ремонт и оснащение</h3>'+
  '<button type="button" class="menu-info" data-help-only data-help="'+repairHint+(base.type==='dock'?' Бесплатный ремонт: отстыкуйтесь и оставайтесь рядом с доком без попаданий. Меню останавливает время.':'')+'" aria-label="Условия ремонта">i</button>'+
  '<p>Корпус '+Math.ceil(state.hp)+' / '+state.maxHp+(state.hp<state.maxHp?' · есть повреждения':' · исправен')+'</p>'+
  '<div class="base-quick-buttons">'+
  (state.hp<state.maxHp?action('repair','Починить · '+o.repairCost+' сплава',o.reasons.repair):'')+
  (base.id==='0:0'&&!state.fieldTrialTaken&&!state.fieldLoan?
   action('showFieldTrial',state.fieldTrialPickerOpen?'Скрыть пробное оружие':'Выбрать пробное оружие'):'')+
  action('baseTab','Открыть корабль','','hangar')+'</div>'+
  quickTrial+
  (state.hp<state.maxHp&&o.reasons.repair?'<small class="base-quick-reason">'+o.reasons.repair+'</small>':'')+'</section>'+
  '<section class="base-quick-service"><span class="base-kicker">ПОДДЕРЖКА</span><h3>Боевые дроны</h3>'+
  '<p>В строю '+state.allies+' / '+o.cap+(state.droneDamage>0?' · есть повреждения':'')+'</p>'+
  '<button type="button" class="menu-info" data-help-only data-help="'+o.drone.desc+'" aria-label="О боевом дроне">i</button>'+
  '<div class="base-quick-buttons">'+
  (state.droneDamage>0?action('repairDrones','Ремонт дронов · '+o.droneRepairCost+' сплава',o.reasons.drones):'')+
  action('hire',(o.replacing?'Заменить':'Нанять')+' · '+o.hireCost+' сплава',o.reasons.hire,o.drone.role)+
  '</div>'+(o.reasons.hire?'<small class="base-quick-reason">'+o.reasons.hire+'</small>':'')+
  '</section></div>'+
  '<details class="base-secondary-info"><summary>Станция · '+brief[0]+' · карта и подробности</summary>'+
  '<div class="base-secondary-body"><p><b>'+brief[1]+'.</b> '+brief[2]+'</p>'+
  basePreview(base,state)+'</div></details>'+
  (firstRewardPromise?'<div class="base-quiet-promise">'+
   'Первый сданный заказ даст бесплатное оружие на выбор.</div>':'')+
  (stationPromise?'<div class="base-quiet-promise">'+stationPromise+'</div>':'');
 const localOperation=state.operation?.baseId===base.id;
 const hasAcceptedWork=localOperation||o.contract.status==='active'||o.contract.status==='ready';
 const operations='<div class="base-operations"><div class="base-view-intro"><div><span class="base-kicker">ВАШИ ЗАДАНИЯ</span><strong>'+
  (hasAcceptedWork?'Текущие задания':'Куда отправимся?')+'</strong>'+
  '<p>'+(localOperation?'Нажмите на особую операцию, чтобы увидеть подробности. ':hasAcceptedWork?'':
   'Можно выполнить одну особую операцию и один полевой заказ одновременно. ')+
  'Условия завершения и получения награды указаны у каждого задания.</p></div></div>'+
  firstReward+
  (o.contract.status==='ready'?'<h3 class="base-section-title">Готовая награда</h3>'+contractPanel(o,state):'')+
  (specialOffer(base,state)?'<details class="base-mission-details"><summary>Особая операция · '+
   (specialOffer(base,state)?.name||(baseNames[base.type]||'Станция'))+
   (localOperation?' · '+(state.operation.phase==='return'?'Вернуться за наградой':'В работе'):'')+
   '</summary>'+specialPanel(base,state)+'</details>':'')+
  (o.contract.status==='ready'?'':'<h3 class="base-section-title">Полевые заказы</h3>'+contractPanel(o,state))+
  (regionalGoal||campaign?'<details class="base-secondary-info base-region-plans" data-hangar-section="region-plans">'+
   '<summary>Цели в регионах · ослабить противника и открыть станции</summary>'+regionalGoal+campaign+'</details>':'')+'</div>';
 const localMission=specialOffer(base,state),hullPercent=Math.round(state.hp/state.maxHp*100);
 const missionForPreparation=state.operation||localMission;
 const missionContext=missionForPreparation&&missionForPreparation.status!=='complete'?
  (missionForPreparation.id===PROBE_OPERATION.id?
   'Операция «Последний сигнал»: при ремонте зонда корабль не стреляет. Дрон может прикрыть его, но не гарантирует безопасность.':
   missionForPreparation.id===RELAY_DEFENSE.id?
   'Операция «Оборона ретранслятора»: противники стремятся к передатчику. Перехватывайте заряженные залпы; атака состоит из трёх конечных волн.':
   missionForPreparation.id===CARRIER_INTERCEPTION.id?
   (missionForPreparation.phase==='return'?'Операция «Перехват снабжения»: вернитесь на авианосец с телеметрией.':
    'Операция «Перехват снабжения»: заход с кормы повреждает двигатели; перед разрядом выйдите за 230 м. Осколочное оружие помогает убрать охранение, рельс позволяет держать дистанцию.'):
   missionForPreparation.phase==='return'?'Операция «Глухой коридор»: помехи сняты, но награда ждёт передачи телеметрии в домашнем доке.':
   'Операция «Глухой коридор»: у глушителя есть охранение и ЭМ-импульсы. После уничтожения вернитесь с телеметрией в док за наградой.') :
  'Выберите дальнейший маршрут и подготовьте корабль к ожидаемой угрозе.';
 const readiness='<section class="base-sortie-context"><div><span class="base-kicker">ГОТОВНОСТЬ К ВЫЛЕТУ</span>'+
  '<strong>Корпус '+Math.ceil(state.hp)+' / '+state.maxHp+' · Дроны '+state.allies+'/'+o.cap+
  ' · Щит '+Math.ceil(state.shield||0)+'</strong></div>'+
  '<p>'+missionContext+(hullPercent<45?' Корпус сильно повреждён: перед опасным вылетом можно отремонтироваться.':'')+'</p>'+
  '<small>'+((state.droneRoles||[]).includes(o.drone.role)?
   o.drone.name+' уже в строю.':
   'Дрон: '+o.hireCost+' сплава · '+(o.ore>=o.hireCost?
    'после покупки останется '+(o.ore-o.hireCost)+' сплава.':
    'не хватает '+(o.hireCost-o.ore)+' сплава.'))+
  ' Следующая станция и постоянные улучшения тоже потребуют ресурсов.</small>'+
  '<div>'+action('baseTab','Вернуться к операциям','','operations')+'</div></section>';
 const loan=state.fieldLoan,spec=loan&&fieldWeapon(loan),offer=fieldLoanOffer(base,state);
 const fieldHelp=id=>id==='ion'?
  'Плазма ставит метки. '+fieldKey+' даёт мгновенный цепной разряд по отмеченной группе. Нужен плазменный луч.':
  fieldKey+' связывает 2–3 близкие цели на 4 с. Затем стреляйте: 35% урона передаётся по связи. Камни и расстояние свыше 260 м разрывают передачу.';
 const refill=refillQuote(loan,o.ore);
 const fieldPanel=loan?card('base-service base-local','ПОЛЕВОЙ МОДУЛЬ',
  spec.name+' · '+loan.charges+'/'+spec.capacity+' заряда',
  fieldHelp(spec.id)+' Нажмите на обычный узел корабля и выберите этот модуль. '+
  (loan.assignment?'Прокат закреплён за '+(loan.assignment.kind==='operation'?'особой операцией':'полевым заказом')+'; после её завершения или отмены модуль вернётся при стыковке.':
   'Прокат будет закреплён за следующим принятым заданием. Можно вернуть досрочно.'),
  action('fieldCharge','Купить заряд · '+spec.chargeCost+' сплава',refill.ok?'':refill.reason)+
  action('returnField','Вернуть модуль')):
  offer?'<div class="base-grid">'+Object.values(FIELD_WEAPONS).map(w=>{
   const q=fieldLoanOffer(base,state,w.id);
   return card('base-service base-local','ПОЛЕВОЙ МОДУЛЬ · '+(q.mode==='trial'?'ОДНА БЕСПЛАТНАЯ ПРОБА':'ПРОКАТ'),
    w.name,fieldHelp(w.id)+' Три заряда. Установите в обычный узел и примените сборку. Одновременно доступен один полевой модуль.',
    action('loanField',q.mode==='trial'?'Выбрать бесплатно':'Взять · '+q.cost+' сплава',q.reason,w.id),q.reason);
  }).join('')+'</div>':base.type==='dock'&&state.fieldTrialTaken?card('base-service',
   'ПОЛЕВОЕ ОРУЖИЕ','Бесплатная проба использована',
   (state.fieldReturnNotice?'Модуль вернулся после задания. ':'')+
    'Повторный прокат доступен в арсенале. Обычное оружие продолжает работать.',
   '<span class="base-ready">ПЕРВАЯ ПРОБА ЗАВЕРШЕНА</span>'):'';
 const hangar=renderShipHangar({...state,baseActive:active,station:base})+'<details class="hg-services" data-hangar-section="services"><summary>Подготовка к вылету · ремонт · дроны · прокат оружия</summary><div class="base-operations">'+readiness+
  '<div class="base-grid">'+repair+hire+'</div>'+local+fieldPanel+supply+'</div></details>';
 const protection=defenseStatus(base,o.connected&&state.connectedBases>=2,state.time||0);
 const protectionText='ПВО '+protection.charges+'/'+protection.capacity+' · радиус '+protection.radius+' м'+
  (protection.rechargeIn?' · заряд через '+protection.rechargeIn+' с':'')+
  (protection.stasis?' · стазис по группе: '+(protection.stasisIn?
   'через '+protection.stasisIn+' с':'готов'):' · стазис доступен при связи двух узлов')+
  ' · орбитальные удары: '+(protection.meteorEnabled?'перехват':'пропуск');
 const meteorChoice=action('toggleMeteorDefense',protection.meteorEnabled?
  'Пропускать орбитальные удары':'Перехватывать орбитальные удары');
 const instantUpgrades=(!o.reasons.upgrade?upgrade:'')+
  (!base.relayBoost&&!o.reasons.antenna?antenna:'');
 const futureUpgrades=(o.reasons.upgrade?upgrade:'')+
  (base.relayBoost||o.reasons.antenna?antenna:'');
 const network='<div class="base-operations">'+threats+capturedWing+'<section class="base-network-simple">'+
  '<span class="base-kicker">ОБОРОНА СТАНЦИИ</span><h3>Защитные заряды · '+protection.charges+'/'+protection.capacity+'</h3>'+
  '<p class="base-defense-summary">ПВО действует автоматически: станция тратит заряды на опасные снаряды поблизости. Орбитальные удары сейчас '+
  (protection.meteorEnabled?'перехватываются':'пропускаются')+'. '+
  (protection.stasis?'Стазис тоже автоматический: сработает при группе врагов рядом со станцией. Кнопки запуска нет.':
   'Стазис откроется после соединения двух станций.')+'</p>'+
  '<details class="base-secondary-info base-defense-choice-details"><summary>Изменить перехват орбитальных ударов</summary>'+
  '<p class="base-defense-tradeoff" role="note">'+(protection.meteorEnabled?
   'Если пропускать орбитальные удары, они смогут поражать врагов и астероиды, но также могут повредить Ваш корабль.':
   'Перехват отключён: орбитальные удары могут поражать врагов, астероиды и Ваш корабль.')+'</p>'+
  '<div class="base-defense-choice">'+meteorChoice+'</div></details>'+
  '<details class="base-secondary-info base-defense-rules"><summary>Точные условия ПВО и стазиса</summary><div class="base-secondary-body">'+
  '<p class="base-defense-status">'+protectionText+'.</p>'+
  '<p>ПВО отражает одну угрозу за заряд. Между перехватами проходит не меньше 0,7 с; снаряды остаются под защитой и при пропуске орбитальных ударов.</p>'+
  '<p>Стазис действует только в сети с домашним доком. Два обычных врага должны одновременно находиться не дальше 235 м от станции и 185 м от вас. Импульс останавливает до трёх на 2,6 с, затем восстанавливается 26 с. На боссов и цели операций не действует.</p>'+
  '<p>Пропуск орбитальных ударов позволяет использовать их против врагов и астероидов, но опасен и для вас.</p></div></details></section>'+
  (instantUpgrades?'<h3 class="base-section-title">Доступно сейчас</h3><div class="base-grid">'+instantUpgrades+'</div>':'')+
  (futureUpgrades?'<details class="base-secondary-info base-network-future"><summary>Следующие улучшения · стоимость и условия</summary><div class="base-grid">'+futureUpgrades+'</div></details>':'')+
  '<details class="base-secondary-info base-network-advanced"><summary>Карта связи между станциями</summary>'+networkPreview(base,state)+'</details>'+
  (modules?'<details class="base-secondary-info base-network-advanced"><summary>'+
   (base.module?'Оснащение станции · установлено':'Оснащение станции · необратимый выбор')+
   '</summary>'+modules+'</details>':'')+
  (transit?'<details class="base-secondary-info base-network-advanced" data-hangar-section="transit"><summary>Перелёты между станциями</summary>'+transit+'</details>':'')+
  (state.doctrine?'<details class="base-secondary-info base-network-advanced">'+
   '<summary>Сменить доктрину пилота</summary><section class="base-doctrine-service">'+
   '<p>Возврат очка доктрины стоит 12 сплава.</p>'+
   action('respec','Сменить доктрину · 12 сплава',o.ore<12?'Нужно 12 сплава':'')+'</section></details>':'')+'</div>';
 const opening=active?
  '<nav class="base-tabs" role="tablist" aria-label="Разделы станции">'+
  tabButton('summary','Главная',selected)+tabButton('operations','Задания',selected,o.contract.status==='ready'?'Награда':state.firstHardwareReward==='pending'?'Оружие':'')+
  tabButton('hangar','Корабль',selected)+tabButton('network','Станция',selected,threats?'Угроза':'')+'</nav>'+
  tabPanel('summary',selected,dashboard+(report?'<details class="base-secondary-info base-report-details">'+
    '<summary>Итоги последнего вылета</summary>'+report+'</details>':''))+
  tabPanel('operations',selected,operations)+
  tabPanel('hangar',selected,hangar)+
  tabPanel('network',selected,network):
  '<div class="base-intro">'+activation+
  '<div class="base-intro-preview"><b>После подключения</b>'+
  '<span>Особые операции и полевые заказы</span>'+
  '<span>Дроны, ремонт и оснащение станции</span>'+
  '<span>Маршруты между подключёнными узлами</span>'+
  (stationPromise?'<span class="base-technology-preview">'+stationPromise+'</span>':'')+
  '</div></div>';
 return '<div class="dialog base-dialog station-'+base.type+'" role="dialog" aria-modal="true" aria-label="Станция"><header class="base-head"><div><span class="base-system-label">ВЫЖИВШИЙ / ТЕРМИНАЛ СТАНЦИИ</span><h2>'+
  (baseNames[base.type]||'Станция')+'</h2><p>Сплав <b>'+o.ore+'</b> · Данные <b>'+(state.data||0)+'</b> (опыт) · Корпус <b>'+Math.ceil(state.hp)+'/'+state.maxHp+'</b> · В сети '+
  state.connectedBases+' · Дроны '+state.allies+'/'+o.cap+(base.type==='carrier'?' · Вылеты '+state.charges:'')+'</p></div>'+
  '<span class="base-pill '+(o.connected?'online':'offline')+'">'+status+'</span></header>'+
  (active&&!o.connected&&!base.suppressed?'<p class="base-network-warning">Работает локально. Для сетевых услуг подключите промежуточные станции.</p>':'')+
  opening+'<footer class="base-foot">'+
  (!active||state.checkpointNote?'<small>'+(!active?'После подключения откроются услуги станции.':'')+
  (state.checkpointNote?'<span role="status">'+state.checkpointNote+'</span>':'')+'</small>':'')+
  (state.hangarSession?.dirty(state.loadout)?
   '<span class="base-unapplied-note" role="status">В ангаре есть неприменённая сборка</span>':'')+
  '<div class="base-footer-actions">'+
  (active?action('baseMap','Карта сектора'):'')+
  action('close',state.hangarSession?.dirty(state.loadout)?'В полёт · сборка не применена':'В полёт')+'</div></footer></div>';
}
