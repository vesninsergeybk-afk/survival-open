import test from 'node:test';
import assert from 'node:assert/strict';
import {DATA_RESEARCH,DATA_PROTOCOL,createDataResearch,researchOffer,buyDataResearch,
 researchedExperience,researchBonus,validDataResearch,buyResearchProtocol,
 researchProtocolBonus,researchProtocolOffer} from '../data-research.js';
import {createCombatMastery,masteryProgress,masteryGoal,masteryKillExperience,
 creditLegacyMasteryPoints} from '../combat-mastery.js';
import {renderPilotMenu} from '../pilot-menu.js';
import {progressionModel,renderProgressionScreen} from '../progression-screen.js';

test('collected data buys meaningful permanent upgrades without consuming level points',()=>{
 const state=createCombatMastery(),player={data:2500,points:4};
 for(const id of Object.keys(DATA_RESEARCH)){
  for(const [index,cost] of [40,90,160,250].entries()){
   const before=player.data;
   const outcome=buyDataResearch(state,player,id);
   assert.deepEqual({rank:outcome.rank,cost:outcome.cost},{rank:index+1,cost});
   assert.equal(player.data,before-cost);
   assert.equal(player.points,4);
  }
  assert.equal(researchOffer(state,player.data,id).ok,false);
 }
 assert.equal(player.data,2500-4*(40+90+160+250));
 assert.ok(validDataResearch(state.research));
});

test('research purchases cannot spend absent data, negative wallets, or unknown branches',()=>{
 const state=createCombatMastery(),player={data:39,points:0};
 assert.equal(buyDataResearch(state,player,'analysis').ok,false);
 assert.equal(buyDataResearch(state,player,'invented').ok,false);
 assert.equal(player.data,39);
 player.data=40;
 assert.equal(buyDataResearch(state,player,'analysis').ok,true);
 assert.equal(player.data,0);
 assert.equal(researchOffer(state,-5,'learning').ok,false);
 assert.equal(validDataResearch({...createDataResearch(),xpRemainder:2}),false);
});

test('after permanent research ends, data still buys bounded, timed combat readiness',()=>{
 const state=createCombatMastery(),player={data:300,points:1};
 assert.equal(DATA_PROTOCOL.cost,120);
 assert.equal(buyResearchProtocol(state,player,200).ok,true);
 assert.equal(player.data,180);
 assert.equal(player.points,1);
 assert.equal(researchProtocolBonus(state,201,'damage'),.15);
 assert.equal(researchProtocolBonus(state,201,'speed'),.10);
 assert.equal(researchProtocolOffer(state,180,220).remaining,70);
 assert.equal(buyResearchProtocol(state,player,220).ok,false,'no wasteful overlapping purchase');
 assert.equal(player.data,180);
 assert.equal(researchProtocolBonus(state,290,'speed'),0);
 assert.equal(buyResearchProtocol(state,player,290).ok,true,'can buy it again after expiration');
 assert.equal(player.data,60);
 assert.equal(validDataResearch(state.research),true);
 assert.equal(validDataResearch({...state.research,protocolUntil:-1}),false);
});

test('analytics grants a fair integer XP bonus across small awards',()=>{
 const state=createCombatMastery(),player={data:80};
 buyDataResearch(state,player,'analysis');
 let total=0;
 for(let n=0;n<10;n++)total+=researchedExperience(state,7);
 assert.equal(total,75,'ten 7-XP scouts produce five bonus XP, not zero');
 assert.ok(Math.abs(state.research.xpRemainder-.25)<1e-8);
});

test('learning research accelerates earned mastery without free ranks or float drift',()=>{
 const normal=createCombatMastery(),trained=createCombatMastery();
 trained.research.ranks.learning=4;
 for(let n=0;n<15;n++){
  masteryProgress(normal,'mining');masteryProgress(trained,'mining');
 }
 const earned=s=>s.tracks.mining;
 const total=s=>Array.from({length:earned(s).rank},(_,i)=>masteryGoal('mining',i))
  .reduce((a,b)=>a+b,earned(s).progress);
 assert.equal(total(normal),15);
 assert.equal(total(trained),24);
 assert.equal(researchBonus(trained,'learning'),.60);
 assert.ok(validDataResearch(trained.research));
});

test('ace XP bonuses no longer round down to zero on every scout',()=>{
 const state=createCombatMastery();
 state.tracks.ace.rank=3;
 const total=Array.from({length:10},()=>masteryKillExperience(state,7,true)).reduce((a,b)=>a+b,0);
 assert.equal(total,72,'4% of ten 7-XP kills yields two extra points and carries the remainder');
 assert.ok(Math.abs(state.research.aceRemainder-.8)<1e-8);
 assert.equal(masteryKillExperience(state,7,false),7,'an assisted kill gives no personal ace premium');
});

test('a saved milestone is retroactively credited exactly once, while new milestones unlock points',()=>{
 const state=createCombatMastery(),player={points:2};
 state.tracks.mining.rank=8;state.tracks.ace.rank=3;
 assert.equal(creditLegacyMasteryPoints(player,state),3);
 assert.deepEqual({points:player.points,earned:player.masteryPoints},{points:5,earned:3});
 assert.equal(creditLegacyMasteryPoints(player,state),0);
 assert.equal(player.points,5);
 const fresh=createCombatMastery();
 let award=null;
 for(let i=0;i<60;i++){
  const next=masteryProgress(fresh,'mining');if(next?.perkUnlocked){award=next;break;}
 }
 assert.equal(award.pointMilestones,1);
});

test('research is visible and purchasable in both the station atlas and flight menu',()=>{
 const state=createCombatMastery(),player={level:5,points:1,xp:30,data:120};
 const selection=progressionModel({developmentDomain:'mastery',developmentMasteryTab:'research',
  combatMastery:state,data:player.data});
 assert.equal(selection.nodes.length,5);
 assert.ok(selection.nodes.slice(0,4).every(n=>n.action==='dataResearch'&&n.canAct));
 assert.equal(selection.nodes[4].action,'dataProtocol');
 const screen=renderProgressionScreen({developmentDomain:'mastery',developmentMasteryTab:'research',
  combatMastery:state,data:player.data,level:5,points:1,ore:25});
 assert.match(screen,/Анализ данных · 120/);
 assert.match(screen,/data-act="dataResearch"/);
 const protocolScreen=renderProgressionScreen({developmentDomain:'mastery',developmentMasteryTab:'research',
  developmentFocus:'research-protocol',combatMastery:state,data:player.data,level:5,points:1,ore:25});
 assert.match(protocolScreen,/data-act="dataProtocol"/);
 const html=renderPilotMenu({player,nextXp:205,ranks:{},doctrineRanks:{},combatMastery:state,
  skills:[],doctrines:[],nextEffect:()=>'',backLabel:'Назад'});
 assert.match(html,/Голубые ядра дают данные/);
 assert.match(html,/data-act="dataResearch"/);
 assert.match(html,/data-act="dataProtocol"/);
});
