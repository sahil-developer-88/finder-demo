import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface UseHasRoleReturn {
  hasRole: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if user has a specific role
 * @param role - The role to check ('admin', 'merchant', 'customer', 'staff')
 * @returns Object with hasRole boolean, loading state, and error
 *
 * Example:
 * const { hasRole: isAdmin } = useHasRole('admin');
 * const { hasRole: isMerchant } = useHasRole('merchant');
 */
export const useHasRole = (role: 'admin' | 'merchant' | 'customer' | 'staff'): UseHasRoleReturn => {
  const { user } = useAuth();
  const [hasRole, setHasRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setHasRole(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (role === 'admin') {
          // Use app_metadata.role (set server-side only, users cannot modify it)
          // Falls back to checking admin_users table
          const appRole = user.app_metadata?.role;
          if (appRole === 'admin') {
            setHasRole(true);
          } else {
            const { data } = await supabase
              .from('admin_users')
              .select('user_id')
              .eq('user_id', user.id)
              .maybeSingle();
            setHasRole(!!data);
          }
        } else if (role === 'merchant') {
          // All authenticated users can be merchants
          setHasRole(true);
        } else if (role === 'customer') {
          setHasRole(true);
        } else {
          setHasRole(false);
        }
      } catch (err: any) {
        console.error(`Error checking role "${role}":`, err);
        setError(err.message);
        setHasRole(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [user, role]);

  return { hasRole, loading, error };
};
