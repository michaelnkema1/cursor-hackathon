# Database Setup

This Supabase project now includes:

- core backend tables: `profiles`, `issues`, `issue_events`, `organizations`, `routing_rules`
- operational tables: `issue_media`, `issue_status_events`, `issue_duplicate_suggestions`, `push_subscriptions`
- helper views/functions: `issues_map`, `issue_timeline`, `issues_nearby`, `issues_within_radius_m`
- storage bucket: `reports`
- admin helper functions: `set_profile_role`, `set_profile_role_by_email`
- starter organizations and routing rules

## Apply the database

From the repo root:

```powershell
cd C:\Users\ednaa\cursor-hackathon\repo-upstream
supabase link --project-ref <your-project-ref>
supabase db push
```

If you prefer the Supabase SQL editor, apply the migration files in order from [`supabase/migrations`](C:/Users/ednaa/cursor-hackathon/repo-upstream/supabase/migrations).

## Bootstrap an admin

After the user has signed up through Supabase Auth, run this in SQL editor:

```sql
select public.set_profile_role_by_email(
  'admin@example.com',
  'admin',
  null
);
```

To assign an authority user to an organization:

```sql
select public.set_profile_role_by_email(
  'authority@example.com',
  'authority',
  'accra-metro'
);
```

## Useful checks

```sql
select slug, name, kind from public.organizations order by name;
select category, organization_id from public.routing_rules order by category;
select * from public.issues_map limit 20;
select * from public.issue_timeline order by occurred_at desc limit 20;
```
