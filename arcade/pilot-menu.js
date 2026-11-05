import {SHIP_UPGRADES} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-weapon-mechanics-2-unified-controls-1-direct-fit-1';
import {escapeMenu as esc,menuInfo,menuSymbol,screenHead,menuFooter} from './menu-screens.js?v=all-menus-1';
export function renderPilotMenu({player:p,ranks,doctrine,skills,doctrines,branch='Корабль',nextEffect,nextXp,atStation=false}){
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
 const cards=skills.filter(s=>s.branch===current&&!SHIP_UPGRADES.has(s.id)).map(s=>{
  const rank=ranks[s.id]||0,mastered=rank>=s.max,prereq=s.requires?skills.find(x=>x.id===s.requires):null;
  const reason=mastered?'Максимум':p.level<s.from?'Нужен уровень '+s.from:prereq&&!ranks[prereq.id]?'Сначала '+prereq.title:p.points<=0?'Нужно 1 очко':'';
  return '<article class="pilot-skill '+(reason?'locked':'ready')+'">'+menuInfo('О навыке: '+s.title,s.desc)+
   '<div class="pilot-skill-title">'+menuSymbol(current==='Технологии'?'signal':current==='Добыча'?'rescue':'skills')+'<h3 data-help="'+esc(s.desc)+'">'+esc(s.title)+'</h3><b>'+rank+'/'+s.max+'</b></div>'+
   '<p class="pilot-next-effect">'+esc(mastered?'Изучено полностью':nextEffect(s.id,rank,ranks))+'</p>'+
   '<button type="button" class="skill-node '+(reason?'locked':'ready')+'" data-act="skill" data-id="'+s.id+'"'+(reason?' disabled':'')+'>'+esc(reason||'Изучить · 1 очко')+'</button></article>';
 }).join('');
 return '<div class="dialog wide skill-dialog pilot-dialog" role="dialog" aria-modal="true" aria-labelledby="skill-menu-title">'+
  screenHead('skills','ПИЛОТ · РАЗВИТИЕ','Развитие пилота','skill-menu-title')+
  '<div class="pilot-status"><span>Уровень <b>'+p.level+'</b></span><span>Свободно очков <b>'+p.points+'</b></span><span>Опыт <b>'+Math.floor(p.xp)+'/'+nextXp+'</b></span></div>'+
  '<nav class="skill-branch-tabs" aria-label="Выберите ветвь развития">'+branches.map(([id,label])=>'<button type="button" data-act="skillBranch" data-id="'+id+'" aria-pressed="'+(id===current)+'">'+label+'</button>').join('')+'</nav>'+
  '<div class="pilot-skill-grid">'+cards+'</div>'+doctrinePanel+
  '<div class="pilot-ship-link"><span>Оружие, корпус, двигатель и щиты — в ангаре станции.</span><button type="button" data-act="'+(atStation?'pilotHangar':'pilotMap')+'">'+(atStation?'К оснащению корабля':'Найти станцию')+'</button></div>'+
  '<div class="pilot-footer-links">'+menuFooter('<button type="button" class="screen-button primary" data-act="close">Продолжить полёт</button>',atStation?'<button type="button" class="screen-button" data-act="pilotStation">К станции</button>':'')+'</div></div>';
}
