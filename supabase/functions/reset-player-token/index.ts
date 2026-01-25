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

    // Get the player with user_id
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, game_id, user_id, display_name")
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

    // Check if current user is the host OR an admin
    const { data: isAdmin } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });
    
    console.log("[reset-player-token] Host check - game.host_user_id:", game.host_user_id, "user.id:", user.id, "isAdmin:", isAdmin);
    
    if (game.host_user_id !== user.id && !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Seul le MJ ou un admin peut réinitialiser les tokens" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new token
    const newToken = generatePlayerToken();
    
    // Build the reconnect URL
    const publicBaseUrl = 'https://ndogmoabeng.com';
    const reconnectUrl = `${publicBaseUrl}/player/${player.game_id}?token=${newToken}`;

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

    // If player has a user account, store the reconnect link
    if (player.user_id) {
      console.log("[reset-player-token] Player has user account, storing reconnect link for user:", player.user_id);
      
      const { error: linkError } = await supabase
        .from("player_reconnect_links")
        .upsert({
          user_id: player.user_id,
          game_id: player.game_id,
          game_player_id: player.id,
          reconnect_url: reconnectUrl,
          player_token: newToken,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,game_id'
        });

      if (linkError) {
        console.error("[reset-player-token] Error storing reconnect link:", linkError);
        // Don't fail the whole operation, just log the error
      } else {
        console.log("[reset-player-token] Reconnect link stored successfully");
      }
    }

    console.log("[reset-player-token] Success - new token generated for player:", playerId);

    return new Response(
      JSON.stringify({
        success: true,
        newToken: newToken,
        reconnectUrl: reconnectUrl,
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
