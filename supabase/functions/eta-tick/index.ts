// Edge Function: computes ETAs for active trips and applies them (which fires the "N minutes away" alert).
// Called every minute by pg_cron. Uses Google Routes when a key is set, else a straight-line estimate.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { fallbackEtas } from '../_shared/fallbackEta.ts';
import { routesEtas, type EtaResult, type EtaStop, type LatLng } from '../_shared/routes.ts';

type Work = {
  trip_id: string;
  origin: LatLng & { recorded_at: string };
  stops: (EtaStop & { sequence: number })[];
};

const CONCURRENCY = 5;

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const apiKey = Deno.env.get('GOOGLE_ROUTES_API_KEY');
  const useMock = Deno.env.get('ROUTES_MOCK') === '1' || !apiKey;

  const { data, error } = await supabase.rpc('get_eta_work');
  if (error) {
    console.error('get_eta_work failed', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  const work = (data ?? []) as Work[];
  let alerted = 0;

  const processTrip = async (item: Work) => {
    const now = new Date();
    const stops: EtaStop[] = item.stops.map((s) => ({ stop_id: s.stop_id, lat: s.lat, lng: s.lng }));
    let etas: EtaResult[];
    if (useMock) {
      etas = fallbackEtas(item.origin, stops, now);
    } else {
      try {
        etas = await routesEtas(item.origin, stops, apiKey!, now, fetch);
      } catch (e) {
        console.error(`routesEtas failed for trip ${item.trip_id}, using fallback:`, e instanceof Error ? e.message : e);
        etas = fallbackEtas(item.origin, stops, now);
      }
    }
    const { data: result, error: applyError } = await supabase.rpc('apply_etas', {
      p_trip_id: item.trip_id,
      p_etas: etas,
    });
    if (applyError) {
      console.error(`apply_etas failed for trip ${item.trip_id}`, applyError.message);
      return;
    }
    alerted += (result as { alerted?: number } | null)?.alerted ?? 0;
  };

  // At most CONCURRENCY trips at a time.
  for (let i = 0; i < work.length; i += CONCURRENCY) {
    await Promise.all(work.slice(i, i + CONCURRENCY).map(processTrip));
  }

  return new Response(JSON.stringify({ trips: work.length, alerted }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
