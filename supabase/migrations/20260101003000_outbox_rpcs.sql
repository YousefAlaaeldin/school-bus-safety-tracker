-- Service-only RPCs for the notification pipeline (docs/contracts/rpc.md §5, skeletons §3).

create or replace function public.claim_due_notifications(p_limit integer default 100)
returns table (id uuid, type public.notification_type, params jsonb, locale public.locale_code,
               tokens text[], trip_id uuid, student_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select o.id
      from public.notification_outbox o
     where o.status = 'pending'
       and o.send_after <= now()
       and (o.claimed_at is null or o.claimed_at < now() - interval '2 minutes')
     order by o.send_after
     limit p_limit
     for update skip locked
  ), claimed as (
    update public.notification_outbox o
       set claimed_at = now(), attempts = o.attempts + 1
      from due
     where o.id = due.id
    returning o.*
  )
  select c.id, c.type, c.params, p.locale,
         coalesce((select array_agg(t.expo_token) from public.push_tokens t
                    where t.user_id = c.recipient_user_id), '{}'::text[]),
         c.trip_id, c.student_id
    from claimed c
    join public.profiles p on p.id = c.recipient_user_id;
end;
$$;

create or replace function public.complete_notification(
  p_id uuid,
  p_status public.notification_status,
  p_ticket_ids text[],
  p_tokens text[],
  p_error text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if p_status = 'sent' then
    update public.notification_outbox
    set status = 'sent', sent_at = now(),
        expo_ticket_ids = coalesce(p_ticket_ids, '{}'),
        sent_tokens = coalesce(p_tokens, '{}'),
        error = null
    where id = p_id;
  elsif p_status = 'failed' then
    update public.notification_outbox
    set status = 'failed', error = p_error
    where id = p_id;
  elsif p_status = 'pending' then
    select attempts into v_attempts from public.notification_outbox where id = p_id;
    if coalesce(v_attempts, 0) >= 5 then
      update public.notification_outbox set status = 'failed', error = p_error where id = p_id;
    else
      update public.notification_outbox set claimed_at = null, error = p_error where id = p_id;
    end if;
  end if;
end;
$$;

create or replace function public.get_unchecked_receipts(p_limit integer default 300)
returns table (id uuid, ticket_ids text[], tokens text[])
language sql
security definer
set search_path = ''
as $$
  select o.id, o.expo_ticket_ids, o.sent_tokens
  from public.notification_outbox o
  where o.status = 'sent'
    and o.sent_at < now() - interval '15 minutes'
    and o.receipts_checked_at is null
  order by o.sent_at
  limit p_limit;
$$;

create or replace function public.mark_receipts_checked(p_ids uuid[], p_dead_tokens text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox set receipts_checked_at = now() where id = any (p_ids);
  delete from public.push_tokens where expo_token = any (coalesce(p_dead_tokens, '{}'));
end;
$$;

-- Callable only by cron and Edge Functions (service_role).
revoke execute on function public.claim_due_notifications(integer) from public, anon, authenticated;
revoke execute on function public.complete_notification(uuid, public.notification_status, text[], text[], text) from public, anon, authenticated;
revoke execute on function public.get_unchecked_receipts(integer) from public, anon, authenticated;
revoke execute on function public.mark_receipts_checked(uuid[], text[]) from public, anon, authenticated;

grant execute on function public.claim_due_notifications(integer) to service_role;
grant execute on function public.complete_notification(uuid, public.notification_status, text[], text[], text) to service_role;
grant execute on function public.get_unchecked_receipts(integer) to service_role;
grant execute on function public.mark_receipts_checked(uuid[], text[]) to service_role;
