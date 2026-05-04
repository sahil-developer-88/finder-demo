import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Store, TrendingUp, Clock, DollarSign, CreditCard, Receipt,
  FileText, AlertTriangle, CheckCircle, AlertCircle, RefreshCw, Zap, Ban, Scale,
} from 'lucide-react';
import { StatCard, SectionTitle } from './shared/ui';

export interface OverviewExceptions {
  disputes:          number;
  reconMismatches:   number;
  negativeBalances:  number;
  tokensExpiring:    number;
  pendingApprovals:  number;
  syncFailures:      number;
  suspendedAccounts: number;
}

const OverviewSection = ({
  stats, loading, monthlyData, exceptions, onNavigate,
}: {
  stats: any;
  loading: boolean;
  monthlyData: { month: string; credits: number; trades: number }[];
  exceptions: OverviewExceptions;
  onNavigate: (section: string, sub: string) => void;
}) => {
  const exceptionItems = [
    { count: exceptions.disputes,          label: 'Open Disputes',              detail: 'Require review or resolution',       color: 'red',    section: 'disputes',  sub: 'Open Disputes',       icon: Scale         },
    { count: exceptions.pendingApprovals,  label: 'Pending Approvals',          detail: 'Listings awaiting moderation',       color: 'amber',  section: 'listings',  sub: 'Moderation Queue',    icon: Clock         },
    { count: exceptions.negativeBalances,  label: 'Negative Balances',          detail: 'Members over credit limit',          color: 'red',    section: 'credits',   sub: 'Aging & Risk',        icon: AlertTriangle },
    { count: exceptions.suspendedAccounts, label: 'Suspended Accounts',         detail: 'Blocked from trading',               color: 'orange', section: 'credits',   sub: 'Suspended',           icon: Ban           },
    { count: exceptions.reconMismatches,   label: 'Reconciliation Mismatches',  detail: 'Ledger vs balances out of sync',     color: 'red',    section: 'syshealth', sub: 'Financial Alerts',    icon: AlertCircle   },
    { count: exceptions.tokensExpiring,    label: 'Tokens Expiring Soon',       detail: 'POS OAuth tokens within 7 days',     color: 'amber',  section: 'syshealth', sub: 'POS & OAuth',         icon: RefreshCw     },
    { count: exceptions.syncFailures,      label: 'Sync Failures',              detail: 'Failed syncs in last 7 days',        color: 'orange', section: 'syshealth', sub: 'Sync & QR',           icon: Zap           },
  ].filter(e => e.count > 0);

  const colorMap: Record<string, { bg: string; border: string; badge: string; btn: string; icon: string }> = {
    red:    { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',       btn: 'text-red-600 hover:bg-red-100',       icon: 'text-red-500'    },
    amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',   btn: 'text-amber-600 hover:bg-amber-100',   icon: 'text-amber-500'  },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', btn: 'text-orange-600 hover:bg-orange-100', icon: 'text-orange-500' },
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Platform Overview" sub="Real-time stats from your barter network" />

      {!loading && (
        exceptionItems.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">All systems good</p>
              <p className="text-xs text-emerald-600 mt-0.5">No disputes, mismatches, expiring tokens, or pending actions right now.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-sm font-bold text-gray-800">Needs Attention <span className="ml-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">{exceptionItems.length}</span></p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {exceptionItems.map(item => {
                const c = colorMap[item.color];
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 shrink-0 ${c.icon}`} />
                        <p className="text-sm font-semibold text-gray-800 leading-tight">{item.label}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center justify-center h-6 min-w-[1.5rem] px-1.5 rounded-full text-xs font-bold ${c.badge}`}>
                        {item.count}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                    <button
                      onClick={() => onNavigate(item.section, item.sub)}
                      className={`self-start text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${c.btn}`}
                    >
                      View →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Total Users"       value={loading ? '—' : stats.totalUsers ?? 0}       color="blue"    trend={12} onClick={() => onNavigate('users', '')} />
        <StatCard icon={Store}      label="Active Listings"   value={loading ? '—' : stats.activeListings ?? 0}   color="emerald" trend={8}  onClick={() => onNavigate('listings', 'Listings Overview')} />
        <StatCard icon={TrendingUp} label="Completed Trades"  value={loading ? '—' : stats.completedTrades ?? 0}  color="purple"  trend={15} onClick={() => onNavigate('activity', 'Transaction Feed')} />
        <StatCard icon={Clock}      label="Pending Approvals" value={loading ? '—' : stats.pendingApprovals ?? 0} color="amber"              onClick={() => onNavigate('listings', 'Moderation Queue')} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Credits Issued"    value={loading ? '—' : `$${(stats.totalCreditsIssued ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}  color="indigo"  trend={6} onClick={() => onNavigate('credits', 'Summary')} />
        <StatCard icon={CreditCard} label="Available Credits" value={loading ? '—' : `$${(stats.totalAvailableCredits ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="emerald"          onClick={() => onNavigate('credits', 'Member Balances')} />
        <StatCard icon={Receipt}    label="1099s Required"    value={loading ? '—' : stats.required1099s ?? 0}    color="rose"             onClick={() => onNavigate('tax', '1099-B Prep')} />
        <StatCard icon={FileText}   label="W-9 Completion"    value={loading ? '—' : `${stats.w9Rate ?? 0}%`}     color="blue"             onClick={() => onNavigate('tax', 'W-9 Tracking')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Credit Growth</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => [`$${v.toLocaleString()}`, 'Credits']} />
                  <Area type="monotone" dataKey="credits" stroke="#10b981" fill="url(#cg)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Trade Volume by Month</CardTitle></CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="trades" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OverviewSection;
