/**
 * Mission 00 sound palette. All cues reuse the game's verified sample bank:
 * no new fetches, per-frame synthesis, or separate AudioContext.
 */
export const PROLOGUE_CUES = Object.freeze({
    reactor_online: 'base_repair_start',
    gate_motor: 'base_section_construct',
    gate_open: 'unlock_tech_tier',
    turret_boot: 'base_outpost_start',
    heavy_boot: 'base_arsenal_start',
    turret_ready: 'base_turret_construct',
    beam_start: 'soul_drain',
    beam_interrupted: 'shield_hit',
    repair_complete: 'base_repair_pulse',
    terminal_online: 'unlock_tech_tier',
    scanner_online: 'base_resonance_link',
    coolant_online: 'base_repair_pulse',
    capacitor_online: 'base_shield_engage',
    relay_disabled: 'base_shield_break',
    weapon_installed: 'upgrade_weapon',
    log_collected: 'pickup',
    sector_entered: 'pickup',
    robot_wake: 'drone_swarm',
    robot_spawn: 'drone_swarm',
    robot_destroyed: 'explosion_small',
    heavy_destroyed: 'explosion_big',
    reinforcements: 'base_raid_warning',
    siege_started: 'base_raid_warning',
    core_hit: 'armor_hit',
    core_warning: 'base_shield_break',
    defense_success: 'base_raid_success',
    transmission_started: 'base_resonance_link',
    transmission_finished: 'achievement'
});

// These messages must remain audible even when their mechanism is offscreen.
const GLOBAL_CUES = new Set([
    'gate_open', 'terminal_online', 'sector_entered', 'reinforcements',
    'siege_started', 'core_warning', 'defense_success', 'transmission_finished'
]);

/** Spatialize local mechanisms; keep plot-critical cues independent of range. */
export function playPrologueCue(game, cue, position = null, intensity = 1) {
    const key = PROLOGUE_CUES[cue];
    if (!key || !game?.audio?.playEvent) return false;
    let pan = 0;
    let level = Math.max(0.1, Math.min(1.3, intensity));
    if (position && game.player && !GLOBAL_CUES.has(cue)) {
        const dx = position.x - game.player.x;
        const dy = position.y - game.player.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 1350) return false;
        pan = Math.max(-0.72, Math.min(0.72, dx / 680));
        level *= Math.max(0.25, 1 - distance / 1500);
    }
    return !!game.audio.playEvent(key, { intensity: level, pan });
}
