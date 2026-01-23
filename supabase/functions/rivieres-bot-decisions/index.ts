import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Bot decision logic for Rivières game
 * Target: 80% success rate for reaching at least level 9 (15 levels total = 3 manches x 5 niveaux)
 * 
 * Strategy:
 * - Early levels (1-3): High probability to stay (85-95%)
 * - Mid levels (4-5) Manche 1-2: Moderate stay (70-85%)
 * - Later manches: More conservative as validated levels increase
 * - Factor in current tokens and danger level
 */

interface BotDecisionRequest {
  session_game_id: string;
}

interface BotPlayer {
  id: string;
  player_number: number;
  display_name: string;
  clan: string | null;
  jetons: number;
  player_token: string;
}

interface RiverState {
  manche_active: number;
  niveau_active: number;
  cagnotte_manche: number;
  danger_effectif: number | null;
  game_id: string;
}

interface PlayerStats {
  player_id: string;
  validated_levels: number;
  keryndes_available: boolean;
  current_round_status: string;
}

function calculateBotDecision(
  state: RiverState,
  stats: PlayerStats,
  player: BotPlayer
): { decision: 'RESTE' | 'DESCENDS'; mise: number; keryndes_choice: string } {
  const { manche_active, niveau_active, danger_effectif } = state;
  const { validated_levels, keryndes_available } = stats;
  const jetons = player.jetons;
  
  // Calculate current total levels completed in the game
  const totalLevels = (manche_active - 1) * 5 + niveau_active - 1 + validated_levels;
  
  // Base stay probability - targeting 80% success for level 9
  // Level 9 = end of manche 2 niveau 4 or start of manche 3
  let stayProbability = 0.85;
  
  // Adjust based on current position in the game
  if (manche_active === 1) {
    // Manche 1: Be aggressive to accumulate levels
    stayProbability = niveau_active <= 3 ? 0.92 : 0.85;
  } else if (manche_active === 2) {
    // Manche 2: Still stay mostly, but be more careful
    if (niveau_active <= 2) {
      stayProbability = 0.88;
    } else if (niveau_active <= 4) {
      stayProbability = 0.80;
    } else {
      // Niveau 5 manche 2 - this is critical for reaching level 9
      stayProbability = validated_levels >= 9 ? 0.50 : 0.75;
    }
  } else {
    // Manche 3: Be more conservative, especially if already at 9+ levels
    if (validated_levels >= 9) {
      // Already hit target - be much more conservative
      stayProbability = niveau_active <= 2 ? 0.60 : 0.40;
    } else {
      // Still need levels - try to get to 9
      stayProbability = niveau_active <= 3 ? 0.75 : 0.55;
    }
  }
  
  // Adjust for danger level if known
  if (danger_effectif !== null) {
    const baseDanger = 7 * 1; // approximate base for 1 player
    if (danger_effectif > baseDanger * 1.5) {
      stayProbability -= 0.15; // High danger - less likely to stay
    } else if (danger_effectif < baseDanger * 0.7) {
      stayProbability += 0.10; // Low danger - more likely to stay
    }
  }
  
  // Adjust for token count
  if (jetons < 20) {
    stayProbability += 0.05; // Low tokens - need to stay and bet
  } else if (jetons > 150) {
    stayProbability -= 0.05; // High tokens - can afford to be careful
  }
  
  // Clamp probability
  stayProbability = Math.max(0.20, Math.min(0.95, stayProbability));
  
  // Make decision
  const random = Math.random();
  const decision = random < stayProbability ? 'RESTE' : 'DESCENDS';
  
  // Calculate bet if staying
  let mise = 0;
  if (decision === 'RESTE') {
    // Bet between 10-40% of tokens, weighted towards lower end
    const betPercentage = 0.10 + Math.random() * 0.30;
    mise = Math.floor(jetons * betPercentage);
    mise = Math.max(0, Math.min(mise, jetons)); // Clamp to available tokens
  }
  
  // Keryndes choice - use power strategically
  let keryndes_choice = 'NONE';
  if (player.clan === 'Keryndes' && keryndes_available) {
    // Use canot (AV1) at niveau 5 or high danger situations
    if (decision === 'RESTE') {
      if (niveau_active === 5 || (danger_effectif !== null && danger_effectif > 50)) {
        // 60% chance to use canot at critical moments
        if (Math.random() < 0.60) {
          keryndes_choice = 'AV1_CANOT';
        }
      }
    } else {
      // If descending, consider using AV2 to reduce for others
      if (manche_active >= 2 && Math.random() < 0.40) {
        keryndes_choice = 'AV2_REDUCE';
      }
    }
  }
  
  return { decision, mise, keryndes_choice };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { session_game_id }: BotDecisionRequest = await req.json();

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
      throw new Error("La partie n'est pas en cours");
    }

    const gameId = state.game_id;

    // Check if user is host or admin
    const { data: game } = await supabase
      .from("games")
      .select("host_user_id")
      .eq("id", gameId)
      .single();

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    const isAdmin = !!roleData;
    const isHost = game?.host_user_id === user.id;

    if (!isHost && !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Non autorisé - admin ou hôte requis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all bot players that are EN_BATEAU
    const { data: botPlayers, error: playersError } = await supabase
      .from("game_players")
      .select("id, player_number, display_name, clan, jetons, player_token")
      .eq("game_id", gameId)
      .eq("is_bot", true)
      .eq("status", "ACTIVE");

    if (playersError) {
      throw new Error("Erreur récupération des bots");
    }

    if (!botPlayers || botPlayers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Aucun bot dans la partie", decisions_made: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get player stats for bots
    const botIds = botPlayers.map(b => b.id);
    const { data: botStats } = await supabase
      .from("river_player_stats")
      .select("*")
      .eq("session_game_id", session_game_id)
      .in("player_id", botIds);

    // Filter to only bots that are EN_BATEAU
    const activeBotStats = botStats?.filter(s => s.current_round_status === "EN_BATEAU") || [];
    const activeBotIds = new Set(activeBotStats.map(s => s.player_id));

    // Check existing decisions for this level
    const { data: existingDecisions } = await supabase
      .from("river_decisions")
      .select("player_id, status")
      .eq("session_game_id", session_game_id)
      .eq("manche", state.manche_active)
      .eq("niveau", state.niveau_active);

    const existingDecisionMap = new Map(existingDecisions?.map(d => [d.player_id, d]) || []);

    let decisionsMade = 0;
    const results: Array<{ player: string; decision: string; mise: number }> = [];

    for (const bot of botPlayers) {
      // Skip if not EN_BATEAU
      if (!activeBotIds.has(bot.id)) continue;

      // Skip if already has locked decision
      const existing = existingDecisionMap.get(bot.id);
      if (existing?.status === "LOCKED") continue;

      const stats = activeBotStats.find(s => s.player_id === bot.id);
      if (!stats) continue;

      // Calculate bot decision
      const { decision, mise, keryndes_choice } = calculateBotDecision(
        state as RiverState,
        stats as PlayerStats,
        bot as BotPlayer
      );

      // Upsert decision
      const decisionData = {
        game_id: gameId,
        session_game_id: session_game_id,
        manche: state.manche_active,
        niveau: state.niveau_active,
        player_id: bot.id,
        player_num: bot.player_number,
        decision: decision,
        mise_demandee: mise,
        keryndes_choice: keryndes_choice,
        submitted_at: new Date().toISOString(),
        status: "DRAFT",
      };

      if (existing) {
        await supabase
          .from("river_decisions")
          .update(decisionData)
          .eq("session_game_id", session_game_id)
          .eq("manche", state.manche_active)
          .eq("niveau", state.niveau_active)
          .eq("player_id", bot.id);
      } else {
        await supabase
          .from("river_decisions")
          .insert(decisionData);
      }

      decisionsMade++;
      results.push({
        player: bot.display_name,
        decision,
        mise,
      });
    }

    // Log action
    await supabase.from("logs_mj").insert({
      game_id: gameId,
      session_game_id: session_game_id,
      action: "BOT_DECISIONS",
      manche: state.manche_active,
      details: `${decisionsMade} décisions de bots générées pour niveau ${state.niveau_active}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `${decisionsMade} décisions de bots générées`,
        decisions_made: decisionsMade,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("Erreur rivieres-bot-decisions:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
