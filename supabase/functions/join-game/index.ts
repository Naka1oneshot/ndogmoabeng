import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePlayerToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { joinCode, displayName, clan } = await req.json();

    if (!joinCode || !displayName) {
      return new Response(
        JSON.stringify({ error: "Code et nom requis" }),
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
      .single();

    if (gameError || !game) {
      console.log("Game not found for code:", joinCode);
      return new Response(
        JSON.stringify({ error: "Partie introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow joining in LOBBY or IN_ROUND status
    if (game.status !== "LOBBY" && game.status !== "IN_ROUND") {
      console.log("Game status not valid for joining:", game.status);
      return new Response(
        JSON.stringify({ error: "Cette partie n'accepte plus de nouveaux joueurs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this player was previously REMOVED (by display_name)
    const { data: removedPlayer } = await supabase
      .from("game_players")
      .select("id, status, removed_reason")
      .eq("game_id", game.id)
      .eq("display_name", displayName.trim())
      .eq("status", "REMOVED")
      .maybeSingle();

    if (removedPlayer) {
      console.log("Player was previously removed:", displayName);
      return new Response(
        JSON.stringify({ error: removedPlayer.removed_reason || "Vous avez été expulsé de cette partie par le MJ" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this player already has an ACTIVE entry (reconnection)
    const { data: existingActive } = await supabase
      .from("game_players")
      .select("id, player_number, player_token, clan")
      .eq("game_id", game.id)
      .eq("display_name", displayName.trim())
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (existingActive) {
      // Player is reconnecting - return existing data and update last_seen
      console.log("Player reconnecting:", displayName, "with number", existingActive.player_number);
      
      await supabase
        .from("game_players")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", existingActive.id);

      return new Response(
        JSON.stringify({
          success: true,
          reconnected: true,
          gameId: game.id,
          gameName: game.name,
          playerId: existingActive.id,
          playerNumber: existingActive.player_number,
          playerToken: existingActive.player_token,
          clan: existingActive.clan,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ACTIVE players to find the next available player number
    const { data: activePlayers, error: playersError } = await supabase
      .from("game_players")
      .select("player_number")
      .eq("game_id", game.id)
      .eq("status", "ACTIVE")
      .not("player_number", "is", null)
      .order("player_number", { ascending: true });

    if (playersError) {
      console.error("Error fetching players:", playersError);
    }

    // Find the smallest available player number among ACTIVE players
    const maxPlayers = game.x_nb_joueurs || 100;
    const usedNumbers = new Set((activePlayers || []).map((p) => p.player_number));
    
    let playerNumber: number | null = null;
    for (let i = 1; i <= maxPlayers; i++) {
      if (!usedNumbers.has(i)) {
        playerNumber = i;
        break;
      }
    }

    if (playerNumber === null) {
      console.log("No available player slots. Max:", maxPlayers, "Used:", usedNumbers.size);
      return new Response(
        JSON.stringify({ error: `La partie est complète (${maxPlayers} joueurs max)` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique player token
    const playerToken = generatePlayerToken();

    console.log("Creating player:", { 
      gameId: game.id, 
      displayName: displayName.trim(), 
      playerNumber, 
      clan: clan || null 
    });

    // Insert the new player
    const { data: newPlayer, error: insertError } = await supabase
      .from("game_players")
      .insert({
        game_id: game.id,
        user_id: null,
        display_name: displayName.trim(),
        player_token: playerToken,
        player_number: playerNumber,
        clan: clan || null,
        is_host: false,
        jetons: 0,
        recompenses: 0,
        is_alive: true,
        last_seen: new Date().toISOString(),
        status: 'ACTIVE',
      })
      .select("id, player_number, clan")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'inscription: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Player created successfully:", newPlayer);

    return new Response(
      JSON.stringify({
        success: true,
        gameId: game.id,
        gameName: game.name,
        playerId: newPlayer.id,
        playerNumber: newPlayer.player_number,
        playerToken: playerToken,
        clan: newPlayer.clan,
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
