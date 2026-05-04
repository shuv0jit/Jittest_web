const CACHE_NAME = 'jittest-network-first-v1';

// Install event: skip waiting to ensure the new service worker activates immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: claim clients so it immediately controls all open pages
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// Fetch event: Network-First Strategy
self.addEventListener('fetch', (event) => {
  // Only apply to GET requests (ignore API POSTs, etc.)
  if (event.request.method !== 'GET') return;
  
  // Do not cache or intercept insecure HTTP requests (prevents mixed-content cache poisoning)
  if (event.request.url.startsWith('http:')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Network succeeded: ONLY update the cache if the response is perfectly valid (200 OK)
        // This prevents caching ISP captive portals, injected ads, or 404/5xx server errors
        if (response && response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Network failed (offline or timed out): fallback to the local cache
        return caches.match(event.request);
      })
  );
});
