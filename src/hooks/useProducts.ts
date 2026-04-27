import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

// Use the view type directly to avoid type mismatches
type ProductsWithEligibilityView = Tables<'products_with_eligibility'>;

interface ProductWithEligibility extends ProductsWithEligibilityView {
  // Additional fields are already part of the view
}

/**
 * Hook to fetch products for the current merchant
 *
 * Features:
 * - Real-time updates when products change
 * - Filtered by merchant
 * - Includes barter eligibility info
 * - Sorted by most recently synced
 */
export function useProducts(posIntegrationId?: string) {
  const queryClient = useQueryClient();

  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ['products', posIntegrationId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('products_with_eligibility')
        .select('*')
        .eq('merchant_id', user.id)
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('last_synced_at', { ascending: false });

      // Filter by POS integration if specified
      if (posIntegrationId) {
        query = query.eq('pos_integration_id', posIntegrationId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      return data as ProductWithEligibility[];
    },
    staleTime: 30000 // Consider data fresh for 30 seconds
  });

  // Set up real-time subscription for product and category updates
  const subscribeToProducts = () => {
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          // Refetch products when any product changes
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'product_categories'
        },
        () => {
          // Refetch products when categories change (affects eligibility)
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    products: products || [],
    isLoading,
    error,
    refetch,
    subscribeToProducts
  };
}
