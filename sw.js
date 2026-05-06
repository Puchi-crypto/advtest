const CACHE_NAME = 'uwaki-detective-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './src/app.js',
  './data/scenarios.json',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './assets/characters/childhood_friend/standing.svg',
  './assets/characters/childhood_friend/line_icon.svg',
  './assets/characters/childhood_friend/secret_icon.svg',
  './assets/characters/gal/standing.svg',
  './assets/characters/gal/line_icon.svg',
  './assets/characters/gal/secret_icon.svg',
  './assets/characters/married_woman/standing.svg',
  './assets/characters/married_woman/line_icon.svg',
  './assets/characters/married_woman/secret_icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
