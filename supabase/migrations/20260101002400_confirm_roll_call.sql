-- confirm_roll_call (docs/contracts/rpc.md §3, §3.2)
create or replace function public.confirm_roll_call(
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
  v_uid     uuid := auth.uid();
  v_prev    jsonb;
  v_trip    public.trips%rowtype;
  v_notify  boolean;
  v_ids     uuid[];
  v_names_en text;
  v_names_ar text;
  v_missing integer;
  v_id      uuid;
  v_result  jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_prev := private.claim_client_action(p_client_action_id, 'confirm_roll_call');
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
  if v_trip.direction <> 'from_school' or v_trip.status <> 'roll_call' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  select s.notify_parent_on_missing into v_notify from public.schools s where s.id = v_trip.school_id;

  -- 1. everyone still "expected" is missing
  with changed as (
    update public.trip_students ts
    set status = 'missing', updated_by = v_uid, updated_at = now()
    where ts.trip_id = p_trip_id and ts.status = 'expected'
    returning ts.student_id
  )
  select coalesce(array_agg(c.student_id order by st.name_en), '{}'::uuid[]),
         coalesce(string_agg(st.name_en, ', ' order by st.name_en), ''),
         coalesce(string_agg(st.name_ar, '، ' order by st.name_en), '')
  into v_ids, v_names_en, v_names_ar
  from changed c
  join public.students st on st.id = c.student_id;
  v_missing := coalesce(array_length(v_ids, 1), 0);

  -- 2. the trip is now under way
  update public.trips set status = 'in_progress', roll_call_confirmed_at = now() where id = p_trip_id;

  -- 3. audit
  perform private.log_trip_event(p_trip_id, null, 'roll_call_confirmed',
                                 p_client_action_id, p_device_time, p_lat, p_lng,
                                 jsonb_build_object('missing_student_ids', to_jsonb(v_ids)));

  -- 4. alerts and notifications
  if v_missing > 0 then
    perform private.raise_alert(v_trip.school_id, p_trip_id, 'roll_call_missing', 'warning',
                                'roll_call_missing:' || p_trip_id::text,
                                jsonb_build_object('student_ids', to_jsonb(v_ids)));
    perform private.enqueue_admin_notifications(
      'roll_call_missing', p_trip_id,
      jsonb_build_object('count', v_missing, 'names_ar', v_names_ar, 'names_en', v_names_en));

    if v_notify then
      foreach v_id in array v_ids loop
        perform private.enqueue_guardian_notifications(
          'missing_child', p_trip_id, v_id, jsonb_build_object('time_iso', now()), now());
      end loop;
    end if;
  end if;

  v_result := jsonb_build_object('missing', v_missing);
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.confirm_roll_call(uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.confirm_roll_call(uuid, uuid, timestamptz, double precision, double precision) to authenticated;
