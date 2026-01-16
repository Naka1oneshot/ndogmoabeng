import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { playerId, reason } = await req.json();

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: "playerId requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the player to kick and their game info
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, game_id, player_number, display_name, status")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      console.error("Player not found:", playerError);
      return new Response(
        JSON.stringify({ error: "Joueur introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (player.status === "REMOVED") {
      return new Response(
        JSON.stringify({ error: "Joueur déjà expulsé" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the game to check if we're in LOBBY
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, status")
      .eq("id", player.game_id)
      .single();

    if (gameError || !game) {
      console.error("Game not found:", gameError);
      return new Response(
        JSON.stringify({ error: "Partie introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kickedPlayerNumber = player.player_number;
    const removedReason = reason || "Expulsé par le Maître du Jeu";

    console.log("Kicking player:", {
      playerId,
      playerName: player.display_name,
      playerNumber: kickedPlayerNumber,
      gameId: player.game_id,
      gameStatus: game.status,
    });

    // Step 1: Mark the player as REMOVED (set player_number to null)
    const { error: updateError } = await supabase
      .from("game_players")
      .update({
        status: "REMOVED",
        player_number: null,
        removed_reason: removedReason,
        removed_at: new Date().toISOString(),
      })
      .eq("id", playerId);

    if (updateError) {
      console.error("Error updating player status:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de l'expulsion" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Only renumber if in LOBBY and the player had a number
    if (game.status === "LOBBY" && kickedPlayerNumber !== null) {
      // Get all ACTIVE players that are PRESENT (last_seen within 60 seconds)
      const presenceThreshold = new Date(Date.now() - 60 * 1000).toISOString();
      
      const { data: activePresentPlayers, error: fetchError } = await supabase
        .from("game_players")
        .select("id, player_number, last_seen")
        .eq("game_id", player.game_id)
        .eq("status", "ACTIVE")
        .eq("is_host", false)
        .not("player_number", "is", null)
        .gte("last_seen", presenceThreshold)
        .order("player_number", { ascending: true });

      if (fetchError) {
        console.error("Error fetching active players:", fetchError);
        // Continue anyway, renumbering is optional
      } else if (activePresentPlayers && activePresentPlayers.length > 0) {
        console.log("Renumbering active present players:", activePresentPlayers.length);
        
        // Renumber from 1 to N in order
        for (let i = 0; i < activePresentPlayers.length; i++) {
          const newNumber = i + 1;
          const p = activePresentPlayers[i];
          
          if (p.player_number !== newNumber) {
            const { error: renumberError } = await supabase
              .from("game_players")
              .update({ player_number: newNumber })
              .eq("id", p.id);

            if (renumberError) {
              console.error(`Error renumbering player ${p.id}:`, renumberError);
            } else {
              console.log(`Renumbered player ${p.id}: ${p.player_number} -> ${newNumber}`);
            }
          }
        }
      }
    }

    console.log("Player kicked successfully:", player.display_name);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${player.display_name} a été expulsé`,
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
