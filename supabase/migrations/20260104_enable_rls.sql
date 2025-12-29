-- Enable RLS for security advisor warnings.
-- Service role bypasses RLS, and we don't expose client-side access.

alter table public.player_links enable row level security;
alter table public.player_saves enable row level security;
alter table public.entitlements enable row level security;
alter table public.email_optins enable row level security;
