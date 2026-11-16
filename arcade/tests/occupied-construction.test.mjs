import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {advanceEnemyExpansion,enemyTerritoryFields} from '../enemy-expansion.js';
import {advancePopulation,interceptPopulationCargo,validPopulation} from '../world-population.js';
import {populationConvoyTitle,populationConvoyEscort} from '../convoy-profiles.js';
import {packRun,unpackRun} from '../run-checkpoint.js';

const build=seed=>new World(seed,{occupied:true});
const project=w=>w.population.convoys.find(c=>c.constructionCargo);
const edge=craft=>craft.constructionLink;
const joined=(w,[a,b])=>w.enemyExpansion.links.some(([x,y])=>
  x===a&&y===b||x===b&&y===a);
const arrival=c=>Math.ceil(c.launchedAt+c.routeLength/c.speed)+2;

test('builder physically travels and only THEN creates an enemy connection',()=>{
 const w=build(1842);
 const previous=w.enemyExpansion.links.length;
 assert.equal(advanceEnemyExpansion(w,33).length,0);
 const event=advanceEnemyExpansion(w,34)[0],craft=project(w);
 assert.equal(event?.kind,'construction-start');
 assert.ok(craft?.populationCargo&&craft.regionalCargo);
 assert.equal(populationConvoyTitle(craft),'Инженерный транспорт');
 assert.deepEqual(populationConvoyEscort(craft),['scout','fighter']);
 assert.equal(w.enemyExpansion.links.length,previous);
 assert.equal(joined(w,edge(craft)),false);
 const firstColony=w.population.colonies.find(c=>c.id===craft.colonyId);
 assert.equal(firstColony.index,0,'first expedition occurs near the starting region');
 const firstStock=firstColony.pool;
 assert.ok(firstStock>=0);
 const deadline=arrival(craft);
 const announcements=advancePopulation(w,deadline);
 assert.ok(announcements.some(e=>e.kind==='construction-complete'&&e.cargoId===craft.id));
 assert.equal(w.enemyExpansion.links.length,previous+1);
 assert.equal(joined(w,edge(craft)),true);
 assert.equal(project(w),undefined);
 assert.ok(validPopulation(w.population,[...w.stations],deadline));
});

test('intercepting a real engineering convoy prevents a free replacement link',()=>{
 const w=build(1842),previous=w.enemyExpansion.links.length;
 advanceEnemyExpansion(w,34);
 const craft=project(w),target=edge(craft);
 craft.hp=0;
 assert.equal(interceptPopulationCargo(w,craft,35),true);
 assert.equal(interceptPopulationCargo(w,craft,35),false);
 const result=advancePopulation(w,arrival(craft));
 assert.equal(joined(w,target),false);
 assert.equal(w.enemyExpansion.links.length,previous);
 assert.ok(!result.some(e=>e.kind==='construction-complete'));
 assert.equal(project(w),undefined);
 assert.ok(w.population.events.some(e=>e.kind==='construction-intercept'&&e.cargoId===craft.id));
});

test('capturing either terminal before arrival aborts the enemy construction',()=>{
 const w=build(1842),previous=w.enemyExpansion.links.length;
 advanceEnemyExpansion(w,34);
 const craft=project(w),target=w.stations.get(craft.targetId);
 target.enemy=false;target.captured=true;target.active=true;
 const events=advancePopulation(w,arrival(craft));
 assert.equal(w.enemyExpansion.links.length,previous);
 assert.ok(events.some(e=>e.kind==='construction-aborted'&&e.cargoId===craft.id));
});

test('construction convoy data is checkpoint-safe and tampering is rejected',()=>{
 const w=build(1842);
 advanceEnemyExpansion(w,34);
 const restored=unpackRun(packRun({population:w.population,expansion:w.enemyExpansion}));
 const p=restored.population;
 assert.equal(validPopulation(p,[...w.stations],34),true);
 assert.deepEqual(p.convoys.find(c=>c.constructionCargo).constructionLink,
  project(w).constructionLink);
 p.convoys[0].constructionLink=['colony:amethyst:0:relay','colony:amethyst:0:factory'];
 assert.equal(validPopulation(p,[...w.stations],34),false);
});

test('ordinary arcade retains instantaneous legacy paid expansion',()=>{
 const w=new World(1842);
 w.enemyExpansion.nextAt=34;
 const before=w.population.convoys.length;
 const result=advanceEnemyExpansion(w,34);
 assert.ok(result.every(e=>e.kind!=='construction-start'));
 assert.equal(w.population.convoys.length,before);
});
