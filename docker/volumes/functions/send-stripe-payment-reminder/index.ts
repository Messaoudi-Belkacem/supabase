import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const logStep = (step, details)=>{
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-PAYMENT-REMINDER] ${step}${detailsStr}`);
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    logStep("Function started");
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: {
        persistSession: false
      }
    });
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    // Parse request body for optional parameters
    let minHoursOld = 2; // Default: send reminder after 2 hours
    let maxReminders = 2; // Default: max 2 reminders
    try {
      const body = await req.json();
      if (body.minHoursOld) minHoursOld = body.minHoursOld;
      if (body.maxReminders) maxReminders = body.maxReminders;
    } catch  {
    // Use defaults if no body
    }
    logStep("Parameters", {
      minHoursOld,
      maxReminders
    });
    // Calculate cutoff time
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - minHoursOld);
    // Find unpaid Stripe payment links that need reminders
    const { data: pendingLinks, error: linksError } = await supabaseClient.from("payment_links").select("id, email, subscription_code, offer_type, duration_months, amount, payment_link_url, created_at, reminder_count, source").eq("provider", "stripe").eq("status", "pending").lt("created_at", cutoffTime.toISOString()).lt("reminder_count", maxReminders).order("created_at", {
      ascending: true
    });
    if (linksError) {
      throw new Error(`Error fetching payment links: ${linksError.message}`);
    }
    logStep("Found pending payment links", {
      count: pendingLinks?.length || 0
    });
    // Find unpaid referrals that need reminders
    const { data: pendingReferrals, error: referralsError } = await supabaseClient.from("referrals").select(`
        id, 
        referred_email, 
        offer_type, 
        duration_months, 
        amount, 
        payment_link_url, 
        created_at, 
        reminder_count,
        referrer_client_id,
        client_accounts!referrals_referrer_client_id_fkey(email, full_name)
      `).eq("status", "pending").not("payment_link_url", "is", null).lt("created_at", cutoffTime.toISOString()).lt("reminder_count", maxReminders);
    if (referralsError) {
      throw new Error(`Error fetching referrals: ${referralsError.message}`);
    }
    logStep("Found pending referrals", {
      count: pendingReferrals?.length || 0
    });
    const results = {
      paymentLinksProcessed: 0,
      referralsProcessed: 0,
      errors: []
    };
    // Send reminders for payment links
    for (const link of pendingLinks || []){
      try {
        const offerLabel = link.offer_type === "complet" ? "Complet" : "Essentiel";
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: #D4AF37; margin: 0; font-size: 24px;">OTT Premium</h1>
              </div>
              <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">Votre paiement est en attente</h2>
                <p style="color: #666; line-height: 1.6;">
                  Bonjour,
                </p>
                <p style="color: #666; line-height: 1.6;">
                  Vous avez récemment généré un lien de paiement pour votre abonnement <strong>OTT Premium ${offerLabel} ${link.duration_months} mois</strong> mais celui-ci n'a pas encore été finalisé.
                </p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #333; font-size: 18px;"><strong>${link.amount}€</strong></p>
                  <p style="margin: 0; color: #666; font-size: 14px;">${offerLabel} - ${link.duration_months} mois</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${link.payment_link_url}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #1a1a2e; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: bold; font-size: 16px;">
                    Finaliser mon paiement
                  </a>
                </div>
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
                  Si vous avez des questions, n'hésitez pas à nous contacter.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;
        const emailResponse = await resend.emails.send({
          from: "OTT Premium <no-reply@ottcrm.fr>",
          to: [
            link.email
          ],
          subject: `Rappel: Votre paiement OTT Premium est en attente`,
          html: emailHtml
        });
        logStep("Reminder sent for payment link", {
          email: link.email,
          linkId: link.id,
          emailId: emailResponse.data?.id
        });
        // Update reminder count
        await supabaseClient.from("payment_links").update({
          reminder_count: (link.reminder_count || 0) + 1,
          reminder_sent_at: new Date().toISOString()
        }).eq("id", link.id);
        results.paymentLinksProcessed++;
      } catch (error) {
        const errorMsg = `Error sending reminder for link ${link.id}: ${error instanceof Error ? error.message : String(error)}`;
        logStep("ERROR", {
          error: errorMsg
        });
        results.errors.push(errorMsg);
      }
    }
    // Send reminders for referrals
    for (const referral of pendingReferrals || []){
      try {
        const offerLabel = referral.offer_type === "complet" ? "Complet" : "Essentiel";
        const referrerName = referral.client_accounts?.full_name || referral.client_accounts?.email || "un ami";
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: #D4AF37; margin: 0; font-size: 24px;">OTT Premium</h1>
              </div>
              <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-top: 0;">Invitation de ${referrerName}</h2>
                <p style="color: #666; line-height: 1.6;">
                  Bonjour,
                </p>
                <p style="color: #666; line-height: 1.6;">
                  ${referrerName} vous a invité à rejoindre OTT Premium ! Le lien de paiement pour votre abonnement <strong>${offerLabel} ${referral.duration_months} mois</strong> est toujours actif.
                </p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #333; font-size: 18px;"><strong>${referral.amount}€</strong></p>
                  <p style="margin: 0; color: #666; font-size: 14px;">${offerLabel} - ${referral.duration_months} mois</p>
                </div>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${referral.payment_link_url}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%); color: #1a1a2e; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: bold; font-size: 16px;">
                    Finaliser mon inscription
                  </a>
                </div>
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
                  Si vous avez des questions, n'hésitez pas à nous contacter.
                </p>
              </div>
            </div>
          </body>
          </html>
        `;
        const emailResponse = await resend.emails.send({
          from: "OTT Premium <no-reply@ottcrm.fr>",
          to: [
            referral.referred_email
          ],
          subject: `Rappel: ${referrerName} vous a invité sur OTT Premium`,
          html: emailHtml
        });
        logStep("Reminder sent for referral", {
          email: referral.referred_email,
          referralId: referral.id,
          emailId: emailResponse.data?.id
        });
        // Update reminder count
        await supabaseClient.from("referrals").update({
          reminder_count: (referral.reminder_count || 0) + 1,
          reminder_sent_at: new Date().toISOString()
        }).eq("id", referral.id);
        results.referralsProcessed++;
      } catch (error) {
        const errorMsg = `Error sending reminder for referral ${referral.id}: ${error instanceof Error ? error.message : String(error)}`;
        logStep("ERROR", {
          error: errorMsg
        });
        results.errors.push(errorMsg);
      }
    }
    logStep("Completed", results);
    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", {
      message: errorMessage
    });
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
