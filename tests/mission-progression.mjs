import assert from 'node:assert/strict';
import {
    createMissionRules, getMissionProfile, isMissionUnlocked,
    readCampaign, recordMissionVictory
} from '../src/mission-progression.js';
import {
    baseDevelopmentCap, baseDevelopmentOptions, baseDevelopmentPrice
} from '../src/base-development.js';
import { buildSkillTree, skillChoice } from '../src/skill-tree.js';

// Run: node --experimental-default-type=module tests/mission-progression.mjs
const campaign = {};
assert.equal(getMissionProfile(1).rankCap,3);
assert.equal(getMissionProfile(2).rankCap,4);
assert.equal(getMissionProfile(6).rankCap,5);
assert.equal(getMissionProfile(11),null);
assert.equal(isMissionUnlocked(campaign,1),true);
assert.equal(isMissionUnlocked(campaign,2),false);
const first = createMissionRules(1,campaign);
assert.equal(first.allowedWeapons.has('knife'),false);
assert.equal(first.allowedWeapons.has('magic_wand'),true);
assert.equal(first.getCap({getUpgradeCap:()=>5}),3);
assert.equal(recordMissionVictory(campaign,3,450).ok,false);
const one = recordMissionVictory(campaign,1,450);
assert.equal(one.firstClear,true);
assert.deepEqual(one.blueprints,['whip','magic_wand']);
assert.equal(isMissionUnlocked(campaign,2),true);
const repeat = recordMissionVictory(campaign,1,500);
assert.equal(repeat.firstClear,false);
assert.equal(repeat.blueprints.length,0);
assert.equal(readCampaign(campaign).bestTimes['mission-01'],450);
const two = createMissionRules(2,campaign);
assert.equal(two.allowedWeapons.has('knife'),true);
assert.equal(two.rankCap,4);
recordMissionVictory(campaign,2,510);
assert.equal(createMissionRules(3,campaign).blueprints.has('knife'),true);
assert.equal(readCampaign(campaign).bestTimes['mission-02'],510);

assert.equal(baseDevelopmentCap(2),1);
assert.equal(baseDevelopmentCap(3),1);
assert.equal(baseDevelopmentCap(4),2);
assert.equal(baseDevelopmentCap(5),3);
assert.equal(baseDevelopmentPrice(0,true),0);
assert.equal(baseDevelopmentPrice(0,false),26);
const base={development:{defense:0,research:0,logistics:0}};
const net={freeDevelopmentUsed:false,credits:10,getUpgradeCap:()=>3};
assert.equal(baseDevelopmentOptions(base,net).filter(n=>n.state==='available').length,3);
net.freeDevelopmentUsed=true;
assert.equal(baseDevelopmentOptions(base,net).filter(n=>n.state==='available').length,0);
net.credits=100;
base.development.research=1;
assert.match(baseDevelopmentOptions(base,net).find(n=>n.id==='research').reason,/реактор/);
net.getUpgradeCap=()=>4;
assert.equal(baseDevelopmentOptions(base,net).find(n=>n.id==='research').state,'available');

const pilot={level:3,weapons:[{id:'starter_pulse',level:1}],passives:{}};
const network={enabled:true,technologyTier:1,hasActivatedType:()=>true,
    getUpgradeCap:()=>3};
assert.ok(buildSkillTree(pilot,network).available.some(n=>n.id==='knife'));
pilot.weapons.push({id:'knife',level:3});
network.technologyTier=2;
network.getUpgradeCap=()=>4;
const forks=buildSkillTree(pilot,network).available.filter(n=>n.id==='knife');
assert.deepEqual(forks.map(n=>n.specialization),['hunter','barrage']);
assert.equal(skillChoice(pilot,network,'weapon','knife'),null);
assert.equal(skillChoice(pilot,network,'weapon','knife','hunter').specialization,'hunter');
assert.equal(buildSkillTree(pilot,network,first).available.some(n=>n.id==='knife'),false);
pilot.weapons[1].level=4;
pilot.weapons[1].specialization='hunter';
network.getUpgradeCap=()=>5;
assert.equal(buildSkillTree(pilot,network).available.filter(n=>n.id==='knife').length,1);
assert.equal(buildSkillTree(pilot,network).available.find(n=>n.id==='knife').specialization,'hunter');

console.log('Mission progression: campaign, 3 station branches, rocket specialization — OK');
