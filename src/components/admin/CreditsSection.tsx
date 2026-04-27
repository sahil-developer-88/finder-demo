import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  AlertCircle, AlertTriangle, ArrowDownLeft, ArrowUpRight, Ban, BarChart2, BookOpen, CheckCircle,
  ChevronRight, Coins, CreditCard, DollarSign, Download, Edit2, FileText, Loader2, MessageSquare, Pause, RefreshCw, Search, Trash2, TrendingUp,
} from 'lucide-react';
import MerchantSearchCombobox from '@/components/payment-requests/MerchantSearchCombobox';
import { SectionTitle, StatCard, Pill, TH, TD, AdminPager, SHSearch } from '@/components/admin/shared/ui';

const SuspendedTab = ({
  suspendedAccounts, agingLoading, setSub, onWriteOffComplete, onReinstate, adminId,
}: {
  suspendedAccounts: any[];
  agingLoading: boolean;
  setSub: (s: string) => void;
  onWriteOffComplete: () => void;
  onReinstate: (account: any) => void;
  adminId: string | undefined;
}) => {
  const PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const [suspSearch, setSuspSearch] = useState('');
  const [suspSort, setSuspSort] = useState<'balance-desc' | 'balance-asc' | 'name' | 'risk'>('balance-desc');
  const filteredSusp = (suspSearch.trim()
    ? suspendedAccounts.filter((a: any) => a.businessName?.toLowerCase().includes(suspSearch.toLowerCase()))
    : suspendedAccounts
  ).slice().sort((a: any, b: any) => {
    if (suspSort === 'balance-desc') return Math.abs(b.balance) - Math.abs(a.balance);
    if (suspSort === 'balance-asc')  return Math.abs(a.balance) - Math.abs(b.balance);
    if (suspSort === 'name')         return (a.businessName ?? '').localeCompare(b.businessName ?? '');
    if (suspSort === 'risk')         return (a.risk ?? '').localeCompare(b.risk ?? '');
    return 0;
  });
  const totalPages = Math.ceil(filteredSusp.length / PER_PAGE);
  const paginated = filteredSusp.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const [confirmAccount, setConfirmAccount] = useState<any>(null);
  const [writing, setWriting] = useState(false);
  const [done, setDone] = useState<string>('');
  const [reinstating, setReinstating] = useState<string | null>(null);
  const [reinstated, setReinstated] = useState('');

  const handleReinstate = async (a: any) => {
    setReinstating(a.id);
    await supabase.from('businesses').update({ status: 'active' }).eq('user_id', a.id);
    await supabase.from('audit_logs').insert({
      user_id:    adminId,
      action:     'account_reinstated',
      table_name: 'businesses',
      record_id:  a.id,
      old_data:   { status: 'suspended' },
      new_data:   { status: 'active', business: a.businessName, reason: 'Account reinstated', section: 'Exchange Ledger > Suspended' },
    });
    setReinstated(a.businessName);
    setReinstating(null);
    onReinstate(a);
  };

  const handleWriteOff = async () => {
    if (!confirmAccount) return;
    setWriting(true);
    const { error } = await supabase.rpc('admin_write_off_credits', {
      p_target_user_id: confirmAccount.id,
      p_reason:         `Write-off approved — ${confirmAccount.daysNegative === 999 ? 'unknown duration' : `${confirmAccount.daysNegative} days`} negative (balance: -$${Math.abs(confirmAccount.balance).toLocaleString()})`,
    });
    if (!error) {
      setDone(confirmAccount.businessName);
      setConfirmAccount(null);
      onWriteOffComplete();
    }
    setWriting(false);
  };

  return (
    <div className="space-y-5">
      {/* Confirmation Dialog */}
      {confirmAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Confirm Write-Off</p>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-gray-800">{confirmAccount.businessName}</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                -${Math.abs(confirmAccount.balance).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {confirmAccount.daysNegative === 999 ? 'Unknown duration' : `${confirmAccount.daysNegative} days negative`}
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-5">
              This will zero out their balance, record the loss in the Write-offs ledger, and remove them from Suspended accounts.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmAccount(null)}
                disabled={writing}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleWriteOff}
                disabled={writing}
              >
                {writing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirm Write-Off'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
          ✓ {done} has been written off and moved to the Write-offs ledger.
        </div>
      )}

      {reinstated && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium">
          ✓ {reinstated} has been reinstated and is now active.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Ban}           label="Suspended (90d+)"    value={suspendedAccounts.length}                                                                                     color="red"   />
        <StatCard icon={AlertTriangle} label="Total Exposure"       value={`$${suspendedAccounts.reduce((s: number, a: any) => s + Math.abs(a.balance), 0).toLocaleString()}`}           color="amber" />
        <StatCard icon={DollarSign}    label="Avg Negative Balance" value={suspendedAccounts.length ? `$${Math.round(suspendedAccounts.reduce((s: number, a: any) => s + Math.abs(a.balance), 0) / suspendedAccounts.length).toLocaleString()}` : '$0'} color="rose" />
      </div>

      <Card className="border-0 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
          <SHSearch value={suspSearch} onChange={v => { setSuspSearch(v); setPage(1); }} placeholder="Search business…" />
          <select
            value={suspSort}
            onChange={e => setSuspSort(e.target.value as any)}
            className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 bg-white text-gray-600"
          >
            <option value="balance-desc">Balance: Highest first</option>
            <option value="balance-asc">Balance: Lowest first</option>
            <option value="name">Name: A → Z</option>
            <option value="risk">Risk level</option>
          </select>
          {suspSearch && <span className="text-xs text-gray-400 shrink-0">{filteredSusp.length} of {suspendedAccounts.length}</span>}
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="border-y bg-gray-50">
              <tr><TH>Business</TH><TH right>Balance</TH><TH>Risk</TH><TH right>Actions</TH></tr>
            </thead>
            <tbody className="divide-y">
              {agingLoading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-red-400 mx-auto" /></td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">{suspSearch ? 'No results match your search' : 'No suspended accounts'}</td></tr>
              ) : paginated.map((a: any) => (
                <tr key={a.id} className="hover:bg-red-50/30 bg-red-50/10">
                  <TD><p className="font-medium text-gray-900">{a.businessName}</p></TD>
                  <TD right><span className="text-sm font-bold text-red-600">-${Math.abs(a.balance).toLocaleString()}</span></TD>
                  <TD><Pill status={a.risk} /></TD>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        disabled={reinstating === a.id}
                        onClick={() => { setReinstated(''); handleReinstate(a); }}
                      >
                        {reinstating === a.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <><RefreshCw className="h-3 w-3 mr-1" />Reinstate</>}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filteredSusp.length)} of {filteredSusp.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-7 w-7 rounded text-xs font-medium transition-colors ${p === page ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {p}
                  </button>
                ))}
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const CreditsSection = ({ sub, setSub, memberCredits: realCredits, memberCreditsLoading, creditAdjLog, setCreditAdjLog, creditAdjLoading, agingData, agingLoading, suspendedAccounts, setSuspendedAccounts, setMemberCredits, monthlyData, allUsers }: {
  sub: string;
  setSub: (s: string) => void;
  memberCredits: any[];
  memberCreditsLoading: boolean;
  creditAdjLog: any[];
  setCreditAdjLog: React.Dispatch<React.SetStateAction<any[]>>;
  creditAdjLoading: boolean;
  agingData: any[];
  agingLoading: boolean;
  suspendedAccounts: any[];
  setSuspendedAccounts: React.Dispatch<React.SetStateAction<any[]>>;
  setMemberCredits: React.Dispatch<React.SetStateAction<any[]>>;
  monthlyData: { month: string; credits: number; trades: number }[];
  allUsers: any[];
}) => {
  const { user } = useAuth();
  const members = memberCreditsLoading ? [] : (realCredits.length > 0 ? realCredits : []);
  // All users for the adjustment dropdown — includes users with no credit row yet
  const allUsersForDropdown = allUsers.map((u: any) => ({
    id: u.user_id,
    businessName: u.business_name || u.full_name || u.email || u.user_id?.slice(0, 8),
    email: u.email || '',
  })).sort((a: any, b: any) => a.businessName.localeCompare(b.businessName));

  const [selectedMember,    setSelectedMember]    = useState<any>(null);
  const [memberSearch,      setMemberSearch]      = useState('');
  const [memberSort,        setMemberSort]        = useState<'balance-desc' | 'balance-asc' | 'name' | 'status'>('balance-desc');
  const [creditAmt,      setCreditAmt]      = useState('');
  const [creditBiz,      setCreditBiz]      = useState('');
  const [creditType,     setCreditType]     = useState<'credit' | 'debit'>('credit');
  const [reason,         setReason]         = useState('promo');
  const [adjNotes,       setAdjNotes]       = useState('');

  // Batch issue state
  const [batchRows,      setBatchRows]      = useState<{ userId: string; name: string; amount: string }[]>([]);
  const [batchPickId,    setBatchPickId]    = useState('');
  const [batchPickName,  setBatchPickName]  = useState('');
  const [batchPickAmt,   setBatchPickAmt]   = useState('');
  const [batchReason,    setBatchReason]    = useState('promo');
  const [batchNotes,     setBatchNotes]     = useState('');
  const [batchRunning,   setBatchRunning]   = useState(false);
  const [batchResult,    setBatchResult]    = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!batchResult) return;
    const t = setTimeout(() => setBatchResult(null), 5000);
    return () => clearTimeout(t);
  }, [batchResult]);
  const [selectedRisk,   setSelectedRisk]   = useState<any>(null);
  const [riskFilter,     setRiskFilter]     = useState<'all' | 'high-risk' | 'dormant'>('all');
  const [riskSearch,     setRiskSearch]     = useState('');
  const [suspendDialog,  setSuspendDialog]  = useState<any>(null);
  const [suspending,     setSuspending]     = useState(false);
  const [suspendDone,    setSuspendDone]    = useState('');
  const [auditPage,      setAuditPage]      = useState(1);
  const AUDIT_PAGE_SIZE = 10;
  const [auditLogSearch, setAuditLogSearch] = useState('');
  const [auditLogSort,   setAuditLogSort]   = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'target' | 'reason'>('date-desc');
  const [writeOffSearch, setWriteOffSearch] = useState('');
  const [writeOffSort,   setWriteOffSort]   = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'target'>('date-desc');

  // ── Platform Ledger state ──────────────────────────────────────────────────
  const [platformLedger,        setPlatformLedger]        = useState<any[]>([]);
  const [platformLedgerLoading, setPlatformLedgerLoading] = useState(false);
  const [plUserFilter,          setPlUserFilter]          = useState('');
  const [plSourceFilter,        setPlSourceFilter]        = useState('all');
  const [plEntryFilter,         setPlEntryFilter]         = useState<'all' | 'credit' | 'debit'>('all');
  const [plDateFrom,            setPlDateFrom]            = useState('');
  const [plDateTo,              setPlDateTo]              = useState('');
  const [selectedLedgerEntry,   setSelectedLedgerEntry]   = useState<any | null>(null);

  useEffect(() => {
    if (sub !== 'Platform Ledger') return;
    setPlatformLedgerLoading(true);
    (async () => {
      const { data: entries } = await supabase
        .from('ledger_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!entries || entries.length === 0) {
        setPlatformLedger([]);
        setPlatformLedgerLoading(false);
        return;
      }
      const userIds = [...new Set(entries.map((e: any) => e.user_id))];
      const [{ data: profiles }, { data: credits }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, business_name, email').in('user_id', userIds as string[]),
        supabase.from('user_credits').select('user_id, available_credits').in('user_id', userIds as string[]),
      ]);
      const nameMap = Object.fromEntries(
        (profiles ?? []).map((p: any) => [
          p.user_id,
          p.business_name || p.full_name || p.email || (p.user_id as string)?.slice(0, 8),
        ])
      );
      const balanceMap = Object.fromEntries(
        (credits ?? []).map((c: any) => [c.user_id, c.available_credits ?? 0])
      );
      setPlatformLedger(entries.map((e: any) => ({
        ...e,
        userName:       nameMap[e.user_id] ?? 'Unknown',
        currentBalance: balanceMap[e.user_id] ?? 0,
      })));
      setPlatformLedgerLoading(false);
    })();
  }, [sub]);

  const handleSuspend = async () => {
    if (!suspendDialog) return;
    setSuspending(true);
    await supabase
      .from('businesses')
      .update({ status: 'suspended' })
      .eq('user_id', suspendDialog.id);
    await supabase.from('audit_logs').insert({
      user_id:    user?.id,
      action:     'account_suspended',
      table_name: 'businesses',
      record_id:  suspendDialog.id,
      old_data:   { status: 'active', days_negative: suspendDialog.daysNegative, balance: suspendDialog.balance },
      new_data:   { status: 'suspended', business: suspendDialog.businessName, reason: 'Account suspended — negative balance over threshold', section: 'Exchange Ledger > Aging & Risk' },
    });
    setSuspendedAccounts(prev => {
      if (prev.find(x => x.id === suspendDialog.id)) return prev;
      return [...prev, { ...suspendDialog }];
    });
    setSuspendDone(suspendDialog.businessName);
    setSuspendDialog(null);
    setSuspending(false);
  };

  // Auto-select first member when data loads
  useEffect(() => {
    if (members.length > 0 && !selectedMember) setSelectedMember(members[0]);
  }, [members]);

  useEffect(() => {
    if (agingData.length > 0 && !selectedRisk) setSelectedRisk(agingData[0]);
  }, [agingData]);

  const totalIssued      = members.reduce((s, m) => s + m.earned, 0);
  const totalOutstanding = members.reduce((s, m) => s + Math.max(0, m.balance), 0);
  const totalNegative    = members.reduce((s, m) => s + Math.min(0, m.balance), 0);
  const netExposure      = totalOutstanding + totalNegative;

  const filteredMembers = members
    .filter(m => !memberSearch || m.businessName.toLowerCase().includes(memberSearch.toLowerCase()))
    .sort((a, b) => {
      if (memberSort === 'balance-desc') return b.balance - a.balance;
      if (memberSort === 'balance-asc')  return a.balance - b.balance;
      if (memberSort === 'name')         return a.businessName.localeCompare(b.businessName);
      if (memberSort === 'status')       return a.status.localeCompare(b.status);
      return 0;
    });

  const agingAccounts = agingData.length > 0 ? agingData : members.filter((m: any) => m.balance < 0);
  const dormantAccounts = members.filter((m: any) => (m.balance === 0 || m.balance == null) && (m.earned === 0 || m.earned == null));
  const highRiskAccounts = agingAccounts.filter((a: any) => a.risk === 'high' || a.risk === 'critical');
  const riskListBase = riskFilter === 'high-risk' ? highRiskAccounts : riskFilter === 'dormant' ? dormantAccounts : agingAccounts;
  const riskListRaw = riskSearch.trim() ? riskListBase.filter((a: any) => a.businessName?.toLowerCase().includes(riskSearch.toLowerCase())) : riskListBase;
  const writeOffs = creditAdjLog.filter(a => a.reason === 'write_off');
  const totalWrittenOff = writeOffs.reduce((s: number, a: any) => s + Math.abs(a.diff || 0), 0);

  return (
    <div>
      <SectionTitle title="Credits" sub="Exchange control center — manage member credit balances" />

      {/* ── 1. SUMMARY ── */}
      {sub === 'Summary' && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={DollarSign}   label="Total Issued"      value={`$${totalIssued.toLocaleString()}`}         color="emerald" trend={14} />
            <StatCard icon={CreditCard}   label="Outstanding"       value={`$${totalOutstanding.toLocaleString()}`}    color="blue"              />
            <StatCard icon={AlertTriangle}label="Negative Balances" value={`$${Math.abs(totalNegative).toLocaleString()}`} color="red"           />
            <StatCard icon={BarChart2}    label="Net Exposure"      value={`$${netExposure.toLocaleString()}`}          color="amber"             />
            <StatCard icon={TrendingUp}   label="Monthly Growth"    value={(() => { const last = monthlyData.at(-1)?.credits ?? 0; const prev = monthlyData.at(-2)?.credits ?? 0; return prev > 0 ? `${last >= prev ? '+' : ''}${(((last - prev) / prev) * 100).toFixed(0)}%` : '—'; })()} color="purple" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Credit Issuance Over Time</CardTitle></CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => [`$${v.toLocaleString()}`, 'Credits']} />
                      <Area type="monotone" dataKey="credits" stroke="#6366f1" fill="url(#cg2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Trade Volume</CardTitle></CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="trades" fill="#10b981" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Balance Status Breakdown</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-y bg-gray-50">
                  <tr><TH>Status</TH><TH right>Members</TH><TH right>Total Balance</TH><TH right>% of Pool</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { status: 'good',     label: 'Positive Balance', members: members.filter((m: any) => m.balance > 0),  color: 'text-emerald-600' },
                    { status: 'negative', label: 'Negative Balance', members: members.filter((m: any) => m.balance < 0),  color: 'text-red-600'     },
                    { status: 'dormant',  label: 'Zero / Dormant',   members: members.filter((m: any) => m.balance === 0), color: 'text-gray-400'   },
                  ].map(row => {
                    const total = row.members.reduce((s, m) => s + Math.abs(m.balance), 0);
                    const pct   = totalIssued > 0 ? ((total / totalIssued) * 100).toFixed(1) : '0';
                    return (
                      <tr key={row.status} className="hover:bg-gray-50">
                        <TD><div className="flex items-center gap-2"><Pill status={row.status} /><span className="text-gray-600">{row.label}</span></div></TD>
                        <TD right>{row.members.length}</TD>
                        <TD right><span className={`font-semibold ${row.color}`}>${total.toLocaleString()}</span></TD>
                        <TD right>
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 bg-gray-100 rounded-full">
                              <div className="h-1.5 rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{pct}%</span>
                          </div>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 2. MEMBER BALANCES — listing-type master/detail ── */}
      {sub === 'Member Balances' && memberCreditsLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      )}
      {sub === 'Member Balances' && !memberCreditsLoading && (
        <div className="space-y-3">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => {
            const hdr = ['Business', 'Status', 'Balance ($)', 'Credit Limit ($)', 'Available Credit ($)', 'Total Earned ($)'];
            const rows = members.map((m: any) => [
              `"${(m.businessName ?? '').replace(/"/g, '""')}"`,
              m.status ?? '',
              (m.balance ?? 0).toFixed(2),
              (m.limit ?? 0).toFixed(2),
              (m.available ?? 0).toFixed(2),
              (m.earned ?? 0).toFixed(2),
            ]);
            const csv = [hdr, ...rows].map(r => r.join(',')).join('\n');
            const el = document.createElement('a');
            el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            el.download = `member_balances_${new Date().toISOString().slice(0, 10)}.csv`;
            el.click();
          }} disabled={members.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Export All Balances
          </Button>
        </div>
        <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[500px]">
          {/* Left: member list */}
          <div className="w-72 shrink-0 flex flex-col border rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="p-3 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder="Search members…"
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                />
              </div>
              <select
                value={memberSort}
                onChange={e => setMemberSort(e.target.value as any)}
                className="w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
              >
                <option value="balance-desc">Balance: Highest first</option>
                <option value="balance-asc">Balance: Lowest first</option>
                <option value="name">Name: A → Z</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember(m)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-gray-50 ${selectedMember?.id === m.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.businessName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{m.status}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${m.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {m.balance < 0 ? '-' : '+'}${Math.abs(m.balance).toLocaleString()}
                    </span>
                  </div>
                  {/* mini balance bar */}
                  <div className="mt-2 h-1 bg-gray-100 rounded-full">
                    <div
                      className={`h-1 rounded-full ${m.balance < 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(100, (Math.abs(m.balance) / m.limit) * 100)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t px-3 py-2 bg-gray-50 shrink-0">
              <p className="text-[10px] text-gray-400 text-center">{filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Right: detail panel */}
          {selectedMember ? (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Header */}
              <div className="bg-white border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedMember.businessName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Pill status={selectedMember.status} />
                      <span className="text-xs text-gray-400">Member ID #{selectedMember.id}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${selectedMember.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {selectedMember.balance < 0 ? '-' : ''}${Math.abs(selectedMember.balance).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Current Balance</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs" onClick={async () => {
                      const { data: entries } = await supabase
                        .from('ledger_entries')
                        .select('created_at, entry_type, source, barter_amount, cash_amount, description')
                        .eq('user_id', selectedMember.id)
                        .order('created_at', { ascending: true });
                      if (!entries || entries.length === 0) return;
                      let running = 0;
                      const hdr = ['Date', 'Type', 'Source', 'Debit (pts)', 'Credit (pts)', 'Cash ($)', 'Running Balance (pts)', 'Description'];
                      const rows = entries.map((e: any) => {
                        const amt = Number(e.barter_amount ?? 0);
                        const isCredit = e.entry_type === 'credit';
                        running += isCredit ? amt : -amt;
                        return [
                          new Date(e.created_at).toLocaleString(),
                          e.entry_type.toUpperCase(),
                          e.source ?? '',
                          isCredit ? '' : amt.toFixed(2),
                          isCredit ? amt.toFixed(2) : '',
                          Number(e.cash_amount ?? 0).toFixed(2),
                          running.toFixed(2),
                          `"${(e.description ?? '').replace(/"/g, '""')}"`,
                        ];
                      });
                      const csv = [hdr, ...rows].map(r => r.join(',')).join('\n');
                      const el = document.createElement('a');
                      el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                      el.download = `statement_${selectedMember.businessName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
                      el.click();
                    }}>
                      <Download className="h-3.5 w-3.5 mr-1" />Export Statement
                    </Button>
                  </div>
                </div>
              </div>

              {/* Credit stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Credit Limit</p>
                    <p className="text-xl font-bold text-gray-900">${selectedMember.limit.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Available Credit</p>
                    <p className={`text-xl font-bold ${selectedMember.available === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                      ${selectedMember.available.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-gray-500 mb-1">Total Earned</p>
                    <p className="text-xl font-bold text-indigo-600">${selectedMember.earned.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Usage bar */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Credit Utilization</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {Math.round((Math.abs(Math.min(0, selectedMember.balance)) / selectedMember.limit) * 100)}% used
                    </p>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all ${selectedMember.balance < 0 ? 'bg-red-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(100, (Math.abs(selectedMember.balance) / selectedMember.limit) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-gray-400">
                    <span>$0</span>
                    <span>Limit: ${selectedMember.limit.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Recent adjustments for this member */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Recent Adjustments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {creditAdjLoading ? (
                    <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
                  ) : creditAdjLog.filter(a => a.target === selectedMember.businessName).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No adjustments on record</p>
                  ) : creditAdjLog.filter(a => a.target === selectedMember.businessName).slice(0, 10).map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-700">{a.reason}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{a.date ? new Date(a.date).toLocaleString() : '—'} · {a.admin}</p>
                      </div>
                      <span className={`text-sm font-bold ${(a.diff ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {(a.diff ?? 0) >= 0 ? '+' : ''}${a.diff?.toLocaleString() ?? '—'}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick actions */}
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />Adjust Limit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-red-600 border-red-200 hover:bg-red-50">
                  <Ban className="h-3.5 w-3.5 mr-1.5" />Freeze Account
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Send Notice
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a member to view details
            </div>
          )}
        </div>
        </div>
      )}

      {/* ── 3. ADJUSTMENTS ── */}
      {sub === 'Adjustments' && (
        <>
        <div className="flex gap-4 h-[600px]">
          {/* Left: form */}
          <div className="w-80 shrink-0">
            <Card className="border-0 shadow-sm h-full">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">New Adjustment</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Business</label>
                  <MerchantSearchCombobox value={creditBiz} onValueChange={setCreditBiz} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Type</label>
                  <div className="flex rounded-lg overflow-hidden border">
                    <button
                      onClick={() => setCreditType('credit')}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${creditType === 'credit' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      + Credit
                    </button>
                    <button
                      onClick={() => setCreditType('debit')}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${creditType === 'debit' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      − Debit
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Amount ($)</label>
                  <Input type="number" placeholder="0.00" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Reason Code</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  >
                    <option value="promo">Promotion</option>
                    <option value="correction">Billing Correction</option>
                    <option value="dispute">Dispute Resolution</option>
                    <option value="trade_credit_grant">Trade Credit Grant</option>
                    <option value="trade_credit_revoke">Trade Credit Revoke</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Internal Notes</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 h-24 resize-none"
                    placeholder="Reason for audit trail…"
                    value={adjNotes}
                    onChange={e => setAdjNotes(e.target.value)}
                  />
                </div>

                <Button
                  disabled={!creditBiz || !creditAmt}
                  className={`w-full ${creditType === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}
                  onClick={async () => {
                    if (!creditBiz || !creditAmt) return;
                    const delta = creditType === 'credit' ? parseFloat(creditAmt) : -parseFloat(creditAmt);

                    const { data: result, error } = await supabase.rpc('admin_adjust_credits', {
                      p_target_user_id: creditBiz,
                      p_delta:          delta,
                      p_reason:         reason,
                      p_notes:          adjNotes || null,
                    });

                    if (error) {
                      console.error('Credit adjustment failed:', error);
                      alert(`Failed: ${error.message}`);
                      return;
                    }

                    const { old_balance, new_balance } = result as any;
                    const newEarned = delta > 0 ? (old_balance || 0) + delta : undefined;

                    // Optimistically update member credits balance in UI
                    setMemberCredits(prev => prev.map(m => {
                      if (m.id !== creditBiz) return m;
                      return {
                        ...m,
                        balance:   new_balance,
                        available: Math.max(0, new_balance),
                        earned:    newEarned !== undefined ? newEarned : m.earned,
                        limit:     Math.max(1000, newEarned !== undefined ? newEarned : m.earned),
                        status:    new_balance < 0 ? 'negative' : new_balance === 0 ? 'dormant' : 'good',
                      };
                    }));

                    // Optimistically add to audit log
                    const targetName = allUsersForDropdown.find((m: any) => m.id === creditBiz)?.businessName || creditBiz.slice(0, 8);
                    setCreditAdjLog(prev => [{
                      id:     crypto.randomUUID(),
                      admin:  '—',
                      target: targetName,
                      action: 'credit_adjustment',
                      diff:   delta,
                      oldBal: old_balance,
                      newBal: new_balance,
                      date:   new Date().toISOString(),
                      reason,
                      notes:  adjNotes,
                    }, ...prev]);

                    setCreditAmt('');
                    setAdjNotes('');
                    setCreditBiz('');
                  }}
                >
                  Apply {creditType === 'credit' ? 'Credit' : 'Debit'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: audit log */}
          <div className="flex-1 overflow-y-auto">
            <Card className="border-0 shadow-sm h-full">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center justify-between">
                  Adjustment Audit Log
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                    const hdr = ['Date', 'Admin', 'Member', 'Action', 'Old Balance', 'New Balance', 'Change', 'Reason', 'Notes'];
                    const rows = creditAdjLog.map((a: any) => [
                      `"${a.date ? new Date(a.date).toLocaleString() : ''}"`,
                      `"${(a.admin ?? '').replace(/"/g, '""')}"`,
                      `"${(a.target ?? '').replace(/"/g, '""')}"`,
                      `"${a.action ?? ''}"`,
                      a.oldBal ?? '',
                      a.newBal ?? '',
                      a.diff != null ? (a.diff > 0 ? `+${a.diff}` : a.diff) : '',
                      `"${(a.reason ?? '').replace(/"/g, '""')}"`,
                      `"${(a.notes ?? '').replace(/"/g, '""')}"`,
                    ]);
                    const csv = [hdr, ...rows].map(r => r.join(',')).join('\n');
                    const el = document.createElement('a');
                    el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                    el.download = `adjustment_log_${new Date().toISOString().slice(0, 10)}.csv`;
                    el.click();
                  }} disabled={creditAdjLog.length === 0}>
                    <Download className="h-3.5 w-3.5 mr-1" />Export
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
                  <SHSearch value={auditLogSearch} onChange={v => { setAuditLogSearch(v); setAuditPage(1); }} placeholder="Search business, reason, admin…" />
                  <select
                    value={auditLogSort}
                    onChange={e => setAuditLogSort(e.target.value as any)}
                    className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
                  >
                    <option value="date-desc">Date: Newest first</option>
                    <option value="date-asc">Date: Oldest first</option>
                    <option value="amount-desc">Amount: Highest first</option>
                    <option value="amount-asc">Amount: Lowest first</option>
                    <option value="target">Business: A → Z</option>
                    <option value="reason">Reason: A → Z</option>
                  </select>
                  {auditLogSearch && <span className="text-xs text-gray-400 shrink-0">{creditAdjLog.filter(a => { const q = auditLogSearch.toLowerCase(); return [a.target, a.reason, a.admin, a.notes].some(v => v?.toLowerCase().includes(q)); }).length} of {creditAdjLog.length}</span>}
                </div>
                <div className="overflow-x-auto">
                {(() => {
                  const filtAuditLog = auditLogSearch.trim()
                    ? creditAdjLog.filter(a => { const q = auditLogSearch.toLowerCase(); return [a.target, a.reason, a.admin, a.notes].some(v => v?.toLowerCase().includes(q)); })
                    : creditAdjLog;
                  const sortedAuditLog = [...filtAuditLog].sort((a, b) => {
                    if (auditLogSort === 'date-desc') return new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();
                    if (auditLogSort === 'date-asc')  return new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime();
                    if (auditLogSort === 'amount-desc') return (b.diff ?? 0) - (a.diff ?? 0);
                    if (auditLogSort === 'amount-asc')  return (a.diff ?? 0) - (b.diff ?? 0);
                    if (auditLogSort === 'target') return (a.target ?? '').localeCompare(b.target ?? '');
                    if (auditLogSort === 'reason') return (a.reason ?? '').localeCompare(b.reason ?? '');
                    return 0;
                  });
                  return (
                <table className="w-full min-w-[500px]">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <TH>Business</TH>
                      <TH>Reason</TH>
                      <TH>Notes</TH>
                      <TH>Admin</TH>
                      <TH>Date</TH>
                      <TH right>Amount</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {creditAdjLoading ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="h-5 w-5 animate-spin text-indigo-400 mx-auto" /></td></tr>
                    ) : filtAuditLog.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">{auditLogSearch ? 'No results match your search' : 'No adjustments recorded yet'}</td></tr>
                    ) : sortedAuditLog.slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE).map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <TD><p className="font-medium text-gray-900">{a.target}</p></TD>
                        <TD><span className="text-xs text-gray-500">{a.reason}</span></TD>
                        <TD><span className="text-xs text-gray-400">{a.notes || '—'}</span></TD>
                        <TD><p className="text-gray-400 text-xs">{a.admin}</p></TD>
                        <TD><p className="text-gray-400 text-xs">{a.date ? new Date(a.date).toLocaleString() : '—'}</p></TD>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-bold ${(a.diff ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {(a.diff ?? 0) >= 0 ? '+' : ''}${a.diff?.toLocaleString() ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                  );
                })()}
                </div>
                <AdminPager total={(() => { const q = auditLogSearch.toLowerCase(); return auditLogSearch.trim() ? creditAdjLog.filter(a => [a.target,a.reason,a.admin,a.notes].some(v=>v?.toLowerCase().includes(q))).length : creditAdjLog.length; })()} page={auditPage} setPage={setAuditPage} />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Batch Issue Credits ── */}
        <Card className="border-0 shadow-sm mt-4">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              Batch Issue Credits
              <span className="text-xs font-normal text-gray-400">— issue credits to multiple members at once</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left: search + add + settings */}
              <div className="space-y-4">
                {/* Add a member row */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Add Member</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <MerchantSearchCombobox
                        value={batchPickId}
                        onValueChange={setBatchPickId}
                        onSelectFull={(id, name) => { setBatchPickId(id); setBatchPickName(name); }}
                      />
                    </div>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={batchPickAmt}
                      onChange={e => setBatchPickAmt(e.target.value)}
                      className="w-24 text-sm"
                    />
                    <Button
                      variant="outline"
                      disabled={!batchPickId || !batchPickAmt || parseFloat(batchPickAmt) <= 0}
                      onClick={() => {
                        if (batchRows.find(r => r.userId === batchPickId)) return;
                        setBatchRows(prev => [...prev, { userId: batchPickId, name: batchPickName || batchPickId.slice(0, 8), amount: batchPickAmt }]);
                        setBatchPickId('');
                        setBatchPickName('');
                        setBatchPickAmt('');
                        setBatchResult(null);
                      }}
                      className="px-3 shrink-0"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Reason + Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Reason</label>
                    <select
                      value={batchReason}
                      onChange={e => setBatchReason(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      <option value="promo">Promotion</option>
                      <option value="correction">Billing Correction</option>
                      <option value="trade_credit_grant">Trade Credit Grant</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Notes</label>
                    <Input
                      type="text"
                      value={batchNotes}
                      onChange={e => setBatchNotes(e.target.value)}
                      placeholder="Optional…"
                      className="text-sm"
                    />
                  </div>
                </div>

                {batchResult && (
                  <p className={`text-sm font-medium ${batchResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                    {batchResult.text}
                  </p>
                )}

                <Button
                  disabled={batchRows.length === 0 || batchRunning}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  onClick={async () => {
                    const entries = batchRows.map(r => ({ user_id: r.userId, amount: parseFloat(r.amount) }));
                    setBatchRunning(true);
                    setBatchResult(null);
                    const { data, error } = await supabase.rpc('admin_batch_issue_credits', {
                      p_entries: entries,
                      p_reason:  batchReason,
                      p_notes:   batchNotes || null,
                    });
                    if (error) {
                      setBatchResult({ ok: false, text: `Failed: ${error.message}` });
                    } else {
                      const r = data as any;
                      const failedIds = new Set((r.errors || []).map((e: any) => e.user_id));
                      const now = new Date().toISOString();
                      const newLogEntries = batchRows
                        .filter(row => !failedIds.has(row.userId))
                        .map(row => ({
                          id:     crypto.randomUUID(),
                          admin:  '—',
                          target: row.name,
                          action: 'credit_adjustment',
                          diff:   parseFloat(row.amount),
                          oldBal: null,
                          newBal: null,
                          date:   now,
                          reason: batchReason,
                          notes:  batchNotes || '',
                        }));
                      if (newLogEntries.length > 0) setCreditAdjLog(prev => [...newLogEntries, ...prev]);
                      const msg = `Issued to ${r.success} member${r.success !== 1 ? 's' : ''}${r.failed > 0 ? ` — ${r.failed} failed` : ''}.`;
                      setBatchResult({ ok: r.failed === 0, text: msg });
                      if (r.success > 0) { setBatchRows([]); setBatchNotes(''); }
                    }
                    setBatchRunning(false);
                  }}
                >
                  {batchRunning
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : `Issue to ${batchRows.length} member${batchRows.length !== 1 ? 's' : ''}`}
                </Button>
              </div>

              {/* Right: queue */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Queue {batchRows.length > 0 && `· ${batchRows.length} member${batchRows.length !== 1 ? 's' : ''}`}
                </p>
                {batchRows.length === 0 ? (
                  <div className="border border-dashed rounded-lg flex items-center justify-center h-32 text-sm text-gray-400">
                    No members added yet
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto divide-y">
                      {batchRows.map((r, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{r.name}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-emerald-600">+${parseFloat(r.amount).toFixed(2)}</span>
                            <button
                              onClick={() => setBatchRows(prev => prev.filter((_, j) => j !== i))}
                              className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                            >×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 bg-gray-50 border-t flex justify-between text-xs font-semibold text-gray-600">
                      <span>Total</span>
                      <span className="text-emerald-600">+${batchRows.reduce((s, r) => s + parseFloat(r.amount || '0'), 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </CardContent>
        </Card>
        </>
      )}

      {/* ── Suspend Confirmation Dialog ── */}
      {suspendDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Ban className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">Suspend Account</p>
                <p className="text-sm text-gray-500">The merchant will lose access to barter services</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
              <p className="text-sm font-semibold text-gray-800">{suspendDialog.businessName}</p>
              <p className="text-2xl font-bold text-red-600 mt-1">-${Math.abs(suspendDialog.balance).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">{suspendDialog.daysNegative} days negative balance</p>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Suspending this account will set their business status to <strong>suspended</strong>. They will not be able to list or trade until reinstated.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSuspendDialog(null)} disabled={suspending}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleSuspend} disabled={suspending}>
                {suspending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirm Suspend'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {suspendDone && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium mb-4">
          ✓ {suspendDone} has been suspended successfully.
        </div>
      )}

      {/* ── 4. AGING & RISK ── */}
      {sub === 'Aging & Risk' && (
        <div className="flex gap-4 h-[600px]">
          {/* Left: risk list */}
          <div className="w-1/2 shrink-0 flex flex-col border rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="p-3 border-b bg-gray-50 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">At-Risk Accounts</p>
                <span className="text-xs text-gray-400">{riskListRaw.length}</span>
              </div>
              {/* Filter toggle */}
              <div className="flex gap-1">
                {(['all', 'high-risk', 'dormant'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setRiskFilter(f); setSelectedRisk(null); }}
                    className={`flex-1 text-[10px] font-medium py-1 rounded-md transition-colors ${riskFilter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    {f === 'all' ? 'All' : f === 'high-risk' ? 'High Risk' : 'Dormant'}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  value={riskSearch}
                  onChange={e => { setRiskSearch(e.target.value); setSelectedRisk(null); }}
                  placeholder="Search business…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-red-300 bg-white"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {agingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-red-400" />
                </div>
              ) : riskListRaw.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                  No accounts in this category
                </div>
              ) : riskListRaw.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedRisk(a)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-gray-50 ${selectedRisk?.id === a.id ? 'bg-red-50 border-l-2 border-l-red-500' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.businessName}</p>
                    <Pill status={a.risk || 'dormant'} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-xs font-semibold ${(a.balance || 0) < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {(a.balance || 0) < 0 ? `-$${Math.abs(a.balance).toLocaleString()}` : '$0'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {a.daysNegative != null && a.daysNegative !== 999 ? `${a.daysNegative}d negative` : riskFilter === 'dormant' ? 'dormant' : '—'}
                    </span>
                  </div>
                  {(a.balance || 0) < 0 && (
                    <div className="mt-1.5 h-1 bg-gray-100 rounded-full">
                      <div
                        className={`h-1 rounded-full ${(a.daysNegative || 0) > 60 ? 'bg-red-500' : (a.daysNegative || 0) > 30 ? 'bg-amber-500' : 'bg-yellow-400'}`}
                        style={{ width: `${Math.min(100, ((a.daysNegative || 0) / 90) * 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right: risk detail */}
          {selectedRisk ? (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Header */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selectedRisk.businessName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Pill status={selectedRisk.risk || 'dormant'} />
                        {selectedRisk.daysNegative != null && selectedRisk.daysNegative !== 999
                          ? <span className="text-xs text-gray-400">{selectedRisk.daysNegative} days negative</span>
                          : <span className="text-xs text-gray-400">Dormant — no activity</span>}
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${(selectedRisk.balance || 0) < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {(selectedRisk.balance || 0) < 0 ? `-$${Math.abs(selectedRisk.balance).toLocaleString()}` : '$0'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Aging buckets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: '0–30 Day',  days: 30, color: 'bg-yellow-400', count: agingAccounts.filter((a: any) => (a.daysNegative ?? 0) <= 30).length },
                  { label: '31–60 Day', days: 60, color: 'bg-amber-500',  count: agingAccounts.filter((a: any) => (a.daysNegative ?? 0) > 30 && (a.daysNegative ?? 0) <= 60).length },
                  { label: '61–90 Day', days: 90, color: 'bg-orange-500', count: agingAccounts.filter((a: any) => (a.daysNegative ?? 0) > 60 && (a.daysNegative ?? 0) <= 90).length },
                  { label: '90+ Day',   days: 999, color: 'bg-red-500',   count: agingAccounts.filter((a: any) => (a.daysNegative ?? 0) > 90).length },
                ].map(b => (
                  <Card key={b.label} className="border-0 shadow-sm">
                    <CardContent className="p-4">
                      <div className={`w-2 h-2 rounded-full ${b.color} mb-2`} />
                      <p className="text-2xl font-bold text-gray-900">{b.count}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{b.label} Negative</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Timeline */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Aging Timeline</CardTitle></CardHeader>
                <CardContent className="p-5 pt-0">
                  <div className="relative">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-3 rounded-full ${selectedRisk.daysNegative > 60 ? 'bg-red-500' : selectedRisk.daysNegative > 30 ? 'bg-amber-500' : 'bg-yellow-400'}`}
                        style={{ width: `${Math.min(100, (selectedRisk.daysNegative / 90) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-400">
                      <span>0d</span><span>30d</span><span>60d</span><span>90d</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Account has been negative for <strong>{selectedRisk.daysNegative} days</strong>.
                    {selectedRisk.daysNegative > 60
                      ? ' Auto-suspension review triggered.'
                      : selectedRisk.daysNegative > 30
                      ? ' Escalation notice recommended.'
                      : ' Monitor and send reminder.'}
                  </p>
                </CardContent>
              </Card>

              {/* Trigger info */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Auto-Suspension Triggers</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: '30-Day alert threshold ($300)', met: selectedRisk.daysNegative >= 30 },
                    { label: '60-Day escalation notice',      met: selectedRisk.daysNegative >= 60 },
                    { label: '90-Day auto-suspend ($800)',     met: selectedRisk.daysNegative >= 90 },
                  ].map(t => (
                    <div key={t.label} className={`flex items-center gap-3 p-3 rounded-lg ${t.met ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                      {t.met
                        ? <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        : <CheckCircle className="h-4 w-4 text-gray-300 shrink-0" />}
                      <p className={`text-sm ${t.met ? 'text-red-700 font-medium' : 'text-gray-400'}`}>{t.label}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="flex-1">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Send Notice
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-amber-600 border-amber-200 hover:bg-amber-50">
                  <Pause className="h-3.5 w-3.5 mr-1.5" />Pause Account
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => { setSuspendDone(''); setSuspendDialog(selectedRisk); }}
                >
                  <Ban className="h-3.5 w-3.5 mr-1.5" />Suspend
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select an account to view risk details
            </div>
          )}
        </div>
      )}

      {/* ── 5. SUSPENDED ── */}
      {sub === 'Suspended' && (
        <SuspendedTab
          suspendedAccounts={suspendedAccounts}
          agingLoading={agingLoading}
          setSub={setSub}
          onWriteOffComplete={() => {}}
          onReinstate={(a) => setSuspendedAccounts(prev => prev.filter(x => x.id !== a.id))}
          adminId={user?.id}
        />
      )}

      {/* ── 6. WRITE-OFFS ── */}
      {sub === 'Write-offs' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Trash2}     label="Total Write-offs"   value={writeOffs.length}                         color="indigo" />
            <StatCard icon={DollarSign} label="Amount Written Off"  value={`$${totalWrittenOff.toLocaleString()}`}  color="red"    />
            <StatCard icon={FileText}   label="This Year"           value={writeOffs.filter((w: any) => new Date(w.date).getFullYear() === new Date().getFullYear()).length} color="amber" />
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center justify-between">
                Write-off Ledger
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                  const hdr = ['Date', 'Member', 'Admin', 'Amount Written Off ($)', 'Old Balance', 'Notes'];
                  const rows = writeOffs.map((w: any) => [
                    `"${w.date ? new Date(w.date).toLocaleString() : ''}"`,
                    `"${(w.target ?? '').replace(/"/g, '""')}"`,
                    `"${(w.admin ?? '').replace(/"/g, '""')}"`,
                    Math.abs(w.diff ?? 0).toFixed(2),
                    w.oldBal ?? '',
                    `"${(w.notes ?? '').replace(/"/g, '""')}"`,
                  ]);
                  const csv = [hdr, ...rows].map(r => r.join(',')).join('\n');
                  const el = document.createElement('a');
                  el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                  el.download = `writeoffs_${new Date().toISOString().slice(0, 10)}.csv`;
                  el.click();
                }} disabled={writeOffs.length === 0}><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
              </CardTitle>
            </CardHeader>
            <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
              <SHSearch value={writeOffSearch} onChange={v => setWriteOffSearch(v)} placeholder="Search member or admin…" />
              <select
                value={writeOffSort}
                onChange={e => setWriteOffSort(e.target.value as any)}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
              >
                <option value="date-desc">Date: Newest first</option>
                <option value="date-asc">Date: Oldest first</option>
                <option value="amount-desc">Amount: Highest first</option>
                <option value="amount-asc">Amount: Lowest first</option>
                <option value="target">Member: A → Z</option>
              </select>
              {writeOffSearch && <span className="text-xs text-gray-400 shrink-0">{writeOffs.filter((w:any)=>{const q=writeOffSearch.toLowerCase();return[w.target,w.admin].some(v=>v?.toLowerCase().includes(q));}).length} of {writeOffs.length}</span>}
            </div>
            <CardContent className="p-0 overflow-x-auto">
              {creditAdjLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
              ) : (() => {
                const filtWO = writeOffSearch.trim()
                  ? writeOffs.filter((w:any)=>{const q=writeOffSearch.toLowerCase();return[w.target,w.admin].some(v=>v?.toLowerCase().includes(q));})
                  : writeOffs;
                const sortedWO = [...filtWO].sort((a: any, b: any) => {
                  if (writeOffSort === 'date-desc')   return new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime();
                  if (writeOffSort === 'date-asc')    return new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime();
                  if (writeOffSort === 'amount-desc') return Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0);
                  if (writeOffSort === 'amount-asc')  return Math.abs(a.diff ?? 0) - Math.abs(b.diff ?? 0);
                  if (writeOffSort === 'target')      return (a.target ?? '').localeCompare(b.target ?? '');
                  return 0;
                });
                return (
                <table className="w-full min-w-[500px]">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <TH>Member</TH>
                      <TH>Admin</TH>
                      <TH>Date</TH>
                      <TH right>Amount Written Off</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedWO.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">{writeOffSearch ? 'No results match your search' : 'No write-offs recorded yet'}</td></tr>
                    ) : sortedWO.map((w: any) => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <TD><p className="font-medium text-gray-900">{w.target}</p></TD>
                        <TD><p className="text-xs text-gray-400">{w.admin}</p></TD>
                        <TD><span className="text-xs text-gray-400">{w.date ? new Date(w.date).toLocaleString() : '—'}</span></TD>
                        <td className="px-4 py-3 text-right"><span className="text-sm font-bold text-red-600">-${Math.abs(w.diff || 0).toLocaleString()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                );
              })()}
            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">How to record a write-off</p>
            <p className="text-sm text-amber-700">Go to <strong>Adjustments</strong> → select the member → set Reason to <strong>write_off</strong>. It will appear here automatically.</p>
          </div>
        </div>
      )}

      {/* ── 7. PLATFORM LEDGER ── */}
      {sub === 'Platform Ledger' && (() => {
        const SRC_LABELS: Record<string, string> = {
          qr_scan: 'QR Scan', checkout: 'Checkout', pos: 'POS',
          payment_request: 'Payment Req', refund: 'Refund', admin: 'Admin', trade: 'Trade',
        };
        const SRC_COLORS: Record<string, string> = {
          qr_scan: 'bg-violet-50 text-violet-700', checkout: 'bg-blue-50 text-blue-700',
          pos: 'bg-indigo-50 text-indigo-700', payment_request: 'bg-amber-50 text-amber-700',
          refund: 'bg-rose-50 text-rose-700', admin: 'bg-gray-100 text-gray-600',
          trade: 'bg-emerald-50 text-emerald-700',
        };

        const filtered = platformLedger.filter(e => {
          if (plEntryFilter !== 'all' && e.entry_type !== plEntryFilter) return false;
          if (plSourceFilter !== 'all' && e.source !== plSourceFilter) return false;
          if (plUserFilter && !e.userName?.toLowerCase().includes(plUserFilter.toLowerCase())) return false;
          if (plDateFrom && new Date(e.created_at) < new Date(plDateFrom)) return false;
          if (plDateTo) {
            const to = new Date(plDateTo); to.setHours(23, 59, 59, 999);
            if (new Date(e.created_at) > to) return false;
          }
          return true;
        });

        const totalCashIn     = platformLedger.filter(e => e.entry_type === 'credit').reduce((s, e) => s + Number(e.cash_amount   ?? 0), 0);
        const totalBarterIn   = platformLedger.filter(e => e.entry_type === 'credit').reduce((s, e) => s + Number(e.barter_amount ?? 0), 0);
        const totalCashOut    = platformLedger.filter(e => e.entry_type === 'debit' ).reduce((s, e) => s + Number(e.cash_amount   ?? 0), 0);
        const totalBarterOut  = platformLedger.filter(e => e.entry_type === 'debit' ).reduce((s, e) => s + Number(e.barter_amount ?? 0), 0);

        const activeSrcs = [...new Set(platformLedger.map(e => e.source))];

        const exportPlatformCSV = () => {
          const hdr = ['Date', 'User', 'Type', 'Source', 'Cash', 'Barter', 'Description'];
          const rows = filtered.map(e => [
            new Date(e.created_at).toLocaleDateString(),
            `"${(e.userName ?? '').replace(/"/g, '""')}"`,
            e.entry_type.toUpperCase(),
            SRC_LABELS[e.source] ?? e.source,
            e.entry_type === 'credit' ? `+$${Number(e.cash_amount).toFixed(2)}` : e.cash_amount > 0 ? `-$${Number(e.cash_amount).toFixed(2)}` : '$0.00',
            e.entry_type === 'credit' ? `+${e.barter_amount}pts` : e.barter_amount > 0 ? `-${e.barter_amount}pts` : '0pts',
            `"${(e.description ?? '').replace(/"/g, '""')}"`,
          ]);
          const csv  = [hdr, ...rows].map(r => r.join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a'); a.href = url;
          a.download = `platform_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
          a.click(); URL.revokeObjectURL(url);
        };

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-500" /> Platform Ledger
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">All cash + barter movements across every user</p>
              </div>
              <Button variant="outline" size="sm" onClick={exportPlatformCSV} disabled={filtered.length === 0}
                className="rounded-xl border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
              </Button>
            </div>

            {/* Platform totals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-white/70" />
                    <p className="text-white/70 text-xs">Total Cash In</p>
                  </div>
                  <p className="text-2xl font-black text-white">${totalCashIn.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-500 to-violet-600">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="h-4 w-4 text-white/70" />
                    <p className="text-white/70 text-xs">Total Barter In</p>
                  </div>
                  <p className="text-2xl font-black text-white">{totalBarterIn.toLocaleString()} pts</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-rose-50 shrink-0">
                    <ArrowUpRight className="h-4 w-4 text-rose-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">${totalCashOut.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">Cash Out</p>
                    <p className="text-xs text-rose-500 font-medium mt-0.5">{totalBarterOut.toLocaleString()} pts out</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-50 shrink-0">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{platformLedger.length.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Total Entries</p>
                    <p className="text-xs text-indigo-500 font-medium mt-0.5">{filtered.length} shown</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* User search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      value={plUserFilter}
                      onChange={e => setPlUserFilter(e.target.value)}
                      placeholder="Search user…"
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 w-40 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>

                  {/* Credit / Debit */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                    {(['all', 'credit', 'debit'] as const).map(f => (
                      <button key={f} onClick={() => setPlEntryFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${plEntryFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Source filter */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[{ value: 'all', label: 'All Sources' }, ...activeSrcs.map(s => ({ value: s, label: SRC_LABELS[s] ?? s }))].map(opt => (
                      <button key={opt.value} onClick={() => setPlSourceFilter(opt.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          plSourceFilter === opt.value
                            ? opt.value === 'all' ? 'bg-gray-900 text-white border-gray-900' : `${SRC_COLORS[opt.value] ?? 'bg-gray-100 text-gray-700'} border-transparent shadow-sm`
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Date range */}
                  <div className="flex items-center gap-2 ml-auto">
                    <input type="date" value={plDateFrom} onChange={e => setPlDateFrom(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="date" value={plDateTo} onChange={e => setPlDateTo(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    {(plDateFrom || plDateTo) && (
                      <button onClick={() => { setPlDateFrom(''); setPlDateTo(''); }}
                        className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                {platformLedgerLoading ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading ledger…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-500 font-medium">No entries found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {platformLedger.length === 0 ? 'No ledger entries recorded yet' : 'Try adjusting your filters'}
                    </p>
                  </div>
                ) : (() => {
                  const headers = ['Date', 'User', 'Type', 'Source', 'Cash', 'Barter', 'Balance', 'Description'];
                  return (
                  <div className="flex gap-4">
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {headers.map(h => (
                              <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4 last:pr-0">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filtered.map(entry => {
                            const isCredit  = entry.entry_type === 'credit';
                            const balance   = Number(entry.currentBalance ?? 0);
                            const isSelected = selectedLedgerEntry?.id === entry.id;
                            return (
                              <tr
                                key={entry.id}
                                onClick={() => setSelectedLedgerEntry(isSelected ? null : entry)}
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50/70'}`}
                              >
                                <td className="py-3 pr-4 text-xs text-gray-400 whitespace-nowrap">
                                  {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="py-3 pr-4">
                                  <p className="text-xs font-semibold text-gray-800 truncate max-w-[120px]">{entry.userName}</p>
                                </td>
                                <td className="py-3 pr-4">
                                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${isCredit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                                    {isCredit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                    {isCredit ? 'Credit' : 'Debit'}
                                  </div>
                                </td>
                                <td className="py-3 pr-4">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SRC_COLORS[entry.source] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {SRC_LABELS[entry.source] ?? entry.source}
                                  </span>
                                </td>
                                <td className={`py-3 pr-4 text-xs font-semibold ${entry.cash_amount > 0 ? (isCredit ? 'text-emerald-600' : 'text-rose-500') : 'text-gray-300'}`}>
                                  {entry.cash_amount > 0 ? `${isCredit ? '+' : '-'}$${Number(entry.cash_amount).toFixed(2)}` : '—'}
                                </td>
                                <td className={`py-3 pr-4 text-xs font-semibold ${entry.barter_amount > 0 ? (isCredit ? 'text-teal-600' : 'text-rose-400') : 'text-gray-300'}`}>
                                  {entry.barter_amount > 0 ? `${isCredit ? '+' : '-'}${Number(entry.barter_amount).toLocaleString()} pts` : '—'}
                                </td>
                                <td className={`py-3 pr-4 text-xs font-bold ${balance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                  {balance < 0 ? '-' : ''}{Math.abs(balance).toLocaleString()} pts
                                </td>
                                <td className="py-3 text-xs text-gray-500 max-w-[180px] truncate">
                                  {entry.description ?? '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* ── Drill-down panel ── */}
                    {selectedLedgerEntry && (() => {
                      const e = selectedLedgerEntry;
                      const isCredit = e.entry_type === 'credit';
                      return (
                        <div className="w-72 shrink-0 border rounded-xl bg-white shadow-sm overflow-hidden self-start sticky top-0">
                          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                            <p className="text-xs font-bold text-gray-700">Entry Detail</p>
                            <button onClick={() => setSelectedLedgerEntry(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                          </div>
                          <div className="p-4 space-y-3 text-xs">
                            {/* Amount */}
                            <div className={`rounded-xl p-3 text-center ${isCredit ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                              <p className={`text-2xl font-black ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isCredit ? '+' : '-'}{Number(e.barter_amount).toLocaleString()} pts
                              </p>
                              {Number(e.cash_amount) > 0 && (
                                <p className={`text-sm font-semibold mt-0.5 ${isCredit ? 'text-emerald-500' : 'text-rose-400'}`}>
                                  {isCredit ? '+' : '-'}${Number(e.cash_amount).toFixed(2)} cash
                                </p>
                              )}
                              <p className={`text-[10px] mt-1 font-semibold ${isCredit ? 'text-emerald-400' : 'text-rose-300'}`}>
                                {isCredit ? 'CREDIT' : 'DEBIT'}
                              </p>
                            </div>

                            {/* Fields */}
                            {[
                              { label: 'Member',    value: e.userName ?? '—' },
                              { label: 'Date',      value: new Date(e.created_at).toLocaleString() },
                              { label: 'Source',    value: SRC_LABELS[e.source] ?? e.source },
                              { label: 'Entry ID',  value: e.id?.slice(0, 16) + '…' },
                              { label: 'Reference', value: e.reference_id ? e.reference_id.slice(0, 16) + '…' : '—' },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex justify-between gap-2">
                                <span className="text-gray-400 shrink-0">{label}</span>
                                <span className="font-medium text-gray-800 text-right break-all">{value}</span>
                              </div>
                            ))}

                            {/* Before → After balance */}
                            <div className="rounded-lg bg-gray-50 border p-3 space-y-1.5">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Balance Change</p>
                              {e.balance_before != null && e.balance_after != null ? (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-center">
                                    <p className="text-[10px] text-gray-400">Before</p>
                                    <p className={`text-sm font-bold ${Number(e.balance_before) < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                                      {Number(e.balance_before) < 0 ? '-' : ''}{Math.abs(Number(e.balance_before)).toLocaleString()} pts
                                    </p>
                                  </div>
                                  <span className="text-gray-400 text-base">→</span>
                                  <div className="text-center">
                                    <p className="text-[10px] text-gray-400">After</p>
                                    <p className={`text-sm font-bold ${Number(e.balance_after) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {Number(e.balance_after) < 0 ? '-' : ''}{Math.abs(Number(e.balance_after)).toLocaleString()} pts
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-center">
                                    <p className="text-[10px] text-gray-400">Current</p>
                                    <p className={`text-sm font-bold ${Number(e.currentBalance ?? 0) < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                                      {Number(e.currentBalance ?? 0) < 0 ? '-' : ''}{Math.abs(Number(e.currentBalance ?? 0)).toLocaleString()} pts
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-gray-300 italic">before/after not recorded for older entries</span>
                                </div>
                              )}
                            </div>

                            {/* Description */}
                            {e.description && (
                              <div className="pt-2 border-t">
                                <p className="text-gray-400 mb-1">Description</p>
                                <p className="text-gray-700 leading-relaxed">{e.description}</p>
                              </div>
                            )}

                            {/* Admin note if source=admin */}
                            {e.source === 'admin' && (
                              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                                <p className="text-amber-700 font-semibold mb-0.5">Admin Action</p>
                                <p className="text-amber-600">This entry was created by an admin adjustment or write-off. See Audit Trail for full details.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  );
                })()}
              </CardContent>
            </Card>

          </div>
        );
      })()}
    </div>
  );
};

export default CreditsSection;
