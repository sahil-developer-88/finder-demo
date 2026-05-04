import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, Edit2, CheckCircle, XCircle, Pause, Trash2, Plug, FileText, Clock,
  Users, ArrowUpRight, Zap, DollarSign, Ban, Scale, Store, Plus,
} from 'lucide-react';
import { Pill } from './shared/ui';
import { POSConnectionWizard } from '@/components/merchant/POSConnectionWizard';
import { useToast } from '@/hooks/use-toast';

const ADMIN_CALLBACK = '/admin?section=listings&sub=Listing+Details';

const POSTab = ({ userId, posIntegrations, onRefresh }: { userId: string; posIntegrations: any[]; onRefresh: () => void }) => {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [disconnecting, setDisc]    = useState<string | null>(null);
  const { toast } = useToast();

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this POS system?')) return;
    setDisc(id);
    await supabase.from('pos_integrations').delete().eq('id', id);
    onRefresh();
    setDisc(null);
  };

  return (
    <div className="space-y-3">
      {posIntegrations.length === 0 && !wizardOpen && (
        <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl">
          <Plug className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No POS systems connected</p>
        </div>
      )}

      {posIntegrations.map((p: any) => (
        <div key={p.id} className="border rounded-xl p-4 space-y-2 hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 capitalize">{p.provider}</p>
              <p className="text-xs text-gray-400">Connected {new Date(p.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Pill status={p.status || 'active'} />
              <button
                onClick={() => handleDisconnect(p.id)}
                disabled={disconnecting === p.id}
                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
              >
                {disconnecting === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Disconnect
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-400">Store ID: </span><span className="font-mono text-gray-700">{p.store_id || '—'}</span></div>
            {p.access_token && (
              <div><span className="text-gray-400">Token: </span><span className="font-mono text-gray-700">{p.access_token.slice(0, 8)}••••••••</span></div>
            )}
          </div>
        </div>
      ))}

      <button
        onClick={() => setWizardOpen(true)}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-primary/40 rounded-xl py-3 text-sm text-primary font-semibold hover:bg-primary/5 transition-all"
      >
        <Plus className="h-4 w-4" /> Connect a POS System
      </button>

      <POSConnectionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        targetUserId={userId}
        callbackRedirect={ADMIN_CALLBACK}
        onSuccess={() => {
          setWizardOpen(false);
          onRefresh();
          toast({ title: 'POS Connected', description: 'The merchant\'s POS has been connected successfully.' });
        }}
      />
    </div>
  );
};

const MerchantDetailPanel = ({ listing, onAction, onEdit, readOnly = false }: { listing: any; onAction: (id: string, action: string) => void; onEdit: (l: any) => void; readOnly?: boolean }) => {
  const [activeTab, setActiveTab]         = useState('overview');
  const [profile, setProfile]             = useState<any>(null);
  const [credits, setCredits]             = useState<any>(null);
  const [posIntegrations, setPOS]         = useState<any[]>([]);
  const [transactions, setTxns]           = useState<any[]>([]);
  const [payReqs, setPayReqs]             = useState<any[]>([]);
  const [taxInfo, setTaxInfo]             = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineFetched, setTimelineFetched] = useState(false);

  useEffect(() => {
    if (!listing?.user_id) return;
    setLoading(true);
    setActiveTab('overview');
    setTimelineFetched(false);
    setTimelineEvents([]);
    const uid = listing.user_id;
    Promise.all([
      supabase.from('profiles').select('*').eq('user_id', uid).single(),
      supabase.from('user_credits').select('*').eq('user_id', uid).single(),
      supabase.from('pos_integrations').select('*').eq('user_id', uid),
      supabase.from('transactions').select('*').or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`).order('created_at', { ascending: false }).limit(50),
      supabase.from('payment_requests').select('*').or(`seller_id.eq.${uid},buyer_id.eq.${uid}`).order('created_at', { ascending: false }).limit(50),
      supabase.from('tax_info').select('*').eq('user_id', uid).single(),
    ]).then(([p, c, pos, tx, pr, tax]) => {
      setProfile(p.data);
      setCredits(c.data);
      setPOS(pos.data || []);
      setTxns(tx.data || []);
      setPayReqs(pr.data || []);
      setTaxInfo(tax.data);
      setLoading(false);
    });
  }, [listing?.id]);

  // Timeline — fetched lazily when tab is opened
  useEffect(() => {
    if (activeTab !== 'timeline' || timelineFetched || !listing?.user_id || loading) return;
    setTimelineLoading(true);
    const uid = listing.user_id;
    Promise.all([
      supabase.from('audit_logs').select('*').eq('record_id', uid).order('created_at', { ascending: false }).limit(100),
      supabase.from('disputes').select('*').or(`reporter_id.eq.${uid},reported_id.eq.${uid}`).order('created_at', { ascending: false }).limit(50),
      supabase.from('pos_transactions').select('id, created_at, total_amount, barter_amount, status').eq('merchant_id', uid).order('created_at', { ascending: false }).limit(50),
    ]).then(([auditRes, disputeRes, posRes]) => {
      const events: any[] = [];

      // Joined
      if (profile?.created_at) {
        events.push({
          id: 'joined', date: profile.created_at, type: 'joined',
          title: 'Joined platform',
          detail: profile.onboarding_completed ? 'Onboarding completed' : 'Account created',
        });
      }

      // Barter transactions
      transactions.slice(0, 30).forEach((t: any) => {
        const isFrom = t.from_user_id === uid;
        events.push({
          id: `tx-${t.id}`, date: t.created_at, type: 'transaction',
          title: isFrom ? `Sent ${t.points_amount ?? 0} pts` : `Received ${t.points_amount ?? 0} pts`,
          detail: t.service_description || t.transaction_type || 'Barter transaction',
          direction: isFrom ? 'out' : 'in',
        });
      });

      // POS transactions
      (posRes.data || []).forEach((t: any) => {
        events.push({
          id: `pos-${t.id}`, date: t.created_at, type: 'pos',
          title: `POS sale — $${Number(t.total_amount ?? 0).toFixed(2)}`,
          detail: `Barter: ${t.barter_amount ?? 0} pts · ${t.status}`,
        });
      });

      // Audit log events
      const actionMap: Record<string, { title: string; type: string }> = {
        credit_adjustment: { title: 'Balance adjusted',   type: 'adjustment'    },
        account_suspended: { title: 'Account suspended',  type: 'suspension'    },
        account_reinstated:{ title: 'Account reinstated', type: 'reinstatement' },
        listing_approve:   { title: 'Listing approved',   type: 'listing'       },
        listing_reject:    { title: 'Listing rejected',   type: 'listing'       },
        listing_suspend:   { title: 'Listing suspended',  type: 'listing'       },
        listing_edited:    { title: 'Listing edited',     type: 'listing'       },
        listing_remove:    { title: 'Listing removed',    type: 'listing'       },
        dispute_resolved:  { title: 'Dispute resolved',   type: 'dispute'       },
        dispute_updated:   { title: 'Dispute updated',    type: 'dispute'       },
      };
      (auditRes.data || []).forEach((a: any) => {
        const isWriteOff = a.reason === 'write_off';
        const mapped = actionMap[a.action];
        if (!mapped && !isWriteOff) return;
        events.push({
          id: `audit-${a.id}`, date: a.created_at,
          type:   isWriteOff ? 'writeoff' : mapped!.type,
          title:  isWriteOff ? 'Balance written off' : mapped!.title,
          detail: a.reason || (a.new_data as any)?.notes || (a.new_data as any)?.reason || '',
          section: a.section || '',
        });
      });

      // Disputes
      (disputeRes.data || []).forEach((d: any) => {
        const isReporter = d.reporter_id === uid;
        events.push({
          id: `dispute-${d.id}`, date: d.created_at, type: 'dispute',
          title:  isReporter ? 'Dispute opened' : 'Dispute received',
          detail: `${d.dispute_type || 'Dispute'} · ${d.status}`,
        });
      });

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimelineEvents(events);
      setTimelineLoading(false);
      setTimelineFetched(true);
    });
  }, [activeTab, listing?.user_id, timelineFetched, loading]);

  const tabs = ['overview', 'profile', 'pos', 'tax', 'timeline'];
  const tabLabel: Record<string, string> = { overview: 'Overview', profile: 'Profile', pos: 'POS', tax: 'Tax / W9', timeline: 'Timeline' };

  return (
    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-260px)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{listing.business_name}</h3>
          <p className="text-sm text-gray-500">{listing.owner || '—'} · {listing.category}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Pill status={listing.status || 'pending'} />
          {!readOnly && (
            <button onClick={() => onEdit(listing)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 text-gray-400 hover:text-indigo-600 transition-all">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!readOnly && (
        <div className="flex gap-2 flex-wrap">
          {listing.status !== 'active' && (
            <button onClick={() => onAction(listing.id, 'approve')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all">
              <CheckCircle className="h-3.5 w-3.5" />{listing.status === 'suspended' ? 'Re-activate' : 'Approve'}
            </button>
          )}
          {['active', 'pending'].includes(listing.status) && (
            <button onClick={() => onAction(listing.id, 'suspend')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold transition-all">
              <Pause className="h-3.5 w-3.5" />Suspend
            </button>
          )}
          {['pending', 'flagged'].includes(listing.status) && (
            <button onClick={() => onAction(listing.id, 'reject')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-all">
              <XCircle className="h-3.5 w-3.5" />Reject
            </button>
          )}
          {listing.status !== 'removed' && (
            <button onClick={() => onAction(listing.id, 'remove')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-all">
              <Trash2 className="h-3.5 w-3.5" />Remove
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading merchant data…
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Category',     value: listing.category || '—' },
                  { label: 'Barter %',     value: `${listing.barter_percentage ?? 0}%` },
                  { label: 'Location',     value: listing.location || '—' },
                  { label: 'Created',      value: new Date(listing.created_at).toLocaleDateString() },
                  { label: 'Barter Balance', value: credits ? `$${Number(credits.available_credits || 0).toFixed(2)}` : '—' },
                  { label: 'POS Connected', value: `${posIntegrations.length} system${posIntegrations.length !== 1 ? 's' : ''}` },
                  { label: 'Total Transactions', value: transactions.length },
                  { label: 'W9 Filed',     value: taxInfo ? 'Yes' : 'No' },
                ].map(f => (
                  <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                    <p className="text-sm font-semibold text-gray-900">{String(f.value)}</p>
                  </div>
                ))}
              </div>
              {listing.description && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-sm text-gray-700">{listing.description}</p>
                </div>
              )}
              {listing.services_offered?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Services Offered</p>
                  <div className="flex flex-wrap gap-1.5">
                    {listing.services_offered.map((s: string) => <span key={s} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PROFILE ── */}
          {activeTab === 'profile' && (
            <div className="space-y-3">
              {profile ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Full Name',      value: profile.full_name || '—' },
                    { label: 'Email',          value: profile.email || '—' },
                    { label: 'Phone',          value: profile.phone || '—' },
                    { label: 'Business Name',  value: profile.business_name || '—' },
                    { label: 'Business Type',  value: profile.business_type || '—' },
                    { label: 'Website',        value: profile.website || '—' },
                    { label: 'Barter %',       value: `${profile.barter_percentage ?? 0}%` },
                    { label: 'Onboarded',      value: profile.onboarding_completed ? 'Yes' : 'No' },
                    { label: 'POS PIN Set',    value: profile.pos_pin ? 'Yes' : 'No' },
                    { label: 'User ID',        value: profile.user_id?.slice(0, 12) + '…' },
                  ].map(f => (
                    <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                      <p className="text-sm font-semibold text-gray-900 break-all">{f.value}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400 py-6 text-center">No profile data found.</p>}
            </div>
          )}

          {/* ── POS INTEGRATIONS ── */}
          {activeTab === 'pos' && (
            <POSTab
              userId={listing.user_id}
              posIntegrations={posIntegrations}
              onRefresh={() => {
                supabase.from('pos_integrations').select('*').eq('user_id', listing.user_id)
                  .then(({ data }) => setPOS(data || []));
              }}
            />
          )}

          {/* ── TAX / W9 ── */}
          {activeTab === 'tax' && (
            <div className="space-y-3">
              {taxInfo ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Legal Name',       value: taxInfo.legal_name || '—' },
                    { label: 'Tax ID (SSN/EIN)', value: taxInfo.tax_id ? '••••••' + String(taxInfo.tax_id).slice(-4) : '—' },
                    { label: 'Business Type',    value: taxInfo.business_type || '—' },
                    { label: 'Address',          value: taxInfo.address || '—' },
                    { label: 'City',             value: taxInfo.city || '—' },
                    { label: 'State',            value: taxInfo.state || '—' },
                    { label: 'ZIP',              value: taxInfo.zip || '—' },
                    { label: 'Signature',        value: taxInfo.signature ? 'On file' : 'Missing' },
                    { label: 'Signed At',        value: taxInfo.signed_at ? new Date(taxInfo.signed_at).toLocaleDateString() : '—' },
                    { label: 'Exempt Code',      value: taxInfo.exempt_payee_code || '—' },
                  ].map(f => (
                    <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                      <p className="text-sm font-semibold text-gray-900">{f.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No W9 on file for this merchant</p>
                </div>
              )}
            </div>
          )}

          {/* ── TIMELINE ── */}
          {activeTab === 'timeline' && (
            <div className="space-y-1">
              {timelineLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" /> Building timeline…
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No history found for this merchant</p>
                </div>
              ) : (() => {
                const typeConfig: Record<string, { icon: any; dot: string; title: string }> = {
                  joined:        { icon: Users,        dot: 'bg-blue-400',    title: 'text-blue-700'    },
                  transaction:   { icon: ArrowUpRight, dot: 'bg-emerald-400', title: 'text-emerald-700' },
                  pos:           { icon: Zap,          dot: 'bg-indigo-400',  title: 'text-indigo-700'  },
                  adjustment:    { icon: DollarSign,   dot: 'bg-amber-400',   title: 'text-amber-700'   },
                  suspension:    { icon: Ban,          dot: 'bg-red-400',     title: 'text-red-700'     },
                  reinstatement: { icon: CheckCircle,  dot: 'bg-emerald-500', title: 'text-emerald-700' },
                  writeoff:      { icon: Trash2,       dot: 'bg-red-500',     title: 'text-red-700'     },
                  dispute:       { icon: Scale,        dot: 'bg-orange-400',  title: 'text-orange-700'  },
                  listing:       { icon: Store,        dot: 'bg-violet-400',  title: 'text-violet-700'  },
                };
                return (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
                    <div className="space-y-0">
                      {timelineEvents.map((event, idx) => {
                        const cfg = typeConfig[event.type] ?? { icon: Clock, dot: 'bg-gray-400', title: 'text-gray-700' };
                        const Icon = cfg.icon;
                        return (
                          <div key={event.id ?? idx} className="relative flex gap-3 pb-4">
                            {/* Dot */}
                            <div className={`relative z-10 h-7 w-7 rounded-full ${cfg.dot} flex items-center justify-center shrink-0 shadow-sm`}>
                              <Icon className="h-3.5 w-3.5 text-white" />
                            </div>
                            {/* Content */}
                            <div className="flex-1 pt-0.5 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-xs font-semibold ${cfg.title} leading-tight`}>{event.title}</p>
                                <p className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                                  {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                              {event.detail && (
                                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{event.detail}</p>
                              )}
                              {event.section && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{event.section}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MerchantDetailPanel;
