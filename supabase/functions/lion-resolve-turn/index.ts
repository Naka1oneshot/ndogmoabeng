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

    // Get current turn with idempotency check
    const { data: currentTurn, error: turnError } = await supabase
      .from('lion_turns')
      .select('*')
      .eq('session_game_id', session_game_id)
      .eq('turn_index', gameState.turn_index)
      .eq('sudden_pair_index', gameState.sudden_pair_index)
      .eq('resolved', false)
      .single();

    if (turnError || !currentTurn) {
      return new Response(
        JSON.stringify({ error: 'Turn already resolved or not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify both are locked
    if (!currentTurn.active_locked || !currentTurn.guess_locked) {
      return new Response(
        JSON.stringify({ error: 'Both players must be locked before resolution' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dealerCard = currentTurn.dealer_card;
    const activeCard = currentTurn.active_card;
    const guessChoice = currentTurn.guess_choice;

    // Calculate d = |activeCard - dealerCard|
    const d = Math.abs(activeCard - dealerCard);

    let pvicDeltaActive = 0;
    let pvicDeltaGuesser = 0;

    // New scoring logic:
    // - If activeCard == dealerCard and guesser chose EQUAL → guesser wins 10 PVic
    // - If activeCard < dealerCard and guesser chose LOWER → guesser wins d PVic
    // - If activeCard > dealerCard and guesser chose HIGHER → guesser wins d PVic
    // - If activeCard == dealerCard and guesser didn't choose EQUAL → active wins 2 PVic
    // - If activeCard < dealerCard and guesser didn't choose LOWER → active wins d PVic
    // - If activeCard > dealerCard and guesser didn't choose HIGHER → active wins d PVic

    if (activeCard === dealerCard) {
      // Cards are equal
      if (guessChoice === 'EQUAL') {
        pvicDeltaGuesser = 10;
      } else {
        pvicDeltaActive = 2;
      }
    } else if (activeCard < dealerCard) {
      // Active card is lower
      if (guessChoice === 'LOWER') {
        pvicDeltaGuesser = d;
      } else {
        pvicDeltaActive = d;
      }
    } else {
      // Active card is higher (activeCard > dealerCard)
      if (guessChoice === 'HIGHER') {
        pvicDeltaGuesser = d;
      } else {
        pvicDeltaActive = d;
      }
    }

    // Update turn as resolved
    await supabase
      .from('lion_turns')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        d,
        pvic_delta_active: pvicDeltaActive,
        pvic_delta_guesser: pvicDeltaGuesser
      })
      .eq('id', currentTurn.id);

    // Update player pvic values
    if (pvicDeltaActive > 0) {
      const { data: activePlayer } = await supabase
        .from('game_players')
        .select('pvic')
        .eq('id', currentTurn.active_player_id)
        .single();
      
      await supabase
        .from('game_players')
        .update({ pvic: (activePlayer?.pvic || 0) + pvicDeltaActive })
        .eq('id', currentTurn.active_player_id);
    }

    if (pvicDeltaGuesser > 0) {
      const { data: guesserPlayer } = await supabase
        .from('game_players')
        .select('pvic')
        .eq('id', currentTurn.guesser_player_id)
        .single();
      
      await supabase
        .from('game_players')
        .update({ pvic: (guesserPlayer?.pvic || 0) + pvicDeltaGuesser })
        .eq('id', currentTurn.guesser_player_id);
    }

    // Get player names for event
    const { data: activePl } = await supabase
      .from('game_players')
      .select('display_name')
      .eq('id', currentTurn.active_player_id)
      .single();

    const { data: guesserPl } = await supabase
      .from('game_players')
      .select('display_name')
      .eq('id', currentTurn.guesser_player_id)
      .single();

    // Publish resolution event
    let resultMessage = '';
    if (d === 0) {
      resultMessage = `🎯 Tour ${currentTurn.turn_index} : Carte croupier ${dealerCard}, carte de ${activePl?.display_name} = ${activeCard}. Différence = 0, aucun point !`;
    } else if (pvicDeltaGuesser > 0) {
      resultMessage = `🎯 Tour ${currentTurn.turn_index} : ${guesserPl?.display_name} a deviné juste (${guessChoice}) ! +${pvicDeltaGuesser} PVic`;
    } else {
      resultMessage = `🎯 Tour ${currentTurn.turn_index} : ${guesserPl?.display_name} s'est trompé ! ${activePl?.display_name} gagne +${pvicDeltaActive} PVic`;
    }

    await supabase.from('game_events').insert({
      game_id: gameState.game_id,
      session_game_id,
      event_type: 'LION_TURN_RESOLVED',
      message: resultMessage,
      visibility: 'PUBLIC',
      manche: currentTurn.turn_index,
      phase: 'LION_TURN',
      payload: {
        dealerCard,
        activeCard,
        guessChoice,
        d,
        pvicDeltaActive,
        pvicDeltaGuesser
      }
    });

    // Auto-trigger next turn if auto_resolve is enabled
    if (gameState.auto_resolve) {
      // Small delay before next turn (2 seconds for animation)
      setTimeout(async () => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/lion-next-turn`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ session_game_id })
          });
        } catch (e) {
          console.error('Failed to auto-trigger next turn:', e);
        }
      }, 2000);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        dealerCard,
        activeCard,
        guessChoice,
        d,
        pvicDeltaActive,
        pvicDeltaGuesser
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in lion-resolve-turn:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
