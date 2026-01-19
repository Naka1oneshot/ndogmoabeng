import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-MEETUP-PAYMENT] ${step}${detailsStr}`);
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

    const { registrationId } = await req.json();
    logStep("Checking registration", { registrationId });

    if (!registrationId) {
      throw new Error("Missing registrationId");
    }

    // Get registration with session ID
    const { data: registration, error: fetchError } = await supabaseClient
      .from('meetup_registrations')
      .select('id, stripe_session_id, payment_status, display_name, phone, companions_count, meetup_event_id')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      throw new Error("Registration not found");
    }

    logStep("Found registration", { 
      id: registration.id, 
      sessionId: registration.stripe_session_id,
      currentStatus: registration.payment_status 
    });

    // If already paid, return success
    if (registration.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ 
          status: 'paid',
          message: 'Paiement déjà confirmé'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // If no session ID, payment was not initiated
    if (!registration.stripe_session_id) {
      return new Response(
        JSON.stringify({ 
          status: 'pending',
          message: 'Paiement non initié'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Check Stripe session status
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(registration.stripe_session_id);

    logStep("Stripe session status", { 
      sessionId: session.id, 
      paymentStatus: session.payment_status,
      status: session.status 
    });

    if (session.payment_status === 'paid') {
      // Update registration as paid
      const { error: updateError } = await supabaseClient
        .from('meetup_registrations')
        .update({ 
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          status: 'CONFIRMED'
        })
        .eq('id', registrationId);

      if (updateError) {
        logStep("Error updating registration", { error: updateError });
      } else {
        logStep("Registration marked as paid");
      }

      // Send admin notification
      try {
        const { data: event } = await supabaseClient
          .from('meetup_events')
          .select('title, start_at')
          .eq('id', registration.meetup_event_id)
          .single();

        if (event) {
          const eventDate = new Date(event.start_at).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          await supabaseClient.functions.invoke('notify-meetup-registration', {
            body: {
              eventTitle: event.title,
              eventDate,
              displayName: registration.display_name,
              phone: registration.phone,
              companionsCount: registration.companions_count,
              companionsNames: [],
              userNote: `💳 PAIEMENT CONFIRMÉ - ${session.amount_total ? (session.amount_total / 100).toFixed(2) : '?'}€`,
              adminUrl: `https://ndogmoabeng.com/admin/meetups`,
            },
          });
          logStep("Admin notification sent");
        }
      } catch (notifError) {
        logStep("Failed to send notification", { error: notifError });
      }

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

    // Payment not completed
    if (session.status === 'expired') {
      // Mark as failed
      await supabaseClient
        .from('meetup_registrations')
        .update({ payment_status: 'failed' })
        .eq('id', registrationId);

      return new Response(
        JSON.stringify({ 
          status: 'expired',
          message: 'Session de paiement expirée'
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
