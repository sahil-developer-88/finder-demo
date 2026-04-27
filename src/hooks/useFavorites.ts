import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useFavorites = () => {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchFavorites();
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Step 1: get favorite business IDs
      const { data: favData } = await supabase
        .from('favorites')
        .select('business_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const ids = new Set((favData || []).map((f: any) => f.business_id));
      setFavoriteIds(ids);

      if (ids.size === 0) { setFavorites([]); return; }

      // Step 2: fetch those businesses
      const { data: bizData } = await supabase
        .from('businesses')
        .select('id, business_name, category, description, services_offered, barter_percentage, location, contact_method, status')
        .in('id', Array.from(ids))
        .eq('status', 'active');

      setFavorites(
        (bizData || []).map((b: any) => ({
          id:               b.id,
          businessName:     b.business_name,
          category:         b.category,
          servicesOffered:  b.services_offered || [],
          wantingInReturn:  [],
          estimatedValue:   0,
          location:         b.location || '',
          contactMethod:    b.contact_method || '',
          rating:           4.5,
          reviews:          0,
          verified:         false,
          points:           0,
          image:            '/placeholder.svg',
          description:      b.description || '',
          barterPercentage: Number(b.barter_percentage) || 20,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (businessId: string) => {
    if (!user) return;
    const isFav = favoriteIds.has(businessId);

    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev);
      isFav ? next.delete(businessId) : next.add(businessId);
      return next;
    });

    if (isFav) {
      await supabase.from('favorites').delete()
        .eq('user_id', user.id).eq('business_id', businessId);
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, business_id: businessId });
    }

    fetchFavorites();
  };

  const isFavorite = (businessId: string) => favoriteIds.has(businessId);

  return { favorites, favoriteIds, loading, toggleFavorite, isFavorite };
};
