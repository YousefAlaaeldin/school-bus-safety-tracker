begin;
select plan(11);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
grant all on ids to authenticated;
insert into ids select 'a_pm', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';
insert into ids select 'a_am', id::text from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a2' and service_date = '2030-01-07';

update public.trips set status = 'in_progress' where id in (select v::uuid from ids);

select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');

-- no-show
select is(
  (public.mark_no_show((select v::uuid from ids where k = 'a_am'), 'f0000000-0000-0000-0000-000000000003',
     gen_random_uuid(), now()))->>'status',
  'missing', 'STUDENT_3 is a no-show');
select tests.clear_authentication();
select is((select recipient_user_id from public.notification_outbox
           where student_id = 'f0000000-0000-0000-0000-000000000003' and type = 'no_show'),
          'a0000000-0000-0000-0000-000000000004'::uuid, 'PARENT_2 gets a no_show notification');
select is((select count(*)::int from public.alerts
           where dedupe_key = 'no_show:' || (select v from ids where k = 'a_am') || ':f0000000-0000-0000-0000-000000000003'),
          1, 'a no_show alert is raised');

-- undo
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.undo_no_show((select v::uuid from ids where k = 'a_am'), 'f0000000-0000-0000-0000-000000000003',
     gen_random_uuid(), now()))->>'status',
  'expected', 'undo returns to expected');
select tests.clear_authentication();
select is((select status::text from public.notification_outbox
           where student_id = 'f0000000-0000-0000-0000-000000000003' and type = 'no_show'),
          'cancelled', 'the no_show notification is cancelled');

-- arrive at school
update public.trip_students set status = 'boarded'
where trip_id = (select v::uuid from ids where k = 'a_am')
  and student_id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002');
select tests.authenticate_as('a0000000-0000-0000-0000-000000000002');
select is(
  (public.arrive_at_school((select v::uuid from ids where k = 'a_am'), gen_random_uuid(), now(), 25.1007, 55.1988))->>'dropped',
  '2', 'two children arrived');
select throws_ok(
  $$ select public.arrive_at_school((select v::uuid from ids where k = 'a_am'), gen_random_uuid(), now()) $$,
  'P0001', 'INVALID_STATE', 'cannot arrive twice');
select throws_ok(
  $$ select public.mark_no_show((select v::uuid from ids where k = 'a_pm'), 'f0000000-0000-0000-0000-000000000003',
       gen_random_uuid(), now()) $$,
  'P0001', 'INVALID_STATE', 'no-shows only exist in the morning');
select tests.clear_authentication();

select is((select count(*)::int from public.trip_students
           where trip_id = (select v::uuid from ids where k = 'a_am') and status = 'dropped'
             and student_id in ('f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002')),
          2, 'both children are dropped');
select is((select count(*)::int from public.notification_outbox
           where trip_id = (select v::uuid from ids where k = 'a_am') and type = 'arrived_school'
             and recipient_user_id = 'a0000000-0000-0000-0000-000000000003'),
          2, 'PARENT_1 gets one arrived_school notification per child');
select isnt((select arrived_school_at from public.trips where id = (select v::uuid from ids where k = 'a_am')),
            null, 'arrived_school_at is set');

select * from finish();
rollback;
