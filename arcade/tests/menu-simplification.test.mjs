import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {renderBasePanel} from '../base-panel.js';
import {renderShipHangar} from '../hangar-panel.js';
import {HangarSession,createLoadout} from '../ship-loadout.js';
import {game} from './weapons-scene.mjs';

function dockView(tab='operations',extra={}){
 const g=game();
 return renderBasePanel(g.docked,{...g.baseState(),baseTab:tab,...extra});
}

test('ordinary field orders precede optional long operations in reading and keyboard order',()=>{
 const html=dockView();
 const operations=html.split('id="base-panel-operations"')[1].split('id="base-panel-hangar"')[0];
 const field=operations.indexOf('aria-label="Полевые заказы"');
 const special=operations.indexOf('aria-label="Особая операция"');
 const extended=operations.indexOf('aria-label="Сложные вылазки"');
 assert.ok(field>0&&special>field&&extended>special);
 assert.match(operations,/Полевой заказ можно совмещать с особой операцией или сложной вылазкой/);
 assert.match(operations,/одну такую вылазку/);
 assert.match(operations,/data-act="acceptContract"/);
 assert.match(operations,/data-act="acceptOperation"/);
 assert.match(operations,/data-act="acceptFieldOperation"/);
});

test('ready field-order reward remains the highest priority and is never duplicated',()=>{
 const g=game(),base=g.docked;
 const contract={baseId:base.id,choiceId:'standard',kind:'kill',name:'Зачистка патрулей',
  progress:4,goal:4,ore:16,data:15};
 const html=renderBasePanel(base,{...g.baseState(),baseTab:'operations',contract});
 const operations=html.split('id="base-panel-operations"')[1].split('id="base-panel-hangar"')[0];
 assert.ok(operations.indexOf('class="base-task-group reward"')<operations.indexOf('aria-label="Особая операция"'));
 assert.equal((operations.match(/class="base-task-group regular"/g)||[]).length,0);
 assert.equal((operations.match(/data-act="claimContract"/g)||[]).length,1);
});

test('free field choices have distinct lightweight transparent illustrations without painted text',()=>{
 const html=dockView('summary',{fieldTrialPickerOpen:true,fieldTrialTaken:false,fieldLoan:null});
 for(const id of ['ion','resonator']){
  assert.match(html,new RegExp('src="\\./assets/station-menu/field-'+id+'\\.webp" alt=""'));
  const bytes=readFileSync(new URL('../assets/station-menu/field-'+id+'.webp',import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.ok(statSync(new URL('../assets/station-menu/field-'+id+'.webp',import.meta.url)).size<100_000);
 }
 const unavailable=dockView('summary',{fieldTrialPickerOpen:true,fieldTrialTaken:true});
 assert.doesNotMatch(unavailable,/class="base-trial-product"/);
});

test('mobile section labels stay readable in the last-loaded stylesheet',()=>{
 const css=readFileSync(new URL('../station-menu-v2.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/\.base-tabs button\{min-height:56px;[^}]*font-size:12px!important/);
 assert.match(css,/@media\(max-width:370px\)/);
});

test('the empty weapon slot distinguishes a permanent reward from a free trial',()=>{
 const loadout=createLoadout(),session=new HangarSession();session.begin(loadout);
 const state={loadout,ore:20,level:1,firstHardwareReward:null,fieldTrialTaken:false};
 session.dispatch({act:'hgSlot',id:'1'},state);
 const withTrial=renderShipHangar(state,session);
 assert.match(withTrial,/второго постоянного орудия/);
 assert.match(withTrial,/Бесплатный пробный модуль доступен в «Обзоре»/);
 const trialUsed=renderShipHangar({...state,fieldTrialTaken:true},session);
 assert.doesNotMatch(trialUsed,/Бесплатный пробный модуль доступен/);
});
