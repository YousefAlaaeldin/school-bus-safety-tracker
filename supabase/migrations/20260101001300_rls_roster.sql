-- RLS policies: students, guardian links, invite codes, and the student-photos bucket.

-- students
create policy students_select_visible on public.students
  for select to authenticated
  using (
    private.is_school_admin(school_id)
    or id in (select private.helper_student_ids())
    or id in (select private.my_student_ids())
  );

create policy students_insert_admin on public.students
  for insert to authenticated
  with check (private.is_school_admin(school_id));

create policy students_update_admin on public.students
  for update to authenticated
  using (private.is_school_admin(school_id))
  with check (private.is_school_admin(school_id));

-- guardian_links
create policy guardian_links_select_visible on public.guardian_links
  for select to authenticated
  using (private.is_school_admin(school_id) or guardian_user_id = auth.uid());

-- school_id is overwritten from the student by a trigger before this check runs.
create policy guardian_links_insert_admin on public.guardian_links
  for insert to authenticated
  with check (private.is_school_admin(school_id));

create policy guardian_links_update_admin on public.guardian_links
  for update to authenticated
  using (private.is_school_admin(school_id))
  with check (private.is_school_admin(school_id));

create policy guardian_links_delete_admin on public.guardian_links
  for delete to authenticated
  using (private.is_school_admin(school_id));

-- Column-limited updates: relationship, can_track and guardian_phone only.
revoke update on public.guardian_links from authenticated;
grant update (relationship, can_track, guardian_phone) on public.guardian_links to authenticated;

-- invite_codes: admin of the link's school
create policy invite_codes_select_admin on public.invite_codes
  for select to authenticated
  using (
    exists (
      select 1 from public.guardian_links gl
      where gl.id = invite_codes.guardian_link_id and private.is_school_admin(gl.school_id)
    )
  );

-- Private bucket for student photos: {school_id}/{student_id}.jpg
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', false)
on conflict do nothing;

-- Paths are compared as text so an odd path can never raise a uuid cast error.
create policy student_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-photos'
    and (
      exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid()
          and m.role = 'admin'
          and m.school_id::text = (storage.foldername(name))[1]
      )
      or split_part(storage.filename(name), '.', 1) in (
        select s::text from private.helper_student_ids() s
      )
      or split_part(storage.filename(name), '.', 1) in (
        select s::text from private.my_student_ids() s
      )
    )
  );

create policy student_photos_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.role = 'admin'
        and m.school_id::text = (storage.foldername(name))[1]
    )
  );

create policy student_photos_update_admin on storage.objects
  for update to authenticated
  using (
    bucket_id = 'student-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.role = 'admin'
        and m.school_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'student-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.role = 'admin'
        and m.school_id::text = (storage.foldername(name))[1]
    )
  );

create policy student_photos_delete_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-photos'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.role = 'admin'
        and m.school_id::text = (storage.foldername(name))[1]
    )
  );
