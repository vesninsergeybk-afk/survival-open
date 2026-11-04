import {EnemyComms} from '../enemy-comms.js';
import {SpatialGrid} from '../balance.js';
import {createFieldLoan} from '../field-weapons.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {createLoadout,createThermal} from '../ship-loadout.js';
import {createCorridorOperation} from '../operations.js';
import {createCarrierInterception} from '../carrier-interception.js';
import {createIonLoan} from '../ion-conductor.js';
import {RUN_KEYS,RunCheckpointStore,captureCheckpoint,restoreCheckpoint,packRun,unpackRun,validateCheckpoint} from '../run-checkpoint.js';
import {startSortie,finishSortie,appendSortieReport} from '../sortie-economy.js';
import {emptyEconomyExpenses,recordEconomyExpense} from '../sortie-ledger.js';
import {transitCost} from '../base-panel.js';

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
  player:{x:base.x+55,y:base.y+30,vx:0,vy:0,r:19,hp:73,maxHp:110,
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
});
test('station point defense does not regain spent charges when the run is resumed',()=>{
 const g=scene(),base=g.docked;
 base.defense={charges:0,rechargeAt:260.5,interceptAt:244.2,
  stasisAt:270.1,visualAt:242,visualKind:'meteor'};
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
 g.advanceContract('kill',{type:'scout',x:b.x,y:b.y});
 assert.equal(g.contract.completedSortieId,g.sortieStart.id);
 g.time+=45;g.player.data+=7;
 g.sortieReports=appendSortieReport(g.sortieReports,finishSortie(g.sortieStart,g,b));
 g.sortieStart=null;g.renderDock=noop;
 g.baseAction('claimContract','');
 assert.equal(g.player.ore,36);assert.equal(g.player.data,52);
 assert.equal(g.sortieReports[0].ore,16);
 assert.equal(g.sortieReports[0].data,22);
 assert.equal(g.sortieReports[0].details.oreContracts,16);
 assert.equal(g.sortieReports[0].details.dataContracts,15);
 assert.deepEqual(g.lastContractReceipt,{ore:16,data:15,credited:true});
 g.baseAction('claimContract','');
 assert.equal(g.player.ore,36);assert.equal(g.sortieReports[0].ore,16);
 const {storage}=save(g),fresh=scene();restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 assert.equal(fresh.player.ore,36);assert.equal(fresh.sortieReports[0].ore,16);
 assert.equal(fresh.sortieReports[0].details.oreContracts,16);
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
test('a paid network transfer creates one accounted flight and credits its original contract',()=>{
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
 assert.equal(g.sortieReports[0].ore,12);
 assert.equal(g.sortieReports[0].data,8);
 assert.equal(g.sortieReports[0].hull,-9);
 g.baseAction('claimContract','');
 assert.equal(g.player.ore,86-price+12+10);
 assert.equal(g.sortieReports[0].ore,22);
 assert.equal(g.sortieReports[0].details.oreContracts,10);
 assert.equal(g.lastContractReceipt.credited,true);
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
 g.operation=op;g.docked.corridorMission=op;
 const {storage}=save(g),fresh=scene();restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 fresh.deliverCorridor();assert.equal(fresh.player.ore,50);assert.equal(fresh.player.data,52);
 assert.ok(fresh.world.home.corridorSecured);assert.equal(fresh.operation,null);
 const store=new RunCheckpointStore(storage);store.load();assert.ok(store.save(captureCheckpoint(fresh,fresh.docked)).ok);
 const again=scene();restoreCheckpoint(again,new RunCheckpointStore(storage).load());again.deliverCorridor();
 assert.equal(again.player.ore,50);assert.equal(again.player.data,52);assert.ok(again.world.home.corridorSecured);
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
test('death and a deliberate new flight suppress older backup continuations',()=>{
 const g=scene(),{store,storage}=save(g);assert.ok(store.end().ok);
 assert.equal(new RunCheckpointStore(storage).load(),null);
 const next=new RunCheckpointStore(storage);next.load();next.startNew();
 assert.equal(new RunCheckpointStore(storage).load(),null);
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
 const g=scene(),{store,storage}=save(g);g.player.note='x'.repeat(850000);
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
 let sky=null,rendered=false;g.visuals={updateSky(x,y){sky=[x,y];}};
 g.heritage.pause=noop;g.hangarSession={begin:noop};
 g.renderDock=()=>{
  assert.deepEqual(sky,[g.player.x,g.player.y]);
  assert.ok(g.nearRocks.length>0);assert.ok(g.localStations.includes(g.docked));
  assert.ok(g.paused);assert.equal(g.time,original.time);rendered=true;
 };
 g.continueRun();assert.ok(rendered);assert.equal(g.pendingCheckpoint,null);
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
