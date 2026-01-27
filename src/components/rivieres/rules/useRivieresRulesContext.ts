import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RivieresRulesContextData {
  // Game state
  manche: number;
  niveau: number;
  cagnotte: number;
  dangerRaw: number | null;
  dangerEffectif: number | null;
  
  // Player stats
  totalPlayers: number;
  playersEnBateau: number;
  
  // Demo mode
  isDemo: boolean;
}

const DEMO_DATA: RivieresRulesContextData = {
  manche: 2,
  niveau: 3,
  cagnotte: 420,
  dangerRaw: 35,
  dangerEffectif: 32,
  totalPlayers: 8,
  playersEnBateau: 5,
  isDemo: true,
};

export function useRivieresRulesContext(
  gameId?: string,
  sessionGameId?: string
): RivieresRulesContextData {
  const [contextData, setContextData] = useState<RivieresRulesContextData>(DEMO_DATA);

  useEffect(() => {
    if (!gameId || !sessionGameId) {
      setContextData(DEMO_DATA);
      return;
    }

    const fetchContext = async () => {
      try {
        // Fetch session state
        const { data: stateData } = await supabase
          .from('river_session_state')
          .select('manche_active, niveau_active, cagnotte_manche, danger_raw, danger_effectif')
          .eq('session_game_id', sessionGameId)
          .maybeSingle();

        // Fetch total players
        const { count: totalCount } = await supabase
          .from('game_players')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', gameId)
          .eq('status', 'ACTIVE')
          .eq('is_host', false);

        // Fetch players en bateau
        const { count: enBateauCount } = await supabase
          .from('river_player_stats')
          .select('*', { count: 'exact', head: true })
          .eq('session_game_id', sessionGameId)
          .eq('current_round_status', 'EN_BATEAU');

        if (stateData) {
          setContextData({
            manche: stateData.manche_active || 1,
            niveau: stateData.niveau_active || 1,
            cagnotte: stateData.cagnotte_manche || 0,
            dangerRaw: stateData.danger_raw,
            dangerEffectif: stateData.danger_effectif,
            totalPlayers: totalCount || 0,
            playersEnBateau: enBateauCount || 0,
            isDemo: false,
          });
        } else {
          // Fallback to demo with real player count if available
          setContextData({
            ...DEMO_DATA,
            totalPlayers: totalCount || DEMO_DATA.totalPlayers,
            isDemo: true,
          });
        }
      } catch (error) {
        console.error('Error fetching rules context:', error);
        setContextData(DEMO_DATA);
      }
    };

    fetchContext();
  }, [gameId, sessionGameId]);

  return contextData;
}

// Helper to compute payout per player (same logic as game)
export function computePayoutPerPlayer(pot: number, nbRestants: number): number {
  if (nbRestants <= 0) return 0;
  return Math.floor(pot / nbRestants);
}

// Level bonus (100 tokens per survivor at level 5)
export function computeLevelBonus(niveau: number, survived: boolean): number {
  if (niveau === 5 && survived) return 100;
  return 0;
}
