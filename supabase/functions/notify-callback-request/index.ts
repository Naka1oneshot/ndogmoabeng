import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CallbackNotification {
  eventTitle: string;
  eventDate: string;
  displayName: string;
  phone: string;
  companionsCount: number;
  companionsNames: string[];
  userNote: string | null;
  totalPlayers: number;
  totalPrice: number;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!adminEmail) {
      console.error("ADMIN_NOTIFICATION_EMAIL not configured");
      return new Response(
        JSON.stringify({ error: "Admin email not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data: CallbackNotification = await req.json();
    console.log("Sending callback notification for:", data.displayName);

    const companionsList = data.companionsNames.filter(n => n).join(", ") || "Non précisés";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070A0F; color: #F5F2EA; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #0F172A; border-radius: 12px; padding: 24px; border: 1px solid #26324D; }
    h1 { color: #14B8A6; margin-top: 0; font-size: 24px; }
    .badge { display: inline-block; background: #14B8A6; color: #070A0F; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 16px; }
    .info-row { padding: 12px 0; border-bottom: 1px solid #26324D; }
    .label { color: #C9C4B8; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
    .value { color: #F5F2EA; font-size: 16px; font-weight: 500; }
    .highlight { color: #D4AF37; font-weight: bold; }
    .phone-link { color: #14B8A6; font-size: 20px; font-weight: bold; text-decoration: none; }
    .price-box { background: #172554; padding: 16px; border-radius: 8px; margin-top: 16px; border-left: 4px solid #D4AF37; }
    .note-box { background: #172554; padding: 16px; border-radius: 8px; margin-top: 16px; border-left: 4px solid #14B8A6; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #26324D; color: #C9C4B8; font-size: 12px; }
    .action-required { background: linear-gradient(135deg, #14B8A6 0%, #10B981 100%); color: #070A0F; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center; }
    .action-required p { margin: 0; font-weight: bold; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">📞 DEMANDE DE RAPPEL</span>
    <h1>Nouvelle demande d'inscription</h1>
    
    <div class="action-required">
      <p>⚡ Cette personne souhaite être rappelée ou payer sur place</p>
    </div>
    
    <div class="info-row">
      <div class="label">Événement</div>
      <div class="value">${data.eventTitle}</div>
    </div>
    
    <div class="info-row">
      <div class="label">Date</div>
      <div class="value">${data.eventDate}</div>
    </div>
    
    <div class="info-row">
      <div class="label">Nom / Pseudo</div>
      <div class="value highlight">${data.displayName}</div>
    </div>
    
    <div class="info-row">
      <div class="label">📱 Téléphone (à rappeler)</div>
      <div class="value">
        <a href="tel:${data.phone}" class="phone-link">${data.phone}</a>
      </div>
    </div>
    
    <div class="info-row">
      <div class="label">Nombre de joueurs</div>
      <div class="value">
        <span class="highlight">${data.totalPlayers}</span> joueur${data.totalPlayers > 1 ? 's' : ''} 
        ${data.companionsCount > 0 ? `(+${data.companionsCount} accompagnant${data.companionsCount > 1 ? 's' : ''})` : '(seul)'}
      </div>
    </div>
    
    ${data.companionsCount > 0 ? `
    <div class="info-row">
      <div class="label">Accompagnants</div>
      <div class="value">${companionsList}</div>
    </div>
    ` : ''}
    
    <div class="price-box">
      <div class="label">💰 Montant à encaisser</div>
      <div class="value" style="font-size: 24px; margin-top: 8px;"><span class="highlight">${data.totalPrice} €</span></div>
    </div>
    
    ${data.userNote ? `
    <div class="note-box">
      <div class="label">💬 Note de l'utilisateur</div>
      <div class="value" style="margin-top: 8px;">${data.userNote}</div>
    </div>
    ` : ''}
    
    <div class="footer">
      <p>📞 <strong>Action requise :</strong> Rappeler cette personne pour confirmer son inscription et organiser le paiement.</p>
      <p style="margin-top: 12px;">Cet email a été envoyé automatiquement depuis la page Coming Soon de Ndogmoabeng.</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Ndogmoabeng <onboarding@resend.dev>",
      to: [adminEmail],
      subject: `📞 Demande de rappel: ${data.displayName} - ${data.totalPlayers} place${data.totalPlayers > 1 ? 's' : ''} (${data.totalPrice} €)`,
      html: emailHtml,
    });

    console.log("Callback notification email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending callback notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
