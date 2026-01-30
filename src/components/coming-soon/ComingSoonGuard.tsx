import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useComingSoon } from '@/hooks/useComingSoon';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { LoadingFallback } from '@/components/common/LoadingFallback';

interface ComingSoonGuardProps {
  children: ReactNode;
}

export function ComingSoonGuard({ children }: ComingSoonGuardProps) {
  const location = useLocation();
  const { isComingSoonEnabled, loading: comingSoonLoading } = useComingSoon();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();

  // Don't guard the coming-soon page itself
  if (location.pathname === '/coming-soon') {
    return <>{children}</>;
  }

  // Show loading while checking status
  if (comingSoonLoading || authLoading || (user && roleLoading)) {
    return <LoadingFallback message="Vérification..." />;
  }

  // If coming soon is enabled
  if (isComingSoonEnabled) {
    // Super admins can bypass
    if (user && isSuperAdmin) {
      return <>{children}</>;
    }
    
    // Everyone else gets redirected
    return <Navigate to="/coming-soon" replace />;
  }

  // Coming soon is disabled, render normally
  return <>{children}</>;
}
