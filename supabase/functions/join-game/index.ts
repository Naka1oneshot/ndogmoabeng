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
    const { joinCode, displayName } = await req.json();

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
      .select("id, status")
      .eq("join_code", joinCode.toUpperCase())
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: "Partie introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (game.status !== "LOBBY") {
      return new Response(
        JSON.stringify({ error: "Cette partie a déjà commencé" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing players to find the next available player number
    const { data: existingPlayers } = await supabase
      .from("game_players")
      .select("player_number")
      .eq("game_id", game.id)
      .not("player_number", "is", null)
      .order("player_number", { ascending: true });

    // Find the smallest available player number
    let playerNumber = 1;
    if (existingPlayers && existingPlayers.length > 0) {
      const usedNumbers = new Set(existingPlayers.map((p) => p.player_number));
      while (usedNumbers.has(playerNumber)) {
        playerNumber++;
      }
    }

    // Generate unique player token
    const playerToken = generatePlayerToken();

    // Insert the new player
    const { data: newPlayer, error: insertError } = await supabase
      .from("game_players")
      .insert({
        game_id: game.id,
        user_id: null,
        display_name: displayName.trim(),
        player_token: playerToken,
        player_number: playerNumber,
        is_host: false,
      })
      .select("id, player_number")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'inscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        gameId: game.id,
        playerId: newPlayer.id,
        playerNumber: newPlayer.player_number,
        playerToken: playerToken,
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
