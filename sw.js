/* sw.js — service worker voor La Grande Boucle de Tom
 * Cache-first app-shell + data. Offline na de eerste load.
 * Bump CACHE bij elke release zodat oude bestanden verlopen.
 */
'use strict';

const CACHE_VERSION = 'v3';                 // hoog dit op bij elke data-/asset-wijziging
const CACHE = 'grande-boucle-' + CACHE_VERSION;
const SHELL = [
  '.',
  'index.html',
  'app.js',
  'styles.css',
  'manifest.json',
  'data/taalarchief.json',
  'icons/favicon.svg',
  'icons/favicon-32.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Alleen same-origin succesvolle responses bijcachen.
        if (res && res.ok && new URL(req.url).origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
