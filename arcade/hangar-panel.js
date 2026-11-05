import {borrowAndFit} from './direct-fitting.js?v=direct-fit-1';
import {fieldLoanOffer} from './field-weapons.js?v=living-world-2-weapon-feel-1-expedition-1-campaign-1';
import {WEAPON_SPECIALIZATIONS,specializationState,quoteSpecialization} from './weapon-specializations.js?v=weapons-cycle-2-weapon-mechanics-2';
import {loadoutAnalysis} from './loadout-analysis.js?v=weapons-cycle-2-campaign-1';
import {TACTICAL_DEVICES,TACTICAL_BRANCHES,createTactical,tacticalSpec,tacticalQuote} from './tactical-fields.js?v=tactical-field-2';
import {DEFAULT_CONTROLS,readableKey} from './control-layout.js?v=unified-controls-1';
import {MODULES,FRAME_STEPS,BLUEPRINT_NAMES,SHIP_ART,HangarSession,createLoadout,
 frameSpec,slotOpen,equipModule,moduleStats,moduleLock,moduleStock,quoteLoadout,quoteBlueprint,loadoutProfile,shipArtStage} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-weapon-mechanics-2-unified-controls-1-direct-fit-1';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>typeof n==='number'?Number(n.toFixed(2)).toLocaleString('ru-RU'):n;
const button=(act,label,id='',disabled=false,cls='')=>'<button type="button" class="'+cls+'" data-act="'+act+'" data-id="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
const labelFor=i=>i===5?'H':String(i+1);
const icon=id=>{
 const paths={plasma:'M12 6h8v12h-8z M16 1v9 M10 21h12 M12 18v9 M20 18v9',
  rail:'M12 12h8v15h-8z M13 1v15 M19 1v15 M9 24h14',
  flak:'M10 12h12v14H10z M10 3l3 11 M16 1v13 M22 3l-3 11 M7 22h18',
  rocket:'M8 7l4-6 4 6v18H8z M18 13l4-6 4 6v14h-8z M10 29h4 M20 30h4',
  resonator:'M5 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M19 24a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M11 11l10 10 M23 8L9 24',
  ion:'M10 12l6-10 6 10-6 16z M5 17h22 M16 10v12',
  howitzer:'M10 16h12v12H10z M12 2h8v16h-8z M6 23h20 M6 28h20'};
 return '<svg class="hg-module-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="'+paths[id]+'"/></svg>';
};
function specializationPanel(id,context){
 const branches=WEAPON_SPECIALIZATIONS[id];if(!branches)return '';
 const current=specializationState(context.loadout,id);
 const heading=current?'Выбрана: '+branches[current.path]?.name+' · '+(current.rank===2?'мастерство':'первая ступень'):
  'Выберите один из двух путей';
 return '<details class="hg-upgrades hg-branches" data-hangar-section="branches"><summary>Специализация · '+esc(heading)+'</summary>'+
  '<p class="hg-note">Каждая ветка меняет поведение оружия. Выбор остаётся до конца вылета; переключиться бесплатно нельзя. Сначала нужны 2 активированные станции и уровень 7; мастерство — 3 станции и уровень 11.</p>'+
  '<div class="hg-upgrade-grid">'+Object.entries(branches).map(([path,branch])=>{
   const quote=quoteSpecialization(context.loadout,id,path,context),chosen=current?.path===path;
   const label=quote.ok?(chosen?'Усилить мастерство · 1 очко':'Выбрать · 1 очко'):quote.reason;
   return '<article><div><strong>'+esc(branch.name)+'</strong><b>'+(chosen?'Выбрана · '+current.rank+'/2':'Ветвь')+'</b></div>'+
    '<p>'+esc(branch.desc)+'</p>'+button('hgSpec',esc(label),id+':'+path,!quote.ok,chosen?'selected':'')+'</article>';
  }).join('')+'</div></details>';
}
function tacticalPanel(context){
 const state=context.tactical||createTactical(),current=TACTICAL_DEVICES[state.equipped],
  spec=tacticalSpec(state),loan=context.fieldLoan,
  overridden=loan&&context.loadout.slots.includes(loan.moduleId||'ion');
 const fieldKey=esc(readableKey((context.controls||DEFAULT_CONTROLS).field));
 const cards=Object.entries(TACTICAL_DEVICES).map(([id,device])=>{
  const owned=state.owned.includes(id),equipped=state.equipped===id;
  const act=owned?'equip':'unlock',quote=tacticalQuote(state,act,id,context);
  const caption=equipped?'Установлено':quote.ok?
   (owned?'Установить бесплатно':'Получить · '+device.cost+' сплава'):quote.reason;
  const chosen=state.branches[id];
  const upgrade=owned?'<div class="hg-tactic-branches"><small>Развитие устройства:</small>'+Object.entries(TACTICAL_BRANCHES[id]).map(([path,branch])=>{
   const q=tacticalQuote(state,'upgrade',id,{...context,path});
   const rank=chosen?.path===path?chosen.rank:0;
   return '<div><strong>'+esc(branch.name)+(rank?' · '+rank+'/2':'')+'</strong><p>'+esc(branch.desc)+'</p>'+
    button('hgTacticUpgrade',q.ok?(rank?'Усилить · 1 очко':'Выбрать · 1 очко'):esc(q.reason),
     id+':'+path,!q.ok)+'</div>';
  }).join('')+'</div>':'';
  return '<article class="hg-tactic-option'+(equipped?' selected':'')+'"><div><b>'+esc(device.name)+'</b><small>'+esc(device.role)+
   ' · '+device.cooldown+' с</small></div><button type="button" class="menu-info" data-help-only data-help="'+esc(device.desc)+'" aria-label="Описание: '+esc(device.name)+'">i</button>'+button('hgTactic'+
    (owned?'Equip':'Unlock'),esc(caption),id,!quote.ok)+(upgrade?'<details class="hg-tactic-upgrade-details"><summary>Ветки</summary>'+upgrade+'</details>':'')+'</article>';
 }).join('');
 return '<section class="hg-tactical" aria-label="Нелетальное оружие"><div class="hg-tactical-current"><div>'+
  '<span class="hg-eyebrow">ТАКТИЧЕСКИЙ СЛОТ · '+fieldKey+'</span><h3>'+esc(current.name)+' · '+spec.cooldown+' с</h3>'+
  '<button type="button" class="menu-info" data-help-only data-help="'+esc(current.desc)+'" aria-label="Описание: '+esc(current.name)+'">i</button>'+
  (overridden?'<small>Пока установлен прокатный модуль, '+fieldKey+' активирует его. После возврата снова работает тактический слот.</small>':'')+
  '</div><details class="hg-tactical-details" data-hangar-section="tactical"><summary>Заменить или улучшить</summary><div class="hg-tactical-options">'+cards+
  '</div></details></div></section>';
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
    icon(id).replace(/<svg[^>]*>|<\/svg>/g,'')+'</g>';
  }
  nodes+='<button type="button" data-act="hgSlot" data-id="'+i+'" class="hg-node'+(selected?' selected':'')+(open?'':' locked')+
   '" style="left:'+bx+'%;top:'+by+'%;--module-color:'+color+'" aria-label="Узел '+labelFor(i)+': '+
   esc(open?(id?MODULES[id].name:'пусто'):'закрыт')+'" aria-pressed="'+selected+'"><b>'+labelFor(i)+'</b><span>'+
   (open?(id?MODULES[id].short:'Пусто'):'Закрыт')+'</span></button>';
 }
 return '<div class="hg-blueprint" style="--art-ratio:512 / '+art[1]+'">'+
  '<img class="hg-hull" src="../assets/space/hero-evolution/ship_'+String(stage+1).padStart(2,'0')+'.webp" alt="Корабль, графическая стадия '+(stage+1)+' из 10. Нос направлен вверх">'+
  '<svg class="hg-wiring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke-width=".22">'+lines+'</g>'+guns+'</svg>'+nodes+'</div>';
}
export function renderShipHangar(state,session=state.hangarSession){
 const context={...state,fieldLoan:state.fieldLoan||state.ionLoan,level:state.level||1,ore:state.ore||0,baseActive:state.baseActive!==false,
  loadout:state.loadout||createLoadout(),ranks:state.skillRanks||state.ranks||{}};
 const controlKey=id=>esc(readableKey((context.controls||DEFAULT_CONTROLS)[id]));
 session=session||new HangarSession();if(!session.draft)session.begin(context.loadout);
 const current=context.loadout,draft=session.draft,frame=frameSpec(current),slot=session.slot,
  open=slotOpen(current,slot),id=session.selected,m=MODULES[id],old=draft.slots[slot],quote=quoteLoadout(current,draft,context);
 const dirty=session.dirty(current),next=FRAME_STEPS[current.frame+1],blueprintQuote=quoteBlueprint(current,draft,context);
 const lock=moduleLock(id,context),wrongNode=(slot===5)!==(m.kind==='heavy');
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
 const assembly='<section class="hg-ship"><div class="hg-section-head"><div><span class="hg-eyebrow">СХЕМА ОСНАЩЕНИЯ</span><h3>Ваш корабль</h3></div><span class="hg-stage">Корпус '+(shipArtStage(context.level)+1)+' / 10</span></div>'+
  shipScene(context,session)+'<p class="hg-scene-caption">Нажмите на узел, чтобы выбрать для него оружие. Нос корабля направлен вверх.</p>'+
  (!open?'<p class="hg-locked-node">Узел '+labelFor(slot)+' ещё закрыт. Посмотрите условия в разделе «Развитие корпуса» ниже.</p>':'')+
  '<div class="hg-slot-strip" aria-label="Состав предварительной сборки">'+draft.slots.map((item,i)=>
   '<span class="'+(slotOpen(current,i)?item?'filled':'empty':'locked')+'"><b>'+labelFor(i)+'</b> '+
    (slotOpen(current,i)?(item?MODULES[item].short:'пусто'):'закрыт')+'</span>').join('')+'</div>'+
  '<details class="hg-thermal-plan hg-thermal-details"><summary>Охлаждение · '+(rate>14?'возможен перегрев':'в норме')+'</summary><strong>Общее охлаждение · 14 ед/с</strong><span>Автооружие: до '+fmt(rate)+' ед/с при непрерывном огне</span>'+
  '<small>'+(rate>14?'При долгой стрельбе эта сборка перегреется. На 100% огонь блокируется до остывания к 35%.':
   'Охлаждение справляется с непрерывным автоогнём этой сборки.')+' C отключает автоогонь и ускоряет охлаждение до 25 ед/с.</small></details></section>';
 const available=Object.values(MODULES).filter(item=>(slot===5?item.kind==='heavy':item.kind!=='heavy')&&
  (session.filter==='all'||item.kind===session.filter));
 const canBorrow=item=>item.kind==='manual'&&!context.fieldLoan&&!!fieldLoanOffer(context.station,context,item.id);
 const accessible=available.filter(item=>!moduleLock(item.id,context)||canBorrow(item));
 const future=available.filter(item=>!!moduleLock(item.id,context)&&!canBorrow(item));
 const weaponChoice=item=>{
  const borrowing=canBorrow(item),rental=borrowing?fieldLoanOffer(context.station,context,item.id):null;
  const fit=borrowing?borrowAndFit(context.station,current,slot,item.id,context):equipModule(current,slot,item.id,context);
  const cost=(fit.cost||0)+(rental?.cost||0),equipped=current.slots[slot]===item.id;
  const reason=moduleLock(item.id,context)&&!borrowing?moduleLock(item.id,context):
   dirty?'Сначала примените или отмените загруженную схему':fit.ok?'':fit.reason;
  const stats=moduleStats(item.id,context.ranks,specializationState(current,item.id));
  const help=item.name+'\n'+item.desc+'\nДальность: '+stats.range+' м · нагрев: '+item.heat+
   ' · интервал: '+fmt(stats.interval)+' с\nУрон: '+fmt(stats.damage)+' · целей: '+stats.targets+
   '\n'+(reason||equipped?'':borrowing?'Прокат до конца задания. 3 заряда. ':'')+
   (reason||(equipped?'Уже установлено.':'Выбор оружия сразу устанавливает его в узел '+labelFor(slot)+'.'));
  const price=equipped?'✓ Установлено':moduleLock(item.id,context)&&!borrowing?'Закрыто':borrowing?
   (cost?'Прокат · '+cost+' сплава':'Проба · бесплатно'):cost?'Купить · '+cost+' сплава':'Установить · бесплатно';
  return '<div class="hg-weapon-row" style="--module-color:'+item.color+'"><button type="button" data-act="'+
   (borrowing?'hgBorrow':'hgEquip')+'" data-id="'+item.id+'" class="hg-weapon'+(equipped?' selected':'')+
   (reason?' unavailable':'')+'" data-help="'+esc(help)+'"'+(reason||equipped?' disabled':'')+'><span class="hg-weapon-glyph" aria-hidden="true">'+icon(item.id)+'</span>'+
   '<span><strong>'+item.short+'</strong><small>'+item.role+'</small><em>'+esc(price)+'</em>'+
   (reason?'<small class="hg-choice-reason">'+esc(reason)+'</small>':'')+'</span></button>'+
   '<button type="button" class="menu-info" data-help-only data-help="'+esc(help)+'" aria-label="О модуле: '+
   esc(item.name)+'">i</button></div>';
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
  (stockGuide?'<details class="hg-stock-help"><summary>Где взять оружие?</summary>'+stockGuide+'</details>':'')+
  '<div class="hg-catalog-list">'+accessible.map(weaponChoice).join('')+
  (accessible.length?'':'<p class="hg-empty-weapons">Пока нет доступного оружия с этим фильтром.</p>')+'</div>'+
  (future.length?'<details class="hg-future-weapons"><summary>Пока недоступно · '+future.length+'</summary><div class="hg-catalog-list">'+
   future.map(weaponChoice).join('')+'</div></details>':'')+
  '<small class="hg-one-click">Нажатие устанавливает оружие. Цена указана на кнопке.</small></aside>';
 const frameLock=!next?'':context.level<next.level?'Нужен уровень '+next.level:context.ore<next.cost?'Не хватает '+(next.cost-context.ore)+' ед. сплава':'';
 const progression='<section class="hg-progression"><div><span class="hg-eyebrow">РАЗВИТИЕ КОРПУСА</span><strong>'+frame.nodes+(frame.nodes===5?' обычных узлов':' обычных узла')+(frame.heavy?' + H':'')+'</strong></div>'+
  '<ol>'+FRAME_STEPS.map((step,i)=>'<li class="'+(i<=current.frame?'unlocked':'')+'"><b>'+step.nodes+(step.heavy?' + H':'')+'</b><small>ур. '+step.level+'</small></li>').join('')+'</ol>'+
  '<div class="hg-frame-action">'+(next?button('hgFrame',next.name+' · '+next.cost+' сплава','',!!frameLock||dirty)+
  '<small>'+esc(dirty?'Сначала завершите замену оружия':frameLock||'Открывает ещё один узел; оружие устанавливается отдельно')+'</small>':'<strong>Все узлы открыты</strong>')+'</div></section>';
 const upgrades=state.hangarUpgrades?.length?'<details class="hg-upgrades" data-hangar-section="upgrades"><summary>Улучшения оружия и систем · очков: '+(state.points||0)+'</summary><div class="hg-upgrade-grid">'+
  state.hangarUpgrades.map(s=>'<article><div><strong>'+esc(s.title)+'</strong><b>'+s.rank+' / '+s.max+'</b></div><p>'+esc(s.effect)+'</p>'+
   button('hgUpgrade',s.reason,s.id,!s.canBuy)+'<small>'+esc(s.desc)+'</small></article>').join('')+'</div></details>':'';
 const savedBlueprints=session.blueprints.filter(Boolean).length;
 const blueprints='<details class="hg-presets" data-hangar-section="blueprints"><summary>Схемы оснащения · сохранено '+savedBlueprints+' из 3</summary><p class="hg-note">Есть три ячейки для сохранения сборок на этом устройстве. Сплав потребуется только для изготовления при применении. При новом вылете оружие и узлы нужно открыть заново.</p><div>'+BLUEPRINT_NAMES.map((name,i)=>
  '<article><b>'+name+'</b><small>'+(session.blueprints[i]?'Сохранена':'Пустая ячейка')+'</small>'+button('hgLoad','Загрузить',String(i),!session.blueprints[i])+button('hgSave','Записать',String(i),!blueprintQuote.ok)+'</article>').join('')+'</div></details>';
 const compareNow=report.ranges.map((range,i)=>'<span><small>'+range+' м</small><b>'+fmt(report.dps[i])+'</b></span>').join('');
 const draftCount=draft.slots.filter((item,i)=>item&&slotOpen(current,i)).length;
 const editing=!!session.catalog&&open;
 const pendingApply=dirty?'<div class="hg-apply-bar has-changes" role="region" aria-label="Подтверждение оснащения"><div><strong>● Предварительная сборка · '+draftCount+' узл.</strong><span>'+
  (quote.cost?'Изготовление: '+quote.cost+' сплава · останется '+Math.max(0,context.ore-quote.cost):'Модули в наличии · замена бесплатна')+'</span>'+
  (!quote.ok?'<small class="hg-error">'+esc(quote.reason)+'</small>':'')+'</div><div>'+
  button('hgReset','Отменить')+button('hgApply',quote.cost?'Изготовить и применить':'Применить','',!quote.ok,'hg-primary')+'</div></div>':
  '<div class="hg-current-bar" role="status">✓ Текущее вооружение установлено. Чтобы изменить его, нажмите на узел корабля.</div>';
 const nextUnlock=next?'Следующий узел: уровень '+next.level+' · '+next.cost+' сплава':'Все узлы открыты';
 return '<section class="ship-hangar'+(editing?' hg-catalog-open':'')+'" aria-label="Конструктор корабля">'+
  '<header class="hg-title"><div><span class="hg-eyebrow">АНГАР · ОСНАЩЕНИЕ КОРАБЛЯ</span><h2>Оружие корабля</h2></div><span class="hg-live-pill">УСТАНОВЛЕНО: '+loadoutProfile(current).automatic+' АВТО'+(loadoutProfile(current).ion?' + ИОН':loadoutProfile(current).resonator?' + РЕЗОНАНС':'')+(loadoutProfile(current).howitzer?' + H':'')+'</span></header>'+
  pendingApply+
  '<details class="hg-combat-cue hg-mission-help"><summary>Совет к вылету</summary>'+esc(combatCue)+'</details>'+
  '<div class="hg-layout'+(editing?' hg-layout-editing':' hg-layout-centered')+'">'+
  (editing?catalog:'')+assembly+'</div>'+tacticalPanel(context)+
  '<details class="hg-weapon-branches" data-hangar-section="weapon-branches"><summary>Ветки оружия</summary>'+
   [...new Set(current.slots.filter(Boolean))].map(id=>specializationPanel(id,context)).join('')+'</details>'+
  '<details class="hg-combat-details"><summary>Урон, нагрев и сравнение сборок</summary><div class="hg-decision-brief"><div class="hg-range-brief" aria-label="Урон автоматического оружия в секунду, без брони и перегрева"><small class="hg-range-title">АВТОУРОН / С</small>'+compareNow+'</div></div>'+comparison+'</details>'+
  '<p class="hg-message" role="status" aria-live="polite">'+esc(session.message||'Выберите узел, затем оружие. Установка происходит сразу.')+'</p>'+
  (frameLock?'<details class="hg-more-frames"><summary>Развитие корпуса · '+nextUnlock+'</summary>'+progression+'</details>':progression)+
  upgrades+blueprints+'</section>';
}
