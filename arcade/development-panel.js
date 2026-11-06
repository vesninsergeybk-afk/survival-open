import {renderShipHangar} from './hangar-panel.js?v=menu-rebuild-1-development-tree-1-devux-3-clarity-pass-1';
import {renderPilotContent} from './pilot-menu.js?v=menu-rebuild-1-development-tree-1-devux-3-first-loops-1';
import {menuIcon} from './menu-icons.js?v=menu-focus-1-station-terminal-art-1';
import {developmentPointLedger} from './experience.js?v=progression-clarity-1';
import {TACTICAL_DEVICES} from './tactical-fields.js?v=clarity-pass-1';

export const DEVELOPMENT_TABS=Object.freeze([
 ['weapons','Оружие','weapons'],['ship','Корабль','hull'],
 ['tactics','Тактические устройства','pulse'],['pilot','Пилот','navigation']
]);
export const developmentTab=id=>DEVELOPMENT_TABS.some(([key])=>key===id)?id:'weapons';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pointsWord=n=>n%100>=11&&n%100<=14?'очков':n%10===1?'очко':n%10>=2&&n%10<=4?'очка':'очков';

// No "best build" is imposed: these are three different intentions, each
// pointing to an upgrade whose actual level and prerequisite gates are met.
export function availableDevelopmentChoices(state){
 const upgrades=state.hangarUpgrades||[],ranks=state.skillRanks||{},level=state.level||1;
 const choose=(ids,source)=>ids.map(id=>source.find(s=>s.id===id)).find(Boolean);
 const slots=state.loadout?.slots||[];
 // Range and split beams only affect plasma; otherwise a shortcut could
 // propose a rank that changes nothing on the current ship.
 const weapon=choose(['beam','range','double','rocket'],upgrades.filter(s=>s.canBuy&&
  (!['range','double'].includes(s.id)||slots.includes('plasma'))));
 const ship=choose(['hull','shield','engine'],upgrades.filter(s=>s.canBuy));
 const pilot=choose(['magnet','mining','extractor','radar'],(state.pilotSkills||[]).filter(s=>
  (ranks[s.id]||0)<s.max&&level>=s.from&&(!s.requires||ranks[s.requires])));
 const mounted=slots.find(id=>['plasma','rail','flak','rocket'].includes(id))||'plasma';
 return [
  weapon&&{intent:'Сильнее атаковать',category:'weapons',focus:weapon.id==='rocket'?'rocket':
   ['range','double'].includes(weapon.id)?'plasma':mounted,
   upgrade:weapon.id,skill:weapon.title,effect:weapon.effect},
  ship&&{intent:'Дольше выживать',category:'ship',focus:ship.id,upgrade:ship.id,skill:ship.title,effect:ship.effect},
  pilot&&{intent:'Быстрее добывать',category:'pilot',focus:pilot.id,upgrade:pilot.id,skill:pilot.title,
   effect:state.nextSkillEffect?.(pilot.id,ranks[pilot.id]||0,ranks)||pilot.desc}
 ].filter(Boolean);
}

// Every shortcut opens the same cards and transactions as this page. The
// navigation never grants an unlock, spends currency or resets a loadout draft.
export function renderDevelopmentPanel(state){
 const category=developmentTab(state.developmentCategory);
 const points=state.points||0,level=state.level||1;
 const xp=Math.max(0,Math.floor(state.xp||0)),nextXp=Math.max(1,state.nextXp||1);
 const ledger=developmentPointLedger(state);
 const purchased=Object.entries(state.skillRanks||{}).filter(([,rank])=>rank>0).map(([id,rank])=>
  [state.pilotSkills?.find(s=>s.id===id)?.title||id,rank]);
 for(const [id,branch] of Object.entries(state.tactical?.branches||{}))if(branch?.rank>0)
  purchased.push(['Устройство: '+(TACTICAL_DEVICES[id]?.short||id),branch.rank]);
 const weaponNames={plasma:'Плазменное орудие',rail:'Рельсовое орудие',flak:'Перехватчик',rocket:'Ракетный модуль'};
 for(const [id,branch] of Object.entries(state.loadout?.specializations||{}))if(branch?.rank>0)
  purchased.push(['Оружие: '+(weaponNames[id]||id),branch.rank]);
 if(state.doctrine)purchased.push(['Доктрина: '+(state.pilotDoctrines?.find(d=>d.id===state.doctrine)?.title||state.doctrine),1]);
 const history=purchased.length?'<details class="dev-points-history"><summary>Куда потрачены '+ledger.spent+' '+pointsWord(ledger.spent)+'</summary><ul>'+
  purchased.map(([name,rank])=>'<li>'+esc(name)+' · '+rank+' '+pointsWord(rank)+'</li>').join('')+'</ul></details>':'';
 const choices=points?availableDevelopmentChoices(state):[];
 const navigation='<nav class="development-tabs" aria-label="Виды развития">'+DEVELOPMENT_TABS.map(([id,label,icon])=>
  '<button type="button" data-act="developmentTab" data-id="'+id+'" aria-pressed="'+(id===category)+'" tabindex="'+(id===category?0:-1)+'"'+
  (id===category?' class="selected"':'')+'>'+menuIcon(icon)+label+'</button>').join('')+'</nav>';
 let content;
 if(category==='pilot')content=renderPilotContent({
  player:{level:state.level||1,points:state.points||0,xp:state.xp||0},
  ranks:state.skillRanks||{},doctrine:state.doctrine,skills:state.pilotSkills||[],
  doctrines:state.pilotDoctrines||[],nextEffect:state.nextSkillEffect||(()=>''),allBranches:true
 });
 else content=renderShipHangar({...state,developmentCategory:category,developmentMode:true});
 return '<section class="development-panel" aria-label="Развитие">'+
  '<header class="development-heading"><div><span class="base-kicker">СИСТЕМА РАЗВИТИЯ</span><h2>Развитие</h2></div>'+
  '<p>Пилот · ур. '+level+' <b class="dev-points-badge'+(points?' has-points':'')+'">'+points+' '+pointsWord(points)+'</b></p></header>'+
  '<div class="dev-xp-status" role="group" aria-label="Прогресс пилота"><div><strong>Опыт: '+xp+' / '+nextXp+'</strong><span>До уровня '+(level+1)+' осталось '+Math.max(0,nextXp-xp)+' опыта</span></div>'+
  '<progress value="'+Math.min(xp,nextXp)+'" max="'+nextXp+'" aria-label="Опыт до следующего уровня"></progress><small>Очки: '+ledger.earned+' получено за уровни · '+ledger.spent+' потрачено на известные улучшения · '+ledger.free+' свободно. '+
  (ledger.unaccounted?'Часть расходов в сохранении не удалось восстановить. ':'')+'Новый уровень даст ещё одно очко.</small>'+history+'</div>'+navigation+
  '<details class="dev-onboarding"><summary>Как потратить очки'+(points?' · доступно '+points:'')+'</summary><div class="dev-onboarding-message"><strong>'+
  (points?'У вас '+points+' '+pointsWord(points)+' развития':'Свободных очков пока нет')+'</strong><span>'+
  (points?(choices.length?'Ниже — доступные сейчас варианты под разные стили игры. Выберите цель, затем улучшение.':'Пока нет улучшений, доступных по условиям. Очки сохранятся.'):
   'Новый уровень принесёт ещё одно очко. Золотые ступени на схемах уже изучены.')+
   '</span></div>'+
  (choices.length?'<div class="dev-available-choices" role="group" aria-label="Что можно улучшить за очко">'+choices.map(c=>
   '<button type="button" data-act="openDevelopment" data-id="'+c.category+'" data-focus="'+c.focus+'" data-upgrade="'+c.upgrade+'" class="dev-choice" title="'+esc(c.effect||c.skill)+'">'+
   '<strong>'+esc(c.intent)+'</strong><span>'+esc(c.skill)+'</span><span class="dev-choice-effect">'+esc(c.effect||'')+'</span><small>Перейти к улучшению →</small></button>').join('')+'</div>':'')+'</details>'+
  '<div class="dev-tree-legend" aria-label="Обозначения на схеме"><span class="ready">Открыто по условиям</span><span class="mastered">Уже изучено</span><span class="locked">Пока закрыто</span></div>'+
  '<div class="development-content" data-development="'+category+'">'+content+'</div>'+
  (['pilot','station'].includes(category)&&state.hangarSession?.message?'<p class="hg-message" role="status" aria-live="polite">'+
   state.hangarSession.message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p>':'')+'</section>';
}
