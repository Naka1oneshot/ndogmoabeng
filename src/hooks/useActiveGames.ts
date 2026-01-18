import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveGamesStats {
  gamesCount: number;
  playersCount: number;
  loading: boolean;
}

export function useActiveGames(refreshInterval = 10000): ActiveGamesStats {
  const [stats, setStats] = useState<ActiveGamesStats>({
    gamesCount: 0,
    playersCount: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Count active games (LOBBY or IN_GAME status, not ended)
        const { count: gamesCount, error: gamesError } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .in('status', ['LOBBY', 'IN_GAME', 'RUNNING'])
          .eq('winner_declared', false);

        if (gamesError) throw gamesError;

        // Get active game IDs
        const { data: activeGames, error: activeError } = await supabase
          .from('games')
          .select('id')
          .in('status', ['LOBBY', 'IN_GAME', 'RUNNING'])
          .eq('winner_declared', false);

        if (activeError) throw activeError;

        let playersCount = 0;
        if (activeGames && activeGames.length > 0) {
          const gameIds = activeGames.map(g => g.id);
          const { count, error: playersError } = await supabase
            .from('game_players')
            .select('*', { count: 'exact', head: true })
            .in('game_id', gameIds)
            .is('removed_at', null);

          if (!playersError) {
            playersCount = count || 0;
          }
        }

        setStats({
          gamesCount: gamesCount || 0,
          playersCount,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching active games stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();

    // Set up interval for periodic refresh
    const interval = setInterval(fetchStats, refreshInterval);

    // Set up realtime subscription for immediate updates
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
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [refreshInterval]);

  return stats;
}
