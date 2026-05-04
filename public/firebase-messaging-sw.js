importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
// IMPORTANT: Replace these with your actual Firebase config values from your src/firebase.js
firebase.initializeApp({
  apiKey: "AIzaSyCvvYmcpWxAPoyK02ovACkoxCh9Xzb5WHs",
  projectId: "jittest-f1580",
  messagingSenderId: "261487978801",
  appId: "1:261487978801:web:72c94d4f0fb1f3691de810",
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