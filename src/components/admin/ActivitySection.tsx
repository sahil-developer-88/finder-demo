import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, AlertTriangle, Ban, Bell, CheckCircle,
  ChevronRight, Clock, FileText, Flag, Loader2, Search, Send, User, XCircle, WifiOff,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SectionTitle, StatCard, Pill, TH, TD, SHSearch } from './shared/ui';

const PAGE_SIZE_A = 500;

const ActivitySection = ({ sub, setSub, activityTxns, activityAudit, systemAlerts, suspiciousList: initialSuspicious, disputesList: initialDisputes, activityLoading }: {
  sub: string;
  setSub: (s: string) => void;
  activityTxns: any[];
  activityAudit: any[];
  systemAlerts: any[];
  suspiciousList: any[];
  disputesList: any[];
  activityLoading: boolean;
}) => {
  const [txPage,       setTxPage]       = useState(1);
  const [selectedTx,   setSelectedTx]   = useState<any>(null);
  const [txSearch,     setTxSearch]     = useState('');
  const [txSort,       setTxSort]       = useState<'time-desc' | 'time-asc' | 'amount-desc' | 'amount-asc' | 'from' | 'to'>('time-desc');
  const [auditPage,    setAuditPage]    = useState(1);
  const [alertPage,    setAlertPage]    = useState(1);
  const [suspPage,     setSuspPage]     = useState(1);
  const [suspSearch,   setSuspSearch]   = useState('');
  const [suspSort,     setSuspSort]     = useState<'severity-desc' | 'sent-desc' | 'sent-asc' | 'received-desc' | 'received-asc' | 'name'>('severity-desc');
  const [dispPage,     setDispPage]     = useState(1);
  const [dispSearch,   setDispSearch]   = useState('');
  const [dispSort,     setDispSort]     = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'status' | 'reporter'>('date-desc');
  const [auditSearch,  setAuditSearch]  = useState('');
  const [disputes,     setDisputes]     = useState(initialDisputes);
  const [suspicious,   setSuspicious]   = useState(initialSuspicious);
  const [alerts,       setAlerts]       = useState(systemAlerts);
  const [actioningId,  setActioningId]  = useState<string | null>(null);
  const [retryingId,   setRetryingId]   = useState<string | null>(null);

  // Local audit list — starts from prop, grows with Load More
  const [localAudit,  setLocalAudit]  = useState(activityAudit);
  const [auditOffset, setAuditOffset] = useState(activityAudit.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(activityAudit.length >= 200);

  React.useEffect(() => {
    setLocalAudit(activityAudit);
    setAuditOffset(activityAudit.length);
    setHasMore(activityAudit.length >= 200);
  }, [activityAudit]);

  const TABLE_LABELS: Record<string, string> = {
    businesses: 'business listing', profiles: 'profile', tax_info: 'tax information',
    transactions: 'transaction', user_credits: 'barter credits', pos_integrations: 'POS integration',
    products: 'product', reviews: 'review', audit_logs: 'audit log',
  };

  const loadMoreAudit = async () => {
    setLoadingMore(true);
    const BATCH = 200;
    const { data: rows } = await supabase
      .from('audit_logs')
      .select('id, action, table_name, record_id, user_id, created_at')
      .order('created_at', { ascending: false })
      .range(auditOffset, auditOffset + BATCH - 1);

    if (!rows || rows.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }

    const uids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))] as string[];
    const { data: profiles } = uids.length
      ? await supabase.from('profiles').select('user_id, full_name, email, business_name').in('user_id', uids)
      : { data: [] };
    const pMap: Record<string, any> = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));

    const enriched = rows.map((l: any) => {
      const table = TABLE_LABELS[l.table_name] || l.table_name?.replace(/_/g, ' ');
      const verb = l.action === 'INSERT' ? 'Created' : l.action === 'UPDATE' ? 'Updated' : l.action === 'DELETE' ? 'Deleted' : l.action;
      const profile = pMap[l.user_id];
      return {
        id:           l.id,
        userId:       l.user_id || '—',
        businessName: profile?.business_name || null,
        fullName:     profile?.full_name || null,
        email:        profile?.email || null,
        action:       `${verb} ${table}`,
        recordId:     l.record_id || null,
        time:         new Date(l.created_at).toLocaleString(),
      };
    });

    setLocalAudit(prev => [...prev, ...enriched]);
    setAuditOffset(prev => prev + rows.length);
    setHasMore(rows.length === BATCH);
    setLoadingMore(false);
  };

  // Sync if parent refreshes
  React.useEffect(() => { setDisputes(initialDisputes); }, [initialDisputes]);
  React.useEffect(() => { setSuspicious(initialSuspicious); }, [initialSuspicious]);
  React.useEffect(() => { setAlerts(systemAlerts); }, [systemAlerts]);

  const handleDisputeAction = async (id: string, action: 'resolve' | 'mediate') => {
    setActioningId(id);
    const newStatus = action === 'resolve' ? 'resolved' : 'mediation';
    const { error } = await supabase.from('transactions').update({ status: newStatus }).eq('id', id);
    if (!error) {
      setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: action === 'resolve' ? 'resolved' : 'mediation' } : d));
    }
    setActioningId(null);
  };

  const handleSuspend = async (userId: string) => {
    setActioningId(userId);
    const { error } = await supabase.from('businesses').update({ status: 'suspended' }).eq('user_id', userId);
    if (!error) {
      setSuspicious(prev => prev.map(s => s.id === userId ? { ...s, suspended: true } : s));
    }
    setActioningId(null);
  };

  const handleDismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleRetryWebhook = async (id: string) => {
    setRetryingId(id);
    const { error } = await supabase.from('webhook_logs').update({ status: 'pending' }).eq('id', id);
    setRetryingId(null);
    if (error) { toast({ title: 'Failed to retry webhook', description: error.message, variant: 'destructive' }); return; }
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleApproveDisconnect = async (posId: string) => {
    setActioningId(posId);
    const { error } = await supabase.from('pos_integrations').update({ status: 'inactive' }).eq('id', posId);
    setActioningId(null);
    if (error) { toast({ title: 'Failed to disconnect POS', description: error.message, variant: 'destructive' }); return; }
    setAlerts(prev => prev.filter(a => a.id !== posId));
  };

  const handleKeepConnected = async (posId: string) => {
    setActioningId(posId);
    const { error } = await supabase.from('pos_integrations').update({ status: 'active' }).eq('id', posId);
    setActioningId(null);
    if (error) { toast({ title: 'Failed to update POS status', description: error.message, variant: 'destructive' }); return; }
    setAlerts(prev => prev.filter(a => a.id !== posId));
  };

  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  const handleNotifyMerchant = async (a: any) => {
    if (!a.merchantId) return;
    setNotifyingId(a.id);
    const adminUser = (await supabase.auth.getUser()).data.user;
    const msgMap: Record<string, string> = {
      pos:        `Your ${a.provider || 'POS'} integration is currently disconnected. Please reconnect it from your dashboard to continue syncing transactions.`,
      pos_stale:  `Your ${a.provider || 'POS'} integration hasn't synced in over 7 days. Please check your connection in the POS Integration settings.`,
      token:      `Your ${a.provider || 'POS'} OAuth token is expiring soon. Please re-authenticate to avoid losing your POS connection.`,
      dispute:    `You have an unresolved dispute that requires your attention. Please log in to review it.`,
      w9:         `Your W-9 tax form is missing. Please complete it in your Tax & 1099 settings to remain compliant.`,
    };
    const body = msgMap[a.kind] || 'Action required on your Value Exchange account.';
    const { error } = await supabase.from('notifications').insert({
      user_id: a.merchantId,
      title:   a.title,
      message: body,
      type:    'warning',
    });
    setNotifyingId(null);
    if (error) { toast({ title: 'Failed to notify merchant', description: error.message, variant: 'destructive' }); return; }
    setNotifiedIds(prev => new Set([...prev, a.id]));
  };

  const filteredAudit = auditSearch
    ? localAudit.filter(a => {
        const q = auditSearch.toLowerCase();
        return (
          a.businessName?.toLowerCase().includes(q) ||
          a.fullName?.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.userId?.toLowerCase().includes(q) ||
          a.action?.toLowerCase().includes(q)
        );
      })
    : localAudit;

  const paginate = (arr: any[], page: number) => arr.slice((page - 1) * PAGE_SIZE_A, page * PAGE_SIZE_A);
  const pageCount = (arr: any[]) => Math.ceil(arr.length / PAGE_SIZE_A);

  const Pager = ({ total, page, setPage }: { total: number; page: number; setPage: (p: number) => void }) => {
    const pages = Math.ceil(total / PAGE_SIZE_A);
    if (pages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <p className="text-xs text-gray-500">Showing {(page - 1) * PAGE_SIZE_A + 1}–{Math.min(page * PAGE_SIZE_A, total)} of {total}</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(page - 1)}>
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          </Button>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`h-7 w-7 rounded text-xs font-medium transition-colors ${p === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{p}</button>
          ))}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const LoadingRow = ({ cols }: { cols: number }) => (
    <tr><td colSpan={cols} className="px-4 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400 mx-auto" /></td></tr>
  );
  const EmptyRow = ({ cols, msg }: { cols: number; msg: string }) => (
    <tr><td colSpan={cols} className="px-4 py-12 text-center text-sm text-gray-400">{msg}</td></tr>
  );

  return (
  <div>
    <SectionTitle title="Activity" sub="System-wide monitoring, alerts, and dispute tracking" />

    {sub === 'Transaction Feed' && (
      <>
        {/* Transaction Detail Modal */}
        {selectedTx && (() => {
          const t = selectedTx;
          const isDebit = ['debit', 'fee', 'withholding', 'reversal', 'write_off'].includes(t.type);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedTx(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={`px-6 py-4 flex items-center justify-between ${isDebit ? 'bg-red-50 border-b border-red-100' : 'bg-emerald-50 border-b border-emerald-100'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${isDebit ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {isDebit ? 'DEBIT' : 'CREDIT'}
                    </span>
                    <span className={`text-xl font-bold ${isDebit ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isDebit ? '−' : '+'}{t.amount.toLocaleString()} pts
                    </span>
                  </div>
                  <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>
                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                  {/* Parties */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 font-medium mb-1">FROM</p>
                      <p className="text-sm font-semibold text-gray-900">{t.from}</p>
                      {t.fromOwner && t.fromOwner !== t.from && <p className="text-xs text-gray-500 mt-0.5">{t.fromOwner}</p>}
                      {t.fromEmail && <p className="text-xs text-gray-400 mt-0.5">{t.fromEmail}</p>}
                      {t.fromId && <p className="text-xs text-gray-300 mt-1 font-mono">{t.fromId.slice(0, 16)}…</p>}
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 font-medium mb-1">TO</p>
                      <p className="text-sm font-semibold text-gray-900">{t.to}</p>
                      {t.toOwner && t.toOwner !== t.to && <p className="text-xs text-gray-500 mt-0.5">{t.toOwner}</p>}
                      {t.toEmail && <p className="text-xs text-gray-400 mt-0.5">{t.toEmail}</p>}
                      {t.toId && <p className="text-xs text-gray-300 mt-1 font-mono">{t.toId.slice(0, 16)}…</p>}
                    </div>
                  </div>
                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-gray-400">Transaction ID</p><p className="font-mono text-xs text-gray-600 mt-0.5">{t.id}</p></div>
                    <div><p className="text-xs text-gray-400">Type</p><p className="capitalize font-medium text-gray-800 mt-0.5">{t.type}</p></div>
                    <div><p className="text-xs text-gray-400">Status</p><div className="mt-0.5"><Pill status={t.status} /></div></div>
                    <div><p className="text-xs text-gray-400">Date &amp; Time</p><p className="text-gray-700 mt-0.5">{t.time}</p></div>
                  </div>
                  {t.description && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Description</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{t.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <Card className="border-0 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
            <SHSearch value={txSearch} onChange={v => { setTxSearch(v); setTxPage(1); }} placeholder="Search from, to, description…" />
            <select
              value={txSort}
              onChange={e => setTxSort(e.target.value as any)}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
            >
              <option value="time-desc">Time: Newest first</option>
              <option value="time-asc">Time: Oldest first</option>
              <option value="amount-desc">Amount: Highest first</option>
              <option value="amount-asc">Amount: Lowest first</option>
              <option value="from">From: A → Z</option>
              <option value="to">To: A → Z</option>
            </select>
            {txSearch && <span className="text-xs text-gray-400 shrink-0">{activityTxns.filter((t: any) => [t.from, t.to, t.fromOwner, t.toOwner, t.description].some((v: any) => v?.toLowerCase().includes(txSearch.toLowerCase()))).length} of {activityTxns.length}</span>}
          </div>
          <CardContent className="p-0 overflow-x-auto">
            {(() => {
              const txFiltered = txSearch.trim()
                ? activityTxns.filter((t: any) => [t.from, t.to, t.fromOwner, t.toOwner, t.description].some((v: any) => v?.toLowerCase().includes(txSearch.toLowerCase())))
                : activityTxns;
              const txSorted = [...txFiltered].sort((a: any, b: any) => {
                if (txSort === 'time-desc')   return String(b.rawCreatedAt ?? '').localeCompare(String(a.rawCreatedAt ?? ''));
                if (txSort === 'time-asc')    return String(a.rawCreatedAt ?? '').localeCompare(String(b.rawCreatedAt ?? ''));
                if (txSort === 'amount-desc') return (b.amount ?? 0) - (a.amount ?? 0);
                if (txSort === 'amount-asc')  return (a.amount ?? 0) - (b.amount ?? 0);
                if (txSort === 'from')        return (a.from ?? '').localeCompare(b.from ?? '');
                if (txSort === 'to')          return (a.to ?? '').localeCompare(b.to ?? '');
                return 0;
              });
              return (
            <table className="w-full min-w-[700px]">
              <thead className="border-y bg-gray-50">
                <tr>
                  <TH>From</TH><TH>To</TH><TH>Debit / Credit</TH><TH right>Amount</TH><TH>Type</TH><TH>Description</TH><TH>Status</TH><TH>Time</TH>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activityLoading ? <LoadingRow cols={8} /> : paginate(txSorted, txPage).length === 0 ? <EmptyRow cols={8} msg="No transactions yet" /> :
                  paginate(txSorted, txPage).map((t: any) => {
                    const isDebit = ['debit', 'fee', 'withholding', 'reversal', 'write_off'].includes(t.type);
                    return (
                      <tr key={t.id} onClick={() => setSelectedTx(t)} className="hover:bg-emerald-50/40 cursor-pointer transition-colors">
                        <TD>
                          <p className="font-semibold text-gray-900 text-sm">{t.from}</p>
                          {t.fromOwner && t.fromOwner !== t.from && <p className="text-xs text-gray-400 mt-0.5">{t.fromOwner}</p>}
                        </TD>
                        <TD>
                          <p className="font-semibold text-gray-800 text-sm">{t.to}</p>
                          {t.toOwner && t.toOwner !== t.to && <p className="text-xs text-gray-400 mt-0.5">{t.toOwner}</p>}
                        </TD>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isDebit ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                            {isDebit ? 'Debit' : 'Credit'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-bold ${isDebit ? 'text-red-600' : 'text-emerald-600'}`}>
                          {isDebit ? '−' : '+'}{t.amount.toLocaleString()}
                        </td>
                        <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full capitalize">{t.type}</span></TD>
                        <TD><p className="text-xs text-gray-500 max-w-[160px] truncate">{t.description || '—'}</p></TD>
                        <TD><Pill status={t.status} /></TD>
                        <TD><span className="text-xs text-gray-400">{t.time}</span></TD>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
              );
            })()}
          </CardContent>
          <Pager total={txSearch.trim() ? activityTxns.filter((t: any) => [t.from, t.to, t.fromOwner, t.toOwner, t.description].some((v: any) => v?.toLowerCase().includes(txSearch.toLowerCase()))).length : activityTxns.length} page={txPage} setPage={setTxPage} />
        </Card>
      </>
    )}

    {sub === 'User Activity' && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Recent User Activity
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={auditSearch} onChange={e => { setAuditSearch(e.target.value); setAuditPage(1); }}
                className="pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 w-full sm:w-56" placeholder="Filter by user…" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-0">
          {activityLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
          ) : filteredAudit.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">No activity logs found</div>
          ) : paginate(filteredAudit, auditPage).map(a => (
            <div key={a.id} className="flex items-start justify-between p-3 border rounded-xl hover:bg-gray-50 gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{a.action}</p>
                  {/* Identity row */}
                  <div className="mt-0.5 space-y-0.5">
                    {a.businessName && (
                      <p className="text-xs font-medium text-gray-700">{a.businessName}</p>
                    )}
                    {a.fullName && a.fullName !== a.businessName && (
                      <p className="text-xs text-gray-600">{a.fullName}</p>
                    )}
                    {a.email && (
                      <p className="text-xs text-indigo-600">{a.email}</p>
                    )}
                    <p className="text-xs text-gray-400 font-mono">
                      ID: {a.userId}
                      {a.recordId && <span className="ml-2 text-gray-300">· Record: {a.recordId.slice(0, 8)}</span>}
                    </p>
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 pt-0.5">{a.time}</span>
            </div>
          ))}
        </CardContent>
        {pageCount(filteredAudit) > 1 && <Pager total={filteredAudit.length} page={auditPage} setPage={setAuditPage} />}
        {!auditSearch && hasMore && (
          <div className="flex justify-center px-4 py-3 border-t">
            <Button variant="outline" size="sm" onClick={loadMoreAudit} disabled={loadingMore}
              className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 w-full">
              {loadingMore
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />Loading…</>
                : `Load more  (showing ${localAudit.length})`
              }
            </Button>
          </div>
        )}
        {!auditSearch && !hasMore && localAudit.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-3 border-t">All {localAudit.length} records loaded</p>
        )}
      </Card>
    )}

    {sub === 'System Alerts' && (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            System Alerts
            <p className="text-xs font-normal text-gray-400">
              {alerts.filter(a => a.type === 'error').length} errors · {alerts.filter(a => a.type === 'warning').length} warnings
            </p>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-0">
          {activityLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
          ) : paginate(alerts, alertPage).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">All clear</p>
              <p className="text-xs text-gray-400">No system alerts — everything looks healthy</p>
            </div>
          ) : paginate(alerts, alertPage).map(a => (
            <div key={a.id} className={`flex items-start gap-4 p-4 rounded-xl border ${
              a.type === 'error' ? 'bg-red-50 border-red-200' : a.type === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${a.type === 'error' ? 'bg-red-100' : a.type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                {a.kind === 'pos' || a.kind === 'pos_stale'
                  ? <WifiOff className={`h-4 w-4 ${a.type === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
                  : a.kind === 'token'
                  ? <Clock className="h-4 w-4 text-amber-600" />
                  : a.kind === 'dispute'
                  ? <Flag className="h-4 w-4 text-red-600" />
                  : a.kind === 'w9'
                  ? <FileText className="h-4 w-4 text-amber-600" />
                  : a.type === 'error'
                  ? <XCircle className="h-4 w-4 text-red-600" />
                  : a.type === 'warning'
                  ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                  : <Bell className="h-4 w-4 text-blue-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                {/* Title + badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                    a.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{a.type}</span>
                </div>
                {/* Main description */}
                <p className="text-sm text-gray-700 mt-1">{a.message}</p>
                {/* Detail rows */}
                <div className="mt-2 space-y-1">
                  {a.kind === 'webhook' && (
                    <>
                      {a.provider && <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Provider:</span> {a.provider}</p>}
                      {a.endpoint && <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Endpoint:</span> {a.endpoint}</p>}
                      <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Account:</span> {a.userId}</p>
                    </>
                  )}
                  {(a.kind === 'pos' || a.kind === 'pos_stale' || a.kind === 'token') && (
                    <>
                      <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Provider:</span> {a.provider}</p>
                      {a.posStatus && <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Status:</span> {a.posStatus}</p>}
                      <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Account:</span> {a.userId}{a.merchantEmail ? ` — ${a.merchantEmail}` : ''}</p>
                      {a.lastSync !== null && <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Last Sync:</span> {a.lastSync || 'Never'}</p>}
                    </>
                  )}
                  {(a.kind === 'dispute' || a.kind === 'w9') && (
                    <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Account:</span> {a.userId}{a.merchantEmail ? ` — ${a.merchantEmail}` : ''}</p>
                  )}
                  <p className="text-xs text-gray-400"><span className="font-medium text-gray-500">
                    {a.kind === 'token' ? 'Expires:' : 'Detected:'}
                  </span> {a.time}</p>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {a.kind === 'webhook' && (
                    <Button size="sm" variant="outline"
                      className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                      disabled={retryingId === a.id}
                      onClick={() => handleRetryWebhook(a.id)}>
                      {retryingId === a.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Retry Webhook
                    </Button>
                  )}
                  {a.kind === 'pos' && a.posStatus === 'disconnect_requested' && (
                    <>
                      <Button size="sm"
                        className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                        disabled={actioningId === a.id}
                        onClick={() => handleApproveDisconnect(a.id)}>
                        {actioningId === a.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Approve Disconnect
                      </Button>
                      <Button size="sm" variant="outline"
                        className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        disabled={actioningId === a.id}
                        onClick={() => handleKeepConnected(a.id)}>
                        Keep Connected
                      </Button>
                    </>
                  )}
                  {a.merchantId && (
                    <Button size="sm" variant="outline"
                      className={`h-7 text-xs ${notifiedIds.has(a.id) ? 'border-emerald-200 text-emerald-700' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}
                      disabled={notifyingId === a.id || notifiedIds.has(a.id)}
                      onClick={() => handleNotifyMerchant(a)}>
                      {notifyingId === a.id
                        ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Sending…</>
                        : notifiedIds.has(a.id)
                        ? <><CheckCircle className="h-3 w-3 mr-1" />Notified</>
                        : <><Send className="h-3 w-3 mr-1" />Notify Merchant</>
                      }
                    </Button>
                  )}
                  <Button size="sm" variant="ghost"
                    className="h-7 text-xs text-gray-400 hover:text-gray-600 ml-auto"
                    onClick={() => handleDismissAlert(a.id)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
        <Pager total={alerts.length} page={alertPage} setPage={setAlertPage} />
      </Card>
    )}

    {sub === 'Suspicious Behavior' && (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-800">High Risk Accounts</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{suspicious.filter(s => s.severity === 'high').length}</p>
            <p className="text-xs text-red-600 mt-0.5">Require immediate review</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800">Medium Risk Accounts</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{suspicious.filter(s => s.severity === 'medium').length}</p>
            <p className="text-xs text-amber-600 mt-0.5">Under monitoring</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
            <SHSearch value={suspSearch} onChange={v => { setSuspSearch(v); setSuspPage(1); }} placeholder="Search business or email…" />
            <select
              value={suspSort}
              onChange={e => setSuspSort(e.target.value as any)}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 bg-white text-gray-600"
            >
              <option value="severity-desc">Severity: Highest first</option>
              <option value="sent-desc">Sent: Highest first</option>
              <option value="sent-asc">Sent: Lowest first</option>
              <option value="received-desc">Received: Highest first</option>
              <option value="received-asc">Received: Lowest first</option>
              <option value="name">Name: A → Z</option>
            </select>
            {suspSearch && <span className="text-xs text-gray-400 shrink-0">{suspicious.filter(s => [s.businessName, s.email].some((v: any) => v?.toLowerCase().includes(suspSearch.toLowerCase()))).length} of {suspicious.length}</span>}
          </div>
          <CardContent className="p-0 overflow-x-auto">
            {(() => {
              const severityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
              const suspFiltered = suspSearch.trim()
                ? suspicious.filter(s => [s.businessName, s.email].some((v: any) => v?.toLowerCase().includes(suspSearch.toLowerCase())))
                : suspicious;
              const suspSorted = [...suspFiltered].sort((a: any, b: any) => {
                if (suspSort === 'severity-desc')  return (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
                if (suspSort === 'sent-desc')       return (b.sent ?? 0) - (a.sent ?? 0);
                if (suspSort === 'sent-asc')        return (a.sent ?? 0) - (b.sent ?? 0);
                if (suspSort === 'received-desc')   return (b.received ?? 0) - (a.received ?? 0);
                if (suspSort === 'received-asc')    return (a.received ?? 0) - (b.received ?? 0);
                if (suspSort === 'name')            return (a.businessName ?? '').localeCompare(b.businessName ?? '');
                return 0;
              });
              return (
            <table className="w-full min-w-[700px]">
              <thead className="border-y bg-gray-50">
                <tr>
                  <TH>Business / Owner</TH><TH>Issues Detected</TH><TH>Sent (30d)</TH><TH>Received (30d)</TH><TH>Severity</TH><TH right>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activityLoading ? <LoadingRow cols={6} /> : paginate(suspSorted, suspPage).length === 0 ? <EmptyRow cols={6} msg="No suspicious accounts detected" /> :
                  paginate(suspSorted, suspPage).map(s => (
                    <tr key={s.id} className={`hover:bg-gray-50 ${s.severity === 'high' ? 'bg-red-50/30' : s.severity === 'medium' ? 'bg-amber-50/20' : ''}`}>
                      <TD>
                        <p className="font-semibold text-gray-900">{s.businessName}</p>
                        {s.email && <p className="text-xs text-gray-400 mt-0.5">{s.email}</p>}
                      </TD>
                      <TD><p className="text-xs text-gray-700 max-w-[220px]">{s.issue}</p></TD>
                      <TD><span className="font-medium">{s.sent}</span></TD>
                      <TD><span className="font-medium">{s.received}</span></TD>
                      <TD><Pill status={s.severity} /></TD>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!s.suspended ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                              disabled={actioningId === s.id}
                              onClick={() => handleSuspend(s.id)}>
                              {actioningId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Ban className="h-3.5 w-3.5 mr-1" />Suspend</>}
                            </Button>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Suspended</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
              );
            })()}
          </CardContent>
          <Pager total={suspSearch.trim() ? suspicious.filter(s => [s.businessName, s.email].some((v: any) => v?.toLowerCase().includes(suspSearch.toLowerCase()))).length : suspicious.length} page={suspPage} setPage={setSuspPage} />

        </Card>
      </div>
    )}

    {sub === 'Disputes' && (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Flag}        label="Open Disputes" value={disputes.filter(d => d.status === 'open').length}     color="red"    />
          <StatCard icon={CheckCircle} label="Resolved"      value={disputes.filter(d => d.status === 'resolved').length} color="emerald"/>
          <StatCard icon={AlertCircle} label="Total"         value={disputes.length}                                      color="amber"  />
        </div>

        <Card className="border-0 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
            <SHSearch value={dispSearch} onChange={v => { setDispSearch(v); setDispPage(1); }} placeholder="Search reporter, reported, or issue…" />
            <select
              value={dispSort}
              onChange={e => setDispSort(e.target.value as any)}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 bg-white text-gray-600"
            >
              <option value="date-desc">Date: Newest first</option>
              <option value="date-asc">Date: Oldest first</option>
              <option value="amount-desc">Amount: Highest first</option>
              <option value="amount-asc">Amount: Lowest first</option>
              <option value="status">Status: A → Z</option>
              <option value="reporter">Reporter: A → Z</option>
            </select>
            {dispSearch && <span className="text-xs text-gray-400 shrink-0">{disputes.filter(d => [d.reporter, d.reported, d.issue].some((v: any) => v?.toLowerCase().includes(dispSearch.toLowerCase()))).length} of {disputes.length}</span>}
          </div>
          <CardContent className="p-0 overflow-x-auto">
            {(() => {
              const dispFiltered = dispSearch.trim()
                ? disputes.filter(d => [d.reporter, d.reported, d.issue].some((v: any) => v?.toLowerCase().includes(dispSearch.toLowerCase())))
                : disputes;
              const dispSorted = [...dispFiltered].sort((a: any, b: any) => {
                if (dispSort === 'date-desc')   return String(b.rawDate ?? '').localeCompare(String(a.rawDate ?? ''));
                if (dispSort === 'date-asc')    return String(a.rawDate ?? '').localeCompare(String(b.rawDate ?? ''));
                if (dispSort === 'amount-desc') return (b.amount ?? 0) - (a.amount ?? 0);
                if (dispSort === 'amount-asc')  return (a.amount ?? 0) - (b.amount ?? 0);
                if (dispSort === 'status')      return (a.status ?? '').localeCompare(b.status ?? '');
                if (dispSort === 'reporter')    return (a.reporter ?? '').localeCompare(b.reporter ?? '');
                return 0;
              });
              return (
            <table className="w-full min-w-[500px]">
              <thead className="border-y bg-gray-50">
                <tr>
                  <TH>Reporter</TH><TH>Reported</TH><TH>Issue</TH><TH right>Amount</TH><TH>Status</TH><TH>Date</TH><TH right>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activityLoading ? <LoadingRow cols={7} /> : paginate(dispSorted, dispPage).length === 0 ? <EmptyRow cols={7} msg="No disputes found" /> :
                  paginate(dispSorted, dispPage).map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <TD><p className="font-medium">{d.reporter}</p></TD>
                      <TD><p className="text-gray-600">{d.reported}</p></TD>
                      <TD><p className="text-xs text-gray-600 max-w-[140px] truncate">{d.issue}</p></TD>
                      <TD right><span className="font-semibold">{d.amount.toLocaleString()}</span></TD>
                      <TD><Pill status={d.status} /></TD>
                      <TD><span className="text-xs text-gray-400">{d.date}</span></TD>
                      <td className="px-4 py-3 text-right">
                        {(d.status === 'open' || d.status === 'mediation') && (
                          <div className="flex items-center justify-end gap-1">
                            {d.status === 'open' && (
                              <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-200"
                                disabled={actioningId === d.id}
                                onClick={() => handleDisputeAction(d.id, 'mediate')}>
                                {actioningId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mediate'}
                              </Button>
                            )}
                            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                              disabled={actioningId === d.id}
                              onClick={() => handleDisputeAction(d.id, 'resolve')}>
                              {actioningId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Resolve'}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
              );
            })()}
          </CardContent>
          <Pager total={dispSearch.trim() ? disputes.filter(d => [d.reporter, d.reported, d.issue].some((v: any) => v?.toLowerCase().includes(dispSearch.toLowerCase()))).length : disputes.length} page={dispPage} setPage={setDispPage} />

        </Card>
      </div>
    )}
  </div>
  );
};

// ─── TxMonSection ─────────────────────────────────────────────────────────────

export default ActivitySection;
