# Phase 5 — Hardening

Goal: safe enough to pilot. That means retention, monitoring, automated UI flows in both languages, security checks, and a human review of the Arabic.

---

### T5.01 — Location data purge job
- **Depends:** T4.06
- **Read:** rpc.md §5 (`purge_old_location_data`)
- **Files:** `supabase/migrations/20260101005000_purge.sql`, `supabase/tests/600_purge.test.sql`
- **Steps:** implement the function, and schedule it daily at `'0 23 * * *'` (03:00 Dubai) as plain SQL cron.
- **Assertions:**
  - With `location_retention_days = 30`, pings 31 days old are deleted and 29-day-old pings are kept
  - A `bus_positions` row of a trip completed 2 days ago is deleted, and an active trip's row is kept
- **Done when:** `pnpm db:test` passes.

### T5.02 — Security regression tests
- **Depends:** T4.06
- **Files:** `supabase/tests/610_security.test.sql`, `tools/scripts/no-secrets.test.ts`
- **Assertions:**
  - **SQL:**
    - every function in schema `public` that is `security definer` has `proconfig` containing `search_path=` (query `pg_proc`)
    - `anon` cannot `select` from `students`
    - every RPC in rpc.md §5 is **not** executable by `authenticated` (use `has_function_privilege`)
    - no private function except the RLS helpers is executable by `authenticated`
  - **TS** (vitest): scan `apps/**` (excluding node_modules) for `service_role` and `SERVICE_ROLE` → 0 matches
- **Done when:** `pnpm db:test && pnpm test` passes.

### T5.03 — Sentry (mobile)
- **Depends:** T3.16, H0.3 (Sentry account; add to the H0.3 list if missing)
- **Files:** `apps/mobile/src/lib/sentry.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app.config.ts`
- **Steps:**
  1. Follow Sentry's current Expo guide (`@sentry/react-native` + config plugin), with the DSN from env `EXPO_PUBLIC_SENTRY_DSN`.
  2. **Never send PII:** strip `phone` from events (`beforeSend`) and turn off `sendDefaultPii`.
  3. Tag the role (`parent` / `helper`).
- **Done when:** `pnpm typecheck` passes.

### T5.04 — Sentry (web + Edge Functions logging)
- **Depends:** T4.08
- **Files:** `apps/web/sentry.*.config.ts` (per the Sentry Next.js wizard), `apps/web/next.config.*`
- **Steps:** follow Sentry's current Next.js setup, with the DSN from env and `sendDefaultPii: false`. In the Edge Functions, ensure every catch uses `console.error` with a structured object (Supabase logs capture it).
- **Done when:** the build succeeds.

### T5.05 — Maestro setup + sign-in flows (both languages)
- **Depends:** T1.39, H0.4
- **Files:** `apps/mobile/.maestro/config.yaml`, `apps/mobile/.maestro/signin-parent.yaml`, `apps/mobile/.maestro/signin-helper.yaml`, `apps/mobile/.maestro/README.md`
- **Steps:**
  1. Add `testID` props to every pressable on the welcome, phone, OTP and home screens (e.g. `welcome-parent`, `phone-input`, `otp-input`).
  2. **Flows:**
     - launch with `clearState`
     - choose the language via `welcome-lang-ar` / `welcome-lang-en`
     - pick the role, type the phone, OTP `123456`
     - assert the home `testID` is visible
  3. Parametrize the language with env `LANG=ar|en`.
  4. The README explains how to install the Maestro CLI on Windows (WSL) and run the flows against the emulator.
- **Done when:** the YAML files are valid and the README exists. 📱 device check: the human runs both flows in both languages.

### T5.06 — Maestro helper trip flows
- **Depends:** T5.05, T2.21
- **Files:** `apps/mobile/.maestro/afternoon-trip.yaml`, `apps/mobile/.maestro/morning-trip.yaml`
- **Steps:**
  1. Precondition: trips for today generated (README step).
  2. **Afternoon:** start → board 3 → confirm (2 missing) → drop each → end.
  3. **Morning:** start → pick up / no-show → arrive at school → end.
  4. Add `testID`s as needed (`student-row-{id}`, `drop-{id}` …).
  5. Take a screenshot at each step (`takeScreenshot`) for the RTL review.
- **Done when:** the files are valid. 📱 device check: the flows pass in `ar` and `en`.

### T5.07 — Offline and error UX pass
- **Depends:** T3.13
- **Files:** `apps/mobile/src/ui/OfflineBanner.tsx`, plus the parent and helper layouts
- **Steps:**
  1. A global `OfflineBanner` (NetInfo) appears at the top of parent and helper screens: `common.offline`.
  2. Check that every query screen from Phases 1–4 has a loading, error (with retry) and empty state. List any fixes in the commit message.
- **Done when:** `pnpm typecheck` passes.

### T5.08 — Accessibility pass
- **Depends:** T5.07
- **Files:** components in `apps/mobile/src/ui/*`, `apps/mobile/src/trip/StudentRow.tsx`
- **Steps:**
  1. Every pressable gets an `accessibilityRole` and an `accessibilityLabel` (an i18n key).
  2. Respect font scaling up to 1.5× with no clipped text on the trip screens. Use `numberOfLines` plus flexible layouts.
  3. Status is never shown by colour alone: always an icon or text too.
- **Done when:** `pnpm typecheck` passes.

### H5.1 — Arabic review 👤
- A native Arabic speaker reviews `packages/i18n/src/ar.json`, especially `notif.*` and the safety texts.
- Use the Maestro screenshots (T5.06) to review layout in RTL.
- Fix wording directly in `ar.json`, then run `pnpm test && pnpm i18n:sync`.

### H5.2 — Field-test runbook 👤
Write down and run: the H3.1 and H4.1 checks, plus:
- phone reboot mid-trip
- the helper's app force-closed mid-trip (does tracking resume when the app is reopened?)
- a substitute helper via `set_trip_helper`
- two buses at once
- a parent with 2 children on different buses
