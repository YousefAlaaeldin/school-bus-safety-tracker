-- RLS helper functions (docs/contracts/rls.md §1, §2, §3 note 1).
-- All are stable + security definer with an empty search_path, and are the ONLY functions in
-- schema private that authenticated users may execute.

create or replace function private.is_school_admin(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.school_id = p_school_id and m.role = 'admin'
  );
$$;

create or replace function private.is_school_helper(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.school_id = p_school_id and m.role = 'helper'
  );
$$;

create or replace function private.is_school_staff(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.school_id = p_school_id
  );
$$;

create or replace function private.my_student_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select gl.student_id from public.guardian_links gl
  where gl.guardian_user_id = auth.uid() and gl.status = 'approved';
$$;

create or replace function private.my_tracking_student_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select gl.student_id from public.guardian_links gl
  where gl.guardian_user_id = auth.uid() and gl.status = 'approved' and gl.can_track = true;
$$;

create or replace function private.is_guardian_in_school(p_school_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_links gl
    join public.students s on s.id = gl.student_id
    where gl.guardian_user_id = auth.uid() and gl.status = 'approved' and s.school_id = p_school_id
  );
$$;

create or replace function private.is_trip_helper(p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trips t where t.id = p_trip_id and t.helper_id = auth.uid()
  );
$$;

create or replace function private.trip_school_id(p_trip_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select t.school_id from public.trips t where t.id = p_trip_id;
$$;

-- Who can see the live bus (rls.md §2).
create or replace function private.can_view_bus(p_trip_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    private.is_school_admin(private.trip_school_id(p_trip_id))
    or private.is_trip_helper(p_trip_id)
    or exists (
      select 1
      from public.trip_students ts
      join public.trips t on t.id = ts.trip_id
      where ts.trip_id = p_trip_id
        and ts.student_id in (select private.my_tracking_student_ids())
        and t.status in ('roll_call', 'in_progress')
        and (
          ts.status = 'boarded'
          or (t.direction = 'to_school' and t.status = 'in_progress' and ts.status = 'expected')
        )
    );
$$;

create or replace function private.helper_student_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select ts.student_id
  from public.trip_students ts
  join public.trips t on t.id = ts.trip_id
  where t.helper_id = auth.uid();
$$;

create or replace function private.helper_stop_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select ts.stop_id
  from public.trip_students ts
  join public.trips t on t.id = ts.trip_id
  where t.helper_id = auth.uid()
  union
  select rs.stop_id
  from public.route_stops rs
  join public.routes r on r.id = rs.route_id
  where r.default_helper_id = auth.uid();
$$;

create or replace function private.guardian_stop_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select sa.stop_id from public.student_assignments sa
  where sa.student_id in (select private.my_student_ids())
  union
  select ts.stop_id from public.trip_students ts
  where ts.student_id in (select private.my_student_ids())
  union
  select st.id from public.stops st
  where st.is_school = true
    and st.school_id in (
      select s.school_id from public.students s
      where s.id in (select private.my_student_ids())
    );
$$;

-- profiles visible to admins (rls.md §3 note 1)
create or replace function private.admin_can_see_profile(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.school_id = mine.school_id
    where mine.user_id = auth.uid() and mine.role = 'admin' and theirs.user_id = p_profile_id
  )
  or exists (
    select 1
    from public.memberships mine
    join public.guardian_links gl on gl.school_id = mine.school_id
    where mine.user_id = auth.uid() and mine.role = 'admin' and gl.guardian_user_id = p_profile_id
  );
$$;

grant execute on function
  private.is_school_admin(uuid),
  private.is_school_helper(uuid),
  private.is_school_staff(uuid),
  private.my_student_ids(),
  private.my_tracking_student_ids(),
  private.is_guardian_in_school(uuid),
  private.is_trip_helper(uuid),
  private.trip_school_id(uuid),
  private.can_view_bus(uuid),
  private.helper_student_ids(),
  private.helper_stop_ids(),
  private.guardian_stop_ids(),
  private.admin_can_see_profile(uuid)
to authenticated;
