import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegistrationNotification {
  eventTitle: string;
  eventDate: string;
  displayName: string;
  phone: string;
  companionsCount: number;
  companionsNames: string[];
  userNote: string | null;
  adminUrl: string;
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

    const data: RegistrationNotification = await req.json();
    console.log("Sending notification for registration:", data.displayName);

    const totalPlayers = 1 + data.companionsCount;
    const companionsList = data.companionsNames.filter(n => n).join(", ") || "Non précisés";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070A0F; color: #F5F2EA; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #0F172A; border-radius: 12px; padding: 24px; border: 1px solid #26324D; }
    h1 { color: #D4AF37; margin-top: 0; font-size: 24px; }
    .info-row { padding: 12px 0; border-bottom: 1px solid #26324D; }
    .label { color: #C9C4B8; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
    .value { color: #F5F2EA; font-size: 16px; font-weight: 500; }
    .highlight { color: #D4AF37; font-weight: bold; }
    .note-box { background: #172554; padding: 16px; border-radius: 8px; margin-top: 16px; border-left: 4px solid #14B8A6; }
    .cta { display: inline-block; background: #D4AF37; color: #070A0F; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #26324D; color: #C9C4B8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎮 Nouvelle inscription</h1>
    
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
      <div class="label">Téléphone</div>
      <div class="value"><a href="tel:${data.phone}" style="color: #14B8A6;">${data.phone}</a></div>
    </div>
    
    <div class="info-row">
      <div class="label">Nombre de joueurs</div>
      <div class="value"><span class="highlight">${totalPlayers}</span> joueur${totalPlayers > 1 ? 's' : ''} ${data.companionsCount > 0 ? `(+${data.companionsCount} accompagnant${data.companionsCount > 1 ? 's' : ''})` : '(seul)'}</div>
    </div>
    
    ${data.companionsCount > 0 ? `
    <div class="info-row">
      <div class="label">Accompagnants</div>
      <div class="value">${companionsList}</div>
    </div>
    ` : ''}
    
    ${data.userNote ? `
    <div class="note-box">
      <div class="label">💬 Note de l'utilisateur</div>
      <div class="value" style="margin-top: 8px;">${data.userNote}</div>
    </div>
    ` : ''}
    
    <a href="${data.adminUrl}" class="cta">Gérer les inscriptions</a>
    
    <div class="footer">
      Cet email a été envoyé automatiquement par le système d'inscription de Ndogmoabeng.
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Ndogmoabeng <onboarding@resend.dev>",
      to: [adminEmail],
      subject: `🎮 Nouvelle inscription: ${data.displayName} pour ${data.eventTitle}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
