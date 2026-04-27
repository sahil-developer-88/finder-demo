import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError, getProviderDisplayName } from '@/utils/errorMessages';

interface ProductSyncResult {
  success: boolean;
  message?: string;
  synced?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
}

export interface SyncProgress {
  id: string;
  pos_integration_id: string;
  user_id: string;
  total_items: number;
  processed_items: number;
  synced_items: number;
  skipped_items: number;
  error_items: number;
  current_item_name?: string;
  current_step?: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  error?: string;
}

/**
 * Hook to sync products from a POS integration
 *
 * Usage:
 * ```tsx
 * const { syncProducts, isSyncing } = useProductSync();
 *
 * const handleSync = async () => {
 *   const result = await syncProducts(posIntegrationId);
 *   if (result.success) {
 *     console.log(`Synced ${result.synced} products!`);
 *   }
 * };
 * ```
 */
export function useProductSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const { toast} = useToast();

  /**
   * Subscribe to real-time sync progress updates
   */
  const subscribeToProgress = useCallback((integrationId: string) => {
    const channel = supabase
      .channel('sync-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_sync_progress',
          filter: `pos_integration_id=eq.${integrationId}`
        },
        (payload) => {
          const newData = payload.new as SyncProgress;
          setProgress(newData);

          // Auto-clear progress after completion
          if (newData?.status === 'completed' || newData?.status === 'failed') {
            setTimeout(() => setProgress(null), 5000); // Clear after 5 seconds
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const syncProducts = async (posIntegrationId: string): Promise<ProductSyncResult> => {
    setIsSyncing(true);

    try {
      // Get current session to verify auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const friendlyError = getUserFriendlyError({
          error: 'Not authenticated',
          context: 'sync'
        });
        toast({
          title: friendlyError.title,
          description: friendlyError.description,
          variant: friendlyError.variant
        });
        return {
          success: false,
          error: 'Not authenticated'
        };
      }

      // Fetch integration to get provider name for better error messages
      const { data: integration } = await supabase
        .from('pos_integrations')
        .select('provider')
        .eq('id', posIntegrationId)
        .single();

      const providerName = integration?.provider;

      const { data, error } = await supabase.functions.invoke('pos-product-sync', {
        body: { pos_integration_id: posIntegrationId }
      });

      if (error) {
        let errorMessage = 'Failed to sync products';

        // FunctionsHttpError carries the response body in error.context
        // Try to extract the actual error message from the response body
        try {
          if (error.context && typeof error.context.json === 'function') {
            const body = await error.context.json();
              errorMessage = body.error || body.message || errorMessage;
            if (body.details) errorMessage += ` - ${body.details}`;
          } else if (data && typeof data === 'object') {
            errorMessage = data.error || data.message || errorMessage;
            if (data.details) errorMessage += ` - ${data.details}`;
          } else if (error.message) {
            errorMessage = error.message;
          }
        } catch {
          errorMessage = error.message || errorMessage;
        }

        // Convert to user-friendly error
        const friendlyError = getUserFriendlyError({
          error: errorMessage,
          context: 'sync',
          provider: getProviderDisplayName(providerName)
        });

        toast({
          title: friendlyError.title,
          description: friendlyError.description,
          variant: friendlyError.variant
        });

        return {
          success: false,
          error: errorMessage
        };
      }

      if (data.success) {
        toast({
          title: 'Products Synced',
          description: `Successfully synced ${data.synced || 0} products${data.skipped ? ` (${data.skipped} skipped)` : ''}`,
        });
      } else {
        toast({
          title: 'Sync Warning',
          description: data.error || 'Some products could not be synced',
          variant: 'destructive'
        });
      }

      return data;

    } catch (error: any) {
      const friendlyError = getUserFriendlyError({
        error: error,
        context: 'sync'
      });

      toast({
        title: friendlyError.title,
        description: friendlyError.description,
        variant: friendlyError.variant
      });

      return {
        success: false,
        error: error.message
      };
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncProducts,
    isSyncing,
    progress,
    subscribeToProgress
  };
}
