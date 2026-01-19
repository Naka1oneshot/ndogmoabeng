import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveGame {
  game_id: string;
  name: string;
  status: string;
  phase: string;
  manche_active: number | null;
  mode: string;
  selected_game_type_code: string | null;
  current_session_game_id: string | null;
  current_step_index: number;
  game_type_name: string;
  player_count: number;
  updated_at: string;
}

export function useWatchGames(searchName: string = '') {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      const { data, error: rpcError } = await supabase
        .rpc('public_list_live_games');

      if (rpcError) throw rpcError;

      let filteredGames = (data || []) as LiveGame[];
      
      // Filter by name if search is provided
      if (searchName.trim()) {
        const search = searchName.toLowerCase().trim();
        filteredGames = filteredGames.filter(game => 
          game.name.toLowerCase().includes(search)
        );
      }

      setGames(filteredGames);
      setError(null);
    } catch (err) {
      console.error('Error fetching live games:', err);
      setError('Impossible de charger les parties');
    } finally {
      setLoading(false);
    }
  }, [searchName]);

  useEffect(() => {
    fetchGames();

    // Realtime subscription for games changes
    const channel = supabase
      .channel('watch-games-list')
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
  }, [fetchGames]);

  return { games, loading, error, refetch: fetchGames };
}
