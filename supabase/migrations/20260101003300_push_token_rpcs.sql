-- rpc.md §4: register_push_token / unregister_push_token

create or replace function public.register_push_token(
  p_token    text,
  p_platform public.device_platform
) returns void
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
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  -- a token that belonged to someone else (shared phone) moves to the caller
  insert into public.push_tokens (user_id, expo_token, platform, last_seen_at)
  values (v_uid, trim(p_token), p_platform, now())
  on conflict (expo_token)
  do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end $$;

create or replace function public.unregister_push_token(p_token text) returns void
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
  delete from public.push_tokens where expo_token = trim(p_token) and user_id = v_uid;
end $$;

revoke execute on function public.register_push_token(text, public.device_platform) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, public.device_platform) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
