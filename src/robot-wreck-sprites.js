/**
 * SPAC-1 destruction and station wrecks: 144 authored frames in eight atlases.
 * Every frame is an exclusive drawImage source cell; never dissolve adjacent
 * silhouettes. Atlas cells have transparent gutters to stop sprite bleeding.
 * All effects use the game clock, not the number of rendered frames.
 */
export const WRECK_ATLAS_CELL = 152;
export const WRECK_DEATH_FRAMES = 16;
export const WRECK_POSE_FRAMES = 5;
export const WRECK_DEATH_SECONDS = .86;
export const WRECK_SHEET_FILES = Object.freeze({
    death_down:'death_down.webp', death_up:'death_up.webp',
    death_left:'death_left.webp', death_right:'death_right.webp',
    guard:'wreck_guard.webp', industrial:'wreck_industrial.webp',
    guard_alt:'wreck_guard_alt.webp', scrap:'wreck_scrap.webp'
});
const ROOT = new URL('../assets/prologue/spac1/wreck-v1/', import.meta.url);
const sheets = new Map();
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function wreckDirection(angle) {
    // World heading: 0 north, PI/2 east, PI south, 3*PI/2 west.
    const quadrant = ((Math.round((Number.isFinite(angle) ? angle : 0) /
        (Math.PI / 2)) % 4) + 4) % 4;
    return ['up', 'right', 'down', 'left'][quadrant];
}

export function wreckDeathFrame(age) {
    const elapsed = Number.isFinite(age) ? Math.max(0, age) : 0;
    return clamp(Math.floor(elapsed * WRECK_DEATH_FRAMES / WRECK_DEATH_SECONDS),
        0, WRECK_DEATH_FRAMES - 1);
}

export function wreckIdleFrame(time, seed = 0) {
    // A brief twitch / voltage surge once every 4–6 seconds. The rest of the
    // time the wreck holds the same frame, without distracting flicker.
    const offset = Math.abs(seed * .619) % 4;
    const interval = 4.1 + Math.abs(Math.sin(seed * 4.13)) * 1.9;
    const local = (((Math.max(0, time) + offset) % interval) + interval) % interval;
    return local < .35 ? Math.min(4, Math.floor(local / .07)) : 0;
}

function requestSheet(key) {
    let sheet = sheets.get(key);
    if (sheet) return sheet;
    sheet = {image:null, ready:false, failed:false};
    sheets.set(key, sheet);
    if (typeof Image === 'undefined') return sheet;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
        const mark = () => {sheet.ready = image.naturalWidth > 0;};
        if (typeof image.decode === 'function') image.decode().then(mark, mark);
        else mark();
    };
    image.onerror = () => {sheet.failed = true;};
    image.src = new URL(WRECK_SHEET_FILES[key], ROOT).href;
    sheet.image = image;
    return sheet;
}

export function warmRobotWrecks() {
    if (typeof Image === 'undefined') return;
    // Each image is decoded exactly once and reused by every wreck on screen.
    for (const key of Object.keys(WRECK_SHEET_FILES)) requestSheet(key);
}

function drawAtlasCell(ctx, img, col, row, size, x, y) {
    const cell = WRECK_ATLAS_CELL;
    ctx.drawImage(img, col * cell, row * cell, cell, cell,
        x - size / 2, y - size * .88, size, size);
}

export function drawSpac1WreckDeath(ctx, death) {
    if (death?.kind !== 'spac1') return false;
    const key = `death_${wreckDirection(death.angle)}`;
    const sheet = requestSheet(key);
    if (!sheet.ready) return false;
    const frame = wreckDeathFrame(death.age || 0);
    const x = death.x, y = death.y;
    const size = 104;
    ctx.save();
    ctx.fillStyle = 'rgba(2, 9, 19, .38)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 10, 33, 9, 0, 0, TAU);
    ctx.fill();
    drawAtlasCell(ctx, sheet.image, frame % 4, Math.floor(frame / 4), size, x, y);
    // The last broken chassis persists. Infrequent tiny electrical sparks add
    // movement without overlapping a second body image or a blurred glow layer.
    if (frame === 15 && Number.isFinite(death.age)) {
        const flicker = Math.sin(death.age * 3.7 + x * .04);
        if (flicker > .94) {
            ctx.fillStyle = `rgba(119, 220, 255, ${(.5 + flicker * .3).toFixed(3)})`;
            ctx.fillRect(x - 9, y - 19, 3, 5);
            ctx.fillRect(x + 2, y - 23, 2, 3);
        }
    }
    ctx.restore();
    return true;
}

export function drawStationRobotWreck(ctx, wreck, time = 0) {
    if (!wreck) return false;
    const key = WRECK_SHEET_FILES[wreck.family] ? wreck.family : 'guard';
    const sheet = requestSheet(key);
    if (!sheet.ready) return false;
    const row = clamp(Math.floor(wreck.variant || 0), 0, 3);
    const frame = wreckIdleFrame(time, wreck.seed ?? wreck.x * .0007 + wreck.y * .0011);
    const size = wreck.size || 110;
    ctx.save();
    ctx.globalAlpha = wreck.opacity ?? .92;
    ctx.fillStyle = 'rgba(2, 10, 19, .35)';
    ctx.beginPath();
    ctx.ellipse(wreck.x + 3, wreck.y + 7, size * .38, size * .08, 0, 0, TAU);
    ctx.fill();
    drawAtlasCell(ctx, sheet.image, frame, row, size, wreck.x, wreck.y);
    ctx.restore();
    return true;
}

export const ROBOT_WRECK_MANIFEST = Object.freeze({
    total: 144, death: 4 * 16, static: 4 * 4 * 5,
    method: 'exclusive Canvas2D atlas cell, zero crossfade',
    atlasCount: 8, cellSize: WRECK_ATLAS_CELL
});
