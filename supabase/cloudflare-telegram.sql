-- Run after supabase/setup.sql.
-- Telegram users explicitly opt in by sending /start to your bot; /stop disables notifications.
create table if not exists public.telegram_subscribers (
  chat_id text primary key,
  username text,
  first_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.telegram_subscribers enable row level security;
revoke all on public.telegram_subscribers from anon, authenticated;
-- Only Cloudflare Pages Functions using the Supabase service-role key may access this table.
