# Send Custom Push Notification

Sends a custom push notification to selected clients from the admin UI.

## Supported targets

- `web`
- `mobile`
- `both`

## Local development

Run the function locally with Supabase CLI:

```bash
supabase functions serve send-custom-push-notification
```

## Deploy

Deploy it without JWT verification at the platform level:

```bash
supabase functions deploy send-custom-push-notification --no-verify-jwt
```

## Required environment variables

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY` or `WEB_PUSH_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY` or `WEB_PUSH_VAPID_PRIVATE_KEY`
- `FIREBASE_SERVER_KEY` or `FCM_SERVER_KEY`