import test from 'node:test';
import assert from 'node:assert/strict';
import {enemyDataReward,enemySalvage} from '../combat-rewards.js';
import {rockYield} from '../mining.js';
import {contractChoices,activationCost,baseOffer} from '../base-panel.js';
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

// An adversarial budget exercise, not a claim to recreate actual combat AI.
// Slow down inputs, reserve time to return to base, require contract hand-in,
// and let damage, shields and instant repairs spend alloy. Pace and damage are
// deliberately declared assumptions so tests cannot masquerade as playtests.
function constrainedRun(style,minutes,initialChoice){
 const profile={
  mining:{rockInterval:140,enemyInterval:Infinity,contract:'alternate',enemyDamage:0,rockDamage:2},
  combat:{rockInterval:Infinity,enemyInterval:80,contract:'standard',enemyDamage:12,rockDamage:0},
  mixed:{rockInterval:200,enemyInterval:115,contract:'standard',enemyDamage:9,rockDamage:2}
 }[style];
 const initialCost=initialChoice==='drone'?20:initialChoice==='shield'?16:0;
 let ore=20-initialCost,earned=0,spent=initialCost,data=0,health=110;
 let shield=initialChoice==='shield'?30:0,rocks=0,kills=0,rich=0,runs=0;
 let nextRock=75,nextEnemy=55,serial=1,repairCount=0;
 const dock={type:'dock',id:'0:0',active:true};
 const damage=amount=>{const absorbed=Math.min(shield,amount);shield-=absorbed;
  health=Math.max(0,health-(amount-absorbed));};
 for(let second=1;second<=minutes*60;second++){
  // Every four minutes, 35 s are spent returning/docking/preparing. Action
  // clocks do not advance while docked, unlike the optimistic baseline.
  if(second%240<35)continue;
  if(Number.isFinite(profile.rockInterval)&&second>=nextRock){
   const isRich=(rocks+1)%3===0;
   const income=rockYield({rich:isRich},'extract');ore+=income;earned+=income;
   rocks++;if(isRich)rich++;damage(profile.rockDamage);
   nextRock=second+profile.rockInterval;
  }
  if(Number.isFinite(profile.enemyInterval)&&second>=nextEnemy){
   const type=serial%3===0?'fighter':'scout';
   const enemy={type,serial:serial++,maxHp:type==='scout'?28:58};
   const income=enemySalvage(enemy);ore+=income;earned+=income;
   data+=enemyDataReward(enemy);kills++;damage(profile.enemyDamage);
   nextEnemy=second+profile.enemyInterval;
  }
  if(second%240===239){
   const contract=contractChoices('dock',runs)[profile.contract==='alternate'?1:0];
   if(contract.kind==='rich'?rich>=contract.goal:kills>=contract.goal){
    ore+=contract.ore;earned+=contract.ore;data+=contract.data;runs++;
    if(contract.kind==='rich')rich-=contract.goal;else kills-=contract.goal;
   }
   // This scenario pays for speed instead of using free dock healing once
   // the hull falls below 70. It is a spending stress case, not optimal play.
   if(health<70){
    const offer=baseOffer(dock,{ore,hp:health,maxHp:110,shield,activeBases:1,
     connectedBases:1,connected:true,allies:0,droneRoles:[],droneDamage:0,
     network:{armor:0,armament:0,engine:0,strikePower:0},contract:null});
    if(ore>=offer.repairCost){
     ore-=offer.repairCost;spent+=offer.repairCost;repairCount++;
     health=Math.min(110,health+offer.repairAmount);
    }
   }
  }
  if(health<=0)break;
 }
 return {ore,earned,spent,data,rocks,kills,runs,repairCount,health};
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

test('slower 5 / 15 / 30 minute budgets include travel time, choices, damage and paid repairs',()=>{
 for(const minutes of [5,15,30])for(const style of ['mining','combat','mixed']){
  for(const choice of ['save','shield','drone']){
   const result=constrainedRun(style,minutes,choice);
   const initial=choice==='drone'?20:choice==='shield'?16:0;
   assert.ok(Number.isFinite(result.ore)&&result.ore>=0,`${style}/${minutes}/${choice}: invalid wallet`);
   assert.equal(result.ore,20+result.earned-result.spent,
    `${style}/${minutes}/${choice}: revenue and expenditure must reconcile`);
   assert.ok(result.spent>=initial&&result.spent<=20+result.earned,
    `${style}/${minutes}/${choice}: purchases exceed resources`);
   assert.ok(result.health<=110&&result.health>=0,
    `${style}/${minutes}/${choice}: impossible hull`);
   assert.ok(result.earned>=0&&result.earned<1000,'no runaway income in this finite scenario');
  }
 }
 // A deliberately slower, shield-first miner cannot be guaranteed a relay
 // in five minutes. This guards against promoting the optimistic model into
 // a claim that every player will afford the first station immediately.
 assert.ok(constrainedRun('mining',5,'shield').ore<activationCost(1));
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
