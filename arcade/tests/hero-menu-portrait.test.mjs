import test from 'node:test';
import assert from 'node:assert/strict';
import {statSync} from 'node:fs';
import {heroMenuPortrait} from '../hero-menu-portrait.js';
import {shipArtStage} from '../ship-loadout.js';
import {renderProgressionScreen} from '../progression-screen.js';

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
