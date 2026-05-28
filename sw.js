const CACHE_NAME = 'clash-board-v2';
const ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './mockData.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event with network-first fallback strategy for API routes, cache-first for local static assets
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // If it's a local static asset, try cache first, fall back to network
  if (ASSETS.some(asset => url.pathname.includes(asset.replace('./', '')))) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request);
      })
    );
    return;
  }

  // Otherwise, default to network first
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        // Return custom JSON error for API requests offline
        if (e.request.url.includes('/api/')) {
          return new Response(JSON.stringify({
            error: 'Offline Mode Active',
            message: 'You are currently offline. Live API calls require an internet connection, but local simulators and strategies are fully active.'
          }), { headers: { 'Content-Type': 'application/json' } });
        }
      });
    })
  );
});
