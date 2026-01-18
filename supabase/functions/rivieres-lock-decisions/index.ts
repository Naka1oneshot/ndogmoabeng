import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LockDecisionsRequest {
  session_game_id: string;
  missing_players_action?: { player_id: string; action: "DESCENDS" | "RESTE_ZERO" }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_game_id, missing_players_action }: LockDecisionsRequest = await req.json();

    if (!session_game_id) {
      throw new Error("session_game_id requis");
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

    // Get all EN_BATEAU players
    const { data: enBateauPlayers, error: playersError } = await supabase
      .from("river_player_stats")
      .select("player_id, player_num")
      .eq("session_game_id", session_game_id)
      .eq("current_round_status", "EN_BATEAU");

    if (playersError) {
      throw new Error(`Erreur récupération joueurs: ${playersError.message}`);
    }

    // Get existing decisions for this level
    const { data: existingDecisions } = await supabase
      .from("river_decisions")
      .select("player_id, status")
      .eq("session_game_id", session_game_id)
      .eq("manche", state.manche_active)
      .eq("niveau", state.niveau_active);

    const submittedPlayerIds = new Set(existingDecisions?.map(d => d.player_id) || []);
    
    // Find players without decisions
    const missingPlayers = enBateauPlayers?.filter(p => !submittedPlayerIds.has(p.player_id)) || [];

    if (missingPlayers.length > 0 && !missing_players_action) {
      // Return list of missing players for MJ to decide
      const { data: playerDetails } = await supabase
        .from("game_players")
        .select("id, display_name, player_number")
        .in("id", missingPlayers.map(p => p.player_id));

      return new Response(
        JSON.stringify({
          success: false,
          needs_mj_decision: true,
          missing_players: playerDetails?.map(p => ({
            player_id: p.id,
            display_name: p.display_name,
            player_number: p.player_number,
          })) || [],
          message: "Certains joueurs n'ont pas soumis de décision. Veuillez choisir leur action.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle missing players if MJ provided actions
    if (missing_players_action && missing_players_action.length > 0) {
      for (const mpa of missing_players_action) {
        const playerStats = enBateauPlayers?.find(p => p.player_id === mpa.player_id);
        if (!playerStats) continue;

        await supabase
          .from("river_decisions")
          .upsert({
            game_id: state.game_id,
            session_game_id: session_game_id,
            manche: state.manche_active,
            niveau: state.niveau_active,
            player_id: mpa.player_id,
            player_num: playerStats.player_num,
            decision: mpa.action === "DESCENDS" ? "DESCENDS" : "RESTE",
            mise_demandee: 0,
            keryndes_choice: "NONE",
            submitted_at: new Date().toISOString(),
            status: "DRAFT",
          }, { onConflict: "session_game_id,manche,niveau,player_id" });
      }
    }

    // Lock all decisions
    const { error: lockError } = await supabase
      .from("river_decisions")
      .update({
        status: "LOCKED",
        locked_at: new Date().toISOString(),
      })
      .eq("session_game_id", session_game_id)
      .eq("manche", state.manche_active)
      .eq("niveau", state.niveau_active)
      .eq("status", "DRAFT");

    if (lockError) {
      throw new Error(`Erreur verrouillage: ${lockError.message}`);
    }

    // Get locked decisions for ranking
    const { data: lockedDecisions } = await supabase
      .from("river_decisions")
      .select("player_id, player_num, decision, mise_demandee")
      .eq("session_game_id", session_game_id)
      .eq("manche", state.manche_active)
      .eq("niveau", state.niveau_active)
      .eq("status", "LOCKED")
      .order("mise_demandee", { ascending: false });

    // Get player names
    const playerIds = lockedDecisions?.map(d => d.player_id) || [];
    const { data: players } = await supabase
      .from("game_players")
      .select("id, display_name")
      .in("id", playerIds);

    const playerNameMap = new Map(players?.map(p => [p.id, p.display_name]) || []);

    // Build ranking
    const resteDecisions = lockedDecisions?.filter(d => d.decision === "RESTE") || [];
    const descendsDecisions = lockedDecisions?.filter(d => d.decision === "DESCENDS") || [];

    const rankingPublic = resteDecisions
      .map(d => playerNameMap.get(d.player_id) || `Joueur ${d.player_num}`)
      .join(", ");

    const rankingMJ = resteDecisions
      .map(d => `${playerNameMap.get(d.player_id) || `J${d.player_num}`} (${d.mise_demandee}💎)`)
      .join(", ");

    const totalMises = resteDecisions.reduce((sum, d) => sum + d.mise_demandee, 0);

    // Log joueurs
    await supabase.from("logs_joueurs").insert({
      game_id: state.game_id,
      session_game_id: session_game_id,
      manche: state.manche_active,
      type: "CLASSEMENT",
      message: `📊 Niveau ${state.niveau_active} - Classement mises: ${rankingPublic || "Aucun"}${descendsDecisions.length > 0 ? ` | ${descendsDecisions.length} joueur(s) descendent du bateau` : ""}`,
    });

    // Log MJ
    await supabase.from("logs_mj").insert({
      game_id: state.game_id,
      session_game_id: session_game_id,
      action: "DECISIONS_LOCKED",
      manche: state.manche_active,
      details: `Niveau ${state.niveau_active} - Mises: ${rankingMJ || "Aucun"} | Total: ${totalMises}💎 | Descentes: ${descendsDecisions.length}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Décisions verrouillées",
        total_mises: totalMises,
        reste_count: resteDecisions.length,
        descends_count: descendsDecisions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("Erreur rivieres-lock-decisions:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
