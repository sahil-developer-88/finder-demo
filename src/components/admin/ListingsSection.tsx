import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  AlertCircle, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle, ChevronRight, Clock,
  Edit2, Flag, Loader2, Pause, Search, StickyNote, Store, Trash2, XCircle, Zap,
} from 'lucide-react';
import MerchantDetailPanel from '@/components/admin/MerchantDetailPanel';
import { SectionTitle, StatCard, Pill, TH, TD, SHSearch } from '@/components/admin/shared/ui';

const ListingsSection = ({
  sub, listings, loading, onAction, onEdit,
}: {
  sub: string;
  listings: any[];
  loading: boolean;
  onAction: (id: string, action: string) => void;
  onEdit: (id: string, data: Record<string, any>) => Promise<void>;
}) => {
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [editingListing, setEditingListing] = useState<any>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [adminCtrlPage, setAdminCtrlPage] = useState(1);
  const LISTINGS_PAGE_SIZE = 10;
  const [ctrlSearch, setCtrlSearch]           = useState('');
  const [ctrlStatus, setCtrlStatus]           = useState('all');
  const [modSearch, setModSearch] = useState('');
  const [modSort,   setModSort]   = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' });

  const openEdit = (l: any) => {
    setEditingListing(l);
    setEditForm({
      business_name: l.business_name || '',
      category: l.category || '',
      description: l.description || '',
      services_offered: (l.services_offered || []).join(', '),
      location: l.location || '',
      contact_method: l.contact_method || '',
      barter_percentage: l.barter_percentage ?? 100,
      status: l.status || 'pending',
      website: l.website || '',
    });
  };

  const saveEdit = async () => {
    if (!editingListing) return;
    setEditSaving(true);
    const payload = {
      ...editForm,
      barter_percentage: Number(editForm.barter_percentage),
      services_offered: editForm.services_offered
        ? editForm.services_offered.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
    };
    await onEdit(editingListing.id, payload);
    setEditSaving(false);
    setEditingListing(null);
  };
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const [detailSearch, setDetailSearch] = useState('');
  const [detailPage, setDetailPage] = useState(1);
  const DETAIL_PAGE_SIZE = 8;

  // Auto-select first listing when data arrives
  useEffect(() => {
    if (listings.length > 0 && !selectedListing) setSelectedListing(listings[0]);
  }, [listings]);

  const filtered = listings.filter(l =>
    !search ||
    l.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.owner?.toLowerCase().includes(search.toLowerCase()) ||
    l.category?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    active:   listings.filter(l => l.status === 'active').length,
    pending:  listings.filter(l => l.status === 'pending').length,
    rejected: listings.filter(l => l.status === 'rejected').length,
    flagged:  listings.filter(l => l.status === 'flagged').length,
    expired:  listings.filter(l => l.status === 'expired').length,
  };

  // Compute category analytics from real data
  const categoryMap: Record<string, { listings: number; totalPrice: number }> = {};
  listings.forEach(l => {
    const cat = l.category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = { listings: 0, totalPrice: 0 };
    categoryMap[cat].listings++;
    categoryMap[cat].totalPrice += l.estimated_value || 0;
  });
  const categoryStats = Object.entries(categoryMap).map(([category, d]) => ({
    category,
    listings: d.listings,
    avgPrice: d.listings > 0 ? Math.round(d.totalPrice / d.listings) : 0,
    saturation: Math.min(100, Math.round((d.listings / Math.max(listings.length, 1)) * 300)),
  })).sort((a, b) => b.listings - a.listings);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );

  return (
    <div>
      <SectionTitle
        title={sub}
        sub={{
          'Listings Overview':     'All listings across the marketplace',
          'Moderation Queue':      'Listings awaiting review, reported or AI-flagged',
          'Listing Details':       'Full listing info — owner, pricing, inventory, performance',
          'Admin Controls':        'Approve, reject, pause, boost or annotate listings',
          'Marketplace Analytics': 'Category saturation, pricing trends and supply alerts',
        }[sub] ?? ''}
      />

      {sub === 'Listings Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={Store}         label="Active"   value={counts.active}   color="emerald" />
            <StatCard icon={Clock}         label="Pending"  value={counts.pending}  color="amber"   />
            <StatCard icon={XCircle}       label="Rejected" value={counts.rejected} color="red"     />
            <StatCard icon={Flag}          label="Flagged"  value={counts.flagged}  color="rose"    />
            <StatCard icon={AlertCircle}   label="Expired"  value={counts.expired}  color="indigo"  />
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                All Listings ({listings.length})
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    className="pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 w-full sm:w-56"
                    placeholder="Search listings…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-y bg-gray-50">
                  <tr>
                    <TH>Business</TH><TH>Category</TH><TH>Barter Price</TH>
                    <TH>Barter %</TH><TH>Status</TH><TH>Created</TH><TH right>Actions</TH>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No listings found</td></tr>
                  ) : paginated.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <TD>
                        <div>
                          <p className="font-medium text-gray-900">{l.business_name}</p>
                          <p className="text-xs text-gray-400">{l.owner || '—'}</p>
                        </div>
                      </TD>
                      <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{l.category}</span></TD>
                      <TD>{l.estimated_value ? `$${l.estimated_value.toLocaleString()}` : '—'}</TD>
                      <TD>{`${l.barter_percentage ?? 20}%`}</TD>
                      <TD><Pill status={l.status || 'pending'} /></TD>
                      <TD>{new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</TD>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onAction(l.id, 'approve')} className="p-1.5 rounded hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="Approve"><CheckCircle className="h-3.5 w-3.5" /></button>
                          <button onClick={() => onAction(l.id, 'reject')}  className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"     title="Reject"><XCircle className="h-3.5 w-3.5" /></button>
                          <button onClick={() => onAction(l.id, 'suspend')} className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"  title="Suspend"><Pause className="h-3.5 w-3.5" /></button>
                          <button onClick={() => onAction(l.id, 'remove')}  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"    title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-2.5 py-1 text-xs rounded border bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >Prev</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`px-2.5 py-1 text-xs rounded border ${n === page ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-gray-100'}`}
                      >{n}</button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-2.5 py-1 text-xs rounded border bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >Next</button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {sub === 'Moderation Queue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <div className="bg-amber-100 p-2 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
              <div><p className="font-semibold text-amber-900">{counts.pending} Awaiting Approval</p><p className="text-xs text-amber-700">Requires manual review</p></div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg"><Flag className="h-5 w-5 text-orange-600" /></div>
              <div><p className="font-semibold text-orange-900">{counts.flagged} Flagged / Reported</p><p className="text-xs text-orange-700">AI or user-reported content</p></div>
            </div>
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                Pending & Flagged Listings
                <SHSearch value={modSearch} onChange={v => setModSearch(v)} placeholder="Search business, category…" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div className="overflow-x-auto">
              {(() => {
                const toggleModSort = (col: string) => setModSort(prev => prev.col === col ? { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' });
                const ModSortIcon = ({ col }: { col: string }) => modSort.col === col ? (modSort.dir === 'desc' ? <ArrowDownRight className="h-3 w-3 text-emerald-500 inline ml-1" /> : <ArrowUpRight className="h-3 w-3 text-emerald-500 inline ml-1" />) : null;
                const base = listings.filter(l => ['pending', 'flagged'].includes(l.status));
                const filtered = modSearch.trim() ? base.filter(l => [l.business_name, l.category, l.owner].some(v => v?.toLowerCase().includes(modSearch.toLowerCase()))) : base;
                const sorted = [...filtered].sort((a, b) => {
                  const av = a[modSort.col] ?? ''; const bv = b[modSort.col] ?? '';
                  if (typeof av === 'number') return modSort.dir === 'desc' ? bv - av : av - bv;
                  return modSort.dir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
                });
                return (
              <table className="w-full min-w-[600px]">
                <thead className="border-y bg-gray-50">
                  <tr>
                    {[{key:'business_name',label:'Business'},{key:'category',label:'Category'},{key:'estimated_value',label:'Barter Price'},{key:'status',label:'Status'},{key:'created_at',label:'Submitted'}].map(c => (
                      <th key={c.key} onClick={() => toggleModSort(c.key)} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left cursor-pointer select-none hover:text-gray-800 whitespace-nowrap">
                        {c.label}<ModSortIcon col={c.key} />
                      </th>
                    ))}
                    <TH right>Actions</TH>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sorted.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">{modSearch ? 'No results match your search' : 'No pending or flagged listings'}</td></tr>
                  ) : sorted.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <TD>
                        <div>
                          <p className="font-medium text-gray-900">{l.business_name}</p>
                          <p className="text-xs text-gray-400">{l.owner || '—'}</p>
                        </div>
                      </TD>
                      <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{l.category}</span></TD>
                      <TD>{l.estimated_value ? `$${l.estimated_value.toLocaleString()}` : '—'}</TD>
                      <TD><Pill status={l.status || 'pending'} /></TD>
                      <TD>{new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</TD>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => onAction(l.id, 'reject')}>
                            <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                          </Button>
                          <Button size="sm" className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => onAction(l.id, 'approve')}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => onAction(l.id, 'suspend')}>
                            <Pause className="h-3.5 w-3.5 mr-1" />Pause
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                );
              })()}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                AI-Flagged Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { msg: 'Price manipulation detected on "Premium Coffee Beans" — barter price 3× market rate', level: 'high'   },
                { msg: 'Duplicate listing detected: "Tech Repair Bundle" matches existing listing ID #182',   level: 'medium' },
                { msg: 'Low inventory warning: "Yoga Class Credits" — 0 units remaining',                     level: 'low'    },
              ].map((a, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  a.level === 'high' ? 'bg-red-50 border-red-200' : a.level === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
                }`}>
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${a.level === 'high' ? 'text-red-500' : a.level === 'medium' ? 'text-amber-500' : 'text-blue-500'}`} />
                  <p className="text-sm text-gray-700">{a.msg}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {sub === 'Marketplace Analytics' && (
        <div className="space-y-6">
          {categoryStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No listing data available for analytics.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Listings by Category</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryStats} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="listings" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Average Barter Price by Category</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryStats} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                          <YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: any) => [`$${v}`, 'Avg Price']} />
                          <Bar dataKey="avgPrice" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3"><CardTitle className="text-base">Category Saturation Levels</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead className="border-y bg-gray-50">
                      <tr><TH>Category</TH><TH>Listings</TH><TH>Avg Price</TH><TH>Saturation</TH><TH>Supply</TH></tr>
                    </thead>
                    <tbody className="divide-y">
                      {categoryStats.map(c => (
                        <tr key={c.category} className="hover:bg-gray-50">
                          <TD><span className="font-medium">{c.category}</span></TD>
                          <TD>{c.listings}</TD>
                          <TD>{c.avgPrice > 0 ? `$${c.avgPrice.toLocaleString()}` : '—'}</TD>
                          <TD>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                                <div
                                  className={`h-1.5 rounded-full ${c.saturation >= 80 ? 'bg-red-400' : c.saturation >= 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                  style={{ width: `${c.saturation}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8">{c.saturation}%</span>
                            </div>
                          </TD>
                          <TD>
                            {c.saturation < 50
                              ? <span className="text-xs text-emerald-600 font-medium">Low supply</span>
                              : c.saturation >= 80
                              ? <span className="text-xs text-red-500 font-medium">Oversaturated</span>
                              : <span className="text-xs text-gray-500">Balanced</span>}
                          </TD>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {sub === 'Listing Details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Listing list */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Listing</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400"
                placeholder="Search listings…"
                value={detailSearch}
                onChange={e => { setDetailSearch(e.target.value); setDetailPage(1); }}
              />
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-340px)]">
              {(() => {
                const detailFiltered = listings.filter(l =>
                  !detailSearch ||
                  l.business_name?.toLowerCase().includes(detailSearch.toLowerCase()) ||
                  l.category?.toLowerCase().includes(detailSearch.toLowerCase()) ||
                  l.owner?.toLowerCase().includes(detailSearch.toLowerCase())
                );
                const detailTotalPages = Math.max(1, Math.ceil(detailFiltered.length / DETAIL_PAGE_SIZE));
                const detailPaginated = detailFiltered.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);
                return (
                  <>
                    {detailPaginated.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">No listings found.</p>
                    ) : detailPaginated.map(l => (
                      <button
                        key={l.id}
                        onClick={() => setSelectedListing(l)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selectedListing?.id === l.id
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">{l.business_name}</p>
                          <Pill status={l.status || 'pending'} />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{l.category}</p>
                      </button>
                    ))}
                    {detailTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-gray-400">{(detailPage - 1) * DETAIL_PAGE_SIZE + 1}–{Math.min(detailPage * DETAIL_PAGE_SIZE, detailFiltered.length)} of {detailFiltered.length}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setDetailPage(p => Math.max(1, p - 1))} disabled={detailPage === 1} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8249;</button>
                          <button onClick={() => setDetailPage(p => Math.min(detailTotalPages, p + 1))} disabled={detailPage === detailTotalPages} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8250;</button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Detail panel */}
          {selectedListing ? (
            <MerchantDetailPanel listing={selectedListing} onAction={onAction} onEdit={openEdit} />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Select a listing to view merchant details</div>
          )}
        </div>
      )}

      {sub === 'Admin Controls' && (
        <div className="space-y-5">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Listing Controls ({listings.length})</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      className="pl-8 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 w-56"
                      placeholder="Search business, category…"
                      value={ctrlSearch}
                      onChange={e => { setCtrlSearch(e.target.value); setAdminCtrlPage(1); }}
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { value: 'all',       label: 'All'       },
                    { value: 'active',    label: 'Approved'  },
                    { value: 'rejected',  label: 'Rejected'  },
                    { value: 'suspended', label: 'Suspended' },
                    { value: 'removed',   label: 'Removed'   },
                  ].map(f => (
                    <button
                      key={f.value}
                      onClick={() => { setCtrlStatus(f.value); setAdminCtrlPage(1); }}
                      className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                        ctrlStatus === f.value
                          ? f.value === 'all'       ? 'bg-gray-800 text-white border-gray-800'
                          : f.value === 'active'    ? 'bg-emerald-600 text-white border-emerald-600'
                          : f.value === 'rejected'  ? 'bg-red-500 text-white border-red-500'
                          : f.value === 'suspended' ? 'bg-amber-500 text-white border-amber-500'
                          :                           'bg-gray-500 text-white border-gray-500'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {(() => {
                const ctrlFiltered = listings.filter(l => {
                  const matchSearch = !ctrlSearch ||
                    l.business_name?.toLowerCase().includes(ctrlSearch.toLowerCase()) ||
                    l.category?.toLowerCase().includes(ctrlSearch.toLowerCase()) ||
                    l.owner?.toLowerCase().includes(ctrlSearch.toLowerCase());
                  const matchStatus = ctrlStatus === 'all' || l.status === ctrlStatus;
                  return matchSearch && matchStatus;
                });
                const ctrlPages = Math.max(1, Math.ceil(ctrlFiltered.length / LISTINGS_PAGE_SIZE));
                const ctrlPage  = Math.min(adminCtrlPage, ctrlPages);
                const ctrlRows  = ctrlFiltered.slice((ctrlPage - 1) * LISTINGS_PAGE_SIZE, ctrlPage * LISTINGS_PAGE_SIZE);
                const ctrlFrom  = ctrlFiltered.length === 0 ? 0 : (ctrlPage - 1) * LISTINGS_PAGE_SIZE + 1;
                const ctrlTo    = Math.min(ctrlPage * LISTINGS_PAGE_SIZE, ctrlFiltered.length);
                const visible   = Array.from({ length: ctrlPages }, (_, i) => i + 1).filter(p =>
                  p === 1 || p === ctrlPages || Math.abs(p - ctrlPage) <= 1
                );
                return (
              <>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-y bg-gray-50">
                  <tr><TH>Business</TH><TH>Category</TH><TH>Barter Price</TH><TH>Status</TH><TH right>Actions</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {ctrlRows.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">{ctrlSearch || ctrlStatus !== 'all' ? 'No listings match your filter' : 'No listings'}</td></tr>
                  ) : ctrlRows.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <TD>
                        <div>
                          <p className="font-medium text-gray-900">{l.business_name}</p>
                          <p className="text-xs text-gray-400">{l.owner || '—'}</p>
                        </div>
                      </TD>
                      <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{l.category}</span></TD>
                      <TD>{l.estimated_value ? `$${l.estimated_value.toLocaleString()}` : '—'}</TD>
                      <TD><Pill status={l.status || 'pending'} /></TD>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {/* Approve — only if not already active/featured */}
                          {l.status !== 'active' && (
                            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 px-2" onClick={() => onAction(l.id, 'approve')}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />{l.status === 'suspended' ? 'Re-activate' : 'Approve'}
                            </Button>
                          )}
                          {/* Reject — only for pending/flagged listings awaiting moderation */}
                          {['pending', 'flagged'].includes(l.status) && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => onAction(l.id, 'reject')}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                            </Button>
                          )}
                          {/* Suspend — only if currently active, featured or pending */}
                          {['active', 'pending'].includes(l.status) && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-amber-600 border-amber-200" onClick={() => onAction(l.id, 'suspend')}>
                              <Pause className="h-3.5 w-3.5 mr-1" />Suspend
                            </Button>
                          )}
                          {/* Remove — always available except already removed */}
                          {l.status !== 'removed' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-600 border-red-200" onClick={() => onAction(l.id, 'remove')}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />Remove
                            </Button>
                          )}
                          {/* Edit — always available */}
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => openEdit(l)}>
                            <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  {ctrlFiltered.length === 0 ? 'No listings' : `${ctrlFrom}–${ctrlTo} of ${ctrlFiltered.length}`}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                    disabled={ctrlPage === 1} onClick={() => setAdminCtrlPage(p => Math.max(1, p - 1))}>
                    <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                  </Button>
                  {visible.map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-gray-400 px-1">…</span>}
                      <Button variant={p === ctrlPage ? 'default' : 'outline'} size="sm"
                        className={`h-7 w-7 p-0 text-xs ${p === ctrlPage ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white' : ''}`}
                        onClick={() => setAdminCtrlPage(p)}>
                        {p}
                      </Button>
                    </React.Fragment>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"
                    disabled={ctrlPage === ctrlPages} onClick={() => setAdminCtrlPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Internal Notes */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-amber-500" />
                Add Internal Note
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Listing</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400">
                  {listings.map(l => <option key={l.id} value={l.id}>{l.business_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Note</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400 h-24 resize-none"
                  placeholder="Add an internal admin note (not visible to the merchant)…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
              </div>
              <Button className="bg-emerald-600 hover:bg-emerald-700">Save Note</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Listing Modal — shared across all sub-tabs */}
      {editingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-900">Edit Listing — {editingListing.business_name}</h2>
              <button onClick={() => setEditingListing(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-600">Business Name</label>
                  <Input value={editForm.business_name} onChange={e => setEditForm(p => ({ ...p, business_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Category</label>
                  <Input value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Status</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={editForm.status}
                    onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                  >
                    {['pending','active','rejected','suspended','flagged','removed'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-600">Description</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 h-20 resize-none"
                    value={editForm.description}
                    onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-600">Services Offered <span className="text-gray-400 font-normal">(comma-separated)</span></label>
                  <Input value={editForm.services_offered} onChange={e => setEditForm(p => ({ ...p, services_offered: e.target.value }))} placeholder="e.g. Haircut, Coloring, Styling" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-600">Location</label>
                  <Input value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Contact Method</label>
                  <Input value={editForm.contact_method} onChange={e => setEditForm(p => ({ ...p, contact_method: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Barter %</label>
                  <Input type="number" min={1} max={100} value={editForm.barter_percentage} onChange={e => setEditForm(p => ({ ...p, barter_percentage: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-gray-600">Website</label>
                  <Input value={editForm.website} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <Button variant="outline" onClick={() => setEditingListing(null)} disabled={editSaving}>Cancel</Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListingsSection;
