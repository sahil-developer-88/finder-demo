import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';

// ─── StatCard ─────────────────────────────────────────────────────────────────
export const StatCard = ({
  icon: Icon, label, value, sub, color = 'emerald', trend,
}: {
  icon: any; label: string; value: string | number; sub?: string; color?: string; trend?: number;
}) => {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-50',
    blue:    'text-blue-500 bg-blue-50',
    amber:   'text-amber-500 bg-amber-50',
    red:     'text-red-500 bg-red-50',
    purple:  'text-purple-500 bg-purple-50',
    indigo:  'text-indigo-500 bg-indigo-50',
    rose:    'text-rose-500 bg-rose-50',
    orange:  'text-orange-500 bg-orange-50',
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

// ─── SubNav ───────────────────────────────────────────────────────────────────
export const SubNav = ({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) => (
  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6 flex-wrap">
    {tabs.map(tab => (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
          active === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {tab}
      </button>
    ))}
  </div>
);

// ─── Pill ─────────────────────────────────────────────────────────────────────
export const Pill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active:    'bg-emerald-100 text-emerald-700',
    pending:   'bg-amber-100 text-amber-700',
    rejected:  'bg-red-100 text-red-700',
    flagged:   'bg-orange-100 text-orange-700',
    expired:   'bg-gray-100 text-gray-500',
    good:      'bg-emerald-100 text-emerald-700',
    negative:  'bg-red-100 text-red-700',
    'at-risk': 'bg-orange-100 text-orange-700',
    dormant:   'bg-gray-100 text-gray-500',
    completed: 'bg-emerald-100 text-emerald-700',
    open:      'bg-red-100 text-red-700',
    resolved:  'bg-gray-100 text-gray-600',
    filed:     'bg-emerald-100 text-emerald-700',
    generated: 'bg-blue-100 text-blue-700',
    draft:     'bg-amber-100 text-amber-700',
    sent:      'bg-purple-100 text-purple-700',
    'n/a':     'bg-gray-100 text-gray-400',
    verified:  'bg-emerald-100 text-emerald-700',
    unverified:'bg-red-100 text-red-700',
    low:       'bg-amber-100 text-amber-700',
    medium:    'bg-orange-100 text-orange-700',
    high:      'bg-red-100 text-red-700',
    critical:  'bg-red-200 text-red-900 font-semibold',
    credit:    'bg-emerald-100 text-emerald-700',
    debit:     'bg-red-100 text-red-700',
    error:     'bg-red-100 text-red-700',
    warning:   'bg-amber-100 text-amber-700',
    info:      'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
    </span>
  );
};

// ─── SectionTitle ─────────────────────────────────────────────────────────────
export const SectionTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

// ─── Table helpers ────────────────────────────────────────────────────────────
export const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);

export const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-4 py-3 text-sm text-gray-700 ${right ? 'text-right' : ''}`}>{children}</td>
);

// ─── Pager ────────────────────────────────────────────────────────────────────
export const AP = 10;

export const AdminPager = ({ total, page, setPage }: { total: number; page: number; setPage: (p: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / AP));
  const from  = total === 0 ? 0 : (page - 1) * AP + 1;
  const to    = Math.min(page * AP, total);
  const visible = Array.from({ length: pages }, (_, i) => i + 1).filter(p =>
    p === 1 || p === pages || Math.abs(p - page) <= 1
  );
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
      <p className="text-xs text-gray-500">{total === 0 ? 'No results' : `${from}–${to} of ${total}`}</p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(page - 1)}>
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
        </Button>
        {visible.map((p, i, arr) => (
          <React.Fragment key={p}>
            {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-gray-400 px-1">…</span>}
            <Button variant={p === page ? 'default' : 'outline'} size="sm"
              className={`h-7 w-7 p-0 text-xs ${p === page ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white' : ''}`}
              onClick={() => setPage(p)}>{p}</Button>
          </React.Fragment>
        ))}
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === pages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

// ─── Search inputs ────────────────────────────────────────────────────────────
export const SMSearch = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative px-4 py-3 border-b bg-gray-50/50">
    <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
    <input className="w-full pl-8 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

export const SHSearch = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative w-64">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white" />
  </div>
);

// ─── UtilBar ──────────────────────────────────────────────────────────────────
export const UtilBar = ({ pct }: { pct: number }) => {
  const color = pct >= 0.8 ? 'bg-red-500' : pct >= 0.5 ? 'bg-orange-400' : pct >= 0.25 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct * 100, 100).toFixed(0)}%` }} />
      </div>
    </div>
  );
};
