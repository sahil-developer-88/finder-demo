importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyAwPorKtGW6yCffIOa6w6otl361Tk7VyNk',
  authDomain:        'finderfinder-b99a1.firebaseapp.com',
  projectId:         'finderfinder-b99a1',
  storageBucket:     'finderfinder-b99a1.firebasestorage.app',
  messagingSenderId: '304763180155',
  appId:             '1:304763180155:web:dceec939c218350054bede',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'SwapShop', {
    body:  body  || 'You have a new message',
    icon:  '/favicon.ico',
    badge: '/favicon.ico',
    data:  { url: '/account-dashboard?tab=inbox', ...(payload.data || {}) },
  });
});

// Handle notification click — open/focus the app and navigate to inbox
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/account-dashboard?tab=inbox';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open in any tab, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new tab
      clients.openWindow(url);
    })
  );
});
