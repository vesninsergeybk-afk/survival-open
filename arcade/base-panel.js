import {renderShipHangar} from './hangar-panel.js?v=first-contract-reward-1-station-layout-2-station-clarity-1-campaign-1-weapon-mechanics-2-tactical-field-2-unified-controls-1-direct-fit-2-orbital-terminal-1-menu-flow-2-menu-focus-1-station-terminal-art-1-menu-reaudit-1-menu-rebuild-1-development-tree-1-devux-3-clarity-pass-1-menu-audit-1-portrait-1-menu-simplify-1-menu-consistency-2-semantic-1';
import {renderDevelopmentPanel} from './development-panel.js?v=menu-rebuild-1-development-tree-1-devux-3-clarity-pass-1-first-loops-1-menu-audit-1-progression-art-6-sketch-portrait-1-menu-consistency-6-semantic-1';
import {readableKey,DEFAULT_CONTROLS,interactionCopy} from './control-layout.js?v=unified-controls-1-first-loops-1';
import {renderTerritoryProgress} from './territory-benefits.js?v=first-loops-1';
import {renderStationRoutePreview} from './map-panel.js?v=menu-exit-1-enemy-intents-2-regions-1-network-defense-4-living-world-3-frontier-3-rpg-precision-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-mesh-log-1-backbone-2-world-feedback-1-menu-focus-1-menu-reaudit-1-menu-rebuild-1-territory-war-1-map-art-1-clarity-pass-1-first-loops-1-menu-audit-1-station-ops-2-ops-audit-2-field-ops-1-station-polish-1-audit-1-field-experience-1-mission-integrity-2-mission-choices-1';
import {RULES, baseNames} from './balance.js?v=arcade-network-20';
import {RELAY_RANGE, RELAY_EXTENSION} from './world.js?v=living-world-3-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-territory-war-1';
import {defenseStatus} from './network-defense.js?v=network-defense-4';
import {corridorOffer,CORRIDOR_OPERATION,corridorScanBonus,probeOffer,probeDataReady,PROBE_OPERATION} from './operations.js?v=weapons-cycle-2-station-ops-2-ops-audit-2';
import {FIELD_OPERATIONS,fieldOperationIds,fieldOperationOffer,fieldOperationCue,isFieldOperation} from './field-operations.js?v=field-operations-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2-mission-choices-1';
import {abandonOperationLabel} from './mission-feedback.js?v=weapons-cycle-2-campaign-1-station-ops-2-ops-audit-2-field-ops-1-audit-1-field-experience-1-mission-depth-1-mission-integrity-2-mission-choices-1';
import {RELAY_DEFENSE,relayOffer,relayDefenseCue} from './relay-defense.js?v=relay-def-1-station-ops-2-ops-audit-2-mission-choices-1';
import {CARRIER_INTERCEPTION,carrierOffer,autonomousStrikeCarrier} from './carrier-interception.js?v=carrier-intercept-2-campaign-1';
import {FIELD_WEAPONS,fieldWeapon,fieldLoanOffer,refillQuote} from './field-weapons.js?v=weapons-cycle-2-regions-1-campaign-1';
import {nextEconomyChoices} from './sortie-economy.js?v=economy-integrity-1-econ-audit-2-campaign-1';
import {FIRST_CONTRACT_MODULES} from './first-contract-reward.js?v=first-contract-reward-1-campaign-1';
import {arsenalDiscoveryPromise,labDiscoveryPromise} from './station-progression.js?v=lab-logistics-qa-1-radio-shadow-1-home-conflict-1-expedition-1-campaign-1-repair-qa-1-unified-controls-1';
import {slotOpen} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-unified-controls-1-direct-fit-2-menu-focus-1';
import {heroMenuPortrait} from './hero-menu-portrait.js';
import {renderHomeConflict} from './home-conflict.js?v=home-conflict-1-campaign-1-repair-qa-1-enemy-balance-2';
import {renderCampaignProgress} from './regional-campaign.js?v=campaign-1-repair-qa-1-territory-war-1';
import {renderStationThreats} from './strategic-command.js?v=campaign-1-repair-qa-1-world-feedback-1-territory-war-1';
import {CONTOURS,contourFields} from './territory-system.js?v=contours-1';
import {contourConnectionChoices,contourCandidateInstruction} from './contour-preview.js?v=contour-visual-1-menu-focus-1-menu-reaudit-1-automatic-contours-1';
import {menuIcon} from './menu-icons.js?v=menu-focus-1-station-terminal-art-1';
import {menuBackButton} from './menu-screens.js?v=all-menus-1-menu-audit-1';

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
  desc:'Участвуйте в уничтожении 4 кораблей противника и вернитесь за наградой.'},
 lab:{kind:'rich',goal:2,ore:22,data:19,name:'Геологические образцы',
  desc:'Найдите 2 богатых астероида с янтарной рудой и разберите их экстрактором, удерживая E.'},
 arsenal:{kind:'defend',goal:5,ore:30,data:26,name:'Оборона периметра',
  desc:'Участвуйте в уничтожении 5 врагов в радиусе 650 м от арсенала. Защищайте подходы к станции.'},
 carrier:{kind:'intercept',goal:5,ore:36,data:32,name:'Прикрытие авиагруппы',
  desc:'Участвуйте в перехвате 5 боевых кораблей: истребителей, фланкеров, таранщиков или тяжёлых. Разведчики не учитываются.'}
});
export const contractFor=type=>CONTRACTS[type]||CONTRACTS.dock;
// A station offers two tasks; only one is active at a time. Rewards renew after a cooldown.
const ALT_CONTRACTS=Object.freeze({
 dock:{kind:'rich',goal:1,ore:10,data:24,name:'Геологические сведения',desc:'Разберите один богатый астероид, удерживая E. Меньше сплава, зато больше опыта.'},
 lab:{kind:'kill',goal:4,ore:31,data:9,name:'Очистка маршрута',desc:'Участвуйте в уничтожении 4 кораблей противника. Больше сплава, но мало опыта.'},
 arsenal:{kind:'intercept',goal:3,ore:18,data:35,name:'Охота на перехватчики',desc:'Участвуйте в уничтожении 3 боевых кораблей, кроме разведчиков. Меньше сплава, больше опыта.'},
 carrier:{kind:'defend',goal:5,ore:28,data:45,name:'Оборона авианосца',desc:'Участвуйте в уничтожении 5 врагов в радиусе 650 м от авианосца. Меньше сплава, больше опыта.'}
});
export const contractChoices=(type,runs=0)=>[
 {id:'standard',tag:'Основное поручение',...contractFor(type)},
 {id:'alternate',tag:'Альтернативное поручение',...(ALT_CONTRACTS[type]||ALT_CONTRACTS.dock)}
].map(choice=>runs>0?{...choice,
 ore:Math.max(8,Math.round(choice.ore*.65)),
 data:Math.max(6,Math.round(choice.data*.65))}:choice);
// A contract counts a real field event, not any action with the same name.
export function eligibleContractProgress(contract,kind,subject=null,station=null,pilotParticipated=false){
 if(!contract||contract.progress>=contract.goal)return false;
 // Enemy crossfire and unattended escorts must not complete the pilot's orders.
 // The pilot may tag a target and let a wingmate finish it.
 if(kind==='kill'&&!pilotParticipated)return false;
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
// A finished field order is paid at its issuing station without another click.
export const contractReadyAtStation=(contract,station)=>!!contract&&!!station?.active&&
 !station.enemy&&contract.baseId===station.id&&Number.isFinite(contract.goal)&&
 contract.goal>0&&Number.isFinite(contract.progress)&&contract.progress>=contract.goal;
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
const action=(name,label,reason='',role='',help='',target='')=>
 '<button type="button" data-act="'+name+'"'+(help?' data-help="'+help.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'"':'')+(role?' data-role="'+role+'"':'')+
 (target?' data-target="'+target+'"':'')+(reason?' disabled':'')+'>'+label+'</button>';
function firstContractRewardPanel(state){
 if(state.firstHardwareReward==='pending'){
  const draftDirty=!!state.hangarSession?.dirty?.(state.loadout);
  const freeSlot=state.loadout?.slots?.some((id,i)=>i<5&&slotOpen(state.loadout,i)&&id===null);
  return '<section class="base-first-reward" aria-label="Выбор первого боевого модуля">'+
  '<span class="base-kicker">ПЕРВЫЙ ЗАКАЗ · ОСОБАЯ НАГРАДА</span>'+
  '<h3>Выберите бесплатное оружие</h3>'+
  '<p>Вы заслужили один модуль. Он бесплатный и остаётся до конца прохождения. '+
  (draftDirty?'В ангаре есть незавершённая сборка: модуль поступит на склад.':
   freeSlot?'Модуль сразу займёт свободный узел.':'Если свободных узлов нет, модуль поступит на склад.')+
   '</p>'+
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
const contractPanel=(o,state,compact=false)=>{
 const c=o.contract;
 if(c.status==='other'&&state.contract){
  const origin=state.world?.stations?.get(state.contract.baseId);
  return '<section class="base-contract other"><span class="base-kicker">УЖЕ ЕСТЬ ЗАКАЗ</span>'+
   '<strong>'+state.contract.name+'</strong><small>Выполнено '+state.contract.progress+
   ' из '+state.contract.goal+'. Новый заказ можно взять после завершения или отказа от текущего.</small>'+
   '<p>Награда выдаётся там, где Вы приняли заказ'+
   (origin?' — '+(baseNames[origin.type]||'исходная станция'):'')+'.</p>'+
   action('baseMap','Посмотреть маршрут','','','','contract')+'</section>';
 }
 if(c.status==='available')return '<section class="base-contract-board">'+(compact?'<p class="base-home-contract-caption">Полевой заказ · выберите один</p>':'<div class="base-contract-copy">'+
  '<span class="base-kicker">НА ВЫБОР</span><strong>Возьмите один заказ</strong>'+
  '<small>Можно взять один. Награду получите после возвращения сюда.</small></div>')+
  '<div class="base-contract-choices">'+o.contractOptions.map(choice=>
   '<article class="base-contract-choice"><strong>'+choice.name+'</strong>'+
   '<small>'+choice.desc+'</small><em>Награда: '+choice.ore+' сплава · '+choice.data+
   ' опыта</em>'+
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
  c.ore+' сплава · '+c.data+' опыта</span></div>'+contractActions+'</section>';
};
// Tactical station briefing. The mission is a world object, not a kill counter.
const missionSummary=summary=>'<p class="base-op-summary">'+summary+'</p>';
const missionDetails=(body,facts,compact=false)=>compact?
 '<button type="button" class="menu-info" data-help-only data-help="'+body.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'" aria-label="Подробности операции">i</button>':
 '<details class="base-op-brief"><summary>Условия, опасность и последствия</summary><p>'+body+'</p>'+facts+'</details>';
const corridorPanel=(base,state,compact=false)=>{
 const op=corridorOffer(base,state.operation);
 if(!op)return '';
 const done=op.status==='complete',active=op.status==='active',returning=op.phase==='return';
 const hp=active||op.resumable?Math.ceil(op.hp/CORRIDOR_OPERATION.maxHp*100):100;
 const body=done?'Передатчик уничтожен, телеметрия доставлена. Обзор карты у дока +'+corridorScanBonus(base)+' м.':
  returning?'Передайте телеметрию при стыковке с доком (E). Если разведчик передал тревогу, на карте будет отмечена засада.':
  'Уничтожьте глушитель. ЭМ-разряд опасен в пределах 315 м. При сближении разведчик уйдёт передавать тревогу. Сбейте его до конца отсчёта, чтобы избежать засады на обратном пути.';
 const actions=done?'<span class="base-op-done">✓ Изменения действуют в секторе</span>':
  active?action('baseMap',returning?'Маршрут к доку':'Показать маршрут','','','','operation')+(compact?'':action('abandonOperation',returning?'Отложить передачу':'Отложить · сохранить повреждения')):
  action('baseMap','Посмотреть маршрут')+
   action('acceptOperation','Принять операцию',op.status==='available'&&!state.operation?'':'Сначала завершите другую операцию или включите станцию');
 const warning=!done&&!active&&op.status!=='available'?'Сначала включите станцию.':
  !done&&!active&&state.operation?'Сначала завершите или отложите текущую особую операцию.':'';
 const facts='<div class="base-op-details">'+
  '<div><span>ЗАДАЧА</span><b>Подавить помехи и доставить телеметрию</b></div>'+
  '<div><span>ОПАСНОСТЬ</span><b>ЭМ-разряд и разведчик, который вызывает засаду</b></div>'+
  '<div><span>ИЗМЕНЕНИЕ МИРА</span><b>'+(done?'Обзор карты +'+corridorScanBonus(base)+' м, патрули реже':
   'Обзор карты +'+CORRIDOR_OPERATION.scanBonus+' м, за перехват разведчика ещё +'+CORRIDOR_OPERATION.radioScanBonus+' м')+'</b></div></div>';
 return '<article class="base-featured-op mission-corridor '+(done?'resolved':active?'underway':'')+'">'+
  '<div class="base-featured-head"><span class="base-kicker">ОСОБАЯ ОПЕРАЦИЯ · ДОК</span><span>'+
  (done?'КОРИДОР ОТКРЫТ':returning?'ОСТАЛОСЬ ВЕРНУТЬСЯ':active?'ОПЕРАЦИЯ ПРИНЯТА':'РАЗВЕДКА ПОД ПОМЕХАМИ')+'</span></div>'+
  '<strong>'+CORRIDOR_OPERATION.name+'</strong>'+missionSummary(done?'Помехи сняты, разведка работает.':returning?
   'Передайте телеметрию в домашнем доке.':active?'Отключите передатчик и вернитесь с данными.':
   'Уничтожьте глушитель и вернитесь в док за наградой.')+
  (returning?'<small>Телеметрия получена. Награда и разведка откроются после возвращения в док.</small>':
   active||op.resumable?'<small>Передатчик: '+hp+'% прочности. Повреждения сохраняются при отступлении.</small>':'')+
  (warning?'<small class="base-op-warning">'+warning+'</small>':'')+
  '<div class="base-featured-foot"><span>'+(done?'Получено: +':'Награда: +')+
  CORRIDOR_OPERATION.rewardOre+' сплава · +'+CORRIDOR_OPERATION.rewardData+
  ' опыта</span><div>'+actions+'</div></div>'+missionDetails(body,facts,compact)+'</article>';
};
const probePanel=(base,state,compact=false)=>{
 const op=probeOffer(base,state.operation,state.time);
 if(!op)return '';
 const done=op.status==='complete',active=op.status==='active';
 const canDeliver=probeDataReady(base,state.operation||base.probeMission);
 const partial=op.partial||op.phase==='return';
 const pct=Math.round((op.repair||0)/PROBE_OPERATION.maxRepair*100);
 const body=done?(op.partial?'Лаборатория получила сохранённые данные.':'Зонд работает, обзор карты у лаборатории расширен.'):
  op.phase==='return'?'Сдайте сохранённые данные. Лаборатория выплатит награду за телеметрию.':
  'Сканер уточнит место зонда при сближении. Удерживайте E для ремонта и отпускайте, чтобы отбить налёт. Прогресс сохранится. С 50% можно увезти данные и завершить операцию без полного ремонта.';
 const actions=done?'<span class="base-op-done">✓ '+(op.partial?'Данные переданы':'Разведка восстановлена')+'</span>':
  (canDeliver?action('claimProbeData','Сдать данные и завершить'):'')+
  (active?action('baseMap',op.phase==='return'?'Показать лабораторию':op.located===false?'Показать район поиска':'Показать цель','','','','operation')+
   (compact?'':action('abandonOperation',op.strikerSerial?abandonOperationLabel(op):'Отложить · сохранить ремонт')):
   canDeliver&&op.phase==='return'?'':action('baseMap','Посмотреть район поиска')+
   action('acceptOperation',op.resumable?'Возобновить операцию':'Принять операцию',op.status==='available'&&!state.operation?'':'Сначала завершите другую операцию или включите лабораторию'));
 const warning=op.status==='cooldown'?'Новый сигнал через '+op.remaining+' с.':
  !done&&!active&&op.status!=='available'?'Сначала включите лабораторию.':
  !done&&!active&&state.operation?'Сначала завершите или отложите текущую особую операцию.':'';
 const facts='<div class="base-op-details">'+
  '<div><span>ЗАДАЧА</span><b>Восстановить зонд</b></div>'+
  '<div><span>ОПАСНОСТЬ</span><b>Налётчики бьют по зонду и прерывают ремонт</b></div>'+
  '<div><span>ИСХОДЫ</span><b>Данные: +9 сплава, +16 опыта. Полный ремонт: обзор карты +300 м.</b></div></div>';
 return '<article class="base-featured-op mission-probe '+(done?'resolved':active?'underway':'')+'">'+
  '<div class="base-featured-head"><span class="base-kicker">ОСОБАЯ ОПЕРАЦИЯ · ЛАБОРАТОРИЯ</span><span>'+
  (done?(op.partial?'ДАННЫЕ ПЕРЕДАНЫ':'СИГНАЛ ВОССТАНОВЛЕН'):op.phase==='return'?'ДАННЫЕ ГОТОВЫ К СДАЧЕ':active?'ОПЕРАЦИЯ ПРИНЯТА':'СИГНАЛ БЕДСТВИЯ')+'</span></div>'+
  '<strong>'+PROBE_OPERATION.name+'</strong>'+missionSummary(done?(op.partial?'Телеметрия доставлена.':'Зонд восстановлен.'):
   op.phase==='return'?'Зонд потерян. Сдайте сохранённые данные.':active&&op.located!==false?
   'Удерживайте E у зонда. Отпустите кнопку, чтобы открыть огонь.':
   'Найдите и восстановите зонд рядом с лабораторией.')+
  (active||op.resumable?'<div class="base-op-progress"><span>Восстановлено: '+pct+'%</span>'+
   '<progress value="'+pct+'" max="100" aria-label="Ход восстановления зонда"></progress></div>':'')+
  (canDeliver?'<small>Сдача данных завершит операцию. Награда: +'+PROBE_OPERATION.partialOre+' сплава и +'+PROBE_OPERATION.partialData+' опыта.</small>':'')+
  (warning?'<small class="base-op-warning">'+warning+'</small>':'')+
  '<div class="base-featured-foot"><span>'+(done?'Получено: +':'Награда: +')+
  (partial?PROBE_OPERATION.partialOre:PROBE_OPERATION.rewardOre)+' сплава · +'+(partial?PROBE_OPERATION.partialData:PROBE_OPERATION.rewardData)+
  ' опыта</span><div>'+actions+'</div></div>'+missionDetails(body,facts,compact)+'</article>';
};
const relayPanel=(base,state,compact=false)=>{
 const op=relayOffer(base,state.operation,state.time);
 if(!op)return '';
 const done=op.status==='complete',active=op.status==='active';
 const body=done?'Ретранслятор защищён. Связь восстановлена.':RELAY_DEFENSE.desc;
 const warning=op.status==='cooldown'?'Повторная попытка через '+op.remaining+' с.':
  op.status==='locked'?'Сначала включите станцию.':
  state.operation&&!active?'Завершите или отложите текущую особую операцию.':'';
 const actions=done?'<span class="base-op-done">✓ РЕТРАНСЛЯТОР ЗАЩИЩЁН</span>':
  active?action('baseMap','Показать цель','','','','operation')+
   (compact?'':action('abandonOperation',op.phase==='approach'?'Отложить оборону':abandonOperationLabel(op))):
  action('baseMap','Посмотреть расположение')+
   action('acceptOperation','Начать оборону',op.status==='available'&&!state.operation?'':'Сначала завершите текущую операцию или дождитесь доступа');
 const facts='<div class="base-op-details">'+
  '<div><span>ЗАДАЧА</span><b>Сохранить передатчик · 3 волны</b></div>'+
  '<div><span>ОПАСНОСТЬ</span><b>Прицельные залпы с разных направлений</b></div>'+
  '<div><span>БОНУС ЗА АНТЕННУ</span><b>+'+RELAY_DEFENSE.bonusOre+' сплава, +'+RELAY_DEFENSE.bonusData+' опыта, обзор карты +'+RELAY_DEFENSE.bonusScan+' м</b></div></div>';
 return '<article class="base-featured-op mission-relay '+(done?'resolved':active?'underway':'')+'">'+
  '<div class="base-featured-head"><span class="base-kicker">ОСОБАЯ ОПЕРАЦИЯ · АРСЕНАЛ</span><span>'+
  (done?'ОБОРОНА ЗАВЕРШЕНА':active?'РЕТРАНСЛЯТОР ПОД УГРОЗОЙ':'ОЖИДАЕТ ПОДМОГИ')+'</span></div>'+
  '<strong>'+RELAY_DEFENSE.name+'</strong>'+missionSummary(done?'Ретранслятор защищён.':active?
   'Защитите передатчик от трёх волн налётчиков.':
   'Защитите передатчик: три волны налётчиков.')+
  (active?'<small>Передатчик: '+Math.ceil(op.hp/op.maxHp*100)+'% · '+relayDefenseCue(op,state.time)+
   (op.antenna?' · Антенна: '+Math.ceil(op.antenna.hp/op.antenna.maxHp*100)+'%':'')+'</small>':'')+
  (op.antennaSaved?'<small>Антенна уцелела. Обзор карты возле арсенала расширен на '+RELAY_DEFENSE.bonusScan+' м.</small>':'')+
  (warning?'<small class="base-op-warning">'+warning+'</small>':'')+
  '<div class="base-featured-foot"><span>'+(done?'Получено: +':'Награда: +')+
  (RELAY_DEFENSE.rewardOre+(op.antennaSaved?RELAY_DEFENSE.bonusOre:0))+' сплава · +'+(RELAY_DEFENSE.rewardData+(op.antennaSaved?RELAY_DEFENSE.bonusData:0))+
  ' опыта</span><div>'+actions+'</div></div>'+missionDetails(body,facts,compact)+'</article>';
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
  active?action('baseMap',returning?'Маршрут к авианосцу':ongoing?'Показать конвой':'Район встречи','','','','operation')+
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
  '<strong>'+CARRIER_INTERCEPTION.name+'</strong>'+missionSummary(done?'Маршрут снабжения противника ослаблен.':returning?
   'Доставьте сведения на авианосец.':ongoing?'Перехватите транспорт до его выхода.':
   'Найдите конвой и остановите снабжение противника.')+
  (ongoing?'<small>Транспорт: '+Math.ceil(op.hp/CARRIER_INTERCEPTION.maxHp*100)+
   '% · до выхода '+Math.ceil(op.distanceRemaining)+' м.</small>':'')+
  (warning?'<small class="base-op-warning">'+warning+'</small>':'')+
  '<div class="base-featured-foot"><span>'+(done?'Получено: +':'Награда: +')+
   CARRIER_INTERCEPTION.rewardOre+' сплава · +'+CARRIER_INTERCEPTION.rewardData+
   ' опыта</span><div>'+actions+'</div></div>'+missionDetails(body,facts,compact)+'</article>';
};
const specialOffer=(base,state)=>corridorOffer(base,state.operation)||
 probeOffer(base,state.operation,state.time)||relayOffer(base,state.operation,state.time)||
 carrierOffer(base,state.operation,state.time);
const specialPanel=(base,state,compact=false)=>
 corridorOffer(base,state.operation)?corridorPanel(base,state,compact):
 probeOffer(base,state.operation)?probePanel(base,state,compact):
 relayOffer(base,state.operation,state.time)?relayPanel(base,state,compact):carrierPanel(base,state,compact);
const fieldOperationsPanel=(base,state)=>{
 const ids=fieldOperationIds(base.type);
 if(!ids.length)return '';
 return '<section class="base-task-group special field-operation-board" aria-label="Сложные вылазки">'+
  '<h3>Сложные вылазки · повторяемые</h3><p class="base-op-summary">'+
  'Альтернатива особой операции: одновременно можно выполнять только одну такую вылазку. У некоторых заданий есть частичная награда.</p>'+
  ids.map(id=>{
   const offer=fieldOperationOffer(base,state.operation,state.time||0,id,state.level||1),spec=FIELD_OPERATIONS[id];
   if(!offer)return '';
   const active=offer.status==='active',op=active?state.operation:null;
   const returning=op?.phase==='return',failed=op?.phase==='failed',readyPartial=
    ['deep-resonance','line-break','sleeping-reactor'].includes(id)&&op?.progress>=1&&
    op?.phase==='active';
   const progress=op?(id==='deep-resonance'?op.progress+'/2 образца':
    id==='reverse-hunt'?op.scans+'/2 наблюдения':
    id==='false-call'?'Проверено '+op.checks+'/3 маяков':
    id==='broken-convoy'?'Прочность транспорта: '+Math.ceil(op.hp)+'%':
    id==='two-fronts'?'Узлы: '+op.nodes.map(n=>Math.round(n.hp/n.maxHp*100)+'%').join(' / '):
    op.progress+'/2 узла'):' ';
   const wait=offer.status==='cooldown'?'Новая вылазка через '+offer.remaining+' с.':
    offer.status==='locked'?'Сначала включите станцию.':
    state.operation&&!active?'Сначала завершите текущую особую операцию.':'';
   const accept=offer.status==='available'&&!state.operation?'':(wait||'Пока недоступно');
   const actions=active?
    (failed?'':action('baseMap',returning?'Курс к станции':'Показать цель','','','','operation'))+
    (readyPartial?action('claimFieldOperation','Сдать достигнутый результат · частичная награда'):'')+
    action('abandonOperation',failed?'Закрыть сорванную вылазку · без награды':
     'Отменить · прогресс будет потерян'):
    id==='broken-convoy'?action('acceptFieldOperation','Обходной маршрут · меньше врагов',accept,id+':safe')+
     action('acceptFieldOperation','Короткий маршрут · больше врагов',accept,id+':fast'):
     action('acceptFieldOperation','Принять вылазку',accept,id);
   return '<article class="base-featured-op field-operation-card field-op--'+id+' '+(active?'underway':'')+'">'+
    '<div class="base-featured-head"><span class="base-kicker">'+
    ({lab:'ЛАБОРАТОРИЯ',arsenal:'АРСЕНАЛ',dock:'ДОК',carrier:'АВИАНОСЕЦ'}[base.type]||'СТАНЦИЯ')+'</span><span>'+(
     failed?'ВЫЛАЗКА СОРВАНА':returning?'ВОЗВРАЩАЙТЕСЬ':
      active?'ВЫЛАЗКА ПРИНЯТА':offer.status==='cooldown'?'ОЖИДАНИЕ':'НОВАЯ ЗАДАЧА')+
    '</span></div><div class="field-op-title"><span class="field-op-icon" aria-hidden="true"></span>'+
    '<h4>'+spec.name+'</h4></div>'+missionSummary(spec.desc)+
    (offer.threatTier?'<small class="base-op-warning">Угроза '+offer.threatTier+
     '/3: противники сильнее, опасные этапы сложнее.</small>':'')+
    (active?'<small>'+progress+' · '+fieldOperationCue(op,{player:state.position||{x:base.x,y:base.y},time:state.time||0})+'</small>':'')+
    (wait?'<small class="base-op-warning">'+wait+'</small>':'')+
    '<div class="base-featured-foot"><span>Награда: +'+offer.rewardOre+
    ' сплава · +'+offer.rewardData+' опыта'+
    '<small>Частичный результат: +'+offer.rewardPartialOre+' сплава · +'+offer.rewardPartialData+
    ' опыта</small></span><div>'+actions+'</div></div></article>';
  }).join('')+'</section>';
};
const baseBrief=(base,state,o)=>{
 const op=corridorOffer(base,state.operation);
 if(op){
  if(op.status==='complete')return ['ПОМЕХИ УСТРАНЕНЫ','Коридор открыт',
   'Дальность местной разведки выросла, патрули возле дома стали реже. Станция больше не заглушена.'];
  if(op.phase==='return')return ['ПОМЕХИ СНЯТЫ','Вернитесь с телеметрией',
   'Передатчик отключён. Доставьте данные в док.'+(op.radio==='sent'?' На карте отмечена засада.':'')];
  if(op.status==='active')return ['ОПЕРАЦИЯ ВЫПОЛНЯЕТСЯ','Найдите передатчик',
   'Сбейте разведчика до передачи тревоги или обойдите засаду на пути назад. Вблизи глушителя следите за ЭМ-разрядом.'];
  return ['РАЗВЕДКА ПОД ПОМЕХАМИ','Глушитель на востоке',
   'Сеть станций работает, но передатчик мешает местной разведке. Отключите его и вернитесь с телеметрией в док, чтобы сделать маршрут спокойнее.'];
 }
 const probe=probeOffer(base,state.operation,state.time);
 if(probe){
  if(probe.partial)return ['ТЕЛЕМЕТРИЯ ПОЛУЧЕНА','Данные переданы лаборатории','Операция завершена.'];
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
   relay.antennaSaved?'Резервная антенна расширила обзор карты возле арсенала.':'Связь с передатчиком восстановлена.'];
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
function territorySummary(base,state,compact=false){
 const world=state.world,lines=world?.contours?.links||[];
 const fields=world?.contours?contourFields(world):[];
 const localLines=lines.filter(pair=>pair.includes(base.id)).length;
 const nodes=world?.nearbyStations?.(base.x,base.y,CONTOURS.maxLength,true)||[];
 const choices=world?.contours?contourConnectionChoices(world,base.id,nodes):{ready:[],next:[]};
 const next=choices.ready[0]||choices.next[0];
 const safeName=node=>node.discovered||node.active||node.strategicRole?
  (baseNames[node.type]||'Станция'):'Неизвестный узел';
 let guidance='Включите или захватите три соседние станции. Если расстояния позволяют, связи замкнутся автоматически и появится воронка.';
 if(base.suppressed)guidance='Передатчик подавлен. Отстыкуйтесь: связь восстановится в полёте. Уничтожьте носитель помех, чтобы он не подавил станцию снова. В меню игровое время остановлено.';
 else if(next){
  const destination=safeName(next.node)+' · '+Math.round(next.distance)+' м';
  guidance=next.preview.ok?
   'Соседняя работающая станция «'+destination+'» будет подключена автоматически. Если три узла замкнут область, появится воронка.':
   'Следующий кандидат: «'+destination+'». '+contourCandidateInstruction(next.node);
 }else if(localLines)guidance='Станция связана с соседними узлами. Дальнейшее расширение сети происходит само при включении или захвате новых станций.';
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return '<section class="base-territory-summary" aria-label="Связь и территория"><h3>'+menuIcon('network')+'Связь и территория</h3>'+
  '<div class="base-territory-stats"><span>Линий у станции <b>'+localLines+'</b></span><span>Контуров в мире <b>'+fields.length+'</b></span></div>'+
  '<p>'+esc(guidance)+'</p>'+(compact?'':'<p class="base-network-distinction">Контурные линии появляются сами, если расстояние между станциями не больше '+CONTOURS.maxLength+' м. Радиосвязь услуг действует на меньшей дальности и обслуживает другие системы.</p>')+
  action('baseContours','Открыть контуры этой станции')+
  (compact?'':'<details class="base-secondary-info base-network-advanced" data-hangar-section="radio-details"><summary>Радиосвязь услуг · в сети дока '+(state.connectedBases||0)+' '+stationNoun(state.connectedBases||0)+'</summary>'+networkPreview(base,state)+'</details>')+'</section>';
}
export const BASE_TABS=Object.freeze(['summary','operations','hangar','development','network']);
const tabButton=(id,name,selected,notice='')=>'<button type="button" role="tab" id="base-tab-'+id+'" aria-controls="base-panel-'+id+'"'+(notice?' data-notice="'+notice+'" aria-label="'+name+' · '+notice+'"':'')+' tabindex="'+(id===selected?'0':'-1')+'" data-act="baseTab" data-role="'+id+
 '" aria-selected="'+(id===selected)+'" class="'+(id===selected?'selected':'')+'">'+name+'</button>';
const tabPanel=(id,selected,body)=>'<section class="base-tab-panel" id="base-panel-'+id+'" aria-labelledby="base-tab-'+id+'" role="tabpanel" data-tab="'+id+'"'+
 (id===selected?'':' hidden')+'>'+(id===selected?body:'')+'</section>';

// The operation is run-wide: the pilot must see it even when docked at a
// different station, whose local offer is a completely different mission.
export function activeOperationStep(op,world,time=0,controls=DEFAULT_CONTROLS){
 if(!op)return null;
 const interact=readableKey((controls||DEFAULT_CONTROLS).interact);
 const home=world?.stations?.get?.(op.baseId);
 const homeName=home?({dock:'в ремонтный док',lab:'в лабораторию',
  arsenal:'в военный арсенал',carrier:'на авианосец'}[home.type]||'на исходную станцию'):
  'на станцию, где приняли операцию';
 if(op.id===PROBE_OPERATION.id&&op.phase==='return')return {title:'«Последний сигнал» · данные спасены',
  description:'Вернитесь в лабораторию и сдайте данные в разделе операций.',button:'Показать лабораторию'};
 if(op.phase==='return')return {title:'«'+op.name+'» · возвращение',
  description:'Цель выполнена. Вернитесь '+homeName+' и пристыкуйтесь ('+interact+'), чтобы передать сведения и получить награду.',
  button:'Показать станцию сдачи'};
 if(isFieldOperation(op))return {title:'«'+op.name+'» · вылазка',
  description:op.desc,
  button:'Показать цель'};
 if(op.id===PROBE_OPERATION.id&&op.located===false)return {title:'«Последний сигнал» · поиск зонда',
  description:'Подлетите в отмеченный район. Сканер уточнит положение зонда.',button:'Показать район поиска'};
 if(op.id===PROBE_OPERATION.id)return {title:'«Последний сигнал» · ремонт зонда',
  description:'Зонд восстановлен на '+Math.round(op.repair||0)+'%. Доберитесь до маркера, удерживайте '+interact+' для ремонта; отпускайте для стрельбы.',
  button:'Показать зонд'};
 if(op.id===RELAY_DEFENSE.id)return {title:'«Оборона ретранслятора» · '+(op.wave?op.wave+'/3 волны':'начало обороны'),
  description:op.phase==='approach'?'Подлетите к ретранслятору: затем начнутся три короткие волны.':
   'Защищайте передатчик. '+relayDefenseCue(op,time)+'. Текущая прочность: '+Math.ceil(op.hp/op.maxHp*100)+'%.',
  button:'Показать ретранслятор'};
 if(op.id===CARRIER_INTERCEPTION.id)return {title:'«Перехват снабжения» · '+(op.phase==='approach'?'поиск':'перехват'),
  description:op.phase==='approach'?'Доберитесь до района встречи: конвой появится при сближении.':
   'Остановите груз до выхода из сектора. Прочность транспорта: '+Math.ceil(op.hp/op.maxHp*100)+'%.',
  button:'Показать конвой'};
 return {title:'«Глухой коридор» · подавление глушителя',
  description:'Найдите отмеченный глушитель и уничтожьте его. Осталось '+Math.ceil(op.hp/op.maxHp*100)+
   '% прочности. Затем вернитесь в домашний док с телеметрией.',button:'Показать глушитель'};
}

// Station entry should tell the pilot what to do now. Awards still go through
// their existing game handlers; this only changes where the actions appear.
function stationNextStep(base,state,o,regionalGoal=false){
 const c=state.contract;
 const local=c?.baseId===base.id;
 const ready=local&&c.progress>=c.goal;
 const origin=c&&!local?state.world?.stations?.get(c.baseId):null;
 const destination=origin?(baseNames[origin.type]||'исходную станцию'):'станцию, где Вы приняли заказ';
 const op=state.operation;
 const probe=op||base.probeMission;
 const operationStep=activeOperationStep(op,state.world,state.time,state.controls);
 let kind='standard',title='Выберите следующее задание';
 let description='Начните с небольшого заказа или особой операции. Награда и условия видны до принятия.';
 let buttons=action('baseTab','Посмотреть задания','','operations');
 if(ready){
  kind='reward';title='Заказ выполнен — заберите награду';
  description=c.name+': +'+c.ore+' сплава, +'+c.data+
   ' опыта. Награда ещё не зачислена.';
  buttons=action('claimContract','Забрать награду');
 }else if(probeDataReady(base,probe)){
  kind='reward';title='Телеметрия готова к сдаче';
  description='За данные лаборатория выплатит '+PROBE_OPERATION.partialOre+' сплава и '+PROBE_OPERATION.partialData+' опыта.'+
   (probe.phase==='return'?'':' Можно вернуться к зонду и закончить ремонт ради расширенного обзора карты.');
  buttons=action('claimProbeData','Сдать данные и завершить');
 }else if(c&&!local&&c.progress>=c.goal){
  kind='return';title='Награда ждёт на другой станции';
  description='Заказ «'+c.name+'» выполнен. Вернитесь на '+destination+
   ' и пристыкуйтесь. Здесь получить награду нельзя.';
  buttons=action('baseMap','Показать станцию на карте','','','','contract');
 }else if(state.firstHardwareReward==='pending'){
  kind='reward';title='Вы получили новое оружие';
  description='Первый заказ уже оплачен. Осталось бесплатно выбрать один из трёх боевых модулей. Сплав не тратится.';
  buttons=action('baseTab','Выбрать оружие','','operations');
 }else if(operationStep){
  kind='active';title=operationStep.title;
  const partial=op.id===PROBE_OPERATION.id&&op.phase==='return';
  description=operationStep.description+(Number.isFinite(op.rewardOre)?
   ' Награда: '+(partial?PROBE_OPERATION.partialOre:op.rewardOre)+' сплава, '+(partial?PROBE_OPERATION.partialData:op.rewardData)+' опыта.':'');
  buttons=action('baseMap',operationStep.button,'','','','operation')+action('baseTab','Условия и награда','','operations');
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
 }
 if(kind==='standard'&&regionalGoal){
  title='Выберите цель следующего вылета';
  description='В заданиях доступны заказы с наградой и планы действий против вражеских станций.';
 }
 return '<section class="base-next-step '+kind+'" aria-label="Что делать сейчас">'+
  '<div><span class="base-kicker">ЧТО СЕЙЧАС ВАЖНО</span><h3>'+title+'</h3><p>'+description+'</p></div>'+
  '<div class="base-next-actions">'+buttons+'</div></section>';
}

const stationEmblem=type=>{
 const marks={dock:'M34 33h28v30H34z M27 42h14M55 42h14M27 54h14M55 54h14M42 27v14M54 27v14M42 55v14M54 55v14',
  lab:'M40 25h16M44 25v17L31 65h34L52 42V25M38 53h20M43 60h10',
  arsenal:'M34 66V40l14-16 14 16v26M48 28v38M29 54h38M36 42h24',
  carrier:'M22 45h22l4-22 4 22h22L52 55l-4 18-4-18z M29 65h10M57 65h10'};
 return '<svg viewBox="0 0 96 96" aria-hidden="true"><path class="emblem-frame" d="M28 4h40l24 24v40L68 92H28L4 68V28Z"/>'+
  '<circle class="emblem-ring" cx="48" cy="48" r="34"/><path class="emblem-mark" d="'+(marks[type]||marks.dock)+'"/>'+
  '<path class="emblem-ticks" d="M48 4v7M48 85v7M4 48h7M85 48h7M16 16l5 5M75 75l5 5M16 80l5-5M75 21l5-5"/></svg>';
};

export function renderBasePanel(base,state){
 const fieldKey=readableKey((state.controls||DEFAULT_CONTROLS).field);
 const o=baseOffer(base,state),active=!!base.active;
 const status=base.suppressed?'СВЯЗЬ ПОДАВЛЕНА':active?(o.connected?'СЕТЬ ПОДКЛЮЧЕНА':'АВТОНОМНЫЙ УЗЕЛ'):'СТАНЦИЯ ВЫКЛЮЧЕНА';
 const activation=card('base-power'+(active?' connected':''),
  'УЗЕЛ СЕТИ',active?'Станция активна':'Включить станцию',
  active?(o.connected?'Связь с домашним доком. Услуги сети доступны.':
   'Работает локально. Активируйте промежуточные станции, чтобы соединить её с сетью.'):
   (o.relayCost?'Запуск узла требует '+o.relayCost+' сплава. После включения появятся местные услуги и доступ к сети.':'Первый док: +20 сплава и небольшой ремонт. Другие базы дают доступ к услугам и технологиям.'),
  active?'<span class="base-ready">✓ Питание включено</span>':
   action('activate',o.relayCost?'Подключить · '+o.relayCost+' сплава':'Запустить бесплатно',o.reasons.activate));
 const hire=card('base-service'+(!active?' inactive':''),
  'БОЕВОЙ ДРОН',o.drone.name+' · '+state.allies+'/'+o.cap,
  o.drone.desc+(o.drone.role==='fighter'?' Сопровождает корабль.':'')+
   (o.replacing?' Заменяет дрона другого типа с частичным зачётом стоимости.':''),
  action('hire',(o.replacing?'Заменить · ':'Нанять · ')+o.hireCost+' сплава',o.reasons.hire,o.drone.role),
  o.reasons.hire);
 const upgrade=card('base-service'+(!active?' inactive':''),
  'ТЕХНОЛОГИЯ СЕТИ',o.tech.name+' · '+o.level+' / 6',
  o.tech.desc,
  action('upgrade','Развить · '+o.upgradeCost+' сплава',o.reasons.upgrade),
  o.reasons.upgrade);
 const repair=card('base-service'+(!active?' inactive':''),
  'ТЕХОБСЛУЖИВАНИЕ','Ремонт корабля и дронов',
  o.repairAmount<=0&&!(state.droneDamage>0)?'Корпус и дроны исправны.':base.type==='dock'?
   'Бесплатно: если вокруг безопасно, отстыкуйтесь и держитесь в 165 м от дока. Через 4 с без попаданий корпус будет восстанавливаться примерно на 3 ед./с. Платный ремонт возвращает до '+Math.ceil(o.repairAmount)+' ед. сразу; при небольших повреждениях обычно выгоднее подождать.':
   'Платный ремонт восстанавливает до '+Math.ceil(o.repairAmount)+' ед. корпуса сразу. Повреждённых дронов можно починить отдельно.',
  (o.repairAmount>0?action('repair','Починить корпус · '+o.repairCost+' сплава',o.reasons.repair):'<span class="base-ready">Корпус исправен</span>')+
  (state.droneDamage>0?action('repairDrones','Починить дронов · '+o.droneRepairCost+' сплава',o.reasons.drones):''),
  o.reasons.repair&&o.reasons.drones?'':undefined);
 const local=o.localService?card('base-service base-local',
   'МЕСТНАЯ УСЛУГА',o.localService.name,
   o.localService.desc,
   action('service','Применить · '+o.localService.cost+' сплава',o.reasons.service),
   o.reasons.service):'';
 const supply=base.type==='carrier'?
  '<div class="base-support"><div><b>✧ УДАРНАЯ ЭСКАДРИЛЬЯ</b><small>Снарядите до двух вылетов. B: удар у вражеской базы или прикрытие при угрозе внутри своего контура с авианосцем. В поле можно перехватывать конвои. Перезарядка 35 с.</small></div>'+
  action('supply','Снарядить · '+o.chargeCost+' сплава',o.reasons.supply)+
  '<span>Зарядов: '+state.charges+' / 2</span></div>':'';
 const transit=o.connected&&state.connectedBases>=2&&o.transfers.length?
  '<section class="base-transit"><div class="base-transit-head"><b>МАРШРУТЫ СЕТИ</b><small>Между включёнными станциями можно перелететь за сплав. Сопровождающие дроны следуют за вами.</small></div><div class="base-transit-routes">'+
  o.transfers.map(t=>action('transfer',(baseNames[t.type]||'Станция')+' · '+t.distance+' м · '+t.cost+' сплава',shortfall(t.cost,o.ore),t.id)).join('')+
  '</div></section>':'';
 const moduleOption=m=>'<div class="base-module-option'+(base.module===m.key?' selected':'')+'"><strong>'+m.name+'</strong><small>'+m.desc+'</small>'+
  (base.module===m.key?'<span class="base-module-installed">✓ УСТАНОВЛЕНО</span>':
   base.module?'<span class="dev-station-unavailable">Другой модуль уже выбран</span>':
   action('installModule','Установить · '+m.cost+' сплава',m.reason,m.key)+
   (m.reason?'<span class="base-module-reason">'+m.reason+'</span>':''))+'</div>';
 const installedOption=base.module?o.moduleOptions.find(m=>m.key===base.module):null;
 const modules=active?'<section class="base-modules"><div class="base-modules-heading"><span class="base-kicker">СПЕЦИАЛИЗАЦИЯ СТАНЦИИ</span><strong>'+
  (base.module?'Модуль установлен':'Выберите одно оснащение')+'</strong><small>'+
  (base.module?'Выбор закреплён за этой станцией до конца прохождения.':
   'Можно установить только один модуль. После установки заменить его в этом прохождении нельзя; перед покупкой потребуется подтверждение.')+
  '</small></div><div class="base-module-options'+(base.module?' dev-station-equipped':'')+'">'+
  (base.module?installedOption?moduleOption(installedOption):'<p class="dev-station-unavailable">Установленный модуль сохранён; данные о нём недоступны.</p>':
   o.moduleOptions.map(moduleOption).join(''))+'</div>'+
  (base.module&&o.moduleOptions.length>1?'<details class="dev-station-alternatives"><summary>Другие варианты · уже недоступны</summary><div class="base-module-options">'+
   o.moduleOptions.filter(m=>m.key!==base.module).map(moduleOption).join('')+'</div></details>':'')+'</section>':'';
 const antenna=active?card('base-service base-antenna',
  'СВЯЗЬ · РЕТРАНСЛЯТОР',base.relayBoost?'Антенна усилена':'Усилить антенну',
  'Стандартная связь '+RELAY_RANGE+' м. Усиление добавляет '+RELAY_EXTENSION+' м к дальности узла. '+
  ((state.relayGain||0)>0?'Сейчас подключит ещё '+state.relayGain+' узл(а).':
   'Расширяет радиосвязь услуг. На длину линий территориального контура не влияет.'),
  base.relayBoost?'<span class="base-ready">✓ УСТАНОВЛЕНО</span>':
   action('antenna','Усилить · '+o.antennaCost+' сплава',o.reasons.antenna),o.reasons.antenna):'';
 const selected=BASE_TABS.includes(state.baseTab)?state.baseTab:'summary';
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
  claim.ore+' сплава, +'+claim.data+' опыта. '+(claim.credited?
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
  Number.isInteger(state.level)?'<p><b>Опыт пилота:</b> до уровня '+(state.level+1)+
  ' осталось '+Math.max(0,Math.ceil(state.nextXp-state.xp))+
  '. Данные и опыт учитываются отдельно: за участие в бою опыт начисляется сразу, '+
  'за поручения — при сдаче, за первое исследование богатого астероида — при добыче. '+
  'Подбор боевых данных не дублирует уже начисленный опыт. Новый уровень даёт очко развития.</p>':'';
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
  '<section class="base-trial-picker" aria-label="Бесплатный полевой модуль">'+
  '<strong>Выберите один полевой модуль</strong><p>На выбор один бесплатный модуль с тремя зарядами. При наличии свободного узла модуль установится сразу.</p>'+
  '<div class="base-trial-options">'+
  '<div class="base-trial-option"><div class="base-trial-product"><img src="./assets/station-menu/field-ion.webp" alt="" loading="lazy" width="80" height="80"><b>Ионный проводник</b><small>Цепной разряд по целям с плазменными метками · '+fieldKey+'</small></div>'+
  action('loanField','Выбрать ионный','','ion')+'</div>'+
  '<div class="base-trial-option"><div class="base-trial-product"><img src="./assets/station-menu/field-resonator.webp" alt="" loading="lazy" width="80" height="80"><b>Резонатор</b><small>Связывает несколько целей и передаёт между ними часть урона · '+fieldKey+'</small></div>'+
  action('loanField','Выбрать резонатор','','resonator')+'</div></div></section>':'';
 const regionalGoal=state.world&&state.position?renderHomeConflict({world:state.world,player:state.position,
  time:state.time,openingArc:state.openingArc},{compact:true}):'';
 const campaign=state.world&&state.position?renderCampaignProgress({world:state.world,player:state.position,
  time:state.time},{compact:true}):'';
 const capturedWing=autonomousStrikeCarrier(base)?'<section class="home-conflict"><strong>Открыта трофейная авиагруппа</strong><p>Этот сборочный узел может снаряжать бомбардировщики без связи с домашним доком. Они поддержат штурм вражеской базы в пределах 9800 м отсюда. Один вылет стоит '+o.chargeCost+' сплава; запас — до двух.</p>'+
  action('supply','Снарядить авиаудар · '+o.chargeCost+' сплава',o.reasons.supply)+'</section>':'';
 const suppression=base.suppressed?'<section class="home-conflict"><strong>Связь станции подавлена</strong><p>Связь восстановится в полёте. Уничтожьте носитель помех, чтобы он не повторил удар. Местный ремонт работает. Меню останавливает игровое время.</p></section>':'';
 const threats=state.world?renderStationThreats({world:state.world,enemies:state.enemies||[],time:state.time,player:state.position}):'';
 const ongoingOp=activeOperationStep(state.operation,state.world,state.time,state.controls);
 const ongoingOpPanel=ongoingOp?'<section class="base-next-step active" aria-label="Текущая особая операция">'+
  '<div><span class="base-kicker">ОСОБАЯ ОПЕРАЦИЯ В РАБОТЕ</span><h3>'+ongoingOp.title+'</h3><p>'+ongoingOp.description+'</p></div>'+
  '<div class="base-next-actions">'+action('baseMap',ongoingOp.button,'','','','operation')+
  action('abandonOperation',abandonOperationLabel(state.operation))+'</div></section>':'';
 const xp=Math.max(0,Math.floor(state.xp||0)),nextXp=Math.max(1,state.nextXp||1);
 const homeDevelopment='<section class="base-home-development" aria-label="Свободные очки">'+
  '<div class="base-home-heading"><h3>Свободные очки · '+(state.points||0)+'</h3></div>'+
  '<p>За одни и те же очки можно изучать навыки пилота и улучшать корабль.</p>'+
  '<div class="base-next-actions"><button type="button" data-act="openDevelopment" data-id="pilot">Открыть дерево развития</button></div></section>';
 const completedOrder=state.contract&&state.contract.progress>=state.contract.goal;
 const homeUrgent=state.firstHardwareReward==='pending'&&!completedOrder?
  firstReward:
  stationNextStep(base,state,o,!!(regionalGoal||campaign));
 // The same level-driven sprite is used by the actual hangar, so the overview
 // never advertises an imaginary ship or an outdated hull configuration.
 const heroArt=heroMenuPortrait(state.level,state.hp,state.maxHp);
 const sectorPreview='<aside class="base-overview-sector" aria-label="Известные узлы сектора">'+
  '<span class="base-kicker">ОБСТАНОВКА</span><h3>Известный сектор</h3>'+basePreview(base,state)+'</aside>';
 const receipt=state.lastContractReceipt;
 const earnedReward=receipt&&!state.contract?'<section class="base-auto-contract-receipt" role="status" aria-label="Награда за заказ получена">'+
  '<span class="base-kicker">ЗАКАЗ ЗАВЕРШЁН</span><strong>Награда зачислена</strong>'+
  '<span class="base-auto-contract-values">+'+receipt.ore+' сплава · +'+receipt.data+
  ' опыта</span></section>':'';
 const dashboard=earnedReward+'<div class="base-overview-lead">'+homeUrgent+sectorPreview+'</div>'+suppression+
  (threats?'<aside class="base-alert" role="status"><span>Противник угрожает связи станций.</span>'+
   action('baseTab','Посмотреть угрозы','','network')+'</aside>':'')+
  '<div class="base-quick-services">'+
  '<section class="base-quick-service base-quick-ship"><span class="base-kicker">КОРАБЛЬ</span><h3>Ремонт и оснащение</h3>'+
  '<button type="button" class="menu-info" data-help-only data-help="'+repairHint+(base.type==='dock'?' Бесплатный ремонт: отстыкуйтесь и оставайтесь рядом с доком без попаданий. Меню останавливает время.':'')+'" aria-label="Условия ремонта">i</button>'+
  '<div class="base-ship-condition"><img class="base-real-ship" src="'+heroArt+'" alt="Текущий облик корабля пилота" loading="lazy">'+
  '<div><p>Корпус <b>'+Math.ceil(state.hp)+' / '+state.maxHp+'</b>'+(state.hp<state.maxHp?' · есть повреждения':' · исправен')+'</p>'+
  '<progress class="base-hull-meter" value="'+Math.max(0,Math.min(state.maxHp,state.hp))+'" max="'+state.maxHp+'" aria-label="Прочность корпуса"></progress></div></div>'+
  '<div class="base-quick-buttons">'+
  '<button type="button" data-act="openShipService">Ремонт и обслуживание →</button>'+
  (base.id==='0:0'&&!state.fieldTrialTaken&&!state.fieldLoan?
   action('showFieldTrial',state.fieldTrialPickerOpen?'Скрыть полевые модули':'Полевой модуль · бесплатно'):'')+
  '</div>'+
  quickTrial+
  '</section>'+
  '<section class="base-quick-service base-quick-drones"><span class="base-kicker">ПОДДЕРЖКА</span><h3>Боевые дроны</h3>'+
  '<div class="base-drone-status"><img src="./assets/progression/weapons/allied_drone.webp" alt="" loading="lazy" width="88" height="88">'+
  '<p>В строю <b>'+state.allies+' / '+o.cap+'</b>'+(state.droneDamage>0?' · есть повреждения':'')+'</p></div>'+
  '<button type="button" class="menu-info" data-help-only data-help="'+o.drone.desc+'" aria-label="О боевом дроне">i</button>'+
  '<div class="base-quick-buttons"><button type="button" data-act="openShipService">Обслуживание дронов →</button></div>'+
  '</section></div>'+(capturedWing||supply)+'<div class="base-home-strategy">'+renderTerritoryProgress(state.world,state.position)+(state.points?homeDevelopment:'')+'</div>'+
  '<details class="base-secondary-info"><summary>Станция · '+brief[0]+' · карта и подробности</summary>'+
  '<div class="base-secondary-body"><p><b>'+brief[1]+'.</b> '+brief[2]+'</p>'+
  '<p>Архив данных · '+(state.data||0)+' · статистика вылета</p></div></details>'+
  (firstRewardPromise?'<div class="base-quiet-promise">'+
   'Первый сданный заказ даст бесплатное оружие на выбор.</div>':'')+
  (stationPromise?'<div class="base-quiet-promise">'+stationPromise+'</div>':'');
 const localOperation=state.operation?.baseId===base.id;
 const hasAcceptedWork=!!state.operation||!!state.contract;
 const operations='<div class="base-operations"><div class="base-view-intro"><div><span class="base-kicker">ВАШИ ЗАДАНИЯ</span><strong>'+
  (hasAcceptedWork?'Текущие задания':'Доступные задания')+'</strong>'+
  '<p>Полевой заказ можно выполнять вместе с особой операцией или сложной вылазкой. Операцию и сложную вылазку одновременно взять нельзя.</p></div></div>'+
  (state.operation&&!localOperation?'<div class="base-active-mission">'+ongoingOpPanel+'</div>':'')+
  firstReward+
  '<div class="base-task-board">'+
  (o.contract.status==='ready'?'<section class="base-task-group reward"><h3>Готовая награда</h3>'+contractPanel(o,state)+'</section>':'')+
  (o.contract.status==='ready'?'':'<section class="base-task-group regular" aria-label="Полевые заказы"><h3>Полевые заказы</h3>'+contractPanel(o,state)+'</section>')+
  (specialOffer(base,state)?'<section class="base-task-group special" aria-label="Особая операция"><h3>Особая операция</h3>'+
   specialPanel(base,state)+'</section>':'')+
  fieldOperationsPanel(base,state)+
  '</div>'+
  (regionalGoal||campaign?'<details class="base-secondary-info base-region-plans" data-hangar-section="region-plans">'+
   '<summary>Цели в регионах · ослабить противника и открыть станции</summary>'+regionalGoal+campaign+'</details>':'')+'</div>';
 const hullPercent=Math.round(state.hp/state.maxHp*100);
 const currentMission=state.operation;
 const missionPreparation=currentMission?(isFieldOperation(currentMission)?
  'Операция «'+currentMission.name+'»: '+currentMission.desc:
  currentMission.id===PROBE_OPERATION.id?
   'Операция «Последний сигнал»: при ремонте зонда корабль не стреляет. Дрон может его прикрыть.':
  currentMission.id===RELAY_DEFENSE.id?
   'Операция «Оборона ретранслятора»: противники атакуют передатчик тремя волнами.':
  currentMission.id===CARRIER_INTERCEPTION.id?
   'Операция «Перехват снабжения»: заходите к транспорту с кормы; остерегайтесь охранения.':
  currentMission.phase==='return'?
   'Операция «Глухой коридор»: вернитесь в домашний док с телеметрией.':
   'Операция «Глухой коридор»: у глушителя есть охранение и ЭМ-импульсы.'):
  'Проверьте корпус, дронов и оснащение. Условия доступных заданий можно посмотреть в разделе «Задания».';
 const readiness='<section class="base-sortie-context"><div><span class="base-kicker">ГОТОВНОСТЬ К ВЫЛЕТУ</span>'+
  '<strong>Корпус '+Math.ceil(state.hp)+' / '+state.maxHp+' · Дроны '+state.allies+'/'+o.cap+
  ' · Щит '+Math.ceil(state.shield||0)+'</strong></div>'+
  '<p>'+missionPreparation+
  (hullPercent<45?' Корпус сильно повреждён. Перед опасным вылетом рекомендуется ремонт.':'')+'</p>'+
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
 const fieldIllustration=id=>'<span class="base-field-illustration"><img src="./assets/station-menu/field-'+id+'.webp" alt="" width="64" height="64" loading="lazy"></span>';
 const fieldPanel=loan?card('base-service base-local base-field-service','ПОЛЕВОЙ МОДУЛЬ',
  spec.name+' · '+loan.charges+'/'+spec.capacity+' заряда',
  fieldIllustration(spec.id)+fieldHelp(spec.id)+' Нажмите на обычный узел корабля и выберите этот модуль. '+
  (loan.assignment?'Прокат закреплён за '+(loan.assignment.kind==='operation'?'особой операцией':'полевым заказом')+'; после её завершения или отмены модуль вернётся при стыковке.':
   'Прокат будет закреплён за следующим принятым заданием. Можно вернуть досрочно.'),
  action('fieldCharge','Купить заряд · '+spec.chargeCost+' сплава',refill.ok?'':refill.reason)+
  action('returnField','Вернуть модуль')):
  offer?.mode==='trial'?card('base-service base-local base-field-service','БЕСПЛАТНАЯ ПРОБА',
   'Выбор первого полевого модуля',
   fieldIllustration('ion')+'Ионный проводник или резонатор: один модуль на три заряда. Выбор находится в «Обзоре», рядом с состоянием корабля.',
   action('showFieldTrial','Выбрать модуль в Обзоре')):
  offer?'<div class="base-grid">'+Object.values(FIELD_WEAPONS).map(w=>{
   const q=fieldLoanOffer(base,state,w.id);
   return card('base-service base-local base-field-service','ПОЛЕВОЙ МОДУЛЬ · ПРОКАТ',
    w.name,fieldIllustration(w.id)+fieldHelp(w.id)+' Три заряда. Установите в обычный узел и примените сборку. Одновременно доступен один полевой модуль.',
    action('loanField',q.mode==='trial'?'Выбрать бесплатно':'Взять · '+q.cost+' сплава',q.reason,w.id),q.reason);
  }).join('')+'</div>':base.type==='dock'&&state.fieldTrialTaken?card('base-service',
   'ПОЛЕВОЕ ОРУЖИЕ','Бесплатная проба использована',
   (state.fieldReturnNotice?'Модуль вернулся после задания. ':'')+
    'Повторный прокат доступен в арсенале. Обычное оружие продолжает работать.',
   '<span class="base-ready">ПЕРВАЯ ПРОБА ЗАВЕРШЕНА</span>'):'';
 const hangar=renderShipHangar({...state,baseActive:active,station:base})+
  ((state.hangarView||'weapons')==='services'?'<section class="hg-services hg-services-direct" data-hangar-section="services" aria-label="Обслуживание корабля"><div class="base-operations">'+readiness+
  '<div class="base-grid">'+repair+hire+'</div>'+local+fieldPanel+supply+'</div></section>':'');
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
 const defense='<section class="base-network-simple">'+
  '<span class="base-kicker">ОБОРОНА СТАНЦИИ</span><h3>Защитные заряды · '+protection.charges+'/'+protection.capacity+'</h3>'+
  '<p class="base-defense-summary">ПВО действует автоматически: станция тратит заряды на опасные снаряды поблизости. Орбитальные удары сейчас '+
  (protection.meteorEnabled?'перехватываются':'пропускаются')+'. '+
  (protection.stasis?'Стазис тоже автоматический: сработает при группе врагов рядом со станцией. Кнопки запуска нет.':
   'Стазис откроется, когда в радиосети дока будут две станции.')+'</p>'+
  '<details class="base-secondary-info base-defense-choice-details"><summary>Изменить перехват орбитальных ударов</summary>'+
  '<p class="base-defense-tradeoff" role="note">'+(protection.meteorEnabled?
   'Если пропускать орбитальные удары, они смогут поражать врагов и астероиды, но также могут повредить Ваш корабль.':
   'Перехват отключён: орбитальные удары могут поражать врагов, астероиды и Ваш корабль.')+'</p>'+
  '<div class="base-defense-choice">'+meteorChoice+'</div></details>'+
  '<details class="base-secondary-info base-defense-rules"><summary>Точные условия ПВО и стазиса</summary><div class="base-secondary-body">'+
  '<p class="base-defense-status">'+protectionText+'.</p>'+
  '<p>ПВО отражает одну угрозу за заряд. Между перехватами проходит не меньше 0,7 с; снаряды остаются под защитой и при пропуске орбитальных ударов.</p>'+
  '<p>Стазис действует только в сети с домашним доком. Два обычных врага должны одновременно находиться не дальше 235 м от станции и 185 м от вас. Импульс останавливает до трёх на 2,6 с, затем восстанавливается 26 с. На боссов и цели операций не действует.</p>'+
  '<p>Пропуск орбитальных ударов позволяет использовать их против врагов и астероидов, но опасен и для вас.</p></div></details></section>';
 const stationDevelopment='<section class="base-station-development" aria-label="Развитие станции"><h3>'+menuIcon('upgrades')+'Технология всего флота</h3>'+
  '<p class="dev-station-currency">На каждой станции можно один раз улучшить общую технологию флота. Результат действует во всём мире. Нужен сплав; очки пилота не расходуются.</p>'+
  '<div class="dev-station-level" aria-label="Развитие технологии сети"><strong>'+o.tech.name+'</strong><span>Общий уровень '+o.level+' из 6 · '+(base.usedUpgrade?'вклад этой станции уже использован':'эта станция ещё может улучшить технологию')+'</span>'+
  '<progress value="'+o.level+'" max="6" aria-label="Изучено уровней технологии"></progress></div>'+
  (instantUpgrades?'<h4>Доступно сейчас</h4><div class="base-grid">'+instantUpgrades+'</div>':'')+
  (futureUpgrades?'<details class="base-secondary-info base-network-future"><summary>Следующие улучшения · стоимость и условия</summary><div class="base-grid">'+futureUpgrades+'</div></details>':'')+'</section>'+
  (modules?'<section class="base-network-direct" aria-label="Оснащение станции"><h3>'+
   menuIcon('upgrades')+(base.module?'Местный модуль · установлен':'Местный модуль · выбор для этой станции')+
   '</h3>'+modules+'</section>':'');
 const development=renderDevelopmentPanel({...state,baseActive:active,station:base})+
  (state.doctrine?'<section class="base-doctrine-service"><h3>Смена доктрины</h3><p>Вернёт 1 очко развития. Новый стиль можно выбрать здесь же.</p>'+
   action('respec','Сменить доктрину · 12 сплава',o.ore<12?'Нужно 12 сплава':'')+'</section>':'');
 const network='<div class="base-operations">'+threats+territorySummary(base,state)+
  stationDevelopment+defense+capturedWing+
  '<section class="base-network-direct" data-hangar-section="transit"><h3>'+menuIcon('navigation')+'Перелёты между станциями</h3>'+
  (transit||'<p>Для перелёта нужна связь этой станции с домашним доком и ещё хотя бы одна доступная станция назначения.</p>')+'</section></div>';
 const opening=active?
  '<nav class="base-tabs" role="tablist" aria-label="Разделы станции">'+
  tabButton('summary','Обзор',selected)+tabButton('operations','Задания',selected,o.contract.status==='ready'?'Награда':state.firstHardwareReward==='pending'?'Оружие':'')+
  tabButton('hangar','Корабль',selected)+tabButton('development','Развитие',selected)+tabButton('network','Станция',selected,threats?'Угроза':'')+'</nav>'+
  tabPanel('summary',selected,dashboard+(report?'<details class="base-secondary-info base-report-details">'+
    '<summary>Итоги последнего вылета</summary>'+report+'</details>':''))+
  tabPanel('operations',selected,operations)+
  tabPanel('hangar',selected,hangar)+
  tabPanel('development',selected,development)+
  tabPanel('network',selected,network):
  '<div class="base-intro">'+activation+
  '<div class="base-intro-preview"><b>После подключения</b>'+
  '<span>Особые операции и полевые заказы</span>'+
  '<span>Дроны, ремонт и оснащение станции</span>'+
  '<span>Маршруты между подключёнными узлами</span>'+
  (stationPromise?'<span class="base-technology-preview">'+stationPromise+'</span>':'')+
  '</div></div>';
 return interactionCopy('<div class="dialog base-dialog station-'+base.type+'" role="dialog" aria-modal="true" aria-label="Станция"><header class="base-head">'+
  '<div class="base-identity"><span class="base-emblem" aria-hidden="true">'+stationEmblem(base.type)+'</span><div>'+
  '<span class="base-system-label">ВЫЖИВШИЙ / ТЕРМИНАЛ СТАНЦИИ</span><h2>'+(baseNames[base.type]||'Станция')+'</h2>'+
  '<p class="base-credits"><span>Сплав <b>'+o.ore+'</b></span><span class="base-pilot-xp">Опыт <b>'+xp+' / '+nextXp+'</b> · ур. '+(state.level||1)+' · очки <b>'+ (state.points||0)+'</b></span>'+
  '<span>Корпус <b>'+Math.ceil(state.hp)+'/'+state.maxHp+'</b></span>'+
  '<span class="base-aux-stat">В сети <b>'+state.connectedBases+'</b></span>'+
  '<span class="base-aux-stat">Дроны <b>'+state.allies+'/'+o.cap+'</b></span>'+
  (base.type==='carrier'?'<span>Вылеты <b>'+state.charges+'</b></span>':'')+'</p></div></div>'+
  '<span class="base-pill '+(o.connected?'online':'offline')+'">'+status+'</span></header>'+
  (active&&!o.connected&&!base.suppressed?'<p class="base-network-warning">Работает локально. Для сетевых услуг подключите промежуточные станции.</p>':'')+
  opening+'<footer class="base-foot">'+
  (!active||state.checkpointNote?'<small>'+(!active?'После подключения откроются услуги станции.':'')+
  (state.checkpointNote?'<span role="status">'+state.checkpointNote+'</span>':'')+'</small>':'')+
  (state.hangarSession?.dirty(state.loadout)?
   '<span class="base-unapplied-note" role="status">В ангаре есть неприменённая сборка</span>':'')+
  '<div class="base-footer-actions">'+
  menuBackButton(state.menuBackLabel)+
  action('toggleAudio',state.soundOn?'🔊 Звук включён':'♫ Включить звук')+
  (active?action('baseMap','Карта сектора'):'')+
  action('close',state.hangarSession?.dirty(state.loadout)?'В полёт · сборка не применена':'В полёт')+'</div></footer></div>',state.controls);
}
