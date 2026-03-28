-- Keep audit/status/media metadata consistent inside the database.

set search_path = public, extensions;

create or replace function public.log_issue_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (old.status is distinct from new.status) then
    insert into public.issue_status_events (
      issue_id,
      old_status,
      new_status,
      changed_by
    )
    values (
      new.id,
      old.status,
      new.status,
      auth.uid()
    );

    if new.status = 'resolved' and new.resolved_at is null then
      new.resolved_at = now();
    elsif new.status <> 'resolved' then
      new.resolved_at = null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists issues_log_status_change on public.issues;
create trigger issues_log_status_change
  before update on public.issues
  for each row execute procedure public.log_issue_status_change();

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

  return new;
end;
$$;

drop trigger if exists issues_sync_media_from_paths on public.issues;
create trigger issues_sync_media_from_paths
  after insert or update of photo_path, audio_path on public.issues
  for each row execute procedure public.sync_issue_media_from_issue();

create or replace function public.set_profile_role(
  target_user_id uuid,
  new_role public.user_role,
  new_organization_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated_row public.profiles;
begin
  if new_role = 'authority' and new_organization_id is null then
    raise exception 'authority role requires organization_id';
  end if;

  if new_role <> 'authority' then
    new_organization_id := null;
  end if;

  update public.profiles
  set
    role = new_role,
    organization_id = new_organization_id,
    updated_at = now()
  where id = target_user_id
  returning * into updated_row;

  if updated_row is null then
    raise exception 'Profile not found for user %', target_user_id;
  end if;

  return updated_row;
end;
$$;

create or replace function public.set_profile_role_by_email(
  target_email text,
  new_role public.user_role,
  new_organization_slug text default null
)
returns table (
  user_id uuid,
  email text,
  role public.user_role,
  organization_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
  target_org_id uuid;
  updated_profile public.profiles;
begin
  select u.id, u.email
  into user_id, email
  from auth.users u
  where lower(u.email) = lower(target_email)
  limit 1;

  if user_id is null then
    raise exception 'No auth user found for email %', target_email;
  end if;

  if new_organization_slug is not null then
    select o.id
    into target_org_id
    from public.organizations o
    where o.slug = new_organization_slug
    limit 1;

    if target_org_id is null then
      raise exception 'No organization found for slug %', new_organization_slug;
    end if;
  end if;

  updated_profile := public.set_profile_role(user_id, new_role, target_org_id);
  role := updated_profile.role;
  organization_id := updated_profile.organization_id;
  return next;
end;
$$;

grant execute on function public.set_profile_role(uuid, public.user_role, uuid)
  to service_role;
grant execute on function public.set_profile_role_by_email(text, public.user_role, text)
  to service_role;
