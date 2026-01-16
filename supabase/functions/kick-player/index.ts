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
    const { playerId, reason, withBan } = await req.json();

    if (!playerId) {
      return new Response(
        JSON.stringify({ error: "playerId requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reason || !reason.trim()) {
      return new Response(
        JSON.stringify({ error: "Raison requise" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the player to kick and their game info
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, game_id, player_number, display_name, status, device_id")
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

    // Get the game to check status
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, status, host_user_id")
      .eq("id", player.game_id)
      .single();

    if (gameError || !game) {
      console.error("Game not found:", gameError);
      return new Response(
        JSON.stringify({ error: "Partie introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Kicking player:", {
      playerId,
      playerName: player.display_name,
      playerNumber: player.player_number,
      gameId: player.game_id,
      gameStatus: game.status,
      withBan,
      deviceId: player.device_id,
    });

    // Step 1: If withBan=true, create a ban record
    if (withBan && player.device_id) {
      const { error: banError } = await supabase
        .from("session_bans")
        .insert({
          game_id: player.game_id,
          device_id: player.device_id,
          reason: reason.trim(),
          created_by: game.host_user_id,
        });

      if (banError) {
        // If it's a duplicate, ignore it
        if (!banError.message?.includes('duplicate')) {
          console.error("Error creating ban:", banError);
        }
      } else {
        console.log("Ban created for device:", player.device_id);
      }
    }

    // Step 2: Mark the player as REMOVED
    const { error: updateError } = await supabase
      .from("game_players")
      .update({
        status: "REMOVED",
        player_number: null,
        removed_reason: reason.trim(),
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

    // Step 3: Renumber remaining ACTIVE players (1..N without gaps)
    const { data: activePlayers, error: fetchError } = await supabase
      .from("game_players")
      .select("id, player_number")
      .eq("game_id", player.game_id)
      .eq("status", "ACTIVE")
      .eq("is_host", false)
      .not("player_number", "is", null)
      .order("player_number", { ascending: true });

    if (fetchError) {
      console.error("Error fetching active players:", fetchError);
    } else if (activePlayers && activePlayers.length > 0) {
      console.log("Renumbering all ACTIVE players:", activePlayers.length);

      for (let i = 0; i < activePlayers.length; i++) {
        const newNumber = i + 1;
        const p = activePlayers[i];

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

    console.log("Player kicked successfully:", player.display_name, withBan ? "(banned)" : "(no ban)");

    return new Response(
      JSON.stringify({
        success: true,
        message: withBan 
          ? `${player.display_name} a été expulsé et bloqué`
          : `${player.display_name} a été expulsé`,
        banned: withBan,
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
