import {RuntimeHarness} from './runtime-game.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {activationCost,transitCost,baseOffer,renderBasePanel,contractFor,contractOffer,eligibleContractProgress} from '../base-panel.js';
import {baseNames} from '../balance.js';
import {markDockEvent} from '../repair-dock-art.js';
import {readFileSync} from 'node:fs';

const base=(type='dock',extra={})=>({
 id:'0:0',x:0,y:0,type,active:false,usedUpgrade:false,...extra
});
const state=(extra={})=>({
 ore:0,hp:75,maxHp:110,shield:0,scanRemaining:0,overchargeRemaining:0,
 activeBases:0,connectedBases:0,connected:false,
 allies:0,droneRoles:[],droneDamage:0,charges:0,doctrine:null,transfers:[],
 network:{armor:0,armament:0,engine:0,strikePower:0},...extra
});

test('first dock is free, gives precisely one 20-alloy starter drone',()=>{
 const o=baseOffer(base(),state());
 assert.equal(o.relayCost,0);
 assert.equal(o.rewardAlloy,20);
 assert.equal(o.rewardRepair,11);
 assert.equal(o.hireCost,20);
 assert.equal(o.cap,1);
 const v=renderBasePanel(base(),state());
 assert.match(v,/Запустить бесплатно/);
 assert.doesNotMatch(v,/data-act="hire"/);
 assert.match(v,/После подключения/);
});

test('additional bases have rising, capped activation prices and no repeat reward',()=>{
 assert.deepEqual([0,1,2,3,10,100].map(activationCost),[0,24,34,44,84,84]);
 const o=baseOffer(base('arsenal'),state({ore:10,activeBases:1}));
 assert.equal(o.relayCost,24);
 assert.equal(o.rewardAlloy,0);
 assert.equal(o.reasons.activate,'Не хватает 14 ед. сплава');
 assert.match(renderBasePanel(base('arsenal'),state({ore:10,activeBases:1})),
  /Подключить · 24 сплава/);
});

test('connected network opens second slot, but fleet never exceeds two escorts',()=>{
 const one=baseOffer(base('dock',{active:true}),
  state({ore:200,activeBases:1,connected:true,connectedBases:1,allies:1,droneRoles:['scout']}));
 assert.equal(one.cap,1);
 assert.match(one.reasons.hire,/Лимит 1/);
 const two=baseOffer(base('arsenal',{active:true}),
  state({ore:200,activeBases:2,connected:true,connectedBases:2,allies:1,droneRoles:['scout']}));
 assert.equal(two.cap,2);
 assert.equal(two.hireCost,54);
 assert.equal(two.reasons.hire,'');
 const full=baseOffer(base('arsenal',{active:true}),
  state({ore:200,activeBases:2,connected:true,connectedBases:2,allies:2,droneRoles:['fighter','fighter']}));
 assert.match(full.reasons.hire,/Лимит 2/);
 const replacement=baseOffer(base('arsenal',{active:true}),
  state({ore:200,activeBases:2,connected:true,connectedBases:2,allies:2,droneRoles:['scout','fighter']}));
 assert.equal(replacement.replacing,true);
 assert.equal(replacement.hireCost,42);
});

test('unconnected stations cannot research network technologies',()=>{
 const disconnected=baseOffer(base('lab',{active:true}),
  state({ore:100,activeBases:2,connectedBases:1,connected:false}));
 assert.match(disconnected.reasons.upgrade,/Соедините станцию/);
 const connected=baseOffer(base('lab',{active:true}),
  state({ore:100,activeBases:2,connectedBases:2,connected:true}));
 assert.equal(connected.upgradeCost,52);
 assert.equal(connected.reasons.upgrade,'');
 const spent=baseOffer(base('lab',{active:true,usedUpgrade:true}),
  state({ore:100,activeBases:2,connectedBases:2,connected:true}));
 assert.match(spent.reasons.upgrade,/Технология этой станции изучена/);
});

test('repair only spends alloy when there is real damage',()=>{
 const full=baseOffer(base('dock',{active:true}),
  state({ore:100,hp:110,connected:true}));
 assert.equal(full.reasons.repair,'Корпус цел');
 assert.equal(full.reasons.drones,'Дроны исправны');
 const damaged=baseOffer(base('dock',{active:true}),
  state({ore:100,hp:50,droneDamage:40,connected:true}));
 assert.equal(damaged.reasons.repair,'');
 assert.equal(damaged.reasons.drones,'');
});

test('airstrike supply is a finite consumable locked to connected carrier',()=>{
 const carrier=base('carrier',{active:true});
 const ready=baseOffer(carrier,state({ore:80,connected:true,connectedBases:3,
  network:{armor:0,armament:0,engine:0,strikePower:1}}));
 assert.equal(ready.chargeCost,40);
 assert.equal(ready.reasons.supply,'');
 const full=baseOffer(carrier,state({ore:80,connected:true,connectedBases:3,charges:2,
  network:{armor:0,armament:0,engine:0,strikePower:1}}));
 assert.match(full.reasons.supply,/Два вылета/);
});

test('transit is useful only between connected relays and has a visible cost',()=>{
 const origin=base('dock',{active:true});
 const destination={id:'1:0',x:1250,y:0,type:'lab'};
 assert.equal(transitCost(origin,destination),28);
 const one=renderBasePanel(origin,state({ore:100,activeBases:1,
  connected:true,connectedBases:1,transfers:[destination]}));
 assert.doesNotMatch(one,/МАРШРУТЫ СЕТИ/);
 const two=renderBasePanel(origin,state({ore:100,activeBases:2,
  connected:true,connectedBases:2,transfers:[destination]}));
 assert.match(two,/МАРШРУТЫ СЕТИ/);
 assert.match(two,/Лаборатория.*28 сплава/);
 assert.match(two,/data-act="transfer" data-role="1:0"/);
 const poor=renderBasePanel(origin,state({ore:4,activeBases:2,
  connected:true,connectedBases:2,transfers:[destination]}));
 assert.match(poor,/data-act="transfer" data-role="1:0" disabled/);
});

test('activated stations issue renewable field assignments with a cooldown',()=>{
 const dock=base('dock',{active:true});
 assert.equal(contractOffer(dock,state()).status,'available');
 assert.equal(contractFor('dock').goal,4);
 assert.equal(contractFor('lab').kind,'rich');
 assert.match(renderBasePanel(dock,state()),/data-act="acceptContract"/);
 const mission={baseId:dock.id,kind:'kill',goal:4,progress:4};
 assert.match(renderBasePanel(dock,state({contract:mission})),/data-act="claimContract"/);
 assert.equal(contractOffer({...dock,contractClaimed:true,contractRuns:1,
  contractCooldownUntil:160},state({time:20})).status,'cooldown');
 assert.equal(contractOffer({...dock,contractClaimed:true,contractRuns:1,
  contractCooldownUntil:160},state({time:161})).status,'available');
 const foreign=contractOffer(base('lab',{id:'9:9',active:true}),state({contract:mission}));
 assert.equal(foreign.status,'other');
});

test('station objectives count only relevant real events',()=>{
 const dock={...contractFor('dock'),progress:0},lab={...contractFor('lab'),progress:0};
 const arsenal={...contractFor('arsenal'),progress:0};
 const carrier={...contractFor('carrier'),progress:0};
 const station={x:100,y:200};
 assert.equal(eligibleContractProgress(dock,'kill',{type:'scout'}),true);
 assert.equal(eligibleContractProgress(lab,'mine',{rich:false}),false);
 assert.equal(eligibleContractProgress(lab,'mine',{rich:true}),true);
 assert.equal(eligibleContractProgress(lab,'kill',{rich:true}),false);
 assert.equal(eligibleContractProgress(arsenal,'kill',{x:750,y:200},station),true);
 assert.equal(eligibleContractProgress(arsenal,'kill',{x:751,y:200},station),false);
 assert.equal(eligibleContractProgress(arsenal,'mine',{x:200,y:200},station),false);
 assert.equal(eligibleContractProgress(carrier,'kill',{type:'scout'}),false);
 for(const type of ['fighter','flanker','berserker','gunship'])
  assert.equal(eligibleContractProgress(carrier,'kill',{type}),true);
 assert.equal(eligibleContractProgress({...carrier,progress:5},'kill',{type:'fighter'}),false);
});

test('accepting and claiming a station assignment immediately refreshes its menu',()=>{
 // Exercise the real ArcadeGame action method without starting a browser loop.
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const start=source.indexOf(' baseAction(act,role){');
 const end=source.indexOf('\n callStrike(){',start);
 assert.ok(start>=0&&end>start,'baseAction must remain available');
 const method=source.slice(start,end);
 const Actions=RuntimeHarness;
 const dock=base('dock',{active:true});
 const fake={
  dead:false,docked:dock,contract:null,time:20,renders:0,
  player:{ore:0,data:0,hp:110,maxHp:110,shield:0,points:0,x:0,y:0},
  heritage:{station:()=>{},vfx:{nova:()=>{}}},cockpit:{resourceGain:()=>{}},
  notice:()=>{},renderDock(){this.renders++;},
  collect(item){this.player.data+=item.value;},
  baseState(){return state({ore:this.player.ore,contract:this.contract});}
 };
 Actions.prototype.baseAction.call(fake,'acceptContract');
 assert.equal(fake.contract.kind,'kill');
 assert.equal(fake.renders,1);
 assert.equal(fake.pausedRenderPending,true);
 const before=renderBasePanel(dock,fake.baseState());
 assert.match(before,/Выполняется · 0\/4/);
 fake.contract.progress=4;
 Actions.prototype.baseAction.call(fake,'claimContract');
 assert.equal(fake.contract,null);
 assert.equal(dock.contractClaimed,true);
 assert.equal(fake.player.ore,16);
 assert.equal(fake.player.data,15);
 assert.equal(fake.renders,2);
 assert.match(renderBasePanel(dock,fake.baseState()),/Ожидание/);
});

test('each civilian station has a bounded, clearly priced local service',()=>{
 const dock=baseOffer(base('dock',{active:true}),state({ore:100}));
 assert.equal(dock.localService.key,'shield');
 assert.equal(dock.reasons.service,'');
 assert.match(renderBasePanel(base('dock',{active:true}),state({ore:100})),/Аварийный конденсатор/);
 const full=baseOffer(base('dock',{active:true}),state({ore:100,shield:30}));
 assert.equal(full.reasons.service,'Щит уже заряжен');
 const lab=baseOffer(base('lab',{active:true}),state({ore:12,scanRemaining:0}));
 assert.equal(lab.localService.key,'scan');
 assert.equal(lab.reasons.service,'');
 const running=baseOffer(base('lab',{active:true}),state({ore:100,scanRemaining:44.2}));
 assert.match(running.reasons.service,/45 с/);
 const arsenal=baseOffer(base('arsenal',{active:true}),state({ore:20}));
 assert.equal(arsenal.localService.key,'overcharge');
 assert.match(arsenal.reasons.service,/8 ед. сплава/);
 const carrier=baseOffer(base('carrier',{active:true}),state({ore:100}));
 assert.equal(carrier.localService,null);
 assert.match(renderBasePanel(base('carrier',{active:true}),state({ore:100})),/УДАРНАЯ ЭСКАДРИЛЬЯ/);
});

test('dock emergency shield can be bought once, without double-spending',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 const start=source.indexOf(' baseAction(act,role){');
 const end=source.indexOf('\n callStrike(){',start);
 const Actions=RuntimeHarness;
 const dock=base('dock',{active:true});
 const fake={
  dead:false,docked:dock,time:20,contract:null,
  player:{ore:50,hp:110,maxHp:110,shield:0},
  heritage:{station:()=>{},vfx:{nova:()=>{}}},
  baseState(){return state({ore:this.player.ore,shield:this.player.shield});},
  notice:()=>{},renderDock(){this.renders=(this.renders||0)+1;}
 };
 Actions.prototype.baseAction.call(fake,'service');
 assert.equal(fake.player.shield,30);
 assert.equal(fake.player.ore,26);
 assert.equal(fake.renders,1);
 Actions.prototype.baseAction.call(fake,'service');
 assert.equal(fake.player.shield,30);
 assert.equal(fake.player.ore,26);
 assert.equal(fake.renders,1);
});

test('antenna is a real station purchase with visible network reach',()=>{
 const dock=base('dock',{active:true});
 const before=baseOffer(dock,state({ore:40,relayGain:2}));
 assert.equal(before.antennaCost,34);
 assert.equal(before.reasons.antenna,'');
 const html=renderBasePanel(dock,state({ore:40,relayGain:2}));
 assert.match(html,/data-act="antenna"/);
 assert.match(html,/Сейчас подключит ещё 2/);
 const installed=baseOffer({...dock,relayBoost:true},state({ore:40}));
 assert.match(installed.reasons.antenna,/уже усилена/);
});
