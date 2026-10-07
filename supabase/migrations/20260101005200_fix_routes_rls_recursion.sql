-- routes_select_visible read student_assignments, whose own policy reads routes: infinite recursion
-- for any query touching routes. Read the guardian's routes through a security-definer helper instead.
create or replace function private.guardian_route_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select sa.route_id from public.student_assignments sa
  where sa.student_id in (select private.my_student_ids());
$$;

revoke execute on function private.guardian_route_ids() from public, anon;
grant execute on function private.guardian_route_ids() to authenticated;

drop policy routes_select_visible on public.routes;
create policy routes_select_visible on public.routes
  for select to authenticated
  using (
    private.is_school_staff(school_id)
    or id in (select private.guardian_route_ids())
  );
