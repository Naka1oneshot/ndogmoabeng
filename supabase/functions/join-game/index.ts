import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a unique player token
function generatePlayerToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { joinCode, displayName, clan, deviceId } = await req.json();

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
      .select("id, name, status, x_nb_joueurs")
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

    // Check if participant already exists for this device in this game
    const { data: existingPlayer, error: existingError } = await supabase
      .from("game_players")
      .select("id, status, player_number, player_token, display_name, removed_reason")
      .eq("game_id", game.id)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (existingError) {
      console.error("Existing player lookup error:", existingError);
    }

    // Case 1: ACTIVE player exists -> return existing player
    if (existingPlayer && existingPlayer.status === "ACTIVE") {
      console.log("Returning existing ACTIVE player:", existingPlayer.display_name);
      
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
          reconnected: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Case 2: LEFT/REMOVED player exists -> reactivate
    if (existingPlayer && (existingPlayer.status === "LEFT" || existingPlayer.status === "REMOVED")) {
      console.log("Reactivating existing player:", existingPlayer.display_name, "status:", existingPlayer.status);

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

    // Insert new player
    const { data: newPlayer, error: insertError } = await supabase
      .from("game_players")
      .insert({
        game_id: game.id,
        display_name: displayName.trim(),
        clan: clan || null,
        player_number: playerNumber,
        player_token: playerToken,
        device_id: deviceId,
        status: "ACTIVE",
        is_host: false,
        jetons: 0,
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

    console.log("New player joined:", displayName, "as player #", playerNumber, "device:", deviceId);

    return new Response(
      JSON.stringify({
        success: true,
        gameId: game.id,
        gameName: game.name,
        playerId: newPlayer.id,
        playerToken,
        playerNumber,
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
