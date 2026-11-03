/**
 * @module entities
 * @description Runtime entity classes — everything with `update(dt)` /
 * `render(ctx)` lifecycle methods lives here. All physics is frame-rate
 * independent (delta-time in seconds), and per-class state is owned, never
 * shared.
 *
 * Dependencies: `./config.js`, `./data.js`. The Weapon class is injected at
 * boot via `registerWeaponClass()` to break a circular import.
 *
 * Exports:
 *   - class Player, Enemy, Projectile, EnemyProjectile, ExpOrb,
 *           Particle, FloatingText, OrbitShard, Mine
 *   - findEnemyDef(id) — lookup helper
 *   - registerWeaponClass(cls) — DI for Weapon to avoid circular imports
 */

import { CONFIG } from './config.js?v=base-87';
import { ENEMIES } from './data.js?v=tactics-106';
import { TEMPORARY_BOOSTS } from './temporary-boosts.js?v=space-7';
import { getEnemySprite, drawHero, heroStageFromProgress } from './sprite-art.js?v=motion-103';
import { drawAnimatedEnemyShip } from './disruptor-ship-sprites.js';
import { drawCombatMissile } from './ship-art-v2.js?v=base-84';
import { atlas } from './asset-art.js?v=art-888';
import { drawWeaponBolt, drawEnemyBolt } from './combat-art.js?v=art-888';

// Exact single 16x16 cells from Kenney Tiny Dungeon (1px gutters).
// Monsters use finished CC0 pixel art; the original vector art stays a fallback.
const ENEMY_CELLS = Object.freeze({
    bat: [0, 10], zombie: [4, 9], skeleton: [1, 9],
    wolf: [3, 10], golem: [0, 8], ghost: [1, 10],
    mage: [0, 7], slime: [0, 9], slimeling: [0, 9],
    bomber: [2, 9], illusionist: [0, 7], stalker: [2, 10]
});

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = CONFIG.PLAYER_SIZE;
        this.baseMaxHp = 100;
        this.maxHp = this.baseMaxHp;
        this.hp = this.baseMaxHp;
        this.shield = 0;
        this.maxShield = 0;
        this.shieldDelay = 0;
        this.empTimer = 7;
        this.level = 1;
        this.exp = 0;
        this.expToNext = 50;
        this.weapons = [];
        this.passives = Object.create(null);
        this.invincible = false;
        this.invincibleTimer = 0;
        this.dead = false;
        this.unhitTimer = 0; // seconds since last damage taken
        this.visualStride = 0;
        this.visualFacing = 1;
        this.visualAngle = 0;
        this.visualBank = 0;
        this.hitPulse = 0;
        this.shipVariant = 'fighter';
        this.temporaryBoosts = Object.create(null);
        // Small exploration modules last until this run ends. They never
        // replace the substantial level-up choices earned from energy orbs.
        this.fieldModules = Object.create(null);
        this.stationUpgrades={damage:0,range:0,fireRate:0};
        this.vx = 0;
        this.vy = 0;
        this.enginePower = 0;
    }

    update(dt, game) {
        this._tickTemporaryBoosts(dt, game);
        // Movement ---------------------------------------------------------
        const v = game.input.getMoveVector();
        // Inertial flight: thrust accelerates toward the requested vector;
        // releasing the controls leaves a short, controllable drift. The
        // exponential interpolation is stable at different frame rates.
        const stageSpeedMult = game.stageMods?.playerSpeedMult ?? 1;
        const speed = CONFIG.PLAYER_SPEED * this.getSpeedMult() * stageSpeedMult;
        const thrusting = Math.hypot(v.x, v.y) > .05;
        const directionChange = this.vx * v.x + this.vy * v.y < -15;
        const response = !thrusting ? 4.2 : directionChange ? 6.6 : 8.0;
        const blend = 1 - Math.exp(-response * dt);
        this.vx += (v.x * speed - this.vx) * blend;
        this.vy += (v.y * speed - this.vy) * blend;
        if (!thrusting && Math.hypot(this.vx, this.vy) < 1.5) {
            this.vx = 0; this.vy = 0;
        }
        const velocity = Math.hypot(this.vx, this.vy);
        // Visual engine response follows actual movement; it eases out during
        // inertial drift and is fully off once the craft comes to rest.
        const targetPower = Math.max(0, Math.min(1, (velocity - 3) / 75)) *
            (thrusting ? 1 : .35);
        const responseRate = targetPower > this.enginePower ? 10 : 5;
        this.enginePower += (targetPower - this.enginePower) *
            (1 - Math.exp(-responseRate * dt));
        if (targetPower === 0 && this.enginePower < .005) this.enginePower = 0;
        // Turn toward the velocity along the shortest arc. Slight banking
        // gives the sprite inertia without changing hit boxes or steering.
        let targetBank = 0;
        if (velocity > 5) {
            const heading = Math.atan2(this.vy, this.vx) + Math.PI / 2;
            const delta = Math.atan2(Math.sin(heading - this.visualAngle),
                Math.cos(heading - this.visualAngle));
            targetBank = Math.max(-.055, Math.min(.055, delta * .075)) *
                Math.min(1, velocity / 95);
            this.visualAngle += delta * (1 - Math.exp(-11 * dt));
        }
        this.visualBank += (targetBank - this.visualBank) *
            (1 - Math.exp(-7 * dt));
        this.hitPulse = Math.max(0, this.hitPulse - dt);
        if (Math.abs(this.vx) > 4) this.visualFacing = this.vx < 0 ? -1 : 1;
        if (velocity > 4) this.visualStride += dt * 11;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Clamp to the playable arena. iter-10 introduced a scrolling camera,
        // so the bound is now the arena (2400×1600), not the viewport. Without
        // this clamp the player walks off into invisible space and the run
        // becomes unplayable. See docs/RUNTIME_QA_REPORT.md.
        const r = this.size;
        const W = CONFIG.ARENA_WIDTH ?? CONFIG.CANVAS_WIDTH;
        const H = CONFIG.ARENA_HEIGHT ?? CONFIG.CANVAS_HEIGHT;
        if (this.x < r) { this.x = r; this.vx = Math.max(0, this.vx); }
        else if (this.x > W - r) { this.x = W - r; this.vx = Math.min(0, this.vx); }
        if (this.y < r) { this.y = r; this.vy = Math.max(0, this.vy); }
        else if (this.y > H - r) { this.y = H - r; this.vy = Math.min(0, this.vy); }

        if (velocity > 18) {
            game.worldVfx?.engineTrail(this.x, this.y, this.visualAngle,
                this.shipVariant, this.hasTemporaryBoost('thruster'), dt);
        }

        // Weapons ----------------------------------------------------------
        for (const w of this.weapons) w.update(dt, this, game);

        // I-frames ---------------------------------------------------------
        if (this.invincible) {
            this.invincibleTimer -= dt;
            if (this.invincibleTimer <= 0) this.invincible = false;
        }

        // Repair, emergency shielding, and active EMP modules.
        const regen = this._passiveSum('hpRegen');
        if (regen) this.heal(regen * dt);
        if (this.shieldDelay > 0) this.shieldDelay -= dt;
        else if (this.maxShield > 0 && this.shield < this.maxShield)
            this.shield = Math.min(this.maxShield,
                this.shield + this._passiveSum('shieldRecharge') * dt);
        const emp = this.passives.emp_pulse?.count || 0;
        if (emp > 0) {
            this.empTimer -= dt;
            if (this.empTimer <= 0) {
                const range = 125 + emp * 18;
                const damage = (12 + emp * 8) * this.getDamageMult();
                for (const e of game.enemies) {
                    if (Math.hypot(e.x - this.x, e.y - this.y) <= range) {
                        e.takeDamage(damage);
                        e.slowTimer = Math.max(e.slowTimer || 0, 1.6);
                        e.slowPct = Math.max(e.slowPct || 0, .42);
                    }
                }
                game.damageTerrain?.(this.x, this.y, range, damage * .45);
                game.combatBursts?.push({ x:this.x, y:this.y, range,
                    ttl:.42, total:.42, color:'#70ecff' });
                game.createParticles?.(this.x, this.y, '#7cfcff', 22);
                this.empTimer = Math.max(6.5, 15 - emp * 1.5);
            }
        }

        // Untouchable streak timer.
        this.unhitTimer += dt;
        if (game.run) {
            if (this.unhitTimer > (game.run.longestUnhit || 0)) {
                game.run.longestUnhit = this.unhitTimer;
            }
        }
    }

    activateTemporaryBoost(id, duration) {
        if (!TEMPORARY_BOOSTS[id] || !Number.isFinite(duration) || duration <= 0) return false;
        // Repeated cells refresh the timer. No stacking and no mutation of
        // permanent passive counts or of individual weapon levels.
        this.temporaryBoosts[id] = duration;
        return true;
    }

    _tickTemporaryBoosts(dt, game) {
        for (const id of Object.keys(this.temporaryBoosts)) {
            this.temporaryBoosts[id] -= dt;
            if (this.temporaryBoosts[id] > 0) continue;
            delete this.temporaryBoosts[id];
            const def = TEMPORARY_BOOSTS[id];
            game?.createFloatingText?.(def.name + ' — эффект закончился',
                this.x, this.y - 48, '#a5b7c9');
        }
    }

    hasTemporaryBoost(id) {
        return (this.temporaryBoosts[id] || 0) > 0;
    }

    addPassive(def) {
        this.passives[def.id] ??= { def, count: 0 };
        if (this.passives[def.id].count >= CONFIG.PASSIVE_MAX_STACK) return;
        this.passives[def.id].count++;
        this.recalculateStats();
    }

    _passiveSum(key) {
        let total = 0;
        for (const id in this.passives) {
            const p = this.passives[id];
            if (p.def.effect[key] !== undefined) total += p.def.effect[key] * p.count;
        }
        return total;
    }

    _passiveMult(key) {
        let mult = 1;
        for (const id in this.passives) {
            const p = this.passives[id];
            if (p.def.effect[key] !== undefined) mult *= Math.pow(1 + p.def.effect[key], p.count);
        }
        return mult;
    }

    recalculateStats() {
        const prevMaxHp = this.maxHp;
        this.maxHp = this.baseMaxHp * this._passiveMult('maxHpMult');
        this.hp += this.maxHp - prevMaxHp;
        this.hp = Math.min(this.hp, this.maxHp);
        const prevShield = this.maxShield;
        this.maxShield = this._passiveSum('shieldMax');
        this.shield = Math.min(this.maxShield, this.shield + Math.max(0, this.maxShield - prevShield));
    }

    getDamageMult() {
        return this._passiveMult('damageMult') *
            (1 + .09 * (this.stationUpgrades?.damage || 0)) *
            (1 + .06 * (this.fieldModules?.capacitor || 0)) *
            (this.hasTemporaryBoost('overcharge') ? 1.55 : 1);
    }
    getAreaMult() {
        return this._passiveMult('areaMult') *
            (1 + .08 * (this.stationUpgrades?.range || 0)) *
            (1 + .07 * (this.fieldModules?.lens || 0)) *
            (this.hasTemporaryBoost('reach') ? 1.75 : 1);
    }
    getCooldownMult() {
        // cooldownMult.effect is negative (-0.08 => 8% faster). Multiply safely.
        let mult = 1;
        for (const id in this.passives) {
            const p = this.passives[id];
            const v = p.def.effect.cooldownMult;
            if (v !== undefined) mult *= Math.pow(1 + v, p.count);
        }
        return Math.max(0.2, mult * Math.pow(.93,this.stationUpgrades?.fireRate||0) *
            (this.hasTemporaryBoost('rapid') ? .58 : 1));
    }
    getSpeedMult() {
        const ship = this.shipVariant === 'scout' ? 1.06 : 1;
        return this._passiveMult('speedMult') * ship *
            (1 + .025 * Math.min(4,this.stationLogistics || 0)) *
            (1 + .06 * (this.fieldModules?.gyro || 0)) *
            (this.hasTemporaryBoost('thruster') ? 1.45 : 1);
    }
    getExpMult() {
        return this._passiveMult('expMult');
    }
    getMagnetRange() {
        let mult = 1;
        for (const id in this.passives) {
            const p = this.passives[id];
            const v = p.def.effect.magnetMult;
            if (v !== undefined) mult *= Math.pow(1 + v, p.count);
        }
        return CONFIG.MAGNET_BASE * mult * (this.shipVariant === 'mage' ? 1.15 : 1);
    }
    getArmor() {
        return this._passiveSum('armor');
    }
    getCritChance() {
        return this._passiveSum('critChance');
    }
    /**
     * iter-14: dodge chance from the new Evasion passive. Soft-capped at 60%
     * so a player who stacks five copies still gets hit sometimes — full
     * immortality would break the late-game balance entirely.
     */
    getDodgeChance() {
        return Math.min(0.6, this._passiveSum('dodgeChance'));
    }
    /**
     * iter-14: percentage damage reduction (Bulwark). Multiplies *after*
     * armor subtraction, soft-capped at 60% for the same reason as dodge.
     */
    getDamageReduction() {
        return Math.min(0.6, this._passiveSum('damageReduction'));
    }

    gainExp(amount) {
        if(this.trainingProgression)return [];
        this.exp += amount * this.getExpMult();
        const levelUps = [];
        while (this.exp >= this.expToNext) {
            this.exp -= this.expToNext;
            this.level++;
            this.expToNext = Math.floor(this.expToNext * 1.2);
            this.hp = Math.min(this.hp + 20, this.maxHp);
            levelUps.push(this.level);
        }
        return levelUps;
    }

    takeDamage(damage, game, options={}) {
        if (this.invincible || this.dead) return;
        // iter-14: dodge fires *before* armor / damageReduction so a dodged
        // hit also doesn't burn an invincibility window — feels like the hit
        // missed entirely. We still emit a "Miss!" floater so the player
        // gets feedback that the passive triggered.
        const dodge = options.ignoreDodge ? 0 : this.getDodgeChance();
        if (dodge > 0 && Math.random() < dodge) {
            game?.createFloatingText?.('Мимо!', this.x, this.y - 30, '#88ffcc');
            return;
        }
        const afterArmor = Math.max(1, damage - this.getArmor());
        const taken = Math.max(1, afterArmor * (1 - this.getDamageReduction()));
        const absorbed = Math.min(this.shield, taken);
        this.shield -= absorbed;
        this.hp -= taken - absorbed;
        this.hitPulse = taken > absorbed ? .23 : .11;
        this.shieldDelay = 6;
        game?.worldVfx?.playerHurt(this.x, this.y, absorbed > 0);
        if (absorbed > 0) game?.createFloatingText?.(
            'ЩИТ −' + Math.round(absorbed), this.x, this.y - 44, '#7deaff');
        this.invincible = true;
        this.invincibleTimer = CONFIG.INVINCIBILITY_TIME;
        this.unhitTimer = 0;
        // Authoritative no-hit flag: once set, it stays set for the rest of
        // the run. Replaces the older `unhitTimer >= gameTime` proxy which
        // could misfire on fractional-second deaths.
        if (game?.run) game.run.tookAnyDamage = true;
        game?.onPlayerHurt?.(taken);
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
    }

    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.maxHp);
    }

    render(ctx, campaign = null, workshop = false, layer = 'all') {
        // Keep the long-range weapon field on the world canvas. During
        // adaptive downscaling, only the detailed hull moves to a small,
        // full-resolution canvas. With layer='all' the old order is intact.
        const now = performance.now() * .001;
        const strobe = this.invincible ? .82 + .18 * Math.sin(now * 26) : 1;
        ctx.save();
        ctx.globalAlpha = strobe;

        if (layer !== 'field') {
            const impact = Math.min(1, this.hitPulse / .23);
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.2);
            grad.addColorStop(0, 'rgba(100,200,255,0.35)');
            grad.addColorStop(1, 'rgba(100,200,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2);
            ctx.fill();

            const impactDrift = impact * Math.sin(now * 34) * this.size * .045;
            drawHero(ctx, this.x + impactDrift, this.y, this.size, this.visualStride,
                this.visualFacing, this.visualAngle + this.visualBank +
                impact * Math.sin(now * 25) * .014,
                this.shipVariant, heroStageFromProgress(this, campaign, workshop),
                this.maxHp > 0 ? this.hp / this.maxHp : 1, this.enginePower);
        }

        if (layer !== 'hull') {
            if (this.shield > .5) {
                const pct = this.maxShield ? this.shield / this.maxShield : 0;
                ctx.strokeStyle = 'rgba(97,231,255,' + (.22 + pct * .53) + ')';
                ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 1.65, 0, Math.PI * 2); ctx.stroke();
            }

            const garlic = this.weapons.find((w) => w.id === 'garlic');
            if (garlic) {
                const range = garlic.getRange(this);
                const t = performance.now() / 400;
                ctx.strokeStyle = `rgba(160,255,160,${0.25 + Math.sin(t) * 0.08})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x, this.y, range, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

// Kept for API compatibility (previously injected the Weapon class).
export function registerWeaponClass(_cls) {
    /* noop */
}

// ---------------------------------------------------------------------------
// Enemy
// ---------------------------------------------------------------------------
export class Enemy {
    constructor(x, y, type, hpMult, dmgMult) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.size = type.size;
        this.maxHp = type.hp * hpMult;
        this.hp = this.maxHp;
        this.speed = type.speed;
        this.damage = type.damage * dmgMult;
        this.expValue = type.exp;
        this.color = type.color;
        this.id = type.id;
        this.boss = !!type.boss;
        this.flashTimer = 0;
        this.ability = type.ability;
        this.abilityTimer = type.ability === 'salvo' ? 2.5 : 3;

        // Archetype state
        this.archetype = type.archetype || 'chaser';
        this.ranged = !!type.ranged;
        this.splitter = !!type.splitter;
        this.dasher = !!type.dasher;
        this.flanker = !!type.flanker;
        this.flankSign = Math.random() < .5 ? -1 : 1;
        this.flankTimer = 1.2 + Math.random() * 1.2;
        this.shielded = !!type.shielded;
        this.bomber = !!type.bomber;
        this.illusionist = !!type.illusionist;
        this.repairCharges = type.repairCharges || 0;
        this.repairState = '';
        this.repairClock = 0;
        this._repairHit = false;

        this.fireTimer = type.fireCooldown ? type.fireCooldown * (0.5 + Math.random() * 0.5) : 0;
        this.aimTimer = 0;
        this.aimTotal = type.aimTime || 0;
        this.aimAngle = 0;
        this.mineTimer = type.mineCooldown ? type.mineCooldown * .45 : 0;
        this.dashTimer = type.dashInterval ? type.dashInterval * (0.3 + Math.random() * 0.7) : 0;
        this.dashActive = 0;
        this.dashAngle = 0;
        this.shieldHp = type.shieldHp ? type.shieldHp * hpMult : 0;
        // Bomber fuse (armed only when close to player).
        this.fuseTimer = 0;
        this.fuseArmed = false;
        // Illusionist clone cooldown (jittered so the wave doesn't sync).
        this.cloneTimer = type.cloneCooldown ? type.cloneCooldown * (0.6 + Math.random() * 0.8) : 0;
        // Frost Nova slow. `slowTimer` > 0 scales movement by (1 - slowPct).
        this.slowTimer = 0;
        this.slowPct = 0;
        // Flag used to mark clone-spawned enemies so they don't re-clone.
        this.isClone = false;
        // Distinct flight personalities: scouts weave, ranged ships orbit,
        // interceptors anticipate motion, and all can read meteor warnings.
        this.tacticSide = Math.random() < .5 ? -1 : 1;
        this.tacticPhase = Math.random() * Math.PI * 2;
        this.tacticClock = 2.8 + Math.random() * 2.4;
        this.avoidingStrike = false;
        this.evasionVector = null;
        this.evasionHold = 0;
        this.visualAngle = null;
        this.separationClock = Math.random() * .13;
        this.separationX = 0;
        this.separationY = 0;
    }

    update(dt, game) {
        if(this.reactionSpeedUntil && game.gameTime>=this.reactionSpeedUntil){
            this.speed=this.reactionBaseSpeed||this.speed;
            this.reactionSpeedUntil=0;
        }
        if(this.reactiveShieldUntil && game.gameTime>=this.reactiveShieldUntil){
            this.reactiveShieldHp=0;this.reactiveShieldUntil=0;
        }
        if(this.siegeMite && game.friendlyBases?.moveSiegeMite?.(this,dt,game))return;
        if(this.raidRole && game.friendlyBases?.moveRaider?.(this,dt,game))return;
        const directTarget=game.friendlyBases?.targetForEnemy?.(this,game.player)||game.player;
        const player=game.missionWorld?.enemyTargetFor?.(this,directTarget,game)||
            game.enemyIntelligence?.targetFor(this,directTarget,game)||directTarget;
        const fromPlayerX = player.x - this.x, fromPlayerY = player.y - this.y;
        const rawDistance = Math.hypot(fromPlayerX, fromPlayerY);
        const lead = this.flanker || this.dasher ?
            Math.min(.43, rawDistance / 1100) :
            this.ranged && !this.type.aimTime ? Math.min(.22, rawDistance / 1600) : 0;
        const dx = player.x + (player.vx || 0) * lead - this.x;
        const dy = player.y + (player.vy || 0) * lead - this.y;
        const d = Math.hypot(dx, dy);
        let vx = 0,
            vy = 0;
        const tx = d > 0.01 ? dx / d : 0;
        const ty = d > 0.01 ? dy / d : 0;

        // Decay slow timer.
        if (this.slowTimer > 0) this.slowTimer -= dt;
        const slowMult = this.slowTimer > 0 ? 1 - (this.slowPct || 0) : 1;

        // One bounded tactical withdrawal. Damage interrupts the repair, and
        // an escaping ship cannot endlessly regenerate its health.
        if(this.type.canRetreatRepair && this.repairCharges>0){
            if(!this.repairState && this.hp<this.maxHp*.35){
                this.repairState='retreat';this.repairClock=0;
                game.enemyIntelligence?.notifyRepair(this,game);
            }
            if(this.repairState==='retreat'){
                this.repairClock+=dt;
                if(d>355||this.repairClock>5){
                    this.repairState='repair';this.repairClock=0;
                    this._repairHit=false;
                }else{
                    this._moveWithTactics(dt,game,-tx*this.speed*slowMult,
                        -ty*this.speed*slowMult,slowMult);
                    if(this.flashTimer>0)this.flashTimer-=dt;
                    return;
                }
            }
            if(this.repairState==='repair'){
                this.repairClock+=dt;
                if(this._repairHit){
                    this.repairState='';this.repairCharges=0;
                }else if(this.repairClock>=2.2){
                    this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.25);
                    this.repairState='';this.repairCharges=0;
                    game.createParticles?.(this.x,this.y,'#74e5ef',9);
                }else{
                    this._moveWithTactics(dt,game,0,0,slowMult);
                    if(this.flashTimer>0)this.flashTimer-=dt;
                    return;
                }
            }
        }

        // --- Bomber: chase normally until close, then fuse + detonate. ---
        if (this.bomber) {
            const fuseRange = this.type.fuseRange || 80;
            if (d < fuseRange) {
                this.fuseArmed = true;
            }
            if (this.fuseArmed) {
                this.fuseTimer += dt;
                if (this.fuseTimer >= (this.type.fuseTime || 1.4)) {
                    const br = this.type.blastRadius || 120;
                    const bd = (this.type.blastDamage || 40) * (game.enemyDmgMult || 1);
                    // Damage player if in range.
                    const pd = Math.hypot(game.player.x - this.x, game.player.y - this.y);
                    if (pd < br && !game.player.invincible) {
                        game.player.takeDamage(bd, game);
                        game.createFloatingText(
                            Math.round(bd),
                            game.player.x,
                            game.player.y - 28,
                            '#ff4433'
                        );
                    }
                    game.createParticles(this.x, this.y, '#ff8833', 24);
                    game.shake?.(0.25);
                    game.audio?.explosion?.();
                    this.selfDestructed = true;
                    this.hp = 0; // self-destruct, no XP or second contact hit
                    return;
                }
            }
            vx = tx * this.speed * slowMult;
            vy = ty * this.speed * slowMult;
            this._moveWithTactics(dt, game, vx, vy, slowMult);
            if (this.flashTimer > 0) this.flashTimer -= dt;
            return;
        }

        // --- Illusionist: chaser that periodically spawns 2 clones. -----
        if (this.illusionist && !this.isClone) {
            this.cloneTimer -= dt;
            if (this.cloneTimer <= 0) {
                this.cloneTimer = this.type.cloneCooldown || 5.5;
                const encounterCap = game.missionWorld ? 60 :
                    Math.max(5, (game.waveDirector?.maxEnemies || 5) + 2);
                const room = Math.max(0, Math.min(CONFIG.MAX_ENEMIES,
                    encounterCap) - game.enemies.length);
                const n = Math.min(this.type.cloneCount || 2, room);
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
                    const cloneDef = this.type.cloneInto ? findEnemyDef(this.type.cloneInto) : this.type;
                    const clone = new Enemy(
                        this.x + Math.cos(a) * 24,
                        this.y + Math.sin(a) * 24,
                        cloneDef || this.type,
                        this.maxHp / Math.max(1, this.type.hp),
                        (game.enemyDmgMult || 1) * 0.6
                    );
                    clone.isClone = true;
                    // Drone carriers launch light scouts: their child HP
                    // must derive from the scout hull, not the 170-HP carrier.
                    const hpRatio = this.maxHp / Math.max(1, this.type.hp);
                    clone.hp = Math.max(6, Math.round((cloneDef || this.type).hp *
                        (this.type.cloneInto ? .85 : .4) * hpRatio));
                    clone.maxHp = clone.hp;
                    // Keep the signature purple, but a touch paler so they read as illusions.
                    clone.color = this.type.cloneInto ? '#93d8ff' : '#e0b0ff';
                    game.enemies.push(clone);
                }
                if (n > 0) game.createParticles(this.x, this.y,
                    this.type.cloneInto ? '#75c8ff' : '#cc88ff', 12);
            }
        }

        if (this.ranged && this.type.keepDistance) {
            const keep = this.type.keepDistance;
            const dir = d > keep + 30 ? 1 : d < keep - 30 ? -1 : 0;
            vx = tx * this.speed * dir * slowMult;
            vy = ty * this.speed * dir * slowMult;
            // Ranged ships keep a moving firing arc, rather than stopping
            // as soon as they reach their preferred distance.
            this.tacticClock -= dt;
            if (this.tacticClock <= 0) {
                this.tacticSide *= -1;
                this.tacticClock = 3.6 + Math.random() * 2;
            }
            const orbit = d > keep + 105 ? .14 : .53;
            vx -= ty * this.tacticSide * this.speed * orbit * slowMult;
            vy += tx * this.tacticSide * this.speed * orbit * slowMult;
            if (this.aimTimer > 0) {
                this.aimTimer -= dt;
                // Aimed snipers fire at the *marked* direction, allowing dodge.
                if (this.aimTimer <= 0) {
                    this._shoot(game, this.aimAngle);
                    this.fireTimer = this.type.fireCooldown || 2.2;
                    this.aimTimer = 0;
                }
            } else {
                this.fireTimer -= dt;
                if (this.fireTimer <= 0 && d < this.type.firingRange &&
                    (!this.prologueGroup || game.missionWorld?.canEnemyFire?.(this,game))) {
                    const angle = Math.atan2(dy, dx);
                    if (this.type.aimTime) {
                        this.aimTimer = this.type.aimTime;
                        this.aimAngle = angle;
                    } else {
                        this._shoot(game, angle);
                        this.fireTimer = this.type.fireCooldown || 2.2;
                    }
                }
            }
        } else if (this.type.mineLayer) {
            // Mine tenders orbit the player and leave armed proximity traps.
            const dir = d > 320 ? 1 : d < 245 ? -1 : 0;
            vx = (tx * dir - ty * .55) * this.speed * slowMult;
            vy = (ty * dir + tx * .55) * this.speed * slowMult;
            this.mineTimer -= dt;
            if (this.mineTimer <= 0 && d < this.type.mineRange) {
                this.mineTimer = this.type.mineCooldown;
                if (game.enemyProjectiles.length < 160) {
                    game.enemyProjectiles.push(new EnemyProjectile(
                        this.x, this.y,
                        0, 0, 21 * (game.enemyDmgMult || 1), 'mine'
                    ));
                }
            }
        } else if (this.flanker) {
            // Approach diagonally, circling the hero and changing direction
            // periodically. This prevents all enemies forming one slow blob.
            this.flankTimer -= dt;
            if (this.flankTimer <= 0) {
                this.flankTimer = 1.6 + Math.random() * 1.1;
                this.flankSign *= -1;
            }
            const forward = d > 180 ? .9 : .56;
            const lateral = d > 180 ? .35 : .83;
            const magnitude = Math.hypot(forward, lateral);
            vx = (tx * forward - ty * lateral * this.flankSign) * this.speed * slowMult / magnitude;
            vy = (ty * forward + tx * lateral * this.flankSign) * this.speed * slowMult / magnitude;
        } else if (this.dasher) {
            this.dashTimer -= dt;
            if (this.dashActive > 0) {
                this.dashActive -= dt;
                vx = Math.cos(this.dashAngle) * (this.type.dashSpeed || 300) * slowMult;
                vy = Math.sin(this.dashAngle) * (this.type.dashSpeed || 300) * slowMult;
            } else if (this.dashTimer <= 0) {
                this.dashAngle = Math.atan2(dy, dx);
                this.dashActive = this.type.dashDuration || 0.5;
                this.dashTimer = this.type.dashInterval || 3.5;
            } else {
                vx = tx * this.speed * slowMult;
                vy = ty * this.speed * slowMult;
            }
        } else {
            // Basic drones weave slightly while advancing, creating readable
            // attack lanes instead of a single overlapping straight-line blob.
            const weave = this.boss ? 0 : .14 *
                Math.sin(game.gameTime * 1.25 + this.tacticPhase);
            vx = (tx - ty * weave) * this.speed * slowMult;
            vy = (ty + tx * weave) * this.speed * slowMult;
        }

        this._moveWithTactics(dt, game, vx, vy, slowMult);

        if (this.flashTimer > 0) this.flashTimer -= dt;

        if (this.boss) {
            this.abilityTimer -= dt;
            if (this.abilityTimer <= 0) {
                this.abilityTimer = this.ability === 'summon' ? 6 : 4.5;
                game.onBossAbility?.(this);
            }
        }
    }

    _moveWithTactics(dt, game, vx, vy, slowMult) {
        // Recalculate local separation about eight times a second, with
        // staggered clocks, rather than querying all neighbours on each
        // render frame. This keeps large waves inexpensive on Android.
        if (!this.boss && game.spatial?.queryRect) {
            this.separationClock -= dt;
            if (this.separationClock <= 0) {
                this.separationClock += .13;
                if (this.separationClock < 0) this.separationClock = .13;
                let sx = 0, sy = 0, checked = 0;
                const nearby = game.spatial.queryRect(this.x, this.y, 64);
                for (const other of nearby) {
                    if (other === this || other.hp <= 0) continue;
                    const dx = this.x - other.x, dy = this.y - other.y;
                    const distance = Math.hypot(dx, dy);
                    const spacing = this.size + other.size + 18;
                    if (distance < spacing && distance > .01) {
                        const pressure = (spacing - distance) / spacing;
                        sx += dx / distance * pressure;
                        sy += dy / distance * pressure;
                    }
                    if (++checked >= 12) break;
                }
                const force = Math.hypot(sx,sy);
                this.separationX = force > .01 ? sx / force * Math.min(1,force) : 0;
                this.separationY = force > .01 ? sy / force * Math.min(1,force) : 0;
            }
            vx += this.separationX * this.speed * .82 * slowMult;
            vy += this.separationY * this.speed * .82 * slowMult;
        }

        // Pilots gradually learn to avoid visible deployed mines.
        if((game.gameTime>95 || game.enemyIntelligence?.profile==='spread') &&
           !this.boss && !this.dasher) {
            for(const mine of game.mines||[]) {
                if(mine.shouldRemove||mine.arming>0)continue;
                const dx=this.x-mine.x,dy=this.y-mine.y;
                const d=Math.hypot(dx,dy),reach=mine.level>=3?92:68;
                if(d<1||d>reach)continue;
                const urge=(reach-d)/reach;
                vx+=dx/d*this.speed*urge*1.5;
                vy+=dy/d*this.speed*urge*1.5;
            }
        }

        // Station robots obey local patrol reports and their assigned roles.
        const stationOrder=game.missionWorld?.enemySteering?.(this,game,vx,vy);
        if(stationOrder){vx=stationOrder.vx;vy=stationOrder.vy;}
        // Received radio orders bias the existing steering; safety evasions
        // below still take precedence over squad manoeuvres.
        const radio=game.enemyIntelligence?.steering(this,game,vx,vy);
        if(radio){vx=radio.vx;vy=radio.vy;}

        // Turret danger is learned only after serious damage; ordinary
        // squadrons can then route around that sector.
        const stationAvoid = game.friendlyBases?.avoidanceVector?.(this, game);
        if (stationAvoid) {
            const urge = stationAvoid.intensity;
            vx = vx * (1 - urge * .62) + stationAvoid.x * this.speed * urge * 1.6;
            vy = vy * (1 - urge * .62) + stationAvoid.y * this.speed * urge * 1.6;
        }

        const threat=this.strikeThreat(dt,game);
        if(threat) {
            const urge=threat.intensity*(this.boss?.65:1);
            vx=vx*(1-.9*urge)+
                threat.x*this.speed*(1.48+.2*urge)*slowMult*urge;
            vy=vy*(1-.9*urge)+
                threat.y*this.speed*(1.48+.2*urge)*slowMult*urge;
            // A pursuer flying *into* the danger field can almost cancel its
            // own escape vector. Preserve a small guaranteed component
            // outward: no hovering/bucking at the edge of a meteor marker.
            // Bosses are heavier, but still move instead of oscillating.
            const outward=vx*threat.x+vy*threat.y;
            const minimum=this.speed*slowMult*(this.boss?.48:.7)*urge;
            if(outward<minimum) {
                vx+=threat.x*(minimum-outward);
                vy+=threat.y*(minimum-outward);
            }
        }
        const dashSpeed = this.dashActive > 0 ? (this.type.dashSpeed || 0) : 0;
        const maxSpeed = Math.max(this.speed * (threat ? 1.55 : 1.22), dashSpeed) *
            slowMult;
        const magnitude = Math.hypot(vx,vy);
        if (magnitude > maxSpeed && magnitude > 0) {
            vx *= maxSpeed / magnitude;
            vy *= maxSpeed / magnitude;
        }
        this.x += vx * dt;
        this.y += vy * dt;
        // Prologue facing is resolved once after room collision constraints.
        if(!this.prologueGroup)this.faceVelocity(dt,vx,vy);
    }

    strikeThreat(dt,game) {
        // Commit to an escape heading briefly, rather than bouncing between
        // overlapping warning circles or reentering the same zone at its rim.
        const danger=game.battleDirector?.avoidanceVector?.(
            this.x,this.y,this.size,this.tacticPhase);
        this.evasionHold=Math.max(0,this.evasionHold-dt);
        if(danger && (!this.evasionVector || this.evasionHold<=0)) {
            this.evasionVector={x:danger.x,y:danger.y,intensity:danger.intensity};
            this.evasionHold=this.boss?.55:.38;
        } else if(danger && this.evasionVector) {
            // Follow the chosen corridor, but allow small course corrections.
            const dot=this.evasionVector.x*danger.x+this.evasionVector.y*danger.y;
            if(dot>.35) {
                const nx=this.evasionVector.x*.86+danger.x*.14;
                const ny=this.evasionVector.y*.86+danger.y*.14;
                const n=Math.hypot(nx,ny)||1;
                this.evasionVector.x=nx/n;this.evasionVector.y=ny/n;
            }
            this.evasionVector.intensity=Math.max(this.evasionVector.intensity*.95,
                danger.intensity);
        }
        if(!danger && this.evasionHold<=0)this.evasionVector=null;
        const threat=danger ? this.evasionVector :
            this.evasionVector&&this.evasionHold>0
                ? {...this.evasionVector,intensity:this.evasionVector.intensity*.6} : null;
        this.avoidingStrike=!!threat;
        return threat;
    }

    faceVelocity(dt,vx,vy) {
        if(Math.hypot(vx,vy)<=5)return;
        const targetAngle=Math.atan2(vy,vx)+Math.PI/2;
        if(this.visualAngle===null || !Number.isFinite(this.visualAngle)){
            this.visualAngle=targetAngle;
        } else {
            const delta=Math.atan2(Math.sin(targetAngle-this.visualAngle),
                Math.cos(targetAngle-this.visualAngle));
            const blend=1-Math.exp(-(this.boss?4:9)*dt);
            this.visualAngle+=delta*blend;
        }
    }

    _shoot(game, angle) {
        // Station robots never fire through the same obstacles that block movement.
        if(this.prologueGroup && !game.missionWorld?.canEnemyFire?.(this,game))return;
        if (!game.enemyProjectiles || game.enemyProjectiles.length >= 160) return;
        const count = this.type.burstCount || 1;
        const spread = this.type.spreadAngle || 0;
        for (let i = 0; i < count; i++) {
            const a = angle + (i - (count - 1) / 2) * spread;
            game.enemyProjectiles.push(new EnemyProjectile(
                this.x, this.y, a, this.type.projectileSpeed || 240,
                this.type.projectileDamage * (game.enemyDmgMult || 1),
                this.id==='gunship'&&i===Math.floor(count/2) ? 'missile' :
                    this.type.aimTime ? 'laser' : 'plasma'
            ));
        }
        game.audio?.shoot?.();
    }

    takeDamage(damage) {
        let dmg = damage;
        if(this.reactiveShieldHp>0){
            const blocked=Math.min(dmg,this.reactiveShieldHp);
            this.reactiveShieldHp-=blocked;
            dmg-=blocked;
            if(dmg<=0){this.flashTimer=.05;return;}
        }
        if (this.shielded && this.shieldHp > 0) {
            const reduction = this.type.damageReduction ?? 0.5;
            const incoming=dmg;
            dmg=incoming*(1-reduction);
            this.shieldHp-=incoming*reduction;
            if (this.shieldHp <= 0) {
                this.shieldHp = 0;
                this.shielded = false;
            }
        }
        this.hp -= dmg;
        if(dmg>0&&this.repairState==='repair')this._repairHit=true;
        this.flashTimer = 0.08;
    }

    render(ctx) {
        ctx.save();
        // Slowed foes get a cold cast.
        if (this.flashTimer > 0) {
            ctx.fillStyle = '#ffffff';
        } else if (this.slowTimer > 0) {
            ctx.fillStyle = '#88ccff';
        } else if (this.bomber && this.fuseArmed) {
            // Blink red while the fuse is burning.
            const blink = Math.floor(performance.now() / 120) % 2 === 0;
            ctx.fillStyle = blink ? '#ffffff' : this.color;
        } else {
            ctx.fillStyle = this.color;
        }
        // The same cached hull is used by both the fast path in main.js and
        // the status-effect renderer here. Avoidance/hit flashes cannot swap
        // the ship's model or reverse its facing.
        if(this.flashTimer>0)ctx.filter='brightness(2.2)';
        else if(this.slowTimer>0)ctx.filter='hue-rotate(155deg) brightness(1.2)';
        else if(this.bomber&&this.fuseArmed&&
            Math.floor(performance.now()/120)%2===0)ctx.filter='brightness(2.3)';
        if(!drawAnimatedEnemyShip(ctx,this)) {
            const art=getEnemySprite(this.type,this.size);
            if(art) {
                ctx.save();ctx.translate(this.x,this.y);
                ctx.rotate(this.visualAngle||0);
                ctx.drawImage(art,-art.width/2,-art.height/2);
                ctx.restore();
            } else {
                ctx.beginPath();ctx.arc(this.x,this.y,this.size,0,Math.PI*2);ctx.fill();
            }
        }
        ctx.filter='none';
        if(this.repairState){
            ctx.save();ctx.strokeStyle=this.repairState==='repair'?'#88fff0':'#f9d17b';
            ctx.globalAlpha=.65;ctx.lineWidth=2;ctx.setLineDash([5,4]);
            ctx.beginPath();ctx.arc(this.x,this.y,this.size+12,0,Math.PI*2);
            ctx.stroke();ctx.restore();
        }

        // Reactive field and short afterburner are readable countermeasures.
        if(this.reactiveShieldHp>0){
            ctx.save();ctx.strokeStyle='#77ecff';ctx.lineWidth=2.5;
            ctx.shadowColor='#46bfff';ctx.shadowBlur=17;
            ctx.beginPath();ctx.arc(this.x,this.y,this.size+9,0,Math.PI*2);
            ctx.stroke();ctx.restore();
        }
        if(this.reactionSpeedUntil>0){
            const a=(this.visualAngle||0)-Math.PI/2;
            const bx=this.x-Math.cos(a)*(this.size+4);
            const by=this.y-Math.sin(a)*(this.size+4);
            ctx.save();ctx.globalAlpha=.85;ctx.fillStyle='#ffb04d';
            ctx.shadowColor='#ff7436';ctx.shadowBlur=13;
            ctx.beginPath();ctx.arc(bx,by,Math.max(3,this.size*.36),0,Math.PI*2);
            ctx.fill();ctx.restore();
        }
        // Shield ring
        if (this.shielded && this.shieldHp > 0) {
            ctx.strokeStyle = 'rgba(160,200,255,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.avoidingStrike) {
            // A small amber thruster flare makes the emergency turn readable.
            ctx.save();
            ctx.strokeStyle = '#ffcb78';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ff9c58';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 7, -.7, .9);
            ctx.stroke();
            ctx.restore();
        }

        // HP bar
        const pct = Math.max(0, this.hp / this.maxHp);
        const w = this.boss ? 80 : 30;
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x - w / 2, this.y - this.size - 10, w, 4);
        ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa33' : '#ff4444';
        ctx.fillRect(this.x - w / 2, this.y - this.size - 10, w * pct, 4);

        if (this.boss) {
            // iter-14: IceQueen wears a frosty cyan halo + a faint inner ring
            // so she reads as "the ice variant" at a glance even from across
            // the arena. Other bosses keep the original magenta crown.
            if (this.type?.iceQueen) {
                ctx.strokeStyle = 'rgba(170,220,255,0.85)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(220,240,255,0.45)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size + 10, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                ctx.strokeStyle = '#ff33aa';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// EnemyProjectile (fired by ranged archetypes). Simple straight-line shot.
// ---------------------------------------------------------------------------
export class EnemyProjectile {
    constructor(x, y, angle, speed, damage, kind = 'plasma') {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.kind = kind;
        this.life = kind === 'mine' ? 6.5 : kind === 'missile' ? 4.1 : 3.5;
        this.arming = kind === 'mine' ? .9 : 0;
        this.size = kind === 'mine' ? 9 : kind === 'missile' ? 9 : kind === 'laser' ? 5 : 7;
        this.lastTargetAngle = angle;
        this.shouldRemove = false;
    }
    update(dt, game) {
        if (this.kind === 'mine') {
            this.life -= dt;
            this.arming -= dt;
            const p = game.player;
            if (this.arming <= 0 && Math.hypot(this.x - p.x, this.y - p.y) < 56) {
                p.takeDamage(this.damage, game);
                game.createParticles(this.x, this.y, '#ff5d9e', 10);
                game.worldVfx?.nova(this.x, this.y, 56, 'red');
                game.damageTerrain?.(this.x, this.y, 53, this.damage, null, false);
                this.shouldRemove = true;
            } else if (this.life <= 0) {
                this.shouldRemove = true;
            }
            return;
        }
        if(this.kind==='missile'){
            // Guided rocket with a limited turning radius. A moving player
            // can still sidestep it through ordinary shared-game physics.
            const p=game.player;
            const target=Math.atan2(p.y-this.y,p.x-this.x);
            const heading=Math.atan2(this.vy,this.vx);
            const error=Math.atan2(Math.sin(target-heading),Math.cos(target-heading));
            const turn=Math.max(-1.4*dt,Math.min(1.4*dt,error));
            const speed=Math.hypot(this.vx,this.vy)||230;
            this.lastTargetAngle=heading+turn;
            this.vx=Math.cos(this.lastTargetAngle)*speed;
            this.vy=Math.sin(this.lastTargetAngle)*speed;
        }
        const previousX=this.x,previousY=this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if(game.missionWorld?.index===0&&!game.missionWorld.clearLineOfFire(previousX,previousY,this.x,this.y)){
            this.shouldRemove=true;return;
        }
        this.life -= dt;
        if (this.life <= 0) { this.shouldRemove = true; return; }
        if (game.friendlyBases?.interceptEnemyProjectile?.(this, game)) return;
        const p = game.player;
        if (Math.hypot(this.x - p.x, this.y - p.y) < p.size + this.size) {
            if(this.kind==='missile'){
                const rank=p.passives?.dodge?.count||0;
                const movement=Math.hypot(p.vx||0,p.vy||0);
                const motion=Math.min(1,Math.max(0,(movement-45)/165));
                const cooldown=(game.gameTime||0)-(p.lastMissileEvasionAt??-100);
                const chance=Math.min(.44,(.10+.075*rank)*motion);
                // Skill only assists an actively piloted ship. Stationary
                // pilots cannot auto-evade rockets, even with stacked dodge.
                if(rank>0&&motion>0&&cooldown>=1.5&&Math.random()<chance){
                    p.lastMissileEvasionAt=game.gameTime;
                    p.missileEvasionAt=game.gameTime;
                    p.missileEvasionSign=Math.sign((p.vx||0)*this.vy-
                        (p.vy||0)*this.vx)||1;
                    game.createFloatingText?.('МАНЁВР · РАКЕТА МИМО',p.x,p.y-45,'#7cffe6');
                    game.createParticles(this.x,this.y,'#a5efff',7);
                    this.shouldRemove=true;
                    return;
                }
                // Plain random dodge must not make an idle target immune.
                p.takeDamage(this.damage,game,{ignoreDodge:true});
                if(game.missionWorld?.index===0&&!game.missionWorld.missileExplained){
                    game.missionWorld.missileExplained=true;
                    game._announce?.('РАКЕТА: меняйте траекторию! Навык «Уклонение» в дереве «Корабль» даёт манёвры на ходу.');
                }
            }else p.takeDamage(this.damage,game);
            game.createParticles(this.x, this.y, '#ff6da0', 8);
            this.shouldRemove = true;
        }
    }
    render(ctx) {
        if(this.kind==='missile'&&this._hybrid3dVisible)return;
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.kind === 'mine') {
            const pulse = .6 + .4 * Math.sin(performance.now() / 85);
            ctx.shadowColor = '#fa3683'; ctx.shadowBlur = 16;
            ctx.strokeStyle = this.arming > 0 ? '#ffbd72' : '#ff487e';
            ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.arc(0, 0, 49, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#84284e'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffd5e9'; ctx.beginPath();
            ctx.arc(0, 0, 4 + pulse * 2, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.rotate(Math.atan2(this.vy, this.vx));
            if(this.kind==='missile'){
                const halo=ctx.createLinearGradient(-34,0,10,0);
                halo.addColorStop(0,'#ff9c3a00');
                halo.addColorStop(1,'#ffdb835c');
                ctx.fillStyle=halo;ctx.beginPath();ctx.ellipse(-16,0,27,7,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#bcc7ce';ctx.fillRect(-10,-3.3,18,6.6);
                ctx.fillStyle='#ff844e';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(2,-6);
                ctx.lineTo(2,6);ctx.closePath();ctx.fill();
                ctx.fillStyle='#627a87';ctx.fillRect(-9,-9,4,18);
                ctx.restore();return;
            }
            if (drawEnemyBolt(ctx,this.kind)) {
                ctx.restore();
                return;
            }
            ctx.shadowColor = this.kind === 'laser' ? '#ff396f' : '#ffb46a';
            ctx.shadowBlur = 15;
            ctx.fillStyle = this.kind === 'laser' ? '#ff5b90' : '#ffb46a';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.kind === 'laser' ? 20 : 11, 3.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff8ed'; ctx.fillRect(-2, -1.3, 7, 2.6);
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Projectile
// ---------------------------------------------------------------------------
export class Projectile {
    constructor(x, y, angle, def, damage, level, player) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.angle = angle;
        this.def = def;
        this.damage = damage;
        this.level = level;
        this.size = 8;
        this.speed = def.speed || 300;
        this.piercing = !!def.piercing ||
            (def.id === 'starter_pulse' && level >= 3);
        this.homing = !!def.homing;
        this.arc = !!def.arc;
        this.boomerang = !!def.boomerang;
        this.explode = !!def.explode;
        this.explodeRadius = def.explodeRadius || 60;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.life = 4; // seconds
        this.hitEnemies = new Set();
        this.shouldRemove = false;
        this.travelDist = 0;
        this.maxDist = (def.baseRange || 300) * (1 + (level - 1) * .1) * (player ? player.getAreaMult() : 1);
        if(player?.trainingProgression)this.maxDist=Math.min(170,this.maxDist);
        this.id = def.id;
    }

    update(dt, game) {
        if(this.rangeEnded){this._onEnd(game);this.shouldRemove=true;return;}
        if (this.homing && this.hitEnemies.size === 0) {
            const target = game.spatial.findNearestEnemy(this.x, this.y, 9999);
            if (target) {
                const ta = Math.atan2(target.y - this.y, target.x - this.x);
                let diff = ta - this.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                this.angle += diff * Math.min(1, 6 * dt);
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
            }
        }

        if (this.arc) {
            this.vy += 420 * dt; // gravity
        }

        if (this.boomerang) {
            const d = Math.hypot(this.x - this.startX, this.y - this.startY);
            if (d > this.maxDist * 0.5) {
                const ra = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                this.vx = Math.cos(ra) * this.speed;
                this.vy = Math.sin(ra) * this.speed;
            }
        }

        const velocity=Math.hypot(this.vx,this.vy);
        const step=game.missionWorld?.index===0?Math.min(dt,Math.max(0,this.maxDist-this.travelDist)/(velocity||1)):dt;
        this.x += this.vx * step;
        this.y += this.vy * step;
        this.travelDist += velocity * step;
        if(game.missionWorld?.index===0&&this.travelDist>=this.maxDist-1e-7)this.rangeEnded=true;
        this.life -= dt;

        if (this.travelDist > this.maxDist || this.life <= 0) {
            this._onEnd(game);
            this.shouldRemove = true;
        }

        if (this.boomerang) {
            const dp = Math.hypot(this.x - game.player.x, this.y - game.player.y);
            if (dp < 24 && this.travelDist > 60) {
                this._onEnd(game);
                this.shouldRemove = true;
            }
        }
    }

    _onEnd(game) {
        if (this.explode) {
            game.audio.explosion('small');
            // iter-16 perf: probe the spatial hash for the blast cells. The
            // explodeRadius is bounded (config BOMBER_DEFAULT_RADIUS = 120),
            // so only a handful of cells are visited even on very dense waves.
            const cands = game?.spatial
                ? game.spatial.queryRect(this.x, this.y, this.explodeRadius)
                : game.enemies;
            for (const enemy of cands) {
                const d = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (d < this.explodeRadius) enemy.takeDamage(this.damage * 0.6);
            }
            game.createParticles(this.x, this.y, '#ff8800', 10);
            game.worldVfx?.shipExplosion(this.x, this.y, 17, '#ffad65');
            game.shake(0.15);
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        // Energy streak is drawn in projectile-local space, so even a fast
        // moving rocket reads as a continuous shot without allocating VFX.
        const trail = Math.min(48, this.speed * .065);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.id === 'starter_pulse' ? .35 : .65;
        ctx.fillStyle = this.id === 'knife' ? '#ff9a45' : '#62d9ff';
        ctx.fillRect(-trail, -2.4, trail, 4.8);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        switch (this.id) {
            case 'starter_pulse':
                if (drawWeaponBolt(ctx,this.id,this.level)) break;
                ctx.shadowColor = '#70deff'; ctx.shadowBlur = 8;
                ctx.fillStyle = '#74e5ff'; ctx.beginPath();
                ctx.moveTo(9, 0); ctx.lineTo(-5, -3.5);
                ctx.lineTo(-5, 3.5); ctx.closePath(); ctx.fill();
                break;
            case 'knife':
                if(drawCombatMissile(ctx,this.level))break;
                ctx.shadowColor='#ffad4e';ctx.shadowBlur=10;
                ctx.fillStyle='#ffd58b';ctx.beginPath();
                ctx.moveTo(13,0);ctx.lineTo(-5,-5);ctx.lineTo(-12,0);
                ctx.lineTo(-5,5);ctx.closePath();ctx.fill();
                ctx.fillStyle='#78d8ff';ctx.fillRect(-14,-1.4,7,2.8);
                break;
            case 'magic_wand':
                if (drawWeaponBolt(ctx,this.id,this.level)) break;
                ctx.shadowColor='#50eaff';ctx.shadowBlur=16;
                ctx.fillStyle='#4ce9ed';ctx.beginPath();
                ctx.ellipse(0,0,11,5,0,0,Math.PI*2);ctx.fill();
                ctx.fillStyle='#e5ffff';ctx.beginPath();ctx.arc(2,0,3,0,Math.PI*2);ctx.fill();
                break;
            case 'axe':
                ctx.fillStyle = '#b0b5b8';
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'cross':
                ctx.fillStyle = '#fff3a0';
                ctx.fillRect(-10, -3, 20, 6);
                ctx.fillRect(-3, -10, 6, 20);
                break;
            case 'fire_wand':
                if (drawWeaponBolt(ctx,this.id,this.level)) break;
                ctx.fillStyle = '#ff6600';
                ctx.beginPath();
                ctx.arc(0, 0, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffcc00';
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                break;
            default:
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// OrbitShard: circles the hero and deals damage on contact. Managed by the
// Orbit weapon, which owns a set of shards and updates them each tick.
// ---------------------------------------------------------------------------
export class OrbitShard {
    constructor(weapon, index, total, radius, damage) {
        this.weapon = weapon;
        this.index = index;
        this.total = total;
        this.radius = radius;
        this.damage = damage;
        this.angle = (index / total) * Math.PI * 2;
        this.hitTimers = new Map(); // enemy -> cooldown
        this.x = 0;
        this.y = 0;
    }
    update(dt, player, game) {
        this.angle += dt * 2.4; // rad/sec
        this.x = player.x + Math.cos(this.angle) * this.radius;
        this.y = player.y + Math.sin(this.angle) * this.radius;
        // Tick cooldowns down.
        for (const [enemy, t] of this.hitTimers) {
            const nt = t - dt;
            if (nt <= 0) this.hitTimers.delete(enemy);
            else this.hitTimers.set(enemy, nt);
        }
        // Broad-phase via spatial hash. The query radius adapts to whatever
        // the largest enemy in the bucket might be (boss is 64) plus the
        // shard's own visual radius — no more fixed 40 px that misses bosses.
        const SHARD_HIT = 10; // matches shard core in render()
        const queryR = SHARD_HIT + 64; // 64 = largest enemy.size in data.js
        for (const e of game.spatial.queryRect(this.x, this.y, queryR)) {
            if (this.hitTimers.has(e)) continue;
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < (e.size || 12) + SHARD_HIT) {
                e.takeDamage(this.damage);
                this.hitTimers.set(e, 0.5);
                game.audio?.shoot?.('orbit');
                game.createFloatingText(Math.round(this.damage), e.x, e.y - 18, '#ffffcc');
            }
        }
    }
    render(ctx) {
        ctx.save();
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 14);
        g.addColorStop(0, 'rgba(255,240,180,0.85)');
        g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();ctx.translate(this.x,this.y);
        ctx.rotate(this.angle+Math.PI/2);
        ctx.fillStyle='#81dff8';ctx.strokeStyle='#e7ffff';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,3);
        ctx.lineTo(0,6);ctx.lineTo(-6,3);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.restore();
        ctx.restore();
    }
}
// ---------------------------------------------------------------------------
// Mine: dropped at the hero's location, arms during `fuse` then detonates.
// ---------------------------------------------------------------------------
export class Mine {
    constructor(x,y,radius,damage,level=1,vx=0,vy=0) {
        this.x=x;this.y=y;this.vx=vx;this.vy=vy;
        this.radius=radius;this.damage=damage;this.level=level;
        this.life=48;this.arming=.65;this.shouldRemove=false;
        this.size=8;this.phase=Math.random()*Math.PI*2;
    }
    update(dt,game) {
        this.life-=dt;this.arming-=dt;
        if(this.life<=0){this.shouldRemove=true;return;}
        // A deployed mine drifts for nearly a minute instead of detonating
        // autonomously a few seconds after being dropped.
        this.x+=this.vx*dt;this.y+=this.vy*dt;
        const damping=Math.exp(-.26*dt);
        this.vx*=damping;this.vy*=damping;
        this.phase+=dt*2.1;
        if(this.arming>0)return;
        const detection=30+this.level*7;
        const magnetic=this.level>=3?(70+(this.level-3)*55):0;
        const sight=Math.max(detection,magnetic);
        const candidates=game.spatial?.queryRect?.(this.x,this.y,sight)||game.enemies;
        let best=null,bestD=Infinity;
        for(const e of candidates) {
            if(e.hp<=0)continue;
            const d=Math.hypot(e.x-this.x,e.y-this.y);
            if(d<bestD){best=e;bestD=d;}
        }
        if(best&&magnetic>0&&bestD<magnetic&&bestD>detection*.55){
            const pullSpeed=(38+(this.level-3)*64);
            const dx=(best.x-this.x)/Math.max(1,bestD);
            const dy=(best.y-this.y)/Math.max(1,bestD);
            this.vx+=(dx*pullSpeed-this.vx)*Math.min(1,dt*2.7);
            this.vy+=(dy*pullSpeed-this.vy)*Math.min(1,dt*2.7);
        }
        if(!best||bestD>detection+best.size)return;
        const nearby=game.spatial?.queryRect?.(this.x,this.y,this.radius)||
            game.enemies;
        let hit=0;
        for(const enemy of nearby) {
            if(enemy.hp<=0)continue;
            const d=Math.hypot(enemy.x-this.x,enemy.y-this.y);
            if(d>=this.radius+enemy.size*.25)continue;
            enemy.takeDamage(this.damage*(1-.28*d/Math.max(1,this.radius)));
            game.createFloatingText?.(Math.round(this.damage),
                enemy.x,enemy.y-20,'#ffce8f');
            hit++;
        }
        game.damageTerrain?.(this.x,this.y,this.radius,this.damage*.8);
        game.worldVfx?.nova(this.x,this.y,this.radius*.95,'orange');
        game.createParticles?.(this.x,this.y,'#ffa761',Math.min(26,12+hit*3));
        game.shake?.(.15);game.audio?.explosion?.();
        this.shouldRemove=true;
    }
    render(ctx) {
        // No giant red disk: only the mine itself is visible.
        const pulse=.65+.35*Math.sin(this.phase*2.1);
        ctx.save();ctx.translate(this.x,this.y);
        ctx.rotate(this.phase*.22);
        ctx.shadowColor=this.level>=3?'#6ceaff':'#ffbb80';
        ctx.shadowBlur=12*pulse;
        ctx.fillStyle=this.level>=3?'#2a7792':'#81533f';
        ctx.strokeStyle=this.level>=3?'#a3f8ff':'#ffd1a0';
        ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(8,0);
        ctx.lineTo(0,9);ctx.lineTo(-8,0);ctx.closePath();
        ctx.fill();ctx.stroke();
        ctx.fillStyle='#f5fbff';ctx.beginPath();ctx.arc(0,0,2.5,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Exp Orb
// ---------------------------------------------------------------------------
export class ExpOrb {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.size = 4 + Math.log(value + 1) * 1.5;
        this.shouldRemove = false;
        this.magnetSpeed = 0;
        this.life = CONFIG.EXP_ORB_LIFETIME;
    }

    update(dt, game) {
        this.life -= dt;
        if (this.life <= 0) {
            this.shouldRemove = true;
            return;
        }
        const p = game.player;
        const dx = p.x - this.x;
        const dy = p.y - this.y;
        const d = Math.hypot(dx, dy);
        const mag = p.getMagnetRange();

        if (d < CONFIG.PICKUP_DISTANCE) {
            p.gainExp(this.value);
            game.createFloatingText(`+${this.value} опыта`, p.x, p.y - 40, '#66bbff');
            game.audio.pickup();
            if (game.run) game.run.orbsCollected = (game.run.orbsCollected || 0) + 1;
            this.shouldRemove = true;
            return;
        }
        if (d < mag) {
            this.magnetSpeed = Math.min(this.magnetSpeed + 600 * dt, 560);
            this.x += (dx / d) * this.magnetSpeed * dt;
            this.y += (dy / d) * this.magnetSpeed * dt;
        }
    }

    render(ctx) {
        const a = this.life < 2 ? Math.max(0, this.life / 2) : 1;
        ctx.save();
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2.2);
        g.addColorStop(0, 'rgba(100,180,255,0.55)');
        g.addColorStop(1, 'rgba(100,180,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7ab8ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Particle / FloatingText
// ---------------------------------------------------------------------------
export class Particle {
    constructor(x, y, color, opts = {}) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = opts.size ?? Math.random() * 4 + 2;
        this.life = opts.life ?? 1;
        this.decay = opts.decay ?? Math.random() * 1.5 + 1;
        const a = opts.angle ?? Math.random() * Math.PI * 2;
        const s = opts.speed ?? Math.random() * 180 + 60;
        this.vx = Math.cos(a) * s;
        this.vy = Math.sin(a) * s;
        this.friction = opts.friction ?? 0.2;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= Math.pow(this.friction, dt);
        this.vy *= Math.pow(this.friction, dt);
        this.life -= this.decay * dt;
        this.size *= Math.pow(0.3, dt);
    }
    render(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

export class FloatingText {
    constructor(text, x, y, color, opts = {}) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = opts.life ?? 1;
        this.vy = opts.vy ?? -60;
        this.size = opts.size ?? 16;
        this.weight = opts.weight ?? 'bold';
        this.crit = !!opts.crit;
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= 1.2 * dt;
    }
    render(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        const sz = this.crit ? this.size * 1.6 : this.size;
        ctx.font = `${this.weight} ${sz}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        if (this.crit) {
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(this.text, this.x, this.y);
        }
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

// Helper: look up an enemy definition by id string.
export function findEnemyDef(id) {
    for (const def of Object.values(ENEMIES)) {
        if (def.id === id) return def;
    }
    return null;
}

