import test from 'node:test';
import assert from 'node:assert/strict';
import {developmentPointLedger} from '../experience.js';
import {activeOperationStep,renderBasePanel} from '../base-panel.js';
import {renderDevelopmentPanel} from '../development-panel.js';
import {createLoadout} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';
import {game} from './weapons-scene.mjs';

test('level nine can legitimately have no free points when eight upgrades were bought',()=>{
 const state={level:9,points:0,skillRanks:{beam:2,hull:1,engine:1},
  doctrine:'command',tactical:{branches:{pulse:{path:'burst',rank:2}}},
  loadout:{specializations:{plasma:{path:'focus',rank:1}}}};
 assert.deepEqual(developmentPointLedger(state),{earned:8,spent:8,free:0,unaccounted:0});
 assert.equal(developmentPointLedger({...state,skillRanks:{beam:0}}).unaccounted,4,
  'a legacy discrepancy is reported, never silently rewritten');
});

test('pilot can inspect exactly where spent level points went',()=>{
 const g=game();g.player.level=9;g.player.points=0;
 g.skillRanks.rocket=0;g.skillRanks.beam=2;g.skillRanks.engine=1;g.doctrine='command';
 const html=renderDevelopmentPanel({...g.baseState(),developmentCategory:'pilot'});
 assert.match(html,/Куда потрачены 4 очка/);
 assert.match(html,/Калибровка орудий · 2 очка/);
 assert.match(html,/Импульсный форсаж · 1 очко/);
 assert.match(html,/Доктрина: Командир · 1 очко/);
 assert.match(html,/Часть расходов в сохранении не удалось восстановить/);
});

test('active operation describes the next literal action at any station',()=>{
 const dock={id:'dock',type:'dock'},carrier={id:'carrier',type:'carrier'};
 const world={stations:new Map([['dock',dock],['carrier',carrier]])};
 const returning=activeOperationStep({id:'carrier-interception',baseId:'carrier',name:'Перехват снабжения',phase:'return'},world);
 assert.match(returning.title,/Перехват снабжения/);
 assert.match(returning.description,/авианосец/i);
 assert.match(returning.description,/пристыкуйтесь/);
 const defending=activeOperationStep({id:'relay-defense',name:'Оборона ретранслятора',phase:'wave',wave:2,hp:80,maxHp:160},world,10);
 assert.match(defending.description,/50%/);
 assert.match(defending.title,/2\/3/);
});

test('station terminal shows pilot XP and the remote operation without losing other assignments',()=>{
 const g=game(),home=g.world.home;
 g.player.level=9;g.player.xp=240;g.player.points=0;
 const remote={id:'carrier-interception',baseId:'elsewhere',name:'Перехват снабжения',phase:'approach',
  x:1200,y:0,hp:420,maxHp:420,rewardOre:38,rewardData:30};
 g.operation=remote;g.baseTab='summary';g.developmentCategory='weapons';
 const html=renderBasePanel(home,g.baseState());
 assert.match(html,/Особая операция|Перехват снабжения/);
 assert.match(html,/Показать конвой/);
 assert.match(html,/Опыт <b>240 \/ /);
 assert.match(html,/очки <b>0<\/b>/);
});

test('mission map frames a known goal even after viewing a different map layer',()=>{
 const g=game();g.mapView='map';g.mapViewports={};g.mapPointers=new Map();
 g.endInteraction=()=>{};g.renderMap=()=>{};g.presentMenu=()=>{};
 g.openMap({x:1250,y:-480});
 assert.equal(g.overlay.dataset.mode,'map');
 assert.equal(g.mapReturnToBase,false);
 assert.ok(g.mapViewports.local.scale>=.025);
 assert.equal(g.mapViewports.local.center.x,625);
 assert.equal(g.mapViewports.local.center.y,-240);
});
