import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Activity, AlertCircle, AlertTriangle, CheckCircle, ChevronRight,
  Download, Flag, Loader2, RefreshCw, RotateCcw, Search, Shield, Wallet, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StatCard, TH, TD, AdminPager, SHSearch } from './shared/ui';

const PAGE_SIZE = 10;

const TxMonSection = ({
  sub, setSub, data, loading,
  riskProfiles = [], reports = [], reportsLoading = false,
  onFlagUpdate, onReportAction, onSuspend,
}: {
  sub: string; setSub: (s: string) => void; data: any[]; loading: boolean;
  riskProfiles?: any[]; reports?: any[]; reportsLoading?: boolean;
  onFlagUpdate?:  (userId: string, status: 'none' | 'soft' | 'hard', signals: string[]) => Promise<void>;
  onReportAction?: (id: string, status: 'reviewed' | 'dismissed') => Promise<void>;
  onSuspend?:     (userId: string) => Promise<void>;
}) => {
  // Local data copy for optimistic updates
  const [localData, setLocalData] = useState<any[]>(data);
  useEffect(() => { setLocalData(data); }, [data]);

  // Per-transaction balance_after from ledger_entries (tx_id → balance_after)
  const [txBalanceMap, setTxBalanceMap] = useState<Record<string, number>>({});
  // Current wallet balance per merchant (for edit modal preview)
  const [balanceMap, setBalanceMap] = useState<Record<string, number>>({});
  useEffect(() => {
    const txIds = localData.map((t: any) => t.id).filter(Boolean) as string[];
    const merchantIds = [...new Set(localData.map((t: any) => t.merchant_id).filter(Boolean))] as string[];
    if (!txIds.length) return;

    // Fetch balance_after per transaction from ledger_entries
    supabase.from('ledger_entries')
      .select('reference_id, balance_after')
      .in('reference_id', txIds)
      .then(({ data: rows }) => {
        if (!rows) return;
        const map: Record<string, number> = {};
        rows.forEach((r: any) => {
          if (r.reference_id && r.balance_after != null) {
            map[r.reference_id] = Number(r.balance_after);
          }
        });
        setTxBalanceMap(map);
      });

    // Fetch current wallet balance per merchant (used in edit modal)
    if (merchantIds.length) {
      supabase.from('user_credits').select('user_id, available_credits').in('user_id', merchantIds)
        .then(({ data: rows }) => {
          if (!rows) return;
          const map: Record<string, number> = {};
          rows.forEach((r: any) => { map[r.user_id] = Number(r.available_credits) || 0; });
          setBalanceMap(map);
        });
    }
  }, [localData]);

  // Edit modal state
  const [editTx,     setEditTx]     = useState<any | null>(null);
  const [editFields, setEditFields] = useState<any>({});
  const [saving,     setSaving]     = useState(false);

  // Lifecycle drill-down state
  const [selectedTx,   setSelectedTx]   = useState<any | null>(null);
  const [txLedger,     setTxLedger]     = useState<any[]>([]);
  const [txLedgerLoad, setTxLedgerLoad] = useState(false);

  // Refund state
  const [refunding,    setRefunding]    = useState(false);
  const [refundMsg,    setRefundMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  const openDetails = async (t: any) => {
    setSelectedTx(t);
    setTxLedger([]);
    setTxLedgerLoad(true);
    const { data } = await supabase
      .from('ledger_entries')
      .select('id, entry_type, barter_amount, cash_amount, source, balance_before, balance_after, created_at')
      .eq('reference_id', t.id)
      .order('created_at', { ascending: true });
    setTxLedger(data || []);
    setTxLedgerLoad(false);
  };

  // Flags & Fraud state (must be at top level — no conditional hooks)
  const [fraudTab,     setFraudTab]     = useState<'auto' | 'reports'>('auto');
  const [hardPage,     setHardPage]     = useState(1);
  const [softPage,     setSoftPage]     = useState(1);
  const [repPage,      setRepPage]      = useState(1);
  const [actioning2,   setActioning2]   = useState<string | null>(null);
  const [fraudRunning, setFraudRunning] = useState(false);
  const [fraudResult,  setFraudResult]  = useState<{ flagged: number; cleared: number } | null>(null);

  const runFraudDetection = async () => {
    setFraudRunning(true);
    setFraudResult(null);
    try {
      const { data, error } = await supabase.rpc('run_fraud_detection');
      if (!error && data) setFraudResult({ flagged: (data as any).flagged ?? 0, cleared: (data as any).cleared ?? 0 });
    } finally {
      setFraudRunning(false);
    }
  };

  const issueRefund = async (t: any) => {
    setRefunding(true);
    setRefundMsg(null);
    const { error } = await supabase.rpc('admin_issue_refund', {
      p_tx_id:   t.id,
      p_tx_type: t.type,
      p_reason:  'Admin refund',
    });
    if (error) {
      setRefundMsg({ ok: false, text: error.message });
    } else {
      setLocalData(prev => prev.map(tx => tx.id === t.id ? { ...tx, status: 'refunded' } : tx));
      setSelectedTx((prev: any) => prev ? { ...prev, status: 'refunded' } : prev);
      setRefundMsg({ ok: true, text: 'Refund issued successfully.' });
    }
    setRefunding(false);
  };

  const openEdit = (t: any) => {
    setEditTx(t);
    setEditFields({
      status:       t.status       || '',
      amount:       t.amount       ?? '',
      barter_amount: t.barter_amount ?? '',
      cash_amount:  t.cash_amount  ?? '',
      barter_pct:   t.barter_pct   ?? '',
      description:  t.description  || '',
      provider:     t.provider     || '',
    });
  };

  const saveEdit = async () => {
    if (!editTx) return;
    setSaving(true);
    try {
      const fields = editTx.type === 'pos'
        ? {
            status:            editFields.status,
            total_amount:      parseFloat(editFields.amount)        || 0,
            barter_amount:     parseFloat(editFields.barter_amount) || 0,
            cash_amount:       parseFloat(editFields.cash_amount)   || 0,
            barter_percentage: parseFloat(editFields.barter_pct)   || 0,
          }
        : {
            status:              editFields.status,
            points_amount:       parseFloat(editFields.amount) || 0,
            service_description: editFields.description,
          };

      const { data: result, error } = await supabase.rpc('admin_edit_transaction', {
        p_tx_id:   editTx.id,
        p_tx_type: editTx.type,
        p_fields:  fields,
      });

      if (error) throw error;

      // Update balances in state from the server response
      if (result?.merchant_id && result?.new_balance != null) {
        setBalanceMap(prev => ({ ...prev, [result.merchant_id]: result.new_balance }));
        setTxBalanceMap(prev => ({ ...prev, [editTx.id]: result.new_balance }));
      }

      setLocalData(prev => prev.map(r => r.id === editTx.id ? {
        ...r,
        status:        editFields.status,
        amount:        parseFloat(editFields.amount)        || r.amount,
        barter_amount: parseFloat(editTx.type === 'pos' ? editFields.barter_amount : editFields.amount) || r.barter_amount,
        cash_amount:   parseFloat(editFields.cash_amount)  || r.cash_amount,
        barter_pct:    parseFloat(editFields.barter_pct)   || r.barter_pct,
        description:   editFields.description,
        provider:      editFields.provider,
      } : r));
      setEditTx(null);
    } finally {
      setSaving(false);
    }
  };

  // All Transactions filters
  const [search, setSearch]         = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [minAmt, setMinAmt]         = useState('');
  const [maxAmt, setMaxAmt]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [typeFilter, setType]       = useState('all');
  const [txMonSort, setTxMonSort]   = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'barter-desc' | 'merchant'>('date-desc');
  const [txPage,      setTxPage]    = useState(1);
  const [splitPage,   setSplitPage] = useState(1);
  const [splitSearch, setSplitSearch] = useState('');
  const [splitSort,   setSplitSort]   = useState<'volume-desc' | 'volume-asc' | 'barter-desc' | 'txns-desc' | 'pct-desc' | 'merchant'>('volume-desc');
  const [posPage,     setPosPage]   = useState(1);
  const [fraudPage,   setFraudPage] = useState(1);
  const PAGE_SIZE = 10;

  // Flags & Fraud filter
  const [fraudFilter, setFraudFilter] = useState('all');

  const TxPager = ({ total, page, setPage }: { total: number; page: number; setPage: (p: number) => void }) => {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from  = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to    = Math.min(page * PAGE_SIZE, total);
    const visible = Array.from({ length: pages }, (_, i) => i + 1).filter(p =>
      p === 1 || p === pages || Math.abs(p - page) <= 1
    );
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
        <p className="text-xs text-gray-500">
          {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
            disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          </Button>
          {visible.map((p, i, arr) => (
            <React.Fragment key={p}>
              {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-gray-400 px-1">…</span>}
              <Button variant={p === page ? 'default' : 'outline'} size="sm"
                className={`h-7 w-7 p-0 text-xs ${p === page ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white' : ''}`}
                onClick={() => setPage(p)}>
                {p}
              </Button>
            </React.Fragment>
          ))}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0"
            disabled={page === pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };
  const [actioning, setActioning]     = useState<string | null>(null);

  // New transaction modal state
  const [newTxOpen, setNewTxOpen] = useState(false);
  const [newTxType, setNewTxType] = useState<'pos' | 'barter'>('barter');
  const [newFields, setNewFields] = useState<any>({});
  const [creating,  setCreating]  = useState(false);

  const openNew = () => {
    setNewTxType('barter');
    setNewFields({ status: 'completed', amount: '', barter_amount: '', cash_amount: '', barter_pct: '', description: '', merchant_id: '' });
    setNewTxOpen(true);
  };

  const saveNew = async () => {
    setCreating(true);
    try {
      if (newTxType === 'pos') {
        const { data: row } = await supabase.from('pos_transactions').insert({
          status:                   newFields.status,
          total_amount:             parseFloat(newFields.amount)        || 0,
          barter_amount:            parseFloat(newFields.barter_amount) || 0,
          cash_amount:              parseFloat(newFields.cash_amount)   || 0,
          barter_percentage:        parseFloat(newFields.barter_pct)   || 0,
          merchant_id:              newFields.merchant_id || '',
          transaction_date:         new Date().toISOString(),
          external_transaction_id:  `manual-${Date.now()}`,
          pos_provider:             'manual',
        }).select().single();
        if (row) {
          setLocalData(prev => [{
            id: row.id, type: 'pos', source: 'pos',
            provider: row.pos_provider || 'unknown',
            merchant: newFields.merchant_id || '—', merchant_id: row.merchant_id,
            amount: row.total_amount, barter_amount: row.barter_amount,
            cash_amount: row.cash_amount, barter_pct: row.barter_percentage,
            status: row.status, date: row.transaction_date,
            description: '', fraudScore: 0, flag: 'low',
          }, ...prev]);
        }
      } else {
        const { data: row } = await supabase.from('transactions').insert({
          status:              newFields.status,
          points_amount:       parseFloat(newFields.amount) || 0,
          service_description: newFields.description,
          from_user_id:        newFields.merchant_id || null,
          to_user_id:          newFields.merchant_id || null,
          transaction_type:    'barter',
        }).select().single();
        if (row) {
          setLocalData(prev => [{
            id: row.id, type: 'barter', source: 'barter', provider: 'barter',
            merchant: newFields.merchant_id || '—', merchant_id: row.from_user_id,
            amount: row.points_amount, barter_amount: row.points_amount,
            cash_amount: 0, barter_pct: 100,
            status: row.status, date: row.created_at,
            description: row.service_description, fraudScore: 0, flag: 'low',
          }, ...prev]);
        }
      }
      setNewTxOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const handleVoid = async (t: any) => {
    setActioning(t.id);
    const table = t.type === 'pos' ? 'pos_transactions' : 'transactions';
    await supabase.from(table).update({ status: 'voided' }).eq('id', t.id);
    setLocalData(prev => prev.map(r => r.id === t.id ? { ...r, status: 'voided' } : r));
    setActioning(null);
  };

  const handleFlag = async (t: any) => {
    setActioning(t.id);
    const newFlag = t.flag === 'high' ? 'high' : 'high';
    const newScore = Math.max(t.fraudScore, 50);
    // Try to persist flag on DB; non-blocking if column doesn't exist
    // const table = t.type === 'pos' ? 'pos_transactions' : 'transactions';
    // await supabase.from(table).update({ flagged_at: new Date().toISOString() }).eq('id', t.id).maybeSingle();
    setLocalData(prev => prev.map(r => r.id === t.id ? { ...r, flag: newFlag, fraudScore: newScore } : r));
    setActioning(null);
  };

  const handleDismissFlag = (id: string) => {
    setLocalData(prev => prev.map(r => r.id === id ? { ...r, flag: 'low', fraudScore: 0 } : r));
  };

  const handleEscalate = async (t: any) => {
    setActioning(t.id);
    const table = t.type === 'barter' ? 'transactions' : 'pos_transactions';
    if (t.type === 'barter') {
      await supabase.from(table).update({ status: 'disputed' }).eq('id', t.id);
    }
    setLocalData(prev => prev.map(r => r.id === t.id ? { ...r, escalated: true, status: t.type === 'barter' ? 'disputed' : r.status } : r));
    setActioning(null);
  };

  const providerBadge = (provider: string) => {
    const p = (provider || '').toLowerCase();
    if (p === 'square')     return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Square</span>;
    if (p === 'clover')     return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">Clover</span>;
    if (p === 'lightspeed') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Lightspeed</span>;
    if (p === 'barter')     return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">Barter</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{provider || 'Unknown'}</span>;
  };

  const statusBadge = (s: string) => {
    if (s === 'completed') return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>;
    if (s === 'refunded')  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Refunded</span>;
    if (s === 'voided')    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Voided</span>;
    if (s === 'pending')   return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Pending</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">{s || '—'}</span>;
  };

  const fraudBadge = (score: number) => {
    if (score >= 50) return <span className="font-bold text-red-600 flex items-center gap-1">🔥 {score}</span>;
    if (score >= 25) return <span className="font-semibold text-amber-500">{score}</span>;
    return <span className="text-gray-400">{score}</span>;
  };

  const fraudReasons = (t: any): string => {
    const reasons: string[] = [];
    if (t.type === 'pos' && t.barter_pct >= 100) reasons.push('100% barter on POS');
    if (t.barter_amount > 500) reasons.push('Large barter amount');
    if (t.status === 'refunded' || t.status === 'voided') reasons.push('Refunded/voided');
    if (reasons.length === 0) reasons.push('High volume');
    return reasons.join(', ');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-emerald-500 mr-2" /><span className="text-gray-500">Loading transaction data…</span></div>;
  }

  // ── All Transactions ──────────────────────────────────────────────────────
  if (sub === 'All Transactions') {
    const q = search.toLowerCase();
    const filtered = localData.filter(t => {
      if (search && !(
        t.merchant?.toLowerCase().includes(q) ||
        t.recipient?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        String(t.amount ?? '').includes(q)
      )) return false;
      if (dateFrom && new Date(t.date) < new Date(dateFrom)) return false;
      if (dateTo   && new Date(t.date) > new Date(dateTo))   return false;
      if (minAmt   && (t.amount ?? 0) < parseFloat(minAmt))  return false;
      if (maxAmt   && (t.amount ?? 0) > parseFloat(maxAmt))  return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter   !== 'all' && t.type   !== typeFilter)   return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (txMonSort === 'date-desc')   return String(b.date ?? '').localeCompare(String(a.date ?? ''));
      if (txMonSort === 'date-asc')    return String(a.date ?? '').localeCompare(String(b.date ?? ''));
      if (txMonSort === 'amount-desc') return (b.amount ?? 0) - (a.amount ?? 0);
      if (txMonSort === 'amount-asc')  return (a.amount ?? 0) - (b.amount ?? 0);
      if (txMonSort === 'barter-desc') return (b.barter_amount ?? 0) - (a.barter_amount ?? 0);
      if (txMonSort === 'merchant')    return (a.merchant ?? '').localeCompare(b.merchant ?? '');
      return 0;
    });
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const paginated  = sorted.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);
    const totalVol   = filtered.reduce((s, t) => s + (t.amount || 0), 0);
    const totalBarter = filtered.reduce((s, t) => s + (t.barter_amount || 0), 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">All Transactions</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              const hdr = ['Date', 'ID', 'Merchant', 'Type', 'Status', 'Total ($)', 'Barter ($)', 'Cash ($)', 'Barter %'];
              const rows = filtered.map((t: any) => [
                `"${t.date ?? ''}"`,
                `"${t.id ?? ''}"`,
                `"${(t.merchant ?? '').replace(/"/g, '""')}"`,
                t.type ?? '',
                t.status ?? '',
                Number(t.amount ?? 0).toFixed(2),
                Number(t.barter_amount ?? 0).toFixed(2),
                Number(t.cash_amount ?? 0).toFixed(2),
                Number(t.barter_pct ?? 0).toFixed(0),
              ]);
              const csv = [hdr, ...rows].map(r => r.join(',')).join('\n');
              const el = document.createElement('a');
              el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
              el.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
              el.click();
            }} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
            </Button>
            <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <span className="text-lg leading-none">+</span> New Transaction
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              <Input placeholder="Search merchant…" value={search} onChange={e => { setSearch(e.target.value); setTxPage(1); }} className="w-48" />
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">From</label>
                <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setTxPage(1); }} className="w-36" />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">To</label>
                <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setTxPage(1); }} className="w-36" />
              </div>
              <Input placeholder="Min $" value={minAmt} onChange={e => { setMinAmt(e.target.value); setTxPage(1); }} className="w-24" />
              <Input placeholder="Max $" value={maxAmt} onChange={e => { setMaxAmt(e.target.value); setTxPage(1); }} className="w-24" />
              <select value={statusFilter} onChange={e => { setStatus(e.target.value); setTxPage(1); }} className="border rounded px-2 py-1 text-sm text-gray-700 bg-white">
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="refunded">Refunded</option>
                <option value="voided">Voided</option>
                <option value="pending">Pending</option>
              </select>
              <select value={typeFilter} onChange={e => { setType(e.target.value); setTxPage(1); }} className="border rounded px-2 py-1 text-sm text-gray-700 bg-white">
                <option value="all">All Types</option>
                <option value="pos">POS</option>
                <option value="barter">Barter</option>
              </select>
              <select value={txMonSort} onChange={e => { setTxMonSort(e.target.value as any); setTxPage(1); }} className="border rounded px-2 py-1 text-sm text-gray-700 bg-white">
                <option value="date-desc">Date: Newest first</option>
                <option value="date-asc">Date: Oldest first</option>
                <option value="amount-desc">Amount: Highest first</option>
                <option value="amount-asc">Amount: Lowest first</option>
                <option value="barter-desc">Barter $: Highest first</option>
                <option value="merchant">Merchant: A → Z</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Transactions</p><p className="text-2xl font-bold text-gray-900">{filtered.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Volume</p><p className="text-2xl font-bold text-gray-900">${totalVol.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Barter Volume</p><p className="text-2xl font-bold text-green-600">${totalBarter.toFixed(2)}</p></CardContent></Card>
        </div>

        {/* Table + lifecycle panel */}
        <div className="flex gap-4 items-start">
        <Card className="flex-1 min-w-0">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Merchant</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type / Source</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Barter $</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Barter %</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fraud Score</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                      <span className="flex items-center justify-end gap-1"><Wallet className="h-3 w-3" />Wallet</span>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-12 text-gray-400">No transactions found.</td></tr>
                  ) : paginated.map(t => {
                    const walletBal = txBalanceMap[t.id] ?? undefined;
                    return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{t.date ? new Date(t.date).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.merchant}</td>
                      <td className="px-4 py-3">{providerBadge(t.provider)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">${(t.amount ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">${(t.barter_amount ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{(t.barter_pct ?? 0).toFixed(0)}%</td>
                      <td className="px-4 py-3">{statusBadge(t.status)}</td>
                      <td className="px-4 py-3 text-center">{fraudBadge(t.fraudScore)}</td>
                      <td className="px-4 py-3 text-right">
                        {walletBal == null
                          ? <span className="text-gray-300 text-xs">…</span>
                          : <span className="font-semibold text-indigo-700">${walletBal.toFixed(2)}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm"
                            className={`text-xs h-7 px-2 ${t.flag === 'high' ? 'bg-red-50 text-red-600 border-red-200' : 'text-red-600 border-red-200 hover:bg-red-50'}`}
                            disabled={actioning === t.id}
                            onClick={() => handleFlag(t)}>
                            {actioning === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : t.flag === 'high' ? 'Flagged' : 'Flag'}
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs h-7 px-2"
                            onClick={() => openEdit(t)}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs h-7 px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            onClick={() => openDetails(t)}>
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </CardContent>
          <TxPager total={sorted.length} page={txPage} setPage={setTxPage} />
        </Card>

        {/* ── Lifecycle drill-down panel ── */}
        {selectedTx && (() => {
          const t = selectedTx;
          const paymentResult = t.status === 'completed' ? { label: 'Success', cls: 'bg-emerald-50 text-emerald-700' }
            : t.status === 'pending'   ? { label: 'Pending',  cls: 'bg-amber-50 text-amber-700' }
            : t.status === 'voided'    ? { label: 'Voided',   cls: 'bg-gray-100 text-gray-600' }
            : t.status === 'refunded'  ? { label: 'Refunded', cls: 'bg-blue-50 text-blue-700' }
            :                           { label: 'Failed',    cls: 'bg-red-50 text-red-700' };

          const syncResult = t.type === 'pos'
            ? t.description ? { label: 'Synced', cls: 'text-emerald-600' } : { label: 'Not Synced', cls: 'text-rose-600' }
            : { label: 'N/A (Barter)', cls: 'text-gray-400' };

          return (
            <div className="w-72 shrink-0 border rounded-xl bg-white shadow-sm overflow-hidden self-start sticky top-0">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <p className="text-xs font-bold text-gray-700">Transaction Lifecycle</p>
                <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>
              <div className="p-4 space-y-4 text-xs">

                {/* Payment Result */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Payment Result</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${paymentResult.cls}`}>
                    {paymentResult.label}
                  </span>
                </div>

                {/* Sync Result */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Sync Result</p>
                  <span className={`font-semibold ${syncResult.cls}`}>{syncResult.label}</span>
                  {t.type === 'pos' && t.description && (
                    <p className="text-gray-400 mt-0.5 font-mono text-[10px] break-all">{t.description}</p>
                  )}
                </div>

                {/* Ledger Entries */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Linked Ledger Entries</p>
                  {txLedgerLoad ? (
                    <div className="flex items-center gap-2 text-gray-400"><Loader2 className="h-3 w-3 animate-spin" />Loading…</div>
                  ) : txLedger.length === 0 ? (
                    <p className="text-gray-400 italic">No ledger entries linked</p>
                  ) : (
                    <div className="space-y-2">
                      {txLedger.map((le: any) => (
                        <div key={le.id} className={`rounded-lg p-2.5 border ${le.entry_type === 'credit' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-bold ${le.entry_type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {le.entry_type === 'credit' ? '+' : '-'}{Number(le.barter_amount).toLocaleString()} pts
                            </span>
                            <span className="text-[10px] text-gray-400">{le.entry_type.toUpperCase()}</span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono break-all">{le.id.slice(0, 20)}…</p>
                          {le.balance_before != null && le.balance_after != null && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {Number(le.balance_before).toLocaleString()} → {Number(le.balance_after).toLocaleString()} pts
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TX details */}
                <div className="pt-2 border-t space-y-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Details</p>
                  {[
                    { label: 'TX ID',    value: t.id?.slice(0, 16) + '…' },
                    { label: 'Merchant', value: t.merchant ?? '—' },
                    { label: 'Source',   value: t.provider ?? t.type ?? '—' },
                    { label: 'Date',     value: t.date ? new Date(t.date).toLocaleString() : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-gray-400 shrink-0">{label}</span>
                      <span className="font-medium text-gray-800 text-right break-all">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Issue Refund */}
                {t.status === 'completed' && Number(t.barter_amount) > 0 && (
                  <div className="pt-2 border-t">
                    {refundMsg && (
                      <p className={`text-[10px] mb-2 font-medium ${refundMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                        {refundMsg.text}
                      </p>
                    )}
                    <button
                      onClick={() => issueRefund(t)}
                      disabled={refunding}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {refunding
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RotateCcw className="h-3.5 w-3.5" />}
                      Issue Refund
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        </div>

        {/* New Transaction Modal */}
        {newTxOpen && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h3 className="text-base font-bold text-gray-900">New Transaction</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Manually create a transaction record</p>
                </div>
                <button onClick={() => setNewTxOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Type toggle */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Transaction Type</label>
                  <div className="flex gap-2">
                    {(['barter', 'pos'] as const).map(t => (
                      <button key={t} onClick={() => setNewTxType(t)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${newTxType === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'}`}>
                        {t === 'barter' ? 'Barter' : 'POS'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</label>
                  <select value={newFields.status}
                    onChange={e => setNewFields((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="refunded">Refunded</option>
                    <option value="voided">Voided</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>

                {/* Merchant / User ID */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {newTxType === 'pos' ? 'Merchant ID' : 'User ID (from)'}
                  </label>
                  <Input value={newFields.merchant_id}
                    onChange={e => setNewFields((f: any) => ({ ...f, merchant_id: e.target.value }))}
                    placeholder="Paste user/merchant UUID"
                    className="text-sm font-mono" />
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {newTxType === 'barter' ? 'Points Amount' : 'Total Amount ($)'}
                    </label>
                    <Input type="number" min="0" step="0.01"
                      value={newFields.amount}
                      onChange={e => setNewFields((f: any) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00" className="text-sm" />
                  </div>
                  {newTxType === 'pos' && (<>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Barter Amount ($)</label>
                      <Input type="number" min="0" step="0.01"
                        value={newFields.barter_amount}
                        onChange={e => setNewFields((f: any) => ({ ...f, barter_amount: e.target.value }))}
                        placeholder="0.00" className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cash Amount ($)</label>
                      <Input type="number" min="0" step="0.01"
                        value={newFields.cash_amount}
                        onChange={e => setNewFields((f: any) => ({ ...f, cash_amount: e.target.value }))}
                        placeholder="0.00" className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Barter %</label>
                      <Input type="number" min="0" max="100" step="1"
                        value={newFields.barter_pct}
                        onChange={e => setNewFields((f: any) => ({ ...f, barter_pct: e.target.value }))}
                        placeholder="0" className="text-sm" />
                    </div>
                  </>)}
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</label>
                  <Input value={newFields.description}
                    onChange={e => setNewFields((f: any) => ({ ...f, description: e.target.value }))}
                    placeholder="What was traded / exchanged?"
                    className="text-sm" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                <Button variant="outline" onClick={() => setNewTxOpen(false)} disabled={creating}>Cancel</Button>
                <Button onClick={saveNew} disabled={creating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {creating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating…</> : 'Create Transaction'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Transaction Modal */}
        {editTx && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Edit Transaction</h3>
                  <p className="text-xs text-gray-400 mt-0.5">ID: {editTx.id?.slice(0, 16)}…</p>
                </div>
                <button onClick={() => setEditTx(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</label>
                  <select value={editFields.status}
                    onChange={e => setEditFields((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="refunded">Refunded</option>
                    <option value="voided">Voided</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {editTx.type === 'barter' ? 'Points Amount' : 'Total Amount ($)'}
                    </label>
                    <Input type="number" min="0" step="0.01"
                      value={editFields.amount}
                      onChange={e => setEditFields((f: any) => ({ ...f, amount: e.target.value }))}
                      className="text-sm" />
                  </div>
                  {editTx.type === 'pos' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Barter Amount ($)</label>
                      <Input type="number" min="0" step="0.01"
                        value={editFields.barter_amount}
                        onChange={e => setEditFields((f: any) => ({ ...f, barter_amount: e.target.value }))}
                        className="text-sm" />
                    </div>
                  )}
                  {editTx.type === 'pos' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cash Amount ($)</label>
                      <Input type="number" min="0" step="0.01"
                        value={editFields.cash_amount}
                        onChange={e => setEditFields((f: any) => ({ ...f, cash_amount: e.target.value }))}
                        className="text-sm" />
                    </div>
                  )}
                  {editTx.type === 'pos' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Barter %</label>
                      <Input type="number" min="0" max="100" step="1"
                        value={editFields.barter_pct}
                        onChange={e => setEditFields((f: any) => ({ ...f, barter_pct: e.target.value }))}
                        className="text-sm" />
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</label>
                  <Input value={editFields.description}
                    onChange={e => setEditFields((f: any) => ({ ...f, description: e.target.value }))}
                    placeholder="Transaction description"
                    className="text-sm" />
                </div>

                {/* Read-only info */}
                <div className="bg-gray-50 rounded-lg px-4 py-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div><span className="font-medium text-gray-600">Merchant:</span> {editTx.merchant}</div>
                  <div><span className="font-medium text-gray-600">Type:</span> {editTx.type}</div>
                  <div><span className="font-medium text-gray-600">Provider:</span> {editTx.provider}</div>
                  <div><span className="font-medium text-gray-600">Date:</span> {editTx.date ? new Date(editTx.date).toLocaleDateString() : '—'}</div>
                </div>

                {/* Wallet impact preview */}
                {editTx.merchant_id && (() => {
                  const currentBal = balanceMap[editTx.merchant_id] ?? null;
                  const newBarterAmt = parseFloat(editTx.type === 'pos' ? editFields.barter_amount : editFields.amount) || 0;
                  const oldBarterAmt = editTx.type === 'pos' ? (editTx.barter_amount ?? 0) : (editTx.barter_amount ?? editTx.amount ?? 0);
                  const diff = newBarterAmt - oldBarterAmt;
                  const newBal = currentBal != null ? Math.max(0, currentBal + diff) : null;
                  if (diff === 0 && currentBal == null) return null;
                  return (
                    <div className="border rounded-lg px-4 py-3 bg-indigo-50 space-y-1 text-xs">
                      <p className="font-semibold text-indigo-700 flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5" /> Wallet Impact
                      </p>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Current balance</span>
                        <span className="font-medium">{currentBal != null ? `$${currentBal.toFixed(2)}` : '…'}</span>
                      </div>
                      {diff !== 0 && (
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Adjustment</span>
                          <span className={`font-semibold ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {newBal != null && diff !== 0 && (
                        <div className="flex items-center justify-between border-t pt-1 mt-1">
                          <span className="font-semibold text-indigo-700">New balance</span>
                          <span className="font-bold text-indigo-700">${newBal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                <Button variant="outline" onClick={() => setEditTx(null)} disabled={saving}>Cancel</Button>
                <Button onClick={saveEdit} disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ── Barter Split ─────────────────────────────────────────────────────────
  if (sub === 'Barter Split') {
    const totalVol    = localData.reduce((s, t) => s + (t.amount || 0), 0);
    const totalBarter = localData.reduce((s, t) => s + (t.barter_amount || 0), 0);
    const avgPct      = localData.length ? localData.reduce((s, t) => s + (t.barter_pct || 0), 0) / localData.length : 0;

    // Group by merchant
    const merchantMap: Record<string, any> = {};
    localData.forEach(t => {
      const key = t.merchant_id || t.merchant;
      if (!merchantMap[key]) {
        merchantMap[key] = { merchant: t.merchant, merchant_id: key, txns: 0, totalVol: 0, barterVol: 0, cashVol: 0, pctSum: 0 };
      }
      merchantMap[key].txns++;
      merchantMap[key].totalVol   += t.amount || 0;
      merchantMap[key].barterVol  += t.barter_amount || 0;
      merchantMap[key].cashVol    += t.cash_amount || 0;
      merchantMap[key].pctSum     += t.barter_pct || 0;
    });
    const merchants = Object.values(merchantMap)
      .map((m: any) => ({ ...m, avgPct: m.txns ? m.pctSum / m.txns : 0 }))
      .filter((m: any) => !splitSearch.trim() || m.merchant?.toLowerCase().includes(splitSearch.toLowerCase()))
      .sort((a: any, b: any) => {
        if (splitSort === 'volume-desc') return b.totalVol - a.totalVol;
        if (splitSort === 'volume-asc')  return a.totalVol - b.totalVol;
        if (splitSort === 'barter-desc') return b.barterVol - a.barterVol;
        if (splitSort === 'txns-desc')   return b.txns - a.txns;
        if (splitSort === 'pct-desc')    return b.avgPct - a.avgPct;
        if (splitSort === 'merchant')    return (a.merchant ?? '').localeCompare(b.merchant ?? '');
        return 0;
      });

    // ── Channel breakdown: POS vs QR/Barter ──────────────────────────────────
    const posTxns    = localData.filter(t => t.source === 'pos');
    const barterTxns = localData.filter(t => t.source === 'barter');
    const channels = [
      {
        label:      'QR / App',
        color:      'violet',
        dotCls:     'bg-violet-500',
        txns:       barterTxns.length,
        barterVol:  barterTxns.reduce((s, t) => s + (t.barter_amount || 0), 0),
        cashVol:    barterTxns.reduce((s, t) => s + (t.cash_amount || 0), 0),
        avgPct:     barterTxns.length ? barterTxns.reduce((s, t) => s + (t.barter_pct || 0), 0) / barterTxns.length : 0,
      },
      {
        label:      'POS',
        color:      'indigo',
        dotCls:     'bg-indigo-500',
        txns:       posTxns.length,
        barterVol:  posTxns.reduce((s, t) => s + (t.barter_amount || 0), 0),
        cashVol:    posTxns.reduce((s, t) => s + (t.cash_amount || 0), 0),
        avgPct:     posTxns.length ? posTxns.reduce((s, t) => s + (t.barter_pct || 0), 0) / posTxns.length : 0,
      },
    ];
    const totalChannelTxns = channels.reduce((s, c) => s + c.txns, 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold text-gray-900">Barter Split</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Transactions</p><p className="text-2xl font-bold text-gray-900">{data.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Volume</p><p className="text-2xl font-bold text-gray-900">${totalVol.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Total Barter Volume</p><p className="text-2xl font-bold text-green-600">${totalBarter.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-gray-500">Avg Barter %</p><p className="text-2xl font-bold text-indigo-600">{avgPct.toFixed(1)}%</p></CardContent></Card>
        </div>

        {/* ── POS vs QR Channel Breakdown ── */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
              Channel Breakdown — POS vs QR / App
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Channel</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Transactions</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Share</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Barter Volume (pts)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Cash Volume ($)</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Avg Barter %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {channels.map(ch => {
                  const share = totalChannelTxns > 0 ? (ch.txns / totalChannelTxns) * 100 : 0;
                  return (
                    <tr key={ch.label} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${ch.dotCls} shrink-0`} />
                        {ch.label}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800 font-semibold">{ch.txns.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full rounded-full ${ch.dotCls}`} style={{ width: `${share.toFixed(0)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{share.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{ch.barterVol.toLocaleString()} pts</td>
                      <td className="px-4 py-3 text-right text-gray-600">${ch.cashVol.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-indigo-600">{ch.avgPct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-gray-50 font-semibold text-gray-700">
                  <td className="px-4 py-2.5 text-xs uppercase text-gray-500">Total</td>
                  <td className="px-4 py-2.5 text-right">{totalChannelTxns.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-400">100%</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">{channels.reduce((s, c) => s + c.barterVol, 0).toLocaleString()} pts</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">${channels.reduce((s, c) => s + c.cashVol, 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-indigo-600">{avgPct.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
            <SHSearch value={splitSearch} onChange={v => { setSplitSearch(v); setSplitPage(1); }} placeholder="Search merchant…" />
            <select
              value={splitSort}
              onChange={e => { setSplitSort(e.target.value as any); setSplitPage(1); }}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
            >
              <option value="volume-desc">Total Volume: Highest first</option>
              <option value="volume-asc">Total Volume: Lowest first</option>
              <option value="barter-desc">Barter $: Highest first</option>
              <option value="txns-desc">Transactions: Most first</option>
              <option value="pct-desc">Avg Barter %: Highest first</option>
              <option value="merchant">Merchant: A → Z</option>
            </select>
            {splitSearch && <span className="text-xs text-gray-400 shrink-0">{merchants.length} results</span>}
          </div>
          <CardContent className="p-0 overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Merchant</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Txns</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Volume</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Barter $</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cash $</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Barter %</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {merchants.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">No data available.</td></tr>
                  ) : merchants.slice((splitPage - 1) * PAGE_SIZE, splitPage * PAGE_SIZE).map((m: any) => (
                    <tr key={m.merchant_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.merchant}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.txns}</td>
                      <td className="px-4 py-3 text-right text-gray-900">${m.totalVol.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600">${m.barterVol.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">${m.cashVol.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{m.avgPct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-center">
                        {m.avgPct > 30
                          ? <span className="text-red-600 font-semibold text-xs">⚠ Over Limit</span>
                          : <span className="text-green-600 font-semibold text-xs">✓ OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          <TxPager total={merchants.length} page={splitPage} setPage={setSplitPage} />
        </Card>
      </div>
    );
  }

  // ── POS Sources ───────────────────────────────────────────────────────────
  if (sub === 'POS Sources') {
    const providers = ['square', 'clover', 'lightspeed', 'barter'];
    const providerStats = providers.map(p => {
      const rows = localData.filter(t => (t.provider || '').toLowerCase() === p);
      const lastActivity = rows.length ? rows[0].date : null;
      return {
        provider: p,
        count:       rows.length,
        totalVol:    rows.reduce((s, t) => s + (t.amount || 0), 0),
        barterVol:   rows.reduce((s, t) => s + (t.barter_amount || 0), 0),
        avgPct:      rows.length ? rows.reduce((s, t) => s + (t.barter_pct || 0), 0) / rows.length : 0,
        lastActivity,
      };
    });
    // also catch "other" providers
    const knownProviders = new Set(providers);
    const otherRows = localData.filter(t => !knownProviders.has((t.provider || '').toLowerCase()));
    if (otherRows.length) {
      providerStats.push({
        provider: 'other',
        count:       otherRows.length,
        totalVol:    otherRows.reduce((s, t) => s + (t.amount || 0), 0),
        barterVol:   otherRows.reduce((s, t) => s + (t.barter_amount || 0), 0),
        avgPct:      otherRows.length ? otherRows.reduce((s, t) => s + (t.barter_pct || 0), 0) / otherRows.length : 0,
        lastActivity: otherRows.length ? otherRows[0].date : null,
      });
    }

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">POS Sources</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {providerStats.slice(0, 4).map(ps => (
            <Card key={ps.provider}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">{providerBadge(ps.provider)}</div>
                <p className="text-2xl font-bold text-gray-900">{ps.count}</p>
                <p className="text-xs text-gray-500 mt-0.5">${ps.totalVol.toFixed(2)} volume</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Provider</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Transactions</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Volume</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Barter Volume</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Avg Barter %</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {providerStats.slice((posPage - 1) * PAGE_SIZE, posPage * PAGE_SIZE).map(ps => (
                    <tr key={ps.provider} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{providerBadge(ps.provider)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{ps.count}</td>
                      <td className="px-4 py-3 text-right text-gray-900">${ps.totalVol.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600">${ps.barterVol.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{ps.avgPct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{ps.lastActivity ? new Date(ps.lastActivity).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          <TxPager total={providerStats.length} page={posPage} setPage={setPosPage} />
        </Card>
      </div>
    );
  }

  // ── Flags & Fraud ─────────────────────────────────────────────────────────
  if (sub === 'Flags & Fraud') {
    const hardFlagged   = riskProfiles.filter(r => r.flag_status === 'hard');
    const softFlagged   = riskProfiles.filter(r => r.flag_status === 'soft');
    const cleanCount    = riskProfiles.filter(r => r.flag_status === 'none').length;
    const pendingReports = reports.filter(r => r.status === 'pending').length;

    const reasonLabel: Record<string, string> = {
      didnt_deliver: "Didn't deliver",
      misleading:    'Misleading listing',
      scam_fraud:    'Scam / Fraud',
      other:         'Other',
    };

    const signalLabels: Record<string, string> = {
      repeated_pair_trading: 'Repeated pair trading',
      large_transfer:        'Large transfer (≥1000)',
      rapid_sending:         'Rapid sending (≥10/day)',
    };
    const SignalBadge = ({ label }: { label: string }) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 mr-1 mb-1">{signalLabels[label] ?? label}</span>
    );

    const doFlagAction = async (r: any, newStatus: 'none' | 'soft' | 'hard') => {
      setActioning2(r.user_id);
      await onFlagUpdate?.(r.user_id, newStatus, r.signals);
      setActioning2(null);
    };

    const doSuspend = async (r: any) => {
      setActioning2(r.user_id + '-suspend');
      await onSuspend?.(r.user_id);
      setActioning2(null);
    };

    const doReportAction = async (id: string, status: 'reviewed' | 'dismissed') => {
      setActioning2(id);
      await onReportAction?.(id, status);
      setActioning2(null);
    };

    const FlagTable = ({ rows, type, page, setPage }: { rows: any[]; type: 'hard' | 'soft'; page: number; setPage: (p: number) => void }) => {
      const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      const borderColor = type === 'hard' ? 'border-red-200' : 'border-amber-200';
      const bgColor     = type === 'hard' ? 'bg-red-50/40' : 'bg-amber-50/40';
      const titleColor  = type === 'hard' ? 'text-red-700' : 'text-amber-700';
      const scoreBg     = type === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

      return (
        <Card className={`border shadow-sm ${borderColor} ${bgColor}`}>
          <CardHeader className="pb-3 border-b">
            <CardTitle className={`text-base flex items-center gap-2 ${titleColor}`}>
              {type === 'hard' ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {type === 'hard' ? 'Hard Flagged' : 'Soft Flagged'} — {rows.length} account{rows.length !== 1 ? 's' : ''}
              {type === 'hard' && <span className="text-xs font-normal text-red-500 ml-1">Account frozen on Suspend</span>}
              {type === 'soft' && <span className="text-xs font-normal text-amber-500 ml-1">Monitored, transactions allowed</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="border-b bg-white/60">
                <tr>
                  <TH>Business</TH>
                  <TH right>Risk Score</TH>
                  <TH>Triggered Signals</TH>
                  <TH right>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">No accounts in this category</td></tr>
                ) : paged.map((r: any) => (
                  <tr key={r.user_id} className="hover:bg-white/70">
                    <TD>
                      <p className="font-medium text-gray-900">{r.businessName}</p>
                      {r.flagged_at && <p className="text-xs text-gray-400">Flagged {new Date(r.flagged_at).toLocaleDateString()}</p>}
                    </TD>
                    <TD right>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${scoreBg}`}>{r.score}</span>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap">
                        {(r.flag_reasons?.length ? r.flag_reasons : r.signals || []).map((s: string) => (
                          <SignalBadge key={s} label={s} />
                        ))}
                      </div>
                    </TD>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          disabled={actioning2 === r.user_id}
                          onClick={() => doFlagAction(r, 'none')}>
                          {actioning2 === r.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Clear'}
                        </Button>
                        {type === 'soft' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            disabled={actioning2 === r.user_id}
                            onClick={() => doFlagAction(r, 'hard')}>
                            Escalate → Hard
                          </Button>
                        )}
                        <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                          disabled={actioning2 === r.user_id + '-suspend'}
                          onClick={() => doSuspend(r)}>
                          {actioning2 === r.user_id + '-suspend' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Suspend'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          <AdminPager total={rows.length} page={page} setPage={setPage} />
        </Card>
      );
    };

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Flags &amp; Fraud</h2>
          <div className="flex items-center gap-3">
            {fraudResult && (
              <span className="text-xs text-gray-500">
                Last run: <span className="text-red-600 font-semibold">{fraudResult.flagged} flagged</span>, <span className="text-emerald-600 font-semibold">{fraudResult.cleared} cleared</span>
              </span>
            )}
            <Button size="sm" variant="outline" onClick={runFraudDetection} disabled={fraudRunning}
              className="flex items-center gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50">
              {fraudRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {fraudRunning ? 'Running…' : 'Run Now'}
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={AlertCircle}  label="Hard Flagged"     value={hardFlagged.length}  color="red"     />
          <StatCard icon={AlertTriangle} label="Soft Flagged"    value={softFlagged.length}  color="amber"   />
          <StatCard icon={Shield}        label="Pending Reports" value={pendingReports}       color="orange"  />
          <StatCard icon={CheckCircle}   label="Clean Accounts"  value={cleanCount}           color="emerald" />
        </div>

        {/* Sub-tabs */}
        <div className="border-b flex gap-0">
          {(['auto', 'reports'] as const).map(t => (
            <button key={t} onClick={() => setFraudTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${fraudTab === t ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'auto' ? 'Auto Flags' : `User Reports${pendingReports > 0 ? ` (${pendingReports})` : ''}`}
            </button>
          ))}
        </div>

        {/* Auto Flags */}
        {fraudTab === 'auto' && (
          <div className="space-y-5">
            {/* Legend */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800 space-y-1">
                <p><span className="font-semibold">Hard Flag (score ≥ 60)</span> — Immediate review required. Recommend suspend.</p>
                <p><span className="font-semibold">Soft Flag (score 30–59)</span> — Monitor. Transactions still allowed.</p>
                <p className="text-xs text-blue-600 pt-1">Auto DB signals: repeated pair trading (≥5 tx) · large transfer (≥1000 pts) · rapid sending (≥10 tx/day). Also scored manually by admin.</p>
              </div>
            </div>

            {hardFlagged.length === 0 && softFlagged.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">No accounts flagged</p>
                  <p className="text-xs text-gray-400 mt-1">All {riskProfiles.length} accounts are below the risk threshold</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {hardFlagged.length > 0 && <FlagTable rows={hardFlagged} type="hard" page={hardPage} setPage={setHardPage} />}
                {softFlagged.length > 0 && <FlagTable rows={softFlagged} type="soft" page={softPage} setPage={setSoftPage} />}
              </>
            )}
          </div>
        )}

        {/* User Reports */}
        {fraudTab === 'reports' && (
          <div className="space-y-4">
            {reportsLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <TH>Reported Business</TH>
                        <TH>Reporter</TH>
                        <TH>Reason</TH>
                        <TH>Details</TH>
                        <TH>Date</TH>
                        <TH>Status</TH>
                        <TH right>Actions</TH>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reports.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No reports submitted yet</td></tr>
                      ) : reports.slice((repPage - 1) * PAGE_SIZE, repPage * PAGE_SIZE).map((r: any) => (
                        <tr key={r.id} className={`hover:bg-gray-50 ${r.status === 'pending' ? 'bg-orange-50/30' : ''}`}>
                          <TD><p className="font-medium text-gray-900">{r.businessName}</p></TD>
                          <TD><p className="text-gray-600">{r.reporterName}</p></TD>
                          <TD>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.reason === 'scam_fraud'    ? 'bg-red-100 text-red-700' :
                              r.reason === 'didnt_deliver' ? 'bg-amber-100 text-amber-700' :
                              r.reason === 'misleading'    ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{reasonLabel[r.reason] || r.reason}</span>
                          </TD>
                          <TD><p className="text-xs text-gray-500 max-w-[200px] truncate">{r.details || '—'}</p></TD>
                          <TD><p className="text-xs text-gray-400 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</p></TD>
                          <TD>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.status === 'pending'    ? 'bg-orange-100 text-orange-700' :
                              r.status === 'reviewed'   ? 'bg-emerald-100 text-emerald-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                          </TD>
                          <td className="px-4 py-3 text-right">
                            {r.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                  disabled={actioning2 === r.id}
                                  onClick={() => doReportAction(r.id, 'reviewed')}>
                                  {actioning2 === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reviewed'}
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-gray-500"
                                  disabled={actioning2 === r.id}
                                  onClick={() => doReportAction(r.id, 'dismissed')}>
                                  Dismiss
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
                <AdminPager total={reports.length} page={repPage} setPage={setRepPage} />
              </Card>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

// ─── LiquiditySection ─────────────────────────────────────────────────────────

export default TxMonSection;
