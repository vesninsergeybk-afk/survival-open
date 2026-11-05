import {borrowAndFit} from './direct-fitting.js?v=direct-fit-1';
import {fieldLoanOffer} from './field-weapons.js?v=living-world-2-weapon-feel-1-expedition-1-campaign-1';
import {WEAPON_SPECIALIZATIONS,specializationState,quoteSpecialization} from './weapon-specializations.js?v=weapons-cycle-2-weapon-mechanics-2';
import {loadoutAnalysis} from './loadout-analysis.js?v=weapons-cycle-2-campaign-1';
import {TACTICAL_DEVICES,TACTICAL_BRANCHES,createTactical,tacticalSpec,tacticalQuote} from './tactical-fields.js?v=tactical-field-2';
import {DEFAULT_CONTROLS,readableKey} from './control-layout.js?v=unified-controls-1';
import {menuIcon} from './menu-icons.js?v=menu-focus-1';
import {MODULES,FRAME_STEPS,BLUEPRINT_NAMES,SHIP_ART,HangarSession,createLoadout,
 frameSpec,slotOpen,equipModule,moduleStats,moduleLock,moduleStock,quoteLoadout,quoteBlueprint,loadoutProfile,shipArtStage} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-weapon-mechanics-2-unified-controls-1-direct-fit-1-menu-flow-2-menu-focus-1';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>typeof n==='number'?Number(n.toFixed(2)).toLocaleString('ru-RU'):n;
const button=(act,label,id='',disabled=false,cls='')=>'<button type="button" class="'+cls+'" data-act="'+act+'" data-id="'+id+'"'+(disabled?' disabled':'')+'>'+label+'</button>';
const labelFor=i=>i===5?'H':String(i+1);
const icon=id=>menuIcon(id,'hg-module-icon');
const info=(name,description)=>'<button type="button" class="menu-info" data-help-only data-help="'+esc(description)+'" aria-label="Подробнее: '+esc(name)+'">i</button>';
function specializationPanel(id,context){
 const branches=WEAPON_SPECIALIZATIONS[id];if(!branches)return '';
 const current=specializationState(context.loadout,id);
 const heading=current?'Выбрана: '+branches[current.path]?.name+' · '+(current.rank===2?'мастерство':'первая ступень'):
  'Выберите один из двух путей';
 return '<section class="hg-upgrades hg-branches" data-hangar-section="branches"><h4>Ветки развития · '+esc(heading)+'</h4>'+
  '<p class="hg-note">Первая ступень: уровень 7 и 2 активированные станции. Мастерство: уровень 11 и 3 станции. Выбор сохраняется до конца вылета.</p>'+
  '<div class="hg-upgrade-grid">'+Object.entries(branches).map(([path,branch])=>{
   const quote=quoteSpecialization(context.loadout,id,path,context),chosen=current?.path===path;
   const label=quote.ok?(chosen?'Усилить мастерство · 1 очко':'Выбрать · 1 очко'):quote.reason;
   return '<article><div><strong>'+esc(branch.name)+'</strong><b>'+(chosen?'Выбрана · '+current.rank+'/2':'Ветвь')+'</b></div>'+
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
 const quote=tacticalQuote(state,owned?'equip':'unlock',id,context),chosen=state.branches[id];
 const caption=equipped?'Установлено':owned?'Установить бесплатно':'Получить · '+device.cost+' сплава';
 const picks=Object.entries(TACTICAL_DEVICES).map(([key,item])=>{
  const active=state.equipped===key,has=state.owned.includes(key);
  return '<button type="button" class="hg-tactic-pick'+(id===key?' selected':'')+'" data-act="hgFocusTactic" data-id="'+key+
   '" aria-pressed="'+(id===key)+'">'+menuIcon(key)+'<strong>'+esc(item.short)+'</strong><small>'+
  (active?'Установлено':has?'В наличии':item.bases+' станции · '+item.cost+' сплава')+'</small></button>';
 }).join('');
 const upgrade='<div class="hg-tactic-branches"><h4>Ветки развития</h4><p class="hg-note">Одна ветка на устройство до конца вылета. Каждая ступень стоит 1 очко развития.</p><div class="hg-upgrade-grid">'+Object.entries(TACTICAL_BRANCHES[id]).map(([path,branch])=>{
   const q=tacticalQuote(state,'upgrade',id,{...context,path});
   const rank=chosen?.path===path?chosen.rank:0;
   return '<article><div><strong>'+esc(branch.name)+'</strong><b>'+rank+'/2</b></div><p>'+esc(branch.desc)+'</p>'+
    button('hgTacticUpgrade',rank?'Усилить · 1 очко':'Выбрать · 1 очко',id+':'+path,!q.ok)+
    (!q.ok?'<small>'+esc(q.reason)+'</small>':'')+'</article>';
  }).join('')+'</div></div>';
 return '<section class="hg-tactical" aria-label="Тактические устройства"><p class="hg-tactical-equipped">'+
  'Сейчас установлено: <b>'+esc(current.short)+'</b> · '+fieldKey+'</p>'+
  '<div class="hg-tactic-selector" role="group" aria-label="Выбор устройства для просмотра">'+picks+'</div>'+
  '<section class="hg-tactic-detail" aria-label="Выбранное устройство"><div class="hg-section-head"><h3>'+menuIcon(id)+esc(device.name)+'</h3>'+info(device.name,device.desc+'\nРадиус: '+spec.radius+' м · длительность: '+fmt(spec.duration)+' с.\nУправление: '+readableKey((context.controls||DEFAULT_CONTROLS).field)+'.')+'</div>'+
  '<p>'+esc(device.role)+' · перезарядка <b>'+spec.cooldown+' с</b></p><p>'+esc(device.desc)+'</p>'+
  button('hgTactic'+(owned?'Equip':'Unlock'),esc(caption),id,!quote.ok,'hg-primary')+
  (!quote.ok&&!equipped?'<p class="hg-requirement">'+esc(quote.reason)+'. Активировано станций: '+(context.activeBases||0)+'.</p>':'')+
  (overridden?'<p class="hg-requirement">Сейчас '+fieldKey+' запускает установленный полевой модуль. После возврата модулей снова будет работать '+esc(current.short.toLowerCase())+'.</p>':'')+
  upgrade+'</section></section>';
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
 const assembly='<section class="hg-ship"><div class="hg-section-head"><div><span class="hg-eyebrow">СХЕМА ОСНАЩЕНИЯ</span><h3>Ваш корабль</h3></div><span class="hg-stage">Корпус '+(shipArtStage(context.level)+1)+' / 10</span></div>'+
  shipScene(context,session)+'<p class="hg-scene-caption">Нажмите на узел, чтобы выбрать для него оружие. Нос корабля направлен вверх.</p>'+
  (!open?'<div class="hg-locked-node"><p>Узел '+labelFor(slot)+' ещё закрыт. Развитие корпуса доступно в разделе «Улучшения».</p>'+button('hgView','Условия открытия узла','upgrades')+'</div>':'')+
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
 const weaponOffer=item=>{
  const borrowing=canBorrow(item),rental=borrowing?fieldLoanOffer(context.station,context,item.id):null;
  const fit=borrowing?borrowAndFit(context.station,current,slot,item.id,context):equipModule(current,slot,item.id,context);
  // Quote the full price even if the player's current balance is too low.
  const budget={...context,ore:Number.MAX_SAFE_INTEGER};
  const priced=borrowing?borrowAndFit(context.station,current,slot,item.id,budget):equipModule(current,slot,item.id,budget);
  const cost=priced.ok?(priced.cost||0)+(priced.loanCost||0):(item.cost||rental?.cost||0),equipped=current.slots[slot]===item.id;
  const reason=dirty?'Сначала примените или отмените загруженную схему':
   moduleLock(item.id,context)&&!borrowing?moduleLock(item.id,context):fit.ok?'':fit.reason;
  const stats=moduleStats(item.id,context.ranks,specializationState(current,item.id));
  const help=item.name+'\n'+item.desc+'\nДальность: '+stats.range+' м · нагрев: '+item.heat+
   ' · интервал: '+fmt(stats.interval)+' с\nУрон: '+fmt(stats.damage)+' · целей: '+stats.targets+
   '\n'+(reason||equipped?'':borrowing?'Прокат до конца задания. 3 заряда. ':'')+
   (reason||(equipped?'Уже установлено.':'Для установки в узел '+labelFor(slot)+' нажмите кнопку установки. Просмотр не меняет оснащение и не тратит сплав.'));
  const price=equipped?'✓ Установлено':borrowing?(cost?'Прокат · '+cost+' сплава':'Бесплатная проба · 3 заряда'):
   cost?cost+' сплава':'Со склада · бесплатно';
  const caption=equipped?'Установлено':reason&&moduleLock(item.id,context)&&!borrowing?'Закрыто':
   borrowing?(cost?'Взять напрокат · '+cost+' сплава':'Взять и установить бесплатно'):
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
   (moduleLock(item.id,context)&&!offer.borrowing?'<small>'+esc(moduleLock(item.id,context))+'</small>':'')+'</span></button></div>';
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
  '<small class="hg-one-click">Выберите оружие. Цена и кнопка установки появятся в его подробностях. Просмотр не тратит сплав.</small></aside>';
 const frameLock=!next?'':context.level<next.level?'Нужен уровень '+next.level:context.ore<next.cost?'Не хватает '+(next.cost-context.ore)+' ед. сплава':'';
 const progression='<section class="hg-progression"><div><span class="hg-eyebrow">РАЗВИТИЕ КОРПУСА</span><strong>'+frame.nodes+(frame.nodes===5?' обычных узлов':' обычных узла')+(frame.heavy?' + H':'')+'</strong></div>'+
  '<ol>'+FRAME_STEPS.map((step,i)=>'<li class="'+(i<=current.frame?'unlocked':'')+'"><b>'+step.nodes+(step.heavy?' + H':'')+'</b><small>ур. '+step.level+'</small></li>').join('')+'</ol>'+
  '<div class="hg-frame-action">'+(next?button('hgFrame',next.name+' · '+next.cost+' сплава','',!!frameLock||dirty)+
  '<small>'+esc(dirty?'Сначала завершите замену оружия':frameLock||'Открывает ещё один узел; оружие устанавливается отдельно')+'</small>':'<strong>Все узлы открыты</strong>')+'</div></section>';
 const upgradeCard=s=>'<article><div><strong>'+menuIcon(s.id)+esc(s.title)+'</strong><b>'+s.rank+' / '+s.max+'</b></div><p>'+esc(s.effect)+'</p>'+
  '<div class="hg-upgrade-action">'+button('hgUpgrade',s.rank>=s.max?'Максимум':'Изучить · 1 очко',s.id,!s.canBuy)+info(s.title,s.desc)+'</div>'+
  (!s.canBuy&&s.rank<s.max?'<small class="hg-requirement">'+esc(s.reason)+'</small>':'')+'</article>';
 const skills=state.hangarUpgrades||[],availableSkills=skills.filter(s=>s.canBuy);
 const frameReady=next&&!frameLock&&!dirty;
 const frameCard=next?'<article class="hg-frame-goal"><div><strong>'+menuIcon('hull')+esc(next.name)+'</strong><b>ур. '+next.level+'</b></div>'+
  '<p>Откроет '+(next.heavy?'тяжёлый узел H':'ещё один оружейный узел')+'. Оружие устанавливается отдельно.</p>'+
  button('hgFrame','Открыть · '+next.cost+' сплава','',!frameReady)+
  (!frameReady?'<small class="hg-requirement">'+esc(dirty?'Сначала примените или отмените загруженную схему':frameLock)+'</small>':'')+'</article>':'';
 const upcoming=skills.filter(s=>!s.canBuy&&s.rank<s.max).map(s=>({level:s.from||1,html:upgradeCard(s)}));
 if(next&&!frameReady)upcoming.push({level:next.level,html:frameCard});
 upcoming.sort((a,b)=>Math.max(0,a.level-context.level)-Math.max(0,b.level-context.level));
 const upgrades='<section class="hg-upgrades hg-all-upgrades" data-hangar-section="upgrades">'+
  '<div class="hg-section-head"><h3>Доступно сейчас</h3><b>Очков развития: '+(state.points||0)+'</b></div>'+
  (availableSkills.length||frameReady?'<div class="hg-upgrade-grid">'+availableSkills.map(upgradeCard).join('')+(frameReady?frameCard:'')+'</div>':
   '<p class="hg-empty-upgrades">'+(upcoming.length?'Сейчас нет доступных покупок. Получайте опыт в бою и за выполнение заданий; условия ближайшего улучшения указаны ниже.':'Все улучшения изучены.')+'</p>')+
  (upcoming.length?'<section class="hg-next-upgrade" aria-label="Ближайшее улучшение"><h4>Следующее улучшение</h4><div class="hg-upgrade-grid">'+upcoming[0].html+'</div></section>':'')+
  '<details class="hg-all-technologies" data-hangar-section="all-technologies"><summary>Все технологии · оружие, системы и корпус</summary>'+progression+
  (skills.length?'<div class="hg-upgrade-grid">'+skills.map(upgradeCard).join('')+'</div>':'')+'</details></section>';
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
 const related=(state.hangarUpgrades||[]).filter(s=>affected[focusedId].includes(s.id));
 const inspector='<aside class="hg-weapon-inspector" aria-label="Развитие выбранного оружия">'+
  '<div class="hg-section-head"><div><span class="hg-eyebrow">ХАРАКТЕРИСТИКИ И РАЗВИТИЕ</span><h3>'+esc(focused.name)+'</h3></div>'+info(focused.name,focusedOffer.help)+'</div>'+
  (session.catalog&&open?'':'<div class="hg-weapon-picks" role="group" aria-label="Выберите оружие для просмотра">'+Object.values(MODULES).map(item=>
   '<button type="button" data-act="hgFocusWeapon" data-id="'+item.id+'" aria-pressed="'+(focusedId===item.id)+'" class="hg-focus-pick'+
   (focusedId===item.id?' selected':'')+'">'+icon(item.id)+esc(item.short)+'</button>').join('')+'</div>')+
  '<p class="hg-weapon-description">'+esc(focused.desc)+'</p>'+
  '<div class="hg-focused-stats"><span>Дальность <b>'+focusedStats.range+' м</b></span><span>Нагрев <b>'+focused.heat+'</b></span>'+
  '<span>Роль <b>'+esc(focused.role)+'</b></span></div>'+
  (session.catalog&&open?fitting:'<p class="hg-weapon-availability">'+(installed?'✓ Установлено на корабле.':
   'Не установлено. Чтобы выбрать ветку, сначала установите оружие в свободный узел.')+'</p>')+
  (WEAPON_SPECIALIZATIONS[focusedId]?specializationPanel(focusedId,context):
   '<p class="hg-no-branches">У этого модуля нет отдельных веток специализации.</p>')+
  (related.length?'<section class="hg-related-upgrades"><h4>Общие улучшения, влияющие на это оружие</h4><div class="hg-upgrade-grid">'+
   related.map(upgradeCard).join('')+'</div></section>':'')+'</aside>';
 const savedBlueprints=session.blueprints.filter(Boolean).length;
 const blueprints='<details class="hg-presets" data-hangar-section="blueprints"><summary>Схемы оснащения · сохранено '+savedBlueprints+' из 3</summary><p class="hg-note">Есть три ячейки для сохранения сборок на этом устройстве. Сплав потребуется только для изготовления при применении. При новом вылете оружие и узлы нужно открыть заново.</p><div>'+BLUEPRINT_NAMES.map((name,i)=>
  '<article><b>'+name+'</b><small>'+(session.blueprints[i]?'Сохранена':'Пустая ячейка')+'</small>'+button('hgLoad','Загрузить',String(i),!session.blueprints[i])+button('hgSave','Записать',String(i),!blueprintQuote.ok)+'</article>').join('')+'</div></details>';
 const compareNow=report.ranges.map((range,i)=>'<span><small>'+range+' м</small><b>'+fmt(report.dps[i])+'</b></span>').join('');
 const draftCount=draft.slots.filter((item,i)=>item&&slotOpen(current,i)).length;
 const editing=!!session.catalog&&open;
 const fittingStrip='<div class="hg-fitting-strip" role="group" aria-label="Узлы корабля">'+draft.slots.map((item,i)=>
  '<button type="button" data-act="hgSlot" data-id="'+i+'" aria-pressed="'+(slot===i)+'" class="'+
  (slotOpen(current,i)?item?'filled':'empty':'locked')+'"><b>'+labelFor(i)+'</b><span>'+
  esc(slotOpen(current,i)?item?MODULES[item].short:'Свободен':'Закрыт')+'</span></button>').join('')+'</div>';
 const pendingApply=dirty?'<div class="hg-apply-bar has-changes" role="region" aria-label="Подтверждение оснащения"><div><strong>● Предварительная сборка · '+draftCount+' узл.</strong><span>'+
  (quote.cost?'Изготовление: '+quote.cost+' сплава · останется '+Math.max(0,context.ore-quote.cost):'Модули в наличии · замена бесплатна')+'</span>'+
  (!quote.ok?'<small class="hg-error">'+esc(quote.reason)+'</small>':'')+'</div><div>'+
  button('hgReset','Отменить')+button('hgApply',quote.cost?'Изготовить и применить':'Применить','',!quote.ok,'hg-primary')+'</div></div>':
  '<div class="hg-current-bar" role="status">'+(editing?'Выберите оружие для узла '+labelFor(slot)+'. Просмотр не меняет оснащение и не тратит сплав.':
   '✓ Текущее вооружение установлено. Чтобы изменить его, нажмите на узел корабля.')+'</div>';
 const view=['weapons','tactics','upgrades','services'].includes(state.hangarView)?state.hangarView:'weapons';
 const nav='<nav class="hg-view-nav" aria-label="Что сделать с кораблём">'+
  [['weapons','Оружие'],['tactics','Тактика'],['upgrades','Улучшения'],['services','Ремонт и дроны']].map(([id,label])=>
   '<button type="button" data-act="hgView" data-id="'+id+'" aria-pressed="'+(view===id)+'"'+(view===id?' class="selected"':'')+'>'+menuIcon(({tactics:'pulse',services:'repair'})[id]||id)+label+'</button>').join('')+'</nav>';
 return '<section class="ship-hangar'+(editing&&view==='weapons'?' hg-catalog-open':'')+'" aria-label="Конструктор корабля">'+
  '<header class="hg-title"><div><span class="hg-eyebrow">АНГАР · КОРАБЛЬ</span><h2>'+({weapons:'Оружие и его развитие',tactics:'Тактические устройства',upgrades:'Улучшения корабля',services:'Ремонт и поддержка'}[view])+'</h2></div><span class="hg-live-pill">УСТАНОВЛЕНО: '+loadoutProfile(current).automatic+' АВТО'+(loadoutProfile(current).ion?' + ИОН':loadoutProfile(current).resonator?' + РЕЗОНАНС':'')+(loadoutProfile(current).howitzer?' + H':'')+'</span></header>'+
  nav+(dirty||view==='weapons'?pendingApply:'')+
  (view==='weapons'&&editing?fittingStrip:'')+
  (view==='weapons'?'<div class="hg-layout'+(editing?' hg-layout-editing':' hg-layout-centered')+'">'+
    (editing?catalog:assembly)+inspector+'</div>'+
    '<details class="hg-combat-cue hg-mission-help"><summary>Совет к вылету</summary>'+esc(combatCue)+'</details>'+
    '<details class="hg-combat-details"><summary>Урон, нагрев и сравнение сборок</summary><div class="hg-decision-brief"><div class="hg-range-brief" aria-label="Урон автоматического оружия в секунду, без брони и перегрева"><small class="hg-range-title">АВТОУРОН / С</small>'+compareNow+'</div></div>'+comparison+'</details>'+blueprints:'')+
  (view==='tactics'?tacticalPanel(context,session):'')+
  (view==='upgrades'?upgrades:'')+
  (view==='services'?'<p class="hg-view-note">Здесь можно отремонтировать корабль, нанять дронов и взять полевые модули.</p>':'')+
  '<p class="hg-message" role="status" aria-live="polite">'+esc(session.message||'')+'</p></section>';
}
