/** Read-only descriptions of the real upgrade; never mutate the loadout. */
export function skillChange(node, player) {
    const before = node.rank;
    const after = node.nextRank;
    const changes = [{label: 'Ранг', before: String(before), after: String(after)}];
    const owned = node.kind === 'weapon' && player.weapons.find(w => w.id === node.id);
    if (!owned || node.state === 'maxed' || typeof owned.getDamage !== 'function' ||
        typeof player.getDamageMult !== 'function') return changes;
    const next = Object.assign(Object.create(Object.getPrototypeOf(owned)), owned,
        {level: after, specialization: node.specialization});
    const number = (value, digits) => Number(value.toFixed(digits)).toLocaleString('ru-RU');
    for (const [method, label, unit, digits] of [
        ['getDamage', 'Урон', '', 1],
        ['getCooldown', 'Интервал атак', ' с', 2],
        ['getRange', 'Дальность', '', 0]
    ]) {
        changes.push({label, before: number(owned[method](player), digits) + unit,
            after: number(next[method](player), digits) + unit});
    }
    return changes;
}

export function skillKey(node) {
    return node.kind + ':' + node.id + ':' + (node.specialization || '');
}
