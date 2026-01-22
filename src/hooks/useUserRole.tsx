import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'super_admin' | 'admin' | 'user';

interface UserRoleState {
  role: AppRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isAdminOrSuper: boolean;
  loading: boolean;
}

export function useUserRole(): UserRoleState {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole(null);
        } else {
          setRole(data?.role as AppRole ?? null);
        }
      } catch (err) {
        console.error('Error fetching role:', err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin';
  const isAdminOrSuper = isSuperAdmin || isAdmin;

  return {
    role,
    isSuperAdmin,
    isAdmin,
    isAdminOrSuper,
    loading
  };
}
