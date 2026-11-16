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
const travelEnd=c=>Math.ceil(c.launchedAt+c.routeLength/c.speed)+1;
const arrival=c=>travelEnd(c)+(c.constructionAction==='repair'?16:22)+2;

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
 const halfway=travelEnd(craft);
 advancePopulation(w,halfway);
 assert.equal(joined(w,edge(craft)),false,'arrival is not construction completion');
 assert.ok(Number.isFinite(craft.assemblyUntil));
 assert.ok(w.population.convoys.includes(craft),'engineer remains vulnerable while building');
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
 assert.ok(w.population.events.some(e=>e.kind==='construction-intercept'&&e.cargoId===craft.id));
 assert.equal(interceptPopulationCargo(w,craft,35),false);
 const result=advancePopulation(w,arrival(craft));
 assert.equal(joined(w,target),false);
 assert.equal(w.enemyExpansion.links.length,previous);
 assert.ok(!result.some(e=>e.kind==='construction-complete'));
 assert.equal(project(w),undefined);
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

test('enemy pays for repair only after a 75-second capture window',()=>{
 const w=build(1842),colony=w.population.colonies.find(c=>c.region==='amethyst'&&c.index===0);
 const factory=w.stations.get(colony.id+':factory');
 factory.ruined=true;factory.enemy=false;factory.captured=false;factory.hp=0;factory.ruinedAt=10;
 for(const turret of factory.turrets)turret.hp=0;
 w.enemyExpansion.nextAt=84;
 assert.equal(advanceEnemyExpansion(w,84)[0]?.kind,'construction-start',
  'before the grace period only ordinary construction may happen');
 assert.equal(w.population.convoys.some(c=>c.constructionAction==='repair'),false);
 w.enemyExpansion.nextAt=85;
 const previousStock=colony.pool,previousReserve=colony.ready;
 const orders=advanceEnemyExpansion(w,85);
 assert.equal(orders[0]?.kind,'repair-start');
 const engineer=w.population.convoys.find(c=>c.constructionAction==='repair');
 assert.ok(engineer);
 assert.equal(engineer.targetId,factory.id);
 assert.equal(colony.pool,previousStock-8,'the repair spends actual industrial material');
 assert.equal(colony.ready,previousReserve-2,'escort ships leave the existing reserve');
 assert.equal(populationConvoyTitle(engineer),'Ремонтный транспорт');
 const events=advancePopulation(w,arrival(engineer));
 assert.ok(events.some(e=>e.kind==='repair-complete'&&e.cargoId===engineer.id));
 assert.equal(factory.ruined,false);
 assert.equal(factory.enemy,true);
 assert.ok(factory.hp>0&&factory.hp<factory.maxHp);
 assert.equal(factory.turrets.filter(t=>t.hp>0).length,1,'only one gun is restored');
 assert.ok(validPopulation(w.population,[...w.stations],arrival(engineer)));
});

test('capturing ruined factory before repair arrives permanently blocks that expedition',()=>{
 const w=build(1842),colony=w.population.colonies.find(c=>c.region==='amethyst'&&c.index===0);
 const factory=w.stations.get(colony.id+':factory');
 factory.ruined=true;factory.enemy=false;factory.captured=false;factory.hp=0;factory.ruinedAt=0;
 w.enemyExpansion.nextAt=100;
 assert.equal(advanceEnemyExpansion(w,100)[0]?.kind,'repair-start');
 const craft=w.population.convoys.find(c=>c.constructionAction==='repair');
 factory.ruined=false;factory.enemy=false;factory.captured=true;factory.active=true;
 factory.hp=Math.round(factory.maxHp*.3);
 const events=advancePopulation(w,arrival(craft));
 assert.ok(events.some(e=>e.kind==='repair-aborted'));
 assert.equal(factory.enemy,false);
 assert.equal(factory.captured,true);
});

test('shooting down repair engineers prevents rebuilding and records loss',()=>{
 const w=build(1842),colony=w.population.colonies.find(c=>c.region==='amethyst'&&c.index===0);
 const relay=w.stations.get(colony.id+':relay');
 relay.ruined=true;relay.enemy=false;relay.captured=false;relay.hp=0;relay.ruinedAt=0;
 w.enemyExpansion.nextAt=100;
 assert.equal(advanceEnemyExpansion(w,100)[0]?.kind,'repair-start');
 const craft=w.population.convoys.find(c=>c.constructionAction==='repair');
 craft.hp=0;
 assert.equal(interceptPopulationCargo(w,craft,100),true);
 assert.ok(w.population.events.some(e=>e.kind==='repair-intercept'&&e.cargoId===craft.id));
 advancePopulation(w,arrival(craft));
 assert.equal(relay.ruined,true);
 assert.equal(relay.enemy,false);
});

test('construction is vulnerable on-site after arrival, not only during flight',()=>{
 const w=build(1842);
 advanceEnemyExpansion(w,34);
 const craft=project(w),link=edge(craft);
 const reached=travelEnd(craft);
 advancePopulation(w,reached);
 assert.ok(craft.assemblyUntil>reached);
 assert.equal(joined(w,link),false);
 assert.ok(validPopulation(w.population,[...w.stations],reached));
 craft.hp=0;
 assert.equal(interceptPopulationCargo(w,craft,reached),true);
 advancePopulation(w,arrival(craft));
 assert.equal(joined(w,link),false);
});

test('capturing a station during assembly cancels hostile construction',()=>{
 const w=build(1842);
 advanceEnemyExpansion(w,34);
 const craft=project(w),link=edge(craft);
 const reached=travelEnd(craft);
 advancePopulation(w,reached);
 const site=w.stations.get(craft.targetId);
 site.enemy=false;site.captured=true;site.active=true;
 const events=advancePopulation(w,reached+1);
 assert.ok(events.some(e=>e.kind==='construction-aborted'&&e.cargoId===craft.id));
 assert.equal(joined(w,link),false);
 assert.equal(project(w),undefined);
});
