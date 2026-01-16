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
    const { gameId, playerToken } = await req.json();

    if (!gameId || !playerToken) {
      return new Response(
        JSON.stringify({ valid: false, error: "Paramètres manquants" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the player by game ID and token
    const { data: player, error } = await supabase
      .from("game_players")
      .select("id, display_name, player_number, game_id, status, removed_reason")
      .eq("game_id", gameId)
      .eq("player_token", playerToken)
      .single();

    if (error || !player) {
      return new Response(
        JSON.stringify({ valid: false, error: "Joueur non trouvé" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if player was removed
    if (player.status === "REMOVED") {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          removed: true,
          error: player.removed_reason || "Vous avez été expulsé de cette partie" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get game info
    const { data: game } = await supabase
      .from("games")
      .select("id, name, status, join_code")
      .eq("id", gameId)
      .single();

    return new Response(
      JSON.stringify({
        valid: true,
        player: {
          id: player.id,
          displayName: player.display_name,
          playerNumber: player.player_number,
        },
        game: game,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
