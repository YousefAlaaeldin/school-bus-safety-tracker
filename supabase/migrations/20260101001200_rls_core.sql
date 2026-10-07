-- RLS policies: schools, calendar, profiles, memberships, staff invites (docs/contracts/rls.md §3, §4).

-- The anon role gets nothing.
revoke all on all tables in schema public from anon;

-- schools
create policy schools_select_member on public.schools
  for select to authenticated
  using (private.is_school_staff(id) or private.is_guardian_in_school(id));

create policy schools_update_admin on public.schools
  for update to authenticated
  using (private.is_school_admin(id))
  with check (private.is_school_admin(id));

-- school_calendar
create policy school_calendar_select_member on public.school_calendar
  for select to authenticated
  using (private.is_school_staff(school_id) or private.is_guardian_in_school(school_id));

create policy school_calendar_insert_admin on public.school_calendar
  for insert to authenticated
  with check (private.is_school_admin(school_id));

create policy school_calendar_update_admin on public.school_calendar
  for update to authenticated
  using (private.is_school_admin(school_id))
  with check (private.is_school_admin(school_id));

create policy school_calendar_delete_admin on public.school_calendar
  for delete to authenticated
  using (private.is_school_admin(school_id));

-- profiles
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.admin_can_see_profile(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Column-limited updates: only display_name and locale.
revoke update on public.profiles from authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

-- memberships
create policy memberships_select_self_or_admin on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or private.is_school_admin(school_id));

create policy memberships_delete_admin on public.memberships
  for delete to authenticated
  using (private.is_school_admin(school_id) and user_id <> auth.uid());

-- staff_invites
create policy staff_invites_select_admin on public.staff_invites
  for select to authenticated
  using (private.is_school_admin(school_id));

create policy staff_invites_delete_admin on public.staff_invites
  for delete to authenticated
  using (private.is_school_admin(school_id));
