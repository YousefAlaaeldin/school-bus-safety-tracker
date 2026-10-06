# Contract: Code skeletons

Copy these patterns. They exist because these are the places where it's easy to be subtly wrong.

---

## §1 pgTAP: acting as a user in tests

`supabase/tests/000_setup.test.sql`. This runs first (alphabetical order) and is **not** rolled back:

```sql
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

create or replace function tests.authenticate_as(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.clear_authentication() returns void
language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema tests to authenticated, anon;

-- fixture trip helper: creates trips for the fixture date (a Monday)
-- plpgsql (not sql) so this file can be created before generate_trips exists
create or replace function tests.make_fixture_trips() returns void
language plpgsql as $$ begin perform public.generate_trips('2030-01-07'::date); end $$;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
```

A typical test file, `supabase/tests/110_rls_guardian.test.sql`:

```sql
begin;
select plan(2);

select tests.make_fixture_trips();                                   -- as postgres

select tests.authenticate_as('a0000000-0000-0000-0000-000000000003'); -- PARENT_1
select is((select count(*)::int from public.students), 2, 'parent 1 sees exactly their 2 children');
select is((select count(*)::int from public.students
           where id = 'f0000000-0000-0000-0000-000000000003'), 0, 'parent 1 cannot see STUDENT_3');
select tests.clear_authentication();

select * from finish();
rollback;
```

Expecting an RPC error:
```sql
select throws_ok(
  $$ select public.end_trip('<trip>', false, null, gen_random_uuid(), now()) $$,
  'P0001', 'STUDENTS_ON_BOARD', 'cannot end with kids on board');
```

Finding fixture trip ids inside a test (as postgres, before `authenticate_as`):
```sql
select id from public.trips where route_id = 'e0000000-0000-0000-0000-0000000000a1' and service_date = '2030-01-07'
```
Store it with `\gset`, or wrap the test in a `do $$ ... $$` block. Simplest is a CTE in each assertion.

**Stop if:** after `tests.authenticate_as(X)`, `select auth.uid()` does not return X. Write it in BLOCKED.md.

---

## §2 RPC template (state-changing helper action)

```sql
create or replace function public.start_trip(
  p_trip_id          uuid,
  p_client_action_id uuid,
  p_device_time      timestamptz,
  p_lat              double precision default null,
  p_lng              double precision default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_prev   jsonb;
  v_trip   public.trips%rowtype;
  v_status public.trip_status;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- 1. idempotency: a replayed tap returns the first result
  v_prev := private.claim_client_action(p_client_action_id, 'start_trip');
  if v_prev is not null then
    return v_prev;
  end if;

  -- 2. lock + authorize + state check
  select * into v_trip from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_trip.helper_id is distinct from v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;
  if v_trip.status <> 'scheduled' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  -- 3. apply
  v_status := case when v_trip.direction = 'from_school'
                   then 'roll_call'::public.trip_status
                   else 'in_progress'::public.trip_status end;
  update public.trips set status = v_status, started_at = now() where id = p_trip_id;

  -- 4. audit
  perform private.log_trip_event(p_trip_id, null, 'trip_started',
                                 p_client_action_id, p_device_time, p_lat, p_lng);

  -- 5. (notifications / alerts would go here)

  -- 6. remember result for replays, return
  v_result := jsonb_build_object('trip_id', p_trip_id, 'status', v_status);
  perform private.save_client_action_result(p_client_action_id, v_result);
  return v_result;
end;
$$;

revoke execute on function public.start_trip(uuid, uuid, timestamptz, double precision, double precision) from public, anon;
grant  execute on function public.start_trip(uuid, uuid, timestamptz, double precision, double precision) to authenticated;
```

If any later step raises, the whole transaction rolls back, **including** the `client_actions` claim. A retry then works normally.

**Private schema privileges** (set once in T1.01):
```sql
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;            -- needed so RLS policies can call helpers
alter default privileges in schema private revoke execute on functions from public;
-- later (T1.11): grant execute on ONLY the RLS helper functions to authenticated
```

---

## §3 Outbox claim (`claim_due_notifications`)

```sql
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
```

The undo path is `private.cancel_pending_notifications`. It flips a still-`pending` row to `cancelled`. Because of the 10 s `send_after`, an undo within 10 s means the push never goes out.

---

## §4 Scheduling Edge Functions from pg_cron

Migration (T3.06). This needs the `pg_cron` and `pg_net` extensions plus two Vault secrets.

```sql
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
```

Plain-SQL jobs (no HTTP): `select cron.schedule('run-watchdogs', '* * * * *', $$ select public.run_watchdogs() $$);`

**Secrets are never in migrations.**
- **Local:** `supabase/seed.sql` creates them with `vault.create_secret(...)`, using the local URL and the local service-role key from `supabase status`. These are local demo values only.
- **Production:** the runbook (T6.01) creates them by hand.

**Stop if:**
- your pg_cron version rejects `'10 seconds'`
- the local functions URL from inside the DB container is unclear (try `http://host.docker.internal:54321` and `http://kong:8000`)
- functions reject the service key's `Authorization` header

Write the exact error to BLOCKED.md.

---

## §5 Background location task (mobile)

`apps/mobile/src/location/backgroundTask.ts`. **Import this file at the top of `app/_layout.tsx`** so the task is defined when the OS wakes the app in the background:

```ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { pingQueue } from './pingQueue';          // SQLite-backed (T3.15)
import { getActiveTripId, setActiveTripId } from './activeTrip';   // persisted in AsyncStorage, NOT React state
import { uploadPings } from './uploader';

export const BUS_LOCATION_TASK = 'bus-location-task';

TaskManager.defineTask(BUS_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const tripId = await getActiveTripId();
  if (!tripId) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  await pingQueue.add(tripId, locations.map((l) => ({
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    heading: l.coords.heading ?? null,
    speed_mps: l.coords.speed ?? null,
    accuracy_m: l.coords.accuracy ?? null,
    recorded_at: new Date(l.timestamp).toISOString(),
  })));
  await uploadPings().catch(() => {});   // best effort; the queue keeps them if offline
});

export async function startBusTracking(tripId: string, t: (k: string) => string) {
  await setActiveTripId(tripId);
  await Location.startLocationUpdatesAsync(BUS_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10_000,
    distanceInterval: 50,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: t('helper.tracking.notificationTitle'),
      notificationBody: t('helper.tracking.notificationBody'),
    },
  });
}

export async function stopBusTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(BUS_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BUS_LOCATION_TASK);
  }
  await setActiveTripId(null);
  await uploadPings().catch(() => {});
}
```

`app.config.ts` plugin entry:
```ts
['expo-location', {
  locationAlwaysAndWhenInUsePermission: 'Allow SafeRide to share the bus location with parents during a trip, even when the app is closed.',
  locationWhenInUsePermission: 'Allow SafeRide to show the bus position during a trip.',
  isIosBackgroundLocationEnabled: true,
  isAndroidBackgroundLocationEnabled: true,
  isAndroidForegroundServiceEnabled: true,
}]
```

**Stop if:** the expo-location plugin options or the Android foreground-service permissions in the current Expo docs differ from the above. Follow the docs, and note what changed in BLOCKED.md so the human knows.

---

## §6 Google Routes API (`supabase/functions/_shared/routes.ts`)

```ts
export type LatLng = { lat: number; lng: number };
export type EtaStop = { stop_id: string; lat: number; lng: number };
export type EtaResult = { stop_id: string; eta_at: string; source: 'routes_api' | 'fallback' };
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export async function routesEtas(
  origin: LatLng, stops: EtaStop[], apiKey: string, now: Date, fetchImpl: FetchLike
): Promise<EtaResult[]> {
  if (stops.length === 0) return [];
  const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const body = {
    origin: wp(origin),
    destination: wp(stops[stops.length - 1]),
    intermediates: stops.slice(0, -1).map(wp),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
  };
  const res = await fetchImpl(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.legs.duration',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ROUTES_HTTP_${res.status}`);
  const json = await res.json() as { routes?: { legs?: { duration?: string }[] }[] };
  const legs = json.routes?.[0]?.legs ?? [];
  if (legs.length !== stops.length) throw new Error('ROUTES_BAD_RESPONSE');
  let acc = 0;
  return stops.map((s, i) => {
    acc += parseInt((legs[i].duration ?? '0s').replace('s', ''), 10);
    return { stop_id: s.stop_id, eta_at: new Date(now.getTime() + acc * 1000).toISOString(), source: 'routes_api' };
  });
}
```

There is one leg between each pair of consecutive points, so `legs.length === stops.length`. Test it with a fixture JSON and a fake `fetchImpl`.

**Stop if:** the current Routes API docs show a different field mask, a different duration format, or an intermediate-waypoint limit below 5.

---

## §7 Offline action queue (`packages/shared/src/queue/`)

```ts
export const HELPER_RPCS = ['start_trip','set_boarded','confirm_roll_call','mark_dropped','undo_dropped',
  'mark_no_show','undo_no_show','arrive_at_school','mark_returned_to_school','end_trip'] as const;
export type HelperRpc = typeof HELPER_RPCS[number];

export type QueuedAction = {
  id: string;                 // = p_client_action_id (uuid v4)
  rpc: HelperRpc;
  args: Record<string, unknown>;   // already includes p_client_action_id, p_device_time, p_lat, p_lng
  createdAt: string;          // ISO, = p_device_time
  attempts: number;
  state: 'pending' | 'failed';
  error?: string;             // RPC error code when failed
};

export interface QueueStore {
  list(): Promise<QueuedAction[]>;        // any order; drain sorts by createdAt
  put(a: QueuedAction): Promise<void>;    // insert or replace by id
  remove(id: string): Promise<void>;
}

export type RpcCaller = (rpc: string, args: Record<string, unknown>) =>
  Promise<{ error: { message: string } | null }>;

export function buildAction(rpc: HelperRpc, args: Record<string, unknown>,
  ctx: { id: string; now: Date; lat: number | null; lng: number | null }): QueuedAction;

/** Sends pending actions oldest-first. Stops at the first network failure (keeps order). */
export async function drain(store: QueueStore, call: RpcCaller):
  Promise<{ sent: number; failed: number; stoppedOnNetwork: boolean }>;
```

How `drain` classifies each result:

| result | meaning | action |
|---|---|---|
| no error | success | `remove(id)` |
| `error.message` is in the RPC error-code list (`rpc.md` §Errors) | business error | `put({...a, state: 'failed', error: code})`, then **continue** |
| anything else (thrown exception, unknown message) | network | `put({...a, attempts: a.attempts + 1})`, then **stop** and return `stoppedOnNetwork: true` |

---

## §8 Expo push (`supabase/functions/_shared/expoPush.ts`)

```ts
export type PushMessage = {
  to: string; title: string; body: string; data: Record<string, string | null>;
  sound: 'default'; priority: 'high'; channelId: 'safety'; interruptionLevel?: 'time-sensitive';
};
export type Ticket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

/** POST https://exp.host/--/api/v2/push/send with up to 100 messages; returns tickets in the same order. */
export async function sendPush(messages: PushMessage[], fetchImpl: FetchLike, accessToken?: string): Promise<Ticket[]>;

/** POST https://exp.host/--/api/v2/push/getReceipts {ids}; returns map id → receipt. */
export async function getReceipts(ids: string[], fetchImpl: FetchLike, accessToken?: string):
  Promise<Record<string, { status: 'ok' } | { status: 'error'; details?: { error?: string } }>>;
```

- A receipt or ticket with `details.error === 'DeviceNotRegistered'` means the token is dead.
- **Stop if:** the Expo docs say `interruptionLevel` isn't supported. Then remove it and note it in BLOCKED.md.
