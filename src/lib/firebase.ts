import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            'AIzaSyAwPorKtGW6yCffIOa6w6otl361Tk7VyNk',
  authDomain:        'finderfinder-b99a1.firebaseapp.com',
  projectId:         'finderfinder-b99a1',
  storageBucket:     'finderfinder-b99a1.firebasestorage.app',
  messagingSenderId: '304763180155',
  appId:             '1:304763180155:web:dceec939c218350054bede',
  measurementId:     'G-J1QRKXP93V',
};

export const VAPID_KEY = 'BO-OTLnwSKJA-GEJSSHfcmpuDqpVjws2Da2nDDvW7AhkKq7haSWisQ1dzugvmprdQmxSgvDXsakhWd5Qq7AC7BE';

const app = initializeApp(firebaseConfig);

// messaging is only available in browser environments that support it (not SSR, not iOS Safari < 16.4)
export const messaging = (() => {
  try {
    return typeof window !== 'undefined' ? getMessaging(app) : null;
  } catch {
    return null;
  }
})();

export { getToken, onMessage };
