import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TOTAL_TURNS = 22;

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

    // Get current game state
    const { data: gameState, error: stateError } = await supabase
      .from('lion_game_state')
      .select('*')
      .eq('session_game_id', session_game_id)
      .single();

    if (stateError || !gameState) {
      return new Response(
        JSON.stringify({ error: 'Game state not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (gameState.status === 'FINISHED') {
      return new Response(
        JSON.stringify({ error: 'Game already finished' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get both players
    const { data: players } = await supabase
      .from('game_players')
      .select('id, display_name, pvic, player_number')
      .eq('game_id', gameState.game_id)
      .eq('is_host', false)
      .is('removed_at', null)
      .order('player_number', { ascending: true });

    if (!players || players.length !== 2) {
      return new Response(
        JSON.stringify({ error: 'Could not find both players' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const playerA = players[0];
    const playerB = players[1];

    const currentTurnIndex = gameState.turn_index;
    const isSuddenDeath = gameState.status === 'SUDDEN_DEATH';

    // Handle normal game mode
    if (!isSuddenDeath) {
      if (currentTurnIndex >= TOTAL_TURNS) {
        // Game should end - check for winner or sudden death
        const pvicA = playerA.pvic || 0;
        const pvicB = playerB.pvic || 0;

        if (pvicA !== pvicB) {
          // We have a winner
          const winnerId = pvicA > pvicB ? playerA.id : playerB.id;
          const winnerName = pvicA > pvicB ? playerA.display_name : playerB.display_name;

          await supabase
            .from('lion_game_state')
            .update({ status: 'FINISHED', winner_player_id: winnerId })
            .eq('id', gameState.id);

          await supabase
            .from('games')
            .update({ status: 'FINISHED', winner_declared: true })
            .eq('id', gameState.game_id);

          // Get winner's user_id for stats
          const { data: winnerPlayer } = await supabase
            .from('game_players')
            .select('user_id')
            .eq('id', winnerId)
            .single();

          // Update player profile statistics
          await supabase.rpc('update_player_stats_on_game_end', {
            p_game_id: gameState.game_id,
            p_winner_user_id: winnerPlayer?.user_id || null
          });

          await supabase.from('game_events').insert({
            game_id: gameState.game_id,
            session_game_id,
            event_type: 'LION_GAME_END',
            message: `🏆 ${winnerName} remporte Le CŒUR du Lion avec ${Math.max(pvicA, pvicB)} PVic !`,
            visibility: 'PUBLIC',
            manche: TOTAL_TURNS,
            phase: 'LION_END'
          });

          return new Response(
            JSON.stringify({ success: true, finished: true, winner: winnerName }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Equality - enter sudden death!
          await supabase
            .from('lion_game_state')
            .update({ 
              status: 'SUDDEN_DEATH', 
              turn_index: 1,
              sudden_pair_index: 1,
              active_player_id: playerA.id,
              guesser_player_id: playerB.id
            })
            .eq('id', gameState.id);

          // Reset hands and decks for sudden death
          const initialCards = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

          await supabase
            .from('lion_hands')
            .update({ remaining_cards: initialCards })
            .eq('session_game_id', session_game_id)
            .eq('owner_player_id', playerA.id);

          await supabase
            .from('lion_hands')
            .update({ remaining_cards: initialCards })
            .eq('session_game_id', session_game_id)
            .eq('owner_player_id', playerB.id);

          await supabase
            .from('lion_decks')
            .update({ remaining_cards: initialCards })
            .eq('session_game_id', session_game_id)
            .eq('owner_player_id', playerA.id);

          await supabase
            .from('lion_decks')
            .update({ remaining_cards: initialCards })
            .eq('session_game_id', session_game_id)
            .eq('owner_player_id', playerB.id);

          // Draw first card for sudden death
          const dealerCard = initialCards[Math.floor(Math.random() * initialCards.length)];
          const remainingDeck = initialCards.filter(c => c !== dealerCard);

          await supabase
            .from('lion_decks')
            .update({ remaining_cards: remainingDeck })
            .eq('session_game_id', session_game_id)
            .eq('owner_player_id', playerA.id);

          // Create first sudden death turn
          await supabase.from('lion_turns').insert({
            session_game_id,
            turn_index: 1,
            is_sudden_death: true,
            sudden_pair_index: 1,
            dealer_owner_player_id: playerA.id,
            dealer_card: dealerCard,
            active_player_id: playerA.id,
            guesser_player_id: playerB.id
          });

          await supabase.from('game_events').insert({
            game_id: gameState.game_id,
            session_game_id,
            event_type: 'LION_SUDDEN_DEATH',
            message: `⚔️ Égalité ! MORT SUBITE activée. Duo de tours décisifs !`,
            visibility: 'PUBLIC',
            manche: 1,
            phase: 'LION_SUDDEN_DEATH'
          });

          return new Response(
            JSON.stringify({ success: true, suddenDeath: true, pairIndex: 1 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Continue to next turn (normal or sudden death)
    const nextTurnIndex = isSuddenDeath 
      ? (currentTurnIndex % 2) + 1  // 1 or 2 in sudden death
      : currentTurnIndex + 1;

    // Swap active/guesser
    const nextActiveId = gameState.guesser_player_id;
    const nextGuesserId = gameState.active_player_id;
    const nextActivePlayer = nextActiveId === playerA.id ? playerA : playerB;

    // Handle sudden death duo completion
    if (isSuddenDeath && currentTurnIndex === 2) {
      // Duo complete, check winner
      const { data: duoTurns } = await supabase
        .from('lion_turns')
        .select('*')
        .eq('session_game_id', session_game_id)
        .eq('sudden_pair_index', gameState.sudden_pair_index)
        .eq('resolved', true);

      if (duoTurns && duoTurns.length === 2) {
        let duoScoreA = 0;
        let duoScoreB = 0;

        for (const turn of duoTurns) {
          if (turn.active_player_id === playerA.id) {
            duoScoreA += turn.pvic_delta_active;
            duoScoreB += turn.pvic_delta_guesser;
          } else {
            duoScoreB += turn.pvic_delta_active;
            duoScoreA += turn.pvic_delta_guesser;
          }
        }

        if (duoScoreA !== duoScoreB) {
          // Winner determined
          const winnerId = duoScoreA > duoScoreB ? playerA.id : playerB.id;
          const winnerName = duoScoreA > duoScoreB ? playerA.display_name : playerB.display_name;

          await supabase
            .from('lion_game_state')
            .update({ status: 'FINISHED', winner_player_id: winnerId })
            .eq('id', gameState.id);

          await supabase
            .from('games')
            .update({ status: 'FINISHED', winner_declared: true })
            .eq('id', gameState.game_id);

          // Get winner's user_id for stats
          const { data: winnerPlayer } = await supabase
            .from('game_players')
            .select('user_id')
            .eq('id', winnerId)
            .single();

          // Update player profile statistics
          await supabase.rpc('update_player_stats_on_game_end', {
            p_game_id: gameState.game_id,
            p_winner_user_id: winnerPlayer?.user_id || null
          });

          await supabase.from('game_events').insert({
            game_id: gameState.game_id,
            session_game_id,
            event_type: 'LION_GAME_END',
            message: `🏆 ${winnerName} remporte la Mort Subite (${Math.max(duoScoreA, duoScoreB)} vs ${Math.min(duoScoreA, duoScoreB)}) !`,
            visibility: 'PUBLIC',
            manche: 2,
            phase: 'LION_END'
          });

          return new Response(
            JSON.stringify({ success: true, finished: true, winner: winnerName, suddenDeath: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          // Still tied! Start new duo
          const newPairIndex = gameState.sudden_pair_index + 1;
          const initialCards = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

          // Reset hands and decks
          await supabase
            .from('lion_hands')
            .update({ remaining_cards: initialCards })
            .eq('session_game_id', session_game_id);

          await supabase
            .from('lion_decks')
            .update({ remaining_cards: initialCards })
            .eq('session_game_id', session_game_id);

          // Draw card for new duo
          const dealerCard = initialCards[Math.floor(Math.random() * initialCards.length)];
          const remainingDeck = initialCards.filter(c => c !== dealerCard);

          await supabase
            .from('lion_decks')
            .update({ remaining_cards: remainingDeck })
            .eq('session_game_id', session_game_id)
            .eq('owner_player_id', playerA.id);

          // Update state for new duo
          await supabase
            .from('lion_game_state')
            .update({ 
              turn_index: 1,
              sudden_pair_index: newPairIndex,
              active_player_id: playerA.id,
              guesser_player_id: playerB.id
            })
            .eq('id', gameState.id);

          // Create turn
          await supabase.from('lion_turns').insert({
            session_game_id,
            turn_index: 1,
            is_sudden_death: true,
            sudden_pair_index: newPairIndex,
            dealer_owner_player_id: playerA.id,
            dealer_card: dealerCard,
            active_player_id: playerA.id,
            guesser_player_id: playerB.id
          });

          await supabase.from('game_events').insert({
            game_id: gameState.game_id,
            session_game_id,
            event_type: 'LION_SUDDEN_DEATH_CONTINUE',
            message: `⚔️ Encore égalité ! Nouveau duo (Pair #${newPairIndex})`,
            visibility: 'PUBLIC',
            manche: 1,
            phase: 'LION_SUDDEN_DEATH'
          });

          return new Response(
            JSON.stringify({ success: true, newDuo: true, pairIndex: newPairIndex }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Normal next turn logic
    // Get the deck for the next active player and draw a card
    const { data: deck } = await supabase
      .from('lion_decks')
      .select('*')
      .eq('session_game_id', session_game_id)
      .eq('owner_player_id', nextActiveId)
      .single();

    if (!deck || deck.remaining_cards.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No cards left in deck' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const remainingCards = deck.remaining_cards as number[];
    const randomIndex = Math.floor(Math.random() * remainingCards.length);
    const dealerCard = remainingCards[randomIndex];
    const newDeckCards = remainingCards.filter((_, i) => i !== randomIndex);

    await supabase
      .from('lion_decks')
      .update({ remaining_cards: newDeckCards })
      .eq('id', deck.id);

    // Update game state
    await supabase
      .from('lion_game_state')
      .update({
        turn_index: nextTurnIndex,
        active_player_id: nextActiveId,
        guesser_player_id: nextGuesserId
      })
      .eq('id', gameState.id);

    // Create new turn
    await supabase.from('lion_turns').insert({
      session_game_id,
      turn_index: nextTurnIndex,
      is_sudden_death: isSuddenDeath,
      sudden_pair_index: gameState.sudden_pair_index,
      dealer_owner_player_id: nextActiveId,
      dealer_card: dealerCard,
      active_player_id: nextActiveId,
      guesser_player_id: nextGuesserId
    });

    await supabase.from('game_events').insert({
      game_id: gameState.game_id,
      session_game_id,
      event_type: 'LION_NEW_TURN',
      message: `🎴 Tour ${nextTurnIndex}${isSuddenDeath ? ' (Mort Subite)' : ''} : ${nextActivePlayer.display_name} joue, carte croupier = ${dealerCard}`,
      visibility: 'PUBLIC',
      manche: nextTurnIndex,
      phase: isSuddenDeath ? 'LION_SUDDEN_DEATH' : 'LION_TURN'
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        turnIndex: nextTurnIndex, 
        dealerCard,
        activePlayer: nextActivePlayer.display_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in lion-next-turn:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
