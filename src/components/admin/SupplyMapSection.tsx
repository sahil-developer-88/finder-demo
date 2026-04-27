import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Store, TrendingUp, AlertCircle, Loader2, DollarSign, BarChart2 } from 'lucide-react';
import { SectionTitle, StatCard, TH, TD, AdminPager, SMSearch } from './shared/ui';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 10;

const SupplyMapSection = ({ sub, setSub, data, loading }: {
  sub: string; setSub: (s: string) => void;
  data: any; loading: boolean;
}) => {
  const [catPage,  setCatPage]  = useState(1); const [catSearch,  setCatSearch]  = useState(''); const [catSort2, setCatSort2] = useState<'listings-desc' | 'listings-asc' | 'avgTicket-desc' | 'avgValue-desc' | 'merchants-desc' | 'name'>('listings-desc');
  const [regPage,  setRegPage]  = useState(1); const [regSearch,  setRegSearch]  = useState(''); const [regSort, setRegSort] = useState<'listings-desc' | 'listings-asc' | 'merchants-desc' | 'avgValue-desc' | 'name'>('listings-desc');
  const [earnPage, setEarnPage] = useState(1); const [earnSearch, setEarnSearch] = useState(''); const [earnSort, setEarnSort] = useState<'earned-desc' | 'earned-asc' | 'name' | 'category'>('earned-desc');
  const [spendPage,setSpendPage]= useState(1); const [spendSearch,setSpendSearch]= useState(''); const [spendSort,setSpendSort]= useState<'spent-desc' | 'spent-asc' | 'name' | 'category'>('spent-desc');


  // Saturation bar: percentage of total listings per category
  const SatBar = ({ pct, count }: { pct: number; count: number }) => (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct > 60 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#10b981' }} />
      </div>
      <span className="text-xs font-mono text-gray-500 w-12 text-right">{pct.toFixed(1)}%</span>
      <span className="text-xs text-gray-400">({count})</span>
    </div>
  );

  if (loading || !data) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;

  const { categories, regions, topEarners, topSpenders } = data;
  const totalListings = categories.reduce((s: number, c: any) => s + c.listingCount, 0);

  // ── Category tab ──
  const filtCat = categories.filter((c: any) => !catSearch || c.category.toLowerCase().includes(catSearch.toLowerCase()))
    .slice().sort((a: any, b: any) => {
      if (catSort2 === 'listings-desc')   return (b.listingCount ?? 0) - (a.listingCount ?? 0);
      if (catSort2 === 'listings-asc')    return (a.listingCount ?? 0) - (b.listingCount ?? 0);
      if (catSort2 === 'avgTicket-desc')  return (b.avgTicket ?? 0) - (a.avgTicket ?? 0);
      if (catSort2 === 'avgValue-desc')   return (b.avgValue ?? 0) - (a.avgValue ?? 0);
      if (catSort2 === 'merchants-desc')  return (b.merchantCount ?? 0) - (a.merchantCount ?? 0);
      if (catSort2 === 'name')            return (a.category ?? '').localeCompare(b.category ?? '');
      return 0;
    });
  const underrep = categories.filter((c: any) => c.listingCount < 3);

  // ── Region tab ──
  const filtReg = regions.filter((r: any) => !regSearch || r.region.toLowerCase().includes(regSearch.toLowerCase()))
    .slice().sort((a: any, b: any) => {
      if (regSort === 'listings-desc')  return (b.listingCount ?? 0) - (a.listingCount ?? 0);
      if (regSort === 'listings-asc')   return (a.listingCount ?? 0) - (b.listingCount ?? 0);
      if (regSort === 'merchants-desc') return (b.merchantCount ?? 0) - (a.merchantCount ?? 0);
      if (regSort === 'avgValue-desc')  return (b.avgValue ?? 0) - (a.avgValue ?? 0);
      if (regSort === 'name')           return (a.region ?? '').localeCompare(b.region ?? '');
      return 0;
    });

  // ── Earners/spenders ──
  const filtEarn  = topEarners.filter( (u: any) => !earnSearch  || u.name.toLowerCase().includes(earnSearch.toLowerCase()))
    .slice().sort((a: any, b: any) => {
      if (earnSort === 'earned-desc') return (b.earned ?? 0) - (a.earned ?? 0);
      if (earnSort === 'earned-asc')  return (a.earned ?? 0) - (b.earned ?? 0);
      if (earnSort === 'name')        return (a.name ?? '').localeCompare(b.name ?? '');
      if (earnSort === 'category')    return (a.category ?? '').localeCompare(b.category ?? '');
      return 0;
    });
  const filtSpend = topSpenders.filter((u: any) => !spendSearch || u.name.toLowerCase().includes(spendSearch.toLowerCase()))
    .slice().sort((a: any, b: any) => {
      if (spendSort === 'spent-desc') return (b.spent ?? 0) - (a.spent ?? 0);
      if (spendSort === 'spent-asc')  return (a.spent ?? 0) - (b.spent ?? 0);
      if (spendSort === 'name')       return (a.name ?? '').localeCompare(b.name ?? '');
      if (spendSort === 'category')   return (a.category ?? '').localeCompare(b.category ?? '');
      return 0;
    });
  const maxEarned = Math.max(...topEarners.map((u: any) => u.earned), 1);
  const maxSpent  = Math.max(...topSpenders.map((u: any) => u.spent), 1);

  return (
    <div className="space-y-6">
      <SectionTitle title="Marketplace Supply Map" sub="Category saturation, regional distribution, and top traders" />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Store}      label="Total Listings"    value={totalListings}                                                                    color="indigo" />
        <StatCard icon={BarChart2}  label="Categories"        value={categories.length}                                                                color="blue"   />
        <StatCard icon={AlertCircle}label="Underrepresented"  value={underrep.length}                                                                  color="amber"  sub="< 3 listings" />
        <StatCard icon={TrendingUp} label="Avg Ticket Size"   value={`$${(categories.reduce((s: number, c: any) => s + (c.avgTicket ?? 0), 0) / Math.max(categories.length, 1)).toFixed(0)}`} color="emerald" />
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 border-b">
        {['Categories', 'Regional', 'Top Earners & Spenders'].map(t => (
          <button key={t} onClick={() => setSub(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${sub === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {/* ── Categories ── */}
      {sub === 'Categories' && (
        <div className="space-y-5">
          {underrep.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">Underrepresented Categories ({underrep.length})</p>
              <div className="flex flex-wrap gap-2">
                {underrep.map((c: any) => (
                  <span key={c.category} className="inline-flex items-center gap-1 text-xs bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                    {c.category} <span className="text-amber-400">({c.listingCount})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0 border-b">
              <CardTitle className="text-base">Category Saturation & Avg Ticket Size</CardTitle>
            </CardHeader>
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <SMSearch value={catSearch} onChange={v => { setCatSearch(v); setCatPage(1); }} placeholder="Search category…" />
              <select value={catSort2} onChange={e => { setCatSort2(e.target.value as any); setCatPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0">
                <option value="listings-desc">Listings: Most first</option>
                <option value="listings-asc">Listings: Least first</option>
                <option value="avgTicket-desc">Avg Ticket: Highest first</option>
                <option value="avgValue-desc">Avg Value: Highest first</option>
                <option value="merchants-desc">Merchants: Most first</option>
                <option value="name">Category: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-b bg-gray-50">
                  <tr><TH>Category</TH><TH>Saturation</TH><TH right>Listings</TH><TH right>Avg Value ($)</TH><TH right>Avg Ticket ($)</TH><TH right>Active Merchants</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {filtCat.slice((catPage-1)*PAGE_SIZE, catPage*PAGE_SIZE).length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No categories found</td></tr>
                  ) : filtCat.slice((catPage-1)*PAGE_SIZE, catPage*PAGE_SIZE).map((c: any) => (
                    <tr key={c.category} className="hover:bg-gray-50">
                      <TD><p className="font-medium text-gray-900">{c.category}</p></TD>
                      <TD><SatBar pct={totalListings > 0 ? (c.listingCount / totalListings) * 100 : 0} count={c.listingCount} /></TD>
                      <TD right><span className="font-semibold">{c.listingCount}</span></TD>
                      <TD right><span className="text-gray-700">{c.avgValue > 0 ? `$${c.avgValue.toFixed(0)}` : '—'}</span></TD>
                      <TD right><span className={`font-medium ${c.avgTicket > 500 ? 'text-emerald-600' : c.avgTicket > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{c.avgTicket > 0 ? `$${c.avgTicket.toFixed(0)}` : '—'}</span></TD>
                      <TD right><span className="text-gray-600">{c.merchantCount}</span></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            <AdminPager total={filtCat.length} page={catPage} setPage={setCatPage} />
          </Card>

          {/* Mini bar chart — top 8 categories by listing count */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Category Distribution</CardTitle></CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...categories].sort((a,b) => b.listingCount - a.listingCount).slice(0,10)} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="listingCount" name="Listings" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Regional ── */}
      {sub === 'Regional' && (
        <div className="space-y-5">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0 border-b"><CardTitle className="text-base">Listings by Region</CardTitle></CardHeader>
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <SMSearch value={regSearch} onChange={v => { setRegSearch(v); setRegPage(1); }} placeholder="Search region or city…" />
              <select value={regSort} onChange={e => { setRegSort(e.target.value as any); setRegPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0">
                <option value="listings-desc">Listings: Most first</option>
                <option value="listings-asc">Listings: Least first</option>
                <option value="merchants-desc">Merchants: Most first</option>
                <option value="avgValue-desc">Avg Value: Highest first</option>
                <option value="name">Region: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-b bg-gray-50">
                  <tr><TH>Region / City</TH><TH>Coverage</TH><TH right>Listings</TH><TH right>Merchants</TH><TH right>Avg Value ($)</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {filtReg.slice((regPage-1)*PAGE_SIZE, regPage*PAGE_SIZE).length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No regions found</td></tr>
                  ) : filtReg.slice((regPage-1)*PAGE_SIZE, regPage*PAGE_SIZE).map((r: any, idx: number) => {
                    const pct = totalListings > 0 ? (r.listingCount / totalListings) * 100 : 0;
                    return (
                      <tr key={r.region} className="hover:bg-gray-50">
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-5 text-right">{(regPage-1)*PAGE_SIZE + idx + 1}.</span>
                            <p className="font-medium text-gray-900">{r.region || 'Unknown'}</p>
                          </div>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs font-mono text-gray-500 w-12 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </TD>
                        <TD right><span className="font-semibold">{r.listingCount}</span></TD>
                        <TD right><span className="text-gray-600">{r.merchantCount}</span></TD>
                        <TD right><span className="text-gray-700">{r.avgValue > 0 ? `$${r.avgValue.toFixed(0)}` : '—'}</span></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
            <AdminPager total={filtReg.length} page={regPage} setPage={setRegPage} />
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-base">Top 10 Regions by Listings</CardTitle></CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...regions].sort((a,b) => b.listingCount - a.listingCount).slice(0,10)} margin={{ top: 4, right: 8, bottom: 30, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="region" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="listingCount" name="Listings" fill="#6366f1" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Top Earners & Spenders ── */}
      {sub === 'Top Earners & Spenders' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Top Earners */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0 border-b">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" />Top Earners</CardTitle>
            </CardHeader>
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <SMSearch value={earnSearch} onChange={v => { setEarnSearch(v); setEarnPage(1); }} placeholder="Search business…" />
              <select value={earnSort} onChange={e => { setEarnSort(e.target.value as any); setEarnPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0">
                <option value="earned-desc">Earned: Highest first</option>
                <option value="earned-asc">Earned: Lowest first</option>
                <option value="name">Name: A → Z</option>
                <option value="category">Category: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-b bg-gray-50">
                  <tr><TH>Business</TH><TH>Category</TH><TH right>Earned (pts)</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {filtEarn.slice((earnPage-1)*PAGE_SIZE, earnPage*PAGE_SIZE).length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No data</td></tr>
                  ) : filtEarn.slice((earnPage-1)*PAGE_SIZE, earnPage*PAGE_SIZE).map((u: any, idx: number) => (
                    <tr key={u.userId} className="hover:bg-gray-50">
                      <TD>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-300 w-5">{(earnPage-1)*PAGE_SIZE+idx+1}</span>
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.location || '—'}</p>
                          </div>
                        </div>
                      </TD>
                      <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{u.category || '—'}</span></TD>
                      <TD right>
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(u.earned / maxEarned) * 100}%` }} />
                          </div>
                          <span className="font-bold text-emerald-700 text-sm">{u.earned.toLocaleString()}</span>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            <AdminPager total={filtEarn.length} page={earnPage} setPage={setEarnPage} />
          </Card>

          {/* Top Spenders */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0 border-b">
              <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-indigo-500" />Top Spenders</CardTitle>
            </CardHeader>
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <SMSearch value={spendSearch} onChange={v => { setSpendSearch(v); setSpendPage(1); }} placeholder="Search business…" />
              <select value={spendSort} onChange={e => { setSpendSort(e.target.value as any); setSpendPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600 shrink-0">
                <option value="spent-desc">Spent: Highest first</option>
                <option value="spent-asc">Spent: Lowest first</option>
                <option value="name">Name: A → Z</option>
                <option value="category">Category: A → Z</option>
              </select>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-b bg-gray-50">
                  <tr><TH>Business</TH><TH>Category</TH><TH right>Spent (pts)</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {filtSpend.slice((spendPage-1)*PAGE_SIZE, spendPage*PAGE_SIZE).length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No data</td></tr>
                  ) : filtSpend.slice((spendPage-1)*PAGE_SIZE, spendPage*PAGE_SIZE).map((u: any, idx: number) => (
                    <tr key={u.userId} className="hover:bg-gray-50">
                      <TD>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-300 w-5">{(spendPage-1)*PAGE_SIZE+idx+1}</span>
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.location || '—'}</p>
                          </div>
                        </div>
                      </TD>
                      <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{u.category || '—'}</span></TD>
                      <TD right>
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(u.spent / maxSpent) * 100}%` }} />
                          </div>
                          <span className="font-bold text-indigo-700 text-sm">{u.spent.toLocaleString()}</span>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            <AdminPager total={filtSpend.length} page={spendPage} setPage={setSpendPage} />
          </Card>
        </div>
      )}
    </div>
  );
};

export default SupplyMapSection;
