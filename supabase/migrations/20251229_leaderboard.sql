create table if not exists public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  anonymous_id text not null,
  metric text not null,
  score numeric not null,
  meta jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (metric, anonymous_id)
);

create index if not exists idx_leaderboard_scores_metric_score
  on public.leaderboard_scores(metric, score desc);
