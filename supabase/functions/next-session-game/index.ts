import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default token values per game type (used as fallback when no config exists)
const DEFAULT_GAME_TYPE_TOKENS: Record<string, number> = {
  "RIVIERES": 100,
  "FORET": 50,
  "SHERIFF": 20,
  "INFECTION": 0, // INFECTION typically inherits
  "LION": 0, // LION typically inherits
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

      // Get current game type to handle game-specific score saving
      const currentGameTypeCode = game.selected_game_type_code;
      
      // Get players for score saving
      const { data: players } = await supabase
        .from("game_players")
        .select("id, player_number, recompenses, pvic, jetons")
        .eq("game_id", gameId)
        .eq("status", "ACTIVE")
        .not("player_number", "is", null);

      // SHERIFF: Save adventure_scores based on sheriff_player_choices victory_points_delta
      // Sheriff's resolution function updates game_players.pvic but may not always save to adventure_scores
      if (currentGameTypeCode === "SHERIFF" && players && players.length > 0) {
        console.log(`[next-session-game] Saving SHERIFF scores to adventure_scores`);
        
        // Get sheriff player choices to calculate the delta for this game
        const { data: sheriffChoices } = await supabase
          .from("sheriff_player_choices")
          .select("player_number, pvic_initial, victory_points_delta")
          .eq("session_game_id", game.current_session_game_id);
        
        for (const player of players) {
          // Find the sheriff choice for this player
          const choice = sheriffChoices?.find(c => c.player_number === player.player_number);
          
          // Calculate sheriff delta: current pvic vs pvic_initial (which is pre-sheriff)
          // If no choice found, delta is 0
          let sheriffDelta = 0;
          if (choice) {
            const pvicInitial = choice.pvic_initial || 0;
            const vpDelta = choice.victory_points_delta || 0;
            // Sheriff applies VP delta as percentage: newPvic = pvicInitial * (1 + vpDelta/100)
            // So the delta = newPvic - pvicInitial
            const expectedNewPvic = Math.round(pvicInitial * (1 + vpDelta / 100));
            sheriffDelta = expectedNewPvic - pvicInitial;
          }
          
          // Fetch existing adventure_scores
          const { data: existingScore } = await supabase
            .from("adventure_scores")
            .select("id, total_score_value, breakdown")
            .eq("session_id", gameId)
            .eq("game_player_id", player.id)
            .single();
          
          if (existingScore) {
            const existingBreakdown = (existingScore.breakdown as Record<string, number>) || {};
            
            // Only update if this session's score isn't already in the breakdown
            if (existingBreakdown[game.current_session_game_id] === undefined) {
              existingBreakdown[game.current_session_game_id] = sheriffDelta;
              
              // Recalculate total from all breakdown values
              const newTotal = Object.values(existingBreakdown).reduce((sum: number, val: number) => sum + (Number(val) || 0), 0);
              
              await supabase
                .from("adventure_scores")
                .update({
                  total_score_value: newTotal,
                  breakdown: existingBreakdown,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingScore.id);
              
              console.log(`[next-session-game] SHERIFF: Player ${player.player_number} saved delta=${sheriffDelta}, newTotal=${newTotal}`);
            } else {
              console.log(`[next-session-game] SHERIFF: Player ${player.player_number} already has score for this session, skipping`);
            }
          } else {
            // Create new adventure_scores entry
            await supabase
              .from("adventure_scores")
              .insert({
                session_id: gameId,
                game_player_id: player.id,
                total_score_value: sheriffDelta,
                breakdown: { [game.current_session_game_id]: sheriffDelta },
              });
            
            console.log(`[next-session-game] SHERIFF: Created adventure_scores for player ${player.player_number}: delta=${sheriffDelta}`);
          }
        }
      } else {
        // For other games, scores are saved by their resolution functions
        console.log(`[next-session-game] Skipping adventure_score save for ${currentGameTypeCode} - already done by game resolution function`);
      }
      
      if (players && players.length > 0) {
        for (const player of players) {
          console.log(`[next-session-game] Player ${player.player_number}: pvic=${player.pvic}, recompenses=${player.recompenses}`);
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
      .select("id, game_type_code, token_policy, custom_starting_tokens, default_step_config")
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

      console.log(`[next-session-game] Adventure complete - scores already saved by game resolution`);
      
      if (finalPlayers && finalPlayers.length > 0) {
        for (const player of finalPlayers) {
          console.log(`[next-session-game] Final player ${player.player_number}: pvic=${player.pvic}, recompenses=${player.recompenses}`);
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

    // =====================================================================
    // LOAD ADVENTURE CONFIG (CONFIG-FIRST approach)
    // =====================================================================
    let adventureConfig: any = null;
    const { data: agc } = await supabase
      .from("adventure_game_configs")
      .select("config")
      .eq("game_id", gameId)
      .single();

    if (agc?.config) {
      adventureConfig = agc.config;
      console.log(`[next-session-game] Loaded adventure_game_configs for game ${gameId}`);
    }

    // =====================================================================
    // DETERMINE TOKEN POLICY (priority: config > step policy > game_type default)
    // =====================================================================
    const gameTypeCode = nextStep.game_type_code;
    let newStartingTokens: number;
    let tokenPolicyUsed: string = "default";
    
    // Check adventure config first
    const tokenPolicyFromConfig = adventureConfig?.token_policies?.[gameTypeCode];
    
    if (tokenPolicyFromConfig) {
      if (tokenPolicyFromConfig.mode === "FIXED" && typeof tokenPolicyFromConfig.fixedValue === "number") {
        newStartingTokens = tokenPolicyFromConfig.fixedValue;
        tokenPolicyUsed = "config_fixed";
        console.log(`[next-session-game] Using config FIXED tokens for ${gameTypeCode}: ${newStartingTokens}`);
      } else if (tokenPolicyFromConfig.mode === "INHERIT") {
        newStartingTokens = game.starting_tokens || 0;
        tokenPolicyUsed = "config_inherit";
        console.log(`[next-session-game] Using config INHERIT tokens for ${gameTypeCode}: ${newStartingTokens}`);
      } else {
        // Fallback to game_type default
        newStartingTokens = DEFAULT_GAME_TYPE_TOKENS[gameTypeCode] ?? 10;
        tokenPolicyUsed = "game_type_default";
      }
    } else if (nextStep.token_policy === "CUSTOM" && nextStep.custom_starting_tokens !== null) {
      // Use step-level custom tokens
      newStartingTokens = nextStep.custom_starting_tokens;
      tokenPolicyUsed = "step_custom";
      console.log(`[next-session-game] Using step CUSTOM tokens: ${newStartingTokens}`);
    } else if (nextStep.token_policy === "INHERIT") {
      // Inherit from previous game
      newStartingTokens = game.starting_tokens || 0;
      tokenPolicyUsed = "step_inherit";
      console.log(`[next-session-game] Using step INHERIT tokens: ${newStartingTokens}`);
    } else if (nextStep.token_policy === "RESET_TO_DEFAULT") {
      // Use game_type default
      const { data: gameType } = await supabase
        .from("game_types")
        .select("default_starting_tokens")
        .eq("code", gameTypeCode)
        .single();
      newStartingTokens = gameType?.default_starting_tokens ?? DEFAULT_GAME_TYPE_TOKENS[gameTypeCode] ?? 10;
      tokenPolicyUsed = "reset_to_default";
      console.log(`[next-session-game] Using RESET_TO_DEFAULT tokens: ${newStartingTokens}`);
    } else {
      // Final fallback
      newStartingTokens = DEFAULT_GAME_TYPE_TOKENS[gameTypeCode] ?? 10;
      tokenPolicyUsed = "fallback";
      console.log(`[next-session-game] Using fallback tokens: ${newStartingTokens}`);
    }

    // Create the new session_game for this step
    const { data: newSessionGame, error: createError } = await supabase
      .from("session_games")
      .insert({
        session_id: gameId,
        step_index: nextStepIndex,
        game_type_code: gameTypeCode,
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
        selected_game_type_code: gameTypeCode,
        manche_active: 1,
        phase: "PHASE1_MISES",
        phase_locked: false,
        starting_tokens: newStartingTokens,
      })
      .eq("id", gameId);

    // Get players for updates
    const { data: players } = await supabase
      .from("game_players")
      .select("id, player_number, jetons, clan, pvic, mate_num, display_name, status")
      .eq("game_id", gameId)
      .eq("status", "ACTIVE")
      .not("player_number", "is", null);

    // =====================================================================
    // UPDATE PLAYER TOKENS based on policy
    // =====================================================================
    const shouldInheritTokens = tokenPolicyUsed === "config_inherit" || tokenPolicyUsed === "step_inherit";
    
    if (players && players.length > 0) {
      for (const player of players) {
        let newJetons: number;
        
        if (shouldInheritTokens) {
          // INHERIT: keep current tokens
          newJetons = player.jetons || 0;
          console.log(`[next-session-game] Player ${player.player_number} inherits ${newJetons} jetons`);
        } else {
          // FIXED/RESET/CUSTOM: apply new tokens with Royaux bonus
          newJetons = player.clan === 'Royaux' 
            ? Math.floor(newStartingTokens * 1.5) 
            : newStartingTokens;
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

    // Initialize new inventories for FORET game type
    if (gameTypeCode === "FORET" && players && players.length > 0) {
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

    // =====================================================================
    // GAME-SPECIFIC INITIALIZATION
    // =====================================================================
    if (gameTypeCode === "FORET") {
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
      
      // Delete old game_monsters config
      const { error: deleteConfigError } = await supabase
        .from("game_monsters")
        .delete()
        .eq("game_id", gameId);
      
      if (deleteConfigError) {
        console.error("Error deleting old monster config:", deleteConfigError);
      } else {
        console.log(`[next-session-game] Cleared old game_monsters config`);
      }

      // =====================================================================
      // CHECK FOR ADVENTURE MONSTER CONFIG
      // =====================================================================
      const foretMonstersConfig = adventureConfig?.foret_monsters?.selected;
      
      if (foretMonstersConfig && Array.isArray(foretMonstersConfig) && foretMonstersConfig.length > 0) {
        console.log(`[next-session-game] Using adventure foret_monsters config: ${foretMonstersConfig.length} entries`);
        
        // Insert monsters from adventure config
        const monstersToInsert = foretMonstersConfig
          .filter((m: any) => m.enabled !== false)
          .map((m: any, index: number) => ({
            game_id: gameId,
            session_game_id: newSessionGameId,
            monster_id: m.monster_id,
            is_enabled: m.enabled !== false,
            pv_max_override: m.pv_max_override || null,
            reward_override: m.reward_override || null,
            initial_status: index < 3 ? 'EN_BATAILLE' : 'EN_FILE',
            order_index: index + 1,
          }));
        
        if (monstersToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from("game_monsters")
            .insert(monstersToInsert);
          
          if (insertError) {
            console.error("Error inserting adventure monsters:", insertError);
          } else {
            console.log(`[next-session-game] Inserted ${monstersToInsert.length} monsters from adventure config`);
            
            // Log an example for debugging
            const example = monstersToInsert[0];
            console.log(`[next-session-game] Example monster: id=${example.monster_id}, pv_override=${example.pv_max_override}, reward_override=${example.reward_override}`);
          }
        }
      } else {
        // Fallback: use default monster initialization
        console.log(`[next-session-game] No adventure monster config, using defaults`);
        
        const { error: initMonsterConfigError } = await supabase.rpc(
          "initialize_game_monsters",
          { p_game_id: gameId }
        );
        if (initMonsterConfigError) {
          console.error("Monster config init error:", initMonsterConfigError);
        } else {
          console.log(`[next-session-game] Monster config initialized with defaults`);
        }

        // Update new monsters with session_game_id
        await supabase
          .from("game_monsters")
          .update({ session_game_id: newSessionGameId })
          .eq("game_id", gameId);
      }
      
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
      
      // Log debug event for MJ
      await supabase.from("session_events").insert({
        game_id: gameId,
        session_game_id: newSessionGameId,
        audience: "MJ",
        type: "DEBUG",
        message: `🌲 Forêt initialisée: ${newStartingTokens} jetons (${tokenPolicyUsed}), monstres: ${foretMonstersConfig ? 'config aventure' : 'défaut'}`,
        payload: { 
          tokensApplied: newStartingTokens, 
          tokenPolicy: tokenPolicyUsed,
          monsterSource: foretMonstersConfig ? 'adventure_config' : 'default',
          monsterCount: foretMonstersConfig?.filter((m: any) => m.enabled !== false).length || 'default'
        },
      });
      
    } else if (gameTypeCode === "INFECTION") {
      console.log(`[next-session-game] Initializing INFECTION game`);
      
      // Load role distribution from adventure config if available
      const infectionConfig = adventureConfig?.infection_config;
      let roleConfig: Record<string, number>;
      const playerCount = players?.length || 0;
      
      if (infectionConfig?.roleDistribution) {
        roleConfig = infectionConfig.roleDistribution;
        console.log(`[next-session-game] Using adventure infection roleDistribution:`, roleConfig);
      } else {
        // Default role distribution based on player count
        if (playerCount === 7) {
          roleConfig = { BA: 1, PV: 2, SY: 2, AE: 0, OC: 1, KK: 0, CV: 1 };
        } else if (playerCount === 8) {
          roleConfig = { BA: 1, PV: 2, SY: 2, AE: 0, OC: 1, KK: 1, CV: 1 };
        } else {
          roleConfig = { BA: 1, PV: 2, SY: 2, AE: 1, OC: 1, KK: 1, CV: Math.max(1, playerCount - 8) };
        }
        console.log(`[next-session-game] Using default infection roleDistribution for ${playerCount} players:`, roleConfig);
      }
      
      const ROLE_TO_TEAM: Record<string, string> = {
        BA: 'NEUTRE',
        PV: 'PV',
        SY: 'SY',
        AE: 'NEUTRE',
        OC: 'NEUTRE',
        KK: 'NEUTRE',
        CV: 'CITOYEN',
      };
      
      // Shuffle helper
      const shuffleArray = <T>(array: T[]): T[] => {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
      };
      
      // Build role list and shuffle
      const roles: string[] = [];
      for (const [role, count] of Object.entries(roleConfig)) {
        for (let i = 0; i < count; i++) {
          roles.push(role);
        }
      }
      const shuffledRoles = shuffleArray(roles);
      
      console.log(`[next-session-game] INFECTION role distribution:`, roleConfig);
      
      // Assign roles to players
      if (players && players.length >= 7) {
        let antibodiesAssigned = false;
        const cvPlayerIds: string[] = [];
        
        for (let i = 0; i < players.length; i++) {
          const player = players[i];
          const role = shuffledRoles[i] || 'CV';
          const team = ROLE_TO_TEAM[role] || 'CITOYEN';
          
          if (role === 'CV') {
            cvPlayerIds.push(player.id);
          }
          
          await supabase
            .from("game_players")
            .update({
              role_code: role,
              team_code: team,
              is_alive: true,
              immune_permanent: false,
              is_carrier: false,
              is_contagious: false,
              infected_at_manche: null,
              will_contaminate_at_manche: null,
              will_die_at_manche: null,
              has_antibodies: false,
            })
            .eq("id", player.id);
        }
        
        // Assign antibodies to random CV player
        if (cvPlayerIds.length > 0) {
          const randomCvId = cvPlayerIds[Math.floor(Math.random() * cvPlayerIds.length)];
          await supabase
            .from("game_players")
            .update({ has_antibodies: true })
            .eq("id", randomCvId);
          console.log(`[next-session-game] Antibodies assigned to player ${randomCvId}`);
        }
        
        // Create role-specific inventory items
        for (let i = 0; i < players.length; i++) {
          const player = players[i];
          const role = shuffledRoles[i] || 'CV';
          const playerNum = player.player_number!;
          
          // Delete old inventory for this session
          await supabase
            .from("inventory")
            .delete()
            .eq("session_game_id", newSessionGameId)
            .eq("owner_num", playerNum);
          
          // Role-specific items
          if (role === 'BA') {
            await supabase.from("inventory").insert({
              game_id: gameId,
              session_game_id: newSessionGameId,
              owner_num: playerNum,
              objet: 'Balle BA',
              quantite: 1,
              disponible: true,
              dispo_attaque: true,
            });
          } else if (role === 'PV') {
            await supabase.from("inventory").insert([
              {
                game_id: gameId,
                session_game_id: newSessionGameId,
                owner_num: playerNum,
                objet: 'Balle PV',
                quantite: 1,
                disponible: true,
                dispo_attaque: true,
              },
              {
                game_id: gameId,
                session_game_id: newSessionGameId,
                owner_num: playerNum,
                objet: 'Antidote PV',
                quantite: 1,
                disponible: true,
                dispo_attaque: false,
              },
            ]);
          } else if (role === 'OC') {
            await supabase.from("inventory").insert({
              game_id: gameId,
              session_game_id: newSessionGameId,
              owner_num: playerNum,
              objet: 'Boule de cristal',
              quantite: 1,
              disponible: true,
              dispo_attaque: false,
            });
          }
          
          // Ezkar clan bonus
          if (player.clan === 'Ezkar') {
            await supabase.from("inventory").insert([
              {
                game_id: gameId,
                session_game_id: newSessionGameId,
                owner_num: playerNum,
                objet: 'Antidote Ezkar',
                quantite: 1,
                disponible: true,
                dispo_attaque: false,
              },
              {
                game_id: gameId,
                session_game_id: newSessionGameId,
                owner_num: playerNum,
                objet: 'Gilet',
                quantite: 1,
                disponible: true,
                dispo_attaque: false,
              },
            ]);
          }
        }
        
        // Create shared PV venin item
        await supabase.from("inventory").insert({
          game_id: gameId,
          session_game_id: newSessionGameId,
          owner_num: 0,
          objet: 'Dose de venin PV',
          quantite: 1,
          disponible: true,
          dispo_attaque: false,
        });
        
        console.log(`[next-session-game] INFECTION inventory created`);
      }
      
      // Create infection_round_state for manche 1
      const syCount = roleConfig.SY || 2;
      const syRequiredSuccess = syCount >= 2 ? 2 : 3;
      
      const { error: roundError } = await supabase
        .from("infection_round_state")
        .insert({
          game_id: gameId,
          session_game_id: newSessionGameId,
          manche: 1,
          status: 'OPEN',
          sy_success_count: 0,
          sy_required_success: syRequiredSuccess,
          opened_at: new Date().toISOString(),
        });
      
      if (roundError) {
        console.error(`[next-session-game] Error creating infection_round_state:`, roundError);
      } else {
        console.log(`[next-session-game] infection_round_state created for manche 1`);
      }
      
      // Update session_game phase to OPEN for INFECTION
      await supabase
        .from("session_games")
        .update({ phase: 'OPEN' })
        .eq("id", newSessionGameId);
      
      // Update games phase to OPEN for INFECTION
      await supabase
        .from("games")
        .update({ phase: 'OPEN' })
        .eq("id", gameId);
      
      console.log(`[next-session-game] INFECTION initialization complete`);
      
    } else if (gameTypeCode === "SHERIFF") {
      console.log(`[next-session-game] Initializing SHERIFF game`);
      
      // Load sheriff config from adventure
      const sheriffConfig = adventureConfig?.sheriff_config;
      const adventurePot = adventureConfig?.adventure_pot;
      
      // Determine common pool initial value
      let commonPoolInitial = adventurePot?.currentAmount ?? 100;
      
      // Pool config
      const poolConfig = {
        cost_per_player: sheriffConfig?.cost_per_player ?? 5,
        floor_percent: sheriffConfig?.floor_percent ?? 40,
        visa_pvic_percent: sheriffConfig?.visa_pvic_percent ?? 50,
        duel_max_impact: sheriffConfig?.duel_max_impact ?? 10,
      };
      
      console.log(`[next-session-game] SHERIFF config: pool=${commonPoolInitial}, config=`, poolConfig);
      
      // Create sheriff_round_state
      const { error: stateError } = await supabase
        .from("sheriff_round_state")
        .upsert({
          game_id: gameId,
          session_game_id: newSessionGameId,
          phase: 'CHOICES',
          current_duel_order: null,
          total_duels: 0,
          common_pool_initial: commonPoolInitial,
          common_pool_spent: 0,
          bot_config: poolConfig,
        }, { onConflict: 'session_game_id' });
      
      if (stateError) {
        console.error(`[next-session-game] Error creating sheriff_round_state:`, stateError);
      } else {
        console.log(`[next-session-game] sheriff_round_state created with pool ${commonPoolInitial}`);
      }
      
      // Set player tokens based on policy (NOT hardcoded 20)
      if (players && players.length > 0) {
        for (const player of players) {
          // Note: newStartingTokens was already calculated above based on token policy
          const playerJetons = shouldInheritTokens ? player.jetons : newStartingTokens;
          const finalJetons = player.clan === 'Royaux' && !shouldInheritTokens
            ? Math.floor((playerJetons || 0) * 1.5)
            : playerJetons || 0;
          
          await supabase
            .from("game_players")
            .update({ jetons: finalJetons })
            .eq("id", player.id);
        }
        console.log(`[next-session-game] Sheriff tokens set based on policy: ${tokenPolicyUsed} = ${newStartingTokens}`);
        
        // Delete old inventory items for this session
        for (const player of players) {
          await supabase
            .from("inventory")
            .delete()
            .eq("session_game_id", newSessionGameId)
            .eq("owner_num", player.player_number);
        }
        
        // Create sheriff_player_choices for each player with pvic_initial snapshot
        const choicesInsert = players.map(p => ({
          game_id: gameId,
          session_game_id: newSessionGameId,
          player_id: p.id,
          player_number: p.player_number,
          visa_choice: null,
          tokens_entering: null,
          has_illegal_tokens: false,
          pvic_initial: p.pvic ?? 0,
        }));
        
        const { error: choicesError } = await supabase
          .from("sheriff_player_choices")
          .upsert(choicesInsert, { onConflict: 'session_game_id,player_number' });
        
        if (choicesError) {
          console.error(`[next-session-game] Error creating sheriff_player_choices:`, choicesError);
        } else {
          console.log(`[next-session-game] sheriff_player_choices created for ${players.length} players`);
        }
      }
      
      // Update session_game phase to PHASE1_CHOICES for SHERIFF
      await supabase
        .from("session_games")
        .update({ phase: 'PHASE1_CHOICES' })
        .eq("id", newSessionGameId);
      
      // Update games phase to PHASE1_CHOICES for SHERIFF
      await supabase
        .from("games")
        .update({ phase: 'PHASE1_CHOICES' })
        .eq("id", gameId);
      
      console.log(`[next-session-game] SHERIFF initialization complete`);
      
    } else if (gameTypeCode === "RIVIERES") {
      console.log(`[next-session-game] Initializing RIVIERES game`);
      
      // Check if river_session_state already exists (idempotency)
      const { data: existingState } = await supabase
        .from("river_session_state")
        .select("id")
        .eq("session_game_id", newSessionGameId)
        .maybeSingle();
      
      if (!existingState) {
        // Create river_session_state
        const { error: stateError } = await supabase
          .from("river_session_state")
          .insert({
            game_id: gameId,
            session_game_id: newSessionGameId,
            manche_active: 1,
            niveau_active: 1,
            cagnotte_manche: 0,
            status: "RUNNING",
          });
        
        if (stateError) {
          console.error(`[next-session-game] Error creating river_session_state:`, stateError);
        } else {
          console.log(`[next-session-game] river_session_state created`);
        }
      }
      
      // Create river_player_stats for each player
      if (players && players.length > 0) {
        // Delete old inventory items for this session
        for (const player of players) {
          await supabase
            .from("inventory")
            .delete()
            .eq("session_game_id", newSessionGameId)
            .eq("owner_num", player.player_number);
        }
        
        // Create river_player_stats
        const playerStats = players.map((p) => ({
          game_id: gameId,
          session_game_id: newSessionGameId,
          player_id: p.id,
          player_num: p.player_number,
          validated_levels: 0,
          keryndes_available: p.clan === "Keryndes",
          current_round_status: "EN_BATEAU",
          descended_level: null,
        }));
        
        const { error: statsError } = await supabase
          .from("river_player_stats")
          .upsert(playerStats, { onConflict: 'session_game_id,player_num' });
        
        if (statsError) {
          console.error(`[next-session-game] Error creating river_player_stats:`, statsError);
        } else {
          console.log(`[next-session-game] river_player_stats created for ${players.length} players`);
        }
        
        // Set starting tokens based on policy (with Royaux bonus)
        for (const player of players) {
          const playerTokens = player.clan === 'Royaux' && !shouldInheritTokens
            ? Math.floor(newStartingTokens * 1.5) 
            : shouldInheritTokens ? (player.jetons || 0) : newStartingTokens;
          
          await supabase
            .from("game_players")
            .update({ jetons: playerTokens })
            .eq("id", player.id);
        }
        console.log(`[next-session-game] Rivieres tokens set based on policy: ${tokenPolicyUsed} = ${newStartingTokens}`);
      }
      
      // Update session_game phase to DECISIONS for RIVIERES
      await supabase
        .from("session_games")
        .update({ phase: 'DECISIONS' })
        .eq("id", newSessionGameId);
      
      // Update games phase to DECISIONS for RIVIERES
      await supabase
        .from("games")
        .update({ phase: 'DECISIONS' })
        .eq("id", gameId);
      
      // Log joueurs (narratif)
      await supabase.from("logs_joueurs").insert({
        game_id: gameId,
        session_game_id: newSessionGameId,
        manche: 1,
        type: "NARRATION",
        message: `🚣 Les Rivières de Ndogmoabeng s'éveillent... ${players?.length || 0} aventuriers embarquent sur le fleuve sacré. Manche 1, Niveau 1 - Que le courant vous soit favorable !`,
      });
      
      console.log(`[next-session-game] RIVIERES initialization complete`);
      
    } else if (gameTypeCode === "LION") {
      console.log(`[next-session-game] Initializing LION game (adventure finale)`);
      
      // LION is the final duel in adventures
      // Only the top team (by combined PVic) plays as ACTIVE
      // All other players become SPECTATOR
      
      if (players && players.length >= 2) {
        // Calculate team scores (pairs by mate_num)
        const teamScores: Record<number, { players: typeof players, totalPvic: number, minPlayerNum: number }> = {};
        
        for (const player of players) {
          const teamKey = Math.min(player.player_number!, player.mate_num || player.player_number!);
          if (!teamScores[teamKey]) {
            teamScores[teamKey] = { players: [], totalPvic: 0, minPlayerNum: teamKey };
          }
          teamScores[teamKey].players.push(player);
          teamScores[teamKey].totalPvic += player.pvic || 0;
        }
        
        // Sort teams by total PVic (descending), tie-break by smallest player_number
        const sortedTeams = Object.values(teamScores)
          .filter(t => t.players.length === 2) // Only complete teams
          .sort((a, b) => {
            if (b.totalPvic !== a.totalPvic) return b.totalPvic - a.totalPvic;
            return a.minPlayerNum - b.minPlayerNum;
          });
        
        console.log(`[next-session-game] LION team rankings:`, sortedTeams.map(t => ({
          team: t.minPlayerNum,
          totalPvic: t.totalPvic,
          players: t.players.map(p => p.display_name)
        })));
        
        let finalistIds: string[] = [];
        let finalistNames: string[] = [];
        let teamPvic = 0;
        let usedFallback = false;
        
        if (sortedTeams.length > 0) {
          // Normal case: use top complete team
          const winningTeam = sortedTeams[0];
          finalistIds = winningTeam.players.map(p => p.id);
          finalistNames = winningTeam.players.map(p => p.display_name);
          teamPvic = winningTeam.totalPvic;
        } else {
          // FALLBACK: No complete teams - take top 2 individuals by PVic
          console.log(`[next-session-game] LION FALLBACK: No complete teams, selecting top 2 individuals`);
          usedFallback = true;
          
          const sortedIndividuals = [...players].sort((a, b) => {
            const pvicDiff = (b.pvic || 0) - (a.pvic || 0);
            if (pvicDiff !== 0) return pvicDiff;
            return (a.player_number || 99) - (b.player_number || 99);
          });
          
          const top2 = sortedIndividuals.slice(0, 2);
          finalistIds = top2.map(p => p.id);
          finalistNames = top2.map(p => p.display_name);
          teamPvic = top2.reduce((sum, p) => sum + (p.pvic || 0), 0);
          
          console.log(`[next-session-game] LION FALLBACK finalists: ${finalistNames.join(' vs ')}`);
        }
        
        // Verify we have exactly 2 finalists
        if (finalistIds.length !== 2) {
          console.error(`[next-session-game] LION ERROR: Expected 2 finalists, got ${finalistIds.length}`);
          return new Response(
            JSON.stringify({ 
              error: `Impossible de déterminer les 2 finalistes pour le Lion. ${finalistIds.length} joueur(s) éligible(s).`,
              details: { playerCount: players.length, completeTeams: sortedTeams.length }
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Set finalists as ACTIVE
        await supabase
          .from("game_players")
          .update({ status: 'ACTIVE' })
          .in("id", finalistIds);
        
        console.log(`[next-session-game] LION finalists: ${finalistNames.join(' vs ')}`);
        
        // Set all other players as SPECTATOR
        const spectatorIds = players
          .filter(p => !finalistIds.includes(p.id))
          .map(p => p.id);
        
        if (spectatorIds.length > 0) {
          await supabase
            .from("game_players")
            .update({ 
              status: 'SPECTATOR', 
              finished_at: new Date().toISOString() 
            })
            .in("id", spectatorIds);
          
          console.log(`[next-session-game] ${spectatorIds.length} players set to SPECTATOR`);
        }
        
        // Log finalists event
        await supabase.from("session_events").insert({
          game_id: gameId,
          session_game_id: newSessionGameId,
          audience: "ALL",
          type: "LION_FINALISTS",
          message: `🦁 Finale du Cœur du Lion ! ${finalistNames.join(' affronte ')} pour le titre suprême !${usedFallback ? ' (sélection individuelle)' : ''}`,
          payload: {
            finalists: finalistIds.map((id, i) => ({ id, name: finalistNames[i] })),
            teamPvic,
            usedFallback,
          },
        });
      }
      
      // Update phases
      await supabase
        .from("session_games")
        .update({ phase: 'LION_TURN' })
        .eq("id", newSessionGameId);
      
      await supabase
        .from("games")
        .update({ phase: 'LION_TURN' })
        .eq("id", gameId);
      
      console.log(`[next-session-game] LION initialization complete`);
    } else {
      console.log(`[next-session-game] Skipping special init for ${gameTypeCode}`);
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
      message: `🎮 Nouvelle étape ! Jeu ${nextStepIndex}: ${gameTypeCode} – Manche 1`,
      payload: {
        event: "NEW_SESSION_GAME",
        stepIndex: nextStepIndex,
        gameTypeCode: gameTypeCode,
        sessionGameId: newSessionGameId,
      },
    });

    // MJ event with debug info
    await supabase.from("session_events").insert({
      game_id: gameId,
      audience: "MJ",
      type: "ADMIN",
      message: `Transition vers étape ${nextStepIndex} (${gameTypeCode}) - Jetons: ${newStartingTokens} (${tokenPolicyUsed})`,
      payload: {
        event: "NEW_SESSION_GAME_ADMIN",
        sessionGameId: newSessionGameId,
        previousSessionGameId: game.current_session_game_id,
        tokenPolicy: tokenPolicyUsed,
        newStartingTokens: newStartingTokens,
        hasAdventureConfig: !!adventureConfig,
      },
    });

    console.log(`[next-session-game] Successfully transitioned to step ${nextStepIndex}`);

    return new Response(
      JSON.stringify({
        success: true,
        adventureComplete: false,
        newSessionGameId,
        stepIndex: nextStepIndex,
        gameTypeCode: gameTypeCode,
        tokenPolicy: tokenPolicyUsed,
        startingTokens: newStartingTokens,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
