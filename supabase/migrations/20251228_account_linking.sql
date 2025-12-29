create table if not exists public.player_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  anonymous_id text not null,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz null,
  unique (user_id, anonymous_id)
);

create index if not exists idx_player_links_user_id on public.player_links(user_id);
create index if not exists idx_player_links_anonymous_id on public.player_links(anonymous_id);

create table if not exists public.player_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  anonymous_id text not null,
  save_version int not null,
  save_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_saves_anonymous_id on public.player_saves(anonymous_id);
create index if not exists idx_player_saves_user_id on public.player_saves(user_id);
