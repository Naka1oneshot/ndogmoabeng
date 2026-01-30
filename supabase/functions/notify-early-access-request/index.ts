import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EarlyAccessNotification {
  fullName: string;
  email: string;
  phone: string | null;
  message: string | null;
  adminUrl: string;
}

serve(async (req: Request): Promise<Response> => {
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

    const data: EarlyAccessNotification = await req.json();
    console.log("Sending early access notification for:", data.fullName);

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
    <h1>📬 Nouvelle demande d'accès anticipé</h1>
    
    <div class="info-row">
      <div class="label">Nom complet</div>
      <div class="value highlight">${data.fullName}</div>
    </div>
    
    <div class="info-row">
      <div class="label">Email</div>
      <div class="value"><a href="mailto:${data.email}" style="color: #14B8A6;">${data.email}</a></div>
    </div>
    
    ${data.phone ? `
    <div class="info-row">
      <div class="label">Téléphone</div>
      <div class="value"><a href="tel:${data.phone}" style="color: #14B8A6;">${data.phone}</a></div>
    </div>
    ` : ''}
    
    ${data.message ? `
    <div class="note-box">
      <div class="label">💬 Message</div>
      <div class="value" style="margin-top: 8px;">${data.message}</div>
    </div>
    ` : ''}
    
    <a href="${data.adminUrl}" class="cta">Gérer les demandes d'accès</a>
    
    <div class="footer">
      Cet email a été envoyé automatiquement par le système de Ndogmoabeng.
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Ndogmoabeng <onboarding@resend.dev>",
      to: [adminEmail],
      subject: `📬 Nouvelle demande d'accès: ${data.fullName}`,
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
