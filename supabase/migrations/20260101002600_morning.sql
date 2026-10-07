-- mark_no_show, undo_no_show, arrive_at_school (docs/contracts/rpc.md §3)

create or replace function public.mark_no_show(
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

  v_prev := private.claim_client_action(p_client_action_id, 'mark_no_show');
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
  if v_trip.direction <> 'to_school' or v_trip.status <> 'in_progress' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_ts from public.trip_students
  where trip_id = p_trip_id and student_id = p_student_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_ts.status <> 'expected' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.trip_students
  set status = 'missing', updated_by = v_uid, updated_at = now()
  where id = v_ts.id;

  perform private.log_trip_event(p_trip_id, p_student_id, 'student_no_show',
                                 p_client_action_id, p_device_time, p_lat, p_lng);
  perform private.enqueue_guardian_notifications(
    'no_show', p_trip_id, p_student_id,
    jsonb_build_object('time_iso', now()), now() + interval '10 seconds');
  perform private.raise_alert(v_trip.school_id, p_trip_id, 'no_show', 'info',
                              'no_show:' || p_trip_id::text || ':' || p_student_id::text,
                              jsonb_build_object('student_id', p_student_id));

  v_result := jsonb_build_object('student_id', p_student_id, 'status', 'missing');
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.mark_no_show(uuid, uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.mark_no_show(uuid, uuid, uuid, timestamptz, double precision, double precision) to authenticated;

create or replace function public.undo_no_show(
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

  v_prev := private.claim_client_action(p_client_action_id, 'undo_no_show');
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
  if v_trip.direction <> 'to_school' or v_trip.status <> 'in_progress' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select * into v_ts from public.trip_students
  where trip_id = p_trip_id and student_id = p_student_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_ts.status <> 'missing' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;
  if v_ts.updated_at <= now() - interval '2 minutes' then
    raise exception 'UNDO_WINDOW_PASSED' using errcode = 'P0001';
  end if;

  update public.trip_students
  set status = 'expected', updated_by = v_uid, updated_at = now()
  where id = v_ts.id;

  perform private.log_trip_event(p_trip_id, p_student_id, 'student_no_show_undone',
                                 p_client_action_id, p_device_time, p_lat, p_lng);
  perform private.cancel_pending_notifications('no_show', p_trip_id, p_student_id);

  v_result := jsonb_build_object('student_id', p_student_id, 'status', 'expected');
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.undo_no_show(uuid, uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.undo_no_show(uuid, uuid, uuid, timestamptz, double precision, double precision) to authenticated;

create or replace function public.arrive_at_school(
  p_trip_id          uuid,
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
  v_point  extensions.geography;
  v_ids    uuid[];
  v_id     uuid;
  v_count  integer;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_prev := private.claim_client_action(p_client_action_id, 'arrive_at_school');
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
  if v_trip.direction <> 'to_school' or v_trip.status <> 'in_progress'
     or v_trip.arrived_school_at is not null then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  v_point := private.make_point(p_lat, p_lng);

  with changed as (
    update public.trip_students
    set status = 'dropped', dropped_at = now(), dropped_location = v_point,
        updated_by = v_uid, updated_at = now()
    where trip_id = p_trip_id and status = 'boarded'
    returning student_id
  )
  select coalesce(array_agg(student_id), '{}'::uuid[]) into v_ids from changed;
  v_count := coalesce(array_length(v_ids, 1), 0);

  update public.trips set arrived_school_at = now() where id = p_trip_id;

  perform private.log_trip_event(p_trip_id, null, 'arrived_school',
                                 p_client_action_id, p_device_time, p_lat, p_lng,
                                 jsonb_build_object('count', v_count));

  foreach v_id in array v_ids loop
    perform private.enqueue_guardian_notifications(
      'arrived_school', p_trip_id, v_id, jsonb_build_object('time_iso', now()), now());
  end loop;

  v_result := jsonb_build_object('dropped', v_count);
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.arrive_at_school(uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.arrive_at_school(uuid, uuid, timestamptz, double precision, double precision) to authenticated;
