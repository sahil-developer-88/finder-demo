import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const sendPush = (recipient_id: string, title: string, body: string) => {
  supabase.functions.invoke('send-push-notification', {
    body: { recipient_id, title, body },
  }).catch(() => {});
};

/**
 * Always-on push notification triggers.
 * Add new event subscriptions here — never in individual UI hooks/pages.
 */
export const usePushTriggers = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`push-triggers-${user.id}`)
      // ── New message ──────────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const msg = payload.new as any;
          sendPush(user.id, 'New message', msg.content?.slice(0, 100) || 'You have a new message');
        }
      )
      // ── New trade request ─────────────────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_requests', filter: `merchant_id=eq.${user.id}` },
        () => {
          sendPush(user.id, 'New trade request', 'Someone sent you a trade request');
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);
};
