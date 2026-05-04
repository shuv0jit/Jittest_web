importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// IMPORTANT: Replace these with your actual Firebase config values from your src/firebase.js
firebase.initializeApp({
  apiKey: "PASTE_YOUR_REAL_API_KEY_HERE",
  projectId: "PASTE_YOUR_REAL_PROJECT_ID_HERE",
  messagingSenderId: "PASTE_YOUR_REAL_SENDER_ID_HERE",
  appId: "PASTE_YOUR_REAL_APP_ID_HERE"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/jittest.png' // Change to your site's actual icon URL
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});