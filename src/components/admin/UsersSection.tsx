import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Loader2, CheckCircle, Clock } from 'lucide-react';
import { SectionTitle, TH, TD } from './shared/ui';
import { supabase } from '@/integrations/supabase/client';

const UsersSection = ({ users, loading }: { users: any[]; loading: boolean }) => {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [sort, setSort]     = useState<'credits-desc' | 'credits-asc' | 'name' | 'joined-desc' | 'joined-asc' | 'w9-done' | 'w9-pending'>('joined-desc');
  const PER_PAGE = 10;

  const filtered = users
    .filter(u =>
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.business_name?.toLowerCase().includes(search.toLowerCase())
    )
    .slice().sort((a, b) => {
      if (sort === 'credits-desc') return (b.available_credits ?? 0) - (a.available_credits ?? 0);
      if (sort === 'credits-asc')  return (a.available_credits ?? 0) - (b.available_credits ?? 0);
      if (sort === 'name')         return (a.full_name ?? '').localeCompare(b.full_name ?? '');
      if (sort === 'joined-desc')  return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
      if (sort === 'joined-asc')   return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
      if (sort === 'w9-done')      return (b.w9_completed ? 1 : 0) - (a.w9_completed ? 1 : 0);
      if (sort === 'w9-pending')   return (a.w9_completed ? 1 : 0) - (b.w9_completed ? 1 : 0);
      return 0;
    });
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div>
      <SectionTitle title="Users" sub="All registered users with credit and compliance status" />

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            {loading ? 'Loading…' : `${users.length} registered users`}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 w-56"
                  placeholder="Search name, email, or business…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as any)}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white text-gray-600"
              >
                <option value="joined-desc">Joined: Newest first</option>
                <option value="joined-asc">Joined: Oldest first</option>
                <option value="credits-desc">Credits: Highest first</option>
                <option value="credits-asc">Credits: Lowest first</option>
                <option value="name">Name: A → Z</option>
                <option value="w9-done">W-9: Submitted first</option>
                <option value="w9-pending">W-9: Pending first</option>
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : (
            <>
              <table className="w-full min-w-[500px]">
                <thead className="border-y bg-gray-50">
                  <tr><TH>User</TH><TH>Business</TH><TH right>Credits</TH><TH>W-9</TH><TH>Joined</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-400">No users found</td></tr>
                  ) : paginated.map(u => {
                    const initials = (u.full_name || u.email || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                      <tr key={u.user_id} className="hover:bg-gray-50">
                        <TD>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold shrink-0">{initials}</div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium">{u.full_name || '—'}</p>
                                {u.onboarding_completed && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Merchant</span>}
                              </div>
                              <p className="text-xs text-gray-400">{u.email || '—'}</p>
                            </div>
                          </div>
                        </TD>
                        <TD><p className="text-gray-600 text-sm">{u.business_name || <span className="text-gray-300">—</span>}</p></TD>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-semibold text-emerald-600">${u.available_credits?.toLocaleString() ?? 0}</p>
                          <p className="text-xs text-gray-400">available</p>
                        </td>
                        <TD>
                          {u.w9_completed
                            ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle className="h-3 w-3" />Done</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"><Clock className="h-3 w-3" />Pending</span>}
                        </TD>
                        <TD><p className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</p></TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-gray-500">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}</p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).reduce((acc: (number | string)[], p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('…');
                      acc.push(p);
                      return acc;
                    }, []).map((p, i) => p === '…' ? (
                      <span key={i} className="px-2 text-gray-400 self-center text-sm">…</span>
                    ) : (
                      <Button key={i} variant={page === p ? 'default' : 'outline'} size="sm" className="w-8" onClick={() => setPage(p as number)}>{p}</Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersSection;
