/**
 * Encounter pacing for Survivor 7.0.
 *
 * A wave is a period of contact followed by a genuine chance to collect
 * energy. Time unlocks enemy types; permanent player progress controls how
 * many ships may be active. A missed early upgrade cannot cause a death spiral.
 * This class never uses random numbers, preserving seeded encounter replays.
 */
export class WaveDirector {
    constructor() { this.reset(); }

    reset() {
        this.spawnClock = 0;
        this.lastPhase = -1;
        this.maxEnemies = 0;
        this.inRespite = true;
        this.recentKills = [];
        this.lastKillCount = 0;
    }

    /** One step may request at most one enemy; no backlog survives a respite. */
    step(dt, game, difficultyMult = 1, waveMult = 1) {
        const time = game.gameTime;
        const totalKills = game.kills || 0;
        for (let i = 0; i < Math.max(0, totalKills - this.lastKillCount); i++) {
            this.recentKills.push(time);
        }
        this.lastKillCount = totalKills;
        // Keep the sorted kill window in place; allocating a new array on
        // every animation frame caused needless work during dense fights.
        let expired = 0;
        while (expired < this.recentKills.length &&
            time - this.recentKills[expired] > 25) expired++;
        if (expired) this.recentKills.splice(0, expired);
        const player = game.player;
        if (!player || time < 12) {
            this.spawnClock = 0;
            this.maxEnemies = 0;
            this.inRespite = true;
            return { spawn: false, cap: 0, angle: null, phase: 0 };
        }

        const phase = time < 45 ? 0 : time < 100 ? 1 : time < 180 ? 2 : 3;
        const stages = [
            { start: 12, interval: 3.45, cap: 5, cycle: 0, fight: 0 },
            { start: 45, interval: 2.65, cap: 10, cycle: 26, fight: 18 },
            { start: 100, interval: 1.95, cap: 16, cycle: 29, fight: 19 },
            { start: 180, interval: 1.55, cap: 26, cycle: 32, fight: 22 }
        ];
        const stage = stages[phase];
        const level = Math.max(1, player.level || 1);
        // Time alone cannot release 20 enemies against a level-one ship.
        const progressionCap = Math.min(48, 5 + (level - 1) * 4);
        const lateCap = phase === 3 ?
            stage.cap + Math.floor((time - 180) / 80) * 3 : stage.cap;
        const cap = Math.min(125, lateCap, progressionCap);
        this.maxEnemies = cap;

        // Each encounter approaches from a broad, readable sector. A new
        // sector follows the respite, so the pilot still needs to maneuver.
        const encounter = stage.cycle ?
            Math.floor((time - stage.start) / stage.cycle) :
            Math.floor((time - stage.start) / 16);
        const patrolAngle = (encounter * 2.3999632297 + phase * 0.91) % (Math.PI * 2);
        // On a normal expedition the ship may outrun its pursuers. Enter
        // from the *forward flank* while it is travelling, so encounters
        // are possible without orbiting a station for XP. Do not alter
        // competitive, tutorial or replay spawn angles.
        const cruising = !!game.friendlyBases?.enabled &&
            Math.hypot(player.vx || 0, player.vy || 0) > 115;
        const flank = Math.floor(time / 3.5) % 2 === 0 ? .28 : -.28;
        const angle = cruising ?
            Math.atan2(player.vy, player.vx) + flank : patrolAngle;
        const elapsed = stage.cycle ? (time - stage.start) % stage.cycle : 0;
        const resting = !!stage.cycle && elapsed >= stage.fight;
        let active = 0;
        for (const enemy of game.enemies) if (enemy.hp > 0) active++;

        // Difficulty still matters, but cannot negate the opening's limits.
        const speedup = Math.max(.75, Math.min(1.35,
            Math.sqrt(Math.max(.2, difficultyMult * waveMult))));
        let interval = stage.interval / speedup;
        if (level === 1) interval = Math.max(interval, 3.3);
        // A backlog with almost no recent kills signals insufficient damage.
        // Slow the next arrivals, never punish a pilot for doing well.
        if (phase > 0 && active >= Math.ceil(cap * .5) &&
            this.recentKills.length < 2) {
            interval *= 1.25;
        }
        const hazardWarning = game.battleDirector?.zones?.some(zone =>
            zone.blast <= 0 && zone.fuse > 0 && zone.fuse < 1.5);
        const saturated = active >= Math.ceil(cap * .82);
        const critical = player.hp < player.maxHp * .3 &&
            active >= Math.ceil(cap * .6);

        this.inRespite = resting || saturated || critical || !!hazardWarning;
        if (this.lastPhase !== phase) {
            this.lastPhase = phase;
            this.spawnClock = 0;
        }
        if (this.inRespite) {
            this.spawnClock = 0;
            return { spawn: false, cap, angle, phase };
        }

        this.spawnClock = Math.min(interval, this.spawnClock + Math.max(0, dt));
        if (this.spawnClock < interval || active >= cap) {
            return { spawn: false, cap, angle, phase };
        }
        this.spawnClock = 0;
        return { spawn: true, cap, angle, phase };
    }
}
