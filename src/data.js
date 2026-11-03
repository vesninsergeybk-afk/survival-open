/**
 * @module data
 * @description Pure-data catalogue: weapons, passives, enemies, bosses, wave
 * director timeline, achievement definitions and unlock map. Behaviour lives
 * elsewhere (`weapons.js`, `entities.js`, `achievements.js`); this module is
 * intentionally side-effect free so it can be diffed during balancing.
 *
 * Dependencies: none.
 *
 * Exports:
 *   - {Record<string, WeaponDef>} WEAPONS
 *   - {Record<string, PassiveDef>} PASSIVES
 *   - {Record<string, EnemyDef>} ENEMIES
 *   - {Record<string, BossDef>} BOSSES
 *   - {WaveDef[]} WAVES
 *   - {AchievementDef[]} ACHIEVEMENTS
 *   - {Record<string, UnlockDef>} UNLOCKS
 */

// ---------------------------------------------------------------------------
// Weapons
// Level scaling is uniform: damage +20% per level, cooldown ×0.92, range +10%.
// Level 5 triggers a weapon's "evolution" flag (see weapons.js).
// ---------------------------------------------------------------------------
export const WEAPONS = {
    STARTER_PULSE: {
        id: 'starter_pulse',
        name: 'Учебный импульс',
        icon: '🔹',
        description: 'Сначала одиночный ближний заряд. На 2-м уровне — два импульса, на 3-м они пробивают одного врага. Астероиды повреждает сильнее.',
        baseDamage: 8,
        baseCooldown: 1.35,
        baseRange: 110,
        projectileCount: 1,
        piercing: false,
        type: 'projectile',
        speed: 340,
        rockDamageMult: 3.2,
        evolveLevel: 5,
        evolveName: 'Тройной импульс'
    },
    WHIP: {
        id: 'whip', minPlayerLevel: 2,
        name: "Плазменная дуга",
        icon: '⚔️',
        description: "Поражает цели по обоим бортам корабля. После усиления замыкает круговую дугу.",
        baseDamage: 20,
        baseCooldown: 1.5,
        baseRange: 90,
        projectileCount: 1,
        piercing: false,
        type: 'melee',
        evolveLevel: 5,
        evolveName: "Плазменный вихрь"
    },
    MAGIC_WAND: {
        id: 'magic_wand', minPlayerLevel: 3,
        name: "Ионная пушка",
        icon: '🔮',
        description: "Ионный заряд наводится на ближайшую цель. После усиления выпускает три заряда.",
        baseDamage: 15,
        baseCooldown: 1.2,
        baseRange: 320,
        projectileCount: 1,
        piercing: false,
        type: 'projectile',
        speed: 420,
        homing: true,
        evolveLevel: 5,
        evolveName: "Тройной ионный залп"
    },
    KNIFE: {
        id: 'knife', minPlayerLevel: 4,
        name: "Ракетный залп",
        icon: '🚀',
        description: "Мощные, но редкие ракеты. С третьего уровня двойной залп; на пятом — веер из трёх ракет.",
        baseDamage: 19,
        baseCooldown: 1.22,
        baseRange: 300,
        projectileCount: 1,
        piercing: false,
        type: 'projectile',
        speed: 470,
        evolveLevel: 5,
        evolveName: "Тройной перехват",
        // Evolution: the focused rocket fan gets a modest +4% crit
        // chance on top of the player's current critChance roll. Picked up
        // by Weapon._rollCrit when the weapon `isEvolved()`.
        evolveBonusCrit: 0.04
    },
    ORBIT: {
        id: 'orbit', minPlayerLevel: 5,
        name: "Боевые спутники",
        icon: '💫',
        description: "Спутники охраняют корабль на орбите. После усиления образуют два кольца.",
        baseDamage: 16,
        baseCooldown: 0.4, // used as "tick" for damage re-hit window
        baseRange: 120, // orbit radius
        projectileCount: 2,
        piercing: true,
        type: 'orbit',
        evolveLevel: 5,
        evolveName: "Двойной эскорт",
        // iter-14: evolved Twin Halo also boosts shard damage by +10%.
        evolveDamageMult: 1.1
    },
    LIGHTNING: {
        id: 'lightning', minPlayerLevel: 6,
        name: "Электроразряд",
        icon: '⚡',
        description: "Поражает случайного врага. С третьего уровня поражает несколько целей подряд. После усиления вызывает ионную бурю.",
        baseDamage: 35,
        baseCooldown: 3.0,
        baseRange: 420,
        piercing: true,
        type: 'instant',
        chain: true,
        chainCount: 3,
        evolveLevel: 5,
        evolveName: "Ионная буря",
        // iter-14: evolved Thunder Call rolls a +15% crit on the strikes.
        evolveBonusCrit: 0.15
    },
    MINE: {
        id: 'mine', minPlayerLevel: 3,
        name: "Гравимина",
        icon: '💣',
        description: "Сбрасывает дрейфующую мину только когда враг приближается с кормы. Уровни увеличивают радиус обнаружения; улучшенные мины магнитные.",
        baseDamage: 45,
        baseCooldown: 2.2,
        baseRange: 100, // explosion radius
        projectileCount: 1,
        piercing: true,
        type: 'mine',
        fuse: 1.2,
        evolveLevel: 5,
        evolveName: "Кассетная гравимина"
    },
    GARLIC: {
        id: 'garlic', minPlayerLevel: 4,
        name: "Энергощит",
        icon: '🧄',
        description: "Создаёт вокруг корабля поражающее энергетическое поле.",
        baseDamage: 5,
        baseCooldown: 0.2,
        baseRange: 110,
        piercing: true,
        type: 'aura',
        continuous: true
    },
    // --- v2.4 additions ---------------------------------------------------
    FROST_NOVA: {
        id: 'frost_nova', minPlayerLevel: 5,
        name: "Криоимпульс",
        icon: '❄️',
        description: "Ледяное кольцо замедляет врагов. После развития выпускает два кольца.",
        baseDamage: 28,
        baseCooldown: 3.2,
        baseRange: 200, // blast radius
        projectileCount: 1,
        piercing: true,
        type: 'nova',
        slowPct: 0.5,
        slowDuration: 1.2,
        evolveLevel: 5,
        evolveName: "Ледяной каскад"
    },
    SOUL_DRAIN: {
        id: 'soul_drain', minPlayerLevel: 6,
        name: "Ремонтный луч",
        icon: '🩸',
        description: "Энергетический луч повреждает цель и восстанавливает обшивку. После усиления захватывает две цели.",
        baseDamage: 8,
        baseCooldown: 0.25, // tick rate
        baseRange: 260,
        projectileCount: 1,
        piercing: true,
        type: 'drain',
        lifestealPct: 0.25,
        evolveLevel: 5,
        evolveName: "Двойной ремонтный луч"
    },
    BOOMERANG: {
        id: 'boomerang', minPlayerLevel: 4,
        name: "Возвратная торпеда",
        icon: '🪃',
        description: "Летит вперёд и возвращается к кораблю. После развития описывает двойную дугу.",
        baseDamage: 18,
        baseCooldown: 1.1,
        baseRange: 340,
        projectileCount: 1,
        piercing: true,
        type: 'projectile',
        speed: 380,
        boomerang: true,
        evolveLevel: 5,
        evolveName: "Двойная дуга",
        // iter-14: Twin Arc fires 5% faster than its base cooldown formula.
        evolveCooldownMult: 0.95
    },
    RAILGUN: {
        id: 'railgun', minPlayerLevel: 7,
        name: 'Рельсотрон',
        icon: '🎯',
        description: 'Пробивает строй врагов и астероиды прямым лучом. Пятый уровень — двойной залп.',
        baseDamage: 68, baseCooldown: 3.3, baseRange: 690,
        projectileCount: 1, piercing: true, type: 'rail',
        evolveLevel: 5, evolveName: 'Двойной рельсотрон'
    },
    DRONE_SWARM: {
        id: 'drone_swarm', minPlayerLevel: 6,
        name: 'Эскадрилья поддержки',
        icon: '🛸',
        description: 'Два автономных дрона стреляют с флангов. С развитием их становится четыре.',
        baseDamage: 12, baseCooldown: .73, baseRange: 450,
        projectileCount: 2, piercing: false, type: 'drone',
        speed: 520, homing: true,
        evolveLevel: 5, evolveName: 'Эскадрилья «Альфа»'
    },
    // --- iter-20: Konami Code unlock --------------------------------------
    // Hidden weapon awarded on the first time the player enters the Konami
    // Code on the main menu. Behaves like a fast piercing projectile (a nod
    // to retro shoot-'em-ups). Not part of the regular drop pool — only
    // available as a starter once UNLOCKS.konami_code is earned.
    RETRO_BLASTER: {
        id: 'retro_blaster', minPlayerLevel: 8,
        name: "Квантовый бластер",
        icon: '👾',
        description: "Квантовый луч пронзает врагов перед героем. После развития выпускает три луча.",
        baseDamage: 14,
        baseCooldown: 0.5,
        baseRange: 480,
        projectileCount: 2,
        piercing: true,
        type: 'projectile',
        speed: 700,
        evolveLevel: 5,
        evolveName: "Квантовый шторм"
    }
};

// ---------------------------------------------------------------------------
// Passives (stackable up to CONFIG.PASSIVE_MAX_STACK)
// ---------------------------------------------------------------------------
export const PASSIVES = {
    MAX_HP: {
        id: 'max_hp',
        name: "Живучесть",
        icon: '❤️',
        description: "Максимальное здоровье +20%",
        effect: { maxHpMult: 0.2 }
    },
    RECOVERY: {
        id: 'recovery',
        name: "Восстановление",
        icon: '💚',
        description: "Восстановление +0,5 здоровья/с",
        effect: { hpRegen: 0.5 }
    },
    ARMOR: {
        id: 'armor',
        name: "Броня",
        icon: '🛡️',
        description: "Получаемый урон −1",
        effect: { armor: 1 }
    },
    MOVESPEED: {
        id: 'movespeed',
        name: "Быстрота",
        icon: '👟',
        description: "Скорость движения +10%",
        effect: { speedMult: 0.1 }
    },
    MIGHT: {
        id: 'might',
        name: "Сила",
        icon: '💪',
        description: "Урон +10%",
        effect: { damageMult: 0.1 }
    },
    AREA: {
        id: 'area',
        name: "Размах",
        icon: '📏',
        description: "Дальность оружия +10%",
        effect: { areaMult: 0.1 }
    },
    COOLDOWN: {
        id: 'cooldown',
        name: "Перезарядка",
        icon: '⏱️',
        description: "Частота атак +8%",
        effect: { cooldownMult: -0.08 }
    },
    MAGNET: {
        id: 'magnet',
        name: "Магнит",
        icon: '🧲',
        description: "Радиус сбора +25%",
        effect: { magnetMult: 0.25 }
    },
    GROWTH: {
        id: 'growth',
        name: "Обучаемость",
        icon: '📈',
        description: "Получаемый опыт +10%",
        effect: { expMult: 0.1 }
    },
    LUCK: {
        id: 'luck',
        name: "Удача",
        icon: '🍀',
        description: "Шанс критического удара +5%",
        effect: { critChance: 0.05 }
    },
    // --- iter-14 passives -------------------------------------------------
    // The three new passives all hook into existing player stats so the level-
    // up roller pool grows without any new code path. `dodgeChance` is summed
    // (capped at 0.6 in entities.js) and consulted before damage is applied;
    // `magnetMult` is reused for Pickup Magnet+ which stacks multiplicatively
    // on the existing MAGNET passive; `damageReduction` is summed and clamped
    // to a soft 0.6 cap on the consumer side so the player can't go fully
    // immortal even with five stacks.
    SHIELD_CORE: {
        id: 'shield_core', name: 'Аварийный щит', icon: '🛡️',
        description: 'Щит +28 единиц; восстанавливается спустя 6 секунд без попаданий.',
        effect: { shieldMax: 28, shieldRecharge: 1.4 }
    },
    EMP_PULSE: {
        id: 'emp_pulse', name: 'ЭМИ-излучатель', icon: '📡',
        description: 'Периодический разряд повреждает и замедляет ближайших врагов.',
        effect: { empPulse: 1 }
    },
    SALVAGE: {
        id: 'salvage', name: 'Переработчик обломков', icon: '⚙️',
        description: 'Больше энергии за разрушенные астероиды: +20% за модуль.',
        effect: { salvageMult: 0.2 }
    },
    TARGETING: {
        id: 'targeting', name: 'Баллистический компьютер', icon: '🎛️',
        description: 'Дальность вооружения +8%, шанс критического попадания +3%.',
        effect: { areaMult: 0.08, critChance: 0.03 }
    },
    SIGNAL_DECODER: {
        id: 'signal_decoder', name: 'Дешифратор переговоров', icon: '📻',
        description: 'Показывает перехваченные приказы противников: засады, координаты и смену тактики.',
        effect: { signalIntercept: 1 }
    },
    DODGE: {
        id: 'dodge',
        name: "Уклонение",
        icon: '💨',
        description: "Шанс уклонения +5%",
        effect: { dodgeChance: 0.05 }
    },
    MAGNET_PLUS: {
        id: 'magnet_plus',
        name: "Усиленный магнит",
        icon: '🧲',
        description: "Радиус сбора +35%",
        effect: { magnetMult: 0.35 }
    },
    DAMAGE_REDUCTION: {
        id: 'damage_reduction',
        name: "Защита",
        icon: '🛡️',
        description: "Получаемый урон −8%",
        effect: { damageReduction: 0.08 }
    }
};

// ---------------------------------------------------------------------------
// Enemies
// Five distinct archetypes + legacy types kept for backwards compat.
// New archetype flags (all optional):
//   ranged:     fires projectiles at the player
//   splitter:   on death, spawns splitChildren × ENEMIES.splitInto
//   dasher:     charges forward in short bursts
//   shielded:   takes reduced damage until shield breaks
// ---------------------------------------------------------------------------
export const ENEMIES = {
    BAT: {
        id: 'bat',
        name: "Дрон-разведчик",
        archetype: 'chaser',
        hp: 15,
        speed: 110,
        damage: 10,
        exp: 10,
        color: '#8844ff',
        size: 12
    },
    ZOMBIE: {
        id: 'zombie',
        name: "Штурмовой дрон",
        archetype: 'chaser',
        hp: 30,
        speed: 70,
        damage: 15,
        exp: 15,
        color: '#44aa44',
        size: 18
    },
    SKELETON: {
        id: 'skeleton',
        name: "Истребитель-призрак",
        archetype: 'chaser',
        hp: 25,
        speed: 95,
        damage: 12,
        exp: 12,
        color: '#dddddd',
        size: 14
    },
    STALKER: {
        id: 'stalker',
        name: "Перехватчик",
        archetype: 'flanker',
        flanker: true,
        hp: 32,
        speed: 132,
        damage: 13,
        exp: 20,
        color: '#ae8abf',
        size: 15
    },
    WOLF: {
        id: 'wolf',
        name: "Рейдер",
        archetype: 'dasher',
        dasher: true,
        dashSpeed: 320,
        dashInterval: 3.5,
        dashDuration: 0.6,
        hp: 40,
        speed: 150,
        damage: 20,
        exp: 20,
        color: '#aa6644',
        size: 16
    },
    GOLEM: {
        id: 'golem',
        name: "Броненосец",
        archetype: 'shielded',
        shielded: true,
        shieldHp: 60,
        damageReduction: 0.5,
        hp: 120,
        speed: 45,
        damage: 30,
        exp: 50,
        color: '#888888',
        size: 28
    },
    GHOST: {
        id: 'ghost',
        name: "Фантомный зонд",
        archetype: 'chaser',
        hp: 20,
        speed: 130,
        damage: 18,
        exp: 18,
        color: '#88ccff',
        size: 15,
        ghost: true
    },
    // --- New archetypes --------------------------------------------------
    MAGE: {
        id: 'mage',
        name: "Плазменная турель",
        archetype: 'ranged',
        ranged: true,
        firingRange: 360,
        keepDistance: 260,
        projectileSpeed: 220,
        projectileDamage: 14,
        fireCooldown: 2.4,
        hp: 28,
        speed: 70,
        damage: 8,
        exp: 22,
        color: '#cc44cc',
        size: 14
    },
    SLIME: {
        id: 'slime',
        name: "Рой наномашин",
        archetype: 'splitter',
        splitter: true,
        splitCount: 2,
        hp: 55,
        speed: 65,
        damage: 14,
        exp: 24,
        color: '#33cc88',
        size: 20
    },
    SLIMELING: {
        id: 'slimeling',
        name: "Микродрон",
        archetype: 'chaser',
        hp: 18,
        speed: 105,
        damage: 8,
        exp: 6,
        color: '#66ddaa',
        size: 10
    },
    // --- v2.4 additions: bomber (self-destructs) + illusionist (clone) ---
    BOMBER: {
        id: 'bomber',
        name: "Дрон-камикадзе",
        archetype: 'bomber',
        bomber: true,
        fuseRange: 80, // begins countdown when within this distance
        fuseTime: 1.4, // seconds before detonation
        blastRadius: 120,
        blastDamage: 40,
        hp: 35,
        speed: 120,
        damage: 10,
        exp: 28,
        color: '#ff6644',
        size: 14
    },
    SNIPER: {
        id: 'sniper', name: 'Лазерный снайпер', archetype: 'ranged',
        ranged: true, aimTime: 1.15, firingRange: 680, keepDistance: 465,
        projectileSpeed: 530, projectileDamage: 24, fireCooldown: 3.7,
        hp: 58, speed: 86, damage: 12, exp: 36,
        color: '#ff6fa8', size: 16
    },
    GUNSHIP: {
        id: 'gunship', name: 'Штурмовой корвет', archetype: 'ranged',
        ranged: true, burstCount: 5, spreadAngle: .2,
        firingRange: 490, keepDistance: 310,
        projectileSpeed: 270, projectileDamage: 10, fireCooldown: 3.2,
        hp: 110, speed: 83, damage: 19, exp: 48,
        color: '#ffc176', size: 23
    },
    MINELAYER: {
        id: 'minelayer', name: 'Минный заградитель', archetype: 'minelayer',
        mineLayer: true, mineCooldown: 4.2, mineRange: 440,
        hp: 95, speed: 90, damage: 15, exp: 46,
        color: '#e37aff', size: 21
    },
    RAMMER: {
        id: 'rammer', name: 'Таранщик', archetype: 'dasher',
        dasher: true, dashSpeed: 465, dashInterval: 2.8, dashDuration: .6,
        hp: 82, speed: 175, damage: 36, exp: 42,
        color: '#ff674b', size: 21
    },
    CARRIER: {
        id: 'carrier', name: 'Дроновоз', archetype: 'carrier',
        illusionist: true, cloneInto: 'bat', cloneCooldown: 7,
        cloneCount: 3, hp: 170, speed: 66, damage: 23,
        exp: 68, color: '#73beff', size: 28
    },
    ILLUSIONIST: {
        id: 'illusionist',
        name: "Голографический дрон",
        archetype: 'illusionist',
        illusionist: true,
        cloneCooldown: 5.5,
        cloneCount: 2,
        hp: 42,
        speed: 95,
        damage: 12,
        exp: 30,
        color: '#cc88ff',
        size: 15
    },
    REPAIRER: {
        id: 'repairer', name: 'Ремонтный челнок', archetype: 'ranged',
        ranged: true, canRetreatRepair: true, repairCharges: 1,
        firingRange: 355, keepDistance: 250, fireCooldown: 3.4,
        projectileSpeed: 240, projectileDamage: 9,
        hp: 64, speed: 124, damage: 10, exp: 38,
        color: '#9df0ef', size: 17
    },
    COMMANDER: {
        id: 'commander', name: 'Командир эскадрильи', archetype: 'ranged',
        ranged: true, commandSquad: true,
        firingRange: 420, keepDistance: 300, fireCooldown: 3.1,
        projectileSpeed: 285, projectileDamage: 12,
        hp: 105, speed: 102, damage: 17, exp: 65,
        color: '#d7d4ff', size: 23
    }
};

// Splitter produces this type (lookup by id to avoid circular assignment).
ENEMIES.SLIME.splitInto = 'slimeling';

// ---------------------------------------------------------------------------
// Bosses
// Mid-boss at 5:00, final boss at 10:00 (default). Each has a signature ability.
// ---------------------------------------------------------------------------
export const BOSSES = {
    HUNTER: {
        id: 'hunter', name: 'Корвет «Каратель»', hp: 1250,
        speed: 96, damage: 32, exp: 300, color: '#ff835d',
        size: 46, boss: true, ability: 'salvo', spawnAt: 135
    },
    REAPER: {
        id: 'reaper',
        name: "Крейсер «Жнец»",
        hp: 2500,
        speed: 80,
        damage: 40,
        exp: 500,
        color: '#220033',
        size: 48,
        boss: true,
        ability: 'summon',
        spawnAt: 300 // 5 minutes
    },
    VOID_LORD: {
        id: 'void_lord',
        name: "Дредноут Пустоты",
        hp: 6000,
        speed: 60,
        damage: 60,
        exp: 1200,
        color: '#550077',
        size: 64,
        boss: true,
        ability: 'charge',
        spawnAt: 600 // 10 minutes
    },
    // --- v2.4 mid/late bosses --------------------------------------------
    NECROMANCER: {
        id: 'necromancer',
        name: "Флагман «Некрон»",
        hp: 4200,
        speed: 70,
        damage: 50,
        exp: 850,
        color: '#3a1a4a',
        size: 54,
        boss: true,
        ability: 'summon',
        spawnAt: 450 // 7:30
    },
    CHRONO_LICH: {
        id: 'chrono_lich',
        name: "Хронокрейсер",
        hp: 10000,
        speed: 55,
        damage: 75,
        exp: 2000,
        color: '#0b2a4a',
        size: 72,
        boss: true,
        ability: 'charge',
        spawnAt: 720 // 12:00
    },
    // --- iter-14 tundra final boss ---------------------------------------
    // IceQueen is a frost-palette variant of the 10-minute boss. The tundra
    // stage swaps her in for VoidLord via `bossOverrides`; on other stages she
    // never auto-spawns. Listed here so the boss list, daily-mode replays and
    // achievement registry can reference her by id without a special case.
    ICE_QUEEN: {
        id: 'ice_queen',
        name: "Криоматка",
        hp: 6200,
        speed: 55,
        damage: 60,
        exp: 1300,
        color: '#88ccff',
        size: 66,
        boss: true,
        ability: 'charge',
        // Listed at 660 to keep the BOSSES timeline strictly ascending
        // (Reaper 300 < Necro 450 < VoidLord 600 < IceQueen 660 < ChronoLich
        // 720). Tundra's `bossOverrides` swaps her into VoidLord's 600 slot
        // at runtime; this raw value is never read on tundra (the override
        // path uses the source boss's spawnAt + offset).
        spawnAt: 660,
        iceQueen: true // visual flag, read by entities renderer for frost halo
    }
};

// ---------------------------------------------------------------------------
// Wave director: each entry is a window [from, to) (seconds) listing the pool
// of enemies that may spawn, plus a spawn-rate multiplier. The director falls
// back to the final entry once gameTime exceeds the last window.
// ---------------------------------------------------------------------------
export const WAVES = [
    { from: 0, to: 30, pool: ['bat','zombie','stalker'], spawnMult: 1.06, label: 'Разведка сектора' },
    { from: 30, to: 60, pool: ['bat','zombie','stalker','wolf','mage'], spawnMult: 1.18, label: 'Перехватчики' },
    { from: 60, to: 90, pool: ['zombie','skeleton','mage','gunship','sniper'], spawnMult: 1.2, label: 'Плазменный обстрел' },
    { from: 90, to: 120, pool: ['stalker','wolf','rammer','sniper','ghost','mage'], spawnMult: 1.3, label: 'Первая охота' },
    { from: 120, to: 180, pool: ['wolf','slime','mage','minelayer','gunship','rammer','carrier'], spawnMult: 1.43, label: 'Минные заграждения' },
    { from: 180, to: 240, pool: ['wolf','golem','ghost','minelayer','sniper','gunship','carrier','rammer','repairer'], spawnMult: 1.55, label: 'Налёт рейдеров' },
    { from: 240, to: 300, pool: ['golem','ghost','slime','mage','illusionist','minelayer','carrier','rammer','repairer','commander'], spawnMult: 1.72, label: 'Бронеколонна' },
    { from: 300, to: 420, pool: ['wolf','golem','ghost','slime','mage','bomber','illusionist','sniper','gunship','rammer','repairer','commander'], spawnMult: 1.82, label: 'После падения «Жнеца»' },
    { from: 420, to: 600, pool: ['golem','slime','mage','ghost','carrier','gunship','minelayer','rammer','sniper','repairer','commander'], spawnMult: 1.95, label: 'Красная тревога' },
    { from: 600, to: Infinity, pool: ['golem','slime','mage','ghost','wolf','skeleton','bomber','illusionist','rammer','sniper','gunship','minelayer','carrier','repairer','commander'], spawnMult: 2.2, label: 'Последний рубеж' }
];

// ---------------------------------------------------------------------------
// Achievements: condition evaluated at end-of-run + continuously in-game.
// `check(ctx)` returns true when unlocked. `ctx` = { game, run }
// ---------------------------------------------------------------------------
export const ACHIEVEMENTS = [
    {
        id: 'first_blood',
        name: "Первая кровь",
        icon: '🗡️',
        description: "Одолейте первого врага.",
        check: (c) => c.game.kills >= 1
    },
    {
        id: 'slayer_100',
        name: "Сотня",
        icon: '🎯',
        description: "Убейте 100 врагов за один забег.",
        check: (c) => c.game.kills >= 100
    },
    {
        id: 'slayer_1000',
        name: "Сокрушитель легиона",
        icon: '🏆',
        description: "Убейте 1000 врагов за один забег.",
        check: (c) => c.game.kills >= 1000
    },
    {
        id: 'boss_slayer',
        name: "Победа над крейсером «Жнец»",
        icon: '☠️',
        description: "Одолейте крейсер «Жнец».",
        check: (c) => !!c.run.bossesDefeated?.reaper
    },
    {
        id: 'void_breaker',
        name: "Покоритель Пустоты",
        icon: '🌌',
        description: "Одолейте дредноут Пустоты.",
        check: (c) => !!c.run.bossesDefeated?.void_lord
    },
    {
        id: 'survive_5min',
        name: "Пять минут",
        icon: '⏱️',
        description: "Продержитесь пять минут.",
        check: (c) => c.game.gameTime >= 300
    },
    {
        id: 'survive_10min',
        name: "Десять минут",
        icon: '🔥',
        description: "Продержитесь десять минут.",
        check: (c) => c.game.gameTime >= 600
    },
    {
        id: 'survive_15min',
        name: "Четверть часа",
        icon: '⌛',
        description: "Продержитесь пятнадцать минут.",
        check: (c) => c.game.gameTime >= 900
    },
    {
        id: 'weapon_max',
        name: "Мастерство",
        icon: '🌟',
        description: "Улучшите любое оружие до максимального уровня.",
        check: (c) => !!c.run.maxedWeapon
    },
    {
        id: 'untouchable',
        name: "Неуязвимый",
        icon: '🛡️',
        description: "Продержитесь 60 секунд без урона.",
        check: (c) => (c.run.longestUnhit || 0) >= 60
    },
    {
        id: 'xp_hoarder',
        name: "Коллекционер опыта",
        icon: '💎',
        description: "Соберите 100 сфер опыта за один забег.",
        check: (c) => (c.run.orbsCollected || 0) >= 100
    },
    {
        id: 'level_20',
        name: "Двадцатый уровень",
        icon: '📈',
        description: "Достигните двадцатого уровня.",
        check: (c) => c.game.player?.level >= 20
    },
    // --- v2.4 additions ---------------------------------------------------
    {
        id: 'speed_demon',
        name: "Демон скорости",
        icon: '💨',
        description: "Победите дредноут Пустоты менее чем за пять минут реального времени.",
        check: (c) =>
            !!c.run.bossesDefeated?.void_lord && (c.run.realSecondsToVoidLord || Infinity) < 300
    },
    {
        id: 'no_hit_boss',
        name: "Безупречный поединок",
        icon: '🕊️',
        description: "Победите босса, не получив урона в бою.",
        check: (c) => !!c.run.noHitBoss
    },
    {
        id: 'max_all',
        name: "Полное усиление",
        icon: '👑',
        description: "Улучшите до предела оружие во всех шести ячейках за один забег.",
        check: (c) => (c.run.maxedWeaponCount || 0) >= 6
    },
    {
        id: 'early_evolve',
        name: "Раннее развитие",
        icon: '🔮',
        description: "Развейте оружие до седьмой минуты.",
        check: (c) => !!c.run.evolvedBefore?.sevenMin
    },
    {
        id: 'triple_build',
        name: "Три сборки",
        icon: '🎲',
        description: "Завершите три забега с разными наборами оружия.",
        check: (c) => (c.game.save?.totals?.uniqueBuilds || 0) >= 3
    },
    {
        id: 'zen_5min',
        name: "Путь аскета",
        icon: '🧘',
        description: "Продержитесь пять минут без пассивных улучшений.",
        check: (c) => c.game.gameTime >= 300 && (c.run.passivesPicked || 0) === 0
    },
    // --- iter-20: hidden / easter-egg achievements ------------------------
    // These three are intentionally undocumented in the gallery's tooltip
    // copy until they're earned (the UI reveals them once unlocked). Their
    // `hidden: true` flag is read by ui.js to gate the description preview.
    {
        id: 'konami_code',
        name: "Код Konami",
        icon: '🎮',
        description: "Найдите легендарную комбинацию клавиш и откройте ретробластер.",
        hidden: true,
        check: (c) => !!c.run.konamiCode
    },
    {
        id: 'speedrun_plus',
        name: "Мастер скоростного прохождения",
        icon: '⚡',
        description:
            "Одолейте сильного босса за пять минут реального времени и откройте след за героем.",
        hidden: true,
        // The tracker sets `run.fastBossClear` whenever any boss falls in
        // under 300 wall-clock seconds. Reaper on the Crypt stage (4:00
        // spawn) is the only viable path; on Forest it's intentionally
        // unreachable without pause-abuse, which the speedrun anchor
        // already filters out.
        check: (c) => !!c.run.fastBossClear
    },
    {
        id: 'pacifist_provoked',
        name: "Спровоцированный пацифист",
        icon: '🕊️',
        description:
            "Продержитесь 60 секунд, никого не убив, и откройте особое звание босса.",
        hidden: true,
        check: (c) => (c.run.pacifistTimer || 0) >= 60 && c.game.kills === 0
    }
];

// ---------------------------------------------------------------------------
// Unlocks: achievement id → weapon id granted as starter-weapon option.
// ---------------------------------------------------------------------------
export const UNLOCKS = {
    first_blood: { weapon: 'magic_wand' },
    slayer_100: { weapon: 'knife' },
    survive_5min: { weapon: 'orbit' },
    boss_slayer: { weapon: 'lightning' },
    survive_10min: { weapon: 'mine' },
    // v2.4 unlocks
    survive_15min: { weapon: 'boomerang' },
    void_breaker: { weapon: 'frost_nova' },
    speed_demon: { weapon: 'soul_drain' },
    // iter-20: easter-egg unlocks. Konami grants a starter weapon, the
    // other two unlock cosmetic flags consumed by the renderer / UI but
    // are still surfaced as standard UNLOCKS entries so the achievement
    // gallery can show their reward chip consistently.
    konami_code: { weapon: 'retro_blaster' },
    speedrun_plus: { cosmetic: 'sprite_trail' },
    pacifist_provoked: { cosmetic: 'boss_title_pacifist' }
};
