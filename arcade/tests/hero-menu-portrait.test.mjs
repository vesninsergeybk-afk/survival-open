import test from 'node:test';
import assert from 'node:assert/strict';
import {statSync} from 'node:fs';
import {heroMenuPortrait} from '../hero-menu-portrait.js';
import {shipArtStage,createLoadout} from '../ship-loadout.js';
import {renderProgressionScreen} from '../progression-screen.js';
import {renderBasePanel} from '../base-panel.js';

test('all ten menu portraits match the flight stage and reference existing assets',()=>{
 for(let stage=0;stage<10;stage++){
  const level=stage*3+1;
  assert.equal(shipArtStage(level),stage);
  for(const hp of [110,43]){
   const portrait=heroMenuPortrait(level,hp,110);
   assert.match(portrait,new RegExp('ship_'+String(stage+1).padStart(2,'0')+(hp<44?'_damaged':'')+'\\.webp$'));
   const file=new URL('../../assets/space/hero-evolution/'+portrait.split('/').at(-1),import.meta.url);
   assert.ok(statSync(file).size>1000,portrait);
  }
 }
});

test('damage switches at strictly below forty percent and handles missing health',()=>{
 assert.match(heroMenuPortrait(7,44,110),/ship_03\.webp$/);
 assert.match(heroMenuPortrait(7,43.9,110),/ship_03_damaged\.webp$/);
 assert.match(heroMenuPortrait(7,undefined,0),/ship_03\.webp$/);
});

test('the development tree portraits follow the same stage and damage rules',()=>{
 const state={level:7,hp:40,maxHp:110,points:1,ore:80,skillRanks:{},
  pilotSkills:[],hangarUpgrades:[],developmentDomain:'network'};
 const html=renderProgressionScreen(state);
 assert.match(html,/prog-orbit-center"><img src="\.\.\/assets\/space\/hero-evolution\/ship_03_damaged\.webp"/);
 assert.match(html,/Корпус серьёзно повреждён/);
 assert.match(renderProgressionScreen({...state,hp:75}),/ship_03\.webp/);
 assert.doesNotMatch(renderProgressionScreen({...state,hp:75}),/ship_03_damaged\.webp/);
});

test('the complete station terminal uses one real ship condition in overview, hangar and development',()=>{
 const dock={id:'0:0',x:0,y:0,type:'dock',active:true,discovered:true};
 const world={home:dock,stations:new Map([[dock.id,dock]]),
  networkTopology:()=>({linked:new Set([dock.id]),count:1,links:[]}),
  nearbyRocks:()=>[],nearbyStations:()=>[]};
 const base={ore:40,data:0,hp:43,maxHp:110,shield:0,allies:0,
  activeBases:1,connectedBases:1,connected:true,droneRoles:[],droneDamage:0,charges:0,
  network:{armor:0,engine:0,armament:0,strikePower:0},transfers:[],
  world,loadout:createLoadout(),skillRanks:{},level:7,points:1,baseTab:'summary',
  contract:null,operation:null,time:30};
 for(const baseTab of ['summary','hangar','development']){
  const damaged=renderBasePanel(dock,{...base,baseTab});
  assert.equal((damaged.match(/ship_03_damaged\.webp/g)||[]).length,1,baseTab);
  assert.doesNotMatch(damaged,/ship_03\.webp/,baseTab);
  const healthy=renderBasePanel(dock,{...base,baseTab,hp:70});
  assert.equal((healthy.match(/ship_03\.webp/g)||[]).length,1,baseTab);
  assert.doesNotMatch(healthy,/ship_03_damaged\.webp/,baseTab);
 }
});
