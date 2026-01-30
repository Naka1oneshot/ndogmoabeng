import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useComingSoon() {
  const [isComingSoonEnabled, setIsComingSoonEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchComingSoonStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'coming_soon_enabled')
        .maybeSingle();

      if (error) {
        console.error('Error fetching coming soon status:', error);
        setIsComingSoonEnabled(false);
        return;
      }

      // Value is stored as JSON boolean
      setIsComingSoonEnabled(data?.value === true);
    } catch (err) {
      console.error('Error fetching coming soon status:', err);
      setIsComingSoonEnabled(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComingSoonStatus();

    // Subscribe to changes
    const channel = supabase
      .channel('coming-soon-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.coming_soon_enabled',
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'value' in payload.new) {
            setIsComingSoonEnabled(payload.new.value === true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchComingSoonStatus]);

  const toggleComingSoon = async (enabled: boolean): Promise<{ error?: Error }> => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'coming_soon_enabled',
          value: enabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (error) throw error;
      
      setIsComingSoonEnabled(enabled);
      return {};
    } catch (err) {
      console.error('Error toggling coming soon mode:', err);
      return { error: err instanceof Error ? err : new Error('Unknown error') };
    }
  };

  return {
    isComingSoonEnabled,
    loading,
    toggleComingSoon,
    refetch: fetchComingSoonStatus,
  };
}
