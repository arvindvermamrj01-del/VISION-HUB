-- Vision Hub starter schema for Supabase
-- Run this once in Supabase Dashboard -> SQL Editor.
-- Never put a service_role key in browser code.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  fullname text,
  role text not null default 'user' check (role in ('user','admin','sub_admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, fullname, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'fullname', ''),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','sub_admin')
  );
$$;

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content_type text not null default 'Movie',
  genre text,
  language text,
  release_year integer,
  rating numeric(3,1),
  poster_url text,
  trailer_url text,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.content(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);

create table if not exists public.movie_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content_type text not null default 'Movie',
  release_year integer,
  language text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','completed')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.content enable row level security;
alter table public.watchlist enable row level security;
alter table public.movie_requests enable row level security;

drop policy if exists "Users read own profile or admins read all" on public.profiles;
create policy "Users read own profile or admins read all"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Users create own basic profile" on public.profiles;
create policy "Users create own basic profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'user');

drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles"
on public.profiles for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Anyone can read published content" on public.content;
create policy "Anyone can read published content"
on public.content for select to anon, authenticated
using (true);

drop policy if exists "Admins manage content" on public.content;
create policy "Admins manage content"
on public.content for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Users manage their own watchlist" on public.watchlist;
create policy "Users manage their own watchlist"
on public.watchlist for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users create and read own requests" on public.movie_requests;
create policy "Users create and read own requests"
on public.movie_requests for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users submit own requests" on public.movie_requests;
create policy "Users submit own requests"
on public.movie_requests for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Admins review requests" on public.movie_requests;
create policy "Admins review requests"
on public.movie_requests for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant usage on schema public to anon, authenticated;
grant select on public.content to anon, authenticated;
grant all on public.profiles, public.content, public.watchlist, public.movie_requests to authenticated;
