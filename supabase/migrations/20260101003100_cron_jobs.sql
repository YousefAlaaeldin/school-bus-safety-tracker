-- Scheduled jobs (docs/contracts/skeletons.md §4). Secrets live in Vault, never in migrations.
-- Re-running is safe: each job is unscheduled first.

select cron.unschedule(jobname) from cron.job where jobname = 'notify-dispatch';
select cron.schedule(
  'notify-dispatch',
  '10 seconds',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/notify-dispatch',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                                where name = 'service_role_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);

-- Trips for today and tomorrow, at 04:30 Dubai time (00:30 UTC).
select cron.unschedule(jobname) from cron.job where jobname = 'generate-trips';
select cron.schedule(
  'generate-trips',
  '30 0 * * *',
  $$
  select public.generate_trips((now() at time zone 'Asia/Dubai')::date);
  select public.generate_trips((now() at time zone 'Asia/Dubai')::date + 1);
  $$
);
