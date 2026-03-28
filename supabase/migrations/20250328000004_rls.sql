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
