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

test('ship fitting opens with a ship and one clear action, not a catalogue or stat inspector',()=>{
 const loadout=createLoadout(),session=new HangarSession();session.begin(loadout);
 const html=renderShipHangar({...state(),hangarSession:session},session);
 assert.match(html,/class="hg-layout hg-layout-centered"/);
 assert.match(html,/Нажмите на узел, чтобы выбрать для него оружие/);
 assert.match(html,/data-act="hgSlot" data-id="1"/);
 assert.match(html,/Текущее вооружение установлено/);
 assert.doesNotMatch(html,/class="hg-arsenal"|class="hg-inspector"/);
 assert.doesNotMatch(html,/data-act="hgApply"/);
 assert.match(html,/<details class="hg-combat-details"><summary>Урон, нагрев/);
 assert.match(html,/<details class="hg-more-frames"><summary>Развитие корпуса/);
});

test('selecting a node reveals available modules before locked future ones; choosing a module reveals its details',()=>{
 const loadout=createLoadout(),session=new HangarSession(),ctx={...state({ore:100}),loadout};
 session.begin(loadout);
 session.dispatch({act:'hgSlot',id:'1'},ctx);
 let html=renderShipHangar({...ctx,hangarSession:session},session);
 assert.match(html,/hg-layout-editing/);
 assert.match(html,/class="hg-arsenal"/);
 assert.doesNotMatch(html,/class="hg-inspector"/);
 assert.match(html,/Пока недоступно ·/);
 assert.ok(html.indexOf('data-act="hgSelect" data-id="plasma"')<html.indexOf('hg-future-weapons'));
 session.dispatch({act:'hgSelect',id:'plasma'},ctx);
 html=renderShipHangar({...ctx,hangarSession:session},session);
 assert.match(html,/class="hg-inspector"/);
 assert.match(html,/<details class="hg-stat-details"><summary>Подробные характеристики/);
 session.dispatch({act:'hgInstall'},ctx);
 html=renderShipHangar({...ctx,hangarSession:session},session);
 assert.match(html,/Предварительная сборка/);
 assert.match(html,/data-act="hgApply"/);
 assert.doesNotMatch(html,/class="hg-arsenal"/);
});

test('a closed hardpoint explains its lock instead of opening an unusable weapon picker',()=>{
 const loadout=createLoadout(),session=new HangarSession(),ctx={...state(),loadout};
 session.begin(loadout);
 session.dispatch({act:'hgSlot',id:'2'},ctx);
 const html=renderShipHangar({...ctx,hangarSession:session},session);
 assert.match(html,/Узел 3 ещё закрыт/);
 assert.match(html,/Развитие корпуса/);
 assert.match(html,/hg-layout-centered/);
 assert.doesNotMatch(html,/class="hg-arsenal"/);
});

test('free field trial is selected directly from the station, without searching the hangar',()=>{
 const closed=panel(renderBasePanel(home,state()),'summary');
 assert.match(closed,/data-act="showFieldTrial">Выбрать пробное оружие/);
 assert.doesNotMatch(closed,/data-act="loanField"/);
 const opened=panel(renderBasePanel(home,state({fieldTrialPickerOpen:true})),'summary');
 assert.match(opened,/Выберите одно пробное оружие/);
 assert.match(opened,/data-act="loanField" data-role="ion">Выбрать ионный/);
 assert.match(opened,/data-act="loanField" data-role="resonator">Выбрать резонатор/);
 assert.match(opened,/там останется применить сборку/);
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/this\.fieldTrialPickerOpen=!this\.fieldTrialPickerOpen/);
 assert.match(game,/this\.fieldTrialPickerOpen=false;\s*this\.baseTab='hangar'/);
});

test('station network shows its current protection, but folds away advanced calculations and future prices',()=>{
 const html=renderBasePanel(home,state({baseTab:'network'}));
 const network=html.slice(html.indexOf('id="base-panel-network"'));
 assert.match(network,/ОБОРОНА СТАНЦИИ/);
 assert.match(network,/Защитные заряды · 1\/1/);
 assert.match(network,/Если пропускать орбитальные удары, они смогут поражать врагов/);
 assert.match(network,/<details class="base-secondary-info base-defense-rules"><summary>Точные условия ПВО и стазиса/);
 assert.match(network,/<details class="base-secondary-info base-network-future"><summary>Следующие улучшения/);
 assert.match(network,/<details class="base-secondary-info base-network-advanced"><summary>Карта связи/);
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
