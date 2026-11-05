import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {renderWorldMap} from '../map-panel.js';
import {advanceEnemyExpansion,enemyExpansionPlan,enemyTerritoryFields,knownEnemyFields,
 validEnemyExpansion,createEnemyExpansion} from '../enemy-expansion.js';

function sector(){
 const world=new World(),keep=new Set(['industry:source','industry:depot','28:5','4:-32',
  'frontier:azure:source','frontier:azure:depot','frontier:teal:source','frontier:teal:depot','0:0']);
 world.stations=new Map([...world.stations].filter(([id])=>keep.has(id)));
 const coords={A:[-600,-200],B:[800,-200],C:[120,940]};
 for(const [id,[x,y]] of Object.entries(coords))world.stations.set(id,{id,x,y,
  enemy:true,active:false,captured:false,suppressed:false,hp:100,maxHp:100,
  type:'dock',discovered:true,turrets:[]});
 world.enemyExpansion=createEnemyExpansion();world.enemyExpansion.prepared=true;
 world.regionalSupply.central.ore=16;
 return world;
}
const game=world=>({world,player:{x:0,y:0},enemies:[],time:0,
 mapView:'territory',contourRegion:'amethyst',contourFirst:null,contourSelection:null});

test('the enemy pays for every actual link, closes a face, then earns bounded industrial income',()=>{
 const w=sector(),stock=w.regionalSupply.central;
 assert.equal(advanceEnemyExpansion(w,89).length,0);
 const first=advanceEnemyExpansion(w,90);
 assert.equal(first.length,1);assert.equal(first[0].kind,'link');
 assert.equal(stock.ore,14);
 assert.equal(w.enemyExpansion.links.length,1);
 assert.equal(advanceEnemyExpansion(w,91).length,0,'no free construction on repeated frames');
 assert.equal(enemyTerritoryFields(w).length,0);
 // A functioning mine refills stock between construction cycles. The enemy
 // must keep the material for its next transport in reserve at all times.
 stock.ore=16;
 assert.equal(advanceEnemyExpansion(w,175)[0].kind,'link');
 stock.ore=16;
 const claimed=advanceEnemyExpansion(w,260);
 assert.equal(claimed[0].kind,'claim');
 assert.ok(enemyTerritoryFields(w)[0].area>700000);
 assert.equal(stock.ore,14);
 assert.equal(w.enemyExpansion.spent,6);
 assert.equal(knownEnemyFields(w).length,1);
 assert.equal(advanceEnemyExpansion(w,440).length,0,'no new triangle remains');
 assert.equal(w.enemyExpansion.earned,1,'one controlled face earns one ore per cycle');
 assert.equal(stock.ore,15);
 assert.ok(validEnemyExpansion(w.enemyExpansion,[...w.stations],440));
});

test('enemy projections show only discovered supports, never hidden station positions',()=>{
 const w=sector();advanceEnemyExpansion(w,90);
 const g=game(w),plan=enemyExpansionPlan(w);
 assert.ok(plan);assert.equal(plan.seen.length,3);
 let html=renderWorldMap(g);
 assert.match(html,/contour-enemy-proposed-field/);
 assert.match(html,/РАСШИРЕНИЕ ВРАЖЕСКОЙ СЕТИ/);
 assert.match(html,/contour-enemy-objective/);
 const hidden=w.stations.get('C');hidden.discovered=false;
 html=renderWorldMap(g);
 assert.doesNotMatch(html,/contour-enemy-proposed-field/);
 assert.match(html,/Из трёх опор разведано 2/);
 assert.doesNotMatch(html,/Известные опоры: [^<]*C\b/);
 hidden.discovered=true;
 w.regionalSupply.central.ore=16;
 advanceEnemyExpansion(w,175);advanceEnemyExpansion(w,260);
 assert.match(renderWorldMap(g),/contour-enemy-land/);
 hidden.enemy=false;hidden.captured=true;hidden.active=true;
 assert.equal(enemyTerritoryFields(w).length,0,'capturing a support destroys the enemy field');
 assert.doesNotMatch(renderWorldMap(g),/contour-enemy-land/);
});

test('expansion states reject forged links and keep legacy saves valid',()=>{
 const w=sector();advanceEnemyExpansion(w,90);
 const old=createEnemyExpansion();
 assert.ok(validEnemyExpansion(old,[...w.stations],0));
 assert.ok(validEnemyExpansion(undefined,[...w.stations],0));
 const fake={...w.enemyExpansion,links:[['A','missing','home']]};
 assert.equal(validEnemyExpansion(fake,[...w.stations],90),false);
 const duplicate={...w.enemyExpansion,links:[['A','B','home'],['B','A','home']]};
 assert.equal(validEnemyExpansion(duplicate,[...w.stations],90),false);
 const plan={...w.enemyExpansion,plan:{front:'home',region:'amethyst',ids:['A','A','C']}};
 assert.equal(validEnemyExpansion(plan,[...w.stations],90),false);
});
