create unique index if not exists uniq_player_saves_user_id
  on public.player_saves(user_id)
  where user_id is not null;

create unique index if not exists uniq_player_saves_anonymous_id
  on public.player_saves(anonymous_id)
  where user_id is null;
