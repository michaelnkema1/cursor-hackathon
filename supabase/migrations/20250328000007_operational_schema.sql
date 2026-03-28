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
