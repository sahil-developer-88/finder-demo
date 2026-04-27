import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  XCircle, AlertTriangle, Bell, Zap, RefreshCw, Package, Flag, Edit2,
  DollarSign, BarChart2, AlertCircle, Scale, CheckCircle, Loader2,
} from 'lucide-react';
import { SectionTitle, StatCard, TH, TD, SHSearch } from './shared/ui';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 10;

interface SysHealthData {
  posFailures:   { count: number; items: any[] };
  oauthExpiring: { count: number; items: any[] };
  syncErrors:    { count: number; items: any[] };
  qrFailures:    { count: number; items: any[] };
  highRefunds:   { count: number; items: any[] };
  highAdj:       { count: number; items: any[] };
  creditImbalance: { totalPositive: number; totalNegative: number; ratio: number };
}

const SystemHealthSection = ({ sub, setSub, data, loading, reconReports, reconRunning, onRunReconciliation }: {
  sub: string;
  setSub: (s: string) => void;
  data: SysHealthData | null;
  loading: boolean;
  reconReports: any[];
  reconRunning: boolean;
  onRunReconciliation: () => Promise<void>;
}) => {
  // ── pagination + search state per table ──────────────────────────────────────
  const [posPage,     setPosPage]     = useState(1);  const [posSearch,   setPosSearch]   = useState('');  const [posSort,   setPosSort]   = useState<'days-desc' | 'days-asc' | 'status' | 'name'>('days-desc');
  const [oauthPage,   setOauthPage]   = useState(1);  const [oauthSearch, setOauthSearch] = useState('');  const [oauthSort, setOauthSort] = useState<'days-asc' | 'days-desc' | 'name'>('days-asc');
  const [syncPage,    setSyncPage]    = useState(1);  const [syncSearch,  setSyncSearch]  = useState('');  const [syncSort,  setSyncSort]  = useState<'time-desc' | 'time-asc' | 'provider'>('time-desc');
  const [qrPage,      setQrPage]      = useState(1);  const [qrSearch,    setQrSearch]    = useState('');  const [qrSort,    setQrSort]    = useState<'time-desc' | 'seconds-desc' | 'reason' | 'merchant'>('time-desc');
  const [refPage,     setRefPage]     = useState(1);  const [refSearch,   setRefSearch]   = useState('');
  const [adjPage,     setAdjPage]     = useState(1);  const [adjSearch,   setAdjSearch]   = useState('');

  // helper: paginate + show count
  const SHPager = ({ total, page, setPage }: { total: number; page: number; setPage: (p: number) => void }) => {
    const tp = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (tp <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
        <span className="text-xs text-gray-400">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8249;</button>
          {Array.from({ length: tp }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 text-sm rounded border-2 ${p === page ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'}`}>{p}</button>
          ))}
          <button onClick={() => setPage(Math.min(tp, page + 1))} disabled={page === tp} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8250;</button>
        </div>
      </div>
    );
  };


  if (loading || !data) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  const criticalCount =
    data.posFailures.count +
    data.oauthExpiring.items.filter(i => i.daysLeft <= 3).length +
    (data.syncErrors.count > 10 ? 1 : 0);
  const warnCount =
    data.oauthExpiring.items.filter(i => i.daysLeft > 3 && i.daysLeft <= 7).length +
    data.qrFailures.count +
    data.highRefunds.count +
    data.highAdj.count +
    (data.creditImbalance.ratio > 0.2 ? 1 : 0);

  const overallStatus = criticalCount > 0 ? 'CRITICAL' : warnCount > 0 ? 'DEGRADED' : 'HEALTHY';
  const statusStyle = overallStatus === 'CRITICAL'
    ? 'bg-red-600 text-white'
    : overallStatus === 'DEGRADED'
    ? 'bg-amber-500 text-white'
    : 'bg-emerald-500 text-white';

  const HealthCard = ({ label, count, severity, sub: targetSub, icon: Icon, detail }: {
    label: string; count: number; severity: 'ok' | 'warn' | 'crit'; sub: string; icon: any; detail?: string;
  }) => {
    const color = severity === 'crit' ? 'border-red-200 bg-red-50' : severity === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-white';
    const dot   = severity === 'crit' ? 'bg-red-500' : severity === 'warn' ? 'bg-amber-400' : 'bg-emerald-400';
    const cnt   = severity === 'crit' ? 'text-red-700' : severity === 'warn' ? 'text-amber-700' : 'text-emerald-700';
    return (
      <button onClick={() => setSub(targetSub)}
        className={`text-left border rounded-xl p-4 hover:shadow-md transition-all ${color}`}>
        <div className="flex items-center justify-between mb-2">
          <Icon className={`h-4 w-4 ${severity === 'crit' ? 'text-red-500' : severity === 'warn' ? 'text-amber-500' : 'text-emerald-500'}`} />
          <div className={`h-2.5 w-2.5 rounded-full ${dot} ${severity !== 'ok' ? 'animate-pulse' : ''}`} />
        </div>
        <p className={`text-2xl font-bold ${cnt}`}>{count}</p>
        <p className="text-xs font-semibold text-gray-700 mt-0.5">{label}</p>
        {detail && <p className="text-xs text-gray-400 mt-0.5">{detail}</p>}
      </button>
    );
  };

  const AlertRow = ({ item, type }: { item: any; type: 'crit' | 'warn' | 'info' }) => {
    const bg   = type === 'crit' ? 'bg-red-50 border-red-200' : type === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100';
    const icon = type === 'crit' ? <XCircle className="h-4 w-4 text-red-500 shrink-0" /> : type === 'warn' ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> : <Bell className="h-4 w-4 text-blue-400 shrink-0" />;
    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg border ${bg}`}>
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0">{item.time}</span>
      </div>
    );
  };

  // Build timeline for dashboard
  const timeline: any[] = [
    ...data.posFailures.items.slice(0, 3).map(i => ({ title: `POS disconnected — ${i.provider} (${i.businessName})`, detail: `Last sync: ${i.lastSync}`, time: i.lastSync, type: 'crit' as const })),
    ...data.oauthExpiring.items.filter(i => i.daysLeft <= 3).slice(0, 3).map(i => ({ title: `OAuth token expiring — ${i.provider} (${i.businessName})`, detail: `Expires in ${i.daysLeft} day${i.daysLeft !== 1 ? 's' : ''}`, time: i.expiresAt, type: 'crit' as const })),
    ...data.syncErrors.items.slice(0, 3).map(i => ({ title: `Sync error — ${i.provider}`, detail: i.error, time: i.time, type: 'crit' as const })),
    ...data.oauthExpiring.items.filter(i => i.daysLeft > 3 && i.daysLeft <= 7).slice(0, 3).map(i => ({ title: `OAuth expiring soon — ${i.provider} (${i.businessName})`, detail: `Expires in ${i.daysLeft} days`, time: i.expiresAt, type: 'warn' as const })),
    ...data.qrFailures.items.slice(0, 3).map(i => ({ title: `QR expired unused — ${i.customer}`, detail: `Generated ${i.generatedAt}`, time: i.generatedAt, type: 'warn' as const })),
    ...data.highRefunds.items.slice(0, 2).map(i => ({ title: `High dispute rate — ${i.businessName}`, detail: `${i.rate}% of trades disputed`, time: '30d window', type: 'warn' as const })),
    ...data.highAdj.items.slice(0, 2).map(i => ({ title: `Large manual adjustment — ${i.target}`, detail: `${i.diff > 0 ? '+' : ''}${i.diff?.toFixed(0)} credits by ${i.admin}`, time: i.date, type: 'warn' as const })),
  ].sort((a, b) => a.type === 'crit' ? -1 : 1).slice(0, 12);

  return (
    <div>
      <SectionTitle title="System Health" sub="Operational control room — real-time platform alerts and health monitoring" />

      {/* ── DASHBOARD ── */}
      {sub === 'Dashboard' && (
        <div className="space-y-5">
          {/* Status banner */}
          <div className={`rounded-xl px-5 py-3 flex items-center justify-between ${statusStyle}`}>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-white/60 animate-pulse" />
              <span className="font-bold text-lg tracking-wide">{overallStatus}</span>
              <span className="text-sm opacity-80">
                {overallStatus === 'HEALTHY' ? 'All systems operational' : `${criticalCount} critical · ${warnCount} warnings`}
              </span>
            </div>
            <span className="text-xs opacity-70">Updated just now</span>
          </div>

          {/* Health grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <HealthCard label="POS Disconnected"     count={data.posFailures.count}   severity={data.posFailures.count > 0 ? 'crit' : 'ok'}   sub="POS & OAuth"      icon={Zap}           detail="connection failures" />
            <HealthCard label="OAuth Expiring"       count={data.oauthExpiring.count}  severity={data.oauthExpiring.items.some(i => i.daysLeft <= 3) ? 'crit' : data.oauthExpiring.count > 0 ? 'warn' : 'ok'} sub="POS & OAuth" icon={RefreshCw} detail="within 7 days" />
            <HealthCard label="Sync Errors"          count={data.syncErrors.count}     severity={data.syncErrors.count > 10 ? 'crit' : data.syncErrors.count > 0 ? 'warn' : 'ok'}  sub="Sync & QR"       icon={AlertTriangle} detail="last 7 days" />
            <HealthCard label="QR Failures"          count={data.qrFailures.count}     severity={data.qrFailures.count > 5 ? 'warn' : 'ok'}    sub="Sync & QR"       icon={Package}       detail="expired unused (24h)" />
            <HealthCard label="High Dispute Rate"    count={data.highRefunds.count}    severity={data.highRefunds.count > 0 ? 'warn' : 'ok'}   sub="Financial Alerts" icon={Flag}          detail="merchants > 10%" />
            <HealthCard label="Large Adjustments"    count={data.highAdj.count}        severity={data.highAdj.count > 0 ? 'warn' : 'ok'}       sub="Financial Alerts" icon={Edit2}         detail="manual adj > $500" />
            <HealthCard label="Credit Imbalance"     count={Math.round(data.creditImbalance.ratio * 100)} severity={data.creditImbalance.ratio > 0.3 ? 'crit' : data.creditImbalance.ratio > 0.15 ? 'warn' : 'ok'} sub="Financial Alerts" icon={DollarSign} detail="negative / positive %" />
            <HealthCard label="Total Active Alerts"  count={criticalCount + warnCount} severity={criticalCount > 0 ? 'crit' : warnCount > 0 ? 'warn' : 'ok'} sub="Dashboard" icon={Bell} detail="across all categories" />
          </div>

          {/* Alert timeline */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-gray-400" />
                Active Alerts
                {criticalCount > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{criticalCount} critical</span>}
                {warnCount > 0    && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{warnCount} warnings</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 pb-4">
              {timeline.length === 0 ? (
                <div className="text-center py-10 text-sm text-emerald-600 font-medium">✅ No active alerts — all systems healthy</div>
              ) : timeline.map((item, i) => (
                <AlertRow key={i} item={item} type={item.type} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── POS & OAUTH ── */}
      {sub === 'POS & OAuth' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Zap}       label="POS Disconnected"   value={data.posFailures.count}                                       color="red"    />
            <StatCard icon={RefreshCw} label="OAuth Expiring ≤7d" value={data.oauthExpiring.count}                                     color="amber"  />
            <StatCard icon={AlertCircle} label="Expiring ≤3d"     value={data.oauthExpiring.items.filter(i => i.daysLeft <= 3).length} color="red"    sub="urgent" />
          </div>

          {/* POS connection failures */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-red-500" />POS Connection Failures
                </CardTitle>
                <div className="flex items-center gap-2">
                  <SHSearch value={posSearch} onChange={v => { setPosSearch(v); setPosPage(1); }} placeholder="Search business or provider…" />
                  <select value={posSort} onChange={e => { setPosSort(e.target.value as any); setPosPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0">
                    <option value="days-desc">Days since sync: Most first</option>
                    <option value="days-asc">Days since sync: Least first</option>
                    <option value="status">Status</option>
                    <option value="name">Name: A → Z</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const filtered = data.posFailures.items.filter(i =>
                  !posSearch || i.businessName.toLowerCase().includes(posSearch.toLowerCase()) || i.provider.toLowerCase().includes(posSearch.toLowerCase())
                ).slice().sort((a, b) => {
                  if (posSort === 'days-desc') return (b.daysSince ?? 0) - (a.daysSince ?? 0);
                  if (posSort === 'days-asc')  return (a.daysSince ?? 0) - (b.daysSince ?? 0);
                  if (posSort === 'status')    return (a.status ?? '').localeCompare(b.status ?? '');
                  if (posSort === 'name')      return (a.businessName ?? '').localeCompare(b.businessName ?? '');
                  return 0;
                });
                const paged = filtered.slice((posPage - 1) * PAGE_SIZE, posPage * PAGE_SIZE);
                return (
                  <>
                    <table className="w-full min-w-[500px]">
                      <thead className="border-b bg-gray-50">
                        <tr><TH>Business</TH><TH>Provider</TH><TH>Status</TH><TH>Last Sync</TH><TH right>Days Since Sync</TH></tr>
                      </thead>
                      <tbody className="divide-y">
                        {paged.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-emerald-600 font-medium">{posSearch ? 'No results match your search' : '✅ All POS connections active'}</td></tr>
                        ) : paged.map(i => (
                          <tr key={i.id} className="hover:bg-gray-50 bg-red-50/20">
                            <TD><p className="font-medium text-gray-900">{i.businessName}</p></TD>
                            <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{i.provider}</span></TD>
                            <TD><span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${i.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{i.status}</span></TD>
                            <TD><span className="text-xs text-gray-400">{i.lastSync}</span></TD>
                            <TD right>
                              {i.daysSince === 999
                                ? <span className="text-xs text-gray-400 italic">Never synced</span>
                                : <span className={`font-semibold text-sm ${i.daysSince > 7 ? 'text-red-600' : 'text-amber-600'}`}>{i.daysSince}d</span>}
                            </TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <SHPager total={filtered.length} page={posPage} setPage={setPosPage} />
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* OAuth tokens expiring */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-amber-500" />OAuth Tokens Expiring Soon
                </CardTitle>
                <div className="flex items-center gap-2">
                  <SHSearch value={oauthSearch} onChange={v => { setOauthSearch(v); setOauthPage(1); }} placeholder="Search business or provider…" />
                  <select value={oauthSort} onChange={e => { setOauthSort(e.target.value as any); setOauthPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0">
                    <option value="days-asc">Days left: Urgent first</option>
                    <option value="days-desc">Days left: Most first</option>
                    <option value="name">Name: A → Z</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const filtered = data.oauthExpiring.items.filter(i =>
                  !oauthSearch || i.businessName.toLowerCase().includes(oauthSearch.toLowerCase()) || i.provider.toLowerCase().includes(oauthSearch.toLowerCase())
                ).slice().sort((a, b) => {
                  if (oauthSort === 'days-asc')  return (a.daysLeft ?? 999) - (b.daysLeft ?? 999);
                  if (oauthSort === 'days-desc') return (b.daysLeft ?? 999) - (a.daysLeft ?? 999);
                  if (oauthSort === 'name')      return (a.businessName ?? '').localeCompare(b.businessName ?? '');
                  return 0;
                });
                const paged = filtered.slice((oauthPage - 1) * PAGE_SIZE, oauthPage * PAGE_SIZE);
                return (
                  <>
                    <table className="w-full min-w-[500px]">
                      <thead className="border-b bg-gray-50">
                        <tr><TH>Business</TH><TH>Provider</TH><TH>Expires At</TH><TH right>Days Left</TH></tr>
                      </thead>
                      <tbody className="divide-y">
                        {paged.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-emerald-600 font-medium">{oauthSearch ? 'No results match your search' : '✅ No tokens expiring within 7 days'}</td></tr>
                        ) : paged.map(i => (
                          <tr key={i.id} className={`hover:bg-gray-50 ${i.daysLeft <= 3 ? 'bg-red-50/20' : 'bg-amber-50/20'}`}>
                            <TD><p className="font-medium text-gray-900">{i.businessName}</p></TD>
                            <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{i.provider}</span></TD>
                            <TD><span className="text-xs text-gray-400">{i.expiresAt}</span></TD>
                            <TD right>
                              <span className={`font-bold text-sm ${i.daysLeft <= 3 ? 'text-red-600' : 'text-amber-600'}`}>
                                {i.daysLeft}d
                                {i.daysLeft <= 1 && <span className="ml-1 text-xs font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Urgent</span>}
                              </span>
                            </TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <SHPager total={filtered.length} page={oauthPage} setPage={setOauthPage} />
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SYNC & QR ── */}
      {sub === 'Sync & QR' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={AlertTriangle} label="Sync Errors (7d)"         value={data.syncErrors.count}  color="red"   />
            <StatCard icon={Package}       label="QR Expired Unused (24h)"  value={data.qrFailures.count}  color="amber" />
          </div>

          {/* Webhook / sync errors */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />Sync Errors — Last 7 Days
                </CardTitle>
                <div className="flex items-center gap-2">
                  <SHSearch value={syncSearch} onChange={v => { setSyncSearch(v); setSyncPage(1); }} placeholder="Search provider or error…" />
                  <select value={syncSort} onChange={e => { setSyncSort(e.target.value as any); setSyncPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0">
                    <option value="time-desc">Time: Newest first</option>
                    <option value="time-asc">Time: Oldest first</option>
                    <option value="provider">Provider: A → Z</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const filtered = data.syncErrors.items.filter(i =>
                  !syncSearch || i.provider.toLowerCase().includes(syncSearch.toLowerCase()) || (i.error || '').toLowerCase().includes(syncSearch.toLowerCase())
                ).slice().sort((a, b) => {
                  if (syncSort === 'time-desc') return String(b.time ?? '').localeCompare(String(a.time ?? ''));
                  if (syncSort === 'time-asc')  return String(a.time ?? '').localeCompare(String(b.time ?? ''));
                  if (syncSort === 'provider')  return (a.provider ?? '').localeCompare(b.provider ?? '');
                  return 0;
                });
                const paged = filtered.slice((syncPage - 1) * PAGE_SIZE, syncPage * PAGE_SIZE);
                return (
                  <>
                    <table className="w-full min-w-[500px]">
                      <thead className="border-b bg-gray-50">
                        <tr><TH>Provider</TH><TH>Endpoint</TH><TH>Error</TH><TH>Time</TH></tr>
                      </thead>
                      <tbody className="divide-y">
                        {paged.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-emerald-600 font-medium">{syncSearch ? 'No results match your search' : '✅ No sync errors in the last 7 days'}</td></tr>
                        ) : paged.map(i => (
                          <tr key={i.id} className="hover:bg-gray-50 bg-red-50/10">
                            <TD><span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono font-medium">{i.provider}</span></TD>
                            <TD><span className="text-xs text-gray-500 font-mono truncate max-w-[200px] block">{i.endpoint}</span></TD>
                            <TD><span className="text-xs text-red-600">{i.error || 'Unknown error'}</span></TD>
                            <TD><span className="text-xs text-gray-400">{i.time}</span></TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <SHPager total={filtered.length} page={syncPage} setPage={setSyncPage} />
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* QR validation failures */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-500" />QR Scan Failures — Last 24h
                <span className="text-xs font-normal text-gray-400 ml-1">Merchant attempted scan but failed</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const q = qrSearch.toLowerCase();
                const filtered = data.qrFailures.items.filter(i =>
                  !q || i.customer?.toLowerCase().includes(q) || i.merchant?.toLowerCase().includes(q) || i.reason?.toLowerCase().includes(q) || i.failureCode?.toLowerCase().includes(q)
                ).slice().sort((a, b) => {
                  if (qrSort === 'time-desc')    return String(b.scannedAt ?? '').localeCompare(String(a.scannedAt ?? ''));
                  if (qrSort === 'seconds-desc') return (b.secondsLate ?? 0) - (a.secondsLate ?? 0);
                  if (qrSort === 'reason')       return (a.reason ?? '').localeCompare(b.reason ?? '');
                  if (qrSort === 'merchant')     return (a.merchant ?? '').localeCompare(b.merchant ?? '');
                  return 0;
                });
                const slice = filtered.slice((qrPage - 1) * PAGE_SIZE, qrPage * PAGE_SIZE);
                return (
                  <>
                    <div className="flex items-center gap-2 px-4 py-2 border-b">
                      <SHSearch value={qrSearch} onChange={v => { setQrSearch(v); setQrPage(1); }} placeholder="Search customer, merchant or reason…" />
                      <select value={qrSort} onChange={e => { setQrSort(e.target.value as any); setQrPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0">
                        <option value="time-desc">Time: Newest first</option>
                        <option value="seconds-desc">Seconds late: Most first</option>
                        <option value="reason">Reason: A → Z</option>
                        <option value="merchant">Merchant: A → Z</option>
                      </select>
                    </div>
                    <table className="w-full min-w-[500px]">
                      <thead className="border-b bg-gray-50">
                        <tr><TH>Customer</TH><TH>Merchant</TH><TH>Reason</TH><TH>Scanned At</TH><TH right>Seconds Late</TH></tr>
                      </thead>
                      <tbody className="divide-y">
                        {slice.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-emerald-600 font-medium">✅ No QR scan failures in the last 24 hours</td></tr>
                        ) : slice.map(i => (
                          <tr key={i.id} className="hover:bg-gray-50">
                            <TD><p className="font-medium text-gray-900">{i.customer}</p></TD>
                            <TD><p className="text-xs text-gray-500">{i.merchant}</p></TD>
                            <TD>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                i.failureCode === 'P0003' ? 'bg-amber-100 text-amber-700' :
                                i.failureCode === 'P0002' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{i.reason}</span>
                            </TD>
                            <TD><span className="text-xs text-gray-400">{i.scannedAt}</span></TD>
                            <TD right>
                              {i.secondsLate != null
                                ? <span className={`text-xs font-mono font-semibold ${i.secondsLate > 120 ? 'text-red-600' : 'text-amber-600'}`}>{i.secondsLate}s</span>
                                : <span className="text-xs text-gray-300">—</span>}
                            </TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <SHPager total={filtered.length} page={qrPage} setPage={setQrPage} />
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── FINANCIAL ALERTS ── */}
      {sub === 'Financial Alerts' && (
        <div className="space-y-5">
          {/* Credit imbalance banner */}
          {data.creditImbalance.ratio > 0.15 && (
            <div className={`rounded-xl p-4 flex items-start gap-3 border ${data.creditImbalance.ratio > 0.3 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
              <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${data.creditImbalance.ratio > 0.3 ? 'text-red-500' : 'text-amber-500'}`} />
              <div className="text-sm">
                <p className={`font-semibold ${data.creditImbalance.ratio > 0.3 ? 'text-red-800' : 'text-amber-800'}`}>
                  Credit pool imbalance — {(data.creditImbalance.ratio * 100).toFixed(1)}% negative exposure
                </p>
                <p className="text-gray-600 mt-0.5">
                  Positive pool: <strong>${data.creditImbalance.totalPositive.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> ·
                  Negative exposure: <strong>${data.creditImbalance.totalNegative.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={DollarSign}   label="Pool Positive"      value={`$${data.creditImbalance.totalPositive.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="emerald" />
            <StatCard icon={AlertCircle}  label="Pool Negative"      value={`$${data.creditImbalance.totalNegative.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="red"     />
            <StatCard icon={BarChart2}    label="Imbalance Ratio"    value={`${(data.creditImbalance.ratio * 100).toFixed(1)}%`} color={data.creditImbalance.ratio > 0.3 ? 'red' : data.creditImbalance.ratio > 0.15 ? 'amber' : 'emerald'} sub="negative / positive" />
          </div>

          {/* High dispute rate */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4 text-amber-500" />High Dispute Rate — Last 30 Days
                <span className="text-xs font-normal text-gray-400 ml-1">Threshold: &gt;10%</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const q = refSearch.toLowerCase();
                const filtered = data.highRefunds.items.filter(i =>
                  !q || i.businessName?.toLowerCase().includes(q)
                );
                const slice = filtered.slice((refPage - 1) * PAGE_SIZE, refPage * PAGE_SIZE);
                return (
                  <>
                    <SHSearch value={refSearch} onChange={v => { setRefSearch(v); setRefPage(1); }} placeholder="Search business…" />
                    <table className="w-full min-w-[500px]">
                      <thead className="border-b bg-gray-50">
                        <tr><TH>Business</TH><TH right>Total Trades</TH><TH right>Disputed</TH><TH right>Rate</TH></tr>
                      </thead>
                      <tbody className="divide-y">
                        {slice.length === 0 ? (
                          <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-emerald-600 font-medium">✅ No merchants above dispute threshold</td></tr>
                        ) : slice.map(i => (
                          <tr key={i.userId} className="hover:bg-gray-50 bg-amber-50/20">
                            <TD><p className="font-medium text-gray-900">{i.businessName}</p></TD>
                            <TD right><span className="font-medium">{i.totalTrades}</span></TD>
                            <TD right><span className="font-medium text-amber-700">{i.disputed}</span></TD>
                            <TD right>
                              <span className={`font-bold text-sm ${i.rate > 20 ? 'text-red-600' : 'text-amber-600'}`}>{i.rate}%</span>
                            </TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <SHPager total={filtered.length} page={refPage} setPage={setRefPage} />
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* High manual adjustments */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-indigo-500" />Large Manual Adjustments — Last 7 Days
                <span className="text-xs font-normal text-gray-400 ml-1">Threshold: &gt;$500</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const q = adjSearch.toLowerCase();
                const filtered = data.highAdj.items.filter(i =>
                  !q || i.target?.toLowerCase().includes(q) || i.admin?.toLowerCase().includes(q) || i.reason?.toLowerCase().includes(q)
                );
                const slice = filtered.slice((adjPage - 1) * PAGE_SIZE, adjPage * PAGE_SIZE);
                return (
                  <>
                    <SHSearch value={adjSearch} onChange={v => { setAdjSearch(v); setAdjPage(1); }} placeholder="Search target, admin or reason…" />
                    <table className="w-full min-w-[500px]">
                      <thead className="border-b bg-gray-50">
                        <tr><TH>Target</TH><TH>Admin</TH><TH right>Amount</TH><TH>Reason</TH><TH>Date</TH></tr>
                      </thead>
                      <tbody className="divide-y">
                        {slice.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-emerald-600 font-medium">✅ No large manual adjustments in the last 7 days</td></tr>
                        ) : slice.map(i => (
                          <tr key={i.id} className="hover:bg-gray-50">
                            <TD><p className="font-medium text-gray-900">{i.target}</p></TD>
                            <TD><p className="text-xs text-gray-500">{i.admin}</p></TD>
                            <TD right>
                              <span className={`font-bold text-sm ${(i.diff ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {(i.diff ?? 0) > 0 ? '+' : ''}{(i.diff ?? 0).toFixed(0)} pts
                              </span>
                            </TD>
                            <TD><span className="text-xs text-gray-400">{i.reason}</span></TD>
                            <TD><span className="text-xs text-gray-400">{i.date}</span></TD>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <SHPager total={filtered.length} page={adjPage} setPage={setAdjPage} />
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Credit Reconciliation */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-violet-500" />Credit Reconciliation
                  <span className="text-xs font-normal text-gray-400 ml-1">Ledger vs user balances · runs daily at 2am UTC</span>
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={onRunReconciliation}
                  disabled={reconRunning}
                >
                  {reconRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                  Run Now
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <TH>Run At</TH>
                    <TH right>Ledger Total</TH>
                    <TH right>Credits Total</TH>
                    <TH right>Discrepancy</TH>
                    <TH>Status</TH>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reconReports.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No reconciliation reports yet — click Run Now to start</td></tr>
                  ) : reconReports.map(r => (
                    <tr key={r.id} className={r.status === 'mismatch' ? 'bg-red-50/30' : ''}>
                      <TD><span className="text-xs text-gray-500">{new Date(r.run_at).toLocaleString()}</span></TD>
                      <TD right><span className="text-xs font-medium">{Number(r.ledger_total).toLocaleString()} pts</span></TD>
                      <TD right><span className="text-xs font-medium">{Number(r.credits_total).toLocaleString()} pts</span></TD>
                      <TD right>
                        <span className={`text-xs font-bold ${Math.abs(r.discrepancy) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {Math.abs(r.discrepancy) < 0.01 ? '0' : (r.discrepancy > 0 ? '+' : '') + Number(r.discrepancy).toFixed(2)} pts
                        </span>
                      </TD>
                      <TD>
                        {r.status === 'ok'
                          ? <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" />Balanced</span>
                          : <span className="text-xs font-semibold text-red-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Mismatch</span>
                        }
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SystemHealthSection;
