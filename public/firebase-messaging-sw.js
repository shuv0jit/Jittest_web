importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

const CACHE_NAME = 'jittest-network-first-v4';

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