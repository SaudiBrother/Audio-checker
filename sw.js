/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   Soundnalyze — Service Worker v3.0                         ║
 * ║                                                              ║
 * ║   Caching Strategy:                                          ║
 * ║     App Shell   → Cache-First  (precached saat install)     ║
 * ║     CDN assets  → Stale-While-Revalidate (fonts, icons)     ║
 * ║     Navigation  → Network-First + offline fallback          ║
 * ║     Audio files → Network-Only  (jangan cache, terlalu besar)║
 * ║                                                              ║
 * ║   Untuk update: bump CACHE_VERSION                           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ── Versi cache — bump setiap deploy baru ─────────────────────── */
const CACHE_VERSION = 'soundnalyze-v3.0.0';

/* ── Nama cache ───────────────────────────────────────────────── */
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_CDN    = `${CACHE_VERSION}-cdn`;
const CACHE_PAGES  = `${CACHE_VERSION}-pages`;

/* ── Base path: otomatis cocok untuk root domain MAUPUN subdirektori
      (misalnya username.github.io/soundnalyze/) ───────────────── */
const BASE = new URL('./', self.location.href).href;

/* ── App Shell: semua yang diperlukan untuk offline ────────────── */
const APP_SHELL = [
    BASE,
    BASE + 'index.html',
    BASE + 'offline.html',
    BASE + 'style.css',
    BASE + 'script.js',
    BASE + 'manifest.json',
    BASE + 'assets/icon.svg',
    BASE + 'assets/icon-72.png',
    BASE + 'assets/icon-96.png',
    BASE + 'assets/icon-128.png',
    BASE + 'assets/icon-144.png',
    BASE + 'assets/icon-152.png',
    BASE + 'assets/icon-192.png',
    BASE + 'assets/icon-384.png',
    BASE + 'assets/icon-512.png',
    BASE + 'assets/icon-maskable-192.png',
    BASE + 'assets/icon-maskable-512.png',
    BASE + 'assets/apple-touch-icon.png',
];

/* ── CDN origins yang di-cache saat runtime ─────────────────────── */
const CDN_ORIGINS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'ka-f.fontawesome.com',
];

/* ── Tipe audio — JANGAN pernah di-cache ────────────────────────── */
const AUDIO_EXT = ['.mp3','.wav','.flac','.m4a','.aac','.ogg','.opus','.webm'];

/* ════════════════════════════════════════════════════════════════
   INSTALL — precache seluruh app shell
════════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
    console.log('[Soundnalyze SW] Installing…', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_STATIC)
            .then(cache =>
                Promise.allSettled(
                    APP_SHELL.map(url =>
                        cache.add(url).catch(err =>
                            console.warn('[SW] Gagal precache:', url, err.message)
                        )
                    )
                )
            )
            .then(() => {
                console.log('[SW] App shell berhasil di-cache');
                return self.skipWaiting();
            })
    );
});

/* ════════════════════════════════════════════════════════════════
   ACTIVATE — hapus cache lama
════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
    console.log('[Soundnalyze SW] Aktif:', CACHE_VERSION);
    const VALID = new Set([CACHE_STATIC, CACHE_CDN, CACHE_PAGES]);
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(k => !VALID.has(k))
                        .map(k => {
                            console.log('[SW] Hapus cache lama:', k);
                            return caches.delete(k);
                        })
                )
            )
            .then(() => self.clients.claim())
    );
});

/* ════════════════════════════════════════════════════════════════
   FETCH — routing tiap request ke strategi yang tepat
════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    /* Lewati non-GET */
    if (request.method !== 'GET') return;

    /* Lewati extension browser */
    if (!url.protocol.startsWith('http')) return;

    /* File audio → Network-Only, jangan cache */
    if (isAudioRequest(url, request)) {
        event.respondWith(fetch(request));
        return;
    }

    /* CDN (fonts, Font Awesome) → Stale-While-Revalidate */
    if (CDN_ORIGINS.some(o => url.hostname.includes(o))) {
        event.respondWith(staleWhileRevalidate(request, CACHE_CDN));
        return;
    }

    /* Asset same-origin atau base path */
    if (url.href.startsWith(BASE) || url.origin === self.location.origin) {
        /* Navigasi HTML → Network-First + fallback offline */
        if (request.mode === 'navigate' ||
            (request.headers.get('Accept') || '').includes('text/html')) {
            event.respondWith(networkFirst(request));
            return;
        }
        /* CSS, JS, gambar → Cache-First */
        event.respondWith(cacheFirst(request, CACHE_STATIC));
        return;
    }
});

/* ════════════════════════════════════════════════════════════════
   STRATEGI CACHE
════════════════════════════════════════════════════════════════ */

async function cacheFirst(req, cacheName) {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
        return res;
    } catch {
        return new Response('Tidak tersedia offline.', { status: 503 });
    }
}

async function networkFirst(req) {
    try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE_PAGES)).put(req, res.clone());
        return res;
    } catch {
        const cached = await caches.match(req)
                    || await caches.match(BASE + 'offline.html')
                    || await caches.match(BASE + 'index.html');
        if (cached) return cached;
        return new Response(
            '<!DOCTYPE html><html><body><h1>Offline</h1><p>Hubungkan kembali ke internet.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
        );
    }
}

async function staleWhileRevalidate(req, cacheName) {
    const cache  = await caches.open(cacheName);
    const cached = await cache.match(req);
    const fresh  = fetch(req)
        .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
    return cached || fresh;
}

/* ════════════════════════════════════════════════════════════════
   HELPER
════════════════════════════════════════════════════════════════ */
function isAudioRequest(url, req) {
    const path = url.pathname.toLowerCase();
    const type = (req.headers.get('Accept') || '').toLowerCase();
    return AUDIO_EXT.some(e => path.endsWith(e)) ||
           type.startsWith('audio/') || type.startsWith('video/');
}

/* ════════════════════════════════════════════════════════════════
   MESSAGE — kontrol dari halaman
════════════════════════════════════════════════════════════════ */
self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING')
        self.skipWaiting();

    if (event.data?.type === 'GET_VERSION')
        event.ports[0]?.postMessage({ version: CACHE_VERSION });

    if (event.data?.type === 'CLEAR_CACHE')
        caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .then(() => event.ports[0]?.postMessage({ ok: true }));
});
