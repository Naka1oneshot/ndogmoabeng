import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface GameHistoryEntry {
  game_id: string;
  game_name: string;
  game_type_code: string;
  game_type_name: string;
  mode: string;
  played_at: string;
  ended_at: string;
  was_host: boolean;
  player_count: number;
  my_jetons: number;
  my_recompenses: number;
  my_kills: number;
  my_result: 'won' | 'lost' | 'played';
  my_team_mate: string | null;
}

interface UseGameHistoryResult {
  games: GameHistoryEntry[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  refetch: () => void;
}

export function useGameHistory(pageSize = 10): UseGameHistoryResult {
  const { user } = useAuth();
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setGames([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      
      const { data, error } = await supabase.rpc('get_user_game_history', {
        p_user_id: user.id,
        p_limit: pageSize,
        p_offset: offset
      });

      if (error) {
        console.error('Error fetching game history:', error);
        setGames([]);
      } else if (data && data.length > 0) {
        setGames(data as GameHistoryEntry[]);
        setTotalCount(Number(data[0].total_count) || 0);
      } else {
        setGames([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error in fetchHistory:', err);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [user, page, pageSize]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    games,
    loading,
    totalCount,
    page,
    pageSize,
    setPage,
    refetch: fetchHistory
  };
}
