importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Install event: skip waiting to ensure the new service worker activates immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event: claim clients so it immediately controls all open pages
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        // Delete ALL existing caches from older, broken service workers
        cacheNames.map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => clients.claim())
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