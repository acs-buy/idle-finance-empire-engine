alter table public.leaderboard
  add column if not exists income_value numeric,
  add column if not exists income_unit text;

alter table public.leaderboard_entries
  add column if not exists income_value numeric,
  add column if not exists income_unit text;
