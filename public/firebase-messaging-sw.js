importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const CACHE_NAME = 'jittest-network-first-v4';
const APP_SHELL_URLS = [
  '/', // This will be rewritten to /index.html by Vercel and cached.
  '/jittest.png'
];

// Install event: skip waiting to ensure the new service worker activates immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching App Shell');
      return cache.addAll(APP_SHELL_URLS);
    }).then(() => self.skipWaiting())
  );
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
  if (event.request.method !== 'GET') return;
  
  // Do not cache or intercept insecure HTTP requests (prevents mixed-content cache poisoning)
  if (event.request.url.startsWith('http:')) return;

  // For navigation requests, fall back to the cached app shell.
  // This allows the SPA to load and handle routing, even when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async (error) => {
        console.warn(`[Service Worker] Navigation failed for ${event.request.url}. Falling back to cached app shell.`, error);
        const cache = await caches.open(CACHE_NAME);
        return await cache.match('/');
      })
    );
    return;
  }

  // For other requests (assets, APIs), use a network-first strategy.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        console.warn(`[Service Worker] Asset fetch failed for ${event.request.url}. Falling back to cache.`, error);
        return await cache.match(event.request);
      }
    })
  );
});

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCvvYmcpWxAPoyK02ovACkoxCh9Xzb5WHs",
  projectId: "jittest-f1580",
  messagingSenderId: "261487978801",
  appId: "1:261487978801:web:72c94d4f0fb1f3691de810",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new message.',
    icon: '/jittest.png' // Change to your site's actual icon URL
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});