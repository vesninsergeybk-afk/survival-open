/** Retain ordinary slow frames; bound resumed tabs to 150ms of simulation. */
export function simulationSlices(frameMs, maxStep=1/30) {
    const elapsed=Math.max(0,Math.min(.15,(Number(frameMs)||0)/1000));
    const count=Math.max(1,Math.ceil(elapsed/maxStep));
    return {count,dt:elapsed/count,elapsed};
}
