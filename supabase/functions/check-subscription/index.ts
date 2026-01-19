import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product ID to tier mapping
const PRODUCT_TO_TIER: Record<string, string> = {
  "prod_Tp3VRqayJwZs5D": "starter",
  "prod_Tp3VDl938PAQx0": "premium",
  "prod_Tp3W1ER13T1Qss": "royal",
};

// Tier limits configuration
const TIER_LIMITS: Record<string, {
  games_joinable: number;
  games_creatable: number;
  clan_benefits: boolean;
  max_friends: number;
}> = {
  freemium: {
    games_joinable: 10,
    games_creatable: 2,
    clan_benefits: false,
    max_friends: 2,
  },
  starter: {
    games_joinable: 30,
    games_creatable: 10,
    clan_benefits: true,
    max_friends: 10,
  },
  premium: {
    games_joinable: 100,
    games_creatable: 50,
    clan_benefits: true,
    max_friends: 20,
  },
  royal: {
    games_joinable: -1, // unlimited
    games_creatable: 200,
    clan_benefits: true,
    max_friends: -1, // unlimited
  },
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check for active Stripe subscription first
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    let stripeSubscription = null;
    let stripeTier = null;
    let subscriptionEnd = null;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      logStep("Found Stripe customer", { customerId });

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      
      if (subscriptions.data.length > 0) {
        stripeSubscription = subscriptions.data[0];
        subscriptionEnd = new Date(stripeSubscription.current_period_end * 1000).toISOString();
        const productId = stripeSubscription.items.data[0].price.product as string;
        stripeTier = PRODUCT_TO_TIER[productId] || null;
        logStep("Active Stripe subscription found", { tier: stripeTier, endDate: subscriptionEnd });
      }
    }

    // If user has an active Stripe subscription, return that
    if (stripeTier) {
      const limits = TIER_LIMITS[stripeTier] || TIER_LIMITS.freemium;
      return new Response(JSON.stringify({
        subscribed: true,
        tier: stripeTier,
        limits,
        subscription_end: subscriptionEnd,
        source: "stripe",
        trial_active: false,
        token_bonus: { games_joinable: 0, games_creatable: 0 },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for trial or token bonuses in database
    const { data: bonusData, error: bonusError } = await supabaseClient
      .from("user_subscription_bonuses")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (bonusError && bonusError.code !== "PGRST116") {
      logStep("Error fetching bonus data", { error: bonusError });
    }

    let effectiveTier = "freemium";
    let trialActive = false;
    let trialEnd = null;
    let tokenBonus = { games_joinable: 0, games_creatable: 0 };

    if (bonusData) {
      // Check if trial is still active
      const trialEndDate = new Date(bonusData.trial_end_at);
      const now = new Date();
      
      if (trialEndDate > now) {
        effectiveTier = bonusData.trial_tier;
        trialActive = true;
        trialEnd = bonusData.trial_end_at;
        logStep("Trial active", { tier: effectiveTier, endDate: trialEnd });
      }

      // Add token bonuses
      tokenBonus = {
        games_joinable: bonusData.token_games_joinable || 0,
        games_creatable: bonusData.token_games_creatable || 0,
      };
      logStep("Token bonus", tokenBonus);
    }

    const limits = TIER_LIMITS[effectiveTier] || TIER_LIMITS.freemium;

    // If freemium, add token bonuses to limits
    const effectiveLimits = {
      ...limits,
      games_joinable: limits.games_joinable === -1 ? -1 : limits.games_joinable + tokenBonus.games_joinable,
      games_creatable: limits.games_creatable + tokenBonus.games_creatable,
    };

    return new Response(JSON.stringify({
      subscribed: trialActive,
      tier: effectiveTier,
      limits: effectiveLimits,
      subscription_end: trialEnd,
      source: trialActive ? "trial" : "freemium",
      trial_active: trialActive,
      trial_end: trialEnd,
      token_bonus: tokenBonus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
