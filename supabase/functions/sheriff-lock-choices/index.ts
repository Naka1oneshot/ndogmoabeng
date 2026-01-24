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

    // Get all players with their choices (including visa_choice and visa_cost_applied)
    const { data: choices, error: choicesError } = await supabase
      .from('sheriff_player_choices')
      .select('player_number, has_illegal_tokens, visa_choice, visa_cost_applied')
      .eq('session_game_id', sessionGameId)
      .not('visa_choice', 'is', null);

    if (choicesError) throw choicesError;

    // Calculate total pool spent from COMMON_POOL visa choices
    const totalPoolSpent = choices
      ?.filter(c => c.visa_choice === 'COMMON_POOL')
      .reduce((sum, c) => sum + (c.visa_cost_applied || 0), 0) || 0;

    // Get players with mate info to avoid same-team duels
    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('player_number, mate_num')
      .eq('game_id', gameId)
      .eq('status', 'ACTIVE')
      .eq('is_host', false)
      .not('player_number', 'is', null);

    if (playersError) throw playersError;

    if (!players || players.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pas assez de joueurs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build mate pairs map
    const matePairs = new Map<number, number>();
    for (const p of players) {
      if (p.mate_num) {
        matePairs.set(p.player_number, p.mate_num);
      }
    }

    // Generate random duels avoiding same-team pairs
    const playerNumbers = players.map(p => p.player_number);
    const shuffled = [...playerNumbers].sort(() => Math.random() - 0.5);
    
    const duels: { player1: number; player2: number }[] = [];
    const used = new Set<number>();

    for (let i = 0; i < shuffled.length; i++) {
      if (used.has(shuffled[i])) continue;
      
      for (let j = i + 1; j < shuffled.length; j++) {
        if (used.has(shuffled[j])) continue;
        
        const p1 = shuffled[i];
        const p2 = shuffled[j];
        
        // Check if they are mates (same team)
        const areMates = matePairs.get(p1) === p2 || matePairs.get(p2) === p1;
        
        if (!areMates) {
          duels.push({ player1: p1, player2: p2 });
          used.add(p1);
          used.add(p2);
          break;
        }
      }
    }

    // If odd number of players, one player doesn't have a duel (that's ok)
    // Insert duels
    const duelsInsert = duels.map((d, idx) => ({
      game_id: gameId,
      session_game_id: sessionGameId,
      duel_order: idx + 1,
      player1_number: d.player1,
      player2_number: d.player2,
      status: 'PENDING',
    }));

    if (duelsInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('sheriff_duels')
        .insert(duelsInsert);

      if (insertError) throw insertError;
    }

    // Update round state with pool spent
    const { error: stateError } = await supabase
      .from('sheriff_round_state')
      .update({
        phase: 'DUELS',
        total_duels: duels.length,
        current_duel_order: null, // Will be set when first duel is activated
        common_pool_spent: totalPoolSpent,
        updated_at: new Date().toISOString(),
      })
      .eq('session_game_id', sessionGameId);

    if (stateError) throw stateError;

    // Update game phase
    await supabase
      .from('games')
      .update({ phase: 'PHASE2_DUELS' })
      .eq('id', gameId);

    // Log event
    await supabase.from('session_events').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      type: 'SHERIFF_DUELS_START',
      message: `${duels.length} duels générés. Les confrontations commencent !`,
      audience: 'ALL',
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        duelsGenerated: duels.length,
        phase: 'DUELS'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sheriff-lock-choices error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
