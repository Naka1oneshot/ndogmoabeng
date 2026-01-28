import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShotPayload {
  gameId: string;
  sessionGameId: string;
  manche: number;
  shooterNum: number;
  shooterRole: 'BA' | 'PV';
  targetNum: number | null; // null means cancel the shot
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ShotPayload = await req.json();
    const { gameId, sessionGameId, manche, shooterNum, shooterRole, targetNum } = payload;

    console.log('[infection-submit-shot] Received:', payload);

    // 1. Verify round is OPEN
    const { data: roundState } = await supabase
      .from('infection_round_state')
      .select('status')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .single();

    if (!roundState || roundState.status !== 'OPEN') {
      throw new Error('Round is not open');
    }

    // 2. Verify shooter is alive and has the right role
    const { data: shooter } = await supabase
      .from('game_players')
      .select('id, is_alive, role_code, player_number')
      .eq('game_id', gameId)
      .eq('player_number', shooterNum)
      .is('removed_at', null)
      .single();

    if (!shooter || !shooter.is_alive) {
      throw new Error('Shooter is not alive');
    }

    if (shooter.role_code !== shooterRole) {
      throw new Error(`Shooter role mismatch: expected ${shooterRole}, got ${shooter.role_code}`);
    }

    // 3. Check for existing shot this round (for BA) or this game (for PV)
    const existingShotQuery = supabase
      .from('infection_shots')
      .select('id, target_num')
      .eq('session_game_id', sessionGameId)
      .eq('shooter_num', shooterNum);

    // BA: check only this round
    // PV: check all rounds
    if (shooterRole === 'BA') {
      existingShotQuery.eq('manche', manche);
    }

    const { data: existingShots } = await existingShotQuery;

    // If targetNum is null, we're cancelling the shot
    if (targetNum === null) {
      if (existingShots && existingShots.length > 0) {
        // Delete existing shot(s) for this round
        if (shooterRole === 'BA') {
          await supabase
            .from('infection_shots')
            .delete()
            .eq('session_game_id', sessionGameId)
            .eq('shooter_num', shooterNum)
            .eq('manche', manche);
        } else {
          // PV can only cancel the shot from current manche
          await supabase
            .from('infection_shots')
            .delete()
            .eq('session_game_id', sessionGameId)
            .eq('shooter_num', shooterNum)
            .eq('manche', manche);
        }
        
        console.log('[infection-submit-shot] Shot cancelled for shooter:', shooterNum);
        return new Response(
          JSON.stringify({ success: true, message: 'Shot cancelled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'No shot to cancel' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 4. Verify target is alive
    const { data: target } = await supabase
      .from('game_players')
      .select('id, is_alive')
      .eq('game_id', gameId)
      .eq('player_number', targetNum)
      .is('removed_at', null)
      .single();

    if (!target || !target.is_alive) {
      throw new Error('Target is not alive');
    }

    // 5. For PV, check if they already shot in a PREVIOUS manche (that's locked)
    if (shooterRole === 'PV' && existingShots && existingShots.length > 0) {
      // Check if the shot is from a previous manche (already locked)
      const { data: previousShots } = await supabase
        .from('infection_shots')
        .select('id, manche')
        .eq('session_game_id', sessionGameId)
        .eq('shooter_num', shooterNum)
        .lt('manche', manche);

      if (previousShots && previousShots.length > 0) {
        throw new Error('PV can only shoot once per game');
      }
    }

    // 6. Check if we already have a shot this round to update
    const { data: currentRoundShots } = await supabase
      .from('infection_shots')
      .select('id')
      .eq('session_game_id', sessionGameId)
      .eq('shooter_num', shooterNum)
      .eq('manche', manche);

    if (currentRoundShots && currentRoundShots.length > 0) {
      // UPDATE existing shot (change target)
      const { error: updateError } = await supabase
        .from('infection_shots')
        .update({
          target_num: targetNum,
          server_ts: new Date().toISOString(),
        })
        .eq('id', currentRoundShots[0].id);

      if (updateError) {
        throw new Error(`Failed to update shot: ${updateError.message}`);
      }

      console.log('[infection-submit-shot] Shot updated:', { shooter: shooterNum, target: targetNum });

      return new Response(
        JSON.stringify({ success: true, message: 'Shot target updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 7. Verify shooter has ammo (only for new shots)
    const bulletType = shooterRole === 'BA' ? 'Balle BA' : 'Balle PV';
    const { data: ammo } = await supabase
      .from('inventory')
      .select('id, quantite')
      .eq('session_game_id', sessionGameId)
      .eq('owner_num', shooterNum)
      .eq('objet', bulletType)
      .single();

    if (!ammo || (ammo.quantite || 0) < 1) {
      throw new Error('No ammunition available');
    }

    // 8. Insert new shot record
    const { error: shotError } = await supabase
      .from('infection_shots')
      .insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche,
        shooter_num: shooterNum,
        shooter_role: shooterRole,
        target_num: targetNum,
        server_ts: new Date().toISOString(),
        status: 'PENDING',
      });

    if (shotError) {
      throw new Error(`Failed to record shot: ${shotError.message}`);
    }

    // 9. Consume bullet for NEW shots only
    await supabase
      .from('inventory')
      .update({ quantite: (ammo.quantite || 1) - 1 })
      .eq('id', ammo.id);

    console.log('[infection-submit-shot] New shot registered:', { shooter: shooterNum, target: targetNum });

    return new Response(
      JSON.stringify({ success: true, message: 'Shot registered' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[infection-submit-shot] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
