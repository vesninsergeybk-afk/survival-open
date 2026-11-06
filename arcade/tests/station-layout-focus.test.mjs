import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderBasePanel} from '../base-panel.js';
import {renderShipHangar} from '../hangar-panel.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';

const home={id:'0:0',x:360,y:-85,type:'dock',active:true,discovered:true};
const world={home,stations:new Map([[home.id,home]]),
 networkTopology:()=>({linked:new Set([home.id]),count:1,links:[]}),
 nearbyRocks:()=>[],nearbyStations:()=>[]};
const state=(extra={})=>({ore:20,data:0,hp:110,maxHp:110,shield:0,allies:0,
 activeBases:1,connectedBases:1,connected:true,droneRoles:[],droneDamage:0,charges:0,
 network:{armor:0,engine:0,armament:0,strikePower:0},transfers:[],world,
 loadout:createLoadout(),skillRanks:{},level:1,points:0,baseTab:'summary',
 contract:null,operation:null,firstHardwareReward:null,time:30,...extra});
const panel=(html,id)=>html.slice(html.indexOf('id="base-panel-'+id+'"'),
 html.indexOf('id="base-panel-'+({summary:'operations',operations:'hangar',hangar:'network'}[id]||'missing')+'"'));

test('ship fitting opens with the ship and a directly accessible weapon development panel',()=>{
 const loadout=createLoadout(),session=new HangarSession();session.begin(loadout);
 const html=renderShipHangar({...state(),hangarSession:session},session);
 assert.match(html,/class="hg-layout hg-layout-centered"/);
 assert.match(html,/Нажмите на узел, чтобы выбрать для него оружие/);
 assert.match(html,/data-act="hgSlot" data-id="1"/);
 assert.match(html,/Текущее вооружение установлено/);
 assert.doesNotMatch(html,/class="hg-arsenal"/);
 assert.match(html,/class="hg-weapon-inspector"/);
 assert.match(html,/data-act="openDevelopment" data-id="weapons" data-focus="plasma"/);
 assert.doesNotMatch(html,/data-act="hgUpgrade"|data-act="hgSpec"/);
 assert.doesNotMatch(html,/data-act="hgApply"/);
 assert.match(html,/<details class="hg-combat-details"><summary>Урон, нагрев/);
 assert.doesNotMatch(html,/<details class="hg-more-frames">/);
});

test('selecting a node offers one-click installation and on-demand descriptions',()=>{
 const loadout=createLoadout(),session=new HangarSession(),ctx={...state({ore:100}),loadout,baseActive:true};
 session.begin(loadout);session.dispatch({act:'hgSlot',id:'1'},ctx);
 let html=renderShipHangar({...ctx,hangarSession:session},session);
 assert.match(html,/hg-layout-editing/);assert.match(html,/class="hg-arsenal"/);
 assert.match(html,/aria-label="Установка выбранного оружия"/);
 assert.equal((html.match(/data-act="hgEquip"/g)||[]).length,1);
 assert.match(html,/data-help-only/);assert.doesNotMatch(html,/class="hg-inspector"/);
 const result=session.dispatch({act:'hgEquip',id:'plasma'},ctx);
 assert.equal(result.loadout.slots[1],'plasma');assert.equal(result.ore,76);
 html=renderShipHangar({...ctx,loadout:result.loadout,ore:result.ore,hangarSession:session},session);
 assert.doesNotMatch(html,/data-act="hgApply"/);assert.doesNotMatch(html,/class="hg-arsenal"/);
});

test('a closed hardpoint explains its lock instead of opening an unusable weapon picker',()=>{
 const loadout=createLoadout(),session=new HangarSession(),ctx={...state(),loadout};
 session.begin(loadout);
 session.dispatch({act:'hgSlot',id:'2'},ctx);
 const html=renderShipHangar({...ctx,hangarSession:session},session);
 assert.match(html,/Узел 3 ещё закрыт/);
 assert.match(html,/Условия открытия/);
 assert.match(html,/hg-layout-centered/);
 assert.doesNotMatch(html,/class="hg-arsenal"/);
});

test('free field trial is selected directly from the station, without searching the hangar',()=>{
 const closed=panel(renderBasePanel(home,state()),'summary');
 assert.match(closed,/data-act="showFieldTrial">Полевой модуль · бесплатно/);
 assert.doesNotMatch(closed,/data-act="loanField"/);
 const opened=panel(renderBasePanel(home,state({fieldTrialPickerOpen:true})),'summary');
 assert.match(opened,/Выберите один полевой модуль/);
 assert.match(opened,/data-act="loanField" data-role="ion">Выбрать ионный/);
 assert.match(opened,/data-act="loanField" data-role="resonator">Выбрать резонатор/);
 assert.match(opened,/модуль установится сразу/);
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/this\.fieldTrialPickerOpen=!this\.fieldTrialPickerOpen/);
 assert.match(game,/this\.fieldTrialPickerOpen=false;\s*this\.baseTab='hangar'/);
});

test('station network exposes territory and development before defence, with optional radio calculations',()=>{
 const html=renderBasePanel(home,state({baseTab:'network'}));
 const network=html.slice(html.indexOf('id="base-panel-network"'));
 assert.match(network,/ОБОРОНА СТАНЦИИ/);
 assert.match(network,/Защитные заряды · 1\/1/);
 assert.match(network,/Если пропускать орбитальные удары, они смогут поражать врагов/);
 assert.match(network,/<details class="base-secondary-info base-defense-rules"><summary>Точные условия ПВО и стазиса/);
 const growth=renderBasePanel(home,state({baseTab:'network'}));
 assert.match(growth,/<div class="base-network-future"><h4>Следующие улучшения/);
 assert.match(network,/<details class="base-secondary-info base-network-advanced"[^>]*><summary>Радиосвязь услуг/);
 assert.ok(network.indexOf('Связь и территория')<network.indexOf('Технология всего флота'));
 assert.ok(network.indexOf('Технология всего флота')<network.indexOf('ОБОРОНА СТАНЦИИ'));
 assert.match(network,/data-act="toggleMeteorDefense"/);
 const withoutInterception=renderBasePanel({...home,defense:{charges:1,meteorEnabled:false}},state({baseTab:'network'}));
 assert.match(withoutInterception,/Перехват отключён: орбитальные удары могут поражать врагов, астероиды и Ваш корабль/);
 assert.match(withoutInterception,/data-act="toggleMeteorDefense">Перехватывать орбитальные удары/);
});

test('station navigation is named for the place it manages and has no duplicate footer instructions',()=>{
 const html=renderBasePanel(home,state());
 assert.match(html,/data-role="network"[^>]*>Станция<\/button>/);
 assert.match(html,/data-role="hangar"[^>]*>Корабль<\/button>/);
 assert.doesNotMatch(html,/Задания, корабль и улучшения доступны в разделах выше/);
});

test('station section changes keep the same top and desktop width instead of recentering the whole menu',()=>{
 const css=readFileSync(new URL('../menu-system.css',import.meta.url),'utf8');
 assert.match(css,/#overlay:has\(\.base-dialog \.base-tabs\)\{align-items:flex-start\}/);
 assert.match(css,/width:min\(calc\(100vw - 36px\),1160px\)/);
 assert.match(css,/max-height:calc\(100dvh - 36px\)/);
});

test('accepted special operation does not claim a sortie has already begun',()=>{
 const operation={id:'silent-corridor',baseId:home.id,hp:150,phase:'attack'};
 const operations=panel(renderBasePanel(home,state({operation,baseTab:'operations'})),'operations');
 assert.match(operations,/ОПЕРАЦИЯ ПРИНЯТА/);
 assert.doesNotMatch(operations,/ВЫЛЕТ НАЧАТ/);
});

test('mission choices say what can be accepted and where the reward comes from',()=>{
 const operations=panel(renderBasePanel(home,state({baseTab:'operations'})),'operations');
 assert.match(operations,/Куда отправимся\?/);
 assert.match(operations,/aria-label="Особая операция"/);
 assert.match(operations,/Глухой коридор/);
 assert.match(operations,/Награда: 16 сплава · 15 данных/);
 assert.doesNotMatch(operations,/Небольшие заказы|ОСНОВНОЕ ПОРУЧЕНИЕ/);
});

test('empty weapon node explains how to get another gun without misleading stock counts',()=>{
 const loadout=createLoadout(),session=new HangarSession();
 session.begin(loadout);
 session.dispatch({act:'hgSlot',id:'1'},{...state({loadout}),baseActive:true});
 const html=renderShipHangar({...state({loadout,firstHardwareReward:null}),baseActive:true},session);
 assert.match(html,/На складе пока нет второго орудия/);
 assert.match(html,/После первого сданного полевого заказа/);
 assert.match(html,/Купить и установить · 24 сплава/);
 assert.doesNotMatch(html,/На складе: 0 · установлено: 1/);
});

test('advanced station risk decisions are behind an explicit disclosure',()=>{
 const network=renderBasePanel(home,state({baseTab:'network'})).split('id="base-panel-network"')[1];
 assert.match(network,/<details class="base-secondary-info base-defense-choice-details"><summary>Изменить перехват орбитальных ударов/);
 assert.match(network,/data-act="toggleMeteorDefense"/);
 assert.match(network,/ПВО действует автоматически/);
});

test('published module addresses invalidate the station and hangar caches',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const base=readFileSync(new URL('../base-panel.js',import.meta.url),'utf8');
 assert.match(html,/game\.js\?v=[^"]*station-clarity-1/);
 assert.match(game,/base-panel\.js\?v=[^']*station-clarity-1/);
 assert.match(base,/hangar-panel\.js\?v=[^']*station-clarity-1/);
});

test('an accepted special operation shows its status and route without an accordion',()=>{
 const operation={id:'silent-corridor',baseId:home.id,hp:150,phase:'attack'};
 const operations=panel(renderBasePanel(home,state({operation,baseTab:'operations'})),'operations');
 assert.match(operations,/Текущие задания/);
 assert.match(operations,/<section class="base-task-group special" aria-label="Особая операция">/);
 assert.match(operations,/Глухой коридор/);
 assert.match(operations,/ОПЕРАЦИЯ ПРИНЯТА/);
 assert.match(operations,/data-act="baseMap">Показать маршрут/);
 assert.doesNotMatch(operations,/class="base-mission-details"/);
});
