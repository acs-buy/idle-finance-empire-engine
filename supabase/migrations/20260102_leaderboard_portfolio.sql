alter table public.leaderboard
  add column if not exists portfolio jsonb;

alter table public.leaderboard_entries
  add column if not exists portfolio jsonb;
