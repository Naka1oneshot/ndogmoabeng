import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  games_played: number;
  games_won: number;
  total_rewards: number;
  created_at: string;
  clan_affinity_id: string | null;
  clan_affinity_scores: Record<string, number> | null;
  clan_affinity_completed_at: string | null;
}

export interface PublicGameHistory {
  game_id: string;
  game_name: string;
  game_type_code: string;
  game_type_name: string;
  played_at: string;
  result: 'won' | 'lost' | 'played';
  player_display_name: string;
}

export interface ProfileComparison {
  my_games_played: number;
  my_games_won: number;
  target_games_played: number;
  target_games_won: number;
  games_together: number;
  my_wins_together: number;
  target_wins_together: number;
}

export interface PublicActiveGame {
  game_id: string;
  game_name: string;
  game_type_code: string | null;
  game_type_name: string | null;
  game_status: string;
  player_count: number;
}

export function usePublicProfile(userId: string | null) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [gameHistory, setGameHistory] = useState<PublicGameHistory[]>([]);
  const [activeGames, setActiveGames] = useState<PublicActiveGame[]>([]);
  const [comparison, setComparison] = useState<ProfileComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch profile, game history, active games, and comparison in parallel
        const [profileResult, historyResult, activeGamesResult, comparisonResult] = await Promise.all([
          supabase.rpc('get_public_profile', { p_user_id: userId }),
          supabase.rpc('get_public_game_history', { p_user_id: userId, p_limit: 10 }),
          supabase.rpc('get_public_active_games', { p_user_id: userId }),
          supabase.rpc('get_public_comparison', { p_target_user_id: userId }),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (historyResult.error) throw historyResult.error;

        if (profileResult.data && profileResult.data.length > 0) {
          setProfile(profileResult.data[0] as PublicProfile);
        } else {
          setError('Profil introuvable');
        }

        setGameHistory((historyResult.data || []) as PublicGameHistory[]);
        setActiveGames((activeGamesResult.data || []) as PublicActiveGame[]);

        if (comparisonResult.data && comparisonResult.data.length > 0) {
          setComparison(comparisonResult.data[0] as ProfileComparison);
        }
      } catch (err) {
        console.error('Error fetching public profile:', err);
        setError('Erreur lors du chargement du profil');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  return { profile, gameHistory, activeGames, comparison, loading, error };
}
