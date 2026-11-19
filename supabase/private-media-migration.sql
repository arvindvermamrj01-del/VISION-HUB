-- Vision Hub private media migration (existing Supabase projects)
-- Run in Supabase SQL Editor as project owner before deploying code that uploads to vh-private-media.
-- Existing public vh-media objects are intentionally left untouched for compatibility.
-- Run sub-admin-role-migration.sql first so vh_can_manage_content_item() exists.

alter table public.vh_content add column if not exists storage_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('vh-private-media','vh-private-media',false,1073741824,array[
 'video/mp4','video/webm','video/quicktime','video/x-m4v',
 'audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','text/vtt'
])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "published private media signed read" on storage.objects;
create policy "published private media signed read" on storage.objects for select to anon, authenticated
using (
  bucket_id='vh-private-media' and (
    public.vh_is_admin()
    or exists(select 1 from public.vh_content c where c.storage_path=storage.objects.name and c.published=true)
    or exists(select 1 from public.vh_media_assets a join public.vh_content c on c.id=a.content_id
              where a.storage_path=storage.objects.name and a.storage_provider='supabase' and c.published=true)
  )
);

drop policy if exists "admins upload private media" on storage.objects;
create policy "admins upload private media" on storage.objects for insert to authenticated
with check (bucket_id='vh-private-media' and (storage.foldername(name))[1]=auth.uid()::text and public.vh_is_admin());

drop policy if exists "admins delete private media" on storage.objects;
drop policy if exists "staff delete linked private media" on storage.objects;
create policy "staff delete linked private media" on storage.objects for delete to authenticated
using (
  bucket_id='vh-private-media' and (
    public.vh_is_admin()
    or exists(select 1 from public.vh_content c
              where c.storage_path=storage.objects.name
              and public.vh_can_manage_content_item(c.content_type))
    or exists(select 1 from public.vh_media_assets a join public.vh_content c on c.id=a.content_id
              where a.storage_path=storage.objects.name
              and a.storage_provider='supabase'
              and public.vh_can_manage_content_item(c.content_type))
  )
);
