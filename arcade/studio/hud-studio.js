const states={
 flight:{title:'Свободный полёт',signal:'Корпус, следующая станция, рывок и общий режим автоогня.',choice:'Лететь к станции, исследовать сектор или вступить в бой.',world:'Радар показывает только ближайшие объекты; второстепенные уведомления не удерживаются постоянно.',check:'Без подсказок найти готовность рывка и ближайшую цель; центральная область не перекрыта прибором.'},
 mining:{title:'Добыча под угрозой',signal:'У цели — «Добывать · удерживать», прогресс раскалывания породы и отдельная заметность поискового сигнала.',choice:'Продолжать добычу, прекратить удержание или отойти. Янтарный поиск патруля отличается от красной атаки.',world:'При отпускании действия добыча прекращается; при атаке предупреждение усиливается, но не закрывает цель.',check:'Игрок видит разницу между добычей, поиском и атакой. Кнопки движения и действия работают одновременно.'},
 combat:{title:'Столкновение',signal:'Здоровье, направление опасного попадания, готовность рывка, статус автоогня и только доступная поддержка.',choice:'Маневрировать, отключить автоогонь при необходимости, использовать рывок или поддержку.',world:'Красный сигнал возникает для подтверждённой атаки/удара, патрульный поиск остаётся янтарным.',check:'На экране с несколькими врагами и взрывами HUD не закрывает корабль, пули и ориентиры.'},
 critical:{title:'Критическое повреждение',signal:'Усиленное отображение остатка корпуса и короткая подпись «Критический корпус».',choice:'Отступить, уклониться или направиться к ремонту; доступные действия остаются понятны.',world:'Один сигнал состояния без бесконечного мигания, резких толчков и ложной красной подсветки остальных шкал.',check:'Смысл понятен без цвета; на reduced-motion остаются текст и форма; числа соответствуют состоянию.'},
 base:{title:'Рядом со станцией',signal:'Контекстное «Открыть базу» и ресурсы, которые потребуются для решения.',choice:'Открыть меню E/сенсорным действием, оценить ремонт, наём, технологию или активацию.',world:'Пока открыто меню, подробности находятся в нём, HUD не дублирует всю экономику.',check:'Кнопка реально действует; при перекрытии астероида и станции приоритет действия совпадает с игровым кодом.'}
};
const images={
 desktop:{src:'./assets/hud-desktop-v03.png',alt:'Художественный концепт HUD для ПК: корпус и опыт слева снизу, действия внизу по центру, ресурсы справа, радар сверху справа',caption:'ПК: крупный корпус, действия по ситуации, второстепенные ресурсы и локальный радар.'},
 mobile:{src:'./assets/hud-mobile-v03.png',alt:'Художественный концепт HUD для горизонтального телефона: корпус сверху слева, радар справа, снизу джойстик и сенсорные кнопки',caption:'Телефон: шкала корпуса вверху, движение слева, контекстное действие, рывок и автоогонь справа.'}
};
function chooseDevice(device){
 const entry=images[device]||images.desktop;
 document.querySelectorAll('[data-hud-device]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hudDevice===device)));
 const img=document.getElementById('hud-mockup'),caption=document.getElementById('hud-mockup-caption');
 if(!img||!caption)return;
 img.src=entry.src;img.alt=entry.alt;caption.textContent=entry.caption;
}
function chooseState(name){
 const state=states[name]||states.flight;
 document.querySelectorAll('[data-hud-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hudState===name)));
 const panel=document.getElementById('hud-state-detail');
 if(!panel)return;
 panel.replaceChildren();
 const h=document.createElement('h4');h.textContent=state.title;panel.append(h);
 for(const [label,value] of [['Что видит игрок',state.signal],['Какое решение принимает',state.choice],['Как отвечает интерфейс',state.world],['Как проверяем',state.check]]){
  const section=document.createElement('div'),tag=document.createElement('strong'),p=document.createElement('p');
  tag.textContent=label;p.textContent=value;section.append(tag,p);panel.append(section);
 }
}
document.querySelectorAll('[data-hud-device]').forEach(b=>b.addEventListener('click',()=>chooseDevice(b.dataset.hudDevice)));
document.querySelectorAll('[data-hud-state]').forEach(b=>b.addEventListener('click',()=>chooseState(b.dataset.hudState)));
chooseDevice('desktop');chooseState('flight');
