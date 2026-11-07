import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {progressionModel,renderProgressionScreen,paintProgressionLinks} from '../progression-screen.js';
import {createLoadout} from '../ship-loadout.js';
import {createTactical} from '../tactical-fields.js';
import {DEFAULT_CONTROLS} from '../control-layout.js';
import {game} from './weapons-scene.mjs';

function docked(){
 const g=game();g.paused=true;g.overlay.hidden=false;g.overlay.dataset.mode='base';
 g.baseTab='development';g.developmentDomain='pilot';g.developmentTactic='pulse';
 g.shipLoadout=createLoadout();g.hangarSession.begin(g.shipLoadout);
 g.tactical=createTactical();g.controls={...DEFAULT_CONTROLS};
 return g;
}
const state=(g,domain)=>({...g.baseState(),developmentDomain:domain,baseActive:true,station:g.docked});

test('all five progression domains show only real station actions and never mutate the ship while browsing',()=>{
 const g=docked(),before=JSON.stringify([g.shipLoadout,g.skillRanks,g.tactical,g.player.ore,g.player.points]);
 for(const domain of ['pilot','weapons','ship','tactics','network']){
  const model=progressionModel(state(g,domain)),html=renderProgressionScreen(state(g,domain));
  assert.equal(model.domain,domain);
  assert.ok(model.nodes.length,domain);
  assert.match(html,new RegExp('data-domain="'+domain+'"'));
  for(const node of model.nodes){
   assert.match(html,new RegExp('data-act="devFocus" data-id="'+node.id+'"'));
   if(node.action!=='baseTab')assert.ok(['skill','doctrine','fitWeapon','hgUpgrade','hgSpec','hgFrame',
    'hgTacticEquip','hgTacticUnlock','hgTacticUpgrade'].includes(node.action),node.action);
  }
 }
 assert.equal(JSON.stringify([g.shipLoadout,g.skillRanks,g.tactical,g.player.ore,g.player.points]),before);
});

test('the progression atlas spends exactly one real point on a general weapon upgrade',()=>{
 const g=docked();g.player.level=3;g.player.points=1;g.player.ore=120;
 g.developmentDomain='weapons';
 const node=progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='skill-beam');
 assert.equal(node.canAct,true);assert.equal(node.action,'hgUpgrade');
 const ore=g.player.ore;
 g.hangarAction({act:node.action,id:node.actionId});
 assert.equal(g.skillRanks.beam,1);assert.equal(g.player.points,0);assert.equal(g.player.ore,ore);
 assert.equal(progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='skill-beam').canAct,false);
 g.hangarAction({act:node.action,id:node.actionId});
 assert.equal(g.skillRanks.beam,1);
});

test('ship frame nodes charge the actual alloy price, and preserve the existing loadout',()=>{
 const g=docked();g.player.level=4;g.player.ore=47;g.developmentDomain='ship';
 const before=JSON.stringify(g.shipLoadout.slots);
 let node=progressionModel(state(g,'ship')).nodes.find(n=>n.id==='frame-1');
 assert.equal(node.canAct,false);assert.match(node.reason,/48/);
 g.hangarAction({act:node.action});assert.equal(g.shipLoadout.frame,0);
 g.player.ore=48;node=progressionModel(state(g,'ship')).nodes.find(n=>n.id==='frame-1');
 assert.equal(node.canAct,true);
 g.hangarAction({act:node.action});
 assert.equal(g.shipLoadout.frame,1);assert.equal(g.player.ore,0);
 assert.equal(JSON.stringify(g.shipLoadout.slots),before);
});

test('weapon specializations and tactical branches honor actual level, stations, points and exclusive choices',()=>{
 const g=docked();g.player.level=7;g.player.points=2;g.activeBases=2;g.developmentDomain='weapons';
 let node=progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='spec-plasma-focus');
 assert.equal(node.canAct,true);
 g.hangarAction({act:node.action,id:node.actionId});
 assert.deepEqual(g.shipLoadout.specializations.plasma,{path:'focus',rank:1});
 assert.equal(g.player.points,1);
 assert.equal(progressionModel(state(g,'weapons')).nodes.find(n=>n.id==='spec-plasma-furnace').canAct,false);
 g.developmentDomain='tactics';
 const tactical=progressionModel(state(g,'tactics')).nodes.find(n=>n.id==='tactic-pulse-shell');
 assert.equal(tactical.canAct,true);
 g.hangarAction({act:tactical.action,id:tactical.actionId});
 assert.deepEqual(g.tactical.branches.pulse,{path:'shell',rank:1});
 assert.equal(g.player.points,0);
 assert.equal(progressionModel(state(g,'tactics')).nodes.find(n=>n.id==='tactic-pulse-burst').canAct,false);
});

test('network nodes link to the existing station services; they do not pretend to buy a new skill',()=>{
 const g=docked(),model=progressionModel(state(g,'network'));
 assert.equal(model.nodes.length,3);
 assert.ok(model.nodes.every(n=>n.action==='baseTab'&&n.actionId==='network'));
 const html=renderProgressionScreen(state(g,'network'));
 assert.match(html,/data-act="baseTab" data-id="network" data-role="network"/);
 assert.match(html,/Системы станции/);
 assert.doesNotMatch(html,/0\/1 · доступно/);
});

test('special weapons with no purchase tree still have a real route to fitting',()=>{
 const g=docked();g.hangarSession.focusWeapon='howitzer';
 const model=progressionModel(state(g,'weapons'));
 assert.equal(model.nodes.length,1);
 assert.equal(model.nodes[0].action,'fitWeapon');
 assert.equal(model.nodes[0].actionId,'howitzer');
 assert.match(renderProgressionScreen(state(g,'weapons')),/data-act="fitWeapon" data-id="howitzer"/);
});

test('progression screen explains a remapped activation key and warns when field weapon occupies it',()=>{
 const g=docked();g.player.level=5;g.player.points=1;g.developmentDomain='tactics';
 g.controls.field='KeyZ';
 g.fieldLoan={moduleId:'ion',charges:3};g.shipLoadout.slots[1]='ion';
 const html=renderProgressionScreen(state(g,'tactics'));
 assert.match(html,/клавиша Z занята/);
 assert.match(html,/Для применения нажмите Z/);
});

test('all referenced generated images are present as independent assets',()=>{
 const g=docked(),root=dirname(fileURLToPath(new URL('../index.html',import.meta.url)));
 for(const domain of ['pilot','weapons','ship','tactics','network']){
  const html=renderProgressionScreen(state(g,domain));
  for(const match of html.matchAll(/src="(\.\/assets\/progression\/[^\"]+\.webp)"/g)){
   assert.equal(existsSync(join(root,match[1])),true,'missing '+match[1]);
  }
 }
});

test('tree connectors cannot create scrollbars on short branches and grow for long ones',()=>{
 const previous=globalThis.getComputedStyle;
 globalThis.getComputedStyle=()=>({paddingRight:'10px',paddingBottom:'13px'});
 try{
  const attrs={};
  const svg={setAttribute:(key,value)=>{attrs[key]=String(value);},replaceChildren(){}};
  const tiers=[{offsetTop:7,offsetHeight:162}];
  const root={clientWidth:474,clientHeight:342,scrollWidth:484,scrollHeight:352,
   querySelector:()=>svg,querySelectorAll:selector=>selector==='.prog-tier'?tiers:[],
   getBoundingClientRect:()=>({left:0,top:0})};
  paintProgressionLinks(root);
  assert.equal(attrs.width,'464');assert.equal(attrs.height,'329');
  tiers[0].offsetTop=650;
  paintProgressionLinks(root);
  assert.equal(attrs.height,'812');
 }finally{globalThis.getComputedStyle=previous;}
});
