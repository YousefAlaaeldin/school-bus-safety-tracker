-- set_boarded (docs/contracts/rpc.md §3, §3.1)
create or replace function public.set_boarded(
  p_trip_id          uuid,
  p_student_id       uuid,
  p_boarded          boolean,
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
  v_status public.student_trip_status;
  v_type   public.notification_type;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_prev := private.claim_client_action(p_client_action_id, 'set_boarded');
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
  if not (
    (v_trip.direction = 'from_school' and v_trip.status in ('roll_call', 'in_progress'))
    or (v_trip.direction = 'to_school' and v_trip.status = 'in_progress')
  ) then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_ts from public.trip_students
  where trip_id = p_trip_id and student_id = p_student_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  v_type := case when v_trip.direction = 'from_school' then 'boarded' else 'picked_up' end;
  v_status := v_ts.status;

  if p_boarded then
    if v_ts.status in ('dropped', 'returned_to_school') then
      raise exception 'INVALID_STATE' using errcode = 'P0001';
    end if;

    if v_ts.status <> 'boarded' then
      v_status := 'boarded';
      update public.trip_students
      set status = 'boarded',
          boarded_at = now(),
          boarded_location = private.make_point(p_lat, p_lng),
          updated_by = v_uid,
          updated_at = now()
      where id = v_ts.id;

      perform private.log_trip_event(p_trip_id, p_student_id, 'student_boarded',
                                     p_client_action_id, p_device_time, p_lat, p_lng);
      perform private.enqueue_guardian_notifications(
        v_type, p_trip_id, p_student_id,
        jsonb_build_object('time_iso', now()), now() + interval '10 seconds');
    end if;
  else
    if v_ts.status <> 'boarded' then
      raise exception 'INVALID_STATE' using errcode = 'P0001';
    end if;

    v_status := case when v_trip.direction = 'from_school' and v_trip.status = 'in_progress'
                     then 'missing'::public.student_trip_status
                     else 'expected'::public.student_trip_status end;
    update public.trip_students
    set status = v_status,
        boarded_at = null,
        boarded_location = null,
        updated_by = v_uid,
        updated_at = now()
    where id = v_ts.id;

    perform private.log_trip_event(p_trip_id, p_student_id, 'student_unboarded',
                                   p_client_action_id, p_device_time, p_lat, p_lng);
    perform private.cancel_pending_notifications(v_type, p_trip_id, p_student_id);
  end if;

  v_result := jsonb_build_object('student_id', p_student_id, 'status', v_status);
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.set_boarded(uuid, uuid, boolean, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.set_boarded(uuid, uuid, boolean, uuid, timestamptz, double precision, double precision) to authenticated;
