import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, sessionGameId, playerNumber, tokensEnteringFinal } = await req.json();

    if (!gameId || !sessionGameId || playerNumber === undefined || tokensEnteringFinal === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate tokens range (21-30 for final duel)
    if (tokensEnteringFinal < 21 || tokensEnteringFinal > 30) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tokens must be between 21 and 30 for final duel' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get round state
    const { data: roundState, error: roundError } = await supabase
      .from('sheriff_round_state')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .single();

    if (roundError || !roundState) {
      return new Response(
        JSON.stringify({ success: false, error: 'Round state not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Check preconditions
    if (roundState.final_duel_status !== 'PENDING_RECHOICE') {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid state: ${roundState.final_duel_status}. Expected PENDING_RECHOICE.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (roundState.final_duel_challenger_num !== playerNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only the designated challenger can submit final tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Update player choice with final tokens
    const { error: choiceError } = await supabase
      .from('sheriff_player_choices')
      .update({
        tokens_entering_final: tokensEnteringFinal,
        tokens_entering_final_confirmed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('session_game_id', sessionGameId)
      .eq('player_number', playerNumber);

    if (choiceError) throw choiceError;

    // Create the final duel
    const { data: newDuel, error: duelInsertError } = await supabase
      .from('sheriff_duels')
      .insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        duel_order: roundState.total_duels + 1, // After all standard duels
        player1_number: roundState.unpaired_player_num,
        player2_number: playerNumber,
        status: 'PENDING', // Will be activated by MJ
        is_final: true,
      })
      .select()
      .single();

    if (duelInsertError) throw duelInsertError;

    // Update round state
    const { error: updateError } = await supabase
      .from('sheriff_round_state')
      .update({
        final_duel_id: newDuel.id,
        final_duel_status: 'READY',
        total_duels: roundState.total_duels + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('session_game_id', sessionGameId);

    if (updateError) throw updateError;

    // Get player names for logging
    const { data: players } = await supabase
      .from('game_players')
      .select('player_number, display_name')
      .eq('game_id', gameId)
      .in('player_number', [roundState.unpaired_player_num, playerNumber]);

    const unpairedName = players?.find(p => p.player_number === roundState.unpaired_player_num)?.display_name || `Joueur ${roundState.unpaired_player_num}`;
    const challengerName = players?.find(p => p.player_number === playerNumber)?.display_name || `Joueur ${playerNumber}`;
    const illegalCount = tokensEnteringFinal - 20;

    // Log event
    await supabase.from('session_events').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      type: 'SHERIFF_FINAL_DUEL_READY',
      message: `${challengerName} entre avec ${tokensEnteringFinal} jetons (${illegalCount} illégaux) pour le dernier duel contre ${unpairedName}`,
      audience: 'ALL',
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        finalDuelId: newDuel.id,
        tokensEnteringFinal,
        illegalCount,
        status: 'READY',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sheriff-submit-final-tokens error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
