
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  listing_id: string | null;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  read: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  recipient_id: string;
  recipient_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export interface UserSearchResult {
  user_id: string;
  full_name: string | null;
  business_name: string | null;
}

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const { user } = useAuth();
  // Track which conversation is open so realtime events go to the right place
  const activeConvIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchConversations();
    setupRealtimeSubscription();

    // Poll every 15s so the Header badge stays in sync even if realtime misses an event
    const pollTimer = setInterval(fetchConversations, 15000);
    const handleFocus = () => fetchConversations();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Collect unique other-user IDs
      const otherIds = [
        ...new Set(
          (data || []).map((m) =>
            m.sender_id === user.id ? m.recipient_id : m.sender_id
          )
        ),
      ];

      // Fetch their profiles for display names
      const profileMap = new Map<string, { full_name?: string; business_name?: string }>();
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, business_name')
          .in('user_id', otherIds);
        profiles?.forEach((p) => profileMap.set(p.user_id, p));
      }

      // Build one entry per conversation (newest message first)
      const conversationMap = new Map<string, Conversation>();
      data?.forEach((message) => {
        const otherId =
          message.sender_id === user.id ? message.recipient_id : message.sender_id;
        const profile = profileMap.get(otherId);
        const name =
          profile?.business_name || profile?.full_name || 'Unknown User';

        if (!conversationMap.has(otherId)) {
          conversationMap.set(otherId, {
            recipient_id: otherId,
            recipient_name: name,
            last_message: message.content,
            last_message_at: message.created_at,
            unread_count: 0,
          });
        }

        // Count unread messages sent TO the current user
        if (message.recipient_id === user.id && !message.read) {
          conversationMap.get(otherId)!.unread_count += 1;
        }
      });

      setConversations(Array.from(conversationMap.values()));
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Append-only refresh — deduplicates by ID so it never causes scroll jumps
  const appendNewMessages = useCallback(async (recipientId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    if (!data?.length) return;
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const newOnes = (data as Message[]).filter(m => !existingIds.has(m.id));
      if (!newOnes.length) return prev; // stable reference — no re-render
      return [...prev, ...newOnes];
    });
  }, [user]);

  // Poll the active conversation every 5 s as a realtime fallback
  useEffect(() => {
    if (!activeConvId || !user) return;
    const poll = setInterval(() => appendNewMessages(activeConvId), 5000);
    return () => clearInterval(poll);
  }, [activeConvId, user, appendNewMessages]);

  const fetchMessages = async (recipientId: string) => {
    if (!user) return;
    activeConvIdRef.current = recipientId;
    setActiveConvId(recipientId);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);

      // Mark incoming messages as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', recipientId)
        .eq('recipient_id', user.id)
        .eq('read', false);

      fetchConversations();
    } catch (error: any) {
      console.error('Error fetching messages:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    // Clean up any previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`messages-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          if (newMessage.sender_id === activeConvIdRef.current) {
            // We're viewing this conversation — append and auto-mark read
            setMessages((prev) => [...prev, newMessage]);
            supabase
              .from('messages')
              .update({ read: true })
              .eq('id', newMessage.id)
              .then(() => fetchConversations());
          } else {
            // Different conversation — refresh list and show toast
            fetchConversations();
            toast({
              title: 'New message',
              description: 'You have received a new message',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          // A message addressed to us was updated (e.g. marked read) — refresh unread counts
          fetchConversations();
        }
      )
      .subscribe();
  };

  const sendMessage = async (
    recipientId: string,
    content: string,
    messageType: 'text' | 'image' | 'file' | 'system' = 'text',
    listingId?: string
  ) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          content,
          message_type: messageType,
          listing_id: listingId || null,
        })
        .select()
        .single();

      if (error) throw error;
      setMessages((prev) => [...prev, data as Message]);
      fetchConversations();
      return data;
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const searchUsers = async (query: string): Promise<UserSearchResult[]> => {
    if (!user || !query.trim()) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, business_name')
        .neq('user_id', user.id)
        .or(`full_name.ilike.%${query}%,business_name.ilike.%${query}%`)
        .limit(10);
      if (error) throw error;
      return (data || []) as UserSearchResult[];
    } catch {
      return [];
    }
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  const markAllMessagesAsRead = async () => {
    if (!user) return;
    // Optimistic — drop all badges immediately
    setConversations(prev => prev.map(c => ({ ...c, unread_count: 0 })));
    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('recipient_id', user.id)
        .eq('read', false);
    } catch (error: any) {
      console.error('Error marking all messages as read:', error);
      fetchConversations(); // revert by refreshing
    }
  };

  return {
    messages,
    conversations,
    loading,
    totalUnread,
    fetchMessages,
    sendMessage,
    searchUsers,
    markAllMessagesAsRead,
    refetch: fetchConversations,
  };
};
