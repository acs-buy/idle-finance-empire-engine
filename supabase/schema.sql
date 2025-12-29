-- supabase/schema.sql (V1)
-- Minimal schema for cloud save + entitlements + email opt-in + leaderboards

create table if not exists public.player_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null, -- supabase auth user id, optional in early phase
  anonymous_id text not null,
  save_version int not null,
  save_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_saves_anonymous_id on public.player_saves(anonymous_id);
create index if not exists idx_player_saves_user_id on public.player_saves(user_id);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  anonymous_id text not null,
  vip_until timestamptz null,
  offline_boost_until timestamptz null,
  auto_invest_manager boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_entitlements_anonymous_id on public.entitlements(anonymous_id);
create index if not exists idx_entitlements_user_id on public.entitlements(user_id);

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  anonymous_id text not null,
  display_name text null,
  net_worth numeric not null,
  prestige_points int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_leaderboard_net_worth on public.leaderboard_entries(net_worth desc);

create table if not exists public.email_optins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null, -- landing | play_modal
  anonymous_id text not null,
  utm jsonb null,
  referrer text null,
  created_at timestamptz not null default now(),
  unique (email)
);
