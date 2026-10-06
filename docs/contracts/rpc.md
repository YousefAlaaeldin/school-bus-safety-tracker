# Contract: RPC functions

Every function below is in schema `public`:
- `language plpgsql security definer set search_path = ''`
- `returns jsonb` unless stated otherwise

Copy the template in `skeletons.md` §2. Clients call them with `supabase.rpc('<name>', { p_...: ... })`.

## §Errors

Raise with `raise exception '<CODE>' using errcode = 'P0001';`. supabase-js then exposes `error.message === '<CODE>'`.

| code | meaning |
|---|---|
| `NOT_AUTHENTICATED` | `auth.uid()` is null |
| `NOT_AUTHORIZED` | Logged in but not allowed (wrong school, not the trip's helper, not a guardian…) |
| `NOT_FOUND` | Row id doesn't exist (or caller can't know it exists) |
| `INVALID_STATE` | The trip or student is not in a status that allows this action |
| `INVALID_INPUT` | Bad argument (empty reason, bad phone, too many pings…) |
| `STUDENTS_ON_BOARD` | `end_trip` without force while students are still `boarded` |
| `PAST_CUTOFF` | Absence change after the cutoff |
| `UNDO_WINDOW_PASSED` | Undo more than 2 minutes after the action |
| `INVITE_INVALID` | Code not found, or its link was revoked |
| `INVITE_USED` | Code already redeemed |
| `INVITE_EXPIRED` | Code past `expires_at` |

## §Common helper-action arguments

Every **helper trip action** (§3) ends with these four arguments, in this order:

```
p_client_action_id uuid,              -- generated on the phone, one per tap
p_device_time      timestamptz,       -- phone clock at the tap
p_lat              double precision default null,
p_lng              double precision default null
```

Each such RPC must:
1. Check `auth.uid()` (`NOT_AUTHENTICATED`).
2. Call `private.claim_client_action(p_client_action_id, '<rpc name>')`. If it returns non-null, **return that value immediately**. This is idempotent replay from the offline queue.
3. Lock the trip row `for update`, check `private.is_trip_helper` (`NOT_AUTHORIZED`), then check states (`INVALID_STATE`).
4. Apply changes, set `trip_students.updated_by = auth.uid()` and `updated_at = now()`.
5. Call `private.log_trip_event(...)`.
6. Enqueue notifications and alerts.
7. Call `private.save_client_action_result(p_client_action_id, v_result)` and return `v_result`.

---

## §1 Private helpers (schema `private`, not callable by clients)

| function | does |
|---|---|
| `private.normalize_phone(p text) returns text` | Strip spaces, dashes and brackets. `00…` → `+…`. `05XXXXXXXX` → `+9715XXXXXXXX`. `9715…` → `+9715…`. Return null if the result doesn't match `^\+[1-9][0-9]{7,14}$`. *immutable* |
| `private.make_point(p_lat float8, p_lng float8) returns geography` | `null` if either is null, else `st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography`. *immutable* |
| `private.claim_client_action(p_id uuid, p_rpc text) returns jsonb` | If a row with `p_id` exists: if it belongs to `auth.uid()`, return its `result`; else raise `NOT_AUTHORIZED`. Otherwise insert `(p_id, auth.uid(), p_rpc, '{}')` and return null |
| `private.save_client_action_result(p_id uuid, p_result jsonb)` | `update client_actions set result = p_result where id = p_id` |
| `private.log_trip_event(p_trip_id, p_student_id, p_type trip_event_type, p_client_action_id, p_device_time, p_lat, p_lng, p_payload jsonb default '{}')` | Insert into `trip_events` with `actor_id = auth.uid()` |
| `private.student_notification_params(p_trip_id, p_student_id) returns jsonb` | `{child_ar, child_en, bus_ar, bus_en, stop_ar, stop_en}` from students, buses (via trip) and stops (via trip_students.stop_id) |
| `private.enqueue_guardian_notifications(p_type notification_type, p_trip_id uuid, p_student_id uuid, p_extra jsonb, p_send_after timestamptz) returns integer` | For every `guardian_links` row of the student with `status = 'approved'` and `guardian_user_id is not null`, insert into `notification_outbox` with `params = student_notification_params(...) \|\| p_extra`, dedupe key per `data-model.md` §3. **On conflict (dedupe_key)**: `do update set status = 'pending', send_after = excluded.send_after, params = excluded.params, claimed_at = null where notification_outbox.status = 'cancelled'`. Returns the rows affected |
| `private.enqueue_admin_notifications(p_type notification_type, p_trip_id uuid, p_extra jsonb, p_dedupe_slot text default '-') returns integer` | One row per admin of the trip's school. `params = {bus_ar, bus_en} \|\| p_extra`. Dedupe key `{type}:{trip_id}:{p_dedupe_slot}:{recipient}`. On conflict do nothing |
| `private.cancel_pending_notifications(p_type notification_type, p_trip_id uuid, p_student_id uuid) returns integer` | `update ... set status = 'cancelled' where status = 'pending' and type/trip/student match` |
| `private.raise_alert(p_school_id, p_trip_id, p_type alert_type, p_severity alert_severity, p_dedupe_key text, p_payload jsonb default '{}') returns boolean` | Insert, `on conflict (dedupe_key) do nothing`. Return true if a row was inserted |
| `private.time_bucket_30m() returns text` | `floor(extract(epoch from now()) / 1800)::bigint::text` |
| `private.handle_new_user()` (trigger on `auth.users` after insert) | See §6 |
| `private.attach_guardian_user()` (trigger on `guardian_links` before insert or update of guardian_phone) | Normalize `guardian_phone` (raise `INVALID_INPUT` if null after normalizing), set `school_id` from the student, set `guardian_user_id` from `profiles.phone` if a match exists |
| `private.check_assignment_stop()` (trigger on `student_assignments` before insert/update) | Raise `INVALID_INPUT` if `stop_id` is not in `route_stops` for `route_id` |

**Hold time:** notifications for helper taps use `send_after = now() + interval '10 seconds'` so a mis-tap can be undone. Everything else uses `now()`.

---

## §2 Context, invites, staff (any signed-in user / admins)

### `get_my_context()` → jsonb
Any authenticated user. Returns:
```json
{
  "profile": {"id": "...", "phone": "+9715...", "email": null, "display_name": null, "locale": "ar"},
  "memberships": [{"school_id": "...", "role": "helper"}],
  "approved_links": 2,
  "pending_links": 0
}
```

### `set_my_locale(p_locale locale_code)` → void
Updates the caller's own profile.

### `create_invite(p_guardian_link_id uuid)` → `{code, expires_at}`
- **Who:** an admin of the link's school.
- **Errors:** `NOT_FOUND`; `INVALID_STATE` if the link is `revoked`.
- **Code:** 8 random characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Retry on unique collision.

### `redeem_invite(p_code text)` → `{student_id, link_id}`
- **Who:** any authenticated user. The link must have `guardian_user_id is null or = auth.uid()`.
- **Steps:** `upper(trim(p_code))`.
  - Not found, or the link is revoked → `INVITE_INVALID`.
  - The link's `guardian_user_id` is set to **a different user** → `INVITE_INVALID`. A code never moves a link away from another verified parent.
  - Already redeemed → `INVITE_USED`.
  - Expired → `INVITE_EXPIRED`.
- **Effects:**
  - The invite gets `redeemed_by` and `redeemed_at` filled.
  - The link gets `guardian_user_id = auth.uid()`, `status = 'approved'`, `approved_at = now()`.

### `approve_guardian_link(p_link_id uuid)` → void
- **Who:** an admin of the link's school.
- **Precondition:** `guardian_user_id is not null`, so a real person has verified that phone. Otherwise `INVALID_STATE`.
- **Effects:** `status = 'approved'`, `approved_by = auth.uid()`, `approved_at = now()`.

### `revoke_guardian_link(p_link_id uuid)` → void
- **Who:** an admin of the link's school.
- **Effects:**
  - `status = 'revoked'`.
  - Cancel every `pending` outbox row for that recipient and student.
  - Mark all of the link's unredeemed invite codes as expired (`expires_at = now()`).

### `invite_staff(p_school_id uuid, p_role membership_role, p_phone text, p_email text, p_display_name text)` → `{invite_id, membership_created}`
- **Who:** an admin of `p_school_id`.
- **Validation** (`INVALID_INPUT` on failure):
  - `helper` requires a phone, which must normalize.
  - `admin` requires an email; store it lowercased.
- **Effects:** insert into `staff_invites` (on conflict do nothing, then select the existing row). If a profile already exists with that phone or email:
  - insert the membership (on conflict do nothing)
  - set `claimed_by` and `claimed_at`
  - return `membership_created: true`

### `remove_staff(p_membership_id uuid)` → void
- **Who:** an admin of that membership's school.
- **Error:** `INVALID_INPUT` if it's the caller's own membership.
- **Effect:** deletes the membership.

### `acknowledge_alert(p_alert_id uuid)` → void
- **Who:** an admin of the alert's school.
- **Effect:** sets `acknowledged_by` and `acknowledged_at`. No-op if already acknowledged.

### `set_trip_helper(p_trip_id uuid, p_helper_id uuid)` → void
- **Who:** an admin of the trip's school.
- **Precondition:** `p_helper_id` has a `helper` membership in that school (`INVALID_INPUT`).
- **State:** trip status is `scheduled`, `roll_call` or `in_progress` (`INVALID_STATE`).

### `import_roster(p_school_id uuid, p_rows jsonb)` → `{students_created, links_created, errors}`
- **Who:** an admin.
- **Input:** `p_rows` is an array of:
  ```
  {name_en, name_ar, grade?, guardian_phone?, relationship?, guardian2_phone?, relationship2?}
  ```
- **Validate all rows first.** Error codes:
  - `NAME_EN_REQUIRED`, `NAME_AR_REQUIRED`
  - `BAD_PHONE` (doesn't normalize)
  - `BAD_RELATIONSHIP` (not in `mother/father/guardian/other`)

  Row numbers in `errors` are **1-based**, e.g. `[{"row": 3, "code": "BAD_PHONE"}]`.
- **If there are any errors:** return them and **insert nothing**.
- **Otherwise:** insert the students and their guardian links (relationship defaults to `guardian`).
- Max 2000 rows, else `INVALID_INPUT`.

---

## §3 Helper trip actions

All of these take the common arguments (see top) and follow the 7-step pattern. "Guardian notif" means `private.enqueue_guardian_notifications`, "admin notif" means `private.enqueue_admin_notifications`. "+10s" means `send_after = now() + interval '10 seconds'`.

| RPC (extra args first) | Allowed when | Effects | Returns |
|---|---|---|---|
| `start_trip(p_trip_id, …)` | trip `scheduled` | `from_school` → `roll_call`, `to_school` → `in_progress`; `started_at = now()`; event `trip_started` | `{trip_id, status}` |
| `set_boarded(p_trip_id, p_student_id, p_boarded boolean, …)` | `from_school`: trip `roll_call` or `in_progress`; `to_school`: trip `in_progress` | See §3.1 | `{student_id, status}` |
| `confirm_roll_call(p_trip_id, …)` | `from_school`, trip `roll_call` | See §3.2 | `{missing}` (int) |
| `mark_dropped(p_trip_id, p_student_id, …)` | `from_school`, trip `in_progress`, student `boarded` | → `dropped`; `dropped_at = now()`; `dropped_location = make_point`; `drop_distance_m = round(st_distance(dropped_location, stop.location))` when a location is given; event `student_dropped` with payload `{drop_distance_m}`; guardian notif `dropped` +10s `{time_iso: now()}` | `{student_id, status, drop_distance_m}` |
| `undo_dropped(p_trip_id, p_student_id, …)` | student `dropped` and `dropped_at > now() - 2 min` (else `UNDO_WINDOW_PASSED`) | → `boarded`; clear `dropped_*`; cancel pending `dropped`; event `student_drop_undone` | `{student_id, status}` |
| `mark_no_show(p_trip_id, p_student_id, …)` | `to_school`, trip `in_progress`, student `expected` | → `missing`; event `student_no_show`; guardian notif `no_show` +10s `{time_iso}`; alert `no_show` / `info` / key `no_show:{trip}:{student}` | `{student_id, status}` |
| `undo_no_show(p_trip_id, p_student_id, …)` | student `missing`, `to_school`, `updated_at > now() - 2 min` (else `UNDO_WINDOW_PASSED`) | → `expected`; cancel pending `no_show`; event `student_no_show_undone` | `{student_id, status}` |
| `arrive_at_school(p_trip_id, …)` | `to_school`, trip `in_progress`, `arrived_school_at is null` | All `boarded` → `dropped` (`dropped_at = now()`, `dropped_location`); `arrived_school_at = now()`; event `arrived_school` with payload `{count}`; guardian notif `arrived_school` for each (send now) `{time_iso}` | `{dropped}` (int) |
| `mark_returned_to_school(p_trip_id, p_student_id, …)` | `from_school`, trip `in_progress`, student `boarded` | → `returned_to_school`; event `student_returned`; guardian notif `returned_to_school` (now); alert `student_returned` / `warning` / key `student_returned:{trip}:{student}` | `{student_id, status}` |
| `end_trip(p_trip_id, p_force boolean, p_reason text, …)` | trip `in_progress` | See §3.3 | `{trip_id, status, forced}` |

### §3.1 `set_boarded`

**`p_boarded = true`:**
- From `expected`, `missing` or `absent_reported` → `boarded`, with `boarded_at = now()` and `boarded_location = make_point(...)`.
- Already `boarded` → no change; return the current status.
- `dropped` or `returned_to_school` → `INVALID_STATE`.
- Event `student_boarded`.
- Guardian notif +10s, `{time_iso: now()}`:
  - type `boarded` if `from_school`
  - type `picked_up` if `to_school`

**`p_boarded = false`:** allowed only from `boarded` (else `INVALID_STATE`).
- New status:
  - `missing` if `from_school` and the trip is `in_progress` (roll call is already confirmed)
  - otherwise `expected`
- Clear `boarded_at` and `boarded_location`.
- Event `student_unboarded`.
- `private.cancel_pending_notifications('boarded' or 'picked_up', ...)`.

### §3.2 `confirm_roll_call`
1. All `expected` → `missing`. Collect their ids and names.
2. The trip becomes `in_progress`, with `roll_call_confirmed_at = now()`.
3. Event `roll_call_confirmed` with payload `{missing_student_ids: [...]}`.
4. If missing > 0:
   - Alert `roll_call_missing` / `warning` / key `roll_call_missing:{trip}`, payload `{student_ids}`.
   - Admin notif `roll_call_missing` with `{count, names_ar, names_en}`. Names are joined with `'، '` for Arabic and `', '` for English.
   - If `schools.notify_parent_on_missing`: guardian notif `missing_child` (send now) `{time_iso: now()}` for each missing student.
5. Return `{missing: n}`.

### §3.3 `end_trip`
1. `v_on_board` = count of `boarded`.
2. If `v_on_board > 0` and `not p_force` → `STUDENTS_ON_BOARD`.
3. If `p_force` and `coalesce(trim(p_reason), '') = ''` → `INVALID_INPUT`.
4. If `to_school`: every remaining `expected` → `missing`, each with guardian notif `no_show` (send now) and an event `student_no_show`.
5. The trip becomes `completed`, with `ended_at = now()`, `end_forced = (p_force and v_on_board > 0)` and `end_reason = p_reason`.
6. Event `trip_ended` with payload `{on_board: v_on_board}`.
7. If forced with `v_on_board > 0`:
   - Alert `trip_forced_end` / `critical` / key `trip_forced_end:{trip}`.
   - Admin notif `trip_forced_end` with `{reason, count: v_on_board}`.

---

## §4 Location and absences

### `ingest_pings(p_trip_id uuid, p_pings jsonb)` → `{inserted}`
- **Who:** the trip's helper (`NOT_AUTHORIZED`). This RPC does **not** use client_action_id; duplicates are ignored by the unique `(trip_id, recorded_at)`.
- **Inactive trip:** if the trip status is not `roll_call` or `in_progress`, return `{inserted: 0}` without an error, so the phone's queue drains.
- **Input:** `p_pings` is an array (max 500, else `INVALID_INPUT`) of:
  ```
  {lat, lng, recorded_at, heading?, speed_mps?, accuracy_m?}
  ```
  Skip silently any item with lat outside [-90, 90], lng outside [-180, 180], or a missing `recorded_at`.
- **Effects:**
  - Insert into `location_pings`, on conflict do nothing.
  - Then upsert `bus_positions` (including `lat`/`lng`) from the ping with the greatest `recorded_at`, **only if** it is newer than the stored `recorded_at`.

### `report_absence(p_student_id uuid, p_service_date date, p_directions trip_direction[], p_reason text)` → `{created}`
- **Who:** an approved guardian of the student, or an admin of the student's school (`NOT_AUTHORIZED`).
- **Validation:** `p_directions` must be non-empty (`INVALID_INPUT`).
- **Cutoff** (guardians only; admins skip it):
  - If `p_service_date` < today in Asia/Dubai → `PAST_CUTOFF`.
  - For each direction, if a trip exists for that student, date and direction with `now() > scheduled_departure - absence_cutoff_minutes` → `PAST_CUTOFF`.
- **Effects:**
  - Insert one row per direction, on conflict do nothing.
  - Update matching `trip_students` from `expected` → `absent_reported`, with event `absence_reported` (actor = caller, client_action_id null).
- **Returns:** the number of rows inserted.

### `cancel_absence(p_absence_id uuid)` → void
- Same auth and cutoff rules as `report_absence`.
- Deletes the report.
- Matching `trip_students` go from `absent_reported` → `expected`, with event `absence_cancelled`.

### `register_push_token(p_token text, p_platform device_platform)` → void
Upsert on `expo_token`, setting `user_id = auth.uid()` and `last_seen_at = now()`. If the token belonged to another user, it moves to the caller.

### `unregister_push_token(p_token text)` → void
`delete from push_tokens where expo_token = p_token and user_id = auth.uid()`.

---

## §5 Service-only RPCs

Revoke execute from `public`, `anon` and `authenticated`, and grant to `service_role`. These are called by cron or Edge Functions.

### `generate_trips(p_service_date date)` → integer
Returns the number of trips created. For every active route (join its school):
1. Skip if `extract(dow from p_service_date)` is in `schools.weekend_days`.
2. Skip if `school_calendar` has `holiday` or `closure` on that date.
3. Skip if there is no `route_schedules` row for that weekday.
4. Departure time is the calendar override (`am_` for `to_school`, `pm_` for `from_school`), or else `departure_time`.
5. `scheduled_departure = (p_service_date + departure_time) at time zone schools.timezone`.
6. Insert the trip, `on conflict (route_id, service_date) do nothing`, with `helper_id = default_helper_id`.
7. **Only for newly inserted trips**, insert `trip_students` for each assignment where all of these hold:
   - the student is active
   - the weekday is in `weekdays`
   - `valid_from <= date` and (`valid_to is null` or `>= date`)

   Set `stop_sequence` from `route_stops`, and `status = 'absent_reported'` if an `absence_reports` row matches (student, date, direction), else `expected`.

### `claim_due_notifications(p_limit integer default 100)` → `table(id uuid, type notification_type, params jsonb, locale locale_code, tokens text[], trip_id uuid, student_id uuid)`
Claims rows using `for update skip locked` (skeleton §3):
- `status = 'pending'`, `send_after <= now()`
- `claimed_at is null or claimed_at < now() - interval '2 minutes'`

For each claimed row it sets `claimed_at = now()` and `attempts = attempts + 1`, and returns the row with the recipient's locale and an array of their `expo_token`s (it may be empty).

### `complete_notification(p_id uuid, p_status notification_status, p_ticket_ids text[], p_tokens text[], p_error text)` → void

| `p_status` | Effect |
|---|---|
| `'sent'` | `sent_at = now()`, `expo_ticket_ids = p_ticket_ids`, `sent_tokens = p_tokens` |
| `'failed'` | Store `error` |
| `'pending'` | Retry later: `claimed_at = null`, store `error`. **If `attempts >= 5`, set `'failed'` instead.** |

### `get_unchecked_receipts(p_limit integer default 300)` → `table(id uuid, ticket_ids text[], tokens text[])`
Rows with `status = 'sent'`, `sent_at < now() - interval '15 minutes'` and `receipts_checked_at is null`.

### `mark_receipts_checked(p_ids uuid[], p_dead_tokens text[])` → void
Sets `receipts_checked_at = now()` on the ids, and deletes from `push_tokens` where `expo_token = any(p_dead_tokens)`.

### `get_eta_work()` → jsonb array
Trips with `status = 'in_progress'` that have a `bus_positions` row with `recorded_at > now() - interval '2 minutes'`.

**Eligible students** have `eta_alert_sent_at is null` and:
- `from_school`: status `boarded`
- `to_school`: status `expected`

Per trip, list up to **5** distinct stops of eligible students, ordered by `stop_sequence`. Leave out trips with no eligible stops. Output:
```json
[{"trip_id": "...", "school_id": "...", "direction": "from_school", "eta_alert_minutes": 10,
  "origin": {"lat": 25.1, "lng": 55.2, "recorded_at": "..."},
  "stops": [{"stop_id": "...", "sequence": 2, "lat": 25.09, "lng": 55.21}]}]
```

### `apply_etas(p_trip_id uuid, p_etas jsonb)` → `{alerted}`
- **Input:** `p_etas` is `[{stop_id, eta_at, source}]`, where `source` is `routes_api` or `fallback`.
- **For each item, for the eligible students at that stop** (same eligibility as above), set `eta_at`, `eta_source` and `eta_updated_at = now()`.
- **Alert rule:** for each such student where `eta_at <= now() + eta_alert_minutes` and `eta_alert_sent_at is null`:
  - set `eta_alert_sent_at = now()`
  - guardian notif `eta_dropoff` (`from_school`) or `eta_pickup` (`to_school`), send now
  - params: `{time_iso: eta_at, minutes: greatest(1, ceil(seconds_until_eta / 60))}`
- **Returns:** the number of students alerted.

### `run_watchdogs()` → `{alerts_created}`
Only creates alerts and admin notifications whose keys are new. The slot `{bucket}` is `private.time_bucket_30m()`.

| check | condition | alert type / severity / key | admin notif |
|---|---|---|---|
| lost contact | trip `roll_call`/`in_progress` and `coalesce(bus_positions.recorded_at, trips.started_at) < now() - 5 min` | `lost_contact` / `warning` / `lost_contact:{trip}:{bucket}` | `lost_contact`, slot `{bucket}`, `{time_iso: last seen}` |
| stationary | trip `in_progress`, position `recorded_at > now() - 2 min`, at least 5 pings in the last 15 min, the oldest of them ≥ 14 min old, and **all** within 50 m of the current position | `stationary` / `warning` / `stationary:{trip}:{bucket}` | `stationary`, slot `{bucket}`, `{minutes: 15}` |
| overdue | trip `roll_call`/`in_progress` and `started_at < now() - 3 hours` | `overdue_trip` / `critical` / `overdue_trip:{trip}` | `overdue_trip`, `{time_iso: started_at}` |

### `purge_old_location_data()` → `{pings_deleted, positions_deleted}`
- Delete `location_pings` older than the school's `location_retention_days` (join through trips).
- Delete `bus_positions` whose trip is `completed` or `cancelled` and `ended_at < now() - 1 day`.

---

## §6 Sign-up trigger: `private.handle_new_user()`

This runs `after insert on auth.users for each row`:
1. `v_phone := private.normalize_phone(new.phone)` (Supabase stores the phone without `+`). `v_email := lower(new.email)`.
2. Insert into `profiles (id, phone, email)`, on conflict do nothing.
3. **Claim staff invites:** for each `staff_invites` row matching `v_phone` or `v_email` with `claimed_by is null`:
   - insert a membership (on conflict do nothing)
   - set `claimed_by` and `claimed_at`
4. **Attach guardian links:** `update guardian_links set guardian_user_id = new.id where guardian_phone = v_phone and guardian_user_id is null`. The status stays as it is: `pending` needs an admin approval or an invite code.
