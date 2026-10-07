-- report_absence and cancel_absence (docs/contracts/rpc.md §4)

-- Shared check: the caller is an approved guardian of the student, or an admin of the student's school.
-- Returns true when the caller is an admin (admins skip the cutoff).
create or replace function private.assert_can_manage_absence(p_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school uuid;
begin
  select s.school_id into v_school from public.students s where s.id = p_student_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if private.is_school_admin(v_school) then
    return true;
  end if;
  if p_student_id in (select private.my_student_ids()) then
    return false;
  end if;
  raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
end;
$$;

-- Raises PAST_CUTOFF if the date has passed or a trip for this student and direction is inside the cutoff.
create or replace function private.assert_before_absence_cutoff(
  p_student_id uuid,
  p_service_date date,
  p_direction public.trip_direction
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_service_date < (now() at time zone 'Asia/Dubai')::date then
    raise exception 'PAST_CUTOFF' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.trip_students ts
    join public.trips t on t.id = ts.trip_id
    join public.schools sc on sc.id = t.school_id
    where ts.student_id = p_student_id
      and t.service_date = p_service_date
      and t.direction = p_direction
      and now() > t.scheduled_departure - make_interval(mins => sc.absence_cutoff_minutes)
  ) then
    raise exception 'PAST_CUTOFF' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.report_absence(
  p_student_id    uuid,
  p_service_date  date,
  p_directions    public.trip_direction[],
  p_reason        text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_admin   boolean;
  v_dir     public.trip_direction;
  v_created integer := 0;
  v_inserted integer;
  v_row     record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  v_admin := private.assert_can_manage_absence(p_student_id);

  if p_directions is null or coalesce(array_length(p_directions, 1), 0) = 0 then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  foreach v_dir in array p_directions loop
    if not v_admin then
      perform private.assert_before_absence_cutoff(p_student_id, p_service_date, v_dir);
    end if;

    insert into public.absence_reports (student_id, service_date, direction, reported_by, reason)
    values (p_student_id, p_service_date, v_dir, v_uid, nullif(trim(coalesce(p_reason, '')), ''))
    on conflict (student_id, service_date, direction) do nothing;
    get diagnostics v_inserted = row_count;
    v_created := v_created + v_inserted;

    for v_row in
      update public.trip_students ts
      set status = 'absent_reported', updated_by = v_uid, updated_at = now()
      from public.trips t
      where ts.trip_id = t.id
        and ts.student_id = p_student_id
        and ts.status = 'expected'
        and t.service_date = p_service_date
        and t.direction = v_dir
      returning ts.trip_id
    loop
      perform private.log_trip_event(v_row.trip_id, p_student_id, 'absence_reported',
                                     null, null, null, null);
    end loop;
  end loop;

  return jsonb_build_object('created', v_created);
end;
$$;

revoke execute on function public.report_absence(uuid, date, public.trip_direction[], text) from public, anon;
grant  execute on function public.report_absence(uuid, date, public.trip_direction[], text) to authenticated;

create or replace function public.cancel_absence(p_absence_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_report public.absence_reports%rowtype;
  v_admin  boolean;
  v_row    record;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_report from public.absence_reports where id = p_absence_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  v_admin := private.assert_can_manage_absence(v_report.student_id);
  if not v_admin then
    perform private.assert_before_absence_cutoff(v_report.student_id, v_report.service_date, v_report.direction);
  end if;

  delete from public.absence_reports where id = p_absence_id;

  for v_row in
    update public.trip_students ts
    set status = 'expected', updated_by = v_uid, updated_at = now()
    from public.trips t
    where ts.trip_id = t.id
      and ts.student_id = v_report.student_id
      and ts.status = 'absent_reported'
      and t.service_date = v_report.service_date
      and t.direction = v_report.direction
    returning ts.trip_id
  loop
    perform private.log_trip_event(v_row.trip_id, v_report.student_id, 'absence_cancelled',
                                   null, null, null, null);
  end loop;
end;
$$;

revoke execute on function public.cancel_absence(uuid) from public, anon;
grant  execute on function public.cancel_absence(uuid) to authenticated;
