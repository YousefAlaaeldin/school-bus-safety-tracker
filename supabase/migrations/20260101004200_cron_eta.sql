-- Compute ETAs for active trips every minute.
select cron.unschedule(jobname) from cron.job where jobname = 'eta-tick';
select cron.schedule(
  'eta-tick',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/eta-tick',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                                where name = 'service_role_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);
