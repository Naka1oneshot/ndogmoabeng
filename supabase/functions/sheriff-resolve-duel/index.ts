import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DuelResult {
  player1VpDelta: number;
  player2VpDelta: number;
  player1TokensLost: number;
  player2TokensLost: number;
  summary: {
    player1: string;
    player2: string;
  };
}

interface DuelConfig {
  gainPerIllegalFound: number;   // % gain per illegal token found (default 10)
  lossSearchNoIllegal: number;   // % loss if search finds 0 illegal (default 50)
  gainPerIllegalPassed: number;  // % gain per illegal token passed unsearched (default 10)
  lossPerIllegalCaught: number;  // % loss per illegal token when caught (default 10)
}

// Calculate number of illegal tokens (tokens beyond 20)
function getIllegalTokenCount(tokensEntering: number): number {
  return Math.max(0, (tokensEntering || 20) - 20);
}

function calculateDuelOutcome(
  p1Searches: boolean,
  p2Searches: boolean,
  p1HasIllegal: boolean,
  p2HasIllegal: boolean,
  p1TokensEntering: number,
  p2TokensEntering: number,
  config: DuelConfig
): DuelResult {
  let p1VpDelta = 0;
  let p2VpDelta = 0;
  let p1TokensLost = 0;
  let p2TokensLost = 0;
  let p1Summary = '';
  let p2Summary = '';

  // Calculate illegal token counts
  const p1IllegalCount = getIllegalTokenCount(p1TokensEntering);
  const p2IllegalCount = getIllegalTokenCount(p2TokensEntering);

  // Player 1 searches Player 2
  if (p1Searches) {
    if (p2HasIllegal && p2IllegalCount > 0) {
      // P1 found illegal tokens on P2
      const p1Gain = p2IllegalCount * config.gainPerIllegalFound;
      const p2Loss = p2IllegalCount * config.lossPerIllegalCaught;
      p1VpDelta += p1Gain;
      p2VpDelta -= p2Loss;
      p2TokensLost = p2IllegalCount;
      p1Summary = `Fouille réussie ! +${p1Gain}% PV (${p2IllegalCount} jetons × ${config.gainPerIllegalFound}%)`;
      p2Summary = `Pris en flagrant délit ! -${p2Loss}% PV, -${p2IllegalCount} jetons`;
    } else {
      // P1 searched but P2 was legal - fixed penalty
      p1VpDelta -= config.lossSearchNoIllegal;
      p1Summary = `Fouille d'un voyageur légal. -${config.lossSearchNoIllegal}% PV`;
      p2Summary = `Vous étiez légal. Pas de pénalité.`;
    }
  } else {
    // P1 didn't search P2
    if (p2HasIllegal && p2IllegalCount > 0) {
      // P2 passed with illegal tokens
      const p2Gain = p2IllegalCount * config.gainPerIllegalPassed;
      p2VpDelta += p2Gain;
      p1Summary = `Vous avez laissé passer un contrebandier !`;
      p2Summary = `Passage réussi avec contrebande ! +${p2Gain}% PV (${p2IllegalCount} jetons × ${config.gainPerIllegalPassed}%)`;
    } else {
      p1Summary = `Vous avez laissé passer.`;
      p2Summary = `Passage sans encombre.`;
    }
  }

  // Player 2 searches Player 1
  if (p2Searches) {
    if (p1HasIllegal && p1IllegalCount > 0) {
      // P2 found illegal tokens on P1
      const p2Gain = p1IllegalCount * config.gainPerIllegalFound;
      const p1Loss = p1IllegalCount * config.lossPerIllegalCaught;
      p2VpDelta += p2Gain;
      p1VpDelta -= p1Loss;
      p1TokensLost = p1IllegalCount;
      p2Summary += ` | Fouille réussie ! +${p2Gain}% PV (${p1IllegalCount} jetons × ${config.gainPerIllegalFound}%)`;
      p1Summary += ` | Pris en flagrant délit ! -${p1Loss}% PV, -${p1IllegalCount} jetons`;
    } else {
      // P2 searched but P1 was legal - fixed penalty
      p2VpDelta -= config.lossSearchNoIllegal;
      p2Summary += ` | Fouille d'un voyageur légal. -${config.lossSearchNoIllegal}% PV`;
      p1Summary += ` | Vous étiez légal. Pas de pénalité.`;
    }
  } else {
    // P2 didn't search P1
    if (p1HasIllegal && p1IllegalCount > 0) {
      // P1 passed with illegal tokens
      const p1Gain = p1IllegalCount * config.gainPerIllegalPassed;
      p1VpDelta += p1Gain;
      p2Summary += ` | Vous avez laissé passer un contrebandier !`;
      p1Summary += ` | Passage réussi avec contrebande ! +${p1Gain}% PV (${p1IllegalCount} jetons × ${config.gainPerIllegalPassed}%)`;
    } else {
      p2Summary += ` | Vous avez laissé passer.`;
      p1Summary += ` | Passage sans encombre.`;
    }
  }

  return {
    player1VpDelta: p1VpDelta,
    player2VpDelta: p2VpDelta,
    player1TokensLost: p1TokensLost,
    player2TokensLost: p2TokensLost,
    summary: {
      player1: p1Summary,
      player2: p2Summary,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, sessionGameId, duelId } = await req.json();

    if (!gameId || !sessionGameId || !duelId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get the duel
    const { data: duel, error: duelError } = await supabase
      .from('sheriff_duels')
      .select('*')
      .eq('id', duelId)
      .single();

    if (duelError || !duel) {
      return new Response(
        JSON.stringify({ success: false, error: 'Duel non trouvé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (duel.status !== 'ACTIVE') {
      return new Response(
        JSON.stringify({ success: false, error: 'Ce duel n\'est pas actif' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (duel.player1_searches === null || duel.player2_searches === null) {
      return new Response(
        JSON.stringify({ success: false, error: 'Les deux joueurs n\'ont pas encore décidé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get player choices
    const { data: choices, error: choicesError } = await supabase
      .from('sheriff_player_choices')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .in('player_number', [duel.player1_number, duel.player2_number]);

    if (choicesError) throw choicesError;

    const p1Choice = choices?.find(c => c.player_number === duel.player1_number);
    const p2Choice = choices?.find(c => c.player_number === duel.player2_number);

    if (!p1Choice || !p2Choice) {
      return new Response(
        JSON.stringify({ success: false, error: 'Choix des joueurs non trouvés' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get round state config for duel parameters
    const { data: roundState } = await supabase
      .from('sheriff_round_state')
      .select('bot_config')
      .eq('session_game_id', sessionGameId)
      .single();

    const botConfig = (roundState?.bot_config as {
      duel_gain_per_illegal_found?: number;
      duel_loss_search_no_illegal?: number;
      duel_gain_per_illegal_passed?: number;
      duel_loss_per_illegal_caught?: number;
    } | null) || {};

    // Build duel config with defaults
    const duelConfig: DuelConfig = {
      gainPerIllegalFound: botConfig.duel_gain_per_illegal_found ?? 10,
      lossSearchNoIllegal: botConfig.duel_loss_search_no_illegal ?? 50,
      gainPerIllegalPassed: botConfig.duel_gain_per_illegal_passed ?? 10,
      lossPerIllegalCaught: botConfig.duel_loss_per_illegal_caught ?? 5,
    };

    // Calculate duel outcome with configurable parameters
    const result = calculateDuelOutcome(
      duel.player1_searches,
      duel.player2_searches,
      p1Choice.has_illegal_tokens,
      p2Choice.has_illegal_tokens,
      p1Choice.tokens_entering || 20,
      p2Choice.tokens_entering || 20,
      duelConfig
    );

    // Update duel with results
    const { error: updateDuelError } = await supabase
      .from('sheriff_duels')
      .update({
        status: 'RESOLVED',
        player1_vp_delta: result.player1VpDelta,
        player2_vp_delta: result.player2VpDelta,
        player1_tokens_lost: result.player1TokensLost,
        player2_tokens_lost: result.player2TokensLost,
        resolution_summary: result.summary,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', duelId);

    if (updateDuelError) throw updateDuelError;

    // Update player choices with cumulative VP delta (visa + duels) and final tokens
    // This accumulates duel results into victory_points_delta for real-time tracking
    const newP1Delta = (p1Choice.victory_points_delta || 0) + result.player1VpDelta;
    const newP2Delta = (p2Choice.victory_points_delta || 0) + result.player2VpDelta;

    await supabase
      .from('sheriff_player_choices')
      .update({
        victory_points_delta: newP1Delta,
        final_tokens: result.player1TokensLost > 0 ? 20 : p1Choice.tokens_entering,
      })
      .eq('id', p1Choice.id);

    await supabase
      .from('sheriff_player_choices')
      .update({
        victory_points_delta: newP2Delta,
        final_tokens: result.player2TokensLost > 0 ? 20 : p2Choice.tokens_entering,
      })
      .eq('id', p2Choice.id);

    // Update game_players jetons for both players
    // Player1: if caught with illegal tokens, reset to 20; otherwise keep their tokens_entering
    const p1FinalTokens = result.player1TokensLost > 0 ? 20 : (p1Choice.tokens_entering || 20);
    await supabase
      .from('game_players')
      .update({ jetons: p1FinalTokens })
      .eq('game_id', gameId)
      .eq('player_number', duel.player1_number);

    // Player2: if caught with illegal tokens, reset to 20; otherwise keep their tokens_entering
    const p2FinalTokens = result.player2TokensLost > 0 ? 20 : (p2Choice.tokens_entering || 20);
    await supabase
      .from('game_players')
      .update({ jetons: p2FinalTokens })
      .eq('game_id', gameId)
      .eq('player_number', duel.player2_number);

    // Get player names
    const { data: players } = await supabase
      .from('game_players')
      .select('player_number, display_name')
      .eq('game_id', gameId)
      .in('player_number', [duel.player1_number, duel.player2_number]);

    const p1Name = players?.find(p => p.player_number === duel.player1_number)?.display_name || `Joueur ${duel.player1_number}`;
    const p2Name = players?.find(p => p.player_number === duel.player2_number)?.display_name || `Joueur ${duel.player2_number}`;

    // Log event
    await supabase.from('session_events').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      type: 'SHERIFF_DUEL_RESOLVED',
      message: `Duel résolu: ${p1Name} (${result.player1VpDelta > 0 ? '+' : ''}${result.player1VpDelta}%) vs ${p2Name} (${result.player2VpDelta > 0 ? '+' : ''}${result.player2VpDelta}%)`,
      audience: 'ALL',
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sheriff-resolve-duel error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
