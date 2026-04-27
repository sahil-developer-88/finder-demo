import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DollarSign, AlertCircle, BarChart2, CheckCircle, Loader2, Edit2, AlertTriangle, Shield,
} from 'lucide-react';
import { SectionTitle, StatCard, TH, TD, AdminPager, SHSearch, AP } from './shared/ui';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 10;

const CreditRiskSection = ({ sub, data, loading, onSave }: {
  sub: string;
  data: any[];
  loading: boolean;
  onSave: (row: any) => Promise<void>;
}) => {
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving,   setSaving]   = useState(false);
  const [crPage,   setCrPage]   = useState(1);
  const [crSearch, setCrSearch] = useState('');
  const [crSort,   setCrSort]   = useState<'risk' | 'balance-asc' | 'balance-desc' | 'utilization-desc' | 'deposit-desc' | 'name'>('risk');
  const [scPages,  setScPages]  = useState<Record<string, number>>({ critical: 1, high: 1, medium: 1, low: 1 });
  const [scSort,   setScSort]   = useState<'balance-asc' | 'balance-desc' | 'utilization-desc' | 'name'>('utilization-desc');
  const [dgDepositPage,     setDgDepositPage]     = useState(1);
  const [dgDepositSort,     setDgDepositSort]     = useState<'deposit-desc' | 'deposit-asc' | 'balance-asc' | 'name'>('deposit-desc');
  const [dgGuaranteeSearch, setDgGuaranteeSearch] = useState('');
  const [dgGuaranteeSort,   setDgGuaranteeSort]   = useState<'balance-asc' | 'balance-desc' | 'name'>('balance-asc');
  const [dgDepositSearch,   setDgDepositSearch]   = useState('');
  const [dgGuaranteePage,   setDgGuaranteePage]   = useState(1);

  const computedRisk = (row: any): string => {
    if (row.balance >= 0) return 'low';
    const util = row.credit_line > 0 ? Math.abs(row.balance) / row.credit_line : 1;
    if (util >= 0.8) return 'critical';
    if (util >= 0.5) return 'high';
    return 'medium';
  };

  const rows = data.map(r => ({
    ...r,
    computed_risk: computedRisk(r),
    utilization:   r.credit_line > 0 && r.balance < 0 ? Math.abs(r.balance) / r.credit_line : 0,
    over_limit:    r.balance < -(r.credit_line ?? 500),
  }));

  const totalExposure   = rows.reduce((s, r) => s + Math.abs(Math.min(0, r.balance)), 0);
  const overLimit       = rows.filter(r => r.over_limit).length;
  const avgUtil         = rows.length > 0 ? rows.reduce((s, r) => s + r.utilization, 0) / rows.length : 0;
  const depositsHeld    = rows.reduce((s, r) => s + (r.security_deposit_amount || 0), 0);
  const guaranteesCount = rows.filter(r => r.personal_guarantee_on_file).length;
  const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const riskRows = [...rows].sort((a, b) => (riskOrder[a.risk_score || a.computed_risk] ?? 3) - (riskOrder[b.risk_score || b.computed_risk] ?? 3));

  const filteredCrRows = (crSearch.trim() ? rows.filter(r => r.businessName?.toLowerCase().includes(crSearch.toLowerCase())) : rows)
    .slice().sort((a, b) => {
      if (crSort === 'risk')               return (riskOrder[a.risk_score || a.computed_risk] ?? 3) - (riskOrder[b.risk_score || b.computed_risk] ?? 3);
      if (crSort === 'balance-asc')        return (a.balance ?? 0) - (b.balance ?? 0);
      if (crSort === 'balance-desc')       return (b.balance ?? 0) - (a.balance ?? 0);
      if (crSort === 'utilization-desc')   return (b.utilization ?? 0) - (a.utilization ?? 0);
      if (crSort === 'deposit-desc')       return (b.security_deposit_amount ?? 0) - (a.security_deposit_amount ?? 0);
      if (crSort === 'name')               return (a.businessName ?? '').localeCompare(b.businessName ?? '');
      return 0;
    });
  const totalPages = Math.max(1, Math.ceil(filteredCrRows.length / PAGE_SIZE));
  const pagedRows  = filteredCrRows.slice((crPage - 1) * PAGE_SIZE, crPage * PAGE_SIZE);

  const startEdit = (r: any) => {
    setEditId(r.user_id);
    setEditForm({
      credit_line:                r.credit_line ?? 500,
      risk_score:                 r.risk_score ?? '',
      security_deposit_amount:    r.security_deposit_amount ?? 0,
      personal_guarantee_on_file: r.personal_guarantee_on_file ?? false,
      auto_suspend_threshold:     r.auto_suspend_threshold ?? 500,
      notes:                      r.notes ?? '',
    });
  };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };
  const saveEdit   = async (r: any) => {
    setSaving(true);
    await onSave({ user_id: r.user_id, ...editForm });
    setSaving(false);
    setEditId(null);
  };

  const RiskBadge = ({ level }: { level: string }) => {
    const map: Record<string, string> = {
      low:      'bg-emerald-100 text-emerald-700',
      medium:   'bg-amber-100 text-amber-700',
      high:     'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[level] || map.low}`}>{level.charAt(0).toUpperCase() + level.slice(1)}</span>;
  };

  const UtilBar = ({ pct }: { pct: number }) => {
    const color = pct >= 0.8 ? 'bg-red-500' : pct >= 0.5 ? 'bg-orange-400' : pct >= 0.25 ? 'bg-amber-400' : 'bg-emerald-400';
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
        </div>
        <span className="text-xs font-medium text-gray-600">{(pct * 100).toFixed(0)}%</span>
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div>
      <SectionTitle title="Credit Risk" sub="Underwriting — approved lines, risk scores, deposits & guarantees" />

      {/* ── OVERVIEW ── */}
      {sub === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={DollarSign}  label="Total Exposure"     value={`$${totalExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="red"     />
            <StatCard icon={AlertCircle} label="Over Limit"         value={overLimit}                                  color="red"     />
            <StatCard icon={BarChart2}   label="Avg Utilization"    value={`${(avgUtil * 100).toFixed(0)}%`}           color="amber"   />
            <StatCard icon={DollarSign}  label="Deposits Held"      value={`$${depositsHeld.toLocaleString()}`}        color="blue"    />
            <StatCard icon={CheckCircle} label="Guarantees on File" value={guaranteesCount}                            color="emerald" />
          </div>

          <Card className="border-0 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b gap-3">
              <SHSearch value={crSearch} onChange={v => { setCrSearch(v); setCrPage(1); }} placeholder="Search business…" />
              {crSearch && <span className="text-xs text-gray-400 shrink-0">{filteredCrRows.length} of {rows.length}</span>}
              <select
                value={crSort}
                onChange={e => { setCrSort(e.target.value as any); setCrPage(1); }}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0"
              >
                <option value="risk">Risk: Highest first</option>
                <option value="utilization-desc">Utilization: Highest first</option>
                <option value="balance-asc">Balance: Most negative first</option>
                <option value="balance-desc">Balance: Highest first</option>
                <option value="deposit-desc">Deposit: Highest first</option>
                <option value="name">Name: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-y bg-gray-50">
                  <tr>
                    <TH>Business</TH>
                    <TH right>Balance</TH>
                    <TH right>Credit Line</TH>
                    <TH>Utilization</TH>
                    <TH>Risk</TH>
                    <TH right>Deposit</TH>
                    <TH>Guarantee</TH>
                    <TH right>Actions</TH>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pagedRows.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">{crSearch ? 'No results match your search' : 'No credit profiles — they are created automatically when data is saved'}</td></tr>
                  ) : pagedRows.map(r => (
                    editId === r.user_id ? (
                      <tr key={r.user_id} className="bg-indigo-50/40">
                        <TD><p className="font-medium text-gray-900">{r.businessName}</p></TD>
                        <TD right>
                          <span className={r.balance < 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                            {r.balance < 0 ? '-' : '+'}${Math.abs(r.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </TD>
                        <td className="px-4 py-2">
                          <Input type="number" value={editForm.credit_line}
                            onChange={e => setEditForm((f: any) => ({ ...f, credit_line: Number(e.target.value) }))}
                            className="h-7 w-24 text-xs text-right" />
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-400">—</td>
                        <td className="px-4 py-2">
                          <select value={editForm.risk_score}
                            onChange={e => setEditForm((f: any) => ({ ...f, risk_score: e.target.value }))}
                            className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
                            <option value="">Auto</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <Input type="number" value={editForm.security_deposit_amount}
                            onChange={e => setEditForm((f: any) => ({ ...f, security_deposit_amount: Number(e.target.value) }))}
                            className="h-7 w-20 text-xs text-right" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="checkbox" checked={editForm.personal_guarantee_on_file}
                            onChange={e => setEditForm((f: any) => ({ ...f, personal_guarantee_on_file: e.target.checked }))}
                            className="h-4 w-4 accent-indigo-600" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => saveEdit(r)} disabled={saving}>
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit}>Cancel</Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.user_id} className={`hover:bg-gray-50 ${r.over_limit ? 'bg-red-50/30' : ''}`}>
                        <TD>
                          <p className="font-medium text-gray-900">{r.businessName}</p>
                          {r.over_limit && <p className="text-xs text-red-600 font-medium">⚠ Over credit limit</p>}
                        </TD>
                        <TD right>
                          <span className={r.balance < 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>
                            {r.balance < 0 ? '-' : '+'}${Math.abs(r.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </TD>
                        <TD right><span className="font-medium">${(r.credit_line ?? 500).toLocaleString()}</span></TD>
                        <TD>{r.balance < 0 ? <UtilBar pct={r.utilization} /> : <span className="text-xs text-gray-300">—</span>}</TD>
                        <TD><RiskBadge level={r.risk_score || r.computed_risk} /></TD>
                        <TD right>
                          {(r.security_deposit_amount ?? 0) > 0
                            ? <span className="font-medium">${r.security_deposit_amount.toLocaleString()}</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </TD>
                        <TD>
                          {r.personal_guarantee_on_file
                            ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />On file</span>
                            : <span className="text-xs text-gray-300">—</span>}
                        </TD>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startEdit(r)}>
                            <Edit2 className="h-3 w-3 mr-1" />Edit
                          </Button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </CardContent>
            <AdminPager total={filteredCrRows.length} page={crPage} setPage={setCrPage} />
          </Card>
        </div>
      )}

      {/* ── RISK SCORECARD ── */}
      {sub === 'Risk Scorecard' && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">Risk is auto-computed</span> from balance vs credit line.
              Critical ≥ 80% utilized · High ≥ 50% · Medium = any negative · Low = positive balance.
              Override manually in the Overview tab.
            </div>
          </div>

          <div className="flex justify-end">
            <select
              value={scSort}
              onChange={e => { setScSort(e.target.value as any); setScPages({ critical: 1, high: 1, medium: 1, low: 1 }); }}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
            >
              <option value="utilization-desc">Utilization: Highest first</option>
              <option value="balance-asc">Balance: Most negative first</option>
              <option value="balance-desc">Balance: Highest first</option>
              <option value="name">Name: A → Z</option>
            </select>
          </div>

          {(['critical','high','medium','low'] as const).map(level => {
            const levelRows = riskRows.filter(r => (r.risk_score || r.computed_risk) === level)
              .slice().sort((a, b) => {
                if (scSort === 'utilization-desc') return (b.utilization ?? 0) - (a.utilization ?? 0);
                if (scSort === 'balance-asc')      return (a.balance ?? 0) - (b.balance ?? 0);
                if (scSort === 'balance-desc')     return (b.balance ?? 0) - (a.balance ?? 0);
                if (scSort === 'name')             return (a.businessName ?? '').localeCompare(b.businessName ?? '');
                return 0;
              });
            if (levelRows.length === 0) return null;
            const pg = scPages[level] || 1;
            const styleMap: Record<string, { border: string; bg: string; title: string }> = {
              critical: { border: 'border-l-red-500',    bg: 'bg-red-50/30',    title: 'text-red-700'     },
              high:     { border: 'border-l-orange-400', bg: 'bg-orange-50/30', title: 'text-orange-700'  },
              medium:   { border: 'border-l-amber-400',  bg: 'bg-amber-50/30',  title: 'text-amber-700'   },
              low:      { border: 'border-l-emerald-400',bg: '',                title: 'text-emerald-700' },
            };
            const s = styleMap[level];
            return (
              <Card key={level} className={`border-0 border-l-4 shadow-sm ${s.border} ${s.bg}`}>
                <CardHeader className="pb-3">
                  <CardTitle className={`text-base ${s.title}`}>
                    {level.charAt(0).toUpperCase() + level.slice(1)} Risk — {levelRows.length} merchant{levelRows.length !== 1 ? 's' : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="border-y bg-white/60">
                      <tr>
                        <TH>Business</TH>
                        <TH right>Balance</TH>
                        <TH right>Credit Line</TH>
                        <TH>Utilization</TH>
                        <TH right>Failures</TH>
                        <TH right>Risk Score</TH>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {levelRows.slice((pg-1)*AP, pg*AP).map(r => {
                        const score = r.numericRiskScore ?? 0;
                        const scoreColor = score >= 60 ? 'text-red-600' : score >= 30 ? 'text-amber-600' : 'text-emerald-600';
                        const scoreLabel = score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low';
                        return (
                          <tr key={r.user_id} className="hover:bg-white/80">
                            <TD><p className="font-medium">{r.businessName}</p></TD>
                            <TD right>
                              <span className={r.balance < 0 ? 'font-semibold text-red-600' : 'text-emerald-600 font-semibold'}>
                                {r.balance < 0 ? '-' : '+'}{Math.abs(r.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })} pts
                              </span>
                            </TD>
                            <TD right><span className="font-medium">${(r.credit_line ?? 500).toLocaleString()}</span></TD>
                            <TD>
                              {r.balance < 0 ? (
                                <div className="flex items-center gap-2">
                                  <UtilBar pct={r.utilization} />
                                  <span className="text-xs text-gray-500 w-8">{(r.utilization * 100).toFixed(0)}%</span>
                                </div>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </TD>
                            <TD right>
                              {r.failureCount > 0 ? (
                                <div className="text-right">
                                  <span className={`text-xs font-semibold ${r.failureCount >= 4 ? 'text-red-600' : r.failureCount >= 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                                    {r.failureCount}
                                  </span>
                                  {r.openDisputes > 0 && (
                                    <span className="ml-1 text-[10px] text-rose-500">({r.openDisputes} open)</span>
                                  )}
                                </div>
                              ) : <span className="text-xs text-gray-300">—</span>}
                            </TD>
                            <TD right>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className={`text-sm font-bold ${scoreColor}`}>{score}</span>
                                <span className={`text-[10px] font-semibold ${scoreColor}`}>{scoreLabel}</span>
                              </div>
                            </TD>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
                <AdminPager total={levelRows.length} page={pg} setPage={p => setScPages(prev => ({ ...prev, [level]: p }))} />
              </Card>
            );
          })}

          {rows.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-sm text-gray-400">No credit profiles found</CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── DEPOSITS & GUARANTEES ── */}
      {sub === 'Deposits & Guarantees' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={DollarSign}  label="Total Deposits Held"  value={`$${depositsHeld.toLocaleString()}`}      color="blue"    />
            <StatCard icon={CheckCircle} label="Guarantees on File"   value={guaranteesCount}                          color="emerald" />
            <StatCard icon={AlertCircle} label="No Collateral"        value={rows.filter(r => !r.security_deposit_amount && !r.personal_guarantee_on_file).length} color="amber" sub="no deposit or guarantee" />
          </div>

          {/* Security deposits */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                Security Deposits
              </CardTitle>
            </CardHeader>
            <div className="flex items-center justify-between px-4 pb-3 gap-3 border-b">
              <SHSearch value={dgDepositSearch} onChange={v => { setDgDepositSearch(v); setDgDepositPage(1); }} placeholder="Search business…" />
              {dgDepositSearch && <span className="text-xs text-gray-400 shrink-0">{rows.filter(r=>(r.security_deposit_amount??0)>0&&r.businessName?.toLowerCase().includes(dgDepositSearch.toLowerCase())).length} of {rows.filter(r=>(r.security_deposit_amount??0)>0).length}</span>}
              <select
                value={dgDepositSort}
                onChange={e => { setDgDepositSort(e.target.value as any); setDgDepositPage(1); }}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0"
              >
                <option value="deposit-desc">Deposit: Highest first</option>
                <option value="deposit-asc">Deposit: Lowest first</option>
                <option value="balance-asc">Balance: Most negative first</option>
                <option value="name">Name: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const depRows = (dgDepositSearch.trim() ? rows.filter(r=>(r.security_deposit_amount??0)>0&&r.businessName?.toLowerCase().includes(dgDepositSearch.toLowerCase())) : rows.filter(r=>(r.security_deposit_amount??0)>0))
                  .slice().sort((a, b) => {
                    if (dgDepositSort === 'deposit-desc') return (b.security_deposit_amount ?? 0) - (a.security_deposit_amount ?? 0);
                    if (dgDepositSort === 'deposit-asc')  return (a.security_deposit_amount ?? 0) - (b.security_deposit_amount ?? 0);
                    if (dgDepositSort === 'balance-asc')  return (a.balance ?? 0) - (b.balance ?? 0);
                    if (dgDepositSort === 'name')         return (a.businessName ?? '').localeCompare(b.businessName ?? '');
                    return 0;
                  });
                return (
              <table className="w-full min-w-[500px]">
                <thead className="border-b bg-gray-50">
                  <tr><TH>Business</TH><TH right>Balance</TH><TH right>Credit Line</TH><TH right>Deposit Held</TH><TH>Coverage</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {depRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">{dgDepositSearch ? 'No results match your search' : 'No security deposits on record — add them in the Overview tab'}</td></tr>
                  ) : depRows.slice((dgDepositPage-1)*AP, dgDepositPage*AP).map(r => {
                    const coverage = (r.credit_line ?? 500) > 0 ? (r.security_deposit_amount / r.credit_line) * 100 : 0;
                    return (
                      <tr key={r.user_id} className="hover:bg-gray-50">
                        <TD><p className="font-medium text-gray-900">{r.businessName}</p></TD>
                        <TD right>
                          <span className={r.balance < 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                            {r.balance < 0 ? '-' : '+'}${Math.abs(r.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </TD>
                        <TD right>${(r.credit_line ?? 500).toLocaleString()}</TD>
                        <TD right><span className="font-semibold text-blue-600">${r.security_deposit_amount.toLocaleString()}</span></TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-2 rounded-full ${coverage >= 100 ? 'bg-emerald-500' : coverage >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(100, coverage)}%` }} />
                            </div>
                            <span className="text-xs text-gray-600">{coverage.toFixed(0)}%</span>
                          </div>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
                );
              })()}
            </CardContent>
            <AdminPager total={(dgDepositSearch.trim() ? rows.filter(r=>(r.security_deposit_amount??0)>0&&r.businessName?.toLowerCase().includes(dgDepositSearch.toLowerCase())) : rows.filter(r=>(r.security_deposit_amount??0)>0)).length} page={dgDepositPage} setPage={setDgDepositPage} />
          </Card>

          {/* Personal guarantees */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                Personal Guarantees
              </CardTitle>
            </CardHeader>
            <div className="flex items-center justify-between px-4 pb-3 gap-3 border-b">
              <SHSearch value={dgGuaranteeSearch} onChange={v => { setDgGuaranteeSearch(v); setDgGuaranteePage(1); }} placeholder="Search business…" />
              {dgGuaranteeSearch && <span className="text-xs text-gray-400 shrink-0">{rows.filter(r=>r.personal_guarantee_on_file&&r.businessName?.toLowerCase().includes(dgGuaranteeSearch.toLowerCase())).length} of {rows.filter(r=>r.personal_guarantee_on_file).length}</span>}
              <select
                value={dgGuaranteeSort}
                onChange={e => { setDgGuaranteeSort(e.target.value as any); setDgGuaranteePage(1); }}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0"
              >
                <option value="balance-asc">Balance: Most negative first</option>
                <option value="balance-desc">Balance: Highest first</option>
                <option value="name">Name: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const guarRows = (dgGuaranteeSearch.trim() ? rows.filter(r=>r.personal_guarantee_on_file&&r.businessName?.toLowerCase().includes(dgGuaranteeSearch.toLowerCase())) : rows.filter(r=>r.personal_guarantee_on_file))
                  .slice().sort((a, b) => {
                    if (dgGuaranteeSort === 'balance-asc')  return (a.balance ?? 0) - (b.balance ?? 0);
                    if (dgGuaranteeSort === 'balance-desc') return (b.balance ?? 0) - (a.balance ?? 0);
                    if (dgGuaranteeSort === 'name')         return (a.businessName ?? '').localeCompare(b.businessName ?? '');
                    return 0;
                  });
                return (
              <table className="w-full min-w-[500px]">
                <thead className="border-b bg-gray-50">
                  <tr><TH>Business</TH><TH right>Balance</TH><TH right>Credit Line</TH><TH>Guarantee</TH><TH>Deposit Also?</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {guarRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">{dgGuaranteeSearch ? 'No results match your search' : 'No personal guarantees on record — mark them in the Overview tab'}</td></tr>
                  ) : guarRows.slice((dgGuaranteePage-1)*AP, dgGuaranteePage*AP).map(r => (
                    <tr key={r.user_id} className="hover:bg-gray-50">
                      <TD><p className="font-medium text-gray-900">{r.businessName}</p></TD>
                      <TD right>
                        <span className={r.balance < 0 ? 'text-red-600 font-semibold' : 'text-emerald-600'}>
                          {r.balance < 0 ? '-' : '+'}${Math.abs(r.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </TD>
                      <TD right>${(r.credit_line ?? 500).toLocaleString()}</TD>
                      <TD><span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />On file</span></TD>
                      <TD>
                        {(r.security_deposit_amount ?? 0) > 0
                          ? <span className="text-xs text-blue-600">Yes — ${r.security_deposit_amount.toLocaleString()}</span>
                          : <span className="text-xs text-gray-400">No deposit</span>}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
                );
              })()}
            </CardContent>
            <AdminPager total={(dgGuaranteeSearch.trim() ? rows.filter(r=>r.personal_guarantee_on_file&&r.businessName?.toLowerCase().includes(dgGuaranteeSearch.toLowerCase())) : rows.filter(r=>r.personal_guarantee_on_file)).length} page={dgGuaranteePage} setPage={setDgGuaranteePage} />
          </Card>
        </div>
      )}
    </div>
  );
};

export default CreditRiskSection;
