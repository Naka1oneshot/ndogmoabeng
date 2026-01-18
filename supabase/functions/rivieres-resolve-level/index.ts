import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResolveLevelRequest {
  session_game_id: string;
  av2_player_id?: string; // If multiple Keryndes want AV2, MJ chooses one
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_game_id, av2_player_id }: ResolveLevelRequest = await req.json();

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

    if (state.danger_raw === null) {
      throw new Error("Le danger n'a pas été défini");
    }

    // Get game info
    const { data: game } = await supabase
      .from("games")
      .select("mode, adventure_id")
      .eq("id", state.game_id)
      .single();

    // Get session_game info
    const { data: sessionGame } = await supabase
      .from("session_games")
      .select("step_index")
      .eq("id", session_game_id)
      .single();

    // Get locked decisions
    const { data: decisions, error: decisionsError } = await supabase
      .from("river_decisions")
      .select("*")
      .eq("session_game_id", session_game_id)
      .eq("manche", state.manche_active)
      .eq("niveau", state.niveau_active)
      .eq("status", "LOCKED");

    if (decisionsError || !decisions) {
      throw new Error("Erreur récupération décisions");
    }

    // Check all EN_BATEAU players have locked decisions
    const { data: enBateauStats } = await supabase
      .from("river_player_stats")
      .select("player_id")
      .eq("session_game_id", session_game_id)
      .eq("current_round_status", "EN_BATEAU");

    const enBateauIds = new Set(enBateauStats?.map(s => s.player_id) || []);
    const decisionPlayerIds = new Set(decisions.map(d => d.player_id));

    for (const playerId of enBateauIds) {
      if (!decisionPlayerIds.has(playerId)) {
        throw new Error("Tous les joueurs EN_BATEAU doivent avoir une décision verrouillée");
      }
    }

    // Get player stats and info
    const { data: allPlayerStats } = await supabase
      .from("river_player_stats")
      .select("*")
      .eq("session_game_id", session_game_id);

    const { data: players } = await supabase
      .from("game_players")
      .select("id, display_name, player_number, clan, jetons")
      .eq("game_id", state.game_id)
      .eq("status", "ACTIVE");

    const playerMap = new Map(players?.map(p => [p.id, p]) || []);
    const statsMap = new Map(allPlayerStats?.map(s => [s.player_id, s]) || []);

    // Apply AV2_REDUCE if applicable
    let dangerEffectif = state.danger_raw;
    const av2Candidates = decisions.filter(d => 
      d.keryndes_choice === "AV2_REDUCE" && 
      d.decision === "RESTE" &&
      statsMap.get(d.player_id)?.keryndes_available
    );

    let av2Used = false;
    let av2PlayerId: string | null = null;

    if (av2Candidates.length > 0) {
      // If multiple, use the one MJ specified, or the first one
      const selectedAv2 = av2_player_id 
        ? av2Candidates.find(c => c.player_id === av2_player_id) 
        : av2Candidates[0];

      if (selectedAv2) {
        dangerEffectif = Math.max(0, state.danger_raw - 20);
        av2Used = true;
        av2PlayerId = selectedAv2.player_id;

        // Mark keryndes_available = false
        await supabase
          .from("river_player_stats")
          .update({ keryndes_available: false, updated_at: new Date().toISOString() })
          .eq("session_game_id", session_game_id)
          .eq("player_id", av2PlayerId);

        const av2PlayerName = playerMap.get(av2PlayerId)?.display_name || "Keryndes";

        // Log the AV2 usage
        await supabase.from("logs_joueurs").insert({
          game_id: state.game_id,
          session_game_id: session_game_id,
          manche: state.manche_active,
          type: "KERYNDES",
          message: `🌊 Le courant faiblit... ${av2PlayerName} apaise les eaux ! Danger réduit.`,
        });

        await supabase.from("logs_mj").insert({
          game_id: state.game_id,
          session_game_id: session_game_id,
          action: "AV2_REDUCE",
          manche: state.manche_active,
          details: `${av2PlayerName} utilise AV2: ${state.danger_raw} → ${dangerEffectif}`,
        });
      }
    }

    // Update danger_effectif in state
    await supabase
      .from("river_session_state")
      .update({ danger_effectif: dangerEffectif })
      .eq("id", state.id);

    // Calculate total mises from RESTE decisions
    const resteDecisions = decisions.filter(d => d.decision === "RESTE");
    const totalMises = resteDecisions.reduce((sum, d) => sum + d.mise_demandee, 0);

    // Debit tokens from RESTE players
    for (const d of resteDecisions) {
      const player = playerMap.get(d.player_id);
      if (player) {
        const newTokens = player.jetons - d.mise_demandee;
        await supabase
          .from("game_players")
          .update({ jetons: newTokens })
          .eq("id", d.player_id);

        // Update mise_effective
        await supabase
          .from("river_decisions")
          .update({ mise_effective: d.mise_demandee })
          .eq("id", d.id);

        // Update local map
        player.jetons = newTokens;
      }
    }

    // Determine outcome
    const outcome = totalMises > dangerEffectif ? "SUCCESS" : "FAIL";
    const cagnotteBefore = state.cagnotte_manche;
    let cagnotteAfter = cagnotteBefore;

    const publicSummaryParts: string[] = [];
    const mjSummaryParts: string[] = [];

    if (outcome === "SUCCESS") {
      // Increment validated_levels for RESTE players
      for (const d of resteDecisions) {
        const stats = statsMap.get(d.player_id);
        if (stats) {
          await supabase
            .from("river_player_stats")
            .update({ 
              validated_levels: stats.validated_levels + 1,
              updated_at: new Date().toISOString()
            })
            .eq("id", stats.id);
        }
      }

      // Add mises to cagnotte
      cagnotteAfter = cagnotteBefore + totalMises;

      if (state.niveau_active < 5) {
        // Mark DESCENDS players as A_TERRE
        const descendsDecisions = decisions.filter(d => d.decision === "DESCENDS");
        for (const d of descendsDecisions) {
          await supabase
            .from("river_player_stats")
            .update({ 
              current_round_status: "A_TERRE",
              descended_level: state.niveau_active,
              updated_at: new Date().toISOString()
            })
            .eq("session_game_id", session_game_id)
            .eq("player_id", d.player_id);
        }

        // Update state for next level
        await supabase
          .from("river_session_state")
          .update({
            niveau_active: state.niveau_active + 1,
            cagnotte_manche: cagnotteAfter,
            danger_dice_count: null,
            danger_raw: null,
            danger_effectif: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.id);

        publicSummaryParts.push(`✅ Niveau ${state.niveau_active} réussi ! Mises totales > Danger. Le bateau continue !`);
        mjSummaryParts.push(`SUCCESS N${state.niveau_active}: Total ${totalMises} > Danger ${dangerEffectif}. Cagnotte: ${cagnotteAfter}`);

      } else {
        // Level 5 success - end of round
        const survivors = allPlayerStats?.filter(s => s.current_round_status === "EN_BATEAU") || [];
        const survivorCount = survivors.length;
        const bonusSurvivor = 50;

        cagnotteAfter += bonusSurvivor * survivorCount;
        const share = survivorCount > 0 ? Math.floor(cagnotteAfter / survivorCount) : 0;

        // Distribute to survivors
        for (const s of survivors) {
          const player = playerMap.get(s.player_id);
          if (player) {
            const newTokens = player.jetons + share;
            await supabase
              .from("game_players")
              .update({ jetons: newTokens })
              .eq("id", s.player_id);
          }
        }

        publicSummaryParts.push(`🎉 Niveau 5 réussi ! ${survivorCount} survivant(s) se partagent ${cagnotteAfter}💎 (${share}💎 chacun)`);
        mjSummaryParts.push(`SUCCESS N5: ${survivorCount} survivants x ${bonusSurvivor} bonus = ${bonusSurvivor * survivorCount}. Cagnotte totale: ${cagnotteAfter}, part: ${share}`);

        // Prepare for next round or end game
        await handleEndOfRound(supabase, state, cagnotteAfter, game, sessionGame, publicSummaryParts, mjSummaryParts);
        cagnotteAfter = 0;
      }

    } else {
      // FAIL - boat capsizes
      const cagnotteFail = cagnotteBefore + totalMises;

      // Identify beneficiaries
      const beneficiaries: { player_id: string; descended_level: number }[] = [];

      // A_TERRE players (descended before this level)
      const aTerreStats = allPlayerStats?.filter(s => s.current_round_status === "A_TERRE") || [];
      for (const s of aTerreStats) {
        beneficiaries.push({ player_id: s.player_id, descended_level: s.descended_level || 0 });
      }

      // DESCENDS at this level
      const descendsDecisions = decisions.filter(d => d.decision === "DESCENDS");
      for (const d of descendsDecisions) {
        await supabase
          .from("river_player_stats")
          .update({ 
            current_round_status: "A_TERRE",
            descended_level: state.niveau_active,
            updated_at: new Date().toISOString()
          })
          .eq("session_game_id", session_game_id)
          .eq("player_id", d.player_id);
        
        beneficiaries.push({ player_id: d.player_id, descended_level: state.niveau_active });
      }

      // Check AV1_CANOT
      const av1Candidates = resteDecisions.filter(d => 
        d.keryndes_choice === "AV1_CANOT" &&
        statsMap.get(d.player_id)?.keryndes_available
      );

      for (const d of av1Candidates) {
        // Mark as A_TERRE (saved by canot)
        await supabase
          .from("river_player_stats")
          .update({ 
            current_round_status: "A_TERRE",
            descended_level: state.niveau_active,
            keryndes_available: false,
            updated_at: new Date().toISOString()
          })
          .eq("session_game_id", session_game_id)
          .eq("player_id", d.player_id);

        beneficiaries.push({ player_id: d.player_id, descended_level: state.niveau_active });

        const playerName = playerMap.get(d.player_id)?.display_name || "Keryndes";
        publicSummaryParts.push(`🛶 ${playerName} déploie son canot et rejoint la rive !`);
        mjSummaryParts.push(`AV1_CANOT: ${playerName} sauvé par le canot`);
      }

      // Mark remaining EN_BATEAU (who didn't use canot) as CHAVIRE
      const av1PlayerIds = new Set(av1Candidates.map(d => d.player_id));
      const chavirePlayers = resteDecisions.filter(d => !av1PlayerIds.has(d.player_id));

      for (const d of chavirePlayers) {
        await supabase
          .from("river_player_stats")
          .update({ 
            current_round_status: "CHAVIRE",
            updated_at: new Date().toISOString()
          })
          .eq("session_game_id", session_game_id)
          .eq("player_id", d.player_id);
      }

      // Distribute cagnotte to beneficiaries
      if (beneficiaries.length > 0) {
        const share = Math.floor(cagnotteFail / beneficiaries.length);

        for (const b of beneficiaries) {
          const player = playerMap.get(b.player_id);
          if (player) {
            const bonus = b.descended_level * 10;
            const totalGain = share + bonus;
            const newTokens = player.jetons + totalGain;

            await supabase
              .from("game_players")
              .update({ jetons: newTokens })
              .eq("id", b.player_id);
          }
        }

        publicSummaryParts.push(`⛵ Le bateau chavire ! ${beneficiaries.length} joueur(s) à terre se partagent ${cagnotteFail}💎 + bonus de descente`);
        mjSummaryParts.push(`FAIL: Cagnotte ${cagnotteFail} / ${beneficiaries.length} = ${Math.floor(cagnotteFail / beneficiaries.length)}. Chavirés: ${chavirePlayers.length}`);
      } else {
        publicSummaryParts.push(`💀 Le bateau chavire ! Aucun survivant à terre... La cagnotte est perdue !`);
        mjSummaryParts.push(`FAIL: Aucun bénéficiaire, cagnotte ${cagnotteFail} perdue`);
      }

      // End of round
      await handleEndOfRound(supabase, state, 0, game, sessionGame, publicSummaryParts, mjSummaryParts);
      cagnotteAfter = 0;
    }

    // Save level history
    await supabase.from("river_level_history").insert({
      game_id: state.game_id,
      session_game_id: session_game_id,
      manche: state.manche_active,
      niveau: state.niveau_active,
      dice_count: state.danger_dice_count,
      danger_raw: state.danger_raw,
      danger_effectif: dangerEffectif,
      total_mises: totalMises,
      outcome: outcome,
      cagnotte_before: cagnotteBefore,
      cagnotte_after: cagnotteAfter,
      public_summary: publicSummaryParts.join(" | "),
      mj_summary: mjSummaryParts.join(" | "),
    });

    // Log joueurs
    await supabase.from("logs_joueurs").insert({
      game_id: state.game_id,
      session_game_id: session_game_id,
      manche: state.manche_active,
      type: outcome === "SUCCESS" ? "SUCCES" : "ECHEC",
      message: publicSummaryParts.join(" "),
    });

    // Log MJ
    await supabase.from("logs_mj").insert({
      game_id: state.game_id,
      session_game_id: session_game_id,
      action: `RESOLVE_${outcome}`,
      manche: state.manche_active,
      details: mjSummaryParts.join(" | "),
    });

    return new Response(
      JSON.stringify({
        success: true,
        outcome: outcome,
        total_mises: totalMises,
        danger_effectif: dangerEffectif,
        cagnotte_after: cagnotteAfter,
        av2_used: av2Used,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("Erreur rivieres-resolve-level:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleEndOfRound(
  supabase: any,
  state: any,
  cagnotteAfter: number,
  game: any,
  sessionGame: any,
  publicSummaryParts: string[],
  mjSummaryParts: string[]
) {
  if (state.manche_active < 3) {
    // Next round
    const nextManche = state.manche_active + 1;

    // Reset all players to EN_BATEAU
    await supabase
      .from("river_player_stats")
      .update({ 
        current_round_status: "EN_BATEAU",
        descended_level: null,
        updated_at: new Date().toISOString()
      })
      .eq("session_game_id", state.session_game_id);

    // Update state
    await supabase
      .from("river_session_state")
      .update({
        manche_active: nextManche,
        niveau_active: 1,
        cagnotte_manche: 0,
        danger_dice_count: null,
        danger_raw: null,
        danger_effectif: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);

    publicSummaryParts.push(`🚣 Manche ${nextManche} commence ! Tous les joueurs remontent sur le bateau.`);
    mjSummaryParts.push(`Passage Manche ${nextManche}`);

  } else {
    // End of game - compute scores
    await computeFinalScores(supabase, state, game, sessionGame, publicSummaryParts, mjSummaryParts);
  }
}

interface PlayerInfo {
  id: string;
  display_name: string;
  player_number: number;
  jetons: number;
}

async function computeFinalScores(
  supabase: any,
  state: any,
  game: any,
  sessionGame: any,
  publicSummaryParts: string[],
  mjSummaryParts: string[]
) {
  // Get all player stats and tokens
  const { data: allStats } = await supabase
    .from("river_player_stats")
    .select("*")
    .eq("session_game_id", state.session_game_id);

  const { data: players } = await supabase
    .from("game_players")
    .select("id, display_name, player_number, jetons")
    .eq("game_id", state.game_id)
    .eq("status", "ACTIVE");

  const playerMap = new Map<string, PlayerInfo>(players?.map((p: PlayerInfo) => [p.id, p]) || []);

  const scores: { player_id: string; score: number; validated_levels: number; jetons: number; penalty: boolean }[] = [];

  for (const stats of allStats || []) {
    const player = playerMap.get(stats.player_id);
    if (!player) continue;

    const validatedLevels = stats.validated_levels;
    const jetons = player.jetons;
    let score: number;
    let penalty = false;

    if (validatedLevels < 9) {
      score = Math.round((validatedLevels * jetons) / 9);
      penalty = true;
    } else {
      score = Math.round(jetons);
    }

    scores.push({
      player_id: stats.player_id,
      score,
      validated_levels: validatedLevels,
      jetons,
      penalty,
    });

    // Save to stage_scores
    await supabase.from("stage_scores").insert({
      session_game_id: state.session_game_id,
      game_player_id: stats.player_id,
      score_value: score,
      details: {
        validated_levels: validatedLevels,
        jetons_end: jetons,
        penalty_applied: penalty,
        formula: penalty ? `round((${validatedLevels} * ${jetons}) / 9)` : `round(${jetons})`,
      },
    });
  }

  // Sort by score desc
  scores.sort((a, b) => b.score - a.score);

  // Build ranking message
  const rankingPublic = scores.map((s, i) => {
    const player = playerMap.get(s.player_id);
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    return `${medal} ${player?.display_name}: ${s.score}pts`;
  }).join(" | ");

  const rankingMJ = scores.map((s, i) => {
    const player = playerMap.get(s.player_id);
    return `${i + 1}. ${player?.display_name}: ${s.score}pts (${s.validated_levels}/15 niveaux, ${s.jetons} jetons, pénalité: ${s.penalty})`;
  }).join("\n");

  publicSummaryParts.push(`🏆 FIN DE PARTIE ! Classement: ${rankingPublic}`);
  mjSummaryParts.push(`FIN: ${rankingMJ}`);

  // Update state to ENDED
  await supabase
    .from("river_session_state")
    .update({ status: "ENDED", updated_at: new Date().toISOString() })
    .eq("id", state.id);

  // Update session_game
  await supabase
    .from("session_games")
    .update({ status: "ENDED", ended_at: new Date().toISOString() })
    .eq("id", state.session_game_id);

  // Handle ADVENTURE mode
  if (game?.mode === "ADVENTURE") {
    // Update adventure_scores
    for (const s of scores) {
      const { data: existingAdventureScore } = await supabase
        .from("adventure_scores")
        .select("id, total_score_value, breakdown")
        .eq("session_id", state.game_id)
        .eq("game_player_id", s.player_id)
        .single();

      if (existingAdventureScore) {
        const breakdown = existingAdventureScore.breakdown || {};
        breakdown[state.session_game_id] = s.score;

        const newTotal = Object.values(breakdown).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);

        await supabase
          .from("adventure_scores")
          .update({
            total_score_value: newTotal,
            breakdown,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAdventureScore.id);
      } else {
        await supabase.from("adventure_scores").insert({
          session_id: state.game_id,
          game_player_id: s.player_id,
          total_score_value: s.score,
          breakdown: { [state.session_game_id]: s.score },
        });
      }
    }
  }
}
