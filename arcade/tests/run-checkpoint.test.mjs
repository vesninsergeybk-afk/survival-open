import {EnemyComms} from '../enemy-comms.js';
import {SpatialGrid,STARTER_COMBAT} from '../balance.js';
import {createFieldLoan} from '../field-weapons.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {ruinEnemyIndustry,claimRuinedIndustry} from '../enemy-station-salvage.js';
import {orderFrontierNetwork,advanceFrontierNetwork} from '../enemy-frontier-network.js';
import {advanceRegionalSupply} from '../regional-supply.js';
import {FRONTIERS} from '../frontier-industry.js';
import {createLoadout,createThermal} from '../ship-loadout.js';
import {createCorridorOperation} from '../operations.js';
import {createCarrierInterception} from '../carrier-interception.js';
import {createIonLoan} from '../ion-conductor.js';
import {RUN_KEYS,MAX_CHECKPOINT_LENGTH,RunCheckpointStore,captureCheckpoint,restoreCheckpoint,packRun,unpackRun,validateCheckpoint} from '../run-checkpoint.js';
import {updatePopulationWorld} from '../population-runtime.js';
import {startSortie,finishSortie,appendSortieReport} from '../sortie-economy.js';
import {emptyEconomyExpenses,recordEconomyExpense} from '../sortie-ledger.js';
import {transitCost} from '../base-panel.js';
import {createOpeningArc,beginOpeningArc} from '../opening-arc.js';
import {advanceEnemyExpansion,enemyTerritoryFields} from '../enemy-expansion.js';
import {createFieldLoot} from '../field-loot.js';
import {createCombatTempo} from '../combat-tempo.js';
import {advanceEnemyFortifications} from '../enemy-fortifications.js';
import {createStrategicExperience,claimStationActivation,claimStationCapture,
 claimExploration,claimStrategicSabotage} from '../strategic-experience.js';

const entry=new URL('../game.js',import.meta.url);
const source=readFileSync(entry,'utf8').replace(/\nnew ArcadeGame\(\);\s*$/,'\n')
 .replace(/from '(\.[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,entry).href));
const {ArcadeGame}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const noop=()=>{};
const memory=()=>({values:new Map(),getItem(k){return this.values.get(k)||null;},setItem(k,v){this.values.set(k,v);}});
function scene(){
 const g=Object.create(ArcadeGame.prototype),world=new World(20261102),base=world.home;
 base.active=true;base.discovered=true;world.discovered.add(base.id);
 Object.assign(g,{seed:world.seed,world,docked:base,paused:true,dead:false,
  player:{x:base.x+55,y:base.y+30,vx:0,vy:0,r:19,hp:73,maxHp:STARTER_COMBAT.hull,
   shield:0,xp:30,level:1,points:0,ore:20,data:30,invul:0,angle:0},
  shipLoadout:createLoadout(),skillRanks:{beam:0,double:0,range:0,rocket:0,hull:0,engine:0,shield:0,
   dodge:0,magnet:0,mining:0,extractor:0,radar:0,tactics:0},
  weaponThermal:createThermal(),moduleClocks:{rail:0,flak:0},network:{armor:0,armament:0,engine:0,strikePower:0},
  support:{charges:1,cooldown:7,missions:[]},time:243.5,spawnClock:3.4,
  enemies:[],allies:[],shots:[],missiles:[],drops:[],flashes:[],zones:[],hacks:[],
  contract:null,operation:null,fieldLoan:null,fieldTrialTaken:false,ionMasteryAwarded:false,
  lastDamageAt:-Infinity,fieldReturnAt:-Infinity,activeBases:1,
  keys:new Set(),touch:{x:0,y:0},overlay:{hidden:false,dataset:{mode:'base'}},
  cockpit:{resourceGain:noop},heritage:{play:noop,station:noop,vfx:{nova:noop}},notice:noop});
 return g;
}
function save(g,storage=memory()){
 const store=new RunCheckpointStore(storage,()=>1234);store.load();assert.ok(store.startNew().ok);
 assert.ok(store.save(captureCheckpoint(g,g.docked)).ok);return {storage,store};
}
test('damaged hostile frontier and neutral ruins survive checkpoint validation and restoration',()=>{
 const g=scene(),c=g.world.population.colonies.find(c=>c.tier===1&&!c.fronts.length);
 const front=orderFrontierNetwork(g.world,c,{x:c.x+3700,y:c.y},g.time);
 assert.ok(front);
 advanceFrontierNetwork(g.world,c,g.time+8);
 const station=g.world.stations.get(c.id+':factory');
 assert.equal(ruinEnemyIndustry(station,g.time),true);
 assert.equal(station.suppressed,false,'ruins do not forge a perpetual suppression timer');
 const snapshot=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.equal(validateCheckpoint(snapshot),true);
 const restored=scene();restoreCheckpoint(restored,snapshot);
 assert.equal(restored.world.stations.get(station.id).ruined,true);
 assert.equal(restored.world.stations.get(station.id).captured,false);
 assert.equal(restored.world.population.colonies.find(x=>x.id===c.id).fronts.length,1);
 const fake=unpackRun(packRun(snapshot));
 fake.world.population.colonies.find(x=>x.id===c.id).fronts[0].nodes[2].colonyId='colony:alien:77';
 assert.equal(validateCheckpoint(fake),false,'corrupt foreign buoy must be rejected');
});
test('a lethal hit before the next frame cannot invalidate a station checkpoint',()=>{
 const g=scene(),e={serial:1,type:'fighter',x:g.player.x+100,y:g.player.y,
  r:14,hp:10,maxHp:70,expAwarded:false};
 g.enemies=[e];g.enemyCanSee=()=>false;g.heritage.vfx.hullImpact=noop;
 g.damageEnemy(e,30,'ion');
 assert.equal(e.hp,0,'dead enemies must never have negative HP');
 const {storage}=save(g),fresh=scene();
 restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 assert.equal(fresh.enemies[0].hp,0);
 assert.equal(fresh.enemies[0].expAwarded,false,
  'the next update, not the hit, awards experience');
 assert.equal(fresh.player.data,30,'no premature reward');
});
test('a saved sortie retains collected temporary charges, combat pacing and paid unfinished enemy works',()=>{
 const g=scene();g.time=310;
 g.fieldLoot=createFieldLoot();g.fieldLoot.reserve={id:'arc',until:375};
 g.combatTempo=createCombatTempo();g.combatTempo.encounters=2;
 g.combatTempo.lastContactAt=300;g.combatTempo.quietUntil=323;
 g.world.regionalSupply.central.ore=16;
 advanceEnemyFortifications(g.world,310);
 const enemy=g.world.stations.get('industry:depot');
 assert.equal(enemy.turrets.at(-1).kind,'construction');
 const snapshot=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.equal(validateCheckpoint(snapshot),true);
 const old=unpackRun(packRun(snapshot));
 delete old.state.fieldLoot;delete old.state.combatTempo;
 assert.equal(validateCheckpoint(old),true,'older saves may omit both systems');
 const restored=scene();restoreCheckpoint(restored,snapshot);
 assert.deepEqual(restored.fieldLoot.reserve,{id:'arc',until:375});
 assert.equal(restored.combatTempo.encounters,2);
 assert.equal(restored.world.stations.get(enemy.id).turrets.at(-1).kind,'construction');
 const paid=restored.world.regionalSupply.central.ore;
 assert.equal(advanceEnemyFortifications(restored.world,349)
  .find(e=>e.front==='home')?.kind,'completed');
 assert.equal(restored.world.regionalSupply.central.ore,paid,'completion does not charge a second time');
 const legacy=scene();restoreCheckpoint(legacy,old);
 assert.equal(legacy.fieldLoot.version,1);
 assert.equal(legacy.combatTempo.version,1);
 const forged=unpackRun(packRun(old));
 forged.world.stations.find(([id])=>id===enemy.id)[1].fortification.stage=11;
 assert.equal(validateCheckpoint(forged),false);
});
test('a map marker survives save and leaves the mission waypoint untouched',()=>{
 const g=scene();
 g.waypoint={id:'mission:relay',x:1200,y:800,label:'Сигнал задания'};
 g.manualWaypoint={id:'map:manual',x:1471,y:-620,label:'Моя метка'};
 const data=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.ok(validateCheckpoint(data));
 const restored=scene();restoreCheckpoint(restored,data);
 assert.deepEqual(restored.manualWaypoint,g.manualWaypoint);
 assert.deepEqual(restored.waypoint,g.waypoint);
 const forged=unpackRun(packRun(data));forged.state.manualWaypoint.x=Infinity;
 assert.equal(validateCheckpoint(forged),false);
 const legacy=unpackRun(packRun(data));delete legacy.state.manualWaypoint;
 assert.ok(validateCheckpoint(legacy));
});

test('artillery magazines and reserved flux packets survive a real dock checkpoint',()=>{
 const g=scene(),state=g.world.contours;
 state.flux=72.75;state.artillerySerial=1;
 state.artillery=[{id:1,kind:'flux-artillery',x:g.player.x+240,y:g.player.y+80,
  r:28,hp:110,maxHp:110,ammo:4,chargeCredit:.13,readyAt:120,
  nextShotAt:250,aimingUntil:0,aimX:g.player.x+280,aimY:g.player.y+80,
  mode:'group',lastShotAt:230,lastImpactAt:230,gunAngle:.8,
  lastImpactX:g.player.x+280,lastImpactY:g.player.y+80}];
 state.artilleryPackets=[{turretId:1,edgeId:'node-a|node-b',amount:.5,charges:2,
  launchedAt:242,arriveAt:246,path:[{x:100,y:100},{x:200,y:100},
   {x:state.artillery[0].x,y:state.artillery[0].y}]}];
 state.artilleryShells=[{turretId:1,startX:state.artillery[0].x,startY:state.artillery[0].y,
  targetX:state.artillery[0].aimX,targetY:state.artillery[0].aimY,
  launchedAt:243,arriveAt:243.35}];
 const saved=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.equal(validateCheckpoint(saved),true);
 const restored=scene();restoreCheckpoint(restored,saved);
 assert.equal(restored.world.contours.flux,72.75);
 assert.equal(restored.world.contours.artillery[0].ammo,4);
 assert.equal(restored.world.contours.artillery[0].mode,'group');
 assert.equal(restored.world.contours.artillery[0].gunAngle,.8);
 assert.equal(restored.world.contours.artilleryPackets[0].charges,2);
 assert.equal(restored.world.contours.artilleryPackets[0].amount,.5);
 assert.equal(restored.world.contours.artilleryShells.length,1);
 assert.equal(restored.world.contours.artilleryShells[0].targetX,state.artilleryShells[0].targetX);
 const forged=unpackRun(packRun(saved));
 forged.world.contours.artilleryPackets[0].charges=99;
 assert.equal(validateCheckpoint(forged),false);
 const old=unpackRun(packRun(saved));
 delete old.world.contours.artillery;delete old.world.contours.artilleryPackets;
 delete old.world.contours.artilleryShells;
 delete old.world.contours.artillerySerial;
 assert.equal(validateCheckpoint(old),true);
 const oldRestored=scene();restoreCheckpoint(oldRestored,old);
 assert.deepEqual(oldRestored.world.contours.artillery,[]);
 assert.deepEqual(oldRestored.world.contours.artilleryShells,[]);
});

test('field mission attempts, full wins and bounded results survive a station checkpoint',()=>{
 const g=scene(),base=g.docked;
 base.fieldOperationRuns={'line-break':3};
 base.fieldOperationFullRuns={'line-break':1};
 base.fieldOperationAttempts={'line-break':5};
 base.fieldOperationHistory=[{id:'line-break',full:false,seconds:104,
  tier:0,convoyHp:null}];
 const saved=unpackRun(packRun(captureCheckpoint(g,base)));
 assert.ok(validateCheckpoint(saved));
 const restored=scene();restoreCheckpoint(restored,saved);
 const station=restored.world.home;
 assert.deepEqual(station.fieldOperationFullRuns,{'line-break':1});
 assert.deepEqual(station.fieldOperationAttempts,{'line-break':5});
 assert.deepEqual(station.fieldOperationHistory,base.fieldOperationHistory);
 const forged=unpackRun(packRun(saved));
 const broken=forged.world.stations.find(([id])=>id===base.id)[1];
 broken.fieldOperationHistory[0].tier=10;
 assert.equal(validateCheckpoint(forged),false,
  'implausible mission history must not corrupt a resumed game');
});
test('strategic XP claims survive a checkpoint and older saves backfill visible past achievements',()=>{
 const g=scene(),site=g.world.stations.get('industry:source');
 site.enemy=false;site.active=true;site.captured=true;site.discovered=true;
 site.supplyIntercepted=true;g.world.discovered.add(site.id);
 g.player.strategicXp=createStrategicExperience();
 assert.ok(claimStationActivation(g.player,site)>0);
 assert.ok(claimStationCapture(g.player,site)>0);
 assert.ok(claimExploration(g.player,site)>0);
 assert.ok(claimStrategicSabotage(g.player,'carrier',site.id)>0);
 const checkpoint=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.ok(validateCheckpoint(checkpoint));
 const restored=scene();restoreCheckpoint(restored,checkpoint);
 assert.deepEqual(restored.player.strategicXp,g.player.strategicXp);
 assert.equal(claimStationActivation(restored.player,restored.world.stations.get(site.id)),0);
 assert.equal(claimStationCapture(restored.player,restored.world.stations.get(site.id)),0);
 assert.equal(claimExploration(restored.player,restored.world.stations.get(site.id)),0);
 assert.equal(claimStrategicSabotage(restored.player,'carrier',site.id),0);

 const legacy=unpackRun(packRun(checkpoint));delete legacy.state.player.strategicXp;
 assert.ok(validateCheckpoint(legacy),'old saves without a milestone ledger remain readable');
 const migrated=scene();restoreCheckpoint(migrated,legacy);
 assert.equal(migrated.player.level,legacy.state.player.level);
 assert.equal(migrated.player.xp,legacy.state.player.xp);
 assert.equal(claimStationActivation(migrated.player,migrated.world.stations.get(site.id)),0);
 assert.equal(claimStationCapture(migrated.player,migrated.world.stations.get(site.id)),0);
 assert.equal(claimExploration(migrated.player,migrated.world.stations.get(site.id)),0);
 assert.equal(claimStrategicSabotage(migrated.player,'carrier',site.id),0);
 const tampered=unpackRun(packRun(checkpoint));tampered.state.player.strategicXp.captures.push('fake');
 assert.equal(validateCheckpoint(tampered),false);
});
test('an early pass-two checkpoint with free home milestones recovers its XP capacity on load',()=>{
 const g=scene();g.player.strategicXp=createStrategicExperience();
 g.player.strategicXp.activations.push('0:0');
 g.player.strategicXp.exploration.push('0:0');
 const checkpoint=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.ok(validateCheckpoint(checkpoint),'the previously published ledger format remains accepted');
 const restored=scene();restoreCheckpoint(restored,checkpoint);
 assert.deepEqual(restored.player.strategicXp.activations,[]);
 assert.deepEqual(restored.player.strategicXp.exploration,[]);
 assert.equal(restored.player.xp,g.player.xp);
 assert.equal(restored.player.level,g.player.level);
});
test('a legacy save with three powered stations closes its missing triangle on load without duplicated rewards',()=>{
 const old=scene(),w=old.world;
 for(const [x,y] of [[1,0],[0,-1]]){
  const node=w.station(x,y);node.active=true;node.enemy=false;node.discovered=true;
  w.discovered.add(node.id);
 }
 w.contours.links=[['0:0','1:0'],['1:0','0:-1']];
 const snapshot=unpackRun(packRun(captureCheckpoint(old,old.docked)));
 assert.ok(validateCheckpoint(snapshot));
 const restored=scene();restoreCheckpoint(restored,snapshot);
 assert.equal(restored.world.contours.links.length,3);
 assert.equal(restored.world.contours.flux,0);
 assert.equal(restored.player.xp,old.player.xp);
 assert.equal(restored.player.level,old.player.level);
 assert.equal(restored.player.strategicXp.firstContour,true);
});
test('enemy territorial investments survive docking without spending twice, and old checkpoints load',()=>{
 const g=scene(),w=g.world;
 const initial=w.enemyExpansion.links.length;
 w.regionalSupply.central.ore=14;
 advanceEnemyExpansion(w,90);
 assert.equal(w.enemyExpansion.links.length,initial+1);
 const funds=w.regionalSupply.central.ore;
 const snapshot=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.ok(validateCheckpoint(snapshot));
 const restored=scene();restoreCheckpoint(restored,snapshot);
 assert.deepEqual(restored.world.enemyExpansion,w.enemyExpansion);
 assert.equal(restored.world.regionalSupply.central.ore,funds);
 advanceEnemyExpansion(restored.world,90);
 assert.equal(restored.world.regionalSupply.central.ore,funds);
 const old=unpackRun(packRun(snapshot));delete old.world.enemyExpansion;
 assert.ok(validateCheckpoint(old));
 const legacy=scene();restoreCheckpoint(legacy,old);
 assert.equal(legacy.world.enemyExpansion.links.length,initial);
 const tampered=unpackRun(packRun(snapshot));
 tampered.world.enemyExpansion.links[0][1]='fake-unseen-station';
 assert.equal(validateCheckpoint(tampered),false);
});
test('a new colony keeps damaged factories, ship reserves, cargo and siege state after docking',()=>{
 const game=scene(),world=game.world,c=world.population.colonies.find(k=>k.fortress);
 advanceRegionalSupply(world,game.time);
 c.ready-=8;c.pool=32;
 c.shield.segments[0].hp=180;
 world.stations.get(c.id+':factory').hp-=64;
 const saved=unpackRun(packRun(captureCheckpoint(game,game.docked)));
 assert.ok(validateCheckpoint(saved));
 const restored=scene();restoreCheckpoint(restored,saved);
 const copy=restored.world.population.colonies.find(k=>k.id===c.id);
 assert.equal(copy.ready,c.ready);
 assert.equal(copy.pool,32);
 assert.equal(copy.shield.segments[0].hp,180);
 assert.equal(restored.world.stations.get(c.id+':factory').hp,
  world.stations.get(c.id+':factory').hp);
 assert.equal(restored.world.populationStations.length,1500);
});
test('the 30-colony checkpoint expands without refilling previously damaged industry',()=>{
 const g=scene(),save=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 const keep=new Set(save.world.population.colonies.filter(c=>c.index<6).map(c=>c.id));
 save.world.population.colonies=save.world.population.colonies.filter(c=>keep.has(c.id));
 save.world.stations=save.world.stations.filter(([id,b])=>!b.colonyId||keep.has(b.colonyId));
 const existing=new Set(save.world.stations.map(([id])=>id));
 save.world.enemyExpansion.links=save.world.enemyExpansion.links.filter(([a,b])=>
  existing.has(a)&&existing.has(b));
 const damaged=save.world.population.colonies[0];
 damaged.pool=7;damaged.ready=2;
 assert.ok(validateCheckpoint(save),'previous 30-colony format stays valid');
 const earlierLinks=save.world.enemyExpansion.links.length;
 const restored=scene();restoreCheckpoint(restored,save);
 assert.equal(restored.world.population.colonies.length,300);
 assert.equal(restored.world.stations.get('colony:amethyst:59:factory')?.enemy,true);
 const original=restored.world.population.colonies.find(c=>c.id===damaged.id);
 assert.equal(original.pool,7);assert.equal(original.ready,2);
 assert.ok(restored.world.enemyExpansion.links.length>earlierLinks);
 assert.ok(validateCheckpoint(unpackRun(packRun(captureCheckpoint(restored,restored.docked)))));
});
test('one hour of heavy fleet production remains a compact, restorable checkpoint',()=>{
 const g=scene();g.camera=()=>({x:-700,y:-480,w:1400,h:960});
 for(let t=30;t<=3600;t+=30){g.time=t;updatePopulationWorld(g,30);}
 const saved=captureCheckpoint(g,g.docked);
 assert.ok(validateCheckpoint(saved));
 const body=packRun(saved);
 assert.ok(body.length<MAX_CHECKPOINT_LENGTH/1.5,
  `two-slot storage must retain headroom: ${body.length} characters`);
 const restored=scene();restoreCheckpoint(restored,unpackRun(body));
 assert.equal(restored.world.population.clock,3600);
 assert.deepEqual(restored.world.population.convoys,g.world.population.convoys);
 assert.equal(restored.world.population.colonies.reduce((n,c)=>n+c.sorties.length,0),
  g.world.population.colonies.reduce((n,c)=>n+c.sorties.length,0));
 assert.ok(validateCheckpoint(unpackRun(packRun(captureCheckpoint(restored,restored.docked)))));
});
test('frontier economy, finite wrecks and new station IDs survive a real checkpoint roundtrip',()=>{
 const g=scene();advanceRegionalSupply(g.world,g.time);
 const source=g.world.stations.get(FRONTIERS.teal.sourceId);
 source.discovered=true;g.world.discovered.add(source.id);
 const state=g.world.regionalSupply.frontier;
 assert.ok(state.azure.delivered>0);
 assert.ok(state.teal.wrecks.some(c=>c.stock<c.maxStock));
 const checkpoint=captureCheckpoint(g,g.docked);
 assert.ok(validateCheckpoint(checkpoint),'frontier state remains valid when saved mid-harvest');
 const decoded=unpackRun(packRun(checkpoint));
 const restored=scene();restoreCheckpoint(restored,decoded);
 assert.deepEqual(restored.world.regionalSupply.frontier,state);
 assert.ok(restored.world.stations.get(source.id).discovered);
 assert.equal(restored.world.stations.get(source.id).strategicRole,source.strategicRole);
 assert.equal(restored.world.stations.get(FRONTIERS.azure.depotId).enemy,true);
 const forbidden=unpackRun(packRun(checkpoint));
 forbidden.world.regionalSupply.frontier.teal.wrecks[0].stock=999;
 assert.equal(validateCheckpoint(forbidden),false,'wrecks cannot be refilled through a save');
});
test('returning to a captured industrial depot records a valid sortie and saves the run',()=>{
 const g=scene(),depot=g.world.stations.get('industry:depot');
 depot.enemy=false;depot.captured=true;depot.active=true;
 g.docked=depot;g.player.x=depot.x+40;g.player.y=depot.y+35;
 g.sortieStart=startSortie(g);g.time+=90;g.player.ore+=12;
 g.sortieReports=appendSortieReport([],finishSortie(g.sortieStart,g,depot));
 const checkpoint=captureCheckpoint(g,depot);
 assert.ok(validateCheckpoint(checkpoint));
 const storage=memory(),store=new RunCheckpointStore(storage,()=>1234);
 store.load();assert.ok(store.startNew().ok);
 assert.ok(store.save(checkpoint).ok);
 const reloaded=store.load();
 assert.equal(reloaded?.baseId,depot.id);
 assert.equal(reloaded?.state.sortieReports[0].baseId,depot.id);
});
test('the optional opening crisis and its objective survive a station checkpoint once',()=>{
 const g=scene();g.openingArc=createOpeningArc(g.world.home);
 beginOpeningArc(g.openingArc,'intercept',42);
 g.openingArc.commanderSerial=8;
 g.openingArc.returnWaypoint={id:'0:0',x:g.world.home.x,y:g.world.home.y,label:'Домашний док'};
 g.enemies=[{serial:8,group:1,type:'fighter',openingCommander:true,
  x:g.player.x+180,y:g.player.y+50,vx:0,vy:0,hp:100,maxHp:100,r:18}];
 const loaded=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.ok(validateCheckpoint(loaded));
 const fresh=scene();restoreCheckpoint(fresh,loaded);
 assert.equal(fresh.openingArc.status,'active');
 assert.equal(fresh.openingArc.commanderSerial,8);
 assert.equal(fresh.openingArc.commanderDefeated,false);
 assert.equal(fresh.openingArc.commanderDefeatedAt,null);
 assert.equal(fresh.enemies[0].openingCommander,true);
 assert.deepEqual(fresh.openingArc.returnWaypoint,g.openingArc.returnWaypoint);
 const damaged=unpackRun(packRun(loaded));damaged.state.openingArc.repair=500;
 assert.equal(validateCheckpoint(damaged),false);
 const old=unpackRun(packRun(loaded));delete old.state.openingArc.commanderDefeated;
 assert.ok(validateCheckpoint(old),'checkpoints predating the kill flag remain readable');
});
test('an announced, funded industrial response survives a save without a duplicate charge',()=>{
 const g=scene(),s=g.world.regionalSupply.frontier.azure;
 advanceRegionalSupply(g.world,g.time);
 s.strategy.routePlan={to:'diversion',readyAt:g.time+34};
 s.strategy.nextRoutePlanAt=g.time+200;
 s.strategy.reports=[{seq:1,kind:'loss',route:'direct',at:210,receivedAt:222},
  {seq:2,kind:'loss',route:'direct',at:224,receivedAt:236}];
 s.strategy.reportSerial=2;s.strategy.routeEvidenceThrough=2;
 const saved=captureCheckpoint(g,g.docked);
 assert.ok(validateCheckpoint(saved));
 const restored=scene();restoreCheckpoint(restored,unpackRun(packRun(saved)));
 assert.deepEqual(restored.world.regionalSupply.frontier.azure.strategy,s.strategy);
 const resources=s.resource;
 advanceRegionalSupply(restored.world,Math.ceil(g.time+34));
 assert.equal(restored.world.regionalSupply.frontier.azure.strategy.route,'diversion');
 assert.equal(restored.world.regionalSupply.frontier.azure.strategy.routePlan,null);
 assert.ok(restored.world.regionalSupply.frontier.azure.resource>=0);
 assert.equal(resources,s.resource,'saving must not spend funds again');
});
test('a funded maintenance expedition keeps its route and budget across a station save',()=>{
 const g=scene(),cfg=FRONTIERS.azure,s=g.world.regionalSupply.frontier.azure;
 s.nextDispatch=1e8;s.resource=4;
 const depot=g.world.stations.get(cfg.depotId);
 depot.hp=depot.maxHp*.5;
 advanceRegionalSupply(g.world,140);
 const craft=s.repairExpedition;
 assert.ok(craft);
 const paid=s.resource,launched=s.repairsLaunched;
 const saved=captureCheckpoint(g,g.docked);
 assert.ok(validateCheckpoint(saved));
 const restored=scene();restoreCheckpoint(restored,unpackRun(packRun(saved)));
 const state=restored.world.regionalSupply.frontier.azure;
 assert.deepEqual(state.repairExpedition,craft);
 assert.equal(state.resource,paid);
 assert.equal(state.repairsLaunched,launched);
 assert.deepEqual(state.repairDispatchTimes,[140]);
 advanceRegionalSupply(restored.world,240);
 assert.equal(state.repairsCompleted,1);
 assert.equal(state.repairExpedition,null);
 assert.ok(restored.world.stations.get(cfg.depotId).hp>depot.maxHp*.5);
 const tampered=unpackRun(packRun(saved));
 tampered.world.regionalSupply.frontier.azure.repairExpedition.hp=100000;
 assert.equal(validateCheckpoint(tampered),false);
 const tamperedWindow=unpackRun(packRun(saved));
 tamperedWindow.world.regionalSupply.frontier.azure.repairDispatchTimes=Array(100).fill(140);
 assert.equal(validateCheckpoint(tamperedWindow),false);
});
test('a missing freight report survives a checkpoint and arrives only at its overdue time',()=>{
 const g=scene();advanceRegionalSupply(g.world,g.time);
 const s=g.world.regionalSupply.frontier.teal;
 s.strategy.pendingLosses=[{route:'direct',at:230,dueAt:290}];
 const checkpoint=captureCheckpoint(g,g.docked);
 assert.ok(validateCheckpoint(checkpoint));
 const restored=scene();restoreCheckpoint(restored,unpackRun(packRun(checkpoint)));
 const rec=restored.world.regionalSupply.frontier.teal;
 assert.deepEqual(rec.strategy.pendingLosses,s.strategy.pendingLosses);
 assert.equal(rec.strategy.reports.filter(r=>r.kind==='loss').length,0);
 advanceRegionalSupply(restored.world,289);
 assert.equal(rec.strategy.reports.filter(r=>r.kind==='loss').length,0);
 advanceRegionalSupply(restored.world,290);
 assert.equal(rec.strategy.reports.filter(r=>r.kind==='loss').length,1);
 assert.equal(rec.strategy.pendingLosses.length,0);
 advanceRegionalSupply(restored.world,400);
 assert.equal(rec.strategy.reports.filter(r=>r.kind==='loss').length,1,
  'reloading a scheduled missing-shipment notice cannot duplicate the event');
});
test('untransmitted cargo telemetry remains on the same freighter after a checkpoint',()=>{
 const g=scene(),network=g.world.regionalSupply.frontier.teal;
 let cargo;
 for(let t=1;t<=450&&!cargo;t++){
  advanceRegionalSupply(g.world,t);
  cargo=network.convoys[0];
 }
 assert.ok(cargo);
 g.time=network.clock;
 cargo.radioBuffer=[g.time];
 assert.ok(validateCheckpoint(captureCheckpoint(g,g.docked)));
 const restored=scene();restoreCheckpoint(restored,
  unpackRun(packRun(captureCheckpoint(g,g.docked))));
 const restoredCargo=restored.world.regionalSupply.frontier.teal.convoys[0];
 assert.deepEqual(restoredCargo.radioBuffer,cargo.radioBuffer);
 assert.equal(restored.world.regionalSupply.frontier.teal.strategy.reports.length,0);
});
test('checkpoint restores hull, inventory, progression, changed rocks and network together',()=>{
 const g=scene(),base=g.world.nearbyStations(1600,0,2100,false).find(b=>b!==g.docked);
 base.active=true;base.relayBoost=true;base.usedUpgrade=true;base.module='armor';
 base.discovered=true;g.world.discovered.add(base.id);g.activeBases=2;g.network.armor=1;
 g.player.level=4;g.player.points=2;g.player.ore=59;
 Object.assign(g.shipLoadout,{frame:1,slots:['plasma','rail',null,null,null,null],owned:{plasma:1,rail:1},
  specializations:{rail:{path:'penetration',rank:1}}});
 const rock=g.world.nearbyRocks(800,400,700)[0];rock.hp=0;rock.alive=false;
 const other=g.world.nearbyRocks(900,500,700).find(r=>r.alive);other.hp-=7;other.x+=12;
 const {storage}=save(g),loaded=new RunCheckpointStore(storage).load(),fresh=scene();
 g.cruiseCharge=2.2;g.cruising=true;
 restoreCheckpoint(fresh,loaded);
 assert.equal(fresh.player.hp,73);assert.equal(fresh.player.ore,59);assert.equal(fresh.player.points,2);
 assert.equal(fresh.shipLoadout.slots[1],'rail');assert.equal(fresh.shipLoadout.specializations.rail.rank,1);
 assert.equal(fresh.network.armor,1);assert.ok(fresh.world.stations.get(base.id).relayBoost);
 assert.equal(fresh.world.home,fresh.docked);assert.equal(fresh.lastDamageAt,-Infinity);
 const restoredRocks=[...fresh.world.rocks.values()].flat();
 assert.equal(restoredRocks.find(r=>r.id===rock.id).alive,false);
 assert.equal(restoredRocks.find(r=>r.id===other.id).hp,other.hp);
 assert.equal(restoredRocks.find(r=>r.id===other.id).x,other.x);
 assert.equal(fresh.time,243.5);assert.equal(fresh.spawnClock,3.4);assert.ok(fresh.paused);
 assert.equal(fresh.cruising,false,'a docked continuation never resumes cruise movement');
 assert.equal(fresh.cruiseCharge,0);
});
test('station point defense does not regain spent charges when the run is resumed',()=>{
 const g=scene(),base=g.docked;
 base.defense={charges:0,rechargeAt:260.5,interceptAt:244.2,
  stasisAt:270.1,visualAt:242,visualKind:'meteor',
  lastLinked:false,meteorEnabled:false};
 g.enemies=[{type:'fighter',x:base.x+100,y:base.y,vx:0,vy:0,r:14,hp:50,maxHp:50,
  stasisUntil:245,stasisImmuneUntil:261}];
 const {storage}=save(g),fresh=scene();
 const checkpoint=new RunCheckpointStore(storage).load();
 assert.ok(checkpoint);
 restoreCheckpoint(fresh,checkpoint);
 assert.deepEqual(fresh.world.home.defense,base.defense);
 assert.equal(fresh.enemies[0].stasisUntil,245);
 assert.equal(fresh.enemies[0].stasisImmuneUntil,261);
 assert.equal(fresh.nextDefenseCheckAt,0);
 checkpoint.world.stations.find(([id])=>id===base.id)[1].defense.charges=3;
 assert.equal(validateCheckpoint(checkpoint),false,'impossible PVO stock is rejected');
});
test('return reports survive a checkpoint, but an unfinished sortie never duplicates',()=>{
 const g=scene();
 g.sortieReports=[{seconds:93,ore:27,data:11,hull:-8,drones:0,levels:0,baseId:'0:0'}];
 g.sortieStart={time:90,ore:0,data:0,hp:110,level:1,allies:0};
 const {storage}=save(g),loaded=new RunCheckpointStore(storage).load(),fresh=scene();
 restoreCheckpoint(fresh,loaded);
 assert.deepEqual(fresh.sortieReports,g.sortieReports);
 assert.equal(fresh.sortieStart,null);
 assert.ok(validateCheckpoint(loaded));
 loaded.state.sortieReports.push({seconds:-4,ore:0,data:0,hull:0,drones:0,levels:0,baseId:'0:0'});
 assert.equal(validateCheckpoint(loaded),false);
});
test('a claimed field contract is credited to its completed flight and saved exactly once',()=>{
 const g=scene(),b=g.docked;
 g.sortieReports=[];g.sortieStart=startSortie(g);
 g.contract={baseId:b.id,kind:'kill',goal:1,progress:0,choiceId:'standard',
  name:'Перехват',ore:16,data:15};
 g.player.x=b.x+460;g.player.y=b.y;
 g.advanceContract('kill',{type:'scout',x:b.x,y:b.y,lastPlayerHitAt:g.time});
 assert.equal(g.contract.completedSortieId,g.sortieStart.id);
 g.player.x=b.x;g.player.y=b.y; // The pilot returns to dock to claim and save.
 g.time+=45;g.player.data+=7;
 g.sortieReports=appendSortieReport(g.sortieReports,finishSortie(g.sortieStart,g,b));
 g.sortieStart=null;g.renderDock=noop;
 g.baseAction('claimContract','');
 assert.equal(g.player.ore,36);assert.equal(g.player.data,52);
 assert.equal(g.sortieReports[0].ore,16);
 assert.equal(g.sortieReports[0].data,22);
 assert.equal(g.sortieReports[0].details.oreContracts,16);
 assert.equal(g.sortieReports[0].details.dataContracts,15);
 assert.deepEqual(g.lastContractReceipt,{ore:16,data:15,levelsGained:1,credited:true});
 g.baseAction('claimContract','');
 assert.equal(g.player.ore,36);assert.equal(g.sortieReports[0].ore,16);
 const {storage}=save(g),fresh=scene();restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 assert.equal(fresh.player.ore,36);assert.equal(fresh.sortieReports[0].ore,16);
 assert.equal(fresh.sortieReports[0].details.oreContracts,16);
});
test('a completed contract gives a return route only when the pilot has no route',()=>{
 const g=scene(),b=g.docked;
 g.contract={baseId:b.id,kind:'rich',goal:1,progress:0,choiceId:'alternate',
  name:'Геологические сведения',ore:10,data:24};
 g.advanceContract('mine',{rich:true});
 assert.equal(g.waypoint?.id,b.id);
 assert.match(g.waypoint?.label,/Награда/);
 const other=scene();other.contract={...g.contract,progress:0};
 other.waypoint={id:'mission',x:300,y:400,label:'Текущая цель'};
 other.advanceContract('mine',{rich:true});
 assert.equal(other.waypoint.id,'mission','a selected mission must not be replaced');
 const pinned=scene();pinned.contract={...g.contract,progress:0};
 pinned.manualWaypoint={id:'personal',x:500,y:500,label:'Моя точка'};
 pinned.advanceContract('mine',{rich:true});
 assert.equal(pinned.waypoint,undefined,'a personal map marker takes priority');
});
test('the first claimed contract gives one free early weapon, installs it and survives a checkpoint',()=>{
 const g=scene();g.heritage.ui=noop;g.renderDock=noop;g.firstHardwareReward=null;
 g.contract={baseId:g.docked.id,kind:'kill',goal:1,progress:1,choiceId:'standard',
  name:'Первый патруль',ore:16,data:15};
 g.baseAction('claimContract','');
 assert.equal(g.firstHardwareReward,'pending');
 assert.equal(g.player.ore,36);assert.equal(g.player.data,45);
 g.baseAction('claimFirstModule','rail');
 assert.equal(g.firstHardwareReward,'rail');
 assert.deepEqual(g.shipLoadout.slots.slice(0,2),['plasma','rail']);
 assert.equal(g.shipLoadout.owned.rail,1);
 assert.equal(g.weaponProfile.rail,1,'the new weapon fires immediately without another hangar step');
 g.baseAction('claimFirstModule','flak');
 assert.equal(g.shipLoadout.owned.flak,undefined,'the same reward cannot be received again');
 assert.equal(g.player.ore,36,'the free weapon does not spend the contract payment');
 const {storage}=save(g),fresh=scene();
 restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 assert.equal(fresh.firstHardwareReward,'rail');
 assert.deepEqual(fresh.shipLoadout.slots.slice(0,2),['plasma','rail']);
});
test('an unfinished hangar draft is preserved while the first reward goes to storage',()=>{
 const g=scene();g.heritage.ui=noop;g.renderDock=noop;g.firstHardwareReward='pending';
 const draft={...g.shipLoadout,slots:['plasma','plasma',null,null,null,null]};
 g.hangarSession={draft,dirty:()=>true};
 g.baseAction('claimFirstModule','flak');
 assert.equal(g.firstHardwareReward,'flak');
 assert.equal(g.shipLoadout.slots[1],null);
 assert.equal(g.shipLoadout.owned.flak,1);
 assert.deepEqual(draft.slots.slice(0,2),['plasma','plasma']);
});
test('station purchases remain separate from sortie income and expenses survive a checkpoint',()=>{
 const g=scene();g.economyExpenses=emptyEconomyExpenses();
 const start=startSortie(g);g.sortieStart=start;
 g.time+=60;g.player.ore+=38;
 g.sortieReports=appendSortieReport([],finishSortie(start,g,g.docked));
 g.sortieStart=null;
 g.player.ore-=20;recordEconomyExpense(g,'drones',20);
 g.player.ore-=24;recordEconomyExpense(g,'stations',24);
 const {storage}=save(g),fresh=scene();restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 assert.equal(fresh.sortieReports[0].ore,38,'a post-dock purchase cannot rewrite earned ore');
 assert.deepEqual(fresh.economyExpenses,{weapons:0,drones:20,repairs:0,stations:24,services:0,travel:0});
 assert.ok(validateCheckpoint(new RunCheckpointStore(storage).load()));
 const forged=new RunCheckpointStore(storage).load();forged.state.economyExpenses.drones=-10;
 assert.equal(validateCheckpoint(forged),false);
});
test('the live pickup path records mined alloy and recovered combat data by source',()=>{
 const g=scene();g.sortieStart=startSortie(g);g.time+=24;
 g.heritage={...g.heritage,play:noop};
 g.collect({type:'ore',value:9,source:'mining'});
 g.collect({type:'ore',value:2,source:'salvage'});
 g.collect({type:'data',value:7,source:'combat'});
 const report=finishSortie(g.sortieStart,g,g.docked);
 assert.equal(report.ore,11);assert.equal(report.data,7);
 assert.equal(report.details.oreMining,9);assert.equal(report.details.oreSalvage,2);
 assert.equal(report.details.dataCombat,7);
 assert.equal(report.details.dataOperations,0);
});
test('the real leave-and-dock lifecycle records one flight and ignores instant reopening',()=>{
 const g=scene();g.sortieReports=[];g.sortieStart=null;
 g.heritage={ui:noop,pause:noop,resume:noop};
 g.hangarSession={begin:noop};g.endInteraction=noop;g.renderDock=noop;g.saveAtStation=noop;
 g.dismiss();
 assert.equal(g.sortieStart.ore,20);
 assert.equal(g.overlay.hidden,true);
 g.time+=95;g.player.ore+=34;g.player.hp-=16;
 g.dock(g.world.home);
 assert.equal(g.sortieReports.length,1);
 assert.equal(g.sortieReports[0].ore,34);
 assert.equal(g.sortieReports[0].hull,-16);
 assert.equal(g.sortieStart,null);
 g.dismiss();g.time+=2;g.dock(g.world.home);
 assert.equal(g.sortieReports.length,1);
});
test('departing via the station map arms one sortie, but an in-flight map does not restart it',()=>{
 const g=scene();g.sortieReports=[];g.sortieStart=null;g.stationExitArmed=true;
 g.heritage={ui:noop,pause:noop,resume:noop};
 g.hangarSession={begin:noop};g.endInteraction=noop;g.renderDock=noop;g.saveAtStation=noop;
 g.overlay.dataset.mode='map';g.mapReturnToBase=true;
 g.dismiss();
 assert.equal(g.sortieStart.ore,20);
 assert.equal(g.stationExitArmed,false);
 g.time+=35;g.player.ore+=12;
 const firstStart=g.sortieStart;
 g.overlay.hidden=false;g.overlay.dataset.mode='map';g.mapReturnToBase=false;
 g.dismiss();
 assert.equal(g.sortieStart,firstStart,'opening the map in space keeps the original start');
 g.time+=50;g.player.ore+=14;g.dock(g.world.home);
 assert.equal(g.sortieReports.length,1);
 assert.equal(g.sortieReports[0].seconds,85);
 assert.equal(g.sortieReports[0].ore,26);
});
test('returning from a paid transfer automatically pays its original contract once',()=>{
 const g=scene(),home=g.docked,target=g.world.station(0,-1);
 target.active=true;g.activeBases=2;g.player.ore=86;
 assert.ok(g.world.networkTopology().linked.has(target.id));
 const price=transitCost(home,target);
 g.sortieStart=null;g.sortieReports=[];g.economyExpenses=emptyEconomyExpenses();
 g.stationExitArmed=true;g.mining={active:false,target:null};
 g.heritage={...g.heritage,ui:noop,pause:noop,resume:noop};
 g.hangarSession={dirty:()=>false,begin:noop};g.endInteraction=noop;
 g.saveAtStation=noop;g.releaseMenu=noop;g.renderDock=noop;
 g.contract={baseId:home.id,kind:'rich',goal:1,progress:0,choiceId:'alternate',
  name:'Геологические сведения',ore:10,data:24};
 g.baseAction('transfer',target.id);
 assert.equal(g.overlay.hidden,true);
 assert.equal(g.docked,null);
 assert.equal(g.player.ore,86-price);
 assert.equal(g.economyExpenses.travel,price);
 assert.equal(g.sortieStart.ore,86-price,'travel is a station expense, not a flight loss');
 const start=g.sortieStart;
 g.advanceContract('mine',{rich:true});
 assert.equal(g.contract.completedSortieId,start.id);
 g.time+=75;g.player.ore+=12;g.player.data+=8;g.player.hp-=9;
 // After the long return flight the craft is in interaction range of home.
 g.player.x=home.x+55;g.player.y=home.y+30;
 g.dock(home);
 assert.equal(g.sortieReports.length,1);
 assert.equal(g.sortieReports[0].ore,22);
 assert.equal(g.sortieReports[0].data,32);
 assert.equal(g.sortieReports[0].hull,-9);
 assert.equal(g.player.ore,86-price+12+10);
 assert.equal(g.contract,null,'no manual reward-claim action is required');
 assert.equal(g.sortieReports[0].ore,22);
 assert.equal(g.sortieReports[0].details.oreContracts,10);
 assert.equal(g.lastContractReceipt.credited,true);
 g.baseAction('claimContract','');
 assert.equal(g.player.ore,86-price+12+10,'the reward cannot be claimed twice');
 assert.equal(g.economyExpenses.travel,price);
 assert.equal(g.sortieStart,null);
});
test('a network transfer cannot spend alloy or discard a pending hangar draft',()=>{
 const g=scene(),home=g.docked,target=g.world.station(0,-1);
 target.active=true;g.player.ore=80;g.stationExitArmed=true;g.sortieStart=null;
 g.hangarSession={dirty:()=>true};g.mining={active:false,target:null};
 let rendered=0;g.renderDock=()=>{rendered++;};
 const start={x:g.player.x,y:g.player.y,ore:g.player.ore};
 g.baseAction('transfer',target.id);
 assert.equal(g.docked,home);
 assert.equal(g.player.x,start.x);assert.equal(g.player.y,start.y);
 assert.equal(g.player.ore,start.ore);
 assert.equal(g.baseTab,'hangar');assert.equal(rendered,1);
 assert.equal(g.sortieStart,null);
});
test('cargo, station mission, escort targets, missiles and strike bases retain shared identities',()=>{
 const g=scene(),carrier=g.world.nearbyStations(1500,0,2300).find(b=>b!==g.docked);
 carrier.type='carrier';carrier.enemy=false;
 const op=createCarrierInterception(carrier);op.hp=117;op.phase='intercept';op.guardsSpawned=true;
 carrier.carrierMission=op;g.operation=op;g.enemies=[op,{serial:7,type:'scout',hp:17,x:op.x+40,y:op.y,
  carrierEscort:carrier.id,target:g.player,protect:op}];
 g.missiles=[{target:op,x:g.player.x,y:g.player.y,life:2}];
 g.support.missions=[{base:carrier,carrier:g.world.home,craft:[],age:1,shotAt:2.3,volleys:0}];
 const {storage}=save(g),fresh=scene();restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 assert.equal(fresh.operation,fresh.enemies[0]);assert.equal(fresh.operation.hp,117);
 assert.equal(fresh.world.stations.get(carrier.id).carrierMission,fresh.operation);
 assert.equal(fresh.enemies[1].target,fresh.player);assert.equal(fresh.enemies[1].protect,fresh.operation);
 assert.equal(fresh.missiles[0].target,fresh.operation);
 assert.equal(fresh.support.missions[0].base,fresh.world.stations.get(carrier.id));
});
test('delivering restored telemetry twice cannot duplicate ore, experience or the world consequence',()=>{
 const g=scene(),op=createCorridorOperation(g.docked);op.phase='return';op.hp=0;
 g.player.strategicXp=createStrategicExperience();
 g.operation=op;g.docked.corridorMission=op;
 const {storage}=save(g),fresh=scene();restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 fresh.deliverCorridor();assert.equal(fresh.player.ore,50);assert.equal(fresh.player.data,52);
 assert.deepEqual({level:fresh.player.level,xp:fresh.player.xp},{level:2,xp:24},
  'operation data plus the one-time sabotage bonus must be credited once');
 assert.ok(fresh.world.home.corridorSecured);assert.equal(fresh.operation,null);
 const store=new RunCheckpointStore(storage);store.load();assert.ok(store.save(captureCheckpoint(fresh,fresh.docked)).ok);
 const again=scene();restoreCheckpoint(again,new RunCheckpointStore(storage).load());again.deliverCorridor();
 assert.equal(again.player.ore,50);assert.equal(again.player.data,52);assert.ok(again.world.home.corridorSecured);
 assert.deepEqual({level:again.player.level,xp:again.player.xp},{level:2,xp:24});
});
test('loan charges, cooldown, spent trial and owned hardware survive without a free refill',()=>{
 const g=scene();g.fieldLoan=createIonLoan(g.docked.id,200);g.fieldLoan.charges=1;
 g.fieldLoan.used=2;g.fieldLoan.cooldownUntil=247;g.fieldLoan.missionStarted=true;g.fieldTrialTaken=true;
 g.shipLoadout.slots[1]='ion';
 const {storage}=save(g),fresh=scene();restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 assert.equal(fresh.fieldLoan.charges,1);assert.equal(fresh.fieldLoan.used,2);
 assert.equal(fresh.fieldLoan.cooldownUntil,247);assert.ok(fresh.fieldTrialTaken);
 assert.equal(fresh.shipLoadout.slots[1],'ion');assert.equal(fresh.player.ore,20);
});
test('interrupted or quota-limited writes preserve the previous valid checkpoint',()=>{
 const g=scene(),{store,storage}=save(g);g.player.ore=37;
 const previous=[...storage.values];storage.setItem=()=>{throw new Error('quota');};
 assert.equal(store.save(captureCheckpoint(g,g.docked)).ok,false);
 assert.deepEqual([...storage.values],previous);
 assert.equal(new RunCheckpointStore(storage).load().state.player.ore,20);
});
test('a damaged latest slot falls back to the previous complete snapshot',()=>{
 const g=scene(),{store,storage}=save(g);g.player.ore=37;store.save(captureCheckpoint(g,g.docked));
 storage.values.set(RUN_KEYS[store.record.serial%2],'{truncated');
 const recovered=new RunCheckpointStore(storage);assert.equal(recovered.load().state.player.ore,20);
 assert.equal(recovered.issue,'damaged');
});
test('another tab cannot silently replace newer purchases with stale state',()=>{
 const g=scene(),{store,storage}=save(g),second=new RunCheckpointStore(storage);second.load();
 const stale=unpackRun(packRun(captureCheckpoint(g,g.docked)));g.player.ore=37;
 assert.ok(store.save(captureCheckpoint(g,g.docked)).ok);
 assert.equal(second.save(stale).reason,'conflict');
 assert.equal(new RunCheckpointStore(storage).load().state.player.ore,37);
});
test('deliberately ending a run or starting anew suppresses older backup continuations',()=>{
 const g=scene(),{store,storage}=save(g);assert.ok(store.end().ok);
 assert.equal(new RunCheckpointStore(storage).load(),null);
 const next=new RunCheckpointStore(storage);next.load();next.startNew();
 assert.equal(new RunCheckpointStore(storage).load(),null);
});
test('death preserves only the last docked world; restoring discards unsaved rewards and captures',()=>{
 const g=scene(),{store,storage}=save(g);g.runStore=store;
 g.heritage.vfx.shipExplosion=noop;g.heritage.play=noop;g.heritage.onDeath=noop;
 g.sortieReports=[];g.sortieStart=startSortie(g);g.time+=90;g.player.ore+=500;
 g.world.stations.get('industry:depot').enemy=false;
 g.player.hp=0;g.die();
 assert.ok(g.dead);assert.ok(g.pendingCheckpoint);
 assert.match(g.overlay.innerHTML,/Вернуться к последней стыковке/);
 const disk=new RunCheckpointStore(storage).load();
 assert.equal(disk.state.player.ore,20);assert.equal(disk.state.time,243.5);
 assert.equal(disk.world.stations.find(([id])=>id==='industry:depot')[1].enemy,true);
 const fresh=scene();restoreCheckpoint(fresh,g.pendingCheckpoint);
 assert.equal(fresh.player.ore,20);assert.equal(fresh.dead,false);
 assert.equal(fresh.world.stations.get('industry:depot').enemy,true);
 assert.ok(store.end().ok);assert.equal(new RunCheckpointStore(storage).load(),null);
});
test('recovery cannot resurrect a stale checkpoint after another tab saves or starts a new run',()=>{
 const g=scene(),{store,storage}=save(g),second=new RunCheckpointStore(storage);second.load();
 g.player.ore=50;assert.ok(second.save(captureCheckpoint(g,g.docked)).ok);
 assert.equal(store.recoveryCheckpoint(),null);assert.equal(store.issue,'conflict');
 assert.equal(new RunCheckpointStore(storage).load().state.player.ore,50);
 const fresh=new RunCheckpointStore(memory());fresh.load();fresh.startNew();
 assert.equal(fresh.recoveryCheckpoint(),null,'no docking means no recovery');
});
test('unsupported future saves and inaccessible storage are left intact',()=>{
 const storage=memory(),raw='{"format":999,"serial":99,"body":"future"}';
 storage.values.set(RUN_KEYS[0],raw);const store=new RunCheckpointStore(storage);
 assert.equal(store.load(),null);assert.equal(store.startNew().ok,false);
 assert.equal(store.save(captureCheckpoint(scene(),scene().docked)).ok,false);
 assert.equal(storage.getItem(RUN_KEYS[0]),raw);
 const blocked=new RunCheckpointStore({getItem(){throw Object.assign(new Error(),{name:'SecurityError'});},setItem(){throw new Error();}});
 assert.equal(blocked.load(),null);assert.equal(blocked.startNew().ok,false);
});
test('malformed data cannot mutate a live run, and executable objects cannot be serialized',()=>{
 const g=scene(),checkpoint=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 checkpoint.state.player.ore=-1;assert.equal(validateCheckpoint(checkpoint),false);
 const original=g.player;assert.throws(()=>restoreCheckpoint(g,checkpoint));assert.equal(g.player,original);
 assert.throws(()=>packRun({execute:noop}));assert.throws(()=>packRun({node:new Date()}));
 assert.throws(()=>unpackRun('{"entry":{"ref":0},"nodes":[["object",[["__proto__",null]]]]}'));
 assert.equal({}.polluted,undefined);
});
test('rendering caches are rebuilt rather than serialized with combat data',()=>{
 const g=scene();g.enemies=[{type:'gunship',hp:50,x:100,y:100,
  capitalPaintCache:{canvas:new Date()},capitalWear:{sites:[{x:2,y:4}]}}];
 const restored=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.equal(restored.state.enemies[0].capitalPaintCache,undefined);
 assert.deepEqual(restored.state.enemies[0].capitalWear.sites,[{x:2,y:4}]);
});
test('new resources from a world event persist even before their first mining hit',()=>{
 const g=scene(),list=g.world.rockCell(3,2),original=list[0];
 const added={...original,id:'3:2/event-1',originKind:'event',x:original.x+30,hp:50,maxHp:50,alive:true};
 list.push(added);
 const restored=scene();restoreCheckpoint(restored,unpackRun(packRun(captureCheckpoint(g,g.docked))));
 assert.equal(restored.world.rockCell(3,2).find(r=>r.id===added.id).hp,50);
 assert.equal(restored.world.rockCell(3,2).filter(r=>r.id===added.id).length,1);
});
test('an oversized next snapshot leaves its smaller predecessor available',()=>{
 const g=scene(),{store,storage}=save(g);
 let state=182947;const chars=new Array(1800000);
 for(let i=0;i<chars.length;i++){
  state^=state<<13;state^=state>>>17;state^=state<<5;
  chars[i]=String.fromCharCode(33+((state>>>0)%90));
 }
 g.player.note=chars.join('');
 assert.equal(store.save(captureCheckpoint(g,g.docked)).reason,'too-large');
 assert.equal(new RunCheckpointStore(storage).load().state.player.ore,20);
});
test('real station save gate never turns an in-flight or dead state into a checkpoint',()=>{
 const g=scene(),storage=memory();g.runStore=new RunCheckpointStore(storage);g.runStore.load();g.runStore.startNew();
 assert.match(g.saveAtStation(),/Вылет сохранён/);
 const serial=g.runStore.record.serial;
 g.paused=false;g.player.ore=99;assert.equal(g.saveAtStation(),'');
 g.paused=true;g.player.x+=900;assert.equal(g.saveAtStation(),'');
 g.player.x-=900;g.dead=true;assert.equal(g.saveAtStation(),'');
 assert.equal(g.runStore.record.serial,serial);
});
test('continuation renders the restored sector and terrain before the dock pauses it again',()=>{
 const original=scene(),saved=unpackRun(packRun(captureCheckpoint(original,original.docked)));
 const g=scene();g.pendingCheckpoint=saved;g.vw=1200;g.vh=800;
 g.dead=true;g.heritage.dead=true;g.enemyComms=new EnemyComms();g.enemyComms.nextTick=900;
 g.designatedTarget={target:{hp:1},expiresAt:900};
 g.targetField={x:500,y:300,radius:165,expiresAt:900};
 let sky=null,rendered=false;g.visuals={updateSky(x,y){sky=[x,y];}};
 g.heritage.pause=noop;g.hangarSession={begin:noop};
 g.renderDock=()=>{
  assert.deepEqual(sky,[g.player.x,g.player.y]);
  assert.ok(g.nearRocks.length>0);assert.ok(g.localStations.includes(g.docked));
  assert.ok(g.paused);assert.equal(g.time,original.time);rendered=true;
 };
 g.continueRun();assert.ok(rendered);assert.equal(g.pendingCheckpoint,null);
 assert.equal(g.heritage.dead,false);assert.equal(g.enemyComms.nextTick,0);
 assert.equal(g.designatedTarget,null);
 assert.equal(g.targetField,null,'a temporary mouse target area must not survive an earlier station save');
});
test('continuing at a dock pays an old unclaimed order exactly once',()=>{
 const original=scene(),b=original.docked;
 original.contract={baseId:b.id,kind:'rich',goal:1,progress:1,
  choiceId:'alternate',name:'Геологические сведения',ore:10,data:24};
 const saved=unpackRun(packRun(captureCheckpoint(original,b)));
 const g=scene();g.pendingCheckpoint=saved;g.vw=1200;g.vh=800;
 g.visuals={updateSky:noop};g.heritage.pause=noop;
 g.hangarSession={begin:noop};g.renderDock=noop;
 g.continueRun();
 assert.equal(g.contract,null);
 assert.equal(g.player.ore,30);
 assert.equal(g.player.data,54);
 assert.equal(g.lastContractReceipt.ore,10);
 g.baseAction('claimContract','');
 assert.equal(g.player.ore,30,'restoring the checkpoint cannot pay the order twice');
});


test('regional production, live cargo identity and captured sources survive station saves and old saves migrate',async()=>{
 const {SUPPLY,advanceRegionalSupply}=await import('../regional-supply.js');
 const g=scene();advanceRegionalSupply(g.world,g.time);
 const cargo=g.world.regionalSupply.convoys[0];assert.ok(cargo);
 g.enemies.push({x:cargo.x,y:cargo.y,hp:20,protect:cargo});
 const mine=g.world.stations.get(SUPPLY.mineId);mine.enemy=false;mine.active=true;mine.captured=true;
 const {storage}=save(g),loaded=new RunCheckpointStore(storage).load(),fresh=scene();
 restoreCheckpoint(fresh,loaded);
 assert.equal(fresh.enemies[0].protect,fresh.world.regionalSupply.convoys[0]);
 assert.equal(fresh.world.stations.get(SUPPLY.mineId).enemy,false);
 assert.equal(fresh.world.regionalSupply.nextDispatch,g.world.regionalSupply.nextDispatch);
 const legacy=captureCheckpoint(g,g.docked);delete legacy.world.regionalSupply;
 restoreCheckpoint(scene(),legacy);assert.ok(validateCheckpoint(legacy));
 const broken=captureCheckpoint(g,g.docked);broken.world.regionalSupply.ore=-1;
 assert.equal(validateCheckpoint(broken),false);
});

test('local worker, industrial resources and mined rocks survive loading; old checkpoints start without retroactive income',async()=>{
 const {advanceRegionalSupply}=await import('../regional-supply.js');
 const g=scene();advanceRegionalSupply(g.world,g.time);
 const local=g.world.regionalSupply.central;
 assert.ok(local.produced>0);
 const source=g.world.stations.get('industry:source');
 source.discovered=true;g.world.discovered.add(source.id);
 const mined=[...g.world.rocks.values()].flat().find(rock=>rock.hp<rock.maxHp);
 assert.ok(mined);
 const original=captureCheckpoint(g,g.docked),fresh=scene();
 assert.ok(validateCheckpoint(original));
 restoreCheckpoint(fresh,unpackRun(packRun(original)));
 assert.equal(fresh.world.regionalSupply.central.produced,local.produced);
 assert.equal(fresh.world.regionalSupply.central.worker.phase,local.worker.phase);
 assert.equal([...fresh.world.rocks.values()].flat().find(r=>r.id===mined.id).hp,mined.hp);
 assert.ok(fresh.world.stations.get(source.id).discovered);
 const legacy=unpackRun(packRun(original));delete legacy.world.regionalSupply.central;
 assert.ok(validateCheckpoint(legacy));
 const migrated=scene();restoreCheckpoint(migrated,legacy);
 const oldTime=migrated.world.regionalSupply.clock;
 advanceRegionalSupply(migrated.world,oldTime+1);
 assert.equal(migrated.world.regionalSupply.central.clock,oldTime+1);
 assert.equal(migrated.world.regionalSupply.central.produced,0);
 const bad=unpackRun(packRun(original));bad.world.regionalSupply.central.worker.carry=999;
 assert.equal(validateCheckpoint(bad),false);
});


test('saving unseen damage cannot silently rebuild a regional garrison on restore',async()=>{
 const {SUPPLY}=await import('../regional-supply.js');
 const g=scene(),mine=g.world.stations.get(SUPPLY.mineId);
 mine.turrets[0].hp=9;mine.hp=150;
 assert.equal(mine.discovered,false);
 const snapshot=captureCheckpoint(g,g.docked),fresh=scene();restoreCheckpoint(fresh,snapshot);
 assert.equal(fresh.world.stations.get(SUPPLY.mineId).turrets[0].hp,9);
 assert.equal(fresh.world.stations.get(SUPPLY.mineId).hp,150);
});

test('a real enemy radio cell cannot break a station checkpoint or lose the active field weapon',async()=>{
 const {SUPPLY,advanceRegionalSupply}=await import('../regional-supply.js');
 const g=scene(),b=g.docked;
 const a={serial:1,type:'scout',x:b.x+80,y:b.y,hp:40,maxHp:70,r:14,target:g.player};
 const c={serial:2,type:'fighter',x:b.x+140,y:b.y,hp:60,maxHp:70,r:14,target:g.player};
 g.enemies=[a,c];g.grid=new SpatialGrid(110);g.grid.insert(a);g.grid.insert(c);
 g.enemyComms=new EnemyComms();g.enemyComms.update(g);
 advanceRegionalSupply(g.world,g.time);const freight=g.world.regionalSupply.convoys[0];assert.ok(freight);a.protect=freight;
 const radioCell=a._commsCell;assert.equal(c._commsCell,radioCell);assert.ok(radioCell.proposals instanceof Map);
 g.fieldLoan=createFieldLoan('resonator',b.id,g.time);g.fieldLoan.charges=2;g.fieldLoan.used=1;g.fieldTrialTaken=true;
 g.shipLoadout.slots[1]='resonator';g.fieldEffects=[{until:g.time+4,targets:[{kind:'enemy',target:a},{kind:'enemy',target:c}]}];
 const {storage}=save(g),loaded=new RunCheckpointStore(storage).load(),fresh=scene();restoreCheckpoint(fresh,loaded);
 assert.equal(a._commsCell,radioCell,'serializing must not dismantle the live radio cell');
 assert.ok(radioCell.proposals instanceof Map);
 assert.equal(fresh.player.hp,73);assert.equal(fresh.fieldLoan.moduleId,'resonator');assert.equal(fresh.fieldLoan.charges,2);
 assert.equal(fresh.fieldLoan.used,1);assert.equal(fresh.shipLoadout.slots[1],'resonator');
 assert.equal(fresh.fieldEffects[0].targets[0].target,fresh.enemies[0]);assert.equal(fresh.enemies[0].target,fresh.player);
 assert.equal(fresh.enemies[0].protect,fresh.world.regionalSupply.convoys[0]);
 assert.equal(fresh.enemies[0]._commsCell,undefined,'the radio cache is rebuilt after continuing');
 fresh.grid=new SpatialGrid(110);for(const e of fresh.enemies)fresh.grid.insert(e);
 fresh.enemyComms=new EnemyComms();fresh.enemyComms.update(fresh);
 assert.equal(fresh.enemies[0]._commsCell,fresh.enemies[1]._commsCell);
 assert.ok(fresh.enemies[0]._commsCell.proposals instanceof Map);
 const next=new RunCheckpointStore(storage);next.load();assert.ok(next.save(captureCheckpoint(fresh,fresh.docked)).ok);
});


test('region archives survive save and reject forged timeless or oversized threats',()=>{
 const g=scene(),hub=g.world.stations.get('industry:depot');
 hub.meshArchive=[{kind:'long',lastAt:210,reports:2,assetId:null}];
 const copy=unpackRun(packRun(captureCheckpoint(g,g.docked)));
 assert.equal(validateCheckpoint(copy),true);
 const restored=scene();restoreCheckpoint(restored,copy);
 assert.deepEqual(restored.world.stations.get('industry:depot').meshArchive,
  hub.meshArchive);
 const record=copy.world.stations.find(([id])=>id==='industry:depot')[1];
 record.meshArchive[0].lastAt=g.time+1;
 assert.equal(validateCheckpoint(copy),false,'future intel is invalid');
 record.meshArchive[0].lastAt=210;
 record.meshArchive[0].reports=999;
 assert.equal(validateCheckpoint(copy),false,'unsupported confidence is invalid');
 record.meshArchive=Array(10).fill({kind:'area',lastAt:210,reports:1,assetId:null});
 assert.equal(validateCheckpoint(copy),false,'archives remain bounded');
 delete record.meshArchive;
 assert.equal(validateCheckpoint(copy),true,'legacy saves do not need the new field');
});
