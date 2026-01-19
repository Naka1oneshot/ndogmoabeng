import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[ADMIN-GRANT-LOYALTY] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Invalid authentication");
    }

    logStep("Authenticated user", { userId: userData.user.id });

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      throw new Error("Admin access required");
    }

    logStep("Admin verified");

    // Parse request
    const { display_name, points_count, note } = await req.json();

    if (!display_name || typeof display_name !== "string") {
      throw new Error("display_name is required");
    }

    if (!points_count || typeof points_count !== "number" || points_count <= 0) {
      throw new Error("points_count must be a positive number");
    }

    logStep("Request parsed", { display_name, points_count, note });

    // Find target user
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("user_id, display_name")
      .eq("display_name", display_name)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error(`Utilisateur "${display_name}" introuvable`);
    }

    logStep("Target user found", { targetUserId: profile.user_id });

    // Grant loyalty points using the database function
    const { data: newBalance, error: pointsError } = await supabaseClient.rpc(
      "add_loyalty_points",
      {
        p_user_id: profile.user_id,
        p_amount: points_count,
        p_transaction_type: "granted",
        p_source: "admin_grant",
        p_note: note || `Octroi admin par ${userData.user.email}`,
        p_granted_by: userData.user.id,
      }
    );

    if (pointsError) {
      logStep("Error granting points", { error: pointsError });
      throw new Error("Erreur lors de l'octroi des points");
    }

    logStep("Points granted successfully", { newBalance });

    return new Response(
      JSON.stringify({
        success: true,
        target_user: profile.display_name,
        added_points: points_count,
        new_balance: newBalance,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep("Error", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
