# Contract: Data model

This is the source of truth for every table, column, enum, index and fixture. Implement it **exactly**: the same names, types, nullability and defaults. If something you need is missing here, write it in `tasks/BLOCKED.md`. Do not invent it.

Conventions:
- Every table is in schema `public` unless stated otherwise.
- `id uuid primary key default gen_random_uuid()` unless stated otherwise.
- `created_at timestamptz not null default now()` on every table unless stated otherwise.
- Foreign keys are `on delete cascade` unless stated otherwise.
- RLS is **enabled** on every table (policies are in `rls.md`).
- Helper SQL functions live in schema **`private`**, which is not exposed through the API.

---

## §1 Enums

```sql
create type public.membership_role      as enum ('admin', 'helper');
create type public.link_status          as enum ('pending', 'approved', 'revoked');
create type public.trip_direction       as enum ('to_school', 'from_school');
create type public.trip_status          as enum ('scheduled', 'roll_call', 'in_progress', 'completed', 'cancelled');
create type public.student_trip_status  as enum ('expected', 'absent_reported', 'boarded', 'missing', 'dropped', 'returned_to_school');
create type public.calendar_day_type    as enum ('holiday', 'closure', 'early_dismissal', 'ramadan_hours');
create type public.locale_code          as enum ('ar', 'en');
create type public.device_platform      as enum ('ios', 'android');
create type public.eta_source           as enum ('routes_api', 'fallback');
create type public.notification_status  as enum ('pending', 'cancelled', 'sent', 'failed');
create type public.alert_severity       as enum ('info', 'warning', 'critical');
create type public.notification_type    as enum (
  'boarded', 'picked_up', 'no_show', 'eta_dropoff', 'eta_pickup', 'dropped',
  'arrived_school', 'returned_to_school', 'missing_child',
  'roll_call_missing', 'trip_forced_end', 'lost_contact', 'stationary', 'overdue_trip'
);
create type public.alert_type           as enum (
  'roll_call_missing', 'no_show', 'student_returned', 'trip_forced_end',
  'lost_contact', 'stationary', 'overdue_trip'
);
create type public.trip_event_type      as enum (
  'trip_started', 'student_boarded', 'student_unboarded', 'roll_call_confirmed',
  'student_dropped', 'student_drop_undone', 'student_no_show', 'student_no_show_undone', 'student_returned',
  'arrived_school', 'trip_ended', 'absence_reported', 'absence_cancelled'
);
```

There is **no "guardian" membership.** A user is a parent if they have at least one `guardian_links` row with `status = 'approved'`.

### What `student_trip_status` means in each direction

| status | `from_school` (afternoon) | `to_school` (morning) |
|---|---|---|
| `expected` | Should board at school | Should be picked up at their stop |
| `absent_reported` | Parent said not coming | Parent said not coming |
| `boarded` | On the bus | Picked up, on the bus |
| `missing` | Not on the bus at roll-call confirm | No-show at their stop |
| `dropped` | Dropped at home stop | Arrived at school |
| `returned_to_school` | Couldn't be dropped; back to school | (not used) |

---

## §2 Tables

### §2.1 `schools`
| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| name_ar | text | no | |
| name_en | text | no | |
| emirate | text | no | |
| timezone | text | no | `'Asia/Dubai'` |
| weekend_days | smallint[] | no | `'{0,6}'` |
| notify_parent_on_missing | boolean | no | false |
| eta_alert_minutes | integer | no | 10 (check 1–60) |
| absence_cutoff_minutes | integer | no | 60 (check 0–720). Minutes before `trips.scheduled_departure` |
| location_retention_days | integer | no | 60 (check 1–365) |
| drop_distance_warning_m | integer | no | 200 |
| created_at | timestamptz | no | now() |

`emirate` must be one of: `'abu_dhabi','dubai','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah'` (check constraint).

### §2.2 `school_calendar`
| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| school_id | uuid → schools | no | |
| date | date | no | |
| type | calendar_day_type | no | |
| note | text | yes | |
| am_departure_override | time | yes | |
| pm_departure_override | time | yes | |
| created_at | timestamptz | no | now() |

Unique `(school_id, date)`.
- `holiday` and `closure`: no trips are generated that day.
- The overrides replace `route_schedules.departure_time` for `to_school` (am) and `from_school` (pm) routes.

### §2.3 `profiles`, `memberships`, `staff_invites`

**profiles**

| column | type | null | default |
|---|---|---|---|
| id | uuid PK → auth.users(id) on delete cascade | no | |
| phone | text, unique | yes | E.164, e.g. `+971500000003` |
| email | text | yes | |
| display_name | text | yes | |
| locale | locale_code | no | `'ar'` |
| created_at | timestamptz | no | now() |

**memberships**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid → profiles | no | |
| school_id | uuid → schools | no | |
| role | membership_role | no | |
| created_at | timestamptz | no | now() |

Unique `(user_id, school_id, role)`.

**staff_invites**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| school_id | uuid → schools | no | |
| role | membership_role | no | |
| phone | text | yes | E.164, used for helpers |
| email | text | yes | lowercase, used for admins |
| display_name | text | yes | |
| claimed_by | uuid → profiles on delete set null | yes | |
| claimed_at | timestamptz | yes | |
| created_at | timestamptz | no | now() |

Check: `phone is not null or email is not null`. Unique `(school_id, role, phone)` and unique `(school_id, role, email)`.

### §2.4 `students`
| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| school_id | uuid → schools | no | |
| name_ar | text | no | |
| name_en | text | no | |
| grade | text | yes | |
| photo_path | text | yes | Storage path `student-photos/{school_id}/{student_id}.jpg` |
| active | boolean | no | true |
| created_at | timestamptz | no | now() |

### §2.5 `guardian_links`, `invite_codes`

**guardian_links**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| student_id | uuid → students | no | |
| school_id | uuid → schools | no | (denormalized for RLS; must equal the student's school, enforced by trigger) |
| guardian_phone | text | no | E.164 |
| guardian_user_id | uuid → profiles on delete set null | yes | Filled automatically when a profile with this phone exists |
| relationship | text | no | `'guardian'`; check in `('mother','father','guardian','other')` |
| status | link_status | no | `'pending'` |
| can_track | boolean | no | true |
| approved_by | uuid → profiles on delete set null | yes | |
| approved_at | timestamptz | yes | |
| created_at | timestamptz | no | now() |

Unique `(student_id, guardian_phone)`.

**invite_codes**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| guardian_link_id | uuid → guardian_links | no | |
| code | text, unique | no | 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` |
| expires_at | timestamptz | no | now() + interval '14 days' |
| redeemed_by | uuid → profiles on delete set null | yes | |
| redeemed_at | timestamptz | yes | |
| created_at | timestamptz | no | now() |

### §2.6 Buses, stops, routes

**buses**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| school_id | uuid → schools | no | |
| label_ar | text | no | e.g. `حافلة 12` |
| label_en | text | no | e.g. `Bus 12` |
| plate | text | yes | |
| capacity | integer | yes | |
| created_at | timestamptz | no | now() |

**stops**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| school_id | uuid → schools | no | |
| label_ar | text | no | |
| label_en | text | no | |
| location | geography(Point, 4326) | no | |
| area | text | yes | |
| building | text | yes | Villa or building number |
| makani_number | text | yes | Dubai only, 10 digits |
| landmark_notes | text | yes | |
| is_school | boolean | no | false. True for the school's own gate stop |
| created_at | timestamptz | no | now() |

GIST index on `location`.

**View `stops_with_coords`** (created in T2.13): `create view public.stops_with_coords with (security_invoker = true) as select s.*, extensions.st_y(s.location::extensions.geometry) as lat, extensions.st_x(s.location::extensions.geometry) as lng from public.stops s;`. Clients read stop coordinates **only** through this view.

**routes**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| school_id | uuid → schools | no | |
| bus_id | uuid → buses on delete restrict | no | |
| direction | trip_direction | no | |
| name_ar | text | no | |
| name_en | text | no | |
| default_helper_id | uuid → profiles on delete set null | yes | |
| active | boolean | no | true |
| created_at | timestamptz | no | now() |

**route_schedules**: PK `(route_id, weekday)`

| column | type | null | default |
|---|---|---|---|
| route_id | uuid → routes | no | |
| weekday | smallint | no | check 0–6 |
| departure_time | time | no | Local school time |

**route_stops**: PK `(route_id, stop_id)`, unique `(route_id, sequence)`

| column | type | null | default |
|---|---|---|---|
| route_id | uuid → routes | no | |
| stop_id | uuid → stops on delete restrict | no | |
| sequence | integer | no | 1-based, in driving order |

**student_assignments**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| student_id | uuid → students | no | |
| route_id | uuid → routes | no | |
| stop_id | uuid → stops on delete restrict | no | Must be in `route_stops` for that route (enforced by trigger) |
| weekdays | smallint[] | no | `'{1,2,3,4,5}'` |
| valid_from | date | no | current_date |
| valid_to | date | yes | |
| created_at | timestamptz | no | now() |

Unique `(student_id, route_id)`.

### §2.7 Trips

**trips**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| school_id | uuid → schools | no | |
| route_id | uuid → routes on delete restrict | no | |
| bus_id | uuid → buses on delete restrict | no | |
| helper_id | uuid → profiles on delete set null | yes | |
| direction | trip_direction | no | |
| service_date | date | no | |
| scheduled_departure | timestamptz | no | |
| status | trip_status | no | `'scheduled'` |
| started_at | timestamptz | yes | |
| roll_call_confirmed_at | timestamptz | yes | |
| arrived_school_at | timestamptz | yes | |
| ended_at | timestamptz | yes | |
| end_forced | boolean | no | false |
| end_reason | text | yes | |
| created_at | timestamptz | no | now() |

Unique `(route_id, service_date)`. Index `(helper_id, service_date)`, index `(school_id, service_date)`.

**trip_students**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| trip_id | uuid → trips | no | |
| student_id | uuid → students | no | |
| stop_id | uuid → stops on delete restrict | no | |
| stop_sequence | integer | no | |
| status | student_trip_status | no | `'expected'` |
| boarded_at | timestamptz | yes | |
| boarded_location | geography(Point, 4326) | yes | |
| dropped_at | timestamptz | yes | |
| dropped_location | geography(Point, 4326) | yes | |
| drop_distance_m | integer | yes | Distance from the stop when the drop was ticked |
| updated_by | uuid → profiles on delete set null | yes | |
| updated_at | timestamptz | no | now() |
| eta_at | timestamptz | yes | |
| eta_source | eta_source | yes | |
| eta_updated_at | timestamptz | yes | |
| eta_alert_sent_at | timestamptz | yes | |

Unique `(trip_id, student_id)`. Index `(student_id)`.

**trip_events** is append-only. Revoke `update` and `delete` from `authenticated` and `anon`.

| column | type | null | default |
|---|---|---|---|
| id | bigint generated always as identity PK | no | |
| trip_id | uuid → trips | no | |
| student_id | uuid → students | yes | |
| type | trip_event_type | no | |
| actor_id | uuid → profiles on delete set null | yes | |
| client_action_id | uuid | yes | |
| device_time | timestamptz | yes | |
| server_time | timestamptz | no | now() |
| location | geography(Point, 4326) | yes | |
| payload | jsonb | no | `'{}'` |

Index `(trip_id, server_time)`.

**client_actions** is the idempotency table.

| column | type | null | default |
|---|---|---|---|
| id | uuid PK | no | (client-generated, **no default**) |
| user_id | uuid → profiles | no | |
| rpc | text | no | |
| result | jsonb | no | `'{}'` |
| created_at | timestamptz | no | now() |

### §2.8 Location, absences, push, outbox, alerts

**bus_positions** holds the latest position per trip and is the source for Realtime.

| column | type | null | default |
|---|---|---|---|
| trip_id | uuid PK → trips | no | |
| school_id | uuid → schools | no | |
| location | geography(Point, 4326) | no | |
| lat | double precision | no | Copy of the latitude. Realtime sends geography as hex, so clients read these instead |
| lng | double precision | no | Copy of the longitude |
| heading | real | yes | |
| speed_mps | real | yes | |
| accuracy_m | real | yes | |
| recorded_at | timestamptz | no | |
| updated_at | timestamptz | no | now() |

**location_pings**

| column | type | null | default |
|---|---|---|---|
| id | bigint generated always as identity PK | no | |
| trip_id | uuid → trips | no | |
| location | geography(Point, 4326) | no | |
| heading | real | yes | |
| speed_mps | real | yes | |
| accuracy_m | real | yes | |
| recorded_at | timestamptz | no | |
| received_at | timestamptz | no | now() |

Index `(trip_id, recorded_at)`. Unique `(trip_id, recorded_at)` so replays are ignored.

**absence_reports**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| student_id | uuid → students | no | |
| service_date | date | no | |
| direction | trip_direction | no | "Both" is stored as two rows |
| reported_by | uuid → profiles on delete set null | yes | |
| reason | text | yes | |
| created_at | timestamptz | no | now() |

Unique `(student_id, service_date, direction)`.

**push_tokens**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid → profiles | no | |
| expo_token | text, unique | no | |
| platform | device_platform | no | |
| last_seen_at | timestamptz | no | now() |
| created_at | timestamptz | no | now() |

**notification_outbox**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| dedupe_key | text, unique | no | Format in §3 |
| type | notification_type | no | |
| recipient_user_id | uuid → profiles | no | |
| school_id | uuid → schools | no | |
| trip_id | uuid → trips | yes | |
| student_id | uuid → students | yes | |
| params | jsonb | no | `'{}'`. Keys listed in `i18n.md` §Notification params |
| send_after | timestamptz | no | now() |
| status | notification_status | no | `'pending'` |
| attempts | integer | no | 0 |
| claimed_at | timestamptz | yes | |
| sent_at | timestamptz | yes | |
| expo_ticket_ids | text[] | no | `'{}'` |
| sent_tokens | text[] | no | `'{}'` (same order as `expo_ticket_ids`) |
| receipts_checked_at | timestamptz | yes | |
| error | text | yes | |
| created_at | timestamptz | no | now() |

Index `(status, send_after)`.

**alerts**

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| school_id | uuid → schools | no | |
| trip_id | uuid → trips | yes | |
| type | alert_type | no | |
| severity | alert_severity | no | |
| dedupe_key | text, unique | no | |
| payload | jsonb | no | `'{}'` |
| acknowledged_by | uuid → profiles on delete set null | yes | |
| acknowledged_at | timestamptz | yes | |
| created_at | timestamptz | no | now() |

Index `(school_id, created_at desc)`.

---

## §3 Dedupe keys

| Kind | Format |
|---|---|
| Notification | `{type}:{trip_id or '-'}:{student_id or '-'}:{recipient_user_id}`. Admin notifications put the dedupe slot (`'-'` or a 30-minute bucket) where the student id goes. |
| Alert, once per trip | `{type}:{trip_id}` |
| Alert, once per student | `{type}:{trip_id}:{student_id}`. Used for `no_show` and `student_returned`. |
| Alert, repeatable | `{type}:{trip_id}:{bucket}`, where `bucket = floor(extract(epoch from now()) / 1800)` (30-minute buckets). Used for `lost_contact` and `stationary`. |

---

## §4 Realtime and storage

**Realtime.** Add these tables to publication `supabase_realtime`:
- `bus_positions`
- `trip_students`
- `alerts`
- `trips`

**Storage.** A private bucket `student-photos`.
- School admins read and write `{their school_id}/*`.
- Helpers read photos of students on their trips (via a signed URL from the app).
- Approved guardians read their own children's photos.

---

## §5 Seed fixtures (`supabase/seed.sql`)

Tests depend on these **exact** IDs. Fixture service date for tests: **`2030-01-07`** (a Monday).

### Schools
| key | id | name_en / name_ar | emirate | weekend |
|---|---|---|---|---|
| School A | `11111111-1111-1111-1111-111111111111` | Al Noor School / مدرسة النور | dubai | {0,6} |
| School B | `22222222-2222-2222-2222-222222222222` | Al Amal School / مدرسة الأمل | sharjah | {5,6,0} |

### Users
Each is inserted into `auth.users`; the trigger creates the profile. Test OTP for every phone is `123456`.

| key | id | phone / email | role |
|---|---|---|---|
| ADMIN_A | `a0000000-0000-0000-0000-000000000001` | admin-a@example.com | admin of A |
| HELPER_A | `a0000000-0000-0000-0000-000000000002` | +971500000002 | helper of A |
| PARENT_1 | `a0000000-0000-0000-0000-000000000003` | +971500000003 | approved guardian of STUDENT_1 and STUDENT_2 |
| PARENT_2 | `a0000000-0000-0000-0000-000000000004` | +971500000004 | approved guardian of STUDENT_3 |
| PARENT_3 | `a0000000-0000-0000-0000-000000000005` | +971500000005 | **pending** guardian of STUDENT_4 |
| HELPER_PARENT | `a0000000-0000-0000-0000-000000000006` | +971500000006 | helper of A **and** approved guardian of STUDENT_5 |
| ADMIN_B | `b0000000-0000-0000-0000-000000000001` | admin-b@example.com | admin of B |
| HELPER_B | `b0000000-0000-0000-0000-000000000002` | +971500000102 | helper of B |
| PARENT_B | `b0000000-0000-0000-0000-000000000003` | +971500000103 | approved guardian of STUDENT_B1 |

Admin passwords (local only): `password123`.

### Buses
| key | id | label_en / label_ar | school |
|---|---|---|---|
| BUS_A1 | `c0000000-0000-0000-0000-0000000000a1` | Bus 12 / حافلة 12 | A |
| BUS_B1 | `c0000000-0000-0000-0000-0000000000b1` | Bus 3 / حافلة 3 | B |

### Stops
All are school A unless noted. Coordinates are `lat, lng` (WGS84).

| key | id | label_en / label_ar | lat, lng | is_school |
|---|---|---|---|---|
| STOP_A_SCHOOL | `d0000000-0000-0000-0000-000000000000` | Al Noor School gate / بوابة مدرسة النور | 25.1007, 55.1988 | true |
| STOP_A1 | `d0000000-0000-0000-0000-000000000001` | Al Barsha 2, Villa 14 / البرشاء 2، فيلا 14 | 25.0935, 55.2105 | false |
| STOP_A2 | `d0000000-0000-0000-0000-000000000002` | Al Barsha South / البرشاء جنوب | 25.0790, 55.2190 | false |
| STOP_A3 | `d0000000-0000-0000-0000-000000000003` | Arjan, Building 7 / أرجان، مبنى 7 | 25.0585, 55.2300 | false |
| STOP_B_SCHOOL | `d0000000-0000-0000-0000-0000000000b0` | Al Amal School gate / بوابة مدرسة الأمل | 25.3375, 55.4120 | true (school B) |
| STOP_B1 | `d0000000-0000-0000-0000-0000000000b1` | Al Nahda / النهدة | 25.3010, 55.3720 | false (school B) |

### Routes
`departure_time` applies on weekdays 1–5 for A, and 1–4 for B. Default helper is HELPER_A for A and HELPER_B for B.

| key | id | direction | bus | stops (sequence) | departure_time |
|---|---|---|---|---|---|
| ROUTE_A_PM | `e0000000-0000-0000-0000-0000000000a1` | from_school | BUS_A1 | STOP_A_SCHOOL(1), A1(2), A2(3), A3(4) | 14:30 |
| ROUTE_A_AM | `e0000000-0000-0000-0000-0000000000a2` | to_school | BUS_A1 | A3(1), A2(2), A1(3), STOP_A_SCHOOL(4) | 06:45 |
| ROUTE_B_PM | `e0000000-0000-0000-0000-0000000000b1` | from_school | BUS_B1 | STOP_B_SCHOOL(1), B1(2) | 13:30 |

### Students
Each one is assigned to both A routes, on weekdays {1,2,3,4,5}.

| key | id | name_en / name_ar | stop | guardians |
|---|---|---|---|---|
| STUDENT_1 | `f0000000-0000-0000-0000-000000000001` | Sara Ahmed / سارة أحمد | STOP_A1 | PARENT_1 (approved) |
| STUDENT_2 | `f0000000-0000-0000-0000-000000000002` | Omar Ahmed / عمر أحمد | STOP_A1 | PARENT_1 (approved) |
| STUDENT_3 | `f0000000-0000-0000-0000-000000000003` | Lina Saeed / لينا سعيد | STOP_A2 | PARENT_2 (approved) |
| STUDENT_4 | `f0000000-0000-0000-0000-000000000004` | Yousef Khalid / يوسف خالد | STOP_A3 | PARENT_3 (pending) |
| STUDENT_5 | `f0000000-0000-0000-0000-000000000005` | Mariam Ali / مريم علي | STOP_A3 | HELPER_PARENT (approved); also `+971500000099`, no account (pending) |
| STUDENT_B1 | `f0000000-0000-0000-0000-0000000000b1` | Hamad Rashid / حمد راشد | STOP_B1 (school B, ROUTE_B_PM) | PARENT_B (approved) |
