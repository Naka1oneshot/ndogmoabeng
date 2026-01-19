import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FeedEntry {
  entry_id: string;
  event_timestamp: string;
  manche: number | null;
  phase_label: string | null;
  source_type: string;
  message: string;
}

export interface GameInfo {
  game_id: string;
  name: string;
  status: string;
  phase: string;
  manche_active: number | null;
  mode: string;
  game_type_code: string | null;
  game_type_name: string;
  current_step_index: number;
  player_count: number;
  is_ended: boolean;
}

export interface Participant {
  player_number: number | null;
  display_name: string;
  clan: string | null;
  is_alive: boolean | null;
}

export function useSpectatorFeed(gameId: string | undefined) {
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!gameId) return;

    try {
      // Fetch game info, feed, and participants in parallel
      const [infoResult, feedResult, participantsResult] = await Promise.all([
        supabase.rpc('public_game_info', { p_game_id: gameId }),
        supabase.rpc('public_game_feed', { p_game_id: gameId }),
        supabase.rpc('public_game_participants', { p_game_id: gameId })
      ]);

      if (infoResult.error) throw infoResult.error;
      if (feedResult.error) throw feedResult.error;
      if (participantsResult.error) throw participantsResult.error;

      const infoData = infoResult.data as GameInfo[] | null;
      if (infoData && infoData.length > 0) {
        setGameInfo(infoData[0]);
      } else {
        setError('Partie introuvable');
        return;
      }

      setFeed((feedResult.data || []) as FeedEntry[]);
      setParticipants((participantsResult.data || []) as Participant[]);
      setError(null);
    } catch (err) {
      console.error('Error fetching spectator data:', err);
      setError('Impossible de charger les données de la partie');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchAll();

    if (!gameId) return;

    // Realtime subscriptions for live updates
    const channel = supabase
      .channel(`spectator-${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_events', filter: `game_id=eq.${gameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'logs_joueurs', filter: `game_id=eq.${gameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'combat_results', filter: `game_id=eq.${gameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'river_level_history', filter: `game_id=eq.${gameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, fetchAll]);

  return { feed, gameInfo, participants, loading, error, refetch: fetchAll };
}
