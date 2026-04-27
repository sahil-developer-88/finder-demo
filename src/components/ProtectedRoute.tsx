
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHasRole } from '@/hooks/useHasRole';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  blockAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly, blockAdmin }) => {
  const { user, loading: authLoading, onboardingCompleted } = useAuth();
  const { hasRole: isAdmin, loading: adminLoading } = useHasRole('admin');
  const location = useLocation();

  const isOnboardingRoute = location.pathname === '/onboarding';

  // Wait for auth + onboarding status to resolve
  if (authLoading || adminLoading || (user && onboardingCompleted === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Not logged in — send to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin-only route — non-admins go to dashboard
  if (adminOnly && !isAdmin) {
    return <Navigate to="/account-dashboard" replace />;
  }

  // Block admins from merchant/user-only routes — redirect to admin panel
  if (blockAdmin && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Admins bypass onboarding requirement
  if (isAdmin) {
    return <>{children}</>;
  }

  // User hasn't completed onboarding — force them to /onboarding
  if (onboardingCompleted === false && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
