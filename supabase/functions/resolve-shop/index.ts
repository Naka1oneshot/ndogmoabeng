import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopRequest {
  id: string;
  player_id: string;
  player_num: number;
  want_buy: boolean;
  item_name: string | null;
}

interface PriorityRanking {
  player_id: string;
  num_joueur: number;
  rank: number;
  display_name: string;
}

interface Player {
  id: string;
  player_number: number;
  display_name: string;
  jetons: number;
  clan: string | null;
}

interface ShopPrice {
  item_name: string;
  cost_normal: number;
  cost_akila: number;
}

interface ItemCatalog {
  name: string;
  category: string;
  restockable: boolean;
}

// Fixed items that are restockable but limited to 1 per round
const FIXED_ITEMS = ['Totem de Rupture', 'Flèche du Crépuscule'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId } = await req.json();

    if (!gameId) {
      return new Response(
        JSON.stringify({ success: false, error: 'gameId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[resolve-shop] Starting resolution for game ${gameId}`);

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
      console.error('[resolve-shop] Game not found:', gameError);
      return new Response(
        JSON.stringify({ success: false, error: 'Partie non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manche = game.manche_active;
    const sessionGameId = game.current_session_game_id;
    console.log(`[resolve-shop] Processing game ${gameId}, session_game ${sessionGameId}, manche ${manche}`);

    // Check if shop offer exists - use session_game_id if available
    const shopOfferQuery = supabase
      .from('game_shop_offers')
      .select('id, item_ids, resolved')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    if (sessionGameId) {
      shopOfferQuery.eq('session_game_id', sessionGameId);
    }
    
    const { data: shopOffer, error: offerError } = await shopOfferQuery.single();

    if (offerError || !shopOffer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Shop non généré pour cette manche' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already resolved (idempotency)
    if (shopOffer.resolved) {
      console.log('[resolve-shop] Shop already resolved, returning existing state');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Shop déjà résolu pour cette manche',
          alreadyResolved: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get priority rankings for this round - use session_game_id if available
    const rankingsQuery = supabase
      .from('priority_rankings')
      .select('player_id, num_joueur, rank, display_name')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    if (sessionGameId) {
      rankingsQuery.eq('session_game_id', sessionGameId);
    }
    
    const { data: rankings, error: rankingsError } = await rankingsQuery.order('rank', { ascending: true });

    if (rankingsError || !rankings || rankings.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Classement de priorité non trouvé. Avez-vous fermé la Phase 1 ?' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[resolve-shop] Found ${rankings.length} players in priority order`);

    // Get all shop requests for this round - use session_game_id if available
    const requestsQuery = supabase
      .from('shop_requests')
      .select('id, player_id, player_num, want_buy, item_name')
      .eq('game_id', gameId)
      .eq('manche', manche);
    
    if (sessionGameId) {
      requestsQuery.eq('session_game_id', sessionGameId);
    }
    
    const { data: requests } = await requestsQuery;

    const requestMap = new Map<string, ShopRequest>();
    (requests || []).forEach(r => requestMap.set(r.player_id, r));

    // Get all players
    const { data: players } = await supabase
      .from('game_players')
      .select('id, player_number, display_name, jetons, clan')
      .eq('game_id', gameId)
      .eq('status', 'ACTIVE');

    const playerMap = new Map<string, Player>();
    (players || []).forEach(p => playerMap.set(p.id, p));

    // Get prices
    const { data: prices } = await supabase
      .from('shop_prices')
      .select('item_name, cost_normal, cost_akila');

    const priceMap = new Map<string, ShopPrice>();
    (prices || []).forEach(p => priceMap.set(p.item_name, p));

    // Get item catalog
    const { data: itemCatalog } = await supabase
      .from('item_catalog')
      .select('name, category, restockable');

    const itemMap = new Map<string, ItemCatalog>();
    (itemCatalog || []).forEach(i => itemMap.set(i.name, i));

    // Initialize stock for this round
    // - Totem/Flèche: 1 each per round
    // - Other items: 1 total (unique)
    const stock = new Map<string, number>();
    for (const itemName of shopOffer.item_ids) {
      const existing = stock.get(itemName) || 0;
      // Fixed items get 1 per round, unique items also get 1
      stock.set(itemName, existing + 1);
    }

    // Track sales per item for this resolution
    const salesThisRound = new Map<string, number>();
    const purchasesApproved: Array<{ playerNum: number; playerName: string; item: string; cost: number }> = [];
    const purchasesRefused: Array<{ playerNum: number; playerName: string; item: string; reason: string }> = [];

    // Log start
    await supabase.from('logs_mj').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      action: 'SHOP_RESOLVE_START',
      details: `Résolution du shop selon l'ordre de priorité (${rankings.length} joueurs)`,
    });

    // Process each player in priority order
    for (const ranking of rankings) {
      const request = requestMap.get(ranking.player_id);
      const player = playerMap.get(ranking.player_id);

      if (!player) {
        console.log(`[resolve-shop] Player ${ranking.player_id} not found in active players, skipping`);
        continue;
      }

      // Skip if no request or doesn't want to buy
      if (!request || !request.want_buy || !request.item_name) {
        console.log(`[resolve-shop] Player ${ranking.display_name} (rank ${ranking.rank}) - no buy request`);
        continue;
      }

      const itemName = request.item_name;
      console.log(`[resolve-shop] Processing rank ${ranking.rank}: ${ranking.display_name} wants ${itemName}`);

      // Check if item is in offer
      if (!shopOffer.item_ids.includes(itemName)) {
        purchasesRefused.push({
          playerNum: player.player_number,
          playerName: player.display_name,
          item: itemName,
          reason: 'Objet non disponible dans l\'offre',
        });
        await supabase.from('logs_mj').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          manche: manche,
          action: 'SHOP_REFUS',
          num_joueur: player.player_number,
          details: `${player.display_name} : ${itemName} non disponible dans l'offre`,
        });
        continue;
      }

      // Check stock
      const availableStock = (stock.get(itemName) || 0) - (salesThisRound.get(itemName) || 0);
      
      if (availableStock <= 0) {
        purchasesRefused.push({
          playerNum: player.player_number,
          playerName: player.display_name,
          item: itemName,
          reason: 'Plus de stock disponible',
        });
        await supabase.from('logs_mj').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          manche: manche,
          action: 'SHOP_REFUS',
          num_joueur: player.player_number,
          details: `${player.display_name} : ${itemName} déjà vendu à un joueur plus prioritaire`,
        });
        continue;
      }

      // Get price based on clan
      const priceInfo = priceMap.get(itemName);
      if (!priceInfo) {
        purchasesRefused.push({
          playerNum: player.player_number,
          playerName: player.display_name,
          item: itemName,
          reason: 'Prix non défini',
        });
        continue;
      }

      const isAkila = player.clan?.toLowerCase().includes('akila') || false;
      const cost = isAkila ? priceInfo.cost_akila : priceInfo.cost_normal;

      // Check tokens
      if (player.jetons < cost) {
        purchasesRefused.push({
          playerNum: player.player_number,
          playerName: player.display_name,
          item: itemName,
          reason: `Jetons insuffisants (${player.jetons}/${cost})`,
        });
        await supabase.from('logs_mj').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          manche: manche,
          action: 'SHOP_REFUS',
          num_joueur: player.player_number,
          details: `${player.display_name} : jetons insuffisants pour ${itemName} (${player.jetons}/${cost})`,
        });
        continue;
      }

      // SUCCESS: Approve purchase
      console.log(`[resolve-shop] Approving: ${player.display_name} buys ${itemName} for ${cost}`);

      // Debit tokens
      const newBalance = player.jetons - cost;
      await supabase
        .from('game_players')
        .update({ jetons: newBalance })
        .eq('id', player.id);

      // Update local player state for subsequent checks
      player.jetons = newBalance;

      // Record purchase
      await supabase.from('game_item_purchases').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        player_id: player.id,
        player_num: player.player_number,
        item_name: itemName,
        cost: cost,
        status: 'APPROVED',
        resolved_at: new Date().toISOString(),
      });

      // Add to inventory
      const { data: existingInv } = await supabase
        .from('inventory')
        .select('id, quantite')
        .eq('game_id', gameId)
        .eq('owner_num', player.player_number)
        .eq('objet', itemName)
        .maybeSingle();

      const itemInfo = itemMap.get(itemName);
      if (existingInv) {
        await supabase
          .from('inventory')
          .update({ quantite: (existingInv.quantite || 0) + 1 })
          .eq('id', existingInv.id);
      } else {
        await supabase.from('inventory').insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          owner_num: player.player_number,
          objet: itemName,
          quantite: 1,
          disponible: true,
          dispo_attaque: itemInfo?.category === 'ATTAQUE',
        });
      }

      // Update sales tracker
      salesThisRound.set(itemName, (salesThisRound.get(itemName) || 0) + 1);

      purchasesApproved.push({
        playerNum: player.player_number,
        playerName: player.display_name,
        item: itemName,
        cost: cost,
      });

      await supabase.from('logs_mj').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        manche: manche,
        action: 'SHOP_OK',
        num_joueur: player.player_number,
        details: `${player.display_name} a acheté ${itemName} pour ${cost} jetons (solde: ${newBalance})`,
      });
    }

    // Mark shop as resolved (idempotency)
    await supabase
      .from('game_shop_offers')
      .update({ 
        resolved: true, 
        resolved_at: new Date().toISOString() 
      })
      .eq('id', shopOffer.id);

    // Final logs
    await supabase.from('logs_mj').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      action: 'SHOP_RESOLVE_END',
      details: `Shop résolu: ${purchasesApproved.length} achats validés, ${purchasesRefused.length} refusés`,
    });

    // Build public log message with player names
    // Get all players who had a request or are active
    const allPlayerIds = new Set([
      ...Array.from(requestMap.values()).map(r => r.player_id),
      ...Array.from(playerMap.keys())
    ]);

    // Get names of players who got approved
    const approvedNames = purchasesApproved.map(p => p.playerName);
    
    // Get names of players who didn't buy or were refused (everyone else)
    const nonBuyerNames: string[] = [];
    for (const ranking of rankings) {
      const player = playerMap.get(ranking.player_id);
      const request = requestMap.get(ranking.player_id);
      
      if (!player) continue;
      
      // Skip if they got an approved purchase
      if (approvedNames.includes(player.display_name)) continue;
      
      // They either: refused, had no wish, or insufficient funds
      nonBuyerNames.push(player.display_name);
    }

    // Build the public message
    let publicShopMessage = '🛒 Résolution du shop :\n';
    if (approvedNames.length > 0) {
      publicShopMessage += `✅ Achats validés pour : ${approvedNames.join(', ')}.\n`;
    }
    if (nonBuyerNames.length > 0) {
      publicShopMessage += `❌ Pas d'achat pour : ${nonBuyerNames.join(', ')}.`;
    }

    await supabase.from('logs_joueurs').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      type: 'SHOP_FIN',
      message: publicShopMessage,
    });

    // Session event
    await supabase.from('session_events').insert({
      game_id: gameId,
      type: 'SHOP_RESOLVED',
      audience: 'ALL',
      message: `🛒 Résolution du shop terminée`,
      payload: { 
        approved: purchasesApproved.length, 
        refused: purchasesRefused.length,
        items: purchasesApproved.map(p => ({ player: p.playerName, item: p.item })),
      },
    });

    // Game event for history
    await supabase.from('game_events').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: manche,
      phase: 'PHASE3_SHOP',
      event_type: 'SHOP_RESOLVED',
      visibility: 'PUBLIC',
      message: `Shop résolu : ${purchasesApproved.length} achats`,
      payload: {
        approved: purchasesApproved,
        refused: purchasesRefused,
      },
    });

    console.log(`[resolve-shop] Complete: ${purchasesApproved.length} approved, ${purchasesRefused.length} refused`);

    // Auto-advance to next round and Phase 1
    const nextManche = manche + 1;
    console.log(`[resolve-shop] Auto-advancing to manche ${nextManche}, PHASE1_MISES`);

    // Credit 5 tokens to all active players for the new round
    const tokenBonus = 5;
    const { error: bonusError } = await supabase.rpc('increment_all_player_tokens', {
      p_game_id: gameId,
      p_amount: tokenBonus
    });

    // If RPC doesn't exist, fallback to manual update
    if (bonusError) {
      console.log('[resolve-shop] RPC not available, using manual token increment');
      for (const player of players || []) {
        await supabase
          .from('game_players')
          .update({ jetons: (player.jetons || 0) + tokenBonus })
          .eq('id', player.id);
      }
    }

    console.log(`[resolve-shop] Credited ${tokenBonus} tokens to all active players`);

    await supabase
      .from('games')
      .update({ 
        manche_active: nextManche, 
        phase: 'PHASE1_MISES',
        phase_locked: false
      })
      .eq('id', gameId);

    // Log the round change
    await supabase.from('logs_mj').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: nextManche,
      action: 'NOUVELLE_MANCHE',
      details: `Passage automatique à la manche ${nextManche} (+${tokenBonus} jetons pour tous)`,
    });

    // Public log for token bonus
    await supabase.from('logs_joueurs').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: nextManche,
      type: 'BONUS',
      message: `💰 Tous les joueurs reçoivent +${tokenBonus} jetons pour la nouvelle manche !`,
    });

    await supabase.from('logs_joueurs').insert({
      game_id: gameId,
      session_game_id: sessionGameId,
      manche: nextManche,
      type: 'PHASE',
      message: `🔄 Nouvelle manche ${nextManche} - Phase 1 : Mises`,
    });

    // Session event for new round
    await supabase.from('session_events').insert({
      game_id: gameId,
      type: 'ROUND_CHANGE',
      audience: 'ALL',
      message: `Nouvelle manche ${nextManche}`,
      payload: { manche: nextManche, phase: 'PHASE1_MISES' },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Shop résolu avec succès - Passage à la manche ${nextManche}`,
        approved: purchasesApproved,
        refused: purchasesRefused,
        stats: {
          totalRequests: requests?.length || 0,
          approved: purchasesApproved.length,
          refused: purchasesRefused.length,
        },
        nextRound: {
          manche: nextManche,
          phase: 'PHASE1_MISES',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[resolve-shop] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erreur serveur inattendue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});