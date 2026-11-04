import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../world.js';
import {createLoadout,createThermal} from '../ship-loadout.js';
import {createCorridorOperation} from '../operations.js';
import {createCarrierInterception} from '../carrier-interception.js';
import {createIonLoan} from '../ion-conductor.js';
import {RUN_KEYS,RunCheckpointStore,captureCheckpoint,restoreCheckpoint,packRun,unpackRun,validateCheckpoint} from '../run-checkpoint.js';

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
  contract:null,operation:null,ionLoan:null,ionTrialTaken:false,ionMasteryAwarded:false,
  lastDamageAt:-Infinity,ionReturnAt:-Infinity,activeBases:1,
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
 const g=scene();g.ionLoan=createIonLoan(g.docked.id,200);g.ionLoan.charges=1;
 g.ionLoan.used=2;g.ionLoan.cooldownUntil=247;g.ionLoan.missionStarted=true;g.ionTrialTaken=true;
 g.shipLoadout.slots[1]='ion';
 const {storage}=save(g),fresh=scene();restoreCheckpoint(fresh,new RunCheckpointStore(storage).load());
 assert.equal(fresh.ionLoan.charges,1);assert.equal(fresh.ionLoan.used,2);
 assert.equal(fresh.ionLoan.cooldownUntil,247);assert.ok(fresh.ionTrialTaken);
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
