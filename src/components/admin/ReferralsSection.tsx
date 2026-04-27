import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Loader2, CheckCircle, Clock, Users, Gift, Award } from 'lucide-react';
import { SectionTitle, StatCard, TH, TD, AdminPager, SHSearch } from './shared/ui';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 10;

const REFERRAL_TIERS = [
  { name: 'Starter',    min: 0,  max: 1,  emoji: '🌱', bg: 'bg-gray-100',    text: 'text-gray-600'    },
  { name: 'Bronze',     min: 1,  max: 5,  emoji: '🥉', bg: 'bg-amber-100',   text: 'text-amber-700'   },
  { name: 'Silver',     min: 5,  max: 15, emoji: '🥈', bg: 'bg-slate-100',   text: 'text-slate-700'   },
  { name: 'Gold',       min: 15, max: 30, emoji: '🥇', bg: 'bg-yellow-100',  text: 'text-yellow-700'  },
  { name: 'Ambassador', min: 30, max: Infinity, emoji: '🏆', bg: 'bg-emerald-100', text: 'text-emerald-700' },
];

const getReferralTier = (completed: number) =>
  [...REFERRAL_TIERS].reverse().find(t => completed >= t.min) ?? REFERRAL_TIERS[0];

const ReferralsSection = ({
  sub, data, loading,
}: {
  sub: string;
  data: { referrers: any[]; activity: any[] };
  loading: boolean;
}) => {
  const [refersPage, setRefersPage] = useState(1);
  const [refersSearch, setRefersSearch] = useState('');
  const [refersSort, setRefersSort] = useState<'completed-desc' | 'total-desc' | 'points-desc' | 'pending-desc' | 'name'>('completed-desc');
  const [actPage, setActPage] = useState(1);
  const [actSearch, setActSearch] = useState('');
  const [actSort, setActSort] = useState<'date-desc' | 'date-asc' | 'points-desc' | 'status-completed' | 'status-pending' | 'referrer'>('date-desc');

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );

  const totalReferrers  = data.referrers.length;
  const totalReferrals  = data.activity.length;
  const totalCompleted  = data.activity.filter(r => r.status === 'completed').length;
  const totalPoints     = data.referrers.reduce((s, r) => s + r.pointsEarned, 0);
  const topReferrers    = [...data.referrers].sort((a, b) => b.completed - a.completed).slice(0, 8);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={sub}
        sub={{
          'Overview':  'Referral program performance across all users',
          'Referrers': 'All referrers with tier status and reward totals',
          'Activity':  'Every referral relationship — who joined via whom',
        }[sub] ?? ''}
      />

      {/* ── Overview ── */}
      {sub === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users}  label="Total Referrers"  value={totalReferrers}  color="emerald" />
            <StatCard icon={Gift}   label="Total Referrals"  value={totalReferrals}  color="blue"    />
            <StatCard icon={CheckCircle} label="Completed"   value={totalCompleted}  color="emerald" />
            <StatCard icon={Award}  label="Points Awarded"   value={totalPoints}     color="amber"   />
          </div>

          {topReferrers.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base">Top Referrers by Completed Referrals</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topReferrers} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [v, 'Completed']} />
                      <Bar dataKey="completed" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Ambassador Tier Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {REFERRAL_TIERS.map(t => {
                  const count = data.referrers.filter(r => getReferralTier(r.completed).name === t.name).length;
                  return (
                    <div key={t.name} className={`rounded-xl p-4 text-center ${t.bg}`}>
                      <p className="text-2xl mb-1">{t.emoji}</p>
                      <p className={`text-sm font-semibold ${t.text}`}>{t.name}</p>
                      <p className={`text-xl font-bold ${t.text}`}>{count}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.min === 0 ? '0' : t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max - 1}`} referrals</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Referrers ── */}
      {sub === 'Referrers' && (() => {
        const sortedRefs = [...data.referrers].sort((a: any, b: any) => {
          if (refersSort === 'completed-desc') return (b.completed ?? 0) - (a.completed ?? 0);
          if (refersSort === 'total-desc')     return (b.total ?? 0) - (a.total ?? 0);
          if (refersSort === 'points-desc')    return (b.pointsEarned ?? 0) - (a.pointsEarned ?? 0);
          if (refersSort === 'pending-desc')   return (b.pending ?? 0) - (a.pending ?? 0);
          if (refersSort === 'name')           return (a.name ?? '').localeCompare(b.name ?? '');
          return 0;
        });
        const filtRefs = refersSearch.trim()
          ? sortedRefs.filter(r => [r.name, r.email, r.referralCode].some((v: any) => v?.toLowerCase().includes(refersSearch.toLowerCase())))
          : sortedRefs;
        const refersSlice = filtRefs.slice((refersPage - 1) * PAGE_SIZE, refersPage * PAGE_SIZE);
        return (
        <Card className="border-0 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
            <SHSearch value={refersSearch} onChange={v => { setRefersSearch(v); setRefersPage(1); }} placeholder="Search name, email, code…" />
            <select
              value={refersSort}
              onChange={e => { setRefersSort(e.target.value as any); setRefersPage(1); }}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white text-gray-600"
            >
              <option value="completed-desc">Completed: Most first</option>
              <option value="total-desc">Total Referrals: Most first</option>
              <option value="points-desc">Points Earned: Highest first</option>
              <option value="pending-desc">Pending: Most first</option>
              <option value="name">Name: A → Z</option>
            </select>
            {refersSearch && <span className="text-xs text-gray-400 shrink-0">{filtRefs.length} of {data.referrers.length}</span>}
          </div>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="border-y bg-gray-50">
                <tr>
                  <TH>Referrer</TH><TH>Code</TH><TH>Tier</TH>
                  <TH right>Total</TH><TH right>Completed</TH><TH right>Pending</TH><TH right>Points Earned</TH>
                </tr>
              </thead>
              <tbody className="divide-y">
                {refersSlice.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">{refersSearch ? 'No results match your search' : 'No referrers yet'}</td></tr>
                ) : refersSlice.map(r => {
                  const tier = getReferralTier(r.completed);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {(r.name?.[0] ?? r.email?.[0] ?? '?').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{r.name || '—'}</p>
                            <p className="text-xs text-gray-400">{r.email}</p>
                          </div>
                        </div>
                      </TD>
                      <TD><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.referralCode}</span></TD>
                      <TD>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tier.bg} ${tier.text}`}>
                          {tier.emoji} {tier.name}
                        </span>
                      </TD>
                      <TD right><span className="font-medium">{r.total}</span></TD>
                      <TD right><span className="text-emerald-600 font-medium">{r.completed}</span></TD>
                      <TD right><span className="text-amber-600">{r.pending}</span></TD>
                      <TD right><span className="font-semibold text-gray-900">{r.pointsEarned > 0 ? `+${r.pointsEarned}` : '—'}</span></TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
          <AdminPager total={filtRefs.length} page={refersPage} setPage={setRefersPage} />
        </Card>
        );
      })()}

      {/* ── Activity ── */}
      {sub === 'Activity' && (() => {
        const filtAct = (actSearch.trim()
          ? data.activity.filter((r: any) => [r.referrerName, r.referredName, r.referrerEmail, r.referredEmail].some((v: any) => v?.toLowerCase().includes(actSearch.toLowerCase())))
          : data.activity
        ).slice().sort((a: any, b: any) => {
          if (actSort === 'date-desc')          return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
          if (actSort === 'date-asc')           return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
          if (actSort === 'points-desc')        return (b.points_awarded ?? 0) - (a.points_awarded ?? 0);
          if (actSort === 'status-completed')   return (b.status === 'completed' ? 1 : 0) - (a.status === 'completed' ? 1 : 0);
          if (actSort === 'status-pending')     return (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0);
          if (actSort === 'referrer')           return (a.referrerName ?? '').localeCompare(b.referrerName ?? '');
          return 0;
        });
        const actSlice = filtAct.slice((actPage - 1) * PAGE_SIZE, actPage * PAGE_SIZE);
        return (
        <Card className="border-0 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
            <SHSearch value={actSearch} onChange={v => { setActSearch(v); setActPage(1); }} placeholder="Search referrer or referred…" />
            <select
              value={actSort}
              onChange={e => { setActSort(e.target.value as any); setActPage(1); }}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white text-gray-600"
            >
              <option value="date-desc">Date: Newest first</option>
              <option value="date-asc">Date: Oldest first</option>
              <option value="points-desc">Points: Highest first</option>
              <option value="status-completed">Status: Completed first</option>
              <option value="status-pending">Status: Pending first</option>
              <option value="referrer">Referrer: A → Z</option>
            </select>
            {actSearch && <span className="text-xs text-gray-400 shrink-0">{filtAct.length} of {data.activity.length}</span>}
          </div>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="border-y bg-gray-50">
                <tr><TH>Referrer</TH><TH>Referred</TH><TH>Date</TH><TH right>Points</TH><TH right>Status</TH></tr>
              </thead>
              <tbody className="divide-y">
                {actSlice.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">{actSearch ? 'No results match your search' : 'No referral activity yet'}</td></tr>
                ) : actSlice.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <TD>
                      <p className="font-medium text-gray-900">{r.referrerName || '—'}</p>
                      <p className="text-xs text-gray-400">{r.referrerEmail}</p>
                    </TD>
                    <TD>
                      <p className="font-medium text-gray-900">{r.referredName || '—'}</p>
                      <p className="text-xs text-gray-400">{r.referredEmail}</p>
                    </TD>
                    <TD><span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></TD>
                    <TD right><span className="font-semibold">{r.points_awarded > 0 ? `+${r.points_awarded}` : '—'}</span></TD>
                    <TD right>
                      {r.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle className="h-3 w-3" /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          <AdminPager total={filtAct.length} page={actPage} setPage={setActPage} />
        </Card>
        );
      })()}
    </div>
  );
};

export default ReferralsSection;
