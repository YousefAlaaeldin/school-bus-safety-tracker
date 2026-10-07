-- Check Expo push receipts every 15 minutes.
select cron.unschedule(jobname) from cron.job where jobname = 'push-receipts';
select cron.schedule(
  'push-receipts',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/push-receipts',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                                where name = 'service_role_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);
