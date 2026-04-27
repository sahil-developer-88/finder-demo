import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  service_name: string | null;
  created_at: string;
  reviewer_name: string | null;
}

interface Props {
  businessUserId: string; // user_id of the business owner
  businessName: string;
}

const StarRow = ({ rating, interactive = false, onSelect }: {
  rating: number;
  interactive?: boolean;
  onSelect?: (r: number) => void;
}) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(s => (
      <button
        key={s}
        type="button"
        disabled={!interactive}
        onClick={() => interactive && onSelect?.(s)}
        className={interactive ? 'cursor-pointer' : 'cursor-default'}
      >
        <Star className={`h-4 w-4 transition-colors ${s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
      </button>
    ))}
  </div>
);

const BusinessReviewSection = ({ businessUserId, businessName }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checking, setChecking] = useState(false);
  const [noTradeError, setNoTradeError] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  // form state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [businessUserId]);

  const fetchReviews = async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('reviews')
      .select('id, rating, comment, service_name, created_at, reviewer_id')
      .eq('reviewee_id', businessUserId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!rows || rows.length === 0) { setReviews([]); setLoading(false); return; }

    const reviewerIds = [...new Set(rows.map(r => r.reviewer_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', reviewerIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

    setReviews(rows.map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      service_name: r.service_name,
      created_at: r.created_at,
      reviewer_name: profileMap[r.reviewer_id]?.full_name ?? null,
    })));
    setLoading(false);
  };

  const handleLeaveReviewClick = async () => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to leave a review.', variant: 'destructive' });
      return;
    }

    // Can't review your own business
    if (user.id === businessUserId) {
      toast({ title: "You can't review your own business.", variant: 'destructive' });
      return;
    }

    setChecking(true);
    setNoTradeError(false);
    setAlreadyReviewed(false);

    // Check if already reviewed
    const { data: existingReview } = await supabase
      .from('reviews')
      .select('id')
      .eq('reviewer_id', user.id)
      .eq('reviewee_id', businessUserId)
      .maybeSingle();

    if (existingReview) {
      setAlreadyReviewed(true);
      setChecking(false);
      setShowForm(true);
      return;
    }

    // Check for a completed transaction between the two users
    const { data: trade } = await supabase
      .from('transactions')
      .select('id')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${businessUserId}),and(from_user_id.eq.${businessUserId},to_user_id.eq.${user.id})`)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle();

    setChecking(false);

    if (!trade) {
      setNoTradeError(true);
      setShowForm(true);
      return;
    }

    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (rating === 0 || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        reviewer_id: user.id,
        reviewee_id: businessUserId,
        rating,
        comment: comment || null,
        service_name: businessName,
      });
      if (error) throw error;
      toast({ title: 'Review submitted!', description: 'Thank you for your feedback.' });
      setShowForm(false);
      setRating(0);
      setComment('');
      fetchReviews();
    } catch (err: any) {
      toast({ title: 'Failed to submit', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Reviews</h3>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <StarRow rating={Math.round(avgRating)} />
              <span className="text-sm text-gray-500">{avgRating.toFixed(1)} ({reviews.length})</span>
            </div>
          )}
        </div>
        {!showForm && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleLeaveReviewClick}
            disabled={checking}
            className="text-xs"
          >
            {checking ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Leave a Review
          </Button>
        )}
      </div>

      {/* Review form / error */}
      {showForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
          {noTradeError ? (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>There is no completed trade between you and this business, so you can't leave a review.</span>
            </div>
          ) : alreadyReviewed ? (
            <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>You have already reviewed this business.</span>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">Your Review</p>
              <StarRow rating={rating} interactive onSelect={setRating} />
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={rating === 0 || submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                  {submitting ? 'Submitting...' : 'Submit'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setNoTradeError(false); }}>
                  Cancel
                </Button>
              </div>
            </>
          )}
          {(noTradeError || alreadyReviewed) && (
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setShowForm(false); setNoTradeError(false); setAlreadyReviewed(false); }}>
              Close
            </Button>
          )}
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="border-b pb-3 last:border-b-0">
              <div className="flex items-center gap-2 mb-1">
                <StarRow rating={r.rating} />
                <span className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
              <p className="text-xs text-gray-500 mt-1">— {r.reviewer_name ?? 'Anonymous'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BusinessReviewSection;
