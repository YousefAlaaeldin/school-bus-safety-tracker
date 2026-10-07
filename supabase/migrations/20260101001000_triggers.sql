-- Sign-up trigger: create the profile, claim staff invites, attach guardian links.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_phone(new.phone);
  v_email text := lower(new.email);
  v_invite record;
begin
  insert into public.profiles (id, phone, email)
  values (new.id, v_phone, v_email)
  on conflict do nothing;

  -- Claim staff invites that match this phone or email.
  for v_invite in
    select id, school_id, role
    from public.staff_invites
    where claimed_by is null
      and ((v_phone is not null and phone = v_phone)
        or (v_email is not null and email = v_email))
  loop
    insert into public.memberships (user_id, school_id, role)
    values (new.id, v_invite.school_id, v_invite.role)
    on conflict do nothing;

    update public.staff_invites
    set claimed_by = new.id, claimed_at = now()
    where id = v_invite.id;
  end loop;

  -- Attach guardian links; the status stays as it is (pending needs approval or an invite code).
  if v_phone is not null then
    update public.guardian_links
    set guardian_user_id = new.id
    where guardian_phone = v_phone and guardian_user_id is null;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Guardian links: normalise the phone, copy school_id from the student, attach an existing profile.
create or replace function private.attach_guardian_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_phone(new.guardian_phone);
  v_matched uuid;
begin
  if v_phone is null then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;
  new.guardian_phone := v_phone;

  select s.school_id into new.school_id
  from public.students s
  where s.id = new.student_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  select p.id into v_matched from public.profiles p where p.phone = v_phone;
  if tg_op = 'INSERT' then
    new.guardian_user_id := coalesce(new.guardian_user_id, v_matched);
  elsif new.guardian_phone is distinct from old.guardian_phone then
    new.guardian_user_id := v_matched;
  end if;

  return new;
end;
$$;

create trigger guardian_links_attach_user
  before insert or update of guardian_phone on public.guardian_links
  for each row execute function private.attach_guardian_user();

-- Assignments: the stop must be one of the route's stops.
create or replace function private.check_assignment_stop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.route_stops rs
    where rs.route_id = new.route_id and rs.stop_id = new.stop_id
  ) then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger student_assignments_check_stop
  before insert or update on public.student_assignments
  for each row execute function private.check_assignment_stop();
