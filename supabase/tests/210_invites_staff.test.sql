begin;
select plan(25);

-- scratch table for codes (created as postgres, usable by authenticated)
create temp table codes (k text primary key, code text);
grant all on codes to authenticated;

-- ============ approve / revoke / staff (state that must not collide with the invite tests) ============

-- approve_guardian_link on a link with no user -> INVALID_STATE
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001'); -- ADMIN_A
select throws_ok(
  $$ select public.approve_guardian_link((select id from public.guardian_links
       where student_id = 'f0000000-0000-0000-0000-000000000005' and guardian_phone = '+971500000099')) $$,
  'P0001', 'INVALID_STATE', 'cannot approve a link nobody has verified');
select tests.clear_authentication();

-- a fresh pending link for PARENT_3 (their phone matches, so the trigger attaches them)
insert into public.guardian_links (student_id, school_id, guardian_phone)
values ('f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '+971500000005');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.approve_guardian_link((select id from public.guardian_links
       where student_id = 'f0000000-0000-0000-0000-000000000002' and guardian_phone = '+971500000005')) $$,
  'admin approves a pending link with a user');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000005'); -- PARENT_3
select is((select count(*)::int from public.students where id = 'f0000000-0000-0000-0000-000000000002'), 1,
          'parent 3 now sees STUDENT_2');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.revoke_guardian_link((select id from public.guardian_links
       where student_id = 'f0000000-0000-0000-0000-000000000001' and guardian_phone = '+971500000003')) $$,
  'admin revokes PARENT_1 link for STUDENT_1');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000003'); -- PARENT_1
select is((select count(*)::int from public.students), 1, 'parent 1 now sees 1 student');
select tests.clear_authentication();

-- invite_staff
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((public.invite_staff('11111111-1111-1111-1111-111111111111', 'helper', '0501112222', null, 'New Helper')
           ->>'membership_created')::boolean, false, 'invite for an unknown phone creates no membership yet');
select tests.clear_authentication();
select is((select count(*)::int from public.staff_invites
           where phone = '+971501112222' and display_name = 'New Helper'), 1, 'invite row has the normalised phone');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select is((public.invite_staff('11111111-1111-1111-1111-111111111111', 'helper', '+971500000003', null, null)
           ->>'membership_created')::boolean, true, 'invite for an existing user creates the membership');
select throws_ok(
  $$ select public.remove_staff((select id from public.memberships
       where user_id = 'a0000000-0000-0000-0000-000000000001')) $$,
  'P0001', 'INVALID_INPUT', 'admin cannot remove their own membership');
select throws_ok(
  $$ select public.invite_staff('11111111-1111-1111-1111-111111111111', 'helper', 'abc', null, null) $$,
  'P0001', 'INVALID_INPUT', 'helper invite needs a valid phone');
select tests.clear_authentication();

-- acknowledge_alert
insert into public.alerts (id, school_id, type, severity, dedupe_key)
values ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111',
        'no_show', 'info', 'test-alert-1');
select tests.authenticate_as('b0000000-0000-0000-0000-000000000001'); -- ADMIN_B
select throws_ok($$ select public.acknowledge_alert('99999999-9999-9999-9999-999999999999') $$,
                 'P0001', 'NOT_AUTHORIZED', 'admin B cannot acknowledge a school-A alert');
select tests.clear_authentication();
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.acknowledge_alert('99999999-9999-9999-9999-999999999999') $$,
                'admin A acknowledges the alert');
select tests.clear_authentication();
select is((select acknowledged_by from public.alerts where id = '99999999-9999-9999-9999-999999999999'),
          'a0000000-0000-0000-0000-000000000001'::uuid, 'acknowledged_by is admin A');

-- ============ invite codes ============

-- STUDENT_5 link for +971500000099 (nobody attached yet)
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
insert into codes select 'l5', public.create_invite((select id from public.guardian_links
  where student_id = 'f0000000-0000-0000-0000-000000000005' and guardian_phone = '+971500000099'))->>'code';
select is(length((select code from codes where k = 'l5')), 8, 'invite code has 8 characters');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000004'); -- PARENT_2
select lives_ok($$ select public.redeem_invite((select code from codes where k = 'l5')) $$,
                'parent 2 redeems the STUDENT_5 code');
select is((select count(*)::int from public.students where id = 'f0000000-0000-0000-0000-000000000005'), 1,
          'parent 2 now sees STUDENT_5');
select tests.clear_authentication();
select is((select guardian_user_id from public.guardian_links
           where student_id = 'f0000000-0000-0000-0000-000000000005' and guardian_phone = '+971500000099'),
          'a0000000-0000-0000-0000-000000000004'::uuid, 'that link now belongs to parent 2');

-- STUDENT_4 link already belongs to PARENT_3
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
insert into codes select 'l4', public.create_invite((select id from public.guardian_links
  where student_id = 'f0000000-0000-0000-0000-000000000004'))->>'code';
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000004'); -- PARENT_2
select throws_ok($$ select public.redeem_invite((select code from codes where k = 'l4')) $$,
                 'P0001', 'INVITE_INVALID', 'parent 2 cannot take over parent 3 link');
select tests.clear_authentication();
select is((select guardian_user_id from public.guardian_links
           where student_id = 'f0000000-0000-0000-0000-000000000004'),
          'a0000000-0000-0000-0000-000000000005'::uuid, 'STUDENT_4 link still belongs to parent 3');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000005'); -- PARENT_3
select lives_ok($$ select public.redeem_invite((select code from codes where k = 'l4')) $$,
                'parent 3 redeems their own code');
select is((select count(*)::int from public.students where id = 'f0000000-0000-0000-0000-000000000004'), 1,
          'parent 3 sees STUDENT_4');
select throws_ok($$ select public.redeem_invite((select code from codes where k = 'l4')) $$,
                 'P0001', 'INVITE_USED', 'a used code cannot be redeemed again');
select throws_ok($$ select public.redeem_invite('ZZZZZZZZ') $$,
                 'P0001', 'INVITE_INVALID', 'unknown code');
select tests.clear_authentication();

-- expired code (STUDENT_3 link belongs to PARENT_2)
select tests.authenticate_as('a0000000-0000-0000-0000-000000000001');
insert into codes select 'l3', public.create_invite((select id from public.guardian_links
  where student_id = 'f0000000-0000-0000-0000-000000000003'))->>'code';
select tests.clear_authentication();
update public.invite_codes set expires_at = now() - interval '1 day'
where code = (select code from codes where k = 'l3');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000004');
select throws_ok($$ select public.redeem_invite((select code from codes where k = 'l3')) $$,
                 'P0001', 'INVITE_EXPIRED', 'expired code');
select tests.clear_authentication();

-- cross-school
insert into codes select 'school_a_link', id::text from public.guardian_links
where student_id = 'f0000000-0000-0000-0000-000000000003';  -- looked up as postgres: admin B cannot see it
select tests.authenticate_as('b0000000-0000-0000-0000-000000000001'); -- ADMIN_B
select throws_ok(
  $$ select public.create_invite((select code::uuid from codes where k = 'school_a_link')) $$,
  'P0001', 'NOT_AUTHORIZED', 'admin B cannot create an invite for a school-A link');
select tests.clear_authentication();

select * from finish();
rollback;
