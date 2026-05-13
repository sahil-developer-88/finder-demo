import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ── Module-level singletons ───────────────────────────────────────────────────
// One channel for the whole app. All hook instances share the same connection.
const onlineUsers = new Set<string>();
const listeners   = new Set<() => void>();
const notify      = () => listeners.forEach(fn => fn());

let channel: ReturnType<typeof supabase.channel> | null = null;
let trackedUserId: string | null = null;

function ensureChannel(userId: string) {
  if (channel && trackedUserId === userId) return; // already initialised for this user

  // Tear down any previous channel (e.g. after a logout/re-login)
  if (channel) {
    channel.untrack().catch(() => {});
    supabase.removeChannel(channel);
    channel = null;
    trackedUserId = null;
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
        await channel!.track({ user_id: userId });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Presence channel error:', status, '— retrying track');
        setTimeout(() => channel?.track({ user_id: userId }), 2000);
      }
    });
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export const usePresence = () => {
  const { user } = useAuth();
  const [, forceRender] = useState(0);

  // Register re-render listener — stable reference so cleanup actually works
  useEffect(() => {
    const handler = () => forceRender(n => n + 1);
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  useEffect(() => {
    if (!user) return;
    ensureChannel(user.id);

    // Re-announce presence when the tab becomes active again
    const retrack = () => {
      if (!document.hidden) channel?.track({ user_id: user.id });
    };
    window.addEventListener('focus', retrack);
    document.addEventListener('visibilitychange', retrack);

    return () => {
      window.removeEventListener('focus', retrack);
      document.removeEventListener('visibilitychange', retrack);
    };
  }, [user]);

  const isUserOnline = useCallback((userId: string) => onlineUsers.has(userId), []);
  return { isUserOnline };
};
