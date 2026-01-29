import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LionGameState {
  id: string;
  game_id: string;
  session_game_id: string;
  status: 'NOT_STARTED' | 'RUNNING' | 'SUDDEN_DEATH' | 'FINISHED';
  turn_index: number;
  sudden_pair_index: number;
  active_player_id: string;
  guesser_player_id: string;
  winner_player_id: string | null;
  auto_resolve: boolean;
  timer_enabled: boolean;
  timer_active_seconds: number;
  timer_guess_seconds: number;
}

interface LionTurn {
  id: string;
  session_game_id: string;
  turn_index: number;
  is_sudden_death: boolean;
  sudden_pair_index: number;
  dealer_owner_player_id: string;
  dealer_card: number;
  active_player_id: string;
  guesser_player_id: string;
  active_card: number | null;
  guess_choice: 'HIGHER' | 'LOWER' | null;
  active_locked: boolean;
  guess_locked: boolean;
  resolved: boolean;
  d: number | null;
  pvic_delta_active: number;
  pvic_delta_guesser: number;
}

interface LionHand {
  id: string;
  session_game_id: string;
  owner_player_id: string;
  remaining_cards: number[];
}

interface LionDeck {
  id: string;
  session_game_id: string;
  owner_player_id: string;
  remaining_cards: number[];
}

interface LionPlayer {
  id: string;
  display_name: string;
  player_number: number;
  pvic: number;
  user_id: string | null;
}

export function useLionGameState(sessionGameId: string | undefined) {
  const [gameState, setGameState] = useState<LionGameState | null>(null);
  const [currentTurn, setCurrentTurn] = useState<LionTurn | null>(null);
  const [myHand, setMyHand] = useState<LionHand | null>(null);
  const [players, setPlayers] = useState<LionPlayer[]>([]);
  const [decks, setDecks] = useState<LionDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!sessionGameId) return;

    try {
      setLoading(true);

      // Fetch game state
      const { data: stateData, error: stateError } = await supabase
        .from('lion_game_state')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .maybeSingle();

      if (stateError) throw stateError;
      setGameState(stateData as LionGameState | null);

      if (stateData) {
        // Fetch current turn
        const { data: turnData } = await supabase
          .from('lion_turns')
          .select('*')
          .eq('session_game_id', sessionGameId)
          .eq('turn_index', stateData.turn_index)
          .eq('sudden_pair_index', stateData.sudden_pair_index)
          .maybeSingle();

        setCurrentTurn(turnData as LionTurn | null);

        // Fetch players
        const { data: playersData } = await supabase
          .from('game_players')
          .select('id, display_name, player_number, pvic, user_id')
          .eq('game_id', stateData.game_id)
          .eq('is_host', false)
          .is('removed_at', null)
          .order('player_number');

        setPlayers((playersData || []) as LionPlayer[]);

        // Fetch decks
        const { data: decksData } = await supabase
          .from('lion_decks')
          .select('*')
          .eq('session_game_id', sessionGameId);

        setDecks((decksData || []) as LionDeck[]);
      }

      // Fetch my hand (if I'm a player)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: myPlayerData } = await supabase
          .from('game_players')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (myPlayerData) {
          const { data: handData } = await supabase
            .from('lion_hands')
            .select('*')
            .eq('session_game_id', sessionGameId)
            .eq('owner_player_id', myPlayerData.id)
            .maybeSingle();

          setMyHand(handData as LionHand | null);
        }
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching Lion game state:', err);
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }, [sessionGameId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!sessionGameId) return;

    const channel = supabase
      .channel(`lion-game-${sessionGameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lion_game_state', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lion_turns', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lion_hands', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lion_decks', filter: `session_game_id=eq.${sessionGameId}` },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionGameId, fetchAll]);

  // Helper to get player by ID
  const getPlayerById = useCallback((id: string) => {
    return players.find(p => p.id === id);
  }, [players]);

  // Get player A and B
  const playerA = players.find(p => p.player_number === 1);
  const playerB = players.find(p => p.player_number === 2);

  return {
    gameState,
    currentTurn,
    myHand,
    players,
    playerA,
    playerB,
    decks,
    loading,
    error,
    refetch: fetchAll,
    getPlayerById
  };
}
