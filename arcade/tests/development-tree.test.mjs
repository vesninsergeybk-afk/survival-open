import test from 'node:test';
import assert from 'node:assert/strict';
import {availableDevelopmentChoices,renderDevelopmentPanel} from '../development-panel.js';
import {renderShipHangar} from '../hangar-panel.js';
import {renderPilotContent} from '../pilot-menu.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';
import {game} from './weapons-scene.mjs';

const upgrades=[
 {id:'beam',title:'Калибровка орудий',rank:1,max:5,from:2,canBuy:true,reason:'Изучить · 1 очко',effect:'Урон ×1,2 → ×1,4',desc:'Общее усиление'},
 {id:'double',title:'Разделение луча',rank:0,max:2,from:4,requires:'beam',canBuy:true,reason:'Изучить · 1 очко',effect:'Две цели',desc:'Для плазмы'},
 {id:'range',title:'Фокусировка',rank:0,max:3,from:3,canBuy:false,reason:'Нужно очко развития',effect:'Дальность +56',desc:'Для луча'},
 {id:'rocket',title:'Авторакеты',rank:0,max:3,from:5,canBuy:true,reason:'Изучить · 1 очко',effect:'Ракетный модуль',desc:'Открывает ракеты'},
 {id:'hull',title:'Укрепление корпуса',rank:1,max:5,from:2,canBuy:false,reason:'Нужно очко развития',effect:'Прочность +22',desc:'Корпус'},
 {id:'shield',title:'Энергощит',rank:0,max:3,from:4,requires:'hull',canBuy:false,reason:'Нужно очко развития',effect:'Щит 40',desc:'Защита'},
 {id:'engine',title:'Импульсный форсаж',rank:0,max:4,from:2,canBuy:false,reason:'Нужно очко развития',effect:'Скорость +35',desc:'Рывок'}
];
function state(extra={}){
 const loadout=createLoadout(),hangarSession=new HangarSession();hangarSession.begin(loadout);
 return {loadout,hangarSession,hangarUpgrades:upgrades,tactical:createTactical(),level:8,
  points:1,ore:150,activeBases:3,baseActive:true,skillRanks:{beam:1,hull:1},...extra};
}

test('development entry identifies points and offers direct playstyle routes',()=>{
 const s=state({hangarUpgrades:upgrades.map(s=>['hull','magnet'].includes(s.id)?{...s,canBuy:true}:s),
  pilotSkills:[{id:'magnet',title:'Магнитный захват',from:2,max:3,branch:'Добыча',desc:'Притяжение трофеев'}],
  nextSkillEffect:()=>'+55 м'});
 const html=renderDevelopmentPanel({...s,developmentCategory:'weapons'});
 assert.match(html,/1 очко/);
 assert.match(html,/Сильнее атаковать/);
 assert.match(html,/Дольше выживать/);
 assert.match(html,/Быстрее добывать/);
 assert.match(html,/data-id="weapons" data-focus="plasma" data-upgrade="beam"/);
 assert.match(html,/data-id="ship" data-focus="hull" data-upgrade="hull"/);
 assert.match(html,/data-id="pilot" data-focus="magnet" data-upgrade="magnet"/);
 assert.match(html,/class="dev-choice-effect">\+55 м/);
 assert.equal((html.match(/data-act="developmentTab"/g)||[]).length,5);
 const noPoints=renderDevelopmentPanel({...s,points:0,developmentCategory:'weapons'});
 assert.match(noPoints,/Свободных очков пока нет/);
 assert.doesNotMatch(noPoints,/Сильнее атаковать/);
});

test('quick recommendations only include actually buyable skills and never promise a blocked option',()=>{
 const s=state({pilotSkills:[
  {id:'magnet',title:'Магнитный захват',from:2,max:3,branch:'Добыча',desc:'Добыча'},
  {id:'mining',title:'Геологическая подготовка',from:2,max:4,requires:'extractor',branch:'Добыча',desc:'Добыча'}
 ],skillRanks:{beam:1,hull:1,magnet:3}});
 const choices=availableDevelopmentChoices(s);
 assert.deepEqual(choices.map(c=>c.category),['weapons']);
 assert.equal(choices[0].upgrade,'beam');
 assert.equal(availableDevelopmentChoices({...s,hangarUpgrades:upgrades.map(u=>({...u,canBuy:false}))}).length,0);
 const launcher=availableDevelopmentChoices({...s,hangarUpgrades:upgrades.map(u=>({...u,canBuy:u.id==='rocket'}))});
 assert.equal(launcher[0].focus,'rocket','a rocket prerequisite must lead to the module unlocking path');
 const railOnly={...createLoadout(),slots:['rail',null,null,null,null,null]};
 const plasmaOnly={...createLoadout(),slots:['plasma',null,null,null,null,null]};
 const splitUpgrades=upgrades.map(u=>({...u,canBuy:['range','double'].includes(u.id)}));
 assert.equal(availableDevelopmentChoices({...s,loadout:railOnly,hangarUpgrades:splitUpgrades}).length,0,
  'never recommend plasma-only upgrades when the current ship has no plasma');
 const split=availableDevelopmentChoices({...s,loadout:plasmaOnly,hangarUpgrades:splitUpgrades});
 assert.equal(split[0].focus,'plasma');assert.equal(split[0].upgrade,'range');
});

test('a quick recommendation focuses the exact purchasable node, without spending points',()=>{
 const g=game();g.player.points=2;
 const calls=[];
 const node={setAttribute:(...args)=>calls.push(['tabindex',...args]),
  scrollIntoView:()=>calls.push(['scroll']),focus:()=>calls.push(['focus'])};
 let disabled=false;
 g.overlay.querySelector=selector=>{
  if(selector.includes('data-act="hgUpgrade"')&&selector.includes('data-id="beam"'))
   return {disabled,closest:()=>node};
  return null;
 };
 g.openDevelopment('weapons','plasma','beam');
 assert.equal(g.baseTab,'development');
 assert.deepEqual(calls.map(v=>v[0]),['tabindex','scroll','focus']);
 assert.equal(g.player.points,2);
 calls.length=0;disabled=true;
 g.openDevelopment('weapons','plasma','beam');
 assert.deepEqual(calls,[],'a skill that became unavailable must never be focused as a recommendation');
});

test('weapon tree shows true prerequisite chain and selected two-path specialization',()=>{
 const s=state({developmentMode:true,developmentCategory:'weapons'});
 const html=renderShipHangar(s);
 assert.match(html,/dev-tech-chain/);
 assert.match(html,/Открытие нового оружия/);
 assert.match(html,/data-act="hgUpgrade" data-id="rocket"/);
 assert.match(html,/После «Калибровка орудий»/);
 assert.match(html,/data-act="hgUpgrade" data-id="double"/);
 assert.match(html,/data-act="hgSpec" data-id="plasma:furnace"/);
 assert.match(html,/data-act="hgSpec" data-id="plasma:focus"/);
 assert.match(html,/Изучено 1 из 5/);
 s.loadout.specializations.plasma={path:'focus',rank:1};
 const chosen=renderShipHangar(s);
 assert.match(chosen,/data-state="exclusive"/);
 assert.match(chosen,/Другой путь выбран/);
 assert.match(chosen,/Изучено 1 из 2/);
});

test('selection of an unmounted weapon never shows purchasable upgrades or changes loadout',()=>{
 const s=state({developmentMode:true,developmentCategory:'weapons'}),snapshot=JSON.stringify(s.loadout);
 s.hangarSession.focusWeapon='ion';
 const html=renderShipHangar(s);
 assert.match(html,/Это оружие ещё не установлено/);
 assert.match(html,/data-act="fitWeapon" data-id="ion"/);
 assert.match(html,/Условие установки: Прокат/);
 assert.doesNotMatch(html,/data-act="hgUpgrade" data-id="beam"|data-act="hgSpec"/);
 assert.equal(JSON.stringify(s.loadout),snapshot);
});

test('unmounted rockets are still unlockable through the prerequisite technology',()=>{
 const s=state({developmentMode:true,developmentCategory:'weapons'});
 s.hangarSession.focusWeapon='rocket';
 const html=renderShipHangar(s);
 assert.match(html,/Это оружие ещё не установлено/);
 assert.match(html,/Изучите «Авторакеты»/);
 assert.match(html,/data-act="openDevelopment" data-id="weapons" data-focus="rocket" data-upgrade="rocket"/);
 assert.doesNotMatch(html,/data-act="fitWeapon" data-id="rocket"/,'do not send the player to fitting before the prerequisite tech');
 assert.match(html,/data-act="hgUpgrade" data-id="rocket"/);
 assert.doesNotMatch(html,/data-act="hgUpgrade" data-id="beam"/);
 assert.doesNotMatch(html,/data-act="hgSpec"/);
});

test('ship screen keeps the hull→shield prerequisite and distinguishes alloy spending',()=>{
 const html=renderShipHangar(state({developmentMode:true,developmentCategory:'ship'}));
 assert.match(html,/dev-ship-linked/);
 assert.match(html,/чтобы открыть щит, сначала улучшите корпус/);
 assert.match(html,/data-act="hgUpgrade" data-id="shield"/);
 assert.match(html,/Оружейные узлы/);
 assert.match(html,/сплава/);
});

test('pilot shows all unlocked-by-level skills even when no point is currently available',()=>{
 const skills=[
  {id:'dodge',branch:'Корабль',title:'Уклонение',from:3,max:3,desc:'Рывок'},
  {id:'magnet',branch:'Добыча',title:'Магнитный захват',from:2,max:3,desc:'Сбор'},
  {id:'mining',branch:'Добыча',title:'Геологическая подготовка',from:2,max:4,desc:'Добыча'},
  {id:'extractor',branch:'Добыча',title:'Дуговой экстрактор',from:3,max:3,requires:'mining',desc:'Разряд'},
  {id:'radar',branch:'Технологии',title:'Радар',from:3,max:2,desc:'Карта'}
 ];
 const html=renderPilotContent({player:{level:8,points:0},ranks:{mining:0},skills,doctrines:[],nextEffect:()=>'+1',allBranches:true});
 assert.match(html,/data-state="waiting"/);
 assert.match(html,/После «Геологическая подготовка»/);
 for(const name of ['Уклонение','Магнитный захват','Геологическая подготовка','Дуговой экстрактор','Радар'])
  assert.match(html,new RegExp(name));
 assert.equal((html.match(/data-act="skill"/g)||[]).length,5);
 assert.doesNotMatch(html,/<details class="pilot-future"/);
 assert.equal((html.match(/data-act="focusPilotBranch"/g)||[]).length,3);
 assert.doesNotMatch(html,/dev-pilot-ready-list/,'no point must not imply a purchasable skill');
 const ready=renderPilotContent({player:{level:8,points:1},ranks:{mining:0},skills,doctrines:[],nextEffect:()=>'+1',allBranches:true});
 assert.match(ready,/dev-pilot-ready-list/);
 assert.match(ready,/data-act="openDevelopment" data-id="pilot" data-focus="magnet" data-upgrade="magnet"/);
});

test('installation shortcut enters a real fitting without manufacturing the weapon',()=>{
 const g=game();g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 g.player.level=8;g.player.ore=120;g.docked.active=true;g.overlay.hidden=false;
 const before=JSON.stringify(g.shipLoadout),ore=g.player.ore;
 g.focusFittingWeapon('rail');
 assert.equal(g.baseTab,'hangar');
 assert.equal(g.hangarView,'weapons');
 assert.equal(g.hangarSession.focusWeapon,'rail');
 assert.equal(g.hangarSession.catalog,true);
 assert.equal(JSON.stringify(g.shipLoadout),before);
 assert.equal(g.player.ore,ore);
});
