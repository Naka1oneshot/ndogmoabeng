import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClanId, ClanAdvantage, GameCode } from '@/lib/clanAdvantages/types';

export interface ClanAdvantageRow {
  id: string;
  game_code: string;
  clan_id: string;
  title: string;
  description: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export function useClanAdvantages() {
  const [advantages, setAdvantages] = useState<ClanAdvantageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdvantages = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('clan_advantages')
      .select('*')
      .order('game_code')
      .order('clan_id')
      .order('title');

    if (fetchError) {
      setError(fetchError.message);
      setAdvantages([]);
    } else {
      setAdvantages(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAdvantages();
  }, [fetchAdvantages]);

  const addAdvantage = async (
    gameCode: string,
    clanId: string,
    title: string,
    description: string,
    source?: string
  ) => {
    const { data, error } = await supabase
      .from('clan_advantages')
      .insert({
        game_code: gameCode,
        clan_id: clanId,
        title,
        description,
        source: source || null,
      })
      .select()

    if (error) throw error;
    await fetchAdvantages();
    return data;
  };

  const updateAdvantage = async (
    id: string,
    updates: Partial<Pick<ClanAdvantageRow, 'title' | 'description' | 'source'>>
  ) => {
    const { error } = await supabase
      .from('clan_advantages')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    await fetchAdvantages();
  };

  const deleteAdvantage = async (id: string) => {
    const { error } = await supabase
      .from('clan_advantages')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchAdvantages();
  };

  // Group advantages by game
  const getAdvantagesByGame = useCallback((): Record<GameCode, Record<ClanId, ClanAdvantage[]>> => {
    const result: Record<string, Record<ClanId, ClanAdvantage[]>> = {};
    
    for (const adv of advantages) {
      if (!result[adv.game_code]) {
        result[adv.game_code] = {
          'maison-royale': [],
          'fraternite-zoulous': [],
          'maison-keryndes': [],
          'akande': [],
          'cercle-aseyra': [],
          'sources-akila': [],
          'ezkar': [],
        };
      }
      const clanId = adv.clan_id as ClanId;
      if (result[adv.game_code][clanId]) {
        result[adv.game_code][clanId].push({
          title: adv.title,
          description: adv.description,
          source: adv.source || '',
        });
      }
    }
    
    return result;
  }, [advantages]);

  // Get games that have at least one advantage
  const getGamesWithAdvantages = useCallback((): string[] => {
    const games = new Set(advantages.map(a => a.game_code));
    return Array.from(games);
  }, [advantages]);

  // Check if a clan has advantage in a specific game
  const clanHasAdvantageInGame = useCallback((gameCode: string, clanId: string): boolean => {
    return advantages.some(a => a.game_code === gameCode && a.clan_id === clanId);
  }, [advantages]);

  return {
    advantages,
    loading,
    error,
    refetch: fetchAdvantages,
    addAdvantage,
    updateAdvantage,
    deleteAdvantage,
    getAdvantagesByGame,
    getGamesWithAdvantages,
    clanHasAdvantageInGame,
  };
}
