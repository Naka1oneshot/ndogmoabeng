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
    const { gameId, sessionGameId, duelId, playerNumber, searches } = await req.json();

    if (!gameId || !sessionGameId || !duelId || playerNumber === undefined || searches === undefined) {
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

    // Determine which player this is
    const isPlayer1 = duel.player1_number === playerNumber;
    const isPlayer2 = duel.player2_number === playerNumber;

    if (!isPlayer1 && !isPlayer2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vous ne participez pas à ce duel' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Update the decision
    const updateField = isPlayer1 ? 'player1_searches' : 'player2_searches';
    
    const { error: updateError } = await supabase
      .from('sheriff_duels')
      .update({ [updateField]: searches })
      .eq('id', duelId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true,
        playerNumber,
        searches,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('sheriff-submit-duel-decision error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
