/**
 * Survivor viewport: use the whole phone screen while keeping a bounded
 * logical camera and render resolution. Pure function for deterministic QA.
 */
export const BASE_VIEW = Object.freeze({ width: 1200, height: 800 });

export function planSurvivorViewport({ width, height, coarsePointer = false, devicePixelRatio = 1 }) {
    const sw = Math.max(1, Math.floor(Number(width) || 1));
    const sh = Math.max(1, Math.floor(Number(height) || 1));
    const mobile = !!coarsePointer && Math.max(sw, sh) <= 1400;
    if (!mobile) {
        const scale = Math.min(
            Math.min(Math.max(1, sw - 16), BASE_VIEW.width) / BASE_VIEW.width,
            Math.min(Math.max(1, sh - 16), BASE_VIEW.height) / BASE_VIEW.height
        );
        return {
            mobile: false,
            cssWidth: BASE_VIEW.width * scale,
            cssHeight: BASE_VIEW.height * scale,
            logicalWidth: BASE_VIEW.width,
            logicalHeight: BASE_VIEW.height,
            backingWidth: BASE_VIEW.width,
            backingHeight: BASE_VIEW.height
        };
    }
    // Landscape-first camera, smoothly scaled across short 16:9 and wide 20:9 phones.
    // Portrait is an orientation prompt; keep valid dimensions for transitions.
    const zoom = sw < sh ? (sw <= 440 ? 0.70 : 0.82) :
        Math.min(0.90, Math.max(0.76, 0.78 + (sh - 390) * 0.0005));
    const density = Math.min(1.5, Math.max(1, Number(devicePixelRatio) || 1));
    return {
        mobile: true,
        cssWidth: sw,
        cssHeight: sh,
        logicalWidth: Math.round(sw / zoom),
        logicalHeight: Math.round(sh / zoom),
        backingWidth: Math.round(sw * density),
        backingHeight: Math.round(sh * density)
    };
}
