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
