/**
 * CC0 station art (Wenrexa Space Modular Buildings, 2021).
 * One local animated atlas: 8x6 cells at 160px; no runtime WebGL.
 * Original: https://opengameart.org/content/assets-free-space-modular-buildings-kit
 */
const CELL = 160, COLS = 8;
export const stationArt = { image: null, ready: false };
if (typeof Image !== 'undefined') {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { stationArt.ready = true; };
    img.onerror = () => { stationArt.ready = false; };
    img.src = new URL('../assets/space/station-atlas.webp', import.meta.url).href;
    stationArt.image = img;
}
/** Draw a particular cell as a composited part. Caller owns ctx transforms. */
export function drawStationPart(ctx, index, x, y, size, angle = 0, alpha = 1) {
    if (!stationArt.ready || index < 0) return false;
    ctx.save();
    ctx.translate(x,y);
    if (angle) ctx.rotate(angle);
    ctx.globalAlpha *= alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(stationArt.image, (index % COLS) * CELL,
        Math.floor(index/COLS) * CELL, CELL, CELL,
        -size/2, -size/2, size, size);
    ctx.restore();
    return true;
}
export const STATION_PARTS = Object.freeze({
    outpost: 0, dock: 1, large: 2, lab: 3, arsenal: 4,
    refinery: 5, carrier: 6, depot: 7,
    bridge: 8, cross: 9, wing: 10, hanger: 11,
    basic: 12, missile: 15, rail: 16, arc: 17,
    turretIdle: 18, turretFireStart: 19,
    scoutStart: 27, fighterStart: 36
});
