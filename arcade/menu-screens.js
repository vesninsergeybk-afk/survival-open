import {OPENING_ARC,runClock} from './opening-arc.js?v=opening-arc-5';
import {baseNames} from './balance.js?v=arcade-network-20';
import {MODULES,moduleStats,slotOpen} from './ship-loadout.js?v=first-contract-reward-1-campaign-1-weapon-mechanics-2-unified-controls-1-direct-fit-1-menu-focus-1';
export const escapeMenu=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const menuSymbol=kind=>{
 const paths={resume:'m8 4 13 8-13 8z',signal:'M12 9v6M9 12h6M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14',
  rescue:'M8 3h8v18H8zM4 8h16M4 16h16M11 10v4M9 12h6',
  weapon:'M8 21V9l4-6 4 6v12M12 3v15M5 18h14',death:'m5 4 14 16M19 4 5 20M7 3h10v5H7z',
  rail:'M9 9h6v12H9zM10 1v11M14 1v11M7 18h10',flak:'M8 10h8v10H8zM7 2l3 10M12 1v11M17 2l-3 10M6 17h12',plasma:'M9 5h6v9H9zM12 1v7M7 17h10M9 14v8M15 14v8',skills:'M12 3v18M3 12h18M5 5l14 14M19 5 5 19',map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16'};
 return '<svg class="menu-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[kind]||paths.signal)+'"/></svg>';
};
export const menuInfo=(title,text)=>'<button type="button" class="menu-info" data-help-only data-help="'+escapeMenu(text)+'" aria-label="'+escapeMenu(title)+'">i</button>';
export const screenHead=(kind,kicker,title,id)=>'<header class="screen-head"><span class="screen-emblem" aria-hidden="true">'+menuSymbol(kind)+'</span><div><span class="screen-kicker">'+kicker+'</span><h2 id="'+id+'">'+title+'</h2></div></header>';
export const menuFooter=(primary,other='')=>'<footer class="screen-footer"><div class="screen-secondary">'+other+'</div><div class="screen-primary">'+primary+'</div></footer>';
export function menuBackButton(label,action='menuBack'){
 if(!label)return '';
 return '<button type="button" class="screen-button" data-act="'+action+'"'+
  (label==='К паузе'?' data-return-pause':'')+'>← '+escapeMenu(label)+'</button>';
}
export function renderMapActions(game){
 const back=game.menuBackLabel?.()||(game.mapReturnToBase&&game.docked?'К станции':'');
 const route=game.manualWaypoint||game.waypoint;
 const distance=route&&Math.round(Math.hypot(route.x-game.player.x,route.y-game.player.y));
 const dirty=(game.stationExitArmed||game.mapReturnToBase)&&game.hangarSession?.dirty(game.shipLoadout);
 return '<footer class="map-control-bar">'+
  '<div class="map-course"><div role="status"><strong>'+(route?
   escapeMenu(route.label)+' · '+distance+' м':'Курс не задан')+'</strong>'+
  (game.mapCourseMessage?'<small>'+escapeMenu(game.mapCourseMessage)+'</small>':'')+'</div>'+
  (route?'<button type="button" data-act="waypoint" data-id="clear">Сбросить маршрут</button>':'')+'</div>'+
  '<div class="map-footer-actions">'+menuBackButton(back,back==='К станции'?'baseBack':'menuBack')+
  '<button type="button" class="primary" data-act="close">'+
   (dirty?'В полёт · сборка не применена':game.stationExitArmed||game.mapReturnToBase?'В полёт':'Продолжить полёт')+
   '</button></div></footer>';
}
const action=(act,label,cls='screen-button',role='')=>'<button type="button" class="'+cls+'" data-act="'+act+'"'+(role?' data-role="'+role+'"':'')+'>'+label+'</button>';
const saveHelp='Прогресс сохраняется при стыковке с активной станцией и после подготовки корабля. Возврат после гибели восстанавливает мир, ресурсы и корабль на момент сохранения; более поздние события отменяются.';
export function renderContinuation(saved,issue){
 const base=saved?.world.stations.find(([id])=>id===saved.baseId)?.[1],p=saved?.state.player;
 const detail=saved?'<div class="screen-metrics"><span>Станция<b>'+escapeMenu(baseNames[base?.type]||'Станция')+'</b></span><span>Уровень<b>'+p.level+'</b></span><span>Сплав<b>'+p.ore+'</b></span></div>':
  '<p class="screen-warning">'+(issue==='unsupported'?'Сохранение создано более новой версией игры. Оно останется на устройстве; новый вылет в этой версии будет без сохранений.':'Контрольную точку не удалось прочитать. Можно начать новый вылет.')+'</p>';
 return '<div class="dialog screen-dialog continuation-dialog" role="dialog" aria-modal="true" aria-labelledby="continue-title">'+
  screenHead('resume','ВЫЖИВШИЙ · ВОЗВРАЩЕНИЕ',saved?'Продолжить вылет?':'Сохранение недоступно','continue-title')+detail+
  '<details class="menu-explanation"><summary>Как работает сохранение</summary><p>'+saveHelp+'</p></details>'+
  menuFooter(action(saved?'runContinue':'runNew',saved?'Продолжить со станции':'Новый вылет','screen-button primary'),saved?action('requestRunNew','Новый вылет','screen-button quiet'):'')+'</div>';
}
export function renderDeathScreen(game,failed){
 const checkpoint=game.pendingCheckpoint;
 return '<div class="dialog screen-dialog death-dialog" role="dialog" aria-modal="true" aria-labelledby="death-title">'+
  screenHead('death','СИГНАЛ ПОТЕРЯН','Корабль потерян','death-title')+
  '<div class="screen-metrics"><span>Время<b>'+runClock(game.time)+'</b></span><span>Уровень<b>'+game.player.level+'</b></span><span>Станции<b>'+game.activeBases+'</b></span></div>'+
  '<p class="screen-record">Личный рекорд · '+runClock(game.bestFlight)+'</p>'+
  (checkpoint?'<p class="screen-warning">Возврат к стыковке отменит события последней вылазки.</p>':
   '<p class="screen-warning">Контрольной точки нет. Для сохранения включите домашний док и стыкуйтесь со станциями.</p>')+
  (failed?'<details class="menu-explanation"><summary>Итоги последней вылазки</summary><p>'+failed.seconds+' с · сплав '+(failed.ore>=0?'+':'')+failed.ore+
   ' · данные '+(failed.data>=0?'+':'')+failed.data+' · повреждения '+failed.details.damageTaken+' · потеряно дронов '+failed.details.dronesLost+'.</p></details>':'')+
  menuFooter(action(checkpoint?'runContinue':'restart',checkpoint?'Вернуться к последней стыковке · '+runClock(checkpoint.state.time):'Новый вылет','screen-button primary'),
   checkpoint?action('requestRestart','Начать заново','screen-button quiet dangerous'):'')+'</div>';
}
export function renderOpeningSignals(interact){
 const options=[['intercept','signal','Перехватить наводчика','Уничтожьте отмеченный корабль.',
  '+'+OPENING_ARC.interceptRewardData+' данных · патрули реже',
  'Наводчик ведёт патрули к доку. Подлетите на дальность оружия; охранение можно обойти. После победы патрули появляются реже на '+OPENING_ARC.interceptRelief+' с.'],
  ['rescue','rescue','Спасти капсулу','Удерживайте '+interact+' рядом с капсулой.',
  '+'+OPENING_ARC.rescueRewardOre+' сплава · +'+OPENING_ARC.rescueShield+' щита',
  'Ремонт занимает '+OPENING_ARC.repairSeconds+' с и сохраняется при перерыве. Пока работает луч, пушки молчат. На половине работы капсула выпустит защитный импульс; после спасения враг поднимет тревогу.']];
 return '<div class="dialog screen-dialog opening-choice" role="dialog" aria-modal="true" aria-labelledby="opening-title">'+
  screenHead('signal','ДОМАШНИЙ СЕКТОР · ДВА СИГНАЛА','Кому помочь?','opening-title')+
  '<p class="screen-warning">Можно выбрать только одну цель. На выполнение — '+OPENING_ARC.deadline+' с игрового времени.</p>'+
  '<div class="screen-choices">'+options.map(([id,icon,name,task,reward,help])=>'<article class="screen-choice">'+menuSymbol(icon)+menuInfo('Подробности: '+name,help)+
   '<h3 data-help="'+escapeMenu(help)+'">'+name+'</h3><p>'+escapeMenu(task)+'</p><span class="screen-reward">'+reward+'</span>'+action('openingPick','Выбрать','screen-button primary',id)+'</article>').join('')+'</div>'+
  '<small class="screen-note">Первое успешно выполненное поручение даёт бесплатный оружейный модуль.</small>'+menuFooter(action('openingSkip','Свободный полёт','screen-button quiet'))+'</div>';
}
export function renderOpeningHardware(loadout){
 const free=loadout?.slots.some((id,i)=>id===null&&slotOpen(loadout,i));
 const options=[['rail','Рельс','Дальний бой · 700 м'],['flak','Картечь','Против роя · 245 м'],
  ['plasma','Плазма','Ближний бой · '+moduleStats('plasma').range+' м']];
 return '<div class="dialog screen-dialog opening-choice reward-dialog" role="dialog" aria-modal="true" aria-labelledby="opening-reward-title">'+
  screenHead('weapon','НАГРАДА · БЕСПЛАТНОЕ ОСНАЩЕНИЕ','Выберите оружие','opening-reward-title')+
  '<p class="screen-lead">'+(free?'Модуль сразу установится в свободный узел.':'Свободного узла нет: модуль поступит на склад ангара.')+'</p>'+
  '<div class="screen-choices three">'+options.map(([id,name,role])=>'<article class="screen-choice">'+menuSymbol(id)+menuInfo('О модуле: '+MODULES[id].name,MODULES[id].desc)+
   '<h3 data-help="'+escapeMenu(MODULES[id].desc)+'">'+name+'</h3><p>'+role+'</p>'+action('openingReward',free?'Получить и установить':'Получить на склад','screen-button primary',id)+'</article>').join('')+'</div>'+
  menuFooter(action('close','Выбрать позже','screen-button quiet'))+'</div>';
}
export function renderRunConfirmation(restart=false){
 return '<section class="run-confirm screen-dialog" role="alertdialog" aria-modal="true" aria-labelledby="run-confirm-title">'+
  screenHead('signal','НОВЫЙ ВЫЛЕТ','Начать заново?','run-confirm-title')+
  '<p class="screen-warning">Текущее сохранение будет заменено. Вернуться к этому прохождению после начала нового не получится.</p>'+
  menuFooter(action(restart?'confirmRestart':'confirmRunNew','Начать новый вылет','screen-button dangerous'),action('cancelRunNew','Остаться здесь','screen-button primary'))+'</section>';
}
