const CACHE = 'fiinas-v3';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // Ne pas intercepter les requêtes vers Firebase, Anthropic API, etc.
  const url = new URL(e.request.url);
  const bypass = [
    'firebaseio.com',
    'googleapis.com',
    'firebaseapp.com',
    'anthropic.com',
    'vercel.app',
  ];
  if (bypass.some(domain => url.hostname.includes(domain))) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok && res.status < 400) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached); // Si réseau échoue, retourner le cache

      return cached || network;
    })
  );
});
