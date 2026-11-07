import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {renderBasePanel,BASE_TABS} from '../base-panel.js';
import {createLoadout,HangarSession} from '../ship-loadout.js';
import {fieldOperationIds} from '../field-operations.js';

const base={id:'0:0',x:0,y:0,type:'dock',active:true,discovered:true};
const loadout=createLoadout(),hangarSession=new HangarSession();hangarSession.begin(loadout);
const state={ore:84,data:12,hp:75,maxHp:110,shield:30,allies:1,
 activeBases:1,connectedBases:1,connected:true,droneRoles:['scout'],droneDamage:0,charges:0,
 network:{armor:0,engine:0,armament:0,strikePower:0},transfers:[],
 loadout,hangarSession,skillRanks:{},level:1,points:3,operation:null,time:0};

test('the five existing station destinations retain real tab semantics and callbacks',()=>{
 assert.deepEqual(BASE_TABS,['summary','operations','hangar','development','network']);
 for(const selected of BASE_TABS){
  const html=renderBasePanel(base,{...state,baseTab:selected});
  assert.equal((html.match(/role="tab"/g)||[]).length,5);
  assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
  assert.match(html,new RegExp('id="base-tab-'+selected+'"[^>]*aria-selected="true"'));
  assert.match(html,new RegExp('id="base-panel-'+selected+'"[^>]*role="tabpanel"'));
  assert.match(html,/data-act="baseTab"/);
  assert.match(html,/data-act="close"/);
  assert.match(html,/data-act="baseMap"/);
 }
});

test('overview shows the live next decision, genuinely known sector and real current ship sprite',()=>{
 const html=renderBasePanel(base,{...state});
 assert.match(html,/class="base-overview-lead"/);
 assert.match(html,/class="base-overview-sector"/);
 assert.match(html,/aria-label="Расположение станции, известных узлов и цели"/);
 assert.match(html,/class="base-real-ship" src="\.\.\/assets\/space\/hero-evolution\/ship_01.webp"/);
 assert.match(html,/data-act="repair"/);
 assert.match(html,/data-act="hire"/);
 assert.match(html,/Корпус <b>75 \/ 110<\/b>/);
 assert.match(html,/class="base-hull-meter" value="75" max="110"/);
 const advanced=renderBasePanel(base,{...state,level:7,hp:42});
 assert.match(advanced,/base-real-ship" src="\.\.\/assets\/space\/hero-evolution\/ship_03_damaged.webp"/);
 assert.match(advanced,/base-hull-meter" value="42" max="110"/);
 const repaired=renderBasePanel(base,{...state,level:7,hp:75});
 assert.match(repaired,/base-real-ship" src="\.\.\/assets\/space\/hero-evolution\/ship_03.webp"/);
});

test('new styling keeps real development, live fitting and station upgrades',()=>{
 const ship=renderBasePanel(base,{...state,baseTab:'hangar'});
 assert.match(ship,/data-act="hgSlot"/);
 assert.match(ship,/hero-evolution\/ship_01.webp/);
 const damagedShip=renderBasePanel(base,{...state,level:7,hp:40,baseTab:'hangar'});
 assert.match(damagedShip,/hg-hull" src="\.\.\/assets\/space\/hero-evolution\/ship_03_damaged.webp"/);
 const skills=renderBasePanel(base,{...state,baseTab:'development'});
 assert.match(skills,/class="progression-ui/);
 const network=renderBasePanel(base,{...state,baseTab:'network'});
 assert.match(network,/Связь и территория/);
 assert.match(network,/data-act="installModule"/);
 assert.match(network,/После установки заменить его в этом прохождении нельзя/);
});

test('the seven station sorties get distinct decorative marks without replacing gameplay text',()=>{
 for(const type of ['dock','lab','arsenal','carrier']){
  const html=renderBasePanel({...base,type},{...state,baseTab:'operations'});
  for(const id of fieldOperationIds(type)){
   assert.match(html,new RegExp('field-operation-card field-op--'+id));
   assert.match(html,/class="field-op-icon" aria-hidden="true"/);
  }
 }
});

test('disabled local station modules explain the missing alloy',()=>{
 const html=renderBasePanel(base,{...state,ore:20,baseTab:'network'});
 assert.equal((html.match(/base-module-reason">Не хватает 18 ед\. сплава/g)||[]).length,2);
 assert.match(html,/data-act="installModule"[^>]*disabled/);
});

test('production loads final quiet layer, real art and reduced-motion/mobile rules',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const finalCss='./station-menu-v2.css?v=station-menu-v2-4';
 assert.ok(html.includes(finalCss));
 assert.ok(html.indexOf(finalCss)>html.indexOf('./progression-art.css'));
 assert.match(html,/game\.js\?v=[^"\n]*station-menu-v2-1/,
  'the game module needs a fresh URL so browsers do not reuse an older import graph');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/base-panel\.js\?v=[^'\n]*station-menu-v2-1/,
  'the station renderer itself must be cache-busted');
 assert.match(game,/base-panel\.js\?v=[^'\n]*station-polish-1/);
 assert.match(game,/map-panel\.js\?v=[^'\n]*station-polish-1/);
 const css=readFileSync(new URL('../station-menu-v2.css',import.meta.url),'utf8');
 assert.match(css,/\.base-overview-lead/);
 assert.match(css,/\.base-ship-condition/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/field-op--broken-convoy/);
 assert.doesNotMatch(css,/01-overview-v2\.png|03-ship-v2\.png/);
 const atlas=new URL('../assets/station-menu/icons-v2.webp',import.meta.url);
 assert.ok(statSync(atlas).size<500_000,'the atlas should not consume multiple megabytes at load');
});

test('development presentation uses the same quiet cards and honest portraits',()=>{
 const css=readFileSync(new URL('../progression-art.css',import.meta.url),'utf8');
 assert.match(css,/\.prog-orbit-center img/);
 assert.match(css,/\.prog-domain\[aria-pressed=true\]/);
 assert.match(css,/\.prog-action:disabled/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.doesNotMatch(css,/space_nebula\.webp|tab_idle\.webp|tab_active\.webp|detail_backplate\.webp/);
 const svg=readFileSync(new URL('../studio/menu-kit/terminal-v2-four-tabs.svg',import.meta.url),'utf8');
 for(const tab of ['Задания','Корабль','Развитие','Станция'])assert.ok(svg.includes('>'+tab+'</text>'));
});
