import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SheriffBotConfig, DEFAULT_SHERIFF_CONFIG } from '../SheriffTheme';

export interface SheriffRulesContextData {
  // Game config
  visaPvicPercent: number;
  costPerPlayer: number;
  floorPercent: number;
  
  // Duel config
  gainPerIllegalFound: number;
  lossSearchNoIllegal: number;
  gainPerIllegalPassed: number;
  lossPerIllegalCaught: number;
  
  // Pool state
  poolInitial: number;
  poolSpent: number;
  poolRemaining: number;
  
  // Players
  totalPlayers: number;
  
  // Demo mode
  isDemo: boolean;
}

const DEMO_DATA: SheriffRulesContextData = {
  visaPvicPercent: 20,
  costPerPlayer: 10,
  floorPercent: 40,
  gainPerIllegalFound: 10,
  lossSearchNoIllegal: 50,
  gainPerIllegalPassed: 10,
  lossPerIllegalCaught: 5,
  poolInitial: 100,
  poolSpent: 30,
  poolRemaining: 70,
  totalPlayers: 8,
  isDemo: true,
};

export function useSheriffRulesContext(
  gameId?: string,
  sessionGameId?: string
): SheriffRulesContextData {
  const [contextData, setContextData] = useState<SheriffRulesContextData>(DEMO_DATA);

  useEffect(() => {
    if (!gameId || !sessionGameId) {
      setContextData(DEMO_DATA);
      return;
    }

    const fetchContext = async () => {
      try {
        // Fetch round state with config
        const { data: stateData } = await supabase
          .from('sheriff_round_state')
          .select('common_pool_initial, common_pool_spent, bot_config')
          .eq('session_game_id', sessionGameId)
          .maybeSingle();

        // Fetch total players
        const { count: totalCount } = await supabase
          .from('game_players')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', gameId)
          .eq('status', 'ACTIVE')
          .eq('is_host', false);

        if (stateData) {
          const config = (stateData.bot_config as SheriffBotConfig) || {};
          const poolInitial = stateData.common_pool_initial || 100;
          const poolSpent = stateData.common_pool_spent || 0;

          setContextData({
            visaPvicPercent: config.visa_pvic_percent ?? DEFAULT_SHERIFF_CONFIG.visa_pvic_percent,
            costPerPlayer: config.cost_per_player ?? DEFAULT_SHERIFF_CONFIG.cost_per_player,
            floorPercent: (config as any).floor_percent ?? 40,
            gainPerIllegalFound: (config as any).duel_gain_per_illegal_found ?? 10,
            lossSearchNoIllegal: (config as any).duel_loss_search_no_illegal ?? 50,
            gainPerIllegalPassed: (config as any).duel_gain_per_illegal_passed ?? 10,
            lossPerIllegalCaught: (config as any).duel_loss_per_illegal_caught ?? 5,
            poolInitial,
            poolSpent,
            poolRemaining: poolInitial - poolSpent,
            totalPlayers: totalCount || 0,
            isDemo: false,
          });
        } else {
          setContextData({
            ...DEMO_DATA,
            totalPlayers: totalCount || DEMO_DATA.totalPlayers,
            isDemo: true,
          });
        }
      } catch (error) {
        console.error('Error fetching sheriff rules context:', error);
        setContextData(DEMO_DATA);
      }
    };

    fetchContext();
  }, [gameId, sessionGameId]);

  return contextData;
}

// Helper functions for simulations
export function computeVisaCostPvic(pvicCurrent: number, visaPvicPercent: number): number {
  return Math.round(pvicCurrent * (visaPvicPercent / 100));
}

export function computePoolSpentWithFloor(
  playersChoosingPool: number,
  costPerPlayer: number,
  poolInitial: number,
  floorPercent: number
): { spent: number; capped: boolean; poolRemaining: number } {
  const rawSpent = playersChoosingPool * costPerPlayer;
  const poolFloor = poolInitial * (floorPercent / 100);
  const maxSpendable = poolInitial - poolFloor;
  const spent = Math.min(rawSpent, maxSpendable);
  
  return {
    spent,
    capped: rawSpent > maxSpendable,
    poolRemaining: poolInitial - spent,
  };
}

export function computeIllegalTokens(tokensEntering: number): number {
  return Math.max(0, tokensEntering - 20);
}

export function computeDuelOutcome(
  playerSearches: boolean,
  opponentSearches: boolean,
  playerIllegal: number,
  opponentIllegal: number,
  config: {
    gainPerIllegalFound: number;
    lossSearchNoIllegal: number;
    gainPerIllegalPassed: number;
    lossPerIllegalCaught: number;
  }
): { playerDelta: number; opponentDelta: number; playerTokensLost: number; opponentTokensLost: number } {
  let playerDelta = 0;
  let opponentDelta = 0;
  let playerTokensLost = 0;
  let opponentTokensLost = 0;

  // Opponent searches player
  if (opponentSearches) {
    if (playerIllegal > 0) {
      // Player caught with illegal tokens
      opponentDelta += playerIllegal * config.gainPerIllegalFound;
      playerDelta -= playerIllegal * config.lossPerIllegalCaught;
      playerTokensLost = playerIllegal;
    } else {
      // Player was legal
      opponentDelta -= config.lossSearchNoIllegal;
    }
  } else {
    // Opponent didn't search
    if (playerIllegal > 0) {
      // Player passed with illegal tokens
      playerDelta += playerIllegal * config.gainPerIllegalPassed;
    }
  }

  // Player searches opponent
  if (playerSearches) {
    if (opponentIllegal > 0) {
      // Opponent caught with illegal tokens
      playerDelta += opponentIllegal * config.gainPerIllegalFound;
      opponentDelta -= opponentIllegal * config.lossPerIllegalCaught;
      opponentTokensLost = opponentIllegal;
    } else {
      // Opponent was legal
      playerDelta -= config.lossSearchNoIllegal;
    }
  } else {
    // Player didn't search
    if (opponentIllegal > 0) {
      // Opponent passed with illegal tokens
      opponentDelta += opponentIllegal * config.gainPerIllegalPassed;
    }
  }

  return { playerDelta, opponentDelta, playerTokensLost, opponentTokensLost };
}
