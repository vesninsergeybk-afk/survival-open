import test from 'node:test';
import assert from 'node:assert/strict';
import {MASTERIES,createCombatMastery,masteryGoal,masteryBonus,
 masteryProgress,masteryMiss,validCombatMastery,masteryPerkTier,
 masteryNextMilestone,migrateCombatMastery,masteryOperationReward} from '../combat-mastery.js';
import {progressionModel,renderProgressionScreen} from '../progression-screen.js';
import {game} from './weapons-scene.mjs';

test('all seven masteries grow through counted events and keep a bounded permanent bonus',()=>{
 const state=createCombatMastery();
 assert.equal(validCombatMastery(state),true);
 for(const id of Object.keys(MASTERIES)){
  assert.equal(masteryProgress(state,id,masteryGoal(id,0)).rank,1);
  assert.equal(state.tracks[id].progress,0);
  assert.ok(masteryGoal(id,4)>=masteryGoal(id,1),
   'rare actions may share a short early goal, but must never become harder to earn backwards');
  assert.ok(masteryBonus(state,id)>0);
  assert.ok(masteryBonus(state,id)<MASTERIES[id].cap);
 }
 masteryProgress(state,'comet',2);
 masteryMiss(state,'comet');
 assert.equal(state.tracks.comet.progress,0,'a missed shot breaks the streak');
 assert.equal(validCombatMastery(state),true);
 state.tracks.ace.progress=999999;
 assert.equal(validCombatMastery(state),false,'invalid saves cannot grant arbitrary experience');
});
test('drone and mastery directions are visible in the same development atlas',()=>{
 const g=game();g.player.level=5;g.player.points=3;
 const base=g.baseState();
 const drones=progressionModel({...base,developmentDomain:'drones'});
 assert.deepEqual(drones.nodes.map(n=>n.actionId),[
  'wingArmor','wingSpeed','wingTargeting','wingAssault','wingRam','wingMedic']);
 assert.ok(drones.nodes.find(n=>n.actionId==='wingArmor').canAct);
 assert.match(renderProgressionScreen({...base,developmentDomain:'drones'}),/data-id="drones"/);
 const mastery=progressionModel({...base,developmentDomain:'mastery'});
 assert.equal(mastery.nodes.length,7);
 assert.ok(mastery.nodes.every(n=>n.kind==='achievement'&&!n.canAct));
 const html=renderProgressionScreen({...base,developmentDomain:'mastery'});
 assert.match(html,/mastery-progress/);
 assert.match(html,/до следующей ступени/);
 assert.doesNotMatch(html,/data-act=""/);
});

test('earned milestones unlock functional perks, while the bonus remains bounded over a long run',()=>{
 const state=createCombatMastery();
 for(const id of Object.keys(MASTERIES)){
  for(let i=0;i<3;i++)masteryProgress(state,id,masteryGoal(id,i));
  assert.equal(masteryPerkTier(state,id),1);
  assert.equal(masteryNextMilestone(state,id),8);
  assert.ok(masteryBonus(state,id)<MASTERIES[id].cap);
  assert.ok(masteryGoal(id,20)<100000,'rank twenty must remain realistically attainable');
 }
 assert.ok(masteryBonus(state,'comet')<masteryBonus({...state,tracks:{...state.tracks,
  comet:{rank:12,progress:0}}},'comet'));
});

test('operation rewards include both the rank bonus and each unlocked special tier',()=>{
 const state=createCombatMastery();
 assert.equal(masteryOperationReward(state,1000),1000);
 masteryProgress(state,'operations',masteryGoal('operations',0));
 assert.equal(state.tracks.operations.rank,1);
 assert.equal(masteryOperationReward(state,1000),
  Math.round(1000*(1+masteryBonus(state,'operations'))));
 for(let rank=1;rank<3;rank++)masteryProgress(state,'operations',masteryGoal('operations',rank));
 assert.equal(masteryPerkTier(state,'operations'),1);
 assert.equal(masteryOperationReward(state,1000),
  Math.round(1000*(1+masteryBonus(state,'operations')+.04)));
});

test('legacy five-track checkpoints retain earned rank and proportional progress',()=>{
 const legacy=createCombatMastery();legacy.version=1;
 delete legacy.tracks.mining;delete legacy.tracks.operations;
 legacy.tracks.comet={rank:9,progress:200};
 assert.equal(validCombatMastery(legacy),true);
 const migrated=migrateCombatMastery(legacy);
 assert.equal(migrated.version,3);
 assert.equal(migrated.tracks.comet.rank,9);
 assert.ok(migrated.tracks.comet.progress<masteryGoal('comet',9));
 assert.equal(migrated.tracks.mining.rank,0);
 assert.equal(validCombatMastery(migrated),true);
});

test('the four automatic milestones reflect how often each action can realistically occur',()=>{
 const expected={
  ace:[13,58,203,853],comet:[9,40,134,557],wing:[8,32,103,402],
  evasive:[8,29,89,342],survivor:[8,32,99,394],
  mining:[5,18,54,207],operations:[5,15,31,71]
 };
 for(const [id,totals] of Object.entries(expected)){
  const actual=[3,8,16,32].map(rank=>Array.from({length:rank},(_,i)=>masteryGoal(id,i))
   .reduce((sum,goal)=>sum+goal,0));
  assert.deepEqual(actual,totals,`${id} mastery events per milestone`);
  assert.ok(actual.every((count,index)=>index===0||count>actual[index-1]));
 }
});

test('version-two mastery ranks and earned fractions survive the revised pacing curve',()=>{
 const old=createCombatMastery();old.version=2;
 old.tracks.operations={rank:14,progress:52};
 old.tracks.ace={rank:8,progress:10};
 old.research.ranks.learning=3;
 old.research.masteryRemainder.operations=.65;
 assert.equal(validCombatMastery(old),true);
 const updated=migrateCombatMastery(old);
 assert.equal(updated.version,3);
 assert.equal(updated.tracks.operations.rank,14);
 assert.equal(updated.tracks.ace.rank,8);
 assert.equal(updated.research.ranks.learning,3);
 assert.equal(updated.research.masteryRemainder.operations,.65);
 assert.equal(validCombatMastery(updated),true);
 assert.equal(migrateCombatMastery(updated),updated,'a second load must not apply another migration');
});

test('buying wing armor upgrades both existing and future escorts without charging alloy',()=>{
 const g=game();g.player.level=4;g.player.points=1;
 const ally=g.allies[0]||{role:'scout',hp:35,maxHp:58};
 g.allies=[ally];
 const before=ally.maxHp,ore=g.player.ore;
 assert.equal(g.buySkill('wingArmor'),true);
 assert.equal(g.player.points,0);
 assert.equal(g.player.ore,ore);
 assert.ok(ally.maxHp>before);
 assert.equal(ally.hp,35+(ally.maxHp-before));
});
