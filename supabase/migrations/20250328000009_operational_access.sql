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
