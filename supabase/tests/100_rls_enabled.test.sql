begin;
select plan(2);

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'RLS on all tables');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select is(auth.uid(), 'a0000000-0000-0000-0000-000000000003'::uuid, 'authenticate_as sets auth.uid()');
select tests.clear_authentication();

select * from finish();
rollback;
