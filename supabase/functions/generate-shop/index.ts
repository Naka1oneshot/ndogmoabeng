import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ItemCatalog {
  id: string;
  name: string;
  category: 'ATTAQUE' | 'PROTECTION';
  purchasable: boolean;
  restockable: boolean;
}

interface ShopPrice {
  item_name: string;
  cost_normal: number;
  cost_akila: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, forceRegenerate = false } = await req.json();
    
    if (!gameId) {
      return new Response(
        JSON.stringify({ success: false, error: 'gameId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-shop] Starting for game ${gameId}, forceRegenerate=${forceRegenerate}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get game info
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, manche_active, phase, host_user_id, current_session_game_id')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      console.error('[generate-shop] Game not found:', gameError);
      return new Response(
        JSON.stringify({ success: false, error: 'Partie non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manche = game.manche_active;
    const sessionGameId = game.current_session_game_id;

    // Check if offer already exists for this round
    let existingQuery = supabase
      .from('game_shop_offers')
      .select('*')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    if (sessionGameId) {
      existingQuery = existingQuery.eq('session_game_id', sessionGameId);
    }
    
    const { data: existingOffer } = await existingQuery.maybeSingle();

    if (existingOffer) {
      if (existingOffer.locked && !forceRegenerate) {
        console.log('[generate-shop] Offer already locked, returning existing');
        return new Response(
          JSON.stringify({ 
            success: true, 
            offer: existingOffer,
            message: 'Offre déjà générée et verrouillée'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if any purchases made for this round
      let purchaseQuery = supabase
        .from('game_item_purchases')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId)
        .eq('manche', manche);
      
      if (sessionGameId) {
        purchaseQuery = purchaseQuery.eq('session_game_id', sessionGameId);
      }
      
      const { count: purchaseCount } = await purchaseQuery;

      if (purchaseCount && purchaseCount > 0) {
        console.log('[generate-shop] Cannot regenerate, purchases already made');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Impossible de régénérer le shop, des achats ont déjà été effectués'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get all purchasable items from catalog
    const { data: allItems, error: itemsError } = await supabase
      .from('item_catalog')
      .select('id, name, category, purchasable, restockable')
      .eq('purchasable', true);

    if (itemsError || !allItems) {
      console.error('[generate-shop] Error fetching items:', itemsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors du chargement des objets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get shop prices
    const { data: prices } = await supabase
      .from('shop_prices')
      .select('item_name, cost_normal, cost_akila');

    const priceMap = new Map<string, ShopPrice>();
    (prices || []).forEach(p => priceMap.set(p.item_name, p));

    // Filter out items with cost 0 (RULE R4)
    const validItems = allItems.filter(item => {
      const price = priceMap.get(item.name);
      return price && (price.cost_normal > 0 || price.cost_akila > 0);
    });

    console.log(`[generate-shop] Valid items: ${validItems.length}`);

    // Identify fixed items (RULE R1)
    const totemRupture = validItems.find(i => i.name === 'Totem de Rupture');
    const flecheCrepuscule = validItems.find(i => i.name === 'Flèche du Crépuscule');

    if (!totemRupture || !flecheCrepuscule) {
      return new Response(
        JSON.stringify({ success: false, error: 'Objets fixes (Totem/Flèche) non trouvés dans le catalogue' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get already purchased non-restockable items for this game (RULE R5)
    const { data: purchases } = await supabase
      .from('game_item_purchases')
      .select('item_name')
      .eq('game_id', gameId);

    const purchasedItemNames = new Set((purchases || []).map(p => p.item_name));

    // Build available pools
    const poolProtection = validItems.filter(i => 
      i.category === 'PROTECTION' && 
      !i.restockable && 
      !purchasedItemNames.has(i.name)
    );

    const poolAttack = validItems.filter(i => 
      i.category === 'ATTAQUE' && 
      i.name !== 'Totem de Rupture' && 
      i.name !== 'Flèche du Crépuscule' &&
      !i.restockable && 
      !purchasedItemNames.has(i.name)
    );

    console.log(`[generate-shop] Pool Protection: ${poolProtection.length}, Pool Attack: ${poolAttack.length}`);

    // Build shop offer (5 items)
    const offerItems: string[] = [];
    const warnings: string[] = [];

    // Always add fixed items (RULE R1)
    offerItems.push(totemRupture.name);
    offerItems.push(flecheCrepuscule.name);

    // Add 1 protection item (RULE R2)
    if (poolProtection.length > 0) {
      const randomProtection = poolProtection[Math.floor(Math.random() * poolProtection.length)];
      offerItems.push(randomProtection.name);
    } else {
      warnings.push('Plus d\'objets PROTECTION disponibles');
      // Fallback to fixed item
      offerItems.push(totemRupture.name);
    }

    // Add 2 attack items (RULE R3)
    const shuffledAttacks = [...poolAttack].sort(() => Math.random() - 0.5);
    const selectedAttacks = shuffledAttacks.slice(0, 2);
    
    for (const attack of selectedAttacks) {
      offerItems.push(attack.name);
    }

    // Fill remaining slots if needed (RULE R6)
    let fallbackToggle = false;
    while (offerItems.length < 5) {
      offerItems.push(fallbackToggle ? flecheCrepuscule.name : totemRupture.name);
      fallbackToggle = !fallbackToggle;
      if (poolProtection.length === 0 || selectedAttacks.length < 2) {
        warnings.push('Slots remplis avec Totem/Flèche (pénurie d\'objets)');
      }
    }

    console.log(`[generate-shop] Final offer: ${offerItems.join(', ')}`);

    // Upsert the offer
    const { data: savedOffer, error: saveError } = await supabase
      .from('game_shop_offers')
      .upsert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        item_ids: offerItems,
        locked: true,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'game_id,manche' })
      .select()
      .single();

    if (saveError) {
      console.error('[generate-shop] Error saving offer:', saveError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erreur lors de la sauvegarde de l\'offre' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log for MJ
    const offerSummary = offerItems.map((name, idx) => {
      const price = priceMap.get(name);
      return `${idx + 1}. ${name} (${price?.cost_normal || '?'}/${price?.cost_akila || '?'})`;
    }).join(', ');

    await supabase.from('logs_mj').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      action: 'SHOP_GEN',
      details: `Shop généré: ${offerSummary}`,
    });

    // Public log for players
    await supabase.from('logs_joueurs').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      type: 'SHOP',
      message: `🛒 Shop ouvert : 5 objets disponibles à l'achat !`,
    });

    // Session event for realtime
    await supabase.from('session_events').insert({
      game_id: gameId,
      type: 'SHOP',
      audience: 'ALL',
      message: `🛒 La boutique de la manche ${manche} est ouverte !`,
      payload: { items: offerItems, sessionGameId },
    });

    console.log('[generate-shop] Shop generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        offer: savedOffer,
        items: offerItems,
        sessionGameId,
        warnings: warnings.length > 0 ? warnings : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-shop] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur serveur inattendue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
