import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ReferralRow {
  id: string;
  referred_id: string;
  referral_code: string;
  status: 'pending' | 'completed';
  points_awarded: number;
  created_at: string;
  completed_at: string | null;
  referred_full_name: string | null;
  referred_email: string | null;
}

export interface ReferralStats {
  total: number;
  completed: number;
  pending: number;
  totalEarned: number;
  successRate: string;
}

export const useReferrals = () => {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats>({
    total: 0, completed: 0, pending: 0, totalEarned: 0, successRate: '0%',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch user's referral code
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.referral_code) setReferralCode(profile.referral_code);

    // Fetch referrals
    const { data: rows } = await supabase
      .from('referrals')
      .select('id, referred_id, referral_code, status, points_awarded, created_at, completed_at')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    if (rows && rows.length > 0) {
      // Fetch referred users' profiles separately
      const referredIds = rows.map(r => r.referred_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', referredIds);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

      const mapped: ReferralRow[] = rows.map(r => ({
        ...r,
        referred_full_name: profileMap[r.referred_id]?.full_name ?? null,
        referred_email: profileMap[r.referred_id]?.email ?? null,
      }));

      setReferrals(mapped);

      const completed = mapped.filter(r => r.status === 'completed').length;
      const pending = mapped.filter(r => r.status === 'pending').length;
      const totalEarned = mapped.reduce((sum, r) => sum + r.points_awarded, 0);
      const successRate = mapped.length > 0
        ? Math.round((completed / mapped.length) * 100) + '%'
        : '0%';

      setStats({ total: mapped.length, completed, pending, totalEarned, successRate });
    }

    setLoading(false);
  };

  return { referrals, referralCode, stats, loading, refetch: fetchData };
};
