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

    // Get next pending duel
    const { data: nextDuel, error: duelError } = await supabase
      .from('sheriff_duels')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('status', 'PENDING')
      .order('duel_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (duelError) throw duelError;

    if (!nextDuel) {
      // No more duels - game complete
      await supabase
        .from('sheriff_round_state')
        .update({
          phase: 'COMPLETE',
          updated_at: new Date().toISOString(),
        })
        .eq('session_game_id', sessionGameId);

      await supabase
        .from('games')
        .update({ status: 'ENDED', phase: 'RESOLUTION' })
        .eq('id', gameId);

      await supabase.from('session_events').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        type: 'SHERIFF_COMPLETE',
        message: 'Le contrôle d\'entrée est terminé !',
        audience: 'ALL',
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          gameComplete: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Activate this duel
    const { error: activateError } = await supabase
      .from('sheriff_duels')
      .update({ status: 'ACTIVE' })
      .eq('id', nextDuel.id);

    if (activateError) throw activateError;

    // Update round state
    const { error: stateError } = await supabase
      .from('sheriff_round_state')
      .update({
        current_duel_order: nextDuel.duel_order,
        updated_at: new Date().toISOString(),
      })
      .eq('session_game_id', sessionGameId);

    if (stateError) throw stateError;

    // Get player names
    const { data: players } = await supabase
      .from('game_players')
      .select('player_number, display_name')
      .eq('game_id', gameId)
      .in('player_number', [nextDuel.player1_number, nextDuel.player2_number]);

    const p1Name = players?.find(p => p.player_number === nextDuel.player1_number)?.display_name || `Joueur ${nextDuel.player1_number}`;
    const p2Name = players?.find(p => p.player_number === nextDuel.player2_number)?.display_name || `Joueur ${nextDuel.player2_number}`;

    // Log event
    await supabase.from('session_events').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      type: 'SHERIFF_DUEL_START',
      message: `Duel #${nextDuel.duel_order}: ${p1Name} vs ${p2Name}`,
      audience: 'ALL',
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        currentDuel: nextDuel.duel_order,
        player1: nextDuel.player1_number,
        player2: nextDuel.player2_number,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sheriff-next-duel error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
