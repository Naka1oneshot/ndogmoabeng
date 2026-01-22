import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-GRANT-TOKENS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      throw new Error(`Authentication error: ${claimsError?.message || "Invalid token"}`);
    }

    const adminUserId = claimsData.claims.sub as string;
    logStep("Admin user authenticated", { adminUserId });

    // Verify admin role (admin or super_admin)
    const { data: adminRole, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUserId)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    if (roleError || !adminRole) {
      throw new Error("Unauthorized: Admin role required");
    }
    logStep("Admin role verified");

    // Get admin email for audit log
    const { data: adminUserData } = await supabaseClient.auth.admin.getUserById(adminUserId);
    const adminEmail = adminUserData?.user?.email || 'unknown';

    const { display_name, tokens_count } = await req.json();
    
    if (!display_name || typeof tokens_count !== 'number' || tokens_count <= 0) {
      throw new Error("Invalid request: display_name and positive tokens_count required");
    }
    logStep("Request params", { display_name, tokens_count });

    // Find user by display_name
    const { data: targetProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("user_id, display_name")
      .eq("display_name", display_name)
      .maybeSingle();

    if (profileError || !targetProfile) {
      throw new Error(`User not found with display name: ${display_name}`);
    }
    logStep("Target user found", { userId: targetProfile.user_id });

    // Get target user email for audit log
    const { data: targetUserData } = await supabaseClient.auth.admin.getUserById(targetProfile.user_id);
    const targetEmail = targetUserData?.user?.email || 'unknown';

    // Upsert the bonus tokens
    const { data: existingBonus } = await supabaseClient
      .from("user_subscription_bonuses")
      .select("token_balance")
      .eq("user_id", targetProfile.user_id)
      .maybeSingle();

    const currentTokens = existingBonus?.token_balance || 0;
    const newTokens = currentTokens + tokens_count;

    const { error: upsertError } = await supabaseClient
      .from("user_subscription_bonuses")
      .upsert({
        user_id: targetProfile.user_id,
        token_balance: newTokens,
        trial_tier: "freemium",
        trial_start_at: new Date().toISOString(),
        trial_end_at: new Date().toISOString(), // Already expired, so no trial benefit
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      logStep("Error upserting tokens", { error: upsertError });
      throw new Error(`Failed to grant tokens: ${upsertError.message}`);
    }

    logStep("Tokens granted successfully", { 
      targetUser: targetProfile.display_name, 
      previousTokens: currentTokens, 
      addedTokens: tokens_count, 
      newTotal: newTokens 
    });

    // Log the action in audit log
    await supabaseClient.from("admin_audit_log").insert({
      performed_by: adminUserId,
      performed_by_email: adminEmail,
      target_user_id: targetProfile.user_id,
      target_user_email: targetEmail,
      action: 'GRANT_TOKENS',
      details: { 
        display_name: targetProfile.display_name,
        tokens_count,
        previous_balance: currentTokens,
        new_balance: newTokens
      }
    });

    return new Response(JSON.stringify({
      success: true,
      target_user: targetProfile.display_name,
      previous_tokens: currentTokens,
      added_tokens: tokens_count,
      new_total: newTokens,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500,
    });
  }
});
