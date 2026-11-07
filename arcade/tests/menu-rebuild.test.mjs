import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBasePanel} from '../base-panel.js';
import {renderShipHangar} from '../hangar-panel.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';
import {renderWorldMap} from '../map-panel.js';
import {game} from './weapons-scene.mjs';

function station(extra={}){
 const g=game();g.baseTab='summary';g.hangarView='weapons';g.paused=true;g.overlay.hidden=false;
 g.player.level=1;g.player.points=0;g.player.ore=20;
 g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 return {g,base:g.docked,state:{...g.baseState(),...extra}};
}

test('the overview links to one mission board and keeps repair and hire directly available',()=>{
 const {g,base,state}=station({hp:100});
 const html=renderBasePanel(base,state);
 assert.match(html,/data-act="baseTab" data-role="operations">Посмотреть задания/);
 assert.doesNotMatch(html,/data-act="acceptOperation"|data-act="acceptContract"/);
 assert.match(html,/data-act="repair"/);assert.match(html,/data-act="hire"/);
 assert.match(html,/id="base-panel-operations"[^>]* hidden><\/section>/);
 g.baseTab='operations';g.paused=true;
 const missions=renderBasePanel(base,g.baseState());
 assert.equal((missions.match(/data-act="acceptOperation"/g)||[]).length,1);
 assert.match(missions,/data-act="acceptContract" data-role="standard"/);
 g.baseAction('acceptOperation','');
 assert.equal(g.baseTab,'operations');assert.ok(g.operation);
 const first=g.operation;g.baseAction('acceptOperation','');assert.equal(g.operation,first);
});

test('a ready reward and first weapon choice can both be completed from the home page',()=>{
 const {g,base}=station();g.baseTab='summary';g.paused=true;
 g.contract={baseId:base.id,choiceId:'standard',kind:'kill',name:'Зачистка патрулей',progress:4,goal:4,ore:16,data:15};
 assert.match(renderBasePanel(base,g.baseState()),/data-act="claimContract"/);
 const alloy=g.player.ore;g.baseAction('claimContract','');
 assert.equal(g.player.ore,alloy+16);assert.equal(g.baseTab,'summary');
 const once=g.player.ore;g.baseAction('claimContract','');assert.equal(g.player.ore,once);
 const html=renderBasePanel(base,g.baseState());
 assert.match(html,/data-act="claimFirstModule"/);assert.equal(g.firstHardwareReward,'pending');
 g.baseAction('claimFirstModule','rail');assert.equal(g.firstHardwareReward,'rail');
});

test('ship upgrades share one ship tab and pilot skills have their own tab',()=>{
 const {g,base}=station();
 for(const [category,view,content] of [['weapons','weapon-upgrades','Плазменный луч'],['ship','upgrades','Защита и двигатель'],['tactics','tactics','Инерционный импульс']]){
  g.openDevelopment(category);
  const state=g.baseState();
  assert.equal(state.baseTab,'hangar');assert.equal(state.hangarView,view);
  const html=renderBasePanel(base,state);
  assert.match(html,new RegExp('data-ship-view="'+view+'"'));
  assert.ok(html.includes(content),category);
  assert.match(html,/id="base-panel-development"[^>]* hidden><\/section>/);
 }
 g.openDevelopment('pilot');
 const pilot=renderBasePanel(base,g.baseState());
 assert.match(pilot,/data-development="pilot"/);
 assert.match(pilot,/Уклонение/);
 assert.doesNotMatch(pilot,/data-act="hgUpgrade"/);
});

test('opening development and an exact weapon preserves the entire pending design and resources',()=>{
 const {g}=station();g.overlay.hidden=false;g.paused=true;
 g.hangarSession.draft.slots[1]='rail';
 const draft=JSON.stringify(g.hangarSession.draft),alloy=g.player.ore,points=g.player.points;
 g.openDevelopment('weapons','rail');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarView,'weapon-upgrades');
 assert.equal(g.hangarSession.focusWeapon,'rail');
 g.openDevelopment('pilot');g.openDevelopment('tactics','decoy');
 assert.equal(g.hangarSession.focusTactic,'decoy');
 assert.equal(JSON.stringify(g.hangarSession.draft),draft);
 assert.equal(g.player.ore,alloy);assert.equal(g.player.points,points);
});

test('fitting and development show separate actions and only one no-spend explanation',()=>{
 const {state}=station(),session=new HangarSession();session.begin(state.loadout);
 session.dispatch({act:'hgSlot',id:'1'},state);
 const fitting=renderShipHangar(state,session);
 assert.match(fitting,/data-act="hgEquip"/);assert.doesNotMatch(fitting,/data-act="hgSpec"|data-act="hgUpgrade"/);
 assert.equal((fitting.match(/Просмотр не меняет оснащение и не тратит сплав/g)||[]).length,1);
 assert.match(fitting,/data-act="openDevelopment" data-id="weapons" data-focus="plasma"/);
 const growth=renderShipHangar({...state,developmentMode:true,developmentCategory:'weapons'},session);
 assert.match(growth,/data-act="hgSpec"/);assert.doesNotMatch(growth,/data-act="hgEquip"|К списку оружия/);
 assert.doesNotMatch(fitting,/Корпус 1 \/ 10/);session.catalog=false;assert.match(renderShipHangar(state,session),/Узлы:/);
});

test('general weapon upgrades and system upgrades belong to their respective development categories',()=>{
 const {g,base}=station();
 const render=view=>renderBasePanel(base,{...g.baseState(),baseTab:'hangar',hangarView:view});
 const systems=render('upgrades');assert.match(systems,/Укрепление корпуса/);assert.doesNotMatch(systems,/Калибровка орудий/);
 const weapons=render('weapon-upgrades');assert.match(weapons,/Калибровка орудий/);assert.doesNotMatch(weapons,/Укрепление корпуса/);
});

test('real development transactions retain station, point, level and alloy restrictions',()=>{
 const {g}=station();g.paused=true;g.overlay.hidden=false;
 g.baseTab='hangar';g.hangarView='weapon-upgrades';g.player.level=2;g.player.points=1;
 const ore=g.player.ore;g.buySkill('beam');assert.equal(g.skillRanks.beam,1);assert.equal(g.player.points,0);assert.equal(g.player.ore,ore);
 g.buySkill('beam');assert.equal(g.skillRanks.beam,1);
 g.hangarView='upgrades';g.player.level=4;g.player.ore=47;
 g.hangarAction({act:'hgFrame'});assert.equal(g.shipLoadout.frame,0);assert.equal(g.player.ore,47);
 g.player.ore=48;g.hangarAction({act:'hgFrame'});assert.equal(g.shipLoadout.frame,1);assert.equal(g.player.ore,0);
 g.docked.active=false;g.player.points=2;
 g.buySkill('beam');assert.equal(g.skillRanks.beam,1);assert.equal(g.player.points,2);
});

test('pilot purchases on the station remain on development, while fitting shortcuts never install or spend',()=>{
 const {g}=station();g.overlay.hidden=false;g.paused=true;
 g.baseTab='development';g.developmentCategory='pilot';g.player.level=5;g.player.points=2;
 g.renderSkills=()=>assert.fail('station development must not open a nested pilot dialog');
 g.buySkill('dodge');assert.equal(g.skillRanks.dodge,1);assert.equal(g.player.points,1);
 const ore=g.player.ore,loadout=JSON.stringify(g.shipLoadout);
 g.focusFittingWeapon('rail');
 assert.equal(g.baseTab,'hangar');assert.equal(g.hangarSession.slot,1);assert.equal(g.hangarSession.focusWeapon,'rail');
 assert.equal(g.player.ore,ore);assert.equal(JSON.stringify(g.shipLoadout),loadout);
});

test('an available pilot doctrine is visible before the long skill branches, without selecting it',()=>{
 const {g,base}=station();g.baseTab='development';g.developmentCategory='pilot';
 g.player.level=5;g.player.points=1;
 const html=renderBasePanel(base,g.baseState());
 assert.match(html,/<details class="pilot-doctrines"[^>]* open>/);
 assert.match(html,/data-act="doctrine"/);
 assert.ok(html.indexOf('pilot-doctrines')<html.indexOf('skill-branch-tabs'),
  'players should see the doctrine option before a full list of skills');
 assert.equal(g.doctrine,null);assert.equal(g.player.points,1);
});

test('repair controls disappear for an intact ship, and station specializations keep their confirmation path',()=>{
 const {base,state}=station();
 const services=renderBasePanel(base,{...state,baseTab:'hangar',hangarView:'services'});
 assert.match(services,/Корпус исправен/);assert.doesNotMatch(services,/data-act="repair"|data-act="repairDrones"/);
 const growth=renderBasePanel(base,{...state,baseTab:'network',ore:100});
 assert.match(growth,/data-act="installModule"/);assert.match(growth,/потребуется подтверждение/);
});

test('an already specialized station shows the installed module and hides unavailable alternatives',()=>{
 const {base,state}=station();base.module='workshop';
 const html=renderBasePanel(base,{...state,baseTab:'network',ore:100,
  network:{armor:2,engine:0,armament:0,strikePower:0}});
 assert.match(html,/dev-station-currency/);
 assert.match(html,/value="2" max="6"/);
 assert.match(html,/Ремонтные манипуляторы/);
 assert.match(html,/dev-station-equipped/);
 assert.match(html,/Другие варианты · уже недоступны/);
 assert.doesNotMatch(html,/data-act="installModule"/,'a finalized specialization must not offer purchases');
});

test('changing a doctrine costs once, returns one point and keeps the pilot on the same development page',()=>{
 const {g}=station();g.baseTab='development';g.developmentCategory='pilot';g.player.level=5;g.player.points=1;
 g.buyDoctrine('assault');assert.equal(g.doctrine,'assault');assert.equal(g.player.points,0);
 g.player.ore=11;g.baseAction('respec','');assert.equal(g.doctrine,'assault');assert.equal(g.player.ore,11);
 g.player.ore=12;g.baseAction('respec','');assert.equal(g.doctrine,null);assert.equal(g.player.ore,0);
 assert.equal(g.player.points,1);assert.equal(g.baseTab,'development');assert.equal(g.developmentCategory,'pilot');
 assert.equal(g.overlay.dataset.mode,'base');g.baseAction('respec','');assert.equal(g.player.points,1);
});

test('the first contour guide and selected-station panel give one route to the same next node',()=>{
 const {g}=station();g.mapView='territory';g.contourRegion='amethyst';g.contourSelection=g.contourFirst=g.docked.id;
 const html=renderWorldMap(g);
 assert.equal((html.match(/>Отметить маршрут к станции<\/button>/g)||[]).length,1);
 assert.match(html,/План первого энергетического контура/);assert.match(html,/СЕТЬ РАБОТАЕТ САМА/);
});
