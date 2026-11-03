/**
 * Three station development paths. Credits are local to a sortie. One free
 * first choice keeps a 6–8 minute mission meaningful; later ranks require
 * both credits and additional reactors. Upgrades are not persistent buffs.
 */
export const BASE_PATHS = Object.freeze([
    Object.freeze({id:'defense',icon:'🛡️',name:'Оборона',
        summary:'Укрепляет станцию и расширяет дальность её турелей.',
        rankEffects:Object.freeze(['Корпус станции +45, корабля +8, дальность турелей +12',
            'Корпус станции +65, корабля +12, дальность +12',
            'Корпус станции +90, корабля +16, дальность +12'])}),
    Object.freeze({id:'research',icon:'🔬',name:'Исследования',
        summary:'Сразу даёт опыт пилоту, ускоряя выбор боевых навыков.',
        rankEffects:Object.freeze(['+18 опыта','+25 опыта','+34 опыта'])}),
    Object.freeze({id:'logistics',icon:'🧭',name:'Логистика',
        summary:'Улучшает маршевую скорость и открывает следующий маршрут.',
        rankEffects:Object.freeze(['Скорость +2,5%, +6 кредитов и разведка',
            'Скорость +2,5%, +8 кредитов и разведка',
            'Скорость +2,5%, +10 кредитов и разведка'])})
]);

export function baseDevelopmentCap(weaponCap) {
    return weaponCap >= 5 ? 3 : weaponCap >= 4 ? 2 : 1;
}

export function baseDevelopmentPrice(level,freeChoiceAvailable) {
    if(level===0 && freeChoiceAvailable)return 0;
    return [26,40,68][level] ?? Infinity;
}

export function baseDevelopmentOptions(base,network) {
    const cap=baseDevelopmentCap(network.getUpgradeCap());
    return BASE_PATHS.map(path=>{
        const rank=base.development?.[path.id] || 0;
        const price=baseDevelopmentPrice(rank,!network.freeDevelopmentUsed);
        let reason='';
        if(rank>=3)reason='Развитие завершено';
        else if(rank>=cap)reason='Для следующего уровня нужен новый реактор и допуск миссии';
        else if(network.credits<price)reason='Нужно '+price+' кредитов';
        return {...path,rank,cap,price,reason,
            state:rank>=3?'maxed':reason?'locked':'available',
            nextEffect:path.rankEffects[rank] || ''};
    });
}
