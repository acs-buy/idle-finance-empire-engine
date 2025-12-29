alter table public.analytics_events
  add column if not exists ts bigint;

alter table public.analytics_events
  add column if not exists event text;

alter table public.analytics_events
  add column if not exists referrer text;

alter table public.analytics_events
  add column if not exists utm_source text;

alter table public.analytics_events
  add column if not exists utm_medium text;

alter table public.analytics_events
  add column if not exists utm_campaign text;

alter table public.analytics_events
  add column if not exists utm_term text;

alter table public.analytics_events
  add column if not exists utm_content text;

alter table public.analytics_events
  add column if not exists device_type text not null default 'desktop';

alter table public.analytics_events
  add column if not exists country text;

alter table public.analytics_events
  add column if not exists build_version text;

alter table public.analytics_events
  add column if not exists payload jsonb;

update public.analytics_events
  set event = event_name
  where event is null;

update public.analytics_events
  set ts = (extract(epoch from created_at) * 1000)::bigint
  where ts is null;

alter table public.analytics_events
  alter column event set not null;

alter table public.analytics_events
  alter column ts set not null;

create index if not exists idx_analytics_events_event_ts
  on public.analytics_events (event, ts desc);

create index if not exists idx_analytics_events_anonymous_ts
  on public.analytics_events (anonymous_id, ts desc);

create index if not exists idx_analytics_events_user_ts
  on public.analytics_events (user_id, ts desc);

alter table public.revenue_events
  add column if not exists id uuid default gen_random_uuid();

alter table public.revenue_events
  add column if not exists ts bigint;

alter table public.revenue_events
  add column if not exists stripe_type text;

alter table public.revenue_events
  add column if not exists product_id text;

alter table public.revenue_events
  add column if not exists customer_id text;

alter table public.revenue_events
  add column if not exists subscription_id text;

alter table public.revenue_events
  add column if not exists raw jsonb default '{}'::jsonb;

alter table public.revenue_events
  alter column amount type numeric using amount::numeric;

update public.revenue_events
  set stripe_type = event_type
  where stripe_type is null;

update public.revenue_events
  set ts = (extract(epoch from occurred_at) * 1000)::bigint
  where ts is null;

update public.revenue_events
  set customer_id = stripe_customer_id
  where customer_id is null;

update public.revenue_events
  set subscription_id = stripe_subscription_id
  where subscription_id is null;

update public.revenue_events
  set raw = coalesce(raw, metadata, '{}'::jsonb);

alter table public.revenue_events
  alter column stripe_type set not null;

alter table public.revenue_events
  alter column ts set not null;

alter table public.revenue_events
  alter column raw set not null;

create index if not exists idx_revenue_events_ts
  on public.revenue_events (ts desc);

create index if not exists idx_revenue_events_anonymous_ts
  on public.revenue_events (anonymous_id, ts desc);

create index if not exists idx_revenue_events_user_ts
  on public.revenue_events (user_id, ts desc);
