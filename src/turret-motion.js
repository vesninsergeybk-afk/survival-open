/**
 * Smooth, angle-safe aiming and muzzle geometry for the station gun mounts.
 * Pure helpers so visual motion can be tested without a Canvas or a game loop.
 */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Shortest signed turn, including the -PI/+PI seam. */
export function turretAngleDelta(from, to) {
    return Math.atan2(Math.sin(to-from), Math.cos(to-from));
}

/** Rate-limited turn in radians/second; never overshoots or spins 360 degrees. */
export function turnTurretTowards(current, desired, dt, rate=7.4) {
    if(!Number.isFinite(current) || !Number.isFinite(desired))return 0;
    if(!Number.isFinite(dt) || dt<=0)return current;
    const delta=turretAngleDelta(current,desired);
    return current+clamp(delta,-rate*Math.min(dt,.05),rate*Math.min(dt,.05));
}

/** Muzzle follows the swiveling gun head, rather than the station centre. */
export function turretMuzzle(baseX,baseY,mountAngle,aimAngle,recoil=0) {
    const x=baseX+Math.cos(mountAngle)*78;
    const y=baseY+Math.sin(mountAngle)*78;
    const length=25-clamp(recoil,0,12);
    return {x:x+Math.cos(aimAngle)*length,
        y:y+Math.sin(aimAngle)*length};
}
