import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateValidatePlayerInput } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate and sanitize all inputs
    const rawInput = await req.json();
    const validation = validateValidatePlayerInput(rawInput);
    
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ valid: false, error: validation.error || "Paramètres invalides" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { gameId, playerToken } = validation.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the player by game ID and token
    const { data: player, error } = await supabase
      .from("game_players")
      .select("id, display_name, player_number, game_id, status, removed_reason, jetons, recompenses, clan, mate_num, role_code, team_code, immune_permanent, pvic, is_alive")
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
      .select("id, name, status, join_code, manche_active, phase, phase_locked, current_session_game_id, selected_game_type_code, mode, adventure_id, current_step_index")
      .eq("id", gameId)
      .single();

    return new Response(
      JSON.stringify({
        valid: true,
        player: {
          id: player.id,
          displayName: player.display_name,
          playerNumber: player.player_number,
          jetons: player.jetons,
          recompenses: player.recompenses,
          clan: player.clan,
          mateNum: player.mate_num,
          roleCode: player.role_code,
          teamCode: player.team_code,
          immunePermanent: player.immune_permanent,
          pvic: player.pvic,
          isAlive: player.is_alive,
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
