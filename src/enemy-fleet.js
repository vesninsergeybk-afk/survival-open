/**
 * Enemy fleet introduction rules for free-roam expeditions.
 *
 * Authored missions use their own scripted rosters, and Daily / Speedrun /
 * replay keep the original encounter rules for score/replay continuity.
 * Gates delay complex tactics until the pilot has both time and upgrades.
 */
export const FLEET_GATES = Object.freeze({
    bat:         { seconds: 0,   level: 1, role: 'scout' },
    zombie:      { seconds: 0,   level: 1, role: 'pursuer' },
    skeleton:    { seconds: 45,  level: 1, role: 'pursuer' },
    stalker:     { seconds: 80,  level: 2, role: 'flanker' },
    mage:        { seconds: 100, level: 3, role: 'ranged' },
    wolf:        { seconds: 110, level: 3, role: 'dasher' },
    ghost:       { seconds: 120, level: 3, role: 'pursuer' },
    rammer:      { seconds: 155, level: 4, role: 'dasher' },
    slime:       { seconds: 150, level: 4, role: 'splitter' },
    gunship:     { seconds: 170, level: 5, role: 'ranged' },
    sniper:      { seconds: 180, level: 5, role: 'sniper' },
    minelayer:   { seconds: 190, level: 5, role: 'minelayer' },
    golem:       { seconds: 200, level: 5, role: 'shielded' },
    illusionist: { seconds: 225, level: 5, role: 'illusionist' },
    bomber:      { seconds: 240, level: 5, role: 'bomber' },
    carrier:     { seconds: 270, level: 6, role: 'carrier' },
    repairer:    { seconds: 205, level: 5, role: 'repairer' },
    commander:   { seconds: 270, level: 6, role: 'commander' },
    // Microdrones arrive through splitters, not the normal spawn lottery.
    slimeling:   { seconds: Infinity, level: Infinity, role: 'support' }
});

export function eligibleEnemyPool(pool, seconds, playerLevel, stageId = 'forest') {
    const time = Math.max(0, Number(seconds) || 0);
    const level = Math.max(1, Number(playerLevel) || 1);
    // Give the first encounter a consistent silhouette and a readable attack.
    // Crypt introduces a single ranged variant from 35s to signal its character.
    let choices = pool || [];
    if (time < 45) choices = time >= 35 && stageId === 'crypt' ?
        ['bat','bat','bat','zombie','mage'] :
        ['bat','bat','bat','zombie'];
    else if (time < 100) choices = [
        'bat','bat','zombie','skeleton','stalker',
        ...(stageId === 'crypt' ? ['mage'] : [])
    ];
    const allowed = choices.filter(id => {
        const gate = FLEET_GATES[id];
        if (!gate) return false;
        if (id === 'mage' && stageId === 'crypt' && time >= 35) return true;
        return time >= gate.seconds && level >= gate.level;
    });
    // A low-level pilot never gets an empty spawn window just because
    // the global wave catalogue has already advanced to elite opponents.
    return allowed.length ? allowed : ['bat','zombie','skeleton'].filter(
        id => time >= FLEET_GATES[id].seconds && level >= FLEET_GATES[id].level
    );
}

/**
 * Ordinary background contacts inside authored missions. Objective-triggered
 * attacks, escorts and boss encounters are selected by MissionWorld itself.
 * New pilots in a later chapter first learn its signature flank / ranged
 * attack before the ambient pressure admits armored or burst-fire ships.
 */
export function missionAmbientPool(index, playerLevel) {
    const level = Math.max(1, Number(playerLevel) || 1);
    switch (index) {
        case 1: return ['bat','zombie','skeleton','stalker'];
        case 2: return level < 3 ? ['zombie','stalker'] :
            level < 5 ? ['stalker','wolf','mage'] :
            ['zombie','stalker','wolf','golem','mage'];
        case 3: return level < 3 ? ['stalker','mage'] :
            ['stalker','mage','wolf','gunship','bomber'];
        case 4: return level < 3 ? ['stalker','mage'] :
            ['stalker','mage','gunship','wolf'];
        default: return ['bat','zombie'];
    }
}

/** Normal expeditions allow only one active boss encounter at a time. */
export const NORMAL_BOSS_RECOVERY_SECONDS = 90;
