# Task status

Tick `- [x]` when a task is done (see README.md). `H` = human task 👤 (the human ticks these). ⚠ = use a stronger model.

## Phase 0 — Setup  ([phase-0-setup.md](phase-0-setup.md))
- [ ] H0.1 — Move the project to a path without spaces 👤
- [ ] H0.2 — Install tools on Windows 👤
- [ ] H0.3 — Create accounts 👤
- [x] T0.01 — Git repo and root housekeeping files
- [x] T0.02 — pnpm workspace and root scripts
- [x] T0.03 — Shared TypeScript, ESLint and Prettier config
- [x] T0.04 — `packages/shared` skeleton with enums
- [x] T0.05 — `packages/i18n` skeleton with parity test
- [x] T0.06 — Root vitest config
- [x] T0.07 — Supabase init and local config
- [x] T0.08 — Expo app scaffold
- [x] T0.09 — App config, EAS profiles, env example
- [x] T0.10 — Mobile i18n + RTL bootstrap ⚠ hard
- [x] T0.11 — Arabic font and base `Text` component
- [x] T0.12 — Next.js scaffold with Tailwind
- [x] T0.13 — Web i18n routing (`ar` default, `en`), `dir` attribute
- [x] T0.14 — CI workflow
- [ ] H0.4 — First development builds on real devices 👤

## Phase 1a — Database foundation  ([phase-1-database.md](phase-1-database.md))
- [x] T1.01 — Extensions and private schema
- [x] T1.02 — Enums
- [x] T1.03 — Schools and calendar
- [x] T1.04 — Profiles, memberships, staff invites
- [x] T1.05 — Students, guardian links, invite codes
- [x] T1.06 — Buses, stops, routes, schedules, assignments
- [x] T1.07 — Trips, trip students, trip events, client actions
- [x] T1.08 — Positions, pings, absences, push tokens, outbox, alerts
- [x] T1.09 — Phone and point utilities (SQL + TS twins)
- [x] T1.10 — Triggers: new user, guardian link attach, assignment stop check ⚠ hard
- [x] T1.11 — RLS helper functions
- [x] T1.12 — RLS policies: schools, calendar, profiles, memberships, staff invites
- [x] T1.13 — RLS policies: students, guardian links, invite codes + photo bucket
- [x] T1.14 — RLS policies: buses, stops, routes, schedules, route stops, assignments
- [x] T1.15 — RLS policies: trips and everything else + Realtime
- [x] T1.16 — Seed data
- [x] T1.17 — Test setup and "RLS on every table" test
- [x] T1.18 — RLS tests: guardians
- [x] T1.19 — RLS tests: staff and cross-school
- [x] T1.20 — RPCs `get_my_context`, `set_my_locale`
- [x] T1.21 — RPCs: invites, guardian approval, staff ⚠ hard
- [x] T1.22 — `generate_trips` ⚠ hard
- [x] T1.23 — RLS tests: trips and bus visibility ⚠ hard
- [x] T1.24 — `import_roster` RPC
- [x] T1.25 — Generate DB types

## Phase 1b — App and web foundation (landing pages, sign-in, dashboard CRUD)  ([phase-1-apps.md](phase-1-apps.md))
- [x] T1.30 — Supabase client (mobile)
- [x] T1.31 — Providers in the root layout
- [x] T1.32 — UI kit part 1: tokens, Screen, Button, Card
- [x] T1.33 — UI kit part 2: TextField, PhoneField, Banner, EmptyState, Spinner
- [x] T1.34 — Role resolution logic (pure + tests)
- [x] T1.35 — Welcome (landing) screen
- [x] T1.36 — Phone entry screen
- [x] T1.37 — OTP screen
- [x] T1.38 — AuthGate: routing after sign-in ⚠ hard
- [x] T1.39 — Onboarding screens
- [x] T1.40 — Settings screen (shared)
- [x] T1.41 — Invite deep link route
- [x] T1.42 — Staff screen: web dashboard + sign in for alerts
- [x] T1.50 — Supabase clients for Next.js
- [x] T1.51 — Web landing page
- [x] T1.52 — Privacy, terms, support pages
- [x] T1.53 — Invite link page
- [x] T1.54 — Dashboard login and access guard
- [x] T1.55 — Dashboard shell layout
- [x] T1.56 — Dashboard UI kit
- [x] T1.57 — Students list
- [x] T1.58 — Student create/edit + photo upload
- [x] T1.59 — Guardians panel
- [x] T1.60 — Roster CSV import
- [x] T1.61 — Buses page
- [ ] T1.62 — Stops page with map pin picker
- [ ] T1.63 — Routes list and create
- [ ] T1.64 — Route detail: stop order and weekly schedule
- [ ] T1.65 — Assignments on route detail
- [x] T1.66 — Staff page
- [x] T1.67 — Calendar page
- [x] T1.68 — School settings page

## Phase 2 — Trip flow: roll call, pickup, drop-off (both directions)  ([phase-2-trips.md](phase-2-trips.md))
- [x] T2.01 — Action helpers + `start_trip`
- [x] T2.02 — Notification and alert helpers
- [x] T2.03 — `set_boarded`
- [x] T2.04 — `confirm_roll_call`
- [x] T2.05 — `mark_dropped`, `undo_dropped`
- [x] T2.06 — `mark_no_show`, `undo_no_show`, `arrive_at_school`
- [x] T2.07 — `mark_returned_to_school`, `end_trip`
- [x] T2.08 — `report_absence`, `cancel_absence`
- [x] T2.09 — Regenerate types
- [x] T2.10 — Offline action queue core ⚠ hard
- [x] T2.11 — Trip view reducer + helpers
- [x] T2.12 — SQLite queue store + drain runner + `useHelperAction`
- [x] T2.13 — `useTrip(tripId)` hook
- [x] T2.14 — Helper home: today's trips
- [x] T2.15 — Trip router screen + Start trip
- [x] T2.16 — Roll call screen (afternoon)
- [x] T2.17 — Roll call confirmation sheet
- [x] T2.18 — Drop list screen (afternoon)
- [x] T2.19 — Drop safeguards: distance check, undo, drop all
- [x] T2.20 — Pickup screen (morning)
- [x] T2.21 — Arrive at school, Return to school, End trip
- [x] T2.22 — Sync status indicator
- [x] T2.23 — Trip map tab
- [x] T2.30 — Today's trips page
- [x] T2.31 — Trip detail + audit timeline
- [x] T2.32 — Alerts inbox

## Phase 3 — Push notifications, parent app, live bus tracking  ([phase-3-parents-tracking.md](phase-3-parents-tracking.md))
- [x] T3.01 — Notification renderer + time formatting
- [x] T3.02 — i18n sync script for Edge Functions
- [x] T3.03 — RPCs: claim/complete notifications, receipts
- [x] T3.04 — Expo push client module
- [x] T3.05 — Edge Function `notify-dispatch` ⚠ hard
- [x] T3.06 — Cron schedules + local Vault secrets
- [x] T3.07 — Edge Function `push-receipts` + cron
- [ ] T3.08 — Push registration + Android channel
- [ ] T3.09 — Notification tap routing + foreground display
- [ ] T3.10 — Parent home: children cards
- [ ] T3.11 — Parent live map
- [ ] T3.12 — Report absence screen
- [ ] T3.13 — Parent history
- [x] T3.14 — `ingest_pings` RPC
- [ ] T3.15 — Ping queue + uploader
- [ ] T3.16 — Background location task + start/stop with the trip ⚠ hard
- [ ] T3.17 — Location permission flow
- [ ] T3.18 — Localized permission strings + Android battery guidance
- [ ] T3.19 — Admin alerts mode (mobile)
- [ ] H3.1 — Device test: background tracking and push 👤

## Phase 4 — "10 minutes away" alerts, watchdogs, live board  ([phase-4-eta-watchdogs.md](phase-4-eta-watchdogs.md))
- [x] T4.01 — `get_eta_work` RPC
- [x] T4.02 — `apply_etas` RPC
- [x] T4.03 — Google Routes API client
- [x] T4.04 — Straight-line fallback estimator
- [x] T4.05 — Edge Function `eta-tick` + cron ⚠ hard
- [ ] T4.06 — Watchdogs
- [ ] T4.07 — Parent map: ETA + approaching state
- [ ] T4.08 — Dashboard live board
- [ ] T4.09 — GPS replay tool
- [ ] T4.10 — End-to-end scenario test (local)
- [ ] H4.1 — Ride-along test 👤

## Phase 5 — Hardening  ([phase-5-hardening.md](phase-5-hardening.md))
- [ ] T5.01 — Location data purge job
- [ ] T5.02 — Security regression tests
- [ ] T5.03 — Sentry (mobile)
- [ ] T5.04 — Sentry (web + Edge Functions logging)
- [ ] T5.05 — Maestro setup + sign-in flows (both languages)
- [ ] T5.06 — Maestro helper trip flows
- [ ] T5.07 — Offline and error UX pass
- [ ] T5.08 — Accessibility pass
- [ ] H5.1 — Arabic review 👤
- [ ] H5.2 — Field-test runbook 👤

## Phase 6 — Pilot and launch  ([phase-6-launch.md](phase-6-launch.md))
- [ ] H6.1 — Decisions 👤
- [ ] H6.2 — Production SMS 👤
- [ ] T6.01 — Production deploy runbook
- [ ] T6.02 — Universal links / App links
- [ ] T6.03 — Store listing metadata (ar + en)
- [ ] T6.04 — Icons and splash config
- [ ] H6.3 — Production builds and store submission 👤
- [ ] H6.4 — Pilot onboarding 👤
