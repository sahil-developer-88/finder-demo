import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ── Module-level singletons ───────────────────────────────────────────────────
const onlineUsers = new Set<string>();
const listeners   = new Set<() => void>();
const notify      = () => listeners.forEach(fn => fn());

let channel: ReturnType<typeof supabase.channel> | null = null;
let trackedUserId: string | null = null;
let isSubscribed  = false;

function ensureChannel(userId: string) {
  if (channel && trackedUserId === userId) return;

  if (channel) {
    channel.untrack().catch(() => {});
    supabase.removeChannel(channel);
    channel = null;
    trackedUserId = null;
    isSubscribed = false;
    onlineUsers.clear();
    notify();
  }

  trackedUserId = userId;
  channel = supabase
    .channel('app_presence', { config: { presence: { key: userId } } })
    .on('presence', { event: 'sync' }, () => {
      const state = channel!.presenceState();
      onlineUsers.clear();
      Object.keys(state).forEach(key => onlineUsers.add(key));
      notify();
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      onlineUsers.add(key);
      notify();
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      onlineUsers.delete(key);
      notify();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        await channel!.track({ user_id: userId });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        isSubscribed = false;
        console.warn('Presence channel error:', status, '— retrying');
        setTimeout(() => channel?.track({ user_id: userId }), 2000);
      }
    });
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export const usePresence = () => {
  const { user } = useAuth();
  const [, forceRender] = useState(0);

  useEffect(() => {
    const handler = () => forceRender(n => n + 1);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    ensureChannel(userId);

    // Channel already subscribed (returning to chat after navigating away) — re-track now.
    // First-time subscribe is handled inside the SUBSCRIBED callback above.
    if (isSubscribed) {
      channel?.track({ user_id: userId }).catch(() => {});
    }

    const retrack = () => {
      if (!document.hidden && isSubscribed) channel?.track({ user_id: userId });
    };
    window.addEventListener('focus', retrack);
    document.addEventListener('visibilitychange', retrack);

    return () => {
      window.removeEventListener('focus', retrack);
      document.removeEventListener('visibilitychange', retrack);
      channel?.untrack().catch(() => {});
    };
  }, [user?.id]);

  const isUserOnline = useCallback((userId: string) => onlineUsers.has(userId), []);
  return { isUserOnline };
};
