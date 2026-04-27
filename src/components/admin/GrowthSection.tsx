import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Clock, FileText, AlertCircle, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight,
  Loader2, ChevronRight, XCircle, Search,
} from 'lucide-react';
import { SectionTitle, StatCard, TH, TD, AdminPager, SHSearch, AP } from './shared/ui';
import MerchantDetailPanel from './MerchantDetailPanel';
import { supabase } from '@/integrations/supabase/client';

// ─── Funnel Drill-Down Modal ──────────────────────────────────────────────────
const FunnelDrillModal = ({ stage, users, onClose }: { stage: string; users: any[]; onClose: () => void }) => {
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const PER = 10;

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.business_name?.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((page - 1) * PER, page * PER);

  // Build a listing-shaped object for MerchantDetailPanel
  const listingForPanel = selectedUser ? {
    id:                selectedUser.user_id,
    user_id:           selectedUser.user_id,
    business_name:     selectedUser.business_name || selectedUser.full_name || '—',
    owner:             selectedUser.full_name,
    category:          selectedUser.business_name ? '' : '',
    status:            selectedUser.onboarding_completed ? 'active' : 'pending',
    barter_percentage: 0,
  } : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {selectedUser ? (
          <>
            {/* Detail header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b">
              <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">{selectedUser.full_name || selectedUser.business_name || '—'}</h3>
                <p className="text-xs text-gray-400">{selectedUser.email || '—'}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            {/* Detail body */}
            <div className="overflow-y-auto flex-1 p-5">
              <MerchantDetailPanel
                listing={listingForPanel}
                onAction={() => {}}
                onEdit={() => {}}
                readOnly
              />
            </div>
          </>
        ) : (
          <>
            {/* List header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-base font-bold text-gray-900">{stage}</h3>
                <p className="text-xs text-gray-400">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b bg-gray-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                  placeholder="Search name, email, or business…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="border-b bg-gray-50 sticky top-0">
                  <tr><TH>User</TH><TH>Business</TH><TH>Joined</TH><TH>Status</TH><TH right>Action</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No users found</td></tr>
                  ) : paginated.map((u: any) => {
                    const initials = (u.full_name || u.email || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <tr key={u.user_id} className="hover:bg-gray-50">
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold shrink-0">{initials}</div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{u.full_name || '—'}</p>
                              <p className="text-xs text-gray-400">{u.email || '—'}</p>
                            </div>
                          </div>
                        </TD>
                        <TD><span className="text-sm text-gray-700">{u.business_name || '—'}</span></TD>
                        <TD><span className="text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</span></TD>
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            {u.onboarding_completed && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Onboarded</span>}
                            {u.w9  && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">W-9</span>}
                            {u.pos && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">POS</span>}
                          </div>
                        </TD>
                        <TD right>
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:underline"
                          >
                            View
                          </button>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pager */}
            <AdminPager total={filtered.length} page={page} setPage={setPage} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

// ─── Growth & Funnel Section ──────────────────────────────────────────────────
const GrowthSection = ({ sub, data, loading }: { sub: string; data: any; loading: boolean }) => {
  const [drillStage, setDrillStage]           = useState<string | null>(null);
  const [chSort, setChSort]                   = useState<'outstanding-desc' | 'outstanding-asc' | 'earned-desc' | 'spent-desc' | 'utilization-desc' | 'status' | 'name'>('outstanding-desc');
  const [chSearch, setChSearch]               = useState('');
  const [chPage, setChPage]                   = useState(1);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );
  if (!data) return null;

  const { funnel, monthlyActive, credits } = data;

  const funnelStages = [
    { label: 'Signed Up',    value: funnel.totalSignups,  color: 'bg-blue-500',    pct: 100,               users: funnel.signedUpUsers  || [] },
    { label: 'Onboarded',    value: funnel.onboarded,     color: 'bg-emerald-500', pct: funnel.toOnboarded, users: funnel.onboardedUsers || [] },
    { label: 'W-9 Complete', value: funnel.w9Complete,    color: 'bg-violet-500',  pct: funnel.toW9,        users: funnel.w9Users        || [] },
    { label: 'POS Active',   value: funnel.posConnected,  color: 'bg-amber-500',   pct: funnel.toPOS,       users: funnel.posActiveUsers  || [] },
  ];

  const drillUsers = funnelStages.find(s => s.label === drillStage)?.users || [];

  return (
    <div className="space-y-6">
      <SectionTitle
        title={sub}
        sub={{
          'Funnel':         'Member journey from signup to active POS user',
          'Monthly Active': 'Active merchants and new signups per month',
          'Credits Health': 'Are you growing members faster than credit liabilities?',
        }[sub] ?? ''}
      />

      {/* ── Funnel ── */}
      {sub === 'Funnel' && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Clock}        label="Pending Onboarding" value={funnel.pendingOnboarding} color="amber"   />
            <StatCard icon={FileText}     label="W-9 Incomplete"     value={funnel.w9Incomplete}      color="red"     />
            <StatCard icon={AlertCircle}  label="No POS Connected"   value={funnel.posNotConnected}   color="rose"    />
            <StatCard icon={TrendingUp}   label="Churn Rate (90d)"   value={`${funnel.churnRate}%`}   color="indigo"  sub={`${funnel.churned} businesses inactive`} />
          </div>

          {/* Funnel bars */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Conversion Funnel
                <span className="text-xs font-normal text-gray-400">Click any row to see users</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnelStages.map((s, i) => (
                <div key={s.label}>
                  <button
                    className="w-full text-left group rounded-xl p-2 -mx-2 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setDrillStage(s.label)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-5">{i + 1}.</span>
                        <span className="text-sm font-medium text-gray-800 group-hover:text-emerald-700 transition-colors">{s.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-gray-900">{s.value.toLocaleString()}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white ${s.color}`}>{s.pct}%</span>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-3 rounded-full transition-all ${s.color}`} style={{ width: `${s.pct}%` }} />
                    </div>
                  </button>
                  {i < funnelStages.length - 1 && (
                    <p className="text-xs text-gray-400 mt-1 ml-7">
                      {funnelStages[i + 1].pct}% of {s.label.toLowerCase()} complete next step
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Drill-down modal */}
          {drillStage && (
            <FunnelDrillModal
              stage={drillStage}
              users={drillUsers}
              onClose={() => setDrillStage(null)}
            />
          )}

          {/* Conversion rate summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Signup → Onboarded',    value: `${funnel.toOnboarded}%`, color: 'emerald' },
              { label: 'Onboarded → W-9 Filed', value: `${funnel.toW9}%`,        color: 'violet'  },
              { label: 'Onboarded → POS Live',  value: `${funnel.toPOS}%`,       color: 'amber'   },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-3xl font-bold text-${c.color}-600`}>{c.value}</p>
                <p className="text-xs text-gray-400 mt-1">conversion rate</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly Active ── */}
      {sub === 'Monthly Active' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Active Merchants vs New Signups (Last 12 Months)</CardTitle></CardHeader>
            <CardContent>
              {monthlyActive.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">No transaction data available.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyActive}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="active"  name="Active Merchants" fill="#10b981" radius={[4,4,0,0]} />
                      <Bar dataKey="signups" name="New Signups"       fill="#6366f1" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-y bg-gray-50">
                  <tr><TH>Month</TH><TH right>Active Merchants</TH><TH right>New Signups</TH><TH right>Growth</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {monthlyActive.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">No data</td></tr>
                  ) : [...monthlyActive].reverse().map((m: any, i: number) => {
                    const prev = [...monthlyActive].reverse()[i + 1];
                    const growth = prev && prev.active > 0 ? Math.round(((m.active - prev.active) / prev.active) * 100) : null;
                    return (
                      <tr key={m.month} className="hover:bg-gray-50">
                        <TD><span className="font-medium">{m.month}</span></TD>
                        <TD right>{m.active}</TD>
                        <TD right>{m.signups}</TD>
                        <TD right>
                          {growth === null ? <span className="text-gray-300">—</span> : (
                            <span className={`font-semibold ${growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {growth >= 0 ? '+' : ''}{growth}%
                            </span>
                          )}
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

      {/* ── Credits Health ── */}
      {sub === 'Credits Health' && (() => {
        const ls = credits.liabilityStatus;
        const vs = credits.velocityStatus;
        const statusColor = (s: string) => s === 'healthy' ? 'emerald' : s === 'warning' ? 'amber' : 'red';
        const statusBg    = (s: string) => s === 'healthy' ? 'bg-emerald-50 border-emerald-200' : s === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
        const statusText  = (s: string) => s === 'healthy' ? 'text-emerald-900' : s === 'warning' ? 'text-amber-900' : 'text-red-900';
        const statusSub   = (s: string) => s === 'healthy' ? 'text-emerald-700' : s === 'warning' ? 'text-amber-700' : 'text-red-700';
        const statusIcon  = (s: string) => s === 'healthy' ? 'bg-emerald-100' : s === 'warning' ? 'bg-amber-100' : 'bg-red-100';
        const statusBar   = (s: string) => s === 'healthy' ? 'bg-emerald-500' : s === 'warning' ? 'bg-amber-400' : 'bg-red-400';
        return (
          <div className="space-y-6">

            {/* IRTA source note */}
            <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Health metrics based on <strong>IRTA (International Reciprocal Trade Association)</strong> barter exchange standards — Quantity Theory of Money framework (MV = PQ).</span>
            </div>

            {/* IRTA Metric 1 — Outstanding Credits Ratio */}
            <Card className={`border shadow-sm ${statusBg(ls)}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${statusIcon(ls)}`}>
                    <DollarSign className={`h-5 w-5 text-${statusColor(ls)}-600`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`font-bold text-sm ${statusText(ls)}`}>
                        {ls === 'healthy' ? 'Liability: Healthy' : ls === 'warning' ? 'Liability: Approaching Limit' : 'Liability: Danger — Over-issued'}
                      </p>
                      <span className={`text-2xl font-bold text-${statusColor(ls)}-700`}>{credits.outstandingRatio}x</span>
                    </div>
                    <p className={`text-xs mt-1 ${statusSub(ls)}`}>
                      Outstanding credits are <strong>{credits.outstandingRatio}×</strong> your monthly avg trade volume (${credits.monthlyAvgVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo).
                      IRTA limit: <strong>≤ 3×</strong>
                    </p>
                    {/* Ratio bar — max shown at 4x */}
                    <div className="mt-3 h-3 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-3 rounded-full transition-all ${statusBar(ls)}`} style={{ width: `${Math.min(100, (credits.outstandingRatio / 4) * 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1 text-gray-400">
                      <span>0×</span><span className="text-emerald-600">2.5× safe</span><span className="text-amber-500">3× limit</span><span>4×+</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* IRTA Metric 2 — Credit Velocity */}
            <Card className={`border shadow-sm ${statusBg(vs)}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${statusIcon(vs)}`}>
                    <TrendingUp className={`h-5 w-5 text-${statusColor(vs)}-600`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`font-bold text-sm ${statusText(vs)}`}>
                        {vs === 'healthy' ? 'Velocity: Healthy' : vs === 'warning' ? 'Velocity: Slow — credits not circulating well' : 'Velocity: Critical — credits are stagnant'}
                      </p>
                      <span className={`text-2xl font-bold text-${statusColor(vs)}-700`}>{credits.velocity}×</span>
                    </div>
                    <p className={`text-xs mt-1 ${statusSub(vs)}`}>
                      Each credit turns over <strong>{credits.velocity}×</strong> per year. Annual trade volume: ${credits.annualTradeVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}.
                      IRTA target: <strong>≥ 3× per year</strong>
                    </p>
                    {/* Velocity bar — max shown at 6x */}
                    <div className="mt-3 h-3 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-3 rounded-full transition-all ${statusBar(vs)}`} style={{ width: `${Math.min(100, (credits.velocity / 6) * 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1 text-gray-400">
                      <span>0×</span><span className="text-amber-500">1× min</span><span className="text-emerald-600">3× target</span><span>6×+</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Secondary stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon={ArrowUpRight}   label="Total Credits Earned"    value={`$${credits.totalEarned.toLocaleString()}`}    color="emerald" />
              <StatCard icon={ArrowDownRight} label="Total Credits Spent"     value={`$${credits.totalSpent.toLocaleString()}`}     color="blue"    />
              <StatCard icon={DollarSign}     label="Outstanding (Liability)" value={`$${credits.totalAvailable.toLocaleString()}`} color="amber"   sub="platform owes members" />
            </div>

            {/* Earned vs Spent vs Outstanding chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Earned vs Spent vs Outstanding</CardTitle></CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Credits', earned: credits.totalEarned, spent: credits.totalSpent, outstanding: credits.totalAvailable }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']} />
                      <Bar dataKey="earned"      name="Total Earned"           fill="#10b981" radius={[4,4,0,0]} />
                      <Bar dataKey="spent"       name="Total Spent"            fill="#6366f1" radius={[4,4,0,0]} />
                      <Bar dataKey="outstanding" name="Outstanding (Liability)" fill="#f59e0b" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Utilization rate (secondary) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Lifetime Utilization Rate</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-4 rounded-full ${credits.utilizationRate >= 70 ? 'bg-emerald-500' : credits.utilizationRate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, credits.utilizationRate)}%` }}
                    />
                  </div>
                  <span className="text-xl font-bold text-gray-900 w-14 text-right">{credits.utilizationRate}%</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">% of all-time earned credits that have been spent. Loyalty industry benchmark: 50–80% is healthy.</p>
              </CardContent>
            </Card>

            {/* Per-user breakdown */}
            {(() => {
              const members: any[] = credits.memberCreditHealth || [];
              const cols = [
                { key: 'name',        label: 'Member'        },
                { key: 'earned',      label: 'Earned'        },
                { key: 'spent',       label: 'Spent'         },
                { key: 'outstanding', label: 'Outstanding'   },
                { key: 'utilization', label: 'Utilization %' },
                { key: 'status',      label: 'Status'        },
              ];
              const filtered = members.filter(m =>
                !chSearch ||
                m.name?.toLowerCase().includes(chSearch.toLowerCase()) ||
                m.email?.toLowerCase().includes(chSearch.toLowerCase())
              );
              const sorted = [...filtered].sort((a, b) => {
                if (chSort === 'outstanding-desc') return (b.outstanding ?? 0) - (a.outstanding ?? 0);
                if (chSort === 'outstanding-asc')  return (a.outstanding ?? 0) - (b.outstanding ?? 0);
                if (chSort === 'earned-desc')       return (b.earned ?? 0) - (a.earned ?? 0);
                if (chSort === 'spent-desc')        return (b.spent ?? 0) - (a.spent ?? 0);
                if (chSort === 'utilization-desc')  return (b.utilization ?? 0) - (a.utilization ?? 0);
                if (chSort === 'status')            return (a.status ?? '').localeCompare(b.status ?? '');
                if (chSort === 'name')              return (a.name ?? '').localeCompare(b.name ?? '');
                return 0;
              });
              const paginated = sorted.slice((chPage - 1) * AP, chPage * AP);
              const statusPill: Record<string, string> = {
                good:     'bg-emerald-100 text-emerald-700',
                negative: 'bg-red-100 text-red-700',
                dormant:  'bg-gray-100 text-gray-500',
                spent:    'bg-blue-100 text-blue-700',
              };
              return (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                      Member Credit Breakdown
                      <div className="flex items-center gap-2 flex-wrap">
                        <SHSearch value={chSearch} onChange={v => { setChSearch(v); setChPage(1); }} placeholder="Search member…" />
                        <select
                          value={chSort}
                          onChange={e => { setChSort(e.target.value as any); setChPage(1); }}
                          className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
                        >
                          <option value="outstanding-desc">Outstanding: Highest first</option>
                          <option value="outstanding-asc">Outstanding: Lowest first</option>
                          <option value="earned-desc">Earned: Highest first</option>
                          <option value="spent-desc">Spent: Highest first</option>
                          <option value="utilization-desc">Utilization %: Highest first</option>
                          <option value="status">Status: A → Z</option>
                          <option value="name">Name: A → Z</option>
                        </select>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="border-y bg-gray-50">
                        <tr>
                          {cols.map(c => (
                            <th key={c.key} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left whitespace-nowrap">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {paginated.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No members found</td></tr>
                        ) : paginated.map((m: any) => (
                          <tr key={m.user_id} className="hover:bg-gray-50">
                            <TD>
                              <p className="text-sm font-medium text-gray-900">{m.name}</p>
                              <p className="text-xs text-gray-400">{m.email}</p>
                            </TD>
                            <TD right><span className="text-sm text-gray-700">${m.earned.toLocaleString()}</span></TD>
                            <TD right><span className="text-sm text-gray-700">${m.spent.toLocaleString()}</span></TD>
                            <TD right>
                              <span className={`text-sm font-semibold ${m.outstanding < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                ${m.outstanding.toLocaleString()}
                              </span>
                            </TD>
                            <TD right>
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-2 rounded-full ${m.utilization >= 70 ? 'bg-emerald-500' : m.utilization >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                    style={{ width: `${Math.min(100, m.utilization)}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-700 w-9 text-right">{m.utilization}%</span>
                              </div>
                            </TD>
                            <TD>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusPill[m.status] || 'bg-gray-100 text-gray-600'}`}>
                                {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                              </span>
                            </TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <AdminPager total={filtered.length} page={chPage} setPage={setChPage} />
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
};

export default GrowthSection;
