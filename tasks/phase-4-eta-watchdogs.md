# Phase 4 — "10 minutes away" alerts, watchdogs, live board

Goal:
- Parents get the "about 10 minutes" alert, once, at the right time.
- The school is alerted when a bus goes silent, stops moving, or runs far too long.
- The dashboard shows every bus live.

---

### T4.01 — `get_eta_work` RPC
- **Depends:** T3.14
- **Read:** rpc.md §5 (`get_eta_work`)
- **Files:** `supabase/migrations/20260101004000_eta_work.sql`, `supabase/tests/500_eta_work.test.sql`
- **Assertions** (as postgres; set state with updates and insert `bus_positions` directly):
  - A_PM `in_progress` with STUDENT_1, STUDENT_3 and STUDENT_4 boarded, and a position recorded now → 1 item with stops `[STOP_A1, STOP_A2, STOP_A3]` in sequence order, `origin` = the position, and `eta_alert_minutes = 10`
  - Set STUDENT_1 and STUDENT_2 `eta_alert_sent_at` → STOP_A1 is gone
  - A position recorded 5 min ago → the trip is not listed
  - A_AM `in_progress` with STUDENT_3 `expected` → listed, with STOP_A2
  - A trip with no eligible students → not listed
  - Authenticated callers → `42501`
- **Done when:** `pnpm db:test` passes.

### T4.02 — `apply_etas` RPC
- **Depends:** T4.01
- **Read:** rpc.md §5 (`apply_etas`)
- **Files:** `supabase/migrations/20260101004100_apply_etas.sql`, `supabase/tests/510_apply_etas.test.sql`
- **Assertions:**
  - ETA for STOP_A1 = now + 25 min → `eta_at` is set on STUDENT_1/2, `{alerted: 0}`, and no outbox rows
  - ETA = now + 8 min → `{alerted: 2}`, 2 outbox `eta_dropoff` rows (PARENT_1, one per child) with `params.minutes` = 8 and `params.time_iso` = the ETA, and `eta_alert_sent_at` is set
  - Applying again with now + 5 min → `{alerted: 0}` (**fires once**), but `eta_at` is updated
  - For A_AM → type `eta_pickup`
  - ETA in the past → `minutes = 1`
- **Done when:** `pnpm db:test` passes.

### T4.03 — Google Routes API client
- **Depends:** T0.06
- **Read:** skeletons §6
- **Files:** `supabase/functions/_shared/routes.ts`, `supabase/functions/_shared/routes.test.ts`, `supabase/functions/_shared/fixtures/routes-3-legs.json`
- **Steps:**
  1. Open the current Routes API `computeRoutes` docs. Confirm the request shape, the field mask, the `duration` string format, and the intermediate-waypoint limit (≥ 5).
  2. Implement per skeletons §6.
  3. The fixture holds a realistic response with 3 legs: `"300s"`, `"420s"`, `"180s"`.
- **Tests:**
  - with the fixture → the 3 ETAs are now + 300, + 720 and + 900 s
  - the request body has 2 intermediates and the correct destination
  - the headers contain the field mask and API key
  - HTTP 403 → throws `ROUTES_HTTP_403`
  - a leg count mismatch → throws `ROUTES_BAD_RESPONSE`
- **Done when:** `pnpm test` passes.
- **Stop if:** the docs differ from the skeleton.

### T4.04 — Straight-line fallback estimator
- **Depends:** T4.03
- **Files:** `supabase/functions/_shared/fallbackEta.ts`, `supabase/functions/_shared/fallbackEta.test.ts`
- **Steps:**
  1. `fallbackEtas(origin, stops, now)`: walk origin → stop1 → stop2 … summing haversine distance × **1.4** (road factor), at **25 km/h** average, plus **60 s dwell per stop already passed**.
  2. Returns `source: 'fallback'`.
  3. Copy the haversine function into this file. Don't import from packages (Deno).
- **Tests:** 1.8 km straight → 1.8 × 1.4 = 2.52 km at 25 km/h ≈ 363 s for the first stop; the second stop includes +60 s dwell.
- **Done when:** `pnpm test` passes.

### T4.05 — Edge Function `eta-tick` + cron ⚠ hard
- **Depends:** T4.02, T4.04, T3.06
- **Files:** `supabase/functions/eta-tick/index.ts`, `supabase/migrations/20260101004200_cron_eta.sql`
- **Steps:**
  1. Call `rpc('get_eta_work')`.
  2. For each trip, in parallel with a concurrency limit of 5:
     - if `ROUTES_MOCK=1` or there's no API key → use `fallbackEtas`
     - else try `routesEtas`, and on any error use `fallbackEtas` and `console.error` the reason
  3. Call `rpc('apply_etas', {p_trip_id, p_etas})`.
  4. Return `{trips, alerted}`.
  5. Cron: `eta-tick` every minute (`'* * * * *'`), HTTP like skeletons §4.
- **Done when:** `pnpm db:reset` succeeds, and the function serves and returns JSON for an active trip with `ROUTES_MOCK=1`.

### T4.06 — Watchdogs
- **Depends:** T4.01, T2.02
- **Read:** rpc.md §5 (`run_watchdogs`), data-model §3
- **Files:** `supabase/migrations/20260101004300_watchdogs.sql`, `supabase/tests/520_watchdogs.test.sql`
- **Steps:** implement `run_watchdogs()` and schedule it every minute as plain SQL cron (skeletons §4).
- **Assertions:**
  - **Lost contact:** A_PM `in_progress`, position `recorded_at = now() - 6 min` → 1 `lost_contact` alert and 1 admin outbox row. Running again → no new rows (same bucket).
  - **Stationary:** A_PM `in_progress`, position fresh, 6 `location_pings` across the last 15 minutes (oldest 14.5 min old), all within 20 m → `stationary` alert. With one ping 200 m away → none.
  - **Overdue:** A_AM `started_at = now() - 4 hours` → `overdue_trip` (`critical`).
  - Nothing fires for `completed` trips.
- **Done when:** `pnpm db:test` passes.

### T4.07 — Parent map: ETA + approaching state
- **Depends:** T4.02, T3.11
- **Files:** `apps/mobile/app/(parent)/track/[tripId].tsx`, `apps/mobile/src/parent/useParentHome.ts`
- **Steps:**
  1. Subscribe to `trip_students` for this trip (RLS limits it to the parent's own child) to read `eta_at` and `eta_source`.
  2. The bottom card shows "Arriving about {{time}}" (`formatTime`). When `eta_source = 'fallback'`, add "(estimate)".
  3. When `eta_at - now < 10 min`, the card turns highlighted.
- **Done when:** `pnpm typecheck` passes.

### T4.08 — Dashboard live board
- **Depends:** T2.30, T3.14
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/page.tsx`, `apps/web/src/components/dashboard/LiveBoard.tsx`, `apps/web/src/components/maps/BusesMap.tsx`
- **Steps:**
  1. **`BusesMap`:** a Google map with one marker per active trip of the school (from `bus_positions` joined to trips/buses), labelled with the bus label. Realtime on `bus_positions` filtered by `school_id=eq.{id}`. A marker turns grey when `recorded_at` is more than 2 min old.
  2. **Side list** of today's active trips, each with: status badge, counts (on board / missing / dropped), last update ("x s ago"), and an unacknowledged alerts count, linking to the trip detail.
  3. Realtime on `trips` and `trip_students` refreshes the counts.
- **Done when:** the build succeeds.

### T4.09 — GPS replay tool
- **Depends:** T3.14
- **Files:** `tools/gps-replay/package.json`, `tools/gps-replay/replay.ts`, `tools/gps-replay/routes/a-pm.geojson`
- **Steps:**
  1. **`a-pm.geojson`:** a LineString from STOP_A_SCHOOL → A1 → A2 → A3 (data-model §5 coordinates), with at least 2 intermediate points between each pair.
  2. **`replay.ts`** (run with `tsx`):
     - args `--trip <id> --phone +971500000002 --otp 123456 --speed 10 --interval 10`
     - signs in via OTP with supabase-js (anon key from env)
     - walks the line at **30 km/h × speed**, emitting a ping every `interval` **simulated** seconds
     - sends a batch via `ingest_pings` every real second
     - pauses 30 simulated seconds at each stop
     - logs progress
  3. Add a script to the root package.json: `"gps:replay": "tsx tools/gps-replay/replay.ts"`.
- **Done when:** `pnpm typecheck` passes. Against a started A_PM trip, `bus_positions` moves.

### T4.10 — End-to-end scenario test (local)
- **Depends:** T4.09, T4.05, T4.06
- **Files:** `tools/scenario/afternoon.test.ts`, `tools/scenario/package.json`
- **Steps:** a vitest test, run with `pnpm --filter scenario test`; it is **not** part of the default `pnpm test`, because it needs the local stack running. It:
  1. Uses the service-role client to call `generate_trips(today)` (skip the test on Dubai weekends).
  2. Signs in as HELPER_A and runs `start_trip`, `set_boarded` × 3 and `confirm_roll_call`.
  3. Runs the replay at ×20 speed in-process (import a `replayOnce` function from T4.09; refactor it to export one).
  4. Calls the `eta-tick` function URL directly each simulated minute (`ROUTES_MOCK=1`).
- **Asserts:**
  - each boarded student's guardians got **exactly one** `eta_dropoff` outbox row
  - it was created when the fallback ETA was ≤ 10 min
  - `mark_dropped` for each → `dropped` rows exist
  - the trip ends cleanly
- **Done when:** `pnpm --filter scenario test` passes with the local stack and functions running.

### H4.1 — Ride-along test 👤
Use one real route, a car and 2 phones. Point the app at a dev cloud project or LAN, with **`ROUTES_MOCK=0`** and a real Routes key. Check:
- The 10-min alert arrives between 8 and 12 minutes before each stop, once.
- In dead zones, pings and taps sync afterwards.
- Lock the screen for 20 minutes: tracking continues.
- Battery drain on the helper phone over the trip. Note the percentage.
