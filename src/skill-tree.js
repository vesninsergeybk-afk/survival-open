/**
 * Survivor 8.7 — deterministic per-run skill paths.
 * One level grants one choice. Rare field finds remain random.
 * This catalogue is data-only and does not own level-up mutations.
 */
import { WEAPONS, PASSIVES } from './data.js?v=tactics-106';
import { buildPrologueSkills } from './prologue-design.js?v=design-127';
import { CONFIG } from './config.js?v=base-87';
import { getWeaponMasteries, getWeaponMastery, masteryCertificateFor } from './weapon-masteries.js?v=mastery-1';

export const SKILL_BRANCHES = Object.freeze([
    {
        id: 'weapons', icon: '⚔️', title: 'Вооружение',
        description: 'Новые орудия, меткость и мощь залпа.',
        tiers: [
            [['weapon','starter_pulse'],['weapon','whip'],['weapon','knife'],['passive','might'],['passive','area']],
            [['weapon','magic_wand'],['passive','cooldown'],['passive','luck'],['weapon','boomerang']],
            [['weapon','railgun'],['weapon','lightning'],
                ['weapon','frost_nova'],['weapon','garlic']]
        ]
    },
    {
        id: 'ship', icon: '🛡️', title: 'Корабль',
        description: 'Скорость, прочность, щиты и живучесть.',
        tiers: [
            [['passive','max_hp'],['passive','armor'],['passive','movespeed'],['passive','shield_core']],
            [['passive','recovery'],['passive','dodge'],['passive','damage_reduction']]
        ]
    },
    {
        id: 'tech', icon: '🔬', title: 'Технологии',
        description: 'Добыча ресурсов, разведка и автономные системы.',
        tiers: [
            [['passive','magnet'],['passive','growth'],['passive','salvage'],['passive','emp_pulse'],
                ['ability','field_repair']],
            [['passive','targeting'],['passive','magnet_plus'],['passive','signal_decoder'],
                ['weapon','orbit'],['weapon','mine'],['ability','station_stasis']],
            [['weapon','drone_swarm'],['weapon','retro_blaster'],['weapon','soul_drain']]
        ]
    }
]);

/** Two field abilities can be bought with ordinary level-up points.
 * The station stasis node gains three ranks, with distinct gameplay effects. */
export const FIELD_ABILITIES = Object.freeze({
    field_repair:{id:'field_repair',icon:'💚',name:'Ремонтный луч',
        description:'Пробел / экранная кнопка: зелёным лучом восстановить турель или станцию за 10 деталей.',
        maxRank:1},
    station_stasis:{id:'station_stasis',icon:'🛡️',name:'Стазис станции',
        description:'Q / экранная кнопка: I — щит и остановка турелей; II — турели продолжают огонь; III — электрические разряды.',
        maxRank:3}
});
/** Direct visual links are also actual prerequisites: no fake tree arrows. */
export const SKILL_PARENTS = Object.freeze({
    'weapon:magic_wand':['weapon:starter_pulse'],
    'passive:cooldown':['passive:might'],
    'passive:luck':['passive:area'],
    'weapon:boomerang':['weapon:whip'],
    'weapon:railgun':['weapon:magic_wand'],
    'weapon:lightning':['weapon:magic_wand'],
    'weapon:frost_nova':['passive:cooldown'],
    'weapon:garlic':['weapon:boomerang'],
    'passive:recovery':['passive:max_hp'],
    'passive:dodge':['passive:movespeed'],
    'passive:damage_reduction':['passive:armor'],
    'passive:targeting':['passive:magnet'],
    'passive:magnet_plus':['passive:magnet'],
    'passive:signal_decoder':['passive:targeting'],
    'weapon:orbit':['passive:emp_pulse'],
    'weapon:mine':['passive:salvage'],
    'ability:station_stasis':['ability:field_repair'],
    'weapon:drone_swarm':['weapon:orbit'],
    'weapon:retro_blaster':['passive:targeting'],
    'weapon:soul_drain':['weapon:mine']
});

const SPECIALISTS = Object.freeze({
    knife:'arsenal', mine:'arsenal', boomerang:'arsenal', railgun:'arsenal',
    orbit:'carrier', drone_swarm:'carrier', lightning:'lab', frost_nova:'lab',
    retro_blaster:'lab', soul_drain:'dock'
});
const SPECIAL_NAMES = Object.freeze({
    arsenal:'арсенал', carrier:'авианосец', lab:'лабораторию', dock:'ремонтный док'
});
const byId = (all, id) => Object.values(all).find(def => def.id === id);
function getRank(player,kind,id){
    if(kind==='ability')return player.fieldSkills?.[id]||0;
    if(kind==='weapon')return player.weapons.find(w=>w.id===id)?.level||0;
    return player.passives[id]?.count||0;
}
function hasPrerequisite(player,token){
    const [kind,id]=token.split(':');
    return getRank(player,kind,id)>0;
}

export function buildSkillTree(player, network, missionRules = null) {
    if(missionRules?.index===0)return buildPrologueSkills(player);
    const networkCap = network?.getUpgradeCap?.() ?? CONFIG.WEAPON_MAX_LEVEL;
    const cap = Math.min(networkCap,missionRules?.rankCap ?? CONFIG.WEAPON_MAX_LEVEL);
    const branches = SKILL_BRANCHES.map(branch => {
        const points = branch.tiers.flat().reduce((total, [kind,id]) => {
            const rank=getRank(player,kind,id);
            // Starter pulse is a starting item, not a spent skill point.
            return total + Math.max(0, rank - (id === 'starter_pulse' ? 1 : 0));
        }, 0);
        const tiers = branch.tiers.map((list, tier) => {
            const needed = tier === 0 ? 0 : tier === 1 ? 1 : 3;
            return list.flatMap(([kind,id]) => {
                const def = byId(kind === 'weapon' ? WEAPONS :
                    kind === 'ability' ? FIELD_ABILITIES : PASSIVES, id);
                if (!def) throw new Error('Unknown skill node: ' + id);
                const owned = kind === 'weapon' ?
                    player.weapons.find(w=>w.id===id) :
                    kind === 'ability' ? null : player.passives[id];
                const rank=getRank(player,kind,id);
                const maximum = kind === 'weapon' ? CONFIG.WEAPON_MAX_LEVEL :
                    kind === 'ability' ? def.maxRank :
                    id === 'signal_decoder' ? 1 : CONFIG.PASSIVE_MAX_STACK;
                const parents=SKILL_PARENTS[kind+':'+id] || [];
                // Rank IV is a real fork: exactly one level-up point buys
                // one of the paths. The alternate route then becomes locked.
                const forks = kind === 'weapon' && rank === 3 &&
                    !owned?.specialization ? getWeaponMasteries(id) : [null];
                return forks.map(fork => {
                    let reason = '';
                    if (rank >= maximum) reason = 'Изучено полностью';
                    else if (points < needed) reason = 'Сначала вложите ' + needed +
                        ' очк. в ветвь «' + branch.title + '»';
                    else if(parents.length&&!parents.some(p=>hasPrerequisite(player,p)))
                        reason='Сначала откройте связанный родительский навык';
                    else if(kind==='ability'&&id==='station_stasis'&&
                        rank >= (network?.technologyTier||0))
                        reason='Подключите следующую станцию к энергетической сети';
                    else if (rank >= cap) reason = cap < networkCap
                        ? 'Предел этой миссии: ранг ' + cap
                        : 'Нужна ещё одна активная станция · предел ' + cap;
                    else if (kind === 'weapon' && missionRules?.allowedWeapons &&
                        !missionRules.allowedWeapons.has(id))
                        reason = 'Чертёж ещё не открыт в кампании';
                    else if (fork && missionRules?.allowedMasteries &&
                        !missionRules.allowedMasteries.has(id)) {
                        const certificate=masteryCertificateFor(id);
                        reason=certificate ? 'Специализация: награда за миссию '+certificate.mission :
                            'Нужен допуск кампании';
                    } else if (!owned && kind === 'weapon' &&
                        player.level < (id === 'knife' ? 3 : (def.minPlayerLevel || 1)))
                        reason = 'Открывается на уровне ' + (id === 'knife' ? 3 : def.minPlayerLevel);
                    else if (!owned && kind === 'weapon' &&
                        player.weapons.length >= CONFIG.MAX_WEAPONS)
                        reason = 'Все места для оружия заняты';
                    else if (!owned && kind === 'passive' &&
                        Object.keys(player.passives).length >= CONFIG.MAX_PASSIVES)
                        reason = 'Все места для модулей заняты';
                    else if (!owned && kind === 'weapon' && network?.enabled &&
                        network.technologyTier < 3 &&
                        SPECIALISTS[id] && !network.hasActivatedType(SPECIALISTS[id]))
                        reason = 'Найдите и запустите ' + SPECIAL_NAMES[SPECIALISTS[id]];
                    const selectedPath=getWeaponMastery(id,owned?.specialization);
                    const shown = fork ? {
                        ...def, name:def.name+' · «'+fork.name+'»',
                        description:fork.description
                    } : selectedPath ? {
                        ...def,name:def.name+' · «'+selectedPath.name+'»',
                        description:selectedPath.description
                    } : def;
                    return {
                        id, kind, def:shown, tier, rank, maximum, parents, fork:!!fork,
                        specialization:fork?.id || owned?.specialization || null,
                        futurePaths:kind==='weapon' && rank<3 ?
                            getWeaponMasteries(id).map(p=>p.name) : null,
                        state: rank >= maximum ? 'maxed' : reason ? 'locked' : 'available',
                        reason, nextRank: Math.min(maximum, rank + 1),
                        branchId: branch.id
                    };
                });
            });
        });
        return {...branch, points, tiers};
    });
    return { branches, cap, available: branches.flatMap(b => b.tiers.flat())
        .filter(n => n.state === 'available') };
}

export function skillChoice(player, network, kind, id, specialization = null, missionRules = null) {
    const node = buildSkillTree(player, network, missionRules).available.find(n =>
        n.kind === kind && n.id === id &&
        (specialization === null || n.specialization === specialization));
    // A fork must be explicit; never silently choose a preferred path.
    if (!node || (kind === 'weapon' &&
        player.weapons.find(w=>w.id===id)?.level === 3 &&
        getWeaponMasteries(id).length && !specialization)) return null;
    return {type:kind,data:node.def,specialization:node.specialization};
}

