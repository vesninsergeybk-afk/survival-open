import {FIELD_EVOLUTION_SKILLS} from './field-evolution.js?v=field-evolution-1-first-loops-1-iris-interrupt-1';
import {escapeMenu as esc,screenHead,menuFooter,menuBackButton} from './menu-screens.js?v=menu-audit-1';

export function installedEvolution(ranks={},skills=FIELD_EVOLUTION_SKILLS){
 return skills.filter(s=>(ranks[s.id]||0)>0);
}

export function renderEvolutionMenu(game,skills){
 const s=game.fieldEvolution,p=game.player,ranks=game.skillRanks;
 const installed=installedEvolution(ranks,skills);
 const offers=(p.points>0?s?.offers||[]:[]).map(id=>skills.find(x=>x.id===id)).filter(Boolean);
 const receipt=game.evolutionReceipt&&game.time-game.evolutionReceipt.at<8?game.evolutionReceipt:null;
 const active=installed.length?'<section class="evolution-installed"><h3>Уже действуют · '+installed.length+'</h3><ul>'+installed.map(skill=>
  '<li><strong>'+esc(skill.title)+'</strong><span>'+esc(skill.desc)+'</span></li>').join('')+'</ul><p>Изученные навыки складываются и сохраняются до конца вылета.</p></section>':'';
 return '<div class="dialog evolution-dialog" role="dialog" aria-modal="true" aria-labelledby="evolution-title">'+
  screenHead('skills','РАЗВИТИЕ ПИЛОТА · ИГРА НА ПАУЗЕ',offers.length?'Добавьте новую способность':'Ваши способности','evolution-title')+
  (receipt?'<div class="evolution-receipt" role="status"><strong>Добавлено: '+esc(receipt.title)+'</strong><span>Ранее изученные навыки продолжают действовать.</span></div>':'')+
  '<p class="evolution-rule">Свободно очков: <b>'+p.points+'</b>. Один новый уровень даёт одно очко. '+(offers.length?'Выберите новый постоянный навык за 1 очко.':'Изученные навыки перечислены ниже.')+'</p>'+
  (offers.length?'<div class="evolution-choices">'+offers.map((skill,index)=>'<article class="evolution-choice"><div class="evolution-choice-copy"><small>ПОСТОЯННЫЙ НАВЫК</small><h3>'+esc(skill.title)+'</h3><p>'+esc(skill.desc)+'</p><button type="button" data-act="evolutionPick" data-id="'+skill.id+'">Изучить · 1 очко <small>['+(index+1)+']</small></button></div></article>').join('')+'</div><p class="evolution-rule">Выбираете одну из предложенных способностей. Другие предложения закроются; уже изученные навыки останутся. Новые варианты появятся со следующим уровнем.</p>':
   '<p class="evolution-rule">'+(p.points?'Очки сохранены. Все навыки можно посмотреть в полном меню развития.':'Следующее очко получите с новым уровнем.')+'</p>')+
  active+
  (ranks.parasite?'<section class="evolution-core-help"><h3>Энергоядра · '+(s?.charge||0)+'/2</h3><p>Маленькие шары у корабля — расходуемые заряды паразита. Заряд автоматически поглощает до 25 ед. сильного удара. Захват и передатчик тоже тратят заряд. Исчезновение шара означает расход заряда; навык остаётся.</p></section>':'')+
  menuFooter('<button type="button" class="screen-button primary" data-act="close">Продолжить полёт</button>',
   menuBackButton(game.menuBackLabel?.())+'<button type="button" class="screen-button" data-act="evolutionAll">Все навыки пилота</button>')+'</div>';
}
