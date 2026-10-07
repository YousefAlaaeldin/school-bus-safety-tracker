-- get_my_context(): who am I, where do I belong. set_my_locale(): change my language.

create or replace function public.get_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
           'id', p.id, 'phone', p.phone, 'email', p.email,
           'display_name', p.display_name, 'locale', p.locale)
    into v_profile
  from public.profiles p
  where p.id = v_uid;

  return jsonb_build_object(
    'profile', v_profile,
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('school_id', m.school_id, 'role', m.role)
                       order by m.created_at, m.id)
      from public.memberships m
      where m.user_id = v_uid
    ), '[]'::jsonb),
    'approved_links', (
      select count(*)::int from public.guardian_links gl
      where gl.guardian_user_id = v_uid and gl.status = 'approved'
    ),
    'pending_links', (
      select count(*)::int from public.guardian_links gl
      where gl.guardian_user_id = v_uid and gl.status = 'pending'
    )
  );
end;
$$;

revoke execute on function public.get_my_context() from public, anon;
grant execute on function public.get_my_context() to authenticated;

create or replace function public.set_my_locale(p_locale public.locale_code)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  update public.profiles set locale = p_locale where id = v_uid;
end;
$$;

revoke execute on function public.set_my_locale(public.locale_code) from public, anon;
grant execute on function public.set_my_locale(public.locale_code) to authenticated;
