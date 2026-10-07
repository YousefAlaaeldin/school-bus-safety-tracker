begin;
select plan(6);

-- every security definer function in public pins its search_path
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'every public security definer function sets search_path');

-- the same for private
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'every private security definer function sets search_path');

-- anon gets nothing
set local role anon;
select throws_ok($$ select * from public.students $$, '42501', null, 'anon cannot select from students');
reset role;

-- service-only RPCs (rpc.md §5) are not executable by signed-in users
select is(
  (select count(*)::int from unnest(array[
      'public.generate_trips(date)',
      'public.claim_due_notifications(integer)',
      'public.complete_notification(uuid, public.notification_status, text[], text[], text)',
      'public.get_unchecked_receipts(integer)',
      'public.mark_receipts_checked(uuid[], text[])',
      'public.get_eta_work()',
      'public.apply_etas(uuid, jsonb)',
      'public.run_watchdogs()',
      'public.purge_old_location_data()'
    ]) f
   where has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute')),
  0, 'service-only RPCs are not executable by authenticated or anon');

-- only the RLS helpers in schema private are executable by authenticated
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname not in (
       'is_school_admin', 'is_school_helper', 'is_school_staff', 'my_student_ids', 'my_tracking_student_ids',
       'is_guardian_in_school', 'is_trip_helper', 'trip_school_id', 'can_view_bus', 'helper_student_ids',
       'helper_stop_ids', 'guardian_stop_ids', 'admin_can_see_profile')),
  0, 'no private function except the RLS helpers is executable by authenticated');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and has_function_privilege('anon', p.oid, 'execute')),
  0, 'anon cannot execute any private function');

select * from finish();
rollback;
