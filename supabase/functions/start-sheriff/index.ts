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
    const { gameId, sessionGameId, initialPool, poolCostPerPlayer, poolFloorPercent } = await req.json();

    if (!gameId || !sessionGameId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing gameId or sessionGameId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use provided values or defaults
    const commonPoolInitial = typeof initialPool === 'number' && initialPool >= 0 ? initialPool : 100;
    const costPerPlayer = typeof poolCostPerPlayer === 'number' && poolCostPerPlayer > 0 ? poolCostPerPlayer : 10;
    const floorPercent = typeof poolFloorPercent === 'number' && poolFloorPercent >= 0 ? poolFloorPercent : 40;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get active players
    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('id, player_number, jetons, pvic')
      .eq('game_id', gameId)
      .eq('status', 'ACTIVE')
      .eq('is_host', false)
      .not('player_number', 'is', null)
      .order('player_number');

    if (playersError) throw playersError;

    if (!players || players.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Minimum 2 joueurs requis' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create round state with pool config
    const poolConfig = {
      cost_per_player: costPerPlayer,
      floor_percent: floorPercent,
    };
    
    const { error: stateError } = await supabase
      .from('sheriff_round_state')
      .upsert({
        game_id: gameId,
        session_game_id: sessionGameId,
        phase: 'CHOICES',
        current_duel_order: null,
        total_duels: 0,
        common_pool_initial: commonPoolInitial,
        common_pool_spent: 0,
        bot_config: poolConfig, // Store pool settings in bot_config for now
      }, { onConflict: 'session_game_id' });

    if (stateError) throw stateError;

    // Initialize all player tokens to 20
    const playerIds = players.map(p => p.id);
    const { error: tokensError } = await supabase
      .from('game_players')
      .update({ jetons: 20 })
      .in('id', playerIds);

    if (tokensError) throw tokensError;

    // Initialize player choices with initial PVic snapshot
    const choicesInsert = players.map(p => ({
      game_id: gameId,
      session_game_id: sessionGameId,
      player_id: p.id,
      player_number: p.player_number,
      visa_choice: null,
      tokens_entering: null,
      has_illegal_tokens: false,
      pvic_initial: p.pvic ?? 0, // Capture PVic at start of Sheriff game
    }));

    const { error: choicesError } = await supabase
      .from('sheriff_player_choices')
      .upsert(choicesInsert, { onConflict: 'session_game_id,player_number' });

    if (choicesError) throw choicesError;

    // Update game status
    const { error: gameError } = await supabase
      .from('games')
      .update({ status: 'IN_GAME', phase: 'PHASE1_CHOICES' })
      .eq('id', gameId);

    if (gameError) throw gameError;

    // Update session game status
    const { error: sessionError } = await supabase
      .from('session_games')
      .update({ status: 'Running' })
      .eq('id', sessionGameId);

    if (sessionError) throw sessionError;

    // Log event
    await supabase.from('session_events').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      type: 'SHERIFF_START',
      message: `Le Shérif de Ndogmoabeng commence avec ${players.length} voyageurs`,
      audience: 'ALL',
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        playerCount: players.length,
        phase: 'CHOICES'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('start-sheriff error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
