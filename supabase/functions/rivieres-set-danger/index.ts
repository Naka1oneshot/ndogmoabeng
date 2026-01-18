import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SetDangerRequest {
  session_game_id: string;
  mode: "ROLL" | "MANUAL";
  dice_count?: number;
  danger_value?: number;
}

function rollDice(count: number): { rolls: number[]; sum: number } {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * 6) + 1);
  }
  return { rolls, sum: rolls.reduce((a, b) => a + b, 0) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_game_id, mode, dice_count, danger_value }: SetDangerRequest = await req.json();

    if (!session_game_id) {
      throw new Error("session_game_id requis");
    }

    // Get current state
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

    let dangerRaw: number;
    let diceUsed: number | null = null;
    let rollDetails: number[] = [];

    if (mode === "ROLL") {
      if (!dice_count || dice_count < 1) {
        throw new Error("Nombre de dés requis pour le mode ROLL");
      }
      diceUsed = dice_count;
      const result = rollDice(dice_count);
      dangerRaw = result.sum;
      rollDetails = result.rolls;
    } else if (mode === "MANUAL") {
      if (danger_value === undefined || danger_value < 0) {
        throw new Error("Valeur de danger requise pour le mode MANUAL");
      }
      dangerRaw = danger_value;
      diceUsed = dice_count || null;
    } else {
      throw new Error("Mode invalide: ROLL ou MANUAL attendu");
    }

    // Update state with danger
    const { error: updateError } = await supabase
      .from("river_session_state")
      .update({
        danger_dice_count: diceUsed,
        danger_raw: dangerRaw,
        danger_effectif: dangerRaw, // Will be adjusted if AV2 is used
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);

    if (updateError) {
      throw new Error(`Erreur mise à jour danger: ${updateError.message}`);
    }

    // Log MJ
    const logMessage = mode === "ROLL"
      ? `DANGER_SET: ${diceUsed} dés lancés [${rollDetails.join(", ")}] = ${dangerRaw}`
      : `DANGER_SET: Valeur manuelle = ${dangerRaw}`;

    await supabase.from("logs_mj").insert({
      game_id: state.game_id,
      session_game_id: session_game_id,
      action: "DANGER_SET",
      manche: state.manche_active,
      details: logMessage,
    });

    return new Response(
      JSON.stringify({
        success: true,
        danger_raw: dangerRaw,
        danger_effectif: dangerRaw,
        dice_count: diceUsed,
        rolls: rollDetails,
        manche: state.manche_active,
        niveau: state.niveau_active,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("Erreur rivieres-set-danger:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
