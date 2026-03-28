-- Add first-class video report support and sync video media entries.

set search_path = public, extensions;

alter table public.issues
  add column if not exists video_path text;

do $$
begin
  begin
    alter type public.issue_media_kind add value if not exists 'video';
  exception
    when duplicate_object then null;
  end;
end$$;

alter table public.issue_media
  drop constraint if exists issue_media_source_check;

alter table public.issue_media
  add constraint issue_media_source_check check (
    source in ('manual', 'issue_photo_path', 'issue_audio_path', 'issue_video_path')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reports',
  'reports',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'audio/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.sync_issue_media_from_issue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.photo_path is null then
    delete from public.issue_media
    where issue_id = new.id
      and source = 'issue_photo_path';
  else
    delete from public.issue_media
    where issue_id = new.id
      and source = 'issue_photo_path'
      and storage_path <> new.photo_path;

    insert into public.issue_media (
      issue_id,
      storage_path,
      kind,
      sort_order,
      source
    )
    values (
      new.id,
      new.photo_path,
      'photo',
      0,
      'issue_photo_path'
    )
    on conflict (issue_id, storage_path) do update
      set kind = excluded.kind,
          sort_order = excluded.sort_order,
          source = excluded.source;
  end if;

  if new.audio_path is null then
    delete from public.issue_media
    where issue_id = new.id
      and source = 'issue_audio_path';
  else
    delete from public.issue_media
    where issue_id = new.id
      and source = 'issue_audio_path'
      and storage_path <> new.audio_path;

    insert into public.issue_media (
      issue_id,
      storage_path,
      kind,
      sort_order,
      source
    )
    values (
      new.id,
      new.audio_path,
      'voice',
      1,
      'issue_audio_path'
    )
    on conflict (issue_id, storage_path) do update
      set kind = excluded.kind,
          sort_order = excluded.sort_order,
          source = excluded.source;
  end if;

  if new.video_path is null then
    delete from public.issue_media
    where issue_id = new.id
      and source = 'issue_video_path';
  else
    delete from public.issue_media
    where issue_id = new.id
      and source = 'issue_video_path'
      and storage_path <> new.video_path;

    insert into public.issue_media (
      issue_id,
      storage_path,
      kind,
      sort_order,
      source
    )
    values (
      new.id,
      new.video_path,
      'video',
      2,
      'issue_video_path'
    )
    on conflict (issue_id, storage_path) do update
      set kind = excluded.kind,
          sort_order = excluded.sort_order,
          source = excluded.source;
  end if;

  return new;
end;
$$;

drop trigger if exists issues_sync_media_from_paths on public.issues;
create trigger issues_sync_media_from_paths
  after insert or update of photo_path, audio_path, video_path on public.issues
  for each row execute procedure public.sync_issue_media_from_issue();

insert into public.issue_media (
  issue_id,
  storage_path,
  kind,
  sort_order,
  source
)
select
  i.id,
  i.video_path,
  'video',
  2,
  'issue_video_path'
from public.issues i
where i.video_path is not null
on conflict (issue_id, storage_path) do update
set
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  source = excluded.source;
