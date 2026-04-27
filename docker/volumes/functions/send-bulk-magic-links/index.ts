import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") || "https://gott-premium.com").replace(/\/$/, "");
// OTT Premium colors
const OTT_COLORS = {
  purple: '#3a1564',
  pink: '#dc1091',
  lime: '#b5cc00',
  darkPurple: '#2a0f4a',
  lightPurple: '#f5f0fa',
  white: '#ffffff',
  gray: '#666666',
  lightGray: '#f8f8f8'
};
function generateMagicLinkEmailHtml(magicLink, clientName) {
  const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
  const customMessage = `Suite à votre réponse concernant votre abonnement, nous vous invitons à accéder à votre espace client pour procéder au renouvellement.

Depuis votre espace client, vous pourrez :
• Consulter vos abonnements et leurs dates d'expiration
• Renouveler votre abonnement en quelques clics
• Accéder à vos identifiants de connexion
• Parrainer vos proches et gagner du temps d'abonnement gratuit

Cliquez sur le bouton ci-dessous pour vous connecter instantanément :`;
  const formattedCustomMessage = customMessage.split('\n\n').map((para)=>`<p style="margin: 0 0 15px 0;">${para.replace(/\n/g, '<br>')}</p>`).join('');
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Accédez à votre espace client - OTT Premium</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 10px !important; }
      .content-cell { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${OTT_COLORS.lightPurple}; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Accédez à votre espace client pour renouveler votre abonnement OTT Premium</div>
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${OTT_COLORS.lightPurple};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 600px; width: 100%; background-color: ${OTT_COLORS.white}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(58, 21, 100, 0.15);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, ${OTT_COLORS.purple} 0%, ${OTT_COLORS.darkPurple} 100%); padding: 30px; text-align: center;">
              <img src="https://ott-premium-officiel.com/logo.webp" alt="OTT Premium" style="max-width: 200px; height: auto;" />
            </td>
          </tr>
          
          <!-- Decorative Bar -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, ${OTT_COLORS.pink} 0%, ${OTT_COLORS.lime} 50%, ${OTT_COLORS.pink} 100%);"></td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content-cell" style="padding: 40px 35px;">
              
              <p style="margin: 0 0 20px 0; font-size: 18px; color: ${OTT_COLORS.purple}; font-weight: 600;">${greeting}</p>
              
              <div style="font-size: 15px; line-height: 1.7; color: ${OTT_COLORS.gray};">
                ${formattedCustomMessage}
              </div>
              
              <!-- Magic Link Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 30px auto;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, ${OTT_COLORS.pink} 0%, ${OTT_COLORS.purple} 100%);">
                    <a href="${magicLink}" target="_blank" style="display: inline-block; padding: 16px 40px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: bold; color: ${OTT_COLORS.white}; text-decoration: none; border-radius: 8px;">
                      🔐 Accéder à mon espace client
                    </a>
                  </td>
                </tr>
              </table>
              
              <div style="font-size: 15px; line-height: 1.7; color: ${OTT_COLORS.gray};">
                <p style="margin: 0 0 15px 0;">Ce lien est valable pendant <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.</p>
              </div>
              
              <!-- Security Notice -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin: 25px 0; background-color: ${OTT_COLORS.lightGray}; border-radius: 12px; border-left: 4px solid ${OTT_COLORS.lime};">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; font-size: 13px; color: ${OTT_COLORS.gray};">
                      🔒 <strong>Sécurité :</strong> Ce lien de connexion sécurisé vous permet d'accéder à votre compte sans mot de passe. Ne le partagez jamais avec personne.
                    </p>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${OTT_COLORS.lightGray}; padding: 25px 35px; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: ${OTT_COLORS.purple}; font-weight: 600;">L'équipe OTT Premium</p>
              
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top: 15px;">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; color: ${OTT_COLORS.gray};">
                      📱 <strong>WhatsApp/Telegram :</strong> +33 7 59 26 78 81
                    </p>
                  </td>
                </tr>
              </table>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              
              <p style="margin: 0; font-size: 11px; color: #999; line-height: 1.5;">
                Cet email a été envoyé par OTT Premium. Si vous n'êtes pas le destinataire prévu, veuillez ignorer ce message.
              </p>
            </td>
          </tr>
          
        </table>
        
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 12px; color: ${OTT_COLORS.purple};">
                © ${new Date().getFullYear()} OTT Premium - Tous droits réservés
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `.trim();
}
async function sendViaSMTP(sender, to, subject, htmlBody) {
  const useTLS = sender.smtp_port === 465;
  const client = new SMTPClient({
    connection: {
      hostname: sender.smtp_host,
      port: sender.smtp_port,
      tls: useTLS,
      auth: {
        username: sender.smtp_user,
        password: sender.smtp_password
      }
    }
  });
  try {
    await client.send({
      from: `OTT Premium <${sender.email}>`,
      to: to,
      subject: subject,
      html: htmlBody
    });
    console.log(`Magic link email sent to ${to} via ${sender.email}`);
  } finally{
    await client.close();
  }
}
async function processBulkMagicLinks(dryRun) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log(`[BACKGROUND] Starting bulk magic link process. Dry run: ${dryRun}`);
  // Get all unread inbound emails with subscriptions expiring within 30 days
  const { data: unreadEmails, error: emailsError } = await supabase.from("email_conversations").select(`
      id,
      sender_email,
      subscription_id,
      subscriptions!inner(
        id,
        subscription_code,
        email,
        end_date,
        status
      )
    `).eq("direction", "inbound").is("notes", null).eq("is_demo", false).lte("subscriptions.end_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  if (emailsError) {
    console.error("[BACKGROUND] Error fetching emails:", emailsError);
    return;
  }
  console.log(`[BACKGROUND] Found ${unreadEmails?.length || 0} unread emails with expiring subscriptions`);
  if (!unreadEmails || unreadEmails.length === 0) {
    console.log("[BACKGROUND] No emails to process");
    return;
  }
  // Group by email to avoid duplicates
  const emailsToProcess = new Map();
  for (const record of unreadEmails){
    const subscription = record.subscriptions;
    const email = subscription.email.toLowerCase();
    if (!emailsToProcess.has(email)) {
      emailsToProcess.set(email, {
        email,
        subscriptionCode: subscription.subscription_code,
        endDate: subscription.end_date,
        emailIds: [
          record.id
        ]
      });
    } else {
      emailsToProcess.get(email).emailIds.push(record.id);
    }
  }
  console.log(`[BACKGROUND] Unique emails to process: ${emailsToProcess.size}`);
  // Get preferred sender - prioritize gott-premium.com domain
  let { data: sender } = await supabase.from("email_senders").select("*").eq("is_active", true).eq("is_configured", true).eq("domain", "gott-premium.com").or("auto_disabled.is.null,auto_disabled.eq.false").order("daily_sent_count", {
    ascending: true
  }).limit(1).maybeSingle();
  if (!sender) {
    const { data: fallbackSender } = await supabase.from("email_senders").select("*").eq("is_active", true).eq("is_configured", true).or("auto_disabled.is.null,auto_disabled.eq.false").order("daily_sent_count", {
      ascending: true
    }).limit(1).maybeSingle();
    sender = fallbackSender;
  }
  console.log(`[BACKGROUND] Sender domain priority: gott-premium.com`);
  if (!sender) {
    console.error("[BACKGROUND] No email sender configured");
    return;
  }
  console.log(`[BACKGROUND] Using sender: ${sender.email}`);
  let sent = 0;
  let errors = 0;
  for (const [email, data] of emailsToProcess){
    try {
      console.log(`[BACKGROUND] Processing ${email} (${data.subscriptionCode}, expires: ${data.endDate})`);
      // Check/create client account
      let { data: client } = await supabase.from("client_accounts").select("id, email, full_name").eq("email", email).eq("is_active", true).maybeSingle();
      if (!client) {
        console.log(`[BACKGROUND] Creating client account for ${email}`);
        if (!dryRun) {
          const defaultPassword = crypto.randomUUID().slice(0, 8);
          const { data: newClientId, error: createError } = await supabase.rpc("create_client_with_password", {
            p_email: email,
            p_password: defaultPassword,
            p_full_name: email.split("@")[0]
          });
          if (createError) {
            console.error(`[BACKGROUND] Error creating client ${email}:`, createError);
            errors++;
            continue;
          }
          const { data: newClient } = await supabase.from("client_accounts").select("id, email, full_name").eq("id", newClientId).single();
          client = newClient;
        }
      }
      if (dryRun) {
        console.log(`[BACKGROUND] [DRY RUN] Would send magic link to ${email}`);
        continue;
      }
      if (!client) {
        errors++;
        continue;
      }
      // Generate magic link token
      const token = crypto.randomUUID() + "-" + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const { error: tokenError } = await supabase.from("client_magic_link_tokens").insert({
        client_account_id: client.id,
        token: token,
        expires_at: expiresAt.toISOString()
      });
      if (tokenError) {
        console.error(`[BACKGROUND] Error creating token for ${email}:`, tokenError);
        errors++;
        continue;
      }
      const magicLink = `${APP_BASE_URL}/client/magic-link?token=${token}`;
      const emailHtml = generateMagicLinkEmailHtml(magicLink, client.full_name);
      await sendViaSMTP(sender, email, "Accédez à votre espace client pour renouveler - OTT Premium", emailHtml);
      // Mark emails as handled
      await supabase.from("email_conversations").update({
        notes: "Magic link de renouvellement envoyé",
        is_read: true
      }).in("id", data.emailIds);
      // Update sender count
      const today = new Date().toISOString().split("T")[0];
      if (sender.last_reset_date !== today) {
        await supabase.from("email_senders").update({
          daily_sent_count: 1,
          last_reset_date: today
        }).eq("id", sender.id);
        sender.daily_sent_count = 1;
        sender.last_reset_date = today;
      } else {
        await supabase.from("email_senders").update({
          daily_sent_count: sender.daily_sent_count + 1
        }).eq("id", sender.id);
        sender.daily_sent_count++;
      }
      sent++;
      console.log(`[BACKGROUND] ✓ Magic link sent to ${email}`);
      // Small delay between emails
      await new Promise((resolve)=>setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[BACKGROUND] Error processing ${email}:`, error);
      errors++;
    }
  }
  console.log(`[BACKGROUND] Completed: ${sent} sent, ${errors} errors`);
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { dryRun = true } = await req.json().catch(()=>({}));
    console.log(`Received request. Dry run: ${dryRun}`);
    // Start background task
    EdgeRuntime.waitUntil(processBulkMagicLinks(dryRun));
    return new Response(JSON.stringify({
      success: true,
      message: dryRun ? "Dry run lancé en arrière-plan, consultez les logs" : "Envoi des magic links lancé en arrière-plan, consultez les logs pour le suivi"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error in send-bulk-magic-links:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
