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

    // Validate round state is in CHOICES phase and get config
    const { data: roundState } = await supabase
      .from('sheriff_round_state')
      .select('phase, bot_config')
      .eq('session_game_id', sessionGameId)
      .single();

    if (!roundState || roundState.phase !== 'CHOICES') {
      return new Response(
        JSON.stringify({ success: false, error: 'Phase de choix terminée' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get config values
    const config = (roundState.bot_config as { visa_pvic_percent?: number; cost_per_player?: number } | null) || {};
    const visaPvicPercent = config.visa_pvic_percent || 20;
    const poolCostPerPlayer = config.cost_per_player || 10;

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

    // Calculate visa cost - visaCostApplied stores the absolute amount for display
    // victoryPointsDelta stores the PERCENTAGE for consistent scoring with duels
    let visaCostApplied = 0;
    let victoryPointsDelta = 0;
    
    if (visaChoice === 'VICTORY_POINTS') {
      // Cost is X% of PVic - store absolute value for display
      visaCostApplied = (player.pvic || 0) * (visaPvicPercent / 100);
      // Store as PERCENTAGE delta (negative) for scoring formula consistency
      victoryPointsDelta = -visaPvicPercent;
    } else if (visaChoice === 'COMMON_POOL') {
      visaCostApplied = poolCostPerPlayer;
      victoryPointsDelta = 0; // No PVic impact for pool payment
    }

    const hasIllegalTokens = tokensEntering > 20;

    // Update player choice with immediate PVic delta for real-time display
    const { error: updateError } = await supabase
      .from('sheriff_player_choices')
      .update({
        visa_choice: visaChoice,
        visa_cost_applied: visaCostApplied,
        tokens_entering: tokensEntering,
        has_illegal_tokens: hasIllegalTokens,
        victory_points_delta: victoryPointsDelta,
        updated_at: new Date().toISOString(),
      })
      .eq('session_game_id', sessionGameId)
      .eq('player_number', playerNumber);

    if (updateError) throw updateError;

    // If visa is paid from common pool, update the spent amount with configured cost
    if (visaChoice === 'COMMON_POOL') {
      const { error: poolError } = await supabase.rpc('increment_sheriff_pool_spent', {
        p_session_game_id: sessionGameId,
        p_amount: poolCostPerPlayer
      });
      
      // Fallback if RPC doesn't exist
      if (poolError) {
        await supabase
          .from('sheriff_round_state')
          .update({ 
            common_pool_spent: supabase.rpc('raw', `common_pool_spent + ${poolCostPerPlayer}`)
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
