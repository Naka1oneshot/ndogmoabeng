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

    const { session_game_id, card, player_id } = await req.json();

    if (!session_game_id || card === undefined || card === null || !player_id) {
      return new Response(
        JSON.stringify({ error: 'session_game_id, card, and player_id are required' }),
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

    // Verify player is the active player
    if (gameState.active_player_id !== player_id) {
      return new Response(
        JSON.stringify({ error: 'You are not the active player this turn' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    if (currentTurn.active_locked) {
      return new Response(
        JSON.stringify({ error: 'Card already submitted for this turn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get player's hand
    const { data: hand, error: handError } = await supabase
      .from('lion_hands')
      .select('*')
      .eq('session_game_id', session_game_id)
      .eq('owner_player_id', player_id)
      .single();

    if (handError || !hand) {
      return new Response(
        JSON.stringify({ error: 'Player hand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify card is in hand
    if (!hand.remaining_cards.includes(card)) {
      return new Response(
        JSON.stringify({ error: 'Card not in your hand', available: hand.remaining_cards }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove card from hand
    const newHand = hand.remaining_cards.filter((c: number) => c !== card);
    await supabase
      .from('lion_hands')
      .update({ remaining_cards: newHand })
      .eq('id', hand.id);

    // Update turn with card and lock
    await supabase
      .from('lion_turns')
      .update({ 
        active_card: card, 
        active_locked: true,
        active_locked_at: new Date().toISOString()
      })
      .eq('id', currentTurn.id);

    // Check if we should auto-resolve
    if (gameState.auto_resolve && currentTurn.guess_locked) {
      // Both are now locked, trigger resolution
      const resolveResponse = await fetch(`${supabaseUrl}/functions/v1/lion-resolve-turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ session_game_id })
      });

      if (!resolveResponse.ok) {
        console.error('Auto-resolve failed:', await resolveResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ success: true, card, remainingHand: newHand }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in lion-submit-active-card:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
