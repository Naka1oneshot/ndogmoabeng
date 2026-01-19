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

// Tier clan benefits configuration
const TIER_CLAN_BENEFITS: Record<string, boolean> = {
  freemium: false,
  starter: true,
  premium: true,
  royal: true,
};

// Check user clan benefits only (no join limits anymore)
async function getUserClanBenefits(supabase: any, userId: string, userEmail: string | null): Promise<boolean> {
  let effectiveTier = "freemium";

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

  // Check for trial
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
  }

  return TIER_CLAN_BENEFITS[effectiveTier] ?? false;
}

// Get user token balance
async function getUserTokenBalance(supabase: any, userId: string): Promise<number> {
  const { data } = await supabase
    .from("user_subscription_bonuses")
    .select("token_balance")
    .eq("user_id", userId)
    .single();
  
  return data?.token_balance || 0;
}

// Consume a token for clan usage
async function consumeTokenForClan(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_subscription_bonuses")
    .update({ 
      token_balance: supabase.raw('token_balance - 1'),
      tokens_used_for_clan: supabase.raw('COALESCE(tokens_used_for_clan, 0) + 1'),
    })
    .eq("user_id", userId)
    .gte("token_balance", 1)
    .select()
    .single();
  
  return !error && data !== null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { joinCode, displayName, clan, deviceId, reconnectKey, useTokenForClan, lockClan } = await req.json();

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

    // Try to get authenticated user from authorization header for clan benefits
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
    console.log("Join attempt:", { displayName, nameNormalized, deviceId, hasReconnectKey: !!reconnectKey, userId, useTokenForClan, lockClan });

    // Priority 1: Try to reconnect by reconnect_key (player_token) if provided
    if (reconnectKey) {
      const { data: tokenPlayer, error: tokenError } = await supabase
        .from("game_players")
        .select("id, status, player_number, player_token, display_name, removed_reason, jetons, recompenses, clan, clan_locked, clan_token_used")
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
              clanLocked: tokenPlayer.clan_locked,
              clanTokenUsed: tokenPlayer.clan_token_used,
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
      .select("id, status, player_number, player_token, display_name, removed_reason, jetons, recompenses, clan, clan_locked, clan_token_used")
      .eq("game_id", game.id)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (existingError) {
      console.error("Existing player lookup error:", existingError);
    }

    // Case 1: ACTIVE player exists for this device -> return existing player
    if (existingPlayer && existingPlayer.status === "ACTIVE") {
      console.log("Returning existing ACTIVE player by device:", existingPlayer.display_name);
      
      // Update last_seen and optionally display_name (but NOT clan if locked)
      const updateData: any = { 
        last_seen: new Date().toISOString(),
        display_name: displayName.trim(),
      };
      
      // Only update clan if not locked
      if (!existingPlayer.clan_locked) {
        updateData.clan = clan || null;
      }
      
      await supabase
        .from("game_players")
        .update(updateData)
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
          clanLocked: existingPlayer.clan_locked,
          clanTokenUsed: existingPlayer.clan_token_used,
          reconnected: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Priority 3: Try to find existing player by normalized name
    const { data: allPlayers } = await supabase
      .from("game_players")
      .select("id, status, player_number, player_token, display_name, removed_reason, jetons, recompenses, clan, device_id, clan_locked, clan_token_used")
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
              clanLocked: matchingPlayerByName.clan_locked,
              clanTokenUsed: matchingPlayerByName.clan_token_used,
              reactivated: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // ACTIVE player reconnecting by name (different device)
        console.log("Reconnecting ACTIVE player by name (new device):", matchingPlayerByName.display_name);
        
        // Update device_id and last_seen (but NOT clan if locked)
        const updateData: any = { 
          last_seen: new Date().toISOString(),
          device_id: deviceId,
        };
        
        if (!matchingPlayerByName.clan_locked) {
          updateData.clan = clan || null;
        }
        
        await supabase
          .from("game_players")
          .update(updateData)
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
            clanLocked: matchingPlayerByName.clan_locked,
            clanTokenUsed: matchingPlayerByName.clan_token_used,
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
    // Check clan benefits for authenticated users
    let hasClanBenefits = false;
    let clanTokenUsed = false;
    
    if (userId) {
      hasClanBenefits = await getUserClanBenefits(supabase, userId, userEmail);
      
      // If user wants to use a token for clan benefits and doesn't have subscription benefits
      if (!hasClanBenefits && useTokenForClan && clan) {
        const tokenBalance = await getUserTokenBalance(supabase, userId);
        if (tokenBalance >= 1) {
          // Don't consume yet - will be consumed at game start
          hasClanBenefits = true;
          clanTokenUsed = true;
          console.log("Player will use token for clan benefits:", displayName);
        }
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
    const effectiveClan = hasClanBenefits ? (clan || null) : null;
    const shouldLockClan = lockClan && effectiveClan !== null;
    
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
        clan_locked: shouldLockClan,
        clan_token_used: clanTokenUsed,
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

    console.log("New player joined:", displayName, "as player #", playerNumber, "device:", deviceId, "clan:", effectiveClan, "clanLocked:", shouldLockClan, "clanTokenUsed:", clanTokenUsed);

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
        clanLocked: shouldLockClan,
        clanTokenUsed,
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