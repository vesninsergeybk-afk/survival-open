import test from 'node:test';
import assert from 'node:assert/strict';
import {claimFirstContractModule,FIRST_CONTRACT_MODULES} from '../first-contract-reward.js';
import {createLoadout,cloneLoadout,applyLoadout,moduleLock,quoteLoadout} from '../ship-loadout.js';

for(const id of Object.keys(FIRST_CONTRACT_MODULES))test('first reward '+id+' installs a different, functional second gun',()=>{
 const initial=createLoadout(),result=claimFirstContractModule(initial,'pending',id);
 assert.equal(result.ok,true);assert.equal(result.installed,true);
 assert.equal(result.slot,1);assert.equal(result.status,id);
 assert.deepEqual(result.loadout.slots.slice(0,2),['plasma',id]);
 assert.equal(result.loadout.owned[id],id==='plasma'?2:1);
 assert.deepEqual(initial,createLoadout(),'the award must never mutate a saved or staged blueprint');
});

test('the chosen early weapon remains legal after removal, but other advanced weapons remain locked',()=>{
 const rewarded=claimFirstContractModule(createLoadout(),'pending','flak').loadout;
 const context={baseActive:true,level:1,ore:0,loadout:rewarded,firstHardwareReward:'flak',ranks:{}};
 assert.equal(moduleLock('flak',context),'');
 assert.match(moduleLock('rail',context),/уровень 3/);
 assert.match(moduleLock('rocket',context),/уровень 5/);
 const bare=cloneLoadout(rewarded);bare.slots[1]=null;
 const removed=applyLoadout(rewarded,bare,context);
 assert.equal(removed.ok,true);assert.equal(removed.cost,0);
 const reequipped=applyLoadout(removed.loadout,rewarded,{...context,loadout:removed.loadout});
 assert.equal(reequipped.ok,true);assert.equal(reequipped.cost,0);
 assert.equal(quoteLoadout(removed.loadout,rewarded,{...context,firstHardwareReward:null,loadout:removed.loadout}).ok,false);
});

test('a full ship receives its first reward in storage; duplicate and invalid requests do nothing',()=>{
 const current=createLoadout();current.slots[1]='plasma';current.owned.plasma=2;
 const result=claimFirstContractModule(current,'pending','rail');
 assert.equal(result.ok,true);assert.equal(result.installed,false);
 assert.deepEqual(result.loadout.slots.slice(0,2),['plasma','plasma']);
 assert.equal(result.loadout.owned.rail,1);
 for(const [status,id] of [['rail','rail'],['pending','howitzer'],['pending','__proto__']]){
  const rejected=claimFirstContractModule(result.loadout,status,id);
  assert.equal(rejected.ok,false);assert.equal(rejected.loadout,undefined);
 }
 assert.equal(result.loadout.owned.rail,1);
});
