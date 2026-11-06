import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {FRONTIERS} from '../frontier-industry.js';
import {SUPPLY} from '../regional-supply.js';
import {ENEMY_TYPES} from '../ai.js';
import {spawnFrontierRaid,spawnRegionalRaid} from '../region-runtime.js';
import {designationLabel,TARGET_DESIGNATION} from '../target-designation.js';
import {renderRegionAtlas} from '../regional-map.js';
import {EXPEDITION_CRUISE,cruiseSafe,updateCruise} from '../expedition-cruise.js';

const director={cap:30,groupSize:4,types:['scout','fighter','flanker','healer','gunship'],interval:3};
function encounter(region){
 const w=new World(),depot=FRONTIERS[region]?.depot||{x:0,y:0};
 const g={world:w,player:{...depot,r:19,hp:110,level:5},time:500,
  enemies:[],groupSerial:0,enemySerial:0,notices:[],notice(m){this.notices.push(m);},
  camera:()=>({x:0,y:0,w:1200,h:800}),
  spawnGroup(){
   for(let i=0;i<director.groupSize;i++)this.enemies.push({type:i?'fighter':'scout',
    hp:i?180:110,maxHp:i?180:110});
   return 1.1;
  }};
 const s=region?w.regionalSupply.frontier[region]:w.regionalSupply;
 s.pendingRaid={announced:true,readyAt:490};
 return {g,s};
}
test('at 500 seconds a paid frontier convoy makes the encounter strictly stronger, never weaker',()=>{
 for(const id of ['azure','teal']){
  const baseline=encounter(id),funded=encounter(id);
  baseline.g.spawnGroup();
  assert.ok(spawnFrontierRaid(funded.g,director));
  assert.equal(funded.g.enemies.length,baseline.g.enemies.length+1);
  assert.deepEqual(funded.g.enemies.slice(0,4),baseline.g.enemies);
  assert.ok(funded.g.enemies.reduce((n,e)=>n+e.hp,0)>
   baseline.g.enemies.reduce((n,e)=>n+e.hp,0));
  const added=funded.g.enemies.at(-1);
  assert.equal(added.type,FRONTIERS[id].reinforcement);
  assert.ok(Math.abs(added.hp-ENEMY_TYPES[added.type].hp*(1+500/550))<.001,
   'a funded specialist must receive the exact late-game health multiplier');
  assert.equal(funded.s.pendingRaid,null);
  assert.equal(funded.s.raids,1);
  assert.equal(baseline.s.raids,0);
 }
});
test('a heavy delivery adds one real heavy ship; a full director cap does not consume it',()=>{
 const {g,s}=encounter();
 assert.equal(spawnRegionalRaid(g,{...director,cap:4}),false);
 assert.equal(s.pendingRaid.readyAt,490);
 assert.equal(g.enemies.length,0);
 assert.ok(spawnRegionalRaid(g,director));
 assert.equal(g.enemies.length,5);
 const heavy=g.enemies.at(-1);
 assert.equal(heavy.type,'gunship');
 assert.ok(heavy.hp>100);
 assert.equal(s.raids,1);
});
test('industrial radio interference delays funded raids in the northern and frontier networks without deleting their stock',()=>{
 for(const id of ['azure','teal']){
  const {g,s}=encounter(id),depot=g.world.stations.get(FRONTIERS[id].depotId);
  depot.fluxJamUntil=540;
  assert.equal(spawnFrontierRaid(g,director),false,`${id}: disrupted radio cannot dispatch a funded ship`);
  assert.ok(s.pendingRaid?.announced);assert.equal(s.raids,0);
  assert.equal(g.enemies.length,0);
  g.time=541;
  assert.ok(spawnFrontierRaid(g,director),`${id}: cargo-paid ship can depart when the radio returns`);
  assert.equal(s.pendingRaid,null);assert.equal(s.raids,1);
 }
 const {g,s}=encounter(),military=g.world.stations.get(SUPPLY.militaryId);
 military.fluxJamUntil=540;
 assert.equal(spawnRegionalRaid(g,director),false);
 assert.equal(s.pendingRaid.readyAt,490);assert.equal(s.raids,0);
 g.time=541;
 assert.ok(spawnRegionalRaid(g,director));
 assert.equal(s.pendingRaid,null);assert.equal(s.raids,1);
});
test('all cargo, workers and salvage get actual player-facing target labels',()=>{
 assert.equal(designationLabel({kind:'enemy',target:{regionalCargo:true,type:'fighter'}}),'Рудный транспорт');
 assert.equal(designationLabel({kind:'enemy',target:{centralCargo:true,type:'fighter'}}),'Местный грузовой транспорт');
 assert.equal(designationLabel({kind:'enemy',target:{frontierCargo:true,frontierNetwork:'azure',type:'fighter'}}),'Энерготранспорт');
 assert.equal(designationLabel({kind:'enemy',target:{frontierCargo:true,frontierNetwork:'teal',type:'fighter'}}),'Транспорт запчастей');
 assert.equal(designationLabel({kind:'enemy',target:{centralWorker:true}}),'Шахтёрский дрон');
 assert.equal(designationLabel({kind:'enemy',target:{frontierWorker:true}}),'Рабочий утилизационного комбината');
 assert.equal(designationLabel({kind:'enemy',target:{frontierSalvage:true}}),'Залежь обломков');
 assert.equal(TARGET_DESIGNATION.duration,14);
});
test('regional briefing exposes challenges and outcomes before the navigation action',()=>{
 const w=new World(),g={world:w,player:{x:0,y:0},waypoint:null};
 const html=renderRegionAtlas(g);
 assert.equal((html.match(/class="region-card"/g)||[]).length,5);
 assert.match(html,/Зачем лететь:/);
 assert.match(html,/Подготовка:/);
 assert.match(html,/Что изменится:/);
 assert.match(html,/Построить маршрут к ориентиру/);
 assert.match(html,/маршевый перелёт/i);
 assert.doesNotMatch(html,/frontier:azure:depot|frontier:teal:source/,
  'unexplored bases are never revealed through their exact identifiers');
});
function trip(){return {player:{x:0,y:0,r:19,burstRemaining:0},
 waypoint:{id:'region-azure',x:26500,y:0},time:0,lastDamageAt:-Infinity,
 enemies:[],shots:[],zones:[],world:{nearbyStations:()=>[]},mining:{active:false}};}
test('cruise requires sustained manual flight to a distant region and ends on a threat',()=>{
 const g=trip(),c=EXPEDITION_CRUISE;
 assert.equal(cruiseSafe(g,0,1),false,'flying away from the waypoint cannot trigger cruise');
 assert.equal(updateCruise(g,1,0,c.warmup-.1),false);
 assert.equal(g.cruising,false);
 assert.equal(updateCruise(g,1,0,.11),true);
 assert.equal(g.cruising,true);
 assert.equal(updateCruise(g,1,0,3),false,'do not announce repeatedly');
 g.enemies=[{x:500,y:0,hp:30}];
 updateCruise(g,1,0,.01);assert.equal(g.cruising,false);
 g.enemies=[];g.world.nearbyStations=()=>[{enemy:true,captured:false}];
 assert.equal(cruiseSafe(g,1,0),false);
 g.world.nearbyStations=()=>[];
 g.regionalStormFields=[{x:100,y:0,r:480}];
 assert.equal(cruiseSafe(g,1,0),false);
 g.regionalStormFields=[];g.holdFire=true;
 assert.equal(cruiseSafe(g,1,0),false);
 g.holdFire=false;g.operation={id:'relay-defense'};
 assert.equal(cruiseSafe(g,1,0),false);
 g.operation=null;g.waypoint={id:'region-azure',x:1700,y:0};
 assert.equal(cruiseSafe(g,1,0),false,'cruise ends before arrival');
});
test('the distance benefit stays stable at 30 and 60 simulation ticks',()=>{
 function fly(dt){
  const g=trip();let elapsed=0;
  while(g.player.x<g.waypoint.x-EXPEDITION_CRUISE.arrivalDistance&&elapsed<180){
   updateCruise(g,1,0,dt);
   g.player.x+=272*(g.cruising?EXPEDITION_CRUISE.multiplier:1)*dt;
   g.time+=dt;elapsed+=dt;
  }
  return elapsed;
 }
 const ten=fly(1/10),thirty=fly(1/30),sixty=fly(1/60);
 assert.ok(thirty<53&&thirty>40,'cruise shortens a long empty flight without teleporting');
 assert.ok(Math.abs(thirty-sixty)<.1);
 assert.ok(Math.abs(ten-sixty)<.25,'low FPS cannot create a major travel advantage');
 assert.ok(thirty<((26500-EXPEDITION_CRUISE.arrivalDistance)/272)*.65);
});
