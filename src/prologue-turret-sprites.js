/**
 * Compact sprite animation for Mission 00's station defense turrets.
 * The shared FriendlyBases simulation still owns targeting, projectiles,
 * cooldowns, durability and damage; this module draws only their appearance.
 */
const TAU = Math.PI * 2;
const CELL = 160;
const DEPLOY_DURATION = .48;
// Barrel-mouth positions inside the 16 artist-authored atlas cells. This avoids
// the wrong-looking flashes caused by assuming a perspective sprite is a flat
// top-down gun that can simply be rotated with cos/sin.
const MUZZLES = [
    [80,51],[132,45],[132,46],[133,49],
    [143,52],[139,49],[20,44],[21,42],
    [80,32],[46,49],[39,51],[31,52],
    [7,51],[31,51],[31,50],[29,53]
];
const cache = { deploy: null, yaw: null };
const url = {
    deploy: new URL('../assets/prologue/turret-deploy.webp', import.meta.url).href,
    yaw: new URL('../assets/prologue/turret-yaw.webp', import.meta.url).href
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function sheet(kind) {
    if (!cache[kind] && typeof Image !== 'undefined') {
        const image = new Image();
        image.decoding = 'async';
        image.onload=()=>image.decode?.().catch(()=>{});
        image.src = url[kind];
        cache[kind] = image;
    }
    const image = cache[kind];
    return image?.complete && image.naturalWidth > 0 ? image : null;
}

/** Zero degrees faces the camera; 90 degrees aims to the right on screen. */
export function turretYawIndex(aim) {
    if (!Number.isFinite(aim)) return 0;
    const heading = ((Math.PI / 2 - aim) % TAU + TAU) % TAU;
    return Math.round(heading * 16 / TAU) % 16;
}

/** Returns -1 once the turret is fully ready for rotational sprites. */
export function turretDeploymentFrame(elapsed) {
    if (!Number.isFinite(elapsed)) return -1;
    if (elapsed >= DEPLOY_DURATION) return -1;
    return clamp(Math.floor(Math.max(0, elapsed) / DEPLOY_DURATION * 9), 0, 8);
}

/** Lightweight light trail from the machinery to the plasma emitter. */
function drawEnergy(ctx, turret, x, y, frame, size, time, flash, nextFrame=frame, mix=0) {
    if (turret.overheat > 0 || turret.disabled || (turret.integrity ?? 100) <= 0) return;
    const cooldown = Math.max(0, turret.cooldown || 0);
    const charging = !!turret.tracked && cooldown < .34 && cooldown > .001;
    const progress = flash > 0 ? 1 : charging ? 1 - cooldown / .34 : 0;
    const ambient = .18 + .12 * (1 + Math.sin(time * 3.4 + (turret.mount || 0))) / 2;
    const scale = size / CELL;
    const m0 = MUZZLES[frame], m1 = MUZZLES[nextFrame];
    const mxLocal = m0[0] * (1 - mix) + m1[0] * mix;
    const myLocal = m0[1] * (1 - mix) + m1[1] * mix;
    const bx = x - size / 2 + 80 * scale;
    const by = y - size * .61 + 88 * scale;
    const mx = x - size / 2 + mxLocal * scale;
    const my = y - size * .61 + myLocal * scale;
    const dx = mx - bx, dy = my - by;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
        const u = clamp(progress - i * .085, 0, 1);
        if (u <= 0 && i > 0) continue;
        const fraction = progress > 0 ? u : .05 + i * .065;
        const px = bx + dx * fraction;
        const py = by + dy * fraction;
        const radius = progress > 0 ? 1.8 + i * .45 : 1.5;
        ctx.shadowColor = '#33eaff';
        ctx.shadowBlur=ctx.__lowFx?0:(progress > 0 ? 8 : 3);
        ctx.fillStyle = `rgba(85,240,255,${progress > 0 ? .95 - i * .14 : ambient})`;
        ctx.beginPath();ctx.arc(px, py, radius, 0, TAU);ctx.fill();
    }
    ctx.restore();
    if (flash <= 0) return;
    const intensity = clamp(flash / .19, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mx, my, 1, mx, my, 17 + 12 * intensity);
    g.addColorStop(0, `rgba(244,255,255,${intensity})`);
    g.addColorStop(.24, `rgba(80,245,255,${intensity * .88})`);
    g.addColorStop(1, 'rgba(15,148,255,0)');
    const r = 17 + 12 * intensity;
    ctx.fillStyle = g;ctx.fillRect(mx-r,my-r,r*2,r*2);
    ctx.strokeStyle = `rgba(173,255,255,${intensity})`;
    ctx.lineWidth = 2 + 4 * intensity;ctx.lineCap = 'round';
    ctx.beginPath();ctx.moveTo(mx,my);
    const distance = Math.hypot(dx,dy)||1;
    ctx.lineTo(mx+dx/distance*(13+17*intensity),
        my+dy/distance*(13+17*intensity));ctx.stroke();
    ctx.restore();
}

/**
 * @returns {boolean} false while the asynchronous atlas is not yet loaded.
 */
export function drawPrologueTurretSprite(ctx, turret, x, y, options = {}) {
    const { time = 0, activatedAt = -Infinity, powered = false,
        aim = 0, flash = 0, heavy = false, recoil = 0 } = options;
    const elapsed = powered && Number.isFinite(activatedAt) ? time - activatedAt : Infinity;
    // Request both sheets at first sight. The transition must never flash
    // the old fallback model while the yaw atlas is still downloading.
    const deploy = sheet('deploy'), yaw = sheet('yaw');
    // Keep the final deployed frame until yaw art is ready. Returning false
    // here used to flash the obsolete fallback model in the middle of motion.
    const opening = !powered || elapsed < DEPLOY_DURATION || !yaw;
    if (!(opening ? deploy : yaw)) return false;
    const size = heavy ? 109 : 97;
    const shiftX = opening ? 0 : Math.cos(aim) * recoil * .22;
    const shiftY = opening ? -10*(1-clamp(elapsed/DEPLOY_DURATION,0,1)) : Math.sin(aim) * recoil * .22;
    const turn = ((Math.PI / 2 - (Number.isFinite(aim) ? aim : 0)) % TAU + TAU) % TAU * 16 / TAU;
    const yawFrame = Math.round(turn) % 16;
    const paint = (image, frame, columns) => {
        if (!image) return;
        ctx.drawImage(image, (frame % columns) * CELL,
            Math.floor(frame / columns) * CELL, CELL, CELL,
            x - size / 2 - shiftX, y - size * .61 - shiftY, size, size);
    };
    ctx.save();
    ctx.globalAlpha *= powered ? 1 : .87;
    if (opening) {
        // Mechanical poses replace one another cleanly. The former
        // interpolation superimposed two barrels and a doubled chassis.
        const fraction = powered ? clamp(Math.max(0, elapsed) / DEPLOY_DURATION * 8, 0, 8) : 0;
        const frame = Math.round(fraction);
        paint(deploy, frame, 5);
    } else {
        // Sixteen authored headings at 22.5-degree intervals. Blending
        // unrelated 3D silhouettes made the moving barrel look transparent.
        paint(yaw, yawFrame, 4);
    }
    ctx.restore();
    if (powered && !opening) {
        drawEnergy(ctx, turret, x - shiftX, y - shiftY, yawFrame,
            size, time, flash, yawFrame, 0);
        // A brief electrical flare masks the art hand-off without double
        // exposure; the gun silhouette remains solid throughout.
        const age=elapsed-DEPLOY_DURATION;
        if(age>=0&&age<.16){
            const intensity=(1-age/.16)*.3;
            ctx.save();ctx.globalAlpha*=intensity;
            const bloom=ctx.createRadialGradient(x,y,5,x,y,size*.8);
            bloom.addColorStop(0,'#c5ffff');
            bloom.addColorStop(.6,'#52e6ff66');
            bloom.addColorStop(1,'#52e6ff00');
            ctx.fillStyle=bloom;ctx.beginPath();ctx.arc(x,y,size*.8,0,TAU);ctx.fill();
            ctx.restore();
        }
    }
    return true;
}

export const PROLOGUE_TURRET_DEPLOY_SECONDS = DEPLOY_DURATION;

