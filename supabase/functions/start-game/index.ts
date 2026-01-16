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
      .select("id, name, status, host_user_id, manche_active")
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

    // Fetch all active players (non-host) ordered by joined_at
    const { data: players, error: playersError } = await supabase
      .from("game_players")
      .select("id, display_name, status, joined_at")
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
    console.log(`Starting game with ${activePlayers.length} players`);

    // Assign player numbers 1..N based on joined_at order
    const playerUpdates = activePlayers.map((player, index) => ({
      id: player.id,
      player_number: index + 1,
      status: "ACTIVE",
    }));

    // Update players with new numbers and ACTIVE status
    for (const update of playerUpdates) {
      const { error: updateError } = await supabase
        .from("game_players")
        .update({
          player_number: update.player_number,
          status: update.status,
        })
        .eq("id", update.id);

      if (updateError) {
        console.error("Player update error:", updateError);
      }
    }

    // Update game status to IN_PROGRESS with phase
    const { error: gameUpdateError } = await supabase
      .from("games")
      .update({
        status: "IN_PROGRESS",
        manche_active: 1,
        phase: "PHASE1_MISES",
        phase_locked: false,
      })
      .eq("id", gameId);

    if (gameUpdateError) {
      console.error("Game update error:", gameUpdateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors du démarrage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      },
    });

    // Create MJ-only detailed event
    const playerList = playerUpdates.map(p => {
      const original = activePlayers.find(a => a.id === p.id);
      return `#${p.player_number}: ${original?.display_name}`;
    }).join(", ");

    await supabase.from("session_events").insert({
      game_id: gameId,
      audience: "MJ",
      type: "ADMIN",
      message: `StartGame: ${activePlayers.length} joueurs activés`,
      payload: {
        event: "GAME_START_ADMIN",
        players: playerUpdates.map(p => ({
          id: p.id,
          playerNumber: p.player_number,
          displayName: activePlayers.find(a => a.id === p.id)?.display_name,
        })),
      },
    });

    console.log("Game started successfully:", gameId);

    return new Response(
      JSON.stringify({
        success: true,
        gameId,
        status: "IN_PROGRESS",
        round: 1,
        phase: "PHASE1_MISES",
        playerCount: activePlayers.length,
        players: playerUpdates,
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