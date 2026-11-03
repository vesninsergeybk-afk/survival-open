/**
 * service-worker.js
 *
 * Small offline cache with network-first updates so the game can be relaunched offline once
 * the player has loaded it at least once. We intentionally keep the precache list
 * short and explicit — it covers the static assets the browser needs to render
 * a frame. localStorage (used by `src/storage.js`) already handles save data.
 *
 * No build step, no Workbox, no dependencies.
 */
/* eslint-env serviceworker */
/* global self, caches, fetch */

const CACHE = 'vesnin-survivor-ru-recorded-sfx-02';
// Only cache a small boot shell eagerly. Every loaded module, animation
// atlas and sound is stored by the fetch handler on first real use; the
// former precache downloaded obsolete code and large images during the dock.
const UNIQUE_ASSETS = [
    './index.html',
    './styles.css?v=qa-106',
    './prologue-design.css?v=design-127',
    './interface.css?v=perf-981',
    './src/main.js?v=spac1-walk-134'
];
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then(async (cache) => {
            const results = await Promise.allSettled(UNIQUE_ASSETS.map((path) => cache.add(path)));
            const failed = results.filter((result) => result.status === 'rejected').length;
            if (failed) console.warn('[survivor-sw] Skipped', failed, 'offline assets; online play is available');
            await self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k.startsWith('vesnin-survivor-ru-') && k !== CACHE).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    // Only cache same-origin GETs from controlled game pages.
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    // Navigation and changing code are network-first. Heavy immutable sprite
    // atlases and sound assets are cache-first for fast repeat sessions.
    // The versioned CACHE name invalidates media on each game release.
    const networkFirst = req.mode === 'navigate' ||
        /\.(?:js|css|json)$/.test(url.pathname);
    const fromNetwork = () => fetch(req, { cache: 'no-store' }).then((res) => {
        if (res && res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
        }
        return res;
    });
    if (networkFirst) {
        event.respondWith(fromNetwork().catch(async () =>
            (await caches.match(req)) ||
            (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
        ));
    } else {
        event.respondWith(caches.match(req).then((hit) => hit || fromNetwork()));
    }
});


