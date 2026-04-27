import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ReviewRow {
  id: string;
  reviewer_id: string;
  reviewee_id: string;
  transaction_id: string | null;
  rating: number;
  comment: string | null;
  service_name: string | null;
  created_at: string;
  reviewer_name: string | null;
  reviewer_email: string | null;
  reviewer_business_name: string | null;
  reviewer_location: string | null;
  reviewer_business_type: string | null;
}

export interface PendingReview {
  transaction_id: string;
  service_description: string | null;
  other_user_id: string;
  other_user_name: string | null;
  completed_at: string;
}

export const useReviews = () => {
  const { user } = useAuth();
  const [received, setReceived] = useState<ReviewRow[]>([]);
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    await Promise.all([fetchReceived(), fetchPending()]);
    setLoading(false);
  };

  const fetchReceived = async () => {
    if (!user) return;

    const { data: rows } = await supabase
      .from('reviews')
      .select('id, reviewer_id, reviewee_id, transaction_id, rating, comment, service_name, created_at')
      .eq('reviewee_id', user.id)
      .order('created_at', { ascending: false });

    if (!rows || rows.length === 0) { setReceived([]); return; }

    const reviewerIds = [...new Set(rows.map(r => r.reviewer_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, business_name, location, business_type')
      .in('user_id', reviewerIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

    setReceived(rows.map(r => ({
      ...r,
      reviewer_name: profileMap[r.reviewer_id]?.full_name ?? null,
      reviewer_email: profileMap[r.reviewer_id]?.email ?? null,
      reviewer_business_name: profileMap[r.reviewer_id]?.business_name ?? null,
      reviewer_location: profileMap[r.reviewer_id]?.location ?? null,
      reviewer_business_type: profileMap[r.reviewer_id]?.business_type ?? null,
    })));
  };

  const fetchPending = async () => {
    if (!user) return;

    // Completed transactions involving the user where they haven't reviewed yet
    const { data: txns } = await supabase
      .from('transactions')
      .select('id, from_user_id, to_user_id, service_description, updated_at')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false });

    if (!txns || txns.length === 0) { setPending([]); return; }

    // Get already-reviewed transaction ids by this user
    const txnIds = txns.map(t => t.id);
    const { data: myReviews } = await supabase
      .from('reviews')
      .select('transaction_id')
      .eq('reviewer_id', user.id)
      .in('transaction_id', txnIds);

    const reviewedTxnIds = new Set((myReviews || []).map(r => r.transaction_id));

    const unreviewed = txns.filter(t => !reviewedTxnIds.has(t.id));
    if (unreviewed.length === 0) { setPending([]); return; }

    const otherUserIds = unreviewed.map(t =>
      t.from_user_id === user.id ? t.to_user_id : t.from_user_id
    );
    const uniqueOtherIds = [...new Set(otherUserIds)];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', uniqueOtherIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

    setPending(unreviewed.map(t => {
      const otherId = t.from_user_id === user.id ? t.to_user_id : t.from_user_id;
      return {
        transaction_id: t.id,
        service_description: t.service_description,
        other_user_id: otherId,
        other_user_name: profileMap[otherId]?.full_name ?? null,
        completed_at: t.updated_at,
      };
    }));
  };

  const submitReview = async (params: {
    reviewee_id: string;
    transaction_id: string;
    rating: number;
    comment: string;
    service_name: string;
  }) => {
    if (!user) return false;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        reviewer_id: user.id,
        reviewee_id: params.reviewee_id,
        transaction_id: params.transaction_id,
        rating: params.rating,
        comment: params.comment || null,
        service_name: params.service_name || null,
      });
      if (error) throw error;
      await fetchData();
      return true;
    } catch (err) {
      console.error('submitReview error:', err);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = received.length > 0
    ? received.reduce((sum, r) => sum + r.rating, 0) / received.length
    : 0;

  return { received, pending, loading, submitting, averageRating, submitReview, refetch: fetchData };
};
