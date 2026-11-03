import assert from 'node:assert/strict';
import { WEAPONS } from '../src/data.js';
import {
    WEAPON_MASTERIES, MASTERY_CERTIFICATES, getWeaponMasteries,
    getWeaponMastery, masteryCertificateFor
} from '../src/weapon-masteries.js';
import {
    readCampaign, createMissionRules, recordMissionVictory
} from '../src/mission-progression.js';
import { buildSkillTree, skillChoice } from '../src/skill-tree.js';

// Run from site/games/survivor/:
// node --experimental-default-type=module tests/weapon-masteries.mjs

const ids=Object.values(WEAPONS).map(w=>w.id);
assert.equal(ids.length,14);
assert.deepEqual(Object.keys(WEAPON_MASTERIES).sort(),[...ids].sort());
const licensed=MASTERY_CERTIFICATES.flatMap(c=>c.weapons);
assert.equal(new Set(licensed).size,14);
assert.deepEqual([...licensed].sort(),[...ids].sort());

const network={enabled:true,technologyTier:3,hasActivatedType:()=>true,
    getUpgradeCap:()=>5};
for(const id of ids) {
    const paths=getWeaponMasteries(id);
    assert.equal(paths.length,2,id+' needs exactly two mastery choices');
    assert.notEqual(paths[0].id,paths[1].id);
    assert.ok(masteryCertificateFor(id),id+' needs campaign unlock');
    for(const path of paths) {
        assert.equal(getWeaponMastery(id,path.id),path);
        assert.ok(path.name&&path.description);
    }
    const player={level:20,passives:{},
        weapons:[{id:'starter_pulse',level:id==='starter_pulse'?3:1}]};
    if(id!=='starter_pulse')player.weapons.push({id,level:3});
    const options=buildSkillTree(player,network).available
        .filter(n=>n.kind==='weapon'&&n.id===id);
    assert.equal(options.length,2,id+' rank-IV fork missing');
    assert.ok(options.every(n=>n.fork&&n.nextRank===4));
    assert.equal(skillChoice(player,network,'weapon',id),null,
        'fork must never silently choose a route');
    for(const option of options) {
        assert.equal(skillChoice(player,network,'weapon',id,
            option.specialization)?.specialization,option.specialization);
    }
    const acquired=player.weapons.find(w=>w.id===id);
    acquired.level=4;
    acquired.specialization=paths[0].id;
    const fixed=buildSkillTree(player,network).available
        .filter(n=>n.kind==='weapon'&&n.id===id);
    assert.equal(fixed.length,1,id+' route is not locked');
    assert.equal(fixed[0].specialization,paths[0].id);
}

const saved={};
for(let mission=1;mission<=6;mission++) {
    const result=recordMissionVictory(saved,mission,400+mission*15);
    assert.equal(result.ok,true);
    assert.equal(result.firstClear,true);
    assert.equal(result.certificates.length,1);
}
assert.equal(readCampaign(saved).masteryLicenses.length,14);
const repeated=recordMissionVictory(saved,6,510);
assert.equal(repeated.firstClear,false);
assert.equal(repeated.certificates.length,0);
assert.equal(repeated.masteryWeapons.length,0);

// Saves written before this release reconstruct certificates from victories.
const old={campaign:{completed:[1,2],blueprints:['whip','magic_wand','knife']}};
assert.ok(readCampaign(old).masteryLicenses.includes('knife'));
const second=createMissionRules(2,{campaign:{completed:[1]}});
assert.ok(second.allowedMasteries.has('knife'),'rocket trial at mission 2');
const third=createMissionRules(3,{campaign:{completed:[1,2]}});
assert.equal(third.allowedMasteries.has('orbit'),false,
    'network mastery must wait for completed mission 3');
const battlePilot={level:20,weapons:[{id:'starter_pulse',level:1},
    {id:'lightning',level:3}],passives:{}};
const pre={rankCap:4,allowedWeapons:new Set(['starter_pulse','lightning']),
    allowedMasteries:new Set()};
assert.ok(buildSkillTree(battlePilot,network,pre).branches.flatMap(b=>b.tiers.flat())
    .filter(n=>n.id==='lightning').every(n=>n.state==='locked'));
pre.allowedMasteries.add('lightning');
assert.equal(buildSkillTree(battlePilot,network,pre).available
    .filter(n=>n.id==='lightning').length,2);
pre.rankCap=3;
assert.equal(buildSkillTree(battlePilot,network,pre).available
    .filter(n=>n.id==='lightning').length,0);
console.log('28 mastery paths, 6 campaign certificates, rank gates: OK');
