import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Loader2, TrendingUp, AlertTriangle, Activity, ChevronRight, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { SectionTitle, StatCard, TH, TD, AdminPager, SHSearch, AP } from './shared/ui';

const LiquiditySection = ({ sub, setSub, data, loading }: { sub: string; setSub: (s: string) => void; data: any; loading: boolean }) => {
  const tabs = ['Overview', 'Credit Velocity', 'Dormant Credits', 'Imbalances', 'Category Supply'];
  const [velPage,      setVelPage]      = useState(1); const [velSearch,   setVelSearch]   = useState('');
  const [velSort,      setVelSort]      = useState<'velocity-asc' | 'velocity-desc' | 'earned-desc' | 'spent-desc' | 'vol90-desc' | 'txcount-desc' | 'name'>('velocity-asc');
  const [dormPage,     setDormPage]     = useState(1); const [dormSearch,  setDormSearch]  = useState('');
  const [dormSent,     setDormSent]     = useState<Record<string, 'sending' | 'sent' | 'failed'>>({});
  const [dormSort,     setDormSort]     = useState<'dormantDays-desc' | 'dormantDays-asc' | 'balance-desc' | 'balance-asc' | 'earned-desc' | 'name'>('dormantDays-desc');
  const [hoardPage,    setHoardPage]    = useState(1); const [hoardSearch, setHoardSearch] = useState(''); const [hoardSort, setHoardSort] = useState<'balance-desc' | 'balance-asc' | 'ratio-desc' | 'earned-desc' | 'name'>('balance-desc');
  const [overPage,     setOverPage]     = useState(1); const [overSearch,  setOverSearch]  = useState('');  const [overSort,  setOverSort]  = useState<'deficit-desc' | 'deficit-asc' | 'balance-asc' | 'earned-desc' | 'name'>('deficit-desc');
  const [catPage,      setCatPage]      = useState(1); const [catLiqSearch,setCatLiqSearch]= useState('');
  const [catSort,      setCatSort]      = useState<'imbalance-desc' | 'imbalance-asc' | 'count-desc' | 'earned-desc' | 'spent-desc' | 'category'>('imbalance-desc');

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const AlertIcon = ({ type }: { type: string }) => {
    if (type === 'hoarding') return <TrendingUp className="h-4 w-4" />;
    if (type === 'imbalance') return <AlertTriangle className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const alertTitle = (type: string) => {
    if (type === 'hoarding') return 'Member Hoarding Alert';
    if (type === 'imbalance') return 'Trade Imbalance Alert';
    return 'Category Supply Alert';
  };

  const velocityColor = (rate: number) => {
    if (rate >= 60) return 'text-emerald-600';
    if (rate >= 30) return 'text-amber-500';
    return 'text-red-500';
  };

  const velocityScoreColor = (score: number) => {
    if (score >= 60) return 'bg-emerald-500';
    if (score >= 30) return 'bg-amber-400';
    return 'bg-red-400';
  };

  const categoryStatus = (imbalance: number) => {
    if (imbalance > 70) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Supply Glut</span>;
    if (imbalance < 20) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">High Demand</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Balanced</span>;
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Liquidity Dashboard" sub={sub} />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mr-2" />
          <span className="text-gray-500">Loading liquidity data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle title="Liquidity Dashboard" sub={sub} />

      {/* Sub-tab nav */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              sub === t
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {sub === 'Overview' && (
        <div className="space-y-6">
          {/* Active Alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Active Alerts</h3>
              <div className="grid gap-3">
                {data.alerts.map((alert: any, i: number) => {
                  const destTab = alert.type === 'category' ? 'Category Supply' : 'Imbalances';
                  return (
                    <button
                      key={i}
                      onClick={() => setSub(destTab)}
                      className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        alert.severity === 'red'
                          ? 'bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300'
                          : 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 ${alert.severity === 'red' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                        <AlertIcon type={alert.type} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${alert.severity === 'red' ? 'text-red-700' : 'text-amber-700'}`}>
                          {alertTitle(alert.type)} — {alert.member}
                        </p>
                        <p className={`text-xs mt-0.5 ${alert.severity === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
                          {alert.detail}
                        </p>
                        <p className={`text-xs mt-1 font-medium ${alert.severity === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                          View in {destTab} →
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 mt-0.5 ${alert.severity === 'red' ? 'text-red-300' : 'text-amber-300'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={TrendingUp} label="Credit Velocity" value={`${data.velocityRate}%`} color="emerald" onClick={() => setSub('Credit Velocity')} />
            <StatCard icon={DollarSign} label="Credits Issued" value={`$${data.totalCreditsIssued.toLocaleString()}`} color="blue" onClick={() => setSub('Credit Velocity')} />
            <StatCard icon={Activity} label="Volume (90d)" value={`$${data.totalVolume90.toLocaleString()}`} color="indigo" onClick={() => setSub('Credit Velocity')} />
            <StatCard icon={Clock} label="Dormant Members" value={data.dormantCount} color="amber" onClick={() => setSub('Dormant Credits')} />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSub('Imbalances')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Hoarding Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600">{data.hoarderCount}</p>
                <p className="text-xs text-gray-500 mt-1">members with high earn/spend imbalance</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSub('Imbalances')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Trade Imbalance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{data.overdrawerCount}</p>
                <p className="text-xs text-gray-500 mt-1">members with negative credit balance</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Credit Velocity ── */}
      {sub === 'Credit Velocity' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-gray-600">
                Velocity measures how actively credits circulate. A healthy exchange targets <strong>60%+</strong> velocity over 90 days.
              </p>
            </CardContent>
          </Card>

          {/* Big velocity gauge */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Overall Velocity (90d)</p>
              <p className={`text-6xl font-bold ${velocityColor(data.velocityRate)}`}>
                {data.velocityRate}%
              </p>
              <p className="text-xs text-gray-400">
                ${data.totalVolume90.toLocaleString()} moved out of ${data.totalCreditsIssued.toLocaleString()} issued
              </p>
            </CardContent>
          </Card>

          {/* Members table */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Member Velocity (Worst First)</CardTitle>
            </CardHeader>
            <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
              <SHSearch value={velSearch} onChange={v => { setVelSearch(v); setVelPage(1); }} placeholder="Search member…" />
              <select
                value={velSort}
                onChange={e => { setVelSort(e.target.value as any); setVelPage(1); }}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
              >
                <option value="velocity-asc">Velocity Score: Lowest first</option>
                <option value="velocity-desc">Velocity Score: Highest first</option>
                <option value="earned-desc">Earned: Highest first</option>
                <option value="spent-desc">Spent: Highest first</option>
                <option value="vol90-desc">90d Volume: Highest first</option>
                <option value="txcount-desc">Tx Count: Most first</option>
                <option value="name">Name: A → Z</option>
              </select>
              {velSearch && <span className="text-xs text-gray-400 shrink-0">{data.velocityMembers.filter((m:any)=>m.name?.toLowerCase().includes(velSearch.toLowerCase())).length} of {data.velocityMembers.length}</span>}
            </div>
            <CardContent className="p-0 mt-0">
              {(() => {
                const filtVel = (velSearch.trim() ? data.velocityMembers.filter((m:any)=>m.name?.toLowerCase().includes(velSearch.toLowerCase())) : data.velocityMembers)
                  .slice().sort((a: any, b: any) => {
                    if (velSort === 'velocity-asc')  return (a.velocityScore ?? 0) - (b.velocityScore ?? 0);
                    if (velSort === 'velocity-desc') return (b.velocityScore ?? 0) - (a.velocityScore ?? 0);
                    if (velSort === 'earned-desc')   return (b.earned ?? 0) - (a.earned ?? 0);
                    if (velSort === 'spent-desc')    return (b.spent ?? 0) - (a.spent ?? 0);
                    if (velSort === 'vol90-desc')    return (b.txVol90 ?? 0) - (a.txVol90 ?? 0);
                    if (velSort === 'txcount-desc')  return (b.txCount90 ?? 0) - (a.txCount90 ?? 0);
                    if (velSort === 'name')          return (a.name ?? '').localeCompare(b.name ?? '');
                    return 0;
                  });
                return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <TH>Member</TH>
                    <TH right>Earned</TH>
                    <TH right>Spent</TH>
                    <TH right>90d Volume</TH>
                    <TH right>Tx Count</TH>
                    <TH>Velocity Score</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtVel.slice((velPage-1)*AP, velPage*AP).map((m: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <TD><span className="font-medium text-gray-900">{m.name}</span></TD>
                      <TD right>${m.earned.toLocaleString()}</TD>
                      <TD right>${m.spent.toLocaleString()}</TD>
                      <TD right>${m.txVol90.toLocaleString()}</TD>
                      <TD right>{m.txCount90}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${velocityScoreColor(m.velocityScore)}`}
                              style={{ width: `${Math.min(m.velocityScore, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold w-10 text-right ${velocityColor(m.velocityScore)}`}>
                            {Math.min(m.velocityScore, 100)}%
                          </span>
                        </div>
                      </TD>
                    </tr>
                  ))}
                  {filtVel.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">{velSearch ? 'No results match your search' : 'No member data available.'}</td></tr>
                  )}
                </tbody>
              </table>
                );
              })()}
            </CardContent>
            <AdminPager total={(velSearch.trim() ? data.velocityMembers.filter((m:any) => m.name?.toLowerCase().includes(velSearch.toLowerCase())) : data.velocityMembers).length} page={velPage} setPage={setVelPage} />
          </Card>
        </div>
      )}

      {/* ── Dormant Credits ── */}
      {sub === 'Dormant Credits' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={Clock} label="Dormant Members" value={data.dormantCount} color="amber" onClick={() => setTimeout(() => document.getElementById('dormant-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)} />
            <StatCard icon={DollarSign} label="Total Dormant Balance" value={`$${data.dormant.reduce((s: number, c: any) => s + c.balance, 0).toLocaleString()}`} color="amber" onClick={() => setTimeout(() => document.getElementById('dormant-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)} />
          </div>

          <Card className="border-amber-200 bg-amber-50 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm text-amber-700">
                These members have earned credits but made no transactions in <strong>90+ days</strong>. Consider sending re-engagement notices to encourage participation.
              </p>
            </CardContent>
          </Card>

          <Card id="dormant-table" className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Dormant Members</CardTitle>
            </CardHeader>
            <div className="flex items-center justify-between px-4 py-3 border-b gap-3">
              <SHSearch value={dormSearch} onChange={v => { setDormSearch(v); setDormPage(1); }} placeholder="Search member…" />
              {dormSearch && <span className="text-xs text-gray-400 shrink-0">{data.dormant.filter((m:any)=>m.name?.toLowerCase().includes(dormSearch.toLowerCase())).length} of {data.dormant.length}</span>}
              <select
                value={dormSort}
                onChange={e => { setDormSort(e.target.value as any); setDormPage(1); }}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0"
              >
                <option value="dormantDays-desc">Inactive: Longest first</option>
                <option value="dormantDays-asc">Inactive: Shortest first</option>
                <option value="balance-desc">Balance: Highest first</option>
                <option value="balance-asc">Balance: Lowest first</option>
                <option value="earned-desc">Earned: Highest first</option>
                <option value="name">Name: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 mt-0">
              {(() => {
                const filtDorm = (dormSearch.trim() ? data.dormant.filter((m:any)=>m.name?.toLowerCase().includes(dormSearch.toLowerCase())) : data.dormant)
                  .slice().sort((a: any, b: any) => {
                    if (dormSort === 'dormantDays-desc') return (b.dormantDays ?? 99999) - (a.dormantDays ?? 99999);
                    if (dormSort === 'dormantDays-asc')  return (a.dormantDays ?? 99999) - (b.dormantDays ?? 99999);
                    if (dormSort === 'balance-desc')     return (b.balance ?? 0) - (a.balance ?? 0);
                    if (dormSort === 'balance-asc')      return (a.balance ?? 0) - (b.balance ?? 0);
                    if (dormSort === 'earned-desc')      return (b.earned ?? 0) - (a.earned ?? 0);
                    if (dormSort === 'name')             return (a.name ?? '').localeCompare(b.name ?? '');
                    return 0;
                  });
                return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <TH>Member</TH>
                    <TH right>Balance</TH>
                    <TH right>Earned</TH>
                    <TH>Last Activity</TH>
                    <TH>Action</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtDorm.slice((dormPage-1)*AP, dormPage*AP).map((m: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <TD><span className="font-medium text-gray-900">{m.name}</span></TD>
                      <TD right>${m.balance.toLocaleString()}</TD>
                      <TD right>${m.earned.toLocaleString()}</TD>
                      <TD>
                        {m.lastActivityDate
                          ? <span className="text-amber-600 text-xs font-medium">{m.lastActivityDate} <span className="text-gray-400">({m.dormantDays}d ago)</span></span>
                          : <span className="text-gray-400 text-xs">Never transacted</span>}
                      </TD>
                      <TD>
                        {(() => {
                          const st = dormSent[m.id];
                          return (
                            <button
                              disabled={!!st}
                              onClick={async () => {
                                setDormSent(prev => ({ ...prev, [m.id]: 'sending' }));
                                const adminUser = (await supabase.auth.getUser()).data.user;
                                if (!adminUser) { setDormSent(prev => ({ ...prev, [m.id]: 'failed' })); return; }
                                const [notifRes, msgRes] = await Promise.all([
                                  supabase.from('notifications').insert({
                                    user_id: m.id,
                                    title: 'You have unused barter credits',
                                    message: `Hi ${m.name}, you have $${m.balance.toLocaleString()} in unused barter credits. You haven't traded in ${m.dormantDays || '90+'} days — log in and start spending them!`,
                                    type: 'info',
                                  }),
                                  supabase.from('messages').insert({
                                    sender_id: adminUser.id,
                                    recipient_id: m.id,
                                    content: `Hi ${m.name},\n\nWe noticed you haven't been active on Valuehub Exchange for ${m.dormantDays || '90+'} days and you still have $${m.balance.toLocaleString()} in barter credits waiting to be used.\n\nLog in and browse available services — your credits are ready to spend!\n\nThank you,\nValuehub Exchange Admin`,
                                    message_type: 'text',
                                  }),
                                ]);
                                setDormSent(prev => ({ ...prev, [m.id]: (notifRes.error || msgRes.error) ? 'failed' : 'sent' }));
                              }}
                              className={`h-7 px-3 text-xs font-medium rounded-lg border transition-all ${
                                st === 'sending' ? 'border-gray-200 text-gray-400 cursor-not-allowed' :
                                st === 'sent'    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-not-allowed' :
                                st === 'failed'  ? 'border-red-200 bg-red-50 text-red-600 cursor-not-allowed' :
                                'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600'
                              }`}
                            >
                              {st === 'sending' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                               st === 'sent'    ? 'Sent ✓' :
                               st === 'failed'  ? 'Failed' :
                               'Send Notice'}
                            </button>
                          );
                        })()}
                      </TD>
                    </tr>
                  ))}
                  {filtDorm.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-gray-400 text-sm">{dormSearch ? 'No results match your search' : 'No dormant members — great engagement!'}</td></tr>
                  )}
                </tbody>
              </table>
                );
              })()}
            </CardContent>
            <AdminPager total={(dormSearch.trim()?data.dormant.filter((m:any)=>m.name?.toLowerCase().includes(dormSearch.toLowerCase())):data.dormant).length} page={dormPage} setPage={p => { setDormPage(p); }} />
          </Card>
        </div>
      )}

      {/* ── Imbalances ── */}
      {sub === 'Imbalances' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hoarders */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-5 bg-amber-50 border-b border-amber-100">
              <CardTitle className="text-sm font-semibold text-amber-700 flex items-center justify-between">
                <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Member Hoarding</span>
                <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full">{data.hoarders.length}</span>
              </CardTitle>
            </CardHeader>
            <div className="flex items-center px-4 py-2 border-b gap-3">
              <SHSearch value={hoardSearch} onChange={v => { setHoardSearch(v); setHoardPage(1); }} placeholder="Search member…" />
              <select
                value={hoardSort}
                onChange={e => { setHoardSort(e.target.value as any); setHoardPage(1); }}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0"
              >
                <option value="balance-desc">Balance: Highest first</option>
                <option value="balance-asc">Balance: Lowest first</option>
                <option value="ratio-desc">Ratio: Highest first</option>
                <option value="earned-desc">Earned: Highest first</option>
                <option value="name">Name: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const filtHoard = (hoardSearch.trim() ? data.hoarders.filter((m:any)=>m.name?.toLowerCase().includes(hoardSearch.toLowerCase())) : data.hoarders)
                  .slice().sort((a: any, b: any) => {
                    if (hoardSort === 'balance-desc') return (b.balance ?? 0) - (a.balance ?? 0);
                    if (hoardSort === 'balance-asc')  return (a.balance ?? 0) - (b.balance ?? 0);
                    if (hoardSort === 'ratio-desc')   return (b.ratio ?? 0) - (a.ratio ?? 0);
                    if (hoardSort === 'earned-desc')  return (b.earned ?? 0) - (a.earned ?? 0);
                    if (hoardSort === 'name')         return (a.name ?? '').localeCompare(b.name ?? '');
                    return 0;
                  });
                return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <TH>Member</TH>
                    <TH right>Balance</TH>
                    <TH right>Earned</TH>
                    <TH right>Spent</TH>
                    <TH right>Ratio</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtHoard.slice((hoardPage-1)*AP, hoardPage*AP).map((m: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-amber-50/40">
                      <TD><span className="font-medium text-gray-900">{m.name}</span></TD>
                      <TD right>${m.balance.toLocaleString()}</TD>
                      <TD right>${m.earned.toLocaleString()}</TD>
                      <TD right>${m.spent.toLocaleString()}</TD>
                      <TD right>
                        <span className="text-amber-600 font-semibold text-xs">
                          {m.ratio != null ? `${m.ratio}:1` : 'Never spent'}
                        </span>
                      </TD>
                    </tr>
                  ))}
                  {filtHoard.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">{hoardSearch ? 'No results match your search' : 'No hoarding detected.'}</td></tr>
                  )}
                </tbody>
              </table>
                );
              })()}
            </CardContent>
            <AdminPager total={(hoardSearch.trim()?data.hoarders.filter((m:any)=>m.name?.toLowerCase().includes(hoardSearch.toLowerCase())):data.hoarders).length} page={hoardPage} setPage={setHoardPage} />
          </Card>

          {/* Overdrawers */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-5 bg-red-50 border-b border-red-100">
              <CardTitle className="text-sm font-semibold text-red-700 flex items-center justify-between">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Trade Imbalance / Over-drawers</span>
                <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full">{data.overdrawers.length}</span>
              </CardTitle>
            </CardHeader>
            <div className="flex items-center px-4 py-2 border-b gap-3">
              <SHSearch value={overSearch} onChange={v => { setOverSearch(v); setOverPage(1); }} placeholder="Search member…" />
              <select
                value={overSort}
                onChange={e => { setOverSort(e.target.value as any); setOverPage(1); }}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0"
              >
                <option value="deficit-desc">Deficit: Highest first</option>
                <option value="deficit-asc">Deficit: Lowest first</option>
                <option value="balance-asc">Balance: Most negative first</option>
                <option value="earned-desc">Earned: Highest first</option>
                <option value="name">Name: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const filtOver = (overSearch.trim() ? data.overdrawers.filter((m:any)=>m.name?.toLowerCase().includes(overSearch.toLowerCase())) : data.overdrawers)
                  .slice().sort((a: any, b: any) => {
                    if (overSort === 'deficit-desc') return (b.deficit ?? 0) - (a.deficit ?? 0);
                    if (overSort === 'deficit-asc')  return (a.deficit ?? 0) - (b.deficit ?? 0);
                    if (overSort === 'balance-asc')  return (a.balance ?? 0) - (b.balance ?? 0);
                    if (overSort === 'earned-desc')  return (b.earned ?? 0) - (a.earned ?? 0);
                    if (overSort === 'name')         return (a.name ?? '').localeCompare(b.name ?? '');
                    return 0;
                  });
                return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <TH>Member</TH>
                    <TH right>Balance</TH>
                    <TH right>Deficit</TH>
                    <TH right>Earned</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtOver.slice((overPage-1)*AP, overPage*AP).map((m: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-red-50/40">
                      <TD><span className="font-medium text-gray-900">{m.name}</span></TD>
                      <TD right><span className="text-red-600 font-semibold">${m.balance.toLocaleString()}</span></TD>
                      <TD right><span className="text-red-500 text-xs">${m.deficit.toLocaleString()}</span></TD>
                      <TD right>${m.earned.toLocaleString()}</TD>
                    </tr>
                  ))}
                  {filtOver.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-gray-400 text-sm">{overSearch ? 'No results match your search' : 'No over-drawers detected.'}</td></tr>
                  )}
                </tbody>
              </table>
                );
              })()}
            </CardContent>
            <AdminPager total={(overSearch.trim()?data.overdrawers.filter((m:any)=>m.name?.toLowerCase().includes(overSearch.toLowerCase())):data.overdrawers).length} page={overPage} setPage={setOverPage} />
          </Card>
        </div>
      )}

      {/* ── Category Supply ── */}
      {sub === 'Category Supply' && (
        <div className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-gray-600">
                Category balance ensures your exchange has diverse supply. <strong>Imbalance</strong> means too many of one type and not enough of another — oversupplied categories struggle to redeem credits.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-gray-700">Category Supply Analysis</CardTitle>
            </CardHeader>
            <div className="flex items-center px-4 py-2 border-b gap-3">
              <SHSearch value={catLiqSearch} onChange={v => { setCatLiqSearch(v); setCatPage(1); }} placeholder="Search category…" />
              <select
                value={catSort}
                onChange={e => { setCatSort(e.target.value as any); setCatPage(1); }}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0"
              >
                <option value="imbalance-desc">Unspent %: Highest first</option>
                <option value="imbalance-asc">Unspent %: Lowest first</option>
                <option value="count-desc">Members: Most first</option>
                <option value="earned-desc">Earned: Highest first</option>
                <option value="spent-desc">Spent: Highest first</option>
                <option value="category">Category: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 mt-0">
              {(() => {
                const filtered = catLiqSearch.trim() ? data.categories.filter((c:any)=>c.category?.toLowerCase().includes(catLiqSearch.toLowerCase())) : data.categories;
                const filtCatLiq = [...filtered].sort((a: any, b: any) => {
                  if (catSort === 'imbalance-desc') return (b.imbalance ?? 0) - (a.imbalance ?? 0);
                  if (catSort === 'imbalance-asc')  return (a.imbalance ?? 0) - (b.imbalance ?? 0);
                  if (catSort === 'count-desc')     return (b.count ?? 0) - (a.count ?? 0);
                  if (catSort === 'earned-desc')    return (b.earned ?? 0) - (a.earned ?? 0);
                  if (catSort === 'spent-desc')     return (b.spent ?? 0) - (a.spent ?? 0);
                  if (catSort === 'category')       return (a.category ?? '').localeCompare(b.category ?? '');
                  return 0;
                });
                return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <TH>Category</TH>
                    <TH right>Members</TH>
                    <TH right>Total Earned</TH>
                    <TH right>Total Spent</TH>
                    <TH right>Unspent %</TH>
                    <TH>Status</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtCatLiq.slice((catPage-1)*AP, catPage*AP).map((c: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <TD>
                        <span className="font-medium text-gray-900">{c.category}</span>
                        {c.count <= 2 && (
                          <span className="ml-2 text-xs text-red-500 font-medium">⚠ Single point of failure</span>
                        )}
                      </TD>
                      <TD right>{c.count}</TD>
                      <TD right>${c.earned.toLocaleString()}</TD>
                      <TD right>${c.spent.toLocaleString()}</TD>
                      <TD right>
                        <span className={c.imbalance > 70 ? 'text-red-600 font-semibold' : c.imbalance < 20 ? 'text-emerald-600 font-semibold' : 'text-gray-600'}>
                          {c.imbalance}%
                        </span>
                      </TD>
                      <TD>{categoryStatus(c.imbalance)}</TD>
                    </tr>
                  ))}
                  {filtCatLiq.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">{catLiqSearch ? 'No results match your search' : 'No active business categories found.'}</td></tr>
                  )}
                </tbody>
              </table>
                );
              })()}
            </CardContent>
            <AdminPager total={(catLiqSearch.trim() ? data.categories.filter((c:any)=>c.category?.toLowerCase().includes(catLiqSearch.toLowerCase())) : data.categories).length} page={catPage} setPage={setCatPage} />
          </Card>

          {data.categories.filter((c: any) => c.count <= 2).length > 0 && (
            <Card className="border-red-200 bg-red-50 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-red-700 mb-1">Single Points of Failure Detected</p>
                <p className="text-xs text-red-600">
                  Categories with only 1–2 members create supply risk. If those members become inactive, the category has no coverage:{' '}
                  {data.categories.filter((c: any) => c.count <= 2).map((c: any) => c.category).join(', ')}.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};


export default LiquiditySection;
