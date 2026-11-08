import {FIELD_EVOLUTION_SKILLS,parasiteTargetMode} from './field-evolution.js?v=parasite-clarity-1';
import {escapeMenu as esc,screenHead,menuFooter,menuBackButton} from './menu-screens.js?v=menu-audit-1';

export function installedEvolution(ranks={},skills=FIELD_EVOLUTION_SKILLS){
 return skills.filter(s=>(ranks[s.id]||0)>0);
}

export function renderEvolutionMenu(game,skills){
 const s=game.fieldEvolution,p=game.player,ranks=game.skillRanks;
 const installed=installedEvolution(ranks,skills);
 const mode=parasiteTargetMode(game),dual=!!ranks.capture&&!!ranks.signal;
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
  (ranks.parasite?'<section class="evolution-core-help" aria-label="Как пользоваться энергетическим паразитом"><h3>Как пользоваться паразитом · '+(s?.charge||0)+'/2 ядра</h3>'+
   '<p><strong>Ядра — это заряды, а навык остаётся навсегда.</strong> Вы получаете одно ядро сразу. Затем каждый третий лично уничтоженный обычный дрон может оставить светящееся ядро: пролетите над ним, чтобы подобрать. Два маленьких шара рядом с кораблём показывают запас.</p>'+
   '<p><strong>Защита не требует кнопки.</strong> При сильном попадании или опасно малой прочности корпуса одно ядро расходуется автоматически и поглощает до 25 ед. урона. Если ядер нет, паразит ждёт следующего подбора.</p>'+
   (ranks.capture?'<p><strong>Захват:</strong> отметьте ПКМ область рядом с обычным врагом (касанием на телефоне): ближайший противник в круге получит метку. Добейте его сами. При наличии ядра и готовности навыка он станет союзником на 16 секунд. Второй захват возможен через 22 секунды; одновременно действует один союзник.</p>':'<p>Чтобы обращать врагов в союзников, сначала изучите «Паразитный захват» на 3-м уровне.</p>')+
   (ranks.signal?'<p><strong>Разведка:</strong> отметьте обычного врага и попадите по нему, пока он ещё достаточно прочен. Одно ядро откроет позиции соседних врагов на карте на 16 секунд.</p>':'')+
   (dual?'<div class="evolution-mode-picker" role="group" aria-label="Режим паразита"><span>Что делать с отмеченной целью:</span><button type="button" data-act="parasiteMode" data-mode="capture" aria-pressed="'+(mode==='capture')+'">Захват</button><button type="button" data-act="parasiteMode" data-mode="signal" aria-pressed="'+(mode==='signal')+'">Разведка</button></div><p>Выбранный режим показан также в полёте: его можно сменить без открытия меню. Режим не тратит заряд; ядро расходуется только при срабатывании.</p>':
    '<p>Дополнительных кнопок для паразита сейчас нет. Если позже изучите оба способа применения, сможете переключать «Захват» и «Разведку».</p>')+
   '</section>':'')+
  active+
  menuFooter('<button type="button" class="screen-button primary" data-act="close">Продолжить полёт</button>',
   menuBackButton(game.menuBackLabel?.())+'<button type="button" class="screen-button" data-act="evolutionAll">Все навыки пилота</button>')+'</div>';
}
