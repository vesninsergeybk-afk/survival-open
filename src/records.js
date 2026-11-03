/**
 * Personal survival records on this browser.
 * One shared origin: the game writes; /lab/ reads the same key.
 * No sign-in or cross-device syncing is implied.
 */
export const SURVIVOR_RECORDS_KEY = 'vm-survivor-records-v1';

export function calculatePoints({ seconds = 0, kills = 0, level = 1, bosses = 0 } = {}) {
    const nonnegative = (n) => Math.max(0, Number.isFinite(Number(n)) ? Math.floor(Number(n)) : 0);
    return nonnegative(seconds) * 2 +
        nonnegative(kills) * 10 +
        Math.max(0, nonnegative(level) - 1) * 40 +
        nonnegative(bosses) * 500;
}

export function formatPoints(value) {
    return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('ru-RU');
}

const emptyRecords = () => ({
    version: 1,
    best: null,
    latest: null,
    totals: { runs: 0, points: 0, kills: 0, seconds: 0, bosses: 0, longestSeconds: 0 },
    history: []
});

export function readSurvivorRecords() {
    try {
        const raw = JSON.parse(localStorage.getItem(SURVIVOR_RECORDS_KEY) || 'null');
        if (!raw || raw.version !== 1 || typeof raw !== 'object') return emptyRecords();
        const clean = emptyRecords();
        clean.best = raw.best && typeof raw.best === 'object' ? raw.best : null;
        clean.latest = raw.latest && typeof raw.latest === 'object' ? raw.latest : null;
        clean.totals = { ...clean.totals, ...(raw.totals || {}) };
        clean.history = Array.isArray(raw.history) ? raw.history.slice(0, 40) : [];
        return clean;
    } catch {
        return emptyRecords();
    }
}

export function recordSurvivorRun(input) {
    const safe = (n) => Math.max(0, Math.floor(Number(n) || 0));
    const run = {
        points: calculatePoints(input),
        seconds: safe(input.seconds),
        kills: safe(input.kills),
        level: Math.max(1, safe(input.level)),
        bosses: safe(input.bosses),
        stage: typeof input.stage === 'string' ? input.stage : 'forest',
        difficulty: typeof input.difficulty === 'string' ? input.difficulty : 'normal',
        mode: typeof input.mode === 'string' ? input.mode : 'normal',
        date: Date.now()
    };
    const records = readSurvivorRecords();
    const isRecord = !records.best || run.points > (Number(records.best.points) || 0);
    records.latest = run;
    if (isRecord) records.best = run;
    records.totals.runs = safe(records.totals.runs) + 1;
    records.totals.points = safe(records.totals.points) + run.points;
    records.totals.kills = safe(records.totals.kills) + run.kills;
    records.totals.seconds = safe(records.totals.seconds) + run.seconds;
    records.totals.bosses = safe(records.totals.bosses) + run.bosses;
    records.totals.longestSeconds = Math.max(safe(records.totals.longestSeconds), run.seconds);
    records.history.unshift(run);
    records.history = records.history.slice(0, 40);
    let saved = false;
    try {
        localStorage.setItem(SURVIVOR_RECORDS_KEY, JSON.stringify(records));
        saved = true;
    } catch {
        // If browser storage is disabled, the run still finishes and displays its points.
    }
    return { points: run.points, isRecord, saved, records };
}
