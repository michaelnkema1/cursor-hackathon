-- FixGhana backend prerequisites.
-- Supabase applies migrations in filename order.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
