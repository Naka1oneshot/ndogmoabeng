import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ForetRulesContextData {
  gameId: string | null;
  sessionGameId: string | null;
  mancheActive: number;
  phase: string;
  isDemo: boolean;
  playerCount: number;
  monstersOnField: number;
  monstersInQueue: number;
}

export function useForetRulesContext(
  gameId?: string,
  sessionGameId?: string
): ForetRulesContextData {
  const [contextData, setContextData] = useState<ForetRulesContextData>({
    gameId: gameId || null,
    sessionGameId: sessionGameId || null,
    mancheActive: 1,
    phase: 'ENCHERES',
    isDemo: !gameId,
    playerCount: 6,
    monstersOnField: 3,
    monstersInQueue: 4,
  });

  useEffect(() => {
    if (!gameId) {
      // Demo mode - use default values
      setContextData(prev => ({
        ...prev,
        isDemo: true,
      }));
      return;
    }

    const fetchContext = async () => {
      // Fetch game data
      const { data: game } = await supabase
        .from('games')
        .select('manche_active, phase, current_session_game_id')
        .eq('id', gameId)
        .single();

      // Fetch player count
      const { count: playerCount } = await supabase
        .from('game_players')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .eq('is_host', false)
        .is('removed_at', null);

      // Fetch monster counts if session game exists
      let monstersOnField = 3;
      let monstersInQueue = 4;
      
      const effectiveSessionId = sessionGameId || game?.current_session_game_id;
      if (effectiveSessionId) {
        const { count: onField } = await supabase
          .from('game_state_monsters')
          .select('*', { count: 'exact', head: true })
          .eq('session_game_id', effectiveSessionId)
          .eq('status', 'EN_BATAILLE');

        const { count: inQueue } = await supabase
          .from('game_state_monsters')
          .select('*', { count: 'exact', head: true })
          .eq('session_game_id', effectiveSessionId)
          .eq('status', 'EN_FILE');

        if (onField !== null) monstersOnField = onField;
        if (inQueue !== null) monstersInQueue = inQueue;
      }

      setContextData({
        gameId,
        sessionGameId: effectiveSessionId || null,
        mancheActive: game?.manche_active || 1,
        phase: game?.phase || 'ENCHERES',
        isDemo: false,
        playerCount: playerCount || 6,
        monstersOnField,
        monstersInQueue,
      });
    };

    fetchContext();
  }, [gameId, sessionGameId]);

  return contextData;
}
