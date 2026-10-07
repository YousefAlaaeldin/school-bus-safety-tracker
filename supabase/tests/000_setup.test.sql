create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

create or replace function tests.authenticate_as(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.clear_authentication() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema tests to authenticated, anon;

-- fixture trip helper: creates trips for the fixture date (a Monday)
-- plpgsql (not sql) so this file can be created before generate_trips exists
create or replace function tests.make_fixture_trips() returns void
language plpgsql as $$ begin perform public.generate_trips('2030-01-07'::date); end $$;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
