import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Star, Loader2, CheckCircle, PenLine, AlertCircle, Search, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useReviews } from "@/hooks/useReviews";

const StarRow = ({ rating, interactive = false, onSelect, size = 5 }: {
  rating: number; interactive?: boolean; onSelect?: (r: number) => void; size?: number;
}) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(s => (
      <button key={s} type="button" disabled={!interactive}
        onClick={() => interactive && onSelect?.(s)}
        className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}>
        <Star className={`h-${size} w-${size} transition-colors ${s <= rating ? 'fill-emerald-500 text-emerald-500' : 'text-gray-200'}`} />
      </button>
    ))}
  </div>
);

type Business = { id: string; business_name: string; user_id: string; email?: string };

const WriteReviewSection = ({ onBusinessSelected, resetTrigger }: { onBusinessSelected: (b: Business) => void; resetTrigger: number }) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    if (resetTrigger > 0) { setSearch(''); setBusinesses([]); }
  }, [resetTrigger]);

  const searchBusinesses = async (query: string) => {
    setSearch(query);
    if (!query.trim()) { setBusinesses([]); return; }
    setSearching(true);

    const { data: byName } = await supabase.from('businesses').select('id, business_name, user_id')
      .ilike('business_name', `%${query}%`).neq('user_id', user?.id ?? '').limit(6);

    const { data: profilesByEmail } = await supabase.from('profiles').select('user_id')
      .ilike('email', `%${query}%`).neq('user_id', user?.id ?? '').limit(6);

    let byEmail: Business[] = [];
    if (profilesByEmail && profilesByEmail.length > 0) {
      const uids = profilesByEmail.map(p => p.user_id);
      const { data } = await supabase.from('businesses').select('id, business_name, user_id').in('user_id', uids);
      byEmail = data ?? [];
    }

    const all = [...(byName ?? []), ...byEmail];
    const seen = new Set<string>();
    const merged = all.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true; }).slice(0, 6);

    const uids = merged.map(b => b.user_id);
    const { data: profiles } = await supabase.from('profiles').select('user_id, email').in('user_id', uids);
    const emailMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.email]));

    setBusinesses(merged.map(b => ({ ...b, email: emailMap[b.user_id] ?? undefined })));
    setSearching(false);
  };

  const selectBusiness = (b: Business) => { setSearch(b.business_name); setBusinesses([]); onBusinessSelected(b); };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
      <Input value={search} onChange={e => searchBusinesses(e.target.value)}
        placeholder="Search business to review..."
        className="pl-9 h-10 bg-gray-50 border-gray-200 text-sm" />
      {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-500 z-10" />}
      {businesses.length > 0 && (
        <div className="absolute z-20 top-full mt-1.5 w-full bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
          {businesses.map(b => (
            <button key={b.id} type="button" onClick={() => selectBusiness(b)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors">
              <p className="text-sm font-semibold text-gray-900">{b.business_name}</p>
              {b.email && <p className="text-xs text-emerald-600 mt-0.5">{b.email}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ReviewForm = ({ business, onSubmitted, onCancel }: {
  business: Business; onSubmitted: () => void; onCancel: () => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [noTradeError, setNoTradeError] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [ownerDetails, setOwnerDetails] = useState<{ business_type: string | null; location: string | null; full_name: string | null } | null>(null);
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  useEffect(() => {
    supabase.from('profiles')
      .select('business_type, location, full_name')
      .eq('user_id', business.user_id)
      .maybeSingle()
      .then(({ data }) => setOwnerDetails(data));
  }, [business.user_id]);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true); setNoTradeError(false); setAlreadyReviewed(false);

    const { data: existing } = await supabase.from('reviews').select('id')
      .eq('reviewer_id', user.id).eq('reviewee_id', business.user_id).maybeSingle();
    if (existing) { setAlreadyReviewed(true); setSubmitting(false); return; }

    // Check all trade types between the two users
    const [
      { data: tradeRow },
      { data: payReqRow },
      { data: scanRow },
    ] = await Promise.all([
      // Direct credit transfers & barter transactions
      supabase.from('transactions').select('id')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${business.user_id}),and(from_user_id.eq.${business.user_id},to_user_id.eq.${user.id})`)
        .eq('status', 'completed').limit(1).maybeSingle(),
      // Payment requests (credit sends via payment request flow)
      supabase.from('payment_requests').select('id')
        .or(`and(seller_id.eq.${business.user_id},buyer_id.eq.${user.id}),and(seller_id.eq.${user.id},buyer_id.eq.${business.user_id})`)
        .eq('status', 'paid').limit(1).maybeSingle(),
      // POS barcode scans (product businesses)
      supabase.from('pos_barcode_scans').select('id')
        .or(`and(customer_id.eq.${user.id},merchant_id.eq.${business.user_id}),and(customer_id.eq.${business.user_id},merchant_id.eq.${user.id})`)
        .eq('status', 'completed').limit(1).maybeSingle(),
    ]);

    const hasDeal = !!(tradeRow || payReqRow || scanRow);

    if (!hasDeal) { setNoTradeError(true); setSubmitting(false); return; }

    const { error } = await supabase.from('reviews').insert({
      reviewer_id: user.id, reviewee_id: business.user_id,
      rating, comment: comment || null, service_name: business.business_name,
    });

    setSubmitting(false);
    if (error) { toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Review submitted!', description: 'Thank you for your feedback.' });
    onSubmitted();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-3">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + info */}
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-base font-bold shrink-0">
              {business.business_name[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{business.business_name}</p>
              {ownerDetails?.full_name && (
                <p className="text-xs text-gray-500">{ownerDetails.full_name}</p>
              )}
              {business.email && (
                <p className="text-xs text-indigo-500">{business.email}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {ownerDetails?.location && (
                  <span className="text-xs text-gray-400">📍 {ownerDetails.location}</span>
                )}
                {ownerDetails?.business_type && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    ownerDetails.business_type === 'product'
                      ? 'bg-violet-100 text-violet-600'
                      : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {ownerDetails.business_type === 'product' ? 'Product' : 'Service'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0">Cancel</button>
        </div>
      </div>
      <div className="px-5 py-5 space-y-4">
        {noTradeError ? (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">No transaction found</p>
              <p className="text-xs text-amber-600 mt-0.5">You haven't completed a transaction with <strong>{business.business_name}</strong>.</p>
            </div>
          </div>
        ) : alreadyReviewed ? (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <CheckCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Already reviewed</p>
              <p className="text-xs text-blue-600 mt-0.5">You already submitted a review for <strong>{business.business_name}</strong>.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 py-2">
              <StarRow rating={rating} interactive onSelect={setRating} size={9} />
              <span className="text-sm font-semibold text-gray-500">{rating > 0 ? labels[rating] : 'Tap a star to rate'}</span>
            </div>
            <Textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Share your experience with this business..."
              rows={3} className="text-sm resize-none border-gray-200 rounded-xl" />
            <Button onClick={handleSubmit} disabled={rating === 0 || submitting}
              className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const ReviewSystem = () => {
  const { received, loading, averageRating, refetch } = useReviews();
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);

  const handleDismiss = () => { setSelectedBusiness(null); setResetTrigger(t => t + 1); };

  const distribution = [5, 4, 3, 2, 1].map(star => ({
    star, count: received.filter(r => r.rating === star).length,
  }));
  const maxCount = Math.max(...distribution.map(d => d.count), 1);
  const barColors = ['bg-emerald-500', 'bg-emerald-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-400'];

  const filtered = filter ? received.filter(r => r.rating === filter) : received;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

      {/* ── Left panel — rating summary ── */}
      <div className="lg:col-span-2 space-y-4">

        {/* Overview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6">
          <h2 className="text-xl font-black text-gray-900 mb-4">Reviews and ratings</h2>

          {/* Big number */}
          <div className="flex items-center gap-4 mb-1">
            <span className="text-5xl font-black text-gray-900 leading-none">
              {averageRating > 0 ? averageRating.toFixed(1) : '—'}
            </span>
            <StarRow rating={Math.round(averageRating)} size={6} />
          </div>
          <p className="text-sm text-gray-400 mb-6">Based on {received.length} rating{received.length !== 1 ? 's' : ''}</p>

          {/* Distribution bars */}
          <div className="space-y-3">
            {distribution.map(({ star, count }, i) => (
              <button key={star} onClick={() => setFilter(filter === star ? null : star)}
                className={`w-full flex items-center gap-3 group transition-opacity ${filter && filter !== star ? 'opacity-40' : ''}`}>
                <span className="text-sm font-semibold text-gray-600 w-6 text-right">{star}</span>
                <Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500 shrink-0" />
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${barColors[i]} rounded-full transition-all duration-500`}
                    style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="text-sm font-semibold text-gray-500 w-6 text-left">{count}</span>
              </button>
            ))}
          </div>

          {filter && (
            <button onClick={() => setFilter(null)}
              className="mt-4 text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1">
              Clear filter ×
            </button>
          )}
        </div>

        {/* Write a review */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <PenLine className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-bold text-gray-800">Write a Review</span>
          </div>
          <WriteReviewSection onBusinessSelected={setSelectedBusiness} resetTrigger={resetTrigger} />
          {selectedBusiness && (
            <ReviewForm business={selectedBusiness}
              onSubmitted={() => { handleDismiss(); refetch(); }}
              onCancel={handleDismiss} />
          )}
        </div>
      </div>

      {/* ── Right panel — reviews list ── */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-gray-900">Reviews</span>
              <span className="text-sm font-semibold text-gray-400">{received.length}</span>
            </div>
            <div className="flex items-center gap-2">
              {[5,4,3,2,1].map(s => (
                <button key={s} onClick={() => setFilter(filter === s ? null : s)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    filter === s
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {s}<Star className="h-3 w-3 fill-current" />
                </button>
              ))}
            </div>
          </div>

          {/* Reviews */}
          {filtered.length === 0 ? (
            <div className="text-center py-14 px-6">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
                <Star className="h-5 w-5 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-600">No reviews yet</p>
              <p className="text-xs text-gray-400 mt-1">Complete trades to start earning feedback</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(r => (
                <div key={r.id} className="px-5 py-5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {(r.reviewer_name?.[0] ?? r.reviewer_email?.[0] ?? '?').toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + date */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {r.reviewer_name ?? 'Anonymous'}
                          </p>
                          {r.reviewer_email && (
                            <p className="text-xs text-gray-400">{r.reviewer_email}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      {/* Business info */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {r.reviewer_business_name && (
                          <span className="text-xs font-semibold text-indigo-600">{r.reviewer_business_name}</span>
                        )}
                        {r.reviewer_location && (
                          <span className="text-xs text-gray-400">· {r.reviewer_location}</span>
                        )}
                        {r.reviewer_business_type && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            r.reviewer_business_type === 'product'
                              ? 'bg-violet-100 text-violet-600'
                              : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {r.reviewer_business_type === 'product' ? 'Product' : 'Service'}
                          </span>
                        )}
                      </div>

                      {/* Stars */}
                      <div className="flex gap-0.5 mt-2">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`h-4 w-4 ${s <= r.rating ? 'fill-emerald-500 text-emerald-500' : 'text-gray-200'}`} />
                        ))}
                      </div>

                      {/* Title + comment */}
                      {r.service_name && (
                        <p className="text-sm font-bold text-gray-900 mt-1.5">{r.service_name}</p>
                      )}
                      {r.comment && (
                        <p className="text-sm text-gray-500 leading-relaxed mt-1">{r.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ReviewSystem;
