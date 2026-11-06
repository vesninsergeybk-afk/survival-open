import {renderShipHangar} from './hangar-panel.js?v=menu-rebuild-1';
import {renderPilotContent} from './pilot-menu.js?v=menu-rebuild-1';
import {menuIcon} from './menu-icons.js?v=menu-focus-1-station-terminal-art-1';

export const DEVELOPMENT_TABS=Object.freeze([
 ['weapons','Оружие','weapons'],['ship','Корабль','hull'],
 ['tactics','Тактика','pulse'],['pilot','Пилот','navigation'],['station','Станция','network']
]);
export const developmentTab=id=>DEVELOPMENT_TABS.some(([key])=>key===id)?id:'weapons';

// Every shortcut opens the same cards and transactions as this page. The
// navigation never grants an unlock, spends currency or resets a loadout draft.
export function renderDevelopmentPanel(state,stationContent=''){
 const category=developmentTab(state.developmentCategory);
 const navigation='<nav class="development-tabs" aria-label="Виды развития">'+DEVELOPMENT_TABS.map(([id,label,icon])=>
  '<button type="button" data-act="developmentTab" data-id="'+id+'" aria-pressed="'+(id===category)+'" tabindex="'+(id===category?0:-1)+'"'+
  (id===category?' class="selected"':'')+'>'+menuIcon(icon)+label+'</button>').join('')+'</nav>';
 let content;
 if(category==='pilot')content=renderPilotContent({
  player:{level:state.level||1,points:state.points||0,xp:state.xp||0},
  ranks:state.skillRanks||{},doctrine:state.doctrine,skills:state.pilotSkills||[],
  doctrines:state.pilotDoctrines||[],nextEffect:state.nextSkillEffect||(()=>''),allBranches:true
 });
 else if(category==='station')content=stationContent;
 else content=renderShipHangar({...state,developmentCategory:category,developmentMode:true});
 return '<section class="development-panel" aria-label="Развитие">'+
  '<header class="development-heading"><div><span class="base-kicker">ВЫБЕРИТЕ, ЧТО УСИЛИТЬ</span><h2>Развитие</h2></div>'+
  '<p>Пилот · ур. '+(state.level||1)+' <b>Очков: '+(state.points||0)+'</b></p></header>'+navigation+
  '<div class="development-content" data-development="'+category+'">'+content+'</div>'+
  (['pilot','station'].includes(category)&&state.hangarSession?.message?'<p class="hg-message" role="status" aria-live="polite">'+
   state.hangarSession.message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p>':'')+'</section>';
}
