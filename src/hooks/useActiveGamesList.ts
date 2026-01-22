import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// Throttle updates to prevent excessive re-renders
const THROTTLE_MS = 2000;

export function useActiveGamesList() {
  const [games, setGames] = useState<ActiveGame[]>([]);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef<number>(0);
  const pendingFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchGames = useCallback(async (force = false) => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;

    // Throttle fetches unless forced
    if (!force && timeSinceLastFetch < THROTTLE_MS) {
      // Schedule a fetch for later if not already pending
      if (!pendingFetchRef.current) {
        pendingFetchRef.current = setTimeout(() => {
          pendingFetchRef.current = null;
          if (mountedRef.current) fetchGames(true);
        }, THROTTLE_MS - timeSinceLastFetch);
      }
      return;
    }

    lastFetchRef.current = now;

    try {
      // Use RPC function for better performance
      const { data, error } = await supabase
        .rpc('public_list_live_games');

      if (error) throw error;

      if (!mountedRef.current) return;

      const mappedGames: ActiveGame[] = (data || []).map((game: {
        game_id: string;
        name: string;
        mode: string;
        selected_game_type_code: string | null;
        status: string;
        current_step_index: number;
        player_count: number;
      }) => ({
        id: game.game_id,
        name: game.name,
        mode: game.mode,
        selected_game_type_code: game.selected_game_type_code,
        join_code: '', // Not exposed in public function
        playerCount: Number(game.player_count) || 0,
        status: game.status,
        is_public: true, // Only public games are listed
        current_step_index: game.current_step_index || 0,
        adventure_id: null,
      }));

      setGames(mappedGames);
    } catch (error) {
      console.error('Error fetching active games:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchGames(true);

    // Realtime subscription with throttled updates
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
      mountedRef.current = false;
      if (pendingFetchRef.current) {
        clearTimeout(pendingFetchRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchGames]);

  // Memoize return value
  return useMemo(() => ({ games, loading }), [games, loading]);
}
