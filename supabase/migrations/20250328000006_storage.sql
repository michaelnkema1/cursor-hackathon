-- Storage bucket used by the backend upload signing endpoints.

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
    'audio/wav'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy reports_objects_insert_own_prefix
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'reports'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy reports_objects_update_own_prefix
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'reports'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'reports'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy reports_objects_delete_own_prefix
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'reports'
    and split_part(name, '/', 1) = auth.uid()::text
  );
