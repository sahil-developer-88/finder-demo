import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Shared presence state so all components see the same data
const onlineUsers = new Set<string>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(fn => fn());

export const usePresence = () => {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    listeners.add(() => forceRender(n => n + 1));
    return () => { listeners.delete(() => forceRender(n => n + 1)); };
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('app_presence', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user_id: string }>();
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
          await channel.track({ user_id: user.id });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      onlineUsers.delete(user.id);
      notify();
    };
  }, [user]);

  const isUserOnline = useCallback((userId: string) => onlineUsers.has(userId), []);

  return { isUserOnline };
};
