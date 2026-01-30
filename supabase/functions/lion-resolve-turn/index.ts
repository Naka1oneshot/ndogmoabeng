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

    // Validate guess_choice is set
    const guessChoice = currentTurn.guess_choice;
    if (!guessChoice) {
      return new Response(
        JSON.stringify({ error: 'Guess not locked (guess_choice is null)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dealerCard = currentTurn.dealer_card;
    const activeCard = currentTurn.active_card;

    // Validate cards are present
    if (dealerCard === null || dealerCard === undefined || activeCard === null || activeCard === undefined) {
      return new Response(
        JSON.stringify({ error: 'Card values missing (dealer or active card is null)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // OFFICIAL SCORING LOGIC
    // ============================================
    // Let:
    //   A = activeCard (joueur actif)
    //   D = dealerCard (croupier)
    //   G = guessChoice ∈ {'HIGHER', 'LOWER', 'EQUAL'}
    //   diff = |A - D|
    //
    // Rules:
    // 1) A == D && G == 'EQUAL' → guesser wins 10 PVic
    // 2) A < D && G == 'LOWER'  → guesser wins (D - A) PVic
    // 3) A > D && G == 'HIGHER' → guesser wins (A - D) PVic
    // 4) A == D && G != 'EQUAL' → active wins 2 PVic
    // 5) A < D && G != 'LOWER'  → active wins (D - A) PVic
    // 6) A > D && G != 'HIGHER' → active wins (A - D) PVic
    // ============================================

    const A = activeCard;
    const D = dealerCard;
    const G = guessChoice;
    const diff = Math.abs(A - D);

    let pvicDeltaActive = 0;
    let pvicDeltaGuesser = 0;
    let winnerRole: 'guesser' | 'active' = 'active';

    if (A === D) {
      // Cards are equal
      if (G === 'EQUAL') {
        pvicDeltaGuesser = 10;
        winnerRole = 'guesser';
      } else {
        pvicDeltaActive = 2;
        winnerRole = 'active';
      }
    } else if (A < D) {
      // Active card is lower than dealer
      if (G === 'LOWER') {
        pvicDeltaGuesser = diff; // D - A since A < D
        winnerRole = 'guesser';
      } else {
        pvicDeltaActive = diff;
        winnerRole = 'active';
      }
    } else {
      // A > D: Active card is higher than dealer
      if (G === 'HIGHER') {
        pvicDeltaGuesser = diff; // A - D since A > D
        winnerRole = 'guesser';
      } else {
        pvicDeltaActive = diff;
        winnerRole = 'active';
      }
    }

    // Update turn as resolved
    const { error: updateTurnError } = await supabase
      .from('lion_turns')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        d: diff,
        pvic_delta_active: pvicDeltaActive,
        pvic_delta_guesser: pvicDeltaGuesser
      })
      .eq('id', currentTurn.id);

    if (updateTurnError) {
      console.error('Failed to update turn:', updateTurnError);
      return new Response(
        JSON.stringify({ error: `Failed to resolve turn: ${updateTurnError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update player pvic values
    if (pvicDeltaActive > 0) {
      const { data: activePlayer, error: activePlayerError } = await supabase
        .from('game_players')
        .select('pvic')
        .eq('id', currentTurn.active_player_id)
        .single();
      
      if (activePlayerError) {
        console.error('Failed to fetch active player:', activePlayerError);
      } else {
        const { error: updateActiveError } = await supabase
          .from('game_players')
          .update({ pvic: (activePlayer?.pvic || 0) + pvicDeltaActive })
          .eq('id', currentTurn.active_player_id);
        
        if (updateActiveError) {
          console.error('Failed to update active player pvic:', updateActiveError);
        }
      }
    }

    if (pvicDeltaGuesser > 0) {
      const { data: guesserPlayer, error: guesserPlayerError } = await supabase
        .from('game_players')
        .select('pvic')
        .eq('id', currentTurn.guesser_player_id)
        .single();
      
      if (guesserPlayerError) {
        console.error('Failed to fetch guesser player:', guesserPlayerError);
      } else {
        const { error: updateGuesserError } = await supabase
          .from('game_players')
          .update({ pvic: (guesserPlayer?.pvic || 0) + pvicDeltaGuesser })
          .eq('id', currentTurn.guesser_player_id);
        
        if (updateGuesserError) {
          console.error('Failed to update guesser player pvic:', updateGuesserError);
        }
      }
    }

    // Get player names for event message
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

    const activeName = activePl?.display_name || 'Joueur actif';
    const guesserName = guesserPl?.display_name || 'Devineur';

    // Build result message according to official rules
    let resultMessage = '';
    const guessLabel = G === 'HIGHER' ? 'PLUS HAUT' : G === 'LOWER' ? 'PLUS BAS' : 'ÉGAL';

    if (A === D) {
      // Equal cards
      if (winnerRole === 'guesser') {
        resultMessage = `🎯 Tour ${currentTurn.turn_index} : Égalité (A=${A}, D=${D}). ${guesserName} a choisi ${guessLabel} : +${pvicDeltaGuesser} PVic au devineur.`;
      } else {
        resultMessage = `🎯 Tour ${currentTurn.turn_index} : Égalité (A=${A}, D=${D}). ${guesserName} a choisi ${guessLabel} (incorrect) : +${pvicDeltaActive} PVic au joueur actif (${activeName}).`;
      }
    } else {
      // Non-equal cards
      const comparison = A < D ? 'inférieure' : 'supérieure';
      if (winnerRole === 'guesser') {
        resultMessage = `🎯 Tour ${currentTurn.turn_index} : A=${A}, D=${D} (carte ${comparison}). ${guesserName} a deviné juste (${guessLabel}) : +${pvicDeltaGuesser} PVic au devineur.`;
      } else {
        resultMessage = `🎯 Tour ${currentTurn.turn_index} : A=${A}, D=${D} (carte ${comparison}). ${guesserName} a choisi ${guessLabel} (incorrect) : +${pvicDeltaActive} PVic au joueur actif (${activeName}).`;
      }
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
        dealerCard: D,
        activeCard: A,
        guessChoice: G,
        d: diff,
        pvicDeltaActive,
        pvicDeltaGuesser,
        winnerRole
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
        dealerCard: D,
        activeCard: A,
        guessChoice: G,
        d: diff,
        pvicDeltaActive,
        pvicDeltaGuesser,
        winnerRole
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
