-- BEGIN 20250328000001_extensions.sql
-- FixGhana backend prerequisites.
-- Supabase applies migrations in filename order.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

-- END 20250328000001_extensions.sql

-- BEGIN 20250328000002_schema.sql
-- Core schema for the backend API contract in backend/app/db_contract.py.

set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('citizen', 'authority', 'admin');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'issue_status') then
    create type public.issue_status as enum ('open', 'in_progress', 'resolved');
  end if;
end$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind text not null default 'local_authority',
  region text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_kind_idx on public.organizations (kind);
create index organizations_region_idx on public.organizations (region);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role public.user_role not null default 'citizen',
  organization_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_authority_requires_organization check (
    (role <> 'authority'::public.user_role) or (organization_id is not null)
  )
);

create index profiles_role_idx on public.profiles (role);
create index profiles_organization_id_idx on public.profiles (organization_id);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete restrict,
  status public.issue_status not null default 'open',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location geography(Point, 4326) not null,
  description text,
  voice_transcript text,
  photo_path text,
  audio_path text,
  ai_category text,
  ai_severity smallint check (ai_severity is null or (ai_severity between 1 and 5)),
  ai_summary text,
  routed_organization_id uuid references public.organizations (id) on delete set null,
  structured_report jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index issues_reporter_id_idx on public.issues (reporter_id);
create index issues_status_idx on public.issues (status);
create index issues_created_at_idx on public.issues (created_at desc);
create index issues_routed_organization_id_idx on public.issues (routed_organization_id);
create index issues_location_gix on public.issues using gist (location);

create table public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index issue_events_issue_id_idx on public.issue_events (issue_id, created_at desc);

create table public.routing_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index routing_rules_organization_id_idx on public.routing_rules (organization_id);

create or replace function public.issues_nearby(
  lat double precision,
  lng double precision,
  radius_m double precision,
  status_filter text default null,
  max_count int default 100
)
returns setof public.issues
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select i.*
  from public.issues i
  where st_dwithin(
    i.location,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography,
    radius_m
  )
    and (
      status_filter is null
      or i.status::text = status_filter
    )
  order by i.created_at desc
  limit greatest(1, least(max_count, 500));
$$;

-- END 20250328000002_schema.sql

-- BEGIN 20250328000003_triggers.sql
-- updated_at handling, profile bootstrap, and geographic sync for issues.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute procedure public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger issues_set_updated_at
  before update on public.issues
  for each row execute procedure public.set_updated_at();

create or replace function public.sync_issue_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.location =
    st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  return new;
end;
$$;

create trigger issues_sync_location
  before insert or update of lat, lng on public.issues
  for each row execute procedure public.sync_issue_location();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    'citizen'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.enforce_profile_guardrails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  into is_admin;

  if is_admin then
    return new;
  end if;

  if old.role is distinct from new.role
     or old.organization_id is distinct from new.organization_id then
    raise exception 'Only admins can change role or organization assignment';
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_guardrails
  before update on public.profiles
  for each row execute procedure public.enforce_profile_guardrails();

-- END 20250328000003_triggers.sql

-- BEGIN 20250328000004_rls.sql
-- Row level security for direct Supabase access.
-- The Python API uses the service-role key, but these policies keep direct client access constrained.

create or replace function public.jwt_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.jwt_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = auth.uid();
$$;

grant execute on function public.jwt_role() to authenticated;
grant execute on function public.jwt_org_id() to authenticated;
grant execute on function public.issues_nearby(
  double precision,
  double precision,
  double precision,
  text,
  int
) to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.issues enable row level security;
alter table public.issue_events enable row level security;
alter table public.routing_rules enable row level security;

create policy organizations_select_public
  on public.organizations
  for select
  to anon, authenticated
  using (true);

create policy organizations_write_service
  on public.organizations
  for all
  to service_role
  using (true)
  with check (true);

create policy organizations_update_admin
  on public.organizations
  for update
  to authenticated
  using (public.jwt_role() = 'admin')
  with check (true);

create policy profiles_select_own_or_staff
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.jwt_role() = 'admin'
    or (
      public.jwt_role() = 'authority'
      and organization_id = public.jwt_org_id()
    )
  );

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_admin
  on public.profiles
  for update
  to authenticated
  using (public.jwt_role() = 'admin')
  with check (true);

create policy profiles_write_service
  on public.profiles
  for all
  to service_role
  using (true)
  with check (true);

create policy issues_select_related
  on public.issues
  for select
  to authenticated
  using (
    reporter_id = auth.uid()
    or public.jwt_role() = 'admin'
    or (
      public.jwt_role() = 'authority'
      and routed_organization_id = public.jwt_org_id()
    )
  );

create policy issues_insert_reporter
  on public.issues
  for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
  );

create policy issues_update_authority
  on public.issues
  for update
  to authenticated
  using (
    public.jwt_role() = 'authority'
    and routed_organization_id = public.jwt_org_id()
  )
  with check (
    public.jwt_role() = 'authority'
    and routed_organization_id = public.jwt_org_id()
  );

create policy issues_update_admin
  on public.issues
  for update
  to authenticated
  using (public.jwt_role() = 'admin')
  with check (true);

create policy issues_write_service
  on public.issues
  for all
  to service_role
  using (true)
  with check (true);

create policy issue_events_select_related
  on public.issue_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.issues i
      where i.id = issue_id
        and (
          i.reporter_id = auth.uid()
          or public.jwt_role() = 'admin'
          or (
            public.jwt_role() = 'authority'
            and i.routed_organization_id = public.jwt_org_id()
          )
        )
    )
  );

create policy issue_events_write_service
  on public.issue_events
  for all
  to service_role
  using (true)
  with check (true);

create policy routing_rules_select_authenticated
  on public.routing_rules
  for select
  to authenticated
  using (true);

create policy routing_rules_write_service
  on public.routing_rules
  for all
  to service_role
  using (true)
  with check (true);

create policy routing_rules_update_admin
  on public.routing_rules
  for update
  to authenticated
  using (public.jwt_role() = 'admin')
  with check (true);

grant usage on schema public to anon, authenticated, service_role;

grant select on table public.organizations to anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;

grant select, insert, update on table public.issues to authenticated;

grant select on table public.issue_events to authenticated;

grant select on table public.routing_rules to authenticated;

grant select, insert, update, delete on table public.organizations to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.issues to service_role;
grant select, insert, update, delete on table public.issue_events to service_role;
grant select, insert, update, delete on table public.routing_rules to service_role;

-- END 20250328000004_rls.sql

-- BEGIN 20250328000005_realtime.sql
-- Broadcast key backend tables over Supabase Realtime.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'issues'
  ) then
    alter publication supabase_realtime add table public.issues;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'issue_events'
  ) then
    alter publication supabase_realtime add table public.issue_events;
  end if;
end$$;

-- END 20250328000005_realtime.sql

-- BEGIN 20250328000006_storage.sql
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

-- END 20250328000006_storage.sql

-- BEGIN 20250328000007_operational_schema.sql
-- Expand the minimal backend contract into a fuller operational schema.

set search_path = public, extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'issue_media_kind') then
    create type public.issue_media_kind as enum ('photo', 'voice', 'other');
  end if;
end$$;

alter table public.organizations
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

alter table public.profiles
  add column if not exists phone text;

alter table public.issues
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists severity smallint,
  add column if not exists ai_model text,
  add column if not exists ai_raw jsonb,
  add column if not exists ai_confidence numeric(5, 4),
  add column if not exists duplicate_of_id uuid references public.issues (id) on delete set null,
  add column if not exists duplicate_score numeric(5, 4),
  add column if not exists is_likely_duplicate boolean not null default false,
  add column if not exists resolved_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_severity_range'
  ) then
    alter table public.issues
      add constraint issues_severity_range
      check (severity is null or (severity between 1 and 5));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_ai_confidence_range'
  ) then
    alter table public.issues
      add constraint issues_ai_confidence_range
      check (ai_confidence is null or (ai_confidence between 0 and 1));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_duplicate_score_range'
  ) then
    alter table public.issues
      add constraint issues_duplicate_score_range
      check (duplicate_score is null or (duplicate_score between 0 and 1));
  end if;
end$$;

create index if not exists issues_category_idx on public.issues (category);
create index if not exists issues_duplicate_of_id_idx
  on public.issues (duplicate_of_id)
  where duplicate_of_id is not null;
create index if not exists issues_likely_duplicate_idx
  on public.issues (is_likely_duplicate)
  where is_likely_duplicate;
create index if not exists issue_events_payload_gin
  on public.issue_events
  using gin (payload);

create table if not exists public.issue_media (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  storage_path text not null,
  kind public.issue_media_kind not null default 'photo',
  mime_type text,
  bytes bigint,
  sort_order int not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (issue_id, storage_path),
  constraint issue_media_source_check check (
    source in ('manual', 'issue_photo_path', 'issue_audio_path')
  )
);

create index if not exists issue_media_issue_id_idx
  on public.issue_media (issue_id, sort_order, created_at);
create unique index if not exists issue_media_source_unique_idx
  on public.issue_media (issue_id, source)
  where source <> 'manual';

create table if not exists public.issue_status_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  old_status public.issue_status,
  new_status public.issue_status not null,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists issue_status_events_issue_id_idx
  on public.issue_status_events (issue_id, created_at desc);

create table if not exists public.issue_duplicate_suggestions (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  candidate_issue_id uuid not null references public.issues (id) on delete cascade,
  score numeric(5, 4) not null,
  source text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (issue_id, candidate_issue_id),
  constraint issue_duplicate_suggestions_no_self check (issue_id <> candidate_issue_id),
  constraint issue_duplicate_suggestions_score_range check (score between 0 and 1)
);

create index if not exists issue_duplicate_suggestions_issue_id_idx
  on public.issue_duplicate_suggestions (issue_id, created_at desc)
  where not dismissed;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id, created_at desc);

create or replace view public.issues_map as
select
  i.id,
  i.status,
  coalesce(i.category, i.ai_category) as category,
  i.subcategory,
  coalesce(i.severity, i.ai_severity) as severity,
  i.routed_organization_id as organization_id,
  i.title,
  i.created_at,
  i.updated_at,
  i.is_likely_duplicate,
  i.duplicate_of_id,
  st_y(i.location::geometry) as latitude,
  st_x(i.location::geometry) as longitude
from public.issues i
where i.duplicate_of_id is null;

create or replace view public.issue_timeline as
select
  e.issue_id,
  e.created_at as occurred_at,
  'event'::text as source,
  e.event_type as action,
  e.actor_id,
  e.payload
from public.issue_events e
union all
select
  s.issue_id,
  s.created_at as occurred_at,
  'status'::text as source,
  'status_changed'::text as action,
  s.changed_by as actor_id,
  jsonb_build_object(
    'old_status', s.old_status,
    'new_status', s.new_status,
    'note', s.note
  ) as payload
from public.issue_status_events s;

create or replace function public.issues_within_radius_m(
  lat double precision,
  lng double precision,
  radius_m double precision
)
returns setof public.issues
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select i.*
  from public.issues i
  where
    i.duplicate_of_id is null
    and i.status in ('open', 'in_progress')
    and st_dwithin(
      i.location,
      st_setsrid(st_makepoint(lng, lat), 4326)::geography,
      radius_m
    )
  order by i.created_at desc;
$$;

create or replace function public.issues_nearby(
  lat double precision,
  lng double precision,
  radius_m double precision,
  status_filter text default null,
  max_count int default 100
)
returns setof public.issues
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select i.*
  from public.issues i
  where
    i.duplicate_of_id is null
    and st_dwithin(
      i.location,
      st_setsrid(st_makepoint(lng, lat), 4326)::geography,
      radius_m
    )
    and (
      status_filter is null
      or i.status::text = status_filter
    )
  order by i.created_at desc
  limit greatest(1, least(max_count, 500));
$$;

-- END 20250328000007_operational_schema.sql

-- BEGIN 20250328000008_operational_automation.sql
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

-- END 20250328000008_operational_automation.sql

-- BEGIN 20250328000009_operational_access.sql
-- RLS, grants, and realtime for the additional operational objects.

set search_path = public, extensions;

grant execute on function public.issues_within_radius_m(double precision, double precision, double precision)
  to authenticated, service_role;

alter table public.issue_media enable row level security;
alter table public.issue_status_events enable row level security;
alter table public.issue_duplicate_suggestions enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists issue_media_select_related on public.issue_media;
create policy issue_media_select_related
  on public.issue_media
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.issues i
      where i.id = issue_id
        and (
          i.reporter_id = auth.uid()
          or public.jwt_role() = 'admin'
          or (
            public.jwt_role() = 'authority'
            and i.routed_organization_id = public.jwt_org_id()
          )
        )
    )
  );

drop policy if exists issue_media_insert_related on public.issue_media;
create policy issue_media_insert_related
  on public.issue_media
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.issues i
      where i.id = issue_id
        and (
          i.reporter_id = auth.uid()
          or public.jwt_role() = 'admin'
          or (
            public.jwt_role() = 'authority'
            and i.routed_organization_id = public.jwt_org_id()
          )
        )
    )
  );

drop policy if exists issue_media_update_related on public.issue_media;
create policy issue_media_update_related
  on public.issue_media
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.issues i
      where i.id = issue_id
        and (
          i.reporter_id = auth.uid()
          or public.jwt_role() = 'admin'
          or (
            public.jwt_role() = 'authority'
            and i.routed_organization_id = public.jwt_org_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.issues i
      where i.id = issue_id
        and (
          i.reporter_id = auth.uid()
          or public.jwt_role() = 'admin'
          or (
            public.jwt_role() = 'authority'
            and i.routed_organization_id = public.jwt_org_id()
          )
        )
    )
  );

drop policy if exists issue_media_delete_related on public.issue_media;
create policy issue_media_delete_related
  on public.issue_media
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.issues i
      where i.id = issue_id
        and (
          i.reporter_id = auth.uid()
          or public.jwt_role() = 'admin'
          or (
            public.jwt_role() = 'authority'
            and i.routed_organization_id = public.jwt_org_id()
          )
        )
    )
  );

drop policy if exists issue_media_write_service on public.issue_media;
create policy issue_media_write_service
  on public.issue_media
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists issue_status_events_select_related on public.issue_status_events;
create policy issue_status_events_select_related
  on public.issue_status_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.issues i
      where i.id = issue_id
        and (
          i.reporter_id = auth.uid()
          or public.jwt_role() = 'admin'
          or (
            public.jwt_role() = 'authority'
            and i.routed_organization_id = public.jwt_org_id()
          )
        )
    )
  );

drop policy if exists issue_status_events_write_service on public.issue_status_events;
create policy issue_status_events_write_service
  on public.issue_status_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists issue_duplicate_suggestions_select_related on public.issue_duplicate_suggestions;
create policy issue_duplicate_suggestions_select_related
  on public.issue_duplicate_suggestions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.issues i
      where i.id = issue_id
        and (
          i.reporter_id = auth.uid()
          or public.jwt_role() = 'admin'
          or (
            public.jwt_role() = 'authority'
            and i.routed_organization_id = public.jwt_org_id()
          )
        )
    )
  );

drop policy if exists issue_duplicate_suggestions_write_service on public.issue_duplicate_suggestions;
create policy issue_duplicate_suggestions_write_service
  on public.issue_duplicate_suggestions
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own
  on public.push_subscriptions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_write_service on public.push_subscriptions;
create policy push_subscriptions_write_service
  on public.push_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update, delete on table public.issue_media to authenticated;
grant select on table public.issue_status_events to authenticated;
grant select on table public.issue_duplicate_suggestions to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

grant select, insert, update, delete on table public.issue_media to service_role;
grant select, insert, update, delete on table public.issue_status_events to service_role;
grant select, insert, update, delete on table public.issue_duplicate_suggestions to service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

grant select on table public.issues_map to authenticated;
grant select on table public.issue_timeline to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'issue_status_events'
  ) then
    alter publication supabase_realtime add table public.issue_status_events;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'issue_media'
  ) then
    alter publication supabase_realtime add table public.issue_media;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'issue_duplicate_suggestions'
  ) then
    alter publication supabase_realtime add table public.issue_duplicate_suggestions;
  end if;
end$$;

-- END 20250328000009_operational_access.sql

-- BEGIN 20250328000010_seed_reference_data.sql
-- Seed enough reference data to make routing and admin setup usable immediately.

insert into public.organizations (
  slug,
  name,
  kind,
  region,
  contact_email,
  metadata
)
values
  (
    'accra-metro',
    'Accra Metropolitan Assembly',
    'local_authority',
    'Greater Accra',
    'ama@example.gov.gh',
    '{"coverage":["sanitation","drainage","community roads"]}'::jsonb
  ),
  (
    'urban-roads',
    'Department of Urban Roads',
    'national_agency',
    'Greater Accra',
    'roads@example.gov.gh',
    '{"coverage":["roads","potholes","traffic markings"]}'::jsonb
  ),
  (
    'ecg',
    'Electricity Company of Ghana',
    'utility',
    'Greater Accra',
    'ecg@example.com',
    '{"coverage":["power","streetlights","transformers"]}'::jsonb
  ),
  (
    'ghana-water',
    'Ghana Water Limited',
    'utility',
    'Greater Accra',
    'gwl@example.com',
    '{"coverage":["water","sewer","pipe leaks"]}'::jsonb
  ),
  (
    'nadmo',
    'National Disaster Management Organisation',
    'national_agency',
    'National',
    'nadmo@example.gov.gh',
    '{"coverage":["flooding","disaster response"]}'::jsonb
  )
on conflict (slug) do update
set
  name = excluded.name,
  kind = excluded.kind,
  region = excluded.region,
  contact_email = excluded.contact_email,
  metadata = excluded.metadata;

insert into public.routing_rules (category, organization_id)
select
  seed.category,
  org.id
from (
  values
    ('road', 'urban-roads'),
    ('pothole', 'urban-roads'),
    ('drainage', 'accra-metro'),
    ('sanitation', 'accra-metro'),
    ('waste', 'accra-metro'),
    ('electricity', 'ecg'),
    ('streetlight', 'ecg'),
    ('water', 'ghana-water'),
    ('sewer', 'ghana-water'),
    ('flooding', 'nadmo')
) as seed(category, organization_slug)
join public.organizations org
  on org.slug = seed.organization_slug
on conflict (category) do update
set organization_id = excluded.organization_id;

-- END 20250328000010_seed_reference_data.sql

