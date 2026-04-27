import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { enrichBusinessType } from '@/utils/transformBusiness';

export const useRecommendations = (excludeUserId?: string) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchRecommendations();
  }, [user]);

  const fetchRecommendations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Step 1: get categories from user's favorites
      const { data: favData } = await supabase
        .from('favorites')
        .select('business_id')
        .eq('user_id', user.id)
        .limit(20);

      let categories: string[] = [];

      if (favData && favData.length > 0) {
        const favIds = favData.map((f: any) => f.business_id);
        const { data: favBiz } = await supabase
          .from('businesses')
          .select('category')
          .in('id', favIds);
        categories = [...new Set((favBiz || []).map((b: any) => b.category).filter(Boolean))];
      }

      // Step 2: fallback to user's own business category
      if (categories.length === 0) {
        const { data: profile } = await supabase
          .from('businesses')
          .select('category')
          .eq('user_id', user.id)
          .single();
        if (profile?.category) categories = [profile.category];
      }

      if (categories.length === 0) { setRecommendations([]); return; }

      // Step 3: fetch businesses in those categories (exclude own)
      const { data } = await supabase
        .from('businesses')
        .select('id, user_id, business_name, category, description, services_offered, barter_percentage, location, contact_method, status')
        .in('category', categories)
        .neq('user_id', user.id)
        .eq('status', 'active')
        .order('barter_percentage', { ascending: false })
        .limit(10);

      const enriched = await enrichBusinessType(data || []);
      setRecommendations(enriched);
    } finally {
      setLoading(false);
    }
  };

  return { recommendations, loading };
};
