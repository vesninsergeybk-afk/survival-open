import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBasePanel} from '../base-panel.js';
import {createLoadout} from '../ship-loadout.js';

const home={id:'0:0',x:360,y:-85,type:'dock',active:true,discovered:true};
const lab={id:'1:0',x:1500,y:0,type:'lab',active:true,discovered:true};
const world={home,stations:new Map([[home.id,home],[lab.id,lab]]),
 networkTopology:()=>({linked:new Set([home.id,lab.id]),count:2,links:[]}),
 nearbyRocks:()=>[],nearbyStations:()=>[]};
const state=(extra={})=>({ore:60,data:0,hp:110,maxHp:110,shield:0,allies:0,
 activeBases:2,connectedBases:2,connected:true,droneRoles:[],droneDamage:0,charges:0,
 network:{armor:0,engine:0,armament:0,strikePower:0},transfers:[],
 world,loadout:createLoadout(),skillRanks:{},level:1,points:0,baseTab:'summary',
 contract:null,operation:null,firstHardwareReward:null,time:30,...extra});
const mission={baseId:home.id,kind:'kill',goal:4,progress:4,choiceId:'standard',
 name:'Зачистка патрулей',ore:16,data:15};
const visiblePanel=html=>html.slice(html.indexOf('<section class="base-tab-panel" id="base-panel-summary"'),
 html.indexOf('<section class="base-tab-panel" id="base-panel-operations"'));

test('completed contract at its origin offers a direct, prominent reward action',()=>{
 const html=renderBasePanel(home,state({contract:mission}));
 const summary=visiblePanel(html);
 assert.match(summary,/ЧТО СЕЙЧАС ВАЖНО/);
 assert.match(summary,/Заказ выполнен — заберите награду/);
 assert.match(summary,/\+16 сплава, \+15 данных и \+15 опыта/);
 assert.match(summary,/\+15 опыта/);
 assert.match(summary,/data-act="claimContract">Забрать награду/);
 assert.ok(summary.indexOf('data-act="claimContract"')<summary.indexOf('base-quick-services'));
 assert.doesNotMatch(summary,/base-featured-op/,'detailed special mission must not obscure the reward');
});

test('both offered and completed contracts disclose the full experience reward',()=>{
 const available=renderBasePanel(home,state({baseTab:'operations'}));
 assert.match(available,/Награда: 16 сплава · 15 данных · 15 опыта/);
 assert.match(available,/Награда: 10 сплава · 24 данных · 24 опыта/);
 const ready=renderBasePanel(home,state({baseTab:'operations',contract:mission}));
 assert.match(ready,/Награда: 16 сплава · 15 данных · 15 опыта/);
});

test('a different station cannot grant the reward and explains where to return',()=>{
 const html=renderBasePanel(lab,state({contract:mission}));
 const summary=visiblePanel(html);
 assert.match(summary,/Награда ждёт на другой станции/);
 assert.match(summary,/Вернитесь на Ремонтный док/);
 assert.match(summary,/data-act="baseMap">Показать станцию на карте/);
 assert.doesNotMatch(summary,/data-act="claimContract"/);
 assert.match(html,/УЖЕ ЕСТЬ ЗАКАЗ/);
 assert.match(html,/Зачистка патрулей/);
});

test('claiming a completed contract stays more important than an unchosen earlier weapon reward',()=>{
 const local=visiblePanel(renderBasePanel(home,state({contract:mission,firstHardwareReward:'pending'})));
 assert.match(local,/data-act="claimContract">Забрать награду/);
 assert.doesNotMatch(local,/ЧТО СЕЙЧАС ВАЖНО[\s\S]*?Вы получили новое оружие/);
 const remote=visiblePanel(renderBasePanel(lab,state({contract:mission,firstHardwareReward:'pending'})));
 assert.match(remote,/Награда ждёт на другой станции/);
 assert.doesNotMatch(remote,/data-act="claimContract"/);
});

test('an active contract displays real progress instead of a disabled action and hides abandonment behind a warning',()=>{
 const html=renderBasePanel(home,state({baseTab:'operations',contract:{...mission,progress:2}}));
 const tasks=html.slice(html.indexOf('id="base-panel-operations"'),html.indexOf('id="base-panel-hangar"'));
 assert.match(tasks,/class="base-contract-progress" role="status"/);
 assert.match(tasks,/В работе · 2 из 4/);
 assert.match(tasks,/<progress value="2" max="4" aria-label="Выполнение полевого заказа"/);
 assert.doesNotMatch(tasks,/data-act="acceptContract"[^>]+disabled[^>]*>Выполняется/);
 assert.match(tasks,/<details class="base-contract-abandon"><summary>Отказаться от заказа<\/summary>/);
 assert.match(tasks,/Текущий прогресс будет потерян/);
 assert.match(tasks,/data-act="abandonContract">Подтвердить отказ/);
});

test('first weapon award has one clear continuation and three real choices',()=>{
 const html=renderBasePanel(home,state({firstHardwareReward:'pending'}));
 const summary=visiblePanel(html);
 assert.match(summary,/Вы получили новое оружие/);
 assert.match(summary,/data-act="baseTab" data-role="operations">Выбрать оружие/);
 assert.doesNotMatch(summary,/claimFirstModule/);
 assert.equal((html.match(/data-act="claimFirstModule"/g)||[]).length,3);
 const result=renderBasePanel(home,state({firstHardwareReward:'rail',
  lastContractReceipt:{ore:16,data:15,firstHardwareReward:'rail'}}));
 assert.match(visiblePanel(result),/Оружие получено/);
 assert.match(visiblePanel(result),/Модуль на складе/);
 const repeated=renderBasePanel(home,state({firstHardwareReward:'plasma',
  lastContractReceipt:{ore:16,data:15,firstHardwareReward:'plasma',firstHardwareInstalled:false}}));
 assert.match(visiblePanel(repeated),/Модуль на складе/,
  'the starter plasma already on the ship must not be mistaken for the awarded copy');
});

test('maintenance is accessible on the home screen; statistics stay optional',()=>{
 const html=renderBasePanel(home,state({hp:70,droneDamage:20,
  sortieReports:[{seconds:80,ore:10,data:4,hull:-10,levels:0}],
  economyExpenses:{weapons:0,drones:0,repairs:0,stations:0,services:0,travel:0}}));
 const summary=visiblePanel(html);
 assert.match(summary,/data-act="repair">Починить · 15 сплава/);
 assert.match(summary,/data-act="repairDrones">Ремонт дронов · 8 сплава/);
 assert.match(summary,/<details class="base-secondary-info base-report-details"><summary>Итоги последнего вылета/);
 assert.doesNotMatch(summary,/<details class="base-secondary-info base-report-details" open/);
});

test('regular jobs are visible before long optional mission description',()=>{
 const html=renderBasePanel(home,state({baseTab:'operations'}));
 assert.match(html,/<details class="base-mission-details"><summary>Особая операция/);
 assert.match(html,/<h3 class="base-section-title">Полевые заказы<\/h3>/);
 assert.match(html,/data-act="acceptContract"/);
 assert.match(html,/data-act="showFieldTrial"/,'the starter weapon trial stays discoverable');
 assert.match(html,/role="tab"[^>]*>Задания<\/button>/);
});

test('an active special mission from another station points back to the map',()=>{
 const operation={id:'silent-corridor',baseId:home.id,kind:'corridor',phase:'attack',x:1300,y:80};
 const html=renderBasePanel(lab,state({operation}));
 const summary=visiblePanel(html);
 assert.match(summary,/Вы приняли операцию на другой станции/);
 assert.match(summary,/data-act="baseMap">Показать цель на карте/);
 assert.doesNotMatch(summary,/data-act="acceptOperation"/);
});

test('unspent pilot points are actionable inside a dock, even after a level-up at claim',()=>{
 const html=renderBasePanel(home,state({level:2,points:1,xp:0,nextXp:68,
  lastContractReceipt:{ore:16,data:15,levelsGained:1}}));
 assert.match(html,/class="base-pilot-progress" role="status"/);
 assert.match(html,/ПИЛОТ · УР. 2/);
 assert.match(html,/Новый уровень! · 1 очко развития/);
 assert.match(html,/data-act="pilotSkills">Выбрать навык/);
 assert.doesNotMatch(html,/Данные <b>0<\/b> \(опыт\)/);
 const spent=renderBasePanel(home,state({level:2,points:0,xp:0,nextXp:68}));
 assert.doesNotMatch(spent,/class="base-pilot-progress"/);
});
