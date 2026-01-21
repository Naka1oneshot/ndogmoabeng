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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { gameId } = await req.json();

    if (!gameId) {
      return new Response(
        JSON.stringify({ error: "ID de partie requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated and is the host
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the game with adventure info
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, name, status, host_user_id, current_session_game_id, current_step_index, adventure_id, mode, starting_tokens")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      console.error("Game fetch error:", gameError);
      return new Response(
        JSON.stringify({ error: "Partie introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (game.host_user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Seul le MJ peut avancer l'aventure" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (game.status !== "IN_GAME") {
      return new Response(
        JSON.stringify({ error: "La partie doit être en cours" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For single game mode, can't advance
    if (game.mode !== "ADVENTURE" || !game.adventure_id) {
      return new Response(
        JSON.stringify({ error: "Cette partie n'est pas une aventure multi-jeux" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark the current session_game as ENDED
    if (game.current_session_game_id) {
      await supabase
        .from("session_games")
        .update({
          status: "ENDED",
          ended_at: new Date().toISOString(),
        })
        .eq("id", game.current_session_game_id);
      
      console.log(`[next-session-game] Marked session_game ${game.current_session_game_id} as ENDED`);
    }

    const currentStepIndex = game.current_step_index || 1;
    const nextStepIndex = currentStepIndex + 1;

    // Get the next adventure step
    const { data: nextStep, error: stepError } = await supabase
      .from("adventure_steps")
      .select("id, game_type_code, token_policy, custom_starting_tokens")
      .eq("adventure_id", game.adventure_id)
      .eq("step_index", nextStepIndex)
      .single();

    if (stepError || !nextStep) {
      console.log(`[next-session-game] No more steps found, adventure complete`);
      
      // Adventure is complete
      await supabase
        .from("games")
        .update({
          status: "ENDED",
          current_step_index: currentStepIndex,
        })
        .eq("id", gameId);

      await supabase.from("session_events").insert({
        game_id: gameId,
        audience: "ALL",
        type: "SYSTEM",
        message: `🏆 L'aventure est terminée ! Félicitations à tous les participants !`,
        payload: { event: "ADVENTURE_COMPLETE", totalSteps: currentStepIndex },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          adventureComplete: true,
          message: "L'aventure est terminée !" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate starting tokens for the new step
    let newStartingTokens = game.starting_tokens;
    if (nextStep.token_policy === "RESET_TO_DEFAULT") {
      // Get default from game_types
      const { data: gameType } = await supabase
        .from("game_types")
        .select("default_starting_tokens")
        .eq("code", nextStep.game_type_code)
        .single();
      newStartingTokens = gameType?.default_starting_tokens || 10;
    } else if (nextStep.token_policy === "CUSTOM" && nextStep.custom_starting_tokens) {
      newStartingTokens = nextStep.custom_starting_tokens;
    }
    // INHERIT: keep the current starting_tokens

    // Create the new session_game for this step
    const { data: newSessionGame, error: createError } = await supabase
      .from("session_games")
      .insert({
        session_id: gameId,
        step_index: nextStepIndex,
        game_type_code: nextStep.game_type_code,
        status: "PENDING",
        manche_active: 1,
        phase: "PHASE1_MISES",
      })
      .select()
      .single();

    if (createError || !newSessionGame) {
      console.error("Session game creation error:", createError);
      return new Response(
        JSON.stringify({ error: "Erreur création session_game" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newSessionGameId = newSessionGame.id;
    console.log(`[next-session-game] Created new session_game: ${newSessionGameId} for step ${nextStepIndex}`);

    // Update games table with new session_game reference
    await supabase
      .from("games")
      .update({
        current_session_game_id: newSessionGameId,
        current_step_index: nextStepIndex,
        selected_game_type_code: nextStep.game_type_code,
        manche_active: 1,
        phase: "PHASE1_MISES",
        phase_locked: false,
        starting_tokens: newStartingTokens,
      })
      .eq("id", gameId);

    // Reset players' jetons for the new game based on token_policy
    const { data: players } = await supabase
      .from("game_players")
      .select("id, player_number, jetons, clan")
      .eq("game_id", gameId)
      .eq("status", "ACTIVE")
      .not("player_number", "is", null);

    if (players && players.length > 0) {
      for (const player of players) {
        let newJetons = player.jetons; // INHERIT by default
        
        if (nextStep.token_policy === "RESET_TO_DEFAULT" || nextStep.token_policy === "CUSTOM") {
          // Royaux clan bonus: 1.5x starting tokens
          newJetons = player.clan === 'Royaux' 
            ? Math.floor(newStartingTokens * 1.5) 
            : newStartingTokens;
        }
        
        await supabase
          .from("game_players")
          .update({ jetons: newJetons, is_alive: true, recompenses: 0 })
          .eq("id", player.id);
      }
    }

    // Initialize new inventories for this session_game (default weapon for all, Sniper for Akila)
    if (players && players.length > 0) {
      for (const player of players) {
        // Default weapon
        await supabase
          .from("inventory")
          .insert({
            game_id: gameId,
            session_game_id: newSessionGameId,
            owner_num: player.player_number,
            objet: "Par défaut (+2 si compagnon Akandé)",
            quantite: 1,
            disponible: true,
            dispo_attaque: true,
          });

        // Sniper for Akila clan
        if (player.clan === "Akila") {
          await supabase
            .from("inventory")
            .insert({
              game_id: gameId,
              session_game_id: newSessionGameId,
              owner_num: player.player_number,
              objet: "Sniper Akila",
              quantite: 1,
              disponible: true,
              dispo_attaque: true,
            });
          console.log(`Added Sniper Akila to player #${player.player_number} for new session_game`);
        }
      }
    }

    // Initialize monsters for the new session_game
    const { error: initMonsterConfigError } = await supabase.rpc(
      "initialize_game_monsters",
      { p_game_id: gameId }
    );
    if (initMonsterConfigError) {
      console.error("Monster config init error:", initMonsterConfigError);
    }

    // Update new monsters with session_game_id
    await supabase
      .from("game_monsters")
      .update({ session_game_id: newSessionGameId })
      .eq("game_id", gameId)
      .is("session_game_id", null);

    // Initialize runtime monster state with session_game_id
    const { error: initMonsterStateError } = await supabase.rpc(
      "initialize_game_state_monsters",
      { p_game_id: gameId, p_session_game_id: newSessionGameId }
    );
    if (initMonsterStateError) {
      console.error("Monster state init error:", initMonsterStateError);
    }

    // Update session_game status to RUNNING
    await supabase
      .from("session_games")
      .update({
        status: "RUNNING",
        started_at: new Date().toISOString(),
      })
      .eq("id", newSessionGameId);

    // Public event
    await supabase.from("session_events").insert({
      game_id: gameId,
      audience: "ALL",
      type: "SYSTEM",
      message: `🎮 Nouvelle étape ! Jeu ${nextStepIndex}: ${nextStep.game_type_code} – Manche 1`,
      payload: {
        event: "NEW_SESSION_GAME",
        stepIndex: nextStepIndex,
        gameTypeCode: nextStep.game_type_code,
        sessionGameId: newSessionGameId,
      },
    });

    // MJ event
    await supabase.from("session_events").insert({
      game_id: gameId,
      audience: "MJ",
      type: "ADMIN",
      message: `Transition vers étape ${nextStepIndex} (${nextStep.game_type_code})`,
      payload: {
        event: "NEW_SESSION_GAME_ADMIN",
        sessionGameId: newSessionGameId,
        previousSessionGameId: game.current_session_game_id,
        tokenPolicy: nextStep.token_policy,
        newStartingTokens: newStartingTokens,
      },
    });

    console.log(`[next-session-game] Successfully transitioned to step ${nextStepIndex}`);

    return new Response(
      JSON.stringify({
        success: true,
        adventureComplete: false,
        newSessionGameId,
        stepIndex: nextStepIndex,
        gameTypeCode: nextStep.game_type_code,
        tokenPolicy: nextStep.token_policy,
        startingTokens: newStartingTokens,
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

