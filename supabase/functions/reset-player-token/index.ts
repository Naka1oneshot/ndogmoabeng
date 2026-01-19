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
    const authHeader = req.headers.get("Authorization");
    console.log("[reset-player-token] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.log("[reset-player-token] No auth header - returning 401");
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé - pas de header d'authentification" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { playerId } = await req.json();
    console.log("[reset-player-token] playerId:", playerId);

    if (!playerId) {
      return new Response(
        JSON.stringify({ success: false, error: "ID joueur requis" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user is authenticated and is the host
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    console.log("[reset-player-token] User:", user?.id, "Auth error:", authError?.message);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé - utilisateur non authentifié" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the player
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, game_id")
      .eq("id", playerId)
      .single();

    if (playerError || !player) {
      console.log("[reset-player-token] Player not found:", playerError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Joueur non trouvé" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the game to verify the current user is the host
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("host_user_id")
      .eq("id", player.game_id)
      .single();

    if (gameError || !game) {
      console.log("[reset-player-token] Game not found:", gameError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Partie non trouvée" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if current user is the host
    console.log("[reset-player-token] Host check - game.host_user_id:", game.host_user_id, "user.id:", user.id);
    if (game.host_user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Seul le MJ peut réinitialiser les tokens" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new token
    const newToken = generatePlayerToken();

    // Update the player's token
    const { error: updateError } = await supabase
      .from("game_players")
      .update({ player_token: newToken })
      .eq("id", playerId);

    if (updateError) {
      console.error("[reset-player-token] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur lors de la mise à jour" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[reset-player-token] Success - new token generated for player:", playerId);

    return new Response(
      JSON.stringify({
        success: true,
        newToken: newToken,
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
