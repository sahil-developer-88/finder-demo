import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface POSTransaction {
  id: string;
  merchant_id: string;
  external_transaction_id: string;
  pos_provider: string;
  total_amount: number;
  currency: string;
  barter_amount: number;
  barter_percentage: number;
  cash_amount: number;
  card_amount: number;
  items?: any;
  status: string;
  transaction_date: string;
  created_at: string;
}

/**
 * Hook for real-time POS transaction syncing.
 *
 * Fix history:
 *   - Realtime subscription now uses a merchant_id filter so only this
 *     merchant's events are delivered (prevents cross-merchant leakage).
 *   - merchantId is resolved first; subscription is set up only after we
 *     know the ID so the filter is always present.
 *   - Fetch limit raised from 50 → 500 so Analytics stats (avg barter %,
 *     all-time split) are computed from a meaningful dataset.
 */
export function usePOSTransactions() {
  const { toast } = useToast();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1 – resolve the authenticated merchant ID once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMerchantId(user.id);
    });
  }, []);

  // Step 2 – fetch + subscribe once merchantId is known
  useEffect(() => {
    if (!merchantId) return;

    fetchTransactions(merchantId);

    // Channel name is merchant-scoped so multiple tabs don't conflict
    const channel = supabase
      .channel(`pos-transactions-${merchantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pos_transactions',
          filter: `merchant_id=eq.${merchantId}`,   // ← only this merchant
        },
        (payload) => {
          const newTx = payload.new as POSTransaction;
          setTransactions(prev => [newTx, ...prev]);
          toast({
            title: '💰 New Transaction',
            description: `${newTx.pos_provider} · $${Number(newTx.total_amount).toFixed(2)}`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pos_transactions',
          filter: `merchant_id=eq.${merchantId}`,   // ← only this merchant
        },
        (payload) => {
          setTransactions(prev =>
            prev.map(tx =>
              tx.id === payload.new.id ? (payload.new as POSTransaction) : tx
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId]);

  async function fetchTransactions(userId: string) {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('merchant_id', userId)
        .order('transaction_date', { ascending: false })
        .limit(500);  // raised from 50 – gives accurate analytics stats

      if (fetchError) throw fetchError;

      setTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return {
    transactions,
    loading,
    error,
    refetch: () => {
      if (merchantId) fetchTransactions(merchantId);
    },
  };
}

/**
 * Hook for POS integrations management
 */
export function usePOSIntegrations() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntegrations();

    // Re-fetch whenever admin changes the status (approve/keep)
    const channel = supabase
      .channel('pos_integrations_user')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pos_integrations' },
        () => { fetchIntegrations(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchIntegrations() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from('pos_integrations')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'disconnect_requested']);

      setIntegrations(data || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function requestDisconnect(id: string) {
    try {
      const { error } = await supabase
        .from('pos_integrations')
        .update({ status: 'disconnect_requested' })
        .eq('id', id);

      if (error) throw error;

      await fetchIntegrations();
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  return {
    integrations,
    loading,
    refetch: fetchIntegrations,
    disconnect: requestDisconnect,
  };
}
