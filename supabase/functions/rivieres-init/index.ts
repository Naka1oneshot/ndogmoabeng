import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InitRequest {
  session_game_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_game_id }: InitRequest = await req.json();

    if (!session_game_id) {
      throw new Error("session_game_id requis");
    }

    // Get session_game and game info
    const { data: sessionGame, error: sgError } = await supabase
      .from("session_games")
      .select("id, session_id, game_type_code, config, step_index")
      .eq("id", session_game_id)
      .single();

    if (sgError || !sessionGame) {
      throw new Error("Session game non trouvée");
    }

    if (sessionGame.game_type_code !== "RIVIERES") {
      throw new Error("Cette fonction est réservée au jeu RIVIERES");
    }

    const gameId = sessionGame.session_id;

    // Get game info
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, mode, starting_tokens, adventure_id")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      throw new Error("Game non trouvée");
    }

    // Get game_type default config
    const { data: gameType } = await supabase
      .from("game_types")
      .select("default_starting_tokens, default_config")
      .eq("code", "RIVIERES")
      .single();

    // Determine starting tokens
    let startingTokens = game.starting_tokens || gameType?.default_starting_tokens || 100;

    // In ADVENTURE mode, check token_policy
    if (game.mode === "ADVENTURE" && game.adventure_id) {
      const { data: step } = await supabase
        .from("adventure_steps")
        .select("token_policy, custom_starting_tokens")
        .eq("adventure_id", game.adventure_id)
        .eq("step_index", sessionGame.step_index)
        .single();

      if (step) {
        if (step.token_policy === "RESET") {
          startingTokens = step.custom_starting_tokens || gameType?.default_starting_tokens || 100;
        }
        // INHERIT: keep current tokens from game_players
      }
    }

    // Check if river_session_state already exists
    const { data: existingState } = await supabase
      .from("river_session_state")
      .select("id")
      .eq("session_game_id", session_game_id)
      .single();

    if (existingState) {
      return new Response(
        JSON.stringify({ success: true, message: "Session RIVIERES déjà initialisée" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create river_session_state
    const { error: stateError } = await supabase
      .from("river_session_state")
      .insert({
        game_id: gameId,
        session_game_id: session_game_id,
        manche_active: 1,
        niveau_active: 1,
        cagnotte_manche: 0,
        status: "RUNNING",
      });

    if (stateError) {
      throw new Error(`Erreur création état: ${stateError.message}`);
    }

    // Get all active players
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id, player_number, clan, jetons")
      .eq("game_id", gameId)
      .eq("status", "ACTIVE");

    if (playersError) {
      throw new Error(`Erreur récupération joueurs: ${playersError.message}`);
    }

    if (!players || players.length === 0) {
      throw new Error("Aucun joueur actif dans la partie");
    }

    // Create river_player_stats for each player
    const playerStats = players.map((p) => ({
      game_id: gameId,
      session_game_id: session_game_id,
      player_id: p.id,
      player_num: p.player_number,
      validated_levels: 0,
      keryndes_available: p.clan === "Keryndes",
      current_round_status: "EN_BATEAU",
      descended_level: null,
    }));

    const { error: statsError } = await supabase
      .from("river_player_stats")
      .insert(playerStats);

    if (statsError) {
      throw new Error(`Erreur création stats joueurs: ${statsError.message}`);
    }

    // Initialize tokens if RESET or SINGLE_GAME with no tokens set
    if (game.mode === "SINGLE_GAME" || game.mode === "ADVENTURE") {
      for (const p of players) {
        // In ADVENTURE with INHERIT, don't reset tokens
        if (game.mode === "ADVENTURE") {
          const { data: step } = await supabase
            .from("adventure_steps")
            .select("token_policy")
            .eq("adventure_id", game.adventure_id)
            .eq("step_index", sessionGame.step_index)
            .single();
          
          if (step?.token_policy === "INHERIT" && p.jetons > 0) {
            continue; // Keep existing tokens
          }
        }

        await supabase
          .from("game_players")
          .update({ jetons: startingTokens })
          .eq("id", p.id);
      }
    }

    // Log MJ
    await supabase.from("logs_mj").insert({
      game_id: gameId,
      session_game_id: session_game_id,
      action: "INIT_PARTIE",
      manche: 1,
      details: `Partie RIVIERES initialisée avec ${players.length} joueurs. Jetons de départ: ${startingTokens}`,
    });

    // Log joueurs (narratif)
    await supabase.from("logs_joueurs").insert({
      game_id: gameId,
      session_game_id: session_game_id,
      manche: 1,
      type: "NARRATION",
      message: `🚣 Les Rivières de Ndogmoabeng s'éveillent... ${players.length} aventuriers embarquent sur le fleuve sacré. Manche 1, Niveau 1 - Que le courant vous soit favorable !`,
    });

    // Update session_game status
    await supabase
      .from("session_games")
      .update({ status: "RUNNING", started_at: new Date().toISOString(), phase: "DECISIONS" })
      .eq("id", session_game_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Session RIVIERES initialisée",
        players_count: players.length,
        starting_tokens: startingTokens
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("Erreur rivieres-init:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
