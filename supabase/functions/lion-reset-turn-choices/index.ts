import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { session_game_id, reset_active, reset_guesser } = await req.json();

    if (!session_game_id) {
      return new Response(
        JSON.stringify({ error: 'session_game_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current game state
    const { data: gameState, error: stateError } = await supabase
      .from('lion_game_state')
      .select('*')
      .eq('session_game_id', session_game_id)
      .single();

    if (stateError || !gameState) {
      return new Response(
        JSON.stringify({ error: 'Game state not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cannot reset if auto_resolve is enabled
    if (gameState.auto_resolve) {
      return new Response(
        JSON.stringify({ error: 'Cannot reset choices when auto_resolve is enabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current turn
    const { data: currentTurn, error: turnError } = await supabase
      .from('lion_turns')
      .select('*')
      .eq('session_game_id', session_game_id)
      .eq('turn_index', gameState.turn_index)
      .eq('sudden_pair_index', gameState.sudden_pair_index)
      .single();

    if (turnError || !currentTurn) {
      return new Response(
        JSON.stringify({ error: 'Current turn not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cannot reset if already resolved
    if (currentTurn.resolved) {
      return new Response(
        JSON.stringify({ error: 'Cannot reset a resolved turn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates: Record<string, unknown> = {};
    let cardRestored = false;

    // Reset active player's card
    if (reset_active && currentTurn.active_locked) {
      updates.active_card = null;
      updates.active_locked = false;
      updates.active_locked_at = null;

      // Restore the card to player's hand
      if (currentTurn.active_card !== null) {
        const { data: hand } = await supabase
          .from('lion_hands')
          .select('*')
          .eq('session_game_id', session_game_id)
          .eq('owner_player_id', currentTurn.active_player_id)
          .single();

        if (hand) {
          const newCards = [...hand.remaining_cards, currentTurn.active_card].sort((a, b) => a - b);
          await supabase
            .from('lion_hands')
            .update({ remaining_cards: newCards })
            .eq('id', hand.id);
          cardRestored = true;
        }
      }
    }

    // Reset guesser's choice
    if (reset_guesser && currentTurn.guess_locked) {
      updates.guess_choice = null;
      updates.guess_locked = false;
      updates.guess_locked_at = null;
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('lion_turns')
        .update(updates)
        .eq('id', currentTurn.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reset_active: reset_active && currentTurn.active_locked,
        reset_guesser: reset_guesser && currentTurn.guess_locked,
        card_restored: cardRestored
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in lion-reset-turn-choices:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
