import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ArcadeGame} from './runtime-game.mjs';
import {World} from '../world.js';
import {SpatialGrid} from '../balance.js';
import {createLoadout,createThermal,loadoutProfile,moduleStats,quoteLoadout,HangarSession,moduleLock} from '../ship-loadout.js';
import {combatTargets,damageTarget,selectTargets} from '../combat-targets.js';
import {createFieldLoan,missionAssignment,bindFieldLoan,finishFieldAssignment,planResonance,refillQuote,updateFieldEffects,resonanceDamage,fieldLoanOffer} from '../field-weapons.js';
import {planIonDischarge} from '../ion-conductor.js';
import {updateHowitzer} from '../ship-weapons.js';
import {plasmaDamageFactor} from '../weapon-specializations.js';
import {beamDamage} from '../balance.js';
import {automaticRange,corridorCue} from '../mission-feedback.js';
import {RUN_KEYS,RunCheckpointStore,captureCheckpoint,restoreCheckpoint,packRun,unpackRun} from '../run-checkpoint.js';
import {createCorridorOperation,createProbeOperation} from '../operations.js';
import {createRelayDefense} from '../relay-defense.js';
import {createCarrierInterception,carrierAspect} from '../carrier-interception.js';

import {game} from './weapons-scene.mjs';
const enemy=(x,y=0,hp=300)=>({x,y,hp,maxHp:hp,r:14,type:'fighter',converted:false});
const rock=(x,y=0,r=40)=>({x,y,r,hp:500,maxHp:500,alive:true});
const equip=(g,id)=>{g.shipLoadout.slots[0]=id;g.weaponProfile=loadoutProfile(g.shipLoadout);};
const memory=()=>({values:new Map(),getItem(k){return this.values.get(k)||null;},setItem(k,v){this.values.set(k,v);}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
function loan(g,id){g.fieldLoan=createFieldLoan(id,g.docked.id,g.time);g.shipLoadout.slots[1]=id;g.syncShipLoadout();}
function checkpoint(g){g.paused=true;g.player.x=g.docked.x+40;g.player.y=g.docked.y;return captureCheckpoint(g,g.docked);}

for(const id of ['plasma','rail','flak','rocket'])test(id+': common catalog damages operation and structural targets',()=>{
 for(const kind of ['jammer','cargo','turret','base']){
  const g=game();equip(g,id);let t;
  if(kind==='jammer'){t=createCorridorOperation(g.docked);Object.assign(t,{x:150,y:0});g.operation=t;}
  else if(kind==='cargo'){const station={...g.docked,type:'carrier'},op=createCarrierInterception(station);Object.assign(op,{x:150,y:0,phase:'pursuit',angle:Math.PI/2});g.operation=op;t=op;g.enemies=[op];g.grid.insert(op);}
  else {const b={x:150,y:0,hp:500,maxHp:500,r:60,enemy:true,turrets:[]};t=kind==='base'?b:{x:150,y:0,hp:100,r:22};if(kind==='turret')b.turrets=[t];g.world.nearbyStations=()=>[b];g.enemyBasesUnlocked=()=>true;}
  const hp=t.hp;g.updateShipWeapons(.01);if(id==='rocket')g.updateMissiles(.5);
  assert.ok(t.hp<hp,kind+' must be damaged by '+id);
 }
});
test('shared catalog deduplicates cargo, excludes friendly nodes and a not-yet-arrived convoy',()=>{
 const g=game(),cargo=enemy(150);Object.assign(cargo,{interceptCargo:true,phase:'pursuit'});g.operation=cargo;g.enemies=[cargo];g.grid.insert(cargo);
 assert.equal(combatTargets(g,700).length,1);cargo.phase='approach';assert.equal(combatTargets(g,700).length,0);
 for(const id of ['last-signal','relay-defense']){const node={...enemy(100),id};g.operation=node;g.grid.clear();g.grid.insert(node);assert.equal(combatTargets(g,700).length,0);}
 const ally=enemy(100);g.operation=null;g.allies=[ally];g.grid.clear();g.grid.insert(ally);assert.equal(combatTargets(g,700).length,0);
});
test('actual rail range and warning change together; a distant hit alerts the guard',()=>{
 const g=game(['rail',null,null,null,null,null]),op=createCorridorOperation(g.docked);g.operation=op;g.player.x=op.x-699;g.player.y=op.y;
 assert.equal(automaticRange(g),700);assert.equal(corridorCue(op,g.time,699,automaticRange(g)).key,'ready');
 g.updateCorridor(.01);assert.equal(g.enemies.length,0);g.updateShipWeapons(.01);assert.equal(op.hp,112);
 g.updateCorridor(.01);assert.equal(g.enemies.length,2,'attacking beyond the proximity trigger still raises an alarm');
 g.player.x=op.x-701;g.moduleClocks.rail=0;g.updateShipWeapons(.01);assert.equal(op.hp,112);
});
test('nearest weapons let position choose an escort; precision weapons choose the operation goal',()=>{
 const g=game(),op={...enemy(300),id:'silent-corridor',phase:'attack'};g.operation=op;
 const escort=enemy(120);g.grid.insert(escort);
 assert.equal(selectTargets(g,435,1,false)[0].target,escort);assert.equal(selectTargets(g,700,1,true)[0].target,op);
});
for(const id of ['plasma','rail','flak'])test(id+': rock cover blocks every actual mount and split target',()=>{
 const g=game();equip(g,id);g.skillRanks.double=2;
 const targets=[enemy(180,-12),enemy(190,0),enemy(200,12)];for(const e of targets)g.grid.insert(e);
 g.rockGrid.insert(rock(95,0,50));const impacts=[];g.damageRock=(r,d)=>impacts.push(d);
 g.updateShipWeapons(.01);assert.ok(impacts.length>0);assert.ok(targets.every(e=>e.hp===300));
});
test('a core cannot absorb the same howitzer explosion that killed its protecting turret',()=>{
 const g=game(),t={x:170,y:0,r:22,hp:40},b={x:180,y:0,r:60,hp:500,maxHp:500,enemy:true,turrets:[t]};
 g.world.nearbyStations=()=>[b];g.enemyBasesUnlocked=()=>true;g.weaponProfile.howitzer=true;
 g.heavyCharge={x:170,y:0,remaining:.01,total:1.25};updateHowitzer(g,.02);
 assert.ok(t.hp<=0);assert.equal(b.hp,500);assert.ok(combatTargets(g,700).some(x=>x.target===b));
});
test('howitzer blast respects cover on the far side of the impact',()=>{
 const g=game(),e=enemy(200),r=rock(100,0,35);g.grid.insert(e);g.rockGrid.insert(r);g.damageRock=(r,d)=>{r.hp-=d;};
 g.weaponProfile.howitzer=true;g.heavyCharge={x:180,y:0,remaining:.01,total:1.25};updateHowitzer(g,.02);assert.equal(e.hp,300);
});
test('a missile does not hit a structure that became friendly while it was in flight',()=>{
 const g=game(),b={x:150,y:0,r:60,hp:100,maxHp:500,enemy:false,captured:true,turrets:[]};
 g.missiles=[{x:0,y:0,tx:150,ty:0,target:b,targetKind:'base',targetBase:null,damage:70,speed:400,life:3}];
 g.updateMissiles(.5);assert.equal(b.hp,100);assert.equal(g.missiles.length,0);
});
test('plasma is strongest near one target, rail wins at distance; calibration preserves these roles',()=>{
 for(let rank=0;rank<=5;rank++){
  const p=moduleStats('plasma',{beam:rank}),r=moduleStats('rail',{beam:rank}),f=moduleStats('flak',{beam:rank});
  assert.ok(p.damage/p.interval>r.damage/r.interval);assert.ok(beamDamage(p.damage,400,115,p.range,.28)/p.interval<r.damage/r.interval);
  assert.ok(f.damage/f.interval<p.damage/p.interval);assert.ok(f.damage*3/f.interval>p.damage/p.interval);
  for(const id of ['plasma','rail','flak','rocket']){const a=moduleStats(id,{beam:0}),b=moduleStats(id,{beam:rank});near((b.damage/b.interval)/(a.damage/a.interval),(1+rank*.2)*(1+rank*.08));}
 }
});
test('focused plasma damage falls monotonically instead of gaining damage halfway to the target',()=>{
 for(const rank of [1,2]){let previous=Infinity;for(let d=0;d<=435;d+=5){const value=beamDamage(18,d,115,435,.28)*plasmaDamageFactor({path:'focus',rank},d,435);assert.ok(value<=previous+1e-8);previous=value;}}
});
test('splitting plasma preserves lone-target power and shares a finite salvo across a group',()=>{
 for(const count of [1,2,3]){const g=game();g.skillRanks.double=2;const targets=Array.from({length:count},(_,i)=>enemy(80,i*4));for(const e of targets)g.grid.insert(e);g.updateShipWeapons(.01);const factor=count===1?1:count===2?.6:.45;for(const e of targets)near(300-e.hp,18*factor);near(g.weaponThermal.current,6);}
});
test('one free choice is shared by both field modules and at most one Space action is installed',()=>{
 const g=game();g.paused=true;g.baseTab='hangar';g.overlay.hidden=false;g.baseAction('loanField','resonator');
 assert.equal(g.fieldLoan.moduleId,'resonator');assert.equal(g.player.ore,400);assert.ok(g.fieldTrialTaken);
 g.hangarAction({act:'hgApply'});assert.ok(g.weaponProfile.resonator);g.baseAction('loanField','ion');assert.equal(g.fieldLoan.moduleId,'resonator');
 const invalid={...g.shipLoadout,slots:['plasma','ion','resonator',null,null,null]};assert.equal(quoteLoadout(g.shipLoadout,invalid,{baseActive:true,level:14,ore:400,fieldLoan:g.fieldLoan}).ok,false);
 g.baseAction('returnField','');g.baseAction('loanField','ion');assert.equal(g.fieldLoan,null);
 assert.equal(moduleLock('rail',{level:2,earlyRail:true}),'');assert.match(moduleLock('rail',{level:2}),/3/);
});
test('resonator empty, lone, hidden and obstructed attempts consume neither charge nor cooldown',()=>{
 for(const condition of ['empty','lone','hidden','blocked']){
  const g=game();loan(g,'resonator');if(condition!=='empty')g.grid.insert(enemy(150));
  if(condition==='hidden')g.grid.insert({...enemy(200),signalIntel:{mode:'investigate'}});
  if(condition==='blocked'){g.grid.insert(enemy(270));g.rockGrid.insert(rock(210,0,40));}
  assert.equal(g.callFieldWeapon(),false,condition);assert.equal(g.fieldLoan.charges,3);assert.equal(g.fieldLoan.cooldownUntil,10);
 }
});
test('resonator links a group, transfers only effective HP loss once, and does no passive damage',()=>{
 const g=game();loan(g,'resonator');const a=enemy(150,0,10),b=enemy(210),c=enemy(250);for(const e of [a,b,c])g.grid.insert(e);
 assert.ok(g.callFieldWeapon());assert.equal(g.fieldLoan.charges,2);assert.equal(b.hp,300);
 damageTarget(g,{kind:'enemy',target:a},100,'rail');near(b.hp,296.5);near(c.hp,296.5);
 assert.equal(g.fieldLoan.charges,2,'ordinary shots do not consume field charges');
});
test('resonance stops across new cover, separated targets, expired duration and friendly conversion',()=>{
 for(const condition of ['cover','range','expired','friendly']){
  const g=game();loan(g,'resonator');const a=enemy(150),b=enemy(210);for(const e of [a,b])g.grid.insert(e);assert.ok(g.callFieldWeapon());
  if(condition==='cover'){b.x=350;g.rockGrid.insert(rock(250,0,40));}if(condition==='range')b.x=420;
  if(condition==='expired')g.time+=4.01;if(condition==='friendly')b.converted=true;
  damageTarget(g,{kind:'enemy',target:a},20,'rail');assert.equal(b.hp,300,condition);
 }
});
test('resonance respects the direction of the link at cargo armor, rather than the player position',()=>{
 const g=game();loan(g,'resonator');const op=createCarrierInterception({...g.docked,type:'carrier'});Object.assign(op,{x:200,y:0,phase:'pursuit',angle:Math.PI/2});g.operation=op;
 // Cargo faces right; the linked escort is behind it, and the player is in front.
 g.player.x=300;const a=enemy(100);g.grid.insert(a);g.grid.insert(op);assert.equal(carrierAspect(op,g.player),'front');assert.ok(g.callFieldWeapon());
 const before=op.hp;damageTarget(g,{kind:'enemy',target:a},20,'rail');near(before-op.hp,20*.35*1.35);
});
test('ion respects a blocked first leg and blocked links without spending a charge',()=>{
 const g=game();loan(g,'ion');const a={...enemy(150),ionMarkUntil:20},b={...enemy(270),ionMarkUntil:20};g.grid.insert(a);g.grid.insert(b);g.rockGrid.insert(rock(75,0,40));
 assert.equal(g.callIonDischarge(),false);assert.equal(g.fieldLoan.charges,3);
 const p=planIonDischarge([a,b],g.player,g.time,g.fieldLoan,(from,to)=>from===g.player);assert.equal(p.targets.length,1);
});
for(const [name,create] of [['jammer',createCorridorOperation],['probe',createProbeOperation],['relay',createRelayDefense],['cargo',createCarrierInterception]])test('field effects cooperate with '+name+' without targeting its friendly objective',()=>{
 const g=game();loan(g,'resonator');const station=name==='probe'?{...g.docked,type:'lab'}:name==='relay'?{...g.docked,type:'arsenal'}:name==='cargo'?{...g.docked,type:'carrier'}:g.docked;
 const op=create(station,g.world);Object.assign(op,{x:200,y:0});if(name==='cargo')op.phase='pursuit';g.operation=op;
 const a=enemy(150),b=enemy(250);g.grid.insert(a);g.grid.insert(b);assert.ok(g.callFieldWeapon());
 const linked=g.fieldEffects[0].targets.map(x=>x.target);assert.equal(linked.includes(op),name==='cargo'||name==='jammer');
 const hp=op.hp;damageTarget(g,{kind:'enemy',target:a},20,'rail');if(name==='probe'||name==='relay')assert.equal(op.hp,hp);
});
test('a completed ordinary contract cannot return a loan assigned to the still-active operation',()=>{
 const g=game();g.operation=createCorridorOperation(g.docked);loan(g,'resonator');bindFieldLoan(g.fieldLoan,missionAssignment(g.operation,null));
 const c={baseId:g.docked.id,choiceId:'standard',kind:'kill'};finishFieldAssignment(g.fieldLoan,'contract',c);assert.equal(g.fieldLoan.returnDue,false);
 finishFieldAssignment(g.fieldLoan,'operation',g.operation);assert.equal(g.fieldLoan.returnDue,true);
});
test('first accepted assignment keeps the loan even after another assignment is taken',()=>{
 const a={baseId:'0:0',id:'silent-corridor'},c={baseId:'0:0',kind:'kill',choiceId:'alternate'},l=createFieldLoan('ion','0:0');
 bindFieldLoan(l,missionAssignment(null,c));bindFieldLoan(l,missionAssignment(a,c));assert.equal(l.assignment.kind,'contract');
 finishFieldAssignment(l,'operation',a);assert.equal(l.returnDue,false);finishFieldAssignment(l,'contract',c);assert.ok(l.returnDue);
});
test('refills have a visible finite capacity, spend resources and preserve cooldown',()=>{
 const g=game();loan(g,'resonator');g.fieldLoan.charges=1;g.fieldLoan.cooldownUntil=16;const start=g.player.ore;
 g.baseAction('fieldCharge');g.baseAction('fieldCharge');g.baseAction('fieldCharge');assert.equal(g.fieldLoan.charges,3);assert.equal(g.player.ore,start-16);assert.equal(g.fieldLoan.cooldownUntil,16);
 assert.equal(refillQuote(g.fieldLoan,400).ok,false);g.fieldLoan.charges=0;assert.equal(refillQuote(g.fieldLoan,7).ok,false);
});
test('finite operation guards can drop one field cell per station and operation, including no-XP relay guards',()=>{
 const g=game();loan(g,'resonator');g.fieldLoan.charges=1;
 const guard=()=>({...enemy(150),hp:0,expAwarded:true,fieldChargeOperation:'relay-defense',fieldChargeBaseId:g.docked.id});
 assert.ok(g.issueFieldCharge(guard()));assert.equal(g.drops[0].type,'fieldCell');assert.equal(g.issueFieldCharge(guard()),false);
 const cell=g.drops[0];g.fieldLoan.charges=3;assert.equal(g.collect(cell),false);g.fieldLoan.charges=1;g.collect(cell);assert.equal(g.fieldLoan.charges,2);assert.equal(g.player.data,0);
 const saved=unpackRun(packRun(checkpoint(g))),fresh=game();restoreCheckpoint(fresh,saved);fresh.fieldLoan.charges=0;
 assert.equal(fresh.issueFieldCharge(guard()),false,'abandon, retry and reload cannot farm the same reward');
});
test('loading a blueprint or unequipping a field module never refills its ammunition',()=>{
 const g=game();loan(g,'resonator');g.fieldLoan.charges=1;g.fieldLoan.used=2;g.hangarSession.begin(g.shipLoadout);
 g.hangarSession.dispatch({act:'hgSave',id:'0'},{loadout:g.shipLoadout,level:14,baseActive:true,ore:400,fieldLoan:g.fieldLoan});
 g.shipLoadout.slots[1]=null;g.syncShipLoadout();assert.equal(g.fieldLoan.charges,1);assert.deepEqual(g.fieldEffects,[]);
 g.hangarSession.dispatch({act:'hgLoad',id:'0'},{loadout:g.shipLoadout,level:14,baseActive:true,ore:400,fieldLoan:g.fieldLoan});assert.equal(g.fieldLoan.charges,1);
});
test('frozen v1 checkpoint migrates a spent ion loan and preserves the original operation identity',()=>{
 const storage=memory(),legacy=readFileSync(new URL('./fixtures/run-checkpoint-v1.json',import.meta.url),'utf8');storage.setItem(RUN_KEYS[0],legacy);
 const store=new RunCheckpointStore(storage),data=store.load();assert.ok(data);assert.equal(data.version,2);
 const g=game();restoreCheckpoint(g,data);assert.equal(g.player.hp,73);assert.equal(g.player.ore,16);assert.equal(g.player.data,93);
 assert.equal(g.fieldLoan.moduleId,'ion');assert.equal(g.fieldLoan.charges,1);assert.equal(g.fieldLoan.used,2);assert.equal(g.fieldLoan.cooldownUntil,246);
 assert.equal(g.fieldLoan.assignment.id,g.operation.id);assert.equal(g.world.home.corridorMission,g.operation);
 assert.ok(store.save(captureCheckpoint(g,g.docked)).ok);assert.equal(JSON.parse(storage.getItem(RUN_KEYS[1])).format,2);
});
test('v2 checkpoint preserves live resonance references and finite ammunition',()=>{
 const g=game();loan(g,'resonator');const a=enemy(100),b=enemy(200);g.enemies=[a,b];g.grid.insert(a);g.grid.insert(b);g.callFieldWeapon();
 const restored=game(),state=unpackRun(packRun(checkpoint(g)));restoreCheckpoint(restored,state);
 assert.equal(restored.fieldLoan.charges,2);assert.equal(restored.fieldEffects[0].targets[0].target,restored.enemies[0]);
 restored.time=15;updateFieldEffects(restored);assert.equal(restored.fieldEffects.length,0);
});

// Exercise the whole production update loop, including acceleration, terrain,
// enemy AI, missiles, repair interruptions, charges, rewards and actual return.
test('all four authored operations finish with three builds at 30 and 60 simulation steps per second',async()=>{
 const {runScenarioMatrix}=await import('../tools/weapons-cycle-scenarios.mjs');
 const {results}=runScenarioMatrix();assert.equal(results.length,24);
 for(const r of results){assert.ok(r.completed,r.job+' '+r.kit+' '+r.hz);assert.ok(r.returned);assert.ok(!r.dead);assert.ok(r.hull>0);}
 for(const a of results.filter(r=>r.hz===60)){
  const b=results.find(r=>r.hz===30&&r.job===a.job&&r.kit===a.kit);
  assert.ok(Math.abs(a.seconds-b.seconds)<10,a.job+' '+a.kit+' should remain playable at both timesteps');
 }
});

test('calibration keeps the finite ion burst useful as automatic damage grows, and hangar shows its actual hits',()=>{
 const g=game();loan(g,'ion');g.skillRanks.beam=5;
 const a={...enemy(150),ionMarkUntil:20},b={...enemy(220),ionMarkUntil:20};g.grid.insert(a);g.grid.insert(b);
 assert.equal(moduleStats('ion',g.skillRanks).damage,'76 / 60 / 44');assert.ok(g.callIonDischarge());
 near(300-a.hp,76);near(300-b.hp,60);assert.equal(g.fieldLoan.charges,2);
});

test('overheat never invites an attack from outside the equipped range',()=>{
 const op={id:'silent-corridor',hp:100,overheatedUntil:20};
 assert.match(corridorCue(op,10,500,245).hint,/СБЛИЗЬТЕСЬ ДО 245/);
 assert.doesNotMatch(corridorCue(op,10,500,245).hint,/АТАКУЙТЕ/);
 assert.match(corridorCue(op,10,500,700).hint,/АТАКУЙТЕ/);
});

test('an already-completed ordinary contract cannot waste a newly borrowed trial on its reward screen',()=>{
 const g=game(),ready={baseId:g.docked.id,choiceId:'standard',kind:'kill',goal:4,progress:4};
 g.contract=ready;g.paused=true;g.overlay.hidden=false;g.baseTab='hangar';g.baseAction('loanField','resonator');
 assert.equal(g.fieldLoan.assignment,null);assert.equal(g.fieldLoan.charges,3);
 finishFieldAssignment(g.fieldLoan,'contract',ready);assert.equal(g.fieldLoan.returnDue,false);
 const next={...ready,progress:0};bindFieldLoan(g.fieldLoan,missionAssignment(null,next));assert.equal(g.fieldLoan.assignment.kind,'contract');
});
