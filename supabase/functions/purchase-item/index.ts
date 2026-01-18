import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, playerNumber, itemName, playerToken } = await req.json();
    
    if (!gameId || !playerNumber || !itemName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Paramètres manquants (gameId, playerNumber, itemName)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[purchase-item] Player ${playerNumber} attempting to buy ${itemName} in game ${gameId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get game info
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, manche_active, phase, current_session_game_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ success: false, error: 'Partie non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify we're in PHASE3_SHOP
    if (game.phase !== 'PHASE3_SHOP') {
      return new Response(
        JSON.stringify({ success: false, error: 'La boutique n\'est pas ouverte (phase actuelle: ' + game.phase + ')' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manche = game.manche_active;
    const sessionGameId = game.current_session_game_id;

    // Get shop offer for this round
    let offerQuery = supabase
      .from('game_shop_offers')
      .select('item_ids')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    if (sessionGameId) {
      offerQuery = offerQuery.eq('session_game_id', sessionGameId);
    }
    
    const { data: shopOffer, error: offerError } = await offerQuery.single();

    if (offerError || !shopOffer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Aucune offre de shop pour cette manche' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify item is in offer
    if (!shopOffer.item_ids.includes(itemName)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cet objet n\'est pas disponible dans la boutique actuelle' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('game_players')
      .select('id, player_number, jetons, clan, display_name, player_token')
      .eq('game_id', gameId)
      .eq('player_number', playerNumber)
      .eq('status', 'ACTIVE')
      .single();

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ success: false, error: 'Joueur non trouvé ou inactif' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify player token if provided
    if (playerToken && player.player_token !== playerToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token joueur invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get item info
    const { data: itemInfo, error: itemError } = await supabase
      .from('item_catalog')
      .select('name, category, consumable, restockable')
      .eq('name', itemName)
      .single();

    if (itemError || !itemInfo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Objet non trouvé dans le catalogue' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if item is unique and already purchased by this player (unless restockable)
    if (!itemInfo.restockable) {
      const { data: existingPurchase } = await supabase
        .from('game_item_purchases')
        .select('id')
        .eq('game_id', gameId)
        .eq('player_num', playerNumber)
        .eq('item_name', itemName)
        .maybeSingle();

      if (existingPurchase) {
        return new Response(
          JSON.stringify({ success: false, error: 'Vous avez déjà acheté cet objet (usage unique)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get price
    const { data: priceInfo, error: priceError } = await supabase
      .from('shop_prices')
      .select('cost_normal, cost_akila')
      .eq('item_name', itemName)
      .single();

    if (priceError || !priceInfo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prix non défini pour cet objet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine cost based on clan
    const isAkila = player.clan?.toLowerCase().includes('akila') || false;
    const cost = isAkila ? priceInfo.cost_akila : priceInfo.cost_normal;

    // Check sufficient tokens
    if (player.jetons < cost) {
      // Log refusal
      await supabase.from('logs_mj').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        action: 'SHOP_REFUS',
        num_joueur: playerNumber,
        details: `${player.display_name} a tenté d'acheter ${itemName} mais jetons insuffisants (${player.jetons}/${cost})`,
      });

      await supabase.from('logs_joueurs').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        type: 'SHOP_REFUS',
        message: `❌ Achat refusé : jetons insuffisants (${player.jetons}/${cost} requis)`,
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Jetons insuffisants (${player.jetons}/${cost} requis)` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Debit tokens
    const newBalance = player.jetons - cost;
    const { error: updateError } = await supabase
      .from('game_players')
      .update({ jetons: newBalance })
      .eq('id', player.id);

    if (updateError) {
      console.error('[purchase-item] Error updating tokens:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors du débit des jetons' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record purchase
    const { error: purchaseError } = await supabase
      .from('game_item_purchases')
      .insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        player_id: player.id,
        player_num: playerNumber,
        item_name: itemName,
        cost: cost,
        manche: manche,
      });

    if (purchaseError) {
      console.error('[purchase-item] Error recording purchase:', purchaseError);
      // Rollback tokens
      await supabase
        .from('game_players')
        .update({ jetons: player.jetons })
        .eq('id', player.id);
      
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de l\'enregistrement de l\'achat' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add to player inventory
    const { data: existingInv } = await supabase
      .from('inventory')
      .select('id, quantite')
      .eq('game_id', gameId)
      .eq('owner_num', playerNumber)
      .eq('objet', itemName)
      .maybeSingle();

    if (existingInv) {
      // Increment quantity
      await supabase
        .from('inventory')
        .update({ quantite: existingInv.quantite + 1 })
        .eq('id', existingInv.id);
    } else {
      // Insert new inventory item
      await supabase.from('inventory').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        owner_num: playerNumber,
        objet: itemName,
        quantite: 1,
        disponible: true,
        dispo_attaque: itemInfo.category === 'ATTAQUE',
      });
    }

    // Logs
    await supabase.from('logs_mj').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      action: 'SHOP_OK',
      num_joueur: playerNumber,
      details: `${player.display_name} a acheté ${itemName} pour ${cost} jetons (solde: ${newBalance})`,
    });

    await supabase.from('logs_joueurs').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      type: 'SHOP_OK',
      message: `✅ ${player.display_name} a acheté un objet !`,
    });

    // Session event for realtime
    await supabase.from('session_events').insert({
      game_id: gameId,
      type: 'SHOP_PURCHASE',
      audience: 'ALL',
      message: `🛒 ${player.display_name} a effectué un achat`,
      payload: { 
        player_num: playerNumber, 
        player_name: player.display_name,
        item: itemName,
        sessionGameId,
      },
    });

    console.log(`[purchase-item] Success: ${player.display_name} bought ${itemName} for ${cost}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Achat réussi : ${itemName}`,
        item: itemName,
        cost: cost,
        newBalance: newBalance,
        sessionGameId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[purchase-item] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur serveur inattendue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
