-- RLS policies: buses, stops, routes, schedules, route stops, assignments (docs/contracts/rls.md §3).

-- buses
create policy buses_select_member on public.buses
  for select to authenticated
  using (private.is_school_staff(school_id) or private.is_guardian_in_school(school_id));

create policy buses_insert_admin on public.buses
  for insert to authenticated
  with check (private.is_school_admin(school_id));

create policy buses_update_admin on public.buses
  for update to authenticated
  using (private.is_school_admin(school_id))
  with check (private.is_school_admin(school_id));

create policy buses_delete_admin on public.buses
  for delete to authenticated
  using (private.is_school_admin(school_id));

-- stops
create policy stops_select_visible on public.stops
  for select to authenticated
  using (
    private.is_school_admin(school_id)
    or id in (select private.helper_stop_ids())
    or id in (select private.guardian_stop_ids())
  );

create policy stops_insert_admin on public.stops
  for insert to authenticated
  with check (private.is_school_admin(school_id));

create policy stops_update_admin on public.stops
  for update to authenticated
  using (private.is_school_admin(school_id))
  with check (private.is_school_admin(school_id));

create policy stops_delete_admin on public.stops
  for delete to authenticated
  using (private.is_school_admin(school_id));

-- routes
create policy routes_select_visible on public.routes
  for select to authenticated
  using (
    private.is_school_staff(school_id)
    or id in (
      select sa.route_id from public.student_assignments sa
      where sa.student_id in (select private.my_student_ids())
    )
  );

create policy routes_insert_admin on public.routes
  for insert to authenticated
  with check (private.is_school_admin(school_id));

create policy routes_update_admin on public.routes
  for update to authenticated
  using (private.is_school_admin(school_id))
  with check (private.is_school_admin(school_id));

create policy routes_delete_admin on public.routes
  for delete to authenticated
  using (private.is_school_admin(school_id));

-- route_schedules: visible like the parent route; writable by an admin of the route's school
create policy route_schedules_select_visible on public.route_schedules
  for select to authenticated
  using (exists (select 1 from public.routes r where r.id = route_schedules.route_id));

create policy route_schedules_insert_admin on public.route_schedules
  for insert to authenticated
  with check (
    exists (select 1 from public.routes r
            where r.id = route_schedules.route_id and private.is_school_admin(r.school_id))
  );

create policy route_schedules_update_admin on public.route_schedules
  for update to authenticated
  using (
    exists (select 1 from public.routes r
            where r.id = route_schedules.route_id and private.is_school_admin(r.school_id))
  )
  with check (
    exists (select 1 from public.routes r
            where r.id = route_schedules.route_id and private.is_school_admin(r.school_id))
  );

create policy route_schedules_delete_admin on public.route_schedules
  for delete to authenticated
  using (
    exists (select 1 from public.routes r
            where r.id = route_schedules.route_id and private.is_school_admin(r.school_id))
  );

-- route_stops: same as route_schedules
create policy route_stops_select_visible on public.route_stops
  for select to authenticated
  using (exists (select 1 from public.routes r where r.id = route_stops.route_id));

create policy route_stops_insert_admin on public.route_stops
  for insert to authenticated
  with check (
    exists (select 1 from public.routes r
            where r.id = route_stops.route_id and private.is_school_admin(r.school_id))
  );

create policy route_stops_update_admin on public.route_stops
  for update to authenticated
  using (
    exists (select 1 from public.routes r
            where r.id = route_stops.route_id and private.is_school_admin(r.school_id))
  )
  with check (
    exists (select 1 from public.routes r
            where r.id = route_stops.route_id and private.is_school_admin(r.school_id))
  );

create policy route_stops_delete_admin on public.route_stops
  for delete to authenticated
  using (
    exists (select 1 from public.routes r
            where r.id = route_stops.route_id and private.is_school_admin(r.school_id))
  );

-- student_assignments: staff of the route's school, or the student's guardian; admins write
create policy student_assignments_select_visible on public.student_assignments
  for select to authenticated
  using (
    exists (select 1 from public.routes r
            where r.id = student_assignments.route_id and private.is_school_staff(r.school_id))
    or student_id in (select private.my_student_ids())
  );

create policy student_assignments_insert_admin on public.student_assignments
  for insert to authenticated
  with check (
    exists (select 1 from public.students s
            where s.id = student_assignments.student_id and private.is_school_admin(s.school_id))
  );

create policy student_assignments_update_admin on public.student_assignments
  for update to authenticated
  using (
    exists (select 1 from public.students s
            where s.id = student_assignments.student_id and private.is_school_admin(s.school_id))
  )
  with check (
    exists (select 1 from public.students s
            where s.id = student_assignments.student_id and private.is_school_admin(s.school_id))
  );

create policy student_assignments_delete_admin on public.student_assignments
  for delete to authenticated
  using (
    exists (select 1 from public.students s
            where s.id = student_assignments.student_id and private.is_school_admin(s.school_id))
  );
