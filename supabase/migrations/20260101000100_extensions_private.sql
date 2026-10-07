-- Extensions
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Private schema: helpers and internal functions that clients must not call directly.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;            -- needed so RLS policies can call helpers
alter default privileges in schema private revoke execute on functions from public;
-- later (T1.11): grant execute on ONLY the RLS helper functions to authenticated
