/**
 * Pick-up supply crates. Reusable world interactions live separately from
 * decorative terrain. Objects reset each run and never consume combat RNG.
 */
import { atlas } from './asset-art.js?v=space-1';
import { CONFIG } from './config.js?v=cc0-6';

const NEARBY = Object.freeze([
    [160, 30], [-270, -195], [-510, 230],
    [460, -325], [740, 370], [-715, -340]
]);

/** Deterministic supplies across the full map; no combat RNG is consumed. */
export function createWorldCaches(stage, expedition = false) {
    const cx = CONFIG.ARENA_WIDTH / 2, cy = CONFIG.ARENA_HEIGHT / 2;
    const points = NEARBY.map(([x, y]) => [cx + x, cy + y]);
    for (let gy = 1; gy <= 5; gy++) {
        for (let gx = 1; gx <= 9; gx++) {
            const phase = gx * 49 + gy * 101;
            const x = gx * 2400 + Math.sin(phase) * 220;
            const y = gy * 2500 + Math.cos(phase * .7) * 220;
            if (Math.hypot(x - cx, y - cy) > 950) points.push([x, y]);
        }
    }
    return points.map(([x, y], index) => ({
        id: stage + ':supplies:' + index, x, y, opened: false,
        kind: expedition && index >= NEARBY.length &&
            (index - NEARBY.length) % 6 === 3 ? 'signal' : 'supplies',
        discovered: false
    }));
}

export function updateWorldCaches(game) {
    const hero = game.player;
    if (!hero || !Array.isArray(game.worldCaches)) return;
    for (const item of game.worldCaches) {
        if (item.opened) continue;
        const dx = hero.x - item.x;
        const dy = hero.y - item.y;
        const dist2 = dx * dx + dy * dy;
        if (item.kind === 'signal' && !item.discovered && dist2 <= 720 * 720) {
            item.discovered = true;
            game.createFloatingText?.('📡 СИГНАЛ РЕЛИКВИИ', hero.x, hero.y - 72, '#ffe4a3');
            game._announce?.('Обнаружена исследовательская капсула. Найдите её на карте и заберите данные.');
        }
        if (dist2 > 42 * 42) continue;
        // Mark before rewarding: even simultaneous updates cannot duplicate loot.
        item.opened = true;
        if (item.kind === 'signal') {
            game.player.gainExp(24);
            game.friendlyBases?.addCredits(22, game, item.x, item.y);
            if (game.run) game.run.signalsRecovered =
                (game.run.signalsRecovered || 0) + 1;
            game.createParticles(item.x, item.y, '#ffe2a0', 14);
            game.createFloatingText('ДАННЫЕ · +24 ОПЫТА · +22 ⚙',
                item.x, item.y - 36, '#ffe6ae');
            game._announce?.('Данные капсулы восстановлены: +24 опыта и +22 кредита.');
        } else {
            game.dropExp(item.x, item.y, 5);
            game.friendlyBases?.addCredits(8, game, item.x, item.y);
            game.createParticles(item.x, item.y, '#dfbb72', 8);
            game.createFloatingText('Припасы · +5 опыта · +8 ⚙',
                item.x, item.y - 28, '#b5f3c7');
        }
    }
}

export function renderWorldCaches(ctx, caches, time = 0, player = null) {
    if (!Array.isArray(caches)) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (const item of caches) {
        if (item.opened) continue;
        if (player && (Math.abs(item.x - player.x) > 1100 || Math.abs(item.y - player.y) > 900)) continue;
        const glow = .13 + .06 * Math.sin(time * 2 + item.x * .01);
        ctx.fillStyle = 'rgba(251,209,125,' + glow + ')';
        ctx.beginPath();
        ctx.ellipse(item.x, item.y + 11, 26, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(item.x,item.y);
        ctx.strokeStyle=item.kind==='signal'?'#ffe6a8':'#99efff';ctx.lineWidth=2;
        ctx.fillStyle=item.kind==='signal'?'#57402d':'#1b3d58';
        ctx.beginPath();ctx.moveTo(0,-23);ctx.lineTo(17,-9);ctx.lineTo(17,12);
        ctx.lineTo(0,22);ctx.lineTo(-17,12);ctx.lineTo(-17,-9);ctx.closePath();
        ctx.fill();ctx.stroke();
        ctx.fillStyle=item.kind==='signal'?'#ffd26b':'#6ee9ff';ctx.fillRect(-8,-7,16,9);
        ctx.strokeStyle='rgba(189,249,255,.5)';ctx.beginPath();
        ctx.moveTo(-13,6);ctx.lineTo(13,6);ctx.stroke();
        if (item.kind === 'signal') {
            ctx.strokeStyle='#ffdf8799';ctx.lineWidth=1.3;
            ctx.beginPath();ctx.arc(0,0,33,0,Math.PI*2);ctx.stroke();
            ctx.fillStyle='#ffe7aa';ctx.font='bold 12px system-ui';
            ctx.textAlign='center';ctx.fillText('ДАННЫЕ',0,-37);
        }
        ctx.restore();
    }
    ctx.restore();
}
