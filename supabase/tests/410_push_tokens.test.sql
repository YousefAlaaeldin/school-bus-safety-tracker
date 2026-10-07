begin;
select plan(7);

select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.register_push_token('ExponentPushToken[abc]', 'android') $$, 'PARENT_1 registers a token');
select is((select user_id::text from public.push_tokens where expo_token = 'ExponentPushToken[abc]'),
          'a0000000-0000-0000-0000-000000000003', 'the token belongs to PARENT_1');
select lives_ok($$ select public.register_push_token('ExponentPushToken[abc]', 'android') $$, 'registering again is idempotent');
select tests.clear_authentication();

select tests.authenticate_as('a0000000-0000-0000-0000-000000000004');
select lives_ok($$ select public.register_push_token('ExponentPushToken[abc]', 'ios') $$, 'PARENT_2 registers the same token');
select tests.clear_authentication();
select is((select user_id::text || '/' || platform::text from public.push_tokens where expo_token = 'ExponentPushToken[abc]'),
          'a0000000-0000-0000-0000-000000000004/ios', 'the token moved to PARENT_2 (one row)');

-- PARENT_1 cannot delete PARENT_2's token
select tests.authenticate_as('a0000000-0000-0000-0000-000000000003');
select public.unregister_push_token('ExponentPushToken[abc]');
select tests.clear_authentication();
select is((select count(*)::int from public.push_tokens where expo_token = 'ExponentPushToken[abc]'), 1,
          'unregister by a non-owner removes nothing');

select tests.authenticate_as('a0000000-0000-0000-0000-000000000004');
select public.unregister_push_token('ExponentPushToken[abc]');
select tests.clear_authentication();
select is((select count(*)::int from public.push_tokens where expo_token = 'ExponentPushToken[abc]'), 0,
          'the owner unregisters it');

select * from finish();
rollback;
