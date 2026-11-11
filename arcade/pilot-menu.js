import {SHIP_UPGRADES} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-weapon-mechanics-2-unified-controls-1-direct-fit-1-menu-focus-1';
import {escapeMenu as esc,menuInfo,menuSymbol,screenHead,menuFooter,menuBackButton} from './menu-screens.js?v=all-menus-1-menu-audit-1';
import {doctrineRank,doctrineCost,doctrineBuyReason,doctrineNextEffect,
 normalizedDoctrineRanks,doctrineSpent,doctrinePointsWord} from './pilot-doctrines.js?v=pilot-depth-1-pilot-value-2';
import {DATA_RESEARCH,DATA_RESEARCH_COSTS,DATA_PROTOCOL,researchRank,researchOffer,
 researchProtocolOffer} from './data-research.js';
export function renderPilotContent({player:p,ranks,doctrine,doctrineRanks,combatMastery,time=0,skills,doctrines,branch='Корабль',nextEffect}){
 const branches=[['Корабль','Пилотирование'],['Технологии','Технологии'],
  ['Добыча','Добыча'],['Оружие','Ручное оружие']];
 const current=branches.some(([id])=>id===branch)?branch:'Корабль';
 const pilotState={doctrine,doctrineRanks,level:p.level,points:p.points};
 const spent=doctrineSpent(normalizedDoctrineRanks(pilotState));
 const protocol=researchProtocolOffer(combatMastery,p.data,time);
 const researchOpen=p.points===0&&p.data>=DATA_RESEARCH_COSTS[0];
 const researchPanel='<details class="pilot-doctrines pilot-data-research" data-hangar-section="data-research"'+(researchOpen?' open':'')+'><summary>Анализ данных · '+p.data+' доступно</summary>'+
  '<p class="screen-note">Голубые ядра дают данные. Постоянные исследования действуют весь вылет; боевой протокол можно включать повторно. Очки развития при этом сохраняются.</p><div class="pilot-doctrine-grid">'+
  Object.entries(DATA_RESEARCH).map(([id,spec])=>{
   const rank=researchRank(combatMastery,id),offer=researchOffer(combatMastery,p.data,id);
   return '<article class="pilot-choice">'+menuInfo('Об исследовании: '+spec.name,spec.description)+
    '<h3>'+esc(spec.name)+'</h3><small>Ранг '+rank+'/'+spec.max+' · бонус +'+
    (rank*spec.step*100).toFixed(1).replace('.',',')+'%</small><p class="pilot-next-effect">'+esc(spec.description)+'</p>'+
    '<button type="button" data-act="dataResearch" data-id="'+id+'"'+(offer.ok?'':' disabled')+'>'+
    esc(offer.ok?'Улучшить · '+offer.cost+' данных':offer.reason)+'</button></article>';
  }).join('')+'<article class="pilot-choice">'+menuInfo('О протоколе: '+DATA_PROTOCOL.name,DATA_PROTOCOL.description)+
   '<h3>'+esc(DATA_PROTOCOL.name)+'</h3><small>Повторяемый · '+DATA_PROTOCOL.duration+' с</small><p class="pilot-next-effect">'+
   esc(DATA_PROTOCOL.description)+'</p><button type="button" data-act="dataProtocol"'+
   (protocol.ok?'':' disabled')+'>'+esc(protocol.ok?'Включить · '+DATA_PROTOCOL.cost+' данных':protocol.reason)+
   '</button></article></div></details>';
 const doctrineReady=doctrines.some(d=>!doctrineBuyReason(pilotState,d.id));
 const doctrinePanel=doctrines.length?'<details class="pilot-doctrines" data-hangar-section="pilot-doctrines"'+(doctrineReady?' open':'')+'><summary>Доктрины · '+
  (spent?spent+' потрачено':p.level<4?'с уровня 4':'четыре ветви')+'</summary>'+
  '<p class="screen-note">Все четыре ветви доступны одному пилоту. Ступени стоят 1, 2 и 3 очка; открываются на уровнях 4, 7 и 11. Сброс всех доктрин на активной станции возвращает очки за 12 сплава.</p><div class="pilot-doctrine-grid">'+
  doctrines.map(d=>{
   const rank=doctrineRank(pilotState,d.id),cost=doctrineCost(rank),reason=doctrineBuyReason(pilotState,d.id);
   const effect=rank>=3?'Ветка завершена':doctrineNextEffect(d.id,rank);
   return '<article class="pilot-choice">'+menuInfo('О доктрине: '+d.title,d.desc)+
    '<h3 data-help="'+esc(d.desc)+'">'+esc(d.title)+'</h3><small>Ранг '+rank+'/3 · '+
    (rank>=3?'изучено полностью':'следующий — '+cost+' '+doctrinePointsWord(cost))+'</small><p class="pilot-next-effect">'+esc(effect)+'</p>'+
    '<button type="button" data-act="doctrine" data-id="'+d.id+'"'+(reason?' disabled':'')+'>'+esc(reason||'Изучить · '+cost+' '+doctrinePointsWord(cost))+'</button></article>';
  }).join('')+'</div></details>':'';
 const entries=skills.filter(s=>s.branch===current&&!SHIP_UPGRADES.has(s.id)).map(s=>{
  const rank=ranks[s.id]||0,mastered=rank>=s.max,prereq=s.requires?skills.find(x=>x.id===s.requires):null;
  const hasPrereq=!s.requires||!!ranks[s.requires],exclusive=!!s.exclusiveWith&&!!ranks[s.exclusiveWith];
  const masteryLocked=!!s.masteryLevel&&rank>0&&p.level<s.masteryLevel;
  const eligible=!mastered&&p.level>=s.from&&hasPrereq&&!exclusive&&!masteryLocked;
  const reason=mastered?'Максимум':exclusive?'Выбрана другая специализация':
   p.level<s.from?'Нужен уровень '+s.from:!hasPrereq?'Сначала «'+(prereq?.title||s.requires)+'»':
   masteryLocked?'Второй ранг — с уровня '+s.masteryLevel:p.points<=0?'Нужно 1 очко':'';
  const status=mastered?'mastered':eligible?(p.points>0?'ready':'waiting'):'locked';
  const effect=mastered?'Изучено полностью':nextEffect(s.id,rank,ranks);
  const ranksHtml='<span class="dev-rank-track" aria-label="Изучено '+rank+' из '+s.max+'">'+Array.from({length:s.max},(_,i)=>'<i'+(i<rank?' class="filled"':'')+'></i>').join('')+'</span>';
  const html='<article class="pilot-skill dev-node '+(reason?'locked':'ready')+'" data-state="'+status+'">'+menuInfo('О навыке: '+s.title,s.desc)+
   '<div class="pilot-skill-title">'+menuSymbol(s.branch==='Технологии'?'signal':s.branch==='Добыча'?'rescue':'skills')+'<h3 data-help="'+esc(s.desc)+'">'+esc(s.title)+'</h3><b>'+rank+'/'+s.max+'</b></div>'+
   ranksHtml+(prereq?'<small class="dev-prerequisite">После «'+esc(prereq.title)+'»</small>':'')+
   (s.masteryLevel?'<small class="dev-prerequisite">Выбор пути — с уровня '+s.from+', второй ранг — с уровня '+s.masteryLevel+'. Пути несовместимы.</small>':'')+
   '<p class="pilot-next-effect">'+esc(effect)+'</p>'+
   '<button type="button" class="skill-node '+(reason?'locked':'ready')+'" data-act="skill" data-id="'+s.id+'"'+(reason?' disabled':'')+'>'+esc(reason||'Изучить · 1 очко')+'</button></article>';
  return {html,rank,eligible,ready:!reason};
 });
 const grid=list=>'<div class="pilot-skill-grid">'+list.map(s=>s.html).join('')+'</div>';
 const currentSkills=entries.filter(s=>s.eligible||s.rank>0).sort((a,b)=>Number(b.ready)-Number(a.ready));
 const future=entries.filter(s=>!s.eligible&&!s.rank);
 const tabs='<nav class="skill-branch-tabs" aria-label="Навыки пилота">'+branches.map(([id,label])=>
  '<button type="button" data-act="skillBranch" data-id="'+id+'" aria-pressed="'+(id===current)+'" tabindex="'+(id===current?0:-1)+'">'+label+'</button>').join('')+'</nav>';
 return researchPanel+doctrinePanel+tabs+
  (currentSkills.length?grid(currentSkills):'<p class="screen-note">В этой ветви ещё нет открытых навыков.</p>')+
  (future.length?'<details class="pilot-future" data-hangar-section="pilot-future"><summary>Будущие навыки · '+future.length+'</summary>'+grid(future)+'</details>':'');
}

export function renderPilotMenu(options){
 const {player:p,nextXp,atStation=false,backLabel}=options;
 return '<div class="dialog wide skill-dialog pilot-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-menu-title">'+
  screenHead('skills','НАВЫКИ И ДОКТРИНА','Пилот','skill-menu-title')+
  '<div class="pilot-status"><span>Уровень <b>'+p.level+'</b></span><span>Свободно очков <b>'+p.points+'</b></span><span>Опыт <b>'+Math.floor(p.xp)+'/'+nextXp+'</b></span><span>Данные <b>'+p.data+'</b></span></div>'+
  renderPilotContent(options)+

  '<div class="pilot-ship-link"><span>Навыки «Голубой кометы» и мин доступны во вкладке «Ручное оружие». Модули автооружия, корпус и устройства улучшайте на станции.</span><button type="button" data-act="'+(atStation?'pilotHangar':'pilotMap')+'">'+(atStation?'К оснащению корабля':'Найти станцию')+'</button></div>'+
  menuFooter('<button type="button" class="screen-button primary" data-act="close">Продолжить полёт</button>',menuBackButton(backLabel))+'</div>';
}
