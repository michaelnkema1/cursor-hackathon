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
