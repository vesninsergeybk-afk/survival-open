import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {baseOffer,renderBasePanel,contractChoices,contractOffer,eligibleContractProgress,stationModule,transitCost} from '../base-panel.js';
import {baseNames} from '../balance.js';
import {World} from '../world.js';

const state=(extra={})=>({
 ore:80,hp:110,maxHp:110,shield:0,activeBases:1,connectedBases:1,connected:true,
 allies:0,droneRoles:[],droneDamage:0,charges:0,transfers:[],contract:null,
 network:{armor:0,armament:0,engine:0,strikePower:0},...extra
});
const station=(type='dock')=>({id:'0:0',x:0,y:0,type,active:true,usedUpgrade:false});

const gameSource=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const start=gameSource.indexOf(' baseAction(act,role){');
const end=gameSource.indexOf('\n callStrike(){',start);
assert.ok(start>=0&&end>start,'baseAction method must exist');
const Actions=new Function('baseOffer','transitCost','baseNames','stationModule',
 'return class TestActions {'+gameSource.slice(start,end)+'}')(baseOffer,transitCost,baseNames,stationModule);
const fakeGame=(base)=>({
 dead:false,docked:base,contract:null,time:10,player:{ore:80,data:0,hp:110,maxHp:110,shield:0,points:0},
 heritage:{station:()=>{},ui:()=>{},vfx:{nova:()=>{}}},cockpit:{resourceGain:()=>{}},
 notice:()=>{},renderDock(){},collect(item){this.player.data+=item.value;},
 baseState(){return state({ore:this.player.ore,contract:this.contract});}
});

test('each station offers exactly two mutually exclusive tasks',()=>{
 for(const type of ['dock','lab','arsenal','carrier']){
  const options=contractChoices(type);
  assert.equal(options.length,2);
  assert.notEqual(options[0].kind+options[0].goal,options[1].kind+options[1].goal);
  const html=renderBasePanel(station(type),state());
  assert.match(html,/data-act="acceptContract" data-role="standard"/);
  assert.match(html,/data-act="acceptContract" data-role="alternate"/);
 }
});

test('alternate task pays its own reward and remains selected after claiming',()=>{
 const dock=station(),game=fakeGame(dock);
 Actions.prototype.baseAction.call(game,'acceptContract','alternate');
 assert.equal(game.contract.choiceId,'alternate');
 assert.equal(game.contract.kind,'rich');
 assert.equal(game.contract.goal,1);
 assert.equal(eligibleContractProgress(game.contract,'kill',{type:'scout'}),false);
 assert.equal(eligibleContractProgress(game.contract,'mine',{rich:true}),true);
 game.contract.progress=1;
 Actions.prototype.baseAction.call(game,'claimContract','');
 assert.equal(game.contract,null);
 assert.equal(game.player.ore,90);
 assert.equal(game.player.data,24);
 assert.equal(dock.completedContract,'alternate');
 assert.equal(contractOffer(dock,game.baseState()).name,'Геологические сведения');
 assert.equal(contractOffer(dock,game.baseState()).status,'cooldown');
 assert.match(renderBasePanel(dock,game.baseState()),/data-act="acceptContract" disabled>Ожидание/);
});

test('station module purchase is affordable, local, and irreversible',()=>{
 const dock=station(),game=fakeGame(dock);
 game.player.ore=20;
 Actions.prototype.baseAction.call(game,'installModule','workshop');
 assert.equal(dock.module,undefined);
 assert.equal(game.player.ore,20);
 game.player.ore=80;
 Actions.prototype.baseAction.call(game,'installModule','workshop');
 assert.equal(dock.module,'workshop');
 assert.equal(game.player.ore,42);
 Actions.prototype.baseAction.call(game,'installModule','bulwark');
 assert.equal(dock.module,'workshop');
 assert.equal(game.player.ore,42);
 assert.equal(baseOffer(dock,game.baseState()).moduleOptions.every(m=>!!m.reason),true);
});

test('unexplored signals do not reveal the base type, enemy bases, or exact coordinates',()=>{
 const world=new World(20261102);
 world.discover(0,0,560);
 const count=world.discovered.size;
 const signals=world.signals(0,0,3000,false);
 assert.ok(signals.length>0);
 assert.equal(world.discovered.size,count);
 for(const signal of signals){
  const actual=world.stations.get(signal.id);
  assert.ok(actual&&!actual.discovered&&!actual.enemy);
  assert.equal('type' in signal,false);
  assert.ok(Math.hypot(actual.x-signal.x,actual.y-signal.y)<=170);
 }
});

test('an unfinished assignment may be abandoned without locking progression',()=>{
 const dock=station(),game=fakeGame(dock);
 Actions.prototype.baseAction.call(game,'acceptContract','alternate');
 assert.equal(game.contract.choiceId,'alternate');
 const abandonStart=gameSource.indexOf('  abandonContract(){');
 const abandonEnd=gameSource.indexOf('\n  openMap(){',abandonStart);
 assert.ok(abandonStart>=0&&abandonEnd>abandonStart);
 const Cancel=new Function('renderWorldMap','return class TestCancel {'+
  gameSource.slice(abandonStart,abandonEnd)+'}')(null);
 game.overlay={dataset:{mode:'base'}};
 Cancel.prototype.abandonContract.call(game);
 assert.equal(game.contract,null);
 assert.equal(dock.contractClaimed,undefined);
 assert.equal(baseOffer(dock,game.baseState()).contract.status,'available');
});

test('network favors actual routes, and antenna can bridge a distant station',()=>{
 const world=new World(20261102),home=world.home;
 home.active=true;
 const distant=world.station(1,-1),north=world.station(0,-1);
 assert.ok(distant&&!distant.enemy&&north&&!north.enemy);
 distant.active=true;
 assert.equal(world.networkTopology().count,1);
 assert.equal(world.networkTopology(home.id).count,2);
 home.relayBoost=true;
 assert.equal(world.networkTopology().count,2);
 // An ordinary intermediate station can connect the same area without upgrades.
 home.relayBoost=false;north.active=true;
 assert.equal(world.networkTopology().count,3);
});

test('capturing a hostile installation changes local sector pressure',()=>{
 const world=new World(20261102);
 const hostile=world.nearbyStations(0,0,6000,true).find(b=>b.enemy);
 assert.ok(hostile);
 assert.equal(world.sectorControl(hostile.x,hostile.y).kind,'hostile');
 hostile.hp=Math.round(hostile.maxHp*.3);
 hostile.enemy=false;hostile.active=true;hostile.captured=true;
 assert.equal(world.sectorControl(hostile.x,hostile.y).kind,'secured');
});

test('civilian station prices ignore captured enemy installations',()=>{
 const ordinary=station('lab');
 const quote=baseOffer({...ordinary,active:false},
  state({activeBases:6,civilianBases:2,ore:100}));
 assert.equal(quote.relayCost,34);
});

test('the scheduled wave director responds to nearby enemy control and capture',()=>{
 const world=new World(20261102);
 const enemy=world.nearbyStations(0,0,6000,true).find(b=>b.enemy);
 assert.ok(enemy);
 const i=gameSource.indexOf(' sectorDirector(director){');
 const j=gameSource.indexOf('\n spawnGroup(',i);
 assert.ok(i>=0&&j>i);
 const Sector=new Function('RULES','return class Sector {'+gameSource.slice(i,j)+'}')( {maxEnemies:180} );
 const context={player:{x:enemy.x,y:enemy.y},world,enemyBasesUnlocked:()=>true};
 const wave={types:['fighter'],cap:20,interval:6};
 const hostile=Sector.prototype.sectorDirector.call(context,wave);
 assert.equal(hostile.cap,23);
 assert.ok(hostile.interval<6);
 enemy.enemy=false;enemy.captured=true;enemy.active=true;
 const safe=Sector.prototype.sectorDirector.call(context,wave);
 assert.equal(safe.cap,17);
 assert.ok(safe.interval>6);
 assert.equal(wave.interval,6);
});

test('buying a relay antenna spends alloy once and changes topology',()=>{
 const world=new World(20261102),dock=world.home;
 dock.active=true;
 const fake=fakeGame(dock);
 fake.world=world;
 fake.player.ore=80;
 fake.baseState=()=>state({ore:fake.player.ore,connected:true,
  connectedBases:world.networkTopology().count});
 Actions.prototype.baseAction.call(fake,'antenna');
 assert.equal(fake.player.ore,46);
 assert.equal(dock.relayBoost,true);
 Actions.prototype.baseAction.call(fake,'antenna');
 assert.equal(fake.player.ore,46);
});

test('hangar acknowledges a hired drone instead of suggesting an impossible second purchase',()=>{
 const html=renderBasePanel(station(),state({ore:0,allies:1,droneRoles:['scout'],baseTab:'hangar'}));
 assert.match(html,/Дрон «Страж» уже в строю/);
 assert.doesNotMatch(html,/Дрон: 20 сплава · не хватает/);
});
