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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { gameId, sessionGameId, currentManche } = await req.json();
    const newManche = currentManche + 1;

    console.log('[next-infection-round] Starting:', { gameId, sessionGameId, currentManche, newManche });

    // 1. Verify current round is RESOLVED
    const { data: currentRound, error: roundError } = await supabase
      .from('infection_round_state')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('manche', currentManche)
      .single();

    if (roundError || !currentRound) {
      throw new Error(`Current round not found: ${roundError?.message}`);
    }

    if (currentRound.status !== 'RESOLVED') {
      throw new Error(`Current round is not RESOLVED (status: ${currentRound.status})`);
    }

    // 2. Check if new round already exists (idempotency)
    const { data: existingRound } = await supabase
      .from('infection_round_state')
      .select('id, status')
      .eq('session_game_id', sessionGameId)
      .eq('manche', newManche)
      .maybeSingle();

    if (existingRound) {
      console.log('[next-infection-round] Round already exists:', { newManche, status: existingRound.status });
      return new Response(
        JSON.stringify({
          success: true,
          message: `Manche ${newManche} existe déjà`,
          data: { newManche, alreadyExists: true },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 3. Calculate SY required success based on alive SY count
    const { data: aliveSY } = await supabase
      .from('game_players')
      .select('id')
      .eq('game_id', gameId)
      .eq('role_code', 'SY')
      .eq('is_alive', true)
      .is('removed_at', null);

    const syCount = aliveSY?.length || 0;
    const syRequiredSuccess = syCount >= 2 ? 2 : 3;

    // 4. Create new round state
    const { error: newRoundError } = await supabase
      .from('infection_round_state')
      .insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: newManche,
        status: 'OPEN',
        sy_success_count: currentRound.sy_success_count || 0,
        sy_required_success: syRequiredSuccess,
        opened_at: new Date().toISOString(),
      });

    if (newRoundError) {
      throw new Error(`Failed to create new round: ${newRoundError.message}`);
    }

    // 4. Give BA +1 bullet (max 2)
    const { data: baPlayer } = await supabase
      .from('game_players')
      .select('id, player_number')
      .eq('game_id', gameId)
      .eq('role_code', 'BA')
      .eq('is_alive', true)
      .is('removed_at', null)
      .single();

    if (baPlayer) {
      const { data: baBullets } = await supabase
        .from('inventory')
        .select('id, quantite')
        .eq('session_game_id', sessionGameId)
        .eq('owner_num', baPlayer.player_number)
        .eq('objet', 'Balle BA')
        .single();

      if (baBullets) {
        const newQty = Math.min((baBullets.quantite || 0) + 1, 2);
        await supabase
          .from('inventory')
          .update({ quantite: newQty })
          .eq('id', baBullets.id);
        console.log('[next-infection-round] BA bullet updated:', { old: baBullets.quantite, new: newQty });
      } else {
        // Create bullet if somehow missing
        await supabase
          .from('inventory')
          .insert({
            game_id: gameId,
            session_game_id: sessionGameId,
            owner_num: baPlayer.player_number,
            objet: 'Balle BA',
            quantite: 1,
            disponible: true,
            dispo_attaque: true,
          });
      }
    }

    // 5. Give OC +1 crystal ball (max 1)
    const { data: ocPlayer } = await supabase
      .from('game_players')
      .select('id, player_number')
      .eq('game_id', gameId)
      .eq('role_code', 'OC')
      .eq('is_alive', true)
      .is('removed_at', null)
      .single();

    if (ocPlayer) {
      const { data: ocCrystal } = await supabase
        .from('inventory')
        .select('id, quantite')
        .eq('session_game_id', sessionGameId)
        .eq('owner_num', ocPlayer.player_number)
        .eq('objet', 'Boule de cristal')
        .single();

      if (ocCrystal) {
        if ((ocCrystal.quantite || 0) < 1) {
          await supabase
            .from('inventory')
            .update({ quantite: 1 })
            .eq('id', ocCrystal.id);
        }
      } else {
        await supabase
          .from('inventory')
          .insert({
            game_id: gameId,
            session_game_id: sessionGameId,
            owner_num: ocPlayer.player_number,
            objet: 'Boule de cristal',
            quantite: 1,
            disponible: true,
            dispo_attaque: false,
          });
      }
    }

    // 6. Update session_game and game
    await supabase
      .from('session_games')
      .update({ manche_active: newManche, phase: 'OPEN' })
      .eq('id', sessionGameId);

    await supabase
      .from('games')
      .update({ manche_active: newManche, phase: 'OPEN' })
      .eq('id', gameId);

    // 7. Log event
    await supabase.from('game_events').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      event_type: 'ROUND_START',
      message: `🌙 Manche ${newManche} ouverte.`,
      manche: newManche,
      phase: 'OPEN',
      visibility: 'PUBLIC',
    });

    console.log('[next-infection-round] Success:', { newManche });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Manche ${newManche} ouverte`,
        data: { newManche, syRequiredSuccess },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[next-infection-round] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
