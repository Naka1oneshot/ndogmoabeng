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
    const { gameId, playerNumber, playerToken, wantBuy, itemName } = await req.json();

    if (!gameId || !playerNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Paramètres manquants (gameId, playerNumber)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[submit-shop-request] Player ${playerNumber} in game ${gameId}: wantBuy=${wantBuy}, item=${itemName}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get game info
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, manche_active, phase, phase_locked')
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
        JSON.stringify({ success: false, error: 'La boutique n\'est pas ouverte' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check phase not locked
    if (game.phase_locked) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phase verrouillée - impossible de modifier le souhait' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manche = game.manche_active;

    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('game_players')
      .select('id, player_number, display_name, player_token')
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

    // Verify player token
    if (playerToken && player.player_token !== playerToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token joueur invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check shop is not already resolved
    const { data: shopOffer } = await supabase
      .from('game_shop_offers')
      .select('id, item_ids, resolved')
      .eq('game_id', gameId)
      .eq('manche', manche)
      .single();

    if (!shopOffer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Shop non généré pour cette manche' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (shopOffer.resolved) {
      return new Response(
        JSON.stringify({ success: false, error: 'Shop déjà résolu - impossible de modifier le souhait' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If want_buy=true, validate item is in offer
    if (wantBuy && itemName) {
      if (!shopOffer.item_ids.includes(itemName)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cet objet n\'est pas disponible dans la boutique actuelle' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Upsert shop request
    const { error: upsertError } = await supabase
      .from('shop_requests')
      .upsert({
        game_id: gameId,
        manche: manche,
        player_id: player.id,
        player_num: playerNumber,
        want_buy: wantBuy,
        item_name: wantBuy ? itemName : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'game_id,manche,player_id' });

    if (upsertError) {
      console.error('[submit-shop-request] Error upserting request:', upsertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de l\'enregistrement du souhait' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[submit-shop-request] Success: Player ${playerNumber} request saved`);

    return new Response(
      JSON.stringify({
        success: true,
        message: wantBuy 
          ? `Souhait enregistré : ${itemName}` 
          : 'Souhait enregistré : aucun achat',
        wantBuy: wantBuy,
        itemName: wantBuy ? itemName : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[submit-shop-request] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur serveur inattendue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});