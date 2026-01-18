import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitDecisionRequest {
  session_game_id: string;
  player_token: string;
  decision: "RESTE" | "DESCENDS";
  mise_demandee: number;
  keryndes_choice: "NONE" | "AV1_CANOT" | "AV2_REDUCE";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_game_id, player_token, decision, mise_demandee, keryndes_choice }: SubmitDecisionRequest = await req.json();

    if (!session_game_id || !player_token) {
      throw new Error("session_game_id et player_token requis");
    }

    // Get session state
    const { data: state, error: stateError } = await supabase
      .from("river_session_state")
      .select("*")
      .eq("session_game_id", session_game_id)
      .single();

    if (stateError || !state) {
      throw new Error("État de session RIVIERES non trouvé");
    }

    if (state.status !== "RUNNING") {
      throw new Error("La partie est terminée");
    }

    // Get player by token
    const { data: player, error: playerError } = await supabase
      .from("game_players")
      .select("id, player_number, display_name, clan, jetons, status")
      .eq("game_id", state.game_id)
      .eq("player_token", player_token)
      .single();

    if (playerError || !player) {
      throw new Error("Joueur non trouvé");
    }

    if (player.status !== "ACTIVE") {
      throw new Error("Joueur inactif");
    }

    // Get player stats
    const { data: playerStats, error: statsError } = await supabase
      .from("river_player_stats")
      .select("*")
      .eq("session_game_id", session_game_id)
      .eq("player_id", player.id)
      .single();

    if (statsError || !playerStats) {
      throw new Error("Stats joueur non trouvées");
    }

    // Check player is EN_BATEAU
    if (playerStats.current_round_status !== "EN_BATEAU") {
      throw new Error(`Vous êtes ${playerStats.current_round_status} et ne pouvez pas soumettre de décision`);
    }

    // Validate decision
    let finalMise = mise_demandee;
    let finalKeryndesChoice = keryndes_choice || "NONE";

    if (decision === "DESCENDS") {
      finalMise = 0;
      if (finalKeryndesChoice === "AV1_CANOT") {
        finalKeryndesChoice = "NONE"; // Can't use canot if descending
      }
    } else if (decision === "RESTE") {
      // Validate mise
      if (finalMise < 0) {
        throw new Error("La mise ne peut pas être négative");
      }
      if (finalMise > player.jetons) {
        throw new Error(`Mise trop élevée. Vous avez ${player.jetons} jetons`);
      }
    } else {
      throw new Error("Décision invalide: RESTE ou DESCENDS attendu");
    }

    // Validate Keryndes choice
    if (finalKeryndesChoice !== "NONE") {
      if (player.clan !== "Keryndes") {
        finalKeryndesChoice = "NONE";
      } else if (!playerStats.keryndes_available) {
        throw new Error("Pouvoir Keryndes déjà utilisé");
      } else if (finalKeryndesChoice === "AV1_CANOT" && decision !== "RESTE") {
        throw new Error("Le canot ne peut être utilisé que si vous restez");
      }
    }

    // Check if decision already exists for this level
    const { data: existingDecision } = await supabase
      .from("river_decisions")
      .select("id, status")
      .eq("session_game_id", session_game_id)
      .eq("manche", state.manche_active)
      .eq("niveau", state.niveau_active)
      .eq("player_id", player.id)
      .single();

    if (existingDecision?.status === "LOCKED") {
      throw new Error("Décision déjà verrouillée");
    }

    // Upsert decision
    const decisionData = {
      game_id: state.game_id,
      session_game_id: session_game_id,
      manche: state.manche_active,
      niveau: state.niveau_active,
      player_id: player.id,
      player_num: player.player_number,
      decision: decision,
      mise_demandee: finalMise,
      keryndes_choice: finalKeryndesChoice,
      submitted_at: new Date().toISOString(),
      status: "DRAFT",
    };

    if (existingDecision) {
      await supabase
        .from("river_decisions")
        .update(decisionData)
        .eq("id", existingDecision.id);
    } else {
      await supabase
        .from("river_decisions")
        .insert(decisionData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Décision enregistrée",
        decision: decision,
        mise: finalMise,
        keryndes_choice: finalKeryndesChoice,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("Erreur rivieres-submit-decision:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
