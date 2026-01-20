import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Component that handles session expiration detection and redirect.
 * Must be rendered inside BrowserRouter and AuthProvider.
 */
export function SessionExpirationHandler() {
  const { sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (sessionExpired && location.pathname !== '/auth' && location.pathname !== '/login') {
      toast.error('Votre session a expiré. Veuillez vous reconnecter.', {
        duration: 5000,
      });
      clearSessionExpired();
      navigate('/auth', { 
        state: { 
          from: location.pathname,
          sessionExpired: true 
        },
        replace: true 
      });
    }
  }, [sessionExpired, navigate, location.pathname, clearSessionExpired]);

  return null;
}
