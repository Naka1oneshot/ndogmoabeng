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
  targetNum: number;
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

    // 3. Check for existing shots this round (BA: max 1/round, PV: max 1/game)
    const { data: existingShots } = await supabase
      .from('infection_shots')
      .select('id')
      .eq('session_game_id', sessionGameId)
      .eq('shooter_num', shooterNum)
      .eq('manche', manche);

    if (shooterRole === 'BA' && existingShots && existingShots.length > 0) {
      throw new Error('BA can only shoot once per round');
    }

    // For PV, check all rounds
    if (shooterRole === 'PV') {
      const { data: allPVShots } = await supabase
        .from('infection_shots')
        .select('id')
        .eq('session_game_id', sessionGameId)
        .eq('shooter_num', shooterNum);

      if (allPVShots && allPVShots.length > 0) {
        throw new Error('PV can only shoot once per game');
      }
    }

    // 4. Verify shooter has ammo
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

    // 5. Verify target is alive
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

    // 6. Insert shot record with server timestamp
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

    // 7. Consume bullet immediately (will be lost even if shot is ignored)
    await supabase
      .from('inventory')
      .update({ quantite: (ammo.quantite || 1) - 1 })
      .eq('id', ammo.id);

    console.log('[infection-submit-shot] Shot registered:', { shooter: shooterNum, target: targetNum });

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
