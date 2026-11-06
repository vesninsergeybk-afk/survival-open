import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBasePanel} from '../base-panel.js';
import {renderShipHangar} from '../hangar-panel.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';

const dock={id:'0:0',type:'dock',x:0,y:0,active:true,discovered:true};
const state=(extra={})=>({ore:180,data:0,hp:92,maxHp:110,shield:0,allies:0,
 activeBases:3,connectedBases:1,connected:true,droneRoles:[],droneDamage:0,
 network:{armor:0,engine:0,armament:0,strikePower:0},charges:0,
 loadout:createLoadout(),skillRanks:{},level:9,points:3,contract:null,
 operation:null,baseTab:'operations',time:0,hangarView:'weapons',
 tactical:createTactical(),hangarUpgrades:[
  {id:'beam',title:'Калибровка орудий',rank:0,max:5,effect:'Урон +20%',reason:'Изучить · 1 очко',canBuy:true,desc:'Автооружие'},
  {id:'hull',title:'Укрепление корпуса',rank:0,max:5,effect:'Корпус +22',reason:'Изучить · 1 очко',canBuy:true,desc:'Корпус'}
 ],...extra});
const panel=(html,id)=>html.slice(html.indexOf('id="base-panel-'+id+'"'),
 html.indexOf('id="base-panel-'+({operations:'hangar',hangar:'network'}[id]||'network')+'"'));

test('special operation and normal assignments offer acceptance immediately on the same screen',()=>{
 const html=panel(renderBasePanel(dock,state()),'operations');
 assert.match(html,/<section class="base-task-group special" aria-label="Особая операция">/);
 assert.match(html,/<section class="base-task-group regular" aria-label="Полевые заказы">/);
 assert.match(html,/data-act="acceptOperation">Принять операцию/);
 assert.match(html,/data-act="acceptContract" data-role="standard">Принять заказ/);
 assert.doesNotMatch(html,/class="base-mission-details"/);
 assert.ok(html.indexOf('data-act="acceptOperation"')<html.indexOf('base-task-group regular'));
});

test('installed weapons show upgrade paths; absent weapons show installation only',()=>{
 const current=createLoadout(),session=new HangarSession();session.begin(current);
 const context=state({baseActive:true,loadout:current,hangarSession:session,developmentMode:true,developmentCategory:'weapons'});
 const first=renderShipHangar(context,session);
 assert.match(first,/data-act="hgFocusWeapon" data-id="rail"/);
 assert.match(first,/class="hg-weapon-inspector dev-weapon-inspector"/);
 assert.match(first,/class="dev-weapon-layout"/);
 assert.match(first,/<details class="dev-other-weapons">/);
 assert.match(first,/data-act="hgSpec" data-id="plasma:furnace"/);
 assert.match(first,/data-act="hgSpec" data-id="plasma:focus"/);
 assert.match(first,/data-act="hgUpgrade" data-id="beam"/);
 assert.doesNotMatch(first,/<details class="hg-weapon-branches"/);
 session.dispatch({act:'hgFocusWeapon',id:'rail'},{loadout:current});
 const next=renderShipHangar(context,session);
 assert.match(next,/<h3>Рельсовое орудие<\/h3>/);
 assert.match(next,/Это оружие ещё не установлено/);
 assert.match(next,/<details class="dev-other-weapons" open>/);
 assert.match(next,/data-act="fitWeapon" data-id="rail"/);
 assert.doesNotMatch(next,/data-act="hgSpec"/,'an absent weapon must not open its upgrade tree');
 assert.doesNotMatch(next,/data-act="hgUpgrade"/,'global upgrades must not appear in the absent module detail');
 assert.doesNotMatch(next,/class="hg-focused-stats"/);
 assert.doesNotMatch(next,/data-act="hgSpec" data-id="plasma:furnace"/);
 assert.equal(current.slots[0],'plasma','inspecting must not equip or buy');
});

test('ship destinations separate tactical devices, system upgrades and repair services',()=>{
 const session=new HangarSession();session.begin(createLoadout());
 const shared=state({baseTab:'hangar',hangarSession:session});
 const weapons=renderShipHangar(shared,session);
 const tactics=renderShipHangar({...shared,hangarView:'tactics'},session);
 const upgrades=renderBasePanel(dock,{...shared,baseTab:'development',developmentCategory:'ship'});
 const tacticalGrowth=renderBasePanel(dock,{...shared,baseTab:'development',developmentCategory:'tactics'});
 const services=panel(renderBasePanel(dock,{...shared,hangarView:'services'}),'hangar');
 for(const html of [weapons,tactics,services]){
  assert.match(html,/data-act="hgView" data-id="weapons"/);
  assert.match(html,/data-act="hgView" data-id="tactics"/);
  assert.doesNotMatch(html,/data-act="hgView" data-id="upgrades"/);
  assert.match(html,/data-act="hgView" data-id="services"/);
 }
 assert.doesNotMatch(weapons,/data-act="hgTacticUnlock"/);
 assert.match(tactics,/data-act="hgFocusTactic" data-id="decoy"/);
 assert.doesNotMatch(tactics,/data-act="hgTacticUpgrade"/);
 assert.match(tacticalGrowth,/data-act="hgTacticUpgrade"/);
 assert.doesNotMatch(tactics,/<details class="hg-tactic-upgrade-details"/);
 assert.match(upgrades,/data-act="hgFrame"/);
 assert.match(upgrades,/data-act="hgUpgrade" data-id="hull"/);
 assert.match(services,/data-act="repair"/);
 assert.match(services,/data-act="hire"/);
 assert.doesNotMatch(services,/<details class="hg-services"/);
});

test('inspecting and switching sections preserves unfinished weapon blueprints',()=>{
 const loadout=createLoadout(),session=new HangarSession();session.begin(loadout);
 session.draft.slots[1]='rail';
 session.dispatch({act:'hgFocusWeapon',id:'rocket'},{loadout});
 const upgradeHtml=renderBasePanel(dock,state({loadout,hangarSession:session,baseTab:'development',developmentCategory:'ship'}));
 const weaponsHtml=renderShipHangar(state({loadout,hangarSession:session}),session);
 assert.match(upgradeHtml,/В ангаре есть неприменённая сборка/);
 assert.match(weaponsHtml,/Предварительная сборка/);
 assert.match(weaponsHtml,/<h3>Самонаводящиеся ракеты<\/h3>/);
 assert.equal(session.draft.slots[1],'rail');
 assert.equal(loadout.slots[1],null);
});

test('station module choice and network transit no longer require expanding another menu',()=>{
 const friend={id:'1:0',type:'lab',x:800,y:100,active:true};
 const network=renderBasePanel(dock,state({baseTab:'network',connectedBases:2,transfers:[friend]}));
 assert.match(network,/<section class="base-network-direct" aria-label="Оснащение станции">/);
 assert.match(network,/data-act="installModule"/);
 assert.match(network,/Технология всего флота/);
 assert.doesNotMatch(network,/data-act="openDevelopment" data-id="station"/);
 assert.match(network,/<section class="base-network-direct" data-hangar-section="transit">/);
 assert.match(network,/data-act="transfer" data-role="1:0"/);
});
