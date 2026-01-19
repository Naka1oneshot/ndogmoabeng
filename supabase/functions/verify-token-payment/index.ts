import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-TOKEN-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { sessionId } = await req.json();
    logStep("Checking session", { sessionId });

    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    // Check Stripe session status
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    logStep("Stripe session status", { 
      sessionId: session.id, 
      paymentStatus: session.payment_status,
      metadata: session.metadata 
    });

    if (session.payment_status === 'paid' && session.metadata?.add_loyalty_points === 'true') {
      const userId = session.metadata.user_id;
      const amountPaidCents = session.amount_total || 0;
      
      if (userId && amountPaidCents > 0) {
        // Check if already credited
        const { data: existingTransaction } = await supabaseClient
          .from('loyalty_transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('note', `Achat tokens: ${session.id}`)
          .maybeSingle();

        if (!existingTransaction) {
          const pointsToAdd = Math.floor(amountPaidCents / 100); // 1€ = 1 point
          if (pointsToAdd > 0) {
            await supabaseClient.rpc('add_loyalty_points', {
              p_user_id: userId,
              p_amount: pointsToAdd,
              p_source: 'token_payment',
              p_note: `Achat tokens: ${session.id}`
            });
            logStep("Loyalty points added", { userId, points: pointsToAdd });
          }
        } else {
          logStep("Points already credited for this session");
        }
      }

      return new Response(
        JSON.stringify({ 
          status: 'paid',
          message: 'Paiement confirmé et points ajoutés !'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (session.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ 
          status: 'paid',
          message: 'Paiement confirmé !'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        status: 'pending',
        message: 'Paiement en attente'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
