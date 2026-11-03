/**
 * Campaign progression contract, independent of map and mission scripts.
 * Missions supply objectives; only an explicit victory records permanent rewards.
 * Ordinary expeditions, daily challenges and replays do not use these gates.
 */
import { MASTERY_CERTIFICATES, masteryWeaponsForAchievements } from './weapon-masteries.js?v=mastery-1';

const MISSION_ROWS = [
    [0, 'Последний сигнал', 6, 9, 2, ['starter_pulse'], []],
    [1, 'Первая искра',       9, 11, 3, ['starter_pulse','whip','magic_wand'], ['whip','magic_wand']],
    [2, 'Каменный пролив',    7,  9, 4, ['starter_pulse','whip','magic_wand','knife'], ['knife']],
    [3, 'Разорванная сеть',   8, 10, 4, ['starter_pulse','whip','magic_wand','knife'], []],
    [4, 'Путь через туманность', 9, 12, 4, ['starter_pulse','whip','magic_wand','knife','orbit'], ['orbit']],
    [5, 'Миссия 5',          12, 18, 4, null, []],
    [6, 'Миссия 6',          25, 35, 5, null, []],
    [7, 'Миссия 7',          25, 35, 5, null, []],
    [8, 'Миссия 8',          25, 40, 5, null, []],
    [9, 'Миссия 9',          30, 45, 5, null, []],
    [10,'Миссия 10',         30, 45, 5, null, []]
];
// Names and goals of missions 5–10 are deliberately unassigned: that work
// belongs to the separate mission-design branch.
export const MISSION_PROFILES = Object.freeze(MISSION_ROWS.map(
    ([index,name,minutesMin,minutesMax,rankCap,trialWeapons,rewardBlueprints]) =>
        Object.freeze({
            index, id:'mission-'+String(index).padStart(2,'0'), name,
            minutesMin, minutesMax, rankCap,
            trialWeapons: trialWeapons && Object.freeze(trialWeapons),
            rewardBlueprints:Object.freeze(rewardBlueprints)
        })
));

export function getMissionProfile(index) {
    return MISSION_PROFILES.find(m => m.index === Number(index)) || null;
}

export function readCampaign(save) {
    const data=save?.campaign || {};
    const completed=Array.isArray(data.completed) ?
        [...new Set(data.completed.filter(v => Number.isInteger(v) && v>=0 && v<=10))] : [];
    const blueprints=Array.isArray(data.blueprints) ?
        [...new Set(data.blueprints.filter(v => typeof v === 'string'))] : [];
    const stored=Array.isArray(data.achievements) ?
        data.achievements.filter(v=>typeof v==='string') : [];
    // Import achievements from older campaign saves without re-grinding.
    const earned=MASTERY_CERTIFICATES.filter(c=>completed.includes(c.mission))
        .map(c=>c.id);
    const achievements=[...new Set([...stored,...earned])];
    return {completed,blueprints,bestTimes:{...(data.bestTimes||{})},
        achievements,masteryLicenses:[...masteryWeaponsForAchievements(achievements)]};
}

export function isMissionUnlocked(save,index) {
    const mission=getMissionProfile(index);
    if(!mission)return false;
    return mission.index===0 || mission.index===1 || readCampaign(save).completed.includes(mission.index-1);
}

/** Returned rules are a snapshot: one run cannot change its own unlocks. */
export function createMissionRules(index,save) {
    const mission=getMissionProfile(index);
    if(!mission || !isMissionUnlocked(save,mission.index))return null;
    const campaign=readCampaign(save);
    const blueprintSet=new Set(['starter_pulse',...campaign.blueprints]);
    const allowed=mission.index===0 ? new Set(['starter_pulse']) : mission.trialWeapons ?
        new Set([...blueprintSet,...mission.trialWeapons]) : null;
    // The rocket branch can be tried in mission 2; its certificate is earned
    // only after winning. Other routes come from prior campaign milestones.
    const allowedMasteries=new Set([...campaign.masteryLicenses,
        ...(mission.index===2?['knife']:[])]);
    return Object.freeze({
        index:mission.index, id:mission.id, name:mission.name,
        rankCap:mission.rankCap,
        allowedWeapons:allowed,
        allowedMasteries,
        blueprints:blueprintSet,
        minutes:[mission.minutesMin,mission.minutesMax],
        // A mission gives only a ceiling. Activated reactors still determine
        // the actual rank available inside this particular run.
        getCap(network) {
            return Math.min(mission.rankCap,network?.getUpgradeCap?.() ?? 5);
        }
    });
}

/**
 * Called by the mission director only after its objective-based victory.
 * Neither player death, elapsed time, nor quitting grants blueprints.
 */
export function recordMissionVictory(save,index,seconds) {
    const profile=getMissionProfile(index);
    if(!profile || !isMissionUnlocked(save,index))
        return {ok:false,message:'Миссия ещё не открыта'};
    const state=readCampaign(save);
    const firstClear=!state.completed.includes(profile.index);
    if(firstClear)state.completed.push(profile.index);
    const gained=profile.rewardBlueprints.filter(id=>!state.blueprints.includes(id));
    state.blueprints.push(...gained);
    const certificates=MASTERY_CERTIFICATES.filter(c=>c.mission===profile.index &&
        !state.achievements.includes(c.id));
    state.achievements.push(...certificates.map(c=>c.id));
    state.masteryLicenses=[...masteryWeaponsForAchievements(state.achievements)];
    if(Number.isFinite(seconds) && seconds>0) {
        const previous=state.bestTimes[profile.id];
        if(!previous || seconds<previous)state.bestTimes[profile.id]=seconds;
    }
    save.campaign=state;
    return {ok:true,firstClear,blueprints:gained,
        certificates:certificates.map(c=>({id:c.id,title:c.title,weapons:[...c.weapons]})),
        masteryWeapons:[...new Set(certificates.flatMap(c=>c.weapons))],
        nextMission:getMissionProfile(profile.index+1)?.id || null};
}

