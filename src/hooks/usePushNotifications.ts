import { useEffect, useState } from 'react';
import { messaging, getToken, onMessage, VAPID_KEY } from '@/lib/firebase';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { showPushBanner } from '@/components/notifications/PushNotificationBanner';

const notifSupported = () => typeof Notification !== 'undefined';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    notifSupported() && Notification.permission === 'granted'
  );

  // If permission was already granted (e.g. returning user), init silently
  useEffect(() => {
    if (!user || !messaging || !notifSupported()) return;
    if (Notification.permission === 'granted') {
      registerAndSaveToken();
    }
  }, [user]);

  // Set up foreground message handler whenever messaging is ready
  useEffect(() => {
    if (!user || !messaging || !notifSupported()) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (!title) return;
      const url = (payload.data as any)?.url || undefined;
      showPushBanner({ title, body: body || '', url });
    });

    return () => unsubscribe();
  }, [user]);

  const registerAndSaveToken = async () => {
    try {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const registration = await navigator.serviceWorker.ready;

      const token = await getToken(messaging!, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (!token) return;

      await supabase
        .from('profiles')
        .update({ fcm_token: token })
        .eq('user_id', user!.id);
    } catch (err) {
      console.error('Push notification setup error:', err);
    }
  };

  // Must be called from a user-click handler (Firefox requirement)
  const enableNotifications = async () => {
    if (!messaging || !user || !notifSupported()) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      setNotificationsEnabled(true);
      await registerAndSaveToken();
    } catch (err) {
      console.error('Enable notifications error:', err);
    }
  };

  return { notificationsEnabled, enableNotifications };
};
