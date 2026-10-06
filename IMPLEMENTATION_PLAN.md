# School Bus Safety Tracker — Implementation Plan

> **Executing this plan:** the exact names (tables, columns, functions, screens, translation keys) live in [`docs/contracts/`](docs/contracts/). Where this plan and the contracts differ, **the contracts win**. For example, there is no "guardian" membership role, and the notification table is `notification_outbox`. The step-by-step tasks are in [`tasks/`](tasks/README.md), and progress is tracked in [`tasks/STATUS.md`](tasks/STATUS.md).

**Goal:** give schools and parents a verified record of every child's bus journey, with live alerts. The school knows who got on, the parents know when their child boarded, where the bus is, when it's close, and when their child was dropped off.

**Clients:** schools (paying customer, owns the data) and parents (end users).
**Platforms:** iOS + Android (one codebase), plus a web dashboard for school staff.
**Market:** United Arab Emirates. **Languages:** Arabic (RTL) and English from day one. **Trips:** morning and afternoon, both in the MVP.

---

## 1. Users & roles

| Role | Where they work | What they do |
|---|---|---|
| **School admin** | Web dashboard | Manage students, guardians, buses, routes, stops, helpers. Assign kids to buses. Receive missing-child and exception alerts. Watch all buses live. |
| **Bus helper** (attendant) | Mobile app, "Helper mode" | Start a trip, do roll call, mark missing, tick kids off as dropped. Their phone is the bus's GPS source. |
| **Parent / guardian** | Mobile app, "Parent mode" | Get boarding / approaching / dropped notifications, track the bus live while their child is on it, pre-report absence. |

- A student can have **several guardians** (two parents, grandparent), and a guardian can have **several students** (siblings). So that link is many-to-many.
- **One mobile app** serves helpers and parents. A **landing screen** asks "who are you?" and sends each user to the right sign-in and home screen (see §7.0). Helper-only permissions, like background location, are requested only when a helper starts a trip. (See §8 for the store-review risk and the fallback of a separate helper app.)
- **One person can have several roles.** A bus helper may also be a parent at the same school. Roles come from `memberships`, and users with more than one get a role switcher.

---

## 2. The core flow

### Afternoon trip (school → home)

This is your described flow, mapped step by step.

1. **School prepares the trip.**
   - Each bus has a route, which is an ordered list of stops. Each student is assigned to a bus and a drop stop.
   - A daily **trip** is generated automatically from the route schedule.
   - The school can adjust it for that day, e.g. a child going home a different way or a substitute helper.
2. **Helper starts the trip → roll call.**
   - The helper sees the expected list.
   - Kids a parent has pre-reported absent are already greyed out.
   - The helper taps each child as they board, or scans their QR card (a phase-2 option).
3. **Helper confirms roll call → missing alert to school.**
   - Any expected child not marked boarded becomes `missing`.
   - The school admins get an immediate push and a dashboard alert listing the missing children.
   - *Optional, as a school setting:* also notify that child's parents.
4. **Each boarded child → push to their parents.**
   - The push is held for a few seconds so a mis-tap can be undone.
   - Example: "Sara boarded Bus 12 at 14:41. Tap to track."
   - That parent can now see the bus live on a map.
   - Their access lasts **only while their child is on board**.
5. **Bus drives → helper sees the drop list in stop order plus a map.**
   - Each stop shows the child or children to drop there.
   - On arrival the helper ticks each child **dropped**.
   - The app records the time and the helper's GPS position at the tick.
6. **10 minutes before a child's stop → push to their parents.**
   - Example: "Bus 12 is ~10 min from your stop. Estimated arrival 15:07."
   - The server computes this from live traffic-aware ETA (see §5). A simple geofence isn't enough.
7. **Child dropped → push to their parents.**
   - Example: "Sara was dropped off at 15:06 at Home stop."
   - The parent's live tracking for that trip ends.
8. **Trip end.**
   - The helper can only end the trip when every boarded child is dropped (or returned to school).
   - Forcing the end with children unaccounted for raises a high-priority school alert.

### Morning trip (home → school)

This is the same model run in the opposite direction:

- Kids are **picked up** at stops and **dropped** at school.
- Parents get "bus ~10 min from your stop" (time to get the child outside), "Sara picked up", and "Sara arrived at school".

Step by step:

1. **Before the trip.** Parents can pre-report absence until a cut-off time, e.g. 06:00. The helper sees those children greyed out.
2. **Helper starts the trip** from the depot or the first stop. Live tracking starts. Parents of every child expected on the trip can see the bus approaching, because their child is waiting for it.
3. **~10 min before each pickup stop** → push to that child's parents: "Bus 12 is ~10 min away. Please have Sara ready."
4. **At each stop** the helper ticks each child **picked up** (→ parent push) or **no-show** (→ parent push, and logged for the school).
5. **Arrival at school.** The helper confirms that everyone on board got off at school.
   - Every child's parents get "Sara arrived at school at 07:32."
   - The school gets the trip summary: who was picked up and who was a no-show.
6. **Trip end** follows the same rule as the afternoon: no child can be left in the `boarded` state.

The two directions share the same states and screens; only the ordering differs. **Both are in the MVP.**

| | Afternoon (school → home) | Morning (home → school) |
|---|---|---|
| Board happens | All at school, during roll call | At each home stop |
| Alight happens | At each home stop | All at school |
| "Missing" means | Not on the bus at roll call | No-show at their stop |
| Parent can track | While the child is on board | From trip start until the child is picked up, then until arrival at school |
| 10-min alert is for | The drop stop | The pickup stop |

---

## 3. Tech stack

Each choice is listed with why it was picked.

| Layer | Choice | Why |
|---|---|---|
| Mobile app | **Expo (React Native) + TypeScript**, Expo Router | One codebase for iOS + Android. Expo's cloud build service (EAS) lets you build iOS from Windows. Large ecosystem. |
| Builds | **EAS Build / EAS Submit**, *development builds* (not Expo Go) | Background location and push need native config that Expo Go can't do reliably. You also can't build iOS locally on Windows. |
| Backend | **Supabase**: Postgres + PostGIS, Auth, Realtime, Edge Functions, pg_cron | Relational data fits this domain (schools → buses → trips → students). Row-Level Security (RLS) enforces "parents only see their own child" *in the database*. Realtime handles the live bus position, and PostGIS handles distances. *(Firebase would work, but its security rules are harder to get right for these cross-entity privacy rules.)* |
| Push | **Expo Push Service** (wraps FCM + APNs) | One API for both platforms. Called from Edge Functions. |
| Maps / ETA | **Google Maps Platform**: `react-native-maps`, Routes API (ETA), Geocoding API (addresses → pins) | Traffic-aware ETAs with multiple waypoints in one call. Mapbox is a viable alternative if cost becomes an issue. |
| Background GPS | `expo-location` + `expo-task-manager` | Background location updates. Uses a foreground service on Android. |
| Offline queue | `expo-sqlite` (or MMKV) on the helper device | Check-ins and pings survive dead zones. |
| Auth | Supabase Auth: **phone OTP** for parents and helpers, email for school admins | A phone number is the natural identity here. It is also how parents get linked to children (see §6). Needs an SMS provider such as Twilio. |
| Admin dashboard + website | **Next.js** (web) with the Supabase JS client | Roster CSV import, route editing and a multi-bus live map are much better on a desktop. The same app also serves the public **landing page** (§7.0). |
| Localization | **i18next** + `expo-localization` (mobile), `next-intl` (web); an Arabic-capable font (e.g. IBM Plex Sans Arabic or Noto Kufi Arabic) | Arabic + English everywhere, including push notification text. RTL layout is built in from the first screen. |
| Testing | Vitest (logic), pgTAP / SQL tests (RLS), Maestro (mobile E2E) | RLS tests matter most. A privacy leak is the worst bug this product can have. |

### Repo layout (monorepo, pnpm workspaces)

```
school-safety-tracker/
├─ apps/
│  ├─ mobile/          # Expo app (helper + parent modes)
│  └─ web/             # Next.js: public landing page (/) + school dashboard (/dashboard)
├─ packages/
│  ├─ shared/          # generated DB types, zod schemas, status enums
│  └─ i18n/            # ar.json + en.json: one source for app, web AND push notification text
├─ supabase/
│  ├─ migrations/      # schema + RLS policies
│  ├─ functions/       # Edge Functions (notify, eta-tick, watchdog, ingest-pings)
│  ├─ seed.sql         # demo school, buses, students for local dev
│  └─ tests/           # RLS + trigger tests
└─ tools/
   └─ gps-replay/      # script that replays a recorded route as fake pings (test ETA without driving)
```

---

## 4. Data model

```
schools            id, name_ar, name_en, emirate, timezone (Asia/Dubai), weekend_days,
                   settings (notify_parent_on_missing, eta_alert_minutes=10, absence_cutoff, …)
school_calendar    school_id, date, type ∈ {holiday, closure, early_dismissal, ramadan_hours}
                   ← trip generation skips or adjusts these days
users              id (auth), phone (+971…), email, display_name, locale ∈ {ar, en}
memberships        user_id, school_id, role ∈ {admin, helper, guardian}
students           id, school_id, name_ar, name_en, grade, photo_url, active
guardians_students guardian_user_id | guardian_phone (pre-signup), student_id, relationship, can_track
buses              id, school_id, label ("Bus 12"), plate, capacity
stops              id, school_id, label_ar, label_en, location geography(Point), area, building/villa,
                   makani_number (Dubai, optional), landmark_notes   ← the pin is the source of truth
routes             id, school_id, bus_id, direction ∈ {to_school, from_school}, name, default_helper_id
route_stops        route_id, stop_id, sequence
student_assignments student_id, route_id, stop_id, days_of_week, valid_from, valid_to
trips              id, route_id, bus_id, helper_id, service_date, direction,
                   status ∈ {scheduled, roll_call, in_progress, completed, cancelled},
                   started_at, ended_at, end_forced bool
trip_students      trip_id, student_id, stop_id,
                   status ∈ {expected, absent_reported, boarded, missing, dropped, returned_to_school},
                   ← morning trips use the same states: boarded = picked up, missing = no-show,
                     dropped = arrived at school
                   boarded_at, boarded_location, dropped_at, dropped_location, updated_by,
                   eta_at, eta_alert_sent_at        ← dedupe flag for the 10-min alert
trip_events        id, trip_id, student_id?, type, actor_id, device_time, server_time, location, payload
                   ← append-only audit log of every tap, alert and state change
bus_positions      trip_id (PK), location, heading, speed, recorded_at   ← latest only; Realtime source
location_pings     trip_id, location, recorded_at, accuracy               ← history (retention-limited)
absence_reports    student_id, service_date, direction, reported_by, reason
push_tokens        user_id, expo_token, platform, last_seen_at
notification_log   id, user_id, trip_id, student_id, type, sent_at, status, dedupe_key UNIQUE
alerts             id, school_id, trip_id, type, severity, created_at, acknowledged_by, acknowledged_at
```

Key design points:

- **`trip_students` is the heart of the system.**
  - Each child on each trip has an explicit state.
  - Every change is also written to `trip_events`, with who made it, the device time, the server time and the GPS position. That gives the school a defensible audit trail ("who marked Sara dropped, where, and when").
- **The day's trip is a snapshot.** Changing a route tomorrow doesn't rewrite yesterday's trip history.
- **`notification_log.dedupe_key`** (e.g. `eta10:{trip}:{student}`) guarantees each alert fires **once**, even if a function retries.
- **Pre-signup guardian phones** are stored on `guardians_students`, with `link_status ∈ {pending, approved, revoked}`. Tracking requires `approved`, which comes from an invite code or admin approval (see §6).

### Student status flow (one trip)

```
expected ──(parent reports absence)──► absent_reported
expected ──(helper taps "on bus")────► boarded ──(helper ticks "dropped")──► dropped
expected ──(roll call confirmed, not boarded)──► missing ──(found / boards late)──► boarded
boarded  ──(couldn't drop, nobody home)──► returned_to_school
```

---

## 5. How the hard parts work

### 5.1 Live tracking

**Helper phone (ping sender):**
- Starts background location when the trip starts.
- Sends a ping every **~10–15 s or ~50 m**, whichever comes first.
- Pings are batched and sent to an `ingest-pings` Edge Function, which:
  - upserts `bus_positions` (the latest position), and
  - inserts `location_pings` (the history).

**Parent and school apps (map viewers):**
- Subscribe through Supabase Realtime to their trip's `bus_positions` row.
- RLS decides who receives it.
- The marker animates smoothly between updates.

### 5.2 The "10 minutes away" alert (server-side)

A scheduled job (`eta-tick`) runs roughly **every 60 s** for each active trip. Running it on the server means it works even if the parent app is closed. Each run:

1. Takes the bus's latest position and the **next few remaining** stops (those with a boarded, not-yet-dropped child), in route order.
   - Only the nearest stops can be inside the 10-min window, so include only stops that haven't been alerted yet, up to ~5. Later stops get a cheap straight-line estimate for display.
2. Makes **one** Routes API call with those stops as waypoints, which returns traffic-aware cumulative arrival times per stop.
   - Calling once a minute per bus, not on every ping, keeps Maps cost predictable.
   - *Verify the current Routes API intermediate-waypoint limit and the traffic-aware pricing tier before building this.*
3. Writes `eta_at` for each child.
4. If `eta_at − now ≤ 10 min` and `eta_alert_sent_at` is empty, it sends the push and sets the flag. The dedupe key stops it firing twice.
5. Edge cases:
   - **Two stops very close together:** the second child may already be under 10 min when the first is dropped. That's fine; it fires right away.
   - **Trip starting less than 10 min from a stop:** the "approaching" alert merges into the boarding alert.

### 5.3 Notifications

| Event | Recipient | Example message |
|---|---|---|
| Roll call confirmed with missing kids | School admins (+ parents if the setting is on) | "Bus 12: 2 students missing — Omar K., Lina S." |
| Child boarded | That child's guardians | "Sara boarded Bus 12 at 14:41. Tap to track." |
| ~10 min from stop | That child's guardians | "Bus 12 arriving at your stop ~15:07." |
| Child dropped | That child's guardians | "Sara was dropped off at 15:06." |
| *Morning:* ~10 min from pickup | That child's guardians | "Bus 12 is ~10 min away. Please have Sara ready." |
| *Morning:* picked up / no-show | That child's guardians | "Sara was picked up at 06:58." / "Bus 12 left your stop. Sara was not picked up." |
| *Morning:* arrived at school | Guardians of every child on board | "Sara arrived at school at 07:32." |
| Trip ended with kids unaccounted for | School admins (high priority) | "Bus 12 ended trip — 1 student not marked dropped." |
| No GPS from active bus > 5 min | School admins | "Lost contact with Bus 12 (last seen 15:02, Main St)." |
| Bus stationary > N min mid-route | School admins | "Bus 12 stopped for 15 min." (possible breakdown) |

**Language:**
- Every notification is rendered in the **recipient's** language (`users.locale`), with the child's name in that language.
- Two parents of the same child can get different languages.
- Times and numbers are wrapped in bidi isolation marks so they don't scramble inside Arabic text.

**Delivery mechanics:**
- All pushes go through one `notify` Edge Function. It looks up push tokens, sends through Expo, and records the result in `notification_log`.
- Expo push receipts are checked so dead tokens are cleaned up.

**Alert sound and priority:**
- On iOS, use the *time-sensitive* interruption level for safety alerts so they can break through Focus modes.
- True "critical alerts" need a special Apple entitlement. That's worth applying for later.

### 5.4 Offline and dead zones (helper app)

**Queue locally:**
- Every helper action (board, drop, roll-call confirm) and every GPS ping goes into a local SQLite queue first, with the **device timestamp**.
- A sync worker drains the queue whenever the phone is online.
- The UI updates immediately (optimistic), with a small "pending sync" indicator.

**Keep replays safe:**
- Server-side actions are **idempotent**: each action has a client-generated UUID, so a replayed action has no effect.
- `trip_events` stores device time *and* server time, so a delayed sync still shows when things really happened.
- Parent notifications for queued actions go out once the action reaches the server. They may be late, but they are never lost.

### 5.5 Drop safeguards

- **Distance check:**
  - When the helper ticks "dropped", the app compares their GPS position with the child's stop.
  - If it's more than ~200 m away, they get "You're not at Sara's stop — confirm anyway?"
  - That catches wrong-child taps.
- **Undo / debounce:** both **boarded** and **dropped** taps wait ~10 s before the parent notification goes out. That way a mis-tap during roll call that's toggled off never tells a parent their child boarded.
- **Siblings:** children sharing a stop can be dropped together with one "Drop all at this stop" action.

### 5.6 Watchdogs (server cron)

- Active trip with no ping for more than 5 min → "lost contact" alert.
- Trip still active long after its expected end → alert.
- Children still `boarded` when a trip is completed → alert. Forced ends are flagged on the trip.

---

## 6. Privacy and security

This is children's location data, so treat it as the top risk.

- **Row-Level Security on every table.** The rules:

  | Who | Can see |
  |---|---|
  | Parent | Only their linked students and those students' `trip_students` rows. `bus_positions` only while one of their children on that trip is **`boarded`**, or, on a **morning** trip, `expected` (the bus is coming for them). |
  | Helper | Only trips assigned to them, for today |
  | Admin | Only their own school |

  Example policy (sketch):

  ```sql
  create policy guardian_sees_bus_while_child_on_board on bus_positions
  for select using (
    exists (
      select 1 from trip_students ts
      join guardians_students gs on gs.student_id = ts.student_id
      where ts.trip_id = bus_positions.trip_id
        and (ts.status = 'boarded'
             or (ts.status = 'expected' and exists (
                   select 1 from trips t
                   where t.id = ts.trip_id and t.direction = 'to_school'
                     and t.status = 'in_progress')))
        and gs.guardian_user_id = auth.uid()
        and gs.can_track
        and gs.link_status = 'approved'
    )
  );
  ```

- **No other children's data for parents.**
  - Parents never see other children's names, photos or stop locations.
  - The parent map shows the bus and *their* stop only.
- **Parent linking is controlled by the school, never self-claimed.** Linking a phone gives live access to a child's location, so a phone match alone isn't enough. A typo on the roster or a recycled phone number would hand that access to a stranger.
  - **Primary:** the school issues a one-time **invite code** per guardian. The parent enters it after verifying their phone by OTP.
  - **Convenience:** if a verified phone matches the roster, the app creates a **pending** link. An admin approves it in the dashboard before any tracking is allowed.
  - **Revocation:** an admin can switch off `can_track` or remove a guardian link **instantly**, for custody disputes or court orders. That takes effect on the next Realtime check.
- **Helpers see stop locations only for their current trip.**
  - Addresses are shown as a pin plus a short label, not the full roster.
- **Retention:**
  - Delete `location_pings` after a short, configurable window, e.g. 30–90 days.
  - Keep `trip_events` (the audit log) longer, per the school's policy.
- **UAE regulation:** see §12 for the data-protection law, data residency and school-transport rules.
- **Consent:** schools collect guardian consent as part of enrolment. The app shows a clear privacy notice on first launch.

---

## 7. App screens

### 7.0 Landing page — "who are you?"

There are two landing pages with the same three choices: one in the app and one on the website. The choice only decides **which sign-in to show**. The user's actual role always comes from the server (`memberships`), so picking the wrong card can't grant access.

**In the mobile app (first-launch welcome screen)**

```
┌──────────────────────────────┐
│        [logo]   عربي | EN     │
│                               │
│   ┌────────────────────────┐  │
│   │ 👪  I'm a parent        │  │ → phone OTP (+971 prefilled) → invite code if not linked yet → Parent home
│   └────────────────────────┘  │
│   ┌────────────────────────┐  │
│   │ 🚌  I'm a bus helper    │  │ → phone OTP → Helper home (today's trips)
│   └────────────────────────┘  │
│   ┌────────────────────────┐  │
│   │ 🏫  I'm school staff    │  │ → open web dashboard, or sign in (email) to get school alerts on this phone
│   └────────────────────────┘  │
└──────────────────────────────┘
```

- **Language toggle at the very top.** It's the first thing a user sees. The default comes from the phone's language, and switching applies to the whole app (layout direction flips after a quick reload, see §12).
- **Roles are checked after sign-in:**
  - If the account's role doesn't match the card picked, the app explains and sends the user to the right place. Example: "This number is registered as a parent — continuing as parent."
  - If the number isn't registered at all, the app shows "Ask your school to add you," with no dead end.
- **Remembered after sign-in.** Later launches skip the landing screen and open straight on the user's home screen. Users with **more than one role** (a helper who is also a parent) get a role switcher in the menu.
- **Invite links** (`https://<domain>/invite/<code>`) open the app directly if it's installed (universal links / app links), and skip to the parent sign-in with the code filled in.

**On the website (`/`)**

| Card | Leads to |
|---|---|
| Parents | App Store and Google Play buttons, with a short "how it works" for parents |
| Bus helpers | App Store and Google Play buttons, plus "your school will register your number" |
| Schools | **Sign in to dashboard** (email login), and **Request a demo** |

- The site is bilingual with an Arabic/English toggle and `dir="rtl"` for Arabic. The default comes from the browser's language.
- It also hosts the **privacy policy**, **terms** and **support** pages. The App Store and Play Store both require public URLs for these, so this page is needed before store submission anyway.
- If an invite link is opened on a phone without the app, it lands here and points to the right store.

**Helper mode**
1. Today's trips → **Start trip**
2. Roll call: list with photos, a tap to toggle boarded, a search box, absent kids greyed out → **Confirm roll call**, which shows a summary of who's missing before sending
3. Trip view: map with the route, plus a list grouped by stop in order. Big **Dropped** buttons, "Drop all at this stop", and the next stop highlighted
4. End trip, blocked while kids are still on board unless forced with a reason
5. Persistent indicators: GPS on/off, sync status, battery warning

**Parent mode**
1. Home: one card per child showing today's status ("On Bus 12 · arriving ~15:07")
2. Live map: bus marker, their stop, ETA (only while the child is on board)
3. Report absence for today or a future date
4. Trip history (last N days)
5. Notification settings and language

**School dashboard (web)**
1. Live board: every active bus on a map, with status chips (roll call done, missing count, delays)
2. Alerts inbox with acknowledge / resolve, and a full audit trail per trip
3. Rosters: students, guardians (CSV import), photos
4. Buses, routes and stops: pick stops on a map, drag to reorder, assign students
5. Helpers: invite, assign to routes, substitutes for the day
6. Reports: trip history and incident log

---

## 8. Platform constraints to know up front

- **You're on Windows.**
  - You can run the **Android emulator** locally. It can also simulate GPS routes, which is handy for testing.
  - You **cannot run an iOS simulator**. iOS builds go through **EAS Build** in the cloud, and you test on a physical iPhone with a development build.
- **Accounts needed before shipping:**
  - Apple Developer Program (annual fee)
  - Google Play Console (one-time fee)
  - Expo/EAS
  - Supabase
  - Google Cloud (Maps SDKs, Routes API, Geocoding)
  - An SMS provider for OTP (e.g. Twilio). For the UAE, check sender-ID registration requirements (see §12).
  - A domain for the website, invite links and privacy policy
- **Background location:**
  - **iOS** needs "Always" location permission and the background location mode.
  - **Android** needs a foreground service with a persistent notification ("Trip in progress — tracking bus location") and the background location permission flow.
  - Exact manifest and permission details change between OS versions, so verify them against the current Expo and Android docs when implementing.
- **Store review:**
  - Apple and Google both scrutinise background location.
  - Prepare a clear justification and an in-app explanation screen before the permission prompt. Make sure tracking only runs during an active trip.
  - If one combined app gets pushback, split it into **two store apps** (Parent and Helper) built from the same monorepo.
- **Recommendation:** a **school-provided phone per bus**, mounted and on a charger. It is far more reliable than a helper's personal phone: battery, permissions, OS power-saving and privacy all improve. Some Android makers (Xiaomi, Huawei, Samsung) aggressively kill background apps, and a dedicated, configured device avoids that.

---

## 9. Phased delivery

The week estimates assume one developer working full time. Treat them as rough.

| Phase | Scope | Est. |
|---|---|---|
| **0. Setup** | Create the accounts above, the monorepo, the Expo dev build running on an Android emulator and an iPhone via EAS, a local Supabase project in the chosen hosting region (§12), CI (lint, typecheck, tests). **i18n and RTL scaffolding**, Arabic font, language switch working on a test screen | 1–1.5 wks |
| **1. Foundation + landing** | DB schema and migrations, RLS policies and **RLS tests**, phone OTP auth, roles, seed data (bilingual). **Mobile landing screen** (§7.0) with role-based routing. **Web landing page** with the privacy and terms pages. Dashboard: login, students, guardians, CSV import (Arabic + English names), buses, stops (map pin picker), routes, assignments, helpers, school calendar | 3.5–4 wks |
| **2. Helper trip flow (both directions)** | Daily trip generation that respects the calendar and weekends. **Afternoon:** roll call, missing → school alert, drop list by stop, drop ticks with distance check. **Morning:** pickup list by stop, picked-up / no-show ticks, arrival-at-school confirmation. End-trip rules and `trip_events` audit for both | 3–4 wks |
| **3. Parents + live tracking** | Parent onboarding (invite code, or phone match plus admin approval), guardian revocation, invite deep links, push tokens, `notify` function with Arabic + English templates, boarded / picked-up / no-show pushes, background GPS on the helper device, `ingest-pings`, Realtime parent map (with the morning "bus coming" access window), absence reporting with cut-off | 3 wks |
| **4. ETA + arrival alerts** | `eta-tick` cron with the Routes API, 10-min alert for drop stops (afternoon) and pickup stops (morning) with dedupe, dropped / arrived-at-school pushes, watchdogs (lost contact, stationary, unaccounted kids), dashboard live board | 2–2.5 wks |
| **5. Hardening** | Offline queue and idempotent sync, battery and accuracy tuning, OEM background-kill handling, GPS-replay tests, E2E tests (Maestro) **in both languages**, native-speaker review of the Arabic text, retention jobs, error monitoring (Sentry) | 2–3 wks |
| **6. Pilot + launch** | Pilot with **one UAE school, 1–2 buses, morning and afternoon**, collect feedback, fix, then submit to the App Store and Play Store (store listings in Arabic + English) | 2–4 wks |
| **Later** | SMS / WhatsApp fallback for parents without the app, QR / NFC student cards for faster roll call, route optimisation, parent ↔ school messaging, transport-operator accounts (§12), multi-school admin, analytics (on-time %, incidents) | — |

**MVP** = Phases 0–4 plus the parts of Phase 5 that are needed for a safe pilot (offline queue, background reliability, Arabic review). That's roughly **15–18 weeks** for one developer.

---

## 10. Testing strategy

- **RLS tests (most important).**
  - Automated SQL tests check that a parent can't read another child's data, can't see the bus after their child is dropped, and can't see another school.
  - Run them in CI on every migration.
- **State-machine unit tests** for `trip_students` transitions and the end-trip rules.
- **GPS replay tool:** feed a recorded or synthetic route into `ingest-pings` at real or accelerated speed. This verifies ETA alerts fire once and at the right time, without driving a bus.
- **Field tests:** ride a real route with two phones (helper plus parent) before the pilot. Include dead zones, app backgrounding, screen lock and a low battery.
- **E2E:** Maestro flows for the landing → sign-in routing of each role, roll call, pickup, drop and parent notification receipt.
- **Morning-trip RLS cases:** a parent sees the bus while it's coming for their child, but not after their child is a no-show and the bus has left.
- **Arabic / RTL:** run every E2E flow in both languages, and take screenshots of each screen in Arabic to catch layout that didn't mirror, clipped text and broken numbers or times.

---

## 11. Open questions for you

**Decided:** UAE market · Arabic + English · morning and afternoon trips in the MVP · landing page that routes by user type.

**Still open:**

1. **Who employs the bus helpers?** The school, or a transport operator? In the UAE, school buses are often run by a contracted operator. That may make the operator a separate kind of account, which affects who manages helpers and receives alerts.
2. **Which emirate(s) for the pilot?** The regulators differ (§12).
3. **Hosting:** does the pilot school (or its regulator) require student data to be **hosted inside the UAE**? This decides the backend setup, so it's needed before Phase 1.
4. **Helper device:** school-provided phones, or helpers' personal phones?
5. **Missing-child alert:** school only, or also that child's parents? (I've made it a per-school setting.)
6. **Drop rule:** can a young child be dropped with nobody there, or must a guardian be present? This could add a "handed to guardian" confirmation, especially for KG children.
7. **Number and time format in Arabic:** Western digits (0–9), common in UAE apps, or Arabic-Indic digits (٠–٩)? 12-hour (ص / م) or 24-hour time?
8. **Business model / budget:** per-school subscription? This affects how much Maps API, SMS and hosting cost is acceptable.

---

## 12. UAE-specific requirements

Every item here should be confirmed with a local lawyer and the pilot school before launch. Regulations change, so treat this as a checklist rather than legal advice.

**Data protection**
- The federal law is the **UAE Personal Data Protection Law** (Federal Decree-Law No. 45 of 2021). Children's data and live location are high-sensitivity, so expect consent, purpose-limitation and retention requirements.
- **DIFC** and **ADGM** free zones have their own data-protection regimes. That only matters if the company or a school client is based there.
- The **education regulators** have their own rules on student data and third-party vendors: KHDA (Dubai), ADEK (Abu Dhabi), SPEA (Sharjah) and the Ministry of Education. Ask the pilot school which one applies and what vendor approval they need.

**Data residency (decide before Phase 1)**
- Schools or regulators may require student data to stay **in the UAE**.
- Check whether managed Supabase offers a region that satisfies this.
- If it doesn't, Supabase is open source and can be **self-hosted** on a cloud provider with a UAE region. That means more ops work, but the app code stays the same.
- Moving data regions after launch is painful, which is why this is settled first.

**School transport rules**
- School buses are regulated per emirate, e.g. RTA in Dubai and ITC in Abu Dhabi. The rules include requirements such as having a bus supervisor on board.
- Check whether these regulators require specific trip records or reports. If they do, make the `trip_events` audit log exportable in that format.

**SMS / OTP**
- The UAE telecom regulator (TDRA) requires **registered sender IDs** for business SMS. Unregistered OTP messages may be blocked or delayed. Register early through your SMS provider.
- WhatsApp is widely used in the UAE. **WhatsApp OTP** (via Twilio or Meta) is a good fallback and is worth considering as the primary channel.

**Addresses and stops**
- UAE addresses are often not precise enough to drive to, so the **map pin is the source of truth** for every stop.
- Each stop also stores area, building/villa and landmark notes, which the helper sees.
- In Dubai, an optional **Makani number** can be stored.
- Parents can propose a pin correction in the app. The school approves it, because stops affect the route.

**Calendar and time**
- Timezone is `Asia/Dubai` (UTC+4, no daylight saving).
- Weekends differ: the federal weekend is Saturday–Sunday, Sharjah has Friday off as well, and many schools have **shorter Fridays**. So the trip schedule is **per weekday**, per school.
- **Ramadan** hours and term holidays come from `school_calendar`.

**Arabic and RTL**
- Every user-facing string lives in `packages/i18n` (`ar.json` / `en.json`), including push notification text.
- Use **start/end** spacing, never left/right, and mirror direction icons such as arrows and back buttons. Maps are never mirrored.
- Switching language in React Native may need an app reload to flip the layout direction. Handle it with a "restarting to apply" step, and check the current Expo RTL guidance when implementing.
- Names are stored in both languages (`name_ar` / `name_en`), with a fallback to the other if one is missing. The CSV import template has both columns.
- Phone numbers, times and bus numbers are wrapped in bidi isolation so they display correctly inside Arabic sentences.
- A **native Arabic speaker** reviews all text, safety messages especially. A machine translation of "your child was not picked up" is not acceptable.
- Store listings, screenshots, the privacy policy and the website all need both languages.

---

## 13. First concrete steps

1. Answer the open questions above, especially 1, 2 and 3 (operator, emirate, data residency).
2. Create the accounts in §8 (Apple, Google Play, Expo, Supabase, Google Cloud, SMS provider, domain).
3. Start sender-ID registration with the SMS provider early, since approval can take time.
4. Scaffold the monorepo: Expo app, Next.js web (landing + dashboard), Supabase project, shared types and the i18n package. Make the landing screen work in Arabic and English first, which proves out RTL.
5. Write the schema migration, RLS policies and RLS tests **first**, since everything else builds on them.
6. Build the helper roll-call screen against seed data. It's the first thing to put in front of a real school for feedback.
