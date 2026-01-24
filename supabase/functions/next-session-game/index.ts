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
      .select("id, name, status, host_user_id, current_session_game_id, current_step_index, adventure_id, mode, starting_tokens, selected_game_type_code")
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

    // Mark the current session_game as ENDED and save adventure scores
    if (game.current_session_game_id) {
      await supabase
        .from("session_games")
        .update({
          status: "ENDED",
          ended_at: new Date().toISOString(),
        })
        .eq("id", game.current_session_game_id);
      
      console.log(`[next-session-game] Marked session_game ${game.current_session_game_id} as ENDED`);

      // Save adventure scores for this session_game
      const { data: players } = await supabase
        .from("game_players")
        .select("id, player_number, recompenses, pvic, jetons")
        .eq("game_id", gameId)
        .eq("status", "ACTIVE")
        .not("player_number", "is", null);

      if (players && players.length > 0) {
        console.log(`[next-session-game] Saving adventure scores for ${players.length} players`);
        
        for (const player of players) {
          // Calculate score: recompenses (kills) + bonus for remaining tokens
          const score = (player.recompenses || 0) + (player.pvic || 0);
          
          // Check if adventure_score already exists for this player
          const { data: existingScore } = await supabase
            .from("adventure_scores")
            .select("id, total_score_value, breakdown")
            .eq("session_id", gameId)
            .eq("game_player_id", player.id)
            .single();

          if (existingScore) {
            const breakdown = existingScore.breakdown || {};
            breakdown[game.current_session_game_id] = score;
            const newTotal = Object.values(breakdown).reduce((sum: number, val: unknown) => sum + (Number(val) || 0), 0);

            await supabase
              .from("adventure_scores")
              .update({
                total_score_value: newTotal,
                breakdown,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingScore.id);
            
            console.log(`[next-session-game] Updated adventure_score for player ${player.player_number}: +${score} = ${newTotal}`);
          } else {
            await supabase.from("adventure_scores").insert({
              session_id: gameId,
              game_player_id: player.id,
              total_score_value: score,
              breakdown: { [game.current_session_game_id]: score },
            });
            
            console.log(`[next-session-game] Created adventure_score for player ${player.player_number}: ${score}`);
          }
        }
      }
    }

    const currentStepIndex = game.current_step_index || 1;
    const nextStepIndex = currentStepIndex + 1;

    // Get the CURRENT step to know the game type we're coming FROM
    const { data: currentStep } = await supabase
      .from("adventure_steps")
      .select("id, game_type_code")
      .eq("adventure_id", game.adventure_id)
      .eq("step_index", currentStepIndex)
      .single();

    const currentGameType = currentStep?.game_type_code || game.selected_game_type_code;
    console.log(`[next-session-game] Current game type: ${currentGameType}`);

    // Get the next adventure step
    const { data: nextStep, error: stepError } = await supabase
      .from("adventure_steps")
      .select("id, game_type_code, token_policy, custom_starting_tokens")
      .eq("adventure_id", game.adventure_id)
      .eq("step_index", nextStepIndex)
      .single();

    if (stepError || !nextStep) {
      console.log(`[next-session-game] No more steps found, adventure complete`);
      
      // Save final adventure scores before ending
      const { data: finalPlayers } = await supabase
        .from("game_players")
        .select("id, player_number, recompenses, pvic")
        .eq("game_id", gameId)
        .eq("status", "ACTIVE")
        .not("player_number", "is", null);

      if (finalPlayers && finalPlayers.length > 0 && game.current_session_game_id) {
        console.log(`[next-session-game] Saving final adventure scores for ${finalPlayers.length} players`);
        
        for (const player of finalPlayers) {
          const score = (player.recompenses || 0) + (player.pvic || 0);
          
          const { data: existingScore } = await supabase
            .from("adventure_scores")
            .select("id, total_score_value, breakdown")
            .eq("session_id", gameId)
            .eq("game_player_id", player.id)
            .single();

          if (existingScore) {
            const breakdown = existingScore.breakdown || {};
            breakdown[game.current_session_game_id] = score;
            const newTotal = Object.values(breakdown).reduce((sum: number, val: unknown) => sum + (Number(val) || 0), 0);

            await supabase
              .from("adventure_scores")
              .update({
                total_score_value: newTotal,
                breakdown,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingScore.id);
          } else {
            await supabase.from("adventure_scores").insert({
              session_id: gameId,
              game_player_id: player.id,
              total_score_value: score,
              breakdown: { [game.current_session_game_id]: score },
            });
          }
        }
      }
      
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

    // NEW TOKEN POLICY based on game types:
    // - RIVIERES: players start with 100 tokens
    // - FORET: players start with 50 tokens
    // - SHERIFF: players start with 0 tokens
    // - INFECTION: players inherit tokens from previous game (SHERIFF)
    
    const GAME_TYPE_TOKENS: Record<string, number | "INHERIT"> = {
      "RIVIERES": 100,
      "FORET": 50,
      "SHERIFF": 0,
      "INFECTION": "INHERIT",
    };

    const nextGameTokenPolicy = GAME_TYPE_TOKENS[nextStep.game_type_code];
    let newStartingTokens: number;
    
    if (nextGameTokenPolicy === "INHERIT") {
      // For INFECTION: inherit tokens from previous game
      newStartingTokens = game.starting_tokens || 0;
      console.log(`[next-session-game] INHERIT mode: keeping tokens from previous game`);
    } else if (typeof nextGameTokenPolicy === "number") {
      newStartingTokens = nextGameTokenPolicy;
      console.log(`[next-session-game] Fixed tokens for ${nextStep.game_type_code}: ${newStartingTokens}`);
    } else {
      // Fallback to old logic if game type not in our map
      if (nextStep.token_policy === "RESET_TO_DEFAULT") {
        const { data: gameType } = await supabase
          .from("game_types")
          .select("default_starting_tokens")
          .eq("code", nextStep.game_type_code)
          .single();
        newStartingTokens = gameType?.default_starting_tokens || 10;
      } else if (nextStep.token_policy === "CUSTOM" && nextStep.custom_starting_tokens) {
        newStartingTokens = nextStep.custom_starting_tokens;
      } else {
        newStartingTokens = game.starting_tokens || 10;
      }
    }

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

    // Reset players' jetons for the new game based on NEW token policy
    const { data: players } = await supabase
      .from("game_players")
      .select("id, player_number, jetons, clan, pvic")
      .eq("game_id", gameId)
      .eq("status", "ACTIVE")
      .not("player_number", "is", null);

    if (players && players.length > 0) {
      for (const player of players) {
        let newJetons: number;
        
        if (nextGameTokenPolicy === "INHERIT") {
          // INFECTION: inherit final tokens from SHERIFF
          newJetons = player.jetons || 0;
          console.log(`[next-session-game] Player ${player.player_number} inherits ${newJetons} jetons`);
        } else if (typeof nextGameTokenPolicy === "number") {
          // Fixed starting tokens with Royaux bonus
          newJetons = player.clan === 'Royaux' 
            ? Math.floor(nextGameTokenPolicy * 1.5) 
            : nextGameTokenPolicy;
        } else {
          // Fallback to old logic
          if (nextStep.token_policy === "RESET_TO_DEFAULT" || nextStep.token_policy === "CUSTOM") {
            newJetons = player.clan === 'Royaux' 
              ? Math.floor(newStartingTokens * 1.5) 
              : newStartingTokens;
          } else {
            newJetons = player.jetons || 0;
          }
        }
        
        // Keep PVic accumulated - DON'T reset it!
        await supabase
          .from("game_players")
          .update({ 
            jetons: newJetons, 
            is_alive: true, 
            recompenses: 0,
            // pvic is NOT reset - it accumulates across games
          })
          .eq("id", player.id);
        
        console.log(`[next-session-game] Player ${player.player_number}: jetons=${newJetons}, pvic kept=${player.pvic}`);
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

    // Only initialize monsters for FORET game type
    if (nextStep.game_type_code === "FORET") {
      console.log(`[next-session-game] Initializing monsters for FORET game`);
      
      // First, delete any existing game_state_monsters for this game to start fresh
      const { error: deleteStateError } = await supabase
        .from("game_state_monsters")
        .delete()
        .eq("game_id", gameId);
      
      if (deleteStateError) {
        console.error("Error deleting old monster state:", deleteStateError);
      } else {
        console.log(`[next-session-game] Cleared old game_state_monsters`);
      }
      
      // Delete old game_monsters config to start fresh
      const { error: deleteConfigError } = await supabase
        .from("game_monsters")
        .delete()
        .eq("game_id", gameId);
      
      if (deleteConfigError) {
        console.error("Error deleting old monster config:", deleteConfigError);
      } else {
        console.log(`[next-session-game] Cleared old game_monsters config`);
      }

      // Initialize fresh monster configuration
      const { error: initMonsterConfigError } = await supabase.rpc(
        "initialize_game_monsters",
        { p_game_id: gameId }
      );
      if (initMonsterConfigError) {
        console.error("Monster config init error:", initMonsterConfigError);
      } else {
        console.log(`[next-session-game] Monster config initialized`);
      }

      // Update new monsters with session_game_id
      await supabase
        .from("game_monsters")
        .update({ session_game_id: newSessionGameId })
        .eq("game_id", gameId);
      
      console.log(`[next-session-game] Updated game_monsters with session_game_id`);

      // Initialize runtime monster state with session_game_id
      const { error: initMonsterStateError } = await supabase.rpc(
        "initialize_game_state_monsters",
        { p_game_id: gameId, p_session_game_id: newSessionGameId }
      );
      if (initMonsterStateError) {
        console.error("Monster state init error:", initMonsterStateError);
      } else {
        console.log(`[next-session-game] Monster state initialized for session ${newSessionGameId}`);
      }
    } else {
      console.log(`[next-session-game] Skipping monster init for ${nextStep.game_type_code} (not FORET)`);
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

