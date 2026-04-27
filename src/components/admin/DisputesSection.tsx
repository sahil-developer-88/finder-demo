import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, Search, AlertTriangle, CheckCircle, Clock, Flag, RefreshCw, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { StatCard, SectionTitle, TH, TD, SHSearch, Pill } from './shared/ui';

const PAGE_SIZE = 10;

type DisputeRow = {
  id: string; transaction_id: string | null;
  reporter_id: string; reported_id: string;
  reporterName: string; reportedName: string;
  status: string; dispute_type: string; description: string;
  admin_notes: string; arbitration_outcome: string;
  partial_refund_amount: number | null; resolved_at: string | null; created_at: string;
};
type EvidenceRow = {
  id: string; dispute_id: string; uploaded_by: string; uploaderName: string;
  file_url: string; file_name: string; file_type: string; uploaded_at: string;
};

const DISPUTE_STATUS_OPTIONS = ['open', 'under_review', 'resolved', 'escalated'];
const OUTCOME_OPTIONS        = ['', 'reporter_wins', 'reported_wins', 'split', 'dismissed'];

const DisputesSection = ({
  sub, setSub, disputes, evidence, loading, onRefresh,
}: {
  sub: string; setSub: (s: string) => void;
  disputes: DisputeRow[]; evidence: EvidenceRow[];
  loading: boolean; onRefresh: () => void;
}) => {
  const { user } = useAuth();
  const [dispPage,  setDispPage]  = useState(1); const [dispSearch,  setDispSearch]  = useState(''); const [dispSort, setDispSort] = useState<'date-desc' | 'date-asc' | 'status' | 'type' | 'reporter' | 'reported'>('date-desc');
  const [evPage,    setEvPage]    = useState(1); const [evSearch,    setEvSearch]    = useState(''); const [evSort, setEvSort] = useState<'date-desc' | 'date-asc' | 'uploader' | 'type' | 'file'>('date-desc');
  const [offPage,   setOffPage]   = useState(1);
  const [offSearch, setOffSearch] = useState('');
  const [saving,        setSaving]        = useState<string | null>(null);
  const [editMap,       setEditMap]       = useState<Record<string, { status: string; admin_notes: string; arbitration_outcome: string; partial_refund_amount: string }>>({});
  const [notesExpanded, setNotesExpanded] = useState<string | null>(null);
  const [notesCache,    setNotesCache]    = useState<Record<string, any[]>>({});

  const getDaysOpen = (created_at: string) => Math.floor((Date.now() - new Date(created_at).getTime()) / 86_400_000);

  const SlaBadge = ({ createdAt, status }: { createdAt: string; status: string }) => {
    if (status === 'resolved') return <span className="text-[10px] text-emerald-500">Resolved</span>;
    const days = getDaysOpen(createdAt);
    if (days >= 7) return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full whitespace-nowrap">⚠ OVERDUE {days}d</span>;
    if (days >= 5) return <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">AT RISK {days}d</span>;
    return <span className="text-[10px] text-gray-400 whitespace-nowrap">{days}d open</span>;
  };

  const toggleNotes = async (disputeId: string) => {
    if (notesExpanded === disputeId) { setNotesExpanded(null); return; }
    setNotesExpanded(disputeId);
    if (notesCache[disputeId]) return;
    const { data } = await supabase
      .from('audit_logs')
      .select('created_at, new_data, reason')
      .eq('table_name', 'disputes')
      .eq('record_id', disputeId)
      .order('created_at', { ascending: true });
    setNotesCache(prev => ({ ...prev, [disputeId]: (data || []).filter((l: any) => l.new_data?.admin_notes) }));
  };

  const DPager = ({ total, page, setPage }: { total: number; page: number; setPage: (p: number) => void }) => {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (pages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
        <p className="text-xs text-gray-500">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</Button>
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`h-7 w-7 rounded text-xs font-medium transition-colors ${p === page ? 'bg-rose-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{p}</button>
          ))}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === pages} onClick={() => setPage(page + 1)}>›</Button>
        </div>
      </div>
    );
  };

  const getEdit = (d: DisputeRow) =>
    editMap[d.id] ?? { status: d.status, admin_notes: d.admin_notes ?? '', arbitration_outcome: d.arbitration_outcome ?? '', partial_refund_amount: d.partial_refund_amount != null ? String(d.partial_refund_amount) : '' };

  const setField = (id: string, field: string, value: string) =>
    setEditMap(prev => ({ ...prev, [id]: { ...(prev[id] ?? getEdit(disputes.find(d => d.id === id)!)), [field]: value } }));

  const handleSave = async (d: DisputeRow) => {
    const edit = getEdit(d);
    setSaving(d.id);
    const patch: Record<string, any> = {
      status: edit.status,
      admin_notes: edit.admin_notes || null,
      arbitration_outcome: edit.arbitration_outcome || null,
      partial_refund_amount: edit.partial_refund_amount ? parseFloat(edit.partial_refund_amount) : null,
      updated_at: new Date().toISOString(),
    };
    if (edit.status === 'resolved' && !d.resolved_at) {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = user?.id ?? null;
    }
    await supabase.from('disputes').update(patch).eq('id', d.id);
    await supabase.from('audit_logs').insert({
      user_id: user?.id, admin_id: user?.id,
      action: patch.status === 'resolved' ? 'dispute_resolved' : 'dispute_updated',
      table_name: 'disputes', record_id: d.id,
      old_data: { status: d.status },
      new_data: { status: patch.status, admin_notes: patch.admin_notes, arbitration_outcome: patch.arbitration_outcome, ...(patch.partial_refund_amount ? { refund_amount: patch.partial_refund_amount } : {}) },
      reason: patch.admin_notes || `Dispute ${patch.status}`,
      section: 'Activity > Disputes',
    });
    setSaving(null);
    onRefresh();
  };

  const filteredDisputes = disputes.filter(d => {
    if (!dispSearch) return true;
    const q = dispSearch.toLowerCase();
    return d.reporterName?.toLowerCase().includes(q) || d.reportedName?.toLowerCase().includes(q) || d.dispute_type?.includes(q) || d.description?.toLowerCase().includes(q);
  }).slice().sort((a, b) => {
    if (dispSort === 'date-desc') return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
    if (dispSort === 'date-asc')  return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
    if (dispSort === 'status')    return (a.status ?? '').localeCompare(b.status ?? '');
    if (dispSort === 'type')      return (a.dispute_type ?? '').localeCompare(b.dispute_type ?? '');
    if (dispSort === 'reporter')  return (a.reporterName ?? '').localeCompare(b.reporterName ?? '');
    if (dispSort === 'reported')  return (a.reportedName ?? '').localeCompare(b.reportedName ?? '');
    return 0;
  });
  const filteredEvidence = evidence.filter(e => {
    if (!evSearch) return true;
    const q = evSearch.toLowerCase();
    return e.uploaderName?.toLowerCase().includes(q) || e.file_name?.toLowerCase().includes(q);
  }).slice().sort((a, b) => {
    if (evSort === 'date-desc') return String(b.uploaded_at ?? '').localeCompare(String(a.uploaded_at ?? ''));
    if (evSort === 'date-asc')  return String(a.uploaded_at ?? '').localeCompare(String(b.uploaded_at ?? ''));
    if (evSort === 'uploader')  return (a.uploaderName ?? '').localeCompare(b.uploaderName ?? '');
    if (evSort === 'type')      return (a.file_type ?? '').localeCompare(b.file_type ?? '');
    if (evSort === 'file')      return (a.file_name ?? '').localeCompare(b.file_name ?? '');
    return 0;
  });

  const offMap: Record<string, { name: string; count: number; openCount: number }> = {};
  disputes.forEach(d => {
    if (!offMap[d.reported_id]) offMap[d.reported_id] = { name: d.reportedName, count: 0, openCount: 0 };
    offMap[d.reported_id].count++;
    if (d.status === 'open' || d.status === 'under_review') offMap[d.reported_id].openCount++;
  });
  const repeatOffenders = Object.entries(offMap).filter(([, v]) => v.count >= 2).sort(([, a], [, b]) => b.count - a.count).map(([uid, v]) => ({ uid, ...v }));

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-rose-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle title="Disputes & Mediation" sub="Manage barter disputes, evidence, and arbitration outcomes" />
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Flag}          label="Open"         value={disputes.filter(d => d.status === 'open').length}         color="red"    />
        <StatCard icon={Clock}         label="Under Review" value={disputes.filter(d => d.status === 'under_review').length} color="amber"  />
        <StatCard icon={CheckCircle}   label="Resolved"     value={disputes.filter(d => d.status === 'resolved').length}     color="emerald"/>
        <StatCard icon={AlertTriangle} label="Escalated"    value={disputes.filter(d => d.status === 'escalated').length}    color="purple" />
      </div>

      <div className="flex gap-1 border-b">
        {['Open Disputes', 'Evidence', 'Repeat Offenders'].map(t => (
          <button key={t} onClick={() => setSub(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${sub === t ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {sub === 'Open Disputes' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center justify-between gap-3">
              All Disputes ({filteredDisputes.length})
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input className="pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 w-full sm:w-56" placeholder="Search reporter, type…" value={dispSearch} onChange={e => { setDispSearch(e.target.value); setDispPage(1); }} />
                </div>
                <select value={dispSort} onChange={e => { setDispSort(e.target.value as any); setDispPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white text-gray-600 shrink-0">
                  <option value="date-desc">Date: Newest first</option>
                  <option value="date-asc">Date: Oldest first</option>
                  <option value="status">Status</option>
                  <option value="type">Type: A → Z</option>
                  <option value="reporter">Reporter: A → Z</option>
                  <option value="reported">Reported: A → Z</option>
                </select>
              </div>
            </CardTitle>
          </CardHeader>
          {(() => {
            const overdue = filteredDisputes.filter(d => d.status !== 'resolved' && getDaysOpen(d.created_at) >= 7);
            if (overdue.length === 0) return null;
            return (
              <div className="mx-4 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span><strong>{overdue.length} dispute{overdue.length > 1 ? 's' : ''}</strong> overdue — open for more than 7 days without resolution</span>
              </div>
            );
          })()}
          <CardContent className="p-0 overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead className="border-b bg-gray-50">
                  <tr><TH>Reporter</TH><TH>Reported</TH><TH>Type</TH><TH>Description</TH><TH>Status</TH><TH>Admin Notes</TH><TH>Outcome</TH><TH right>Refund (pts)</TH><TH>Filed</TH><TH right>Save</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDisputes.slice((dispPage - 1) * PAGE_SIZE, dispPage * PAGE_SIZE).length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-400">No disputes found</td></tr>
                  ) : filteredDisputes.slice((dispPage - 1) * PAGE_SIZE, dispPage * PAGE_SIZE).map(d => {
                    const edit = getEdit(d);
                    return (
                      <tr key={d.id} className={`hover:bg-gray-50 align-top ${d.status === 'escalated' ? 'bg-purple-50/30' : d.status === 'open' ? 'bg-red-50/10' : ''}`}>
                        <TD><p className="font-medium text-gray-900">{d.reporterName}</p><p className="text-xs text-gray-400 font-mono">{d.reporter_id.slice(0, 8)}</p></TD>
                        <TD><p className="text-gray-700">{d.reportedName}</p><p className="text-xs text-gray-400 font-mono">{d.reported_id.slice(0, 8)}</p></TD>
                        <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full capitalize">{d.dispute_type.replace(/_/g, ' ')}</span></TD>
                        <TD><p className="text-xs text-gray-600 max-w-[150px] truncate" title={d.description}>{d.description || '—'}</p></TD>
                        <TD>
                          <select value={edit.status} onChange={e => setField(d.id, 'status', e.target.value)} className="text-xs border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-rose-400">
                            {DISPUTE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                          </select>
                        </TD>
                        <TD>
                          <textarea rows={2} value={edit.admin_notes} onChange={e => setField(d.id, 'admin_notes', e.target.value)} placeholder="Add notes…" className="text-xs border rounded-lg px-2 py-1 w-36 resize-none focus:outline-none focus:ring-1 focus:ring-rose-400" />
                          <button onClick={() => toggleNotes(d.id)} className="text-[10px] text-blue-500 hover:underline mt-1 block">
                            {notesExpanded === d.id ? 'Hide history' : 'View history'}
                          </button>
                          {notesExpanded === d.id && (
                            <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto w-36">
                              {(notesCache[d.id] ?? []).length === 0 ? (
                                <p className="text-[10px] text-gray-400 italic">No previous notes</p>
                              ) : (notesCache[d.id] ?? []).map((log: any, i: number) => (
                                <div key={i} className="text-[10px] bg-gray-50 border rounded p-1.5">
                                  <p className="text-gray-400 mb-0.5">{new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</p>
                                  <p className="text-gray-700 leading-relaxed">{log.new_data?.admin_notes}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </TD>
                        <TD>
                          <select value={edit.arbitration_outcome} onChange={e => setField(d.id, 'arbitration_outcome', e.target.value)} className="text-xs border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-rose-400">
                            {OUTCOME_OPTIONS.map(o => <option key={o} value={o}>{o ? o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '— None —'}</option>)}
                          </select>
                        </TD>
                        <td className="px-4 py-3 text-right">
                          <input type="number" min="0" step="1" placeholder="0" value={edit.partial_refund_amount} onChange={e => setField(d.id, 'partial_refund_amount', e.target.value)} className="text-xs border rounded-lg px-2 py-1 w-20 text-right focus:outline-none focus:ring-1 focus:ring-rose-400" />
                        </td>
                        <TD>
                          <span className="text-xs text-gray-400 block">{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                          <SlaBadge createdAt={d.created_at} status={d.status} />
                        </TD>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white" onClick={() => handleSave(d)} disabled={saving === d.id}>
                            {saving === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
          <DPager total={filteredDisputes.length} page={dispPage} setPage={setDispPage} />
        </Card>
      )}

      {sub === 'Evidence' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center justify-between gap-3">
              Evidence Files ({filteredEvidence.length})
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input className="pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-400 w-full sm:w-56" placeholder="Search file, uploader…" value={evSearch} onChange={e => { setEvSearch(e.target.value); setEvPage(1); }} />
                </div>
                <select value={evSort} onChange={e => { setEvSort(e.target.value as any); setEvPage(1); }} className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white text-gray-600 shrink-0">
                  <option value="date-desc">Date: Newest first</option>
                  <option value="date-asc">Date: Oldest first</option>
                  <option value="uploader">Uploader: A → Z</option>
                  <option value="type">File Type: A → Z</option>
                  <option value="file">File Name: A → Z</option>
                </select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="border-b bg-gray-50">
                <tr><TH>Dispute ID</TH><TH>Uploaded By</TH><TH>File Name</TH><TH>Type</TH><TH>Uploaded</TH><TH right>View</TH></tr>
              </thead>
              <tbody className="divide-y">
                {filteredEvidence.slice((evPage - 1) * PAGE_SIZE, evPage * PAGE_SIZE).length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No evidence files uploaded yet</td></tr>
                ) : filteredEvidence.slice((evPage - 1) * PAGE_SIZE, evPage * PAGE_SIZE).map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <TD><span className="font-mono text-xs text-gray-500">{e.dispute_id.slice(0, 8)}…</span></TD>
                    <TD><p className="text-sm font-medium">{e.uploaderName}</p></TD>
                    <TD><p className="text-sm text-gray-700 max-w-[200px] truncate" title={e.file_name}>{e.file_name}</p></TD>
                    <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{e.file_type || '—'}</span></TD>
                    <TD><span className="text-xs text-gray-400">{new Date(e.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span></TD>
                    <td className="px-4 py-3 text-right">
                      <a href={e.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
                        <ArrowUpRight className="h-3.5 w-3.5" />View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          <DPager total={filteredEvidence.length} page={evPage} setPage={setEvPage} />
        </Card>
      )}

      {sub === 'Repeat Offenders' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800">Repeat Offenders</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{repeatOffenders.length}</p>
              <p className="text-xs text-red-600 mt-0.5">Users reported in 2+ disputes</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800">With Open Cases</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{repeatOffenders.filter(o => o.openCount > 0).length}</p>
              <p className="text-xs text-amber-600 mt-0.5">Currently active disputes</p>
            </div>
          </div>
          <Card className="border-0 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b gap-3">
              <SHSearch value={offSearch} onChange={v => { setOffSearch(v); setOffPage(1); }} placeholder="Search user…" />
              {offSearch && <span className="text-xs text-gray-400 shrink-0">{repeatOffenders.filter(o => o.name?.toLowerCase().includes(offSearch.toLowerCase())).length} of {repeatOffenders.length}</span>}
            </div>
            <CardContent className="p-0 overflow-x-auto">
              {(() => {
                const filtOff = offSearch.trim() ? repeatOffenders.filter(o => o.name?.toLowerCase().includes(offSearch.toLowerCase())) : repeatOffenders;
                return (
                  <table className="w-full min-w-[500px]">
                    <thead className="border-y bg-gray-50">
                      <tr><TH>User</TH><TH right>Total Reports</TH><TH right>Open / Under Review</TH><TH right>Resolved</TH><TH>Risk</TH><TH right>Action</TH></tr>
                    </thead>
                    <tbody className="divide-y">
                      {filtOff.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-emerald-600 font-medium">{offSearch ? 'No results match your search' : '✅ No users appear in more than one dispute'}</td></tr>
                      ) : filtOff.slice((offPage - 1) * PAGE_SIZE, offPage * PAGE_SIZE).map(o => {
                        const risk = o.count >= 5 ? 'critical' : o.count >= 3 ? 'high' : 'medium';
                        return (
                          <tr key={o.uid} className={`hover:bg-gray-50 ${risk === 'critical' ? 'bg-red-50/30' : ''}`}>
                            <TD><p className="font-medium text-gray-900">{o.name}</p><p className="text-xs text-gray-400 font-mono">{o.uid.slice(0, 8)}</p></TD>
                            <TD right><span className="font-bold text-gray-900">{o.count}</span></TD>
                            <TD right><span className={o.openCount > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>{o.openCount}</span></TD>
                            <TD right><span className="text-emerald-600">{o.count - o.openCount}</span></TD>
                            <TD><Pill status={risk} /></TD>
                            <td className="px-4 py-3 text-right">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSub('Open Disputes')}>View Disputes</Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </CardContent>
            <DPager total={(offSearch.trim() ? repeatOffenders.filter(o => o.name?.toLowerCase().includes(offSearch.toLowerCase())) : repeatOffenders).length} page={offPage} setPage={setOffPage} />
          </Card>
        </div>
      )}
    </div>
  );
};

export default DisputesSection;
