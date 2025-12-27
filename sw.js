const CACHE_NAME = 'v1_audio_app';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/assets/js/main.js',
    '/assets/js/modules/config.js',
    '/assets/js/modules/audio-utils.js',
    '/assets/js/modules/audio-worker.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});
