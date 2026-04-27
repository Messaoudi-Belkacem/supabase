import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") || "https://gott-premium.com").replace(/\/$/, "");
const MOBILE_DEEP_LINK_BASE = (Deno.env.get("MOBILE_DEEP_LINK_BASE") || "ottcrm://auth").replace(/\/$/, "");
// OTT Premium colors
const OTT_COLORS = {
  purple: "#3a1564",
  pink: "#dc1091",
  lime: "#b5cc00",
  darkPurple: "#2a0f4a",
  lightPurple: "#f5f0fa",
  white: "#ffffff",
  gray: "#666666",
  lightGray: "#f8f8f8"
};
function generateMagicLinkEmailHtml(webMagicLink, mobileDeepLink, clientName, customMessage, otpCode) {
  const greeting = clientName ? `Bonjour ${clientName},` : "Bonjour,";
  // Format custom message - convert line breaks to <br> and wrap in paragraphs
  const formattedCustomMessage = customMessage ? customMessage.split("\n\n").map((para)=>`<p style="margin: 0 0 15px 0;">${para.replace(/\n/g, "<br>")}</p>`).join("") : "";
  // Default message if no custom message
  const defaultMessage = !customMessage ? `
    <p style="margin: 0 0 15px 0;">Vous avez demandé à vous connecter à votre espace client OTT Premium.</p>
    <p style="margin: 0 0 15px 0;">Cliquez sur le bouton ci-dessous pour accéder à votre compte :</p>
  ` : "";
  const otpSection = otpCode ? `
              <!-- Mobile OTP -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 30px;">
                <tr>
                  <td style="text-align: center; padding: 20px; background-color: ${OTT_COLORS.lightPurple}; border-radius: 12px; border: 2px dashed ${OTT_COLORS.purple};">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: ${OTT_COLORS.gray};">Ou entrez ce code dans l'application mobile :</p>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; color: ${OTT_COLORS.purple}; letter-spacing: 8px;">
                      ${otpCode}
                    </div>
                  </td>
                </tr>
              </table>
  ` : "";
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Connexion à votre espace client - OTT Premium</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 10px !important; }
      .content-cell { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${OTT_COLORS.lightPurple}; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Cliquez pour accéder à votre espace client OTT Premium</div>
  
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
                ${formattedCustomMessage || defaultMessage}
              </div>

              ${otpSection}
              
              <!-- Web CTA -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 14px;">
                  <tr>
                    <td style="border-radius: 8px; background: linear-gradient(135deg, ${OTT_COLORS.pink} 0%, ${OTT_COLORS.purple} 100%);">
                      <a href="${webMagicLink}" target="_blank" style="display: inline-block; padding: 16px 40px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: bold; color: ${OTT_COLORS.white}; text-decoration: none; border-radius: 8px;">
                        🌐 Ouvrir sur le site web
                      </a>
                    </td>
                  </tr>
                </table>
               <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 10px;">
                 <tr>
                   <td style="border-radius: 8px; background: ${OTT_COLORS.lightGray}; border: 1px solid #ddd;">
                      <a href="${mobileDeepLink}" target="_blank" style="display: inline-block; padding: 14px 34px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 15px; font-weight: 700; color: ${OTT_COLORS.purple}; text-decoration: none; border-radius: 8px;">
                        📱 Ouvrir dans l'app mobile
                      </a>
                   </td>
                 </tr>
               </table>
               <p style="margin: 10px 0 0 0; font-size: 13px; color: ${OTT_COLORS.gray}; line-height: 1.6; text-align: center;">
                 Le lien web fonctionne partout. Le lien mobile ouvre directement l'application OTT CRM.
               </p>
               <p style="margin: 10px 0 0 0; font-size: 12px; color: ${OTT_COLORS.gray}; line-height: 1.6; word-break: break-all;">
                 Si l'ouverture mobile ne démarre pas, copiez ce lien dans votre navigateur mobile : ${mobileDeepLink}
               </p>
              
              <div style="font-size: 15px; line-height: 1.7; color: ${OTT_COLORS.gray};">
                <p style="margin: 0 0 15px 0;">Ce lien est valable pendant <strong>1 heure</strong> et ne peut être utilisé qu'une seule fois.</p>
                <p style="margin: 0 0 15px 0;">Si vous n'avez pas demandé cette connexion, vous pouvez ignorer cet email en toute sécurité.</p>
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
async function refreshAccessToken(refreshToken) {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });
    const data = await response.json();
    if (data.error) {
      console.error("[MAGIC-LINK] Token refresh error:", data);
      return null;
    }
    return data;
  } catch (error) {
    console.error("[MAGIC-LINK] Error refreshing token:", error);
    return null;
  }
}
function createRawEmail(from, to, subject, htmlBody) {
  const boundary = "----=_Part_" + Math.random().toString(36).substring(2);
  const emailLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(htmlBody.replace(/<[^>]*>/g, "")))),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(htmlBody))),
    "",
    `--${boundary}--`
  ];
  return emailLines.join("\r\n");
}
async function sendViaGmailOAuth(supabase, sender, to, subject, htmlBody) {
  let accessToken = sender.oauth_access_token;
  // Check if token needs refresh
  if (sender.oauth_token_expires_at && sender.oauth_refresh_token) {
    const tokenExpiry = new Date(sender.oauth_token_expires_at);
    const now = new Date();
    if (tokenExpiry <= now) {
      console.log("[MAGIC-LINK] Access token expired, refreshing...");
      const newTokens = await refreshAccessToken(sender.oauth_refresh_token);
      if (!newTokens) {
        await supabase.from("email_senders").update({
          auto_disabled: true,
          last_error: "OAuth token refresh failed",
          last_error_at: new Date().toISOString(),
          error_count: (sender.error_count || 0) + 1
        }).eq("id", sender.id);
        throw new Error("Failed to refresh access token");
      }
      accessToken = newTokens.access_token;
      const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
      await supabase.from("email_senders").update({
        oauth_access_token: accessToken,
        oauth_token_expires_at: newExpiry
      }).eq("id", sender.id);
      console.log("[MAGIC-LINK] Token refreshed successfully");
    }
  }
  // Create raw email
  const from = `OTT Premium <${sender.email}>`;
  const rawEmail = createRawEmail(from, to, subject, htmlBody);
  // URL-safe base64 encode
  const encodedEmail = btoa(rawEmail).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  // Send via Gmail API
  const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      raw: encodedEmail
    })
  });
  const sendResult = await sendResponse.json();
  if (sendResult.error) {
    console.error("[MAGIC-LINK] Gmail API error:", sendResult.error);
    await supabase.from("email_senders").update({
      last_error: sendResult.error.message || "Gmail API error",
      last_error_at: new Date().toISOString(),
      error_count: (sender.error_count || 0) + 1
    }).eq("id", sender.id);
    throw new Error(`Gmail API error: ${sendResult.error.message}`);
  }
  console.log(`[MAGIC-LINK] ✅ Gmail API email sent successfully to ${to}, messageId: ${sendResult.id}`);
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { email, returnLinkOnly, customMessage } = await req.json();
    if (!email) {
      console.error("Magic link request failed: email missing");
      return new Response(JSON.stringify({
        error: "Email requis"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[MAGIC-LINK] Request for: ${normalizedEmail}, returnLinkOnly: ${returnLinkOnly}, hasCustomMessage: ${!!customMessage}`);
    // Check if client account exists
    let client = await (async ()=>{
      const { data, error } = await supabase.from("client_accounts").select("id, email, full_name, auth_user_id").eq("email", normalizedEmail).eq("is_active", true).maybeSingle();
      if (error) {
        console.error("[MAGIC-LINK] Error fetching client:", error);
        throw new Error("Erreur lors de la vérification du compte");
      }
      return data;
    })();
    console.log(`[MAGIC-LINK] Client account found: ${!!client}`);
    // If client doesn't exist, check if subscriptions exist for this email
    if (!client) {
      console.log("[MAGIC-LINK] Client account not found, checking for subscriptions...");
      // Search for subscriptions with this email
      const { data: subscriptions, error: subError } = await supabase.from("subscriptions").select("id, email, subscription_code, end_date, login, password, server_url").eq("email", normalizedEmail).limit(1);
      if (subError) {
        console.error("[MAGIC-LINK] Error fetching subscriptions:", subError);
      }
      if (subscriptions && subscriptions.length > 0) {
        console.log(`[MAGIC-LINK] Found ${subscriptions.length} subscription(s) for ${normalizedEmail}, creating client account...`);
        // Get the first subscription to use its data
        const fullName = normalizedEmail.split("@")[0];
        // Generate a default password
        const defaultPassword = crypto.randomUUID().slice(0, 8);
        // Create client account
        const { data: newClientId, error: createError } = await supabase.rpc("create_client_with_password", {
          p_email: normalizedEmail,
          p_password: defaultPassword,
          p_full_name: fullName
        });
        if (createError) {
          console.error("[MAGIC-LINK] Error creating client:", createError);
          throw new Error("Erreur lors de la création du compte client");
        }
        console.log("[MAGIC-LINK] Created new client account:", newClientId);
        // Link all subscriptions to the new client account
        const { data: linkedCount, error: linkError } = await supabase.rpc("link_client_subscriptions_by_email", {
          p_client_id: newClientId
        });
        if (linkError) {
          console.error("[MAGIC-LINK] Error linking subscriptions:", linkError);
        } else {
          console.log(`[MAGIC-LINK] Linked ${linkedCount} subscription(s) to client ${newClientId}`);
        }
        // Fetch the newly created client
        const { data: newClient, error: fetchError } = await supabase.from("client_accounts").select("id, email, full_name, auth_user_id").eq("id", newClientId).single();
        if (fetchError) {
          console.error("[MAGIC-LINK] Error fetching new client:", fetchError);
          throw new Error("Erreur lors de la récupération du compte");
        }
        client = newClient;
        console.log("[MAGIC-LINK] Client account ready with synchronized subscriptions");
      } else {
        // No subscriptions found for this email
        console.log(`[MAGIC-LINK] No subscriptions found for email: ${normalizedEmail}`);
        return new Response(JSON.stringify({
          error: "Aucun abonnement trouvé pour cette adresse email. Contactez le support si vous pensez qu'il s'agit d'une erreur."
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
    }
    // Generate unique tokens
    const token = crypto.randomUUID() + "-" + crypto.randomUUID(); // For magic link
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    // Store tokens in database
    const { error: tokenError } = await supabase.from("client_magic_link_tokens").insert([
      {
        client_account_id: client.id,
        token: token,
        expires_at: expiresAt.toISOString()
      },
      {
        client_account_id: client.id,
        token: otpCode,
        expires_at: expiresAt.toISOString()
      }
    ]);
    if (tokenError) {
      console.error("Error inserting tokens:", tokenError);
      throw new Error("Erreur lors de la création du lien");
    }
    // Build magic links for both website and mobile app
    const encodedToken = encodeURIComponent(token);
    const mobileMagicLink = `${MOBILE_DEEP_LINK_BASE}?token=${encodedToken}`;
    const webMagicLink = `${APP_BASE_URL}/client/magic-link?token=${encodedToken}`;
    // If returnLinkOnly, just return the link without sending email
    if (returnLinkOnly) {
      console.log(`Magic link generated (link only) for ${email}`);
      return new Response(JSON.stringify({
        success: true,
        magicLink: webMagicLink,
        mobileMagicLink,
        webMagicLink,
        otpCode
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Generate branded email HTML with optional custom message and OTP code
    const emailHtml = generateMagicLinkEmailHtml(webMagicLink, mobileMagicLink, client.full_name, customMessage, otpCode);
    // Get preferred sender - prioritize gott-premium.com domain with OAuth configured
    let { data: sender } = await supabase.from("email_senders").select("*").eq("is_active", true).eq("is_configured", true).eq("domain", "gott-premium.com").eq("oauth_provider", "google").not("oauth_access_token", "is", null).or("auto_disabled.is.null,auto_disabled.eq.false").order("daily_sent_count", {
      ascending: true
    }).limit(1).maybeSingle();
    // Fallback to any active OAuth sender if no gott-premium.com sender found
    if (!sender) {
      console.log("[MAGIC-LINK] No gott-premium.com OAuth sender found, looking for fallback...");
      const { data: fallbackSender } = await supabase.from("email_senders").select("*").eq("is_active", true).eq("is_configured", true).eq("oauth_provider", "google").not("oauth_access_token", "is", null).or("auto_disabled.is.null,auto_disabled.eq.false").order("daily_sent_count", {
        ascending: true
      }).limit(1).maybeSingle();
      sender = fallbackSender;
    }
    console.log(`[MAGIC-LINK] Selected sender domain priority: gott-premium.com (OAuth)`);
    if (!sender) {
      console.error("[MAGIC-LINK] No OAuth email sender available - all senders are inactive or not configured");
      throw new Error("Aucun expéditeur email configuré avec OAuth");
    }
    console.log(`[MAGIC-LINK] Using OAuth sender: ${sender.email}`);
    // Send email via Gmail OAuth
    try {
      await sendViaGmailOAuth(supabase, sender, client.email, "Connexion à votre espace client - OTT Premium", emailHtml);
      console.log(`[MAGIC-LINK] Gmail OAuth send successful to ${client.email} via ${sender.email}`);
    } catch (gmailError) {
      console.error(`[MAGIC-LINK] Gmail OAuth send FAILED to ${client.email} via ${sender.email}:`, gmailError);
      throw new Error("Erreur lors de l'envoi de l'email. Veuillez réessayer.");
    }
    // Update sender's daily count
    const today = new Date().toISOString().split("T")[0];
    if (sender.last_reset_date !== today) {
      await supabase.from("email_senders").update({
        daily_sent_count: 1,
        last_reset_date: today,
        last_sent_at: new Date().toISOString()
      }).eq("id", sender.id);
    } else {
      await supabase.from("email_senders").update({
        daily_sent_count: sender.daily_sent_count + 1,
        last_sent_at: new Date().toISOString()
      }).eq("id", sender.id);
    }
    console.log(`[MAGIC-LINK] ✅ Email sent successfully to ${client.email}`);
    return new Response(JSON.stringify({
      success: true,
      senderUsed: sender.email
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("[MAGIC-LINK] ❌ Error:", error);
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
