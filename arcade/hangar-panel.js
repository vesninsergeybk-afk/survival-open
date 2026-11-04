import {WEAPON_SPECIALIZATIONS,specializationState,quoteSpecialization} from './weapon-specializations.js?v=weapons-cycle-2';
import {loadoutAnalysis} from './loadout-analysis.js?v=weapons-cycle-2';
import {MODULES,FRAME_STEPS,BLUEPRINT_NAMES,SHIP_ART,HangarSession,createLoadout,
 frameSpec,slotOpen,moduleStats,moduleLock,moduleStock,quoteLoadout,quoteBlueprint,loadoutProfile,shipArtStage} from './ship-loadout.js?v=weapons-cycle-2';

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
function statTable(id,ranks,oldId,loadout){
 const m=MODULES[id],s=moduleStats(id,ranks,specializationState(loadout,id)),
  old=oldId?moduleStats(oldId,ranks,specializationState(loadout,oldId)):null;
 const rows=[['Урон за попадание',s.damage,old?.damage],['Дальность, м',s.range,old?.range],
  [id==='howitzer'?'Перезарядка, с':'Интервал, с',s.interval,old?.interval],[id==='howitzer'?'Радиус взрыва, м':'Целей за залп',id==='howitzer'?110:s.targets,old?.targets],
  ['Нагрев за залп',m.heat,oldId?MODULES[oldId].heat:null]];
 if(id==='howitzer')rows.splice(3,0,['Подготовка, с',1.25,null]);
 return '<table class="hg-stats"><caption>Свойства одного модуля'+(oldId&&id!==oldId?' · справа новое значение':'')+'</caption><tbody>'+
  rows.map(([name,value,before])=>'<tr><th scope="row">'+name+'</th><td>'+
   (oldId&&id!==oldId&&before!==value?'<span class="hg-before">'+fmt(before)+' → </span>':'')+fmt(value)+'</td></tr>').join('')+'</tbody></table>';
}
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
  shipScene(context,session)+'<p class="hg-scene-caption">Выберите узел на схеме · нос направлен вверх</p>'+
  '<div class="hg-slot-strip" aria-label="Состав предварительной сборки">'+draft.slots.map((item,i)=>
   '<span class="'+(slotOpen(current,i)?item?'filled':'empty':'locked')+'"><b>'+labelFor(i)+'</b> '+
    (slotOpen(current,i)?(item?MODULES[item].short:'пусто'):'закрыт')+'</span>').join('')+'</div>'+
  '<div class="hg-thermal-plan"><strong>Общее охлаждение · 14 ед/с</strong><span>Автооружие: до '+fmt(rate)+' ед/с при непрерывном огне</span>'+
  '<small>'+(rate>14?'При долгой стрельбе эта сборка перегреется. На 100% огонь блокируется до остывания к 35%.':
   'Охлаждение справляется с непрерывным автоогнём этой сборки.')+' C отключает автоогонь и ускоряет охлаждение до 25 ед/с.</small></div></section>';
 const available=Object.values(MODULES).filter(item=>(slot===5?item.kind==='heavy':item.kind!=='heavy')&&
  (session.filter==='all'||item.kind===session.filter));
 const catalog='<aside class="hg-arsenal"><div class="hg-section-head"><div><span class="hg-eyebrow">МОДУЛЬНЫЙ АРСЕНАЛ</span><h3>Вооружение</h3></div>'+button('hgShip','← Корабль','','','hg-mobile-only')+'</div>'+
  '<div class="hg-filters" role="group" aria-label="Фильтр оружия">'+
  [['all','Все'],['auto','Авто'],['manual','Ручное']].filter(([key])=>slot!==5||key==='all').map(([key,name])=>
   button('hgFilter',name,key,false,session.filter===key?'selected':'')).join('')+'</div><div class="hg-catalog-list">'+available.map(item=>{
   const reason=moduleLock(item.id,context),stock=moduleStock(current,draft,context,item.id);
   return '<button type="button" data-act="hgSelect" data-id="'+item.id+'" class="hg-weapon'+(id===item.id?' selected':'')+
    (reason?' unavailable':'')+'" style="--module-color:'+item.color+'" aria-pressed="'+(id===item.id)+'">'+icon(item.id)+
    '<span><strong>'+item.name+'</strong><small>'+item.role+' · '+(item.kind==='auto'?'автоогонь':item.kind==='heavy'?'F':'Space')+'</small><em>'+
    esc(reason||(stock.owned?'На складе: '+stock.free+' · установлено: '+stock.installed:(item.cost===null?'Прокат':item.cost+' сплава за модуль')))+'</em></span></button>';
  }).join('')+(available.length?'':'<p>Для этого узла нет модулей с выбранным фильтром.</p>')+'</div>'+
  '<p class="hg-note">Снятое оружие остаётся на складе до конца вылета. Повторная установка бесплатна.</p></aside>';
 const inspector='<aside class="hg-inspector">'+button(open?'hgCatalog':'hgShip',open?'← Каталог':'← Корабль','','','hg-mobile-only hg-back-catalog')+'<span class="hg-eyebrow">УЗЕЛ '+labelFor(slot)+' · '+(slot===5?'СВЕРХТЯЖЁЛЫЙ':'УНИВЕРСАЛЬНЫЙ')+'</span>'+
  (open?'<h3 style="color:'+m.color+'">'+m.name+'</h3><p>'+m.desc+'</p>'+statTable(id,context.ranks,old,current)+specializationPanel(id,context)+
   '<p class="hg-fit-note">'+(lock?esc(lock):wrongNode?'Для этого оружия нужен другой узел.':
    (current.owned[id]||0)>0?'Имеющиеся модули используются первыми. Недостающие будут изготовлены при применении.':
    m.kind==='manual'?'Прокатный модуль · осталось зарядов: '+context.fieldLoan.charges:
    'Изготовление одного модуля: '+m.cost+' сплава. Стоимость всей сборки показана внизу.')+'</p>'+
   button('hgInstall',old===id?'Выбрано для узла':'Установить в узел '+labelFor(slot),'',!!lock||wrongNode||old===id,'hg-primary')+
   button('hgRemove','Снять модуль','',!old,'hg-remove'):
   '<h3>Узел ещё закрыт</h3><p>'+(slot===5?'Узел H открывается отдельно после пяти обычных. В него устанавливается осадная гаубица.':
    'Дополнительные узлы открываются по очереди. Графическая стадия корабля не ограничивает число доступных узлов.')+'</p>')+
  '<div class="hg-control-note"><span>Автооружие · <kbd>C</kbd> вкл/выкл</span><span>Полевой модуль · <kbd>Space</kbd></span><span>Гаубица · <kbd>F</kbd></span></div></aside>';
 const frameLock=!next?'':context.level<next.level?'Нужен уровень '+next.level:context.ore<next.cost?'Не хватает '+(next.cost-context.ore)+' ед. сплава':'';
 const progression='<section class="hg-progression"><div><span class="hg-eyebrow">РАЗВИТИЕ КОРПУСА</span><strong>'+frame.nodes+(frame.nodes===5?' обычных узлов':' обычных узла')+(frame.heavy?' + H':'')+'</strong></div>'+
  '<ol>'+FRAME_STEPS.map((step,i)=>'<li class="'+(i<=current.frame?'unlocked':'')+'"><b>'+step.nodes+(step.heavy?' + H':'')+'</b><small>ур. '+step.level+'</small></li>').join('')+'</ol>'+
  '<div class="hg-frame-action">'+(next?button('hgFrame',next.name+' · '+next.cost+' сплава','',!!frameLock||dirty)+
  '<small>'+esc(dirty?'Сначала завершите замену оружия':frameLock||'Открывает ещё один узел; оружие устанавливается отдельно')+'</small>':'<strong>Все узлы открыты</strong>')+'</div></section>';
 const upgrades=state.hangarUpgrades?.length?'<details class="hg-upgrades" data-hangar-section="upgrades"><summary>Улучшения оружия и систем · очков: '+(state.points||0)+'</summary><div class="hg-upgrade-grid">'+
  state.hangarUpgrades.map(s=>'<article><div><strong>'+esc(s.title)+'</strong><b>'+s.rank+' / '+s.max+'</b></div><p>'+esc(s.effect)+'</p>'+
   button('hgUpgrade',s.reason,s.id,!s.canBuy)+'<small>'+esc(s.desc)+'</small></article>').join('')+'</div></details>':'';
 const blueprints='<details class="hg-presets" data-hangar-section="blueprints"><summary>Сохранённые конфигурации · 3 схемы</summary><p class="hg-note">Схемы сохраняются на этом устройстве бесплатно. Сплав потребуется только для изготовления при применении. При новом вылете оружие и узлы нужно открыть заново.</p><div>'+BLUEPRINT_NAMES.map((name,i)=>
  '<article><b>'+name+'</b>'+button('hgLoad','Загрузить',String(i),!session.blueprints[i])+button('hgSave','Записать',String(i),!blueprintQuote.ok)+'</article>').join('')+'</div></details>';
 const compareNow=report.ranges.map((range,i)=>'<span><small>'+range+' м</small><b>'+fmt(report.dps[i])+'</b></span>').join('');
 const draftCount=draft.slots.filter((item,i)=>item&&slotOpen(current,i)).length;
 return '<section class="ship-hangar'+(session.catalog?' hg-catalog-open':'')+(session.inspect?' hg-inspect-open':'')+'" aria-label="Конструктор корабля">'+
  '<header class="hg-title"><div><span class="hg-eyebrow">АНГАР · ОСНАЩЕНИЕ КОРАБЛЯ</span><h2>Соберите свой корабль</h2></div><span class="hg-live-pill">В ПОЛЁТЕ: '+loadoutProfile(current).automatic+' АВТО'+(loadoutProfile(current).ion?' + ИОН':loadoutProfile(current).resonator?' + РЕЗОНАНС':'')+(loadoutProfile(current).howitzer?' + H':'')+'</span></header>'+
  '<div class="hg-apply-bar'+(dirty?' has-changes':'')+'" role="region" aria-label="Подтверждение оснащения"><div><strong>'+(dirty?'● Предварительная сборка · '+draftCount+' узл.':'✓ Текущая конфигурация · '+draftCount+' узл.')+'</strong><span>'+
   (quote.cost?'Изготовление: '+quote.cost+' сплава · останется '+Math.max(0,context.ore-quote.cost):'Модули в наличии · замена бесплатна')+'</span>'+(!quote.ok?'<small class="hg-error">'+esc(quote.reason)+'</small>':'')+'</div><div>'+
   button('hgReset','Отменить','',!dirty)+button('hgApply',quote.cost?'Изготовить и применить':'Применить','',!dirty||!quote.ok,'hg-primary')+'</div></div>'+
  '<div class="hg-decision-brief"><p>'+esc(combatCue)+'</p><div class="hg-range-brief" aria-label="Урон автоматического оружия в секунду, без брони и перегрева"><small class="hg-range-title">АВТОУРОН / С</small>'+compareNow+'</div></div>'+
  comparison+'<div class="hg-layout">'+catalog+assembly+inspector+'</div>'+
  '<p class="hg-message" role="status" aria-live="polite">'+esc(session.message||'Изменения вступят в силу после применения. В ангаре игра приостановлена.')+'</p>'+
  progression+upgrades+blueprints+'</section>';
}
