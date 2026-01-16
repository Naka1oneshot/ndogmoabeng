import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, playerToken, action } = await req.json();

    if (!gameId || !playerToken) {
      return new Response(
        JSON.stringify({ error: 'gameId and playerToken are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the player by token
    const { data: player, error: findError } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, status')
      .eq('game_id', gameId)
      .eq('player_token', playerToken)
      .single();

    if (findError || !player) {
      console.error('Player not found:', findError);
      return new Response(
        JSON.stringify({ error: 'Player not found', valid: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine what to update based on action
    const updateData: { last_seen: string; status?: string } = {
      last_seen: new Date().toISOString(),
    };

    if (action === 'leave') {
      updateData.status = 'LEFT';
      console.log(`Player ${player.display_name} (${player.id}) is leaving game ${gameId}`);
    } else if (action === 'join' || action === 'heartbeat') {
      updateData.status = 'ACTIVE';
      console.log(`Heartbeat from ${player.display_name} (${player.id}) in game ${gameId}`);
    }

    // Update presence
    const { error: updateError } = await supabase
      .from('game_players')
      .update(updateData)
      .eq('id', player.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update presence' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        player: {
          id: player.id,
          displayName: player.display_name,
          playerNumber: player.player_number,
          status: updateData.status || player.status,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Heartbeat error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
