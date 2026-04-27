import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") || "https://gott-premium.com").replace(/\/$/, "");
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
function calculateSenderWarmupLimit(sender) {
  if (!sender.warmup_enabled) {
    return sender.warmup_max_limit || 500;
  }
  const startDate = sender.warmup_start_date ? new Date(sender.warmup_start_date) : new Date();
  const today = new Date();
  const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const initialLimit = sender.warmup_initial_limit || 50;
  const increment = sender.warmup_daily_increment || 10;
  const maxLimit = sender.warmup_max_limit || 500;
  return Math.min(initialLimit + daysSinceStart * increment, maxLimit);
}
async function selectSender(supabase) {
  const today = new Date().toISOString().split('T')[0];
  // Prefer response_only senders
  const { data: senders } = await supabase.from('email_senders').select('*').eq('is_active', true).eq('is_configured', true).neq('auto_disabled', true).order('response_only', {
    ascending: false
  });
  if (!senders || senders.length === 0) {
    return null;
  }
  for (const sender of senders){
    let currentCount = sender.daily_sent_count;
    if (sender.last_reset_date !== today) {
      await supabase.from('email_senders').update({
        daily_sent_count: 0,
        last_reset_date: today
      }).eq('id', sender.id);
      currentCount = 0;
    }
    const dailyLimit = calculateSenderWarmupLimit(sender);
    if (currentCount < dailyLimit) {
      return {
        ...sender,
        daily_sent_count: currentCount
      };
    }
  }
  return null;
}
async function sendViaSMTP(sender, to, subject, htmlBody) {
  if (!sender.smtp_host || !sender.smtp_user || !sender.smtp_password) {
    throw new Error('SMTP credentials not configured');
  }
  const useTls = sender.smtp_secure === true;
  const port = sender.smtp_port || (useTls ? 465 : 587);
  console.log(`SMTP: ${sender.smtp_host}:${port}, tls=${useTls}`);
  const client = new SMTPClient({
    connection: {
      hostname: sender.smtp_host,
      port: port,
      tls: useTls,
      auth: {
        username: sender.smtp_user,
        password: sender.smtp_password
      }
    }
  });
  try {
    await client.send({
      from: `${sender.name} <${sender.email}>`,
      to: to,
      subject: subject,
      html: htmlBody
    });
    console.log('Email sent successfully');
  } finally{
    await client.close();
  }
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { clientEmail, offerType, durationMonths, resellerName } = await req.json();
    if (!clientEmail || !offerType) {
      throw new Error('clientEmail and offerType are required');
    }
    console.log(`Sending reseller activation email to: ${clientEmail}`);
    const sender = await selectSender(supabase);
    if (!sender) {
      throw new Error('No SMTP sender available');
    }
    console.log(`Using sender: ${sender.name} <${sender.email}>`);
    const year = new Date().getFullYear();
    const portalUrl = `${APP_BASE_URL}/client/login`;
    const clientName = clientEmail.split('@')[0];
    const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activation de votre abonnement</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${OTT_COLORS.lightPurple}; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${OTT_COLORS.lightPurple};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: ${OTT_COLORS.white}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(58, 21, 100, 0.15);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${OTT_COLORS.purple} 0%, ${OTT_COLORS.darkPurple} 100%); padding: 30px; text-align: center;">
              <img src="https://ott-premium-officiel.com/logo.webp?v=2" alt="OTT Premium" style="max-width: 200px; height: auto;" />
            </td>
          </tr>
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, ${OTT_COLORS.pink} 0%, ${OTT_COLORS.lime} 50%, ${OTT_COLORS.pink} 100%);"></td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 35px;">
              <h1 style="margin: 0 0 25px 0; color: ${OTT_COLORS.purple}; font-size: 26px; font-weight: 700;">
                🚀 Activation en cours !
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.7; color: ${OTT_COLORS.gray};">
                Bonjour <strong style="color: ${OTT_COLORS.purple};">${clientName}</strong>,
              </p>
              
              <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.7; color: ${OTT_COLORS.gray};">
                Félicitations ! Votre abonnement <strong style="color: ${OTT_COLORS.pink};">Orgafor Service ${offerType} ${durationMonths} mois</strong> est en cours d'activation.
              </p>

              <!-- Activation Status -->
              <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-radius: 12px; padding: 25px; margin-bottom: 25px; border-left: 4px solid #ff9800;">
                <h3 style="margin: 0 0 15px 0; color: ${OTT_COLORS.purple}; font-size: 18px;">⏳ Activation en cours</h3>
                <p style="margin: 0; font-size: 15px; color: ${OTT_COLORS.gray}; line-height: 1.6;">
                  Notre équipe prépare votre accès. Vous recevrez vos <strong>identifiants de connexion</strong> très prochainement par email.
                </p>
              </div>

              <!-- Portal Info -->
              <div style="background: linear-gradient(135deg, ${OTT_COLORS.lightPurple} 0%, #f0e8f5 100%); border-radius: 12px; padding: 25px; margin-bottom: 25px; border-left: 4px solid ${OTT_COLORS.pink};">
                <h3 style="margin: 0 0 15px 0; color: ${OTT_COLORS.purple}; font-size: 18px;">📱 Votre Espace Client</h3>
                <p style="margin: 0 0 15px 0; font-size: 15px; color: ${OTT_COLORS.gray}; line-height: 1.6;">
                  Dès que votre compte sera activé, vous trouverez dans votre espace client :
                </p>
                <ul style="margin: 0; padding-left: 20px; color: ${OTT_COLORS.gray}; line-height: 2;">
                  <li><strong>Vos identifiants de connexion</strong> (login & mot de passe)</li>
                  <li><strong>Les instructions d'installation</strong> pour tous vos appareils</li>
                  <li><strong>Les liens de téléchargement</strong> des applications</li>
                  <li><strong>Le suivi de votre abonnement</strong></li>
                </ul>
              </div>

              <!-- CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="${portalUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, ${OTT_COLORS.pink} 0%, ${OTT_COLORS.purple} 100%); color: ${OTT_COLORS.white}; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(220, 16, 145, 0.3);">
                      Accéder à mon Espace Client
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 14px; color: ${OTT_COLORS.gray}; text-align: center; line-height: 1.6;">
                Une fois connecté, vous aurez accès à toutes les instructions pour configurer vos appareils.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: ${OTT_COLORS.lightGray}; padding: 25px 35px; border-top: 1px solid #eee;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: ${OTT_COLORS.purple}; font-weight: 600;">L'équipe OTT Premium</p>
              <p style="margin: 0; font-size: 13px; color: ${OTT_COLORS.gray};">
                📱 <strong>WhatsApp/Telegram :</strong> +33 7 59 26 78 81
              </p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="margin: 0; font-size: 11px; color: #999;">
                © ${year} OTT Premium - Tous droits réservés
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    await sendViaSMTP(sender, clientEmail, "🚀 Votre abonnement Orgafor Service est en cours d'activation !", emailHtml);
    // Update sender count
    await supabase.from('email_senders').update({
      daily_sent_count: sender.daily_sent_count + 1,
      last_sent_at: new Date().toISOString()
    }).eq('id', sender.id);
    console.log('Reseller activation email sent successfully');
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error sending activation email:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
