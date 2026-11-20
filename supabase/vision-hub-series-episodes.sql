-- VISION HUB series seasons and episodes.
-- Episodes are catalog rows so existing private-media signing, watch progress and player quality code can be reused.
begin;

alter table public.vh_content
  add column if not exists parent_series_id bigint references public.vh_content(id) on delete cascade,
  add column if not exists season_number integer,
  add column if not exists episode_number integer;

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid='public.vh_content'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%content_type%'
  loop
    execute format('alter table public.vh_content drop constraint %I',c.conname);
  end loop;
end $$;

alter table public.vh_content
  add constraint vh_content_content_type_check
  check (content_type in ('Movie','Web Series','Documentary','Short','Episode'));

alter table public.vh_content
  drop constraint if exists vh_content_episode_metadata_check;
alter table public.vh_content
  add constraint vh_content_episode_metadata_check
  check (
    content_type <> 'Episode'
    or (parent_series_id is not null and season_number >= 1 and episode_number >= 1)
  );

create unique index if not exists vh_content_series_episode_unique
  on public.vh_content(parent_series_id,season_number,episode_number)
  where content_type='Episode';
create index if not exists vh_content_series_episode_order_idx
  on public.vh_content(parent_series_id,season_number,episode_number)
  where content_type='Episode';

commit;
