import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle, CheckCircle, Clock, Flag, Loader2,
  RefreshCw, ArrowUpRight, ChevronDown, ChevronUp, Paperclip,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type Dispute = {
  id: string;
  transaction_id: string | null;
  reporter_id: string;
  reported_id: string;
  status: string;
  dispute_type: string;
  description: string;
  admin_notes: string | null;
  arbitration_outcome: string | null;
  partial_refund_amount: number | null;
  resolved_at: string | null;
  created_at: string;
};

type Evidence = {
  id: string;
  dispute_id: string;
  uploaded_by: string;
  file_url: string;
  file_name: string;
  file_type: string;
  uploaded_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  open:         'bg-red-100 text-red-700',
  under_review: 'bg-amber-100 text-amber-700',
  resolved:     'bg-emerald-100 text-emerald-700',
  escalated:    'bg-purple-100 text-purple-700',
};

const OUTCOME_LABEL: Record<string, string> = {
  reporter_wins: 'Reporter Wins',
  reported_wins: 'Reported Wins',
  split:         'Split',
  dismissed:     'Dismissed',
};

const MerchantDisputesTab = () => {
  const { user } = useAuth();
  const [disputes,  setDisputes]  = useState<Dispute[]>([]);
  const [evidence,  setEvidence]  = useState<Evidence[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  // Evidence upload state per dispute
  const [uploadUrl,      setUploadUrl]      = useState('');
  const [uploadName,     setUploadName]     = useState('');
  const [uploadType,     setUploadType]     = useState('');
  const [uploading,      setUploading]      = useState(false);
  const [uploadMsg,      setUploadMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: dData }, { data: eData }] = await Promise.all([
        supabase
          .from('disputes')
          .select('*')
          .or(`reporter_id.eq.${user.id},reported_id.eq.${user.id}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('dispute_evidence')
          .select('*')
          .order('uploaded_at', { ascending: false }),
      ]);
      setDisputes((dData as Dispute[]) || []);
      setEvidence((eData as Evidence[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [user]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev === id ? null : id);
    setUploadUrl('');
    setUploadName('');
    setUploadType('');
    setUploadMsg(null);
  };

  const handleUploadEvidence = async (disputeId: string) => {
    if (!uploadUrl.trim() || !uploadName.trim()) return;
    setUploading(true);
    setUploadMsg(null);
    const { error } = await supabase.from('dispute_evidence').insert({
      dispute_id:  disputeId,
      uploaded_by: user!.id,
      file_url:    uploadUrl.trim(),
      file_name:   uploadName.trim(),
      file_type:   uploadType.trim() || 'link',
    });
    if (error) {
      setUploadMsg({ ok: false, text: error.message });
    } else {
      setUploadMsg({ ok: true, text: 'Evidence submitted.' });
      setUploadUrl('');
      setUploadName('');
      setUploadType('');
      fetchAll();
    }
    setUploading(false);
  };

  const open         = disputes.filter(d => d.status === 'open').length;
  const underReview  = disputes.filter(d => d.status === 'under_review').length;
  const resolved     = disputes.filter(d => d.status === 'resolved').length;
  const escalated    = disputes.filter(d => d.status === 'escalated').length;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Disputes</h2>
          <p className="text-sm text-gray-500 mt-0.5">View disputes you filed or that were filed against you</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Flag,          label: 'Open',         value: open,        color: 'red'     },
          { icon: Clock,         label: 'Under Review', value: underReview, color: 'amber'   },
          { icon: CheckCircle,   label: 'Resolved',     value: resolved,    color: 'emerald' },
          { icon: AlertTriangle, label: 'Escalated',    value: escalated,   color: 'purple'  },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 text-${color}-500`} />
              <span className={`text-xs font-medium text-${color}-700`}>{label}</span>
            </div>
            <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Disputes list */}
      {disputes.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-sm text-gray-400">
            No disputes on your account.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {disputes.map(d => {
            const isExpanded    = expanded === d.id;
            const myRole        = d.reporter_id === user?.id ? 'Filed by you' : 'Filed against you';
            const dispEvidence  = evidence.filter(e => e.dispute_id === d.id);
            const canUpload     = d.status === 'open' || d.status === 'under_review';

            return (
              <Card key={d.id} className="border-0 shadow-sm overflow-hidden">
                {/* Row header */}
                <button
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(d.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[d.status] || 'bg-gray-100 text-gray-600'}`}>
                        {d.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                        {d.dispute_type.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${d.reporter_id === user?.id ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                        {myRole}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1.5 truncate">{d.description || '—'}</p>
                  </div>
                  <div className="text-right shrink-0 mr-2">
                    <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</p>
                    {d.arbitration_outcome && (
                      <p className="text-xs font-medium text-emerald-600 mt-0.5">{OUTCOME_LABEL[d.arbitration_outcome] ?? d.arbitration_outcome}</p>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t bg-gray-50/60 px-5 py-4 space-y-4">
                    {/* Details grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Filed</p>
                        <p className="font-medium text-gray-800">{new Date(d.created_at).toLocaleDateString()}</p>
                      </div>
                      {d.resolved_at && (
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Resolved</p>
                          <p className="font-medium text-gray-800">{new Date(d.resolved_at).toLocaleDateString()}</p>
                        </div>
                      )}
                      {d.arbitration_outcome && (
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Outcome</p>
                          <p className="font-medium text-emerald-700">{OUTCOME_LABEL[d.arbitration_outcome] ?? d.arbitration_outcome}</p>
                        </div>
                      )}
                      {d.partial_refund_amount != null && (
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Refund Amount</p>
                          <p className="font-medium text-gray-800">{d.partial_refund_amount} pts</p>
                        </div>
                      )}
                    </div>

                    {/* Full description */}
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Description</p>
                      <p className="text-sm text-gray-700 bg-white border rounded-lg px-3 py-2">{d.description || '—'}</p>
                    </div>

                    {/* Admin notes (read-only) */}
                    {d.admin_notes && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Admin Notes</p>
                        <p className="text-sm text-gray-700 bg-white border rounded-lg px-3 py-2">{d.admin_notes}</p>
                      </div>
                    )}

                    {/* Evidence */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">Evidence ({dispEvidence.length})</p>
                      {dispEvidence.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                          {dispEvidence.map(ev => (
                            <div key={ev.id} className="flex items-center gap-3 bg-white border rounded-lg px-3 py-2">
                              <Paperclip className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{ev.file_name}</p>
                                <p className="text-xs text-gray-400">{ev.file_type} · {new Date(ev.uploaded_at).toLocaleDateString()}</p>
                              </div>
                              <a
                                href={ev.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0"
                              >
                                <ArrowUpRight className="h-3.5 w-3.5" /> View
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mb-3">No evidence uploaded yet.</p>
                      )}

                      {/* Upload evidence */}
                      {canUpload && (
                        <div className="bg-white border rounded-lg p-3 space-y-2">
                          <p className="text-xs font-medium text-gray-600">Submit Evidence (link)</p>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <Input
                              placeholder="File name (e.g. receipt.pdf)"
                              value={uploadName}
                              onChange={e => setUploadName(e.target.value)}
                              className="text-xs h-8"
                            />
                            <Input
                              placeholder="File type (e.g. PDF, Image)"
                              value={uploadType}
                              onChange={e => setUploadType(e.target.value)}
                              className="text-xs h-8"
                            />
                            <Input
                              placeholder="URL (Google Drive, Dropbox, etc.)"
                              value={uploadUrl}
                              onChange={e => setUploadUrl(e.target.value)}
                              className="text-xs h-8 md:col-span-1"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              disabled={uploading || !uploadUrl.trim() || !uploadName.trim()}
                              onClick={() => handleUploadEvidence(d.id)}
                            >
                              {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                              Submit
                            </Button>
                            {uploadMsg && (
                              <span className={`text-xs ${uploadMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                                {uploadMsg.text}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {!canUpload && (
                        <p className="text-xs text-gray-400 italic">Evidence submission is closed — dispute is {d.status}.</p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MerchantDisputesTab;
