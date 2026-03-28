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
