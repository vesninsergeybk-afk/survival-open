import test from 'node:test';
import assert from 'node:assert/strict';
import {game} from './weapons-scene.mjs';
import {baseOffer,contractOffer,contractReadyAtStation,renderBasePanel} from '../base-panel.js';
import {STATION_MIN_CONTRACTS,stationReputationGoal,stationReputationReady,
 stationReputation,awardStationReputation} from '../station-reputation.js';

const neutral=(rank=1)=>({id:'1:0',x:1400,y:0,type:'lab',rank,active:false,
 enemy:false,discovered:true,hp:800,maxHp:800,turrets:[],usedUpgrade:false});

test('trust is earned at the issuing station and requires separate completed orders',()=>{
 const a=neutral(),b={...neutral(),id:'2:0'};
 assert.equal(STATION_MIN_CONTRACTS,2);
 assert.equal(stationReputationGoal(a),3);
 assert.equal(stationReputationReady(a),false);
 assert.equal(awardStationReputation(a,'standard'),2);
 a.contractRuns=1;
 assert.equal(stationReputationReady(a),false,'one valuable task cannot unlock a station');
 assert.equal(awardStationReputation(a,'alternate'),1);
 a.contractRuns=2;
 assert.equal(stationReputationReady(a),true);
 assert.equal(stationReputationReady(b),false,'orders do not unlock another station');
 assert.equal(awardStationReputation(a,'standard'),0,'trust cannot grow past the threshold');
 assert.equal(stationReputation(a),3);
});

test('remote station difficulty rises gradually; home and already owned stations remain valid',()=>{
 assert.deepEqual([1,2,3,4,5].map(rank=>stationReputationGoal(neutral(rank))),[3,3,4,4,5]);
 const remote=neutral(5);
 remote.contractRuns=2;remote.reputation=4;
 assert.equal(stationReputationReady(remote),false);
 awardStationReputation(remote,'alternate');remote.contractRuns++;
 assert.equal(stationReputationReady(remote),true);
 assert.equal(stationReputationReady({...remote,enemy:true,active:false}),false);
 assert.equal(stationReputationReady({...remote,ruined:true,active:false}),false);
 assert.equal(stationReputationReady({id:'0:0',active:false}),true);
 assert.equal(stationReputationReady({...neutral(),active:true}),true);
});

test('neutral station UI offers contracts but locks activation and communicates progress',()=>{
 const b=neutral(),state={ore:500,activeBases:1,civilianBases:1,
  network:{armor:0,armament:0,engine:0,strikePower:0},
  transfers:[],connectedBases:1,hp:100,maxHp:100,allies:0,droneRoles:[]};
 assert.equal(contractOffer(b,state).status,'available');
 assert.match(baseOffer(b,state).reasons.activate,/Выполните поручения/);
 const html=renderBasePanel(b,state);
 assert.match(html,/ДОВЕРИЕ ЭКИПАЖА/);
 assert.match(html,/Выполнено заказов: 0 \(нужно не менее 2\)/);
 assert.match(html,/data-act="acceptContract"/);
 assert.match(html,/data-act="activate"[^>]+disabled/);
 assert.match(html,/\+2 доверия/);
 const activeOrder={baseId:b.id,kind:'rich',goal:2,progress:1,choiceId:'standard',
  name:'Геологические образцы'};
 assert.match(renderBasePanel(b,{...state,contract:activeOrder}),
  /Награда: 22 сплава · 19 опыта · \+2 доверия/,
  'the active primary order must display the actual two-point reward');
 b.contractRuns=2;b.reputation=3;
 assert.equal(baseOffer(b,state).reasons.activate,'');
 assert.doesNotMatch(renderBasePanel(b,state),/data-act="activate"[^>]+disabled/);
});

test('real station actions enforce trust, pay missions once, and then allow activation',()=>{
 const g=game(),b=neutral();g.world.stations.set(b.id,b);
 g.world.discovered.add(b.id);g.docked=b;g.paused=true;
 g.player.x=b.x;g.player.y=b.y;
 g.rewardNotice=function(message){this.lastNotice=message;};
 g.collect=function(item){if(item.type==='data')this.player.data+=item.value;};
 g.renderDock=()=>{};
 g.baseAction('activate');
 assert.equal(b.active,false,'the raw action cannot bypass trust with abundant alloy');
 const takeAndClaim=choice=>{
  g.baseAction('acceptContract',choice);
  assert.equal(g.contract?.choiceId,choice);
  g.contract.progress=g.contract.goal;
  assert.equal(contractReadyAtStation(g.contract,b),true);
  g.baseAction('claimContract','');
  assert.equal(g.contract,null);
 };
 takeAndClaim('alternate');
 assert.equal(b.reputation,1);assert.equal(b.contractRuns,1);
 assert.equal(g.firstHardwareReward,'pending');
 g.baseAction('activate');
 assert.equal(b.active,false,'one completed order never unlocks a station');
 assert.equal(contractOffer(b,g.baseState()).status,'available',
  'a paused neutral terminal must offer the next task without a frozen cooldown');
 takeAndClaim('standard');
 assert.equal(b.reputation,3);assert.equal(b.contractRuns,2);
 assert.equal(stationReputationReady(b),true);
 const alloy=g.player.ore;
 g.baseAction('activate');
 assert.equal(b.active,true);
 assert.equal(g.player.ore,alloy-24);
 assert.equal(b.activationIndex,2);
 g.baseAction('activate');
 assert.equal(g.player.ore,alloy-24,'activation reward and cost cannot repeat');
});
