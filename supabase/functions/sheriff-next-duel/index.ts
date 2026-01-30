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
      // Check if this is an ADVENTURE game
      const { data: game } = await supabase
        .from('games')
        .select('mode, adventure_id')
        .eq('id', gameId)
        .single();

      const isAdventure = game?.mode === 'ADVENTURE';

      // Calculate final PVic for all players
      const { data: choices } = await supabase
        .from('sheriff_player_choices')
        .select('player_id, player_number, pvic_initial, tokens_entering, visa_choice, has_illegal_tokens')
        .eq('session_game_id', sessionGameId);

      // Get all duels for delta calculation
      const { data: allDuels } = await supabase
        .from('sheriff_duels')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .eq('status', 'RESOLVED');

      // Calculate PVic deltas
      const pvicDeltas: Record<string, number> = {};
      
      for (const choice of choices || []) {
        const playerId = choice.player_id;
        let delta = choice.pvic_initial || 0;
        
        // Sum up duel outcomes
        for (const duel of allDuels || []) {
          if (duel.player1_id === playerId) {
            delta += duel.player1_pvic_delta || 0;
          } else if (duel.player2_id === playerId) {
            delta += duel.player2_pvic_delta || 0;
          }
        }
        
        // Add visa bonus
        if (choice.visa_choice === 'POOL') {
          // Pool visa gives 50% of cost as PVic
          const costPerPlayer = 5; // Default
          delta += Math.floor(costPerPlayer * 0.5);
        }
        
        pvicDeltas[playerId] = delta;
      }

      // Update player PVic values
      for (const [playerId, pvicFinal] of Object.entries(pvicDeltas)) {
        await supabase
          .from('game_players')
          .update({ pvic: pvicFinal })
          .eq('id', playerId);
        
        console.log(`[sheriff-next-duel] Updated player ${playerId} pvic to ${pvicFinal}`);
      }

      // Update adventure_scores if in adventure mode
      if (isAdventure) {
        for (const choice of choices || []) {
          const playerId = choice.player_id;
          const pvicFinal = pvicDeltas[playerId] || 0;
          const pvicInitial = choice.pvic_initial || 0;
          const sheriffDelta = pvicFinal - pvicInitial;

          // Save to stage_scores
          await supabase.from('stage_scores').upsert({
            session_game_id: sessionGameId,
            game_player_id: playerId,
            score_value: sheriffDelta,
            details: {
              pvic_initial: pvicInitial,
              pvic_final: pvicFinal,
              delta: sheriffDelta,
            },
          }, { onConflict: 'session_game_id,game_player_id' });

          // Update adventure_scores
          const { data: existingScore } = await supabase
            .from('adventure_scores')
            .select('id, total_score_value, breakdown')
            .eq('session_id', gameId)
            .eq('game_player_id', playerId)
            .maybeSingle();

          if (existingScore) {
            const breakdown = existingScore.breakdown || {};
            breakdown[sessionGameId] = sheriffDelta;
            const newTotal = Object.values(breakdown).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);

            await supabase
              .from('adventure_scores')
              .update({ 
                total_score_value: newTotal, 
                breakdown, 
                updated_at: new Date().toISOString() 
              })
              .eq('id', existingScore.id);
          } else {
            await supabase.from('adventure_scores').insert({
              session_id: gameId,
              game_player_id: playerId,
              total_score_value: sheriffDelta,
              breakdown: { [sessionGameId]: sheriffDelta },
            });
          }
        }
      }

      // Update sheriff round state
      await supabase
        .from('sheriff_round_state')
        .update({
          phase: 'COMPLETE',
          updated_at: new Date().toISOString(),
        })
        .eq('session_game_id', sessionGameId);

      // Mark session_game as ENDED
      await supabase
        .from('session_games')
        .update({ status: 'ENDED', ended_at: new Date().toISOString() })
        .eq('id', sessionGameId);

      if (isAdventure) {
        // In ADVENTURE mode, don't end the main game - just mark session complete
        await supabase
          .from('games')
          .update({ phase: 'SESSION_COMPLETE' })
          .eq('id', gameId);
        
        console.log(`[sheriff-next-duel] Adventure mode - marked session complete, not ending game`);
      } else {
        // In standalone mode, end the game
        await supabase
          .from('games')
          .update({ status: 'ENDED', phase: 'RESOLUTION' })
          .eq('id', gameId);
      }

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
          isAdventure,
          pvicDeltas,
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
