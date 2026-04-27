import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LedgerEntry {
  id: string;
  user_id: string;
  entry_type: 'credit' | 'debit';
  cash_amount: number;
  barter_amount: number;
  source: 'qr_scan' | 'checkout' | 'pos' | 'payment_request' | 'refund' | 'admin' | 'trade';
  reference_id: string | null;
  description: string | null;
  created_at: string;
  // computed client-side
  cash_balance_after: number;
  barter_balance_after: number;
}

export interface LedgerSummary {
  totalCashReceived: number;
  totalCashSent: number;
  totalBarterReceived: number;
  totalBarterSent: number;
  currentCashBalance: number;
  currentBarterBalance: number;
}

export function useLedger() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>({
    totalCashReceived: 0,
    totalCashSent: 0,
    totalBarterReceived: 0,
    totalBarterSent: 0,
    currentCashBalance: 0,
    currentBarterBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const computeRunningBalances = (raw: Omit<LedgerEntry, 'cash_balance_after' | 'barter_balance_after'>[]): LedgerEntry[] => {
    // Sort oldest → newest to compute running balance correctly
    const sorted = [...raw].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let cashBal = 0;
    let barterBal = 0;

    const withBalances = sorted.map(entry => {
      if (entry.entry_type === 'credit') {
        cashBal += entry.cash_amount;
        barterBal += entry.barter_amount;
      } else {
        cashBal -= entry.cash_amount;
        barterBal -= entry.barter_amount;
      }
      return {
        ...entry,
        cash_balance_after: Math.round(cashBal * 100) / 100,
        barter_balance_after: Math.round(barterBal * 100) / 100,
      };
    });

    // Return newest → oldest for display
    return withBalances.reverse();
  };

  const computeSummary = (data: LedgerEntry[]): LedgerSummary => {
    let totalCashReceived = 0;
    let totalCashSent = 0;
    let totalBarterReceived = 0;
    let totalBarterSent = 0;

    data.forEach(e => {
      if (e.entry_type === 'credit') {
        totalCashReceived += e.cash_amount;
        totalBarterReceived += e.barter_amount;
      } else {
        totalCashSent += e.cash_amount;
        totalBarterSent += e.barter_amount;
      }
    });

    const currentCashBalance = totalCashReceived - totalCashSent;
    const currentBarterBalance = totalBarterReceived - totalBarterSent;

    return {
      totalCashReceived: Math.round(totalCashReceived * 100) / 100,
      totalCashSent: Math.round(totalCashSent * 100) / 100,
      totalBarterReceived: Math.round(totalBarterReceived * 100) / 100,
      totalBarterSent: Math.round(totalBarterSent * 100) / 100,
      currentCashBalance: Math.round(currentCashBalance * 100) / 100,
      currentBarterBalance: Math.round(currentBarterBalance * 100) / 100,
    };
  };

  const fetchLedger = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('ledger_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    const raw = (data ?? []) as Omit<LedgerEntry, 'cash_balance_after' | 'barter_balance_after'>[];
    const enriched = computeRunningBalances(raw);
    setEntries(enriched);
    setSummary(computeSummary(enriched));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Real-time: new ledger entries appear instantly
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`ledger_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ledger_entries',
          filter: `user_id=eq.${user.id}`,
        },
        () => { fetchLedger(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchLedger]);

  return { entries, summary, loading, error, refetch: fetchLedger };
}
