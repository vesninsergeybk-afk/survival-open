/**
 * Mission 00, room one: authored 4x3 atlases for the reactor, power distributor
 * and the damaged isometric blast gate.  This file owns visuals only; the
 * PrologueMissionWorld continues to own input, collision and mission progress.
 */

const CELL = 288;
const LAST_FRAME = 11;
const REACTOR_UNFOLD_SECONDS = 1.18;
const DISTRIBUTOR_UNFOLD_SECONDS = 1.15;
const GATE_SECONDS = 1.85;

const PATHS = {
    reactor: new URL('../assets/prologue/first-room-reactor.webp', import.meta.url).href,
    distributor: new URL('../assets/prologue/first-room-distributor.webp', import.meta.url).href,
    gate: new URL('../assets/prologue/first-room-gate.webp', import.meta.url).href,
    materials: new URL('../assets/prologue/first-room-materials.webp', import.meta.url).href
};

const images = new Map();
const prepared = new WeakSet();
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
// Run powered idle poses forward and back; a wrap from the last to the first
// frame makes mechanical arms appear to teleport through their own chassis.
function reflectedLoop(elapsed, speed, first, last) {
    const span = last - first;
    const cycle = (elapsed * speed) % (span * 2);
    return first + (cycle <= span ? cycle : span * 2 - cycle);
}
// The authored poses change their transparent margins as machinery unfolds.
// Measure the opaque artwork once per atlas cell; keep its centre and grounded
// bottom at a fixed world position without rescaling the unfolding motion.
const SAMPLE = 96;
const alignmentCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (alignmentCanvas) alignmentCanvas.width = alignmentCanvas.height = SAMPLE;
const alignmentCtx = alignmentCanvas?.getContext('2d', {willReadFrequently:true}) ?? null;
const alignments = new Map();
function footprint(img, kind, frame) {
    let frames = alignments.get(kind);
    if (!frames) { frames = new Array(12); alignments.set(kind, frames); }
    if (frames[frame]) return frames[frame];
    const fallback = {centre:CELL / 2, bottom:CELL};
    if (!alignmentCtx) return frames[frame] = fallback;
    try {
        alignmentCtx.clearRect(0, 0, SAMPLE, SAMPLE);
        alignmentCtx.drawImage(img, frame % 4 * CELL, Math.floor(frame / 4) * CELL,
            CELL, CELL, 0, 0, SAMPLE, SAMPLE);
        const rgba = alignmentCtx.getImageData(0, 0, SAMPLE, SAMPLE).data;
        let left=SAMPLE, right=-1, bottom=-1;
        for (let y=0; y<SAMPLE; y++) for (let x=0; x<SAMPLE; x++) {
            if (rgba[(y*SAMPLE+x)*4+3] < 150) continue;
            left=Math.min(left,x); right=Math.max(right,x); bottom=Math.max(bottom,y);
        }
        if (right < 0) return frames[frame] = fallback;
        return frames[frame] = {
            centre:(left+right+1)*CELL/(2*SAMPLE),
            bottom:(bottom+1)*CELL/SAMPLE
        };
    } catch (_) {
        return frames[frame] = fallback;
    }
}

function sheet(kind) {
    if (typeof Image === 'undefined') return null;
    if (!images.has(kind)) {
        const img = new Image();
        img.decoding = 'async';
        img.onload=async()=>{
            try{await img.decode?.();}catch(_){/* onload already succeeded */}
            if(kind!=='materials')for(let frame=0;frame<12;frame++)footprint(img,kind,frame);
            prepared.add(img);
        };
        img.src = PATHS[kind];
        images.set(kind, img);
    }
    const img = images.get(kind);
    return prepared.has(img) && img.naturalWidth > 0 ? img : null;
}

export function warmFirstRoomProps(){for(const kind of Object.keys(PATHS))sheet(kind);}

export function reactorFrame(active, ageSeconds) {
    if (!active) return 0;
    const elapsed = Math.max(0, Number.isFinite(ageSeconds) ? ageSeconds : 0);
    if (elapsed < REACTOR_UNFOLD_SECONDS)
        return Math.min(7, elapsed / REACTOR_UNFOLD_SECONDS * 7);
    // Keep the running movement continuous in time instead of jumping
    // straight from one complete image to the next.
    return reflectedLoop(elapsed - REACTOR_UNFOLD_SECONDS, 2.75, 7, 11);
}

export function distributorFrame(active, ageSeconds) {
    if (!active) return 0;
    const elapsed = Math.max(0, Number.isFinite(ageSeconds) ? ageSeconds : 0);
    if (elapsed < DISTRIBUTOR_UNFOLD_SECONDS)
        return Math.min(8, elapsed / DISTRIBUTOR_UNFOLD_SECONDS * 8);
    return reflectedLoop(elapsed - DISTRIBUTOR_UNFOLD_SECONDS, 2.3, 8, 11);
}

/** Collision openness, including a short mechanical jam at 42%. */
export function gateOpenProgress(elapsedSeconds) {
    const q = clamp((Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0) / GATE_SECONDS, 0, 1);
    if (q >= 1) return 1;
    if (q < .37) return q / .37 * .42;
    if (q < .43) return .42; // A brief mechanical hesitation, not a half-second freeze.
    if (q < .82) return .42 + (q - .43) / .39 * .40;
    return .82 + (q - .82) / .18 * .18;
}

export function gateFrame(openness) {
    return clamp(openness, 0, 1) * LAST_FRAME;
}

/** Draw one atlas cell at an unchanging world anchor. Returns false while loading. */
export function drawFirstRoomProp(ctx, kind, frame, x, y, size, time = 0) {
    const img = sheet(kind);
    if (!img) return false;
    const value = clamp(Number.isFinite(frame) ? frame : 0, 0, LAST_FRAME);
    // Adjacent perspective poses have different silhouettes. Dissolving them
    // creates two translucent machines at once, which looks like ghosting.
    // Show exactly one authored pose and let real time control the cadence.
    const pose = clamp(Math.round(value), 0, LAST_FRAME);
    const scale = size / CELL;
    const anchor = footprint(img, kind, pose);
    ctx.save();
    ctx.translate(x, y);
    if (kind === 'gate') ctx.transform(1, -.12, 0, 1, 0, 0);
    ctx.drawImage(img, pose % 4 * CELL, Math.floor(pose / 4) * CELL,
        CELL, CELL, -anchor.centre * scale,
        size * (kind === 'gate' ? .43 : .35) - anchor.bottom * scale,
        size, size);
    if ((kind === 'reactor' || kind === 'distributor') && value >= 7) {
        const glow = .035 + .03 * (1 + Math.sin(time * 3.3)) / 2;
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#5adff1';
        ctx.beginPath();
        ctx.ellipse(0, size * .17, size * .34, size * .13, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    return true;
}

/** A few material accents, not a dense repeated tiled pattern. */
export function drawFirstRoomMaterials(ctx, cx, cy) {
    const img = sheet('materials');
    if (!img) return false;
    const sourceCell = img.naturalWidth / 3;
    const plates = [
        [1, -460, -300, 150, .28],
        [2, -470,  130, 150, .32],
        [3, -165, -195, 214, .33],
        [4,  355, -285, 128, .30],
        [5,  255,  260, 140, .31],
        [0,   70,  270, 155, .16]
    ];
    ctx.save();
    for (const [index, dx, dy, size, opacity] of plates) {
        const column = index % 3, row = Math.floor(index / 3);
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, column * sourceCell + 3, row * sourceCell + 3,
            sourceCell - 6, sourceCell - 6, cx + dx - size / 2,
            cy + dy - size / 2, size, size);
    }
    ctx.restore();
    return true;
}

