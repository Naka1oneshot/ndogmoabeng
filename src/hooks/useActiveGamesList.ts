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
  is_public: boolean;
  current_step_index: number;
  adventure_id: string | null;
}

export function useActiveGamesList() {
  const [games, setGames] = useState<ActiveGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Fetch all active games (public and private)
        const { data, error: gamesError } = await supabase
          .from('games')
          .select('*')
          .in('status', ['LOBBY', 'IN_GAME', 'RUNNING'])
          .eq('winner_declared', false)
          .order('created_at', { ascending: false })
          .limit(20);

        if (gamesError) throw gamesError;

        const activeGames = data || [];

        if (activeGames.length === 0) {
          setGames([]);
          setLoading(false);
          return;
        }

        // Fetch player counts for each game
        const gamesWithCounts = await Promise.all(
          activeGames.slice(0, 10).map(async (game) => {
            const { count } = await supabase
              .from('game_players')
              .select('*', { count: 'exact', head: true })
              .eq('game_id', game.id)
              .eq('is_host', false)
              .is('removed_at', null);

            return {
              id: game.id,
              name: game.name,
              mode: game.mode,
              selected_game_type_code: game.selected_game_type_code,
              join_code: game.join_code,
              status: game.status,
              is_public: (game as any).is_public || false,
              playerCount: count || 0,
              current_step_index: game.current_step_index || 0,
              adventure_id: game.adventure_id || null,
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
