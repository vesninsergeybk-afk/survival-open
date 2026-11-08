import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {renderBasePanel} from '../base-panel.js';
import {createLoadout} from '../ship-loadout.js';
import {captureHangarView,restoreHangarView} from '../hangar-view.js';

function fixture(){
 const world=new World(8723),home=world.home;
 home.active=true;home.discovered=true;
 const state={ore:80,data:0,hp:70,maxHp:110,shield:0,allies:0,
  activeBases:1,connectedBases:1,connected:true,droneRoles:[],droneDamage:0,charges:0,
  network:{armor:0,engine:0,armament:0,strikePower:0},transfers:[],world,
  position:{x:home.x,y:home.y},loadout:createLoadout(),skillRanks:{},level:1,points:0,
  baseTab:'summary',contract:null,operation:null,firstHardwareReward:null,time:180};
 return {home,state};
}
const section=(html,id)=>html.split('id="base-panel-'+id+'"')[1]?.split('<section class="base-tab-panel"')[0];

test('regional plans cannot replace or bury routine station actions',()=>{
 const {home,state}=fixture();
 state.world.regionalSupply.central.conflict={offeredAt:150,plan:null,outcome:null};
 const html=renderBasePanel(home,state),summary=section(html,'summary'),tasks=section(renderBasePanel(home,{...state,baseTab:'operations'}),'operations');
 assert.match(summary,/data-act="baseTab" data-role="operations">Посмотреть задания/);
 assert.doesNotMatch(summary,/data-act="acceptContract"|data-act="acceptOperation"/);
 assert.match(summary,/data-act="openShipService"/);
 assert.doesNotMatch(summary,/data-act="repair"/);
 assert.doesNotMatch(summary,/class="campaign-progress"|aria-label="Цель домашнего региона"|data-act="conflictPlan"/);
 assert.match(tasks,/data-hangar-section="region-plans"/);
 assert.match(tasks,/aria-label="Цель домашнего региона"/);
 assert.match(html,/data-act="baseMap">Карта сектора/);
});

test('a ready local reward marks the task tab and remains directly claimable on home',()=>{
 const {home,state}=fixture();
 state.contract={baseId:home.id,choiceId:'standard',kind:'kill',name:'Зачистка патрулей',progress:4,goal:4,ore:16,data:15};
 const html=renderBasePanel(home,state);
 assert.match(html,/id="base-tab-operations"[^>]*data-notice="Награда"[^>]*aria-label="Задания · Награда"/);
 assert.match(section(html,'summary'),/data-act="claimContract">Забрать награду/);
 const other={...home,id:'different',type:'lab'};
 const remote=renderBasePanel(other,state);
 assert.doesNotMatch(remote,/data-notice="Награда"/);
 assert.doesNotMatch(section(remote,'summary'),/data-act="claimContract"/);
});

test('changing station sections resets scroll; a purchase preserves the current section and disclosures',()=>{
 const dialog={scrollTop:480},disclosure={dataset:{hangarSection:'region-plans'},open:true};
 let tab='operations';
 const root={querySelector:s=>s==='.base-dialog'?dialog:{dataset:{role:tab}},
  querySelectorAll:s=>s.endsWith('[open]')?(disclosure.open?[disclosure]:[]):[disclosure]};
 const view=captureHangarView(root);
 dialog.scrollTop=0;disclosure.open=false;
 restoreHangarView(root,view);
 assert.equal(dialog.scrollTop,480);
 assert.equal(disclosure.open,true);
 tab='hangar';restoreHangarView(root,view);
 assert.equal(dialog.scrollTop,0);
});

test('selecting a deep progression node preserves scroll, but changing its weapon resets it',()=>{
 const dialog={scrollTop:780};let weapon='plasma';
 const progression={dataset:{domain:'weapons'},querySelector:()=>({dataset:{id:weapon}})};
 const root={
  querySelector:s=>s==='.progression-ui'?progression:s==='.base-dialog'?dialog:
   s==='.base-tabs [aria-selected="true"]'?{dataset:{role:'development'}}:null,
  querySelectorAll:()=>[]
 };
 const view=captureHangarView(root);
 assert.equal(view.section,'weapons:plasma');
 dialog.scrollTop=0;restoreHangarView(root,view);
 assert.equal(dialog.scrollTop,780,'the selected upgrade must stay in view after its detail updates');
 weapon='rail';restoreHangarView(root,view);
 assert.equal(dialog.scrollTop,0,'a different weapon must start at its own tree top');
 progression.dataset.domain='ship';restoreHangarView(root,view);
 assert.equal(dialog.scrollTop,0,'another domain must not inherit the previous list position');
});

test('published script versions include the progression scroll fix',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(game,/hangar-view\.js\?v=[^'\n]*devscroll-1/);
 assert.match(html,/game\.js\?v=[^"\n]*devscroll-1/);
});
