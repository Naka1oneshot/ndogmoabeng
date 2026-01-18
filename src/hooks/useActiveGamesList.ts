import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveGame {
  id: string;
  name: string;
  mode: string;
  selected_game_type_code: string | null;
  join_code: string;
  playerCount: number;
  status: string;
}

export function useActiveGamesList() {
  const [games, setGames] = useState<ActiveGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Fetch active games
        const { data: activeGames, error: gamesError } = await supabase
          .from('games')
          .select('id, name, mode, selected_game_type_code, join_code, status')
          .in('status', ['LOBBY', 'IN_GAME', 'RUNNING'])
          .eq('winner_declared', false)
          .order('created_at', { ascending: false })
          .limit(10);

        if (gamesError) throw gamesError;

        if (!activeGames || activeGames.length === 0) {
          setGames([]);
          setLoading(false);
          return;
        }

        // Fetch player counts for each game
        const gamesWithCounts = await Promise.all(
          activeGames.map(async (game) => {
            const { count } = await supabase
              .from('game_players')
              .select('*', { count: 'exact', head: true })
              .eq('game_id', game.id)
              .is('removed_at', null);

            return {
              ...game,
              playerCount: count || 0,
            };
          })
        );

        setGames(gamesWithCounts);
      } catch (error) {
        console.error('Error fetching active games:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();

    // Realtime subscription
    const channel = supabase
      .channel('active-games-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => fetchGames()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players' },
        () => fetchGames()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { games, loading };
}
