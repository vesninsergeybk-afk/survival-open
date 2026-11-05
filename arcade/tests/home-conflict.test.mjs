import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {openingThreat} from '../balance.js';
import {advanceRegionalSupply,strategicCapture} from '../regional-supply.js';
import {CENTRAL_INDUSTRY,centralCargoPosition,centralStrategy,centralIndustryValid} from '../central-industry.js';
import {updateRegionalWorld,spawnCentralRaid,hitRegionalCargo} from '../region-runtime.js';
import {homeIndustryState,homeConflictPressure,homeConflictTarget,homeConflictCue,
 updateHomeConflict,renderHomeConflict} from '../home-conflict.js';
import {RuntimeHarness} from './runtime-game.mjs';

const noop=()=>{};
function game(){
 const g=new RuntimeHarness();
 Object.assign(g,{world:new World(),player:{x:360,y:-85,hp:110,maxHp:110},
  time:0,enemies:[],enemySerial:0,groupSerial:0,notices:[],
  openingArc:{status:'skipped'},notice:text=>g.notices.push(text),
  heritage:{play:noop,vfx:{hullImpact:noop,shipExplosion:noop}},addDrop:noop,
  camera:()=>({x:-240,y:-485,w:1200,h:800}),
  spawnGroup(d){for(let i=0;i<d.groupSize&&g.enemies.length<d.cap;i++)
   g.enemies.push({hp:25,scenario:'ambient'});return 0;}});
 return g;
}

test('home pressure stays bounded over hours; starving and capturing have lasting distinct effects',()=>{
 const g=game(),p=g.player,w=g.world;
 const at=t=>homeConflictPressure(openingThreat(t,25),w,p);
 assert.equal(at(0).cap,0);
 assert.equal(at(800).cap,14);assert.equal(at(8000).cap,14);
 assert.ok(at(8000).interval>=6.5);
 const far={x:35000,y:7000},raw=openingThreat(8000,25);
 assert.deepEqual(homeConflictPressure(raw,w,far),raw);
 w.regionalSupply.central.worker.hp=0;
 assert.equal(at(8000).cap,9);assert.ok(at(8000).interval>=10);
 const depot=w.stations.get(CENTRAL_INDUSTRY.depotId);
 depot.enemy=false;strategicCapture(w,depot,0);
 assert.equal(at(8000).cap,7);assert.ok(at(8000).interval>=12);
});

test('ten minutes of actual deliveries create funded sorties; interception eliminates these sorties',()=>{
 const simulate=intercept=>{
  const g=game(),s=g.world.regionalSupply.central;
  for(let time=1;time<=600;time++){
   g.time=time;updateRegionalWorld(g,1);
   if(intercept)for(const cargo of [...s.convoys])hitRegionalCargo(g,cargo,1000);
   if(time%7===0){
    const d=homeConflictPressure(openingThreat(time,6),g.world,g.player);
    spawnCentralRaid(g,d);
    g.enemies=[]; // same player clears each encounter in both simulations
   }
  }
  assert.ok(centralIndustryValid(s,600));return s;
 };
 const passive=simulate(false),blockade=simulate(true);
 assert.ok(passive.delivered>=3);assert.ok(passive.raids>=3);
 assert.equal(blockade.delivered,0);assert.equal(blockade.raids,0);
 assert.ok(blockade.intercepted>=2);
 assert.ok(blockade.produced>0,'the living source still mines; a blockade needs repeated action');
});

test('source capture preserves a paid delivery; depot capture cancels the paid sortie immediately',()=>{
 const g=game(),w=g.world,s=w.regionalSupply.central;
 advanceRegionalSupply(w,140);g.time=140;
 assert.equal(s.convoys.length,1);
 const source=w.stations.get(CENTRAL_INDUSTRY.sourceId);
 source.enemy=false;strategicCapture(w,source,g.time);
 assert.equal(homeIndustryState(w).outcome,null,'the in-flight cargo is still dangerous');
 g.time=220;updateRegionalWorld(g,80);
 assert.ok(s.delivered>0);assert.ok(s.pendingRaid?.announced);
 assert.equal(homeIndustryState(w).outcome,null);
 const depot=w.stations.get(CENTRAL_INDUSTRY.depotId);
 depot.enemy=false;strategicCapture(w,depot,g.time);
 assert.equal(s.pendingRaid,null);assert.equal(s.reserves,0);
 assert.equal(homeIndustryState(w).outcome,'captured');
 assert.equal(spawnCentralRaid(g,{cap:14,groupSize:2,types:['fighter']}),false);
});

test('cutting off the worker only secures the sector after all paid reserves are spent',()=>{
 const g=game(),s=g.world.regionalSupply.central;
 s.worker.hp=0;s.reserves=1;s.assemblyUntil=1;
 g.time=10;updateRegionalWorld(g,1);assert.ok(s.pendingRaid);
 assert.equal(homeIndustryState(g.world).outcome,null);
 g.time=31;assert.ok(spawnCentralRaid(g,{cap:14,groupSize:2,types:['fighter']}));
 updateHomeConflict(g);
 assert.equal(homeIndustryState(g.world).outcome,'starved');
 assert.equal(g.enemies.filter(e=>e.scenario==='central-funded').length,3,
  'securing future supply never erases the already launched assault');
});

test('enemy responses require mined resources; route changes affect only future cargo',()=>{
 const g=game(),s=g.world.regionalSupply.central;
 s.worker.hp=0;s.worker.phase='disabled';
 Object.assign(centralStrategy(s),{losses:1,planUntil:18});
 advanceRegionalSupply(g.world,30);
 assert.equal(s.strategy.screened,false,'a command cannot buy protection with no materials');
 s.ore=4;advanceRegionalSupply(g.world,31);
 assert.equal(s.ore,0);assert.equal(s.strategy.screened,true);
 const cargo={id:'central-cargo-1',centralCargo:true,regionalCargo:true,
  route:'direct',speed:CENTRAL_INDUSTRY.cargoSpeed,distance:0,launchedAt:32,hp:115,maxHp:115,r:29};
 s.convoys=[cargo];s.serial=1;s.ore=4;
 s.strategy.losses=2;s.strategy.planUntil=33;
 advanceRegionalSupply(g.world,33);
 assert.equal(s.strategy.rerouted,true);assert.equal(s.ore,0);
 assert.equal(cargo.route,'direct');
 assert.deepEqual({x:cargo.x,y:cargo.y},
  (({x,y})=>({x,y}))(centralCargoPosition(CENTRAL_INDUSTRY.cargoSpeed,'direct')));
 assert.notDeepEqual(centralCargoPosition(1000,'direct'),centralCargoPosition(1000,'diversion'));
 assert.ok(centralIndustryValid(s,33));
});

test('the plan offers an approximate survey, never exact unknown stations or invisible cargo',()=>{
 const g=game();
 assert.equal(renderHomeConflict(g),'');assert.equal(homeConflictTarget(g,'survey'),null);
 g.time=150;updateHomeConflict(g);
 const survey=homeConflictTarget(g,'survey'),source=g.world.stations.get(CENTRAL_INDUSTRY.sourceId);
 assert.equal(survey.id,'conflict:source');assert.notEqual(survey.x,source.x);
 assert.equal(source.discovered,false);assert.equal(homeConflictTarget(g,'depot'),null);
 advanceRegionalSupply(g.world,140);
 assert.ok(g.world.regionalSupply.central.convoys.length);
 assert.equal(homeConflictTarget(g,'intercept'),null);
 const cargo=g.world.regionalSupply.central.convoys[0];cargo.seen=true;
 assert.equal(homeConflictTarget(g,'intercept').id,cargo.id);
 source.discovered=true;
 assert.equal(homeConflictTarget(g,'depot').id,'conflict:depot');
 assert.match(renderHomeConflict(g),/ЦЕЛЬ РЕГИОНА/);
 assert.match(homeConflictCue(g),/до доставки/);
});

test('new regional goal waits for the first dilemma, and never hijacks a player route',()=>{
 const g=game();g.time=160;g.openingArc.status='active';
 updateHomeConflict(g);assert.equal(g.world.regionalSupply.central.conflict.offeredAt,null);
 g.openingArc.status='complete';g.waypoint={id:'personal',x:100,y:100};
 updateHomeConflict(g);assert.equal(g.waypoint.id,'personal');
 g.world.regionalSupply.central.conflict.plan='survey';
 g.waypoint=homeConflictTarget(g,'survey');
 const source=g.world.stations.get(CENTRAL_INDUSTRY.sourceId);source.discovered=true;
 updateHomeConflict(g);assert.equal(g.waypoint.id,source.id);
});

test('a cancelled hangar departure does not commit the new regional plan',()=>{
 const g=game();g.time=150;updateHomeConflict(g);
 Object.assign(g,{dead:false,overlay:{hidden:false,dataset:{mode:'base'}},docked:g.world.home,
  stationExitArmed:true,hangarSession:{dirty:()=>true},askDepartureConfirmation(){g.asked=true;}});
 assert.equal(g.chooseConflictPlan('survey'),true);assert.equal(g.asked,true);
 assert.equal(g.world.regionalSupply.central.conflict.plan,null);
 assert.equal(g.pendingWaypointSelection.waypoint.conflictPlan,'survey');
});
test('a paid sortie can depart at the background cap, while the total remains bounded',()=>{
 const g=game(),s=g.world.regionalSupply.central;g.time=200;
 s.pendingRaid={announced:true,readyAt:190};
 g.enemies=Array.from({length:14},()=>({hp:25,scenario:'ambient'}));
 assert.ok(spawnCentralRaid(g,{cap:14,groupSize:2,types:['fighter']}));
 assert.equal(g.enemies.length,17);assert.equal(s.raids,1);
 assert.equal(g.enemies.filter(e=>e.scenario==='central-funded').length,3);
});
test('legacy transports retain their speed after loading, with no backward teleport',()=>{
 const g=game(),s=g.world.regionalSupply.central;
 s.clock=100;
 const cargo={id:'central-cargo-1',centralCargo:true,regionalCargo:true,
  distance:2100,launchedAt:90,...centralCargoPosition(2100),hp:115,maxHp:115,r:29};
 s.convoys=[cargo];s.serial=1;
 advanceRegionalSupply(g.world,101);
 assert.equal(cargo.distance,2310);assert.ok(centralIndustryValid(s,101));
});
test('the real director preserves opening consequences and local captured-sector relief',()=>{
 const g=game();delete g.spawnGroup;g.time=200;g.enemyBasesUnlocked=()=>true;
 const wave=openingThreat(g.time,6);
 g.openingArc={status:'complete',alarmUntil:300};
 const alarm=g.sectorDirector(wave);
 g.openingArc={status:'complete',reliefUntil:300};
 const relief=g.sectorDirector(wave);
 assert.ok(alarm.cap>relief.cap);assert.ok(alarm.interval<relief.interval);
});
