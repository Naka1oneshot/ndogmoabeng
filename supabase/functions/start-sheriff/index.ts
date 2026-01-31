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
    const { gameId, sessionGameId, initialPool, poolCostPerPlayer, poolFloorPercent, visaPvicPercent, duelMaxImpact } = await req.json();

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

    // Get game info to check for adventure mode
    const { data: game } = await supabase
      .from('games')
      .select('mode, adventure_id, starting_tokens')
      .eq('id', gameId)
      .single();

    const isAdventureMode = game?.mode === 'ADVENTURE';

    // Default values
    let commonPoolInitial = typeof initialPool === 'number' && initialPool >= 0 ? initialPool : 100;
    let costPerPlayer = typeof poolCostPerPlayer === 'number' && poolCostPerPlayer > 0 ? poolCostPerPlayer : 5;
    let floorPercent = typeof poolFloorPercent === 'number' && poolFloorPercent >= 0 ? poolFloorPercent : 40;
    let pvicPercent = typeof visaPvicPercent === 'number' && visaPvicPercent > 0 ? visaPvicPercent : 50;
    let maxDuelImpact = typeof duelMaxImpact === 'number' && duelMaxImpact > 0 ? duelMaxImpact : 10;

    // Token policy: in adventure mode, use games.starting_tokens (set by next-session-game)
    // In standalone mode, default to 20
    let startingTokens = 20; // Default for standalone mode
    
    // Load adventure config if in ADVENTURE mode
    if (isAdventureMode && game.adventure_id) {
      console.log(`[start-sheriff] Adventure mode detected, loading config for game: ${gameId}`);
      
      // In adventure mode, starting_tokens should already be set by next-session-game
      // based on the adventure config token_policy
      startingTokens = game.starting_tokens ?? 20;
      console.log(`[start-sheriff] Using games.starting_tokens from adventure: ${startingTokens}`);
      
      const { data: agc, error: agcError } = await supabase
        .from('adventure_game_configs')
        .select('config')
        .eq('game_id', gameId)
        .single();
      
      if (agcError) {
        console.error('[start-sheriff] Error loading adventure config:', agcError);
      } else if (agc?.config) {
        const adventureConfig = agc.config as any;
        console.log('[start-sheriff] Adventure config loaded');
        
        // Apply sheriff_config from adventure
        const sheriffConfig = adventureConfig.sheriff_config;
        if (sheriffConfig) {
          if (typeof sheriffConfig.cost_per_player === 'number') {
            costPerPlayer = sheriffConfig.cost_per_player;
          }
          if (typeof sheriffConfig.floor_percent === 'number') {
            floorPercent = sheriffConfig.floor_percent;
          }
          if (typeof sheriffConfig.visa_pvic_percent === 'number') {
            pvicPercent = sheriffConfig.visa_pvic_percent;
          }
          if (typeof sheriffConfig.duel_max_impact === 'number') {
            maxDuelImpact = sheriffConfig.duel_max_impact;
          }
          console.log(`[start-sheriff] Using adventure config: costPerPlayer=${costPerPlayer}, floorPercent=${floorPercent}, pvicPercent=${pvicPercent}, maxDuelImpact=${maxDuelImpact}`);
        }
        
        // Apply adventure_pot - use currentAmount if set, otherwise initialAmount
        // This handles: initial config, after penalties, and edge case where currentAmount is 0
        const adventurePot = adventureConfig.adventure_pot;
        if (adventurePot) {
          // Priority: currentAmount (may be 0 after penalties) > initialAmount > default
          if (typeof adventurePot.currentAmount === 'number') {
            commonPoolInitial = adventurePot.currentAmount;
            console.log(`[start-sheriff] Using adventure pot currentAmount: ${commonPoolInitial}`);
          } else if (typeof adventurePot.initialAmount === 'number') {
            commonPoolInitial = adventurePot.initialAmount;
            console.log(`[start-sheriff] Using adventure pot initialAmount (no currentAmount set): ${commonPoolInitial}`);
          }
        }
      }
    }

    // Get active players (ALWAYS exclude host)
    const { data: players, error: playersError } = await supabase
      .from('game_players')
      .select('id, player_number, jetons, pvic, clan')
      .eq('game_id', gameId)
      .eq('status', 'ACTIVE')
      .eq('is_host', false)
      .is('removed_at', null)
      .not('player_number', 'is', null)
      .order('player_number');

    if (playersError) throw playersError;
    
    console.log(`[start-sheriff] Players found: ${players?.length || 0} (excluding host)`);

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
      visa_pvic_percent: pvicPercent,
      duel_max_impact: maxDuelImpact,
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
        bot_config: poolConfig,
      }, { onConflict: 'session_game_id' });

    if (stateError) throw stateError;

    // Initialize player tokens
    // In adventure mode, tokens are already set by next-session-game based on token_policy
    // In standalone mode, set to startingTokens (default 20)
    const playerIds = players.map(p => p.id);
    
    if (!isAdventureMode) {
      // Standalone mode: reset tokens to default (20)
      const { error: tokensError } = await supabase
        .from('game_players')
        .update({ jetons: startingTokens })
        .in('id', playerIds);

      if (tokensError) throw tokensError;
      console.log(`[start-sheriff] Standalone mode: set all players to ${startingTokens} tokens`);
    } else {
      // Adventure mode: tokens already set by next-session-game, just log current state
      console.log(`[start-sheriff] Adventure mode: preserving tokens set by next-session-game`);
      for (const p of players) {
        console.log(`[start-sheriff] Player ${p.player_number}: jetons=${p.jetons}, pvic=${p.pvic}`);
      }
    }

    // Initialize player choices with initial PVic snapshot
    // First, delete any existing choices to ensure fresh insert with correct pvic_initial
    await supabase
      .from('sheriff_player_choices')
      .delete()
      .eq('session_game_id', sessionGameId);

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
      .insert(choicesInsert);

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
      .update({ status: 'RUNNING' })
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

    // Log debug info for MJ
    if (isAdventureMode) {
      await supabase.from('session_events').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        type: 'DEBUG',
        message: `🤠 Sheriff initialisé: ${startingTokens} jetons (adventure), pool=${commonPoolInitial}`,
        audience: 'MJ',
        payload: { startingTokens, commonPoolInitial, poolConfig, isAdventureMode: true },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        playerCount: players.length,
        phase: 'CHOICES',
        startingTokens,
        isAdventureMode,
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
