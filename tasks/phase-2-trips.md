# Phase 2 — Trip flow: roll call, pickup, drop-off (both directions)

Goal: a helper runs a full morning or afternoon trip on the phone, even with bad signal. The server records every tap, raises missing-child alerts, and queues parent notifications. Pushes are actually sent in Phase 3.

DB tasks:
- One migration and one test file each. File names are given.
- `pnpm db:reset && pnpm db:test` must pass.
- Re-run `pnpm gen:types` after each migration.
- Tests get trip ids by selecting from `public.trips` (route id + `'2030-01-07'`) after `tests.make_fixture_trips()`.
- Tests set up state as postgres with direct `update`s when that's simpler than calling earlier RPCs.

---

## Server

### T2.01 — Action helpers + `start_trip`
- **Depends:** T1.23
- **Read:** `docs/contracts/rpc.md` §Common, §1 (`claim_client_action`, `save_client_action_result`, `log_trip_event`, `student_notification_params`, `time_bucket_30m`, `make_point`), §3 (`start_trip`); `docs/contracts/skeletons.md` §2
- **Files:** `supabase/migrations/20260101002100_trip_actions_base.sql`, `supabase/tests/300_start_trip.test.sql`
- **Assertions:**
  - HELPER_A starts A_PM → `{status: 'roll_call'}`, `started_at` is set, and 1 `trip_events` row of type `trip_started`
  - Calling again with the **same** `client_action_id` returns the same result with no error and still 1 event
  - Calling with a **new** id → `INVALID_STATE`
  - HELPER_A starts A_AM → `in_progress`
  - HELPER_B starts A_PM → `NOT_AUTHORIZED`
  - PARENT_1 starts it → `NOT_AUTHORIZED`
  - A random trip id → `NOT_FOUND`
  - A `client_action_id` already used by HELPER_A, sent by HELPER_PARENT → `NOT_AUTHORIZED`

### T2.02 — Notification and alert helpers
- **Depends:** T2.01
- **Read:** rpc.md §1 (`enqueue_guardian_notifications`, `enqueue_admin_notifications`, `cancel_pending_notifications`, `raise_alert`), data-model §3
- **Files:** `supabase/migrations/20260101002200_notify_helpers.sql`, `supabase/tests/310_notify_helpers.test.sql`
- **Assertions** (as postgres, calling the private functions directly):
  - Guardian enqueue `boarded` for STUDENT_1 on A_PM → 1 row (PARENT_1) with params containing `child_ar = 'سارة أحمد'`, `bus_en = 'Bus 12'`, `stop_en` = STOP_A1's label, plus the extra keys
  - Enqueue for STUDENT_5 → 1 row (HELPER_PARENT). The `+971500000099` link has no user, so no row for it
  - Enqueue for STUDENT_4 (pending link) → 0 rows
  - Enqueue the same again → still 1 row (dedupe)
  - Cancel → status `cancelled`; enqueue again → the same row is back to `pending`
  - Admin enqueue `roll_call_missing` → 1 row (ADMIN_A)
  - `raise_alert` twice with the same key → true, then false

### T2.03 — `set_boarded`
- **Depends:** T2.02
- **Read:** rpc.md §3 table row + §3.1
- **Files:** `supabase/migrations/20260101002300_set_boarded.sql`, `supabase/tests/320_set_boarded.test.sql`
- **Assertions:**
  - On A_PM in `roll_call`, board STUDENT_1 → `boarded`, an event, and an outbox row of type `boarded` with `send_after > now()`
  - Un-board during `roll_call` → `expected` and the outbox row is `cancelled`
  - Board again → the outbox row is `pending` again
  - With A_PM set to `in_progress` (as postgres), un-board → `missing`
  - A_AM board STUDENT_3 → outbox type `picked_up`
  - Boarding while the trip is `scheduled` → `INVALID_STATE`
  - Boarding a `dropped` student → `INVALID_STATE`
  - Boarding an `absent_reported` student → allowed

### T2.04 — `confirm_roll_call`
- **Depends:** T2.03
- **Read:** rpc.md §3.2
- **Files:** `supabase/migrations/20260101002400_confirm_roll_call.sql`, `supabase/tests/330_roll_call.test.sql`
- **Assertions:**
  - A_PM `roll_call` with STUDENT_1/2/3 boarded → returns `{missing: 2}`; STUDENT_4 and STUDENT_5 are `missing`; trip `in_progress`
  - One alert `roll_call_missing`
  - One admin outbox row whose `params.count = 2` and `names_en` contains "Yousef Khalid"
  - With `schools.notify_parent_on_missing = false` → 0 `missing_child` rows
  - With it set to true (fresh setup) → 1 `missing_child` row (HELPER_PARENT for STUDENT_5; STUDENT_4's link is pending)
  - Confirm on A_AM → `INVALID_STATE`
  - Confirm twice → `INVALID_STATE`
  - With everyone boarded → `{missing: 0}` and no alert

### T2.05 — `mark_dropped`, `undo_dropped`
- **Depends:** T2.04
- **Read:** rpc.md §3 table rows
- **Files:** `supabase/migrations/20260101002500_drop.sql`, `supabase/tests/340_drop.test.sql`
- **Assertions:**
  - A_PM `in_progress`, STUDENT_1 boarded: drop with lat/lng = STOP_A1's coordinates → `dropped`, `drop_distance_m` between 0 and 5, and an outbox `dropped` with hold
  - A drop about 1 km away (lat + 0.009) → `drop_distance_m` between 900 and 1100
  - Undo right away → `boarded`, `dropped_*` cleared, outbox `dropped` cancelled
  - Set `dropped_at = now() - interval '3 minutes'` (as postgres), then undo → `UNDO_WINDOW_PASSED`
  - Dropping an `expected` student → `INVALID_STATE`
  - Dropping on A_AM → `INVALID_STATE`

### T2.06 — `mark_no_show`, `undo_no_show`, `arrive_at_school`
- **Depends:** T2.05
- **Read:** rpc.md §3 table rows
- **Files:** `supabase/migrations/20260101002600_morning.sql`, `supabase/tests/350_morning.test.sql`
- **Assertions:**
  - A_AM `in_progress`: no-show STUDENT_3 → `missing`, outbox `no_show` (PARENT_2), and an alert `no_show:{trip}:{student}`
  - Undo → `expected` and the outbox cancelled
  - Board STUDENT_1 and STUDENT_2, then `arrive_at_school` → `{dropped: 2}`, both `dropped`, 2 outbox `arrived_school` rows (PARENT_1 ×2, one per child), and `arrived_school_at` set
  - Calling `arrive_at_school` again → `INVALID_STATE`
  - `mark_no_show` on A_PM → `INVALID_STATE`

### T2.07 — `mark_returned_to_school`, `end_trip`
- **Depends:** T2.06
- **Read:** rpc.md §3 table rows + §3.3
- **Files:** `supabase/migrations/20260101002700_end_trip.sql`, `supabase/tests/360_end_trip.test.sql`
- **Assertions:**
  - A_PM with STUDENT_1 boarded: `end_trip(false)` → `STUDENTS_ON_BOARD`
  - `end_trip(true, '')` → `INVALID_INPUT`
  - `end_trip(true, 'Breakdown')` → `completed`, `end_forced = true`, a `critical` alert, and admin outbox `trip_forced_end` with `count = 1`
  - **Fresh A_PM:** return STUDENT_1 → `returned_to_school`, guardian outbox `returned_to_school`, and a `warning` alert; then `end_trip(false)` succeeds with `end_forced = false`
  - **A_AM:** board STUDENT_1 → `arrive_at_school` → `end_trip(false)` → the remaining `expected` students become `missing`, with `no_show` outbox rows for students that have approved guardians
  - Ending a `scheduled` trip → `INVALID_STATE`

### T2.08 — `report_absence`, `cancel_absence`
- **Depends:** T2.07
- **Read:** rpc.md §4 (these two)
- **Files:** `supabase/migrations/20260101002800_absence.sql`, `supabase/tests/370_absence.test.sql`
- **Assertions:**
  - **PARENT_1:**
    - reports STUDENT_1 for `2030-01-07`, both directions, before trips exist → `{created: 2}`
    - `make_fixture_trips` → STUDENT_1 is `absent_reported` on both A trips
    - `cancel_absence` (after trips exist) → back to `expected`
  - **Trip-based cutoff:** set A_PM `scheduled_departure = now() + interval '30 minutes'` (cutoff 60) → report `from_school` → `PAST_CUTOFF`
  - **ADMIN_A**, same case → succeeds (admins skip the cutoff)
  - **Past date:** report for `2020-01-06` → `PAST_CUTOFF`
  - **Authorization:**
    - PARENT_2 reporting STUDENT_1 → `NOT_AUTHORIZED`
    - PARENT_3 (pending) reporting STUDENT_4 → `NOT_AUTHORIZED`
  - Empty `p_directions` → `INVALID_INPUT`

### T2.09 — Regenerate types
- **Depends:** T2.08
- **Files:** `packages/shared/src/db.types.ts`
- **Done when:** `pnpm gen:types && pnpm typecheck` passes.

---

## Shared logic (pure, vitest)

### T2.10 — Offline action queue core ⚠ hard
- **Depends:** T0.06
- **Read:** `docs/contracts/skeletons.md` §7, rpc.md §Errors and §Common
- **Files:** `packages/shared/src/queue/queue.ts`, `packages/shared/src/queue/memoryStore.ts`, `packages/shared/src/queue/queue.test.ts`, `packages/shared/src/index.ts`
- **Steps:**
  1. Implement the types and `buildAction` + `drain` from skeletons §7.
     - `buildAction` sets `args.p_client_action_id = ctx.id`, `args.p_device_time = ctx.now.toISOString()`, `args.p_lat` and `args.p_lng`.
  2. `memoryStore.ts` is an in-memory `QueueStore` for tests.
- **Tests:**
  - FIFO by `createdAt` even when inserted out of order
  - success removes
  - a business error (`INVALID_STATE`) marks failed and continues to the next
  - a thrown error stops, increments attempts, and leaves later actions untouched
  - an unknown error message counts as network
  - empty queue → `{sent: 0, failed: 0, stoppedOnNetwork: false}`
- **Done when:** `pnpm test` passes.

### T2.11 — Trip view reducer + helpers
- **Depends:** T2.10
- **Read:** rpc.md §3 + §3.1–3.3 (the status effects), data-model §1 (status table)
- **Files:** `packages/shared/src/trip/view.ts`, `packages/shared/src/trip/view.test.ts`, `packages/shared/src/geo.ts`, `packages/shared/src/time.ts`
- **Steps:**
  1. **`view.ts`:**
     ```ts
     export type TripRow = { id: string; direction: TripDirection; status: TripStatus };
     export type StudentRow = { student_id: string; stop_id: string; stop_sequence: number; status: StudentTripStatus;
                                name_ar: string; name_en: string; photo_path: string | null };
     export type StudentView = StudentRow & { pending: boolean; failedError?: string };
     export function applyPending(trip: TripRow, students: StudentRow[], actions: QueuedAction[]):
       { trip: TripRow; students: StudentView[] };
     export function groupByStop<T extends { stop_id: string; stop_sequence: number }>(rows: T[]):
       { stop_id: string; stop_sequence: number; rows: T[] }[];   // ordered by stop_sequence
     export function counts(rows: { status: StudentTripStatus }[]): Record<StudentTripStatus, number>;
     ```
     - `applyPending` applies each `pending` action, oldest first, using the same status rules as the server (rpc §3.1–3.3), and sets `pending: true` on touched students.
     - `failed` actions are **not** applied. Instead they set `failedError` on that student.
  2. **`geo.ts`:** `haversineMeters(a: LatLng, b: LatLng): number`.
  3. **`time.ts`:** `todayInDubai(now: Date): string`, giving `'YYYY-MM-DD'`.
- **Tests:**
  - every RPC's optimistic effect
  - un-board in `roll_call` vs `in_progress`
  - `confirm_roll_call` turns `expected` into `missing`
  - `arrive_at_school`
  - a failed action leaves the status unchanged and sets `failedError`
  - `groupByStop` order
  - haversine distance for STOP_A1 → STOP_A2 is about 1.8 km (±10%)
  - `todayInDubai` at `2030-01-06T21:00:00Z` → `'2030-01-07'`
- **Done when:** `pnpm test` passes.

---

## Mobile (helper)

### T2.12 — SQLite queue store + drain runner + `useHelperAction`
- **Depends:** T2.10, T1.30
- **Files:** `apps/mobile/src/queue/sqliteStore.ts`, `apps/mobile/src/queue/runner.ts`, `apps/mobile/src/queue/useHelperAction.ts`
- **Steps:**
  1. Install `npx expo install expo-sqlite expo-crypto @react-native-community/netinfo expo-location`.
  2. **`sqliteStore`:** a `QueueStore` on table `actions(id text primary key, json text not null)` in database `queue.db`.
  3. **`runner.ts`:**
     - `startQueueRunner()` drains on start, every 15 s, on NetInfo going back online, and on AppState `active`.
     - It drains with `drain(store, (rpc, args) => supabase.rpc(rpc, args))`, wrapped so that thrown errors count as network.
     - It is single-flight (never two drains at once).
     - After each drain it invalidates the react-query key `['trip', tripId]` for the affected trips.
     - It exposes a zustand store `{ pendingCount, failed: QueuedAction[], online }`.
  4. **`useHelperAction()`** returns `run(rpc, args)`, which:
     - gets the last known location, waiting at most 1.5 s, else null
     - calls `buildAction` with `id = Crypto.randomUUID()`
     - `store.put`, then triggers a drain
     - updates the local view immediately (the query cache key `['queue']`)
  5. Call `startQueueRunner()` from the helper layout.
- **Done when:** `pnpm typecheck` passes.

### T2.13 — `useTrip(tripId)` hook
- **Depends:** T2.12, T2.11
- **Files:** `apps/mobile/src/trip/useTrip.ts`
- **Steps:**
  1. A query `['trip', tripId]` loads:
     - the trip (`id`, `direction`, `status`, `school_id`)
     - bus labels and route names
     - the `trip_students` rows joined with students (names, photo_path)
     - stops from the view `stops_with_coords` (labels, `lat`, `lng`; see the note below)
     - the school's `drop_distance_warning_m`
  2. Subscribe to Realtime `postgres_changes` on `trip_students` (filter `trip_id=eq.{id}`) and `trips` (filter `id=eq.{id}`). On a change, invalidate the query.
  3. Return `applyPending(trip, students, queuedActionsForTrip)`, `groupByStop(...)`, `counts`, the stops map, `loading` and `error`.
- **Also create** migration `supabase/migrations/20260101002900_stop_coords_view.sql` with the view `stops_with_coords`, exactly as in data-model §2.6. RLS still applies, because the view is `security_invoker`.
- **Done when:** `pnpm db:reset`, `pnpm gen:types` and `pnpm typecheck` all pass.

### T2.14 — Helper home: today's trips
- **Depends:** T2.13, T1.32
- **Files:** `apps/mobile/app/(helper)/index.tsx`, `apps/mobile/app/(helper)/_layout.tsx`
- **Steps:**
  1. Query trips with `helper_id = me` and `service_date = todayInDubai(new Date())`, ordered by `scheduled_departure`.
  2. Each trip is a Card with:
     - a direction icon and label (`helper.home.morning` / `helper.home.afternoon`)
     - the route name, bus label and departure time (`formatTime`)
     - a status badge (`status.trip.*`)
     - a count of expected students
  3. Tapping a card opens `/(helper)/trip/{id}`.
  4. Empty state: `helper.home.noTrips`.
  5. A header button opens settings.
  6. On mount, set `lastRole = 'helper'`.
- **Done when:** `pnpm typecheck` passes. 📱 device check: HELPER_A sees trips after you run `select public.generate_trips(current_date)` in Studio on a weekday.

### T2.15 — Trip router screen + Start trip
- **Depends:** T2.14
- **Files:** `apps/mobile/app/(helper)/trip/[tripId]/index.tsx`
- **Steps:**
  1. Uses `useTrip`.
  2. If the status is `scheduled`, show a summary (route, bus, number of students, the first stop) and a big **Start trip** button. The button:
     - asks for **foreground** location permission (background comes in Phase 3)
     - runs `start_trip`
  3. Otherwise redirect by direction and status:

     | direction | status | screen |
     |---|---|---|
     | from_school | `roll_call` | `roll-call` |
     | from_school | `in_progress` | `drop` |
     | to_school | `in_progress` | `pickup` |
     | any | `completed` | a read-only summary with counts |
- **Done when:** `pnpm typecheck` passes.

### T2.16 — Roll call screen (afternoon)
- **Depends:** T2.15
- **Files:** `apps/mobile/app/(helper)/trip/[tripId]/roll-call.tsx`, `apps/mobile/src/trip/StudentRow.tsx`
- **Steps:**
  1. **`StudentRow`:**
     - a photo (`expo-image` with a signed URL, cached; fall back to initials)
     - the name in the current locale
     - a big toggle area: tapping flips `set_boarded`
     - visual states: boarded (green check), expected (empty circle), absent_reported (greyed, labelled "Absent", still tappable to board)
     - a `pending` spinner dot, and a `failedError` red text
  2. **Screen:**
     - a header with counts ("12 / 15 on board")
     - a search box
     - a sorted list: expected first, then boarded, then absent
     - a sticky bottom button **Confirm roll call**
  3. Keys go under `helper.rollCall.*`.
- **Done when:** `pnpm typecheck` passes.

### T2.17 — Roll call confirmation sheet
- **Depends:** T2.16
- **Files:** `apps/mobile/src/trip/ConfirmRollCallSheet.tsx`, `apps/mobile/app/(helper)/trip/[tripId]/roll-call.tsx`
- **Steps:**
  1. A modal listing the names of everyone still `expected`, with the text "These will be reported missing to the school".
  2. Buttons: "Go back", and "Confirm & report" (danger) → `confirm_roll_call`.
  3. If nobody is missing, show "Everyone is on board" with a primary Confirm.
- **Done when:** `pnpm typecheck` passes.

### T2.18 — Drop list screen (afternoon)
- **Depends:** T2.17
- **Files:** `apps/mobile/app/(helper)/trip/[tripId]/drop.tsx`, `apps/mobile/src/trip/StopSection.tsx`
- **Steps:**
  1. Sections from `groupByStop`. Each `StopSection` header shows the sequence number, stop label, area, building, landmark notes and how many are left there.
  2. The **next stop** (first section that still has `boarded` students) is highlighted and auto-scrolled into view.
  3. Rows show `boarded` students with a **Dropped** button. `dropped` students are shown struck through with the time. `missing` students show a "Missing" badge in a separate top section.
  4. The header shows "on board N".
  5. Keys go under `helper.drop.*`.
- **Done when:** `pnpm typecheck` passes.

### T2.19 — Drop safeguards: distance check, undo, drop all
- **Depends:** T2.18
- **Files:** `apps/mobile/src/trip/useDropAction.ts`, `apps/mobile/src/ui/UndoSnackbar.tsx`, `apps/mobile/src/trip/StopSection.tsx`
- **Steps:**
  1. **`useDropAction`:**
     - gets the current position (timeout 3 s)
     - if `haversineMeters(position, stop) > drop_distance_warning_m`, shows an Alert: `helper.drop.farWarning` with `{{meters}}`, and buttons Cancel / "Drop anyway"
     - then runs `mark_dropped`
  2. **`UndoSnackbar`:** shown for **10 s** after a drop, with an Undo button → `undo_dropped` for that student.
  3. **"Drop all at this stop"** in the section header: one distance check, then `mark_dropped` for each boarded student there.
- **Done when:** `pnpm typecheck` passes.

### T2.20 — Pickup screen (morning)
- **Depends:** T2.19
- **Files:** `apps/mobile/app/(helper)/trip/[tripId]/pickup.tsx`
- **Steps:**
  1. Sections by stop. The next stop is the first one with `expected` students.
  2. Each `expected` row has two buttons: **Picked up** (`set_boarded` true) and **No-show** (`mark_no_show`), each followed by a 10 s `UndoSnackbar` (`set_boarded` false / `undo_no_show`).
  3. Boarded students are shown with a check.
  4. A sticky bottom button **Arrived at school** appears when no stops with `expected` students remain, or the helper taps "Skip to school".
  5. Keys go under `helper.pickup.*`.
- **Done when:** `pnpm typecheck` passes.

### T2.21 — Arrive at school, Return to school, End trip
- **Depends:** T2.20
- **Files:** `apps/mobile/src/trip/EndTripSheet.tsx`, `apps/mobile/app/(helper)/trip/[tripId]/drop.tsx`, `apps/mobile/app/(helper)/trip/[tripId]/pickup.tsx`
- **Steps:**
  1. **Pickup:** "Arrived at school" → a confirmation listing the boarded count → `arrive_at_school` → then show **End trip**.
  2. **Drop:** a row long-press menu with "Return to school" → confirm → `mark_returned_to_school`.
  3. **`EndTripSheet`** (both screens, from a header button):
     - if no one is boarded → confirm → `end_trip(false)`
     - otherwise list the names still on board, and offer "End anyway", which needs a reason text (required) → `end_trip(true, reason)`
  4. Handle `STUDENTS_ON_BOARD` from the server by reopening the sheet.
  5. After ending, go back to helper home.
- **Done when:** `pnpm typecheck` passes.

### T2.22 — Sync status indicator
- **Depends:** T2.12
- **Files:** `apps/mobile/src/queue/SyncBadge.tsx`, `apps/mobile/app/(helper)/_layout.tsx`
- **Steps:**
  1. A header-right badge:
     - grey cloud + `helper.sync.offline` when offline
     - spinner + `{{count}}` when `pendingCount > 0`
     - a red dot when there are failed actions (tap → a list of failed actions with their `errors.*` messages and a Dismiss button)
     - hidden when all is synced
  2. Add it to every helper trip screen's header.
- **Done when:** `pnpm typecheck` passes. 📱 device check: in airplane mode, tap 3 boards → the badge shows 3 → turn airplane mode off → it syncs to 0 and the server shows 3 events.

### T2.23 — Trip map tab
- **Depends:** T2.13
- **Files:** `apps/mobile/app/(helper)/trip/[tripId]/map.tsx`, `apps/mobile/src/maps/TripMap.tsx`
- **Steps:**
  1. Install `npx expo install react-native-maps`.
  2. **`TripMap`:**
     - `MapView` with `showsUserLocation`
     - a numbered marker per stop (sequence), coloured: done = grey, next = primary, upcoming = dark
     - a school stop icon
     - fit to coordinates on load
  3. Link to it from the drop/pickup header with a "Map" button.
  4. Use `provider={PROVIDER_GOOGLE}` only on Android.
- **Done when:** `pnpm typecheck` passes. 📱 device check: the map renders on Android (it needs the Maps key in the build env) and iOS.

---

## Dashboard

### T2.30 — Today's trips page
- **Depends:** T1.56, T2.09
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/trips/page.tsx`
- **Steps:**
  1. A date picker defaulting to today (Dubai). Show trips for that date.
  2. Columns: route, direction, bus, helper, status badge, counts (boarded / missing / dropped / absent) and departure time.
  3. A "Change helper" action → a dialog → `set_trip_helper`.
  4. Link each row to the detail page.
- **Done when:** the build succeeds.

### T2.31 — Trip detail + audit timeline
- **Depends:** T2.30
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/trips/[tripId]/page.tsx`, `apps/web/src/components/dashboard/TripTimeline.tsx`
- **Steps:**
  1. A students table: name, stop, status badge, boarded_at, dropped_at, and `drop_distance_m` (highlight if over the school threshold).
  2. **Timeline:** `trip_events` ordered by `server_time`, showing:
     - the type label (`dashboard.events.<type>`) with the student and actor names
     - server time, plus device time when it differs by more than 60 s ("synced late")
     - a small map link if there's a location
  3. Realtime refresh on `trip_students` changes.
- **Done when:** the build succeeds.

### T2.32 — Alerts inbox
- **Depends:** T1.56, T2.09
- **Files:** `apps/web/src/app/[locale]/dashboard/(app)/alerts/page.tsx`, `apps/web/src/components/dashboard/AlertsList.tsx`
- **Steps:**
  1. A list of alerts, newest first: a severity badge, the type label (`dashboard.alerts.<type>`), the trip link, payload details (e.g. names of missing students), the time, and an acknowledge button → `acknowledge_alert`.
  2. Filter: unacknowledged / all.
  3. A Realtime subscription to `alerts` inserts new rows live, and plays a short sound for `critical` ones.
  4. The sidebar nav shows an unacknowledged count badge.
- **Done when:** the build succeeds.
