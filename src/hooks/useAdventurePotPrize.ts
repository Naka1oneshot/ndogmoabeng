import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdventurePotPrizeResult {
  /** Current pot amount in € (if available) */
  potAmount: number | null;
  /** Whether this is the final game of the adventure */
  isFinalGame: boolean;
  /** Whether the data is still loading */
  loading: boolean;
}

/**
 * Hook to fetch adventure pot prize for the final game of an adventure.
 * Only returns a pot amount if:
 * - The game is in ADVENTURE mode
 * - The current session_game is the last step of the adventure
 * - adventure_pot.currentAmount is configured and > 0
 * 
 * @param gameId - The main game ID
 * @param sessionGameId - The current session game ID (optional, for direct check)
 */
export function useAdventurePotPrize(
  gameId: string | undefined,
  sessionGameId?: string | null
): AdventurePotPrizeResult {
  const [potAmount, setPotAmount] = useState<number | null>(null);
  const [isFinalGame, setIsFinalGame] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Check if game is in ADVENTURE mode
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('mode, current_session_game_id')
          .eq('id', gameId)
          .single();

        if (gameError || !gameData || gameData.mode !== 'ADVENTURE') {
          setLoading(false);
          return;
        }

        // 2. Get all session_games for this adventure, ordered by step_index DESC
        const { data: sessionGames, error: sgError } = await supabase
          .from('session_games')
          .select('id, step_index, game_type_code, status')
          .eq('session_id', gameId)
          .order('step_index', { ascending: false });

        if (sgError || !sessionGames || sessionGames.length === 0) {
          setLoading(false);
          return;
        }

        // The last session_game is the one with highest step_index
        const lastSessionGame = sessionGames[0];
        
        // Determine which session_game we're checking against
        const currentSessionId = sessionGameId || gameData.current_session_game_id;
        
        // Check if the current session game is the final one
        const isLast = currentSessionId === lastSessionGame.id;

        if (!isLast) {
          setIsFinalGame(false);
          setPotAmount(null);
          setLoading(false);
          return;
        }

        setIsFinalGame(true);

        // 3. Fetch adventure_game_configs for the pot amount
        const { data: configData, error: configError } = await supabase
          .from('adventure_game_configs')
          .select('config')
          .eq('game_id', gameId)
          .single();

        if (configError || !configData) {
          setLoading(false);
          return;
        }

        // Extract pot amount from config
        const config = configData.config as Record<string, unknown> | null;
        const adventurePot = config?.adventure_pot as { currentAmount?: number; initialAmount?: number } | undefined;
        const currentAmount = adventurePot?.currentAmount;

        if (typeof currentAmount === 'number' && currentAmount > 0) {
          setPotAmount(currentAmount);
        } else {
          setPotAmount(null);
        }

        setLoading(false);
      } catch (error) {
        console.error('[useAdventurePotPrize] Error:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [gameId, sessionGameId]);

  return { potAmount, isFinalGame, loading };
}
