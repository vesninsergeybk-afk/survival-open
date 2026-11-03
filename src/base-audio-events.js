/**
 * Pure sound-routing rules for station transactions. Nothing here changes
 * station costs, progression, or resonance: playback follows a successful buy.
 */
const STARTUPS = Object.freeze({
    dock: 'base_repair_start',
    carrier: 'base_carrier_start',
    arsenal: 'base_arsenal_start',
    lab: 'base_laboratory_start',
    outpost: 'base_outpost_start'
});
const BRANCH_UNLOCKS = Object.freeze({
    dock: 'unlock_branch_repair',
    carrier: 'unlock_branch_carrier',
    arsenal: 'unlock_branch_arsenal',
    lab: 'unlock_branch_laboratory',
    outpost: 'unlock_branch_repair'
});
const SIMPLE_ACTIONS = Object.freeze({
    repair: 'base_repair_pulse',
    turret: 'base_turret_construct',
    extension: 'base_section_construct',
    upgradeTurret: 'upgrade_weapon',
    specialize: 'unlock_branch_arsenal',
    escort: 'base_escort_launch',
    hangar: 'base_hangar_expand',
    escortUpgrade: 'upgrade_drones',
    stasisUpgrade: 'upgrade_armor',
    stasisMode: 'base_shield_engage',
    shipUpgrade: 'upgrade_weapon'
});
const DEVELOPMENT = Object.freeze({
    defense: 'upgrade_defense',
    research: 'upgrade_research',
    logistics: 'upgrade_logistics'
});

export function baseSoundPlan({ action, type, branch, discounted = false,
    sameTypePeer = false, techUnlocked = false, firstBranch = false } = {}) {
    if (action === 'activate') {
        // The reactor animation takes 2850 ms. The recognition chime comes
        // after it so it remains audible and conveys the *result* of activation.
        const plan = [{ key: STARTUPS[type] || STARTUPS.outpost, afterMs: 0 }];
        if (sameTypePeer) plan.push({ key: 'base_resonance_link', afterMs: 2820 });
        else if (techUnlocked) plan.push({ key: 'unlock_tech_tier', afterMs: 2820 });
        return plan;
    }
    const sound = action === 'baseDevelopment'
        ? (DEVELOPMENT[branch] || 'upgrade_standard')
        : SIMPLE_ACTIONS[action];
    if (!sound) return [];
    const plan = [{ key: sound, afterMs: 0 }];
    // First investment unlocks a genuine station development branch.
    if (action === 'baseDevelopment' && firstBranch) {
        plan.push({ key: BRANCH_UNLOCKS[type] || BRANCH_UNLOCKS.dock, afterMs: 760 });
    }
    if (discounted) {
        // A small, distinct receipt-like ping, audible after a mechanical cue.
        plan.push({ key: 'base_resonance_discount',
            afterMs: action === 'extension' || action === 'turret' ? 850 : 520 });
    }
    return plan;
}
