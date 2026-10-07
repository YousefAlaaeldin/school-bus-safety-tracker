begin;
select plan(11);

-- HELPER_PARENT: helper of A and approved guardian of STUDENT_5
select tests.authenticate_as('a0000000-0000-0000-0000-000000000006');
select is(jsonb_array_length(public.get_my_context()->'memberships'), 1, 'helper-parent has 1 membership');
select is(public.get_my_context()->'memberships'->0->>'role', 'helper', 'the membership is helper');
select is((public.get_my_context()->>'approved_links')::int, 1, 'helper-parent has 1 approved link');
select tests.clear_authentication();

-- PARENT_3: pending link only
select tests.authenticate_as('a0000000-0000-0000-0000-000000000005');
select is((public.get_my_context()->>'pending_links')::int, 1, 'parent 3 has 1 pending link');
select is((public.get_my_context()->>'approved_links')::int, 0, 'parent 3 has 0 approved links');
select tests.clear_authentication();

-- ADMIN_A
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is(public.get_my_context()->'memberships'->0->>'role', 'admin', 'admin A has an admin membership');
select lives_ok($$ select public.set_my_locale('en') $$, 'set_my_locale works');
select tests.clear_authentication();

select is((select locale::text from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'), 'en',
          'admin A locale changed');
select is((select count(*)::int from public.profiles where locale = 'en'), 1, 'only the caller profile changed');

-- anon cannot call either RPC
set local role anon;
select throws_ok($$ select public.get_my_context() $$, '42501', null, 'anon cannot call get_my_context');
select throws_ok($$ select public.set_my_locale('en') $$, '42501', null, 'anon cannot call set_my_locale');
reset role;

select * from finish();
rollback;
