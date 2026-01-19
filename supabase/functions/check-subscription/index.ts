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
const TIER_LIMITS = {
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning freemium state");
      return new Response(JSON.stringify({
        subscribed: false,
        tier: "freemium",
        limits: TIER_LIMITS.freemium,
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let tier = "freemium";
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
      
      const productId = subscription.items.data[0].price.product as string;
      tier = PRODUCT_TO_TIER[productId] || "freemium";
      logStep("Determined subscription tier", { productId, tier });
    } else {
      logStep("No active subscription found");
    }

    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.freemium;

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      tier,
      limits,
      subscription_end: subscriptionEnd,
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
