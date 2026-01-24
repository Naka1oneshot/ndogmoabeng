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
    const { gameId, sessionGameId, playerNumber, visaChoice, tokensEntering } = await req.json();

    if (!gameId || !sessionGameId || !playerNumber || !visaChoice || !tokensEntering) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate round state is in CHOICES phase
    const { data: roundState } = await supabase
      .from('sheriff_round_state')
      .select('phase')
      .eq('session_game_id', sessionGameId)
      .single();

    if (!roundState || roundState.phase !== 'CHOICES') {
      return new Response(
        JSON.stringify({ success: false, error: 'Phase de choix terminée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get player's current pvic for visa cost calculation
    const { data: player } = await supabase
      .from('game_players')
      .select('id, pvic')
      .eq('game_id', gameId)
      .eq('player_number', playerNumber)
      .single();

    if (!player) {
      return new Response(
        JSON.stringify({ success: false, error: 'Joueur non trouvé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Calculate visa cost
    let visaCostApplied = 0;
    if (visaChoice === 'VICTORY_POINTS') {
      visaCostApplied = (player.pvic || 0) * 0.2; // 20% of current PV
    } else if (visaChoice === 'COMMON_POOL') {
      visaCostApplied = 10; // 10€ from common pool
    }

    const hasIllegalTokens = tokensEntering > 20;

    // Update player choice
    const { error: updateError } = await supabase
      .from('sheriff_player_choices')
      .update({
        visa_choice: visaChoice,
        visa_cost_applied: visaCostApplied,
        tokens_entering: tokensEntering,
        has_illegal_tokens: hasIllegalTokens,
        updated_at: new Date().toISOString(),
      })
      .eq('session_game_id', sessionGameId)
      .eq('player_number', playerNumber);

    if (updateError) throw updateError;

    // If visa is paid from common pool, update the spent amount
    if (visaChoice === 'COMMON_POOL') {
      const { error: poolError } = await supabase.rpc('increment_sheriff_pool_spent', {
        p_session_game_id: sessionGameId,
        p_amount: 10
      });
      
      // Fallback if RPC doesn't exist
      if (poolError) {
        await supabase
          .from('sheriff_round_state')
          .update({ 
            common_pool_spent: supabase.rpc('raw', `common_pool_spent + 10`)
          })
          .eq('session_game_id', sessionGameId);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        visaChoice,
        tokensEntering,
        hasIllegalTokens,
        visaCostApplied
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sheriff-submit-choice error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
