import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a unique player token (reconnect_key)
function generatePlayerToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Normalize name for matching (trim + lowercase)
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// Product ID to tier mapping (same as check-subscription)
const PRODUCT_TO_TIER: Record<string, string> = {
  "prod_Tp3VRqayJwZs5D": "starter",
  "prod_Tp3VDl938PAQx0": "premium",
  "prod_Tp3W1ER13T1Qss": "royal",
};

// Tier limits configuration
const TIER_LIMITS: Record<string, {
  games_joinable: number;
  clan_benefits: boolean;
}> = {
  freemium: { games_joinable: 10, clan_benefits: false },
  starter: { games_joinable: 30, clan_benefits: true },
  premium: { games_joinable: 100, clan_benefits: true },
  royal: { games_joinable: -1, clan_benefits: true }, // unlimited
};

// Get start of current month in ISO format
function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// Check user subscription limits
async function getUserSubscriptionLimits(supabase: any, userId: string, userEmail: string | null): Promise<{ 
  canJoin: boolean; 
  hasClanBenefits: boolean; 
  reason?: string 
}> {
  const monthStart = getMonthStart();
  
  // Count games joined this month (only initialized games)
  const { count: gamesJoinedCount } = await supabase
    .from("game_players")
    .select("*, games!inner(status)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_host", false)
    .gte("joined_at", monthStart)
    .is("removed_at", null)
    .neq("games.status", "LOBBY");

  const usedJoinable = gamesJoinedCount || 0;
  
  let effectiveTier = "freemium";
  let tokenBonus = 0;

  // Check Stripe subscription if user has email
  if (userEmail) {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
        
        if (customers.data.length > 0) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customers.data[0].id,
            status: "active",
            limit: 1,
          });
          
          if (subscriptions.data.length > 0) {
            const productId = subscriptions.data[0].items.data[0].price.product as string;
            effectiveTier = PRODUCT_TO_TIER[productId] || "freemium";
          }
        }
      } catch (e) {
        console.error("Stripe check error:", e);
      }
    }
  }

  // Check for trial or token bonuses
  const { data: bonusData } = await supabase
    .from("user_subscription_bonuses")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (bonusData) {
    const trialEndDate = new Date(bonusData.trial_end_at);
    if (trialEndDate > new Date()) {
      effectiveTier = bonusData.trial_tier || effectiveTier;
    }
    tokenBonus = bonusData.token_games_joinable || 0;
  }

  const limits = TIER_LIMITS[effectiveTier] || TIER_LIMITS.freemium;
  const totalJoinable = limits.games_joinable === -1 ? -1 : limits.games_joinable + tokenBonus;
  const remaining = totalJoinable === -1 ? 999 : totalJoinable - usedJoinable;

  if (remaining <= 0) {
    return { 
      canJoin: false, 
      hasClanBenefits: limits.clan_benefits,
      reason: "Vous avez atteint votre limite de parties jouables ce mois-ci. Passez à un abonnement supérieur ou achetez des tokens." 
    };
  }

  return { canJoin: true, hasClanBenefits: limits.clan_benefits };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { joinCode, displayName, clan, deviceId, reconnectKey } = await req.json();

    if (!joinCode || !displayName) {
      return new Response(
        JSON.stringify({ error: "Code et pseudo requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: "Device ID requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the game by join code
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, name, status, x_nb_joueurs, starting_tokens")
      .eq("join_code", joinCode.toUpperCase())
      .maybeSingle();

    if (gameError) {
      console.error("Game lookup error:", gameError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la recherche" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!game) {
      return new Response(
        JSON.stringify({ error: "Partie introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if game is joinable
    if (game.status !== "LOBBY" && game.status !== "IN_ROUND") {
      return new Response(
        JSON.stringify({ error: "Cette partie n'accepte plus de nouveaux joueurs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if device is banned from this session
    const { data: ban, error: banError } = await supabase
      .from("session_bans")
      .select("id, reason")
      .eq("game_id", game.id)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (banError) {
      console.error("Ban lookup error:", banError);
    }

    if (ban) {
      console.log("Device is banned:", deviceId, "Reason:", ban.reason);
      return new Response(
        JSON.stringify({ 
          error: "BANNED", 
          reason: ban.reason || "Vous avez été banni de cette partie",
          banned: true 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check subscription limits for authenticated users (new joins only, not reconnections)
    // We'll check this before allowing new player creation
    let subscriptionLimits: { canJoin: boolean; hasClanBenefits: boolean; reason?: string } | null = null;
    
    // Try to get authenticated user from authorization header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) {
        userId = userData.user.id;
        userEmail = userData.user.email || null;
      }
    }

    const nameNormalized = normalizeName(displayName);
    console.log("Join attempt:", { displayName, nameNormalized, deviceId, hasReconnectKey: !!reconnectKey, userId });

    // Priority 1: Try to reconnect by reconnect_key (player_token) if provided
    if (reconnectKey) {
      const { data: tokenPlayer, error: tokenError } = await supabase
        .from("game_players")
        .select("id, status, player_number, player_token, display_name, removed_reason, jetons, recompenses, clan")
        .eq("game_id", game.id)
        .eq("player_token", reconnectKey)
        .maybeSingle();

      if (!tokenError && tokenPlayer) {
        // Check if player is LEFT or REMOVED (KICKED)
        if (tokenPlayer.status === "LEFT") {
          console.log("Player previously left, allowing rejoin:", tokenPlayer.display_name);
          // Will fall through to name-based reconnection or new join
        } else if (tokenPlayer.status === "REMOVED") {
          console.log("Player was kicked, rejoin refused:", tokenPlayer.display_name);
          return new Response(
            JSON.stringify({ 
              error: "Vous avez été expulsé de cette partie", 
              reason: tokenPlayer.removed_reason || "Expulsé par le MJ",
              kicked: true 
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // ACTIVE player - reconnect
          console.log("Reconnecting by token:", tokenPlayer.display_name);
          await supabase
            .from("game_players")
            .update({ 
              last_seen: new Date().toISOString(),
              device_id: deviceId, // Update device_id in case it changed
            })
            .eq("id", tokenPlayer.id);

          return new Response(
            JSON.stringify({
              success: true,
              gameId: game.id,
              gameName: game.name,
              playerId: tokenPlayer.id,
              playerToken: tokenPlayer.player_token,
              playerNumber: tokenPlayer.player_number,
              displayName: tokenPlayer.display_name,
              jetons: tokenPlayer.jetons,
              recompenses: tokenPlayer.recompenses,
              clan: tokenPlayer.clan,
              reconnected: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Priority 2: Check if participant already exists for this device in this game
    const { data: existingPlayer, error: existingError } = await supabase
      .from("game_players")
      .select("id, status, player_number, player_token, display_name, removed_reason, jetons, recompenses, clan")
      .eq("game_id", game.id)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (existingError) {
      console.error("Existing player lookup error:", existingError);
    }

    // Case 1: ACTIVE player exists for this device -> return existing player
    if (existingPlayer && existingPlayer.status === "ACTIVE") {
      console.log("Returning existing ACTIVE player by device:", existingPlayer.display_name);
      
      // Update last_seen and optionally display_name
      await supabase
        .from("game_players")
        .update({ 
          last_seen: new Date().toISOString(),
          display_name: displayName.trim(),
          clan: clan || null,
        })
        .eq("id", existingPlayer.id);

      return new Response(
        JSON.stringify({
          success: true,
          gameId: game.id,
          gameName: game.name,
          playerId: existingPlayer.id,
          playerToken: existingPlayer.player_token,
          playerNumber: existingPlayer.player_number,
          displayName: existingPlayer.display_name,
          jetons: existingPlayer.jetons,
          recompenses: existingPlayer.recompenses,
          clan: existingPlayer.clan,
          reconnected: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Priority 3: Try to find existing player by normalized name
    const { data: namePlayer, error: nameError } = await supabase
      .from("game_players")
      .select("id, status, player_number, player_token, display_name, removed_reason, jetons, recompenses, clan, device_id")
      .eq("game_id", game.id)
      .maybeSingle();

    // We need to manually filter by normalized name since Supabase doesn't have ilike on computed fields
    const { data: allPlayers } = await supabase
      .from("game_players")
      .select("id, status, player_number, player_token, display_name, removed_reason, jetons, recompenses, clan, device_id")
      .eq("game_id", game.id);

    const matchingPlayerByName = (allPlayers || []).find(
      p => normalizeName(p.display_name) === nameNormalized
    );

    if (matchingPlayerByName) {
      console.log("Found player by name:", matchingPlayerByName.display_name, "status:", matchingPlayerByName.status);

      // If player is REMOVED (kicked), refuse
      if (matchingPlayerByName.status === "REMOVED") {
        return new Response(
          JSON.stringify({ 
            error: "Ce pseudo a été expulsé de cette partie", 
            reason: matchingPlayerByName.removed_reason || "Expulsé par le MJ",
            kicked: true 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If player is ACTIVE or LEFT, reconnect them
      if (matchingPlayerByName.status === "ACTIVE" || matchingPlayerByName.status === "LEFT") {
        // For LEFT players, we need to reactivate them with a new player_number
        if (matchingPlayerByName.status === "LEFT") {
          // Get smallest available player number
          const { data: activePlayers } = await supabase
            .from("game_players")
            .select("player_number")
            .eq("game_id", game.id)
            .eq("status", "ACTIVE")
            .eq("is_host", false)
            .not("player_number", "is", null);

          const usedNumbers = new Set((activePlayers || []).map(p => p.player_number));
          let playerNumber = 1;
          while (usedNumbers.has(playerNumber)) {
            playerNumber++;
          }

          // Check max players limit
          const maxPlayers = game.x_nb_joueurs || 100;
          if (playerNumber > maxPlayers) {
            return new Response(
              JSON.stringify({ error: `La partie est complète (${maxPlayers} joueurs max)` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Generate new token for reactivated player
          const newToken = generatePlayerToken();

          await supabase
            .from("game_players")
            .update({
              status: "ACTIVE",
              player_number: playerNumber,
              player_token: newToken,
              device_id: deviceId,
              removed_reason: null,
              removed_at: null,
              removed_by: null,
              last_seen: new Date().toISOString(),
            })
            .eq("id", matchingPlayerByName.id);

          console.log("Reactivated LEFT player by name:", matchingPlayerByName.display_name, "as #", playerNumber);

          return new Response(
            JSON.stringify({
              success: true,
              gameId: game.id,
              gameName: game.name,
              playerId: matchingPlayerByName.id,
              playerToken: newToken,
              playerNumber,
              displayName: matchingPlayerByName.display_name,
              jetons: matchingPlayerByName.jetons,
              recompenses: matchingPlayerByName.recompenses,
              clan: matchingPlayerByName.clan,
              reactivated: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // ACTIVE player reconnecting by name (different device)
        console.log("Reconnecting ACTIVE player by name (new device):", matchingPlayerByName.display_name);
        
        // Update device_id and last_seen
        await supabase
          .from("game_players")
          .update({ 
            last_seen: new Date().toISOString(),
            device_id: deviceId,
          })
          .eq("id", matchingPlayerByName.id);

        return new Response(
          JSON.stringify({
            success: true,
            gameId: game.id,
            gameName: game.name,
            playerId: matchingPlayerByName.id,
            playerToken: matchingPlayerByName.player_token,
            playerNumber: matchingPlayerByName.player_number,
            displayName: matchingPlayerByName.display_name,
            jetons: matchingPlayerByName.jetons,
            recompenses: matchingPlayerByName.recompenses,
            clan: matchingPlayerByName.clan,
            reconnected: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Case 2: LEFT/REMOVED player exists for this device -> reactivate
    if (existingPlayer && (existingPlayer.status === "LEFT" || existingPlayer.status === "REMOVED")) {
      console.log("Reactivating existing player by device:", existingPlayer.display_name, "status:", existingPlayer.status);

      // Get smallest available player number
      const { data: activePlayers } = await supabase
        .from("game_players")
        .select("player_number")
        .eq("game_id", game.id)
        .eq("status", "ACTIVE")
        .eq("is_host", false)
        .not("player_number", "is", null);

      const usedNumbers = new Set((activePlayers || []).map(p => p.player_number));
      let playerNumber = 1;
      while (usedNumbers.has(playerNumber)) {
        playerNumber++;
      }

      // Check max players limit
      const maxPlayers = game.x_nb_joueurs || 100;
      if (playerNumber > maxPlayers) {
        return new Response(
          JSON.stringify({ error: `La partie est complète (${maxPlayers} joueurs max)` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new token for reactivated player
      const newToken = generatePlayerToken();

      const { error: updateError } = await supabase
        .from("game_players")
        .update({
          status: "ACTIVE",
          player_number: playerNumber,
          player_token: newToken,
          display_name: displayName.trim(),
          clan: clan || null,
          removed_reason: null,
          removed_at: null,
          removed_by: null,
          last_seen: new Date().toISOString(),
        })
        .eq("id", existingPlayer.id);

      if (updateError) {
        console.error("Error reactivating player:", updateError);
        return new Response(
          JSON.stringify({ error: "Erreur lors de la réactivation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Player reactivated:", displayName, "as player #", playerNumber);

      return new Response(
        JSON.stringify({
          success: true,
          gameId: game.id,
          gameName: game.name,
          playerId: existingPlayer.id,
          playerToken: newToken,
          playerNumber,
          reactivated: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Case 3: No existing player -> create new one
    // First check subscription limits for authenticated users
    if (userId) {
      subscriptionLimits = await getUserSubscriptionLimits(supabase, userId, userEmail);
      if (!subscriptionLimits.canJoin) {
        console.log("Subscription limit reached for user:", userId);
        return new Response(
          JSON.stringify({ 
            error: "LIMIT_REACHED",
            reason: subscriptionLimits.reason,
            limitReached: true 
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get smallest available player number
    const { data: activePlayers } = await supabase
      .from("game_players")
      .select("player_number")
      .eq("game_id", game.id)
      .eq("status", "ACTIVE")
      .eq("is_host", false)
      .not("player_number", "is", null);

    const usedNumbers = new Set((activePlayers || []).map(p => p.player_number));
    let playerNumber = 1;
    while (usedNumbers.has(playerNumber)) {
      playerNumber++;
    }

    // Check max players limit
    const maxPlayers = game.x_nb_joueurs || 100;
    if (playerNumber > maxPlayers) {
      return new Response(
        JSON.stringify({ error: `La partie est complète (${maxPlayers} joueurs max)` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate player token
    const playerToken = generatePlayerToken();

    // Determine if player can have clan benefits
    const hasClanBenefits = subscriptionLimits?.hasClanBenefits ?? false;
    const effectiveClan = hasClanBenefits ? (clan || null) : null;
    
    // Insert new player with starting tokens from game
    const baseTokens = game.starting_tokens ?? 50;
    // Royaux clan bonus: 1.5x starting tokens (only if clan benefits available)
    const startingTokens = (hasClanBenefits && effectiveClan === 'Royaux') ? Math.floor(baseTokens * 1.5) : baseTokens;
    
    const { data: newPlayer, error: insertError } = await supabase
      .from("game_players")
      .insert({
        game_id: game.id,
        display_name: displayName.trim(),
        clan: effectiveClan,
        player_number: playerNumber,
        player_token: playerToken,
        device_id: deviceId,
        user_id: userId || null,
        status: "ACTIVE",
        is_host: false,
        jetons: startingTokens,
        recompenses: 0,
        is_alive: true,
        last_seen: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      
      // Check if it's a unique constraint violation (device already in game)
      if (insertError.message?.includes('idx_game_players_game_device')) {
        return new Response(
          JSON.stringify({ error: "Cet appareil est déjà dans la partie" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'inscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("New player joined:", displayName, "as player #", playerNumber, "device:", deviceId, "clan:", effectiveClan);

    return new Response(
      JSON.stringify({
        success: true,
        gameId: game.id,
        gameName: game.name,
        playerId: newPlayer.id,
        playerToken,
        playerNumber,
        clan: effectiveClan,
        hasClanBenefits,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
