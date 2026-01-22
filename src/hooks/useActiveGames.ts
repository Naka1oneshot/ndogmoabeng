import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveGamesStats {
  gamesCount: number;
  playersCount: number;
  loading: boolean;
}

// Throttle updates to prevent excessive re-renders
const THROTTLE_MS = 5000;

export function useActiveGames(refreshInterval = 30000): ActiveGamesStats {
  const [stats, setStats] = useState<ActiveGamesStats>({
    gamesCount: 0,
    playersCount: 0,
    loading: true,
  });
  
  const lastFetchRef = useRef<number>(0);
  const pendingFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async (force = false) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;

    // Throttle fetches unless forced
    if (!force && timeSinceLastFetch < THROTTLE_MS) {
      if (!pendingFetchRef.current) {
        pendingFetchRef.current = setTimeout(() => {
          pendingFetchRef.current = null;
          if (mountedRef.current) fetchStats(true);
        }, THROTTLE_MS - timeSinceLastFetch);
      }
      return;
    }

    lastFetchRef.current = now;

    try {
      // Single optimized query using the RPC function
      const { data, error } = await supabase
        .rpc('public_list_live_games');

      if (error) throw error;
      if (!mountedRef.current) return;

      const gamesCount = data?.length || 0;
      const playersCount = data?.reduce((sum: number, game: { player_count: number }) => 
        sum + (Number(game.player_count) || 0), 0) || 0;

      setStats({
        gamesCount,
        playersCount,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching active games stats:', error);
      if (mountedRef.current) {
        setStats(prev => ({ ...prev, loading: false }));
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStats(true);

    // Set up interval for periodic refresh (less frequent)
    const interval = setInterval(() => fetchStats(true), refreshInterval);

    // Realtime subscription with throttled updates
    const channel = supabase
      .channel('active-games-stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      if (pendingFetchRef.current) {
        clearTimeout(pendingFetchRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [refreshInterval, fetchStats]);

  return useMemo(() => stats, [stats]);
}
