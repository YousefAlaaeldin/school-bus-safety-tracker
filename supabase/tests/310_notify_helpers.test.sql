begin;
select plan(11);

select tests.make_fixture_trips();

create temp table ids (k text primary key, v text);
insert into ids select 'a_pm', id::text from public.trips
  where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07';

-- STUDENT_1 -> PARENT_1 only
select is(
  private.enqueue_guardian_notifications('boarded', (select v::uuid from ids where k = 'a_pm'),
    'f0000000-0000-0000-0000-000000000001', '{"time_iso": "2030-01-07T11:00:00Z"}', now()),
  1, 'one row for STUDENT_1');
select is(
  (select params->>'child_ar' from public.notification_outbox
   where student_id = 'f0000000-0000-0000-0000-000000000001'),
  'سارة أحمد', 'params carry the Arabic child name');
select is(
  (select params->>'bus_en' || '|' || (params->>'stop_en') || '|' || (params->>'time_iso')
   from public.notification_outbox where student_id = 'f0000000-0000-0000-0000-000000000001'),
  'Bus 12|Al Barsha 2, Villa 14|2030-01-07T11:00:00Z', 'params carry bus, stop and the extra keys');

-- STUDENT_5: only the guardian with an account (HELPER_PARENT) gets a row
select is(
  private.enqueue_guardian_notifications('boarded', (select v::uuid from ids where k = 'a_pm'),
    'f0000000-0000-0000-0000-000000000005', '{}', now()),
  1, 'one row for STUDENT_5 (the +971500000099 link has no user)');
select is(
  (select recipient_user_id from public.notification_outbox where student_id = 'f0000000-0000-0000-0000-000000000005'),
  'a0000000-0000-0000-0000-000000000006'::uuid, 'the recipient is HELPER_PARENT');

-- STUDENT_4: pending link
select is(
  private.enqueue_guardian_notifications('boarded', (select v::uuid from ids where k = 'a_pm'),
    'f0000000-0000-0000-0000-000000000004', '{}', now()),
  0, 'no row for a pending link');

-- dedupe
select private.enqueue_guardian_notifications('boarded', (select v::uuid from ids where k = 'a_pm'),
  'f0000000-0000-0000-0000-000000000001', '{}', now());
select is((select count(*)::int from public.notification_outbox where student_id = 'f0000000-0000-0000-0000-000000000001'),
          1, 'enqueueing the same notification twice keeps one row');

-- cancel and revive
select private.cancel_pending_notifications('boarded', (select v::uuid from ids where k = 'a_pm'),
  'f0000000-0000-0000-0000-000000000001');
select is((select status::text from public.notification_outbox where student_id = 'f0000000-0000-0000-0000-000000000001'),
          'cancelled', 'cancel flips the row to cancelled');
select private.enqueue_guardian_notifications('boarded', (select v::uuid from ids where k = 'a_pm'),
  'f0000000-0000-0000-0000-000000000001', '{}', now());
select is((select status::text from public.notification_outbox where student_id = 'f0000000-0000-0000-0000-000000000001'),
          'pending', 'enqueueing again revives the cancelled row');

-- admin notification
select is(
  private.enqueue_admin_notifications('roll_call_missing', (select v::uuid from ids where k = 'a_pm'),
    '{"count": 2, "names_en": "A, B"}'),
  1, 'one admin row (ADMIN_A)');

-- alerts
select ok(
  private.raise_alert('11111111-1111-1111-1111-111111111111', (select v::uuid from ids where k = 'a_pm'),
    'no_show', 'info', 'k1')
  and not private.raise_alert('11111111-1111-1111-1111-111111111111', (select v::uuid from ids where k = 'a_pm'),
    'no_show', 'info', 'k1'),
  'raise_alert returns true, then false for the same key');

select * from finish();
rollback;
