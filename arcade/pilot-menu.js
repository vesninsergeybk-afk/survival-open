import {SHIP_UPGRADES} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-weapon-mechanics-2-unified-controls-1-direct-fit-1-menu-focus-1';
import {escapeMenu as esc,menuInfo,menuSymbol,screenHead,menuFooter} from './menu-screens.js?v=all-menus-1';
export function renderPilotContent({player:p,ranks,doctrine,skills,doctrines,branch='Корабль',nextEffect,allBranches=false}){
 const branches=[['Корабль','Пилотирование'],['Технологии','Технологии'],['Добыча','Добыча']];
 const current=branches.some(([id])=>id===branch)?branch:'Корабль';
 const selectedDoctrine=doctrines.find(d=>d.id===doctrine);
 const doctrineReady=!doctrine&&p.level>=4&&p.points>0;
 const doctrinePanel='<details class="pilot-doctrines"'+(doctrineReady?' open':'')+'><summary>Доктрина · '+
  (selectedDoctrine?esc(selectedDoctrine.title):p.level<4?'с уровня 4':p.points?'доступен выбор':'нужно 1 очко')+'</summary>'+
  '<p class="screen-note">Один стиль боя. Смена на активной станции стоит 12 сплава.</p><div class="pilot-doctrine-grid">'+
  doctrines.map(d=>'<article class="pilot-choice">'+menuInfo('О доктрине: '+d.title,d.desc)+'<h3 data-help="'+esc(d.desc)+'">'+esc(d.title)+'</h3><small>'+
   (doctrine===d.id?'Выбрана':doctrine?'Уже выбран другой стиль':p.level<4?'Нужен уровень 4':'Стоимость · 1 очко')+'</small>'+
   '<button type="button" data-act="doctrine" data-id="'+d.id+'"'+(!doctrineReady?' disabled':'')+'>'+ (doctrine===d.id?'Установлено':'Выбрать · 1 очко')+'</button></article>').join('')+'</div></details>';
 const entries=skills.filter(s=>(allBranches||s.branch===current)&&!SHIP_UPGRADES.has(s.id)).map(s=>{
  const rank=ranks[s.id]||0,mastered=rank>=s.max,prereq=s.requires?skills.find(x=>x.id===s.requires):null;
  const hasPrereq=!prereq||!!ranks[prereq.id],eligible=!mastered&&p.level>=s.from&&hasPrereq;
  const reason=mastered?'Максимум':p.level<s.from?'Нужен уровень '+s.from:!hasPrereq?'Сначала '+prereq.title:p.points<=0?'Нужно 1 очко':'';
  const status=mastered?'mastered':eligible?(p.points>0?'ready':'waiting'):'locked';
  const effect=mastered?'Изучено полностью':nextEffect(s.id,rank,ranks);
  const ranksHtml='<span class="dev-rank-track" aria-label="Изучено '+rank+' из '+s.max+'">'+Array.from({length:s.max},(_,i)=>'<i'+(i<rank?' class="filled"':'')+'></i>').join('')+'</span>';
  const html='<article class="pilot-skill dev-node '+(reason?'locked':'ready')+'" data-state="'+status+'">'+menuInfo('О навыке: '+s.title,s.desc)+
   '<div class="pilot-skill-title">'+menuSymbol(s.branch==='Технологии'?'signal':s.branch==='Добыча'?'rescue':'skills')+'<h3 data-help="'+esc(s.desc)+'">'+esc(s.title)+'</h3><b>'+rank+'/'+s.max+'</b></div>'+
   ranksHtml+(prereq?'<small class="dev-prerequisite">После «'+esc(prereq.title)+'»</small>':'')+
   '<p class="pilot-next-effect">'+esc(effect)+'</p>'+
   '<button type="button" class="skill-node '+(reason?'locked':'ready')+'" data-act="skill" data-id="'+s.id+'"'+(reason?' disabled':'')+'>'+esc(reason||'Изучить · 1 очко')+'</button></article>';
  return {html,id:s.id,title:s.title,effect,rank,ready:!reason,eligible,from:s.from,branch:s.branch,requires:s.requires};
 });
 const grid=list=>'<div class="pilot-skill-grid">'+list.map(s=>s.html).join('')+'</div>';
 const ready=allBranches&&p.points>0?entries.filter(s=>s.ready).slice(0,3):[];
 const quick=ready.length?'<section class="dev-pilot-ready" aria-label="Навыки для улучшения сейчас">'+
  '<div class="dev-tree-caption"><h3>Можно улучшить сейчас</h3><span>Каждый навык · 1 очко</span></div>'+
  '<div class="dev-pilot-ready-list">'+ready.map(s=>'<button type="button" data-act="openDevelopment" data-id="pilot" data-focus="'+s.id+'" data-upgrade="'+s.id+'">'+
   '<strong>'+esc(s.title)+'</strong><small>'+esc(s.branch)+' · '+s.rank+' → '+(s.rank+1)+'</small><small class="dev-pilot-ready-effect">'+esc(s.effect)+'</small><span>Найти в дереве →</span></button>').join('')+'</div></section>':'';
 const doctrineCue=allBranches&&doctrineReady&&doctrines.length?'<div class="dev-doctrine-cue"><span><strong>Открыт выбор стиля боя</strong> · доктрина стоит 1 очко и меняет возможности пилота.</span>'+
  '<button type="button" data-act="focusDoctrine">Посмотреть стили →</button></div>':'';
 const cards=allBranches?
  '<nav class="dev-pilot-branch-nav" aria-label="Переход к направлению подготовки">'+branches.map(([id,label])=>{
   const available=entries.filter(s=>s.branch===id&&s.ready).length;
   return '<button type="button" data-act="focusPilotBranch" data-id="'+id+'">'+esc(label)+
    (available&&p.points>0?' · '+available+' доступно':'')+'</button>';
  }).join('')+'</nav>'+doctrineCue+quick+
  '<p class="dev-summary">Изученные ступени отмечены золотым, доступные — голубым. Под каждой ступенью указан эффект следующего ранга.</p>'+
  branches.map(([id,label])=>{
   const list=entries.filter(s=>s.branch===id);
   if(!list.length)return '';
   return '<section class="dev-pilot-branch" data-pilot-branch="'+id+'" aria-label="'+esc(label)+'"><div class="dev-tree-caption"><h3>'+esc(label)+'</h3><span>'+list.filter(s=>s.eligible).length+' открыто по условиям</span></div>'+
    grid(list.filter(s=>s.eligible||s.rank>0))+
    (list.some(s=>!s.eligible&&!s.rank)?'<details class="pilot-future"><summary>Будущие навыки · '+list.filter(s=>!s.eligible&&!s.rank).length+'</summary>'+grid(list.filter(s=>!s.eligible&&!s.rank))+'</details>':'')+'</section>';
  }).join(''):
  grid(entries);
 return (allBranches?'':'<nav class="skill-branch-tabs" aria-label="Выберите ветвь развития">'+branches.map(([id,label])=>'<button type="button" data-act="skillBranch" data-id="'+id+'" aria-pressed="'+(id===current)+'">'+label+'</button>').join('')+'</nav>')+
  cards+doctrinePanel;
}

export function renderPilotMenu(options){
 const {player:p,nextXp,atStation=false}=options;
 return '<div class="dialog wide skill-dialog pilot-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-menu-title">'+
  screenHead('skills','ПИЛОТ · РАЗВИТИЕ','Развитие пилота','skill-menu-title')+
  '<div class="pilot-status"><span>Уровень <b>'+p.level+'</b></span><span>Свободно очков <b>'+p.points+'</b></span><span>Опыт <b>'+Math.floor(p.xp)+'/'+nextXp+'</b></span></div>'+
  renderPilotContent(options)+

  '<div class="pilot-ship-link"><span>Все улучшения оружия и корабля — в разделе «Развитие» на станции.</span><button type="button" data-act="'+(atStation?'pilotHangar':'pilotMap')+'">'+(atStation?'К оснащению корабля':'Найти станцию')+'</button></div>'+
  '<div class="pilot-footer-links">'+menuFooter('<button type="button" class="screen-button primary" data-act="close">Продолжить полёт</button>',atStation?'<button type="button" class="screen-button" data-act="pilotStation">К станции</button>':'')+'</div></div>';
}
