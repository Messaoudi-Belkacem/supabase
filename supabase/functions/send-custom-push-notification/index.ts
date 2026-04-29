import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type TargetPlatform = "web" | "mobile" | "both";

type NotificationPayload = {
  title?: string;
  body?: string;
  linkUrl?: string;
  imageUrl?: string;
  clientIds?: string[];
  dryRun?: boolean;
  targetPlatform?: TargetPlatform;
};

type ClientRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  notification_preferences: unknown | null;
};

type PushSubscriptionRow = {
  client_account_id: string;
  channel: "web" | "mobile";
  platform: "web" | "ios" | "android";
  token: string | null;
  subscription: Record<string, unknown> | null;
  enabled: boolean;
};

function pushAllowed(notificationPreferences: unknown) {
  if (!notificationPreferences || typeof notificationPreferences !== "object") {
    return true;
  }

  const record = notificationPreferences as Record<string, unknown>;
  return record.push !== false;
}

function normalizeTargetPlatform(targetPlatform?: string): TargetPlatform {
  if (
    targetPlatform === "web" ||
    targetPlatform === "mobile" ||
    targetPlatform === "both"
  ) {
    return targetPlatform;
  }

  return "both";
}

function shouldIncludeSubscription(
  subscription: PushSubscriptionRow,
  targetPlatform: TargetPlatform,
) {
  if (targetPlatform === "both") {
    return true;
  }

  if (targetPlatform === "web") {
    return subscription.channel === "web";
  }

  return subscription.channel === "mobile";
}

async function sendFcmMessage(
  serverKey: string,
  token: string,
  payload: NotificationPayload,
) {
  const data: Record<string, string> = {};

  if (payload.linkUrl) {
    data.linkUrl = payload.linkUrl;
  }

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      priority: "high",
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
      ...(Object.keys(data).length > 0 ? { data } : {}),
    }),
  });

  const responseData = await response.json().catch(() => null);
  return { response, responseData };
}

async function sendWebPushMessage(
  subscription: Record<string, unknown>,
  payload: NotificationPayload,
) {
  const vapidPublicKey =
    Deno.env.get("VAPID_PUBLIC_KEY") ||
    Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") ||
    "";
  const vapidPrivateKey =
    Deno.env.get("VAPID_PRIVATE_KEY") ||
    Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") ||
    "";
  const vapidSubject =
    Deno.env.get("VAPID_SUBJECT") ||
    Deno.env.get("WEB_PUSH_VAPID_SUBJECT") ||
    "mailto:support@ottcrm.local";

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquants.");
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  await webpush.sendNotification(
    subscription as Parameters<typeof webpush.sendNotification>[0],
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      linkUrl: payload.linkUrl,
      imageUrl: payload.imageUrl,
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } =
      await supabase.auth.getUser(jwt);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (roleError || roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const body = (await req.json().catch(() => ({}))) as NotificationPayload;
    const title = body.title?.trim();
    const message = body.body?.trim();
    const targetPlatform = normalizeTargetPlatform(body.targetPlatform);
    const clientIds = Array.isArray(body.clientIds)
      ? Array.from(
          new Set(
            body.clientIds.filter(
              (clientId) =>
                typeof clientId === "string" && clientId.trim().length > 0,
            ),
          ),
        )
      : [];

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "Le titre et le message sont obligatoires." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    if (clientIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucun destinataire sélectionné." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const { data: clients, error: clientsError } = await supabase
      .from("client_accounts")
      .select("id, email, full_name, is_active, notification_preferences")
      .eq("is_active", true)
      .in("id", clientIds);

    if (clientsError) {
      throw clientsError;
    }

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("client_push_subscriptions")
      .select(
        "client_account_id, channel, platform, token, subscription, enabled",
      )
      .eq("enabled", true)
      .in("client_account_id", clientIds);

    if (subscriptionsError) {
      throw subscriptionsError;
    }

    const matchedClients = (clients || []) as ClientRow[];
    const pushSubscriptions = (subscriptions || []) as PushSubscriptionRow[];
    const subscriptionsByClientId = new Map<string, PushSubscriptionRow[]>();

    for (const subscription of pushSubscriptions) {
      const list =
        subscriptionsByClientId.get(subscription.client_account_id) || [];
      list.push(subscription);
      subscriptionsByClientId.set(subscription.client_account_id, list);
    }

    const skipped: Array<{ clientId: string; email: string; reason: string }> =
      [];
    const failures: Array<{ clientId: string; email: string; error: string }> =
      [];
    let sentCount = 0;
    let matchedCount = 0;

    for (const client of matchedClients) {
      if (!client.is_active) {
        skipped.push({
          clientId: client.id,
          email: client.email,
          reason: "client_inactif",
        });
        continue;
      }

      if (!pushAllowed(client.notification_preferences)) {
        skipped.push({
          clientId: client.id,
          email: client.email,
          reason: "push_desactive",
        });
        continue;
      }

      const clientSubscriptions = (
        subscriptionsByClientId.get(client.id) || []
      ).filter((subscription) =>
        shouldIncludeSubscription(subscription, targetPlatform),
      );

      if (clientSubscriptions.length === 0) {
        skipped.push({
          clientId: client.id,
          email: client.email,
          reason: `aucune_souscription_${targetPlatform}`,
        });
        continue;
      }

      matchedCount += clientSubscriptions.length;

      for (const subscription of clientSubscriptions) {
        if (body.dryRun) {
          sentCount += 1;
          continue;
        }

        try {
          if (subscription.channel === "mobile") {
            if (!subscription.token) {
              skipped.push({
                clientId: client.id,
                email: client.email,
                reason: "mobile_token_introuvable",
              });
              continue;
            }

            const { response, responseData } = await sendFcmMessage(
              Deno.env.get("FIREBASE_SERVER_KEY") ||
                Deno.env.get("FCM_SERVER_KEY") ||
                "",
              subscription.token,
              {
                title,
                body: message,
                linkUrl: body.linkUrl,
                imageUrl: body.imageUrl,
              },
            );

            const success =
              response.ok &&
              (responseData?.success === 1 ||
                responseData?.message_id ||
                responseData?.name);

            if (!success) {
              const errorMessage =
                responseData?.error ||
                responseData?.results?.[0]?.error ||
                `FCM error (${response.status})`;
              failures.push({
                clientId: client.id,
                email: client.email,
                error: String(errorMessage),
              });
              continue;
            }

            sentCount += 1;
            continue;
          }

          if (!subscription.subscription) {
            skipped.push({
              clientId: client.id,
              email: client.email,
              reason: "web_subscription_introuvable",
            });
            continue;
          }

          await sendWebPushMessage(subscription.subscription, {
            title,
            body: message,
            linkUrl: body.linkUrl,
            imageUrl: body.imageUrl,
          });

          sentCount += 1;
        } catch (error) {
          const messageText =
            error instanceof Error ? error.message : String(error);
          failures.push({
            clientId: client.id,
            email: client.email,
            error: messageText,
          });
        }
      }
    }

    const summary = {
      success: true,
      requestedCount: clientIds.length,
      matchedCount,
      sentCount,
      skippedCount: skipped.length,
      failedCount: failures.length,
      skipped,
      failures,
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});