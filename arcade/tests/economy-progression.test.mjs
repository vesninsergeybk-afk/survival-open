import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyDataReward,enemySalvage} from '../combat-rewards.js';
import {rockYield} from '../mining.js';
import {contractChoices,activationCost} from '../base-panel.js';
import {expForNext} from '../balance.js';

// A repeatable economic stress model, not a claim about real human play speed.
// Assumed interactions: mining destroys one rock per 65 seconds, combat downs
// one enemy per 34 seconds, mixed play moves between the two. Every completion
// has instantaneous travel/hand-in, so earnings are an optimistic upper bound.
function modeledRun(style,minutes){
 const duration=minutes*60;
 const model={mining:{rockInterval:65,enemyInterval:Infinity,contract:'alternate'},
  combat:{rockInterval:Infinity,enemyInterval:34,contract:'standard'},
  mixed:{rockInterval:115,enemyInterval:52,contract:'standard'}}[style];
 let ore=20,data=0,rocks=0,kills=0,rich=0,runs=0,lastClaim=-150;
 let nextRock=Number.isFinite(model.rockInterval)?40:Infinity;
 let nextEnemy=Number.isFinite(model.enemyInterval)?23:Infinity,enemySerial=1;
 for(let second=1;second<=duration;second++){
  if(second>=nextRock){
   const large=(rocks+1)%3===0;
   ore+=rockYield({rich:large},'extract');rocks++;if(large)rich++;
   nextRock+=model.rockInterval;
  }
  if(second>=nextEnemy){
   const type=enemySerial%3===0?'fighter':'scout';
   const hp=(type==='scout'?28:58)*(1+Math.min(2.5,second/550));
   const enemy={type,serial:enemySerial++,maxHp:hp};
   ore+=enemySalvage(enemy);data+=enemyDataReward(enemy);kills++;
   nextEnemy+=model.enemyInterval;
  }
  const contract=contractChoices('dock',runs)[model.contract==='alternate'?1:0];
  if(second-lastClaim>=150&&(contract.kind==='kill'?kills>=contract.goal:rich>=contract.goal)){
   ore+=contract.ore;data+=contract.data;
   if(contract.kind==='kill')kills-=contract.goal;else rich-=contract.goal;
   lastClaim=second;runs++;
  }
 }
 let level=1,earned=data;
 while(earned>=expForNext(level)&&level<100){earned-=expForNext(level++);}
 return {style,minutes,ore,data,level,runs,rocks};
}

test('optimistic 5 / 15 / 30 minute progression has a path to the first meaningful purchase',()=>{
 for(const minutes of [5,15,30]){
  const profiles=['mining','combat','mixed'].map(style=>modeledRun(style,minutes));
  for(const p of profiles){
   assert.ok(p.ore>=24,`${p.style}, ${minutes}m: cannot afford the first 24-alloy upgrade`);
   assert.ok(Number.isFinite(p.ore)&&Number.isFinite(p.data));
   assert.ok(p.ore<1000,'unbounded resource farming in the model');
  }
  assert.ok(profiles[1].data>profiles[0].data,'combat should reward pilot progression');
  assert.ok(profiles[0].ore>0,'mining should remain a reliable alloy source');
  if(minutes===30)assert.ok(profiles[1].level>=4,'combat must reach alternative weapons in a long run');
 }
});

test('replacement contracts and network activation cannot produce negative or infinite prices',()=>{
 const first=contractChoices('dock',0),repeat=contractChoices('dock',1);
 assert.ok(repeat.every((c,i)=>c.ore>0&&c.ore<first[i].ore));
 assert.ok(repeat.every(c=>c.data>=6));
 assert.deepEqual([1,2,3,4,5].map(activationCost),[24,34,44,54,64]);
 assert.equal(activationCost(100),84);
});

test('salvage is intentionally limited compared with focused asteroid extraction',()=>{
 const rich=rockYield({rich:true},'extract');
 const scoutDrops=Array.from({length:12},(_,i)=>enemySalvage({type:'scout',serial:i+1}));
 assert.ok(scoutDrops.reduce((a,b)=>a+b,0)<rich);
 const base=enemyDataReward({type:'scout',maxHp:28});
 const late=enemyDataReward({type:'scout',maxHp:98});
 assert.ok(late>base&&late<=base*2,'tougher enemies pay more XP without runaway scaling');
});
