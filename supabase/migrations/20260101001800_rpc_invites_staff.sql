-- RPCs: invites, guardian approval, staff, alerts, trip helper (docs/contracts/rpc.md §2).

-- create_invite -----------------------------------------------------------------------------------
create or replace function public.create_invite(p_guardian_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.guardian_links%rowtype;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 chars
  v_code text;
  v_bytes bytea;
  v_expires timestamptz;
  v_attempt integer := 0;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_link from public.guardian_links where id = p_guardian_link_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.is_school_admin(v_link.school_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_link.status = 'revoked' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      -- 256 is a multiple of 32, so there is no modulo bias.
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;

    begin
      insert into public.invite_codes (guardian_link_id, code)
      values (p_guardian_link_id, v_code)
      returning expires_at into v_expires;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then
        raise;
      end if;
    end;
  end loop;

  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

-- redeem_invite -----------------------------------------------------------------------------------
create or replace function public.redeem_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invite_codes%rowtype;
  v_link public.guardian_links%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_invite
  from public.invite_codes
  where code = upper(trim(coalesce(p_code, '')))
  for update;
  if not found then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;

  select * into v_link from public.guardian_links where id = v_invite.guardian_link_id for update;
  if not found or v_link.status = 'revoked' then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;
  -- A code never moves a link away from another verified parent.
  if v_link.guardian_user_id is not null and v_link.guardian_user_id <> v_uid then
    raise exception 'INVITE_INVALID' using errcode = 'P0001';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception 'INVITE_USED' using errcode = 'P0001';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'P0001';
  end if;

  update public.invite_codes
  set redeemed_by = v_uid, redeemed_at = now()
  where id = v_invite.id;

  update public.guardian_links
  set guardian_user_id = v_uid, status = 'approved', approved_at = now()
  where id = v_link.id;

  return jsonb_build_object('student_id', v_link.student_id, 'link_id', v_link.id);
end;
$$;

-- approve_guardian_link ---------------------------------------------------------------------------
create or replace function public.approve_guardian_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.guardian_links%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_link from public.guardian_links where id = p_link_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.is_school_admin(v_link.school_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_link.guardian_user_id is null then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.guardian_links
  set status = 'approved', approved_by = v_uid, approved_at = now()
  where id = p_link_id;
end;
$$;

-- revoke_guardian_link ----------------------------------------------------------------------------
create or replace function public.revoke_guardian_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_link public.guardian_links%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_link from public.guardian_links where id = p_link_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.is_school_admin(v_link.school_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  update public.guardian_links set status = 'revoked' where id = p_link_id;

  if v_link.guardian_user_id is not null then
    update public.notification_outbox
    set status = 'cancelled'
    where status = 'pending'
      and recipient_user_id = v_link.guardian_user_id
      and student_id = v_link.student_id;
  end if;

  update public.invite_codes
  set expires_at = now()
  where guardian_link_id = p_link_id and redeemed_at is null;
end;
$$;

-- invite_staff ------------------------------------------------------------------------------------
create or replace function public.invite_staff(
  p_school_id uuid,
  p_role public.membership_role,
  p_phone text,
  p_email text,
  p_display_name text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_email text;
  v_invite_id uuid;
  v_profile_id uuid;
  v_created boolean := false;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not private.is_school_admin(p_school_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  if p_role = 'helper' then
    v_phone := private.normalize_phone(p_phone);
    if v_phone is null then
      raise exception 'INVALID_INPUT' using errcode = 'P0001';
    end if;
  else
    v_email := lower(trim(coalesce(p_email, '')));
    if v_email = '' then
      raise exception 'INVALID_INPUT' using errcode = 'P0001';
    end if;
  end if;

  insert into public.staff_invites (school_id, role, phone, email, display_name)
  values (p_school_id, p_role, v_phone, v_email, nullif(trim(coalesce(p_display_name, '')), ''))
  on conflict do nothing
  returning id into v_invite_id;

  if v_invite_id is null then
    select id into v_invite_id
    from public.staff_invites
    where school_id = p_school_id and role = p_role
      and ((v_phone is not null and phone = v_phone) or (v_email is not null and email = v_email));
  end if;

  select id into v_profile_id
  from public.profiles
  where (v_phone is not null and phone = v_phone) or (v_email is not null and email = v_email)
  limit 1;

  if v_profile_id is not null then
    insert into public.memberships (user_id, school_id, role)
    values (v_profile_id, p_school_id, p_role)
    on conflict do nothing;

    update public.staff_invites
    set claimed_by = v_profile_id, claimed_at = coalesce(claimed_at, now())
    where id = v_invite_id and claimed_by is null;

    v_created := true;
  end if;

  return jsonb_build_object('invite_id', v_invite_id, 'membership_created', v_created);
end;
$$;

-- remove_staff ------------------------------------------------------------------------------------
create or replace function public.remove_staff(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_membership public.memberships%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_membership from public.memberships where id = p_membership_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.is_school_admin(v_membership.school_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_membership.user_id = v_uid then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  delete from public.memberships where id = p_membership_id;
end;
$$;

-- acknowledge_alert -------------------------------------------------------------------------------
create or replace function public.acknowledge_alert(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_alert public.alerts%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_alert from public.alerts where id = p_alert_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.is_school_admin(v_alert.school_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  update public.alerts
  set acknowledged_by = v_uid, acknowledged_at = now()
  where id = p_alert_id and acknowledged_at is null;
end;
$$;

-- set_trip_helper ---------------------------------------------------------------------------------
create or replace function public.set_trip_helper(p_trip_id uuid, p_helper_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_trip public.trips%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if not private.is_school_admin(v_trip.school_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if p_helper_id is null or not exists (
    select 1 from public.memberships m
    where m.user_id = p_helper_id and m.school_id = v_trip.school_id and m.role = 'helper'
  ) then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;
  if v_trip.status not in ('scheduled', 'roll_call', 'in_progress') then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update public.trips set helper_id = p_helper_id where id = p_trip_id;
end;
$$;

-- grants: authenticated only ---------------------------------------------------------------------
revoke execute on function public.create_invite(uuid) from public, anon;
revoke execute on function public.redeem_invite(text) from public, anon;
revoke execute on function public.approve_guardian_link(uuid) from public, anon;
revoke execute on function public.revoke_guardian_link(uuid) from public, anon;
revoke execute on function public.invite_staff(uuid, public.membership_role, text, text, text) from public, anon;
revoke execute on function public.remove_staff(uuid) from public, anon;
revoke execute on function public.acknowledge_alert(uuid) from public, anon;
revoke execute on function public.set_trip_helper(uuid, uuid) from public, anon;

grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
grant execute on function public.approve_guardian_link(uuid) to authenticated;
grant execute on function public.revoke_guardian_link(uuid) to authenticated;
grant execute on function public.invite_staff(uuid, public.membership_role, text, text, text) to authenticated;
grant execute on function public.remove_staff(uuid) to authenticated;
grant execute on function public.acknowledge_alert(uuid) to authenticated;
grant execute on function public.set_trip_helper(uuid, uuid) to authenticated;
