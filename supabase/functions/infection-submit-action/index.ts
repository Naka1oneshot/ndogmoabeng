import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActionPayload {
  gameId: string;
  sessionGameId: string;
  manche: number;
  playerId: string;
  playerNum: number;
  actionType: 'CORRUPTION' | 'AE_SABOTAGE' | 'SY_RESEARCH' | 'PV_PATIENT0' | 'PV_ANTIDOTE' | 'OC_LOOKUP' | 'VOTE_TEST' | 'VOTE_SUSPECT';
  targetNum?: number;
  amount?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ActionPayload = await req.json();
    const { gameId, sessionGameId, manche, playerId, playerNum, actionType, targetNum, amount } = payload;

    console.log('[infection-submit-action] Received:', payload);

    // 1. Verify round is OPEN
    const { data: roundState, error: roundError } = await supabase
      .from('infection_round_state')
      .select('status')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .single();

    if (roundError || !roundState) {
      throw new Error('Round not found');
    }

    if (roundState.status !== 'OPEN') {
      throw new Error('Round is locked - actions cannot be modified');
    }

    // 2. Verify player is alive
    const { data: player, error: playerError } = await supabase
      .from('game_players')
      .select('id, is_alive, role_code, jetons')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      throw new Error('Player not found');
    }

    if (!player.is_alive) {
      throw new Error('Dead players cannot submit actions');
    }

    // 3. Validate action based on type
    const updateFields: Record<string, any> = {};

    switch (actionType) {
      case 'CORRUPTION':
        const corruptionAmount = amount || 0;
        if (corruptionAmount < 0) throw new Error('Corruption amount cannot be negative');
        if (corruptionAmount > (player.jetons || 0)) throw new Error('Insufficient tokens');
        updateFields.corruption_amount = corruptionAmount;
        break;

      case 'AE_SABOTAGE':
        if (player.role_code !== 'AE') throw new Error('Only AE can submit sabotage target');
        updateFields.ae_sabotage_target_num = targetNum;
        break;

      case 'SY_RESEARCH':
        if (player.role_code !== 'SY') throw new Error('Only SY can submit research target');
        
        // Check if this target was already researched in a previous manche
        if (targetNum) {
          const { data: previousResearches, error: prevResearchError } = await supabase
            .from('infection_inputs')
            .select('manche, sy_research_target_num')
            .eq('session_game_id', sessionGameId)
            .eq('player_id', playerId)
            .not('sy_research_target_num', 'is', null)
            .lt('manche', manche);
          
          if (prevResearchError) {
            console.error('[infection-submit-action] Error checking previous researches:', prevResearchError);
          }
          
          const alreadyResearchedTargets = new Set(
            (previousResearches || []).map(r => r.sy_research_target_num)
          );
          
          if (alreadyResearchedTargets.has(targetNum)) {
            const targetPlayer = await supabase
              .from('game_players')
              .select('display_name')
              .eq('game_id', gameId)
              .eq('player_number', targetNum)
              .single();
            
            throw new Error(`Vous avez déjà fait une recherche sur ${targetPlayer.data?.display_name || `Joueur ${targetNum}`}. Choisissez une nouvelle cible.`);
          }
        }
        
        updateFields.sy_research_target_num = targetNum;
        break;

      case 'PV_PATIENT0':
        if (player.role_code !== 'PV') throw new Error('Only PV can choose patient 0');
        updateFields.pv_patient0_target_num = targetNum;
        break;

      case 'PV_ANTIDOTE':
        if (player.role_code !== 'PV') throw new Error('Only PV can use antidote');
        updateFields.pv_antidote_target_num = targetNum;
        break;

      case 'OC_LOOKUP':
        if (player.role_code !== 'OC') throw new Error('Only OC can use oracle lookup');
        updateFields.oc_lookup_target_num = targetNum;
        break;

      case 'VOTE_TEST':
        updateFields.vote_test_target_num = targetNum;
        break;

      case 'VOTE_SUSPECT':
        updateFields.vote_suspect_pv_target_num = targetNum;
        break;

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }

    // 4. Upsert infection_inputs
    const { error: upsertError } = await supabase
      .from('infection_inputs')
      .upsert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche,
        player_id: playerId,
        player_num: playerNum,
        updated_at: new Date().toISOString(),
        ...updateFields,
      }, {
        onConflict: 'session_game_id,manche,player_id',
      });

    if (upsertError) {
      console.error('[infection-submit-action] Upsert error:', upsertError);
      throw new Error(`Failed to save action: ${upsertError.message}`);
    }

    console.log('[infection-submit-action] Success:', { actionType, playerNum });

    return new Response(
      JSON.stringify({ success: true, message: `${actionType} submitted successfully` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[infection-submit-action] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
