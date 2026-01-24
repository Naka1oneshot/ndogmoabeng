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

function calculateDuelOutcome(
  p1Searches: boolean,
  p2Searches: boolean,
  p1HasIllegal: boolean,
  p2HasIllegal: boolean,
  p1IllegalCount: number,
  p2IllegalCount: number
): DuelResult {
  let p1VpDelta = 0;
  let p2VpDelta = 0;
  let p1TokensLost = 0;
  let p2TokensLost = 0;
  let p1Summary = '';
  let p2Summary = '';

  // Player 1 searches Player 2
  if (p1Searches) {
    if (p2HasIllegal) {
      // P1 found illegal tokens on P2
      p1VpDelta += p2IllegalCount; // Gain X% PV
      p2VpDelta -= p2IllegalCount; // Lose X% PV
      p2TokensLost = p2IllegalCount; // Lose illegal tokens
      p1Summary = `Fouille réussie ! +${p2IllegalCount}% PV`;
      p2Summary = `Pris en flagrant délit ! -${p2IllegalCount}% PV, -${p2IllegalCount} jetons`;
    } else {
      // P1 searched but P2 was legal
      p1VpDelta -= 10; // Lose 10% PV for false accusation
      p1Summary = `Fouille d'un voyageur légal. -10% PV`;
      p2Summary = `Vous étiez légal. Pas de pénalité.`;
    }
  } else {
    // P1 didn't search P2
    if (p2HasIllegal) {
      // P2 passed with illegal tokens
      p2VpDelta += p2IllegalCount; // Gain X% PV for successful smuggling
      p1Summary = `Vous avez laissé passer un contrebandier !`;
      p2Summary = `Passage réussi avec contrebande ! +${p2IllegalCount}% PV`;
    } else {
      p1Summary = `Vous avez laissé passer.`;
      p2Summary = `Passage sans encombre.`;
    }
  }

  // Player 2 searches Player 1
  if (p2Searches) {
    if (p1HasIllegal) {
      // P2 found illegal tokens on P1
      p2VpDelta += p1IllegalCount;
      p1VpDelta -= p1IllegalCount;
      p1TokensLost = p1IllegalCount;
      p2Summary += ` | Fouille réussie ! +${p1IllegalCount}% PV`;
      p1Summary += ` | Pris en flagrant délit ! -${p1IllegalCount}% PV, -${p1IllegalCount} jetons`;
    } else {
      // P2 searched but P1 was legal
      p2VpDelta -= 10;
      p2Summary += ` | Fouille d'un voyageur légal. -10% PV`;
      p1Summary += ` | Vous étiez légal. Pas de pénalité.`;
    }
  } else {
    // P2 didn't search P1
    if (p1HasIllegal) {
      // P1 passed with illegal tokens
      p1VpDelta += p1IllegalCount;
      p2Summary += ` | Vous avez laissé passer un contrebandier !`;
      p1Summary += ` | Passage réussi avec contrebande ! +${p1IllegalCount}% PV`;
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

    // Calculate duel outcome
    const p1IllegalCount = p1Choice.has_illegal_tokens ? 10 : 0;
    const p2IllegalCount = p2Choice.has_illegal_tokens ? 10 : 0;

    const result = calculateDuelOutcome(
      duel.player1_searches,
      duel.player2_searches,
      p1Choice.has_illegal_tokens,
      p2Choice.has_illegal_tokens,
      p1IllegalCount,
      p2IllegalCount
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

    // Update player choices with cumulative VP delta and final tokens
    await supabase
      .from('sheriff_player_choices')
      .update({
        victory_points_delta: (p1Choice.victory_points_delta || 0) + result.player1VpDelta,
        final_tokens: result.player1TokensLost > 0 ? 20 : p1Choice.tokens_entering,
      })
      .eq('id', p1Choice.id);

    await supabase
      .from('sheriff_player_choices')
      .update({
        victory_points_delta: (p2Choice.victory_points_delta || 0) + result.player2VpDelta,
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
