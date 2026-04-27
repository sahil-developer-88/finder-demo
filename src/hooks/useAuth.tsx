
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  onboardingCompleted: boolean | null; // null = still loading
  refreshOnboardingStatus: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  onboardingCompleted: null,
  refreshOnboardingStatus: async () => {},
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  const fetchOnboardingStatus = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('user_id', userId)
      .maybeSingle();
    setOnboardingCompleted(data?.onboarding_completed ?? false);
  }, []);

  const refreshOnboardingStatus = useCallback(async () => {
    if (user) await fetchOnboardingStatus(user.id);
  }, [user, fetchOnboardingStatus]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // TOKEN_REFRESHED just updates the token — don't re-render the whole app
        if (event === 'TOKEN_REFRESHED') {
          setSession(session);
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (user?.id) {
            localStorage.removeItem(`barterex_onboarding_backup_${user.id}`);
          }
          setOnboardingCompleted(null);
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          fetchOnboardingStatus(session.user.id);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          fetchOnboardingStatus(session.user.id);
        }
      })
      .catch((err) => {
        console.error('Failed to get session:', err);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      // Always clear state and stored session regardless of API result
      if (user?.id) {
        localStorage.removeItem(`barterex_onboarding_backup_${user.id}`);
      }
      // Remove all Supabase session keys from localStorage
      Object.keys(localStorage)
        .filter(key => key.startsWith('sb-'))
        .forEach(key => localStorage.removeItem(key));
      setUser(null);
      setSession(null);
      setOnboardingCompleted(null);
      // Force redirect to auth — full reload ensures no stale state remains
      window.location.href = '/auth';
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, onboardingCompleted, refreshOnboardingStatus, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
