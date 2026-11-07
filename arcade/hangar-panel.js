import {borrowAndFit} from './direct-fitting.js?v=direct-fit-1';
import {fieldLoanOffer} from './field-weapons.js?v=living-world-2-weapon-feel-1-expedition-1-campaign-1';
import {WEAPON_SPECIALIZATIONS,specializationState,quoteSpecialization} from './weapon-specializations.js?v=weapons-cycle-2-weapon-mechanics-2';
import {loadoutAnalysis} from './loadout-analysis.js?v=weapons-cycle-2-campaign-1';
import {TACTICAL_DEVICES,TACTICAL_BRANCHES,createTactical,tacticalSpec,tacticalQuote} from './tactical-fields.js?v=tactical-field-2';
import {DEFAULT_CONTROLS,readableKey} from './control-layout.js?v=unified-controls-1-first-loops-1';
import {menuIcon} from './menu-icons.js?v=menu-focus-1-station-terminal-art-1';
import {MODULES,FRAME_STEPS,BLUEPRINT_NAMES,SHIP_ART,HangarSession,createLoadout,
 frameSpec,slotOpen,equipModule,moduleStats,moduleLock,moduleStock,quoteLoadout,quoteBlueprint,loadoutProfile,shipArtStage} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-weapon-mechanics-2-unified-controls-1-direct-fit-1-menu-flow-2-menu-focus-1';
import {heroMenuPortrait} from './hero-menu-portrait.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>typeof n==='number'?Number(n.toFixed(2)).toLocaleString('ru-RU'):n;
const button=(act,label,id='',disabled=false,cls='')=>'<button type="button" class="'+cls+'" data-act="'+act+'" data-id="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
const labelFor=i=>i===5?'H':String(i+1);
// The blueprint needs inline path geometry for its own SVG transforms.
const icon=(id,blueprint=false)=>menuIcon(id,blueprint?'hg-module-icon-inline':'hg-module-icon');
const info=(name,description)=>'<button type="button" class="menu-info" data-help-only data-help="'+esc(description)+'" aria-label="Подробнее: '+esc(name)+'">i</button>';
const weaponDescription=(item,controls)=>item.desc
 .replace('Space / «Ион»',readableKey(controls.field)+' / «Ион»')
 .replace('Клавиша полевого устройства (по умолчанию пробел)',readableKey(controls.field))
 .replace('R по умолчанию',readableKey(controls.railMode))
 .replace('F по умолчанию',readableKey(controls.howitzer));
const moduleRequirement=(id,context)=>moduleLock(id,context).replace('в ангаре','в улучшениях оружия');
const rankTrack=(rank,max)=>'<span class="dev-rank-track" aria-label="Изучено '+rank+' из '+max+'">'+
 Array.from({length:max},(_,i)=>'<i'+(i<rank?' class="filled"':'')+'></i>').join('')+'</span>';
const devState=(rank,max,canBuy,eligible=false)=>rank>=max?'mastered':canBuy?'ready':eligible?'waiting':'locked';
function specializationPanel(id,context){
 const branches=WEAPON_SPECIALIZATIONS[id];if(!branches)return '';
 const current=specializationState(context.loadout,id);
 const heading=current?'Выбрана: '+branches[current.path]?.name+' · '+(current.rank===2?'мастерство':'первая ступень'):
  'Выберите один из двух путей';
 return '<section class="hg-upgrades hg-branches dev-split-tree" data-hangar-section="branches"><div class="dev-tree-caption"><h4>Специализация · два пути</h4><span>1 очко за ступень</span></div>'+
  '<p class="hg-note">Выберите один путь. После выбора второй закроется до конца прохождения. Мастерство усиливает выбранный путь.</p>'+
  '<div class="dev-branch-root">'+menuIcon(id)+'<strong>'+esc(heading)+'</strong></div>'+
  '<div class="hg-upgrade-grid dev-branch-pair">'+Object.entries(branches).map(([path,branch])=>{
   const quote=quoteSpecialization(context.loadout,id,path,context),chosen=current?.path===path;
   const rank=chosen?current.rank:0,blocked=current&&!chosen;
   const label=rank>=2?'Мастерство изучено':blocked?'Другой путь выбран':
    quote.ok?(chosen?'Изучить мастерство · 1 очко':'Выбрать путь · 1 очко'):quote.reason;
   return '<article class="dev-node" data-state="'+(blocked?'exclusive':devState(rank,2,quote.ok))+'"><div><strong>'+esc(branch.name)+'</strong><b>'+(chosen?'Выбрана':'Ветвь')+'</b></div>'+
    rankTrack(rank,2)+
    '<p>'+esc(branch.desc)+'</p>'+button('hgSpec',esc(label),id+':'+path,!quote.ok,chosen?'selected':'')+'</article>';
  }).join('')+'</div></section>';
}
function tacticalPanel(context,session){
 const state=context.tactical||createTactical(),current=TACTICAL_DEVICES[state.equipped],
  id=Object.hasOwn(TACTICAL_DEVICES,session.focusTactic)?session.focusTactic:state.equipped,
  device=TACTICAL_DEVICES[id],owned=state.owned.includes(id),equipped=state.equipped===id,
  spec=tacticalSpec({...state,equipped:id}),loan=context.fieldLoan,
  overridden=loan&&context.loadout.slots.includes(loan.moduleId||'ion');
 const fieldKey=esc(readableKey((context.controls||DEFAULT_CONTROLS).field));
 const unlockHelp='<p class="hg-tactical-unlock-help">Условия «2, 3, 4 станции» означают <b>общее количество включённых дружественных станций</b>, а не уровни одной станции. Сейчас включено: <b>'+(context.activeBases||0)+'</b>. Новое устройство покупается за сплав; развитие его ветки стоит 1 очко пилота.</p>';
 const quote=tacticalQuote(state,owned?'equip':'unlock',id,context),chosen=state.branches[id];
 const caption=equipped?'Установлено':owned?'Установить бесплатно':'Получить · '+device.cost+' сплава';
 const upgrade='<div class="hg-tactic-branches dev-split-tree"><div class="dev-tree-caption"><h4>Ветки развития</h4><span>1 очко за ступень</span></div><p class="hg-note">Один путь на устройство до конца прохождения. Сначала получите устройство, затем выберите его специализацию.</p><div class="dev-branch-root">'+menuIcon(id)+'<strong>'+esc(device.short)+'</strong></div><div class="hg-upgrade-grid dev-branch-pair">'+Object.entries(TACTICAL_BRANCHES[id]).map(([path,branch])=>{
   const q=tacticalQuote(state,'upgrade',id,{...context,path});
   const rank=chosen?.path===path?chosen.rank:0,blocked=chosen&&chosen.path!==path;
   const futureSpec=tacticalSpec({...state,equipped:id,branches:{...state.branches,[id]:{path,rank:Math.min(2,rank+1)}}});
   const deltas=rank>=2?[]:[['radius','Радиус','м'],['duration','Действует','с'],['cooldown','Перезарядка','с']]
    .filter(([key])=>Number.isFinite(spec[key])&&Number.isFinite(futureSpec[key])&&spec[key]!==futureSpec[key])
    .map(([key,label,unit])=>label+': '+fmt(spec[key])+' → '+fmt(futureSpec[key])+' '+unit);
   return '<article class="dev-node" data-state="'+(blocked?'exclusive':devState(rank,2,q.ok))+'"><div><strong>'+esc(branch.name)+'</strong><b>'+rank+'/2</b></div>'+rankTrack(rank,2)+'<p>'+esc(branch.desc)+'</p>'+
    (deltas.length&&!blocked?'<small class="dev-tactic-next">'+esc(deltas.join(' · '))+'</small>':'')+
    button('hgTacticUpgrade',rank>=2?'Мастерство изучено':blocked?'Другой путь выбран':rank?'Мастерство · 1 очко':'Выбрать · 1 очко',id+':'+path,!q.ok)+
    (!q.ok?'<small>'+esc(q.reason)+'</small>':'')+'</article>';
  }).join('')+'</div></div>';
  const tacticPick=([key,item])=>{
   const isOwned=state.owned.includes(key),isEquipped=state.equipped===key;
   return '<button type="button" class="hg-tactic-pick'+(id===key?' selected':'')+'" data-act="hgFocusTactic" data-id="'+key+'" aria-pressed="'+(id===key)+'">'+
    menuIcon(key)+'<strong>'+esc(item.short)+'</strong><small>'+(isEquipped?'✓ Используется':isOwned?'Получено':'Не получено')+'</small></button>';
  };
  const ownedPicks=Object.entries(TACTICAL_DEVICES).filter(([key])=>state.owned.includes(key));
  const absentPicks=Object.entries(TACTICAL_DEVICES).filter(([key])=>!state.owned.includes(key));
  const selector='<div class="dev-arsenal-head"><strong>Ваши устройства</strong><span>Получено: '+ownedPicks.length+'</span></div>'+
   '<div class="hg-tactic-selector dev-tactic-picks" role="group" aria-label="Полученные тактические устройства">'+ownedPicks.map(tacticPick).join('')+'</div>'+
   (absentPicks.length?'<details class="dev-other-weapons dev-other-tactics"'+(!owned?' open':'')+'><summary>Не получено · '+absentPicks.length+' <span>посмотреть условия получения</span></summary>'+
    '<div class="hg-tactic-selector dev-tactic-picks" role="group" aria-label="Ещё не полученные тактические устройства">'+absentPicks.map(tacticPick).join('')+'</div></details>':'');
  const fitting=equipped?'':button(owned?'hgTacticEquip':'hgTacticUnlock',esc(caption),id,!quote.ok,'hg-primary');
  const status=equipped?'✓ Используется в бою':owned?'Получено · сейчас установлено другое устройство':'Ещё не получено';
  const gate='<div class="dev-weapon-gate dev-tactic-gate" role="status">'+menuIcon(id)+'<div><strong>Устройство пока не получено</strong>'+
   '<p>Получите устройство, чтобы открыть его улучшения.</p>'+
   '<p class="dev-gate-requirement">Условия: '+device.bases+' станции · '+device.cost+' сплава. '+
   (quote.ok?'Можно получить сейчас.':esc(quote.reason)+'.')+'</p>'+fitting+'</div></div>';
  return '<section class="hg-tactical dev-tactical" aria-label="Развитие тактики"><p class="hg-tactical-equipped">'+
   'Сейчас установлено: <b>'+esc(current.short)+'</b> · '+fieldKey+'</p>'+
   (overridden?'<p class="hg-requirement">Сейчас '+fieldKey+' запускает полевой модуль. После его возврата клавиша снова включит '+esc(current.short.toLowerCase())+'.</p>':'')+
   '<details class="dev-weapon-description"><summary>Как открыть новые устройства</summary>'+unlockHelp+'</details><div class="dev-tactical-layout">'+
   '<section class="dev-tactical-sidebar" aria-label="Выбор устройства">'+selector+
   '<div class="dev-tactical-profile"><span class="hg-eyebrow">ВЫБРАННОЕ УСТРОЙСТВО</span><h3>'+menuIcon(id)+esc(device.name)+'</h3>'+
   '<p class="dev-tactic-status">'+status+'</p><p>'+esc(device.role)+' · перезарядка '+spec.cooldown+' с</p>'+
   '<details class="dev-weapon-description"><summary>Как работает устройство</summary><p>'+esc(device.desc)+'</p></details>'+
   (owned&&!equipped?fitting:'')+'</div></section><div class="dev-tactical-growth" aria-label="Дерево развития тактики">'+
   (owned?upgrade:gate)+'</div></div></section>';
}
function shipScene(context,session){
 const loadout=context.loadout,draft=session.draft,stage=shipArtStage(context.level),art=SHIP_ART[stage];
 const badges=[[14,31],[86,31],[50,9],[14,75],[86,75],[50,91]];
 let lines='',guns='',nodes='';
 for(let i=0;i<6;i++){
  const open=slotOpen(loadout,i),id=draft.slots[i],selected=session.slot===i;
  const [x,y]=art[i+2],[bx,by]=badges[i];
  const color=open?(id?MODULES[id].color:'#7fadb8'):'#596b81';
  lines+='<path d="M'+bx+' '+by+' L'+(bx<50?bx+12:bx>50?bx-12:bx)+' '+by+' L'+(x*100)+' '+(y*100)+'" stroke="'+color+'" opacity="'+(selected?1:.45)+'"/>';
  guns+='<circle cx="'+x*100+'" cy="'+y*100+'" r="'+(selected?1.5:1)+'" fill="'+color+'"/>';
  if(open&&id){
   guns+='<g transform="translate('+(x*100-2)+' '+(y*100-3)+') scale(.125)" stroke="'+color+'" stroke-width="2.2" fill="#122639">'+
    icon(id,true).replace(/<svg[^>]*>|<\/svg>/g,'')+'</g>';
  }
  nodes+='<button type="button" data-act="hgSlot" data-id="'+i+'" class="hg-node'+(selected?' selected':'')+(open?'':' locked')+
   '" style="left:'+bx+'%;top:'+by+'%;--module-color:'+color+'" aria-label="Узел '+labelFor(i)+': '+
   esc(open?(id?MODULES[id].name:'пусто'):'закрыт')+'" aria-pressed="'+selected+'"><b>'+labelFor(i)+'</b><span>'+
   (open?(id?MODULES[id].short:'Пусто'):'Закрыт')+'</span></button>';
 }
 return '<div class="hg-blueprint" style="--art-ratio:512 / '+art[1]+'">'+
  '<img class="hg-hull" src="'+heroMenuPortrait(context.level,context.hp,context.maxHp)+'" alt="Ваш корабль. Нос направлен вверх">'+
  '<svg class="hg-wiring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke-width=".22">'+lines+'</g>'+guns+'</svg>'+nodes+'</div>';
}
export function renderShipHangar(state,session=state.hangarSession){
 const standaloneDevelopment=!!state.developmentMode;
 const view=['weapons','weapon-upgrades','tactics','upgrades','services'].includes(state.hangarView)?state.hangarView:'weapons';
 const category=standaloneDevelopment?state.developmentCategory:view==='upgrades'?'ship':'weapons';
 const development=standaloneDevelopment||view==='upgrades'||view==='weapon-upgrades';
 const context={...state,controls:{...DEFAULT_CONTROLS,...state.controls},fieldLoan:state.fieldLoan||state.ionLoan,level:state.level||1,ore:state.ore||0,baseActive:state.baseActive!==false,
  loadout:state.loadout||createLoadout(),ranks:state.skillRanks||state.ranks||{}};
 session=session||new HangarSession();if(!session.draft)session.begin(context.loadout);
 const current=context.loadout,draft=session.draft,frame=frameSpec(current),slot=session.slot,
  open=slotOpen(current,slot),old=draft.slots[slot],quote=quoteLoadout(current,draft,context);
 const dirty=session.dirty(current),next=FRAME_STEPS[current.frame+1],blueprintQuote=quoteBlueprint(current,draft,context);
 const report=loadoutAnalysis(draft,context.ranks),before=loadoutAnalysis(current,context.ranks),rate=report.heatRate;
 const combatCue=state.operation?.id==='silent-corridor'?'Глухой коридор: передатчик охраняют, возможны ЭМ-импульсы. После уничтожения возвращайтесь с данными.':
  state.operation?.id==='last-signal'?'Последний сигнал: во время ремонта зонда автоогонь отключён. Подумайте о защите корабля.':
  state.operation?.id==='relay-defense'?'Оборона ретранслятора: предстоит сдержать три волны противников.':
  state.operation?.id==='carrier-interception'?'Перехват снабжения: у транспорта уязвима корма; охранение мешает сближению.':
  'Сборка определяет дистанцию боя, нагрев и число одновременно атакуемых целей.';
 const comparison='<details class="hg-comparison" data-hangar-section="comparison" aria-label="Сравнение вооружения на разных дистанциях">'+
  '<summary>Подробное сравнение сборок · 100 / 400 / 650 м</summary><table class="hg-stats"><caption>Расчётный урон в секунду по одной цели без брони, укрытий и перегрева. Ручное оружие не учитывается.</caption>'+
  '<thead><tr><th scope="col">Дистанция</th><th scope="col">Сейчас</th><th scope="col">'+(dirty?'После применения':'Эта сборка')+'</th></tr></thead><tbody>'+
  report.ranges.map((d,i)=>'<tr><th scope="row">'+d+' м</th><td>'+fmt(before.dps[i])+'</td><td>'+fmt(report.dps[i])+'</td></tr>').join('')+
  '</tbody></table><ul>'+report.notes.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul></details>';
 const assembly='<section class="hg-ship"><div class="hg-section-head"><div><span class="hg-eyebrow">СХЕМА ОСНАЩЕНИЯ</span><h3>Ваш корабль</h3></div><span class="hg-stage">Узлы: '+current.slots.filter((id,i)=>id&&slotOpen(current,i)).length+' / '+(frame.nodes+(frame.heavy?1:0))+' занято</span></div>'+
  shipScene(context,session)+'<p class="hg-scene-caption">Нажмите на узел, чтобы выбрать для него оружие. Нос корабля направлен вверх.</p>'+
  (!open?'<div class="hg-locked-node"><p>Узел '+labelFor(slot)+' ещё закрыт.</p><button type="button" data-act="openDevelopment" data-id="ship">Условия открытия узла</button></div>':'')+
  '<div class="hg-slot-strip" aria-label="Состав предварительной сборки">'+draft.slots.map((item,i)=>
   '<span class="'+(slotOpen(current,i)?item?'filled':'empty':'locked')+'"><b>'+labelFor(i)+'</b> '+
    (slotOpen(current,i)?(item?MODULES[item].short:'пусто'):'закрыт')+'</span>').join('')+'</div>'+
  '<details class="hg-thermal-plan hg-thermal-details"><summary>Охлаждение · '+(rate>14?'возможен перегрев':'в норме')+'</summary><strong>Общее охлаждение · 14 ед/с</strong><span>Автооружие: до '+fmt(rate)+' ед/с при непрерывном огне</span>'+
  '<small>'+(rate>14?'При долгой стрельбе эта сборка перегреется. На 100% огонь блокируется до остывания к 35%.':
   'Охлаждение справляется с непрерывным автоогнём этой сборки.')+' '+esc(readableKey(context.controls.cease))+' отключает автоогонь и ускоряет охлаждение до 25 ед/с.</small></details></section>';
 const available=Object.values(MODULES).filter(item=>(slot===5?item.kind==='heavy':item.kind!=='heavy')&&
  (session.filter==='all'||item.kind===session.filter));
 const canBorrow=item=>item.kind==='manual'&&!context.fieldLoan&&!!fieldLoanOffer(context.station,context,item.id);
 const accessible=available.filter(item=>!moduleRequirement(item.id,context)||canBorrow(item));
 const future=available.filter(item=>!!moduleRequirement(item.id,context)&&!canBorrow(item));
 const weaponOffer=item=>{
  const borrowing=canBorrow(item),rental=borrowing?fieldLoanOffer(context.station,context,item.id):null;
  const fit=borrowing?borrowAndFit(context.station,current,slot,item.id,context):equipModule(current,slot,item.id,context);
  // Quote the full price even if the player's current balance is too low.
  const budget={...context,ore:Number.MAX_SAFE_INTEGER};
  const priced=borrowing?borrowAndFit(context.station,current,slot,item.id,budget):equipModule(current,slot,item.id,budget);
  const cost=priced.ok?(priced.cost||0)+(priced.loanCost||0):(item.cost||rental?.cost||0),equipped=current.slots[slot]===item.id;
  const reason=dirty?'Сначала примените или отмените загруженную схему':
   moduleRequirement(item.id,context)&&!borrowing?moduleRequirement(item.id,context):fit.ok?'':fit.reason;
  const stats=moduleStats(item.id,context.ranks,specializationState(current,item.id));
  const help=item.name+'\n'+weaponDescription(item,context.controls)+'\nДальность: '+stats.range+' м · нагрев: '+item.heat+
   ' · интервал: '+fmt(stats.interval)+' с\nУрон: '+fmt(stats.damage)+' · целей: '+stats.targets+
   '\n'+(reason||equipped?'':borrowing?'Прокат до конца задания. 3 заряда. ':'')+
   (reason||(equipped?'Уже установлено.':'Для установки в узел '+labelFor(slot)+' нажмите кнопку установки. Просмотр не меняет оснащение и не тратит сплав.'));
  const price=equipped?'✓ Установлено':borrowing?(cost?'Прокат · '+cost+' сплава':'Бесплатная проба · 3 заряда'):
   cost?cost+' сплава':'Со склада · бесплатно';
  const caption=equipped?'Установлено':borrowing?(cost?'Взять напрокат · '+cost+' сплава':'Взять и установить бесплатно'):
   cost?'Купить и установить · '+cost+' сплава':'Установить бесплатно';
  return {borrowing,cost,equipped,reason,help,price,caption};
 };
 const weaponChoice=item=>{
  const offer=weaponOffer(item);
  return '<div class="hg-weapon-row" style="--module-color:'+item.color+'">'+
   '<button type="button" data-act="hgFocusWeapon" data-id="'+item.id+'" class="hg-weapon'+
   (session.focusWeapon===item.id?' selected':'')+'" aria-pressed="'+(session.focusWeapon===item.id)+'" aria-label="'+
   esc(item.name)+': характеристики и развитие"><span class="hg-weapon-glyph" aria-hidden="true">'+icon(item.id)+'</span>'+
   '<span><strong>'+item.short+'</strong><small>'+item.role+'</small><em>'+esc(offer.price)+'</em>'+
   (moduleRequirement(item.id,context)&&!offer.borrowing?'<small>'+esc(moduleRequirement(item.id,context))+'</small>':'')+'</span></button></div>';
 };
 const noFreeStock=!old&&slot!==5&&accessible.length>0&&
  accessible.every(item=>moduleStock(current,draft,context,item.id).free===0);
 const stockGuide=noFreeStock?'<p class="hg-note hg-stock-guidance">'+
  (context.firstHardwareReward==='pending'?'Бесплатное оружие уже заработано. Вернитесь в «Задания», выберите награду и затем установите её здесь.':
   context.firstHardwareReward===null?'На складе пока нет второго орудия. После первого сданного полевого заказа Вы получите новое оружие бесплатно. Или изготовьте доступный модуль за сплав.':
   'Свободного оружия на складе нет. Изготовьте доступный модуль за сплав или освободите другой узел.')+'</p>':'';
 const catalog='<aside class="hg-arsenal"><div class="hg-section-head"><div><span class="hg-eyebrow">МОДУЛЬНЫЙ АРСЕНАЛ</span><h3>Вооружение для узла '+labelFor(slot)+'</h3></div>'+button('hgShip','← К схеме','','','hg-back-ship')+'</div>'+
  (old?'<div class="hg-slot-current">В узле: '+MODULES[old].name+' · '+button('hgUnequip','Снять')+'</div>':'')+
  '<div class="hg-filters" role="group" aria-label="Фильтр оружия">'+
  [['all','Все'],['auto','Авто'],['manual','Ручное']].filter(([key])=>slot!==5||key==='all').map(([key,name])=>
   button('hgFilter',name,key,false,session.filter===key?'selected':'')).join('')+'</div>'+
  (stockGuide?'<div class="hg-stock-help"><strong>Где взять оружие?</strong>'+stockGuide+'</div>':'')+
  '<div class="hg-catalog-list">'+accessible.map(weaponChoice).join('')+
  (accessible.length?'':'<p class="hg-empty-weapons">Пока нет доступного оружия с этим фильтром.</p>')+'</div>'+
  (future.length?'<details class="hg-future-weapons"><summary>Пока недоступно · '+future.length+'</summary><div class="hg-catalog-list">'+
   future.map(weaponChoice).join('')+'</div></details>':'')+
  '<small class="hg-one-click">Выберите оружие. Цена и кнопка установки появятся в его подробностях.</small></aside>';
 const frameLock=!next?'':context.level<next.level?'Нужен уровень '+next.level:context.ore<next.cost?'Не хватает '+(next.cost-context.ore)+' ед. сплава':'';
 const progression='<section class="hg-progression"><div><span class="hg-eyebrow">ОРУЖЕЙНЫЕ УЗЛЫ КОРАБЛЯ</span><strong>'+frame.nodes+(frame.nodes===5?' обычных узлов':' обычных узла')+(frame.heavy?' + H':'')+'</strong></div>'+
  '<ol>'+FRAME_STEPS.map((step,i)=>'<li class="'+(i<=current.frame?'unlocked':'')+'"><b>'+step.nodes+(step.heavy?' + H':'')+'</b><small>ур. '+step.level+'</small></li>').join('')+'</ol>'+
  '<div class="hg-frame-action">'+(next?button('hgFrame',next.name+' · '+next.cost+' сплава','',!!frameLock||dirty)+
  '<small>'+esc(dirty?'Сначала завершите замену оружия':frameLock||'Открывает ещё один узел; оружие устанавливается отдельно')+'</small>':'<strong>Все узлы открыты</strong>')+'</div></section>';
 const upgradeCard=s=>'<article class="dev-node" data-state="'+devState(s.rank,s.max,s.canBuy,s.rank<s.max&&s.reason==='Нужно очко развития')+'"><div><strong>'+menuIcon(s.id)+esc(s.title)+'</strong><b>'+s.rank+' / '+s.max+'</b></div>'+
  rankTrack(s.rank,s.max)+'<p>'+esc(s.effect)+'</p>'+
  '<div class="hg-upgrade-action">'+button('hgUpgrade',s.rank>=s.max?'Максимум':'Изучить · 1 очко',s.id,!s.canBuy)+info(s.title,s.desc)+'</div>'+
  (!s.canBuy&&s.rank<s.max?'<small class="hg-requirement">'+esc(s.reason)+'</small>':'')+'</article>';
 const shipCore=(state.hangarUpgrades||[]).filter(s=>s.id==='hull'||s.id==='shield');
 const shipEngine=(state.hangarUpgrades||[]).filter(s=>s.id==='engine');
 const upgrades='<section class="hg-upgrades hg-all-upgrades" data-hangar-section="upgrades">'+
  '<div class="hg-section-head"><h3>Улучшения корабля</h3><b>Свободные очки: '+(state.points||0)+'</b></div>'+
  '<div class="dev-ship-tree" aria-label="Дерево улучшений корабля">'+
  '<div class="dev-tree-caption"><h3>Защита и двигатель</h3><span>Каждый ранг · 1 очко</span></div>'+
  '<p class="hg-note">Корпус → щит: чтобы открыть щит, сначала улучшите корпус. Двигатель развивается отдельно. Голубые узлы доступны для покупки.</p>'+
  '<div class="dev-ship-path"><div class="dev-ship-linked">'+shipCore.map(upgradeCard).join('')+'</div><div class="dev-ship-independent">'+shipEngine.map(upgradeCard).join('')+'</div></div>'+
  '<div class="dev-tree-caption"><h3>Оружейные узлы</h3><span>Требуют сплав и уровень пилота</span></div>'+progression+
  '</div></section>';
 const focusedId=Object.hasOwn(MODULES,session.focusWeapon)?session.focusWeapon:'plasma';
 const focused=MODULES[focusedId],focusedStats=moduleStats(focusedId,context.ranks,specializationState(current,focusedId));
 const installed=current.slots.includes(focusedId);
 const focusedOffer=weaponOffer(focused);
 const fitting='<section class="hg-fit-action" aria-label="Установка выбранного оружия">'+
  '<strong>Узел '+labelFor(slot)+' · '+(old?esc(MODULES[old].short):'свободен')+'</strong>'+
  button(focusedOffer.borrowing?'hgBorrow':'hgEquip',esc(focusedOffer.caption),focusedId,!!focusedOffer.reason||focusedOffer.equipped,'hg-primary hg-weapon-fit')+
  (focusedOffer.reason?'<p class="hg-requirement">'+esc(focusedOffer.reason)+'</p>':'')+
  '<small>'+(focusedOffer.equipped?'Этот модуль уже установлен.':focusedOffer.reason?'Просмотр не меняет оснащение и не тратит сплав.':
   focusedOffer.cost?'Сплав спишется при нажатии кнопки. Останется '+Math.max(0,context.ore-focusedOffer.cost)+' сплава.':
   'Установка произойдёт при нажатии кнопки. Сплав не тратится.')+'</small></section>';
 const affected={plasma:['beam','double','range'],rail:['beam'],flak:['beam'],rocket:['beam','rocket'],ion:['beam'],resonator:[],howitzer:[]};
 const related=(state.hangarUpgrades||[]).filter(s=>affected[focusedId].includes(s.id))
  .sort((a,b)=>Number(b.canBuy)-Number(a.canBuy)||(a.from||1)-(b.from||1));
 const weaponTree=related.length?'<section class="hg-related-upgrades dev-weapon-tree" aria-label="Общие улучшения, действующие на это оружие">'+
  '<div class="dev-tree-caption"><h4>Общие технологии</h4><span>Действуют на все подходящие орудия</span></div>'+
  '<p class="hg-note">'+(focusedId==='plasma'?'«Разделение луча» требует первого ранга «Калибровки орудий». Остальные технологии можно развивать независимо.':
   'Каждое улучшение действует на установленные орудия подходящего типа. Прогресс общий для всего корабля.')+'</p>'+
  '<div class="dev-tech-grid">'+related.filter(s=>!s.requires).map(root=>'<div class="dev-tech-chain">'+upgradeCard(root)+
   related.filter(s=>s.requires===root.id).map(child=>'<div class="dev-tech-child"><small class="dev-prerequisite">После «'+esc(root.title)+'»</small>'+upgradeCard(child)+'</div>').join('')+
   '</div>').join('')+'</div></section>':'';
 // Rockets are different from other modules: their first tech rank CREATES the
 // first launcher. Keep this purchase reachable before any launcher is fitted.
 const rocketEntry=(state.hangarUpgrades||[]).find(s=>s.id==='rocket');
 const rocketUnlock=development&&!(context.ranks.rocket>0)&&rocketEntry?
  '<section class="dev-weapon-unlock" aria-label="Открытие ракет"><div class="dev-tree-caption"><h4>Открытие нового оружия</h4><span>Сначала технология, затем установка</span></div>'+
  '<p class="hg-note">Первый ранг «Авторакет» даст ракетный модуль. После изучения установите его в ангаре; только тогда откроется его дальнейшее развитие.</p>'+upgradeCard(rocketEntry)+'</section>':'';
 const weaponPick=item=>{
   const isInstalled=current.slots.includes(item.id);
   return '<button type="button" data-act="hgFocusWeapon" data-id="'+item.id+'" aria-pressed="'+(focusedId===item.id)+'" class="hg-focus-pick'+
    (focusedId===item.id?' selected':'')+(isInstalled?' installed':' absent')+'" aria-label="'+esc(item.name)+(isInstalled?', установлено':', не установлено')+'">'+icon(item.id)+
    '<span>'+esc(item.short)+'<small>'+(isInstalled?'✓ На корабле':'Не установлено')+'</small></span></button>';
 };
 const mountedModules=Object.values(MODULES).filter(item=>current.slots.includes(item.id));
 const absentModules=Object.values(MODULES).filter(item=>!current.slots.includes(item.id));
 const weaponPicker='<div class="dev-arsenal-head"><strong>Ваше вооружение</strong><span>Видов: '+mountedModules.length+'</span></div>'+
  '<div class="hg-weapon-picks dev-weapon-picks" role="group" aria-label="Установленное оружие">'+mountedModules.map(weaponPick).join('')+'</div>'+
  (absentModules.length?'<details class="dev-other-weapons"'+(!installed?' open':'')+'><summary>Не установлено · '+absentModules.length+' <span>посмотреть и установить</span></summary>'+
   '<div class="hg-weapon-picks dev-weapon-picks dev-absent-picks" role="group" aria-label="Неустановленное оружие">'+absentModules.map(weaponPick).join('')+'</div></details>':'');
 const selectedHead='<div class="hg-section-head"><div><span class="hg-eyebrow">'+(development?'ВЫБРАННОЕ ОРУЖИЕ':'ХАРАКТЕРИСТИКИ')+'</span><h3>'+esc(focused.name)+'</h3></div>'+info(focused.name,focusedOffer.help)+'</div>';
 const selectedStats='<div class="hg-focused-stats"><span>Дальность <b>'+focusedStats.range+' м</b></span><span>Нагрев <b>'+focused.heat+'</b></span><span>Роль <b>'+esc(focused.role)+'</b></span></div>';
 const needsRocketTech=focusedId==='rocket'&&!context.ranks.rocket;
 const gate='<div class="dev-weapon-gate" role="status">'+menuIcon('hull')+
   '<div><strong>Это оружие ещё не установлено</strong><p>'+(needsRocketTech?
    'Сначала изучите технологию «Авторакеты» ниже, затем установите полученный модуль на корабль.':
    'Для этого модуля пока закрыты улучшения и специализация. Сначала установите его на корабль.')+'</p>'+
   (moduleRequirement(focusedId,context)?'<p class="dev-gate-requirement">Условие установки: '+esc(moduleRequirement(focusedId,context))+'.</p>':'')+
   (needsRocketTech?'<button type="button" class="development-shortcut" data-act="openDevelopment" data-id="weapons" data-focus="rocket" data-upgrade="rocket">К технологии «Авторакеты» →</button>':
    '<button type="button" class="development-shortcut" data-act="fitWeapon" data-id="'+focusedId+'">К установке '+esc(focused.short)+' →</button>')+'</div></div>';
 const growth=(installed?
  (weaponTree||'<p class="hg-no-branches">У этого модуля нет общих технологий развития.</p>')+
  (WEAPON_SPECIALIZATIONS[focusedId]?specializationPanel(focusedId,context):'<p class="hg-no-branches">Для этого модуля нет отдельных путей специализации.</p>'):
  gate)+rocketUnlock;
 const inspector=development?'<aside class="hg-weapon-inspector dev-weapon-inspector" aria-label="Развитие выбранного оружия">'+
  '<div class="dev-weapon-layout"><section class="dev-weapon-sidebar" aria-label="Оснащение корабля">'+
  weaponPicker+'<div class="dev-weapon-profile">'+selectedHead+
  (installed?'<p class="hg-weapon-availability">✓ Установлено на корабле</p>'+selectedStats+
   '<details class="dev-weapon-description"><summary>Как работает оружие</summary><p>'+esc(weaponDescription(focused,context.controls))+'</p></details>':'')+
  '</div></section><div class="dev-weapon-growth" aria-label="Возможности развития">'+growth+'</div></div></aside>':
  '<aside class="hg-weapon-inspector" aria-label="Выбранное оружие">'+
  (session.catalog&&open?'<div class="hg-inspector-tools">'+button('hgCatalog','← К списку оружия','','','hg-back-list')+'</div>':'')+
  selectedHead+'<p class="hg-weapon-description">'+esc(weaponDescription(focused,context.controls))+'</p>'+selectedStats+
  (session.catalog&&open?fitting:'<p class="hg-weapon-availability">'+(installed?'✓ Установлено на корабле.':
   'Не установлено. Чтобы выбрать ветку, сначала установите оружие в свободный узел.')+'</p>')+
  '<div class="hg-inspector-actions">'+(!session.catalog?button('hgCatalog','Заменить оружие'):'')+
  '<button type="button" class="development-shortcut" data-act="openDevelopment" data-id="weapons" data-focus="'+focusedId+'">'+menuIcon('upgrades')+'Улучшить оружие</button></div></aside>';
 const savedBlueprints=session.blueprints.filter(Boolean).length;
 const blueprints='<details class="hg-presets" data-hangar-section="blueprints"><summary>Схемы оснащения · сохранено '+savedBlueprints+' из 3</summary><p class="hg-note">Есть три ячейки для сохранения сборок на этом устройстве. Сплав потребуется только для изготовления при применении. При новом прохождении оружие и узлы нужно открыть заново.</p><div>'+BLUEPRINT_NAMES.map((name,i)=>
  '<article><b>'+name+'</b><small>'+(session.blueprints[i]?'Сохранена':'Пустая ячейка')+'</small>'+button('hgLoad','Загрузить',String(i),!session.blueprints[i])+button('hgSave','Записать',String(i),!blueprintQuote.ok)+'</article>').join('')+'</div></details>';
 const compareNow=report.ranges.map((range,i)=>'<span><small>'+range+' м</small><b>'+fmt(report.dps[i])+'</b></span>').join('');
 const draftCount=draft.slots.filter((item,i)=>item&&slotOpen(current,i)).length;
 const editing=!!session.catalog&&open;
 const fittingStrip='<div class="hg-fitting-strip" role="group" aria-label="Узлы корабля">'+draft.slots.map((item,i)=>
  '<button type="button" data-act="hgSlot" data-id="'+i+'" aria-pressed="'+(slot===i)+'" class="'+
  (slotOpen(current,i)?item?'filled':'empty':'locked')+'"><b>'+labelFor(i)+'</b><span>'+
  esc(slotOpen(current,i)?item?MODULES[item].short:'Свободен':'Закрыт')+'</span></button>').join('')+'</div>';
 const pendingApply=dirty?'<div class="hg-apply-bar has-changes" role="region" aria-label="Подтверждение оснащения"><div><strong>● Предварительная сборка · '+draftCount+' узл.</strong><span>'+
  (quote.cost?'Изготовление: '+quote.cost+' сплава'+(context.ore>=quote.cost?' · останется '+(context.ore-quote.cost):' · не хватает '+(quote.cost-context.ore)):
   quote.ok?'Модули в наличии · замена бесплатна':'Применение схемы недоступно. Проверьте условия ниже.')+'</span>'+
  (!quote.ok?'<small class="hg-error">'+esc(quote.reason)+'</small>':'')+'</div><div>'+
  button('hgReset','Отменить')+button('hgApply',quote.cost?'Изготовить и применить':'Применить','',!quote.ok,'hg-primary')+'</div></div>':
  '<div class="hg-current-bar" role="status">'+(editing?'Выберите оружие для узла '+labelFor(slot)+'.':
   '✓ Текущее вооружение установлено. Чтобы изменить его, нажмите на узел корабля.')+'</div>';
 if(standaloneDevelopment)return '<section class="ship-hangar development-hangar" aria-label="'+(category==='weapons'?'Развитие оружия':category==='tactics'?'Развитие тактики':'Развитие корабля')+'">'+
  (category==='weapons'?inspector:category==='tactics'?tacticalPanel(context,session):upgrades)+
  '<p class="hg-message" role="status" aria-live="polite">'+esc(session.message||'')+'</p></section>';
 const section=view==='weapon-upgrades'?'weapons':view;
 const nav='<nav class="hg-view-nav" aria-label="Что сделать с кораблём">'+
  [['weapons','Оружие','weapons'],['upgrades','Корпус и узлы','hull'],['tactics','Тактика','pulse'],['services','Обслуживание','repair']].map(([id,label,iconId])=>
   '<button type="button" data-act="hgView" data-id="'+id+'" aria-pressed="'+(section===id)+'" tabindex="'+(section===id?0:-1)+'"'+(section===id?' class="selected"':'')+'>'+menuIcon(iconId)+label+'</button>').join('')+'</nav>';
 const weaponViews=section==='weapons'?'<nav class="hg-weapon-views" aria-label="Действия с оружием">'+
  '<button type="button" data-act="hgView" data-id="weapons" aria-pressed="'+(view==='weapons')+'">Установка</button>'+
  '<button type="button" data-act="hgView" data-id="weapon-upgrades" aria-pressed="'+(view==='weapon-upgrades')+'">Улучшения</button></nav>':'';
 return '<section class="ship-hangar'+(editing&&view==='weapons'?' hg-catalog-open':'')+(development?' development-hangar':'')+'" data-ship-view="'+view+'" aria-label="Конструктор корабля">'+
  '<header class="hg-title"><div><span class="hg-eyebrow">КОРАБЛЬ</span><h2>'+({weapons:'Установка оружия','weapon-upgrades':'Улучшения оружия',tactics:'Тактические устройства',upgrades:'Корпус и узлы',services:'Обслуживание'}[view])+'</h2></div></header>'+
  nav+weaponViews+(dirty||view==='weapons'?pendingApply:'')+
  (view==='weapons'&&editing?fittingStrip:'')+
  (view==='weapons'?'<div class="hg-layout'+(editing?' hg-layout-editing':' hg-layout-centered')+'">'+
    (editing?catalog:assembly)+inspector+'</div>'+
    '<details class="hg-combat-cue hg-mission-help"><summary>Совет к вылету</summary>'+esc(combatCue)+'</details>'+
    '<details class="hg-combat-details"><summary>Урон, нагрев и сравнение сборок</summary><div class="hg-decision-brief"><div class="hg-range-brief" aria-label="Урон автоматического оружия в секунду, без брони и перегрева"><small class="hg-range-title">АВТОУРОН / С</small>'+compareNow+'</div></div>'+comparison+'</details>'+blueprints:'')+
  (view==='weapon-upgrades'?inspector:'')+
  (view==='tactics'?tacticalPanel(context,session):'')+
  (view==='upgrades'?upgrades:'')+
  (view==='services'?'<p class="hg-view-note">Здесь можно отремонтировать корабль, нанять дронов и взять полевые модули.</p>':'')+
  '<p class="hg-message" role="status" aria-live="polite">'+esc(session.message||'')+'</p></section>';
}
