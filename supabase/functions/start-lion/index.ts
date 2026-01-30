import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { session_game_id } = await req.json();

    if (!session_game_id) {
      return new Response(
        JSON.stringify({ error: 'session_game_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session game info
    const { data: sessionGame, error: sessionError } = await supabase
      .from('session_games')
      .select('id, session_id, game_type_code')
      .eq('id', session_game_id)
      .single();

    if (sessionError || !sessionGame) {
      return new Response(
        JSON.stringify({ error: 'Session game not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sessionGame.game_type_code !== 'LION') {
      return new Response(
        JSON.stringify({ error: 'This is not a LION game' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gameId = sessionGame.session_id;

    // Check if this is an ADVENTURE game and load config
    const { data: game } = await supabase
      .from('games')
      .select('mode, adventure_id')
      .eq('id', gameId)
      .single();

    const isAdventure = game?.mode === 'ADVENTURE';

    // Load adventure config for Lion-specific settings
    let lionConfig: any = null;
    if (isAdventure && game.adventure_id) {
      console.log(`[start-lion] Adventure mode detected, loading config for game: ${gameId}`);
      
      const { data: agc, error: agcError } = await supabase
        .from('adventure_game_configs')
        .select('config')
        .eq('game_id', gameId)
        .single();
      
      if (agcError) {
        console.error('[start-lion] Error loading adventure config:', agcError);
      } else if (agc?.config) {
        const adventureConfig = agc.config as any;
        lionConfig = adventureConfig.lion_config;
        console.log('[start-lion] Adventure lion_config loaded:', lionConfig);
      }
    }

    // Check if game state already exists (idempotency guard)
    const { data: existingState } = await supabase
      .from('lion_game_state')
      .select('id, status, active_player_id, guesser_player_id')
      .eq('session_game_id', session_game_id)
      .maybeSingle();

    if (existingState) {
      // Game state exists - ensure game and session_game status are updated
      console.log('Lion game state already exists, ensuring statuses are correct');
      
      await supabase
        .from('games')
        .update({ status: 'IN_GAME', phase: 'LION_TURN' })
        .eq('id', gameId);

      await supabase
        .from('session_games')
        .update({ status: 'RUNNING' })
        .eq('id', session_game_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          alreadyStarted: true,
          message: 'Game was already started, statuses updated'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get players - in ADVENTURE mode, only get ACTIVE players (the 2 finalists)
    // In standalone mode, get all non-host, non-removed players
    let playersQuery = supabase
      .from('game_players')
      .select('id, display_name, player_number, user_id, pvic, status')
      .eq('game_id', gameId)
      .eq('is_host', false)
      .is('removed_at', null);

    if (isAdventure) {
      // In adventure mode, only get ACTIVE players (finalists)
      playersQuery = playersQuery.eq('status', 'ACTIVE');
    }

    const { data: players, error: playersError } = await playersQuery.order('joined_at', { ascending: true });

    if (playersError || !players) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch players' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (players.length !== 2) {
      return new Response(
        JSON.stringify({ error: `LION requires exactly 2 ${isAdventure ? 'ACTIVE' : ''} players, found ${players.length}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const playerA = players[0];
    const playerB = players[1];

    // Assign player numbers if not set
    if (!playerA.player_number) {
      await supabase
        .from('game_players')
        .update({ player_number: 1 })
        .eq('id', playerA.id);
    }
    if (!playerB.player_number) {
      await supabase
        .from('game_players')
        .update({ player_number: 2 })
        .eq('id', playerB.id);
    }

    // In ADVENTURE mode, preserve PVic from previous games
    // In standalone mode, reset PVic to 0
    if (!isAdventure) {
      await supabase
        .from('game_players')
        .update({ pvic: 0, recompenses: 0 })
        .in('id', [playerA.id, playerB.id]);
      console.log('[start-lion] Standalone mode - reset PVic to 0');
    } else {
      // Just reset recompenses, keep pvic
      await supabase
        .from('game_players')
        .update({ recompenses: 0 })
        .in('id', [playerA.id, playerB.id]);
      console.log(`[start-lion] Adventure mode - preserved PVic: ${playerA.display_name}=${playerA.pvic}, ${playerB.display_name}=${playerB.pvic}`);
    }

    // Create hands for both players
    const initialCards = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    
    await supabase.from('lion_hands').insert([
      { session_game_id, owner_player_id: playerA.id, remaining_cards: initialCards },
      { session_game_id, owner_player_id: playerB.id, remaining_cards: initialCards }
    ]);

    // Create decks for both players
    await supabase.from('lion_decks').insert([
      { session_game_id, owner_player_id: playerA.id, remaining_cards: initialCards },
      { session_game_id, owner_player_id: playerB.id, remaining_cards: initialCards }
    ]);

    // Draw first dealer card from player A's deck (since A is active first)
    const dealerCard = initialCards[Math.floor(Math.random() * initialCards.length)];
    const remainingDeckA = initialCards.filter(c => c !== dealerCard);

    // Update deck A after drawing
    await supabase
      .from('lion_decks')
      .update({ remaining_cards: remainingDeckA })
      .eq('session_game_id', session_game_id)
      .eq('owner_player_id', playerA.id);

    // Create game state with lion_config if available
    const autoResolve = lionConfig?.auto_resolve ?? true;
    const timerEnabled = lionConfig?.timer_enabled ?? false;
    const timerActiveSeconds = lionConfig?.timer_active_seconds ?? 60;
    const timerGuessSeconds = lionConfig?.timer_guess_seconds ?? 30;
    
    console.log(`[start-lion] Game settings: autoResolve=${autoResolve}, timerEnabled=${timerEnabled}`);
    
    const { error: stateError } = await supabase.from('lion_game_state').insert({
      game_id: gameId,
      session_game_id,
      status: 'RUNNING',
      turn_index: 1,
      sudden_pair_index: 0,
      active_player_id: playerA.id,
      guesser_player_id: playerB.id,
      auto_resolve: autoResolve,
      timer_enabled: timerEnabled,
      timer_active_seconds: timerActiveSeconds,
      timer_guess_seconds: timerGuessSeconds,
    });

    if (stateError) {
      console.error('Failed to create game state:', stateError);
      return new Response(
        JSON.stringify({ error: 'Failed to create game state', details: stateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create first turn
    const { error: turnError } = await supabase.from('lion_turns').insert({
      session_game_id,
      turn_index: 1,
      is_sudden_death: false,
      sudden_pair_index: 0,
      dealer_owner_player_id: playerA.id,
      dealer_card: dealerCard,
      active_player_id: playerA.id,
      guesser_player_id: playerB.id
    });

    if (turnError) {
      console.error('Failed to create first turn:', turnError);
      return new Response(
        JSON.stringify({ error: 'Failed to create first turn', details: turnError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update game status
    await supabase
      .from('games')
      .update({ status: 'IN_GAME', phase: 'LION_TURN' })
      .eq('id', gameId);

    // Publish start event
    await supabase.from('game_events').insert({
      game_id: gameId,
      session_game_id,
      event_type: 'LION_START',
      message: `🦁 Le CŒUR du Lion commence ! ${playerA.display_name} joue en premier.`,
      visibility: 'PUBLIC',
      manche: 1,
      phase: 'LION_TURN'
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        playerA: { id: playerA.id, name: playerA.display_name },
        playerB: { id: playerB.id, name: playerB.display_name },
        dealerCard,
        turnIndex: 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in start-lion:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
