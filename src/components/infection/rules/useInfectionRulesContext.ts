import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InfectionRulesContextData {
  // Game state
  manche: number;
  totalPlayers: number;
  playersAlive: number;
  pvCount: number;
  syCount: number;
  
  // Demo mode
  isDemo: boolean;
}

const DEMO_DATA: InfectionRulesContextData = {
  manche: 2,
  totalPlayers: 9,
  playersAlive: 7,
  pvCount: 2,
  syCount: 2,
  isDemo: true,
};

export function useInfectionRulesContext(
  gameId?: string,
  sessionGameId?: string
): InfectionRulesContextData {
  const [contextData, setContextData] = useState<InfectionRulesContextData>(DEMO_DATA);

  useEffect(() => {
    if (!gameId || !sessionGameId) {
      setContextData(DEMO_DATA);
      return;
    }

    const fetchContext = async () => {
      try {
        // Fetch game info
        const { data: gameData } = await supabase
          .from('games')
          .select('manche_active')
          .eq('id', gameId)
          .maybeSingle();

        // Fetch players
        const { data: playersData } = await supabase
          .from('game_players')
          .select('is_alive, role_code, is_host')
          .eq('game_id', gameId)
          .is('removed_at', null);

        if (playersData) {
          const activePlayers = playersData.filter(p => !p.is_host);
          const alive = activePlayers.filter(p => p.is_alive !== false);
          const pvs = activePlayers.filter(p => p.role_code === 'PV');
          const sys = activePlayers.filter(p => p.role_code === 'SY');

          setContextData({
            manche: gameData?.manche_active || 1,
            totalPlayers: activePlayers.length,
            playersAlive: alive.length,
            pvCount: pvs.length,
            syCount: sys.length,
            isDemo: false,
          });
        } else {
          setContextData({
            ...DEMO_DATA,
            isDemo: true,
          });
        }
      } catch (error) {
        console.error('Error fetching infection rules context:', error);
        setContextData(DEMO_DATA);
      }
    };

    fetchContext();
  }, [gameId, sessionGameId]);

  return contextData;
}
