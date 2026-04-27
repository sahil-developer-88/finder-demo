
import { useState, useEffect, useMemo, useRef } from 'react';
import BackButton from '@/components/ui/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, CalendarDays, Plug, ArrowLeftRight, CreditCard,
  Store, Plus, Trash2, TrendingUp, DollarSign, BarChart2,
  ArrowUpRight, ArrowDownRight, Loader2, ChevronDown,
  RefreshCw, Bell, AlertTriangle, Clock, Search, ChevronLeft, ChevronRight, Download, Scale, MessageSquare,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { POSConnectionWizard } from './POSConnectionWizard';
import { POSSetupReminder } from './POSSetupReminder';
import { usePOSTransactions, usePOSIntegrations } from '@/hooks/usePOSTransactions';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import CreatePaymentRequest from '@/components/payment-requests/CreatePaymentRequest';
import PaymentRequestList from '@/components/payment-requests/PaymentRequestList';
import MerchantDisputesTab from './MerchantDisputesTab';
import MerchantSupportTab from './MerchantSupportTab';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface DailySummaryRow {
  summary_date: string;
  total_sales: number;
  barter_amount: number;
  cash_amount: number;
  tx_count: number;
}

interface BarterTransaction {
  id: string;
  from_user_id: string;
  to_user_id: string;
  points_amount: number;
  service_description: string | null;
  status: string;
  transaction_type: string;
  created_at: string;
}


interface UnifiedTransaction {
  id: string;
  date: string;
  totalAmount: number;
  barterAmount: number;
  cashAmount: number;
  source: 'pos' | 'barter';
  provider?: string;
  status: string;
  description?: string;
  direction: 'cr' | 'dr';
  otherUserId?: string;
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id: 'requests',
    icon: CreditCard,
    label: 'Payment Requests',
    subs: ['Analytics', 'Daily Summary', 'Integrations', 'Transactions', 'Trade: Send / Request'],
  },
  {
    id: 'disputes',
    icon: Scale,
    label: 'Disputes',
    subs: [],
  },
  {
    id: 'support',
    icon: MessageSquare,
    label: 'Support',
    subs: [],
  },
];

// ─── Helper Components ────────────────────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value, sub, color = 'emerald', trend,
}: {
  icon: any; label: string; value: string | number; sub?: string; color?: string; trend?: number;
}) => {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-50',
    blue:    'text-blue-500 bg-blue-50',
    amber:   'text-amber-500 bg-amber-50',
    purple:  'text-purple-500 bg-purple-50',
    indigo:  'text-indigo-500 bg-indigo-50',
  };
  const cls = colors[color] || colors.emerald;
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-xl ${cls}`}>
            <Icon className={`h-5 w-5 ${cls.split(' ')[0]}`} />
          </div>
          {trend !== undefined && (
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

const Pill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    completed:  'bg-emerald-100 text-emerald-700',
    active:     'bg-emerald-100 text-emerald-700',
    pending:    'bg-amber-100 text-amber-700',
    failed:     'bg-red-100 text-red-700',
    pos:        'bg-blue-100 text-blue-700',
    barter:     'bg-purple-100 text-purple-700',
    synced:     'bg-emerald-100 text-emerald-700',
    lightspeed: 'bg-indigo-100 text-indigo-700',
    shopify:    'bg-green-100 text-green-700',
    square:     'bg-blue-100 text-blue-700',
    clover:     'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status.toLowerCase()] || 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);
const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-4 py-3 text-sm text-gray-700 ${right ? 'text-right' : ''}`}>{children}</td>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const MerchantDashboard = ({ embedded = false, externalSub }: { embedded?: boolean; externalSub?: string } = {}) => {
  const [activeSection, setActiveSection] = useState('requests');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['requests']));
  const [internalSub, setInternalSub] = useState('Analytics');
  const requestSub = externalSub ?? internalSub;
  const setRequestSub = (s: string) => { if (!externalSub) setInternalSub(s); };

  const [wizardOpen, setWizardOpen] = useState(false);
  const [showPOSReminder, setShowPOSReminder] = useState(false);
  const [requestListKey, setRequestListKey] = useState(0);
  const [posSetupPreference, setPosSetupPreference] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummaryRow[]>([]);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  const [barterTransactions, setBarterTransactions] = useState<BarterTransaction[]>([]);
  const [barterTxLoading, setBarterTxLoading] = useState(false);
  const [txSearch, setTxSearch] = useState('');
  const [txFilter, setTxFilter] = useState<'all' | 'cr' | 'dr' | 'pos' | 'barter'>('all');
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 10;
  const [allTxSearch, setAllTxSearch] = useState('');
  const [allTxFilter, setAllTxFilter] = useState<'all' | 'cr' | 'dr' | 'pos' | 'barter'>('all');
  const [allTxPage, setAllTxPage] = useState(1);
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

  // ── Reporting state ───────────────────────────────────────────────────────
  const [summaryView, setSummaryView] = useState<'daily' | 'monthly'>('daily');
  const [summaryMonth, setSummaryMonth] = useState(() => new Date().getMonth() + 1);
  const [summaryYear, setSummaryYear] = useState(() => new Date().getFullYear());
  const [monthlyRangeSummary, setMonthlyRangeSummary] = useState<DailySummaryRow[]>([]);
  const [monthlyRangeLoading, setMonthlyRangeLoading] = useState(false);
  const [monthlyEarnings, setMonthlyEarnings] = useState<{ month_label: string; month_num: number; earned: number; spent: number }[]>([]);
  const [monthlyEarningsLoading, setMonthlyEarningsLoading] = useState(false);
  const [earningsYear, setEarningsYear] = useState(() => new Date().getFullYear());

  const { transactions, loading: txLoading } = usePOSTransactions();
  const { integrations, loading: intLoading, disconnect, refetch: refetchIntegrations } = usePOSIntegrations();
  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; provider: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const { pendingReceivedCount } = usePaymentRequests();
  const { toast } = useToast();
  const { user } = useAuth();

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const provider = params.get('provider');

    if (oauthSuccess === 'true' && provider) {
      window.history.replaceState({}, '', window.location.pathname);
      toast({ title: 'Success!', description: `Your ${provider.toUpperCase()} POS has been connected successfully.` });
      refetchIntegrations();
    }
    if (oauthError) {
      window.history.replaceState({}, '', window.location.pathname);
      toast({ title: 'Connection Error', description: decodeURIComponent(oauthError), variant: 'destructive' });
    }
  }, [toast, refetchIntegrations]);

  // Fetch POS setup preference
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('pos_setup_preference')
        .eq('user_id', user.id)
        .single();
      if (profile) {
        setPosSetupPreference(profile.pos_setup_preference);
        setShowPOSReminder(
          (profile.pos_setup_preference === 'pending' || profile.pos_setup_preference === 'later') &&
          integrations.length === 0
        );
      }
    };
    fetchProfile();
  }, [user, integrations]);

  // Fetch daily summary + barter transactions (live)
  useEffect(() => {
    if (!user) return;

    const fetchDailySummary = async () => {
      setDailySummaryLoading(true);
      try {
        const { data, error } = await supabase.rpc('merchant_get_daily_summary', { p_days: 7 });
        if (error) throw error;
        setDailySummary((data as DailySummaryRow[]) || []);
      } catch (err) {
        console.error('Error fetching daily summary:', err);
      } finally {
        setDailySummaryLoading(false);
      }
    };

    const fetchBarterTransactions = async () => {
      setBarterTxLoading(true);
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .or(`to_user_id.eq.${user.id},from_user_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        setBarterTransactions((data as BarterTransaction[]) || []);
      } catch (err) {
        console.error('Error fetching barter transactions:', err);
      } finally {
        setBarterTxLoading(false);
      }
    };

    fetchDailySummary();
    fetchBarterTransactions();

    const channel = supabase
      .channel(`merchant_transactions_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `to_user_id=eq.${user.id}` },
        () => { fetchBarterTransactions(); fetchDailySummary(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `from_user_id=eq.${user.id}` },
        () => { fetchBarterTransactions(); fetchDailySummary(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch profiles for other users in barter transactions
  useEffect(() => {
    if (!user || barterTransactions.length === 0) return;
    const otherIds = [...new Set(
      barterTransactions.flatMap(tx => [tx.from_user_id, tx.to_user_id]).filter(id => id !== user.id)
    )];
    if (otherIds.length === 0) return;
    supabase
      .from('profiles')
      .select('user_id, full_name, business_name')
      .in('user_id', otherIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach(p => {
          const parts = [p.full_name, p.business_name].filter(Boolean);
          map[p.user_id] = parts.join(' · ') || 'Unknown';
        });
        setUserProfiles(map);
      });
  }, [barterTransactions, user]);

  const handleDismissReminder = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ pos_setup_preference: 'not_needed' }).eq('user_id', user.id);
    setShowPOSReminder(false);
    setPosSetupPreference('not_needed');
    toast({ title: 'Reminder dismissed', description: 'You can still connect your POS anytime from Integrations.' });
  };

  // ─── Reporting helpers ────────────────────────────────────────────────────────
  const fetchMonthlyRangeSummary = async (year: number, month: number) => {
    setMonthlyRangeLoading(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    const { data, error } = await supabase.rpc('merchant_get_summary_range', { p_start: start, p_end: end });
    if (!error) setMonthlyRangeSummary((data as DailySummaryRow[]) || []);
    setMonthlyRangeLoading(false);
  };

  const fetchMonthlyEarnings = async (year: number) => {
    setMonthlyEarningsLoading(true);
    const { data, error } = await supabase.rpc('merchant_get_yearly_barter_earnings', { p_year: year });
    if (!error) setMonthlyEarnings(data || []);
    setMonthlyEarningsLoading(false);
  };

  const exportCSV = (rows: typeof unifiedTransactions, filename: string) => {
    const headers = ['Date', 'Type', 'Direction', 'Total', 'Barter', 'Cash', 'Status', 'Description'];
    const csvRows = rows.map(tx => [
      format(new Date(tx.date), 'yyyy-MM-dd HH:mm'),
      tx.source,
      tx.direction === 'cr' ? 'Credit' : 'Debit',
      tx.totalAmount.toFixed(2),
      tx.barterAmount.toFixed(2),
      tx.cashAmount.toFixed(2),
      tx.status,
      tx.description || '',
    ]);
    const csv = [headers, ...csvRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch monthly earnings when Analytics tab is active or year changes
  const prevEarningsYearRef = useRef(earningsYear);
  useEffect(() => {
    if (!user) return;
    fetchMonthlyEarnings(earningsYear);
    prevEarningsYearRef.current = earningsYear;
  }, [user, earningsYear]);

  // ─── Computed values ─────────────────────────────────────────────────────────
  const todayStr = new Date().toDateString();

  // All barter transactions (scanner + payment requests + sends)
  const allBarterTx = barterTransactions.filter(tx => tx.status === 'completed');

  const posTodayBarter     = transactions.filter(tx => new Date(tx.transaction_date).toDateString() === todayStr).reduce((s, tx) => s + tx.barter_amount, 0);
  const barterTodayBarter  = allBarterTx.filter(tx => new Date(tx.created_at).toDateString() === todayStr).reduce((s, tx) => s + (tx.points_amount || 0), 0);
  const totalBarterToday   = posTodayBarter + barterTodayBarter;

  const posTodayCount      = transactions.filter(tx => new Date(tx.transaction_date).toDateString() === todayStr).length;
  const barterTodayCount   = allBarterTx.filter(tx => new Date(tx.created_at).toDateString() === todayStr).length;
  const todayTxCount       = posTodayCount + barterTodayCount;

  const avgBarterPct   = transactions.length > 0 ? transactions.reduce((s, tx) => s + tx.barter_percentage, 0) / transactions.length : 0;
  const totalSales     = transactions.reduce((s, tx) => s + tx.total_amount, 0);
  const totalBarter    = transactions.reduce((s, tx) => s + tx.barter_amount, 0) + allBarterTx.reduce((s, tx) => s + (tx.points_amount || 0), 0);
  const totalCash      = totalSales - transactions.reduce((s, tx) => s + tx.barter_amount, 0);
  const barterSplitPct = (totalSales + allBarterTx.reduce((s, tx) => s + (tx.points_amount || 0), 0)) > 0
    ? (totalBarter / (totalSales + allBarterTx.reduce((s, tx) => s + (tx.points_amount || 0), 0))) * 100
    : 0;

  const mergedDailySummary = useMemo(() => {
    const byDate = new Map<string, DailySummaryRow>();
    dailySummary.forEach(row => byDate.set(row.summary_date, { ...row }));
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    allBarterTx
      .filter(tx => new Date(tx.created_at).getTime() >= sevenDaysAgo)
      .forEach(tx => {
        const dateStr  = tx.created_at.split('T')[0];
        const amt      = tx.points_amount || 0;
        const existing = byDate.get(dateStr);
        byDate.set(dateStr, existing ? {
          ...existing,
          total_sales:   existing.total_sales + amt,
          barter_amount: existing.barter_amount + amt,
          cash_amount:   existing.cash_amount,
          tx_count:      existing.tx_count + 1,
        } : { summary_date: dateStr, total_sales: amt, barter_amount: amt, cash_amount: 0, tx_count: 1 });
      });
    return Array.from(byDate.values()).sort((a, b) => new Date(b.summary_date).getTime() - new Date(a.summary_date).getTime());
  }, [dailySummary, allBarterTx]);

  const unifiedTransactions: UnifiedTransaction[] = [
    ...transactions.map(tx => ({
      id: tx.id, date: tx.transaction_date, totalAmount: tx.total_amount,
      barterAmount: tx.barter_amount, cashAmount: tx.total_amount - tx.barter_amount,
      source: 'pos' as const, provider: tx.pos_provider, status: tx.status,
      direction: 'cr' as const, // POS: merchant always receives
    })),
    ...allBarterTx.map(tx => ({
      id: tx.id, date: tx.created_at, totalAmount: tx.points_amount || 0,
      barterAmount: tx.points_amount || 0, cashAmount: 0,
      source: 'barter' as const, status: tx.status, description: tx.service_description ?? undefined,
      direction: tx.to_user_id === user?.id ? 'cr' as const : 'dr' as const,
      otherUserId: tx.to_user_id === user?.id ? tx.from_user_id : tx.to_user_id,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={embedded ? '' : 'flex bg-gray-50 overflow-hidden'} style={embedded ? {} : { height: 'calc(100vh - 64px)' }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────────── */}
      {!embedded && <aside className="w-56 bg-[#0f1117] flex flex-col shrink-0 overflow-hidden">
        <div className="h-14 flex items-center px-5 border-b border-white/10 shrink-0">
          <Store className="h-5 w-5 text-emerald-400 mr-2.5" />
          <span className="text-white font-bold">Merchant</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ id, icon: Icon, label, subs }: any) => {
            const active = activeSection === id;
            const hasSubs = subs.length > 0;
            return (
              <div key={id}>
                <button
                  onClick={() => {
                    setExpandedSections(prev => {
                      const next = new Set(prev);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    });
                    setActiveSection(id);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    active
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-400' : ''}`} />
                  <span className="flex-1">{label}</span>
                  {id === 'requests' && pendingReceivedCount > 0 && (
                    <span className="h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {pendingReceivedCount}
                    </span>
                  )}
                  {hasSubs && (
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expandedSections.has(id) ? 'rotate-180 text-emerald-400' : 'text-gray-600'}`} />
                  )}
                </button>

                {hasSubs && expandedSections.has(id) && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                    {subs.map((sub: string) => (
                      <button
                        key={sub}
                        onClick={() => setRequestSub(sub)}
                        className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-all ${
                          requestSub === sub && activeSection === id
                            ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                            : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <span className="text-emerald-400 text-xs font-bold">
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-300 truncate">{user?.email ?? '—'}</p>
            </div>
          </div>
        </div>
      </aside>}

      {/* ── Main Content ────────────────────────────────────────────────────────── */}
      <main className={embedded ? 'space-y-6' : 'flex-1 overflow-y-auto p-6'}>
        {!embedded && <div className="mb-4"><BackButton /></div>}

        {showPOSReminder && (
          <div className="mb-6">
            <POSSetupReminder onConnect={() => setWizardOpen(true)} onDismiss={handleDismissReminder} />
          </div>
        )}

        {/* ── ANALYTICS ──────────────────────────────────────────────────────── */}
        {requestSub === 'Analytics' && (
          <div className="space-y-6">
            <SectionTitle title="Analytics" sub="Real-time barter and POS transaction overview" />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={DollarSign}  label="Today's Barter Volume"  value={`$${totalBarterToday.toFixed(2)}`}  color="emerald" />
              <StatCard icon={BarChart2}   label="Transactions Today"     value={todayTxCount}                        color="blue"   sub={`${posTodayCount} POS · ${barterTodayCount} barter`} />
              <StatCard icon={TrendingUp}  label="Avg Barter %"           value={`${avgBarterPct.toFixed(1)}%`}       color="purple" sub="POS only" />
              <StatCard icon={Plug}        label="POS Connected"          value={integrations.length}                 color="indigo" />
            </div>

            {/* Barter vs Cash split */}
            {transactions.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-900">Barter vs Cash Split</CardTitle>
                  <p className="text-xs text-gray-400">Last 500 POS transactions</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-3 rounded-full overflow-hidden bg-gray-100 flex">
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${barterSplitPct}%` }} />
                    <div className="bg-blue-400 h-full flex-1" />
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Barter ${totalBarter.toFixed(2)} ({barterSplitPct.toFixed(1)}%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" />
                      Cash ${totalCash.toFixed(2)} ({(100 - barterSplitPct).toFixed(1)}%)
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly barter earnings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base font-semibold text-gray-900">Monthly Barter Earnings</CardTitle>
                    <p className="text-xs text-gray-400 mt-0.5">Credits earned vs spent per month</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={earningsYear}
                      onChange={e => setEarningsYear(Number(e.target.value))}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-400 bg-white"
                    >
                      {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <button
                      disabled={monthlyEarnings.length === 0}
                      onClick={() => {
                        const headers = ['Month', 'Earned', 'Spent', 'Net'];
                        const rows = monthlyEarnings.map(r => [r.month_label, r.earned.toFixed(2), r.spent.toFixed(2), (r.earned - r.spent).toFixed(2)]);
                        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `barter-earnings-${earningsYear}.csv`; a.click(); URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="h-3.5 w-3.5" /> CSV
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {monthlyEarningsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : monthlyEarnings.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">No earnings data for {earningsYear}.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-y bg-gray-50">
                        <tr>
                          <TH>Month</TH>
                          <TH right>Earned</TH>
                          <TH right>Spent</TH>
                          <TH right>Net</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyEarnings.map(row => {
                          const net = row.earned - row.spent;
                          return (
                            <tr key={row.month_num} className="border-b last:border-0 hover:bg-gray-50">
                              <TD>{row.month_label}</TD>
                              <TD right><span className="text-emerald-600 font-medium">${Number(row.earned).toFixed(2)}</span></TD>
                              <TD right><span className="text-red-500">${Number(row.spent).toFixed(2)}</span></TD>
                              <TD right><span className={net >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>{net >= 0 ? '+' : ''}${net.toFixed(2)}</span></TD>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-semibold bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-700">Total</td>
                          <td className="px-4 py-2 text-sm text-emerald-600 text-right">${monthlyEarnings.reduce((s, r) => s + Number(r.earned), 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-red-500 text-right">${monthlyEarnings.reduce((s, r) => s + Number(r.spent), 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right">
                            {(() => { const n = monthlyEarnings.reduce((s, r) => s + Number(r.earned) - Number(r.spent), 0); return <span className={n >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>{n >= 0 ? '+' : ''}${n.toFixed(2)}</span>; })()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent transactions */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base font-semibold text-gray-900">Recent Transactions</CardTitle>
                  {/* Search */}
                  <div className="relative w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      value={txSearch}
                      onChange={e => { setTxSearch(e.target.value); setTxPage(1); }}
                      placeholder="Search description..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 bg-white"
                    />
                  </div>
                </div>
                {/* Filter chips */}
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {(['all', 'cr', 'dr', 'pos', 'barter'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setTxFilter(f); setTxPage(1); }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        txFilter === f
                          ? f === 'cr' ? 'bg-emerald-500 text-white'
                          : f === 'dr' ? 'bg-red-500 text-white'
                          : 'bg-gray-800 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'cr' ? 'Credit' : f === 'dr' ? 'Debit' : f === 'pos' ? 'POS' : 'Barter'}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {txLoading || barterTxLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (() => {
                  const displayed = unifiedTransactions.filter(tx => {
                    if (txFilter === 'cr') return tx.direction === 'cr';
                    if (txFilter === 'dr') return tx.direction === 'dr';
                    if (txFilter === 'pos') return tx.source === 'pos';
                    if (txFilter === 'barter') return tx.source === 'barter';
                    return true;
                  }).filter(tx => {
                    if (!txSearch.trim()) return true;
                    const q = txSearch.toLowerCase();
                    return (
                      (tx.description?.toLowerCase().includes(q)) ||
                      (tx.provider?.toLowerCase().includes(q)) ||
                      tx.source.includes(q) ||
                      tx.status.includes(q)
                    );
                  });
                  const totalPages = Math.ceil(displayed.length / TX_PAGE_SIZE);
                  const paginated = displayed.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);
                  return displayed.length === 0 ? (
                    <p className="text-center text-gray-400 py-10 text-sm">No transactions found.</p>
                  ) : (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-y bg-gray-50">
                        <tr>
                          <TH>Date</TH>
                          <TH>User</TH>
                          <TH>Source</TH>
                          <TH right>Total</TH>
                          <TH right>Credit</TH>
                          <TH right>Debit</TH>
                          <TH right>Barter</TH>
                          <TH right>Cash</TH>
                          <TH>Status</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map(tx => (
                          <tr key={`${tx.source}-${tx.id}`} className="border-b last:border-0 hover:bg-gray-50">
                            <TD>{format(new Date(tx.date), 'MMM d, h:mm a')}</TD>
                            <TD>
                              {tx.otherUserId
                                ? (() => {
                                    const profile = userProfiles[tx.otherUserId];
                                    const [name, biz] = profile ? profile.split(' · ') : ['...', undefined];
                                    return (
                                      <div>
                                        <p className="font-medium text-gray-800 text-sm leading-tight">{name}</p>
                                        {biz && <p className="text-xs text-gray-400 leading-tight">{biz}</p>}
                                      </div>
                                    );
                                  })()
                                : <span className="text-gray-400 text-xs">POS Customer</span>}
                            </TD>
                            <TD><Pill status={tx.source === 'pos' ? (tx.provider || 'pos') : 'barter'} /></TD>
                            <TD right>${tx.totalAmount.toFixed(2)}</TD>
                            <TD right>
                              {tx.direction === 'cr'
                                ? <span className="text-emerald-600 font-semibold">+${tx.totalAmount.toFixed(2)}</span>
                                : <span className="text-gray-300">—</span>}
                            </TD>
                            <TD right>
                              {tx.direction === 'dr'
                                ? <span className="text-red-500 font-semibold">-${tx.totalAmount.toFixed(2)}</span>
                                : <span className="text-gray-300">—</span>}
                            </TD>
                            <TD right><span className="text-emerald-600 font-medium">${tx.barterAmount.toFixed(2)}</span></TD>
                            <TD right>${tx.cashAmount.toFixed(2)}</TD>
                            <TD><Pill status={tx.status} /></TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-2">
                      <p className="text-xs text-gray-500">
                        {(txPage - 1) * TX_PAGE_SIZE + 1}–{Math.min(txPage * TX_PAGE_SIZE, displayed.length)} of {displayed.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setTxPage(p => Math.max(1, p - 1))}
                          disabled={txPage === 1}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setTxPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                              p === txPage
                                ? 'bg-emerald-600 text-white'
                                : 'border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          onClick={() => setTxPage(p => Math.min(totalPages, p + 1))}
                          disabled={txPage === totalPages}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── DAILY SUMMARY ───────────────────────────────────────────────────── */}
        {requestSub === 'Daily Summary' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {summaryView === 'daily' ? 'Daily Summary' : 'Monthly Statement'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {summaryView === 'daily' ? 'Last 7 days of barter and POS activity' : 'Day-by-day breakdown for selected month'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* View toggle */}
                <div className="flex items-center bg-gray-100 rounded-xl p-1">
                  {(['daily', 'monthly'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setSummaryView(v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${summaryView === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {/* Month / Year pickers (monthly view only) */}
                {summaryView === 'monthly' && (
                  <>
                    <select
                      value={summaryMonth}
                      onChange={e => { const m = Number(e.target.value); setSummaryMonth(m); fetchMonthlyRangeSummary(summaryYear, m); }}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-400 bg-white"
                    >
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((name, i) => (
                        <option key={i + 1} value={i + 1}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={summaryYear}
                      onChange={e => { const y = Number(e.target.value); setSummaryYear(y); fetchMonthlyRangeSummary(y, summaryMonth); }}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-400 bg-white"
                    >
                      {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => fetchMonthlyRangeSummary(summaryYear, summaryMonth)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition-all"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Load
                    </button>
                  </>
                )}
                {/* CSV export */}
                <button
                  disabled={summaryView === 'daily' ? mergedDailySummary.length === 0 : monthlyRangeSummary.length === 0}
                  onClick={() => {
                    const data = summaryView === 'daily' ? mergedDailySummary : monthlyRangeSummary;
                    const headers = ['Date', 'Total Sales', 'Barter', 'Cash', '# Transactions'];
                    const rows = data.map(r => [r.summary_date, Number(r.total_sales).toFixed(2), Number(r.barter_amount).toFixed(2), Number(r.cash_amount).toFixed(2), Number(r.tx_count)]);
                    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url;
                    a.download = summaryView === 'daily' ? `daily-summary-${format(new Date(), 'yyyy-MM-dd')}.csv` : `monthly-statement-${summaryYear}-${String(summaryMonth).padStart(2,'0')}.csv`;
                    a.click(); URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            </div>

            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                {(summaryView === 'daily' ? (dailySummaryLoading || barterTxLoading) : monthlyRangeLoading) ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (() => {
                  const data = summaryView === 'daily' ? mergedDailySummary : monthlyRangeSummary;
                  const emptyMsg = summaryView === 'daily'
                    ? 'No transactions in the last 7 days.'
                    : `No transactions for ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][summaryMonth - 1]} ${summaryYear}. Click Load to fetch data.`;
                  return data.length === 0 ? (
                    <p className="text-center text-gray-400 py-10 text-sm">{emptyMsg}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-y bg-gray-50">
                          <tr>
                            <TH>Date</TH>
                            <TH right>Total Sales</TH>
                            <TH right>Barter</TH>
                            <TH right>Cash / Card</TH>
                            <TH right># Transactions</TH>
                          </tr>
                        </thead>
                        <tbody>
                          {data.map(row => {
                            const barterPct = row.total_sales > 0 ? (row.barter_amount / row.total_sales) * 100 : 0;
                            return (
                              <tr key={row.summary_date} className="border-b last:border-0 hover:bg-gray-50">
                                <TD>{format(new Date(row.summary_date + 'T12:00:00'), summaryView === 'daily' ? 'EEE, MMM d' : 'MMM d, yyyy')}</TD>
                                <TD right>${Number(row.total_sales).toFixed(2)}</TD>
                                <TD right>
                                  <span className="text-emerald-600 font-medium">${Number(row.barter_amount).toFixed(2)}</span>
                                  <span className="text-gray-400 ml-1 text-xs">({barterPct.toFixed(0)}%)</span>
                                </TD>
                                <TD right>${Number(row.cash_amount).toFixed(2)}</TD>
                                <TD right>{Number(row.tx_count)}</TD>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t font-semibold bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-700">Total</td>
                            <td className="px-4 py-2 text-sm text-gray-700 text-right">${data.reduce((s, r) => s + Number(r.total_sales), 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-emerald-600 text-right">${data.reduce((s, r) => s + Number(r.barter_amount), 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 text-right">${data.reduce((s, r) => s + Number(r.cash_amount), 0).toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700 text-right">{data.reduce((s, r) => s + Number(r.tx_count), 0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── INTEGRATIONS ────────────────────────────────────────────────────── */}
        {requestSub === 'Integrations' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <SectionTitle title="Integrations" sub="Manage your connected POS systems" />
              <Button onClick={() => setWizardOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
                <Plus className="w-4 h-4 mr-2" /> Connect POS
              </Button>
            </div>

            {intLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : integrations.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Plug className="h-10 w-10 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium mb-1">No POS systems connected yet</p>
                  <p className="text-gray-400 text-sm mb-6">Connect your POS to start syncing products and transactions.</p>
                  <Button onClick={() => setWizardOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Connect Your First POS
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <table className="w-full">
                    <thead className="border-y bg-gray-50">
                      <tr>
                        <TH>Provider</TH>
                        <TH>Store ID</TH>
                        <TH>Status</TH>
                        <TH>Connected</TH>
                        <TH right>Actions</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {integrations.map(integration => (
                        <tr key={integration.id} className="border-b last:border-0 hover:bg-gray-50">
                          <TD>
                            <div className="flex items-center gap-2">
                              <Plug className="h-4 w-4 text-gray-400" />
                              <span className="font-medium capitalize">{integration.provider}</span>
                            </div>
                          </TD>
                          <TD><span className="text-gray-500 font-mono text-xs">{integration.store_id || '—'}</span></TD>
                          <TD>
                            {integration.status === 'disconnect_requested' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" /> Pending Disconnect
                              </span>
                            ) : (
                              <Pill status="active" />
                            )}
                          </TD>
                          <TD>{format(new Date(integration.created_at), 'MMM d, yyyy')}</TD>
                          <TD right>
                            {integration.status === 'disconnect_requested' ? (
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-xs text-amber-600 font-medium">Awaiting approval</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-xs"
                                  onClick={async () => {
                                    try {
                                      const { error } = await supabase
                                        .from('pos_integrations')
                                        .update({ status: 'active' })
                                        .eq('id', integration.id);
                                      if (error) throw error;
                                      refetchIntegrations();
                                      toast({ title: 'Request Cancelled', description: 'Your disconnect request has been cancelled.' });
                                    } catch (err: any) {
                                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                                    }
                                  }}
                                >
                                  Cancel Request
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDisconnectTarget({ id: integration.id, provider: integration.provider })}
                              >
                                <Trash2 className="w-4 h-4 mr-1" /> Disconnect
                              </Button>
                            )}
                          </TD>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── TRANSACTIONS ────────────────────────────────────────────────────── */}
        {requestSub === 'Transactions' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">All Transactions</h2>
                <p className="text-sm text-gray-500 mt-0.5">POS-synced and direct barter transactions combined</p>
              </div>
              <button
                disabled={unifiedTransactions.length === 0}
                onClick={() => exportCSV(unifiedTransactions, `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={ArrowUpRight}
                label="Total Credits"
                value={`$${unifiedTransactions.filter(t => t.direction === 'cr').reduce((s, t) => s + t.totalAmount, 0).toFixed(2)}`}
                sub={`${unifiedTransactions.filter(t => t.direction === 'cr').length} transactions`}
                color="emerald"
              />
              <StatCard
                icon={ArrowDownRight}
                label="Total Debits"
                value={`$${unifiedTransactions.filter(t => t.direction === 'dr').reduce((s, t) => s + t.totalAmount, 0).toFixed(2)}`}
                sub={`${unifiedTransactions.filter(t => t.direction === 'dr').length} transactions`}
                color="amber"
              />
              <StatCard
                icon={TrendingUp}
                label="Total Barter"
                value={`$${unifiedTransactions.reduce((s, t) => s + t.barterAmount, 0).toFixed(2)}`}
                sub="credits exchanged"
                color="purple"
              />
              <StatCard
                icon={BarChart2}
                label="All Transactions"
                value={unifiedTransactions.length}
                sub={`${unifiedTransactions.filter(t => t.source === 'pos').length} POS · ${unifiedTransactions.filter(t => t.source === 'barter').length} barter`}
                color="blue"
              />
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base font-semibold text-gray-900">Transactions</CardTitle>
                  <div className="relative w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      value={allTxSearch}
                      onChange={e => { setAllTxSearch(e.target.value); setAllTxPage(1); }}
                      placeholder="Search description..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {(['all', 'pos', 'barter'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setAllTxFilter(f as any); setAllTxPage(1); }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        allTxFilter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'pos' ? 'POS' : 'Barter'}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {txLoading || barterTxLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (() => {
                  const displayed = unifiedTransactions.filter(tx => {
                    if (allTxFilter === 'pos') return tx.source === 'pos';
                    if (allTxFilter === 'barter') return tx.source === 'barter';
                    return true;
                  }).filter(tx => {
                    if (!allTxSearch.trim()) return true;
                    const q = allTxSearch.toLowerCase();
                    return (
                      tx.description?.toLowerCase().includes(q) ||
                      tx.provider?.toLowerCase().includes(q) ||
                      tx.source.includes(q) ||
                      tx.status.includes(q)
                    );
                  });
                  const totalPages = Math.ceil(displayed.length / TX_PAGE_SIZE);
                  const paginated = displayed.slice((allTxPage - 1) * TX_PAGE_SIZE, allTxPage * TX_PAGE_SIZE);
                  return displayed.length === 0 ? (
                    <p className="text-center text-gray-400 py-10 text-sm">No transactions found.</p>
                  ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-y bg-gray-50">
                          <tr>
                            <TH>Date</TH>
                            <TH>User</TH>
                            <TH>Source</TH>
                            <TH right>Total</TH>
                            <TH right>Credit</TH>
                            <TH right>Debit</TH>
                            <TH right>Barter</TH>
                            <TH right>Cash</TH>
                            <TH right>Barter %</TH>
                            <TH>Status</TH>
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.map(tx => (
                            <tr key={`${tx.source}-${tx.id}`} className="border-b last:border-0 hover:bg-gray-50">
                              <TD>{format(new Date(tx.date), 'MMM d, h:mm a')}</TD>
                              <TD>
                                {tx.otherUserId
                                  ? (() => {
                                      const profile = userProfiles[tx.otherUserId];
                                      const [name, biz] = profile ? profile.split(' · ') : ['...', undefined];
                                      return (
                                        <div>
                                          <p className="font-medium text-gray-800 text-sm leading-tight">{name}</p>
                                          {biz && <p className="text-xs text-gray-400 leading-tight">{biz}</p>}
                                        </div>
                                      );
                                    })()
                                  : <span className="text-gray-400 text-xs">POS Customer</span>}
                              </TD>
                              <TD><Pill status={tx.source === 'pos' ? (tx.provider || 'pos') : 'barter'} /></TD>
                              <TD right>${tx.totalAmount.toFixed(2)}</TD>
                              <TD right>
                                {tx.direction === 'cr'
                                  ? <span className="text-emerald-600 font-semibold">+${tx.totalAmount.toFixed(2)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </TD>
                              <TD right>
                                {tx.direction === 'dr'
                                  ? <span className="text-red-500 font-semibold">-${tx.totalAmount.toFixed(2)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </TD>
                              <TD right><span className="text-emerald-600 font-medium">${tx.barterAmount.toFixed(2)}</span></TD>
                              <TD right>${tx.cashAmount.toFixed(2)}</TD>
                              <TD right>{tx.totalAmount > 0 ? ((tx.barterAmount / tx.totalAmount) * 100).toFixed(1) : '0.0'}%</TD>
                              <TD><Pill status={tx.status} /></TD>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t mt-2">
                        <p className="text-xs text-gray-500">
                          {(allTxPage - 1) * TX_PAGE_SIZE + 1}–{Math.min(allTxPage * TX_PAGE_SIZE, displayed.length)} of {displayed.length}
                        </p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setAllTxPage(p => Math.max(1, p - 1))} disabled={allTxPage === 1}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => setAllTxPage(p)}
                              className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${p === allTxPage ? 'bg-emerald-600 text-white' : 'border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'}`}>
                              {p}
                            </button>
                          ))}
                          <button onClick={() => setAllTxPage(p => Math.min(totalPages, p + 1))} disabled={allTxPage === totalPages}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TRADE: SEND / REQUEST ───────────────────────────────────────────── */}
        {requestSub === 'Trade: Send / Request' && (
          <div className="space-y-6">
            <SectionTitle title="Trade: Send / Request" sub="Create and manage barter payment requests" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CreatePaymentRequest mode="request" onSuccess={() => setRequestListKey(k => k + 1)} />
              <CreatePaymentRequest mode="send" onSuccess={() => setRequestListKey(k => k + 1)} />
            </div>
            <PaymentRequestList key={requestListKey} />
          </div>
        )}

        {/* ── DISPUTES ────────────────────────────────────────────────────────── */}
        {activeSection === 'disputes' && <MerchantDisputesTab />}

        {/* ── SUPPORT ─────────────────────────────────────────────────────────── */}
        {activeSection === 'support' && <MerchantSupportTab />}
      </main>

      <POSConnectionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => refetchIntegrations()}
      />

      {/* POS Disconnect Confirmation Dialog */}
      <Dialog open={!!disconnectTarget} onOpenChange={(open) => { if (!open) setDisconnectTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Request POS Disconnect
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect your <span className="font-semibold capitalize">{disconnectTarget?.provider}</span> integration?
              This will send a request to the admin for approval — your POS will remain active until they approve it.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            Once approved, your POS will stop syncing transactions and barter payments will no longer be processed automatically.
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              disabled={disconnecting}
              onClick={() => setDisconnectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={disconnecting}
              onClick={async () => {
                if (!disconnectTarget) return;
                setDisconnecting(true);
                try {
                  await disconnect(disconnectTarget.id);
                  toast({ title: 'Request Sent', description: 'Your disconnect request has been sent to the admin for approval.' });
                  setDisconnectTarget(null);
                } catch (err: any) {
                  toast({ title: 'Error', description: err.message || 'Failed to send request', variant: 'destructive' });
                } finally {
                  setDisconnecting(false);
                }
              }}
            >
              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Send Disconnect Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantDashboard;
