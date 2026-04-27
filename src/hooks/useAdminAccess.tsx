/*
 * DEPRECATED: This hook has been replaced by useHasRole
 *
 * OLD IMPLEMENTATION (Kept for reference):
 * Use useHasRole('admin') instead
 */

/*
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AdminAccess {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

export const useAdminAccess = (): AdminAccess => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // TODO: admin_users table doesn't exist yet - defaulting to non-admin
        // This feature needs the admin_users table migration to be implemented
        setIsAdmin(false);
      } catch (err: any) {
        console.error('Error checking admin access:', err);
        setError(err.message);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [user]);

  return { isAdmin, loading, error };
};
*/

// NEW IMPLEMENTATION: Use useHasRole instead
// import { useHasRole } from '@/hooks/useHasRole';
// const { hasRole: isAdmin } = useHasRole('admin');
