import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MEETUP-CHECKOUT] ${step}${detailsStr}`);
};

interface CheckoutRequest {
  eventId: string;
  eventTitle: string;
  priceEur: number;
  displayName: string;
  phone: string;
  companionsCount: number;
  companionsNames: string[];
  userNote: string;
}

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

    const body: CheckoutRequest = await req.json();
    logStep("Request body", body);

    const { 
      eventId, 
      eventTitle, 
      priceEur, 
      displayName, 
      phone, 
      companionsCount, 
      companionsNames, 
      userNote 
    } = body;

    if (!eventId || !displayName || !phone) {
      throw new Error("Missing required fields: eventId, displayName, phone");
    }

    // Check if already registered with same phone
    const { data: existing } = await supabaseClient
      .from('meetup_registrations')
      .select('id, status, payment_status')
      .eq('meetup_event_id', eventId)
      .eq('phone', phone)
      .neq('status', 'CANCELLED')
      .maybeSingle();

    if (existing) {
      if (existing.payment_status === 'paid') {
        throw new Error('Tu es déjà inscrit(e) et as payé pour cet événement !');
      }
      // If pending payment, delete old registration and create new one
      if (existing.payment_status === 'pending') {
        await supabaseClient
          .from('meetup_registrations')
          .delete()
          .eq('id', existing.id);
        logStep("Deleted pending registration", { id: existing.id });
      }
    }

    // Calculate total price (main + companions)
    const totalPlayers = 1 + companionsCount;
    const totalAmountCents = Math.round(priceEur * 100 * totalPlayers);
    const isFreeEvent = totalAmountCents === 0;
    
    logStep("Price calculation", { priceEur, totalPlayers, totalAmountCents, isFreeEvent });

    // Create registration
    const { data: registration, error: insertError } = await supabaseClient
      .from('meetup_registrations')
      .insert({
        meetup_event_id: eventId,
        display_name: displayName,
        phone: phone,
        companions_count: companionsCount,
        companions_names: companionsNames.filter((n: string) => n.trim() !== ''),
        user_note: userNote?.trim() || null,
        payment_status: isFreeEvent ? 'free' : 'pending',
        status: isFreeEvent ? 'CONFIRMED' : 'NEW',
        paid_amount_cents: totalAmountCents,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;
    logStep("Created registration", { registrationId: registration.id, isFreeEvent });

    // For free events, send notification and return success
    if (isFreeEvent) {
      // Send admin notification for free registration
      try {
        const eventDate = new Date().toLocaleDateString('fr-FR');
        await supabaseClient.functions.invoke('notify-meetup-registration', {
          body: {
            eventTitle,
            eventDate,
            displayName,
            phone,
            companionsCount,
            companionsNames: companionsNames.filter((n: string) => n.trim() !== ''),
            userNote: userNote?.trim() || null,
            adminUrl: 'https://ndogmoabeng.com/admin/meetups',
          },
        });
        logStep("Admin notification sent for free event");
      } catch (notifError) {
        logStep("Failed to send notification", { error: notifError });
      }

      return new Response(
        JSON.stringify({ 
          free: true,
          registrationId: registration.id,
          message: 'Inscription gratuite confirmée'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Initialize Stripe for paid events
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://ndogmoabeng.com";

    // Create Stripe checkout session with dynamic price
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Ticket: ${eventTitle}`,
              description: `${totalPlayers} place${totalPlayers > 1 ? 's' : ''} - ${displayName}${companionsCount > 0 ? ` + ${companionsCount} accompagnant${companionsCount > 1 ? 's' : ''}` : ''}`,
            },
            unit_amount: totalAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/?meetup_payment=success&registration_id=${registration.id}`,
      cancel_url: `${origin}/?meetup_payment=cancelled&registration_id=${registration.id}`,
      metadata: {
        registration_id: registration.id,
        event_id: eventId,
        phone: phone,
        total_players: String(totalPlayers),
      },
      payment_intent_data: {
        metadata: {
          registration_id: registration.id,
          event_id: eventId,
        },
      },
    });

    // Update registration with session ID
    await supabaseClient
      .from('meetup_registrations')
      .update({ stripe_session_id: session.id })
      .eq('id', registration.id);

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ 
        url: session.url, 
        registrationId: registration.id,
        sessionId: session.id 
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
