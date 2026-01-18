import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SessionGame {
  id: string;
  game_type_code: string;
  step_index: number;
  manche_active: number;
  phase: string | null;
  status: string;
}

interface UseSessionGameResult {
  sessionGame: SessionGame | null;
  sessionGameId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and subscribe to the current session_game for a given game/session.
 * This is part of the multi-game adventure architecture.
 */
export function useSessionGame(gameId: string | undefined, currentSessionGameId: string | null | undefined): UseSessionGameResult {
  const [sessionGame, setSessionGame] = useState<SessionGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    const fetchSessionGame = async () => {
      // If we have a direct session_game_id, use it
      if (currentSessionGameId) {
        const { data, error: fetchError } = await supabase
          .from('session_games')
          .select('id, game_type_code, step_index, manche_active, phase, status')
          .eq('id', currentSessionGameId)
          .single();

        if (fetchError) {
          console.error('[useSessionGame] Error fetching session_game:', fetchError);
          setError(fetchError.message);
        } else if (data) {
          setSessionGame(data);
        }
        setLoading(false);
        return;
      }

      // Fallback: get current_session_game_id from games table
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('current_session_game_id')
        .eq('id', gameId)
        .single();

      if (gameError) {
        console.error('[useSessionGame] Error fetching game:', gameError);
        setError(gameError.message);
        setLoading(false);
        return;
      }

      if (gameData?.current_session_game_id) {
        const { data, error: fetchError } = await supabase
          .from('session_games')
          .select('id, game_type_code, step_index, manche_active, phase, status')
          .eq('id', gameData.current_session_game_id)
          .single();

        if (fetchError) {
          console.error('[useSessionGame] Error fetching session_game:', fetchError);
          setError(fetchError.message);
        } else if (data) {
          setSessionGame(data);
        }
      }

      setLoading(false);
    };

    fetchSessionGame();

    // Subscribe to session_games updates if we have a session_game_id
    const sessionId = currentSessionGameId;
    if (sessionId) {
      const channel = supabase
        .channel(`session-game-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'session_games',
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            setSessionGame(prev => prev ? { ...prev, ...payload.new } : null);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [gameId, currentSessionGameId]);

  return {
    sessionGame,
    sessionGameId: sessionGame?.id || currentSessionGameId || null,
    loading,
    error,
  };
}
