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

// Tier limits configuration (games_creatable only, games_joinable is unlimited for all)
const TIER_LIMITS: Record<string, {
  games_creatable: number;
  clan_benefits: boolean;
  max_friends: number;
  chat_access: string;
}> = {
  freemium: {
    games_creatable: 2,
    clan_benefits: false,
    max_friends: 2,
    chat_access: "read_only",
  },
  starter: {
    games_creatable: 10,
    clan_benefits: true,
    max_friends: 10,
    chat_access: "full",
  },
  premium: {
    games_creatable: 50,
    clan_benefits: true,
    max_friends: 20,
    chat_access: "full",
  },
  royal: {
    games_creatable: 200,
    clan_benefits: true,
    max_friends: -1, // unlimited
    chat_access: "full",
  },
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Get start of current month in ISO format
function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

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

    const monthStart = getMonthStart();
    logStep("Month start for usage count", { monthStart });

    // Count games animated this month (as host) - only games that were initialized (status != LOBBY)
    const { count: gamesCreatedCount, error: createdError } = await supabaseClient
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("host_user_id", user.id)
      .gte("created_at", monthStart)
      .neq("status", "LOBBY");

    if (createdError) {
      logStep("Error counting created games", { error: createdError });
    }

    // Count current friends (accepted friendships)
    const { count: friendsCount, error: friendsError } = await supabaseClient
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (friendsError) {
      logStep("Error counting friends", { error: friendsError });
    }

    const usedCreatable = gamesCreatedCount || 0;
    const currentFriendsCount = friendsCount || 0;
    logStep("Usage counts", { usedCreatable, currentFriendsCount });

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

    // If user has an active Stripe subscription, return that with usage
    if (stripeTier) {
      const limits = TIER_LIMITS[stripeTier] || TIER_LIMITS.freemium;
      const remainingFriends = limits.max_friends === -1 ? -1 : Math.max(0, limits.max_friends - currentFriendsCount);
      const remainingLimits = {
        ...limits,
        games_creatable: Math.max(0, limits.games_creatable - usedCreatable),
        max_friends: remainingFriends,
      };
      
      return new Response(JSON.stringify({
        subscribed: true,
        tier: stripeTier,
        limits: remainingLimits,
        max_limits: limits,
        usage: { games_created: usedCreatable, friends_count: currentFriendsCount },
        subscription_end: subscriptionEnd,
        source: "stripe",
        trial_active: false,
        token_bonus: { games_creatable: 0 },
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
    let tokenBonus = { games_creatable: 0 };

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
        games_creatable: bonusData.token_games_creatable || 0,
      };
      logStep("Token bonus", tokenBonus);
    }

    const limits = TIER_LIMITS[effectiveTier] || TIER_LIMITS.freemium;

    // Calculate total limits including token bonuses
    const totalCreatable = limits.games_creatable + tokenBonus.games_creatable;
    const remainingFriends = limits.max_friends === -1 ? -1 : Math.max(0, limits.max_friends - currentFriendsCount);

    // Calculate remaining limits after usage
    const remainingLimits = {
      ...limits,
      games_creatable: Math.max(0, totalCreatable - usedCreatable),
      max_friends: remainingFriends,
    };

    const maxLimits = {
      ...limits,
      games_creatable: totalCreatable,
    };

    return new Response(JSON.stringify({
      subscribed: trialActive,
      tier: effectiveTier,
      limits: remainingLimits,
      max_limits: maxLimits,
      usage: { games_created: usedCreatable, friends_count: currentFriendsCount },
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
