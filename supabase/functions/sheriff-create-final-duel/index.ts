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
    const { gameId, sessionGameId } = await req.json();

    if (!gameId || !sessionGameId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing gameId or sessionGameId' }),
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
    if (!roundState.unpaired_player_num) {
      return new Response(
        JSON.stringify({ success: false, error: 'No unpaired player - final duel not applicable' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (roundState.final_duel_status !== 'NONE') {
      return new Response(
        JSON.stringify({ success: false, error: `Final duel already in progress: ${roundState.final_duel_status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check all standard duels are resolved
    const { data: pendingDuels, error: duelsError } = await supabase
      .from('sheriff_duels')
      .select('id, status')
      .eq('session_game_id', sessionGameId)
      .eq('is_final', false)
      .neq('status', 'RESOLVED');

    if (duelsError) throw duelsError;

    if (pendingDuels && pendingDuels.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `${pendingDuels.length} standard duels still pending. Complete all standard duels first.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get all player choices with their PVic changes
    const { data: choices, error: choicesError } = await supabase
      .from('sheriff_player_choices')
      .select('player_number, pvic_initial, victory_points_delta')
      .eq('session_game_id', sessionGameId);

    if (choicesError) throw choicesError;

    if (!choices || choices.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not enough players for final duel' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Find the player who lost the most PVic (biggest negative delta)
    // Exclude the unpaired player
    const eligibleChoices = choices.filter(c => c.player_number !== roundState.unpaired_player_num);
    
    if (eligibleChoices.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No eligible challenger found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calculate delta = victory_points_delta (cumulative visa + duel changes)
    // The player with the most negative delta is the "biggest loser"
    // Tie-breaker: smaller player_number
    let challenger = eligibleChoices[0];
    let minDelta = challenger.victory_points_delta || 0;

    for (const choice of eligibleChoices) {
      const delta = choice.victory_points_delta || 0;
      if (delta < minDelta || (delta === minDelta && choice.player_number < challenger.player_number)) {
        challenger = choice;
        minDelta = delta;
      }
    }

    // Update round state to PENDING_RECHOICE
    const { error: updateError } = await supabase
      .from('sheriff_round_state')
      .update({
        final_duel_challenger_num: challenger.player_number,
        final_duel_status: 'PENDING_RECHOICE',
        updated_at: new Date().toISOString(),
      })
      .eq('session_game_id', sessionGameId);

    if (updateError) throw updateError;

    // Get player names for logging
    const { data: players } = await supabase
      .from('game_players')
      .select('player_number, display_name')
      .eq('game_id', gameId)
      .in('player_number', [roundState.unpaired_player_num, challenger.player_number]);

    const unpairedName = players?.find(p => p.player_number === roundState.unpaired_player_num)?.display_name || `Joueur ${roundState.unpaired_player_num}`;
    const challengerName = players?.find(p => p.player_number === challenger.player_number)?.display_name || `Joueur ${challenger.player_number}`;

    // Log event
    await supabase.from('session_events').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      type: 'SHERIFF_FINAL_DUEL_INIT',
      message: `Dernier Duel: ${challengerName} (plus gros perdant PVic: ${minDelta.toFixed(1)}%) doit choisir ses jetons pour affronter ${unpairedName}`,
      audience: 'ALL',
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        unpairedPlayerNum: roundState.unpaired_player_num,
        unpairedPlayerName: unpairedName,
        challengerPlayerNum: challenger.player_number,
        challengerPlayerName: challengerName,
        challengerDelta: minDelta,
        status: 'PENDING_RECHOICE',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sheriff-create-final-duel error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
