import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Coins, Check, X, Clock, ArrowUpRight, ArrowDownLeft, Loader2, Star } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

type Tab = 'received' | 'sent';

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  accepted:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-600',
  completed: 'bg-violet-100 text-violet-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pending',
  accepted:  'Accepted',
  rejected:  'Declined',
  completed: 'Completed',
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-500'}`}>
    {STATUS_LABEL[status] ?? status}
  </span>
);

// ── Review Modal ──────────────────────────────────────────────
function ReviewModal({ trade, onClose, onSubmit }: {
  trade: any;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}) {
  const [rating, setRating]         = useState(0);
  const [comment, setComment]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await onSubmit(rating, comment);
    setRating(0);
    setComment('');
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Rate Your Trade 🎉</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Summary card */}
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-2">
              <span className="text-xl font-bold text-violet-600">
                {(trade?.other_name || '?')[0].toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-0.5">Trade with</p>
            <p className="text-base font-bold text-gray-900">{trade?.other_name || 'Unknown'}</p>
            {trade?.service_name && (
              <span className="inline-block mt-2 text-xs font-semibold text-violet-600 bg-violet-50 px-3 py-1 rounded-full">
                {trade.service_name}
              </span>
            )}
          </div>

          {/* Stars */}
          <div>
            <p className="text-sm font-semibold text-gray-700 text-center mb-3">How was your experience?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-9 w-9 transition-colors ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm text-gray-500 mt-2 font-medium">{labels[rating]}</p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Leave a review <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              placeholder="Share your experience..."
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className="flex-2 flex-1 py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </span>
              ) : 'Submit Review'}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">Your review helps build community trust</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const TradeRequestsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { user } = useAuth();
  const [tab, setTab]               = useState<Tab>('received');
  const [received, setReceived]     = useState<any[]>([]);
  const [sent, setSent]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [reviewTrade, setReviewTrade] = useState<any>(null);

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: recv, error: e1 }, { data: snt, error: e2 }] = await Promise.all([
      supabase.from('trade_requests').select('*').eq('merchant_id', user.id).order('created_at', { ascending: false }),
      supabase.from('trade_requests').select('*').eq('sender_id',   user.id).order('created_at', { ascending: false }),
    ]);

    if (e1) console.error('recv error', e1);
    if (e2) console.error('sent error', e2);

    const enrichWithName = async (rows: any[], idField: string) => {
      if (!rows?.length) return rows ?? [];
      const ids = rows.map(r => r[idField]);
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, full_name, business_name').in('user_id', ids);
      const map = new Map(profiles?.map(p => [p.user_id, p]) ?? []);
      return rows.map(r => ({
        ...r,
        other_name: map.get(r[idField])?.business_name || map.get(r[idField])?.full_name || 'Unknown',
      }));
    };

    const [recvEnriched, sntEnriched] = await Promise.all([
      enrichWithName(recv ?? [], 'sender_id'),
      enrichWithName(snt  ?? [], 'merchant_id'),
    ]);

    setReceived(recvEnriched);
    setSent(sntEnriched);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchRequests();
    const channel = supabase
      .channel(`trade_requests_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_requests', filter: `merchant_id=eq.${user.id}` }, fetchRequests)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_requests', filter: `sender_id=eq.${user.id}` },   fetchRequests)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleResponse = async (id: string, accepted: boolean) => {
    setResponding(id);
    await supabase.from('trade_requests').update({ status: accepted ? 'accepted' : 'rejected' }).eq('id', id);
    await fetchRequests();
    setResponding(null);
  };

  const handleMarkComplete = (item: any) => {
    setReviewTrade(item);
    supabase.from('trade_requests')
      .update({ status: 'completed' })
      .eq('id', item.id)
      .then(() => {
        fetchRequests();
        // Award referral points to both participants if either was referred — RPC is a no-op if no pending referral exists
        if (item.merchant_id) supabase.rpc('award_referral_points', { p_referred_user_id: item.merchant_id }).catch(() => {});
        if (item.sender_id)   supabase.rpc('award_referral_points', { p_referred_user_id: item.sender_id  }).catch(() => {});
      });
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!reviewTrade || !user) return;
    const revieweeId = tab === 'received' ? reviewTrade.sender_id : reviewTrade.merchant_id;
    await supabase.from('reviews').insert({
      reviewer_id:  user.id,
      reviewee_id:  revieweeId,
      rating,
      comment:      comment.trim() || null,
      service_name: reviewTrade.service_name || null,
    });
    setReviewTrade(null);
    fetchRequests();
  };

  const list = tab === 'received' ? received : sent;

  return (
    <>
      {reviewTrade && (
        <ReviewModal
          trade={reviewTrade}
          onClose={() => setReviewTrade(null)}
          onSubmit={handleSubmitReview}
        />
      )}

      <div className={embedded ? '' : 'min-h-screen bg-gray-50'}>
        <div className={embedded ? '' : 'max-w-2xl mx-auto px-4 py-6'}>

          {!embedded && <div className="mb-4"><BackButton /></div>}

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Coins className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Trade Requests</h1>
              <p className="text-sm text-gray-500">Manage all your incoming and outgoing trade requests</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            {(['received', 'sent'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border transition-all ${
                  tab === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {t === 'received' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                {t === 'received' ? `Received (${received.length})` : `Sent (${sent.length})`}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mb-3">
                <Coins className="h-8 w-8 text-violet-300" />
              </div>
              <p className="font-semibold text-gray-500">No {tab} requests yet</p>
              <p className="text-sm text-gray-400 mt-1">
                {tab === 'received' ? 'Trade requests from customers will appear here' : 'Requests you send to merchants will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map(req => (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                        <Coins className="h-5 w-5 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{req.service_name || '—'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {tab === 'received' ? `From: ${req.other_name}` : `To: ${req.other_name}`}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Barter breakdown + date */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                    {req.barter_percentage != null && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Coins className="h-3.5 w-3.5 text-emerald-500" />
                        {req.barter_percentage}% Credits + {100 - req.barter_percentage}% Cash
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {format(new Date(req.created_at), 'MMM d, yyyy · h:mm a')}
                    </div>
                  </div>

                  {/* Accept / Decline — received + pending */}
                  {tab === 'received' && req.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleResponse(req.id, true)}
                        disabled={responding === req.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
                      >
                        {responding === req.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Check className="h-4 w-4" />}
                        Accept
                      </button>
                      <button
                        onClick={() => handleResponse(req.id, false)}
                        disabled={responding === req.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-colors disabled:opacity-60"
                      >
                        <X className="h-4 w-4" /> Decline
                      </button>
                    </div>
                  )}

                  {/* Mark Complete — accepted */}
                  {req.status === 'accepted' && (
                    <button
                      onClick={() => handleMarkComplete(req)}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors"
                    >
                      <Check className="h-4 w-4" />
                      Mark Complete &amp; Review
                    </button>
                  )}

                  {/* Completed banner */}
                  {req.status === 'completed' && (
                    <div className="mt-3 py-2 rounded-xl bg-violet-50 text-center">
                      <span className="text-sm font-bold text-violet-600">✓ Trade Completed</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TradeRequestsPage;
