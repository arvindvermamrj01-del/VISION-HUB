-- Vision Hub staff role permissions migration for an existing Supabase project.
-- Run as project owner in Supabase SQL Editor before deploying the staff UI.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('user','admin','sub_admin','content_editor','moderator'));
create or replace function public.vh_is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'); $$;
create or replace function public.vh_can_manage_content()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','sub_admin','content_editor')); $$;
create or replace function public.vh_can_manage_requests()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','sub_admin','moderator')); $$;
create or replace function public.vh_can_manage_catalog()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','sub_admin')); $$;
revoke all on function public.vh_is_admin() from public;
revoke all on function public.vh_can_manage_content() from public;
revoke all on function public.vh_can_manage_requests() from public;
revoke all on function public.vh_can_manage_catalog() from public;
grant execute on function public.vh_is_admin() to authenticated;
grant execute on function public.vh_can_manage_content() to authenticated;
grant execute on function public.vh_can_manage_requests() to authenticated;
grant execute on function public.vh_can_manage_catalog() to authenticated;
drop policy if exists "admins manage content" on public.vh_content;
drop policy if exists "staff manage content" on public.vh_content;
create policy "staff manage content" on public.vh_content for all to authenticated using(public.vh_can_manage_content()) with check(public.vh_can_manage_content());
drop policy if exists "admins manage requests" on public.vh_requests;
drop policy if exists "staff manage requests" on public.vh_requests;
create policy "staff manage requests" on public.vh_requests for all to authenticated using(public.vh_can_manage_requests()) with check(public.vh_can_manage_requests());
drop policy if exists "admins manage categories" on public.vh_categories;
drop policy if exists "catalog staff manage categories" on public.vh_categories;
create policy "catalog staff manage categories" on public.vh_categories for all to authenticated using(public.vh_can_manage_catalog()) with check(public.vh_can_manage_catalog());
drop policy if exists "admins manage songs" on public.vh_songs;
drop policy if exists "catalog staff manage songs" on public.vh_songs;
create policy "catalog staff manage songs" on public.vh_songs for all to authenticated using(public.vh_can_manage_catalog()) with check(public.vh_can_manage_catalog());
drop policy if exists "admins upload private media" on storage.objects;
create policy "admins upload private media" on storage.objects for insert to authenticated
with check(bucket_id='vh-private-media' and (storage.foldername(name))[1]=auth.uid()::text and public.vh_can_manage_content());
drop policy if exists "admins delete private media" on storage.objects;
create policy "admins delete private media" on storage.objects for delete to authenticated
using(bucket_id='vh-private-media' and public.vh_can_manage_content());
