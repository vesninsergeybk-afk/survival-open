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
  const reason=mastered?'Максимум':p.level<s.from?'Нужен уровень '+s.from:prereq&&!ranks[prereq.id]?'Сначала '+prereq.title:p.points<=0?'Нужно 1 очко':'';
  const html='<article class="pilot-skill '+(reason?'locked':'ready')+'">'+menuInfo('О навыке: '+s.title,s.desc)+
   '<div class="pilot-skill-title">'+menuSymbol(s.branch==='Технологии'?'signal':s.branch==='Добыча'?'rescue':'skills')+'<h3 data-help="'+esc(s.desc)+'">'+esc(s.title)+'</h3><b>'+rank+'/'+s.max+'</b></div>'+
   '<p class="pilot-next-effect">'+esc(mastered?'Изучено полностью':nextEffect(s.id,rank,ranks))+'</p>'+
   '<button type="button" class="skill-node '+(reason?'locked':'ready')+'" data-act="skill" data-id="'+s.id+'"'+(reason?' disabled':'')+'>'+esc(reason||'Изучить · 1 очко')+'</button></article>';
  return {html,rank,ready:!reason,from:s.from};
 });
 const currentEntries=entries.filter(s=>s.ready||s.rank>0);
 const future=entries.filter(s=>!s.ready&&!s.rank).sort((a,b)=>a.from-b.from);
 const grid=list=>'<div class="pilot-skill-grid">'+list.map(s=>s.html).join('')+'</div>';
 const cards=allBranches?
  (currentEntries.length?grid(currentEntries):'<p class="development-empty">Пока нет доступных навыков. Следующий уровень даст очко развития.</p>')+
  (future.length?'<h3 class="development-next-title">Следующий навык</h3>'+grid(future.slice(0,1)):'')+
  (future.length>1?'<details class="pilot-future" data-hangar-section="pilot-future"><summary>Ещё навыки · '+(future.length-1)+'</summary>'+grid(future.slice(1))+'</details>':''):
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
