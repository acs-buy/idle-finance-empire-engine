create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  anonymous_id text not null,
  user_id uuid null,
  utm jsonb null,
  props jsonb null,
  path text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_event_name
  on public.analytics_events(event_name);
create index if not exists idx_analytics_events_created_at
  on public.analytics_events(created_at);

alter table public.analytics_events enable row level security;

create table if not exists public.revenue_events (
  stripe_event_id text primary key,
  event_type text not null,
  amount integer null,
  currency text null,
  anonymous_id text null,
  user_id uuid null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  metadata jsonb null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_revenue_events_occurred_at
  on public.revenue_events(occurred_at);

alter table public.revenue_events enable row level security;
