create table if not exists public.client_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  channel text not null check (channel in ('web', 'mobile')),
  platform text not null check (platform in ('web', 'ios', 'android')),
  token text,
  subscription jsonb,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_push_subscriptions_content_check check (
    (token is not null and length(trim(token)) > 0)
    or subscription is not null
  )
);

create unique index if not exists uq_client_push_subscriptions_target
  on public.client_push_subscriptions (client_account_id, channel, platform);

create index if not exists idx_client_push_subscriptions_client_account
  on public.client_push_subscriptions (client_account_id);

create index if not exists idx_client_push_subscriptions_enabled_target
  on public.client_push_subscriptions (enabled, channel, platform);

alter table public.client_push_subscriptions enable row level security;

drop policy if exists "Admins can manage push subscriptions" on public.client_push_subscriptions;
create policy "Admins can manage push subscriptions"
on public.client_push_subscriptions
for all
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Clients can manage own push subscriptions" on public.client_push_subscriptions;
create policy "Clients can manage own push subscriptions"
on public.client_push_subscriptions
for all
using (
  exists (
    select 1
    from public.client_accounts client_accounts
    where client_accounts.id = client_account_id
      and client_accounts.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.client_accounts client_accounts
    where client_accounts.id = client_account_id
      and client_accounts.auth_user_id = auth.uid()
  )
);

insert into public.client_push_subscriptions (
  client_account_id,
  channel,
  platform,
  token,
  subscription,
  enabled,
  last_seen_at
)
select
  client_accounts.id,
  case
    when client_accounts.push_subscription ? 'endpoint' then 'web'
    else 'mobile'
  end as channel,
  case
    when client_accounts.push_subscription ? 'endpoint' then 'web'
    when lower(coalesce(client_accounts.push_subscription->>'platform', '')) in ('ios', 'android')
      then lower(client_accounts.push_subscription->>'platform')
    else 'android'
  end as platform,
  nullif(trim(coalesce(
    client_accounts.push_subscription->>'token',
    client_accounts.push_subscription->>'fcmToken',
    client_accounts.push_subscription->>'fcm_token',
    client_accounts.push_subscription->>'registrationToken',
    client_accounts.push_subscription->>'registration_token',
    client_accounts.push_subscription->>'pushToken',
    client_accounts.push_subscription->>'push_token'
  )), '') as token,
  case
    when client_accounts.push_subscription ? 'endpoint' then client_accounts.push_subscription
    else null
  end as subscription,
  coalesce((client_accounts.notification_preferences->>'push')::boolean, true) as enabled,
  coalesce(client_accounts.updated_at, now()) as last_seen_at
from public.client_accounts
where client_accounts.push_subscription is not null
on conflict (client_account_id, channel, platform) do update
set
  token = excluded.token,
  subscription = excluded.subscription,
  enabled = excluded.enabled,
  last_seen_at = excluded.last_seen_at,
  updated_at = now();