import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Intelligent bot decision-making for Lion game
 * Handles both active player (card selection) and guesser (HIGHER/LOWER/EQUAL)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { session_game_id } = await req.json();

    if (!session_game_id) {
      return new Response(
        JSON.stringify({ error: 'session_game_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get game state
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

    // Check if bots are enabled
    if (!gameState.bot_enabled) {
      return new Response(
        JSON.stringify({ message: 'Bot mode not enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Skip if turn already resolved
    if (currentTurn.resolved) {
      return new Response(
        JSON.stringify({ message: 'Turn already resolved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { activeBot?: string; guesserBot?: string } = {};

    // Check if active player is a bot and hasn't locked yet
    const { data: activePlayer } = await supabase
      .from('game_players')
      .select('id, display_name, is_bot')
      .eq('id', gameState.active_player_id)
      .single();

    if (activePlayer?.is_bot && !currentTurn.active_locked) {
      // Get active player's hand
      const { data: hand } = await supabase
        .from('lion_hands')
        .select('remaining_cards')
        .eq('session_game_id', session_game_id)
        .eq('owner_player_id', activePlayer.id)
        .single();

      if (hand && hand.remaining_cards.length > 0) {
        const card = selectActiveCard(
          hand.remaining_cards,
          currentTurn.dealer_card,
          gameState.bot_active_strategy || 'random'
        );

        // Submit the card
        const submitResponse = await fetch(`${supabaseUrl}/functions/v1/lion-submit-active-card`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            session_game_id,
            card,
            player_id: activePlayer.id
          })
        });

        if (submitResponse.ok) {
          results.activeBot = `${activePlayer.display_name} played card ${card}`;
          console.log(`[lion-bot] Active bot ${activePlayer.display_name} played card ${card}`);
        } else {
          console.error(`[lion-bot] Failed to submit active card:`, await submitResponse.text());
        }
      }
    }

    // Check if guesser is a bot and hasn't locked yet
    const { data: guesserPlayer } = await supabase
      .from('game_players')
      .select('id, display_name, is_bot')
      .eq('id', gameState.guesser_player_id)
      .single();

    if (guesserPlayer?.is_bot && !currentTurn.guess_locked) {
      // Get active player's hand to make intelligent guess
      const { data: activeHand } = await supabase
        .from('lion_hands')
        .select('remaining_cards')
        .eq('session_game_id', session_game_id)
        .eq('owner_player_id', gameState.active_player_id)
        .single();

      const choice = selectGuessChoice(
        currentTurn.dealer_card,
        activeHand?.remaining_cards || [],
        gameState.bot_guess_strategy || 'smart'
      );

      // Submit the guess
      const submitResponse = await fetch(`${supabaseUrl}/functions/v1/lion-submit-guess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          session_game_id,
          choice,
          player_id: guesserPlayer.id
        })
      });

      if (submitResponse.ok) {
        results.guesserBot = `${guesserPlayer.display_name} guessed ${choice}`;
        console.log(`[lion-bot] Guesser bot ${guesserPlayer.display_name} guessed ${choice}`);
      } else {
        console.error(`[lion-bot] Failed to submit guess:`, await submitResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in lion-bot-decisions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Select card for active player (bot)
 */
function selectActiveCard(
  hand: number[],
  dealerCard: number,
  strategy: string
): number {
  if (hand.length === 0) return 0;

  switch (strategy) {
    case 'defensive':
      // Try to play a card close to dealer (minimize difference)
      return hand.reduce((best, card) => 
        Math.abs(card - dealerCard) < Math.abs(best - dealerCard) ? card : best
      );
    
    case 'aggressive':
      // Try to play a card far from dealer (maximize difference)
      return hand.reduce((best, card) => 
        Math.abs(card - dealerCard) > Math.abs(best - dealerCard) ? card : best
      );
    
    case 'random':
    default:
      // Random selection
      return hand[Math.floor(Math.random() * hand.length)];
  }
}

/**
 * Intelligent guess selection for bot guesser
 * Takes into account:
 * 1. Dealer card value (can't go higher than 10, can't go lower than 0)
 * 2. Active player's remaining cards (what they CAN play)
 */
function selectGuessChoice(
  dealerCard: number,
  activePlayerHand: number[],
  strategy: string
): 'HIGHER' | 'LOWER' | 'EQUAL' {
  
  // Always use smart logic for impossible choices
  const hasHigherCards = activePlayerHand.some(c => c > dealerCard);
  const hasLowerCards = activePlayerHand.some(c => c < dealerCard);
  const hasEqualCard = activePlayerHand.includes(dealerCard);

  // CRITICAL: Don't guess something impossible
  // If dealer is 10, there's no higher card (0-10 range)
  if (dealerCard === 10 && !hasEqualCard) {
    // Can only be LOWER or EQUAL, and if no equal card exists, must be LOWER
    return 'LOWER';
  }
  
  // If dealer is 0, there's no lower card
  if (dealerCard === 0 && !hasEqualCard) {
    return 'HIGHER';
  }

  // If active player has no cards higher than dealer, don't guess HIGHER
  if (!hasHigherCards && dealerCard < 10) {
    // They can only play LOWER or EQUAL
    if (hasEqualCard && Math.random() < 0.3) {
      return 'EQUAL';
    }
    return 'LOWER';
  }

  // If active player has no cards lower than dealer, don't guess LOWER
  if (!hasLowerCards && dealerCard > 0) {
    // They can only play HIGHER or EQUAL
    if (hasEqualCard && Math.random() < 0.3) {
      return 'EQUAL';
    }
    return 'HIGHER';
  }

  // If active player only has the equal card left
  if (activePlayerHand.length === 1 && activePlayerHand[0] === dealerCard) {
    return 'EQUAL';
  }

  // Strategy-based decision
  switch (strategy) {
    case 'always_equal':
      return 'EQUAL';
    
    case 'random':
      // Pure random (but still respecting impossible choices)
      const choices: ('HIGHER' | 'LOWER' | 'EQUAL')[] = [];
      if (hasHigherCards) choices.push('HIGHER');
      if (hasLowerCards) choices.push('LOWER');
      if (hasEqualCard) choices.push('EQUAL');
      return choices[Math.floor(Math.random() * choices.length)] || 'EQUAL';
    
    case 'smart':
    default:
      // Smart probability-based decision
      return smartGuess(dealerCard, activePlayerHand, hasHigherCards, hasLowerCards, hasEqualCard);
  }
}

/**
 * Smart guess using probability analysis
 */
function smartGuess(
  dealerCard: number,
  activeHand: number[],
  hasHigher: boolean,
  hasLower: boolean,
  hasEqual: boolean
): 'HIGHER' | 'LOWER' | 'EQUAL' {
  const handSize = activeHand.length;
  if (handSize === 0) {
    // Fallback: guess based on dealer position
    if (dealerCard >= 8) return 'LOWER';
    if (dealerCard <= 2) return 'HIGHER';
    return Math.random() < 0.5 ? 'HIGHER' : 'LOWER';
  }

  // Count cards in each category
  const higherCount = activeHand.filter(c => c > dealerCard).length;
  const lowerCount = activeHand.filter(c => c < dealerCard).length;
  const equalCount = hasEqual ? 1 : 0;

  // Calculate probabilities
  const pHigher = higherCount / handSize;
  const pLower = lowerCount / handSize;
  const pEqual = equalCount / handSize;

  // Consider expected value:
  // EQUAL correct = +10, EQUAL wrong = -10 (to active)
  // HIGHER/LOWER correct = +diff, wrong = -diff
  
  // Calculate average potential gain for each choice
  let evHigher = 0;
  let evLower = 0;
  const evEqual = pEqual * 10 - (1 - pEqual) * 5; // Weighted for equal bonus

  // For HIGHER: sum of (diff * probability) for each higher card
  activeHand.forEach(c => {
    if (c > dealerCard) {
      evHigher += (c - dealerCard) / handSize;
    }
  });
  // Penalty for wrong guess
  evHigher -= (lowerCount + equalCount) / handSize * 3;

  // For LOWER: sum of (diff * probability) for each lower card
  activeHand.forEach(c => {
    if (c < dealerCard) {
      evLower += (dealerCard - c) / handSize;
    }
  });
  // Penalty for wrong guess
  evLower -= (higherCount + equalCount) / handSize * 3;

  // Add some randomness to make it less predictable
  const rand = Math.random() * 2;
  evHigher += rand;
  evLower += rand;

  // Choose based on expected value
  if (evEqual > evHigher && evEqual > evLower && hasEqual) {
    return 'EQUAL';
  } else if (evHigher > evLower && hasHigher) {
    return 'HIGHER';
  } else if (hasLower) {
    return 'LOWER';
  } else if (hasHigher) {
    return 'HIGHER';
  } else if (hasEqual) {
    return 'EQUAL';
  }
  
  // Ultimate fallback
  return dealerCard >= 5 ? 'LOWER' : 'HIGHER';
}
