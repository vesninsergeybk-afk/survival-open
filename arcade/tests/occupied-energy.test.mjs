import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../world.js';
import {advancePopulation,expandSavedPopulation,validPopulation} from '../world-population.js';
import {OPENING_ENERGY,openingPowerRoute,openingFactoryStatus,
 openingSectorEnergy,connectedPlayerEnergySlots} from '../occupied-energy.js';
import {escortCapacity,escortHireOffer} from '../escort-squad.js';
import {packRun,unpackRun} from '../run-checkpoint.js';

const start=seed=>new World(seed,{occupied:true});
const district=(w,i=0)=>w.population.colonies.find(c=>c.region==='amethyst'&&c.index===i);
const station=(w,c,role)=>w.stations.get(c.id+':'+role);
const capture=s=>{s.enemy=false;s.captured=true;s.active=true;s.ruined=false;};

test('finite capacity is split among real captured sources, with neutral ruins',()=>{
 const w=start(1842);
 const first=openingSectorEnergy(w);
 assert.deepEqual([first.total,first.enemy,first.player,first.neutral],[36,36,0,0]);
 const ore=station(w,district(w),'extractor');
 capture(ore);
 const moved=openingSectorEnergy(w);
 assert.deepEqual([moved.enemy,moved.player,moved.neutral],[24,12,0]);
 assert.equal(moved.playerPercent,33);
 const second=station(w,district(w,1),'extractor');
 second.ruined=true;second.hp=0;second.enemy=false;
 const ruined=openingSectorEnergy(w);
 assert.deepEqual([ruined.enemy,ruined.player,ruined.neutral],[12,12,12]);
 assert.equal(openingSectorEnergy(new World(1842)),null);
});

test('grid transport needs a live owned route and never crosses a captured relay',()=>{
 const w=start(1842),c=district(w),factory=station(w,c,'factory');
 assert.equal(openingPowerRoute(w,c),true);
 assert.equal(openingFactoryStatus(w,c).shipCap,24);
 // First cut both grid edges incident to the factory.
 w.enemyExpansion.links=w.enemyExpansion.links.filter(([a,b])=>
  a!==factory.id&&b!==factory.id);
 assert.equal(openingPowerRoute(w,c),false);
 assert.equal(openingFactoryStatus(w,c).enabled,true,
  'finite stored power gives time to react');
 w.enemyExpansion.links.push([factory.id,station(w,c,'relay').id,'home']);
 assert.equal(openingPowerRoute(w,c),true,'remaining relay path restores supply');
 capture(station(w,c,'relay'));
 assert.equal(openingPowerRoute(w,c),false,'enemy cannot use player-owned relay as a cable');
});

test('capturing an energy source drains finite backup and prevents new hostile ships',()=>{
 const w=start(1842),c=district(w);
 const factory=station(w,c,'factory'),ore=station(w,c,'extractor');
 assert.equal(openingFactoryStatus(w,c).grid,true);
 advancePopulation(w,1);
 assert.equal(c.buildQueued,true);
 capture(ore);
 const reserveBefore=c.powerReserve,shipsBefore=c.ready;
 assert.equal(openingFactoryStatus(w,c).grid,false);
 advancePopulation(w,100);
 assert.equal(c.powerReserve,0);
 assert.equal(openingFactoryStatus(w,c).shipCap,0);
 assert.equal(openingFactoryStatus(w,c).enabled,false);
 assert.ok(c.ready>=shipsBefore,'existing ships are not deleted by a blackout');
 const produced=c.built;
 c.pool=100;c.buildQueued=false;c.ready=8;
 advancePopulation(w,102);
 assert.equal(c.buildQueued,false,'factory cannot start a paid job without energy');
 assert.equal(c.built,produced);
 assert.ok(reserveBefore>0&&factory.enemy,'the factory remains physically hostile');
 // Real reconnection is necessary: no free reinforcement from existing stock.
 ore.enemy=true;ore.captured=false;ore.active=false;
 advancePopulation(w,103);
 assert.equal(openingFactoryStatus(w,c).grid,true);
 assert.equal(c.buildQueued,true);
 assert.ok(c.powerReserve>=OPENING_ENERGY.rechargePerSecond);
});

test('an already paid factory job pauses after emergency power ends and resumes',()=>{
 const w=start(97531),c=district(w),ore=station(w,c,'extractor');
 capture(ore);
 c.powerReserve=1;c.buildQueued=true;c.buildUntil=3;c.pool=20;c.ready=5;
 const before=c.built;
 advancePopulation(w,1);
 assert.equal(c.powerReserve,0);
 advancePopulation(w,15);
 assert.equal(c.built,before);
 assert.equal(c.buildQueued,true);
 assert.ok(c.buildUntil>=17);
 ore.enemy=true;ore.captured=false;ore.active=false;
 advancePopulation(w,19);
 assert.equal(c.built,before+3,'existing job completes only after power is restored');
 assert.equal(c.ready,8);
});

test('power state is serializable, validated and old experiments gain one finite reserve',()=>{
 const w=start(1842),c=district(w);
 capture(station(w,c,'extractor'));
 advancePopulation(w,30);
 const saved=unpackRun(packRun(w.population));
 assert.equal(validPopulation(saved,[...w.stations],30),true);
 const snapshot=saved.colonies.find(s=>s.id===c.id);
 assert.equal(snapshot.powerReserve,c.powerReserve);
 snapshot.powerReserve=9999;
 assert.equal(validPopulation(saved,[...w.stations],30),false);
 snapshot.powerReserve=undefined;
 expandSavedPopulation(saved,w.seed,30,true);
 assert.equal(snapshot.powerReserve,OPENING_ENERGY.batterySeconds);
 assert.equal(expandSavedPopulation(saved,w.seed,30,true),saved);
 const normal=new World(1842);
 assert.equal(district(normal).powerReserve,undefined);
});

test('energy-production restrictions are opt-in: classic factories remain unchanged',()=>{
 const w=new World(1842),c=district(w);
 assert.equal(openingFactoryStatus(w,c).enabled,true);
 assert.equal(openingFactoryStatus(w,c).shipCap,36);
 assert.equal(c.powerReserve,undefined);
 const factory=station(w,c,'factory');
 factory.enemy=true;
 advancePopulation(w,1);
 assert.equal(c.buildQueued,true);
});

test('only a connected captured source provides extra escort capacity',()=>{
 const w=start(1842),c=district(w),ore=station(w,c,'extractor');
 const stationStub={active:true,enemy:false,ruined:false},state={
  connectedBases:1,ore:100,allies:1,energyEscortSlots:0
 };
 assert.equal(connectedPlayerEnergySlots(w,new Set([ore.id])),0);
 capture(ore);
 assert.equal(connectedPlayerEnergySlots(w,new Set()),0,'isolated source has no remote fleet bonus');
 assert.equal(connectedPlayerEnergySlots(w,new Set([ore.id])),1);
 assert.equal(escortCapacity(1),1);
 assert.equal(escortCapacity(1,1),2);
 const withEnergy={...state,energyEscortSlots:1};
 assert.equal(escortHireOffer(stationStub,state,'scout').ok,false);
 assert.equal(escortHireOffer(stationStub,withEnergy,'scout').ok,true);
 assert.equal(escortCapacity(6,3),6,'energy never bypasses the hard squad cap');
 const normal=new World(1842),normalOre=station(normal,district(normal),'extractor');
 capture(normalOre);
 assert.equal(connectedPlayerEnergySlots(normal,new Set([normalOre.id])),0);
});
