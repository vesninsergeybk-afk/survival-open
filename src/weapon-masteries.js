/**
 * Weapon mastery paths and campaign certificates.
 * Each rank-IV choice consumes ONE normal level-up and persists to rank V.
 * Campaign certificates unlock choices, not free weapon levels or damage.
 */
export const WEAPON_MASTERIES = Object.freeze({
    starter_pulse: [
        {id:'focus',name:'Прожиг',description:'Усиленный дальний импульс для точного боя.',effects:{damageMult:1.28,rangeMult:1.16}},
        {id:'volley',name:'Очередь',description:'Дополнительный заряд в залпе, но каждый слабее.',effects:{extraProjectiles:1,damageMult:.78,cooldownMult:1.07}}
    ],
    whip: [
        {id:'halo',name:'Кольцо',description:'Плазма защищает корабль по кругу, но урон ниже.',effects:{fullCircle:true,damageMult:.76,rangeMult:1.08}},
        {id:'lance',name:'Клинок',description:'Прицельная мощная дуга для ближнего боя.',effects:{damageMult:1.30,rangeMult:1.13,cooldownMult:1.12,fullCircle:false}}
    ],
    magic_wand: [
        {id:'seeker',name:'Захват',description:'Быстрые наводящиеся заряды против опасных целей.',effects:{damageMult:1.19,projectileSpeedMult:1.18,cooldownMult:1.10}},
        {id:'prism',name:'Призма',description:'Дополнительный ионный заряд в широком залпе.',effects:{extraProjectiles:1,damageMult:.77,spreadDegrees:19}}
    ],
    knife: [
        {id:'hunter',name:'Охотник',description:'Две самонаводящиеся ракеты против сильных целей.',effects:{homing:true,damageMult:1.18,cooldownMult:1.10}},
        {id:'barrage',name:'Шквал',description:'Три облегчённые ракеты с небольшими взрывами.',effects:{extraProjectiles:1,explodeRadius:42,damageMult:.72,cooldownMult:1.12}}
    ],
    orbit: [
        {id:'guardian',name:'Периметр',description:'Спутники прикрывают увеличенную площадь.',effects:{rangeMult:1.23,damageMult:1.10}},
        {id:'blades',name:'Лезвия',description:'Два дополнительных спутника с меньшим уроном.',effects:{extraShards:2,damageMult:.77,rangeMult:.94}}
    ],
    lightning: [
        {id:'conductor',name:'Проводник',description:'Разряд перекидывается ещё на две цели.',effects:{extraChain:2,damageMult:.84,cooldownMult:.96}},
        {id:'thunder',name:'Гром',description:'Усиленный разряд против защищённых противников.',effects:{damageMult:1.29,cooldownMult:1.16}}
    ],
    mine: [
        {id:'net',name:'Минная сеть',description:'Ещё одна мина при сбросе; каждая слабее.',effects:{extraMines:1,damageMult:.79,rangeMult:.88}},
        {id:'charge',name:'Тяжёлый заряд',description:'Повышенная мощность и радиус гравимин.',effects:{damageMult:1.29,rangeMult:1.18,cooldownMult:1.13}}
    ],
    garlic: [
        {id:'dome',name:'Купол',description:'Широкое защитное поле с меньшим уроном.',effects:{rangeMult:1.29,damageMult:.79,cooldownMult:1.07}},
        {id:'furnace',name:'Плазменный жар',description:'Близкое поле наносит больше урона и чаще срабатывает.',effects:{damageMult:1.27,rangeMult:.88,cooldownMult:.93}}
    ],
    frost_nova: [
        {id:'stasis',name:'Глубокий холод',description:'Более длительное и сильное замедление.',effects:{slowBonus:.13,slowDurationBonus:.7,damageMult:.84}},
        {id:'shatter',name:'Криоудар',description:'Сильный взрыв, но более долгая перезарядка.',effects:{damageMult:1.28,cooldownMult:1.15}}
    ],
    soul_drain: [
        {id:'medic',name:'Полевой ремонт',description:'Больше восстановления корпуса при меньшем уроне.',effects:{lifestealMult:1.7,damageMult:.85}},
        {id:'leech',name:'Сеть лучей',description:'Дополнительная цель, меньше урона и восстановления.',effects:{extraTargets:1,damageMult:.81,lifestealMult:.77}}
    ],
    boomerang: [
        {id:'twins',name:'Двойная дуга',description:'Дополнительная возвратная торпеда в каждом залпе.',effects:{extraProjectiles:1,damageMult:.82}},
        {id:'razor',name:'Резак',description:'Более мощная дальняя торпеда, но медленнее.',effects:{damageMult:1.29,rangeMult:1.18,cooldownMult:1.13}}
    ],
    railgun: [
        {id:'breach',name:'Бронебой',description:'Мощный дальний луч против тяжёлых целей.',effects:{damageMult:1.34,rangeMult:1.10,cooldownMult:1.20,singleBeam:true}},
        {id:'crossfire',name:'Перекрёстный огонь',description:'Дополнительный луч с меньшим уроном каждого.',effects:{extraBeams:1,damageMult:.70,cooldownMult:1.12}}
    ],
    drone_swarm: [
        {id:'wing',name:'Дополнительное звено',description:'Ещё один боевой дрон, но слабее вооружение каждого.',effects:{extraDrones:1,damageMult:.82}},
        {id:'interceptor',name:'Перехватчики',description:'Усиленная дальняя стрельба меньшим отрядом.',effects:{damageMult:1.25,rangeMult:1.18,cooldownMult:1.14}}
    ],
    retro_blaster: [
        {id:'storm',name:'Квантовый рой',description:'Ещё два луча с меньшим уроном каждого.',effects:{extraProjectiles:2,damageMult:.66,cooldownMult:1.13}},
        {id:'singularity',name:'Сингулярность',description:'Мощный дальний луч, но с паузой между залпами.',effects:{damageMult:1.31,rangeMult:1.19,cooldownMult:1.20}}
    ]
});

export const MASTERY_CERTIFICATES = Object.freeze([
    {mission:1,id:'first-signal',title:'Первый сигнал',
        weapons:['starter_pulse','whip','magic_wand']},
    {mission:2,id:'arsenal-key',title:'Ключ арсенала',
        weapons:['knife','mine','boomerang']},
    {mission:3,id:'network-key',title:'Восстановленная сеть',
        weapons:['orbit','drone_swarm']},
    {mission:4,id:'energy-key',title:'Управление энергией',
        weapons:['lightning','frost_nova','garlic']},
    {mission:5,id:'heavy-key',title:'Тяжёлая техника',
        weapons:['railgun','soul_drain']},
    {mission:6,id:'quantum-key',title:'Квантовый допуск',
        weapons:['retro_blaster']}
].map(c=>Object.freeze({...c,weapons:Object.freeze(c.weapons)})));

export function getWeaponMasteries(weaponId) {
    return WEAPON_MASTERIES[weaponId] || [];
}

export function getWeaponMastery(weaponId,pathId) {
    return getWeaponMasteries(weaponId).find(path=>path.id===pathId) || null;
}

export function masteryCertificateFor(weaponId) {
    return MASTERY_CERTIFICATES.find(c=>c.weapons.includes(weaponId)) || null;
}

export function masteryWeaponsForAchievements(achievementIds=[]) {
    const earned=new Set(achievementIds);
    return new Set(MASTERY_CERTIFICATES.filter(c=>earned.has(c.id))
        .flatMap(c=>c.weapons));
}
