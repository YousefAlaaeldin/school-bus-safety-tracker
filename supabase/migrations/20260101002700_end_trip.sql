-- mark_returned_to_school and end_trip (docs/contracts/rpc.md §3, §3.3)

create or replace function public.mark_returned_to_school(
  p_trip_id          uuid,
  p_student_id       uuid,
  p_client_action_id uuid,
  p_device_time      timestamptz,
  p_lat              double precision default null,
  p_lng              double precision default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_prev   jsonb;
  v_trip   public.trips%rowtype;
  v_ts     public.trip_students%rowtype;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_prev := private.claim_client_action(p_client_action_id, 'mark_returned_to_school');
  if v_prev is not null then
    return v_prev;
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_trip.helper_id is distinct from v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_trip.direction <> 'from_school' or v_trip.status <> 'in_progress' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_ts from public.trip_students
  where trip_id = p_trip_id and student_id = p_student_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_ts.status <> 'boarded' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.trip_students
  set status = 'returned_to_school', updated_by = v_uid, updated_at = now()
  where id = v_ts.id;

  perform private.log_trip_event(p_trip_id, p_student_id, 'student_returned',
                                 p_client_action_id, p_device_time, p_lat, p_lng);
  perform private.enqueue_guardian_notifications(
    'returned_to_school', p_trip_id, p_student_id, jsonb_build_object('time_iso', now()), now());
  perform private.raise_alert(v_trip.school_id, p_trip_id, 'student_returned', 'warning',
                              'student_returned:' || p_trip_id::text || ':' || p_student_id::text,
                              jsonb_build_object('student_id', p_student_id));

  v_result := jsonb_build_object('student_id', p_student_id, 'status', 'returned_to_school');
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.mark_returned_to_school(uuid, uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.mark_returned_to_school(uuid, uuid, uuid, timestamptz, double precision, double precision) to authenticated;

create or replace function public.end_trip(
  p_trip_id          uuid,
  p_force            boolean,
  p_reason           text,
  p_client_action_id uuid,
  p_device_time      timestamptz,
  p_lat              double precision default null,
  p_lng              double precision default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_prev     jsonb;
  v_trip     public.trips%rowtype;
  v_on_board integer;
  v_forced   boolean;
  v_row      record;
  v_result   jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_prev := private.claim_client_action(p_client_action_id, 'end_trip');
  if v_prev is not null then
    return v_prev;
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_trip.helper_id is distinct from v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_trip.status <> 'in_progress' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select count(*)::integer into v_on_board
  from public.trip_students where trip_id = p_trip_id and status = 'boarded';

  if v_on_board > 0 and not coalesce(p_force, false) then
    raise exception 'STUDENTS_ON_BOARD' using errcode = 'P0001';
  end if;
  if coalesce(p_force, false) and coalesce(trim(p_reason), '') = '' then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  -- Morning trips: whoever was never picked up is a no-show.
  if v_trip.direction = 'to_school' then
    for v_row in
      update public.trip_students
      set status = 'missing', updated_by = v_uid, updated_at = now()
      where trip_id = p_trip_id and status = 'expected'
      returning student_id
    loop
      perform private.log_trip_event(p_trip_id, v_row.student_id, 'student_no_show',
                                     p_client_action_id, p_device_time, p_lat, p_lng);
      perform private.enqueue_guardian_notifications(
        'no_show', p_trip_id, v_row.student_id, jsonb_build_object('time_iso', now()), now());
    end loop;
  end if;

  v_forced := coalesce(p_force, false) and v_on_board > 0;
  update public.trips
  set status = 'completed', ended_at = now(), end_forced = v_forced, end_reason = p_reason
  where id = p_trip_id;

  perform private.log_trip_event(p_trip_id, null, 'trip_ended',
                                 p_client_action_id, p_device_time, p_lat, p_lng,
                                 jsonb_build_object('on_board', v_on_board));

  if v_forced then
    perform private.raise_alert(v_trip.school_id, p_trip_id, 'trip_forced_end', 'critical',
                                'trip_forced_end:' || p_trip_id::text,
                                jsonb_build_object('reason', p_reason, 'count', v_on_board));
    perform private.enqueue_admin_notifications(
      'trip_forced_end', p_trip_id, jsonb_build_object('reason', p_reason, 'count', v_on_board));
  end if;

  v_result := jsonb_build_object('trip_id', p_trip_id, 'status', 'completed', 'forced', v_forced);
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.end_trip(uuid, boolean, text, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.end_trip(uuid, boolean, text, uuid, timestamptz, double precision, double precision) to authenticated;
