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

    // Fetch the game and verify host
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, name, status, host_user_id, manche_active, current_session_game_id, mode, selected_game_type_code, adventure_id, starting_tokens")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      console.error("Game fetch error:", gameError);
      return new Response(
        JSON.stringify({ error: "Partie introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FIX 2 (edge security): start-game is FORET-only
    // Other game types have their own init functions (rivieres-init, start-infection, start-sheriff)
    const gameTypeCode = game.selected_game_type_code || 'FORET';
    if (gameTypeCode !== 'FORET') {
      console.error(`start-game called for non-FORET game type: ${gameTypeCode}`);
      return new Response(
        JSON.stringify({ error: `start-game is FORET only. Use the appropriate init function for ${gameTypeCode}.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (game.host_user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Seul le MJ peut démarrer la partie" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (game.status !== "LOBBY") {
      return new Response(
        JSON.stringify({ error: "La partie n'est pas en état LOBBY" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ====== ADVENTURE MODE: Load adventure configuration ======
    let adventureConfig: any = null;
    let startingTokens = game.starting_tokens || 50;
    let foretMonsterOverrides: any[] = [];
    
    if (game.adventure_id) {
      console.log(`[start-game] Adventure mode detected, loading config for adventure: ${game.adventure_id}`);
      
      const { data: agc, error: agcError } = await supabase
        .from("adventure_game_configs")
        .select("config")
        .eq("game_id", gameId)
        .single();
      
      if (agcError) {
        console.error("[start-game] Error loading adventure config:", agcError);
      } else if (agc?.config) {
        adventureConfig = agc.config;
        console.log("[start-game] Adventure config loaded:", JSON.stringify(adventureConfig).slice(0, 500));
        
        // Apply token policy for FORET
        const tokenPolicies = adventureConfig.token_policies || {};
        const foretPolicy = tokenPolicies.FORET || tokenPolicies.foret;
        
        if (foretPolicy) {
          if (foretPolicy.mode === 'FIXED' && foretPolicy.fixedValue) {
            startingTokens = foretPolicy.fixedValue;
            console.log(`[start-game] Using FIXED token policy: ${startingTokens} jetons`);
          } else if (foretPolicy.mode === 'INHERIT') {
            // Keep current tokens - they should already be set from previous game
            console.log(`[start-game] Using INHERIT token policy`);
          }
        }
        
        // Load monster overrides
        const foretMonsters = adventureConfig.foret_monsters || adventureConfig.foretMonsters;
        if (foretMonsters?.selected && Array.isArray(foretMonsters.selected)) {
          foretMonsterOverrides = foretMonsters.selected;
          console.log(`[start-game] Loaded ${foretMonsterOverrides.length} monster overrides from adventure config`);
        }
      }
    }

    // Get the session_game_id (current stage)
    let sessionGameId = game.current_session_game_id;
    
    // If no session_game exists, create one (should be rare with Phase 1+2 migrations)
    if (!sessionGameId) {
      const { data: newSessionGame, error: createError } = await supabase
        .from("session_games")
        .insert({
          session_id: gameId,
          step_index: 1,
          game_type_code: gameTypeCode,
          status: 'PENDING',
          manche_active: 1,
          phase: 'PHASE1_MISES',
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
      
      sessionGameId = newSessionGame.id;
      
      // Update games with the new session_game_id
      await supabase
        .from("games")
        .update({ current_session_game_id: sessionGameId })
        .eq("id", gameId);
    }

    console.log(`[start-game] Using session_game_id: ${sessionGameId}`);

    // Fetch all active players (non-host) ordered by joined_at
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id, display_name, status, joined_at, clan, user_id, clan_token_used, jetons")
      .eq("game_id", gameId)
      .eq("is_host", false)
      .in("status", ["ACTIVE", "WAITING"])
      .order("joined_at", { ascending: true });

    if (playersError) {
      console.error("Players fetch error:", playersError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la récupération des joueurs" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const activePlayers = players || [];
    console.log(`Starting game with ${activePlayers.length} players, startingTokens=${startingTokens}`);

    // Consume tokens for players who marked clan_token_used
    for (const player of activePlayers) {
      if (player.clan_token_used && player.user_id && player.clan) {
        // Consume the token
        const { error: tokenError } = await supabase
          .from("user_subscription_bonuses")
          .update({ 
            token_balance: supabase.rpc('decrement_token_balance'),
          })
          .eq("user_id", player.user_id)
          .gte("token_balance", 1);

        // Use raw SQL for atomic decrement
        const { error: decrementError } = await supabase.rpc('raw_query', {
          query: `UPDATE user_subscription_bonuses 
                  SET token_balance = token_balance - 1, 
                      tokens_used_for_clan = COALESCE(tokens_used_for_clan, 0) + 1 
                  WHERE user_id = '${player.user_id}' AND token_balance >= 1`
        });

        // Fallback: direct SQL update
        if (decrementError) {
          await supabase
            .from("user_subscription_bonuses")
            .update({ 
              tokens_used_for_clan: 1, // Will be incremented
            })
            .eq("user_id", player.user_id);
          
          // Manual decrement via direct query
          const { data: bonus } = await supabase
            .from("user_subscription_bonuses")
            .select("token_balance, tokens_used_for_clan")
            .eq("user_id", player.user_id)
            .single();
          
          if (bonus && bonus.token_balance >= 1) {
            await supabase
              .from("user_subscription_bonuses")
              .update({ 
                token_balance: bonus.token_balance - 1,
                tokens_used_for_clan: (bonus.tokens_used_for_clan || 0) + 1,
              })
              .eq("user_id", player.user_id);
            console.log(`Token consumed for player ${player.display_name} (clan: ${player.clan})`);
          } else {
            // Token was not available - remove clan
            await supabase
              .from("game_players")
              .update({ clan: null, clan_token_used: false })
              .eq("id", player.id);
            console.log(`Token not available for player ${player.display_name}, clan removed`);
          }
        }
      }
    }

    // Assign player numbers 1..N based on joined_at order
    // Apply starting tokens (with Royaux bonus if applicable)
    const playerUpdates = activePlayers.map((player, index) => {
      // Royaux bonus: 1.5x starting tokens
      const isRoyaux = player.clan === 'maison-royale' || player.clan === 'Royaux';
      const playerTokens = isRoyaux ? Math.floor(startingTokens * 1.5) : startingTokens;
      
      return {
        id: player.id,
        player_number: index + 1,
        status: "ACTIVE",
        clan: player.clan,
        jetons: playerTokens,
      };
    });

    // Update players with new numbers, ACTIVE status, and tokens
    for (const update of playerUpdates) {
      const { error: updateError } = await supabase
        .from("game_players")
        .update({
          player_number: update.player_number,
          status: update.status,
          jetons: update.jetons,
        })
        .eq("id", update.id);

      if (updateError) {
        console.error("Player update error:", updateError);
      } else {
        console.log(`Player #${update.player_number} set with ${update.jetons} jetons`);
      }
    }

    // Initialize player inventories with starting items
    console.log("Initializing player inventories...");
    
    for (const player of playerUpdates) {
      // All players get the default weapon (permanent, non-consumable)
      const { error: defaultItemError } = await supabase
        .from("inventory")
        .insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          owner_num: player.player_number,
          objet: "Par défaut (+2 si compagnon Akandé)",
          quantite: 1,
          disponible: true,
          dispo_attaque: true,
        });

      if (defaultItemError) {
        // Check if it's a duplicate key error (already exists)
        if (defaultItemError.code === '23505') {
          console.log(`Default item already exists for player #${player.player_number}`);
        } else {
          console.error("Default item insert error:", defaultItemError);
        }
      } else {
        console.log(`Added default weapon to player #${player.player_number}`);
      }

      // Akila clan players get the Sniper Akila (single use, consumable)
      if (player.clan === "Akila" || player.clan === "sources-akila") {
        const { error: sniperError } = await supabase
          .from("inventory")
          .insert({
            game_id: gameId,
            session_game_id: sessionGameId,
            owner_num: player.player_number,
            objet: "Sniper Akila",
            quantite: 1,
            disponible: true,
            dispo_attaque: true,
          });

        if (sniperError) {
          if (sniperError.code === '23505') {
            console.log(`Sniper Akila already exists for player #${player.player_number}`);
          } else {
            console.error("Sniper Akila insert error:", sniperError);
          }
        } else {
          console.log(`Added Sniper Akila to player #${player.player_number} (Akila clan)`);
        }
      }
    }
    
    console.log("Player inventories initialized");

    // ====== MONSTER INITIALIZATION ======
    console.log("Initializing game monsters...");
    
    // Check if game_monsters already exist for this session
    const { data: existingGameMonsters } = await supabase
      .from("game_monsters")
      .select("id")
      .eq("game_id", gameId)
      .eq("session_game_id", sessionGameId)
      .limit(1);
    
    if (!existingGameMonsters || existingGameMonsters.length === 0) {
      // Check if adventure has monster overrides
      if (foretMonsterOverrides.length > 0) {
        console.log(`[start-game] Applying ${foretMonsterOverrides.length} monster overrides from adventure config`);
        
        // Insert monster configurations from adventure config
        for (const monster of foretMonsterOverrides) {
          if (monster.enabled !== false) {
            const { error: insertError } = await supabase
              .from("game_monsters")
              .insert({
                game_id: gameId,
                session_game_id: sessionGameId,
                monster_id: monster.monster_id,
                pv_max_override: monster.pv_max_override || null,
                reward_override: monster.reward_override || null,
                initial_status: monster.monster_id <= 3 ? 'EN_BATAILLE' : 'EN_FILE',
                order_index: monster.monster_id,
                is_enabled: true,
              });
            
            if (insertError) {
              console.error(`Error inserting monster ${monster.monster_id}:`, insertError);
            } else {
              console.log(`Monster #${monster.monster_id} configured: PV=${monster.pv_max_override}, Reward=${monster.reward_override}`);
            }
          }
        }
      } else {
        // No adventure overrides - initialize game_monsters from catalog defaults
        const { error: initMonsterConfigError } = await supabase.rpc(
          "initialize_game_monsters",
          { p_game_id: gameId }
        );
        if (initMonsterConfigError) {
          console.error("Monster config init error:", initMonsterConfigError);
        } else {
          console.log("Game monsters config initialized from catalog");
        }
        
        // Update with session_game_id
        await supabase
          .from("game_monsters")
          .update({ session_game_id: sessionGameId })
          .eq("game_id", gameId)
          .is("session_game_id", null);
      }
    } else {
      console.log("Game monsters already exist for this session");
    }
    
    // Initialize runtime state (game_state_monsters) with session_game_id
    const { error: initMonsterStateError } = await supabase.rpc(
      "initialize_game_state_monsters",
      { p_game_id: gameId, p_session_game_id: sessionGameId }
    );
    if (initMonsterStateError) {
      console.error("Monster state init error:", initMonsterStateError);
    } else {
      console.log("Game monsters runtime state initialized with session_game_id");
    }

    // Update game status to IN_GAME with phase and starting_tokens
    const { error: gameUpdateError } = await supabase
      .from("games")
      .update({
        status: "IN_GAME",
        manche_active: 1,
        phase: "PHASE1_MISES",
        phase_locked: false,
        starting_tokens: startingTokens,
      })
      .eq("id", gameId);

    if (gameUpdateError) {
      console.error("Game update error:", gameUpdateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors du démarrage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session_games status
    await supabase
      .from("session_games")
      .update({
        status: "RUNNING",
        manche_active: 1,
        phase: "PHASE1_MISES",
        started_at: new Date().toISOString(),
      })
      .eq("id", sessionGameId);

    // Create public event for all players
    await supabase.from("session_events").insert({
      game_id: gameId,
      audience: "ALL",
      type: "SYSTEM",
      message: `🎮 La partie commence ! Manche 1 – Phase 1 (Mises)`,
      payload: {
        event: "GAME_START",
        round: 1,
        phase: "PHASE1_MISES",
        playerCount: activePlayers.length,
        sessionGameId: sessionGameId,
        startingTokens: startingTokens,
      },
    });

    // Create MJ-only detailed event
    const playerList = playerUpdates.map(p => {
      const original = activePlayers.find(a => a.id === p.id);
      return `#${p.player_number}: ${original?.display_name} (${p.jetons}j)`;
    }).join(", ");

    await supabase.from("session_events").insert({
      game_id: gameId,
      audience: "MJ",
      type: "ADMIN",
      message: `StartGame: ${activePlayers.length} joueurs, ${startingTokens} jetons de base`,
      payload: {
        event: "GAME_START_ADMIN",
        sessionGameId: sessionGameId,
        startingTokens: startingTokens,
        adventureConfig: adventureConfig ? { 
          tokenPolicy: adventureConfig.token_policies?.FORET,
          monsterOverrides: foretMonsterOverrides.length 
        } : null,
        players: playerUpdates.map(p => ({
          id: p.id,
          playerNumber: p.player_number,
          displayName: activePlayers.find(a => a.id === p.id)?.display_name,
          jetons: p.jetons,
          clan: p.clan,
        })),
      },
    });

    console.log("Game started successfully:", gameId, "session_game_id:", sessionGameId, "startingTokens:", startingTokens);

    // Auto-generate the first shop for round 1 (only for FORET game type - already verified above)
    let shopGenerated = false;
    
    console.log("[start-game] Auto-generating first shop for FORET game...");
    try {
      const fnUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const generateShopResponse = await fetch(`${fnUrl}/functions/v1/generate-shop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ gameId, sessionGameId }),
      });
      
      if (generateShopResponse.ok) {
        const shopResult = await generateShopResponse.json();
        shopGenerated = true;
        console.log("[start-game] Shop generated successfully:", shopResult.items?.join(", ") || "OK");
      } else {
        const errorText = await generateShopResponse.text();
        console.error("[start-game] Shop generation failed:", generateShopResponse.status, errorText);
      }
    } catch (shopError) {
      console.error("[start-game] Error calling generate-shop:", shopError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        gameId,
        sessionGameId,
        status: "IN_GAME",
        round: 1,
        phase: "PHASE1_MISES",
        playerCount: activePlayers.length,
        startingTokens,
        players: playerUpdates,
        shopGenerated,
        gameTypeCode,
        adventureConfigApplied: !!adventureConfig,
        monsterOverridesApplied: foretMonsterOverrides.length,
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
