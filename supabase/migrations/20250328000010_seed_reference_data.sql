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
