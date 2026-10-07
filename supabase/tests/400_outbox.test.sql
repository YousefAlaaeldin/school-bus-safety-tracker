begin;
select plan(10);

-- a push token for PARENT_1 (Arabic profile by default)
insert into public.push_tokens (user_id, expo_token, platform)
values ('a0000000-0000-0000-0000-000000000003', 'ExponentPushToken[parent1]', 'android');

insert into public.notification_outbox (id, dedupe_key, type, recipient_user_id, school_id, send_after)
values
  ('b1000000-0000-0000-0000-000000000001', 'k-due', 'boarded', 'a0000000-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111', now() - interval '1 second'),
  ('b1000000-0000-0000-0000-000000000002', 'k-future', 'boarded', 'a0000000-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111', now() + interval '1 hour'),
  ('b1000000-0000-0000-0000-000000000003', 'k-cancelled', 'boarded', 'a0000000-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111', now() - interval '1 second');
update public.notification_outbox set status = 'cancelled' where id = 'b1000000-0000-0000-0000-000000000003';

select is((select count(*)::int from public.claim_due_notifications(10)), 1, 'only the due, pending row is claimed');
select is((select count(*)::int from public.claim_due_notifications(10)), 0, 'a second claim returns nothing');

-- locale and tokens
update public.notification_outbox set claimed_at = null where id = 'b1000000-0000-0000-0000-000000000001';
select is((select locale::text || '|' || tokens[1] from public.claim_due_notifications(10)),
          'ar|ExponentPushToken[parent1]', 'the claim returns the recipient locale and tokens');

-- complete_notification
select public.complete_notification('b1000000-0000-0000-0000-000000000001', 'sent',
  array['ticket-1'], array['ExponentPushToken[parent1]'], null);
select is((select status::text from public.notification_outbox where id = 'b1000000-0000-0000-0000-000000000001'),
          'sent', 'a sent notification is marked sent');
select is((select expo_ticket_ids[1] from public.notification_outbox where id = 'b1000000-0000-0000-0000-000000000001'),
          'ticket-1', 'ticket ids are stored');

update public.notification_outbox set status = 'pending', attempts = 5 where id = 'b1000000-0000-0000-0000-000000000002';
select public.complete_notification('b1000000-0000-0000-0000-000000000002', 'pending', null, null, 'EXPO_HTTP_500');
select is((select status::text from public.notification_outbox where id = 'b1000000-0000-0000-0000-000000000002'),
          'failed', 'a retry after 5 attempts fails the notification');

-- receipts
update public.notification_outbox set sent_at = now() - interval '20 minutes'
where id = 'b1000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.get_unchecked_receipts()), 1, 'a sent row 20 minutes old needs a receipt check');
select public.mark_receipts_checked(array['b1000000-0000-0000-0000-000000000001']::uuid[],
  array['ExponentPushToken[parent1]']);
select is((select count(*)::int from public.get_unchecked_receipts()), 0, 'it is returned only once');
select is((select count(*)::int from public.push_tokens where expo_token = 'ExponentPushToken[parent1]'),
          0, 'the dead token is deleted');

-- service_role only
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select throws_ok($$ select * from public.claim_due_notifications(1) $$, '42501', null,
                 'authenticated users cannot claim notifications');
select tests.clear_authentication();

select * from finish();
rollback;
