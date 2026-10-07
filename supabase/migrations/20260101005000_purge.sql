-- Location data retention (docs/contracts/rpc.md §5). Runs daily at 03:00 Dubai time.

create or replace function public.purge_old_location_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pings integer;
  v_positions integer;
begin
  delete from public.location_pings lp
  using public.trips t, public.schools s
  where lp.trip_id = t.id
    and s.id = t.school_id
    and lp.recorded_at < now() - make_interval(days => s.location_retention_days);
  get diagnostics v_pings = row_count;

  delete from public.bus_positions bp
  using public.trips t
  where bp.trip_id = t.id
    and t.status in ('completed', 'cancelled')
    and t.ended_at < now() - interval '1 day';
  get diagnostics v_positions = row_count;

  return jsonb_build_object('pings_deleted', v_pings, 'positions_deleted', v_positions);
end;
$$;

revoke execute on function public.purge_old_location_data() from public, anon, authenticated;
grant execute on function public.purge_old_location_data() to service_role;

select cron.unschedule(jobname) from cron.job where jobname = 'purge-location-data';
select cron.schedule('purge-location-data', '0 23 * * *', $$ select public.purge_old_location_data() $$);
